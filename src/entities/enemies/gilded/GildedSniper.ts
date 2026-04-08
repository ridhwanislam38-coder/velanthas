import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import type { Player } from '../../Player';

// GildedSniper — long range crossbow, uses cover (stays near walls)
// Fires a charged bolt at long range (very high damage)
// Retreats to near-wall position to reload
// Pattern A: charge shot → reload cover → charge shot
// Pattern B: rapid 3-bolt burst (shorter range)

export type EnemyState =
  | 'seek_cover' | 'cover' | 'aim'
  | 'telegraph_heavy' | 'telegraph_light'
  | 'attack_bolt' | 'attack_burst'
  | 'reload' | 'stagger' | 'dead';

const DETECT_RANGE  = 350;
const SNIPE_RANGE   = 320;
const BURST_RANGE   = 180;
const MOVE_SPEED    = 65;
const COVER_DIST    = 20;   // px from world edge to seek as "wall cover"

export class GildedSniper {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;

  private _state: EnemyState = 'seek_cover';
  private _stateTimer  = 0;
  private _attackTimer = 0;
  private _telegraphFrame = 0;

  private _hp:     number;
  private _maxHp:  number;
  private _hitCount = 0;
  private _patternStep = 0;
  private _burstCount = 0;

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  // Cover position (near wall)
  private _coverX: number;
  private _atCover = false;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_heavy: 20,
    telegraph_light: 12,
  };

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
    hp = DIFFICULTY.HP.GUARD,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._hp = this._maxHp = hp;
    // Prefer cover near walls — pick nearest side
    this._coverX = x < scene.scale.width / 2
      ? COVER_DIST + 16
      : scene.scale.width - COVER_DIST - 16;

    this.sprite = scene.physics.add.image(x, y, 'gilded_sniper');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      player.x, player.y,
    );

    this._stateTimer  += delta;
    this._attackTimer  = Math.max(0, this._attackTimer - delta);

    this._updateFacing(player);
    this._runState(dist, delta, player);
  }

  private _runState(dist: number, delta: number, player: Player): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    switch (this._state) {
      case 'seek_cover': {
        // Move toward cover wall position
        const dxCover = this._coverX - this.sprite.x;
        if (Math.abs(dxCover) > 10) {
          body.setVelocityX(Math.sign(dxCover) * MOVE_SPEED);
        } else {
          body.setVelocityX(0);
          this._atCover = true;
          this._transition('cover');
        }
        break;
      }

      case 'cover': {
        body.setVelocityX(0);
        if (this._stateTimer > 400 && this._attackTimer <= 0 && dist < DETECT_RANGE) {
          this._transition('aim');
        }
        break;
      }

      case 'aim': {
        body.setVelocityX(0);
        // Choose attack based on range
        if (dist <= BURST_RANGE && this._playerAttackCount >= DIFFICULTY.ATTACK_SPAM_THRESHOLD) {
          this._burstCount = 0;
          this._playerAttackCount = 0;
          this._transition('telegraph_light');
        } else if (dist <= SNIPE_RANGE) {
          this._transition('telegraph_heavy');
        } else {
          // Too far — wait at cover
          this._transition('cover');
        }
        break;
      }

      case 'telegraph_heavy': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES['telegraph_heavy'] ?? 20;
        if (this._telegraphFrame === 1) this._juice.onTelegraphHeavy(this.sprite);
        const hintLevel = Deaths.getHintLevel('telegraph_heavy');
        if ((hintLevel === 1 || hintLevel === 2) && this._telegraphFrame === needed - 3) {
          const dur = hintLevel === 1 ? DIFFICULTY.HINT_WINDOW_MS.LEVEL_1 : DIFFICULTY.HINT_WINDOW_MS.LEVEL_2;
          this._juice.slowMo(0.4, dur * 0.5);
        }
        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._transition('attack_bolt');
        }
        break;
      }

      case 'telegraph_light': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES['telegraph_light'] ?? 12;
        if (this._telegraphFrame === 1) this._juice.onTelegraphLight(this.sprite);
        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._transition('attack_burst');
        }
        break;
      }

      case 'attack_bolt': {
        body.setVelocityX(0);
        if (this._stateTimer > 100) {
          this._fireBolt(player, false);
          this._attackTimer = 2500;
          this._transition('reload');
        }
        break;
      }

      case 'attack_burst': {
        // 3 bolts rapid-fire
        if (this._stateTimer > 180 && this._burstCount < 3) {
          this._fireBolt(player, true);
          this._burstCount++;
          this._stateTimer = 0;
        }
        if (this._burstCount >= 3) {
          this._attackTimer = 2000;
          this._transition('reload');
        }
        break;
      }

      case 'reload': {
        body.setVelocityX(0);
        if (this._stateTimer > 800) {
          this._transition('seek_cover');
        }
        break;
      }

      case 'stagger': {
        body.setVelocityX(0);
        if (this._stateTimer > 400) this._transition('seek_cover');
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _fireBolt(player: Player, isBurst: boolean): void {
    const dirX = player.x - this.sprite.x;
    const dirY = player.y - this.sprite.y;
    const len  = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const speed = isBurst ? 220 : 380;
    const dmg   = isBurst ? 12 : 45;
    const kb    = isBurst ? 80 : 200;

    const bolt = this._scene.physics.add.image(this.sprite.x, this.sprite.y, 'bolt_projectile');
    bolt.setDepth(9);
    bolt.setRotation(Math.atan2(dirY, dirX));
    const boltBody = bolt.body as Phaser.Physics.Arcade.Body;
    boltBody.setVelocity((dirX / len) * speed, (dirY / len) * speed);
    boltBody.setAllowGravity(false);

    this._scene.time.delayedCall(2000, () => { if (bolt.active) bolt.destroy(); });

    const BOLT_RANGE = 20;
    const tick = this._scene.time.addEvent({
      delay: 16, repeat: 120,
      callback: () => {
        if (!bolt.active) { tick.remove(); return; }
        const d = Phaser.Math.Distance.Between(bolt.x, bolt.y, player.x, player.y);
        if (d < BOLT_RANGE) {
          player.receiveHit(dmg, kb, isBurst ? 10 : 24);
          bolt.destroy();
          tick.remove();
        }
      },
    });
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) { this._die(_attacker); return; }

    // Sniper breaks from cover when hit — seeks new cover position
    this._coverX = this.sprite.x > this._scene.scale.width / 2
      ? COVER_DIST + 16
      : this._scene.scale.width - COVER_DIST - 16;

    this._transition('stagger');
  }

  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  private _die(killer: Player): void {
    this._state = 'dead';
    killer.ap.gain(2, 'kill');
    this._juice.onKill(this.sprite);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 800,
      delay: 500,
      onComplete: () => this.sprite.destroy(),
    });
  }

  private _transition(next: EnemyState): void {
    this._state = next;
    this._stateTimer = 0;
  }

  private _updateFacing(player: Player): void {
    this.sprite.setFlipX(!(player.x > this.sprite.x));
  }

  get stance(): FightStance {
    return {
      x: this.sprite.x, y: this.sprite.y,
      facing: this.sprite.flipX ? 'left' : 'right',
      width: this.sprite.displayWidth,
      height: this.sprite.displayHeight,
    };
  }
  get hp(): number { return this._hp; }
  get maxHp(): number { return this._maxHp; }
  get hpPct(): number { return this._hp / this._maxHp; }
  get isDead(): boolean { return this._state === 'dead'; }
  get state(): EnemyState { return this._state; }
}

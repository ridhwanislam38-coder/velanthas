import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import type { Player } from '../../Player';

// SongbirdArcher — aerial (floats), arrow barrage pattern
// Floats at a fixed height, fires arrow barrage (5 arrows spread)
// When forced to ground (hit), switches to ground melee pattern briefly

export type EnemyState =
  | 'patrol' | 'detect' | 'hover'
  | 'telegraph_light' | 'telegraph_heavy'
  | 'attack_barrage' | 'attack_light' | 'attack_heavy'
  | 'grounded' | 'stagger' | 'recover' | 'dead';

const DETECT_RANGE   = 280;
const RANGED_RANGE   = 220;
const HOVER_HEIGHT   = -80;  // px above ground (negative Y offset)
const GROUND_RECOVER = 2000; // ms before taking flight again
const MOVE_SPEED     = 60;
const PATROL_SPEED   = 35;

export class SongbirdArcher {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;

  private _state: EnemyState = 'patrol';
  private _stateTimer  = 0;
  private _attackTimer = 0;
  private _telegraphFrame = 0;
  private _patrolDir: 1 | -1 = 1;
  private _patrolBounce = 0;

  private _hp:     number;
  private _maxHp:  number;
  private _hitCount = 0;
  private _patternStep = 0;
  private _barrageCount = 0;

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  private _groundY = 0;   // spawn Y = ground reference
  private _isAerial = false;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light: 12,
    telegraph_heavy: 16,
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
    this._groundY = y;

    this.sprite = scene.physics.add.image(x, y, 'songbird_archer');
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
      case 'patrol': {
        body.setVelocityX(PATROL_SPEED * this._patrolDir);
        body.setAllowGravity(true);
        this._patrolBounce += delta;
        if (this._patrolBounce > 2000) {
          this._patrolBounce = 0;
          this._patrolDir = (this._patrolDir * -1) as 1 | -1;
          this.sprite.setFlipX(this._patrolDir < 0);
        }
        if (dist < DETECT_RANGE) this._transition('detect');
        break;
      }

      case 'detect': {
        body.setVelocityX(0);
        if (this._stateTimer > 300) {
          this._takeToAir();
          this._transition('hover');
        }
        break;
      }

      case 'hover': {
        // Maintain hover height — cancel gravity, seek hover Y
        body.setAllowGravity(false);
        const targetY = this._groundY + HOVER_HEIGHT;
        const dyToTarget = targetY - this.sprite.y;
        body.setVelocityY(Phaser.Math.Clamp(dyToTarget * 3, -80, 80));

        // Follow player X at range
        const hDist = Math.abs(player.x - this.sprite.x);
        if (hDist > RANGED_RANGE) {
          const dir = player.x > this.sprite.x ? 1 : -1;
          body.setVelocityX(MOVE_SPEED * dir);
        } else {
          body.setVelocityX(0);
        }

        if (dist > DETECT_RANGE * 1.3) { this._land(); this._transition('patrol'); break; }

        if (this._attackTimer <= 0 && hDist <= RANGED_RANGE) {
          this._barrageCount = 0;
          this._transition('telegraph_heavy');
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
          this._transition('attack_light');
        }
        break;
      }

      case 'telegraph_heavy': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES['telegraph_heavy'] ?? 16;
        if (this._telegraphFrame === 1) this._juice.onTelegraphHeavy(this.sprite);
        const hintLevel = Deaths.getHintLevel('telegraph_heavy');
        if ((hintLevel === 1 || hintLevel === 2) && this._telegraphFrame === needed - 3) {
          const dur = hintLevel === 1 ? DIFFICULTY.HINT_WINDOW_MS.LEVEL_1 : DIFFICULTY.HINT_WINDOW_MS.LEVEL_2;
          this._juice.slowMo(0.4, dur * 0.5);
        }
        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._transition('attack_barrage');
        }
        break;
      }

      case 'attack_barrage': {
        // Fire 5 arrows in spread, with 120ms between each
        if (this._stateTimer > 120 && this._barrageCount < 5) {
          this._fireArrow(player, (this._barrageCount - 2) * 15); // spread angle
          this._barrageCount++;
          this._stateTimer = 0;
        }
        if (this._barrageCount >= 5) {
          this._attackTimer = 2200;
          this._transition('recover');
        }
        break;
      }

      case 'attack_light': {
        body.setVelocityX(0);
        if (this._stateTimer > 200) {
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            const data = ATTACK_DATA['light'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._attackTimer = 900;
          this._transition('recover');
        }
        break;
      }

      case 'attack_heavy': {
        body.setVelocityX(0);
        if (this._stateTimer > 240) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            const data = ATTACK_DATA['heavy'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._attackTimer = 1400;
          this._transition('recover');
        }
        break;
      }

      case 'grounded': {
        // Hit down — melee mode briefly
        body.setAllowGravity(true);
        body.setVelocityX(0);
        if (this._stateTimer > GROUND_RECOVER) {
          this._takeToAir();
          this._transition('hover');
        }
        break;
      }

      case 'stagger': {
        body.setVelocityX(0);
        break;
      }

      case 'recover': {
        body.setVelocityX(0);
        if (this._stateTimer > 350) {
          if (this._isAerial) this._transition('hover');
          else this._transition('grounded');
        }
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _fireArrow(player: Player, angleOffset: number): void {
    const dirX = player.x - this.sprite.x;
    const dirY = player.y - this.sprite.y;
    const baseAngle = Math.atan2(dirY, dirX);
    const angle = baseAngle + (angleOffset * Math.PI / 180);
    const speed = 260;

    const arrow = this._scene.physics.add.image(this.sprite.x, this.sprite.y, 'arrow_projectile');
    arrow.setDepth(9);
    arrow.setRotation(angle);
    const ab = arrow.body as Phaser.Physics.Arcade.Body;
    ab.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    ab.setAllowGravity(false);

    this._scene.time.delayedCall(2000, () => { if (arrow.active) arrow.destroy(); });

    const ARROW_DAMAGE = 14;
    const ARROW_RANGE  = 22;
    const tick = this._scene.time.addEvent({
      delay: 16, repeat: 120,
      callback: () => {
        if (!arrow.active) { tick.remove(); return; }
        const d = Phaser.Math.Distance.Between(arrow.x, arrow.y, player.x, player.y);
        if (d < ARROW_RANGE) {
          player.receiveHit(ARROW_DAMAGE, 100, 12);
          arrow.destroy();
          tick.remove();
        }
      },
    });
  }

  private _takeToAir(): void {
    this._isAerial = true;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
  }

  private _land(): void {
    this._isAerial = false;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 900;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) { this._die(_attacker); return; }

    // Heavy hits ground the archer
    if (result.data.hitstun > 20) {
      this._land();
      this._transition('grounded');
    } else {
      this._transition('stagger');
      this._scene.time.delayedCall(350, () => {
        if (this._state === 'stagger') this._transition('recover');
      });
    }
  }

  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  private _die(killer: Player): void {
    this._state = 'dead';
    this._land();
    killer.ap.gain(2, 'kill');
    this._juice.onKill(this.sprite);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0, y: this.sprite.y + 30,
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

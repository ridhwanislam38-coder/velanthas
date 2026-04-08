import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import type { Player } from '../../Player';

// IronveilArcher — ranged attacker
// Fires arrow projectile at 200px range, retreats when player closes to melee

export type EnemyState =
  | 'patrol' | 'detect' | 'approach' | 'retreat'
  | 'telegraph_light' | 'telegraph_heavy'
  | 'attack_light' | 'attack_heavy' | 'attack_ranged'
  | 'stagger' | 'recover' | 'backoff' | 'dead';

const DETECT_RANGE  = 300;
const RANGED_RANGE  = 200;
const MELEE_FLEE    = 80;   // flee if player gets this close
const MOVE_SPEED    = 55;
const PATROL_SPEED  = 30;
const RETREAT_SPEED = 90;

export class IronveilArcher {
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

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light: 14,
    telegraph_heavy: 18,
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

    this.sprite = scene.physics.add.image(x, y, 'ironveil_archer');
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
        if (this._stateTimer > 300) this._transition('approach');
        break;
      }

      case 'approach': {
        // Archer seeks optimal range — not melee range
        if (dist < MELEE_FLEE) {
          this._transition('retreat');
          break;
        }
        if (dist > DETECT_RANGE * 1.2) {
          this._transition('patrol');
          break;
        }
        if (dist <= RANGED_RANGE && this._attackTimer <= 0) {
          // Telegraph arrow shot
          this._patternStep = 0;
          this._transition('telegraph_light');
          break;
        }
        // Move toward optimal range
        const dir = dist > RANGED_RANGE ? (player.x > this.sprite.x ? 1 : -1) : 0;
        body.setVelocityX(MOVE_SPEED * dir);
        break;
      }

      case 'retreat': {
        // Back away fast from melee player
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(RETREAT_SPEED * awayDir);
        if (this._stateTimer > 800) {
          this._transition('approach');
        }
        break;
      }

      case 'telegraph_light': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 14;

        if (this._telegraphFrame === 1) {
          this._juice.onTelegraphLight(this.sprite);
        }

        const hintLevel = Deaths.getHintLevel(this._state);
        if (hintLevel === 1 || hintLevel === 2) {
          const dur = hintLevel === 1 ? DIFFICULTY.HINT_WINDOW_MS.LEVEL_1 : DIFFICULTY.HINT_WINDOW_MS.LEVEL_2;
          if (this._telegraphFrame === needed - 3) this._juice.slowMo(0.4, dur * 0.5);
        }

        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._transition('attack_ranged');
        }
        break;
      }

      case 'telegraph_heavy': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 18;

        if (this._telegraphFrame === 1) {
          this._juice.onTelegraphHeavy(this.sprite);
        }

        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._transition('attack_heavy');
        }
        break;
      }

      case 'attack_ranged': {
        body.setVelocityX(0);
        if (this._stateTimer > 150) {
          this._fireArrow(player);
          this._attackTimer = 1800;
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
          this._transition('recover');
        }
        break;
      }

      case 'attack_heavy': {
        body.setVelocityX(0);
        if (this._stateTimer > 200) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            const data = ATTACK_DATA['heavy'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._transition('recover');
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
          this._transition('approach');
        }
        break;
      }

      case 'backoff': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(MOVE_SPEED * awayDir);
        if (this._stateTimer > 1200) {
          this._hitCount = 0;
          this._transition('approach');
        }
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _fireArrow(player: Player): void {
    // Spawn an arrow projectile — a simple image that moves toward player
    const dirX = player.x - this.sprite.x;
    const dirY = player.y - this.sprite.y;
    const len  = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const speed = 280;

    const arrow = this._scene.physics.add.image(this.sprite.x, this.sprite.y, 'arrow_projectile');
    arrow.setDepth(9);
    const arrowBody = arrow.body as Phaser.Physics.Arcade.Body;
    arrowBody.setVelocity((dirX / len) * speed, (dirY / len) * speed);
    arrowBody.setAllowGravity(false);
    arrow.setRotation(Math.atan2(dirY, dirX));

    // Auto-destroy after 2s; also check overlap with player in scene
    this._scene.time.delayedCall(2000, () => {
      if (arrow.active) arrow.destroy();
    });

    // Arrow damage: check proximity each frame for 2s
    const ARROW_DAMAGE = 18;
    const ARROW_RANGE  = 24;
    const tick = this._scene.time.addEvent({
      delay: 16,
      repeat: 120,
      callback: () => {
        if (!arrow.active) { tick.remove(); return; }
        const dist = Phaser.Math.Distance.Between(arrow.x, arrow.y, player.x, player.y);
        if (dist < ARROW_RANGE) {
          player.receiveHit(ARROW_DAMAGE, 120, 14);
          arrow.destroy();
          tick.remove();
        }
      },
    });
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 800;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) { this._die(_attacker); return; }

    this._transition('stagger');
    this._scene.time.delayedCall(400, () => {
      if (this._state === 'stagger') this._transition('retreat');
    });
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

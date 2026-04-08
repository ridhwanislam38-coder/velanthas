import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { DIFFICULTY } from '../../../config/difficultyConfig';
import { SightComponent } from '../../../systems/SightSystem';
import type { Player } from '../../Player';

// EchoSelf — MEMORY_SIGHT: always knows player position
// Mirrors player's last action: if player attacked → EchoSelf attacks back with same type
// Reflects player behavior — punishes repetition

export type EnemyState =
  | 'patrol' | 'detect' | 'approach'
  | 'telegraph_light' | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_light' | 'attack_heavy' | 'attack_unblockable'
  | 'stagger' | 'recover' | 'backoff' | 'dead';

const DETECT_RANGE = 9999; // MEMORY_SIGHT — always knows
const ATTACK_RANGE = 65;
const MOVE_SPEED   = 72;
const PATROL_SPEED = 40;

export class EchoSelf {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;
  private _sight:  SightComponent;

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

  // Last player action mirroring
  private _lastPlayerAction: 'light' | 'heavy' | 'unblockable' = 'light';
  private _mirrorQueue: EnemyState[] = [];

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light:       12,
    telegraph_heavy:       18,
    telegraph_unblockable: 20,
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

    this.sprite = scene.physics.add.image(x, y, 'echo_self');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setTint(0x8844cc); // void tint

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);

    this._sight = new SightComponent(scene, this.sprite, { type: 'MEMORY_SIGHT' });
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    // MEMORY_SIGHT — always RED
    this._sight.checkPlayer(player.x, player.y);

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
        // Immediately transitions — MEMORY_SIGHT means always aware
        body.setVelocityX(PATROL_SPEED * this._patrolDir);
        this._patrolBounce += delta;
        if (this._patrolBounce > 2000) {
          this._patrolBounce = 0;
          this._patrolDir = (this._patrolDir * -1) as 1 | -1;
          this.sprite.setFlipX(this._patrolDir < 0);
        }
        // MEMORY_SIGHT: always detects
        this._transition('detect');
        break;
      }

      case 'detect': {
        body.setVelocityX(0);
        if (this._stateTimer > 200) this._transition('approach');
        break;
      }

      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * dir);
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          // Mirror player's last action
          this._buildMirrorPattern();
          this._executeNextInPattern();
        }
        break;
      }

      case 'telegraph_light':
      case 'telegraph_heavy':
      case 'telegraph_unblockable': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 12;

        if (this._telegraphFrame === 1) {
          if (this._state === 'telegraph_light') this._juice.onTelegraphLight(this.sprite);
          else if (this._state === 'telegraph_heavy') this._juice.onTelegraphHeavy(this.sprite);
          else this._juice.onTelegraphUnblockable(this.sprite);
        }

        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_light': {
        body.setVelocityX(0);
        if (this._stateTimer > 180) {
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            const data = ATTACK_DATA['light'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_heavy': {
        body.setVelocityX(0);
        if (this._stateTimer > 220) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            const data = ATTACK_DATA['heavy'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_unblockable': {
        body.setVelocityX(0);
        if (this._stateTimer > 250) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(50, 200, 30);
          }
          this._executeNextInPattern();
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
          if (this._hitCount >= 3) this._transition('backoff');
          else this._transition('approach');
        }
        break;
      }

      case 'backoff': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(MOVE_SPEED * awayDir);
        if (this._stateTimer > 1000) {
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

  /** Called externally when player performs an action */
  recordPlayerAction(actionType: 'light' | 'heavy' | 'unblockable'): void {
    this._lastPlayerAction = actionType;
  }

  private _buildMirrorPattern(): void {
    // Mirror player's last action — same type back at them
    this._mirrorQueue = [];
    switch (this._lastPlayerAction) {
      case 'light':
        this._mirrorQueue = ['telegraph_light', 'attack_light', 'telegraph_light', 'attack_light'];
        break;
      case 'heavy':
        this._mirrorQueue = ['telegraph_heavy', 'attack_heavy'];
        break;
      case 'unblockable':
        this._mirrorQueue = ['telegraph_unblockable', 'attack_unblockable'];
        break;
    }
    this._patternStep = 0;
  }

  private _executeNextInPattern(): void {
    const next = this._mirrorQueue[this._patternStep];
    if (next) {
      this._transition(next);
      this._patternStep++;
    } else {
      this._patternStep = 0;
      this._attackTimer = 1200;
      this._transition('recover');
    }
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 1000;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.setTint(0x8844cc);
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) { this._die(_attacker); return; }

    this._transition('stagger');
    this._scene.time.delayedCall(450, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

  recordPlayerDodge(): void  { /* MEMORY_SIGHT — no dodge tracking needed */ }
  recordPlayerAttack(): void { this.recordPlayerAction('light'); }

  private _die(killer: Player): void {
    this._state = 'dead';
    this._sight.destroy();
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
    if (this._state === 'approach' || this._state === 'detect') {
      this.sprite.setFlipX(!(player.x > this.sprite.x));
    }
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

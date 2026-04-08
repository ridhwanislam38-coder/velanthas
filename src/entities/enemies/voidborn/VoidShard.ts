import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import type { Player } from '../../Player';

// VoidShard — fragments on hit, spawns 2 smaller shards
// When fragmenting, uses Bus.emit(ENEMY_SPECIAL) to signal the parent system
// Smaller = isFragment flag, no further splitting

export type EnemyState =
  | 'patrol' | 'detect' | 'approach'
  | 'telegraph_light' | 'telegraph_unblockable'
  | 'attack_light' | 'attack_slam'
  | 'fragmenting' | 'stagger' | 'recover' | 'dead';

const DETECT_RANGE = 180;
const ATTACK_RANGE = 55;
const MOVE_SPEED   = 85;
const PATROL_SPEED = 45;

export class VoidShard {
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

  /** If true, this is a child shard — will NOT fragment further */
  readonly isFragment: boolean;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light:       12,
    telegraph_unblockable: 15,
  };

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
    hp = DIFFICULTY.HP.GUARD,
    isFragment = false,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._hp = this._maxHp = isFragment ? Math.floor(hp * 0.4) : hp;
    this.isFragment = isFragment;

    const key = isFragment ? 'void_shard_small' : 'void_shard';
    this.sprite = scene.physics.add.image(x, y, key);
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);

    if (isFragment) {
      this.sprite.setScale(0.6);
    }

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead' || this._state === 'fragmenting') return;

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
        if (this._patrolBounce > 1500) {
          this._patrolBounce = 0;
          this._patrolDir = (this._patrolDir * -1) as 1 | -1;
          this.sprite.setFlipX(this._patrolDir < 0);
        }
        if (dist < DETECT_RANGE) this._transition('detect');
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
        if (dist > DETECT_RANGE * 1.3) this._transition('patrol');
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._patternStep = 0;
          this._executeNextInPattern();
        }
        break;
      }

      case 'telegraph_light':
      case 'telegraph_unblockable': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 12;
        if (this._telegraphFrame === 1) {
          if (this._state === 'telegraph_light') this._juice.onTelegraphLight(this.sprite);
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
        if (this._stateTimer > 160) {
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            const data = ATTACK_DATA['light'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_slam': {
        body.setVelocityX(0);
        if (this._stateTimer > 220) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(35, 180, 22);
          }
          this._attackTimer = 1200;
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
        if (this._stateTimer > 300) this._transition('approach');
        break;
      }

      case 'dead':
      case 'fragmenting':
        break;
    }
    void delta;
  }

  private _executeNextInPattern(): void {
    const steps: EnemyState[] = [
      'telegraph_light', 'attack_light',
      'telegraph_unblockable', 'attack_slam',
    ];
    const next = steps[this._patternStep];
    if (next) { this._transition(next); this._patternStep++; }
    else { this._patternStep = 0; this._attackTimer = 1000; this._transition('recover'); }
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead' || this._state === 'fragmenting') return;

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

    if (this._hp <= 0) {
      if (!this.isFragment) {
        this._fragment(_attacker);
      } else {
        this._die(_attacker);
      }
      return;
    }

    this._transition('stagger');
    this._scene.time.delayedCall(350, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

  private _fragment(killer: Player): void {
    this._transition('fragmenting');

    // Signal to parent scene to spawn 2 child shards
    Bus.emit(GameEvent.ENEMY_STAGGER, {
      id: 'void_shard_split',
      sourceX: this.sprite.x,
      sourceY: this.sprite.y,
      parentSprite: this.sprite,
    });

    this._juice.flash(0x8800ff, 0.7, 100);
    this._juice.shake(0.004, 200);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 300,
      onComplete: () => {
        this._state = 'dead';
        killer.ap.gain(1, 'kill');
        this.sprite.destroy();
      },
    });
  }

  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  private _die(killer: Player): void {
    this._state = 'dead';
    killer.ap.gain(this.isFragment ? 1 : 2, 'kill');
    this._juice.onKill(this.sprite);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 600,
      delay: 300,
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

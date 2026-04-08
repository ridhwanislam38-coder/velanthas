import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { DIFFICULTY } from '../../../config/difficultyConfig';
import { SightComponent } from '../../../systems/SightSystem';
import type { Player } from '../../Player';

// SilentMirror — MEMORY_SIGHT, copies player's last 3 attack inputs and repeats them
// Learns player's combo and echoes it back after a brief delay
// Pattern: record player attacks → wait → replay exact sequence

export type EnemyState =
  | 'observe' | 'approach'
  | 'telegraph_light' | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_light' | 'attack_heavy' | 'attack_unblockable'
  | 'stagger' | 'recover' | 'dead';

type RecordedAttack = 'light' | 'heavy' | 'unblockable';

const DETECT_RANGE = 9999; // MEMORY_SIGHT
const ATTACK_RANGE = 70;
const MOVE_SPEED   = 65;

export class SilentMirror {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;
  private _sight:  SightComponent;

  private _state: EnemyState = 'observe';
  private _stateTimer  = 0;
  private _attackTimer = 0;
  private _telegraphFrame = 0;

  private _hp:     number;
  private _maxHp:  number;
  private _hitCount = 0;

  // Recording buffer — last 3 player attacks
  private _recordBuffer: RecordedAttack[] = [];
  // Playback queue — what we're currently executing
  private _playbackQueue: EnemyState[] = [];
  private _playbackStep = 0;

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

    this.sprite = scene.physics.add.image(x, y, 'silent_mirror');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setTint(0xccccff); // mirror silver tint

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);

    this._sight = new SightComponent(scene, this.sprite, { type: 'MEMORY_SIGHT' });
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

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

  /** Called when player performs an attack — mirror records it */
  recordPlayerAttack(type: RecordedAttack): void {
    this._recordBuffer.push(type);
    if (this._recordBuffer.length > 3) {
      this._recordBuffer.shift(); // keep last 3 only
    }
  }

  private _runState(dist: number, delta: number, player: Player): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    switch (this._state) {
      case 'observe': {
        // Follow at safe distance, observing
        const followDist = 120;
        if (dist > followDist + 20) {
          const dir = player.x > this.sprite.x ? 1 : -1;
          body.setVelocityX(MOVE_SPEED * 0.7 * dir);
        } else {
          body.setVelocityX(0);
        }
        // After recording 3 attacks and getting close, replay
        if (this._recordBuffer.length >= 3 && dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._buildPlaybackQueue();
          this._playbackStep = 0;
          this._transition('approach');
        }
        break;
      }

      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * dir);
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._executeNextPlayback();
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
          this._executeNextPlayback();
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
          this._executeNextPlayback();
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
          this._executeNextPlayback();
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
          this._executeNextPlayback();
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
          // Reset record buffer to start observing fresh
          this._recordBuffer = [];
          this._transition('observe');
        }
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _buildPlaybackQueue(): void {
    this._playbackQueue = [];
    for (const atk of this._recordBuffer) {
      switch (atk) {
        case 'light':
          this._playbackQueue.push('telegraph_light', 'attack_light');
          break;
        case 'heavy':
          this._playbackQueue.push('telegraph_heavy', 'attack_heavy');
          break;
        case 'unblockable':
          this._playbackQueue.push('telegraph_unblockable', 'attack_unblockable');
          break;
      }
    }
    this._playbackStep = 0;
  }

  private _executeNextPlayback(): void {
    const next = this._playbackQueue[this._playbackStep];
    if (next) {
      this._transition(next);
      this._playbackStep++;
    } else {
      this._playbackStep = 0;
      this._attackTimer = 1400;
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
      if (this._state !== 'dead') this.sprite.setTint(0xccccff);
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) { this._die(_attacker); return; }

    // Interrupt playback on hit — reset observation
    this._playbackQueue = [];
    this._playbackStep = 0;

    this._transition('stagger');
    this._scene.time.delayedCall(400, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

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

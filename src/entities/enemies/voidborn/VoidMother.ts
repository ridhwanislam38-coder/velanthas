import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import type { Player } from '../../Player';

// VoidMother — spawns VoidShards periodically
// Vulnerable ONLY while spawning (is open / exposed)
// Otherwise: deflects attacks, takes 0 damage

export type EnemyState =
  | 'idle' | 'approach' | 'spawning'
  | 'telegraph_heavy'
  | 'attack_heavy' | 'attack_slam'
  | 'stagger' | 'recover' | 'dead';

const DETECT_RANGE  = 300;
const ATTACK_RANGE  = 90;
const MOVE_SPEED    = 45;
const SPAWN_INTERVAL = 5000; // ms between spawns

export class VoidMother {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;

  private _state: EnemyState = 'idle';
  private _stateTimer  = 0;
  private _attackTimer = 0;
  private _telegraphFrame = 0;

  private _hp:     number;
  private _maxHp:  number;
  private _hitCount = 0;
  private _patternStep = 0;

  private _spawning    = false;  // vulnerability window
  private _spawnTimer  = 0;
  private _shardCount  = 0;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_heavy: 20,
  };

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
    hp = DIFFICULTY.HP.ELITE,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._hp = this._maxHp = hp;

    this.sprite = scene.physics.add.image(x, y, 'void_mother');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(1.8);

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
    this._spawnTimer  -= delta;

    // Periodic spawning
    const vmState: string = this._state;
    if (this._spawnTimer <= 0 && vmState !== 'spawning' && vmState !== 'dead') {
      this._spawnTimer = SPAWN_INTERVAL;
      this._beginSpawning();
    }

    this._updateFacing(player);
    this._runState(dist, delta, player);
  }

  private _runState(dist: number, delta: number, player: Player): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    switch (this._state) {
      case 'idle': {
        body.setVelocityX(0);
        if (dist < DETECT_RANGE) this._transition('approach');
        break;
      }

      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * dir);
        if (dist > DETECT_RANGE * 1.5) this._transition('idle');
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._patternStep = 0;
          this._executeNextInPattern();
        }
        break;
      }

      case 'spawning': {
        // Open — vulnerable — don't move
        body.setVelocityX(0);
        this._spawning = true;
        if (this._stateTimer > 1500) {
          this._spawning = false;
          this._transition('recover');
        }
        break;
      }

      case 'telegraph_heavy': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES['telegraph_heavy'] ?? 20;
        if (this._telegraphFrame === 1) this._juice.onTelegraphHeavy(this.sprite);
        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_heavy': {
        body.setVelocityX(0);
        if (this._stateTimer > 250) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            const data = ATTACK_DATA['heavy'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_slam': {
        body.setVelocityX(0);
        if (this._stateTimer > 300) {
          if (dist < ATTACK_RANGE * 1.3) {
            player.receiveHit(50, 220, 30);
            this._juice.shake(0.007, 250);
          }
          this._attackTimer = 2000;
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
        if (this._stateTimer > 500) this._transition('approach');
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _executeNextInPattern(): void {
    const steps: EnemyState[] = ['telegraph_heavy', 'attack_heavy', 'telegraph_heavy', 'attack_slam'];
    const next = steps[this._patternStep];
    if (next) { this._transition(next); this._patternStep++; }
    else { this._patternStep = 0; this._attackTimer = 2200; this._transition('recover'); }
  }

  private _beginSpawning(): void {
    this._transition('spawning');
    this._shardCount += 2;

    // Signal to scene to spawn 2 VoidShards near VoidMother
    Bus.emit(GameEvent.ENEMY_STAGGER, {
      id: 'void_mother_spawn',
      sourceX: this.sprite.x,
      sourceY: this.sprite.y,
      count: 2,
    });

    this._juice.flash(0x8800ff, 0.4, 150);
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    // Only takes damage while spawning (vulnerable window)
    if (!this._spawning) {
      // Deflect — no damage, visual bounce
      this._juice.flash(0x440088, 0.3, 60);
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      const kbDir = this.sprite.flipX ? 1 : -1;
      body.setVelocityX(result.data.knockback * 0.3 * kbDir);
      return;
    }

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

    this._spawning = false;
    this._transition('stagger');
    this._scene.time.delayedCall(600, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

  private _die(killer: Player): void {
    this._state = 'dead';
    killer.ap.gain(4, 'kill');
    Bus.emit(GameEvent.ENEMY_DEATH, { entity: this.sprite, id: 'void_mother' });
    this._juice.onKill(this.sprite);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 1000,
      delay: 800,
      onComplete: () => this.sprite.destroy(),
    });
  }

  private _transition(next: EnemyState): void {
    this._state = next;
    this._stateTimer = 0;
  }

  private _updateFacing(player: Player): void {
    if (this._state === 'approach') {
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
  get isVulnerable(): boolean { return this._spawning; }
  get state(): EnemyState { return this._state; }
}

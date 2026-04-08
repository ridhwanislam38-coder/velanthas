import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import type { Player } from '../../Player';

// ForsakenSoldier — undead guard, resurrects ONCE after death at 20% HP
// Pattern A: light × 2 → heavy
// Pattern B: feint → grab
// After resurrection: moves faster, attacks faster (desperate)

export type EnemyState =
  | 'patrol' | 'detect' | 'approach'
  | 'telegraph_light' | 'telegraph_heavy'
  | 'attack_light' | 'attack_heavy' | 'attack_grab'
  | 'resurrecting' | 'stagger' | 'recover' | 'backoff' | 'circle' | 'dead';

type AttackPattern = 'A' | 'B';

const DETECT_RANGE   = 200;
const ATTACK_RANGE   = 60;
const GRAB_RANGE     = 45;
const MOVE_SPEED     = 60;
const MOVE_SPEED_RES = 80;  // faster after resurrection
const PATROL_SPEED   = 35;

export class ForsakenSoldier {
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
  private _pattern: AttackPattern = 'A';
  private _patternStep = 0;

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  private _hasResurrected = false; // can only resurrect once
  private _resurrected    = false; // flag: currently in post-resurrection state

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light: 12,
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

    this.sprite = scene.physics.add.image(x, y, 'forsaken_soldier');
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
    const moveSpeed = this._resurrected ? MOVE_SPEED_RES : MOVE_SPEED;

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
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(moveSpeed * dir);
        if (dist > DETECT_RANGE * 1.2) this._transition('patrol');
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._choosePattern(player);
        }
        break;
      }

      case 'resurrecting': {
        body.setVelocityX(0);
        if (this._stateTimer > 1500) {
          this._transition('approach');
        }
        break;
      }

      case 'telegraph_light':
      case 'telegraph_heavy': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 12;

        if (this._telegraphFrame === 1) {
          if (this._state === 'telegraph_light') this._juice.onTelegraphLight(this.sprite);
          else this._juice.onTelegraphHeavy(this.sprite);
        }

        const hintLevel = Deaths.getHintLevel(this._state);
        if (hintLevel === 1 || hintLevel === 2) {
          const dur = hintLevel === 1 ? DIFFICULTY.HINT_WINDOW_MS.LEVEL_1 : DIFFICULTY.HINT_WINDOW_MS.LEVEL_2;
          if (this._telegraphFrame === needed - 3) this._juice.slowMo(0.4, dur * 0.5);
        }

        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_light': {
        body.setVelocityX(0);
        const lightTime = this._resurrected ? 140 : 200;
        if (this._stateTimer > lightTime) {
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
        const heavyTime = this._resurrected ? 160 : 200;
        if (this._stateTimer > heavyTime) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            const data = ATTACK_DATA['heavy'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._patternStep = 0;
          this._attackTimer = 900;
          this._transition('recover');
        }
        break;
      }

      case 'attack_grab': {
        body.setVelocityX(0);
        if (this._stateTimer > 180) {
          if (dist < GRAB_RANGE) {
            player.receiveHit(25, 100, 20);
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
        const recoverMs = this._resurrected ? 280 : 400;
        if (this._stateTimer > recoverMs) {
          if (this._hitCount >= 3) this._transition('backoff');
          else this._transition('approach');
        }
        break;
      }

      case 'backoff': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(moveSpeed * awayDir);
        if (this._stateTimer > 1200) {
          this._hitCount = 0;
          this._transition('circle');
        }
        break;
      }

      case 'circle': {
        const sideDir = Math.sin(this._stateTimer / 300) > 0 ? 1 : -1;
        body.setVelocityX(PATROL_SPEED * sideDir);
        if (this._stateTimer > 1200) this._transition('approach');
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _choosePattern(player: Player): void {
    if (this._playerDodgeCount >= DIFFICULTY.DODGE_SPAM_THRESHOLD) {
      this._pattern = 'B';
      this._playerDodgeCount = 0;
    } else {
      this._pattern = 'A';
    }
    this._patternStep = 0;
    this._executeNextInPattern();
    void player;
  }

  private _executeNextInPattern(): void {
    if (this._pattern === 'A') {
      const steps: EnemyState[] = [
        'telegraph_light', 'attack_light',
        'telegraph_light', 'attack_light',
        'telegraph_heavy', 'attack_heavy',
      ];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._transition('recover'); }
    } else {
      const steps: EnemyState[] = ['telegraph_light', 'attack_grab'];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._transition('recover'); }
    }
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 1200;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') {
        if (this._resurrected) this.sprite.setTint(0x8888ff);
        else this.sprite.clearTint();
      }
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) {
      if (!this._hasResurrected) {
        this._resurrect(_attacker);
      } else {
        this._die(_attacker);
      }
      return;
    }

    this._transition('stagger');
    this._scene.time.delayedCall(500, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

  private _resurrect(_killer: Player): void {
    this._hasResurrected = true;
    this._resurrected = true;
    this._hp = Math.floor(this._maxHp * 0.2); // 20% HP on resurrection
    this._hitCount = 0;

    this._juice.flash(0x8888ff, 0.7, 300);

    // Grey-blue tint for resurrection
    this.sprite.setTint(0x8888ff);

    this._transition('resurrecting');

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
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
  get hasResurrected(): boolean { return this._hasResurrected; }
  get state(): EnemyState { return this._state; }
}

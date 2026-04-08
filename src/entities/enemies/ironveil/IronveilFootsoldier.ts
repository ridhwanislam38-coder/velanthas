import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import type { Player } from '../../Player';

// IronveilFootsoldier — standard soldier
// Pattern A: light×2 → heavy (learnable)
// Pattern B: feint light → grab (punishes mashing)
// Pattern C: charge → unblockable (must dodge)
// Shield: occasionally blocks incoming attacks

export type EnemyState =
  | 'patrol' | 'detect' | 'approach'
  | 'telegraph_light' | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_light' | 'attack_heavy' | 'attack_unblockable' | 'attack_grab'
  | 'shield' | 'stagger' | 'recover' | 'backoff' | 'circle' | 'dead';

type AttackPattern = 'A' | 'B' | 'C';

const DETECT_RANGE = 200;
const ATTACK_RANGE = 60;
const GRAB_RANGE   = 45;
const MOVE_SPEED   = 60;
const PATROL_SPEED = 35;

export class IronveilFootsoldier {
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

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;
  private _patternStep       = 0;

  // Shield: chance to block incoming hit
  private _shieldTimer = 0;
  private _isShielding = false;

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

    this.sprite = scene.physics.add.image(x, y, 'ironveil_footsoldier');
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
    this._shieldTimer  = Math.max(0, this._shieldTimer - delta);

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
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * dir);
        if (dist > DETECT_RANGE * 1.2) this._transition('patrol');
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          // Occasionally raise shield before attacking
          if (this._shieldTimer <= 0 && Math.random() < 0.2) {
            this._transition('shield');
          } else {
            this._choosePattern(player);
          }
        }
        break;
      }

      case 'shield': {
        body.setVelocityX(0);
        this._isShielding = true;
        if (this._stateTimer > 800) {
          this._isShielding = false;
          this._shieldTimer = 3000;
          this._transition('approach');
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
          if (this._state === 'telegraph_light') {
            this._juice.onTelegraphLight(this.sprite);
          } else if (this._state === 'telegraph_heavy') {
            this._juice.onTelegraphHeavy(this.sprite);
          } else {
            this._juice.onTelegraphUnblockable(this.sprite);
          }
        }

        const attackId = this._state;
        const hintLevel = Deaths.getHintLevel(attackId);
        if (hintLevel === 1 || hintLevel === 2) {
          const dur = hintLevel === 1
            ? DIFFICULTY.HINT_WINDOW_MS.LEVEL_1
            : DIFFICULTY.HINT_WINDOW_MS.LEVEL_2;
          if (this._telegraphFrame === needed - 3) {
            this._juice.slowMo(0.4, dur * 0.5);
          }
        }

        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_light':
      case 'attack_heavy': {
        body.setVelocityX(0);
        if (this._stateTimer > 200) {
          const attackType: AttackType = this._state === 'attack_light' ? 'light' : 'heavy';
          const result = checkHit(this.stance, player.stance, attackType);
          if (result.connected) {
            const data = ATTACK_DATA[attackType];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._transition('recover');
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
        if (this._stateTimer > 400) {
          if (this._hitCount >= 3) {
            this._transition('backoff');
          } else {
            this._transition('approach');
          }
        }
        break;
      }

      case 'backoff': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(MOVE_SPEED * awayDir);
        if (this._stateTimer > 1500) {
          this._hitCount = 0;
          this._transition('circle');
        }
        break;
      }

      case 'circle': {
        const sideDir = Math.sin(this._stateTimer / 300) > 0 ? 1 : -1;
        body.setVelocityX(PATROL_SPEED * sideDir);
        if (this._stateTimer > 1500) {
          this._transition('approach');
        }
        break;
      }

      case 'dead':
        break;
    }
  }

  private _choosePattern(player: Player): void {
    if (this._playerDodgeCount >= DIFFICULTY.DODGE_SPAM_THRESHOLD) {
      this._pattern = 'B';
      this._playerDodgeCount = 0;
    } else if (this._playerAttackCount >= DIFFICULTY.ATTACK_SPAM_THRESHOLD) {
      this._pattern = 'C';
      this._playerAttackCount = 0;
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
    } else if (this._pattern === 'B') {
      const steps: EnemyState[] = ['telegraph_light', 'attack_grab'];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._transition('recover'); }
    } else {
      const steps: EnemyState[] = ['telegraph_unblockable', 'attack_unblockable'];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._transition('recover'); }
    }
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    // Shield absorbs hit if shielding (frontal only — not from behind)
    if (this._isShielding) {
      const attackerDir = _attacker.x > this.sprite.x ? 'right' : 'left';
      const facingDir   = this.sprite.flipX ? 'left' : 'right';
      if (attackerDir === facingDir) {
        // Blocked! Chip damage only
        const chip = Math.floor(result.data.damage * 0.1);
        this._hp = Math.max(0, this._hp - chip);
        this._juice.flash(0x4488ff, 0.3, 60);
        return;
      }
    }

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 1200;
    this._isShielding = false;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) { this._die(_attacker); return; }

    this._transition('stagger');
    this._scene.time.delayedCall(500, () => {
      if (this._state === 'stagger') this._transition('recover');
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

import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import type { Player } from '../../Player';

// WailingWraith — passes through walls (ignore horizontal physics)
// When it screams, nearby enemies are alerted (Bus.emit ENEMY_DETECT_RED)
// Pattern A: phase through → touch damage
// Pattern B: scream (attract + AOE fear) → wail strike

export type EnemyState =
  | 'patrol' | 'detect' | 'approach'
  | 'telegraph_light' | 'telegraph_unblockable'
  | 'attack_touch' | 'attack_wail'
  | 'screaming' | 'stagger' | 'recover' | 'dead';

type AttackPattern = 'A' | 'B';

const DETECT_RANGE  = 200;
const TOUCH_RANGE   = 40;
const WAIL_RANGE    = 180;
const MOVE_SPEED    = 55;
const PATROL_SPEED  = 30;
const SCREAM_RADIUS = 320; // alerts nearby enemies

export class WailingWraith {
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

  private _screamTimer = 0;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light:       12,
    telegraph_unblockable: 16,
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

    this.sprite = scene.physics.add.image(x, y, 'wailing_wraith');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(false); // can go out of bounds (wall-phase)
    this.sprite.setAlpha(0.85); // semi-transparent

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);
    body.setAllowGravity(true);
    // Ignore horizontal world collision — phases through walls
    body.checkCollision.left  = false;
    body.checkCollision.right = false;
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      player.x, player.y,
    );

    this._stateTimer  += delta;
    this._attackTimer  = Math.max(0, this._attackTimer - delta);
    this._screamTimer  = Math.max(0, this._screamTimer - delta);

    // Periodic scream if not in combat and detected
    if (this._screamTimer <= 0 && this._state !== 'screaming' && this._state !== 'dead' && dist < DETECT_RANGE) {
      this._screamTimer = 6000;
      this._initiateScream();
    }

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
        if (dist > DETECT_RANGE * 1.5) this._transition('patrol');
        if (dist < TOUCH_RANGE && this._attackTimer <= 0) {
          this._pattern = this._playerAttackCount >= DIFFICULTY.ATTACK_SPAM_THRESHOLD ? 'B' : 'A';
          this._playerAttackCount = 0;
          this._patternStep = 0;
          this._executeNextInPattern();
        }
        break;
      }

      case 'screaming': {
        body.setVelocityX(0);
        if (this._stateTimer > 1200) {
          this._transition('approach');
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

      case 'attack_touch': {
        // Phase through — collision damage
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * 2 * dir);
        if (dist < TOUCH_RANGE) {
          player.receiveHit(20, 120, 15);
          body.setVelocityX(0);
          this._attackTimer = 1000;
          this._transition('recover');
        } else if (this._stateTimer > 400) {
          body.setVelocityX(0);
          this._attackTimer = 800;
          this._transition('recover');
        }
        break;
      }

      case 'attack_wail': {
        body.setVelocityX(0);
        if (this._stateTimer > 300) {
          // Wail strike in range
          if (dist < WAIL_RANGE) {
            player.receiveHit(35, 180, 25);
            this._juice.flash(0xaaaaff, 0.4, 150);
          }
          this._attackTimer = 1600;
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
          if (this._hitCount >= 3) {
            this._hitCount = 0;
            this._transition('patrol'); // retreat through walls
          } else {
            this._transition('approach');
          }
        }
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _executeNextInPattern(): void {
    if (this._pattern === 'A') {
      const steps: EnemyState[] = ['telegraph_light', 'attack_touch'];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._attackTimer = 1000; this._transition('recover'); }
    } else {
      const steps: EnemyState[] = ['telegraph_unblockable', 'attack_wail'];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._transition('recover'); }
    }
  }

  private _initiateScream(): void {
    this._transition('screaming');
    this._juice.flash(0xaaaaff, 0.5, 200);

    // Alert nearby enemies via Bus
    Bus.emit(GameEvent.ENEMY_DETECT_RED, {
      id: 'wraith_scream',
      sourceX: this.sprite.x,
      sourceY: this.sprite.y,
      radius: SCREAM_RADIUS,
    });
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

    this._transition('stagger');
    this._scene.time.delayedCall(400, () => {
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
      scaleX: 1.5, scaleY: 1.5,
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

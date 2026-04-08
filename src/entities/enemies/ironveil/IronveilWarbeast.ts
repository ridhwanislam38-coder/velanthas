import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import type { Player } from '../../Player';

// IronveilWarbeast — large 2-phase beast
// Phase 1 (>40% HP): normal speed, stomp + charge attacks
// Phase 2 (≤40% HP): enraged — speed doubles, gains new slam pattern

export type EnemyState =
  | 'patrol' | 'detect' | 'approach'
  | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_heavy' | 'attack_unblockable' | 'attack_stomp'
  | 'phase_change' | 'stagger' | 'recover' | 'backoff' | 'dead';

const DETECT_RANGE   = 250;
const ATTACK_RANGE   = 90;   // large hitbox
const PHASE2_TRIGGER = 0.4;

const MOVE_SPEED_P1  = 65;
const MOVE_SPEED_P2  = 130;  // doubles in phase 2
const PATROL_SPEED   = 40;

export class IronveilWarbeast {
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

  private _phase: 1 | 2 = 1;
  private _phaseChangeTriggered = false;

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_heavy:       20,
    telegraph_unblockable: 18,
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

    this.sprite = scene.physics.add.image(x, y, 'ironveil_warbeast');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(1.5); // large

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    // Phase 2 trigger check
    if (!this._phaseChangeTriggered && this.hpPct <= PHASE2_TRIGGER) {
      this._phaseChangeTriggered = true;
      this._triggerPhase2();
      return;
    }

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
    const moveSpeed = this._phase === 2 ? MOVE_SPEED_P2 : MOVE_SPEED_P1;

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
        if (this._stateTimer > 400) this._transition('approach');
        break;
      }

      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(moveSpeed * dir);
        if (dist > DETECT_RANGE * 1.2) this._transition('patrol');
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._patternStep = 0;
          this._executePattern();
        }
        break;
      }

      case 'phase_change': {
        body.setVelocityX(0);
        if (this._stateTimer > 1200) {
          this._transition('approach');
        }
        break;
      }

      case 'telegraph_heavy':
      case 'telegraph_unblockable': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 20;

        if (this._telegraphFrame === 1) {
          if (this._state === 'telegraph_heavy') {
            this._juice.onTelegraphHeavy(this.sprite);
          } else {
            this._juice.onTelegraphUnblockable(this.sprite);
          }
        }

        const hintLevel = Deaths.getHintLevel(this._state);
        if (hintLevel === 1 || hintLevel === 2) {
          const dur = hintLevel === 1 ? DIFFICULTY.HINT_WINDOW_MS.LEVEL_1 : DIFFICULTY.HINT_WINDOW_MS.LEVEL_2;
          if (this._telegraphFrame === needed - 3) this._juice.slowMo(0.4, dur * 0.5);
        }

        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._executePattern();
        }
        break;
      }

      case 'attack_heavy': {
        body.setVelocityX(0);
        if (this._stateTimer > 250) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            const data = ATTACK_DATA['heavy'];
            player.receiveHit(data.damage * 1.5 | 0, data.knockback * 1.5 | 0, data.hitstun);
          }
          this._executePattern();
        }
        break;
      }

      case 'attack_unblockable': {
        // Charge attack — momentum-based
        const chargeDir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(200 * chargeDir);
        if (this._stateTimer > 350) {
          body.setVelocityX(0);
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(65, 300, 40);
            this._juice.shake(0.008, 300);
          }
          this._attackTimer = 1600;
          this._patternStep = 0;
          this._transition('recover');
        }
        break;
      }

      case 'attack_stomp': {
        // Ground stomp — AOE near feet
        body.setVelocityX(0);
        if (this._stateTimer > 300) {
          this._juice.shake(0.01, 400);
          if (dist < ATTACK_RANGE * 1.2) {
            player.receiveHit(45, 150, 30);
          }
          this._attackTimer = 1400;
          this._patternStep = 0;
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
        const recoverTime = this._phase === 2 ? 300 : 500;
        if (this._stateTimer > recoverTime) {
          if (this._hitCount >= 4) this._transition('backoff');
          else this._transition('approach');
        }
        break;
      }

      case 'backoff': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(moveSpeed * awayDir);
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

  private _executePattern(): void {
    if (this._phase === 1) {
      // stomp → charge
      const steps: EnemyState[] = [
        'telegraph_heavy', 'attack_stomp',
        'telegraph_unblockable', 'attack_unblockable',
      ];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._attackTimer = 1800; this._transition('recover'); }
    } else {
      // Phase 2: heavy slam → stomp → charge
      const steps: EnemyState[] = [
        'telegraph_heavy', 'attack_heavy',
        'telegraph_heavy', 'attack_stomp',
        'telegraph_unblockable', 'attack_unblockable',
      ];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._attackTimer = 1200; this._transition('recover'); }
    }
  }

  private _triggerPhase2(): void {
    this._phase = 2;
    this._phaseChangeTriggered = true;
    this._patternStep = 0;
    this._attackTimer = 0;

    Bus.emit(GameEvent.BOSS_PHASE_CHANGE, { entity: this.sprite, phase: 2 });
    this._juice.flash(0xff4400, 0.8, 300);
    this._juice.shake(0.012, 500);

    // Red tint for phase 2
    this.sprite.setTint(0xff6644);

    this._transition('phase_change');
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    // Warbeast takes reduced knockback due to size
    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 1000;

    this.sprite.setTint(this._phase === 2 ? 0xff8866 : 0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') {
        this.sprite.setTint(this._phase === 2 ? 0xff6644 : 0xffffff);
        if (this._phase === 1) this.sprite.clearTint();
      }
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX((result.data.knockback * 0.5) * kbDir); // reduced KB

    if (this._hp <= 0) { this._die(_attacker); return; }

    // Only staggers with heavy hits
    if (result.data.hitstun > 20) {
      this._transition('stagger');
      this._scene.time.delayedCall(400, () => {
        if (this._state === 'stagger') this._transition('recover');
      });
    }
  }

  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  private _die(killer: Player): void {
    this._state = 'dead';
    killer.ap.gain(3, 'kill');
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
  get phase(): 1 | 2 { return this._phase; }
}

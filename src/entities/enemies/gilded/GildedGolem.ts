import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import type { Player } from '../../Player';

// GildedGolem — slow, massive knockback
// Enrages when last enemy alive (all other enemies in encounter dead)
// Enraged: speed +50%, damage +50%, adds stomp AOE

export type EnemyState =
  | 'patrol' | 'detect' | 'approach'
  | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_heavy' | 'attack_slam' | 'attack_stomp'
  | 'enrage' | 'stagger' | 'recover' | 'backoff' | 'dead';

const DETECT_RANGE = 200;
const ATTACK_RANGE = 90;
const MOVE_SPEED   = 38;   // very slow
const PATROL_SPEED = 20;

export class GildedGolem {
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

  private _enraged = false;
  private _enrageCheckDone = false;

  // Callback to check if alone (last enemy alive) — set by scene
  private _isLastAlive: () => boolean = () => false;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_heavy:       22,
    telegraph_unblockable: 20,
  };

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
    hp = DIFFICULTY.HP.ELITE,
    isLastAlive?: () => boolean,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._hp = this._maxHp = hp;
    if (isLastAlive) this._isLastAlive = isLastAlive;

    this.sprite = scene.physics.add.image(x, y, 'gilded_golem');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(2.0); // massive

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);
  }

  setIsLastAlive(fn: () => boolean): void {
    this._isLastAlive = fn;
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    // Check if last enemy alive — trigger enrage
    if (!this._enraged && !this._enrageCheckDone && this._isLastAlive()) {
      this._enrageCheckDone = true;
      this._triggerEnrage();
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
    const moveSpeed = this._enraged ? MOVE_SPEED * 1.5 : MOVE_SPEED;

    switch (this._state) {
      case 'patrol': {
        body.setVelocityX(PATROL_SPEED * this._patrolDir);
        this._patrolBounce += delta;
        if (this._patrolBounce > 2500) {
          this._patrolBounce = 0;
          this._patrolDir = (this._patrolDir * -1) as 1 | -1;
          this.sprite.setFlipX(this._patrolDir < 0);
        }
        if (dist < DETECT_RANGE) this._transition('detect');
        break;
      }

      case 'detect': {
        body.setVelocityX(0);
        if (this._stateTimer > 500) this._transition('approach');
        break;
      }

      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(moveSpeed * dir);
        if (dist > DETECT_RANGE * 1.3) this._transition('patrol');
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._patternStep = 0;
          this._executeNextInPattern();
        }
        break;
      }

      case 'enrage': {
        body.setVelocityX(0);
        if (this._stateTimer > 1200) this._transition('approach');
        break;
      }

      case 'telegraph_heavy':
      case 'telegraph_unblockable': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 22;

        if (this._telegraphFrame === 1) {
          if (this._state === 'telegraph_heavy') this._juice.onTelegraphHeavy(this.sprite);
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

      case 'attack_heavy': {
        body.setVelocityX(0);
        if (this._stateTimer > 300) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            const baseDmg = ATTACK_DATA['heavy'].damage;
            const baseKb  = ATTACK_DATA['heavy'].knockback;
            const mult = this._enraged ? 1.5 : 1.0;
            player.receiveHit(baseDmg * mult | 0, baseKb * 2 | 0, ATTACK_DATA['heavy'].hitstun); // massive knockback
            this._juice.shake(0.008, 300);
          }
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_slam': {
        body.setVelocityX(0);
        if (this._stateTimer > 350) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            const mult = this._enraged ? 1.5 : 1.0;
            player.receiveHit(60 * mult | 0, 300, 38);
            this._juice.shake(0.01, 400);
          }
          this._attackTimer = 2200;
          this._transition('recover');
        }
        break;
      }

      case 'attack_stomp': {
        // Enraged only — AOE stomp
        body.setVelocityX(0);
        if (this._stateTimer > 400) {
          this._juice.shake(0.012, 450);
          if (dist < ATTACK_RANGE * 1.4) {
            player.receiveHit(45, 200, 30);
          }
          this._attackTimer = 1800;
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
        const recoverMs = this._enraged ? 350 : 600;
        if (this._stateTimer > recoverMs) {
          if (this._hitCount >= 3) this._transition('backoff');
          else this._transition('approach');
        }
        break;
      }

      case 'backoff': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(moveSpeed * awayDir);
        if (this._stateTimer > 1500) {
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

  private _executeNextInPattern(): void {
    if (this._enraged) {
      const steps: EnemyState[] = [
        'telegraph_heavy', 'attack_heavy',
        'telegraph_unblockable', 'attack_slam',
        'telegraph_unblockable', 'attack_stomp',
      ];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._attackTimer = 1400; this._transition('recover'); }
    } else {
      const steps: EnemyState[] = ['telegraph_heavy', 'attack_heavy', 'telegraph_unblockable', 'attack_slam'];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._attackTimer = 2000; this._transition('recover'); }
    }
  }

  private _triggerEnrage(): void {
    this._enraged = true;
    Bus.emit(GameEvent.BOSS_PHASE_CHANGE, { entity: this.sprite, phase: 2 });
    this._juice.flash(0xffcc00, 0.8, 300);
    this._juice.shake(0.010, 500);
    this.sprite.setTint(0xffaa00);
    this._transition('enrage');
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 1000;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') {
        if (this._enraged) this.sprite.setTint(0xffaa00);
        else this.sprite.clearTint();
      }
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * 0.3 * kbDir); // golem barely moves

    if (this._hp <= 0) { this._die(_attacker); return; }

    // Only staggers on heavy hits
    if (result.data.hitstun > 20) {
      this._transition('stagger');
      this._scene.time.delayedCall(500, () => {
        if (this._state === 'stagger') this._transition('recover');
      });
    }
  }

  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  private _die(killer: Player): void {
    this._state = 'dead';
    killer.ap.gain(4, 'kill');
    this._juice.onKill(this.sprite);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 1200,
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
  get isEnraged(): boolean { return this._enraged; }
  get state(): EnemyState { return this._state; }
}

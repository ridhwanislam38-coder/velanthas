import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import type { Player } from '../../Player';

// WraithEnemy — fades in and out of visibility
// Only damageable when fully visible (alpha = 1)
// Pattern: phase out → reposition → phase in → attack → phase out

export type EnemyState =
  | 'phased_out' | 'phasing_in' | 'visible' | 'phasing_out'
  | 'telegraph_light' | 'telegraph_heavy'
  | 'attack_light' | 'attack_heavy'
  | 'stagger' | 'recover' | 'dead';

type AttackPattern = 'A' | 'B';

const DETECT_RANGE   = 220;
const ATTACK_RANGE   = 65;
const MOVE_SPEED     = 75;
const PHASE_INTERVAL = 3000; // ms between visible windows
const PHASE_IN_TIME  = 600;  // ms to fade in
const PHASE_OUT_TIME = 400;  // ms to fade out

export class WraithEnemy {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;

  private _state: EnemyState = 'phased_out';
  private _stateTimer  = 0;
  private _attackTimer = 0;
  private _telegraphFrame = 0;

  private _hp:     number;
  private _maxHp:  number;
  private _hitCount = 0;
  private _pattern: AttackPattern = 'A';
  private _patternStep = 0;

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  private _phaseTimer    = 0; // time until next phase-in
  private _isFullyVisible = false;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light: 12,
    telegraph_heavy: 16,
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

    this.sprite = scene.physics.add.image(x, y, 'wraith_enemy');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setAlpha(0.05); // starts nearly invisible

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);

    // Begin with phase-out timer
    this._phaseTimer = PHASE_INTERVAL;
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      player.x, player.y,
    );

    this._stateTimer  += delta;
    this._attackTimer  = Math.max(0, this._attackTimer - delta);
    this._phaseTimer   = Math.max(0, this._phaseTimer - delta);

    // Trigger phase-in when timer expires and within detect range
    if (this._phaseTimer <= 0 && this._state === 'phased_out' && dist < DETECT_RANGE) {
      this._phaseTimer = PHASE_INTERVAL;
      this._repositionNearPlayer(player);
      this._transition('phasing_in');
    }

    this._updateFacing(player);
    this._runState(dist, delta, player);
  }

  private _runState(dist: number, delta: number, player: Player): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    switch (this._state) {
      case 'phased_out': {
        // Move slowly toward player while invisible
        body.setVelocityX(0);
        this._isFullyVisible = false;
        break;
      }

      case 'phasing_in': {
        body.setVelocityX(0);
        // Alpha tween handled via Phaser tween started in transition
        if (this._stateTimer > PHASE_IN_TIME) {
          this._isFullyVisible = true;
          this._transition('visible');
        }
        break;
      }

      case 'visible': {
        this._isFullyVisible = true;
        // Attack player while visible
        if (dist > DETECT_RANGE) {
          this._transition('phasing_out');
          break;
        }
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * dir);
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          body.setVelocityX(0);
          this._pattern = this._playerDodgeCount >= DIFFICULTY.DODGE_SPAM_THRESHOLD ? 'B' : 'A';
          this._playerDodgeCount = 0;
          this._patternStep = 0;
          this._executeNextInPattern();
        }
        // Auto phase-out after visible window expires
        if (this._stateTimer > 2500) {
          this._transition('phasing_out');
        }
        break;
      }

      case 'phasing_out': {
        body.setVelocityX(0);
        this._isFullyVisible = false;
        if (this._stateTimer > PHASE_OUT_TIME) {
          this._phaseTimer = PHASE_INTERVAL;
          this._transition('phased_out');
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
          this._patternStep = 0;
          this._attackTimer = 1000;
          // Phase out after attack
          this._transition('phasing_out');
        }
        break;
      }

      case 'stagger': {
        body.setVelocityX(0);
        break;
      }

      case 'recover': {
        body.setVelocityX(0);
        if (this._stateTimer > 350) this._transition('visible');
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _executeNextInPattern(): void {
    if (this._pattern === 'A') {
      const steps: EnemyState[] = ['telegraph_light', 'attack_light', 'telegraph_heavy', 'attack_heavy'];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._attackTimer = 900; this._transition('phasing_out'); }
    } else {
      const steps: EnemyState[] = ['telegraph_heavy', 'attack_heavy'];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._transition('phasing_out'); }
    }
  }

  private _repositionNearPlayer(player: Player): void {
    // Snap to near player while invisible
    const offset = (Math.random() > 0.5 ? 1 : -1) * 80;
    this.sprite.setX(Phaser.Math.Clamp(player.x + offset, 20, this._scene.scale.width - 20));
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    // Only damageable when fully visible
    if (!this._isFullyVisible) {
      this._juice.flash(0xffffff, 0.1, 30);
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

    // Hit forces phase-out
    this._transition('phasing_out');
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
      delay: 400,
      onComplete: () => this.sprite.destroy(),
    });
  }

  private _transition(next: EnemyState): void {
    const prev = this._state;
    this._state = next;
    this._stateTimer = 0;

    // Alpha tweens for phase transitions
    if (next === 'phasing_in') {
      this._scene.tweens.add({
        targets: this.sprite,
        alpha: 1,
        duration: PHASE_IN_TIME,
        ease: 'Linear',
      });
    } else if (next === 'phasing_out' || next === 'phased_out') {
      this._scene.tweens.add({
        targets: this.sprite,
        alpha: 0.05,
        duration: PHASE_OUT_TIME,
        ease: 'Linear',
      });
    } else if (next === 'visible') {
      this.sprite.setAlpha(1);
    }
    void prev;
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
  get isVisible(): boolean { return this._isFullyVisible; }
  get state(): EnemyState { return this._state; }
}

import Phaser from 'phaser';
import { DEPTH } from '../config/visualConfig';
import { Input, InputAction }   from '../systems/InputSystem';
import { APSystem }             from '../systems/APSystem';
import { ParrySystem }          from '../systems/ParrySystem';
import { DodgeSystem }          from '../systems/DodgeSystem';
import { JuiceSystem }          from '../systems/JuiceSystem';
import type { SpecialAttackSystem, SpecialId } from '../systems/SpecialAttackSystem';
import {
  ComboTracker, checkHit, ATTACK_DATA, applyBlock,
  type AttackType, type FightStance,
} from '../systems/CombatSystem';
import { Bus, GameEvent } from '../systems/EventBus';
import type { GuardEnemy } from './enemies/GuardEnemy';

// ── Movement tuning (birds-eye — no gravity, no jump) ───────────────────
const MOVE_SPEED  = 120;  // px/s
const DRAG        = 800;  // px/s² deceleration when no input
const WALK_FRAME_MS = 100;

// ── Player animation states ────────────────────────────────────────────────
export type PlayerAnimState =
  | 'idle' | 'walk' | 'run'
  | 'lightAtk' | 'heavyAtk' | 'finisher' | 'special1' | 'special3'
  | 'dodge' | 'block' | 'hit' | 'death';

export type Facing = 'left' | 'right' | 'up' | 'down';

// ── Combat state machine ───────────────────────────────────────────────────
type AttackState =
  | { tag: 'none' }
  | { tag: 'startup'; type: AttackType; frame: number }
  | { tag: 'active';  type: AttackType; frame: number; hit: boolean }
  | { tag: 'recovery';type: AttackType; frame: number };

// ── Player ────────────────────────────────────────────────────────────────
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly ap:     APSystem;
  readonly parry:  ParrySystem;
  readonly dodge:  DodgeSystem;

  private _juice:    JuiceSystem;
  private _combo:    ComboTracker;
  private _specials: SpecialAttackSystem | null = null;

  // ── Movement state
  private _facing: Facing = 'down';
  private _animState: PlayerAnimState = 'idle';
  private _isBlocking    = false;
  private _isDead        = false;

  // ── Combat state
  private _atkState: AttackState = { tag: 'none' };
  private _hitstunFrames = 0;

  // ── Walk animation
  private _walkFrame   = 0;
  private _walkTimer   = 0;
  private _idleFrame   = 0;
  private _idleTimer   = 0;

  // ── Stats
  private _hp:    number;
  private _maxHp: number;

  constructor(scene: Phaser.Scene, x: number, y: number, juice: JuiceSystem) {
    this.sprite = scene.physics.add.image(x, y, 'hero_idle_0');
    this.sprite.setDepth(DEPTH.GAME);
    this.sprite.setCollideWorldBounds(true);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setDrag(DRAG, DRAG);
    body.setMaxVelocity(MOVE_SPEED, MOVE_SPEED);

    this.ap    = new APSystem();
    this.parry = new ParrySystem(this.ap);
    this.dodge = new DodgeSystem(this.ap);
    this._juice = juice;
    this._combo = new ComboTracker();

    this._hp = this._maxHp = 100;

    // Parry + dodge juice callbacks
    this.parry.onParry(result => {
      this._juice.resolveParryResult(result, [this.sprite]);
    });
    this.dodge.onDodge(result => {
      this._juice.resolveDodgeResult(result);
    });
  }

  /** Wire the special attack system — called once from the scene after both are created. */
  setSpecials(s: SpecialAttackSystem): void {
    this._specials = s;
  }

  // ── Main update ───────────────────────────────────────────────────────
  update(delta: number, nowMs: number, enemies: GuardEnemy[]): void {
    if (this._isDead) return;

    // Pause everything during hit-stop
    if (this._juice.hitstopActive) {
      this._updateAnimation(delta);
      return;
    }

    this.parry.tick();
    this.dodge.update(delta);
    this.ap.update(delta);
    this._updateAttack(delta, nowMs, enemies);

    // Movement blocked during certain states
    const canMove = this._atkState.tag === 'none' || this._atkState.tag === 'active';
    if (canMove && this._hitstunFrames <= 0) {
      this._applyMovement();
    } else {
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setAcceleration(0, 0);
    }

    // Block (parry input)
    if (Input.isDown(InputAction.PARRY) && this._atkState.tag === 'none' && this._hitstunFrames <= 0) {
      if (!this._isBlocking) { this._isBlocking = true; this.parry.activate(); }
    } else {
      if (this._isBlocking) { this._isBlocking = false; this.parry.deactivate(); }
    }

    // Attack inputs
    if (this._atkState.tag === 'none' && this._hitstunFrames <= 0) {
      this._readAttackInput(nowMs, enemies);
    }

    // Hitstun countdown
    if (this._hitstunFrames > 0) this._hitstunFrames--;

    this._updateAnimation(delta);
  }

  // ── Birds-eye movement ────────────────────────────────────────────────
  private _applyMovement(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const mv = Input.moveVector();

    if (Math.abs(mv.x) > 0.01 || Math.abs(mv.y) > 0.01) {
      body.setVelocity(mv.x * MOVE_SPEED, mv.y * MOVE_SPEED);

      // Update facing based on dominant axis
      if (Math.abs(mv.x) > Math.abs(mv.y)) {
        this._facing = mv.x < 0 ? 'left' : 'right';
        this.sprite.setFlipX(mv.x < 0);
      } else {
        this._facing = mv.y < 0 ? 'up' : 'down';
      }
    }
    // Drag handles deceleration when no input
  }

  // ── Attack input reading ──────────────────────────────────────────────
  private _readAttackInput(nowMs: number, enemies: GuardEnemy[]): void {
    if (Input.justDown(InputAction.DODGE)) {
      this.dodge.press();
      this._startAttack('dodge' as AttackType, nowMs);
      return;
    }

    if (Input.justDown(InputAction.ATTACK_LIGHT)) {
      const free = this.dodge.consumeFreeLight();
      const type = free
        ? 'light'
        : this._combo.recordAttack('light', nowMs);
      this._startAttack(type, nowMs);
      return;
    }

    if (Input.justDown(InputAction.ATTACK_HEAVY)) {
      const type = this._combo.recordAttack('heavy', nowMs);
      this._startAttack(type, nowMs);
      return;
    }

    // Specials — routed through SpecialAttackSystem
    const specialActions: Array<[InputAction, SpecialId]> = [
      [InputAction.SPECIAL_1, 'JUDGMENT_MARK'],
      [InputAction.SPECIAL_2, 'PHANTOM_STEP'],
      [InputAction.SPECIAL_3, 'VOID_CRUCIBLE'],
      [InputAction.SPECIAL_4, 'THORNWALL_REQUIEM'],
      [InputAction.SPECIAL_5, 'THE_RECKONING'],
      [InputAction.SPECIAL_6, 'SISTERS_ECHO'],
      [InputAction.SPECIAL_7, 'WORLDS_WEIGHT'],
    ];

    for (const [action, id] of specialActions) {
      if (Input.justDown(action)) {
        if (this._specials && !this._specials.isActive) {
          const targets = enemies.filter(e => !e.isDead).map(e => e.sprite);
          this._specials.use(id, this.sprite.x, this.sprite.y, targets);
        }
        return;
      }
    }
  }

  private _startAttack(type: AttackType, _nowMs: number): void {
    if (type === ('dodge' as AttackType)) {
      this._atkState = { tag: 'none' };
      return; // dodge handled by DodgeSystem
    }
    const data = ATTACK_DATA[type];
    this._atkState = { tag: 'startup', type, frame: 0 };
    this.ap.markCombat();
    void data;
  }

  // ── Attack state machine ──────────────────────────────────────────────
  private _updateAttack(
    _delta: number,
    nowMs: number,
    enemies: GuardEnemy[],
  ): void {
    if (this._atkState.tag === 'none') return;

    const s = this._atkState;
    const data = ATTACK_DATA[s.type];
    s.frame++;

    if (s.tag === 'startup') {
      if (s.frame >= data.startup) {
        this._atkState = { tag: 'active', type: s.type, frame: 0, hit: false };
      }
    } else if (s.tag === 'active') {
      if (!s.hit) {
        const stance: FightStance = {
          x: this.sprite.x, y: this.sprite.y,
          facing: this._facing === 'left' || this._facing === 'right' ? this._facing : 'right',
          width: this.sprite.displayWidth,
          height: this.sprite.displayHeight,
        };
        for (const enemy of enemies) {
          const result = checkHit(stance, enemy.stance, s.type);
          if (result.connected) {
            s.hit = true;
            enemy.receiveHit(result, this);
            if (s.type === 'light' || s.type === 'finisher') {
              this._juice.onLightHit([this.sprite, enemy.sprite]);
            } else if (s.type === 'heavy') {
              this._juice.onHeavyHit([this.sprite, enemy.sprite]);
            } else {
              this._juice.onSpecialHit([this.sprite, enemy.sprite]);
            }
            break;
          }
        }
      }
      if (s.frame >= data.active) {
        this._atkState = { tag: 'recovery', type: s.type, frame: 0 };
      }
    } else if (s.tag === 'recovery') {
      if (s.frame >= data.recovery) {
        this._atkState = { tag: 'none' };
      }
    }

    void nowMs;
  }

  // ── Receive hit (called by enemy systems) ─────────────────────────────
  receiveHit(damage: number, knockback: number, hitstun: number): void {
    if (this._isDead) return;

    const dodgeResult = this.dodge.resolveHit();
    if (dodgeResult === 'perfect' || dodgeResult === 'dodge') return;

    const atkData = ATTACK_DATA['light'];
    const parryResult = this.parry.resolveHit(atkData);
    if (parryResult === 'perfect' || parryResult === 'parry') return;

    const finalDamage = this._isBlocking
      ? Math.floor(damage * 0.15)
      : damage;

    this._hp = Math.max(0, this._hp - finalDamage);
    this._hitstunFrames = hitstun;
    Bus.emit(GameEvent.HP_CHANGED, { hp: this._hp, maxHp: this._maxHp });

    // Knockback in birds-eye: push away from attacker direction
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbX = this._facing === 'left' ? knockback : -knockback;
    body.setVelocityX(kbX);

    this._animState = 'hit';
    this.sprite.setTexture('hero_hurt');

    if (this._hp <= 0) this._die();
  }

  private _die(): void {
    this._isDead = true;
    this._animState = 'death';
    this._juice.onPlayerDeath();
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);
    this.sprite.setTexture('hero_hurt');
    Bus.emit(GameEvent.PLAYER_DEATH, {});
  }

  // ── Animation ─────────────────────────────────────────────────────────
  private _updateAnimation(delta: number): void {
    if (this._animState === 'death' || this._animState === 'hit') return;

    // Attack animation
    const s = this._atkState;
    if (s.tag !== 'none') {
      const animMap: Partial<Record<AttackType, string>> = {
        light: 'hero_atk_0', heavy: 'hero_atk_1', finisher: 'hero_atk_2',
        special1: 'hero_atk_2', special3: 'hero_atk_2',
      };
      const key = animMap[s.type] ?? 'hero_atk_0';
      this.sprite.setTexture(key);
      return;
    }

    // Block
    if (this._isBlocking) {
      this.sprite.setTexture('hero_idle_0');
      this._animState = 'block';
      return;
    }

    // Movement
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);

    if (speed > 8) {
      this._walkTimer += delta;
      if (this._walkTimer >= WALK_FRAME_MS) {
        this._walkTimer -= WALK_FRAME_MS;
        this._walkFrame = (this._walkFrame + 1) % 4;
      }
      this.sprite.setTexture(`hero_walk_${this._walkFrame}`);
      this._animState = 'walk';
    } else {
      // Idle breathing
      this._idleTimer += delta;
      const idlePeriod = 600 / 4;
      if (this._idleTimer >= idlePeriod) {
        this._idleTimer -= idlePeriod;
        this._idleFrame = (this._idleFrame + 1) % 4;
      }
      const idleMap = [0, 1, 1, 0];
      const frameIdx = idleMap[this._idleFrame] ?? 0;
      this.sprite.setTexture(`hero_idle_${frameIdx}`);
      this._animState = 'idle';
    }
  }

  // ── Accessors ──────────────────────────────────────────────────────────
  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get hp(): number { return this._hp; }
  get maxHp(): number { return this._maxHp; }
  get hpPct(): number { return this._hp / this._maxHp; }
  get facing(): Facing { return this._facing; }
  get animState(): PlayerAnimState { return this._animState; }
  get isDead(): boolean { return this._isDead; }
  get isBlocking(): boolean { return this._isBlocking; }
  get inHitstun(): boolean { return this._hitstunFrames > 0; }
  get stance(): FightStance {
    return {
      x: this.sprite.x, y: this.sprite.y,
      facing: this._facing === 'left' || this._facing === 'right' ? this._facing : 'right',
      width: this.sprite.displayWidth,
      height: this.sprite.displayHeight,
    };
  }
}

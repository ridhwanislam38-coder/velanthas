import Phaser from 'phaser';
import {
  JUMP_VEL, RUN_SPEED, ACCEL, DECEL, MAX_FALL_SPEED,
  COYOTE_FRAMES, JUMP_BUFFER_FRAMES, WALK_FRAME_MS,
  GRAVITY, FAST_FALL_MULT, APEX_HANG_VY, APEX_GRAV_MULT, APEX_HANG_FRAMES,
} from '../config/Constants';
import { APSystem }             from '../systems/APSystem';
import { ParrySystem }          from '../systems/ParrySystem';
import { DodgeSystem }          from '../systems/DodgeSystem';
import { JuiceSystem }          from '../systems/JuiceSystem';
import type { SpecialAttackSystem, SpecialId } from '../systems/SpecialAttackSystem';
import {
  ComboTracker, checkHit, ATTACK_DATA, applyBlock,
  type AttackType, type FightStance,
} from '../systems/CombatSystem';
import type { GuardEnemy } from './enemies/GuardEnemy';

// ── Player animation states ────────────────────────────────────────────────
export type PlayerAnimState =
  | 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land'
  | 'lightAtk' | 'heavyAtk' | 'finisher' | 'special1' | 'special3'
  | 'dodge' | 'block' | 'hit' | 'death';

export type Facing = 'left' | 'right';

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
  private _facing: Facing = 'right';
  private _animState: PlayerAnimState = 'idle';
  private _coyoteTimer   = 0;
  private _jumpBuffer    = 0;
  private _apexFrames    = 0;
  private _fastFalling   = false;
  private _wasOnGround   = false;
  private _landFrame     = 0;  // frames since landing (for land animation)
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
    this.sprite.setDepth(10);
    this.sprite.setCollideWorldBounds(true);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(MAX_FALL_SPEED);

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
  update(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    keys: Record<string, Phaser.Input.Keyboard.Key>,
    delta: number,
    nowMs: number,
    enemies: GuardEnemy[],
  ): void {
    if (this._isDead) return;

    const body     = this.sprite.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down;

    // Pause everything during hit-stop
    if (this._juice.hitstopActive) {
      this._updateAnimation(delta, onGround, body);
      return;
    }

    this.parry.tick();
    this.dodge.update(delta);
    this.ap.update(delta);

    this._updateCoyote(onGround);
    this._updateJumpBuffer(cursors, keys);
    this._updateFastFall(cursors, keys, body, onGround);
    this._applyJump(body);
    this._updateAttack(delta, nowMs, enemies, body);

    // Movement blocked during certain states
    const canMove = this._atkState.tag === 'none' || this._atkState.tag === 'active';
    if (canMove && this._hitstunFrames <= 0) {
      this._applyMovement(body, cursors, keys);
    } else {
      body.setAccelerationX(0);
      if (!onGround) {
        // Allow slight air drift deceleration
        body.setVelocityX(body.velocity.x * 0.92);
      } else {
        body.setVelocityX(0);
      }
    }

    // Block
    const blockKey = keys['Z'];
    if (blockKey?.isDown && this._atkState.tag === 'none' && this._hitstunFrames <= 0) {
      if (!this._isBlocking) { this._isBlocking = true; this.parry.activate(); }
    } else {
      if (this._isBlocking) { this._isBlocking = false; this.parry.deactivate(); }
    }

    // Inputs for attacks
    if (this._atkState.tag === 'none' && this._hitstunFrames <= 0) {
      this._readAttackInput(keys, nowMs, enemies);
    }

    // Hitstun countdown
    if (this._hitstunFrames > 0) this._hitstunFrames--;

    // Landing
    const justLanded = onGround && !this._wasOnGround;
    if (justLanded) {
      this._landFrame = 0;
      this._juice.shake(0.001, 80);
    }
    if (this._landFrame < 6) this._landFrame++;
    this._wasOnGround = onGround;

    this._updateAnimation(delta, onGround, body);
  }

  // ── Coyote time ───────────────────────────────────────────────────────
  private _updateCoyote(onGround: boolean): void {
    if (onGround) {
      this._coyoteTimer = COYOTE_FRAMES;
    } else {
      this._coyoteTimer = Math.max(0, this._coyoteTimer - 1);
    }
  }

  // ── Jump buffer ───────────────────────────────────────────────────────
  private _updateJumpBuffer(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    keys: Record<string, Phaser.Input.Keyboard.Key>,
  ): void {
    const pressed =
      Phaser.Input.Keyboard.JustDown(cursors.up) ||
      Phaser.Input.Keyboard.JustDown(cursors.space) ||
      Phaser.Input.Keyboard.JustDown(keys['W'] ?? cursors.up);

    if (pressed) this._jumpBuffer = JUMP_BUFFER_FRAMES;
    else this._jumpBuffer = Math.max(0, this._jumpBuffer - 1);
  }

  // ── Fast fall + apex hang ─────────────────────────────────────────────
  private _updateFastFall(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    keys: Record<string, Phaser.Input.Keyboard.Key>,
    body: Phaser.Physics.Arcade.Body,
    onGround: boolean,
  ): void {
    if (onGround) {
      this._fastFalling = false;
      this._apexFrames  = 0;
      body.setGravityY(0); // reset to world gravity
      return;
    }

    const jumpHeld =
      cursors.up.isDown ||
      cursors.space.isDown ||
      (keys['W']?.isDown ?? false);

    const vy = body.velocity.y;

    // Fast fall: jump released while rising
    if (!jumpHeld && vy < 0 && !this._fastFalling) {
      this._fastFalling = true;
    }

    if (this._fastFalling) {
      body.setGravityY(GRAVITY * (FAST_FALL_MULT - 1)); // additive on top of world gravity
      this._apexFrames = 0;
      return;
    }

    // Apex hang: near peak of arc
    if (Math.abs(vy) < APEX_HANG_VY) {
      this._apexFrames = Math.min(this._apexFrames + 1, APEX_HANG_FRAMES);
      // Reduce gravity: set local gravity to compensate
      const reduction = GRAVITY * (1 - APEX_GRAV_MULT);
      body.setGravityY(-reduction); // negative additive = net reduction
    } else {
      this._apexFrames = 0;
      body.setGravityY(0);
    }
  }

  // ── Jump execution ────────────────────────────────────────────────────
  private _applyJump(body: Phaser.Physics.Arcade.Body): void {
    if (this._coyoteTimer > 0 && this._jumpBuffer > 0) {
      body.setVelocityY(JUMP_VEL);
      body.setGravityY(0);
      this._coyoteTimer  = 0;
      this._jumpBuffer   = 0;
      this._fastFalling  = false;
      this._apexFrames   = 0;
    }
  }

  // ── Horizontal movement ───────────────────────────────────────────────
  private _applyMovement(
    body: Phaser.Physics.Arcade.Body,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    keys: Record<string, Phaser.Input.Keyboard.Key>,
  ): void {
    const left  = cursors.left.isDown  || (keys['A']?.isDown ?? false);
    const right = cursors.right.isDown || (keys['D']?.isDown ?? false);

    if (left && !right) {
      body.setAccelerationX(-ACCEL);
      body.setMaxVelocityX(RUN_SPEED);
      // Skid: if was moving right, apply extra decel
      if (body.velocity.x > 0) body.setVelocityX(body.velocity.x - DECEL * 0.016);
      this.sprite.setFlipX(true);
      this._facing = 'left';
    } else if (right && !left) {
      body.setAccelerationX(ACCEL);
      body.setMaxVelocityX(RUN_SPEED);
      if (body.velocity.x < 0) body.setVelocityX(body.velocity.x + DECEL * 0.016);
      this.sprite.setFlipX(false);
      this._facing = 'right';
    } else {
      // Decelerate
      body.setAccelerationX(0);
      const vx = body.velocity.x;
      if (Math.abs(vx) < 4) {
        body.setVelocityX(0);
      } else {
        body.setVelocityX(vx * 0.75); // ground friction
      }
    }
  }

  // ── Attack input reading ──────────────────────────────────────────────
  private _readAttackInput(
    keys: Record<string, Phaser.Input.Keyboard.Key>,
    nowMs: number,
    enemies: GuardEnemy[],
  ): void {
    const lightKey  = keys['J'];
    const heavyKey  = keys['K'];
    const dodgeKey  = keys['L'];
    // ── Specials: 7 total, one key each ───────────────────────────────
    const sp1K = keys['U']; // JUDGMENT_MARK  (1AP)
    const sp2K = keys['O']; // PHANTOM_STEP   (1AP)
    const sp3K = keys['P']; // VOID_CRUCIBLE  (2AP)
    const sp4K = keys['Q']; // THORNWALL_REQUIEM (2AP)
    const sp5K = keys['I']; // THE_RECKONING  (3AP)
    const sp6K = keys['E']; // SISTERS_ECHO   (3AP)
    const sp7K = keys['R']; // WORLDS_WEIGHT  (3AP)

    if (dodgeKey && Phaser.Input.Keyboard.JustDown(dodgeKey)) {
      this.dodge.press();
      this._startAttack('dodge' as AttackType, nowMs);
      return;
    }

    if (lightKey && Phaser.Input.Keyboard.JustDown(lightKey)) {
      const free = this.dodge.consumeFreeLight();
      const type = free
        ? 'light'
        : this._combo.recordAttack('light', nowMs);
      this._startAttack(type, nowMs);
      return;
    }

    if (heavyKey && Phaser.Input.Keyboard.JustDown(heavyKey)) {
      const type = this._combo.recordAttack('heavy', nowMs);
      this._startAttack(type, nowMs);
      return;
    }

    // Specials — routed through SpecialAttackSystem
    const specialBindings: Array<[Phaser.Input.Keyboard.Key | undefined, SpecialId]> = [
      [sp1K, 'JUDGMENT_MARK'],
      [sp2K, 'PHANTOM_STEP'],
      [sp3K, 'VOID_CRUCIBLE'],
      [sp4K, 'THORNWALL_REQUIEM'],
      [sp5K, 'THE_RECKONING'],
      [sp6K, 'SISTERS_ECHO'],
      [sp7K, 'WORLDS_WEIGHT'],
    ];

    for (const [key, id] of specialBindings) {
      if (key && Phaser.Input.Keyboard.JustDown(key)) {
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
    _body: Phaser.Physics.Arcade.Body,
  ): void {
    if (this._atkState.tag === 'none') return;

    const s = this._atkState;
    const data = ATTACK_DATA[s.type];
    s.frame++;

    if (s.tag === 'startup') {
      if (s.frame >= data.startup) {
        this._atkState = { tag: 'active', type: s.type, frame: 0, hit: false };
      }
      // Dodge cancel window
      if (data.cancelAt > 0 && s.frame >= data.cancelAt) {
        // Allow dodge cancel (DodgeSystem handles i-frames)
      }
    } else if (s.tag === 'active') {
      if (!s.hit) {
        // Check hit against each enemy
        const stance: FightStance = {
          x: this.sprite.x, y: this.sprite.y,
          facing: this._facing,
          width: this.sprite.displayWidth,
          height: this.sprite.displayHeight,
        };
        for (const enemy of enemies) {
          const result = checkHit(stance, enemy.stance, s.type);
          if (result.connected) {
            s.hit = true;
            enemy.receiveHit(result, this);
            // Juice
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

    // Check dodge i-frames
    const dodgeResult = this.dodge.resolveHit();
    if (dodgeResult === 'perfect' || dodgeResult === 'dodge') {
      return; // dodged
    }

    // Check parry
    const atkData = ATTACK_DATA['light']; // placeholder — caller should pass AttackData
    const parryResult = this.parry.resolveHit(atkData);
    if (parryResult === 'perfect' || parryResult === 'parry') {
      return; // parried
    }

    // Block mitigation
    const finalDamage = this._isBlocking
      ? Math.floor(damage * 0.15)   // 15% chip through block
      : damage;

    this._hp = Math.max(0, this._hp - finalDamage);
    this._hitstunFrames = hitstun;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = (knockback > 0) ? 1 : -1;
    body.setVelocityX(knockback * (this._facing === 'right' ? -kbDir : kbDir));

    this._animState = 'hit';
    this.sprite.setTexture('hero_hurt');

    if (this._hp <= 0) {
      this._die();
    }
  }

  private _die(): void {
    this._isDead = true;
    this._animState = 'death';
    this._juice.onPlayerDeath();
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);
    this.sprite.setTexture('hero_hurt');
    // YOU DIED text handled by scene
  }

  // ── Animation ─────────────────────────────────────────────────────────
  private _updateAnimation(
    delta: number,
    onGround: boolean,
    body: Phaser.Physics.Arcade.Body,
  ): void {
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
      this.sprite.setTexture('hero_idle_0'); // no separate block frame yet
      this._animState = 'block';
      return;
    }

    // Airborne
    if (!onGround) {
      const vy = body.velocity.y;
      if (vy < 0) {
        this.sprite.setTexture('hero_idle_0'); // jump up
        this._animState = 'jump';
      } else {
        this.sprite.setTexture('hero_idle_1'); // falling
        this._animState = 'fall';
      }
      return;
    }

    // Landing squash (first 6 frames after landing)
    if (this._landFrame < 4) {
      this.sprite.setTexture('hero_hurt'); // low-crouch reuse for now
      this._animState = 'land';
      return;
    }

    // Ground movement
    const moving = Math.abs(body.velocity.x) > 8;
    if (moving) {
      this._walkTimer += delta;
      if (this._walkTimer >= WALK_FRAME_MS) {
        this._walkTimer -= WALK_FRAME_MS;
        this._walkFrame = (this._walkFrame + 1) % 4;
      }
      this.sprite.setTexture(`hero_walk_${this._walkFrame}`);
      this._animState = 'walk';
    } else {
      // Idle breathing — 4-frame bob at 600ms total cycle
      this._idleTimer += delta;
      const idlePeriod = 600 / 4;
      if (this._idleTimer >= idlePeriod) {
        this._idleTimer -= idlePeriod;
        this._idleFrame = (this._idleFrame + 1) % 4;
      }
      // idle_0/1 alternate; idle_2/3 back to 0/1 (creates breathe loop)
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
      facing: this._facing,
      width: this.sprite.displayWidth,
      height: this.sprite.displayHeight,
    };
  }
}


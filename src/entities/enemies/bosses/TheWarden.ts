import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { checkHit, type FightStance } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import { SightComponent, type SightConfig } from '../../../systems/SightSystem';
import { BossSystem, type BossConfig, type BossPhase } from '../../../systems/BossSystem';
import { ENEMY_STATS, TELEGRAPH } from '../../../config/enemyConfig';
import { ENEMY_LOOT, rollLoot } from '../../../systems/CurrencySystem';
import type { Player } from '../../Player';

// ── The Warden ─────────────────────────────────────────────────────────────
// Region: Gildspire — the mint vault beneath the golden towers
// Built, not born. Protects worthless metal. Diligent, thorough, wrong.
//
// Phase 1 (100-60%): Armoured. Most attacks deflect. Must hit back/joints.
// Phase 2 (60-0%):   Armour cracked. Core exposed. All hits connect. Speed ×2.

export type BossState =
  | 'idle' | 'patrol' | 'approach'
  | 'telegraph_vault_slam' | 'telegraph_security_sweep'
  | 'telegraph_lock_protocol' | 'telegraph_emergency_override'
  | 'attack_vault_slam' | 'attack_security_sweep'
  | 'attack_lock_protocol' | 'attack_emergency_override'
  | 'invulnerable' | 'stagger' | 'recover' | 'backoff' | 'dead';

type AttackPattern = 'STANDARD' | 'SWEEP_COMBO' | 'LOCKDOWN' | 'OVERRIDE';

// ── Constants ─────────────────────────────────────────────────────────────
const STATS          = ENEMY_STATS.TheWarden;
const DETECT_RANGE   = 260;
const ATTACK_RANGE   = 80;
const PATROL_SPEED   = 40;
const MOVE_SPEED     = STATS.spd;
const SPEED_MULT_P2  = 2.0;

const VAULT_SLAM_TELEGRAPH       = TELEGRAPH.HEAVY;       // 18f
const SECURITY_SWEEP_TELEGRAPH   = TELEGRAPH.LIGHT;       // 12f
const LOCK_PROTOCOL_TELEGRAPH    = TELEGRAPH.UNBLOCKABLE;  // 20f
const EMERGENCY_OVERRIDE_TELEGRAPH = TELEGRAPH.CHARGE;     // 24f

const VAULT_SLAM_DAMAGE          = 65;
const VAULT_SLAM_KNOCKBACK       = 280;
const SECURITY_SWEEP_DAMAGE      = 35;
const LOCK_PROTOCOL_INVULN_MS    = 3000;
const EMERGENCY_OVERRIDE_DAMAGE  = 90;
const EMERGENCY_OVERRIDE_KNOCKBACK = 350;

const BOSS_CONFIG: BossConfig = {
  id:           'the_warden',
  name:         'The Warden',
  title:        'Guardian of the Empty Vault',
  phase2MusicKey: 'mus_warden_p2',
  loreFragment: '"The balance... is maintained."',
};

const TELEGRAPH_FRAMES: Record<string, number> = {
  telegraph_vault_slam:         VAULT_SLAM_TELEGRAPH,
  telegraph_security_sweep:     SECURITY_SWEEP_TELEGRAPH,
  telegraph_lock_protocol:      LOCK_PROTOCOL_TELEGRAPH,
  telegraph_emergency_override: EMERGENCY_OVERRIDE_TELEGRAPH,
};

export class TheWarden {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;
  private _boss:   BossSystem;

  // ── AI state
  private _state: BossState = 'patrol';
  private _stateTimer    = 0;
  private _attackTimer   = 0;
  private _telegraphFrame = 0;
  private _patrolDir: 1 | -1 = 1;
  private _patrolBounce  = 0;

  // ── Combat
  private _hp:      number;
  private _maxHp:   number;
  private _hitCount = 0;
  private _pattern: AttackPattern = 'STANDARD';
  private _patternStep = 0;

  // ── Phase
  private _phase: BossPhase = 1;
  private _armoured = true; // Phase 1 armour — frontal hits deflect

  // ── Player reads
  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  // ── Sight
  private _sight: SightComponent;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._hp = this._maxHp = STATS.hp;

    this.sprite = scene.physics.add.image(x, y, 'boss_warden');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(2.0);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);

    const sightCfg: SightConfig = {
      type:      'CONE_SIGHT',
      coneRange: DETECT_RANGE,
      coneAngle: 90,
      periRange: 50,
    };
    this._sight = new SightComponent(scene, this.sprite, sightCfg);

    this._boss = new BossSystem(scene, juice, BOSS_CONFIG);

    scene.events.on('boss_phase_change', (newPhase: BossPhase) => {
      this._phase = newPhase;
      if (newPhase === 2) this._onPhase2();
    });
  }

  private _onPhase2(): void {
    this._armoured = false;
    this._juice.shake(0.015, 500);
    Bus.emit(GameEvent.BOSS_PHASE_CHANGE, { bossId: BOSS_CONFIG.id, phase: 2 });
  }

  // ── Main update ────────────────────────────────────────────────────────
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

  // ── State machine ──────────────────────────────────────────────────────
  private _runState(dist: number, delta: number, player: Player): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const speed = this._phase === 2 ? MOVE_SPEED * SPEED_MULT_P2 : MOVE_SPEED;

    switch (this._state) {
      case 'patrol': {
        body.setVelocityX(PATROL_SPEED * this._patrolDir);
        this._patrolBounce += delta;
        if (this._patrolBounce > 2500) {
          this._patrolBounce = 0;
          this._patrolDir = (this._patrolDir * -1) as 1 | -1;
          this.sprite.setFlipX(this._patrolDir < 0);
        }
        const detection = this._sight.checkPlayer(player.x, player.y);
        if (detection === 'RED' || detection === 'ORANGE') {
          this._transition('approach');
        }
        break;
      }

      case 'idle': {
        body.setVelocityX(0);
        const detection = this._sight.checkPlayer(player.x, player.y);
        if (detection === 'RED' || detection === 'ORANGE') {
          this._transition('approach');
        }
        break;
      }

      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(speed * dir);
        const sightState = this._sight.checkPlayer(player.x, player.y);
        if (sightState === 'LOST' || sightState === 'IDLE') {
          this._transition('patrol');
          break;
        }
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._choosePattern();
        }
        break;
      }

      // ── Telegraphs ──────────────────────────────────────────────────
      case 'telegraph_vault_slam':
      case 'telegraph_security_sweep':
      case 'telegraph_lock_protocol':
      case 'telegraph_emergency_override': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = TELEGRAPH_FRAMES[this._state] ?? TELEGRAPH.LIGHT;

        if (this._telegraphFrame === 1) {
          this._emitTelegraph();
        }

        const hintLevel = Deaths.getHintLevel(this._state);
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

      // ── Attacks ─────────────────────────────────────────────────────
      case 'attack_vault_slam': {
        body.setVelocityX(0);
        if (this._stateTimer > 250) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(VAULT_SLAM_DAMAGE, VAULT_SLAM_KNOCKBACK, result.data.hitstun);
            this._juice.shake(0.01, 300);
          }
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_security_sweep': {
        // Light AOE — jump over it
        body.setVelocityX(0);
        if (this._stateTimer > 180) {
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            player.receiveHit(SECURITY_SWEEP_DAMAGE, result.data.knockback, result.data.hitstun);
          }
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_lock_protocol': {
        // Becomes invulnerable for 3 seconds — player must run
        body.setVelocityX(0);
        this._transition('invulnerable');
        break;
      }

      case 'invulnerable': {
        body.setVelocityX(0);
        if (this._stateTimer > LOCK_PROTOCOL_INVULN_MS) {
          this._attackTimer = 1500;
          this._transition('recover');
        }
        break;
      }

      case 'attack_emergency_override': {
        // Phase 2: full-arena sweep — must use platforms
        body.setVelocityX(0);
        if (this._stateTimer > 350) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(EMERGENCY_OVERRIDE_DAMAGE, EMERGENCY_OVERRIDE_KNOCKBACK, 35);
            this._juice.shake(0.015, 500);
          }
          this._attackTimer = 2500;
          this._transition('recover');
        }
        break;
      }

      // ── Recovery ────────────────────────────────────────────────────
      case 'stagger': {
        body.setVelocityX(0);
        break;
      }

      case 'recover': {
        body.setVelocityX(0);
        if (this._stateTimer > 500) {
          if (this._hitCount >= 5) {
            this._transition('backoff');
          } else {
            this._transition('approach');
          }
        }
        break;
      }

      case 'backoff': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(speed * awayDir);
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

  // ── Pattern selection ──────────────────────────────────────────────────
  private _choosePattern(): void {
    if (this._phase === 2) {
      if (this._playerDodgeCount >= DIFFICULTY.DODGE_SPAM_THRESHOLD) {
        this._pattern = 'OVERRIDE';
        this._playerDodgeCount = 0;
      } else if (this._playerAttackCount >= DIFFICULTY.ATTACK_SPAM_THRESHOLD) {
        this._pattern = 'LOCKDOWN';
        this._playerAttackCount = 0;
      } else {
        this._pattern = 'SWEEP_COMBO';
      }
    } else {
      if (this._playerAttackCount >= DIFFICULTY.ATTACK_SPAM_THRESHOLD) {
        this._pattern = 'LOCKDOWN';
        this._playerAttackCount = 0;
      } else {
        this._pattern = 'STANDARD';
      }
    }

    this._patternStep = 0;
    this._executeNextInPattern();
  }

  private _executeNextInPattern(): void {
    const patterns: Record<AttackPattern, BossState[]> = {
      STANDARD: [
        'telegraph_security_sweep', 'attack_security_sweep',
        'telegraph_security_sweep', 'attack_security_sweep',
        'telegraph_vault_slam',     'attack_vault_slam',
      ],
      SWEEP_COMBO: [
        'telegraph_security_sweep',     'attack_security_sweep',
        'telegraph_vault_slam',         'attack_vault_slam',
        'telegraph_emergency_override', 'attack_emergency_override',
      ],
      LOCKDOWN: [
        'telegraph_lock_protocol', 'attack_lock_protocol',
      ],
      OVERRIDE: [
        'telegraph_emergency_override', 'attack_emergency_override',
      ],
    };

    const steps = patterns[this._pattern];
    const next = steps[this._patternStep];
    if (next) {
      this._transition(next);
      this._patternStep++;
    } else {
      this._patternStep = 0;
      this._attackTimer = 1200;
      this._transition('recover');
    }
  }

  // ── Telegraph emitter ──────────────────────────────────────────────────
  private _emitTelegraph(): void {
    switch (this._state) {
      case 'telegraph_security_sweep':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_LIGHT, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphLight(this.sprite);
        break;
      case 'telegraph_vault_slam':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_HEAVY, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphHeavy(this.sprite);
        break;
      case 'telegraph_lock_protocol':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_UNB, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphUnblockable(this.sprite);
        break;
      case 'telegraph_emergency_override':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_UNB, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphUnblockable(this.sprite);
        break;
    }
  }

  // ── Receive hit ────────────────────────────────────────────────────────
  receiveHit(
    result: { data: { damage: number; knockback: number; hitstun: number } },
    _attacker: Player,
    hitFromBehind = false,
  ): void {
    if (this._state === 'dead' || this._state === 'invulnerable') return;

    // Phase 1 armour: frontal hits deflect (0 damage)
    if (this._armoured && !hitFromBehind) {
      this._juice.flash(0x888888, 0.3, 100);
      return;
    }

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 1000;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir * 0.3); // heavy — low knockback

    this._boss.setHpPercent(this.hpPct);

    if (this._hp <= 0) {
      this._die(_attacker);
      return;
    }

    this._transition('stagger');
    this._scene.time.delayedCall(600, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  // ── Death ──────────────────────────────────────────────────────────────
  private _die(killer: Player): void {
    this._state = 'dead';
    this._sight.destroy();

    const lootEntry = ENEMY_LOOT['the_warden'];
    if (lootEntry) {
      const loot = rollLoot(lootEntry);
      Bus.emit(GameEvent.ENEMY_KILLED, {
        enemyId: BOSS_CONFIG.id,
        lootLumens: loot.lumens,
      });
    }

    killer.ap.gain(15, 'kill');
    this._boss.onBossDeath(this.sprite);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 1200,
      delay: 1000,
      onComplete: () => this.sprite.destroy(),
    });
  }

  private _transition(next: BossState): void {
    this._state = next;
    this._stateTimer = 0;
  }

  private _updateFacing(player: Player): void {
    if (this._state === 'approach' || this._state === 'patrol') {
      this.sprite.setFlipX(!(player.x > this.sprite.x));
    }
  }

  // ── Accessors ──────────────────────────────────────────────────────────
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
  get isArmoured(): boolean { return this._armoured; }
  get phase(): BossPhase { return this._phase; }
  get state(): BossState { return this._state; }
}

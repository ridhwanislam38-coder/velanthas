import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import { SightComponent, type SightConfig } from '../../../systems/SightSystem';
import { BossSystem, type BossConfig, type BossPhase } from '../../../systems/BossSystem';
import { ENEMY_STATS, PHASE_THRESHOLDS, TELEGRAPH } from '../../../config/enemyConfig';
import { ENEMY_LOOT, rollLoot } from '../../../systems/CurrencySystem';
import type { Player } from '../../Player';

// ── Grimdar the Forsaken ───────────────────────────────────────────────────
// Region: Ashfields — throne room of a collapsed citadel
// Once a general of the Accord's armies. He doesn't know he's already dead.
// He's been defending a treaty that no longer exists for 400 years.
//
// Phase 1 (100-60%): Shield + sword. Light×2 → heavy. Clear telegraphs.
// Phase 2 (60-0%):   Shield discarded. Speed +40%. Unblockable charges.

export type BossState =
  | 'idle' | 'approach' | 'circle'
  | 'telegraph_forsaken_slash' | 'telegraph_grief_strike'
  | 'telegraph_condemned_charge' | 'telegraph_last_stand'
  | 'attack_forsaken_slash' | 'attack_grief_strike'
  | 'attack_condemned_charge' | 'attack_last_stand'
  | 'stagger' | 'recover' | 'backoff' | 'dead';

type AttackPattern = 'SWORD_AND_SHIELD' | 'DUAL_WIELD' | 'CHARGE' | 'LAST_STAND';

// ── Constants (no magic numbers) ──────────────────────────────────────────
const STATS          = ENEMY_STATS.GrimdarTheForsaken;
const DETECT_RANGE   = 280;
const ATTACK_RANGE   = 70;
const MOVE_SPEED     = STATS.spd;
const SPEED_MULT_P2  = 1.4;

const FORSAKEN_SLASH_TELEGRAPH  = TELEGRAPH.LIGHT;       // 12f
const GRIEF_STRIKE_TELEGRAPH    = TELEGRAPH.HEAVY;        // 18f
const CONDEMNED_CHARGE_TELEGRAPH = TELEGRAPH.UNBLOCKABLE; // 20f
const LAST_STAND_TELEGRAPH      = TELEGRAPH.CHARGE;       // 24f

const FORSAKEN_SLASH_DAMAGE  = 30;
const GRIEF_STRIKE_DAMAGE    = 50;
const CONDEMNED_CHARGE_DAMAGE = 60;
const LAST_STAND_DAMAGE      = 80;
const LAST_STAND_KNOCKBACK   = 300;
const GRIEF_STRIKE_KNOCKBACK = 200;

const BOSS_CONFIG: BossConfig = {
  id:           'grimdar_the_forsaken',
  name:         'Grimdar',
  title:        'The Forsaken Knight',
  phase2MusicKey: 'mus_grimdar_p2',
  loreFragment: 'Edric Fragment #1 — carved into his pauldron.',
};

const TELEGRAPH_FRAMES: Record<string, number> = {
  telegraph_forsaken_slash:   FORSAKEN_SLASH_TELEGRAPH,
  telegraph_grief_strike:     GRIEF_STRIKE_TELEGRAPH,
  telegraph_condemned_charge: CONDEMNED_CHARGE_TELEGRAPH,
  telegraph_last_stand:       LAST_STAND_TELEGRAPH,
};

export class GrimdarTheForsaken {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;
  private _boss:   BossSystem;

  // ── AI state
  private _state: BossState = 'idle';
  private _stateTimer    = 0;
  private _attackTimer   = 0;
  private _telegraphFrame = 0;

  // ── Combat
  private _hp:      number;
  private _maxHp:   number;
  private _hitCount = 0;
  private _pattern: AttackPattern = 'SWORD_AND_SHIELD';
  private _patternStep = 0;

  // ── Phase
  private _phase: BossPhase = 1;

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

    this.sprite = scene.physics.add.image(x, y, 'boss_grimdar');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(1.5);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);

    const sightCfg: SightConfig = {
      type:      'CONE_SIGHT',
      coneRange: DETECT_RANGE,
      coneAngle: 120,
      periRange: 60,
    };
    this._sight = new SightComponent(scene, this.sprite, sightCfg);

    this._boss = new BossSystem(scene, juice, BOSS_CONFIG);

    // Listen for phase transitions
    scene.events.on('boss_phase_change', (newPhase: BossPhase) => {
      this._phase = newPhase;
      if (newPhase === 2) {
        this._onPhase2();
      }
    });
  }

  // ── Phase 2: discard shield, speed up ──────────────────────────────────
  private _onPhase2(): void {
    this._juice.shake(0.01, 400);
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
          this._transition('idle');
          break;
        }
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._choosePattern(player);
        }
        break;
      }

      case 'circle': {
        const sideDir = Math.sin(this._stateTimer / 300) > 0 ? 1 : -1;
        body.setVelocityX(speed * 0.5 * sideDir);
        if (this._stateTimer > 1200) {
          this._transition('approach');
        }
        break;
      }

      // ── Telegraphs ──────────────────────────────────────────────────
      case 'telegraph_forsaken_slash':
      case 'telegraph_grief_strike':
      case 'telegraph_condemned_charge':
      case 'telegraph_last_stand': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = TELEGRAPH_FRAMES[this._state] ?? TELEGRAPH.LIGHT;

        if (this._telegraphFrame === 1) {
          this._emitTelegraph();
        }

        // Hint system
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
      case 'attack_forsaken_slash': {
        body.setVelocityX(0);
        if (this._stateTimer > 160) {
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            player.receiveHit(FORSAKEN_SLASH_DAMAGE, result.data.knockback, result.data.hitstun);
          }
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_grief_strike': {
        body.setVelocityX(0);
        if (this._stateTimer > 220) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(GRIEF_STRIKE_DAMAGE, GRIEF_STRIKE_KNOCKBACK, result.data.hitstun);
          }
          this._transition('recover');
        }
        break;
      }

      case 'attack_condemned_charge': {
        // Unblockable — must dodge sideways
        body.setVelocityX(0);
        if (this._stateTimer > 250) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(CONDEMNED_CHARGE_DAMAGE, result.data.knockback, result.data.hitstun);
          }
          this._transition('recover');
        }
        break;
      }

      case 'attack_last_stand': {
        // Phase 2 only — massive wind-up slam
        body.setVelocityX(0);
        if (this._stateTimer > 300) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(LAST_STAND_DAMAGE, LAST_STAND_KNOCKBACK, 35);
            this._juice.shake(0.012, 400);
          }
          this._attackTimer = 2000;
          this._transition('recover');
        }
        break;
      }

      // ── Stagger / Recover / Backoff ─────────────────────────────────
      case 'stagger': {
        body.setVelocityX(0);
        break;
      }

      case 'recover': {
        body.setVelocityX(0);
        if (this._stateTimer > 500) {
          if (this._hitCount >= 4) {
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
        if (this._stateTimer > 1200) {
          this._hitCount = 0;
          this._transition('circle');
        }
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  // ── Pattern selection ──────────────────────────────────────────────────
  private _choosePattern(_player: Player): void {
    if (this._phase === 2) {
      // Phase 2: mix charge + last stand patterns
      if (this._playerDodgeCount >= DIFFICULTY.DODGE_SPAM_THRESHOLD) {
        this._pattern = 'LAST_STAND';
        this._playerDodgeCount = 0;
      } else if (this._playerAttackCount >= DIFFICULTY.ATTACK_SPAM_THRESHOLD) {
        this._pattern = 'CHARGE';
        this._playerAttackCount = 0;
      } else {
        this._pattern = 'DUAL_WIELD';
      }
    } else {
      // Phase 1: shield + sword
      if (this._playerAttackCount >= DIFFICULTY.ATTACK_SPAM_THRESHOLD) {
        this._pattern = 'CHARGE';
        this._playerAttackCount = 0;
      } else {
        this._pattern = 'SWORD_AND_SHIELD';
      }
    }

    this._patternStep = 0;
    this._executeNextInPattern();
  }

  private _executeNextInPattern(): void {
    const patterns: Record<AttackPattern, BossState[]> = {
      // Phase 1: light×2 → heavy (learnable combo)
      SWORD_AND_SHIELD: [
        'telegraph_forsaken_slash', 'attack_forsaken_slash',
        'telegraph_forsaken_slash', 'attack_forsaken_slash',
        'telegraph_grief_strike',   'attack_grief_strike',
      ],
      // Phase 2: fast light×3 → condemned charge
      DUAL_WIELD: [
        'telegraph_forsaken_slash', 'attack_forsaken_slash',
        'telegraph_forsaken_slash', 'attack_forsaken_slash',
        'telegraph_forsaken_slash', 'attack_forsaken_slash',
        'telegraph_condemned_charge', 'attack_condemned_charge',
      ],
      // Unblockable charge (punishes attack spam)
      CHARGE: [
        'telegraph_condemned_charge', 'attack_condemned_charge',
      ],
      // Phase 2 only — massive slam (punishes dodge spam)
      LAST_STAND: [
        'telegraph_last_stand', 'attack_last_stand',
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

  // ── Telegraph event emitter ────────────────────────────────────────────
  private _emitTelegraph(): void {
    switch (this._state) {
      case 'telegraph_forsaken_slash':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_LIGHT, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphLight(this.sprite);
        break;
      case 'telegraph_grief_strike':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_HEAVY, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphHeavy(this.sprite);
        break;
      case 'telegraph_condemned_charge':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_UNB, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphUnblockable(this.sprite);
        break;
      case 'telegraph_last_stand':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_UNB, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphUnblockable(this.sprite);
        break;
    }
  }

  // ── Receive hit ────────────────────────────────────────────────────────
  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 1200;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    // Update boss bar
    this._boss.setHpPercent(this.hpPct);

    if (this._hp <= 0) {
      this._die(_attacker);
      return;
    }

    this._transition('stagger');
    this._scene.time.delayedCall(500, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  // ── Death ──────────────────────────────────────────────────────────────
  private _die(killer: Player): void {
    this._state = 'dead';
    this._sight.destroy();

    // Roll loot
    const lootEntry = ENEMY_LOOT['grimdar_the_forsaken'];
    if (lootEntry) {
      const loot = rollLoot(lootEntry);
      Bus.emit(GameEvent.ENEMY_KILLED, {
        enemyId: BOSS_CONFIG.id,
        lootLumens: loot.lumens,
      });
    }

    killer.ap.gain(10, 'kill');
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
    if (this._state === 'approach' || this._state === 'idle' || this._state === 'circle') {
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
  get phase(): BossPhase { return this._phase; }
  get state(): BossState { return this._state; }
}

import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { checkHit, type FightStance } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import { SightComponent, type SightConfig } from '../../../systems/SightSystem';
import { BossSystem, type BossConfig, type BossPhase } from '../../../systems/BossSystem';
import { ENEMY_STATS, PHASE_THRESHOLDS, TELEGRAPH } from '../../../config/enemyConfig';
import { ENEMY_LOOT, rollLoot } from '../../../systems/CurrencySystem';
import type { Player } from '../../Player';

// ── Luma Moth ──────────────────────────────────────────────────────────────
// Region: Verdenmere — heart of the bioluminescent forest
// Ancient guardian. Absorbed the grief of the region. Enormous with sorrow.
// It doesn't want to fight. It has no choice.
//
// Phase 1 (100-70%): Slow wing sweeps. Beautiful, peaceful.
// Phase 2 (70-40%):  Wing damage — erratic flight. Spore barrages.
// Phase 3 (40-0%):   Desperate. Light wall. Dark between attacks.
// Spare branch:       HP < 10% → choice to spare → companion unlock.

export type BossState =
  | 'idle' | 'hover' | 'approach'
  | 'telegraph_wing_gust' | 'telegraph_spore_cloud'
  | 'telegraph_light_wall' | 'telegraph_sorrow_pulse'
  | 'attack_wing_gust' | 'attack_spore_cloud'
  | 'attack_light_wall' | 'attack_sorrow_pulse'
  | 'stagger' | 'recover' | 'retreat' | 'spare_window' | 'dead';

type AttackPattern = 'GENTLE_SWEEP' | 'SPORE_BARRAGE' | 'LIGHT_WALL' | 'DESPERATION';

// ── Constants ─────────────────────────────────────────────────────────────
const STATS          = ENEMY_STATS.LumaMoth;
const DETECT_RANGE   = 320;
const ATTACK_RANGE   = 100; // wider — AOE boss
const MOVE_SPEED     = STATS.spd;
const ERRATIC_MULT   = 1.3;

const WING_GUST_TELEGRAPH     = TELEGRAPH.LIGHT;       // 12f
const SPORE_CLOUD_TELEGRAPH   = TELEGRAPH.HEAVY;        // 18f
const LIGHT_WALL_TELEGRAPH    = TELEGRAPH.UNBLOCKABLE;   // 20f
const SORROW_PULSE_TELEGRAPH  = TELEGRAPH.CHARGE;        // 24f

const WING_GUST_DAMAGE    = 25;
const SPORE_CLOUD_DAMAGE  = 15; // DOT tick
const LIGHT_WALL_DAMAGE   = 55;
const SORROW_PULSE_DAMAGE = 70;
const SORROW_KNOCKBACK    = 250;

const SPARE_HP_THRESHOLD = 0.10;

const BOSS_CONFIG: BossConfig = {
  id:           'luma_moth',
  name:         'Luma Moth',
  title:        'Guardian of Verdenmere',
  phase2MusicKey: 'mus_luma_p2',
  phase3MusicKey: 'mus_luma_p3',
  loreFragment: 'The forest remembers what you chose.',
};

const TELEGRAPH_FRAMES: Record<string, number> = {
  telegraph_wing_gust:    WING_GUST_TELEGRAPH,
  telegraph_spore_cloud:  SPORE_CLOUD_TELEGRAPH,
  telegraph_light_wall:   LIGHT_WALL_TELEGRAPH,
  telegraph_sorrow_pulse: SORROW_PULSE_TELEGRAPH,
};

export class LumaMoth {
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
  private _pattern: AttackPattern = 'GENTLE_SWEEP';
  private _patternStep = 0;

  // ── Phase
  private _phase: BossPhase = 1;
  private _spareOffered = false;

  // ── Player reads
  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  // ── Hover oscillation
  private _hoverOffset = 0;

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

    this.sprite = scene.physics.add.image(x, y, 'boss_luma_moth');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(1.8);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);
    body.setAllowGravity(false); // flying boss

    const sightCfg: SightConfig = {
      type:      'CONE_SIGHT',
      coneRange: DETECT_RANGE,
      coneAngle: 160,
      periRange: 80,
    };
    this._sight = new SightComponent(scene, this.sprite, sightCfg);

    this._boss = new BossSystem(scene, juice, BOSS_CONFIG);

    scene.events.on('boss_phase_change', (newPhase: BossPhase) => {
      this._phase = newPhase;
      if (newPhase === 2) this._onPhase2();
      if (newPhase === 3) this._onPhase3();
    });
  }

  private _onPhase2(): void {
    Bus.emit(GameEvent.BOSS_PHASE_CHANGE, { bossId: BOSS_CONFIG.id, phase: 2 });
  }

  private _onPhase3(): void {
    this._juice.shake(0.008, 300);
    Bus.emit(GameEvent.BOSS_PHASE_CHANGE, { bossId: BOSS_CONFIG.id, phase: 3 });
  }

  // ── Main update ────────────────────────────────────────────────────────
  update(delta: number, player: Player): void {
    if (this._state === 'dead' || this._state === 'spare_window') return;

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      player.x, player.y,
    );

    this._stateTimer  += delta;
    this._attackTimer  = Math.max(0, this._attackTimer - delta);

    // Hover float effect
    this._hoverOffset += delta * 0.003;
    const floatY = Math.sin(this._hoverOffset) * 4;
    this.sprite.y += floatY * (delta / 16);

    // Check spare threshold
    if (!this._spareOffered && this.hpPct < SPARE_HP_THRESHOLD) {
      this._offerSpare();
      return;
    }

    this._updateFacing(player);
    this._runState(dist, delta, player);
  }

  // ── State machine ──────────────────────────────────────────────────────
  private _runState(dist: number, delta: number, player: Player): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const speed = this._phase >= 2 ? MOVE_SPEED * ERRATIC_MULT : MOVE_SPEED;

    switch (this._state) {
      case 'idle': {
        body.setVelocity(0, 0);
        const detection = this._sight.checkPlayer(player.x, player.y);
        if (detection === 'RED' || detection === 'ORANGE') {
          this._transition('approach');
        }
        break;
      }

      case 'hover': {
        // Gentle side-to-side movement
        const sideDir = Math.sin(this._stateTimer / 400) > 0 ? 1 : -1;
        body.setVelocityX(speed * 0.4 * sideDir);
        if (this._stateTimer > 1500) {
          this._transition('approach');
        }
        break;
      }

      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(speed * dir);
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._choosePattern();
        }
        break;
      }

      // ── Telegraphs ──────────────────────────────────────────────────
      case 'telegraph_wing_gust':
      case 'telegraph_spore_cloud':
      case 'telegraph_light_wall':
      case 'telegraph_sorrow_pulse': {
        body.setVelocity(0, 0);
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
      case 'attack_wing_gust': {
        body.setVelocityX(0);
        if (this._stateTimer > 180) {
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            player.receiveHit(WING_GUST_DAMAGE, result.data.knockback, result.data.hitstun);
          }
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_spore_cloud': {
        body.setVelocityX(0);
        if (this._stateTimer > 200) {
          // Lingering DOT — damage on initial hit
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            player.receiveHit(SPORE_CLOUD_DAMAGE, 0, 8);
          }
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_light_wall': {
        // Unblockable — must find gaps
        body.setVelocityX(0);
        if (this._stateTimer > 280) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(LIGHT_WALL_DAMAGE, result.data.knockback, result.data.hitstun);
          }
          this._transition('recover');
        }
        break;
      }

      case 'attack_sorrow_pulse': {
        // Phase 3 AOE — can be parried if timed
        body.setVelocityX(0);
        if (this._stateTimer > 300) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(SORROW_PULSE_DAMAGE, SORROW_KNOCKBACK, 30);
            this._juice.shake(0.01, 350);
          }
          this._attackTimer = 2000;
          this._transition('recover');
        }
        break;
      }

      // ── Recovery ────────────────────────────────────────────────────
      case 'stagger': {
        body.setVelocity(0, 0);
        break;
      }

      case 'recover': {
        body.setVelocity(0, 0);
        if (this._stateTimer > 600) {
          if (this._hitCount >= 3) {
            this._transition('retreat');
          } else {
            this._transition('hover');
          }
        }
        break;
      }

      case 'retreat': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(speed * awayDir);
        if (this._stateTimer > 1000) {
          this._hitCount = 0;
          this._transition('hover');
        }
        break;
      }

      case 'dead':
      case 'spare_window':
        break;
    }
    void delta;
  }

  // ── Pattern selection ──────────────────────────────────────────────────
  private _choosePattern(): void {
    if (this._phase === 3) {
      this._pattern = this._playerDodgeCount >= DIFFICULTY.DODGE_SPAM_THRESHOLD
        ? 'DESPERATION'
        : 'LIGHT_WALL';
      this._playerDodgeCount = 0;
    } else if (this._phase === 2) {
      this._pattern = this._playerAttackCount >= DIFFICULTY.ATTACK_SPAM_THRESHOLD
        ? 'SPORE_BARRAGE'
        : 'SPORE_BARRAGE';
      this._playerAttackCount = 0;
    } else {
      this._pattern = 'GENTLE_SWEEP';
    }

    this._patternStep = 0;
    this._executeNextInPattern();
  }

  private _executeNextInPattern(): void {
    const patterns: Record<AttackPattern, BossState[]> = {
      GENTLE_SWEEP: [
        'telegraph_wing_gust', 'attack_wing_gust',
        'telegraph_wing_gust', 'attack_wing_gust',
      ],
      SPORE_BARRAGE: [
        'telegraph_spore_cloud', 'attack_spore_cloud',
        'telegraph_wing_gust',   'attack_wing_gust',
        'telegraph_spore_cloud', 'attack_spore_cloud',
      ],
      LIGHT_WALL: [
        'telegraph_light_wall', 'attack_light_wall',
      ],
      DESPERATION: [
        'telegraph_sorrow_pulse', 'attack_sorrow_pulse',
      ],
    };

    const steps = patterns[this._pattern];
    const next = steps[this._patternStep];
    if (next) {
      this._transition(next);
      this._patternStep++;
    } else {
      this._patternStep = 0;
      this._attackTimer = 1500;
      this._transition('recover');
    }
  }

  // ── Spare / Kill branch ────────────────────────────────────────────────
  private _offerSpare(): void {
    this._spareOffered = true;
    this._transition('spare_window');
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    Bus.emit(GameEvent.SPECIAL_START, { id: 'luma_spare' });
  }

  /** Called by scene when player makes a choice at the spare window. */
  resolveSpare(spared: boolean): void {
    if (spared) {
      // Moth collapses, recovers, transforms into companion
      Bus.emit(GameEvent.SPECIAL_END, { id: 'luma_spare', outcome: 'spared' });
      Bus.emit(GameEvent.CHOICE_MADE, { choiceId: 'luma_spare', outcome: 'spared' });
      this._state = 'dead'; // remove from combat
    } else {
      // Resume fight — moth is at < 10% HP
      this._transition('recover');
    }
  }

  // ── Telegraph emitter ──────────────────────────────────────────────────
  private _emitTelegraph(): void {
    switch (this._state) {
      case 'telegraph_wing_gust':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_LIGHT, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphLight(this.sprite);
        break;
      case 'telegraph_spore_cloud':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_HEAVY, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphHeavy(this.sprite);
        break;
      case 'telegraph_light_wall':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_UNB, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphUnblockable(this.sprite);
        break;
      case 'telegraph_sorrow_pulse':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_HEAVY, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphHeavy(this.sprite);
        break;
    }
  }

  // ── Receive hit ────────────────────────────────────────────────────────
  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead' || this._state === 'spare_window') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 1000;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir * 0.5); // flying boss — less knockback

    this._boss.setHpPercent(this.hpPct);

    if (this._hp <= 0) {
      this._die(_attacker);
      return;
    }

    this._transition('stagger');
    this._scene.time.delayedCall(400, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  // ── Death ──────────────────────────────────────────────────────────────
  private _die(killer: Player): void {
    this._state = 'dead';
    this._sight.destroy();

    const lootEntry = ENEMY_LOOT['luma_moth'];
    if (lootEntry) {
      const loot = rollLoot(lootEntry);
      Bus.emit(GameEvent.ENEMY_KILLED, {
        enemyId: BOSS_CONFIG.id,
        lootLumens: loot.lumens,
      });
    }

    killer.ap.gain(12, 'kill');
    this._boss.onBossDeath(this.sprite);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 1500,
      delay: 800,
      onComplete: () => this.sprite.destroy(),
    });
  }

  private _transition(next: BossState): void {
    this._state = next;
    this._stateTimer = 0;
  }

  private _updateFacing(player: Player): void {
    if (this._state === 'approach' || this._state === 'hover') {
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
  get isSpareOffered(): boolean { return this._spareOffered; }
}

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

// ── Sister Silence ─────────────────────────────────────────────────────────
// Region: The Unnamed City — the white tower at the center
// Last keeper of the Accord. Silent for 400 years — not inability, choice.
// The fight is a conversation. She is asking: are you ready?
//
// Phase 1 (100-70%): Slow, deliberate. All attacks 20f telegraph. Teaching.
// Phase 2 (70-40%):  Removes telegraph delays. Tests if you learned.
// Phase 3 (40-0%):   MEMORY_SIGHT. Knows player's every move. Must break pattern.

export type BossState =
  | 'idle' | 'approach' | 'circle' | 'observe'
  | 'telegraph_the_question' | 'telegraph_the_answer'
  | 'telegraph_silence' | 'telegraph_echo'
  | 'attack_the_question' | 'attack_the_answer'
  | 'attack_silence' | 'attack_echo'
  | 'stagger' | 'recover' | 'backoff' | 'dead';

type AttackPattern = 'QUESTION' | 'ANSWER' | 'SILENCE' | 'ECHO' | 'FULL_TEST';

// ── Constants ─────────────────────────────────────────────────────────────
const STATS          = ENEMY_STATS.SisterSilence;
const DETECT_RANGE   = 300;
const ATTACK_RANGE   = 75;
const MOVE_SPEED     = STATS.spd;

// Phase 1: all telegraphs are long (teaching)
const QUESTION_TELEGRAPH_P1 = TELEGRAPH.UNBLOCKABLE;  // 20f — generous
const ANSWER_TELEGRAPH_P1   = TELEGRAPH.UNBLOCKABLE;  // 20f
// Phase 2: telegraphs shorten (testing)
const QUESTION_TELEGRAPH_P2 = TELEGRAPH.LIGHT;        // 12f
const ANSWER_TELEGRAPH_P2   = TELEGRAPH.LIGHT;        // 12f
// Phase 3: near-zero telegraphs
const SILENCE_TELEGRAPH     = 8;                       // 8f — very fast
const ECHO_TELEGRAPH        = 10;                      // 10f

const QUESTION_DAMAGE    = 40;  // light × 3
const ANSWER_DAMAGE      = 80;  // unblockable
const SILENCE_DAMAGE     = 100; // full-arena
const ECHO_DAMAGE        = 60;  // mirrors player
const ANSWER_KNOCKBACK   = 300;
const SILENCE_KNOCKBACK  = 200;

// Player input tracking for ECHO (phase 3)
const ECHO_MEMORY_SIZE = 3;

const BOSS_CONFIG: BossConfig = {
  id:           'sister_silence',
  name:         'Sister Silence',
  title:        'Last Keeper of the Accord',
  phase2MusicKey: 'mus_sister_p2',
  phase3MusicKey: 'mus_sister_p3',
  loreFragment: 'Edric Fragment #4 — the truth she kept.',
};

export class SisterSilence {
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
  private _pattern: AttackPattern = 'QUESTION';
  private _patternStep = 0;
  private _questionStep = 0; // tracks light×3 within QUESTION pattern

  // ── Phase
  private _phase: BossPhase = 1;

  // ── Player reads
  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  // ── MEMORY_SIGHT (phase 3): track player's recent inputs
  private _playerInputMemory: string[] = [];

  // ── Sight
  private _sight: SightComponent;

  // ── Dynamic telegraph frames based on phase
  private get _telegraphFrames(): Record<string, number> {
    if (this._phase === 3) {
      return {
        telegraph_the_question: SILENCE_TELEGRAPH,
        telegraph_the_answer:   SILENCE_TELEGRAPH,
        telegraph_silence:      SILENCE_TELEGRAPH,
        telegraph_echo:         ECHO_TELEGRAPH,
      };
    }
    if (this._phase === 2) {
      return {
        telegraph_the_question: QUESTION_TELEGRAPH_P2,
        telegraph_the_answer:   ANSWER_TELEGRAPH_P2,
        telegraph_silence:      SILENCE_TELEGRAPH,
        telegraph_echo:         ECHO_TELEGRAPH,
      };
    }
    return {
      telegraph_the_question: QUESTION_TELEGRAPH_P1,
      telegraph_the_answer:   ANSWER_TELEGRAPH_P1,
      telegraph_silence:      SILENCE_TELEGRAPH,
      telegraph_echo:         ECHO_TELEGRAPH,
    };
  }

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._hp = this._maxHp = STATS.hp;

    this.sprite = scene.physics.add.image(x, y, 'boss_sister_silence');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(1.4);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);

    const sightCfg: SightConfig = {
      type:      'CONE_SIGHT',
      coneRange: DETECT_RANGE,
      coneAngle: 140,
      periRange: 70,
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
    this._juice.shake(0.012, 400);
    Bus.emit(GameEvent.BOSS_PHASE_CHANGE, { bossId: BOSS_CONFIG.id, phase: 3 });
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

    switch (this._state) {
      case 'idle': {
        body.setVelocityX(0);
        const detection = this._sight.checkPlayer(player.x, player.y);
        if (detection === 'RED' || detection === 'ORANGE') {
          this._transition('observe');
        }
        break;
      }

      case 'observe': {
        // Brief pause before engaging — she's studying you
        body.setVelocityX(0);
        if (this._stateTimer > 600) {
          this._transition('approach');
        }
        break;
      }

      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * dir);
        const sightState = this._sight.checkPlayer(player.x, player.y);
        if (sightState === 'LOST' || sightState === 'IDLE') {
          this._transition('idle');
          break;
        }
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._choosePattern();
        }
        break;
      }

      case 'circle': {
        const sideDir = Math.sin(this._stateTimer / 250) > 0 ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * 0.6 * sideDir);
        if (this._stateTimer > 1000) {
          this._transition('approach');
        }
        break;
      }

      // ── Telegraphs ──────────────────────────────────────────────────
      case 'telegraph_the_question':
      case 'telegraph_the_answer':
      case 'telegraph_silence':
      case 'telegraph_echo': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this._telegraphFrames[this._state] ?? TELEGRAPH.LIGHT;

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
      case 'attack_the_question': {
        // Light × 3 — "can you parry all three?"
        body.setVelocityX(0);
        if (this._stateTimer > 140) {
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            player.receiveHit(QUESTION_DAMAGE, result.data.knockback, result.data.hitstun);
          }
          this._questionStep++;
          if (this._questionStep >= 3) {
            this._questionStep = 0;
            this._executeNextInPattern();
          } else {
            // Continue the question sequence
            this._transition('telegraph_the_question');
          }
        }
        break;
      }

      case 'attack_the_answer': {
        // Unblockable — "if you can't, why are you here?"
        body.setVelocityX(0);
        if (this._stateTimer > 260) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(ANSWER_DAMAGE, ANSWER_KNOCKBACK, result.data.hitstun);
          }
          this._transition('recover');
        }
        break;
      }

      case 'attack_silence': {
        // Full-arena — no safe spot, must perfect-dodge through her
        body.setVelocityX(0);
        if (this._stateTimer > 320) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(SILENCE_DAMAGE, SILENCE_KNOCKBACK, 35);
            this._juice.shake(0.015, 500);
          }
          this._attackTimer = 2500;
          this._transition('recover');
        }
        break;
      }

      case 'attack_echo': {
        // Mirrors player's last 3 inputs — trained from your own hands
        body.setVelocityX(0);
        if (this._stateTimer > 200) {
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            player.receiveHit(ECHO_DAMAGE, result.data.knockback, result.data.hitstun);
          }
          this._executeNextInPattern();
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
        if (this._stateTimer > 400) {
          if (this._hitCount >= 4) {
            this._transition('backoff');
          } else {
            this._transition('circle');
          }
        }
        break;
      }

      case 'backoff': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(MOVE_SPEED * awayDir);
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

  // ── Pattern selection ──────────────────────────────────────────────────
  private _choosePattern(): void {
    if (this._phase === 3) {
      // Phase 3: MEMORY_SIGHT — uses player's own inputs against them
      if (this._playerInputMemory.length >= ECHO_MEMORY_SIZE) {
        this._pattern = 'ECHO';
      } else if (this._playerDodgeCount >= DIFFICULTY.DODGE_SPAM_THRESHOLD) {
        this._pattern = 'SILENCE';
        this._playerDodgeCount = 0;
      } else {
        this._pattern = 'FULL_TEST';
      }
    } else if (this._phase === 2) {
      // Phase 2: remove telegraph delays — tests if you learned
      if (this._playerAttackCount >= DIFFICULTY.ATTACK_SPAM_THRESHOLD) {
        this._pattern = 'ANSWER';
        this._playerAttackCount = 0;
      } else {
        this._pattern = 'QUESTION';
      }
    } else {
      // Phase 1: teaching — always question pattern
      this._pattern = 'QUESTION';
    }

    this._patternStep = 0;
    this._questionStep = 0;
    this._executeNextInPattern();
  }

  private _executeNextInPattern(): void {
    const patterns: Record<AttackPattern, BossState[]> = {
      // Light × 3 (question telegraphs handled in attack_the_question)
      QUESTION: [
        'telegraph_the_question', 'attack_the_question',
      ],
      // Direct unblockable
      ANSWER: [
        'telegraph_the_answer', 'attack_the_answer',
      ],
      // Phase 3: full-arena sweep
      SILENCE: [
        'telegraph_silence', 'attack_silence',
      ],
      // Phase 3: mirror player's inputs
      ECHO: [
        'telegraph_echo', 'attack_echo',
        'telegraph_echo', 'attack_echo',
        'telegraph_echo', 'attack_echo',
      ],
      // Phase 2/3: question → answer combo
      FULL_TEST: [
        'telegraph_the_question', 'attack_the_question',
        'telegraph_the_answer',   'attack_the_answer',
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
      case 'telegraph_the_question':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_LIGHT, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphLight(this.sprite);
        break;
      case 'telegraph_the_answer':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_UNB, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphUnblockable(this.sprite);
        break;
      case 'telegraph_silence':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_UNB, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphUnblockable(this.sprite);
        break;
      case 'telegraph_echo':
        Bus.emit(GameEvent.ENEMY_TELEGRAPH_HEAVY, { id: BOSS_CONFIG.id });
        this._juice.onTelegraphHeavy(this.sprite);
        break;
    }
  }

  // ── Receive hit ────────────────────────────────────────────────────────
  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 1000;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    this._boss.setHpPercent(this.hpPct);

    if (this._hp <= 0) {
      this._die(_attacker);
      return;
    }

    this._transition('stagger');
    this._scene.time.delayedCall(450, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

  // ── Player behaviour recording ─────────────────────────────────────────
  recordPlayerDodge(): void {
    this._playerDodgeCount++;
    this._recordPlayerInput('dodge');
  }

  recordPlayerAttack(): void {
    this._playerAttackCount++;
    this._recordPlayerInput('attack');
  }

  recordPlayerParry(): void {
    this._recordPlayerInput('parry');
  }

  private _recordPlayerInput(input: string): void {
    this._playerInputMemory.push(input);
    if (this._playerInputMemory.length > ECHO_MEMORY_SIZE) {
      this._playerInputMemory.shift();
    }
  }

  // ── Death ──────────────────────────────────────────────────────────────
  private _die(killer: Player): void {
    this._state = 'dead';
    this._sight.destroy();

    const lootEntry = ENEMY_LOOT['sister_silence'];
    if (lootEntry) {
      const loot = rollLoot(lootEntry);
      Bus.emit(GameEvent.ENEMY_KILLED, {
        enemyId: BOSS_CONFIG.id,
        lootLumens: loot.lumens,
      });
    }

    killer.ap.gain(20, 'kill');
    this._boss.onBossDeath(this.sprite);

    // Sky transformation
    Bus.emit(GameEvent.SKY_UNNAMED_REVEAL, { bossId: BOSS_CONFIG.id });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 1500,
      delay: 1200,
      onComplete: () => this.sprite.destroy(),
    });
  }

  private _transition(next: BossState): void {
    this._state = next;
    this._stateTimer = 0;
  }

  private _updateFacing(player: Player): void {
    if (this._state === 'approach' || this._state === 'observe' || this._state === 'circle') {
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
  get playerInputMemory(): readonly string[] { return this._playerInputMemory; }
}

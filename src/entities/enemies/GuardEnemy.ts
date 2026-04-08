import Phaser from 'phaser';
import { JuiceSystem }                          from '../../systems/JuiceSystem';
import { SightComponent, type SightConfig }     from '../../systems/SightSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../systems/CombatSystem';
import { Deaths, DIFFICULTY }                   from '../../config/difficultyConfig';
import type { Player }                          from '../Player';

// ── E33 Enemy Design rules ─────────────────────────────────────────────────
// Every attack telegraphed 12-20f before it lands.
// Enemy has 3 attack patterns that are readable and learnable.
// Enemy adapts to player behaviour (dodge spam, attack spam).

export type EnemyState =
  | 'patrol' | 'detect' | 'approach'
  | 'telegraph_light' | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_light' | 'attack_heavy' | 'attack_unblockable' | 'attack_grab'
  | 'stagger' | 'recover' | 'backoff' | 'circle' | 'dead';

type AttackPattern = 'A' | 'B' | 'C';
// Pattern A: 2× light → heavy (learnable)
// Pattern B: feint light → grab (punishes mashing)
// Pattern C: charge → unblockable (must dodge)

const DETECT_RANGE  = 200;
const ATTACK_RANGE  =  60;
const GRAB_RANGE    =  45;
const MOVE_SPEED    =  60; // px/s
const PATROL_SPEED  =  35;

export class GuardEnemy {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;

  // ── AI state
  private _state: EnemyState = 'patrol';
  private _stateTimer = 0;    // ms in current state
  private _attackTimer = 0;   // ms until next attack
  private _telegraphFrame = 0;// frames since telegraph started
  private _patrolDir: 1 | -1 = 1;
  private _patrolBounce = 0;

  // ── Combat tracking
  private _hp:      number;
  private _maxHp:   number;
  private _hitCount = 0;       // hits taken this engagement
  private _pattern: AttackPattern = 'A';

  // ── Sight
  private _sight: SightComponent;

  // ── Player behaviour reads
  private _playerDodgeCount  = 0;  // consecutive dodges detected
  private _playerAttackCount = 0;  // consecutive lights detected
  private _patternStep       = 0;  // position in current attack pattern

  // ── Attack data
  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light:       12,
    telegraph_heavy:       18,
    telegraph_unblockable: 20,
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

    this.sprite = scene.physics.add.image(x, y, 'npc_guard');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);

    // Cone sight — soldier archetype (reads facing direction)
    const sightCfg: SightConfig = {
      type:      'CONE_SIGHT',
      coneRange: DETECT_RANGE,
      coneAngle: 100,
      periRange: 40,
    };
    this._sight = new SightComponent(scene, this.sprite, sightCfg);
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
      // ── PATROL ──────────────────────────────────────────────────────
      case 'patrol': {
        body.setVelocityX(PATROL_SPEED * this._patrolDir);
        this._patrolBounce += delta;
        if (this._patrolBounce > 2000) {
          this._patrolBounce = 0;
          this._patrolDir = (this._patrolDir * -1) as 1 | -1;
          this.sprite.setFlipX(this._patrolDir < 0);
        }
        // Use SightComponent — triggers yellow→orange→red escalation
        const detection = this._sight.checkPlayer(player.x, player.y);
        if (detection === 'RED' || detection === 'ORANGE') {
          this._transition('detect');
        }
        break;
      }

      // ── DETECT ──────────────────────────────────────────────────────
      case 'detect': {
        body.setVelocityX(0);
        if (this._stateTimer > 300) this._transition('approach');
        break;
      }

      // ── APPROACH ────────────────────────────────────────────────────
      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * dir);
        // Lost sight — return to patrol
        const sightState = this._sight.checkPlayer(player.x, player.y);
        if (sightState === 'LOST' || sightState === 'IDLE') {
          this._transition('patrol');
          break;
        }
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._choosePattern(player);
        }
        break;
      }

      // ── TELEGRAPHS ──────────────────────────────────────────────────
      case 'telegraph_light':
      case 'telegraph_heavy':
      case 'telegraph_unblockable': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 12;

        // Visual telegraph
        if (this._telegraphFrame === 1) {
          if (this._state === 'telegraph_light') {
            this._juice.onTelegraphLight(this.sprite);
          } else if (this._state === 'telegraph_heavy') {
            this._juice.onTelegraphHeavy(this.sprite);
          } else {
            this._juice.onTelegraphUnblockable(this.sprite);
          }
        }

        // Hint system — if player dies repeatedly to this attack
        const attackId = this._state;
        const hintLevel = Deaths.getHintLevel(attackId);
        if (hintLevel === 1 || hintLevel === 2) {
          // Slow-mo hint window
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

      // ── ATTACKS ─────────────────────────────────────────────────────
      case 'attack_light':
      case 'attack_heavy': {
        body.setVelocityX(0);
        if (this._stateTimer > 200) {
          // Check hit
          const attackType: AttackType = this._state === 'attack_light' ? 'light' : 'heavy';
          const result = checkHit(this.stance, player.stance, attackType);
          if (result.connected) {
            const data = ATTACK_DATA[attackType];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._transition('recover');
        }
        break;
      }

      case 'attack_unblockable': {
        // Cannot be parried — must dodge
        body.setVelocityX(0);
        if (this._stateTimer > 250) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            // No parry check — bypasses parry system
            player.receiveHit(50, 200, 30);
          }
          this._transition('recover');
        }
        break;
      }

      case 'attack_grab': {
        // Feint → grab — punishes button mashing
        body.setVelocityX(0);
        if (this._stateTimer > 180) {
          if (dist < GRAB_RANGE) {
            player.receiveHit(25, 100, 20);
          }
          this._transition('recover');
        }
        break;
      }

      // ── STAGGER ─────────────────────────────────────────────────────
      case 'stagger': {
        body.setVelocityX(0);
        // Stagger duration set by attack that landed
        break; // transition handled by receiveHit
      }

      // ── RECOVER ─────────────────────────────────────────────────────
      case 'recover': {
        body.setVelocityX(0);
        if (this._stateTimer > 400) {
          if (this._hitCount >= 3) {
            this._transition('backoff');
          } else {
            this._transition('approach');
          }
        }
        break;
      }

      // ── BACK OFF ─────────────────────────────────────────────────────
      case 'backoff': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(MOVE_SPEED * awayDir);
        if (this._stateTimer > 1500) {
          this._hitCount = 0;
          this._transition('circle');
        }
        break;
      }

      // ── CIRCLE ───────────────────────────────────────────────────────
      case 'circle': {
        // Strafe sideways
        const sideDir = Math.sin(this._stateTimer / 300) > 0 ? 1 : -1;
        body.setVelocityX(PATROL_SPEED * sideDir);
        if (this._stateTimer > 1500) {
          this._transition('approach');
        }
        break;
      }
    }
  }

  // ── Pattern selection (reads player behaviour) ─────────────────────────
  private _choosePattern(player: Player): void {
    // Read player — dodge spammer → grab
    if (this._playerDodgeCount >= DIFFICULTY.DODGE_SPAM_THRESHOLD) {
      this._pattern = 'B';
      this._playerDodgeCount = 0;
    }
    // Attack spammer → counter with unblockable
    else if (this._playerAttackCount >= DIFFICULTY.ATTACK_SPAM_THRESHOLD) {
      this._pattern = 'C';
      this._playerAttackCount = 0;
    }
    // Default pattern A (teach the learnable one first)
    else {
      this._pattern = 'A';
    }

    this._patternStep = 0;
    this._executeNextInPattern();
    void player;
  }

  private _executeNextInPattern(): void {
    if (this._pattern === 'A') {
      // 2× light → heavy
      const steps: EnemyState[] = [
        'telegraph_light', 'attack_light',
        'telegraph_light', 'attack_light',
        'telegraph_heavy', 'attack_heavy',
      ];
      const next = steps[this._patternStep];
      if (next) {
        this._transition(next);
        this._patternStep++;
      } else {
        this._patternStep = 0;
        this._transition('recover');
      }
    } else if (this._pattern === 'B') {
      // Feint light → grab
      const steps: EnemyState[] = [
        'telegraph_light', 'attack_grab',
      ];
      const next = steps[this._patternStep];
      if (next) {
        this._transition(next);
        this._patternStep++;
      } else {
        this._patternStep = 0;
        this._transition('recover');
      }
    } else {
      // Charge → unblockable
      const steps: EnemyState[] = [
        'telegraph_unblockable', 'attack_unblockable',
      ];
      const next = steps[this._patternStep];
      if (next) {
        this._transition(next);
        this._patternStep++;
      } else {
        this._patternStep = 0;
        this._transition('recover');
      }
    }
  }

  // ── Receive hit from player ────────────────────────────────────────────
  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 1200; // cooldown before next attack attempt

    // Flash white
    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    // Knockback
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) {
      this._die(_attacker);
      return;
    }

    // Stagger
    this._transition('stagger');
    this._scene.time.delayedCall(500, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

  // ── Record player behaviour (called by scene when player acts) ─────────
  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  private _die(killer: Player): void {
    this._state = 'dead';
    this._sight.destroy();
    killer.ap.gain(2, 'kill');
    this._juice.onKill(this.sprite);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 800,
      delay: 500,
      onComplete: () => this.sprite.destroy(),
    });
  }

  private _transition(next: EnemyState): void {
    this._state = next;
    this._stateTimer = 0;
  }

  private _updateFacing(player: Player): void {
    if (this._state === 'approach' || this._state === 'detect') {
      const facingRight = player.x > this.sprite.x;
      this.sprite.setFlipX(!facingRight);
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
  get state(): EnemyState { return this._state; }
}

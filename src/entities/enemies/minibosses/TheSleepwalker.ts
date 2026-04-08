import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent, } from '../../../systems/EventBus';
import { makeSoundDetector } from '../../../systems/SightSystem';
import type { Player } from '../../Player';

// TheSleepwalker — SOUND_SIGHT only, moves randomly until alerted, then fast
// Sleepwalking state: random meandering, ignores player visually
// Alerted state: extremely fast, aggressive pursuit
// Sound events: PLAYER_LAND, footsteps, player attacks nearby

export type EnemyState =
  | 'sleepwalk' | 'alerted' | 'approach_fast'
  | 'telegraph_light' | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_light' | 'attack_heavy' | 'attack_slam'
  | 'stagger' | 'recover' | 'dead';

type AttackPattern = 'A' | 'B';

const ATTACK_RANGE    = 70;
const SLEEPWALK_SPEED = 30;  // slow, random
const ALERT_SPEED     = 150; // very fast when alerted
const CALM_DOWN_TIME  = 8000; // ms without sound → returns to sleepwalk

export class TheSleepwalker {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;

  private _state: EnemyState = 'sleepwalk';
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

  // Sound detection
  private _alerted    = false;
  private _alertTimer = 0; // counts down to calm
  private _soundCleanup: (() => void) | null = null;

  // Sleepwalk direction timer
  private _sleepDir: 1 | -1 = 1;
  private _sleepDirTimer = 0;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light:       12,
    telegraph_heavy:       18,
    telegraph_unblockable: 16,
  };

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
    hp = DIFFICULTY.HP.MINIBOSS,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._hp = this._maxHp = hp;

    this.sprite = scene.physics.add.image(x, y, 'the_sleepwalker');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(1.3);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);

    // Wire SOUND_SIGHT
    this._soundCleanup = makeSoundDetector({
      scene,
      entity: this.sprite,
      ranges: { footstep: 120, attack: 180, land: 200 },
      onDetect: () => this._onSoundDetected(),
    });
  }

  private _onSoundDetected(): void {
    if (this._state === 'dead') return;
    this._alerted = true;
    this._alertTimer = CALM_DOWN_TIME;
    if (this._state === 'sleepwalk') {
      this._juice.flash(0xff8800, 0.4, 150);
      Bus.emit(GameEvent.ENEMY_DETECT_RED, {
        id: 'sleepwalker_alerted',
        sourceX: this.sprite.x,
        sourceY: this.sprite.y,
      });
      this._transition('alerted');
    }
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      player.x, player.y,
    );

    this._stateTimer  += delta;
    this._attackTimer  = Math.max(0, this._attackTimer - delta);

    // Alert decay
    if (this._alerted) {
      this._alertTimer -= delta;
      if (this._alertTimer <= 0) {
        this._alerted = false;
        if (this._state === 'approach_fast' || this._state === 'alerted') {
          this._transition('sleepwalk');
        }
      }
    }

    this._updateFacing(player);
    this._runState(dist, delta, player);
  }

  private _runState(dist: number, delta: number, player: Player): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    switch (this._state) {
      case 'sleepwalk': {
        // Random direction changes
        this._sleepDirTimer -= delta;
        if (this._sleepDirTimer <= 0) {
          this._sleepDirTimer = 800 + Math.random() * 1200;
          this._sleepDir = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
          this.sprite.setFlipX(this._sleepDir < 0);
        }
        body.setVelocityX(SLEEPWALK_SPEED * this._sleepDir);

        // Bounce off walls
        if (body.blocked.left)  this._sleepDir =  1;
        if (body.blocked.right) this._sleepDir = -1;
        break;
      }

      case 'alerted': {
        body.setVelocityX(0);
        // Brief realization pause
        if (this._stateTimer > 400) {
          this._transition('approach_fast');
        }
        break;
      }

      case 'approach_fast': {
        if (!this._alerted) { this._transition('sleepwalk'); break; }
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(ALERT_SPEED * dir);
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._pattern = this._playerDodgeCount >= DIFFICULTY.DODGE_SPAM_THRESHOLD ? 'B' : 'A';
          this._playerDodgeCount = 0;
          this._patternStep = 0;
          this._executeNextInPattern();
        }
        break;
      }

      case 'telegraph_light':
      case 'telegraph_heavy':
      case 'telegraph_unblockable': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 12;

        if (this._telegraphFrame === 1) {
          if (this._state === 'telegraph_light') this._juice.onTelegraphLight(this.sprite);
          else if (this._state === 'telegraph_heavy') this._juice.onTelegraphHeavy(this.sprite);
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

      case 'attack_light': {
        body.setVelocityX(0);
        if (this._stateTimer > 160) {
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
        if (this._stateTimer > 200) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            const data = ATTACK_DATA['heavy'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_slam': {
        body.setVelocityX(0);
        if (this._stateTimer > 280) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(55, 240, 35);
            this._juice.shake(0.008, 300);
          }
          this._attackTimer = 1600;
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
        if (this._stateTimer > 400) {
          if (this._alerted) this._transition('approach_fast');
          else this._transition('sleepwalk');
        }
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _executeNextInPattern(): void {
    if (this._pattern === 'A') {
      const steps: EnemyState[] = [
        'telegraph_light', 'attack_light',
        'telegraph_light', 'attack_light',
        'telegraph_heavy', 'attack_heavy',
      ];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._attackTimer = 1000; this._transition('recover'); }
    } else {
      const steps: EnemyState[] = ['telegraph_unblockable', 'attack_slam'];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._transition('recover'); }
    }
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    // Getting hit always alerts the Sleepwalker
    if (!this._alerted) {
      this._onSoundDetected();
    }

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 900;
    this._alertTimer = CALM_DOWN_TIME; // reset calm timer

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) { this._die(_attacker); return; }

    this._transition('stagger');
    this._scene.time.delayedCall(450, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  private _die(killer: Player): void {
    this._state = 'dead';
    if (this._soundCleanup) {
      this._soundCleanup();
      this._soundCleanup = null;
    }
    killer.ap.gain(5, 'kill');
    Bus.emit(GameEvent.BOSS_KILLED, { entity: this.sprite, bossId: 'the_sleepwalker' });
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
    if (this._alerted && (this._state === 'approach_fast' || this._state === 'alerted')) {
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
  get isAlerted(): boolean { return this._alerted; }
  get state(): EnemyState { return this._state; }
}

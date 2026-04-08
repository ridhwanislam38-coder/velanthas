import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import type { Player } from '../../Player';

// IronveilInquisitor — casts slow debuff aura, parry punishes hard
// Slow aura: reduces player movement speed in range
// Parry punish: if player parries inquisitor, inquisitor retaliates with heavy counter instantly
// Pattern A: slow aura → light feeler → heavy punish
// Pattern B: aura pulse → unblockable surge

export type EnemyState =
  | 'patrol' | 'detect' | 'approach' | 'cast_aura'
  | 'telegraph_light' | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_light' | 'attack_heavy' | 'attack_unblockable'
  | 'parry_punish' | 'stagger' | 'recover' | 'backoff' | 'dead';

type AttackPattern = 'A' | 'B';

const DETECT_RANGE = 220;
const ATTACK_RANGE = 70;
const AURA_RANGE   = 150;
const MOVE_SPEED   = 55;
const PATROL_SPEED = 30;

export class IronveilInquisitor {
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
  private _pattern: AttackPattern = 'A';
  private _patternStep = 0;

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  // Aura state
  private _auraActive  = false;
  private _auraTimer   = 0;
  private _auraCircle: Phaser.GameObjects.Arc | null = null;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light:       14,
    telegraph_heavy:       18,
    telegraph_unblockable: 20,
  };

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
    hp = DIFFICULTY.HP.ELITE,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._hp = this._maxHp = hp;

    this.sprite = scene.physics.add.image(x, y, 'ironveil_inquisitor');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);

    // Listen for parry events — if player parries us, we counter
    Bus.on(GameEvent.PARRY_PERFECT, (data: unknown) => {
      const d = data as { target?: { x?: number; y?: number } };
      if (d?.target && this._state !== 'dead') {
        // Check if this parry was against us
        const dist = Phaser.Math.Distance.Between(
          this.sprite.x, this.sprite.y,
          d.target.x ?? 0, d.target.y ?? 0,
        );
        if (dist < 80) this._transition('parry_punish');
      }
    });
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      player.x, player.y,
    );

    this._stateTimer  += delta;
    this._attackTimer  = Math.max(0, this._attackTimer - delta);
    this._auraTimer    = Math.max(0, this._auraTimer - delta);

    // Aura slow debuff — emit to player if in range
    if (this._auraActive) {
      if (dist <= AURA_RANGE) {
        Bus.emit(GameEvent.SPECIAL_START, { id: 'slow_aura', source: this.sprite });
      }
      if (this._auraCircle) {
        this._auraCircle.setPosition(this.sprite.x, this.sprite.y);
      }
    }

    this._updateFacing(player);
    this._runState(dist, delta, player);
  }

  private _runState(dist: number, delta: number, player: Player): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    switch (this._state) {
      case 'patrol': {
        body.setVelocityX(PATROL_SPEED * this._patrolDir);
        this._patrolBounce += delta;
        if (this._patrolBounce > 2000) {
          this._patrolBounce = 0;
          this._patrolDir = (this._patrolDir * -1) as 1 | -1;
          this.sprite.setFlipX(this._patrolDir < 0);
        }
        if (dist < DETECT_RANGE) this._transition('detect');
        break;
      }

      case 'detect': {
        body.setVelocityX(0);
        if (this._stateTimer > 350) this._transition('cast_aura');
        break;
      }

      case 'cast_aura': {
        body.setVelocityX(0);
        if (this._stateTimer > 600) {
          this._activateAura();
          this._transition('approach');
        }
        break;
      }

      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * dir);
        if (dist > DETECT_RANGE * 1.2) {
          this._deactivateAura();
          this._transition('patrol');
          break;
        }
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
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 14;

        if (this._telegraphFrame === 1) {
          if (this._state === 'telegraph_light') {
            this._juice.onTelegraphLight(this.sprite);
          } else if (this._state === 'telegraph_heavy') {
            this._juice.onTelegraphHeavy(this.sprite);
          } else {
            this._juice.onTelegraphUnblockable(this.sprite);
          }
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
        if (this._stateTimer > 200) {
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
          this._attackTimer = 1400;
          this._transition('recover');
        }
        break;
      }

      case 'attack_unblockable': {
        body.setVelocityX(0);
        if (this._stateTimer > 260) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(55, 220, 32);
          }
          this._attackTimer = 1800;
          this._transition('recover');
        }
        break;
      }

      case 'parry_punish': {
        // Hard punish — instant heavy counter
        body.setVelocityX(0);
        if (this._stateTimer > 80) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(60, 250, 40); // massive punish
            this._juice.onHeavyHit([this.sprite]);
          }
          this._attackTimer = 1000;
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
        if (this._stateTimer > 450) {
          if (this._hitCount >= 3) this._transition('backoff');
          else this._transition('approach');
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

  private _executeNextInPattern(): void {
    if (this._pattern === 'A') {
      const steps: EnemyState[] = [
        'telegraph_light', 'attack_light',
        'telegraph_heavy', 'attack_heavy',
      ];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._transition('recover'); }
    } else {
      const steps: EnemyState[] = ['telegraph_unblockable', 'attack_unblockable'];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._transition('recover'); }
    }
  }

  private _activateAura(): void {
    if (this._auraActive) return;
    this._auraActive = true;
    this._auraCircle = this._scene.add.arc(
      this.sprite.x, this.sprite.y,
      AURA_RANGE, 0, 360, false,
      0x8844cc, 0.15,
    ).setDepth(7).setStrokeStyle(1, 0xaa66ff, 0.5);
  }

  private _deactivateAura(): void {
    this._auraActive = false;
    this._auraCircle?.destroy();
    this._auraCircle = null;
  }

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

    if (this._hp <= 0) { this._die(_attacker); return; }

    this._transition('stagger');
    this._scene.time.delayedCall(500, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  private _die(killer: Player): void {
    this._state = 'dead';
    this._deactivateAura();
    killer.ap.gain(3, 'kill');
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
  get state(): EnemyState { return this._state; }
}

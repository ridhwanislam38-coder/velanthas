import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import type { Player } from '../../Player';

// BoneColossus — 3-piece boss structure
// Destroy arms first → torso → skull (each is a separate HP pool)
// Arms block player from hitting torso
// Skull is final phase — fast + unblockable only

export type EnemyState =
  | 'idle' | 'approach'
  | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_arm_slam' | 'attack_torso_smash' | 'attack_skull_bite'
  | 'part_destroyed' | 'stagger' | 'recover' | 'dead';

type BossPiece = 'arms' | 'torso' | 'skull';

const DETECT_RANGE  = 300;
const ATTACK_RANGE  = 110;
const MOVE_SPEED    = 40;

// HP per piece
const ARM_HP    = 200;
const TORSO_HP  = 350;
const SKULL_HP  = 250;

export class BoneColossus {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;

  private _state: EnemyState = 'idle';
  private _stateTimer  = 0;
  private _attackTimer = 0;
  private _telegraphFrame = 0;

  // Overall HP (tracked as combined)
  private _hp:    number;
  private _maxHp: number;

  // Per-piece HP
  private _armHp:   number = ARM_HP;
  private _torsoHp: number = TORSO_HP;
  private _skullHp: number = SKULL_HP;

  private _activePiece: BossPiece = 'arms'; // player must destroy in order
  private _patternStep = 0;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_heavy:       20,
    telegraph_unblockable: 18,
  };

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._maxHp = ARM_HP + TORSO_HP + SKULL_HP;
    this._hp = this._maxHp;

    this.sprite = scene.physics.add.image(x, y, 'bone_colossus');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(3.0); // massive

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);
    body.setImmovable(true);
  }

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

  private _runState(dist: number, delta: number, player: Player): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    switch (this._state) {
      case 'idle': {
        body.setVelocityX(0);
        if (dist < DETECT_RANGE) this._transition('approach');
        break;
      }

      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * dir);
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._patternStep = 0;
          this._executePattern();
        }
        break;
      }

      case 'part_destroyed': {
        body.setVelocityX(0);
        if (this._stateTimer > 1200) this._transition('approach');
        break;
      }

      case 'telegraph_heavy':
      case 'telegraph_unblockable': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 20;

        if (this._telegraphFrame === 1) {
          if (this._state === 'telegraph_heavy') this._juice.onTelegraphHeavy(this.sprite);
          else this._juice.onTelegraphUnblockable(this.sprite);
        }

        const hintLevel = Deaths.getHintLevel(this._state);
        if (hintLevel === 1 || hintLevel === 2) {
          const dur = hintLevel === 1 ? DIFFICULTY.HINT_WINDOW_MS.LEVEL_1 : DIFFICULTY.HINT_WINDOW_MS.LEVEL_2;
          if (this._telegraphFrame === needed - 3) this._juice.slowMo(0.4, dur * 0.5);
        }

        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._executePattern();
        }
        break;
      }

      case 'attack_arm_slam': {
        body.setVelocityX(0);
        if (this._stateTimer > 300) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            const data = ATTACK_DATA['heavy'];
            player.receiveHit(data.damage, data.knockback * 2 | 0, data.hitstun);
          }
          this._juice.shake(0.009, 350);
          this._executePattern();
        }
        break;
      }

      case 'attack_torso_smash': {
        body.setVelocityX(0);
        if (this._stateTimer > 350) {
          if (dist < ATTACK_RANGE * 1.3) {
            player.receiveHit(55, 250, 35);
            this._juice.shake(0.011, 400);
          }
          this._attackTimer = 2400;
          this._transition('recover');
        }
        break;
      }

      case 'attack_skull_bite': {
        body.setVelocityX(0);
        if (this._stateTimer > 200) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(70, 300, 40); // skull = most dangerous
          }
          this._attackTimer = 1800;
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
        if (this._stateTimer > 600) this._transition('approach');
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _executePattern(): void {
    switch (this._activePiece) {
      case 'arms': {
        const steps: EnemyState[] = [
          'telegraph_heavy', 'attack_arm_slam',
          'telegraph_heavy', 'attack_arm_slam',
        ];
        const next = steps[this._patternStep];
        if (next) { this._transition(next); this._patternStep++; }
        else { this._patternStep = 0; this._attackTimer = 2000; this._transition('recover'); }
        break;
      }
      case 'torso': {
        const steps: EnemyState[] = [
          'telegraph_heavy', 'attack_arm_slam',
          'telegraph_unblockable', 'attack_torso_smash',
        ];
        const next = steps[this._patternStep];
        if (next) { this._transition(next); this._patternStep++; }
        else { this._patternStep = 0; this._attackTimer = 2200; this._transition('recover'); }
        break;
      }
      case 'skull': {
        const steps: EnemyState[] = [
          'telegraph_unblockable', 'attack_skull_bite',
          'telegraph_unblockable', 'attack_skull_bite',
        ];
        const next = steps[this._patternStep];
        if (next) { this._transition(next); this._patternStep++; }
        else { this._patternStep = 0; this._attackTimer = 1400; this._transition('recover'); }
        break;
      }
    }
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    // Hits go to active piece's HP first
    // Arms must be destroyed before torso; torso before skull
    let pieceDestroyed = false;

    switch (this._activePiece) {
      case 'arms': {
        this._armHp = Math.max(0, this._armHp - result.data.damage);
        this._hp = this._armHp + this._torsoHp + this._skullHp;
        if (this._armHp <= 0) {
          pieceDestroyed = true;
          this._activePiece = 'torso';
          Bus.emit(GameEvent.BOSS_PHASE_CHANGE, { entity: this.sprite, phase: 2, piece: 'arms_destroyed' });
        }
        break;
      }
      case 'torso': {
        this._torsoHp = Math.max(0, this._torsoHp - result.data.damage);
        this._hp = this._armHp + this._torsoHp + this._skullHp;
        if (this._torsoHp <= 0) {
          pieceDestroyed = true;
          this._activePiece = 'skull';
          Bus.emit(GameEvent.BOSS_PHASE_CHANGE, { entity: this.sprite, phase: 3, piece: 'torso_destroyed' });
        }
        break;
      }
      case 'skull': {
        this._skullHp = Math.max(0, this._skullHp - result.data.damage);
        this._hp = this._armHp + this._torsoHp + this._skullHp;
        if (this._skullHp <= 0) {
          this._die(_attacker);
          return;
        }
        break;
      }
    }

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    // Minimal knockback — colossus barely moves
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * 0.15 * kbDir);

    if (pieceDestroyed) {
      this._juice.flash(0xffffff, 0.8, 200);
      this._juice.shake(0.012, 500);
      this._patternStep = 0;
      this._attackTimer = 0;
      this._transition('part_destroyed');
    } else if (result.data.hitstun > 20) {
      this._transition('stagger');
      this._scene.time.delayedCall(500, () => {
        if (this._state === 'stagger') this._transition('recover');
      });
    }
  }

  private _die(killer: Player): void {
    this._state = 'dead';
    killer.ap.gain(5, 'kill');
    Bus.emit(GameEvent.BOSS_KILLED, { entity: this.sprite, bossId: 'bone_colossus' });
    this._juice.onKill(this.sprite);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 1500,
      delay: 1000,
      onComplete: () => this.sprite.destroy(),
    });
  }

  private _transition(next: EnemyState): void {
    this._state = next;
    this._stateTimer = 0;
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
  get activePiece(): BossPiece { return this._activePiece; }
  get state(): EnemyState { return this._state; }
}

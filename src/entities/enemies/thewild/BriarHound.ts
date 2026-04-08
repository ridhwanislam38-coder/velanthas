import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import type { Player } from '../../Player';

// BriarHound — fast dash attack, pounces from distance
// Pattern A: pounce → bite light × 2
// Pattern B: feint pounce → circle → pounce from behind

export type EnemyState =
  | 'patrol' | 'detect' | 'approach' | 'circle'
  | 'telegraph_light' | 'telegraph_unblockable'
  | 'attack_light' | 'attack_pounce'
  | 'stagger' | 'recover' | 'backoff' | 'dead';

type AttackPattern = 'A' | 'B';

const DETECT_RANGE  = 240;
const POUNCE_RANGE  = 180;
const BITE_RANGE    = 55;
const MOVE_SPEED    = 95;
const PATROL_SPEED  = 50;
const POUNCE_SPEED  = 320;

export class BriarHound {
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
  private _pounceVelX  = 0;

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light:       12,
    telegraph_unblockable: 14,
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

    this.sprite = scene.physics.add.image(x, y, 'briar_hound');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);
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
      case 'patrol': {
        body.setVelocityX(PATROL_SPEED * this._patrolDir);
        this._patrolBounce += delta;
        if (this._patrolBounce > 1800) {
          this._patrolBounce = 0;
          this._patrolDir = (this._patrolDir * -1) as 1 | -1;
          this.sprite.setFlipX(this._patrolDir < 0);
        }
        if (dist < DETECT_RANGE) this._transition('detect');
        break;
      }

      case 'detect': {
        body.setVelocityX(0);
        if (this._stateTimer > 200) this._transition('approach');
        break;
      }

      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * dir);
        if (dist > DETECT_RANGE * 1.2) this._transition('patrol');
        if (dist < POUNCE_RANGE && this._attackTimer <= 0) {
          this._pattern = this._playerDodgeCount >= DIFFICULTY.DODGE_SPAM_THRESHOLD ? 'B' : 'A';
          this._playerDodgeCount = 0;
          this._patternStep = 0;
          this._executeNextInPattern(player);
        }
        break;
      }

      case 'circle': {
        // Circle around player before flanking
        const sideDir = Math.sin(this._stateTimer / 200) > 0 ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * sideDir);
        if (this._stateTimer > 1000) {
          this._patternStep = 0;
          this._pattern = 'A'; // pounce from new position
          this._executeNextInPattern(player);
        }
        break;
      }

      case 'telegraph_light':
      case 'telegraph_unblockable': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 12;

        if (this._telegraphFrame === 1) {
          if (this._state === 'telegraph_light') {
            this._juice.onTelegraphLight(this.sprite);
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
          this._executeNextInPattern(player);
        }
        break;
      }

      case 'attack_pounce': {
        // Maintain pounce velocity until hitting range or wall
        body.setVelocityX(this._pounceVelX);
        const pDist = Phaser.Math.Distance.Between(
          this.sprite.x, this.sprite.y,
          player.x, player.y,
        );
        if (pDist < BITE_RANGE || this._stateTimer > 400) {
          body.setVelocityX(0);
          if (pDist < BITE_RANGE) {
            player.receiveHit(30, 200, 20);
            this._juice.shake(0.004, 150);
          }
          this._executeNextInPattern(player);
        }
        break;
      }

      case 'attack_light': {
        body.setVelocityX(0);
        if (this._stateTimer > 150) {
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            const data = ATTACK_DATA['light'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._executeNextInPattern(player);
        }
        break;
      }

      case 'stagger': {
        body.setVelocityX(0);
        break;
      }

      case 'recover': {
        body.setVelocityX(0);
        if (this._stateTimer > 300) {
          if (this._hitCount >= 4) this._transition('backoff');
          else this._transition('approach');
        }
        break;
      }

      case 'backoff': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(MOVE_SPEED * awayDir);
        if (this._stateTimer > 800) {
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

  private _executeNextInPattern(player: Player): void {
    if (this._pattern === 'A') {
      // pounce → bite × 2
      const steps: EnemyState[] = [
        'telegraph_unblockable', 'attack_pounce',
        'telegraph_light', 'attack_light',
        'telegraph_light', 'attack_light',
      ];
      const next = steps[this._patternStep];
      if (next) {
        if (next === 'attack_pounce') {
          const dir = player.x > this.sprite.x ? 1 : -1;
          this._pounceVelX = POUNCE_SPEED * dir;
        }
        this._transition(next);
        this._patternStep++;
      } else {
        this._patternStep = 0;
        this._attackTimer = 1000;
        this._transition('recover');
      }
    } else {
      // Pattern B: feint → circle → pounce
      const steps: EnemyState[] = ['telegraph_unblockable', 'circle'];
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

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 700;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) { this._die(_attacker); return; }

    this._transition('stagger');
    this._scene.time.delayedCall(350, () => {
      if (this._state === 'stagger') this._transition('recover');
    });
  }

  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  private _die(killer: Player): void {
    this._state = 'dead';
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
    if (this._state !== 'attack_pounce') {
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

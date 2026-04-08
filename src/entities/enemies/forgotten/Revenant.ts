import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import type { Player } from '../../Player';

// Revenant — becomes invulnerable for 3 seconds after taking damage, then retaliates
// Pattern A: heavy + retreat
// Pattern B: after invuln window — burst counter (unblockable)

export type EnemyState =
  | 'patrol' | 'detect' | 'approach'
  | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_heavy' | 'attack_burst'
  | 'invulnerable' | 'retaliate'
  | 'stagger' | 'recover' | 'backoff' | 'dead';

const DETECT_RANGE  = 210;
const ATTACK_RANGE  = 65;
const MOVE_SPEED    = 65;
const PATROL_SPEED  = 35;
const INVULN_DURATION = 3000; // ms

export class Revenant {
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
  private _patternStep = 0;

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  private _invulnTimer = 0;
  private _isInvuln    = false;
  private _retaliateQueued = false;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_heavy:       18,
    telegraph_unblockable: 15,
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

    this.sprite = scene.physics.add.image(x, y, 'revenant');
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

    // Tick invulnerability
    if (this._isInvuln) {
      this._invulnTimer -= delta;
      if (this._invulnTimer <= 0) {
        this._isInvuln = false;
        this.sprite.setAlpha(1);
        this.sprite.clearTint();
        if (this._retaliateQueued) {
          this._retaliateQueued = false;
          this._transition('retaliate');
        }
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
        if (this._stateTimer > 300) this._transition('approach');
        break;
      }

      case 'approach': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(MOVE_SPEED * dir);
        if (dist > DETECT_RANGE * 1.2) this._transition('patrol');
        if (dist < ATTACK_RANGE && this._attackTimer <= 0 && !this._isInvuln) {
          this._patternStep = 0;
          this._transition('telegraph_heavy');
        }
        break;
      }

      case 'invulnerable': {
        // Back away during invuln
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(MOVE_SPEED * 0.7 * awayDir);
        // Actual invuln exit is handled in update() via _invulnTimer
        break;
      }

      case 'retaliate': {
        // Snap back to player and unblockable burst
        body.setVelocityX(0);
        if (this._stateTimer > 100) {
          this._patternStep = 0;
          this._transition('telegraph_unblockable');
        }
        break;
      }

      case 'telegraph_heavy': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES['telegraph_heavy'] ?? 18;
        if (this._telegraphFrame === 1) this._juice.onTelegraphHeavy(this.sprite);
        const hintLevel = Deaths.getHintLevel('telegraph_heavy');
        if ((hintLevel === 1 || hintLevel === 2) && this._telegraphFrame === needed - 3) {
          const dur = hintLevel === 1 ? DIFFICULTY.HINT_WINDOW_MS.LEVEL_1 : DIFFICULTY.HINT_WINDOW_MS.LEVEL_2;
          this._juice.slowMo(0.4, dur * 0.5);
        }
        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._transition('attack_heavy');
        }
        break;
      }

      case 'telegraph_unblockable': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES['telegraph_unblockable'] ?? 15;
        if (this._telegraphFrame === 1) this._juice.onTelegraphUnblockable(this.sprite);
        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._transition('attack_burst');
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
          this._attackTimer = 1400;
          this._transition('recover');
        }
        break;
      }

      case 'attack_burst': {
        // Retaliation burst — 3 rapid strikes
        body.setVelocityX(0);
        if (this._stateTimer > 80) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(50, 200, 28);
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
          if (this._hitCount >= 4) this._transition('backoff');
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

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    // Invulnerable — no damage
    if (this._isInvuln) {
      this._juice.flash(0xffffff, 0.2, 40);
      return;
    }

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 800;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead' && this._isInvuln) {
        this.sprite.setTint(0x4444cc); // blue invuln tint
      } else if (this._state !== 'dead') {
        this.sprite.clearTint();
      }
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) { this._die(_attacker); return; }

    // Activate invulnerability
    this._isInvuln = true;
    this._invulnTimer = INVULN_DURATION;
    this._retaliateQueued = true;
    this.sprite.setAlpha(0.5);
    this.sprite.setTint(0x4444cc); // blue tint during invuln
    this._juice.flash(0x4444cc, 0.4, 150);

    this._transition('invulnerable');
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
  get isInvulnerable(): boolean { return this._isInvuln; }
  get state(): EnemyState { return this._state; }
}

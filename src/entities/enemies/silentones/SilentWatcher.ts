import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { DIFFICULTY } from '../../../config/difficultyConfig';
import { SightComponent } from '../../../systems/SightSystem';
import type { Player } from '../../Player';

// SilentWatcher — MEMORY_SIGHT, never moves
// Projects a kill beam if player stays in its sight line for 3 seconds
// Beam is lethal — must break line of sight before it fires

export type EnemyState =
  | 'watching' | 'charging_beam' | 'firing_beam' | 'cooling'
  | 'stagger' | 'dead';

const SIGHT_RANGE   = 400;
const BEAM_RANGE    = 400;
const CHARGE_TIME   = 3000; // 3 seconds of sight = beam fires
const BEAM_DURATION = 500;  // beam fires for 500ms

export class SilentWatcher {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;
  private _sight:  SightComponent;

  private _state: EnemyState = 'watching';
  private _stateTimer = 0;

  private _hp:     number;
  private _maxHp:  number;

  // Sight line timer
  private _sightTimer  = 0;
  private _playerInSight = false;

  // Beam visual
  private _beamLine: Phaser.GameObjects.Line | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
    hp = DIFFICULTY.HP.GUARD,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._hp = this._maxHp = hp;

    this.sprite = scene.physics.add.image(x, y, 'silent_watcher');
    this.sprite.setDepth(8);
    this.sprite.setImmovable(true); // never moves

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setImmovable(true);

    // MEMORY_SIGHT — always knows
    this._sight = new SightComponent(scene, this.sprite, { type: 'MEMORY_SIGHT' });
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    this._stateTimer += delta;

    // Check line of sight (simple horizontal + Y check)
    const dx = player.x - this.sprite.x;
    const dy = Math.abs(player.y - this.sprite.y);
    const dist = Math.abs(dx);
    const facingRight = !this.sprite.flipX;

    this._playerInSight = dist < SIGHT_RANGE
      && dy < 30
      && ((facingRight && dx > 0) || (!facingRight && dx < 0));

    this._sight.checkPlayer(player.x, player.y);
    this._updateFacing(player);
    this._runState(delta, player, dist);
  }

  private _runState(delta: number, player: Player, dist: number): void {
    switch (this._state) {
      case 'watching': {
        if (this._playerInSight) {
          this._sightTimer += delta;
          // Visual indicator — tint grows red
          const pct = Math.min(1, this._sightTimer / CHARGE_TIME);
          const r = Math.floor(pct * 255);
          this.sprite.setTint(Phaser.Display.Color.GetColor(r, 255 - r, 255 - r));

          if (this._sightTimer >= CHARGE_TIME) {
            this._sightTimer = 0;
            this._transition('charging_beam');
          }
        } else {
          // Decay sight timer when player breaks LOS
          this._sightTimer = Math.max(0, this._sightTimer - delta * 2);
          this.sprite.clearTint();
        }
        break;
      }

      case 'charging_beam': {
        // Visual charge-up flash
        if (this._stateTimer > 300) {
          this._transition('firing_beam');
        }
        break;
      }

      case 'firing_beam': {
        this._drawBeam(player);
        // Lethal beam — check if player in sight line while beam active
        if (this._playerInSight && dist < BEAM_RANGE) {
          player.receiveHit(9999, 0, 60); // lethal
        }
        if (this._stateTimer > BEAM_DURATION) {
          this._destroyBeam();
          this._transition('cooling');
        }
        break;
      }

      case 'cooling': {
        this.sprite.clearTint();
        if (this._stateTimer > 2000) {
          this._transition('watching');
        }
        break;
      }

      case 'stagger': {
        if (this._stateTimer > 400) this._transition('watching');
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _drawBeam(player: Player): void {
    if (!this._beamLine) {
      this._beamLine = this._scene.add.line(
        0, 0,
        this.sprite.x, this.sprite.y,
        player.x, this.sprite.y,
        0xff0000, 0.9,
      ).setDepth(250).setOrigin(0, 0);
      this._beamLine.setLineWidth(3);
    } else {
      // Update end point
      this._beamLine.setTo(
        this.sprite.x, this.sprite.y,
        player.x, this.sprite.y,
      );
    }
  }

  private _destroyBeam(): void {
    this._beamLine?.destroy();
    this._beamLine = null;
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    // Watcher doesn't move
    if (this._hp <= 0) { this._die(_attacker); return; }

    // Hitting watcher resets beam charge
    this._sightTimer = 0;
    this._destroyBeam();
    this._transition('stagger');
  }

  private _die(killer: Player): void {
    this._state = 'dead';
    this._destroyBeam();
    this._sight.destroy();
    killer.ap.gain(2, 'kill');
    this._juice.onKill(this.sprite);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
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
  get state(): EnemyState { return this._state; }
}

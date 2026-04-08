import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { DIFFICULTY } from '../../../config/difficultyConfig';
import { SightComponent } from '../../../systems/SightSystem';
import type { Player } from '../../Player';

// SilentChaser — extremely fast, MEMORY_SIGHT
// No attack animation — collision damage only (contact = hurt)
// Cannot be shaken off — always pursues
// Only weaknesses: create distance, use terrain

export type EnemyState =
  | 'idle' | 'chase' | 'contact_stun' | 'stagger' | 'dead';

const DETECT_RANGE  = 9999; // MEMORY_SIGHT
const CHASE_SPEED   = 180;  // very fast
const CONTACT_RANGE = 30;   // collision damage radius
const CONTACT_DAMAGE = 22;
const CONTACT_KNOCKBACK = 150;
const CONTACT_HITSTUN   = 18;

export class SilentChaser {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;
  private _sight:  SightComponent;

  private _state: EnemyState = 'idle';
  private _stateTimer = 0;

  private _hp:     number;
  private _maxHp:  number;

  private _contactTimer = 0; // cooldown after dealing contact damage

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
    hp = DIFFICULTY.HP.GUARD,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._hp = this._maxHp = hp;

    this.sprite = scene.physics.add.image(x, y, 'silent_chaser');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);

    this._sight = new SightComponent(scene, this.sprite, { type: 'MEMORY_SIGHT' });
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    // MEMORY_SIGHT — always knows
    this._sight.checkPlayer(player.x, player.y);

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      player.x, player.y,
    );

    this._stateTimer   += delta;
    this._contactTimer  = Math.max(0, this._contactTimer - delta);

    this._updateFacing(player);
    this._runState(dist, delta, player);
  }

  private _runState(dist: number, delta: number, player: Player): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    switch (this._state) {
      case 'idle': {
        // MEMORY_SIGHT = always chasing
        this._transition('chase');
        break;
      }

      case 'chase': {
        const dir = player.x > this.sprite.x ? 1 : -1;
        body.setVelocityX(CHASE_SPEED * dir);

        // Contact damage — no attack animation
        if (dist < CONTACT_RANGE && this._contactTimer <= 0) {
          player.receiveHit(CONTACT_DAMAGE, CONTACT_KNOCKBACK, CONTACT_HITSTUN);
          this._contactTimer = 600; // 600ms between contact hits
          this._juice.onLightHit([this.sprite]);
        }
        break;
      }

      case 'contact_stun': {
        // Brief pause after dealing damage
        body.setVelocityX(0);
        if (this._stateTimer > 150) this._transition('chase');
        break;
      }

      case 'stagger': {
        body.setVelocityX(0);
        if (this._stateTimer > 300) this._transition('chase');
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) { this._die(_attacker); return; }

    this._transition('stagger');
  }

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
      duration: 600,
      delay: 300,
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

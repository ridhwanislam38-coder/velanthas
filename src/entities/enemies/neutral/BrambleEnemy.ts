import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { DIFFICULTY } from '../../../config/difficultyConfig';
import type { Player } from '../../Player';

// BrambleEnemy — damages on touch; wall-crawling
// Crawls along walls and ceilings using gravity flip
// No attack animations — contact damage only like SilentChaser

export type EnemyState =
  | 'crawl' | 'contact_stun' | 'stagger' | 'dead';

const CRAWL_SPEED     = 70;
const CONTACT_RANGE   = 32;
const CONTACT_DAMAGE  = 15;
const CONTACT_KB      = 130;
const CONTACT_HITSTUN = 14;

export class BrambleEnemy {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;

  private _state: EnemyState = 'crawl';
  private _stateTimer  = 0;
  private _contactTimer = 0;

  private _hp:     number;
  private _maxHp:  number;

  // Wall-crawl state
  private _crawlDir: 1 | -1 = 1;
  private _onWall  = false;
  private _gravityFlipped = false;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
    hp = DIFFICULTY.HP.GUARD,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._hp = this._maxHp = hp;

    this.sprite = scene.physics.add.image(x, y, 'bramble_enemy');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setTint(0x226622); // dark green

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(200);
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      player.x, player.y,
    );

    this._stateTimer   += delta;
    this._contactTimer  = Math.max(0, this._contactTimer - delta);

    this._runState(dist, delta, player);
  }

  private _runState(dist: number, delta: number, player: Player): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    switch (this._state) {
      case 'crawl': {
        // Wall crawl — move horizontally; when hitting a wall, try to crawl up
        body.setVelocityX(CRAWL_SPEED * this._crawlDir);

        // Detect wall collision — reverse
        if (body.blocked.right && this._crawlDir === 1) {
          this._crawlDir = -1;
        } else if (body.blocked.left && this._crawlDir === -1) {
          this._crawlDir = 1;
        }

        // Detect floor/ceiling — crawl along it (slow Y movement to "stick")
        if (body.blocked.down || body.blocked.up) {
          body.setVelocityY(0);
        } else {
          // Gravity ensures floor contact; on ceiling we need gravity flip
          if (this._gravityFlipped) {
            body.setGravityY(-600); // pull to ceiling
          }
        }

        // Contact damage — on touch
        if (dist < CONTACT_RANGE && this._contactTimer <= 0) {
          player.receiveHit(CONTACT_DAMAGE, CONTACT_KB, CONTACT_HITSTUN);
          this._contactTimer = 500;
        }

        // Occasionally switch gravity to crawl ceiling
        if (this._stateTimer > 3000 && body.blocked.up && !this._gravityFlipped) {
          this._gravityFlipped = true;
          this._stateTimer = 0;
        } else if (this._stateTimer > 4000 && this._gravityFlipped) {
          this._gravityFlipped = false;
          body.setGravityY(0); // restore normal
          this._stateTimer = 0;
        }
        break;
      }

      case 'contact_stun': {
        body.setVelocityX(0);
        if (this._stateTimer > 200) this._transition('crawl');
        break;
      }

      case 'stagger': {
        body.setVelocityX(0);
        body.setGravityY(0);
        this._gravityFlipped = false;
        if (this._stateTimer > 350) this._transition('crawl');
        break;
      }

      case 'dead':
        break;
    }
    void delta;
    void player;
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.setTint(0x226622);
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (this._hp <= 0) { this._die(_attacker); return; }

    this._transition('stagger');
  }

  private _die(killer: Player): void {
    this._state = 'dead';
    killer.ap.gain(1, 'kill');
    this._juice.onKill(this.sprite);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setGravityY(0);
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

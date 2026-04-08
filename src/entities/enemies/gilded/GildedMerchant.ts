import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import type { Player } from '../../Player';

// GildedMerchant — non-combatant who calls guards when threatened
// If player is hostile (attacks merchant), merchant shouts and triggers guard spawn
// Will flee rather than fight; only attacks weakly if cornered

export type EnemyState =
  | 'idle' | 'flee' | 'cornered'
  | 'telegraph_light' | 'attack_light'
  | 'calling_guard' | 'stagger' | 'dead';

const FLEE_SPEED   = 120;
const DETECT_RANGE = 180;   // becomes hostile if player too close and hostile
const CORNER_RANGE = 50;    // too close to flee — fight back

export class GildedMerchant {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;

  private _state: EnemyState = 'idle';
  private _stateTimer  = 0;
  private _attackTimer = 0;
  private _telegraphFrame = 0;

  private _hp:     number;
  private _maxHp:  number;

  private _calledGuard = false;
  private _isHostile   = false; // set true when player attacks

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light: 12,
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

    this.sprite = scene.physics.add.image(x, y, 'gilded_merchant');
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
      case 'idle': {
        body.setVelocityX(0);
        // Do nothing unless attacked (handled by receiveHit) or player hostile nearby
        if (this._isHostile && dist < DETECT_RANGE) {
          if (!this._calledGuard) {
            this._callForGuards();
          }
          this._transition('flee');
        }
        break;
      }

      case 'flee': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(FLEE_SPEED * awayDir);
        this.sprite.setFlipX(awayDir > 0); // look away from player

        if (dist < CORNER_RANGE) {
          this._transition('cornered');
        }
        break;
      }

      case 'cornered': {
        body.setVelocityX(0);
        if (this._stateTimer > 400 && this._attackTimer <= 0) {
          this._transition('telegraph_light');
        }
        break;
      }

      case 'telegraph_light': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES['telegraph_light'] ?? 12;
        if (this._telegraphFrame === 1) this._juice.onTelegraphLight(this.sprite);
        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._transition('attack_light');
        }
        break;
      }

      case 'attack_light': {
        body.setVelocityX(0);
        if (this._stateTimer > 200) {
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            // Weak attack — half damage (merchant, not a fighter)
            player.receiveHit(5, 40, 8);
          }
          this._attackTimer = 1600;
          this._transition('flee');
        }
        break;
      }

      case 'calling_guard': {
        body.setVelocityX(0);
        if (this._stateTimer > 600) this._transition('flee');
        break;
      }

      case 'stagger': {
        body.setVelocityX(0);
        if (this._stateTimer > 300) this._transition('flee');
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _callForGuards(): void {
    this._calledGuard = true;
    this._transition('calling_guard');

    // Signal via Bus — scene handles spawning guards
    Bus.emit(GameEvent.FACTION_REP_CHANGED, {
      id: 'gilded_guard_call',
      sourceX: this.sprite.x,
      sourceY: this.sprite.y,
      faction: 'gilded',
    });

    this._juice.flash(0xffcc00, 0.5, 200);
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._isHostile = true;
    this._hp = Math.max(0, this._hp - result.data.damage);

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * kbDir);

    if (!this._calledGuard) {
      this._callForGuards();
    }

    if (this._hp <= 0) { this._die(_attacker); return; }

    this._transition('stagger');
  }

  private _die(killer: Player): void {
    this._state = 'dead';
    killer.ap.gain(1, 'kill');
    // Faction rep consequence
    Bus.emit(GameEvent.FACTION_REP_CHANGED, {
      id: 'gilded_merchant_killed',
      faction: 'gilded',
      delta: -10,
    });
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
    if (this._state === 'idle') {
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

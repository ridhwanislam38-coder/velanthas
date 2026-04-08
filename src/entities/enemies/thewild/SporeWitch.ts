import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import type { Player } from '../../Player';

// SporeWitch — ranged spore cloud (DOT), teleports short range when hit
// Pattern A: spore cloud (DOT area) → light poke
// Pattern B: rapid spore burst × 3

export type EnemyState =
  | 'patrol' | 'detect' | 'approach' | 'reposition'
  | 'telegraph_light' | 'telegraph_heavy'
  | 'attack_light' | 'attack_spore' | 'attack_spore_burst'
  | 'teleport' | 'stagger' | 'recover' | 'backoff' | 'dead';

const DETECT_RANGE = 260;
const RANGED_RANGE = 180;
const MELEE_FLEE   = 90;
const MOVE_SPEED   = 50;
const PATROL_SPEED = 30;
const TELEPORT_DIST = 120;

export class SporeWitch {
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
  private _burstCount = 0;

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  // Active DOT clouds
  private _activeClouds: Array<{ obj: Phaser.GameObjects.Arc; timer: number }> = [];

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light: 12,
    telegraph_heavy: 16,
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

    this.sprite = scene.physics.add.image(x, y, 'spore_witch');
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

    // Tick active spore clouds
    this._tickClouds(delta, player);

    this._updateFacing(player);
    this._runState(dist, delta, player);
  }

  private _tickClouds(delta: number, player: Player): void {
    const CLOUD_DAMAGE_INTERVAL = 500; // ms
    for (let i = this._activeClouds.length - 1; i >= 0; i--) {
      const cloud = this._activeClouds[i];
      if (!cloud) continue;
      cloud.timer -= delta;
      if (cloud.timer <= 0) {
        // Deal DOT tick
        const dx = player.x - cloud.obj.x;
        const dy = player.y - cloud.obj.y;
        if (Math.sqrt(dx * dx + dy * dy) < 40) {
          player.receiveHit(5, 0, 0); // DOT tick, no knockback
        }
        cloud.timer = CLOUD_DAMAGE_INTERVAL;
      }
    }
    // Remove expired clouds (lifetime tracked by their own timer event)
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
        if (dist < MELEE_FLEE) {
          this._transition('reposition');
          break;
        }
        if (dist > DETECT_RANGE * 1.2) { this._transition('patrol'); break; }
        if (dist <= RANGED_RANGE && this._attackTimer <= 0) {
          this._patternStep = 0;
          const pattern = this._playerAttackCount >= DIFFICULTY.ATTACK_SPAM_THRESHOLD ? 'burst' : 'cloud';
          this._playerAttackCount = 0;
          if (pattern === 'burst') {
            this._burstCount = 0;
            this._transition('attack_spore_burst');
          } else {
            this._transition('telegraph_heavy');
          }
          break;
        }
        const dir = dist > RANGED_RANGE ? (player.x > this.sprite.x ? 1 : -1) : 0;
        body.setVelocityX(MOVE_SPEED * dir);
        break;
      }

      case 'reposition': {
        // Move away from player
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(MOVE_SPEED * 1.5 * awayDir);
        if (this._stateTimer > 600) this._transition('approach');
        break;
      }

      case 'telegraph_light': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES['telegraph_light'] ?? 12;
        if (this._telegraphFrame === 1) this._juice.onTelegraphLight(this.sprite);
        const hintLevel = Deaths.getHintLevel('telegraph_light');
        if ((hintLevel === 1 || hintLevel === 2) && this._telegraphFrame === needed - 3) {
          const dur = hintLevel === 1 ? DIFFICULTY.HINT_WINDOW_MS.LEVEL_1 : DIFFICULTY.HINT_WINDOW_MS.LEVEL_2;
          this._juice.slowMo(0.4, dur * 0.5);
        }
        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._transition('attack_light');
        }
        break;
      }

      case 'telegraph_heavy': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES['telegraph_heavy'] ?? 16;
        if (this._telegraphFrame === 1) this._juice.onTelegraphHeavy(this.sprite);
        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._transition('attack_spore');
        }
        break;
      }

      case 'attack_light': {
        body.setVelocityX(0);
        if (this._stateTimer > 180) {
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            const data = ATTACK_DATA['light'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._attackTimer = 1200;
          this._transition('recover');
        }
        break;
      }

      case 'attack_spore': {
        body.setVelocityX(0);
        if (this._stateTimer > 200) {
          this._spawnSporeCloud(player.x, player.y);
          this._attackTimer = 2000;
          this._transition('recover');
        }
        break;
      }

      case 'attack_spore_burst': {
        body.setVelocityX(0);
        if (this._stateTimer > 200 && this._burstCount < 3) {
          this._spawnSporeCloud(
            player.x + (Math.random() - 0.5) * 60,
            player.y + (Math.random() - 0.5) * 30,
          );
          this._burstCount++;
          this._stateTimer = 0;
        }
        if (this._burstCount >= 3) {
          this._attackTimer = 2500;
          this._transition('recover');
        }
        break;
      }

      case 'teleport': {
        // Short teleport — handled as instant position change
        body.setVelocityX(0);
        break;
      }

      case 'stagger': {
        body.setVelocityX(0);
        break;
      }

      case 'recover': {
        body.setVelocityX(0);
        if (this._stateTimer > 350) {
          if (this._hitCount >= 3) this._transition('backoff');
          else this._transition('approach');
        }
        break;
      }

      case 'backoff': {
        const awayDir = player.x > this.sprite.x ? -1 : 1;
        body.setVelocityX(MOVE_SPEED * awayDir);
        if (this._stateTimer > 1000) {
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

  private _spawnSporeCloud(targetX: number, targetY: number): void {
    const cloud = this._scene.add.arc(targetX, targetY, 40, 0, 360, false, 0x44aa44, 0.3)
      .setDepth(7);

    const entry = { obj: cloud, timer: 500 };
    this._activeClouds.push(entry);

    // Cloud lasts 3 seconds
    this._scene.time.delayedCall(3000, () => {
      cloud.destroy();
      const idx = this._activeClouds.indexOf(entry);
      if (idx !== -1) this._activeClouds.splice(idx, 1);
    });
  }

  private _teleportAway(player: Player): void {
    const awayDir = player.x > this.sprite.x ? -1 : 1;
    const newX = Phaser.Math.Clamp(
      this.sprite.x + awayDir * TELEPORT_DIST,
      0,
      this._scene.scale.width,
    );

    // Flash on departure
    this._juice.flash(0x44cc44, 0.5, 80);
    this.sprite.setAlpha(0);
    this.sprite.setX(newX);
    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      duration: 200,
    });
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 800;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.clearTint();
    });

    if (this._hp <= 0) { this._die(_attacker); return; }

    // Teleport away on hit
    this._teleportAway(_attacker);
    this._transition('reposition');
  }

  recordPlayerDodge(): void  { this._playerDodgeCount++; }
  recordPlayerAttack(): void { this._playerAttackCount++; }

  private _die(killer: Player): void {
    this._state = 'dead';
    // Clean up clouds
    for (const c of this._activeClouds) c.obj.destroy();
    this._activeClouds = [];

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

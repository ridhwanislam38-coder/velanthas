import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import type { Player } from '../../Player';

// TheOldGrove — massive tree miniboss
// 3 attacks: root eruption (AOE), branch slam (heavy), spore cloud (DOT ranged)
// Phase 2 at 50% HP: all attacks faster, adds root trap

export type EnemyState =
  | 'idle' | 'rooted'
  | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_branch_slam' | 'attack_root_eruption' | 'attack_spore_cloud'
  | 'phase_change' | 'stagger' | 'recover' | 'dead';

const ATTACK_RANGE   = 100;
const SLAM_RANGE     = 120;
const SPORE_RANGE    = 250;
const DETECT_RANGE   = 300;

export class TheOldGrove {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene:  Phaser.Scene;
  private _juice:  JuiceSystem;

  private _state: EnemyState = 'idle';
  private _stateTimer  = 0;
  private _attackTimer = 0;
  private _telegraphFrame = 0;

  private _hp:     number;
  private _maxHp:  number;
  private _hitCount = 0;
  private _patternStep = 0;
  private _patternCycle = 0; // cycles through 3 attacks

  private _phase: 1 | 2 = 1;
  private _phaseChangeTriggered = false;

  private _activeClouds: Array<{ obj: Phaser.GameObjects.Arc; timer: number }> = [];

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_heavy:       20,
    telegraph_unblockable: 20,
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

    this.sprite = scene.physics.add.image(x, y, 'the_old_grove');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(2.5); // massive

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);  // tree doesn't move
    body.setAllowGravity(true);
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    // Phase 2 trigger
    if (!this._phaseChangeTriggered && this.hpPct <= 0.5) {
      this._phaseChangeTriggered = true;
      this._triggerPhase2();
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      player.x, player.y,
    );

    this._stateTimer  += delta;
    this._attackTimer  = Math.max(0, this._attackTimer - delta);

    // Tick spore DOT clouds
    this._tickClouds(delta, player);

    this._updateFacing(player);
    this._runState(dist, delta, player);
  }

  private _tickClouds(delta: number, player: Player): void {
    for (let i = this._activeClouds.length - 1; i >= 0; i--) {
      const cloud = this._activeClouds[i];
      if (!cloud) continue;
      cloud.timer -= delta;
      if (cloud.timer <= 0) {
        const dx = player.x - cloud.obj.x;
        const dy = player.y - cloud.obj.y;
        if (Math.sqrt(dx * dx + dy * dy) < 50) {
          player.receiveHit(6, 0, 0);
        }
        cloud.timer = 500;
      }
    }
  }

  private _runState(dist: number, delta: number, player: Player): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    switch (this._state) {
      case 'idle': {
        body.setVelocityX(0);
        if (dist < DETECT_RANGE && this._attackTimer <= 0) {
          this._chooseNextAttack(dist, player);
        }
        break;
      }

      case 'rooted': {
        body.setVelocityX(0);
        // Rooted — just waiting
        if (this._stateTimer > 600) this._transition('idle');
        break;
      }

      case 'telegraph_heavy': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES['telegraph_heavy'] ?? 20;
        if (this._telegraphFrame === 1) this._juice.onTelegraphHeavy(this.sprite);
        const hintLevel = Deaths.getHintLevel('telegraph_heavy');
        if ((hintLevel === 1 || hintLevel === 2) && this._telegraphFrame === needed - 3) {
          const dur = hintLevel === 1 ? DIFFICULTY.HINT_WINDOW_MS.LEVEL_1 : DIFFICULTY.HINT_WINDOW_MS.LEVEL_2;
          this._juice.slowMo(0.4, dur * 0.5);
        }
        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          this._transition('attack_branch_slam');
        }
        break;
      }

      case 'telegraph_unblockable': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES['telegraph_unblockable'] ?? 20;
        if (this._telegraphFrame === 1) this._juice.onTelegraphUnblockable(this.sprite);
        if (this._telegraphFrame >= needed) {
          this._telegraphFrame = 0;
          // Which unblockable?
          if (this._patternCycle % 3 === 0) {
            this._transition('attack_root_eruption');
          } else {
            this._transition('attack_spore_cloud');
          }
        }
        break;
      }

      case 'attack_branch_slam': {
        body.setVelocityX(0);
        if (this._stateTimer > 300) {
          this._juice.shake(0.01, 400);
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            const data = ATTACK_DATA['heavy'];
            player.receiveHit(data.damage * 2 | 0, data.knockback * 1.5 | 0, data.hitstun);
          }
          const waitMs = this._phase === 2 ? 1800 : 2200;
          this._attackTimer = waitMs;
          this._patternCycle++;
          this._transition('recover');
        }
        break;
      }

      case 'attack_root_eruption': {
        body.setVelocityX(0);
        if (this._stateTimer > 400) {
          this._juice.shake(0.008, 350);
          // Eruption in a radius around player
          const eruptX = player.x;
          const eruptY = player.y;
          const eruptDist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, eruptX, eruptY);
          if (eruptDist < SLAM_RANGE) {
            player.receiveHit(55, 200, 35);
          }
          // Visual — root spike arc at player position
          const spike = this._scene.add.arc(eruptX, eruptY, 30, 0, 360, false, 0x885500, 0.7).setDepth(9);
          this._scene.tweens.add({
            targets: spike,
            scaleY: { from: 0.2, to: 1 },
            alpha: { from: 1, to: 0 },
            duration: 500,
            onComplete: () => spike.destroy(),
          });
          const waitMs = this._phase === 2 ? 2000 : 2800;
          this._attackTimer = waitMs;
          this._patternCycle++;
          this._transition('recover');
        }
        break;
      }

      case 'attack_spore_cloud': {
        body.setVelocityX(0);
        if (this._stateTimer > 200) {
          // Launch multiple spore clouds toward player
          const cloudCount = this._phase === 2 ? 4 : 3;
          for (let i = 0; i < cloudCount; i++) {
            this._scene.time.delayedCall(i * 150, () => {
              this._spawnSporeCloud(
                player.x + (Math.random() - 0.5) * 80,
                player.y + (Math.random() - 0.5) * 40,
              );
            });
          }
          const waitMs = this._phase === 2 ? 2200 : 3000;
          this._attackTimer = waitMs;
          this._patternCycle++;
          this._transition('recover');
        }
        break;
      }

      case 'phase_change': {
        body.setVelocityX(0);
        if (this._stateTimer > 1500) {
          this._transition('idle');
        }
        break;
      }

      case 'stagger': {
        body.setVelocityX(0);
        break;
      }

      case 'recover': {
        body.setVelocityX(0);
        const recoverMs = this._phase === 2 ? 400 : 600;
        if (this._stateTimer > recoverMs) {
          this._transition('idle');
        }
        break;
      }

      case 'dead':
        break;
    }
    void delta;
  }

  private _chooseNextAttack(dist: number, player: Player): void {
    const cycle = this._patternCycle % 3;
    if (cycle === 0 && dist < SLAM_RANGE) {
      this._transition('telegraph_heavy'); // branch slam
    } else if (cycle === 1) {
      this._transition('telegraph_unblockable'); // root eruption
    } else {
      this._transition('telegraph_unblockable'); // spore cloud
    }
    void player;
  }

  private _spawnSporeCloud(targetX: number, targetY: number): void {
    const cloud = this._scene.add.arc(targetX, targetY, 50, 0, 360, false, 0x44aa44, 0.3).setDepth(7);
    const entry = { obj: cloud, timer: 500 };
    this._activeClouds.push(entry);
    this._scene.time.delayedCall(4000, () => {
      cloud.destroy();
      const idx = this._activeClouds.indexOf(entry);
      if (idx !== -1) this._activeClouds.splice(idx, 1);
    });
  }

  private _triggerPhase2(): void {
    this._phase = 2;
    Bus.emit(GameEvent.BOSS_PHASE_CHANGE, { entity: this.sprite, phase: 2 });
    this._juice.flash(0x44ff44, 0.7, 400);
    this._juice.shake(0.015, 600);
    this.sprite.setTint(0x88ff44);
    this._attackTimer = 0;
    this._transition('phase_change');
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') {
        if (this._phase === 2) this.sprite.setTint(0x88ff44);
        else this.sprite.clearTint();
      }
    });

    // Tree barely moves from knockback
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const kbDir = this.sprite.flipX ? 1 : -1;
    body.setVelocityX(result.data.knockback * 0.2 * kbDir);

    if (this._hp <= 0) { this._die(_attacker); return; }

    // Only staggers if hit many times quickly
    if (this._hitCount % 8 === 0) {
      this._transition('stagger');
      this._scene.time.delayedCall(600, () => {
        if (this._state === 'stagger') this._transition('recover');
      });
    }
  }

  private _die(killer: Player): void {
    this._state = 'dead';
    for (const c of this._activeClouds) c.obj.destroy();
    this._activeClouds = [];

    killer.ap.gain(5, 'kill');
    Bus.emit(GameEvent.BOSS_KILLED, { entity: this.sprite, bossId: 'the_old_grove' });
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
  get state(): EnemyState { return this._state; }
  get phase(): 1 | 2 { return this._phase; }
}

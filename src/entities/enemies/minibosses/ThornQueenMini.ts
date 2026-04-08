import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import type { Player } from '../../Player';

// ThornQueenMini — summons bramble walls that block movement
// Phase 1: summon walls + ranged thorns
// Phase 2 (50% HP): walls become electrified (hurt on touch), summons more often
// Pattern A: thorn barrage (3 projectiles)
// Pattern B: summon bramble wall + thorn barrage while player fights through

export type EnemyState =
  | 'idle' | 'approach'
  | 'telegraph_light' | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_thorn' | 'attack_thorn_barrage' | 'attack_heavy'
  | 'summon_wall' | 'phase_change'
  | 'stagger' | 'recover' | 'dead';

type AttackPattern = 'A' | 'B';

const DETECT_RANGE  = 300;
const ATTACK_RANGE  = 80;
const RANGED_RANGE  = 250;
const MOVE_SPEED    = 45;
const PATROL_SPEED  = 25;

// Active bramble walls — tracked for cleanup
type BrambleWall = { obj: Phaser.GameObjects.Rectangle; x: number; electrified: boolean };

export class ThornQueenMini {
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
  private _pattern: AttackPattern = 'A';
  private _patternStep = 0;
  private _thornCount = 0;

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  private _phase: 1 | 2 = 1;
  private _phaseChangeTriggered = false;

  private _brambleWalls: BrambleWall[] = [];

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light:       12,
    telegraph_heavy:       18,
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

    this.sprite = scene.physics.add.image(x, y, 'thorn_queen_mini');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(1.4);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;

    // Phase 2 at 50% HP
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

    // Electrified walls — hurt player on contact
    if (this._phase === 2) {
      this._tickElectrifiedWalls(player);
    }

    this._updateFacing(player);
    this._runState(dist, delta, player);
  }

  private _tickElectrifiedWalls(player: Player): void {
    for (const wall of this._brambleWalls) {
      if (!wall.electrified) continue;
      const dx = Math.abs(player.x - wall.x);
      const dy = Math.abs(player.y - (this.sprite.y - 30));
      if (dx < 20 && dy < 50) {
        player.receiveHit(8, 50, 6);
      }
    }
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
        if (dist > DETECT_RANGE * 1.4) this._transition('idle');
        if (this._attackTimer <= 0) {
          if (dist <= RANGED_RANGE) {
            this._pattern = this._hitCount > 3 ? 'B' : 'A';
            this._patternStep = 0;
            this._executeNextInPattern();
          }
        }
        break;
      }

      case 'phase_change': {
        body.setVelocityX(0);
        if (this._stateTimer > 1200) this._transition('approach');
        break;
      }

      case 'summon_wall': {
        body.setVelocityX(0);
        if (this._stateTimer > 500) {
          this._spawnBrambleWall(player);
          this._transition('recover');
        }
        break;
      }

      case 'telegraph_light':
      case 'telegraph_heavy':
      case 'telegraph_unblockable': {
        body.setVelocityX(0);
        this._telegraphFrame++;
        const needed = this.TELEGRAPH_FRAMES[this._state] ?? 12;

        if (this._telegraphFrame === 1) {
          if (this._state === 'telegraph_light') this._juice.onTelegraphLight(this.sprite);
          else if (this._state === 'telegraph_heavy') this._juice.onTelegraphHeavy(this.sprite);
          else this._juice.onTelegraphUnblockable(this.sprite);
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

      case 'attack_thorn': {
        body.setVelocityX(0);
        if (this._stateTimer > 150) {
          this._fireThorn(player);
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_thorn_barrage': {
        // 3 thorns in rapid succession
        if (this._stateTimer > 150 && this._thornCount < 3) {
          const angleOffset = (this._thornCount - 1) * 12;
          this._fireThorn(player, angleOffset);
          this._thornCount++;
          this._stateTimer = 0;
        }
        if (this._thornCount >= 3) {
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_heavy': {
        body.setVelocityX(0);
        if (this._stateTimer > 240) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            const data = ATTACK_DATA['heavy'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._executeNextInPattern();
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
          if (this._hitCount >= 4) {
            this._hitCount = 0;
            this._transition('approach');
          } else {
            this._transition('approach');
          }
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
        'telegraph_light', 'attack_thorn',
        'telegraph_light', 'attack_thorn',
        'telegraph_light', 'attack_thorn',
      ];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._attackTimer = 2000; this._transition('recover'); }
    } else {
      // Pattern B: summon wall + barrage
      const steps: EnemyState[] = [
        'summon_wall',
        'telegraph_heavy', 'attack_thorn_barrage',
      ];
      const next = steps[this._patternStep];
      if (next) {
        if (next === 'attack_thorn_barrage') this._thornCount = 0;
        this._transition(next);
        this._patternStep++;
      } else {
        this._patternStep = 0;
        this._attackTimer = 2500;
        this._transition('recover');
      }
    }
  }

  private _fireThorn(player: Player, angleOffset = 0): void {
    const dirX = player.x - this.sprite.x;
    const dirY = player.y - this.sprite.y;
    const baseAngle = Math.atan2(dirY, dirX) + (angleOffset * Math.PI / 180);
    const speed = 220;

    const thorn = this._scene.physics.add.image(this.sprite.x, this.sprite.y, 'thorn_projectile');
    thorn.setDepth(9);
    thorn.setRotation(baseAngle);
    const tb = thorn.body as Phaser.Physics.Arcade.Body;
    tb.setVelocity(Math.cos(baseAngle) * speed, Math.sin(baseAngle) * speed);
    tb.setAllowGravity(false);

    this._scene.time.delayedCall(2000, () => { if (thorn.active) thorn.destroy(); });

    const tick = this._scene.time.addEvent({
      delay: 16, repeat: 120,
      callback: () => {
        if (!thorn.active) { tick.remove(); return; }
        const d = Phaser.Math.Distance.Between(thorn.x, thorn.y, player.x, player.y);
        if (d < 22) {
          player.receiveHit(16, 100, 12);
          thorn.destroy();
          tick.remove();
        }
      },
    });
  }

  private _spawnBrambleWall(player: Player): void {
    // Bramble wall between queen and player
    const wallX = (this.sprite.x + player.x) / 2;
    const wallY = this.sprite.y;
    const electrified = this._phase === 2;

    const wallColor = electrified ? 0xaaff22 : 0x225500;
    const wall = this._scene.add.rectangle(wallX, wallY, 16, 80, wallColor, 0.8).setDepth(50);

    const entry: BrambleWall = { obj: wall, x: wallX, electrified };
    this._brambleWalls.push(entry);

    // Wall lasts 4s
    this._scene.time.delayedCall(4000, () => {
      wall.destroy();
      const idx = this._brambleWalls.indexOf(entry);
      if (idx !== -1) this._brambleWalls.splice(idx, 1);
    });
  }

  private _triggerPhase2(): void {
    this._phase = 2;
    // Electrify existing walls
    for (const wall of this._brambleWalls) {
      wall.electrified = true;
      wall.obj.setFillStyle(0xaaff22);
    }
    Bus.emit(GameEvent.BOSS_PHASE_CHANGE, { entity: this.sprite, phase: 2 });
    this._juice.flash(0x44ff44, 0.7, 300);
    this._juice.shake(0.010, 400);
    this.sprite.setTint(0x88ff44);
    this._attackTimer = 0;
    this._transition('phase_change');
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 1200;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') {
        if (this._phase === 2) this.sprite.setTint(0x88ff44);
        else this.sprite.clearTint();
      }
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
    for (const wall of this._brambleWalls) wall.obj.destroy();
    this._brambleWalls = [];

    killer.ap.gain(5, 'kill');
    Bus.emit(GameEvent.BOSS_KILLED, { entity: this.sprite, bossId: 'thorn_queen_mini' });
    this._juice.onKill(this.sprite);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 1000,
      delay: 800,
      onComplete: () => this.sprite.destroy(),
    });
  }

  private _transition(next: EnemyState): void {
    this._state = next;
    this._stateTimer = 0;
  }

  private _updateFacing(player: Player): void {
    if (this._state === 'approach' || this._state === 'idle') {
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
  get phase(): 1 | 2 { return this._phase; }
  get state(): EnemyState { return this._state; }
}

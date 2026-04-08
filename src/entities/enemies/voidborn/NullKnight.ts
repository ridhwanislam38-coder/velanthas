import Phaser from 'phaser';
import { JuiceSystem } from '../../../systems/JuiceSystem';
import { ATTACK_DATA, checkHit, type FightStance, type AttackType } from '../../../systems/CombatSystem';
import { Deaths, DIFFICULTY } from '../../../config/difficultyConfig';
import { Bus, GameEvent } from '../../../systems/EventBus';
import type { Player } from '../../Player';

// NullKnight — parry-immune, teleports behind player after blocking
// Block: absorbs damage, then teleports behind player and counter-attacks
// Pattern A: heavy → teleport-behind → unblockable from behind
// Pattern B: light × 2 → heavy

export type EnemyState =
  | 'patrol' | 'detect' | 'approach'
  | 'telegraph_light' | 'telegraph_heavy' | 'telegraph_unblockable'
  | 'attack_light' | 'attack_heavy' | 'attack_unblockable'
  | 'block_teleport' | 'stagger' | 'recover' | 'backoff' | 'dead';

type AttackPattern = 'A' | 'B';

const DETECT_RANGE = 220;
const ATTACK_RANGE = 65;
const MOVE_SPEED   = 70;
const PATROL_SPEED = 38;
const TELEPORT_BEHIND = 70; // px behind player

export class NullKnight {
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

  private _playerDodgeCount  = 0;
  private _playerAttackCount = 0;

  // Block counter — absorbs one hit, then teleports behind
  private _blockReady  = true;
  private _blockTimer  = 0;
  private _lastPlayer: Player | null = null;

  private readonly TELEGRAPH_FRAMES: Record<string, number> = {
    telegraph_light:       12,
    telegraph_heavy:       18,
    telegraph_unblockable: 20,
  };

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    juice: JuiceSystem,
    hp = DIFFICULTY.HP.ELITE,
  ) {
    this._scene = scene;
    this._juice = juice;
    this._hp = this._maxHp = hp;

    this.sprite = scene.physics.add.image(x, y, 'null_knight');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setTint(0x334455); // dark void tint

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setMaxVelocityY(900);
  }

  update(delta: number, player: Player): void {
    if (this._state === 'dead') return;
    this._lastPlayer = player;

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      player.x, player.y,
    );

    this._stateTimer  += delta;
    this._attackTimer  = Math.max(0, this._attackTimer - delta);
    this._blockTimer   = Math.max(0, this._blockTimer - delta);

    // Recharge block
    if (!this._blockReady && this._blockTimer <= 0) {
      this._blockReady = true;
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
        if (dist > DETECT_RANGE * 1.3) this._transition('patrol');
        if (dist < ATTACK_RANGE && this._attackTimer <= 0) {
          this._pattern = this._playerAttackCount >= DIFFICULTY.ATTACK_SPAM_THRESHOLD ? 'A' : 'B';
          this._playerAttackCount = 0;
          this._patternStep = 0;
          this._executeNextInPattern();
        }
        break;
      }

      case 'block_teleport': {
        // Teleport behind player and launch unblockable
        body.setVelocityX(0);
        if (this._stateTimer > 100) {
          this._teleportBehindPlayer(player);
          this._transition('telegraph_unblockable');
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

      case 'attack_light': {
        body.setVelocityX(0);
        if (this._stateTimer > 180) {
          const result = checkHit(this.stance, player.stance, 'light');
          if (result.connected) {
            const data = ATTACK_DATA['light'];
            player.receiveHit(data.damage, data.knockback, data.hitstun);
          }
          this._executeNextInPattern();
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
          this._executeNextInPattern();
        }
        break;
      }

      case 'attack_unblockable': {
        body.setVelocityX(0);
        if (this._stateTimer > 240) {
          const result = checkHit(this.stance, player.stance, 'heavy');
          if (result.connected) {
            player.receiveHit(60, 250, 35); // punish hit from behind
          }
          this._attackTimer = 1400;
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
        if (this._stateTimer > 450) {
          if (this._hitCount >= 3) this._transition('backoff');
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

  private _executeNextInPattern(): void {
    if (this._pattern === 'A') {
      const steps: EnemyState[] = ['telegraph_heavy', 'attack_heavy'];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._attackTimer = 1600; this._transition('recover'); }
    } else {
      const steps: EnemyState[] = [
        'telegraph_light', 'attack_light',
        'telegraph_light', 'attack_light',
        'telegraph_heavy', 'attack_heavy',
      ];
      const next = steps[this._patternStep];
      if (next) { this._transition(next); this._patternStep++; }
      else { this._patternStep = 0; this._attackTimer = 1400; this._transition('recover'); }
    }
  }

  private _teleportBehindPlayer(player: Player): void {
    const behindDir = player.x > this.sprite.x ? 1 : -1; // opposite = behind
    const newX = Phaser.Math.Clamp(
      player.x + behindDir * TELEPORT_BEHIND,
      16, this._scene.scale.width - 16,
    );
    this._juice.flash(0x334455, 0.6, 80);
    this.sprite.setAlpha(0);
    this.sprite.setX(newX);
    this.sprite.setFlipX(player.x > newX); // face player
    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      duration: 150,
    });
  }

  receiveHit(result: { data: { damage: number; knockback: number; hitstun: number } }, _attacker: Player): void {
    if (this._state === 'dead') return;

    // Block counter — absorb one hit then teleport behind
    if (this._blockReady && this._state !== 'attack_light' && this._state !== 'attack_heavy' && this._state !== 'attack_unblockable') {
      this._blockReady = false;
      this._blockTimer = 8000; // 8s recharge

      // Chip damage only (no parry — NullKnight is parry-immune from player side too)
      const chip = Math.floor(result.data.damage * 0.1);
      this._hp = Math.max(0, this._hp - chip);
      this._juice.flash(0x334455, 0.5, 80);

      if (this._hp <= 0) { this._die(_attacker); return; }

      // Teleport behind
      this._transition('block_teleport');
      return;
    }

    this._hp = Math.max(0, this._hp - result.data.damage);
    this._hitCount++;
    this._attackTimer = 1000;

    this.sprite.setTint(0xffffff);
    this._scene.time.delayedCall(80, () => {
      if (this._state !== 'dead') this.sprite.setTint(0x334455);
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
    killer.ap.gain(3, 'kill');
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
  get state(): EnemyState { return this._state; }
}

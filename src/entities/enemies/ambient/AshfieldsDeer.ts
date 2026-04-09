import Phaser from 'phaser';
import { DEPTH } from '../../../config/visualConfig';

// ── AshfieldsDeer — non-combat ambient creature ─────────────────────────────
// Wanders the Ashfields region. Flees when player approaches within 60px.
// Does NOT attack, cannot be killed, drops nothing. Purely atmospheric.

const WANDER_SPEED = 20;
const FLEE_SPEED   = 80;
const FLEE_DIST    = 60;
const WANDER_PAUSE_MIN = 2000;
const WANDER_PAUSE_MAX = 5000;

export class AshfieldsDeer {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene: Phaser.Scene;
  private _wanderTimer = 0;
  private _wanderDir   = { x: 0, y: 0 };
  private _state: 'idle' | 'wander' | 'flee' = 'idle';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this._scene = scene;
    this.sprite = scene.physics.add.image(x, y, 'ambient_deer');
    this.sprite.setDepth(DEPTH.GAME);
    this.sprite.setCollideWorldBounds(true);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setDrag(200, 200);

    this._scheduleWander();
  }

  update(delta: number, playerX: number, playerY: number): void {
    const dx = this.sprite.x - playerX;
    const dy = this.sprite.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < FLEE_DIST) {
      // Flee away from player
      const len = dist || 1;
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocity((dx / len) * FLEE_SPEED, (dy / len) * FLEE_SPEED);
      this.sprite.setFlipX(dx < 0);
      this._state = 'flee';
      return;
    }

    if (this._state === 'flee') {
      this._state = 'idle';
      this._scheduleWander();
    }

    this._wanderTimer -= delta;
    if (this._wanderTimer <= 0) {
      if (this._state === 'idle') {
        this._pickWanderDir();
        this._state = 'wander';
        this._wanderTimer = 1500 + Math.random() * 1500;
      } else {
        this._state = 'idle';
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);
        this._scheduleWander();
      }
    }

    if (this._state === 'wander') {
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(this._wanderDir.x * WANDER_SPEED, this._wanderDir.y * WANDER_SPEED);
      this.sprite.setFlipX(this._wanderDir.x < 0);
    }
  }

  private _scheduleWander(): void {
    this._wanderTimer = WANDER_PAUSE_MIN + Math.random() * (WANDER_PAUSE_MAX - WANDER_PAUSE_MIN);
  }

  private _pickWanderDir(): void {
    const angle = Math.random() * Math.PI * 2;
    this._wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

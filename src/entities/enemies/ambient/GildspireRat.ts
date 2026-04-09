import Phaser from 'phaser';
import { DEPTH } from '../../../config/visualConfig';

// ── GildspireRat — scurrying ambient creature ───────────────────────────────
// Runs along walls/edges in Gildspire interiors. Darts away when player
// approaches, hugs walls. Non-combat.

const SCURRY_SPEED = 60;
const FLEE_SPEED   = 100;
const FLEE_DIST    = 30;
const PAUSE_MIN    = 1000;
const PAUSE_MAX    = 3000;

export class GildspireRat {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene: Phaser.Scene;
  private _dir = 1; // 1 = right, -1 = left
  private _timer = 0;
  private _state: 'scurry' | 'pause' | 'flee' = 'pause';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this._scene = scene;
    this.sprite = scene.physics.add.image(x, y, 'ambient_rat');
    this.sprite.setDepth(DEPTH.GAME);
    this.sprite.setScale(0.5);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setDrag(300, 300);
    this._schedulePause();
  }

  update(delta: number, playerX: number, playerY: number): void {
    const dx = this.sprite.x - playerX;
    const dy = this.sprite.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < FLEE_DIST) {
      const len = dist || 1;
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocity((dx / len) * FLEE_SPEED, (dy / len) * FLEE_SPEED);
      this.sprite.setFlipX(dx < 0);
      this._state = 'flee';
      return;
    }

    if (this._state === 'flee') {
      this._state = 'pause';
      this._schedulePause();
    }

    this._timer -= delta;
    if (this._timer <= 0) {
      if (this._state === 'pause') {
        this._state = 'scurry';
        this._dir = Math.random() > 0.5 ? 1 : -1;
        this._timer = 800 + Math.random() * 1200;
      } else {
        this._state = 'pause';
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);
        this._schedulePause();
      }
    }

    if (this._state === 'scurry') {
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(this._dir * SCURRY_SPEED);
      this.sprite.setFlipX(this._dir < 0);
    }
  }

  private _schedulePause(): void {
    this._timer = PAUSE_MIN + Math.random() * (PAUSE_MAX - PAUSE_MIN);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

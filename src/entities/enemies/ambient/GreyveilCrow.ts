import Phaser from 'phaser';
import { DEPTH } from '../../../config/visualConfig';

// ── GreyveilCrow — perching ambient creature ────────────────────────────────
// Sits on terrain. When player approaches within 40px, flies away (diagonal
// upward, fades out over 1s, then repositions). Non-combat.

const FLEE_DIST    = 40;
const FLY_SPEED    = 120;
const FADE_MS      = 1000;
const RESETTLE_MS  = 8000;

export class GreyveilCrow {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private _scene: Phaser.Scene;
  private _homeX: number;
  private _homeY: number;
  private _fleeing = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this._scene = scene;
    this._homeX = x;
    this._homeY = y;
    this.sprite = scene.physics.add.image(x, y, 'ambient_crow');
    this.sprite.setDepth(DEPTH.GAME);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
  }

  update(_delta: number, playerX: number, playerY: number): void {
    if (this._fleeing) return;

    const dx = this.sprite.x - playerX;
    const dy = this.sprite.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < FLEE_DIST) {
      this._flee();
    }
  }

  private _flee(): void {
    this._fleeing = true;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    // Fly up-left or up-right randomly
    const dir = Math.random() > 0.5 ? 1 : -1;
    body.setVelocity(FLY_SPEED * dir * 0.6, -FLY_SPEED);

    this._scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => {
        body.setVelocity(0, 0);
        // Resettle after delay
        this._scene.time.delayedCall(RESETTLE_MS, () => {
          this.sprite.setPosition(this._homeX, this._homeY);
          this.sprite.setAlpha(1);
          this._fleeing = false;
        });
      },
    });
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

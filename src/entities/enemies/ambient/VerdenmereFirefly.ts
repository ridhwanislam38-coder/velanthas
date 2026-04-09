import Phaser from 'phaser';
import { DEPTH } from '../../../config/visualConfig';

// ── VerdenmereFirefly — glowing ambient particle-creature ───────────────────
// Drifts slowly through Verdenmere. Emits a faint glow (LightingSystem source).
// Non-interactive, non-combat. Atmospheric only.

const DRIFT_SPEED = 8;
const GLOW_RADIUS = 20;
const DIR_CHANGE_MS = 4000;

export class VerdenmereFirefly {
  readonly sprite: Phaser.GameObjects.Arc;
  private _scene: Phaser.Scene;
  private _dx = 0;
  private _dy = 0;
  private _timer = 0;
  private _phase = Math.random() * Math.PI * 2; // for glow pulse

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this._scene = scene;
    this.sprite = scene.add.circle(x, y, 2, 0x88ff44, 0.8);
    this.sprite.setDepth(DEPTH.PARTICLES);
    this._pickDir();
  }

  update(delta: number): void {
    this._timer -= delta;
    if (this._timer <= 0) this._pickDir();

    this.sprite.x += this._dx * DRIFT_SPEED * (delta / 1000);
    this.sprite.y += this._dy * DRIFT_SPEED * (delta / 1000);

    // Glow pulse
    this._phase += delta * 0.003;
    this.sprite.setAlpha(0.4 + Math.sin(this._phase) * 0.4);
  }

  private _pickDir(): void {
    const angle = Math.random() * Math.PI * 2;
    this._dx = Math.cos(angle);
    this._dy = Math.sin(angle);
    this._timer = DIR_CHANGE_MS * (0.5 + Math.random());
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

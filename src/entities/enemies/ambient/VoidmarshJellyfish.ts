import Phaser from 'phaser';
import { DEPTH } from '../../../config/visualConfig';

// ── VoidmarshJellyfish — floating ambient creature ──────────────────────────
// Drifts through Voidmarsh swamp. Pulses with void-purple glow. Harmless
// but eerie. Rises/sinks slowly in a sine wave.

const DRIFT_SPEED  = 6;
const PULSE_HZ     = 0.8;
const BOB_AMPLITUDE = 12;
const BOB_SPEED     = 0.5;

export class VoidmarshJellyfish {
  readonly sprite: Phaser.GameObjects.Arc;
  private _scene: Phaser.Scene;
  private _baseY: number;
  private _dx: number;
  private _phase: number;
  private _bobPhase: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this._scene = scene;
    this._baseY = y;
    this.sprite = scene.add.circle(x, y, 4, 0x7b2fff, 0.6);
    this.sprite.setDepth(DEPTH.PARTICLES);

    this._dx = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5);
    this._phase = Math.random() * Math.PI * 2;
    this._bobPhase = Math.random() * Math.PI * 2;
  }

  update(delta: number): void {
    const dt = delta / 1000;

    // Horizontal drift
    this.sprite.x += this._dx * DRIFT_SPEED * dt;

    // Vertical bob (sine wave)
    this._bobPhase += BOB_SPEED * dt;
    this.sprite.y = this._baseY + Math.sin(this._bobPhase) * BOB_AMPLITUDE;

    // Glow pulse
    this._phase += PULSE_HZ * dt * Math.PI * 2;
    this.sprite.setAlpha(0.3 + Math.sin(this._phase) * 0.3);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

import Phaser from 'phaser';
import type { APSystem, APGainReason } from '../systems/APSystem';
import { COLOR } from '../config/Constants';

// ── AP Orb Display — bottom-left, 3 orbs, pulse on gain ──────────────────

export class APDisplay {
  private _orbs:  Phaser.GameObjects.Arc[]  = [];
  private _glows: Phaser.GameObjects.Arc[]  = [];
  private _label: Phaser.GameObjects.Text;
  private _scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, ap: APSystem, x = 6, y = 170) {
    this._scene = scene;
    const MAX = ap.max;

    for (let i = 0; i < MAX; i++) {
      const cx = x + i * 14;
      // Glow ring
      const glow = scene.add
        .circle(cx, y, 7, COLOR.LUMINA, 0.15)
        .setScrollFactor(0).setDepth(95);
      // Orb
      const orb = scene.add
        .circle(cx, y, 5, COLOR.AP_EMPTY, 1)
        .setScrollFactor(0).setDepth(96)
        .setStrokeStyle(1, COLOR.LUMINA, 0.6);
      this._orbs.push(orb);
      this._glows.push(glow);
    }

    this._label = scene.add.text(x, y - 12, 'AP', {
      fontFamily: "'Press Start 2P'", fontSize: '5px', color: '#4cc9f0',
    }).setScrollFactor(0).setDepth(96).setAlpha(0.7);

    // Sync initial state
    ap.onChange((val, reason) => this._sync(val, ap.max, reason));
    this._sync(ap.value, ap.max);
  }

  private _sync(val: number, max: number, reason?: APGainReason): void {
    for (let i = 0; i < max; i++) {
      const orb  = this._orbs[i];
      const glow = this._glows[i];
      if (!orb || !glow) continue;

      const filled = i < val;
      orb.setFillStyle(filled ? COLOR.AP_FULL : COLOR.AP_EMPTY, 1);
      glow.setAlpha(filled ? 0.3 : 0.05);

      // Pulse on gain
      if (reason && filled) {
        this._scene.tweens.add({
          targets: orb,
          scaleX: { from: 1.6, to: 1 },
          scaleY: { from: 1.6, to: 1 },
          duration: 300,
          ease: 'Back.easeOut',
        });
        this._scene.tweens.add({
          targets: glow,
          alpha: { from: 0.8, to: 0.3 },
          duration: 400,
        });
      }
    }
  }
}

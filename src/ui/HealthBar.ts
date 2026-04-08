import Phaser from 'phaser';
import { COLOR } from '../config/Constants';

// ── Reusable health bar ────────────────────────────────────────────────────
// Player bar: bottom of screen, left-aligned, wider
// Enemy bar:  above head (standard enemies) OR top of screen (bosses)

export type HealthBarStyle = 'player' | 'enemy' | 'boss';

interface BarConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  style: HealthBarStyle;
  label?: string;
  scrollFactor?: number;
}

export class HealthBar {
  private _bg:    Phaser.GameObjects.Rectangle;
  private _fill:  Phaser.GameObjects.Rectangle;
  private _delay: Phaser.GameObjects.Rectangle;  // yellow "damage delay" bar
  private _label: Phaser.GameObjects.Text | null = null;
  private _scene: Phaser.Scene;

  private _currentPct = 1;
  private _delayPct   = 1;
  private _delayTimer = 0;
  private readonly DELAY_MS = 600;

  constructor(scene: Phaser.Scene, cfg: BarConfig) {
    this._scene = scene;

    const sf = cfg.scrollFactor ?? 0;
    const H  = cfg.height;
    const W  = cfg.width;
    const { x, y } = cfg;

    // Background track
    this._bg = scene.add
      .rectangle(x, y, W, H, 0x1a1a2e, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(sf)
      .setDepth(90);

    // Delay bar (shows previous HP briefly in yellow before catching up)
    this._delay = scene.add
      .rectangle(x, y, W, H, 0xffd60a, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(sf)
      .setDepth(91);

    // Active fill
    const fillColor = cfg.style === 'player' ? COLOR.LUMINA : COLOR.DANGER;
    this._fill = scene.add
      .rectangle(x, y, W, H, fillColor, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(sf)
      .setDepth(92);

    // Border
    scene.add
      .rectangle(x, y, W, H, 0x4cc9f0, 0)
      .setOrigin(0, 0.5)
      .setScrollFactor(sf)
      .setStrokeStyle(1, 0x4cc9f0, 0.5)
      .setDepth(93);

    if (cfg.label) {
      this._label = scene.add.text(x, y - H - 3, cfg.label, {
        fontFamily: "'Press Start 2P'", fontSize: '5px', color: '#e8e8f0',
      }).setOrigin(0, 1).setScrollFactor(sf).setDepth(94);
    }

    this._updateGeometry(W);
  }

  setPercent(pct: number): void {
    const clamped = Phaser.Math.Clamp(pct, 0, 1);
    if (clamped < this._currentPct) {
      // Took damage — delay bar holds at old value briefly
      this._delayPct   = this._currentPct;
      this._delayTimer = this.DELAY_MS;
    }
    this._currentPct = clamped;

    const maxW = this._bg.width;
    this._fill.setSize(Math.max(0, maxW * clamped), this._fill.height);
  }

  /** Follow a world-space target (enemy head) */
  attachTo(sprite: Phaser.GameObjects.Image, offsetY = -20): void {
    this._scene.events.on('postupdate', () => {
      const tx = sprite.x - this._bg.width / 2;
      const ty = sprite.y + offsetY;
      this._bg.setPosition(tx, ty);
      this._delay.setPosition(tx, ty);
      this._fill.setPosition(tx, ty);
    });
  }

  update(delta: number): void {
    if (this._delayTimer > 0) {
      this._delayTimer -= delta;
      if (this._delayTimer <= 0) {
        this._delayTimer = 0;
        this._delayPct = this._currentPct;
      }
    }
    const maxW = this._bg.width;
    this._delay.setSize(Math.max(0, maxW * this._delayPct), this._delay.height);
  }

  private _updateGeometry(maxW: number): void {
    this._fill.setSize(maxW, this._fill.height);
    this._delay.setSize(maxW, this._delay.height);
  }

  setLabel(text: string): void {
    this._label?.setText(text);
  }

  setVisible(v: boolean): void {
    this._bg.setVisible(v);
    this._fill.setVisible(v);
    this._delay.setVisible(v);
    this._label?.setVisible(v);
  }

  destroy(): void {
    this._bg.destroy();
    this._fill.destroy();
    this._delay.destroy();
    this._label?.destroy();
  }
}

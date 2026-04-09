import Phaser from 'phaser';
import { DEPTH } from '../config/visualConfig';
import { W, H } from '../config/Constants';

// ── MiniMap — top-right corner map indicator ────────────────────────────────
// Shows player position as dot on a region-colored rectangle.
// Discovered portals shown as small diamonds.
// Full map (TAB + M) is a future feature.

const MAP_W = 50;
const MAP_H = 35;
const MAP_X = W - MAP_W - 6;
const MAP_Y = 6;

const REGION_COLORS: Record<string, number> = {
  ASHFIELDS:     0x2a1a0e,
  VERDENMERE:    0x0a2a1a,
  GREYVEIL:      0x1a1a2a,
  GILDSPIRE:     0x2a2a0a,
  VOIDMARSH:     0x1a0a2a,
  UNNAMED_CITY:  0xf5f0e8,
  INTERSTITIAL:  0x0a0a0a,
};

export class MiniMap {
  private _scene: Phaser.Scene;
  private _bg: Phaser.GameObjects.Rectangle;
  private _border: Phaser.GameObjects.Rectangle;
  private _playerDot: Phaser.GameObjects.Arc;
  private _worldW = 640;
  private _worldH = 480;

  constructor(scene: Phaser.Scene, region: string, worldW: number, worldH: number) {
    this._scene = scene;
    this._worldW = worldW;
    this._worldH = worldH;

    const color = REGION_COLORS[region] ?? 0x1a1a1a;

    this._bg = scene.add.rectangle(MAP_X + MAP_W / 2, MAP_Y + MAP_H / 2, MAP_W, MAP_H, color, 0.7);
    this._bg.setDepth(DEPTH.UI).setScrollFactor(0);

    this._border = scene.add.rectangle(MAP_X + MAP_W / 2, MAP_Y + MAP_H / 2, MAP_W, MAP_H);
    this._border.setStrokeStyle(1, 0x4cc9f0, 0.5);
    this._border.setFillStyle(0x000000, 0);
    this._border.setDepth(DEPTH.UI).setScrollFactor(0);

    this._playerDot = scene.add.circle(MAP_X, MAP_Y, 2, 0x4cc9f0);
    this._playerDot.setDepth(DEPTH.UI + 1).setScrollFactor(0);
  }

  update(playerX: number, playerY: number): void {
    const nx = Math.max(0, Math.min(1, playerX / this._worldW));
    const ny = Math.max(0, Math.min(1, playerY / this._worldH));
    this._playerDot.setPosition(MAP_X + nx * MAP_W, MAP_Y + ny * MAP_H);
  }

  destroy(): void {
    this._bg.destroy();
    this._border.destroy();
    this._playerDot.destroy();
  }
}

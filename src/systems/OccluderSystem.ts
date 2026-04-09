import Phaser from 'phaser';
import { DEPTH } from '../config/visualConfig';

// ── OccluderSystem ──────────────────────────────────────────────────────────
// Fades tall terrain/props to semi-transparent when they overlap the player.
// Objects must be registered via addOccluder(). Only objects at DEPTH.OCCLUDERS
// are candidates. Overlap detection uses axis-aligned bounding box.
//
// Design note: NOT every prop — only things explicitly flagged. Mountains,
// large trees, building upper walls, river banks. Small props stay opaque.

const OCCLUDE_ALPHA  = 0.45;  // target alpha when occluding player
const RESTORE_ALPHA  = 1.0;
const FADE_SPEED     = 0.08;  // alpha change per frame — smooth transition

interface OccluderEntry {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  targetAlpha: number;
}

export class OccluderSystem {
  private _occluders: OccluderEntry[] = [];
  private _playerRef: { x: number; y: number; displayWidth: number; displayHeight: number } | null = null;

  /** Set the player reference (any object with x, y, displayWidth, displayHeight). */
  setPlayer(player: { x: number; y: number; displayWidth: number; displayHeight: number }): void {
    this._playerRef = player;
  }

  /** Register a game object as a potential occluder. Sets its depth to OCCLUDERS layer. */
  addOccluder(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    obj.setDepth(DEPTH.OCCLUDERS);
    this._occluders.push({ obj, targetAlpha: RESTORE_ALPHA });
  }

  /** Remove an occluder (e.g. on destruction). */
  removeOccluder(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    const idx = this._occluders.findIndex(e => e.obj === obj);
    if (idx !== -1) this._occluders.splice(idx, 1);
  }

  /** Call every frame from scene.update(). */
  update(): void {
    if (!this._playerRef) return;

    const px = this._playerRef.x;
    const py = this._playerRef.y;
    const pw = this._playerRef.displayWidth;
    const ph = this._playerRef.displayHeight;

    for (const entry of this._occluders) {
      const o = entry.obj;
      if (!o.active) continue;

      // AABB overlap check
      const ox = o.x - o.displayWidth * o.originX;
      const oy = o.y - o.displayHeight * o.originY;
      const ow = o.displayWidth;
      const oh = o.displayHeight;

      const overlaps =
        px - pw / 2 < ox + ow &&
        px + pw / 2 > ox &&
        py - ph / 2 < oy + oh &&
        py + ph / 2 > oy;

      entry.targetAlpha = overlaps ? OCCLUDE_ALPHA : RESTORE_ALPHA;

      // Smooth lerp toward target
      const current = o.alpha;
      const diff = entry.targetAlpha - current;
      if (Math.abs(diff) > 0.01) {
        o.setAlpha(current + diff * FADE_SPEED);
      } else {
        o.setAlpha(entry.targetAlpha);
      }
    }
  }

  /** Cleanup on scene shutdown. */
  destroy(): void {
    this._occluders.length = 0;
    this._playerRef = null;
  }
}

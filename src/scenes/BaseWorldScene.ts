import Phaser from 'phaser';
import { DEPTH } from '../config/visualConfig';
import { Bus, GameEvent } from '../systems/EventBus';

// ── BaseWorldScene ──────────────────────────────────────────────────────────
// Abstract base for all birds-eye region scenes. Provides:
//   - Zero-gravity physics (per-scene override of world gravity)
//   - Camera: smooth-lerp follow with deadzone, world bounds, sub-pixel correction
//   - Y-sort: game-layer objects re-sorted by y each frame (depth 100–149)
//   - System lifecycle hooks for subclass wiring
//
// Subclasses override the abstract methods and call super.create() / super.update().

// ── Camera tuning ────────────────────────────────────────────────────────
const CAM_LERP        = 0.08;  // low = smooth tracking, 1 = snap
const CAM_DEADZONE_W  = 60;    // px — player moves freely in this rect
const CAM_DEADZONE_H  = 40;

// ── Y-sort range within DEPTH.GAME ──────────────────────────────────────
const YSORT_RANGE = DEPTH.GAME_MAX - DEPTH.GAME; // 49 depth levels

export interface WorldSceneConfig {
  /** World width in game px — used for camera bounds + tilemap */
  worldWidth: number;
  /** World height in game px */
  worldHeight: number;
}

export abstract class BaseWorldScene extends Phaser.Scene {
  // ── Y-sorted objects — register anything that should depth-sort ────────
  private _ySortables: Phaser.GameObjects.Components.Depth[] = [];
  private _worldH = 0;

  // ── Lifecycle ─────────────────────────────────────────────────────────

  /** Subclass MUST call `super.create(config)`. */
  protected create(config: WorldSceneConfig): void {
    this._worldH = config.worldHeight;

    // Zero gravity for birds-eye — subclass can re-enable for platform sections
    this.physics.world.gravity.y = 0;

    // Camera bounds
    this.cameras.main.setBounds(0, 0, config.worldWidth, config.worldHeight);
    this.cameras.main.setRoundPixels(true);
  }

  /** Call after creating the player sprite to wire camera follow. */
  protected followTarget(target: Phaser.GameObjects.GameObject): void {
    const cam = this.cameras.main;
    cam.startFollow(target, true);
    cam.setLerp(CAM_LERP, CAM_LERP);
    cam.setDeadzone(CAM_DEADZONE_W, CAM_DEADZONE_H);
  }

  /** Register a game object for y-sort each frame. */
  protected addYSortable(
    obj: Phaser.GameObjects.Components.Depth & { y: number },
  ): void {
    this._ySortables.push(obj);
  }

  /** Remove from y-sort list (call on destroy/death). */
  protected removeYSortable(
    obj: Phaser.GameObjects.Components.Depth,
  ): void {
    const idx = this._ySortables.indexOf(obj);
    if (idx !== -1) this._ySortables.splice(idx, 1);
  }

  /** Subclass MUST call `super.update(time, delta)`. */
  override update(_time: number, _delta: number): void {
    this._ySort();
  }

  // ── Y-sort ────────────────────────────────────────────────────────────
  private _ySort(): void {
    const maxY = this._worldH || 1;
    const base = DEPTH.GAME;

    for (const obj of this._ySortables) {
      // normalise y into 0–1, clamp, then map into depth range
      const normalized = Math.max(0, Math.min(1, (obj as unknown as { y: number }).y / maxY));
      obj.setDepth(base + Math.floor(normalized * YSORT_RANGE));
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────
  protected shutdown(): void {
    this._ySortables.length = 0;
  }
}

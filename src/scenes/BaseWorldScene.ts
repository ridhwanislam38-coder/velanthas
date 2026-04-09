import Phaser from 'phaser';
import { Bus, GameEvent } from '../systems/EventBus';

// ── BaseWorldScene ──────────────────────────────────────────────────────────
// Abstract base for all birds-eye region scenes. Provides:
//   - Zero-gravity physics (per-scene override of world gravity)
//   - Camera: smooth-lerp follow with deadzone, world bounds, sub-pixel correction
//   - Y-sort: HD-2D raw-Y depth (sprites between ground=5 and foreground=9999)
//   - System lifecycle hooks for subclass wiring
//
// Subclasses override the abstract methods and call super.create() / super.update().

// ── Camera tuning ────────────────────────────────────────────────────────
const CAM_LERP        = 0.08;  // low = smooth tracking, 1 = snap
const CAM_DEADZONE_W  = 60;    // px — player moves freely in this rect
const CAM_DEADZONE_H  = 40;

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
  // HD-2D: sprites get depth = raw Y (0–worldH). Ground layer is at 5,
  // foreground layer is at 9999, so sprites always render between them.
  private _ySort(): void {
    for (const obj of this._ySortables) {
      const y = (obj as unknown as { y: number }).y;
      // Clamp to 10–9998 so sprites stay between ground (5) and foreground (9999)
      obj.setDepth(Math.max(10, Math.min(9998, Math.round(y))));
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────
  protected shutdown(): void {
    this._ySortables.length = 0;
  }
}

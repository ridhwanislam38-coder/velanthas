import Phaser from 'phaser';
import type { ElevationLevel } from '../config/worldConfig';
import { ELEVATION } from '../config/worldConfig';

// ── Elevation System ───────────────────────────────────────────────────────
// Tracks player elevation (0-4). Adjusts camera offset, wind particles,
// fall damage. Depth sorting is handled by the scene's depth values.
//
// Level 0 = underground (caves)
// Level 1 = ground (standard exploration)
// Level 2 = raised (stairs, hillsides)
// Level 3 = rooftops / treetops
// Level 4 = peaks (towers, mountain tops)

export type ElevationTransitionType = 'STAIRS' | 'LADDER' | 'CAVE_ENTRY' | 'CLIFF_EDGE' | 'UNDERGROUND';

export interface ElevationZone {
  x:          number;
  y:          number;
  width:      number;
  height:     number;
  targetLevel: ElevationLevel;
  transition: ElevationTransitionType;
}

export class ElevationSystem {
  private _scene:       Phaser.Scene;
  private _level:       ElevationLevel = 1;
  private _zones:       ElevationZone[] = [];
  private _wind:        Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private _transitioning = false;

  private _listeners: Array<(level: ElevationLevel) => void> = [];

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
  }

  // ── Public ────────────────────────────────────────────────────────────

  addZone(zone: ElevationZone): void {
    this._zones.push(zone);
  }

  /** Call every frame with player position to detect zone entry. */
  checkPlayer(px: number, py: number): void {
    for (const zone of this._zones) {
      if (
        px >= zone.x && px <= zone.x + zone.width &&
        py >= zone.y && py <= zone.y + zone.height
      ) {
        if (zone.targetLevel !== this._level) {
          this._transition(zone.targetLevel, zone.transition);
        }
        return;
      }
    }
  }

  /** Called when player lands after a fall. Returns damage dealt (may be 0). */
  onLand(fromLevel: ElevationLevel, toLevel: ElevationLevel): number {
    const fallDistance = fromLevel - toLevel;
    if (fromLevel >= 3 && toLevel <= 1 && fallDistance >= 2) {
      return ELEVATION.CLIFF_FALL_DMG;
    }
    return 0;
  }

  onChange(fn: (level: ElevationLevel) => void): void {
    this._listeners.push(fn);
  }

  get level(): ElevationLevel { return this._level; }

  /** Camera Y offset to apply — shifts world DOWN as player climbs. */
  get cameraYOffset(): number {
    return this._level * ELEVATION.CAMERA_Y_OFFSET;
  }

  /** Depth value for sprites at this elevation + their y position. */
  static depthFor(elevation: ElevationLevel, y: number): number {
    return elevation * 10_000 + y;
  }

  /** Whether wind particles should be active. */
  get windActive(): boolean {
    return this._level >= ELEVATION.WIND_ENABLED_AT;
  }

  /** Saturation reduction at peak (0.0-1.0, applied as palette modifier). */
  get peakDesaturation(): number {
    return this._level === 4 ? ELEVATION.PEAK_DESATURATE : 0;
  }

  // ── Transition ────────────────────────────────────────────────────────

  private _transition(target: ElevationLevel, type: ElevationTransitionType): void {
    if (this._transitioning) return;
    this._transitioning = true;
    const prev = this._level;

    switch (type) {
      case 'STAIRS':
        // Gradual — camera moves over 0.4s
        this._scene.tweens.add({
          targets:  this._scene.cameras.main,
          scrollY:  this._scene.cameras.main.scrollY + (target - prev) * ELEVATION.CAMERA_Y_OFFSET,
          duration: 400,
          ease:     'Power2',
          onComplete: () => this._completeTransition(target),
        });
        break;

      case 'CAVE_ENTRY':
        // Fade to black, change level, fade back
        this._scene.cameras.main.fade(500, 0, 0, 0, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
          if (progress === 1) {
            this._completeTransition(target);
            this._scene.cameras.main.flash(400, 0, 0, 0, true);
          }
        });
        break;

      case 'CLIFF_EDGE':
        // Camera pulls back (zooms out slightly)
        this._scene.tweens.add({
          targets:  this._scene.cameras.main,
          zoom:     0.85,
          duration: 300,
          ease:     'Power1',
          onComplete: () => {
            this._completeTransition(target);
            this._scene.tweens.add({
              targets:  this._scene.cameras.main,
              zoom:     1.0,
              duration: 400,
              ease:     'Power2',
            });
          },
        });
        break;

      default:
        // LADDER, UNDERGROUND — instant (camera follows player)
        this._completeTransition(target);
        break;
    }

    // Wind particles
    this._updateWind(target);
  }

  private _completeTransition(target: ElevationLevel): void {
    this._level         = target;
    this._transitioning = false;
    this._listeners.forEach(fn => fn(this._level));
    this._scene.events.emit('elevation_change', this._level);
  }

  // ── Wind particles ────────────────────────────────────────────────────

  private _updateWind(newLevel: ElevationLevel): void {
    const shouldHaveWind = newLevel >= ELEVATION.WIND_ENABLED_AT;

    if (shouldHaveWind && !this._wind) {
      const { width, height } = this._scene.scale;
      this._wind = this._scene.add.particles(0, height * 0.3, '__DEFAULT', {
        x:         { min: -10, max: width + 10 },
        speedX:    { min: 40, max: 80 },
        speedY:    { min: -5, max: 5 },
        lifespan:  { min: 1000, max: 2000 },
        scaleX:    { min: 0.3, max: 1.2 },
        scaleY:    0.08,
        quantity:  1,
        frequency: 300,
        alpha:     { start: 0.3, end: 0 },
        tint:      0xd0d8e0,
      });
      this._wind.setScrollFactor(0).setDepth(140);
    }

    if (!shouldHaveWind && this._wind) {
      this._wind.destroy();
      this._wind = null;
    }
  }
}

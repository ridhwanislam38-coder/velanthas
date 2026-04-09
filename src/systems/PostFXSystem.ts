import Phaser from 'phaser';
import { Bus, GameEvent } from './EventBus';

// ── PostFXSystem ────────────────────────────────────────────────────────────
// Thin controller over Phaser's built-in camera postFX. No custom shaders —
// uses bloom, bokeh (DoF), blur (motion), and barrel (chromatic aberration).
//
// All effects applied to the main camera, affecting everything below UI depth.
// Driven by EventBus events for combat feel.

interface PostFXConfig {
  /** Persistent bloom for light sources. */
  bloomEnabled: boolean;
  bloomColor:   number;
  bloomOffset:  number;
  bloomBlur:    number;
  bloomStrength:number;

  /** Depth-of-field (permanent subtle bokeh). */
  dofEnabled: boolean;
  dofRadius:  number;
  dofAmount:  number;
}

const DEFAULTS: PostFXConfig = {
  bloomEnabled:  true,
  bloomColor:    0xffffff,
  bloomOffset:   1.0,
  bloomBlur:     4,
  bloomStrength: 1,

  dofEnabled: false,  // off by default — enable per-region for diorama feel
  dofRadius:  0.5,
  dofAmount:  1.0,
};

export class PostFXSystem {
  private _scene:  Phaser.Scene | null = null;
  private _config: PostFXConfig = { ...DEFAULTS };

  // FX handles (null if not applied)
  private _bloom:  Phaser.FX.Bloom | null = null;
  private _bokeh:  Phaser.FX.Bokeh | null = null;
  private _blur:   Phaser.FX.Blur  | null = null;
  private _barrel: Phaser.FX.Barrel| null = null;

  // Timers for transient effects
  private _blurTimer   = 0;
  private _barrelTimer = 0;

  // ── Init — call once per scene ────────────────────────────────────────
  init(scene: Phaser.Scene, config?: Partial<PostFXConfig>): void {
    this._scene = scene;
    if (config) Object.assign(this._config, config);

    const cam = scene.cameras.main;

    // Persistent bloom
    if (this._config.bloomEnabled) {
      this._bloom = cam.postFX.addBloom(
        this._config.bloomColor,
        this._config.bloomOffset,
        this._config.bloomOffset,
        this._config.bloomBlur,
        this._config.bloomStrength,
      );
    }

    // Persistent DoF (bokeh) — subtle background blur
    if (this._config.dofEnabled) {
      this._bokeh = cam.postFX.addBokeh(
        this._config.dofRadius,
        this._config.dofAmount,
      );
    }

    this._wireEvents();
  }

  // ── Per-frame update ──────────────────────────────────────────────────
  update(delta: number): void {
    // Motion blur auto-decay
    if (this._blurTimer > 0) {
      this._blurTimer -= delta;
      if (this._blurTimer <= 0 && this._blur) {
        this._scene?.cameras.main.postFX.remove(this._blur);
        this._blur = null;
      }
    }

    // Chromatic aberration auto-decay
    if (this._barrelTimer > 0) {
      this._barrelTimer -= delta;
      if (this._barrel) {
        // Ease barrel back to 1.0 (no distortion)
        const t = Math.max(0, this._barrelTimer / 300);
        this._barrel.amount = 1.0 + t * 0.03; // subtle barrel
      }
      if (this._barrelTimer <= 0 && this._barrel) {
        this._scene?.cameras.main.postFX.remove(this._barrel);
        this._barrel = null;
      }
    }
  }

  // ── On-demand effects ─────────────────────────────────────────────────

  /** Flash of motion blur on heavy hits / kills. */
  motionBlur(durationMs = 200, strength = 2): void {
    if (!this._scene) return;
    const cam = this._scene.cameras.main;

    if (this._blur) cam.postFX.remove(this._blur);
    this._blur = cam.postFX.addBlur(0, strength, strength, 1);
    this._blurTimer = durationMs;
  }

  /** Chromatic aberration pulse on specials / critical moments. */
  chromaticAberration(durationMs = 300): void {
    if (!this._scene) return;
    const cam = this._scene.cameras.main;

    if (this._barrel) cam.postFX.remove(this._barrel);
    this._barrel = cam.postFX.addBarrel(1.03);
    this._barrelTimer = durationMs;
  }

  /** Toggle DoF on/off (e.g. during dialogue focus). */
  setDoF(enabled: boolean): void {
    if (!this._scene) return;
    const cam = this._scene.cameras.main;

    if (enabled && !this._bokeh) {
      this._bokeh = cam.postFX.addBokeh(
        this._config.dofRadius,
        this._config.dofAmount,
      );
    } else if (!enabled && this._bokeh) {
      cam.postFX.remove(this._bokeh);
      this._bokeh = null;
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────
  destroy(): void {
    if (this._scene) {
      const cam = this._scene.cameras.main;
      cam.postFX.clear();
    }
    this._bloom = this._bokeh = this._blur = this._barrel = null;
    this._scene = null;
  }

  // ── Event wiring ──────────────────────────────────────────────────────
  private _wireEvents(): void {
    Bus.on(GameEvent.HIT_HEAVY, () => {
      this.motionBlur(200, 2);
    });

    Bus.on(GameEvent.HIT_SPECIAL, () => {
      this.chromaticAberration(400);
      this.motionBlur(300, 3);
    });
  }
}

import Phaser from 'phaser';
import type { WeatherType, Season } from '../config/worldConfig';
import { WEATHER_WEIGHTS, WEATHER_EFFECTS } from '../config/worldConfig';

// ── Weather System ─────────────────────────────────────────────────────────
// One active weather state per region.
// Transitions over 90 real seconds — never sudden.
// Particles fade in/out — no pop-in.

const TRANSITION_MS = 90_000;

export interface WeatherState {
  current:  WeatherType;
  next:     WeatherType | null;
  progress: number; // 0-1, lerp during transition
}

export class WeatherSystem {
  private _scene:    Phaser.Scene;
  private _region:   string;
  private _season:   Season;
  private _state:    WeatherState;
  private _particles: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();
  private _transitioning = false;
  private _transitionElapsed = 0;

  constructor(scene: Phaser.Scene, region: string, season: Season) {
    this._scene  = scene;
    this._region = region;
    this._season = season;
    this._state  = { current: this._roll(), next: null, progress: 0 };
    this._applyWeather(this._state.current, 1.0);
  }

  // ── Public ────────────────────────────────────────────────────────────

  update(delta: number): void {
    if (!this._transitioning) return;

    this._transitionElapsed += delta;
    const t = Math.min(this._transitionElapsed / TRANSITION_MS, 1);
    this._state.progress = t;

    // Crossfade particles
    if (this._state.next) {
      this._blendParticles(this._state.current, this._state.next, t);
    }

    if (t >= 1) {
      this._completeTransition();
    }
  }

  /** Force a new weather roll (e.g. on region change or bonfire rest). */
  tick(): void {
    if (this._transitioning) return;
    const next = this._roll();
    if (next === this._state.current) return;
    this._beginTransition(next);
  }

  get currentWeather(): WeatherType { return this._state.current; }

  get speedMod(): number  { return WEATHER_EFFECTS[this._state.current].speedMod; }
  get dmgMod():   number  { return WEATHER_EFFECTS[this._state.current].dmgMod;   }

  setSeason(season: Season): void {
    this._season = season;
  }

  destroy(): void {
    this._particles.forEach(e => e.destroy());
    this._particles.clear();
  }

  // ── Transition ────────────────────────────────────────────────────────

  private _beginTransition(next: WeatherType): void {
    this._state.next         = next;
    this._state.progress     = 0;
    this._transitioning      = true;
    this._transitionElapsed  = 0;
    this._applyWeather(next, 0);
  }

  private _completeTransition(): void {
    if (!this._state.next) return;

    // Fully remove old particles
    const old = this._particles.get(this._state.current);
    if (old) { old.destroy(); this._particles.delete(this._state.current); }

    this._state.current     = this._state.next;
    this._state.next        = null;
    this._state.progress    = 0;
    this._transitioning     = false;
    this._transitionElapsed = 0;

    this._scene.events.emit('weather_changed', this._state.current);
  }

  // ── Particle management ───────────────────────────────────────────────

  private _applyWeather(weather: WeatherType, initialAlpha: number): void {
    if (weather === 'CLEAR') return;
    const emitter = this._createEmitter(weather);
    if (!emitter) return;
    emitter.setAlpha(initialAlpha);
    this._particles.set(weather, emitter);
  }

  private _blendParticles(from: WeatherType, to: WeatherType, t: number): void {
    const fromE = this._particles.get(from);
    const toE   = this._particles.get(to);
    if (fromE) fromE.setAlpha(1 - t);
    if (toE)   toE.setAlpha(t);
  }

  private _createEmitter(weather: WeatherType): Phaser.GameObjects.Particles.ParticleEmitter | null {
    const { width, height } = this._scene.scale;

    switch (weather) {
      case 'RAIN': {
        const mgr = this._scene.add.particles(0, 0, '__DEFAULT', {
          x: { min: -20, max: width + 20 },
          y: -4,
          speedX: 30,
          speedY: { min: 180, max: 260 },
          lifespan: 1400,
          scaleX: 0.12,
          scaleY: 0.5,
          quantity: 2,
          frequency: 20,
          alpha: 0.5,
          tint: 0xb0c8ff,
        });
        mgr.setScrollFactor(0).setDepth(150);
        return mgr;
      }

      case 'STORM': {
        const mgr = this._scene.add.particles(0, 0, '__DEFAULT', {
          x: { min: -20, max: width + 20 },
          y: -4,
          speedX: 60,
          speedY: { min: 280, max: 380 },
          lifespan: 1000,
          scaleX: 0.1,
          scaleY: 0.7,
          quantity: 4,
          frequency: 12,
          alpha: 0.65,
          tint: 0x90a8cc,
        });
        mgr.setScrollFactor(0).setDepth(150);
        // Lightning: random full-screen flashes
        this._scheduleLightning();
        return mgr;
      }

      case 'FOG': {
        const mgr = this._scene.add.particles(0, height / 2, '__DEFAULT', {
          x: { min: 0, max: width },
          y: { min: height * 0.4, max: height },
          speedX: { min: -8, max: 8 },
          speedY: { min: -2, max: 2 },
          lifespan: 6000,
          scaleX: 12,
          scaleY: 6,
          quantity: 1,
          frequency: 400,
          alpha: { start: 0, end: 0.18 },
          tint: 0xaabbcc,
        });
        mgr.setScrollFactor(0).setDepth(130);
        return mgr;
      }

      case 'ASHFALL': {
        const mgr = this._scene.add.particles(0, 0, '__DEFAULT', {
          x: { min: 0, max: width },
          y: -4,
          speedX: { min: 15, max: 35 },
          speedY: { min: 20, max: 50 },
          lifespan: 4000,
          scaleX: 0.15,
          scaleY: 0.15,
          quantity: 1,
          frequency: 80,
          alpha: 0.4,
          tint: 0x444444,
        });
        mgr.setScrollFactor(0).setDepth(150);
        return mgr;
      }

      case 'VOIDBLOOM': {
        const mgr = this._scene.add.particles(0, 0, '__DEFAULT', {
          x: { min: 0, max: width },
          y: { min: height / 2, max: height },
          speedX: { min: -10, max: 10 },
          speedY: { min: -30, max: -10 },
          lifespan: 3000,
          scaleX: 0.3,
          scaleY: 0.3,
          quantity: 1,
          frequency: 200,
          alpha: { start: 0.6, end: 0 },
          tint: 0x7b2fff,
        });
        mgr.setScrollFactor(0).setDepth(130);
        return mgr;
      }

      default: return null;
    }
  }

  private _scheduleLightning(): void {
    if (this._state.current !== 'STORM' && this._state.next !== 'STORM') return;

    const delay = Phaser.Math.Between(8000, 15000);
    this._scene.time.delayedCall(delay, () => {
      if (this._state.current === 'STORM' || this._state.next === 'STORM') {
        this._scene.cameras.main.flash(2, 240, 240, 224, false);
        this._scene.time.delayedCall(1500, () => {
          this._scene.events.emit('weather_thunder');
        });
        this._scheduleLightning();
      }
    });
  }

  // ── Weighted random roll ───────────────────────────────────────────────

  private _roll(): WeatherType {
    const weights = WEATHER_WEIGHTS[this._region]?.[this._season] ?? { CLEAR: 1 };
    const entries = Object.entries(weights) as [WeatherType, number][];
    const total   = entries.reduce((s, [, w]) => s + w, 0);
    let rand = Math.random() * total;
    for (const [type, weight] of entries) {
      rand -= weight;
      if (rand <= 0) return type;
    }
    return 'CLEAR';
  }
}

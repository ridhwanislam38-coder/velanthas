import { Howl, Howler } from 'howler';
import { Bus, GameEvent } from './EventBus';

// ── AudioSystem — Ambient-Only (NO music) ───────────────────────────────────
// Three channels:
//   ambientBed   — constant regional loop (wind, water, cave-hum). Crossfades on region change.
//   ambientLayer — mid-range environmental events (distant bells, bird calls, crowd murmur). Loops.
//   sfx          — one-shot foreground events (footsteps, combat, UI, destruction).
//
// NO music channel. Velanthas is music-free — atmospheric sound design only.

const CROSSFADE_MS = 2000;

// ── SFX catalogue — add entries here as assets are sourced ──────────────
export type SfxKey =
  | 'hit_light' | 'hit_heavy' | 'hit_crit' | 'hit_break'
  | 'parry' | 'parry_perfect' | 'dodge'
  | 'death' | 'boss_roar'
  | 'bonfire_ignite' | 'bonfire_rest'
  | 'footstep_stone' | 'footstep_grass' | 'footstep_water'
  | 'menu_select' | 'menu_back'
  | 'item_pickup' | 'currency_gain'
  | 'destruct_rock' | 'destruct_wood' | 'destruct_ice'
  | 'portal_open' | 'portal_travel'
  | 'npc_interact' | 'dialogue_advance';

// ── Ambient region keys ─────────────────────────────────────────────────
export type AmbientKey =
  | 'ashfields' | 'verdenmere' | 'greyveil'
  | 'gildspire' | 'voidmarsh' | 'unnamed_city'
  | 'interstitial' | 'interior' | 'silence';

// ── Channel volumes ─────────────────────────────────────────────────────
interface ChannelVolumes {
  ambientBed:   number;
  ambientLayer: number;
  sfx:          number;
}

const DEFAULT_VOLUMES: ChannelVolumes = {
  ambientBed:   0.5,
  ambientLayer: 0.35,
  sfx:          0.8,
};

// ── AudioSystem ─────────────────────────────────────────────────────────
export class AudioSystem {
  private _volumes: ChannelVolumes = { ...DEFAULT_VOLUMES };

  // Active ambient Howl instances (null = nothing playing yet)
  private _bed:      Howl | null = null;
  private _bedId:    number | null = null;
  private _layer:    Howl | null = null;
  private _layerId:  number | null = null;

  // SFX pool: pre-loaded Howl instances keyed by SfxKey
  private _sfxPool = new Map<SfxKey, Howl>();

  // Current region (to skip redundant crossfades)
  private _currentRegion: AmbientKey | null = null;

  constructor() {
    this._wireEvents();
  }

  // ── Region crossfade ──────────────────────────────────────────────────
  /** Crossfade ambient bed + layer to a new region's soundscape. */
  crossfadeToRegion(region: AmbientKey): void {
    if (region === this._currentRegion) return;
    this._currentRegion = region;

    // Bed
    const bedSrc = this._ambientPath(region, 'bed');
    this._crossfadeChannel('bed', bedSrc);

    // Layer
    const layerSrc = this._ambientPath(region, 'layer');
    this._crossfadeChannel('layer', layerSrc);
  }

  // ── SFX ───────────────────────────────────────────────────────────────
  /** Play a one-shot sound effect. */
  playSfx(key: SfxKey): void {
    let howl = this._sfxPool.get(key);
    if (!howl) {
      howl = new Howl({
        src: [
          `assets/audio/sfx/${key}.webm`,
          `assets/audio/sfx/${key}.mp3`,
        ],
        volume: this._volumes.sfx,
        preload: true,
      });
      this._sfxPool.set(key, howl);
    }
    howl.volume(this._volumes.sfx);
    howl.play();
  }

  // ── Volume control ────────────────────────────────────────────────────
  setVolume(channel: keyof ChannelVolumes, v: number): void {
    const clamped = Math.max(0, Math.min(1, v));
    this._volumes[channel] = clamped;

    if (channel === 'ambientBed' && this._bed && this._bedId !== null) {
      this._bed.volume(clamped, this._bedId);
    }
    if (channel === 'ambientLayer' && this._layer && this._layerId !== null) {
      this._layer.volume(clamped, this._layerId);
    }
    // SFX volume applies on next play — no live adjustment needed
  }

  getVolume(channel: keyof ChannelVolumes): number {
    return this._volumes[channel];
  }

  getVolumes(): Readonly<ChannelVolumes> { return this._volumes; }

  /** Restore volumes from a saved settings object. */
  restoreVolumes(saved: Partial<ChannelVolumes>): void {
    if (saved.ambientBed !== undefined)   this.setVolume('ambientBed', saved.ambientBed);
    if (saved.ambientLayer !== undefined) this.setVolume('ambientLayer', saved.ambientLayer);
    if (saved.sfx !== undefined)          this.setVolume('sfx', saved.sfx);
  }

  /** Mute/unmute everything globally. */
  mute(muted: boolean): void {
    Howler.mute(muted);
  }

  /** Stop all audio — call on scene shutdown. */
  stopAll(): void {
    Howler.stop();
    this._bed = this._layer = null;
    this._bedId = this._layerId = null;
    this._currentRegion = null;
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private _crossfadeChannel(
    channel: 'bed' | 'layer',
    src: string[],
  ): void {
    const vol = channel === 'bed' ? this._volumes.ambientBed : this._volumes.ambientLayer;
    const oldHowl = channel === 'bed' ? this._bed : this._layer;
    const oldId    = channel === 'bed' ? this._bedId : this._layerId;

    // Fade out old
    if (oldHowl && oldId !== null) {
      const capturedHowl = oldHowl;
      const capturedId = oldId;
      capturedHowl.fade(capturedHowl.volume(capturedId) as number, 0, CROSSFADE_MS, capturedId);
      capturedHowl.once('fade', () => {
        capturedHowl.stop(capturedId);
        capturedHowl.unload();
      }, capturedId);
    }

    // Fade in new
    const newHowl = new Howl({
      src,
      volume: 0,
      loop: true,
      html5: true, // streaming for long ambient loops — saves memory
    });

    const newId = newHowl.play();
    newHowl.fade(0, vol, CROSSFADE_MS, newId);

    if (channel === 'bed') {
      this._bed = newHowl;
      this._bedId = newId;
    } else {
      this._layer = newHowl;
      this._layerId = newId;
    }
  }

  private _ambientPath(region: AmbientKey, type: 'bed' | 'layer'): string[] {
    const base = `assets/audio/ambient/${region}_${type}`;
    return [`${base}.webm`, `${base}.mp3`];
  }

  private _wireEvents(): void {
    Bus.on(GameEvent.REGION_ENTER, (data: unknown) => {
      const d = data as { region?: string };
      if (d.region) {
        this.crossfadeToRegion(d.region.toLowerCase() as AmbientKey);
      }
    });
  }
}

/** Singleton — one AudioSystem for the entire game session. */
export const Audio = new AudioSystem();

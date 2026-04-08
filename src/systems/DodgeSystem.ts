import type { APSystem } from './APSystem';

// ── Dodge System ───────────────────────────────────────────────────────────
// Dodge window: 10 frames before hit.
// Perfect dodge window: first 3 of those 10 frames.
// Perfect dodge: 0 damage + 0.5s slow-mo + free light attack + 1 AP.
// I-frames: 8 frames of invincibility during dodge roll.
// Cooldown: 600ms — punishes spam (no i-frames if spammed).

export type DodgeResult = 'perfect' | 'dodge' | 'miss';

const DODGE_WINDOW_FRAMES   = 10;
const PERFECT_WINDOW_FRAMES = 3;
const IFRAME_FRAMES         = 8;
const COOLDOWN_MS           = 600;

export class DodgeSystem {
  private _iframes       = 0;    // remaining i-frames
  private _cooldownLeft  = 0;    // ms until next dodge available
  private _windowFrame   = 0;    // how many frames ago dodge was pressed
  private _windowActive  = false;
  private _freeLightAvail = false;
  private _ap: APSystem;
  private _onDodge?: (result: DodgeResult) => void;

  constructor(ap: APSystem) {
    this._ap = ap;
  }

  /** Called when player presses dodge input */
  press(): boolean {
    if (this._cooldownLeft > 0) return false; // on cooldown — no i-frames
    this._windowActive = true;
    this._windowFrame  = 0;
    this._iframes      = IFRAME_FRAMES;
    this._cooldownLeft = COOLDOWN_MS;
    return true;
  }

  /** Called each frame (delta = ms elapsed) */
  update(delta: number): void {
    if (this._cooldownLeft > 0) {
      this._cooldownLeft = Math.max(0, this._cooldownLeft - delta);
    }
    if (this._iframes > 0) {
      this._iframes--;
    }
    if (this._windowActive) {
      this._windowFrame++;
      if (this._windowFrame > DODGE_WINDOW_FRAMES) {
        this._windowActive = false;
      }
    }
  }

  /**
   * Called the frame an attack's hitbox would connect.
   * Returns whether the dodge absorbed it.
   */
  resolveHit(): DodgeResult {
    if (!this._windowActive && this._iframes <= 0) return 'miss';
    if (this._iframes <= 0) return 'miss';

    const f = this._windowFrame;
    let result: DodgeResult;

    if (f <= PERFECT_WINDOW_FRAMES) {
      result = 'perfect';
      this._ap.gain(1, 'perfect_dodge');
      this._freeLightAvail = true;
    } else {
      result = 'dodge';
    }

    this._windowActive = false;
    this._onDodge?.(result);
    return result;
  }

  /** Consume the free light attack granted by perfect dodge */
  consumeFreeLight(): boolean {
    if (!this._freeLightAvail) return false;
    this._freeLightAvail = false;
    return true;
  }

  onDodge(fn: (result: DodgeResult) => void): void {
    this._onDodge = fn;
  }

  get hasIframes(): boolean { return this._iframes > 0; }
  get onCooldown(): boolean { return this._cooldownLeft > 0; }
  get freeLightAvailable(): boolean { return this._freeLightAvail; }
  get cooldownPct(): number { return this._cooldownLeft / COOLDOWN_MS; }
}

import type { AttackData } from './CombatSystem';
import type { APSystem } from './APSystem';

// ── Parry System ───────────────────────────────────────────────────────────
// Parry window: 6 frames before hit lands.
// Perfect parry window: 2 frames (subset — first 2 of the 6).
// Miss: chip damage through block (15%).
// Visual: flash ring on parry, gold ring on perfect parry.

export type ParryResult = 'perfect' | 'parry' | 'miss' | 'too_late';

export interface ParryState {
  active: boolean;
  frame: number;
  result: ParryResult | null;
}

const PARRY_WINDOW_FRAMES = 6;
const PERFECT_WINDOW_FRAMES = 2;

export class ParrySystem {
  private _state: ParryState = { active: false, frame: 0, result: null };
  private _ap: APSystem;
  private _onParry?: (result: ParryResult) => void;

  constructor(ap: APSystem) {
    this._ap = ap;
  }

  /** Call when player presses block/parry input */
  activate(): void {
    this._state = { active: true, frame: 0, result: null };
  }

  /** Call when player releases block/parry input */
  deactivate(): void {
    this._state.active = false;
  }

  /** Called each physics update frame */
  tick(): void {
    if (this._state.active) {
      this._state.frame++;
      // Parry window expires — becomes a block attempt
      if (this._state.frame > PARRY_WINDOW_FRAMES) {
        this._state.active = false;
      }
    }
  }

  /**
   * Called the frame an attack's active hitbox lands on the player.
   * Returns what happened: perfect / parry / miss (not blocking) / too_late.
   */
  resolveHit(attack: AttackData): ParryResult {
    if (!this._state.active && this._state.result === null) {
      // Player never activated parry this hit
      return 'miss';
    }

    if (!this._state.active) return 'too_late';

    const frame = this._state.frame;
    let result: ParryResult;

    if (frame <= PERFECT_WINDOW_FRAMES) {
      result = 'perfect';
      this._ap.gain(1, 'perfect_parry');
    } else if (frame <= PARRY_WINDOW_FRAMES) {
      result = 'parry';
    } else {
      result = 'too_late';
    }

    this._state.result = result;
    this._state.active = false;
    this._onParry?.(result);

    void attack; // attack data used by caller for stagger duration
    return result;
  }

  /** Register callback for visual/audio feedback */
  onParry(fn: (result: ParryResult) => void): void {
    this._onParry = fn;
  }

  /** Stagger duration in ms based on parry quality */
  getStaggerDuration(result: ParryResult): number {
    if (result === 'perfect') return 1500;
    if (result === 'parry')   return 800;
    return 0;
  }

  get isActive(): boolean { return this._state.active; }
  get frame(): number { return this._state.frame; }
}

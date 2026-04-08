// ── AP (Action Point) System ───────────────────────────────────────────────
// Max 3 AP. Gain from perfect parry/dodge and kills. Spend on specials.
// Decays -1 per 8s out of combat.

export type APGainReason = 'perfect_parry' | 'perfect_dodge' | 'kill';

const AP_MAX = 3;
const AP_DECAY_MS = 8000;

export class APSystem {
  private _ap = 0;
  private _lastCombatMs = 0;
  private _decayAccum = 0;
  private _onChange?: (ap: number, reason?: APGainReason) => void;

  get value(): number { return this._ap; }
  get max(): number { return AP_MAX; }

  gain(amount: number, reason: APGainReason): void {
    const prev = this._ap;
    this._ap = Math.min(AP_MAX, this._ap + amount);
    this._lastCombatMs = Date.now();
    if (this._ap !== prev) this._onChange?.(this._ap, reason);
  }

  spend(amount: number): boolean {
    if (this._ap < amount) return false;
    this._ap -= amount;
    this._onChange?.(this._ap);
    return true;
  }

  markCombat(): void {
    this._lastCombatMs = Date.now();
    this._decayAccum = 0;
  }

  /** Call from scene update. delta = ms since last frame. */
  update(delta: number): void {
    const outOfCombat = Date.now() - this._lastCombatMs > 2000;
    if (!outOfCombat || this._ap <= 0) return;

    this._decayAccum += delta;
    if (this._decayAccum >= AP_DECAY_MS) {
      this._decayAccum -= AP_DECAY_MS;
      const prev = this._ap;
      this._ap = Math.max(0, this._ap - 1);
      if (this._ap !== prev) this._onChange?.(this._ap);
    }
  }

  onChange(fn: (ap: number, reason?: APGainReason) => void): void {
    this._onChange = fn;
  }

  canAfford(cost: number): boolean { return this._ap >= cost; }
}

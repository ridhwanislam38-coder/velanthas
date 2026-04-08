// ── Difficulty — one mode, deaths are data ────────────────────────────────
// No difficulty select. The game teaches through pattern recognition.
// Die enough → subtle assistance appears, then persists, then skip option.

export interface AttackDeathRecord {
  attackId: string;
  deaths: number;
}

export const DIFFICULTY = {
  // Death thresholds for hint system
  HINT_APPEAR_AT:  3,   // deaths to same attack → 0.5s slow-mo hint
  HINT_PERSIST_AT: 5,   // deaths → hint stays longer (1.0s window)
  SKIP_OFFER_AT:  10,   // deaths → skip option appears (reduced rewards)
  SKIP_REWARD_MULT: 0.5,// if skip taken, XP/gold multiplied by this

  // Enemy HP scaling by tier
  HP: {
    GUARD:    100,
    ELITE:    250,
    MINIBOSS: 800,
    BOSS:     3000,
  },

  // Slow-mo window highlight duration (ms) by hint level
  HINT_WINDOW_MS: {
    LEVEL_1: 500,
    LEVEL_2: 1000,
  },

  // Combat reads — enemy adapts to player patterns
  DODGE_SPAM_THRESHOLD:    3,   // dodges in a row → enemy switches to grab
  ATTACK_SPAM_THRESHOLD:   4,   // light attacks in a row → enemy counters
} as const;

// ── In-session death tracking ──────────────────────────────────────────────
// Stored in-memory, persisted to localStorage between sessions.
export class DeathTracker {
  private _records: Map<string, number> = new Map();

  constructor() {
    this._load();
  }

  recordDeath(attackId: string): number {
    const prev = this._records.get(attackId) ?? 0;
    const next = prev + 1;
    this._records.set(attackId, next);
    this._save();
    return next;
  }

  getDeaths(attackId: string): number {
    return this._records.get(attackId) ?? 0;
  }

  getHintLevel(attackId: string): 0 | 1 | 2 | 'skip' {
    const d = this.getDeaths(attackId);
    if (d >= DIFFICULTY.SKIP_OFFER_AT)  return 'skip';
    if (d >= DIFFICULTY.HINT_PERSIST_AT) return 2;
    if (d >= DIFFICULTY.HINT_APPEAR_AT)  return 1;
    return 0;
  }

  reset(): void {
    this._records.clear();
    localStorage.removeItem('sq_deaths');
  }

  private _save(): void {
    const obj: Record<string, number> = {};
    this._records.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem('sq_deaths', JSON.stringify(obj));
  }

  private _load(): void {
    const raw = localStorage.getItem('sq_deaths');
    if (!raw) return;
    try {
      const obj = JSON.parse(raw) as Record<string, number>;
      Object.entries(obj).forEach(([k, v]) => this._records.set(k, v));
    } catch { /* corrupt save — start fresh */ }
  }
}

export const Deaths = new DeathTracker();

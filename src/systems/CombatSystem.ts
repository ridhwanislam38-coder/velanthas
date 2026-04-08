// ── E33-style Combat System ────────────────────────────────────────────────
// Skill-based, timing-is-everything. Every death = player error.
// Reward aggression, punish passivity.

export type AttackType = 'light' | 'heavy' | 'special1' | 'special3' | 'finisher';
export type ComboRoute = readonly AttackType[];

// ── Frame data (at 60fps) ──────────────────────────────────────────────────
export interface AttackData {
  readonly startup:    number;   // frames before hitbox active
  readonly active:     number;   // frames hitbox is live
  readonly recovery:   number;   // frames after active (committed)
  readonly damage:     number;
  readonly knockback:  number;   // px
  readonly hitstun:    number;   // frames target is stunned
  readonly cancelAt:   number;   // frame when dodge-cancel is possible (0 = never)
  readonly apCost:     number;   // AP required to perform (0 = free)
  readonly canParry:   boolean;  // can this be parried?
  readonly canBlock:   boolean;  // can this be blocked?
  readonly blockChip:  number;   // damage dealt even if blocked (%)
}

export const ATTACK_DATA: Readonly<Record<AttackType, AttackData>> = {
  light: {
    startup: 3, active: 8, recovery: 10,
    damage: 10, knockback: 80, hitstun: 12,
    cancelAt: 5, apCost: 0, canParry: true, canBlock: true, blockChip: 0,
  },
  heavy: {
    startup: 10, active: 14, recovery: 10,
    damage: 35, knockback: 150, hitstun: 24,
    cancelAt: 0, apCost: 0, canParry: true, canBlock: true, blockChip: 0.15,
  },
  finisher: {
    startup: 5, active: 10, recovery: 14,
    damage: 60, knockback: 200, hitstun: 30,
    cancelAt: 0, apCost: 0, canParry: true, canBlock: true, blockChip: 0.2,
  },
  special1: {
    startup: 6, active: 20, recovery: 8,
    damage: 60, knockback: 180, hitstun: 30,
    cancelAt: 0, apCost: 1, canParry: false, canBlock: false, blockChip: 1.0,
  },
  special3: {
    // Cutscene finisher — executes only below 20% HP
    startup: 0, active: 0, recovery: 0,
    damage: 9999, knockback: 0, hitstun: 9999,
    cancelAt: 0, apCost: 3, canParry: false, canBlock: false, blockChip: 1.0,
  },
} as const;

// ── Combo routes ───────────────────────────────────────────────────────────
// L×3 → finisher
// L×2 → H (knockup)
// H → special1 (wall-slam if near edge)
export const COMBO_ROUTES: readonly ComboRoute[] = [
  ['light', 'light', 'light', 'finisher'],
  ['light', 'light', 'heavy'],
  ['heavy', 'special1'],
] as const;

// ── Combo tracker ──────────────────────────────────────────────────────────
export class ComboTracker {
  private _history: AttackType[] = [];
  private _lastAttackTime = 0;
  private readonly COMBO_WINDOW_MS = 1200; // reset if no attack within window

  recordAttack(type: AttackType, nowMs: number): AttackType {
    if (nowMs - this._lastAttackTime > this.COMBO_WINDOW_MS) {
      this._history = [];
    }
    this._history.push(type);
    this._lastAttackTime = nowMs;

    // Check if we're in a combo route
    const next = this._getNextInRoute();
    return next;
  }

  // Returns the attack type to actually execute (may be upgraded to finisher etc.)
  private _getNextInRoute(): AttackType {
    const h = this._history;
    for (const route of COMBO_ROUTES) {
      if (route.length === h.length) {
        const match = route.every((a, i) => a === h[i]);
        if (match) {
          // Completed this route — return the final attack and reset
          const final = route[route.length - 1];
          if (final === undefined) return 'light';
          this._history = [];
          return final;
        }
      }
    }
    // Not in a terminal route yet — return the last pressed type
    return h[h.length - 1] ?? 'light';
  }

  reset(): void { this._history = []; }
  get chain(): number { return this._history.length; }
}

// ── Hit detection (melee proximity check) ─────────────────────────────────
export interface FightStance {
  x: number;
  y: number;
  facing: 'left' | 'right';
  width: number;   // sprite width
  height: number;  // sprite height
}

export interface HitResult {
  connected: boolean;
  data: AttackData;
  attackType: AttackType;
}

export function checkHit(
  attacker: FightStance,
  target: FightStance,
  attackType: AttackType,
): HitResult {
  const data = ATTACK_DATA[attackType];

  // Horizontal: attacker's reach = sprite width × 1.5
  const reach = attacker.width * 1.5;
  const dx = target.x - attacker.x;
  const facingTarget =
    (attacker.facing === 'right' && dx > 0) ||
    (attacker.facing === 'left'  && dx < 0);
  const inRange = Math.abs(dx) < reach;

  // Vertical: allow small Y offset
  const dy = Math.abs(target.y - attacker.y);
  const sameRow = dy < target.height * 0.6;

  return { connected: facingTarget && inRange && sameRow, data, attackType };
}

// ── Block mitigation ───────────────────────────────────────────────────────
export function applyBlock(hit: HitResult, isBlocking: boolean): number {
  if (!isBlocking || !hit.data.canBlock) return hit.data.damage;
  return Math.floor(hit.data.damage * hit.data.blockChip);
}

import type { FactionId } from './enemyConfig';

// ── Faction reputation thresholds ─────────────────────────────────────────
export const REP = {
  ALLY:    75,
  NEUTRAL:  0,
  HOSTILE: -30,
  ENEMY:   -75,
} as const;

// ── Per-kill reputation cost ───────────────────────────────────────────────
export const REP_KILL_COST: Record<FactionId, number> = {
  IRONVEIL:   -5,
  THEWILD:    -5,
  VOIDBORN:    0,   // killing voidborn doesn't hurt rep (they're corrupted)
  GILDED:     -8,   // they have lawyers
  FORGOTTEN:  -3,   // hard to make undead angrier
  SILENTONES: -15,  // deeply sacred, killing = major transgression
  NEUTRAL:    -2,
} as const;

// ── Faction palette colors ─────────────────────────────────────────────────
export const FACTION_COLORS: Record<FactionId, { primary: number; secondary: number }> = {
  IRONVEIL:   { primary: 0xe94560, secondary: 0x1a0008 },
  THEWILD:    { primary: 0x06d6a0, secondary: 0x1a2e1a },
  VOIDBORN:   { primary: 0x7b2fff, secondary: 0x0d0020 },
  GILDED:     { primary: 0xffd60a, secondary: 0x1a1600 },
  FORGOTTEN:  { primary: 0x8888aa, secondary: 0x0a0a18 },
  SILENTONES: { primary: 0xffffff, secondary: 0xf0f0f0 },
  NEUTRAL:    { primary: 0x6b6b8a, secondary: 0x1a1a2e },
} as const;

// ── Reputation effect thresholds ─────────────────────────────────────────
// Used by FactionSystem to determine NPC behavior
export const FACTION_EFFECTS = {
  DISCOUNT_THRESHOLD: REP.ALLY,       // ≥75: 20% shop discount
  SECRET_THRESHOLD:   50,             // ≥50: faction side quests unlock
  HOSTILE_THRESHOLD:  REP.HOSTILE,    // ≤-30: NPCs draw weapons
  BOUNTY_THRESHOLD:   REP.ENEMY,      // ≤-75: bounty hunters spawn
  BOUNTY_HUNTER_HP:   150,
  BOUNTY_HUNTER_DMG:  35,
} as const;

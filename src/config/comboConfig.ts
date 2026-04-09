// ── Combo Routes Configuration ──────────────────────────────────────────────
// 20 named combo routes (CLAUDE.md content target).
// Each route is a sequence of attack types that unlocks a finisher.
// CombatSystem.ComboTracker checks input against these routes.

export type ComboInput = 'light' | 'heavy' | 'dodge_attack' | 'special';

export interface ComboRoute {
  id:          string;
  name:        string;
  description: string;
  sequence:    ComboInput[];
  finisher:    string;       // finisher attack ID
  damage_mult: number;       // multiplier on finisher damage
  unlock_level:number;       // player level required (0 = always available)
}

export const COMBO_ROUTES: ComboRoute[] = [
  // ── Basic (always available) ──────────────────────────────────────
  { id: 'flurry',       name: 'Flurry',          description: 'Quick triple strike.',
    sequence: ['light', 'light', 'light'],    finisher: 'finisher_flurry',     damage_mult: 1.5, unlock_level: 0 },
  { id: 'crush',        name: 'Crush',           description: 'Two heavies into a slam.',
    sequence: ['heavy', 'heavy'],             finisher: 'finisher_crush',      damage_mult: 2.0, unlock_level: 0 },
  { id: 'swift_break',  name: 'Swift Break',     description: 'Light into heavy break.',
    sequence: ['light', 'heavy'],             finisher: 'finisher_break',      damage_mult: 1.8, unlock_level: 0 },

  // ── Intermediate (level 3+) ───────────────────────────────────────
  { id: 'whirlwind',    name: 'Whirlwind',       description: 'Spin attack after dodge.',
    sequence: ['dodge_attack', 'light', 'light'], finisher: 'finisher_whirlwind', damage_mult: 2.2, unlock_level: 3 },
  { id: 'fang_rush',    name: 'Fang Rush',       description: 'Dagger-style rapid pierce.',
    sequence: ['light', 'light', 'dodge_attack', 'light'], finisher: 'finisher_fang', damage_mult: 2.5, unlock_level: 3 },
  { id: 'guard_breaker',name: 'Guard Breaker',   description: 'Break then punish.',
    sequence: ['heavy', 'light', 'heavy'],    finisher: 'finisher_guardbreak', damage_mult: 2.3, unlock_level: 3 },
  { id: 'riposte',      name: 'Riposte',         description: 'Counter after dodge.',
    sequence: ['dodge_attack', 'heavy'],      finisher: 'finisher_riposte',    damage_mult: 2.0, unlock_level: 3 },
  { id: 'echo_strike',  name: 'Echo Strike',     description: 'Double tap with afterimage.',
    sequence: ['light', 'dodge_attack', 'light'], finisher: 'finisher_echo',   damage_mult: 2.1, unlock_level: 3 },

  // ── Advanced (level 6+) ───────────────────────────────────────────
  { id: 'void_combo',   name: 'Void Combo',      description: 'Channel void between strikes.',
    sequence: ['light', 'heavy', 'light', 'heavy'], finisher: 'finisher_void', damage_mult: 3.0, unlock_level: 6 },
  { id: 'tempest',      name: 'Tempest',         description: 'Unrelenting assault.',
    sequence: ['light', 'light', 'heavy', 'light', 'light'], finisher: 'finisher_tempest', damage_mult: 3.5, unlock_level: 6 },
  { id: 'judgment_chain',name: 'Judgment Chain',  description: 'Special into combo finisher.',
    sequence: ['special', 'light', 'heavy'],  finisher: 'finisher_judgment',   damage_mult: 3.2, unlock_level: 6 },
  { id: 'shadow_dance', name: 'Shadow Dance',    description: 'Weave dodges between strikes.',
    sequence: ['dodge_attack', 'light', 'dodge_attack', 'heavy'], finisher: 'finisher_shadow', damage_mult: 3.0, unlock_level: 6 },
  { id: 'iron_curtain', name: 'Iron Curtain',    description: 'Heavy wall of force.',
    sequence: ['heavy', 'heavy', 'heavy'],    finisher: 'finisher_iron',       damage_mult: 3.8, unlock_level: 6 },

  // ── Master (level 10+) ────────────────────────────────────────────
  { id: 'silence_combo',name: 'The Silence',     description: 'The combo that mirrors the Accord.',
    sequence: ['light', 'heavy', 'dodge_attack', 'special', 'heavy'], finisher: 'finisher_silence', damage_mult: 5.0, unlock_level: 10 },
  { id: 'accords_echo', name: "Accord's Echo",   description: 'Channel the old pact.',
    sequence: ['special', 'dodge_attack', 'special'], finisher: 'finisher_accord', damage_mult: 4.5, unlock_level: 10 },
  { id: 'edric_memory', name: "Edric's Memory",  description: 'Fight like the one who broke everything.',
    sequence: ['heavy', 'light', 'light', 'dodge_attack', 'heavy', 'special'], finisher: 'finisher_edric', damage_mult: 6.0, unlock_level: 10 },
  { id: 'moth_waltz',   name: 'Moth Waltz',      description: 'Graceful as the LumaMoth.',
    sequence: ['dodge_attack', 'dodge_attack', 'light', 'light', 'light'], finisher: 'finisher_moth', damage_mult: 4.0, unlock_level: 10 },
  { id: 'warden_lock',  name: "Warden's Lock",   description: 'Unmovable offense.',
    sequence: ['heavy', 'heavy', 'dodge_attack', 'heavy', 'heavy'], finisher: 'finisher_warden', damage_mult: 5.5, unlock_level: 10 },
  { id: 'sister_mirror',name: "Sister's Mirror",  description: 'Reflect their own pattern.',
    sequence: ['dodge_attack', 'light', 'heavy', 'light', 'dodge_attack'], finisher: 'finisher_sister', damage_mult: 4.8, unlock_level: 10 },
  { id: 'final_theorem',name: 'Final Theorem',   description: 'The last combo anyone learns.',
    sequence: ['special', 'heavy', 'dodge_attack', 'light', 'light', 'heavy', 'special'], finisher: 'finisher_final', damage_mult: 8.0, unlock_level: 15 },
];

/** Get combos available at a given player level. */
export function getAvailableCombos(playerLevel: number): ComboRoute[] {
  return COMBO_ROUTES.filter(c => playerLevel >= c.unlock_level);
}

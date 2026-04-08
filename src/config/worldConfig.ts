// ── World Config — Velanthas ──────────────────────────────────────────────
// Day/night timing, season timing, NPC schedule states, cave rules.
// Single source of truth for all world-timing constants.

// ── Day cycle (real minutes per phase) ───────────────────────────────────
export const DAY_CYCLE = {
  TOTAL_MINUTES:  10,              // 1 full day = 10 real minutes
  DAWN_MINUTES:    2,
  DAY_MINUTES:     3,
  DUSK_MINUTES:    2,
  NIGHT_MINUTES:   3,
  // Summer modifier: +1hr day / -1hr night (applied to season multiplier)
  SUMMER_DAY_BONUS: 0.5,          // fraction of phase added to day
} as const;

// Phase keys
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

// ── Season cycle (real hours per season) ──────────────────────────────────
export const SEASON_CYCLE = {
  HOURS_PER_SEASON: 1,            // 4 seasons = 4-hour full cycle
  SEASONS: ['spring', 'summer', 'autumn', 'winter'] as const,
} as const;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

// ── NPC schedule states ───────────────────────────────────────────────────
// NPCs have 4 position waypoints. Scheduler picks based on time of day.
export type NpcScheduleState = 'morning' | 'day' | 'evening' | 'night';

export function timeOfDayToSchedule(tod: TimeOfDay): NpcScheduleState {
  if (tod === 'dawn')  return 'morning';
  if (tod === 'dusk')  return 'evening';
  return tod as NpcScheduleState; // 'day' | 'night' are direct matches
}

// ── Enemy spawn multipliers by time ───────────────────────────────────────
export const SPAWN_MULTIPLIERS: Record<TimeOfDay, { dmg: number; spd: number }> = {
  dawn:  { dmg: 1.0,  spd: 1.0  },
  day:   { dmg: 1.0,  spd: 1.0  },
  dusk:  { dmg: 1.05, spd: 1.05 },
  night: { dmg: 1.15, spd: 1.10 }, // night is harder
} as const;

// ── Weather weight tables ─────────────────────────────────────────────────
// Per-region, per-season. Weights are relative — normalised at runtime.
export type WeatherType = 'CLEAR' | 'RAIN' | 'STORM' | 'FOG' | 'ASHFALL' | 'VOIDBLOOM';

type WeatherWeights = Partial<Record<WeatherType, number>>;

export const WEATHER_WEIGHTS: Record<string, Record<Season, WeatherWeights>> = {
  ASHFIELDS: {
    spring: { CLEAR: 4, RAIN: 2, STORM: 1, ASHFALL: 3         },
    summer: { CLEAR: 5, RAIN: 1, STORM: 1, ASHFALL: 3         },
    autumn: { CLEAR: 3, RAIN: 2, STORM: 2, FOG: 1, ASHFALL: 2 },
    winter: { CLEAR: 3, STORM: 2, FOG: 2, ASHFALL: 3          },
  },
  VERDENMERE: {
    spring: { CLEAR: 5, RAIN: 3, FOG: 2                       },
    summer: { CLEAR: 6, RAIN: 2, FOG: 1                       },
    autumn: { CLEAR: 3, RAIN: 4, STORM: 2, FOG: 1             },
    winter: { CLEAR: 4, RAIN: 2, STORM: 1, FOG: 3             },
  },
  GREYVEIL: {
    spring: { CLEAR: 3, RAIN: 3, FOG: 4                       },
    summer: { CLEAR: 4, RAIN: 2, FOG: 4                       },
    autumn: { CLEAR: 2, RAIN: 3, STORM: 2, FOG: 5             },
    winter: { CLEAR: 1, RAIN: 2, STORM: 3, FOG: 6             },
  },
  GILDSPIRE: {
    spring: { CLEAR: 6, RAIN: 2, FOG: 1, STORM: 1             },
    summer: { CLEAR: 8, RAIN: 1, STORM: 1                     },
    autumn: { CLEAR: 5, RAIN: 2, STORM: 2, FOG: 1             },
    winter: { CLEAR: 4, RAIN: 2, STORM: 3, FOG: 1             },
  },
  VOIDMARSH: {
    spring:  { CLEAR: 2, RAIN: 2, FOG: 3, STORM: 1, VOIDBLOOM: 2 },
    summer:  { CLEAR: 2, RAIN: 1, FOG: 2, STORM: 2, VOIDBLOOM: 3 },
    autumn:  { CLEAR: 1, RAIN: 2, FOG: 3, STORM: 2, VOIDBLOOM: 2 },
    winter:  { CLEAR: 1, RAIN: 1, FOG: 4, STORM: 2, VOIDBLOOM: 2 },
  },
  UNNAMED_CITY: {
    // The Unnamed City has no weather — ever.
    spring: { CLEAR: 1 },
    summer: { CLEAR: 1 },
    autumn: { CLEAR: 1 },
    winter: { CLEAR: 1 },
  },
} as const;

// ── Weather gameplay effects ───────────────────────────────────────────────
export const WEATHER_EFFECTS: Record<WeatherType, {
  speedMod: number; visibilityMod: number; dmgMod: number;
}> = {
  CLEAR:     { speedMod: 1.0,  visibilityMod: 1.0,  dmgMod: 1.0  },
  RAIN:      { speedMod: 0.9,  visibilityMod: 1.0,  dmgMod: 1.0  },
  STORM:     { speedMod: 0.9,  visibilityMod: 0.7,  dmgMod: 1.0  },
  FOG:       { speedMod: 1.0,  visibilityMod: 0.6,  dmgMod: 1.0  },
  ASHFALL:   { speedMod: 1.0,  visibilityMod: 1.0,  dmgMod: 1.0  },
  VOIDBLOOM: { speedMod: 1.0,  visibilityMod: 1.0,  dmgMod: 1.1  },
} as const;

// ── Elevation ─────────────────────────────────────────────────────────────
export const ELEVATION = {
  LEVELS:           5,          // 0 (underground) → 4 (peak)
  CAMERA_Y_OFFSET: -40,        // px per elevation level
  CLIFF_FALL_DMG:   25,        // DMG from falling level 3+→1+
  PEAK_DESATURATE:  0.15,      // saturation reduction at level 4
  WIND_ENABLED_AT:  3,         // min elevation for wind particles
} as const;

export type ElevationLevel = 0 | 1 | 2 | 3 | 4;

// ── Cave types ────────────────────────────────────────────────────────────
export const CAVE_TYPES = ['ACCORD_RUIN', 'NATURAL', 'VOID', 'FORGOTTEN'] as const;
export type CaveType = typeof CAVE_TYPES[number];

export const CAVE_CONFIG: Record<CaveType, {
  ambientColor: number; reverbMod: number; torchMax: number;
}> = {
  ACCORD_RUIN: { ambientColor: 0xF5F0E8, reverbMod: 1.4, torchMax: 3 },
  NATURAL:     { ambientColor: 0x00FFAA, reverbMod: 1.4, torchMax: 3 },
  VOID:        { ambientColor: 0xAA44FF, reverbMod: 1.5, torchMax: 3 },
  FORGOTTEN:   { ambientColor: 0xC8D4E8, reverbMod: 1.6, torchMax: 3 },
} as const;

// ── City persistence rules ────────────────────────────────────────────────
// Which city state is persisted to Supabase vs. localStorage.
export const CITY_PERSISTENCE = {
  faction_rep:        'supabase',   // critical — affects NPC dialogue globally
  quest_stage:        'supabase',
  shop_inventory:     'supabase',
  npc_schedule:       'local',      // cheap — derive from time-of-day
  weather_state:      'local',      // transient — regenerated on load
  death_count:        'local',      // localStorage (already implemented)
} as const;

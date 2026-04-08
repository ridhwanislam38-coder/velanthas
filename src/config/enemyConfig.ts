// ── Single source of truth for ALL enemy stats ────────────────────────────
// No magic numbers inside entity files. Import from here.

export interface EnemyStats {
  readonly hp:    number;
  readonly dmg:   number;
  readonly spd:   number;
  readonly faction: FactionId;
}

export type FactionId =
  | 'IRONVEIL' | 'THEWILD' | 'VOIDBORN'
  | 'GILDED'   | 'FORGOTTEN' | 'SILENTONES' | 'NEUTRAL';

// ── REGULAR ENEMIES ───────────────────────────────────────────────────────
export const ENEMY_STATS = {
  // IRONVEIL
  IronveilFootsoldier: { hp: 90,  dmg: 12, spd: 85,  faction: 'IRONVEIL'  } as EnemyStats,
  IronveilArcher:      { hp: 60,  dmg: 20, spd: 70,  faction: 'IRONVEIL'  } as EnemyStats,
  IronveilShieldwall:  { hp: 200, dmg: 18, spd: 50,  faction: 'IRONVEIL'  } as EnemyStats,
  IronveilBerserker:   { hp: 130, dmg: 35, spd: 130, faction: 'IRONVEIL'  } as EnemyStats,
  IronveilInquisitor:  { hp: 110, dmg: 22, spd: 80,  faction: 'IRONVEIL'  } as EnemyStats,
  IronveilWarbeast:    { hp: 280, dmg: 45, spd: 95,  faction: 'IRONVEIL'  } as EnemyStats,

  // THE WILD
  MossWalker:          { hp: 150, dmg: 20, spd: 55,  faction: 'THEWILD'   } as EnemyStats,
  SporeWitch:          { hp: 80,  dmg: 15, spd: 90,  faction: 'THEWILD'   } as EnemyStats,
  BriarHound:          { hp: 100, dmg: 28, spd: 150, faction: 'THEWILD'   } as EnemyStats,
  SongbirdArcher:      { hp: 70,  dmg: 25, spd: 100, faction: 'THEWILD'   } as EnemyStats,
  TheOldGrove:         { hp: 800, dmg: 40, spd: 30,  faction: 'THEWILD'   } as EnemyStats,   // mini

  // VOIDBORN
  VoidShard:           { hp: 30,  dmg: 30, spd: 0,   faction: 'VOIDBORN'  } as EnemyStats,
  EchoSelf:            { hp: 120, dmg: 0,  spd: 0,   faction: 'VOIDBORN'  } as EnemyStats,   // dmg = player's
  VoidMother:          { hp: 400, dmg: 50, spd: 40,  faction: 'VOIDBORN'  } as EnemyStats,
  NullKnight:          { hp: 180, dmg: 40, spd: 85,  faction: 'VOIDBORN'  } as EnemyStats,

  // GILDED
  GildedMerchant:      { hp: 75,  dmg: 15, spd: 80,  faction: 'GILDED'    } as EnemyStats,
  GildedEnforcer:      { hp: 160, dmg: 30, spd: 90,  faction: 'GILDED'    } as EnemyStats,
  GildedSniper:        { hp: 55,  dmg: 35, spd: 65,  faction: 'GILDED'    } as EnemyStats,
  GildedGolem:         { hp: 350, dmg: 55, spd: 45,  faction: 'GILDED'    } as EnemyStats,

  // FORGOTTEN
  ForsakenSoldier:     { hp: 80,  dmg: 18, spd: 60,  faction: 'FORGOTTEN' } as EnemyStats,
  WailingWraith:       { hp: 70,  dmg: 25, spd: 140, faction: 'FORGOTTEN' } as EnemyStats,
  BoneColossus:        { hp: 300, dmg: 50, spd: 55,  faction: 'FORGOTTEN' } as EnemyStats,
  Revenant:            { hp: 140, dmg: 28, spd: 90,  faction: 'FORGOTTEN' } as EnemyStats,

  // SILENT ONES
  SilentWatcher:       { hp: 100, dmg: 0,  spd: 0,   faction: 'SILENTONES'} as EnemyStats,  // doesn't attack
  SilentChaser:        { hp: 90,  dmg: 40, spd: 160, faction: 'SILENTONES'} as EnemyStats,
  SilentMirror:        { hp: 120, dmg: 0,  spd: 0,   faction: 'SILENTONES'} as EnemyStats,  // reflects

  // NEUTRAL
  GuardEnemy:          { hp: 100, dmg: 15, spd: 90,  faction: 'NEUTRAL'   } as EnemyStats,
  WraithEnemy:         { hp: 70,  dmg: 25, spd: 140, faction: 'VOIDBORN'  } as EnemyStats,
  BrambleEnemy:        { hp: 60,  dmg: 20, spd: 70,  faction: 'THEWILD'   } as EnemyStats,
  MirrorKnight:        { hp: 120, dmg: 18, spd: 80,  faction: 'NEUTRAL'   } as EnemyStats,

  // MINI-BOSSES
  ThornQueenMini:      { hp: 400, dmg: 30, spd: 110, faction: 'THEWILD'   } as EnemyStats,
  TheSleepwalker:      { hp: 500, dmg: 40, spd: 60,  faction: 'FORGOTTEN' } as EnemyStats,

  // BOSSES
  GrimdarTheForsaken:  { hp: 1200, dmg: 50, spd: 95,  faction: 'FORGOTTEN' } as EnemyStats,
  LumaMoth:            { hp: 1500, dmg: 45, spd: 80,  faction: 'THEWILD'   } as EnemyStats,
  TheWarden:           { hp: 2000, dmg: 65, spd: 55,  faction: 'IRONVEIL'  } as EnemyStats,
  SisterSilence:       { hp: 3000, dmg: 80, spd: 160, faction: 'SILENTONES'} as EnemyStats,
} as const;

// ── PHASE HP THRESHOLDS ───────────────────────────────────────────────────
export const PHASE_THRESHOLDS = {
  PHASE_2: 0.50,
  PHASE_3: 0.20,
} as const;

// ── TELEGRAPH FRAMES ──────────────────────────────────────────────────────
export const TELEGRAPH = {
  LIGHT:       12,
  HEAVY:       18,
  UNBLOCKABLE: 20,
  CHARGE:      24,
} as const;

// ── PARRY STAGGER DURATIONS (ms) ─────────────────────────────────────────
export const PARRY_STAGGER = {
  NORMAL:  800,
  PERFECT: 1500,
  GUARD_WEAKNESS: 1600, // GuardEnemy perfect parry = 2× normal
} as const;

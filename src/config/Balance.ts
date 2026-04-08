// ── Leveling ───────────────────────────────────────────────────────────────
export const LEVEL = {
  xpBase:     120,
  xpGrowth:   1.5,
  hpPerLevel: 15,
  atkPerLevel: 4,
} as const;

// ── Damage formula coefficients ────────────────────────────────────────────
export const DAMAGE = {
  levelMult:      1.9,   // base^(level-1)
  speedMult:      3.0,   // max speed bonus (at 0ms remaining)
  comboLinearCap: 5,     // linear scaling up to this combo count
  comboExpBase:   1.6,   // exponential base after linear cap
  breakMult:      15,    // base LUMINA BREAK multiplier (+level*3)
  critBase:       0.10,  // base crit chance
  critPerLevel:   0.015, // crit chance per level
  critDmgBase:    1.8,   // base crit damage mult
  critDmgPerLvl:  0.08,  // crit damage mult per level
  surgeMult:      2.8,   // surge item multiplier
} as const;

// ── Monster stats per subject × floor ─────────────────────────────────────
export const MONSTERS = {
  math: {
    name:   ['Calcumancer', 'Proof Golem', 'Vector Wraith', 'Infinite Shade', 'Axiom Prime'],
    hp:     [80,  200,  500,  1_200,  3_000],
    atk:    [8,   18,   35,   70,     150],
    xp:     [30,  75,   180,  420,    1_000],
    gold:   [15,  35,   80,   200,    450],
  },
  science: {
    name:   ['Entropy Wisp', 'Nucleus Brute', 'Reaction Lich', 'Waveform', 'Singularity'],
    hp:     [90,  220,  540,  1_300,  3_200],
    atk:    [9,   20,   38,   75,     160],
    xp:     [32,  80,   190,  440,    1_050],
    gold:   [16,  38,   85,   210,    470],
  },
  history: {
    name:   ['Forgotten King', 'Era Phantom', 'Chronicle Drake', 'Empire Shade', 'Memento Lich'],
    hp:     [75,  190,  470,  1_150,  2_900],
    atk:    [7,   17,   33,   65,     140],
    xp:     [28,  70,   175,  400,    960],
    gold:   [14,  32,   75,   190,    430],
  },
  english: {
    name:   ['Syntax Specter', 'Rhetoric Imp', 'Metaphor Drake', 'Prose Colossus', 'Void Verse'],
    hp:     [70,  180,  440,  1_100,  2_750],
    atk:    [7,   16,   30,   62,     135],
    xp:     [26,  65,   165,  385,    920],
    gold:   [13,  30,   70,   180,    410],
  },
  custom: {
    name:   ['Conceptum', 'Memory Shard', 'Void Construct', 'Forgotten Form', 'Memoria Boss'],
    hp:     [85,  210,  520,  1_250,  3_100],
    atk:    [8,   19,   36,   72,     155],
    xp:     [31,  78,   185,  430,    1_025],
    gold:   [15,  36,   82,   205,    460],
  },
} as const;

// ── Shop items ─────────────────────────────────────────────────────────────
export const SHOP = {
  hint:   { cost: 50,  label: 'Hint Scroll',   desc: 'Eliminates one wrong answer' },
  shield: { cost: 80,  label: 'Memory Shield', desc: 'Block next monster attack' },
  surge:  { cost: 100, label: 'Lumina Surge',  desc: '2.8× damage next answer' },
  elixir: { cost: 120, label: 'HP Elixir',     desc: 'Restore 40 HP' },
} as const;

// ── Study activities ───────────────────────────────────────────────────────
export const ACTIVITIES = {
  review:     { atkBuff: 0.30, label: 'Quick Review',    desc: '+30% ATK' },
  practice:   { atkBuff: 0.20, hint: true, label: 'Practice Mode', desc: '+20% ATK + 1 Hint' },
  deepStudy:  { atkBuff: 0.50, shield: true, label: 'Deep Study', desc: '+50% ATK + Shield' },
  rest:       { hpHeal: 30, label: 'Rest',               desc: '+30 HP' },
  cram:       { atkBuff: 0.70, hpCost: 20, label: 'Cram Session', desc: '+70% ATK, -20 HP' },
  meditation: { atkBuff: 0.10, surge: true, label: 'Meditation', desc: '+10% ATK + Surge' },
} as const;

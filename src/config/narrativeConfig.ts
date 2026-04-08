// ── Narrative Config — VELANTHAS / The Accord's Silence ───────────────────
// World lexicon, naming rules, landmark names, and simplicity/depth flags.
// All story text lives in src/story/lore/. This file is the index.

export const WORLD_NAME   = 'VELANTHAS';
export const ACCORD_NAME  = 'The Accord';
export const PLAYER_TITLE = 'the traveller'; // player has no canon name

// ── Naming conventions per faction ────────────────────────────────────────
export const NAMING_RULES = {
  IRONVEIL:   'hard consonants, short — Rhoe, Vaek, Dorn, Cress, Aldric',
  THEWILD:    'soft, nature-rooted — Sera, Maren, Birn, Thessaly, Orin',
  VOIDBORN:   'no name — referred to by what they were',
  GILDED:     'two-part, merchant-class — Silvane Cord, Otta Fenn, Caul Mire',
  FORGOTTEN:  'old, heavy — Edric, Valdeth, Thessamine, Corrow',
  SILENTONES: 'no names — the world names them',
} as const;

// ── Regions ───────────────────────────────────────────────────────────────
export const REGIONS = {
  ASHFIELDS:     { name: 'The Ashfields',        faction: 'IRONVEIL'   },
  VERDENMERE:    { name: 'Verdenmere Deep',       faction: 'THEWILD'    },
  GREYVEIL:      { name: 'The Greyveil Flats',   faction: 'FORGOTTEN'  },
  GILDSPIRE:     { name: 'Gildspire Heights',    faction: 'GILDED'     },
  VOIDMARSH:     { name: 'The Voidmarsh',        faction: 'VOIDBORN'   },
  INTERSTITIAL:  { name: 'The Interstitial',     faction: 'NEUTRAL'    },
} as const;

// ── Cities ────────────────────────────────────────────────────────────────
export const CITIES = {
  ASHENMOOR:   { name: 'Ashenmoor',         region: 'ASHFIELDS',   desc: 'Occupied, smoke-grey, iron bridges' },
  VERDENMERE:  { name: 'Verdenmere',        region: 'VERDENMERE',  desc: 'Grown not built, canopy city' },
  GRAYVEIL:    { name: 'Grayveil',          region: 'GREYVEIL',    desc: 'Half-alive, mist-wrapped, bell towers' },
  GILDSPIRE:   { name: 'Gildspire',         region: 'GILDSPIRE',   desc: 'Marble and gold, too clean' },
  UNNAMED:     { name: 'The Unnamed City',  region: 'INTERSTITIAL', desc: 'White, silent, watching' },
} as const;

// ── Landmarks ─────────────────────────────────────────────────────────────
export const LANDMARKS = {
  SUNDERGATE:        'Where the Accord broke — cracked arch, still standing',
  EDRICS_CROSSING:   'A bridge Edric built — player doesn\'t know why it\'s named that yet',
  FIRST_ROOM:        'Beneath the Unnamed City — where the Accord was first made',
  THESSAMINES_GARDEN:'Player\'s mother\'s garden — hidden in Verdenmere — flowers still bloom',
} as const;

// ── The Accord's 4-note theme ─────────────────────────────────────────────
// Same melody in every region's music — different instrument each time.
export const ACCORD_THEME = {
  ASHFIELDS:   'low brass — once per loop',
  VERDENMERE:  'birdsong patterns — organic',
  GREYVEIL:    'piano, reversed',
  GILDSPIRE:   'harpsichord, ornamented — almost unrecognizable',
  VOIDMARSH:   'atonal — rhythm preserved, pitch corrupted',
  UNNAMED_CITY:'silence — audible only after 30s of standing still — from below',
} as const;

// ── Story endings ─────────────────────────────────────────────────────────
export const ENDINGS = {
  RESTORE: {
    id:          'RESTORE',
    name:        'The Accord Restored',
    description: 'Sacrifice yourself. World heals. You dissolve into the Accord. The melody resumes.',
    requirements: [],
  },
  RELEASE: {
    id:          'RELEASE',
    name:        'The Accord Released',
    description: 'Destroy the Chamber. The world learns to live without the Accord permanently.',
    requirements: [],
  },
  REMEMBER: {
    id:          'REMEMBER',
    name:        'Remembered',
    description: 'Call your mother\'s soul out of the Accord. She chooses. Everyone lives.',
    requirements: [
      'all_quests_complete',
      'ori_awake',
      'maren_interstitial',
      'daevans_sword',
    ],
  },
} as const;

// ── Edric's memory fragments ───────────────────────────────────────────────
// 6 cutscenes told in order. Fragment 6 only unlocks on REMEMBER path.
export const EDRIC_FRAGMENTS = [
  { id: 1, description: 'Edric walking through a healthy Accord-era world — vibrant, full colour' },
  { id: 2, description: 'Edric speaking to the Accord Chamber — being told what is required' },
  { id: 3, description: 'Edric at Thessamine\'s garden — with a woman — her back always to camera' },
  { id: 4, description: 'Edric at the Sundergate — hand on the arch — long pause' },
  { id: 5, description: 'The silence — colour draining from the world' },
  { id: 6, description: 'Edric placing a flower on a grave — player\'s name on the stone (REMEMBER only)', rememberOnly: true },
] as const;

// ── Simplicity rules ──────────────────────────────────────────────────────
// These systems are intentionally thin — do not add complexity.
export const SIMPLE_SYSTEMS = [
  'dialogue',   // JSON tree, typewriter, 3 choices max
  'quests',     // integer stages per quest, Supabase persisted
  'faction_rep',// single integer per faction, threshold in factionConfig
  'lore_items', // readable text on examine — no codex UI
  'npc_schedule', // 4 position states: morning/day/evening/night
  'weather',    // weight table per region+season, one active at a time
  'seasons',    // real-time clock segments, no calendar
] as const;

// ── Depth rules ───────────────────────────────────────────────────────────
// These systems justify their complexity — implement fully.
export const DEEP_SYSTEMS = [
  'lighting',   // primary visual layer, communicates story state
  'cutscenes',  // primary story delivery
  'elevation',  // defines traversal feel
  'reflections',// world quality signal
  'ending_choice', // three paths, fully tracked, genuinely different
] as const;

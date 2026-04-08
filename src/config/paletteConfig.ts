// ── Region Palette Config — VELANTHAS ────────────────────────────────────
// Each region has: primary, secondary, accent, sky, shadow, mist, accord.
// Rule: black is never pure — always tinted toward region primary.
//       shadows are never black — always darkest shade of region primary.
//       Accord white (#F5F0E8) appears in ruins in every region.

export interface RegionPalette {
  /** Dominant terrain/environment colour */
  primary:   number;
  /** Architecture, structures */
  secondary: number;
  /** Cutscenes and important moments — used sparingly */
  accent:    number;
  /** Sky at night */
  sky:       number;
  /** Darkest shadow — replaces black */
  shadow:    number;
  /** Atmospheric fog/haze */
  mist:      number;
  /** How Accord ruins look here */
  accord:    number;
  /** Accord colour in hex string for CSS */
  accordHex: string;
}

export const ACCORD_WHITE      = 0xF5F0E8;
export const ACCORD_WHITE_HEX  = '#F5F0E8';
export const THESSAMINE_PINK   = 0xC87DB0; // only used post-SisterSilence reveal
export const THESSAMINE_HEX    = '#C87DB0';

export const REGION_PALETTES: Record<string, RegionPalette> = {
  ASHFIELDS: {
    primary:   0x3D2B1F,
    secondary: 0x7A3B2E,
    accent:    0xE8824A, // dying ember — cutscenes only
    sky:       0x1A1410,
    shadow:    0x1F150E,
    mist:      0x4A3428,
    accord:    ACCORD_WHITE,
    accordHex: '#F5F0E8', // cold white — sharp contrast — feels wrong here
  },

  VERDENMERE: {
    primary:   0x1C3A2A,
    secondary: 0x5C3D1E,
    accent:    0x7EFFA0, // bioluminescent teal — night and caves only
    sky:       0x0D2118,
    shadow:    0x0E1E15,
    mist:      0x2A4A35,
    accord:    ACCORD_WHITE,
    accordHex: '#F5F0E8', // warm white — vines grow through it — beautiful here
  },

  GREYVEIL: {
    primary:   0x2A2E38,
    secondary: 0x4A4E5A,
    accent:    0xC8D4E8, // ghost light blue — ghosts emit this — ambient only
    sky:       0x141820,
    shadow:    0x0E1018,
    mist:      0x3A4050,
    accord:    ACCORD_WHITE,
    accordHex: '#F5F0E8', // neutral white — perfectly preserved — unsettling
  },

  GILDSPIRE: {
    primary:   0x3D2E0A,
    secondary: 0xF0D080,
    accent:    0xFFFFFF, // pure white — only region using true white — deliberate excess
    sky:       0x1A1508,
    shadow:    0x1E1804,
    mist:      0x4A3C1A,
    accord:    ACCORD_WHITE,
    accordHex: '#F5F0E8', // ivory — gilded over — scrapeable gold veneer
  },

  VOIDMARSH: {
    primary:   0x1A0A2E,
    secondary: 0x2D1A4A,
    accent:    0x00FFB0, // void green — tears in reality — unnatural
    sky:       0x0A0514,
    shadow:    0x08030F, // almost pure black — deepest shadows in game
    mist:      0x251040,
    accord:    ACCORD_WHITE,
    accordHex: '#F5F0E8', // appears INVERTED here — dark stain on light surfaces
  },

  INTERSTITIAL: {
    // Cycles through all 5 region primaries over 90 seconds — seamless gradient
    // These are the endpoints; renderer interpolates between them cyclically.
    primary:   0x3D2B1F, // starts at Ashfields, cycles
    secondary: 0x000000, // unused — no architecture
    accent:    0xFFFFFF, // all 5 accents simultaneously — layered
    sky:       0x0A0A0A,
    shadow:    0x000000,
    mist:      0x1A1A2E,
    accord:    ACCORD_WHITE,
    accordHex: '#F5F0E8', // glows here — pulsing, alive — only place still active
  },

  UNNAMED_CITY: {
    // Everything is Accord white and its shadows — nothing else — ever.
    primary:   ACCORD_WHITE,
    secondary: 0xC8C4BE,
    accent:    0x9A9690,
    sky:       0xC8C4BE,
    shadow:    0x9A9690,
    mist:      0xBEBAB4,
    accord:    ACCORD_WHITE,
    accordHex: '#F5F0E8',
    // Post-SisterSilence: all palettes bloom simultaneously — 3s transition.
    // First colour to appear (if Thessamine's Garden found): #C87DB0 soft pink.
    // If Garden not found: Accord white persists.
  },
} as const;

// ── Story-driven palette modifiers ────────────────────────────────────────
// Applied as global tint deltas after regional palette. Not real-time.
export const STORY_PALETTE_EVENTS = [
  { trigger: 'kill_GrimdarTheForsaken', region: 'ASHFIELDS',  effect: 'primary shifts slightly warmer — 0x3D2B1F → 0x4A3020 — subtle' },
  { trigger: 'kill_TheOldGrove',        region: 'VERDENMERE', effect: 'canopy thins — more light shafts — accent more visible' },
  { trigger: 'kill_LumaMoth',           region: 'VERDENMERE', effect: 'night slightly brighter — one less light source' },
  { trigger: 'kill_SisterSilence',      region: 'ALL',        effect: 'all regions gain +20% warmth permanently' },
] as const;

// ── Lighting colours by context ───────────────────────────────────────────
export const LIGHT_COLORS = {
  torch:              0xFF6622, // orange point light, radius 80px, flickers ±5px/200ms
  bioluminescence:    0x00FFAA, // teal, slow pulse 3s cycle
  void_tear:          0x00FFB0, // green contamination — grows with tear size
  ghost:              0xC8D4E8, // ghost light, ambient radius 40px
  accord_ruin:        0xF5F0E8, // faint emission from Accord stone

  // Story moments
  edric_memory:       0xFFE8C0, // warm sepia — warmer than any gameplay light
  sister_silence_arena: 0xF5F0E8, // flat white — no shadow — fight in void
  remember_chamber:   0xC87DB0, // Thessamine's colour — only here
  boss_death_flash:   0xFFFFFF, // 2f full white then 60% desaturate
  perfect_parry:      0xFFD700, // gold flash 1f + point light burst r=60px

  // Weather modifiers (delta over ambient)
  rain_tint:          -0x0F0F0F, // -15% brightness, +10% blue
  fog_bright:         +0x1A1A1A, // +20% brightness, -30% contrast
} as const;

// ── True pixel-art resolution ──────────────────────────────────────────────
// Game renders at 320×180 internally; Phaser Scale.FIT scales 3× to 960×540.
// All coordinates, velocities, and sizes are in 320×180 space.
export const W      = 320;
export const H      = 180;
export const PX     = 3;   // kept for legacy BootScene helper
export const TILE_SIZE = 16;

// ── World ──────────────────────────────────────────────────────────────────
export const TOWN_W   = 1280;
export const GROUND_Y = 155;

// ── Palette ────────────────────────────────────────────────────────────────
// Max 24 colors — enforced.
export const COLOR = {
  BG:       0x040408, BG_S: '#040408',
  LUMINA:   0x4cc9f0, LUMINA_S: '#4cc9f0',
  DANGER:   0xe94560, DANGER_S: '#e94560',
  GOLD:     0xffd60a, GOLD_S: '#ffd60a',
  VOID:     0x7b2fff, VOID_S: '#7b2fff',
  NATURE:   0x06d6a0, NATURE_S: '#06d6a0',
  WHITE:    0xffffff,
  BLACK:    0x000000,
  PARRY:    0xffd60a,   // perfect parry ring
  PARRY_S:  '#ffd60a',
  AP_FULL:  0x4cc9f0,
  AP_EMPTY: 0x1a1a2e,
  HIT:      0xe94560,
  STAGGER:  0xff8800,
} as const;

// ── Physics — E33/Dead Cells feel ─────────────────────────────────────────
export const GRAVITY          = 2200;  // px/s² — snappy arcs
export const FAST_FALL_MULT   = 2.5;   // applied when jump released while rising
export const APEX_HANG_VY     = 60;    // |vy| threshold for apex detection
export const APEX_GRAV_MULT   = 0.6;   // gravity reduction at apex
export const APEX_HANG_FRAMES = 4;     // frames of reduced gravity at apex
export const JUMP_VEL         = -720;  // px/s — full arc < 0.6s
export const RUN_SPEED        = 130;   // px/s
export const WALK_SPEED       = 80;    // px/s (unused for now — run only)
export const ACCEL            = 1200;  // px/s² — 2-frame run startup feel
export const DECEL            = 1800;  // px/s² — faster than accel → tight skid
export const MAX_FALL_SPEED   = 900;   // px/s terminal velocity
export const COYOTE_FRAMES    = 8;     // frames (was 10 — snappier)
export const JUMP_BUFFER_FRAMES = 6;

// ── Walk animation ─────────────────────────────────────────────────────────
export const WALK_FRAME_MS = 100;      // faster than before (was 120ms)

// ── Timing (ms) ────────────────────────────────────────────────────────────
export const TYPEWRITER_MS = 22;

// ── Font sizes (in 320×180 game units) ────────────────────────────────────
// At 3× scale: 8px game = 24px screen (crisp, readable)
export const FONT = {
  XS:   '6px',
  SM:   '8px',
  MD:   '10px',
  LG:   '14px',
  XL:   '18px',
  TITLE:'28px',
} as const;

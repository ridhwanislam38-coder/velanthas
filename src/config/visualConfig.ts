// ── Visual Config — HD-2D Standard ──────────────────────────────────────────
// Renderer layer order, parallax ratios, palette rules, performance caps.
// All numbers here — never in scene files.

// ── Render layers (Phaser depth values) ──────────────────────────────────
export const DEPTH = {
  SKY:         0,      // layer 0 — furthest back
  BG_FAR:      10,     // layer 1 — distant background (slow parallax)
  BG_MID:      20,     // layer 2 — mid background (medium parallax)
  BG_PROPS:    30,     // layer 3 — background props (slight parallax)
  GAME:        100,    // layer 4 — player, enemies, tiles (y-sorted 100–149)
  GAME_MAX:    149,    // y-sort ceiling — nothing in GAME layer above this
  OCCLUDERS:   150,    // layer 4.5 — terrain/props that alpha-fade over player
  FG_NEAR:     200,    // layer 5 — foreground diorama pieces
  PARTICLES:   250,    // layer 6
  LIGHTING:    300,    // layer 7 — multiply blend over 0–250
  POSTFX:      350,    // layer 7.5 — bloom, DoF, motion blur, chromatic
  UI:          400,    // layer 8 — HUD, dialogue, journal (unaffected by lighting)
  CUTSCENE:    500,    // layer 9 — Remotion playback overlays
  LETTERBOX:   600,    // topmost — cinematic bars
} as const;

// ── Parallax scroll ratios ────────────────────────────────────────────────
// Amount the layer moves relative to camera movement (1.0 = moves with camera).
export const PARALLAX = {
  SKY:      0.05,  // almost stationary — infinite feel
  BG_FAR:   0.15,  // mountains / distant structures
  BG_MID:   0.35,  // trees, buildings
  BG_PROPS: 0.65,  // barrels, pillars, near foliage
  GAME:     1.00,  // world space — moves 1:1
  FG:       1.30,  // foreground — moves slightly faster than world
} as const;

// ── Performance caps ──────────────────────────────────────────────────────
export const PERF = {
  MAX_PARTICLES:       500,  // never exceed this pool size
  MAX_LIGHTS_PER_SCREEN: 12, // beyond this: cull furthest
  GILDSPIRE_MAX_LIGHTS:   8, // tighter cap for reflection-heavy interiors
  LIGHTING_TICK_FRAMES:   3, // recalculate light math every N frames
  SKY_REDRAW_ON_MOVE:  true, // only redraw sky on camera move or weather change
  FRAME_BUDGET_MS:     16,   // target — alert if exceeded
} as const;

// ── Pixel art enforcement ─────────────────────────────────────────────────
export const PIXEL = {
  SMOOTHING_ENABLED:  false, // ALWAYS false — non-negotiable
  ROUND_PIXELS:       true,
  PIXEL_ART_MODE:     true,
  // Character sizes in GAME pixels (displayed at ×3)
  PLAYER_W:           16,
  PLAYER_H:           24,
  ENEMY_W:            24,
  ENEMY_H:            32,
  TILE_W:             32,
  TILE_H:             32,
} as const;

// ── Foreground silhouette config ──────────────────────────────────────────
export const SILHOUETTE = {
  ALPHA:    0.65,  // 65% opacity — player visible through it
  TINT:     0x000000,
  DEPTH:    DEPTH.FG_NEAR,
} as const;

// ── Atmospheric perspective ───────────────────────────────────────────────
// Near = sharp + dark, far = soft + lighter.
// Applied as alpha/tint modifiers per parallax layer.
export const ATMOSPHERE = {
  FAR_BRIGHTNESS_MOD: 0.6,  // far layers are 40% brighter (haze)
  FAR_SATURATION_MOD: 0.7,  // far layers are 30% less saturated
  NEAR_CONTRAST_MOD:  1.1,  // near foreground slightly sharper
} as const;

// ── Idle animation rules ───────────────────────────────────────────────────
// Nothing is ever fully static in the world.
export const IDLE_ANIM = {
  BACKGROUND_BREATHE_HZ: 0.15,    // bg elements breathe (subtle scale)
  TORCH_FLICKER_HZ:      2.0,     // torch fire
  TORCH_AMPLITUDE:       0.12,    // ±12% size variation
  PARTICLE_DRIFT_MIN_MS: 3000,    // ambient particles always present
  SHADOW_SWAY_HZ:        0.3,     // tree shadows sway
} as const;

// ── Sky region transition ─────────────────────────────────────────────────
export const SKY = {
  CROSSFADE_MS:      3000,   // sky crossfade duration on region change
  CLOUD_SHAPES:      8,      // base cloud shape count (randomly composed)
  CLOUD_MIN_PX:      40,     // smallest cloud cluster
  CLOUD_MAX_PX:      300,    // largest formation
  INTERSTITIAL_CYCLE_S: 60,  // full cycle through all region palettes
  STAR_COUNT:        200,    // stars in night sky
  STAR_TWINKLE_HZ:   0.05,  // per-star random twinkle frequency
  MOON_W:            20,     // moon sprite width in game pixels
  MOON_H:            20,
} as const;

// ── Special attack cinematic ──────────────────────────────────────────────
export const CINEMATIC = {
  NAME_CARD_SLIDE_FRAMES:  6,
  NAME_CARD_HOLD_FRAMES:   40,
  NAME_CARD_FADE_FRAMES:   10,
  NAME_CARD_X:             4,    // bottom-left x
  NAME_CARD_Y_FROM_BOTTOM: 12,   // px from bottom of screen
  ZOOM_EASE:               'Power2',
  SHAKE_MAX_DEG:           2,    // camera rotation cap (>2 causes nausea)
  IMPACT_FRAME_HOLD:       3,    // white flash hold frames
} as const;

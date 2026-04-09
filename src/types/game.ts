// ── Core game state interfaces ─────────────────────────────────────────────

export interface PlayerData {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  atk: number;
  currency: number;          // lumens — earned from enemies, quests, destructibles
  combo: number;
  breakCount: number;
  totalDamage: number;
  maxCombo: number;
}

export interface GameState {
  player: PlayerData;
  saveId: string | null;
}

export type SceneKey =
  | 'BootScene'
  | 'TitleScene'
  | 'PrologueScene'
  | 'TownScene'
  | 'DungeonScene'
  | 'AshfieldsScene'
  | 'VerdenmereScene'
  | 'GreyveilScene'
  | 'GildspireScene'
  | 'VoidmarshScene'
  | 'UnnamedCityScene'
  | 'InterstitialScene';

// ── Asset keys — all texture/audio keys live here ────────────────────────
// NOTE: NO music keys. Velanthas is music-free — ambient soundscapes only.
export const enum AssetKey {
  // Sprites
  PLAYER        = 'hero',
  GUARD_ENEMY   = 'monster',
  NPC_BASE      = 'npc',

  // UI textures (generated in BootScene)
  HP_BAR_BG     = 'ui_hp_bg',
  HP_BAR_FILL   = 'ui_hp_fill',
  AP_ORB        = 'ui_ap_orb',

  // Particles
  PARTICLE_DUST = 'ptcl_dust',
  PARTICLE_SPARK= 'ptcl_spark',
  PARTICLE_LEAF = 'ptcl_leaf',
  PARTICLE_ASH  = 'ptcl_ash',
  PARTICLE_VOID = 'ptcl_void',
  PARTICLE_PETAL= 'ptcl_petal',

  // Audio SFX (Howler — sfx channel only)
  SFX_HIT_LIGHT   = 'sfx_hit_light',
  SFX_HIT_HEAVY   = 'sfx_hit_heavy',
  SFX_PARRY       = 'sfx_parry',
  SFX_DODGE       = 'sfx_dodge',
  SFX_DEATH       = 'sfx_death',
  SFX_BONFIRE     = 'sfx_bonfire',

  // Audio ambient beds (per-region wind/water/cave loops)
  AMB_ASHFIELDS   = 'amb_ashfields',
  AMB_VERDENMERE  = 'amb_verdenmere',
  AMB_GREYVEIL    = 'amb_greyveil',
  AMB_GILDSPIRE   = 'amb_gildspire',
  AMB_VOIDMARSH   = 'amb_voidmarsh',
  AMB_UNNAMED     = 'amb_unnamed_city',
}

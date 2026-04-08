// ── Core game state interfaces ─────────────────────────────────────────────

export interface PlayerData {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  atk: number;
  gold: number;
  combo: number;
  breakCount: number;
  subject: SubjectKey | null;
  items: ItemBag;
  buffs: BuffState;
  questionsAnswered: number;
  totalDamage: number;
  maxCombo: number;
}

export interface ItemBag {
  hints: number;
  shields: number;
  surges: number;
  elixirs: number;
}

export interface BuffState {
  atkMult: number;
  shieldActive: boolean;
  surgeActive: boolean;
}

export interface BattleState {
  subject: SubjectKey;
  floorIndex: number;
  questions: Question[];
  questionIndex: number;
  monsterHp: number;
  monsterMaxHp: number;
  combo: number;
  breakCount: number;
}

export interface Question {
  prompt: string;
  answers: string[];
  correctIndex: number;
  topic: string;
}

export interface GameState {
  player: PlayerData;
  battle: BattleState | null;
  apiKey: string;
  detectedTopic: string;
  customQuestions: Question[];
  saveId: string | null;
}

export type SubjectKey = 'math' | 'science' | 'history' | 'english' | 'custom';

export type SceneKey =
  | 'BootScene'
  | 'TitleScene'
  | 'PrologueScene'
  | 'TownScene'
  | 'DungeonScene'
  | 'BattleScene'
  | 'ResultScene';

// ── Asset keys — all texture/audio keys live here ────────────────────────
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

  // Audio SFX
  SFX_HIT_LIGHT   = 'sfx_hit_light',
  SFX_HIT_HEAVY   = 'sfx_hit_heavy',
  SFX_PARRY       = 'sfx_parry',
  SFX_DODGE       = 'sfx_dodge',
  SFX_DEATH       = 'sfx_death',
  SFX_BONFIRE     = 'sfx_bonfire',

  // Music
  MUS_ASHFIELDS   = 'mus_ashfields',
  MUS_VERDENMERE  = 'mus_verdenmere',
  MUS_GREYVEIL    = 'mus_greyveil',
  MUS_GILDSPIRE   = 'mus_gildspire',
  MUS_VOIDMARSH   = 'mus_voidmarsh',
  MUS_UNNAMED     = 'mus_unnamed_city',
  MUS_BOSS_1      = 'mus_boss_grimdar',
  MUS_BOSS_2      = 'mus_boss_luma',
  MUS_BOSS_3      = 'mus_boss_warden',
  MUS_BOSS_4      = 'mus_boss_sister',
}

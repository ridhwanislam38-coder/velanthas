// ── Event Bus ─────────────────────────────────────────────────────────────
// Single pub/sub hub for cross-system communication.
// Systems NEVER import each other directly — they emit and listen here.
//
// Usage:
//   import { Bus, GameEvent } from './EventBus';
//   Bus.emit(GameEvent.HIT_LIGHT, { target: sprite, damage: 10 });
//   Bus.on(GameEvent.HIT_LIGHT, (data) => { ... });

// ── All game events — const enum for zero-cost inlining ──────────────────
export const enum GameEvent {
  // Combat
  HIT_LIGHT             = 'hit_light',
  HIT_HEAVY             = 'hit_heavy',
  HIT_SPECIAL           = 'hit_special',
  HIT_FINISHER          = 'hit_finisher',
  PARRY_PERFECT         = 'parry_perfect',
  PARRY_NORMAL          = 'parry_normal',
  PARRY_MISS            = 'parry_miss',
  DODGE_PERFECT         = 'dodge_perfect',
  DODGE_NORMAL          = 'dodge_normal',
  BLOCK_HIT             = 'block_hit',
  COMBO_ADVANCE         = 'combo_advance',
  COMBO_RESET           = 'combo_reset',

  // Player
  PLAYER_DEATH          = 'player_death',
  PLAYER_SPAWN          = 'player_spawn',
  PLAYER_LAND           = 'player_land',
  PLAYER_JUMP           = 'player_jump',
  PLAYER_DASH           = 'player_dash',
  AP_CHANGED            = 'ap_changed',
  AP_FULL               = 'ap_full',
  HP_CHANGED            = 'hp_changed',
  HP_CRITICAL           = 'hp_critical', // < 20%

  // Enemies
  ENEMY_DEATH           = 'enemy_death',
  ENEMY_STAGGER         = 'enemy_stagger',
  ENEMY_TELEGRAPH_LIGHT = 'enemy_telegraph_light',
  ENEMY_TELEGRAPH_HEAVY = 'enemy_telegraph_heavy',
  ENEMY_TELEGRAPH_UNB   = 'enemy_telegraph_unblockable',
  ENEMY_DETECT_YELLOW   = 'enemy_detect_yellow',
  ENEMY_DETECT_ORANGE   = 'enemy_detect_orange',
  ENEMY_DETECT_RED      = 'enemy_detect_red',
  ENEMY_LOST_SIGHT      = 'enemy_lost_sight',

  // Boss
  BOSS_PHASE_CHANGE     = 'boss_phase_change',
  BOSS_PHASE_MUSIC      = 'boss_phase_music',
  BOSS_KILLED           = 'boss_killed',
  BOSS_DEATH_COUNT      = 'boss_death_count',

  // Special attacks
  SPECIAL_START         = 'special_start',
  SPECIAL_IMPACT        = 'special_impact',
  SPECIAL_END           = 'special_end',

  // Faction
  FACTION_REP_CHANGED   = 'faction_rep_changed',
  FACTION_STATUS_CHANGED = 'faction_status_changed',
  BOUNTY_HUNTER_SPAWN   = 'bounty_hunter_spawn',

  // World
  TIME_OF_DAY_CHANGE    = 'time_of_day_change',
  SEASON_CHANGE         = 'season_change',
  WEATHER_CHANGED       = 'weather_changed',
  WEATHER_THUNDER       = 'weather_thunder',
  ELEVATION_CHANGE      = 'elevation_change',
  REGION_ENTER          = 'region_enter',
  REGION_EXIT           = 'region_exit',

  // Story / Cutscenes
  CUTSCENE_START        = 'cutscene_start',
  CUTSCENE_END          = 'cutscene_end',
  CUTSCENE_MUSIC        = 'cutscene_music',
  DIALOGUE_START        = 'dialogue_start',
  DIALOGUE_END          = 'dialogue_end',
  LORE_FRAGMENT         = 'lore_fragment',
  QUEST_STAGE           = 'quest_stage',
  ENDING_TRIGGER        = 'ending_trigger',

  // Lighting
  LIGHT_ADD             = 'light_add',
  LIGHT_REMOVE          = 'light_remove',
  TORCH_EXTINGUISH      = 'torch_extinguish',

  // Sky / Atmosphere
  SKY_CHANGE_REGION     = 'sky_change_region',
  SKY_VOIDBLOOM_HEAL    = 'sky_voidbloom_heal',
  SKY_UNNAMED_REVEAL    = 'sky_unnamed_reveal',

  // Scene
  BONFIRE_REST          = 'bonfire_rest',
  GAME_PAUSE            = 'game_pause',
  GAME_RESUME           = 'game_resume',

  // Currency & Loot
  CURRENCY_GAIN         = 'currency_gain',
  CURRENCY_SPEND        = 'currency_spend',
  ENEMY_KILLED          = 'enemy_killed',
  DESTRUCT_BREAK        = 'destruct_break',

  // Journal
  QUEST_ADVANCE         = 'quest_advance',
  LORE_FOUND            = 'lore_found',
  CHOICE_MADE           = 'choice_made',
  JOURNAL_OPEN          = 'journal_open',
  JOURNAL_CLOSE         = 'journal_close',

  // Visual
  REVELATION_REFLECTION_START    = 'revelation_reflection_start',
  REVELATION_REFLECTION_COMPLETE = 'revelation_reflection_complete',
}

type EventHandler<T = unknown> = (data: T) => void;

class EventBus {
  private _handlers: Map<string, Set<EventHandler<unknown>>> = new Map();

  on<T = unknown>(event: GameEvent, handler: EventHandler<T>): void {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event)!.add(handler as EventHandler<unknown>);
  }

  once<T = unknown>(event: GameEvent, handler: EventHandler<T>): void {
    const wrapper: EventHandler<unknown> = (data) => {
      handler(data as T);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  off<T = unknown>(event: GameEvent, handler: EventHandler<T>): void {
    this._handlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  emit<T = unknown>(event: GameEvent, data?: T): void {
    const handlers = this._handlers.get(event);
    if (!handlers) return;
    for (const fn of handlers) fn(data as unknown);
  }

  /** Remove all listeners for an event — use when scene shuts down. */
  clear(event: GameEvent): void {
    this._handlers.delete(event);
  }

  /** Remove ALL listeners — call only on full game restart. */
  clearAll(): void {
    this._handlers.clear();
  }
}

/** Singleton — import this everywhere, never construct a new EventBus. */
export const Bus = new EventBus();

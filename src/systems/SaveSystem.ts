import type { PlayerData } from '../types/game';
import { saveProgress, loadProgress, postLeaderboardScore } from '../supabase/queries';
import { supabaseConfigured } from '../config/env';
import { Bus, GameEvent } from './EventBus';

// ── Save System ────────────────────────────────────────────────────────────
// Orchestrates persistence:
//   1. Supabase (if configured + user is authed)
//   2. localStorage fallback (always available)
//
// Auto-saves on:
//   - BONFIRE_REST event
//   - Boss kill (BOSS_KILLED)
//   - Region transition (REGION_ENTER)
//
// Usage (scene create):
//   Save.init(player);
//   const saveData = await Save.load();

const LS_SAVE_KEY    = 'velanthas_save';
const LS_SAVE_ID_KEY = 'velanthas_save_id';

export class SaveSystem {
  private _saveId:  string | null = null;
  private _player:  PlayerData | null = null;
  private _bossKills   = 0;
  private _timeStartMs = Date.now();

  // ── Init — call once at scene start ───────────────────────────────────
  init(player: PlayerData): void {
    this._player     = player;
    this._saveId     = localStorage.getItem(LS_SAVE_ID_KEY);
    this._timeStartMs = Date.now();
    this._wireEvents();
  }

  // ── Load — call once after init ───────────────────────────────────────
  async load(): Promise<PlayerData | null> {
    // Try Supabase if configured and saveId exists
    if (supabaseConfigured && this._saveId) {
      const row = await loadProgress(this._saveId);
      if (row) {
        return this._rowToPlayerData(row as unknown as Record<string, unknown>);
      }
    }

    // localStorage fallback
    const raw = localStorage.getItem(LS_SAVE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as PlayerData;
    } catch {
      console.warn('[SaveSystem] localStorage parse failed — returning null');
      return null;
    }
  }

  // ── Save — manual or event-driven ────────────────────────────────────
  async save(): Promise<void> {
    if (!this._player) return;

    // Always persist to localStorage first (instant, no network)
    localStorage.setItem(LS_SAVE_KEY, JSON.stringify(this._player));

    // Supabase if configured
    if (supabaseConfigured) {
      const id = await saveProgress(this._player, this._saveId);
      if (id && id !== this._saveId) {
        this._saveId = id;
        localStorage.setItem(LS_SAVE_ID_KEY, id);
      }
    }
  }

  // ── Post score to leaderboard ─────────────────────────────────────────
  async postScore(): Promise<void> {
    if (!this._player) return;

    const timePlayedS = Math.floor((Date.now() - this._timeStartMs) / 1000);
    await postLeaderboardScore(this._player, {
      bossKills:  this._bossKills,
      timePlayedS,
    });
  }

  // ── Accessors ─────────────────────────────────────────────────────────
  get hasSave(): boolean {
    return !!localStorage.getItem(LS_SAVE_KEY) || !!this._saveId;
  }

  // ── Event wiring ──────────────────────────────────────────────────────
  private _wireEvents(): void {
    Bus.on(GameEvent.BONFIRE_REST, () => {
      void this.save();
    });

    Bus.on(GameEvent.BOSS_KILLED, () => {
      this._bossKills++;
      void this.save();
    });

    Bus.on(GameEvent.REGION_ENTER, () => {
      void this.save();
    });
  }

  // ── Row → PlayerData ──────────────────────────────────────────────────
  private _rowToPlayerData(row: Record<string, unknown>): PlayerData {
    // Map Supabase row fields back to PlayerData shape
    // Only fields we save — rest use defaults from the PlayerData initializer
    const base = this._player ?? this._defaultPlayerData();
    return {
      ...base,
      hp:    typeof row['hp']     === 'number' ? row['hp']     : base.hp,
      maxHp: typeof row['max_hp'] === 'number' ? row['max_hp'] : base.maxHp,
    };
  }

  private _defaultPlayerData(): PlayerData {
    return {
      name:        'Wanderer',
      level:       1,
      xp:          0,
      xpToNext:    120,
      hp:          100,
      maxHp:       100,
      atk:         10,
      currency:    0,
      combo:       0,
      breakCount:  0,
      totalDamage: 0,
      maxCombo:    0,
    };
  }
}

/** Scene-level singleton — one Save per session. */
export const Save = new SaveSystem();

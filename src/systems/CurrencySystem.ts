import { Bus, GameEvent } from './EventBus';

// ── CurrencySystem ──────────────────────────────────────────────────────────
// Single currency: lumens. Earned from enemies, quests, destructibles.
// Spent at merchant NPCs. Persisted via SaveSystem.
//
// All mutations emit events so UI + save can react.

export class CurrencySystem {
  private _lumens = 0;

  constructor(initial = 0) {
    this._lumens = initial;
    this._wireEvents();
  }

  // ── Query ─────────────────────────────────────────────────────────────
  get lumens(): number { return this._lumens; }

  canAfford(cost: number): boolean { return this._lumens >= cost; }

  // ── Mutations ─────────────────────────────────────────────────────────

  /** Add lumens (enemy drop, quest reward, destructible loot). */
  earn(amount: number, source: string): void {
    if (amount <= 0) return;
    this._lumens += amount;
    Bus.emit(GameEvent.CURRENCY_GAIN, { amount, source, total: this._lumens });
  }

  /** Spend lumens (merchant purchase). Returns false if insufficient. */
  spend(cost: number, item: string): boolean {
    if (!this.canAfford(cost)) return false;
    this._lumens -= cost;
    Bus.emit(GameEvent.CURRENCY_SPEND, { cost, item, total: this._lumens });
    return true;
  }

  /** Set balance directly (from save load). */
  restore(amount: number): void {
    this._lumens = Math.max(0, amount);
  }

  // ── Event wiring ──────────────────────────────────────────────────────
  private _wireEvents(): void {
    // Enemy killed → roll loot table
    Bus.on(GameEvent.ENEMY_KILLED, (data: unknown) => {
      const d = data as { enemyId?: string; lootLumens?: number };
      if (d.lootLumens && d.lootLumens > 0) {
        this.earn(d.lootLumens, d.enemyId ?? 'enemy');
      }
    });

    // Destructible broken → small loot
    Bus.on(GameEvent.DESTRUCT_BREAK, (data: unknown) => {
      const d = data as { lumens?: number };
      if (d.lumens && d.lumens > 0) {
        this.earn(d.lumens, 'destructible');
      }
    });
  }
}

// ── Loot tables ─────────────────────────────────────────────────────────────
// Maps enemy/destructible IDs to lumen drop ranges. Roll on kill.

export interface LootEntry {
  minLumens: number;
  maxLumens: number;
  /** Optional: item drops (equipment key) with probability 0–1 */
  items?: Array<{ key: string; chance: number }>;
}

export const ENEMY_LOOT: Record<string, LootEntry> = {
  // Ironveil
  ironveil_footsoldier:  { minLumens: 5,  maxLumens: 12 },
  ironveil_archer:       { minLumens: 6,  maxLumens: 14 },
  ironveil_shieldwall:   { minLumens: 8,  maxLumens: 18 },
  ironveil_berserker:    { minLumens: 10, maxLumens: 22 },
  ironveil_inquisitor:   { minLumens: 12, maxLumens: 28 },
  ironveil_warbeast:     { minLumens: 15, maxLumens: 35 },

  // The Wild
  moss_walker:           { minLumens: 4,  maxLumens: 10 },
  spore_witch:           { minLumens: 8,  maxLumens: 18, items: [{ key: 'spore_vial', chance: 0.15 }] },
  briar_hound:           { minLumens: 5,  maxLumens: 12 },
  songbird_archer:       { minLumens: 7,  maxLumens: 16 },

  // Voidborn
  void_shard:            { minLumens: 6,  maxLumens: 15 },
  echo_self:             { minLumens: 10, maxLumens: 25 },
  void_mother:           { minLumens: 20, maxLumens: 45 },
  null_knight:           { minLumens: 15, maxLumens: 35 },

  // Gilded
  gilded_merchant:       { minLumens: 20, maxLumens: 50 },
  gilded_enforcer:       { minLumens: 12, maxLumens: 30 },
  gilded_sniper:         { minLumens: 10, maxLumens: 25 },
  gilded_golem:          { minLumens: 25, maxLumens: 60 },

  // Forgotten
  forsaken_soldier:      { minLumens: 3,  maxLumens: 8 },
  wailing_wraith:        { minLumens: 5,  maxLumens: 12 },
  bone_colossus:         { minLumens: 18, maxLumens: 40 },
  revenant:              { minLumens: 12, maxLumens: 28 },

  // Silent Ones
  silent_watcher:        { minLumens: 8,  maxLumens: 20 },
  silent_chaser:         { minLumens: 6,  maxLumens: 15 },
  silent_mirror:         { minLumens: 10, maxLumens: 25 },

  // Neutral
  mirror_knight:         { minLumens: 10, maxLumens: 22 },
  bramble_enemy:         { minLumens: 5,  maxLumens: 12 },
  wraith_enemy:          { minLumens: 8,  maxLumens: 18 },

  // Mini-bosses
  thorn_queen_mini:      { minLumens: 50,  maxLumens: 100 },
  the_sleepwalker:       { minLumens: 60,  maxLumens: 120 },

  // Bosses
  grimdar_the_forsaken:  { minLumens: 200, maxLumens: 350 },
  luma_moth:             { minLumens: 250, maxLumens: 400 },
  the_warden:            { minLumens: 300, maxLumens: 500 },
  sister_silence:        { minLumens: 400, maxLumens: 600 },
};

export const DESTRUCTIBLE_LOOT: Record<string, LootEntry> = {
  rock_small:   { minLumens: 1, maxLumens: 3 },
  rock_large:   { minLumens: 2, maxLumens: 6 },
  crate:        { minLumens: 3, maxLumens: 8, items: [{ key: 'herb', chance: 0.25 }] },
  barrel:       { minLumens: 2, maxLumens: 5 },
  ice_sheet:    { minLumens: 4, maxLumens: 10 },
  weak_wall:    { minLumens: 5, maxLumens: 15, items: [{ key: 'lore_fragment', chance: 0.30 }] },
};

/** Roll a loot table entry. Returns lumen amount + any item drops. */
export function rollLoot(entry: LootEntry): { lumens: number; items: string[] } {
  const lumens = entry.minLumens + Math.floor(Math.random() * (entry.maxLumens - entry.minLumens + 1));
  const items: string[] = [];

  if (entry.items) {
    for (const item of entry.items) {
      if (Math.random() < item.chance) {
        items.push(item.key);
      }
    }
  }

  return { lumens, items };
}

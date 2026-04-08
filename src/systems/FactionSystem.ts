import type { FactionId } from '../config/enemyConfig';
import { REP_KILL_COST, FACTION_EFFECTS } from '../config/factionConfig';

// ── Faction System ─────────────────────────────────────────────────────────
// Global reputation tracker. Persists to localStorage.
// Every kill and dialogue choice flows through here.

export type FactionEvent =
  | { type: 'kill';     faction: FactionId }
  | { type: 'dialogue'; faction: FactionId; delta: number }
  | { type: 'quest';    faction: FactionId; delta: number };

export class FactionSystem {
  private _rep: Map<FactionId, number> = new Map();
  private _listeners: Array<(faction: FactionId, rep: number) => void> = [];

  constructor() {
    this._initDefaults();
    this._load();
  }

  private _initDefaults(): void {
    const factions: FactionId[] = [
      'IRONVEIL', 'THEWILD', 'VOIDBORN',
      'GILDED', 'FORGOTTEN', 'SILENTONES', 'NEUTRAL',
    ];
    for (const f of factions) this._rep.set(f, 0);
  }

  // ── Core API ──────────────────────────────────────────────────────────

  processEvent(event: FactionEvent): void {
    const delta = event.type === 'kill'
      ? REP_KILL_COST[event.faction]
      : event.delta;

    const prev = this._rep.get(event.faction) ?? 0;
    const next  = Math.max(-100, Math.min(100, prev + delta));
    this._rep.set(event.faction, next);
    this._save();
    this._notify(event.faction, next);
  }

  getRep(faction: FactionId): number {
    return this._rep.get(faction) ?? 0;
  }

  getStatus(faction: FactionId): 'ally' | 'neutral' | 'hostile' | 'enemy' {
    const rep = this.getRep(faction);
    if (rep >= FACTION_EFFECTS.DISCOUNT_THRESHOLD) return 'ally';
    if (rep >= FACTION_EFFECTS.HOSTILE_THRESHOLD)  return 'neutral';
    if (rep >= FACTION_EFFECTS.BOUNTY_THRESHOLD)   return 'hostile';
    return 'enemy';
  }

  hasDiscount(faction: FactionId): boolean {
    return this.getRep(faction) >= FACTION_EFFECTS.DISCOUNT_THRESHOLD;
  }

  shouldSpawnBountyHunter(faction: FactionId): boolean {
    return this.getRep(faction) <= FACTION_EFFECTS.BOUNTY_THRESHOLD;
  }

  getShopMultiplier(faction: FactionId): number {
    const rep = this.getRep(faction);
    if (rep >= FACTION_EFFECTS.DISCOUNT_THRESHOLD) return 0.80; // 20% off
    if (rep >= FACTION_EFFECTS.SECRET_THRESHOLD)   return 0.90; // 10% off
    if (rep <= FACTION_EFFECTS.HOSTILE_THRESHOLD)  return 1.20; // 20% markup
    return 1.0;
  }

  // Whether faction NPCs will speak to player
  willNPCSpeak(faction: FactionId): boolean {
    return this.getStatus(faction) !== 'enemy';
  }

  // Whether faction guards are aggressive
  areGuardsHostile(faction: FactionId): boolean {
    const status = this.getStatus(faction);
    return status === 'hostile' || status === 'enemy';
  }

  onChange(fn: (faction: FactionId, rep: number) => void): void {
    this._listeners.push(fn);
  }

  reset(): void {
    this._initDefaults();
    localStorage.removeItem('sq_factions');
  }

  // ── Persistence ───────────────────────────────────────────────────────
  private _save(): void {
    const obj: Record<string, number> = {};
    this._rep.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem('sq_factions', JSON.stringify(obj));
  }

  private _load(): void {
    const raw = localStorage.getItem('sq_factions');
    if (!raw) return;
    try {
      const obj = JSON.parse(raw) as Record<string, number>;
      Object.entries(obj).forEach(([k, v]) => {
        this._rep.set(k as FactionId, v);
      });
    } catch { /* corrupt — use defaults */ }
  }

  private _notify(faction: FactionId, rep: number): void {
    for (const fn of this._listeners) fn(faction, rep);
  }
}

// Singleton — shared across all scenes
export const Factions = new FactionSystem();

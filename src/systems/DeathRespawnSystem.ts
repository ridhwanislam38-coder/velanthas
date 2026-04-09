import { Bus, GameEvent } from './EventBus';

// ── DeathRespawnSystem ──────────────────────────────────────────────────────
// Handles player death → respawn flow:
//   1. PLAYER_DEATH event fires
//   2. "YOU DIED" overlay fades in (2s)
//   3. Currency penalty: lose 10% of lumens (dropped at death spot as recoverable)
//   4. Respawn at last bonfire with full HP
//   5. All enemies in the region reset
//
// Tracks death count per boss for hint system escalation.

export interface DeathSpot {
  region: string;
  x: number;
  y: number;
  lumensDropped: number;
  recovered: boolean;
}

export interface RespawnPoint {
  region: string;
  sceneKey: string;
  x: number;
  y: number;
}

const CURRENCY_PENALTY_PCT = 0.10; // lose 10% of lumens on death

export class DeathRespawnSystem {
  private _lastBonfire: RespawnPoint | null = null;
  private _deathSpot:   DeathSpot | null = null;
  private _bossDeaths   = new Map<string, number>();
  private _totalDeaths  = 0;

  constructor() {
    this._wireEvents();
  }

  // ── Queries ───────────────────────────────────────────────────────────
  get lastBonfire(): RespawnPoint | null { return this._lastBonfire; }
  get deathSpot(): DeathSpot | null { return this._deathSpot; }
  get totalDeaths(): number { return this._totalDeaths; }

  getBossDeaths(bossId: string): number {
    return this._bossDeaths.get(bossId) ?? 0;
  }

  /** Hint level: 0 = no hints, 1 = subtle, 2 = moderate, 3 = explicit. */
  getHintLevel(bossId: string): number {
    const deaths = this.getBossDeaths(bossId);
    if (deaths >= 8) return 3;
    if (deaths >= 5) return 2;
    if (deaths >= 3) return 1;
    return 0;
  }

  // ── Mutations ─────────────────────────────────────────────────────────

  /** Called when player rests at a bonfire. */
  setBonfire(point: RespawnPoint): void {
    this._lastBonfire = { ...point };
  }

  /** Called when player dies to a boss specifically. */
  recordBossDeath(bossId: string): void {
    const prev = this._bossDeaths.get(bossId) ?? 0;
    this._bossDeaths.set(bossId, prev + 1);
    Bus.emit(GameEvent.BOSS_DEATH_COUNT, {
      bossId,
      count: prev + 1,
      hintLevel: this.getHintLevel(bossId),
    });
  }

  /** Try to recover lumens from death spot. Returns amount recovered or 0. */
  recoverLumens(playerX: number, playerY: number, threshold = 30): number {
    if (!this._deathSpot || this._deathSpot.recovered) return 0;

    const dx = playerX - this._deathSpot.x;
    const dy = playerY - this._deathSpot.y;
    if (Math.sqrt(dx * dx + dy * dy) > threshold) return 0;

    this._deathSpot.recovered = true;
    const amount = this._deathSpot.lumensDropped;
    Bus.emit(GameEvent.CURRENCY_GAIN, { amount, source: 'death_recovery', total: 0 });
    return amount;
  }

  // ── Serialisation ─────────────────────────────────────────────────────
  serialise(): {
    lastBonfire: RespawnPoint | null;
    deathSpot: DeathSpot | null;
    bossDeaths: Record<string, number>;
    totalDeaths: number;
  } {
    const bossDeaths: Record<string, number> = {};
    for (const [k, v] of this._bossDeaths) bossDeaths[k] = v;
    return {
      lastBonfire: this._lastBonfire,
      deathSpot: this._deathSpot,
      bossDeaths,
      totalDeaths: this._totalDeaths,
    };
  }

  deserialise(data: {
    lastBonfire: RespawnPoint | null;
    deathSpot: DeathSpot | null;
    bossDeaths: Record<string, number>;
    totalDeaths: number;
  }): void {
    this._lastBonfire = data.lastBonfire;
    this._deathSpot = data.deathSpot;
    this._totalDeaths = data.totalDeaths;
    this._bossDeaths.clear();
    for (const [k, v] of Object.entries(data.bossDeaths)) {
      this._bossDeaths.set(k, v);
    }
  }

  // ── Event wiring ──────────────────────────────────────────────────────
  private _wireEvents(): void {
    Bus.on(GameEvent.PLAYER_DEATH, (data: unknown) => {
      this._totalDeaths++;
      const d = data as { region?: string; x?: number; y?: number; lumens?: number; bossId?: string };

      // Drop lumens at death spot
      if (d.region && d.x !== undefined && d.y !== undefined && d.lumens !== undefined) {
        const dropped = Math.floor(d.lumens * CURRENCY_PENALTY_PCT);
        this._deathSpot = {
          region: d.region,
          x: d.x,
          y: d.y,
          lumensDropped: dropped,
          recovered: false,
        };
      }

      // Boss-specific death tracking
      if (d.bossId) {
        this.recordBossDeath(d.bossId);
      }
    });

    Bus.on(GameEvent.BONFIRE_REST, (data: unknown) => {
      const d = data as { region?: string; sceneKey?: string; x?: number; y?: number };
      if (d.region && d.sceneKey && d.x !== undefined && d.y !== undefined) {
        this.setBonfire({ region: d.region, sceneKey: d.sceneKey, x: d.x, y: d.y });
      }
    });
  }
}

export const Deaths = new DeathRespawnSystem();

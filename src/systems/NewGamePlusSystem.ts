import { Bus, GameEvent } from './EventBus';
import { Journal } from './JournalSystem';

// ── NG+ System ──────────────────────────────────────────────────────────────
// Tracks completion state and unlocks NG+ content:
//   - First clear: new difficulty + enemy remixes (stat multipliers)
//   - Find all lore: new area accessible (Interstitial expanded)
//   - Find all secrets: new NPC appears, comments on all of them
//
// NG+ carries over: equipment, currency, customization, portal discoveries
// NG+ resets: quest progress, lore discovery state, boss kills, region state

export type NGPlusTier = 0 | 1 | 2 | 3; // 0 = first playthrough

export interface NGPlusState {
  tier:          NGPlusTier;
  cleared:       boolean;    // beat final boss at least once
  allLoreFound:  boolean;
  allSecretsFound: boolean;
  enemyStatMult: number;     // 1.0 base, increases per tier
  newNPCUnlocked: boolean;   // "The Collector" NPC who comments on secrets
}

const STAT_MULTIPLIERS: Record<NGPlusTier, number> = {
  0: 1.0,
  1: 1.5,  // NG+1: enemies 50% stronger
  2: 2.0,  // NG+2: enemies 2x
  3: 3.0,  // NG+3: enemies 3x (for challenge seekers)
};

export class NewGamePlusSystem {
  private _state: NGPlusState = {
    tier: 0,
    cleared: false,
    allLoreFound: false,
    allSecretsFound: false,
    enemyStatMult: 1.0,
    newNPCUnlocked: false,
  };

  constructor() {
    this._wireEvents();
  }

  // ── Queries ───────────────────────────────────────────────────────────
  get tier(): NGPlusTier { return this._state.tier; }
  get enemyStatMult(): number { return this._state.enemyStatMult; }
  get isNGPlus(): boolean { return this._state.tier > 0; }
  get collectorUnlocked(): boolean { return this._state.newNPCUnlocked; }

  // ── Start NG+ ─────────────────────────────────────────────────────────
  /** Called after credits roll. Advances NG+ tier and resets world state. */
  startNewGamePlus(): void {
    const nextTier = Math.min(3, this._state.tier + 1) as NGPlusTier;
    this._state.tier = nextTier;
    this._state.enemyStatMult = STAT_MULTIPLIERS[nextTier];

    // Check lore/secret completion
    const loreCount = Journal.getLoreCount();
    this._state.allLoreFound = loreCount.found >= loreCount.total;

    const secrets = Journal.getFoundLore().filter(l => l.id.startsWith('lore_secret_'));
    this._state.allSecretsFound = secrets.length >= 10;
    this._state.newNPCUnlocked = this._state.allSecretsFound;
  }

  // ── Enemy stat scaling ────────────────────────────────────────────────
  /** Apply NG+ multiplier to an enemy's base stats. */
  scaleEnemyHp(baseHp: number): number {
    return Math.floor(baseHp * this._state.enemyStatMult);
  }

  scaleEnemyDamage(baseDmg: number): number {
    return Math.floor(baseDmg * this._state.enemyStatMult);
  }

  // ── Serialisation ─────────────────────────────────────────────────────
  serialise(): NGPlusState {
    return { ...this._state };
  }

  deserialise(data: NGPlusState): void {
    Object.assign(this._state, data);
  }

  // ── Event wiring ──────────────────────────────────────────────────────
  private _wireEvents(): void {
    Bus.on(GameEvent.ENDING_TRIGGER, () => {
      this._state.cleared = true;
    });
  }
}

export const NGPlus = new NewGamePlusSystem();

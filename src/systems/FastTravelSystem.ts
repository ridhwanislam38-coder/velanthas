import { Bus, GameEvent } from './EventBus';

// ── FastTravelSystem ────────────────────────────────────────────────────────
// Discovered portal nodes on the world map. Player must physically reach
// a portal to discover it. Thereafter they can fast-travel between any
// discovered portals from the map/journal UI.
//
// Visual: class-specific "void-cut" effect:
//   - Warrior: slashes reality open with blade
//   - Mage: opens a rift with arcane gesture
//   - Rogue: slips into shadow, reappears at destination
//   - Hybrid: partial effects depending on dominant class
//
// The visual is triggered via EventBus and consumed by the CinematicSystem
// (or a lightweight portal-FX handler in the scene).

export interface PortalNode {
  id:        string;
  name:      string;
  region:    string;
  x:         number;
  y:         number;
  discovered:boolean;
}

// ── Known portals (static list — discovered flag per save) ──────────────
const ALL_PORTALS: Omit<PortalNode, 'discovered'>[] = [
  { id: 'ashfields_hub',     name: 'Ashfields Bonfire',    region: 'ASHFIELDS',      x: 320, y: 240 },
  { id: 'ashfields_east',    name: 'Ashfields East Gate',  region: 'ASHFIELDS',      x: 600, y: 200 },
  { id: 'verdenmere_grove',  name: 'Verdenmere Grove',     region: 'VERDENMERE',     x: 180, y: 300 },
  { id: 'verdenmere_falls',  name: 'Verdenmere Falls',     region: 'VERDENMERE',     x: 500, y: 400 },
  { id: 'greyveil_gate',     name: 'Greyveil Gate',        region: 'GREYVEIL',       x: 320, y: 100 },
  { id: 'greyveil_crypt',    name: 'Greyveil Crypt',       region: 'GREYVEIL',       x: 200, y: 380 },
  { id: 'gildspire_market',  name: 'Gildspire Market',     region: 'GILDSPIRE',      x: 400, y: 250 },
  { id: 'gildspire_tower',   name: 'Gildspire Tower',      region: 'GILDSPIRE',      x: 550, y: 150 },
  { id: 'voidmarsh_edge',    name: 'Voidmarsh Edge',       region: 'VOIDMARSH',      x: 100, y: 350 },
  { id: 'voidmarsh_heart',   name: 'Voidmarsh Heart',      region: 'VOIDMARSH',      x: 400, y: 400 },
  { id: 'unnamed_entrance',  name: 'Unnamed City Gate',    region: 'UNNAMED_CITY',   x: 320, y: 200 },
  { id: 'interstitial_rift', name: 'The Interstitial',     region: 'INTERSTITIAL',   x: 250, y: 250 },
];

export type TravelClass = 'warrior' | 'mage' | 'rogue' | 'hybrid';

export class FastTravelSystem {
  private _portals: PortalNode[] = ALL_PORTALS.map(p => ({ ...p, discovered: false }));

  // ── Queries ───────────────────────────────────────────────────────────
  getDiscovered(): PortalNode[] {
    return this._portals.filter(p => p.discovered);
  }

  getAll(): readonly PortalNode[] {
    return this._portals;
  }

  isDiscovered(id: string): boolean {
    return this._portals.find(p => p.id === id)?.discovered ?? false;
  }

  // ── Discovery ─────────────────────────────────────────────────────────
  /** Mark a portal as discovered (player physically reached it). */
  discover(id: string): void {
    const portal = this._portals.find(p => p.id === id);
    if (portal && !portal.discovered) {
      portal.discovered = true;
      Bus.emit(GameEvent.LORE_FOUND, { loreId: `portal_${id}` });
    }
  }

  // ── Travel ────────────────────────────────────────────────────────────
  /** Initiate travel from current portal to destination. Returns destination or null. */
  travel(fromId: string, toId: string, playerClass: TravelClass): PortalNode | null {
    const from = this._portals.find(p => p.id === fromId);
    const to   = this._portals.find(p => p.id === toId);

    if (!from?.discovered || !to?.discovered) return null;
    if (fromId === toId) return null;

    // Emit travel event — scene/cinematic system handles the visual
    Bus.emit(GameEvent.REGION_EXIT, { region: from.region });
    Bus.emit(GameEvent.CUTSCENE_START, {
      type: 'fast_travel',
      class: playerClass,
      from: fromId,
      to: toId,
    });

    return to;
  }

  // ── Serialisation ─────────────────────────────────────────────────────
  serialise(): string[] {
    return this._portals.filter(p => p.discovered).map(p => p.id);
  }

  deserialise(discoveredIds: string[]): void {
    const idSet = new Set(discoveredIds);
    for (const portal of this._portals) {
      portal.discovered = idSet.has(portal.id);
    }
  }
}

export const FastTravel = new FastTravelSystem();

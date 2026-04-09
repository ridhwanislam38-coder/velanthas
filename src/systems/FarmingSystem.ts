import { Bus, GameEvent } from './EventBus';

// ── FarmingSystem ───────────────────────────────────────────────────────────
// Material harvest nodes scattered across regions. Respawn on bonfire rest.
// Crafting table stub for future recipe implementation.
//
// Materials: herbs, ore, wood, crystals, void essence
// Each node has a type, a yield range, and a respawn condition.

export interface MaterialNode {
  id:          string;
  type:        MaterialType;
  region:      string;
  x:           number;
  y:           number;
  harvested:   boolean;
  yieldMin:    number;
  yieldMax:    number;
}

export type MaterialType = 'herb' | 'ore' | 'wood' | 'crystal' | 'void_essence';

export interface InventoryEntry {
  type: MaterialType;
  quantity: number;
}

// ── Crafting recipe stub (future expansion) ─────────────────────────────
export interface CraftingRecipe {
  id:          string;
  name:        string;
  description: string;
  inputs:      Array<{ type: MaterialType; quantity: number }>;
  outputItem:  string; // equipment/consumable key
}

// ── Known recipes (expand as content grows) ─────────────────────────────
export const RECIPES: CraftingRecipe[] = [
  {
    id: 'health_poultice',
    name: 'Health Poultice',
    description: 'Restores 30 HP',
    inputs: [{ type: 'herb', quantity: 3 }],
    outputItem: 'consumable_health_poultice',
  },
  {
    id: 'smoke_bomb',
    name: 'Smoke Bomb',
    description: 'Breaks enemy aggro for 3 seconds',
    inputs: [{ type: 'herb', quantity: 1 }, { type: 'ore', quantity: 2 }],
    outputItem: 'consumable_smoke_bomb',
  },
  {
    id: 'void_lantern',
    name: 'Void Lantern',
    description: 'Illuminates dark areas, reveals hidden paths',
    inputs: [{ type: 'crystal', quantity: 2 }, { type: 'void_essence', quantity: 1 }],
    outputItem: 'tool_void_lantern',
  },
];

export class FarmingSystem {
  private _nodes:     MaterialNode[] = [];
  private _inventory  = new Map<MaterialType, number>();

  constructor() {
    // Init inventory
    const types: MaterialType[] = ['herb', 'ore', 'wood', 'crystal', 'void_essence'];
    for (const t of types) this._inventory.set(t, 0);

    this._wireEvents();
  }

  // ── Node registration ─────────────────────────────────────────────────
  /** Register a harvestable node in the world (called by scene on create). */
  addNode(node: Omit<MaterialNode, 'harvested'>): void {
    this._nodes.push({ ...node, harvested: false });
  }

  /** Get all nodes for a region (for scene rendering). */
  getNodesForRegion(region: string): MaterialNode[] {
    return this._nodes.filter(n => n.region === region);
  }

  // ── Harvest ───────────────────────────────────────────────────────────
  /** Harvest a node. Returns yield amount or 0 if already harvested. */
  harvest(nodeId: string): number {
    const node = this._nodes.find(n => n.id === nodeId);
    if (!node || node.harvested) return 0;

    node.harvested = true;
    const yield_ = node.yieldMin + Math.floor(Math.random() * (node.yieldMax - node.yieldMin + 1));

    const current = this._inventory.get(node.type) ?? 0;
    this._inventory.set(node.type, current + yield_);

    return yield_;
  }

  /** Respawn all harvested nodes (called on bonfire rest). */
  respawnAll(): void {
    for (const node of this._nodes) {
      node.harvested = false;
    }
  }

  // ── Inventory ─────────────────────────────────────────────────────────
  getQuantity(type: MaterialType): number {
    return this._inventory.get(type) ?? 0;
  }

  getInventory(): InventoryEntry[] {
    const entries: InventoryEntry[] = [];
    for (const [type, quantity] of this._inventory) {
      if (quantity > 0) entries.push({ type, quantity });
    }
    return entries;
  }

  // ── Crafting ──────────────────────────────────────────────────────────
  canCraft(recipeId: string): boolean {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return false;

    for (const input of recipe.inputs) {
      if (this.getQuantity(input.type) < input.quantity) return false;
    }
    return true;
  }

  /** Craft a recipe. Returns output item key or null if insufficient materials. */
  craft(recipeId: string): string | null {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe || !this.canCraft(recipeId)) return null;

    // Deduct materials
    for (const input of recipe.inputs) {
      const current = this._inventory.get(input.type) ?? 0;
      this._inventory.set(input.type, current - input.quantity);
    }

    return recipe.outputItem;
  }

  // ── Serialisation ─────────────────────────────────────────────────────
  serialise(): { inventory: Record<string, number>; harvested: string[] } {
    const inv: Record<string, number> = {};
    for (const [type, qty] of this._inventory) inv[type] = qty;

    return {
      inventory: inv,
      harvested: this._nodes.filter(n => n.harvested).map(n => n.id),
    };
  }

  deserialise(data: { inventory: Record<string, number>; harvested: string[] }): void {
    for (const [type, qty] of Object.entries(data.inventory)) {
      this._inventory.set(type as MaterialType, qty);
    }
    const harvestedSet = new Set(data.harvested);
    for (const node of this._nodes) {
      node.harvested = harvestedSet.has(node.id);
    }
  }

  // ── Event wiring ──────────────────────────────────────────────────────
  private _wireEvents(): void {
    Bus.on(GameEvent.BONFIRE_REST, () => {
      this.respawnAll();
    });
  }
}

export const Farming = new FarmingSystem();

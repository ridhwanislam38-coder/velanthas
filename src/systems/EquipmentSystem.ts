import { Bus, GameEvent } from './EventBus';

// ── EquipmentSystem ─────────────────────────────────────────────────────────
// Manages player equipment: weapon, armour, accessory, picto slots.
// Equipment provides stat modifiers. Swap via inventory or merchant.
// 30 equipment pieces minimum (CLAUDE.md content target).

export type EquipSlot = 'weapon' | 'armour' | 'accessory' | 'picto_1' | 'picto_2' | 'picto_3';
export type WeaponFamily = 'sword' | 'bow' | 'staff' | 'dagger' | 'hammer' | 'focus';

export interface EquipmentItem {
  id:          string;
  name:        string;
  description: string;
  slot:        EquipSlot;
  family?:     WeaponFamily;   // only for weapons
  stats:       Partial<EquipStats>;
  loreText?:   string;         // journal entry when first equipped
}

export interface EquipStats {
  atk:     number;
  def:     number;
  speed:   number;
  critRate:number;    // 0–1 additive
  apRegen: number;    // AP/s bonus
}

// ── Equipment catalogue (30 pieces) ─────────────────────────────────────
export const EQUIPMENT: EquipmentItem[] = [
  // === Weapons (12) ===
  { id: 'sword_wanderer',     name: 'Wanderer Blade',       description: 'A worn but reliable sword.',               slot: 'weapon', family: 'sword',  stats: { atk: 8 } },
  { id: 'sword_ironveil',     name: 'Ironveil Longsword',   description: 'Standard issue. Heavy but true.',          slot: 'weapon', family: 'sword',  stats: { atk: 14, speed: -5 } },
  { id: 'sword_accord',       name: 'Accord Fragment',      description: 'A blade that hums with silence.',          slot: 'weapon', family: 'sword',  stats: { atk: 22, critRate: 0.05 }, loreText: 'The metal remembers the pact.' },
  { id: 'bow_songbird',       name: 'Songbird Bow',         description: 'Light and swift. Whispers when drawn.',    slot: 'weapon', family: 'bow',    stats: { atk: 10, speed: 8 } },
  { id: 'bow_void',           name: 'Voidstring',           description: 'Arrows dissolve mid-flight and reform.',   slot: 'weapon', family: 'bow',    stats: { atk: 18, critRate: 0.08 } },
  { id: 'staff_scholar',      name: 'Scholar Staff',        description: 'Magistra Eon once carried one like this.', slot: 'weapon', family: 'staff',  stats: { atk: 6, apRegen: 0.3 } },
  { id: 'staff_void',         name: 'Void Conduit',         description: 'Channels raw void energy. Unstable.',      slot: 'weapon', family: 'staff',  stats: { atk: 20, apRegen: 0.5, def: -5 } },
  { id: 'dagger_shadow',      name: 'Shadow Fang',          description: 'Barely visible. Barely there.',            slot: 'weapon', family: 'dagger', stats: { atk: 7, speed: 15, critRate: 0.12 } },
  { id: 'dagger_gilded',      name: 'Gilded Stiletto',      description: 'More ornament than weapon. Still cuts.',   slot: 'weapon', family: 'dagger', stats: { atk: 11, speed: 10, critRate: 0.08 } },
  { id: 'hammer_forge',       name: 'Forgecrusher',         description: 'Slow. Devastating. Breaks guards.',        slot: 'weapon', family: 'hammer', stats: { atk: 25, speed: -12 } },
  { id: 'hammer_bone',        name: 'Bone Maul',            description: 'Carved from a Colossus femur.',            slot: 'weapon', family: 'hammer', stats: { atk: 30, speed: -15, def: 5 } },
  { id: 'focus_crystal',      name: 'Focusing Lens',        description: 'Amplifies will into force.',               slot: 'weapon', family: 'focus',  stats: { atk: 12, apRegen: 0.4 } },

  // === Armour (8) ===
  { id: 'armour_wanderer',    name: 'Wanderer Cloak',       description: 'Threadbare but comfortable.',              slot: 'armour', stats: { def: 5 } },
  { id: 'armour_ironveil',    name: 'Ironveil Plate',       description: 'Standard military plate. Heavy.',          slot: 'armour', stats: { def: 18, speed: -8 } },
  { id: 'armour_wild',        name: 'Wildwood Bark',        description: 'Living armour that grows around you.',     slot: 'armour', stats: { def: 12, speed: 3 } },
  { id: 'armour_void',        name: 'Void Shroud',          description: 'Part of you fades from sight.',            slot: 'armour', stats: { def: 8, critRate: 0.06, speed: 5 } },
  { id: 'armour_gilded',      name: 'Gilded Vestments',     description: 'Beautiful. Impractical. Expensive.',       slot: 'armour', stats: { def: 10 } },
  { id: 'armour_forgotten',   name: 'Revenant Wrappings',   description: 'Smells of dust and regret.',               slot: 'armour', stats: { def: 14, apRegen: 0.2 } },
  { id: 'armour_accord',      name: 'Accord Mantle',        description: 'White as bone. Warm as nothing.',          slot: 'armour', stats: { def: 20, apRegen: 0.3 }, loreText: 'The Accord protected. The mantle remembers.' },
  { id: 'armour_warden',      name: 'Warden Plate',         description: 'Taken from the Warden. Still locked.',     slot: 'armour', stats: { def: 25, speed: -10 } },

  // === Accessories (5) ===
  { id: 'acc_ring_haste',     name: 'Haste Ring',           description: 'Move before you think.',                   slot: 'accessory', stats: { speed: 12 } },
  { id: 'acc_amulet_crit',    name: 'Sharpened Amulet',     description: 'Finds the gap in every guard.',            slot: 'accessory', stats: { critRate: 0.10 } },
  { id: 'acc_charm_ap',       name: 'AP Charm',             description: 'The Accord flows faster through you.',     slot: 'accessory', stats: { apRegen: 0.5 } },
  { id: 'acc_belt_def',       name: 'Ironhide Belt',        description: 'Thick leather over chain.',                slot: 'accessory', stats: { def: 8 } },
  { id: 'acc_pendant_lore',   name: 'Lorekeeper Pendant',   description: 'Reveals hidden lore in the world.',        slot: 'accessory', stats: {} },

  // === Pictos (5 — equippable modifiers) ===
  { id: 'picto_parry_window', name: 'Picto: Patience',      description: '+2f parry window.',                        slot: 'picto_1', stats: {} },
  { id: 'picto_dodge_dist',   name: 'Picto: Evasion',       description: '+20% dodge distance.',                     slot: 'picto_1', stats: { speed: 5 } },
  { id: 'picto_lifesteal',    name: 'Picto: Siphon',        description: 'Heal 3% of damage dealt.',                 slot: 'picto_2', stats: {} },
  { id: 'picto_combo_extend', name: 'Picto: Chain',         description: '+1s combo window.',                        slot: 'picto_2', stats: {} },
  { id: 'picto_ap_on_kill',   name: 'Picto: Harvest',       description: '+1 AP on kill.',                           slot: 'picto_3', stats: { apRegen: 0.1 } },
];

export class EquipmentSystem {
  private _equipped = new Map<EquipSlot, EquipmentItem | null>();
  private _inventory: EquipmentItem[] = [];

  constructor() {
    // Start with wanderer gear
    const slots: EquipSlot[] = ['weapon', 'armour', 'accessory', 'picto_1', 'picto_2', 'picto_3'];
    for (const s of slots) this._equipped.set(s, null);

    const starterWeapon = EQUIPMENT.find(e => e.id === 'sword_wanderer');
    const starterArmour = EQUIPMENT.find(e => e.id === 'armour_wanderer');
    if (starterWeapon) this._equipped.set('weapon', starterWeapon);
    if (starterArmour) this._equipped.set('armour', starterArmour);
  }

  // ── Queries ───────────────────────────────────────────────────────────
  getEquipped(slot: EquipSlot): EquipmentItem | null {
    return this._equipped.get(slot) ?? null;
  }

  getAllEquipped(): Map<EquipSlot, EquipmentItem | null> {
    return new Map(this._equipped);
  }

  getInventory(): EquipmentItem[] {
    return [...this._inventory];
  }

  /** Sum all stat bonuses from equipped items. */
  getTotalStats(): EquipStats {
    const total: EquipStats = { atk: 0, def: 0, speed: 0, critRate: 0, apRegen: 0 };
    for (const item of this._equipped.values()) {
      if (!item) continue;
      for (const key of Object.keys(total) as Array<keyof EquipStats>) {
        total[key] += item.stats[key] ?? 0;
      }
    }
    return total;
  }

  // ── Mutations ─────────────────────────────────────────────────────────
  /** Equip an item from inventory. Returns the previously equipped item (or null). */
  equip(itemId: string): EquipmentItem | null {
    const idx = this._inventory.findIndex(i => i.id === itemId);
    if (idx === -1) return null;

    const item = this._inventory[idx]!;
    const prev = this._equipped.get(item.slot) ?? null;

    // Swap
    this._equipped.set(item.slot, item);
    this._inventory.splice(idx, 1);
    if (prev) this._inventory.push(prev);

    // Lore discovery on first equip
    if (item.loreText) {
      Bus.emit(GameEvent.LORE_FOUND, { loreId: `equip_${item.id}` });
    }

    return prev;
  }

  /** Unequip a slot, putting the item back in inventory. */
  unequip(slot: EquipSlot): void {
    const item = this._equipped.get(slot);
    if (item) {
      this._inventory.push(item);
      this._equipped.set(slot, null);
    }
  }

  /** Add an item to inventory (loot drop, quest reward, purchase). */
  addToInventory(itemId: string): boolean {
    const item = EQUIPMENT.find(e => e.id === itemId);
    if (!item) return false;
    this._inventory.push({ ...item });
    return true;
  }

  // ── Serialisation ─────────────────────────────────────────────────────
  serialise(): { equipped: Record<string, string | null>; inventory: string[] } {
    const equipped: Record<string, string | null> = {};
    for (const [slot, item] of this._equipped) {
      equipped[slot] = item?.id ?? null;
    }
    return {
      equipped,
      inventory: this._inventory.map(i => i.id),
    };
  }

  deserialise(data: { equipped: Record<string, string | null>; inventory: string[] }): void {
    for (const [slot, itemId] of Object.entries(data.equipped)) {
      if (itemId) {
        const item = EQUIPMENT.find(e => e.id === itemId);
        this._equipped.set(slot as EquipSlot, item ?? null);
      } else {
        this._equipped.set(slot as EquipSlot, null);
      }
    }
    this._inventory = [];
    for (const id of data.inventory) {
      const item = EQUIPMENT.find(e => e.id === id);
      if (item) this._inventory.push({ ...item });
    }
  }
}

export const Equipment = new EquipmentSystem();

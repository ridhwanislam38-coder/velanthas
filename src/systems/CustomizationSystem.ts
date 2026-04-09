import { Bus, GameEvent } from './EventBus';

// ── CustomizationSystem ─────────────────────────────────────────────────────
// Player appearance: outfit, hair, face, colours. Cosmetic only — no stat effects.
// Persisted per save. Sprite sheets swap based on current selections.
// All outfits are modest by default — no revealing options (halal content rule).

export interface AppearanceData {
  outfitId:   string;
  hairId:     string;
  faceId:     string;
  skinColor:  number;   // hex tint
  hairColor:  number;   // hex tint
  outfitColor:number;   // hex tint
}

const DEFAULT_APPEARANCE: AppearanceData = {
  outfitId:    'cloak_wanderer',
  hairId:      'hair_short',
  faceId:      'face_neutral',
  skinColor:   0xd4a574,
  hairColor:   0x2a1a0e,
  outfitColor: 0x4a3a2a,
};

// ── Available options (expand as RetroDiffusion generates assets) ────────
export const OUTFITS = [
  { id: 'cloak_wanderer',   label: 'Wanderer Cloak',      spriteKey: 'outfit_wanderer' },
  { id: 'armor_ironveil',   label: 'Ironveil Plate',      spriteKey: 'outfit_ironveil' },
  { id: 'robe_scholar',     label: 'Scholar Robe',        spriteKey: 'outfit_scholar' },
  { id: 'tunic_wild',       label: 'Wildwood Tunic',      spriteKey: 'outfit_wild' },
  { id: 'vestment_void',    label: 'Void Vestments',      spriteKey: 'outfit_void' },
  { id: 'garb_gilded',      label: 'Gilded Merchant Garb',spriteKey: 'outfit_gilded' },
] as const;

export const HAIRSTYLES = [
  { id: 'hair_short',   label: 'Short',    spriteKey: 'hair_short' },
  { id: 'hair_long',    label: 'Long',     spriteKey: 'hair_long' },
  { id: 'hair_braided', label: 'Braided',  spriteKey: 'hair_braided' },
  { id: 'hair_shaved',  label: 'Shaved',   spriteKey: 'hair_shaved' },
  { id: 'hair_hood',    label: 'Hooded',   spriteKey: 'hair_hood' },
] as const;

export const FACES = [
  { id: 'face_neutral', label: 'Neutral' },
  { id: 'face_scarred', label: 'Scarred' },
  { id: 'face_marked',  label: 'Marked' },
] as const;

export class CustomizationSystem {
  private _appearance: AppearanceData = { ...DEFAULT_APPEARANCE };

  get appearance(): Readonly<AppearanceData> { return this._appearance; }

  setOutfit(id: string): void {
    this._appearance.outfitId = id;
  }

  setHair(id: string): void {
    this._appearance.hairId = id;
  }

  setFace(id: string): void {
    this._appearance.faceId = id;
  }

  setColors(skin?: number, hair?: number, outfit?: number): void {
    if (skin !== undefined)   this._appearance.skinColor = skin;
    if (hair !== undefined)   this._appearance.hairColor = hair;
    if (outfit !== undefined) this._appearance.outfitColor = outfit;
  }

  /** Apply current appearance to the player sprite. */
  applyToSprite(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    // Outfit texture swap
    const outfit = OUTFITS.find(o => o.id === this._appearance.outfitId);
    if (outfit) {
      // If the texture exists, use it; otherwise keep current
      if (sprite.scene.textures.exists(outfit.spriteKey)) {
        sprite.setTexture(outfit.spriteKey);
      }
    }
    // Tint for colour customisation
    sprite.setTint(this._appearance.outfitColor);
  }

  serialise(): AppearanceData {
    return { ...this._appearance };
  }

  deserialise(data: AppearanceData): void {
    Object.assign(this._appearance, data);
  }

  reset(): void {
    this._appearance = { ...DEFAULT_APPEARANCE };
  }
}

export const Customization = new CustomizationSystem();

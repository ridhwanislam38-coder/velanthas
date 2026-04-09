import Phaser from 'phaser';
import { Bus, GameEvent } from './EventBus';
import { DEPTH } from '../config/visualConfig';

// ── PetSystem ───────────────────────────────────────────────────────────────
// Bondable companion creatures that follow the player.
// Combat support (light bonus, aggro distraction).
// Flying unlock in late game enables aerial traversal.
//
// Pets earned through: boss spare (LumaMoth), quest rewards, secrets.

export interface PetConfig {
  id:          string;
  name:        string;
  description: string;
  spriteKey:   string;
  followDist:  number;    // distance behind player
  followSpeed: number;
  abilities:   PetAbility[];
  canFly:      boolean;   // unlocked later
  lightRadius?:number;    // some pets emit light
  source:      string;    // how the pet is obtained
}

export type PetAbility =
  | 'light_bonus'       // +10% light attack damage
  | 'aggro_distract'    // enemies target pet briefly
  | 'heal_tick'         // +1 HP every 10s
  | 'loot_magnet'       // auto-collect nearby lumens
  | 'reveal_secrets'    // highlights hidden lore in range
  | 'flight';           // late-game aerial traversal

export const PET_CONFIGS: PetConfig[] = [
  {
    id: 'luma_moth_pet', name: 'Luma', description: 'The moth chose to follow you.',
    spriteKey: 'pet_moth', followDist: 24, followSpeed: 130,
    abilities: ['light_bonus', 'reveal_secrets'],
    canFly: true, lightRadius: 60,
    source: 'Spare LumaMoth boss at <10% HP',
  },
  {
    id: 'ash_fox', name: 'Cinder', description: 'An ash-colored fox from the Ashfields.',
    spriteKey: 'pet_fox', followDist: 20, followSpeed: 140,
    abilities: ['loot_magnet'],
    canFly: false,
    source: 'Side quest: Maren\'s Choice (help Maren)',
  },
  {
    id: 'void_wisp', name: 'Null', description: 'A fragment of void that refuses to dissipate.',
    spriteKey: 'pet_wisp', followDist: 16, followSpeed: 160,
    abilities: ['aggro_distract', 'light_bonus'],
    canFly: true, lightRadius: 30,
    source: 'Voidmarsh: find all 3 void lore fragments',
  },
  {
    id: 'stone_beetle', name: 'Basalt', description: 'Slow, resilient, loyal.',
    spriteKey: 'pet_beetle', followDist: 28, followSpeed: 90,
    abilities: ['heal_tick'],
    canFly: false,
    source: 'Greyveil: complete The Broken Oath quest',
  },
  {
    id: 'gilded_hawk', name: 'Aureus', description: 'A golden hawk from Gildspire rooftops.',
    spriteKey: 'pet_hawk', followDist: 30, followSpeed: 170,
    abilities: ['loot_magnet', 'reveal_secrets'],
    canFly: true,
    source: 'Gildspire: purchase from Verso for 500 lumens',
  },
];

export class PetSystem {
  private _activePet: PetConfig | null = null;
  private _unlockedIds = new Set<string>();
  private _sprite: Phaser.GameObjects.Image | null = null;
  private _scene: Phaser.Scene | null = null;
  private _flyingEnabled = false;

  constructor() {
    this._wireEvents();
  }

  // ── Queries ───────────────────────────────────────────────────────────
  get activePet(): PetConfig | null { return this._activePet; }
  get isFlying(): boolean { return this._flyingEnabled && (this._activePet?.canFly ?? false); }
  getUnlocked(): PetConfig[] { return PET_CONFIGS.filter(p => this._unlockedIds.has(p.id)); }
  hasAbility(ability: PetAbility): boolean {
    return this._activePet?.abilities.includes(ability) ?? false;
  }

  // ── Mutations ─────────────────────────────────────────────────────────
  unlock(petId: string): void {
    this._unlockedIds.add(petId);
  }

  setActive(petId: string | null, scene?: Phaser.Scene): void {
    if (petId === null) {
      this._activePet = null;
      this._sprite?.destroy();
      this._sprite = null;
      return;
    }
    const config = PET_CONFIGS.find(p => p.id === petId);
    if (!config || !this._unlockedIds.has(petId)) return;
    this._activePet = config;
    if (scene) this._createSprite(scene);
  }

  enableFlying(): void {
    this._flyingEnabled = true;
  }

  // ── Update (follow player) ────────────────────────────────────────────
  update(playerX: number, playerY: number): void {
    if (!this._sprite || !this._activePet) return;

    const dx = playerX - this._activePet.followDist - this._sprite.x;
    const dy = playerY - this._sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      const speed = this._activePet.followSpeed;
      const factor = Math.min(1, speed * 0.016 / dist);
      this._sprite.x += dx * factor;
      this._sprite.y += dy * factor;
    }
  }

  // ── Serialisation ─────────────────────────────────────────────────────
  serialise(): { unlocked: string[]; active: string | null; flyingEnabled: boolean } {
    return {
      unlocked: [...this._unlockedIds],
      active: this._activePet?.id ?? null,
      flyingEnabled: this._flyingEnabled,
    };
  }

  deserialise(data: { unlocked: string[]; active: string | null; flyingEnabled: boolean }): void {
    this._unlockedIds = new Set(data.unlocked);
    this._flyingEnabled = data.flyingEnabled;
    if (data.active) {
      const config = PET_CONFIGS.find(p => p.id === data.active);
      if (config && this._unlockedIds.has(data.active)) {
        this._activePet = config;
      }
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────
  private _createSprite(scene: Phaser.Scene): void {
    this._scene = scene;
    this._sprite?.destroy();
    if (!this._activePet) return;
    this._sprite = scene.add.image(0, 0, this._activePet.spriteKey);
    this._sprite.setDepth(DEPTH.GAME - 1); // just behind player in y-sort
    this._sprite.setScale(0.8);
  }

  private _wireEvents(): void {
    // LumaMoth spare → unlock moth pet
    Bus.on(GameEvent.SPECIAL_END, (data: unknown) => {
      const d = data as { id?: string; spared?: boolean };
      if (d.id === 'luma_spare' && d.spared) {
        this.unlock('luma_moth_pet');
      }
    });
  }
}

export const Pets = new PetSystem();

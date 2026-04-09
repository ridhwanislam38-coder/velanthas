import Phaser from 'phaser';
import { registerAllContent } from '../config/questConfig';

// ── BootScene — Preload all assets, then start game ─────────────────────────
// NO canvas sprite generation. All art comes from PixelLab PNGs.
// If a PNG is missing, the texture just won't exist — no ugly fallback.

export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload(): void {
    // Debug: log any load failures
    this.load.on('loaderror', (file: { key: string; src: string }) => {
      console.error(`[BootScene] FAILED to load: ${file.key} from ${file.src}`);
    });
    this.load.on('filecomplete', (key: string) => {
      console.log(`[BootScene] Loaded: ${key}`);
    });

    // ── Player sprites (PixelLab — isometric 3/4 view, 4 directions) ──
    this.load.image('hero_idle_0',  'assets/sprites/characters/player_iso_down_idle.png');
    this.load.image('hero_down',    'assets/sprites/characters/player_iso_down.png');
    this.load.image('hero_up',      'assets/sprites/characters/player_iso_up.png');
    this.load.image('hero_right',   'assets/sprites/characters/player_iso_right.png');
    this.load.image('hero_idle_1',  'assets/sprites/characters/player_idle_front.png'); // same for now
    this.load.image('hero_walk_0',  'assets/sprites/characters/player_iso_walk.png');
    this.load.image('hero_walk_1',  'assets/sprites/characters/player_walk_front.png');
    this.load.image('hero_walk_2',  'assets/sprites/characters/player_walk_front.png');
    this.load.image('hero_walk_3',  'assets/sprites/characters/player_walk_front.png');
    this.load.image('hero_atk_0',   'assets/sprites/characters/player_attack.png');
    this.load.image('hero_atk_1',   'assets/sprites/characters/player_attack.png');
    this.load.image('hero_atk_2',   'assets/sprites/characters/player_attack.png');
    this.load.image('hero_hurt',    'assets/sprites/characters/player_idle_front.png');

    // ── Enemy sprites ──────────────────────────────────────────────────
    this.load.image('monster',      'assets/sprites/enemies/guard_enemy.png');

    // ── NPC sprites ────────────────────────────────────────────────────
    this.load.image('npc_scholar',  'assets/sprites/npcs/magistra_eon.png');
    this.load.image('npc_merchant', 'assets/sprites/npcs/merchant_verso.png');
    this.load.image('npc_verso',    'assets/sprites/npcs/merchant_verso.png');
    this.load.image('npc_elder',    'assets/sprites/npcs/elder_moss.png');
    this.load.image('npc_child',    'assets/sprites/npcs/ori_child.png');

    // ── Tiles + Environment ────────────────────────────────────────────
    this.load.image('tile_ash_ground', 'assets/tiles/tilesets/ashfields_ground.png');
    this.load.image('tile_ash_path',   'assets/tiles/tilesets/ashfields_path.png');
    this.load.image('env_dead_tree',   'assets/tiles/environments/dead_tree.png');
    this.load.image('env_ruin_wall',   'assets/tiles/environments/ruined_wall.png');
    this.load.image('env_bonfire',     'assets/tiles/environments/bonfire.png');
    this.load.image('env_ash_rock',    'assets/tiles/environments/ash_rock_large.png');
    this.load.image('env_broken_pillar','assets/tiles/environments/broken_pillar.png');
    this.load.image('env_ember_pool',  'assets/tiles/environments/ember_pool.png');

    // ── Multi-area backgrounds (Ashfields) ──────────────────────────────
    this.load.image('ashfields_hub',    'assets/areas/ashfields/square_2.jpg');
    this.load.image('ashfields_street', 'assets/areas/ashfields/street_1.jpg');
    this.load.image('ashfields_tavern', 'assets/areas/ashfields/tavern_3.jpg');
    this.load.image('ashfields_market', 'assets/areas/ashfields/square_2.jpg');

    // ── HD-2D Region backgrounds (Leonardo AI) ─────────────────────────
    this.load.image('ashfields_hub_1',  'assets/tiles/environments/ashfields_hub_1.jpg');
    this.load.image('ashfields_hub_2',  'assets/tiles/environments/ashfields_hub_2.jpg');

    // ── HD-2D split layers (ground + foreground) ──────────────────────
    this.load.image('ashfields_ground',     'assets/tiles/environments/ashfields_hub_2_ground.png');
    this.load.image('ashfields_foreground', 'assets/tiles/environments/ashfields_hub_2_foreground.png');
    this.load.image('verdenmere_hub',   'assets/tiles/environments/verdenmere_hub.jpg');
    this.load.image('greyveil_hub',     'assets/tiles/environments/greyveil_hub.jpg');
    this.load.image('gildspire_hub',    'assets/tiles/environments/gildspire_hub.jpg');
    this.load.image('voidmarsh_hub',    'assets/tiles/environments/voidmarsh_hub.jpg');

    // ── HD-2D Background layers (PixelLab) ───────────────────────────
    this.load.image('ashfields_bg_far',     'assets/tiles/environments/ashfields_bg_far.png');
    this.load.image('ashfields_bg_mid',     'assets/tiles/environments/ashfields_bg_mid.png');
    this.load.image('ashfields_ground_det', 'assets/tiles/environments/ashfields_ground_detail.png');
    this.load.image('verdenmere_bg_far',    'assets/tiles/environments/verdenmere_bg_far.png');
    this.load.image('verdenmere_bg_mid',    'assets/tiles/environments/verdenmere_bg_mid.png');

    // ── Ambient SFX (FreeSound) ────────────────────────────────────────
    this.load.audio('wind_ashfields',  'assets/generated/audio/ambient/wind_ashfields.wav');
    this.load.audio('distant_bell',    'assets/generated/audio/ambient/distant_bell.wav');
    this.load.audio('footstep_stone',  'assets/generated/audio/ambient/footstep_stone.wav');

    // ── Voice lines (ElevenLabs) ───────────────────────────────────────
    this.load.audio('magistra_eon_01', 'assets/generated/audio/dialogue/magistra_eon_01.mp3');
    this.load.audio('magistra_eon_02', 'assets/generated/audio/dialogue/magistra_eon_02.mp3');
    this.load.audio('magistra_eon_03', 'assets/generated/audio/dialogue/magistra_eon_03.mp3');
  }

  create(): void {
    // Generate starfield background (this one is procedural, not a PNG)
    this._genStarfield();

    // Register all quests + lore
    registerAllContent();

    this.scene.start('TitleScene');
  }

  private _genStarfield(): void {
    if (this.textures.exists('bg_stars')) return;
    const W = 320, H = 180, PX = 3;
    const tex = this.textures.createCanvas('bg_stars', W * PX, H * PX)!;
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#040408';
    ctx.fillRect(0, 0, W * PX, H * PX);
    let s = 42;
    const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
    for (let i = 0; i < 200; i++) {
      const sx = Math.floor(rng() * W * PX);
      const sy = Math.floor(rng() * H * PX);
      const br = Math.floor(80 + rng() * 120);
      ctx.fillStyle = `rgb(${br},${br},${Math.floor(br * 0.9)})`;
      ctx.fillRect(sx, sy, rng() < 0.15 ? 2 : 1, rng() < 0.15 ? 2 : 1);
    }
    tex.refresh();
  }
}

import Phaser from 'phaser';
import { registerAllContent } from '../config/questConfig';

// ── BootScene — Asset Loading + Sprite Generation ───────────────────────────
// Generates all placeholder sprites using Phaser Graphics API.
// Art direction: HD-2D dark fantasy. Muted earth tones, dark outlines,
// warm highlights. Triangle Strategy diorama feel.
//
// These placeholders will be replaced by AI-generated art (PixelLab,
// RetroDiffusion, God Mode AI, Scenario) once pipeline keys are set.

const PX = 3; // game px → screen px multiplier

// ── VELANTHAS Color Palette (dark fantasy, NOT trivia-game bright) ───────
const C = {
  // Core
  OUTLINE:  '#0a0a0e',
  BG_DARK:  '#040408',
  WHITE:    '#ffffff',
  ACCORD:   '#F5F0E8', // the eerie Accord white

  // Skin tones (modest, natural)
  SKIN_1:   '#c4946a',
  SKIN_2:   '#a07050',
  SKIN_3:   '#704a30',

  // Player — wanderer palette (muted blue-grey cloak)
  CLOAK:    '#3a4a5a',
  CLOAK_L:  '#5a6a7a',
  ARMOR:    '#2a2a3a',
  BELT:     '#8a7a5a',
  BOOT:     '#3a2a1a',
  HAIR:     '#2a1a0e',

  // Faction colors
  IRONVEIL: '#5a6a7a',  // steel blue-grey
  WILD:     '#3a5a2a',  // forest green
  VOID:     '#4a1a6a',  // deep purple
  GILDED:   '#8a7a2a',  // tarnished gold
  FORGOTTEN:'#5a4a4a',  // dusty brown
  SILENT:   '#3a3a4a',  // cold grey

  // UI
  HP_RED:   '#8a2a2a',
  AP_BLUE:  '#2a4a6a',
  GOLD:     '#aa8a2a',
  DANGER:   '#8a2a1a',

  // Effects
  FIRE:     '#aa5a1a',
  VOID_FX:  '#6a2aaa',
  LIGHT:    '#aaa87a',
} as const;

type DrawCtx = { ctx: CanvasRenderingContext2D; tex: Phaser.Textures.CanvasTexture };

export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload(): void {
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
    this._genPlayer();
    this._genNPCs();
    this._genEnemies();
    this._genEffects();
    this._genUI();
    this._genBackgrounds();

    // Register all quests + lore
    registerAllContent();

    this.scene.start('TitleScene');
  }

  // ── Canvas helper ─────────────────────────────────────────────────────
  private mk(key: string, gw: number, gh: number): DrawCtx {
    const tex = this.textures.createCanvas(key, gw * PX, gh * PX)!;
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = false;
    return { ctx, tex };
  }

  private f(ctx: CanvasRenderingContext2D, gx: number, gy: number, gw: number, gh: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(gx * PX, gy * PX, gw * PX, gh * PX);
  }

  // ── PLAYER (16×24 game px) — dark wanderer ────────────────────────────
  private _genPlayer(): void {
    const frames = ['hero_idle_0', 'hero_idle_1', 'hero_walk_0', 'hero_walk_1', 'hero_walk_2', 'hero_walk_3'];
    for (let i = 0; i < frames.length; i++) {
      const { ctx, tex } = this.mk(frames[i]!, 16, 24);
      const f = this.f.bind(this, ctx);
      const bob = (i === 1) ? -1 : 0;
      const legOff = (i >= 2) ? ((i % 2 === 0) ? 1 : -1) : 0;

      // Outline
      f(3, 0 + bob, 10, 24, C.OUTLINE);
      // Hair
      f(4, 0 + bob, 8, 3, C.HAIR);
      // Face
      f(5, 3 + bob, 6, 4, C.SKIN_1);
      f(6, 4 + bob, 1, 1, C.OUTLINE); // left eye
      f(9, 4 + bob, 1, 1, C.OUTLINE); // right eye
      // Cloak body
      f(4, 7 + bob, 8, 8, C.CLOAK);
      f(4, 7 + bob, 8, 1, C.CLOAK_L); // shoulder highlight
      f(5, 11 + bob, 6, 1, C.BELT);
      // Arms (peek out from cloak)
      f(3, 8 + bob, 1, 4, C.SKIN_1);
      f(12, 8 + bob, 1, 4, C.SKIN_1);
      // Legs
      f(5, 15 + bob + legOff, 3, 6, C.ARMOR);
      f(8, 15 + bob - legOff, 3, 6, C.ARMOR);
      // Boots
      f(5, 20 + bob + legOff, 3, 3, C.BOOT);
      f(8, 20 + bob - legOff, 3, 3, C.BOOT);

      tex.refresh();
    }

    // Attack frames
    for (let a = 0; a < 3; a++) {
      const { ctx, tex } = this.mk(`hero_atk_${a}`, 20, 24);
      const f = this.f.bind(this, ctx);
      const ext = a * 2;
      f(3, 0, 10, 24, C.OUTLINE);
      f(4, 0, 8, 3, C.HAIR);
      f(5, 3, 6, 4, C.SKIN_1);
      f(4, 7, 8, 8, C.CLOAK);
      f(4, 7, 8, 1, C.CLOAK_L);
      // Weapon arm extended
      f(12 + ext, 6, 4, 2, C.IRONVEIL); // blade
      f(12 + ext, 8, 1, 1, C.LIGHT);    // glint
      f(5, 15, 6, 6, C.ARMOR);
      f(5, 20, 6, 3, C.BOOT);
      tex.refresh();
    }

    // Hurt
    {
      const { ctx, tex } = this.mk('hero_hurt', 16, 24);
      const f = this.f.bind(this, ctx);
      f(3, 1, 10, 22, C.OUTLINE);
      f(4, 2, 8, 3, C.HAIR);
      f(5, 5, 6, 4, C.SKIN_1);
      f(4, 9, 8, 8, C.CLOAK);
      ctx.globalAlpha = 0.4;
      f(0, 0, 16, 24, C.DANGER);
      ctx.globalAlpha = 1;
      tex.refresh();
    }
  }

  // ── NPCs — distinct by silhouette + faction color ─────────────────────
  private _genNPCs(): void {
    const npcs: Array<[string, string, string, boolean]> = [
      ['npc_scholar',  C.VOID,     C.ACCORD,    false],  // Magistra Eon
      ['npc_guard',    C.IRONVEIL, C.CLOAK_L,   true],   // Captain Rhoe
      ['npc_villager', C.FORGOTTEN,C.SKIN_1,    false],  // Maren + ambient
      ['npc_elder',    C.SILENT,   C.ACCORD,    false],  // Elder Moss
      ['npc_merchant', C.GILDED,   C.GOLD,      false],  // Verso
      ['npc_noble',    C.GILDED,   C.LIGHT,     false],  // Guildmaster Solen
      ['npc_knight',   C.IRONVEIL, C.CLOAK_L,   true],   // Daevan
      ['npc_bard',     C.WILD,     C.LIGHT,     false],  // Songweaver
      ['npc_hunter',   C.WILD,     C.SKIN_2,    false],  // Hunter
      ['npc_hooded',   C.SILENT,   C.VOID,      false],  // The Watcher
      ['npc_child',    C.CLOAK_L,  C.SKIN_1,    false],  // Ori / children
      ['npc_ghost',    C.ACCORD,   C.WHITE,     false],  // Thessamine
      ['npc_verso',    C.GILDED,   C.GOLD,      false],  // Verso (alt key)
      ['npc_student',  C.CLOAK,    C.SKIN_1,    false],  // Generic
      ['npc_cloaked',  C.SILENT,   C.VOID,      false],  // Generic hooded
    ];

    for (const [key, body, accent, hasWeapon] of npcs) {
      const { ctx, tex } = this.mk(key, 12, 20);
      const f = this.f.bind(this, ctx);
      f(2, 0, 8, 20, C.OUTLINE);
      f(3, 0, 6, 3, C.SKIN_1);    // head
      f(3, 3, 6, 4, C.SKIN_2);    // face shadow
      f(4, 4, 1, 1, C.OUTLINE);   // eyes
      f(7, 4, 1, 1, C.OUTLINE);
      f(2, 7, 8, 8, body);         // body
      f(2, 7, 8, 1, accent);       // accent line
      if (hasWeapon) {
        f(10, 5, 1, 9, C.IRONVEIL); // weapon
      }
      f(3, 15, 6, 4, body);        // legs
      f(3, 19, 3, 1, C.BOOT);
      f(6, 19, 3, 1, C.BOOT);
      tex.refresh();
    }
  }

  // ── ENEMIES — dark fantasy silhouettes ────────────────────────────────
  private _genEnemies(): void {
    // Generic monster (used by GuardEnemy + faction enemies)
    const { ctx, tex } = this.mk('monster', 24, 32);
    const f = this.f.bind(this, ctx);
    f(2, 2, 20, 28, C.OUTLINE);
    f(4, 4, 16, 24, C.FORGOTTEN);
    f(4, 4, 16, 2, C.DANGER);     // red highlight
    // Eyes
    f(7, 10, 3, 3, C.DANGER);
    f(14, 10, 3, 3, C.DANGER);
    f(8, 11, 1, 1, C.OUTLINE);
    f(15, 11, 1, 1, C.OUTLINE);
    // Body detail
    f(6, 18, 12, 2, C.SILENT);
    tex.refresh();

    // Ambient creature placeholders
    this._ambientSprite('ambient_deer', 20, 16, C.FORGOTTEN, C.SKIN_2);
    this._ambientSprite('ambient_crow', 12, 8, C.OUTLINE, C.SILENT);
    this._ambientSprite('ambient_rat', 8, 6, C.FORGOTTEN, C.SKIN_2);

    // Pet sprites
    this._ambientSprite('pet_moth', 16, 12, C.WILD, C.LIGHT);
    this._ambientSprite('pet_fox', 16, 12, C.FIRE, C.GILDED);
    this._ambientSprite('pet_wisp', 8, 8, C.VOID_FX, C.WHITE);
    this._ambientSprite('pet_beetle', 12, 10, C.SILENT, C.FORGOTTEN);
    this._ambientSprite('pet_hawk', 14, 10, C.GILDED, C.GOLD);
  }

  private _ambientSprite(key: string, w: number, h: number, body: string, accent: string): void {
    const { ctx, tex } = this.mk(key, w, h);
    ctx.fillStyle = body;
    ctx.fillRect(PX, PX, (w - 2) * PX, (h - 2) * PX);
    ctx.fillStyle = accent;
    ctx.fillRect(2 * PX, 2 * PX, (w - 4) * PX, Math.floor(h / 3) * PX);
    tex.refresh();
  }

  // ── Effects ───────────────────────────────────────────────────────────
  private _genEffects(): void {
    // Slash trail
    for (let i = 0; i < 4; i++) {
      const { ctx, tex } = this.mk(`fx_slash_${i}`, 20, 12);
      const w = 4 + i * 4;
      ctx.globalAlpha = 1 - i * 0.2;
      ctx.fillStyle = C.IRONVEIL;
      ctx.fillRect(0, 4 * PX, w * PX, 3 * PX);
      ctx.fillStyle = C.WHITE;
      ctx.fillRect(w * PX, 3 * PX, 2 * PX, 5 * PX);
      ctx.globalAlpha = 1;
      tex.refresh();
    }
  }

  // ── UI textures ───────────────────────────────────────────────────────
  private _genUI(): void {
    // Panel
    const { ctx: pc, tex: pt } = this.mk('ui_panel', 64, 64);
    pc.fillStyle = '#0a0a1a';
    pc.fillRect(0, 0, 64 * PX, 64 * PX);
    pc.fillStyle = C.CLOAK_L;
    pc.fillRect(0, 0, 64 * PX, PX); // top border
    pc.fillRect(0, 63 * PX, 64 * PX, PX);
    pc.fillRect(0, 0, PX, 64 * PX);
    pc.fillRect(63 * PX, 0, PX, 64 * PX);
    pt.refresh();
  }

  // ── Backgrounds ───────────────────────────────────────────────────────
  private _genBackgrounds(): void {
    // Starfield
    const { ctx, tex } = this.mk('bg_stars', 320, 180);
    ctx.fillStyle = C.BG_DARK;
    ctx.fillRect(0, 0, 320 * PX, 180 * PX);
    const rng = this._seededRng(42);
    for (let i = 0; i < 200; i++) {
      const sx = Math.floor(rng() * 320 * PX);
      const sy = Math.floor(rng() * 180 * PX);
      const br = Math.floor(80 + rng() * 120); // dimmer stars for dark fantasy
      ctx.fillStyle = `rgb(${br},${br},${Math.floor(br * 0.9)})`;
      ctx.fillRect(sx, sy, rng() < 0.15 ? 2 : 1, rng() < 0.15 ? 2 : 1);
    }
    tex.refresh();
  }

  private _seededRng(seed: number): () => number {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  }
}

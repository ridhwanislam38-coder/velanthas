import Phaser from 'phaser';

// ── Constants ──────────────────────────────────────────────────────────────
const PX = 3; // game pixels → screen pixels

// ── Color palette ──────────────────────────────────────────────────────────
const C = {
  // Hero
  HAIR:    '#4cc9f0', SKIN:    '#f4a261', EYE:     '#040408',
  ARMOR:   '#1a1a2e', TRIM:    '#4cc9f0', CAPE:    '#7b2fff',
  LEG:     '#2d2d44', BOOT:    '#4a3728', BELT:    '#ffd60a',
  // NPC palettes
  ROBE_D:  '#1a1230', ROBE_L:  '#6b2fff', SCROLL:  '#f5e6c8',
  CLOAK:   '#0d0d1a', HOOD:    '#2a1850', STAFF_W: '#8b7355',
  GUARD_A: '#2a3a4a', GUARD_T: '#4a6a7a', SPEAR:   '#8b7355',
  // Monsters
  MATH_B:  '#0077b6', MATH_A:  '#00b4d8', MATH_E:  '#90e0ef',
  SCI_B:   '#06d6a0', SCI_A:   '#1de9b6', SCI_E:   '#80ffdb',
  HIS_B:   '#7b2fff', HIS_A:   '#9d4edd', HIS_E:   '#c77dff',
  ENG_B:   '#e94560', ENG_A:   '#ff6b6b', ENG_E:   '#ffa5a5',
  VOID_B:  '#240046', VOID_A:  '#5a189a', VOID_E:  '#c77dff',
  // FX / UI
  WHITE:   '#ffffff', BLACK:   '#000000', NONE:    'rgba(0,0,0,0)',
  SPARK:   '#ffd60a', SLASH_C: '#4cc9f0', MAG_C:   '#7b2fff',
  EXPL_1:  '#ffd60a', EXPL_2:  '#ff8800', EXPL_3:  '#e94560',
  BG_DARK: '#040408',
} as const;

// ── Helper: canvas + ctx ───────────────────────────────────────────────────
type DrawCtx = { ctx: CanvasRenderingContext2D; tex: Phaser.Textures.CanvasTexture };

export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  create(): void {
    this._genHero();
    this._genNPCs();
    this._genMonsters();
    this._genEffects();
    this._genUI();
    this.scene.start('TitleScene');
  }

  // ── Canvas factory ─────────────────────────────────────────────────────
  private mk(key: string, gw: number, gh: number): DrawCtx {
    const tex = this.textures.createCanvas(key, gw * PX, gh * PX)!;
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, gw * PX, gh * PX);
    return { ctx, tex };
  }

  // Helper: fill game-pixel rect
  private f(
    ctx: CanvasRenderingContext2D,
    gx: number, gy: number, gw: number, gh: number,
    color: string,
    ox = 0, oy = 0,
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect((gx + ox) * PX, (gy + oy) * PX, gw * PX, gh * PX);
  }

  // ── HERO SPRITES (16×24 game px each) ─────────────────────────────────
  private _genHero(): void {
    this._heroFrame('hero_idle_0', 0);
    this._heroFrame('hero_idle_1', 1);
    this._heroFrame('hero_walk_0', 0);
    this._heroFrame('hero_walk_1', 2);
    this._heroFrame('hero_walk_2', 0);
    this._heroFrame('hero_walk_3', 3);
    this._heroAtk('hero_atk_0', 0);
    this._heroAtk('hero_atk_1', 1);
    this._heroAtk('hero_atk_2', 2);
    this._heroHurt();
    this._heroVic('hero_vic_0', false);
    this._heroVic('hero_vic_1', true);
  }

  private _heroFrame(key: string, variant: number): void {
    const { ctx, tex } = this.mk(key, 16, 24);
    const f = this.f.bind(this, ctx);
    const oy = variant === 1 ? -1 : 0; // idle_1 bobs 1px up

    // Hair/helmet
    f(4, 0, 8, 4, C.HAIR, 0, oy);
    f(5, 1, 6, 2, C.TRIM, 0, oy);
    // Face
    f(5, 4, 6, 4, C.SKIN, 0, oy);
    f(5, 5, 1, 1, C.EYE,  0, oy); // left eye
    f(9, 5, 1, 1, C.EYE,  0, oy); // right eye
    // Ears
    f(4, 5, 1, 2, C.SKIN, 0, oy);
    f(11,5, 1, 2, C.SKIN, 0, oy);
    // Armor body
    f(4, 8, 8, 5, C.ARMOR, 0, oy);
    f(4, 8, 8, 1, C.TRIM,  0, oy); // shoulder line
    f(4, 12,8, 1, C.BELT,  0, oy); // belt
    // Cape (behind body, left side)
    f(2, 8, 2, 6, C.CAPE, 0, oy);
    f(12,8, 2, 5, C.CAPE, 0, oy);
    // Arms
    f(3, 9, 1, 4, C.SKIN,  0, oy); // left arm
    f(12,9, 1, 4, C.SKIN,  0, oy); // right arm
    // Hands
    f(3, 13,1, 2, C.SKIN,  0, oy);
    f(12,13,1, 2, C.SKIN,  0, oy);
    // Legs — vary per walk variant
    const lLeg = (variant === 2) ? 1 : (variant === 3 ? -1 : 0);
    const rLeg = -lLeg;
    f(5, 13+lLeg, 2, 5, C.LEG, 0, oy);
    f(8, 13+rLeg, 3, 5, C.LEG, 0, oy);
    // Boots
    f(5, 18+lLeg, 3, 3, C.BOOT, 0, oy);
    f(8, 18+rLeg, 3, 3, C.BOOT, 0, oy);

    tex.refresh();
  }

  private _heroAtk(key: string, phase: number): void {
    const { ctx, tex } = this.mk(key, 16, 24);
    const f = this.f.bind(this, ctx);
    const lunge = phase * 2; // forward lean

    f(4+lunge, 0, 8, 4, C.HAIR);
    f(5+lunge, 4, 6, 4, C.SKIN);
    f(5+lunge, 5, 1, 1, C.EYE);
    f(9+lunge, 5, 1, 1, C.EYE);
    f(4+lunge, 8, 8, 5, C.ARMOR);
    f(4+lunge, 8, 8, 1, C.TRIM);
    f(2+lunge, 8, 2, 6, C.CAPE);
    // Sword arm extended
    f(12+lunge,8, 3, 2, C.TRIM);
    f(12+lunge,10,4, 1, C.SPARK);
    f(5+lunge,13, 6, 5, C.LEG);
    f(5+lunge,18, 6, 3, C.BOOT);

    tex.refresh();
  }

  private _heroHurt(): void {
    const { ctx, tex } = this.mk('hero_hurt', 16, 24);
    const f = this.f.bind(this, ctx);
    // Recoil — tinted red, leaning back
    f(2, 1, 8, 4, C.ENG_A);
    f(3, 5, 6, 4, '#ffb09e');
    f(2, 9, 7, 5, '#3a1a2e');
    f(2, 8, 7, 1, '#c04060');
    f(4, 14,6, 5, C.LEG);
    f(4, 19,6, 3, C.BOOT);
    ctx.globalAlpha = 0.4;
    f(0, 0,16,24, C.ENG_A);
    ctx.globalAlpha = 1;
    tex.refresh();
  }

  private _heroVic(key: string, arm: boolean): void {
    const { ctx, tex } = this.mk(key, 16, 24);
    const f = this.f.bind(this, ctx);
    f(4, 0, 8, 4, C.HAIR);
    f(5, 4, 6, 4, C.SKIN);
    f(5, 5, 1, 1, C.EYE);
    f(9, 5, 1, 1, C.EYE);
    // smile
    f(6, 7, 1, 1, C.EYE);
    f(8, 7, 1, 1, C.EYE);
    f(4, 8, 8, 5, C.ARMOR);
    f(4, 8, 8, 1, C.TRIM);
    f(2, 8, 2, 6, C.CAPE);
    // victory arm raised
    const ry = arm ? 0 : 2;
    f(12, 6+ry, 1, 6, C.SKIN);
    f(12, 6+ry, 2, 1, C.SPARK);
    f(5, 13,6, 5, C.LEG);
    f(5, 18,6, 3, C.BOOT);
    tex.refresh();
  }

  // ── NPC SPRITES (12×20 game px) ───────────────────────────────────────
  private _genNPCs(): void {
    this._npcVerso();
    this._npcLune();
    this._npcGeneric('npc_student', C.MATH_B,  '#f0d080', false);
    this._npcGeneric('npc_guard',   C.GUARD_A, C.GUARD_T, true);
    this._npcGeneric('npc_elder',   C.HIS_B,   '#d4b483', false);
    this._npcGeneric('npc_merchant','#4a3020',  C.SPARK,  false);
    this._npcGeneric('npc_cloaked', C.CLOAK,   C.HOOD,   false);
    this._npcGeneric('npc_scholar', C.ROBE_D,  C.ROBE_L, false);
    // portraits (24×32) for dialogue
    this._portrait('portrait_verso',   C.ROBE_D, C.SCROLL);
    this._portrait('portrait_lune',    C.CLOAK,  C.MAG_C);
    this._portrait('portrait_six',     C.MATH_B, '#f0d080');
    this._portrait('portrait_brant',   C.GUARD_A, C.GUARD_T);
  }

  private _npcVerso(): void {
    const { ctx, tex } = this.mk('npc_verso', 12, 20);
    const f = this.f.bind(this, ctx);
    // Shopkeeper: dark robes, scroll in hand
    f(3, 0, 6, 3, '#c8a26a'); // hair
    f(3, 3, 6, 4, C.SKIN);
    f(3, 4, 1, 1, C.EYE); f(7, 4, 1, 1, C.EYE);
    f(2, 7, 8, 7, C.ROBE_D);
    f(2, 7, 8, 1, C.ROBE_L);
    f(9, 9, 2, 3, C.SCROLL); // scroll
    f(3,14, 6, 5, C.ROBE_D);
    f(3,19, 3, 1, '#2a1a0a'); f(6,19, 3, 1, '#2a1a0a');
    tex.refresh();
  }

  private _npcLune(): void {
    const { ctx, tex } = this.mk('npc_lune', 12, 20);
    const f = this.f.bind(this, ctx);
    // Wanderer: deep hood, glowing eyes
    f(1, 0,10, 5, C.HOOD); // big hood
    f(3, 3, 6, 4, '#2a1a1a'); // shadowed face
    f(3, 5, 1, 1, C.MAG_C); f(7, 5, 1, 1, C.MAG_C); // glowing eyes
    f(2, 7, 8, 7, C.CLOAK);
    f(1, 9, 1, 5, C.STAFF_W); // staff left
    f(3,14, 6, 5, C.CLOAK);
    f(3,19, 3, 1, C.CLOAK); f(6,19, 3, 1, C.CLOAK);
    tex.refresh();
  }

  private _npcGeneric(
    key: string,
    bodyColor: string,
    accentColor: string,
    isGuard: boolean,
  ): void {
    const { ctx, tex } = this.mk(key, 12, 20);
    const f = this.f.bind(this, ctx);
    f(3, 0, 6, 3, C.SKIN);
    f(3, 3, 6, 4, C.SKIN);
    f(3, 4, 1, 1, C.EYE); f(7, 4, 1, 1, C.EYE);
    f(2, 7, 8, 7, bodyColor);
    f(2, 7, 8, 1, accentColor);
    if (isGuard) {
      f(2, 8, 1, 5, accentColor); f(9, 8, 1, 5, accentColor); // shoulder pads
      f(10,5, 1, 9, C.SPEAR); // spear
    }
    f(3,14, 6, 5, bodyColor);
    f(3,19, 3, 1, '#2a1a0a'); f(6,19, 3, 1, '#2a1a0a');
    tex.refresh();
  }

  private _portrait(key: string, bgColor: string, accentColor: string): void {
    const { ctx, tex } = this.mk(key, 24, 32);
    const f = this.f.bind(this, ctx);
    f(0, 0, 24, 32, bgColor);
    f(0, 0, 24,  1, accentColor);
    f(0,31, 24,  1, accentColor);
    f(0, 0,  1, 32, accentColor);
    f(23,0,  1, 32, accentColor);
    // Simple face
    f(8, 6,  8,  6, C.SKIN);
    f(8, 5,  8,  2, '#6b4226');
    f(9, 9,  1,  1, C.EYE); f(13,9, 1, 1, C.EYE);
    f(8,14,  8,  6, bgColor);
    f(8,20,  8, 10, accentColor);
    tex.refresh();
  }

  // ── MONSTER SPRITES (24×32 game px) ───────────────────────────────────
  private _genMonsters(): void {
    this._monster('mon_math',    C.MATH_B,  C.MATH_A,  C.MATH_E,  'crystal');
    this._monster('mon_science', C.SCI_B,   C.SCI_A,   C.SCI_E,   'flask');
    this._monster('mon_history', C.HIS_B,   C.HIS_A,   C.HIS_E,   'specter');
    this._monster('mon_english', C.ENG_B,   C.ENG_A,   C.ENG_E,   'book');
    this._monster('mon_custom',  C.VOID_B,  C.VOID_A,  C.VOID_E,  'void');
  }

  private _monster(
    prefix: string,
    base: string, mid: string, bright: string,
    shape: 'crystal' | 'flask' | 'specter' | 'book' | 'void',
  ): void {
    for (let i = 0; i < 3; i++) {
      const { ctx, tex } = this.mk(`${prefix}_idle_${i}`, 24, 32);
      const f = this.f.bind(this, ctx);
      const bob = i === 1 ? -1 : 0;

      // Body
      f(4, 6+bob, 16, 20, base);
      f(4, 6+bob, 16,  2, mid);    // highlight top
      f(5, 24+bob,14,  2, bright); // underbelly glow

      switch (shape) {
        case 'crystal':
          f(8, 2+bob, 8, 6, mid);        // crystal spike top
          f(10,2+bob, 4, 4, bright);
          f(2, 8+bob, 3, 8, mid);        // side spikes
          f(19,8+bob, 3, 8, mid);
          f(7, 26+bob,4, 5, base);       // crystal feet
          f(13,26+bob,4, 5, base);
          break;
        case 'flask':
          // Flask/chemical shape
          f(9, 2+bob, 6, 5, mid);        // flask neck
          f(6, 7+bob,12, 2, bright);     // liquid line
          f(4,20+bob, 4, 5, bright);     // arms with claws
          f(16,20+bob,4, 5, bright);
          f(8,26+bob, 8, 5, base);       // base
          break;
        case 'specter':
          // Ghost-like, wispy bottom
          f(8, 2+bob, 8, 5, mid);        // crown wisps
          f(5,26+bob, 3, 4, mid);
          f(10,27+bob,4, 3, mid);
          f(16,26+bob,3, 4, mid);
          ctx.globalAlpha = 0.6 + i * 0.1;
          f(4, 6+bob,16,20, base);
          ctx.globalAlpha = 1;
          break;
        case 'book':
          // Book/tome shape
          f(3, 4+bob,18, 2, bright);     // top binding
          f(3, 6+bob, 2,20, mid);        // spine
          f(3,24+bob,18, 2, bright);     // bottom binding
          f(7, 8+bob, 2, 8, mid);        // page lines
          f(11,8+bob, 2, 8, mid);
          f(15,8+bob, 2, 8, mid);
          break;
        case 'void':
          // Pulsing void entity
          f(6, 4+bob,12, 2, mid);
          f(4, 6+bob, 2, 2, bright);     // eye stalks
          f(18,6+bob, 2, 2, bright);
          f(4, 8+bob, 3, 3, bright);     // eyes glow
          f(17,8+bob, 3, 3, bright);
          ctx.globalAlpha = 0.3;
          f(0, 0,24,32, bright);         // void glow overlay
          ctx.globalAlpha = 1;
          break;
      }

      // Eyes (all monsters)
      f(7, 12+bob, 3, 3, bright);
      f(14,12+bob, 3, 3, bright);
      f(8, 13+bob, 1, 1, C.EYE);
      f(15,13+bob, 1, 1, C.EYE);

      tex.refresh();
    }

    // Hurt frame
    const { ctx: hCtx, tex: hTex } = this.mk(`${prefix}_hurt`, 24, 32);
    const fh = this.f.bind(this, hCtx);
    fh(4, 6, 16, 20, base);
    fh(4, 6, 16,  2, mid);
    hCtx.globalAlpha = 0.6;
    fh(0, 0, 24, 32, '#ffffff');
    hCtx.globalAlpha = 1;
    fh(7, 12, 3, 3, bright);
    fh(14,12, 3, 3, bright);
    hTex.refresh();
  }

  // ── EFFECT SPRITES ─────────────────────────────────────────────────────
  private _genEffects(): void {
    // Slash frames (20×12)
    for (let i = 0; i < 4; i++) {
      const { ctx, tex } = this.mk(`fx_slash_${i}`, 20, 12);
      const f = this.f.bind(this, ctx);
      const w = 4 + i * 4;
      const alpha = 1 - i * 0.2;
      ctx.globalAlpha = alpha;
      f(0, 4, w, 3, C.SLASH_C);
      f(w, 3, 2, 5, C.WHITE);
      ctx.globalAlpha = 1;
      tex.refresh();
    }
    // Magic orb frames (16×16)
    for (let i = 0; i < 4; i++) {
      const { ctx, tex } = this.mk(`fx_magic_${i}`, 16, 16);
      const f = this.f.bind(this, ctx);
      const r = 3 + i;
      ctx.globalAlpha = 1 - i * 0.15;
      f(8-r, 8-r, r*2, r*2, C.MAG_C);
      f(8-r+1, 8-r+1, r*2-2, r*2-2, C.VOID_E);
      ctx.globalAlpha = 1;
      tex.refresh();
    }
    // Explosion frames (24×24)
    for (let i = 0; i < 5; i++) {
      const { ctx, tex } = this.mk(`fx_explosion_${i}`, 24, 24);
      const f = this.f.bind(this, ctx);
      const r = 3 + i * 2;
      const colors: string[] = [C.WHITE, C.EXPL_1, C.EXPL_2, C.EXPL_3, C.MAG_C];
      const col = colors[Math.min(i, colors.length - 1)] ?? C.EXPL_1;
      ctx.globalAlpha = 1 - i * 0.15;
      f(12-r, 12-r, r*2, r*2, col);
      if (i > 0) {
        const inner = r - 2;
        f(12-inner, 12-inner, inner*2, inner*2, colors[Math.max(0, i-1)] ?? C.EXPL_1);
      }
      ctx.globalAlpha = 1;
      tex.refresh();
    }
    // LUMINA BREAK flash (full 960×640)
    {
      const { ctx, tex } = this.mk('fx_break_flash', 320, 214); // 1/3 scale, stretched
      ctx.fillStyle = C.WHITE;
      ctx.fillRect(0, 0, 320 * PX, 214 * PX);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = C.MAG_C;
      ctx.fillRect(0, 0, 320 * PX, 214 * PX);
      ctx.globalAlpha = 1;
      tex.refresh();
    }
  }

  // ── UI SPRITES ─────────────────────────────────────────────────────────
  private _genUI(): void {
    // Panel (64×64)
    {
      const { ctx, tex } = this.mk('ui_panel', 64, 64);
      const f = this.f.bind(this, ctx);
      f(0, 0, 64, 64, '#0a0a1e');
      f(0, 0, 64,  1, C.TRIM);
      f(0,63, 64,  1, C.TRIM);
      f(0, 0,  1, 64, C.TRIM);
      f(63,0,  1, 64, C.TRIM);
      f(1, 1,  1,  1, C.TRIM); f(62,1,  1, 1, C.TRIM); // corners
      f(1,62,  1,  1, C.TRIM); f(62,62, 1, 1, C.TRIM);
      tex.refresh();
    }
    // Starfield background (320×213 — Phaser scales to 960×640)
    {
      const W = 320, H = 213;
      const { ctx, tex } = this.mk('bg_stars', W, H);
      ctx.fillStyle = C.BG_DARK;
      ctx.fillRect(0, 0, W * PX, H * PX);
      // Stars
      const rng = this._seededRng(42);
      for (let i = 0; i < 200; i++) {
        const sx = Math.floor(rng() * W * PX);
        const sy = Math.floor(rng() * H * PX);
        const sz = rng() < 0.15 ? 2 : 1;
        const br = Math.floor(100 + rng() * 155);
        ctx.fillStyle = `rgb(${br},${br},${br})`;
        ctx.fillRect(sx, sy, sz, sz);
      }
      tex.refresh();
    }
    // Dungeon background (320×213)
    {
      const W = 320, H = 213;
      const { ctx, tex } = this.mk('bg_dungeon', W, H);
      const grad = ctx.createLinearGradient(0, 0, 0, H * PX);
      grad.addColorStop(0, '#04040c');
      grad.addColorStop(1, '#0a0520');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W * PX, H * PX);
      // Stone tile pattern
      ctx.fillStyle = '#0d0d1e';
      for (let ty = 0; ty < H; ty += 8) {
        for (let tx = (ty % 16 === 0 ? 0 : 4); tx < W; tx += 8) {
          ctx.fillRect(tx * PX, ty * PX, 7 * PX, 7 * PX);
        }
      }
      tex.refresh();
    }
    // Tile sheet placeholder (32×32 px = single tile)
    {
      const { ctx, tex } = this.mk('tile_ground', 11, 11); // 32/3 ≈ 11 game px
      const f = this.f.bind(this, ctx);
      f(0, 0, 11, 11, '#1a1a2e');
      f(0, 0, 11,  1, '#2a2a4e');
      f(0, 0,  1, 11, '#2a2a4e');
      tex.refresh();
    }
  }

  // ── Deterministic RNG (no external dep) ───────────────────────────────
  private _seededRng(seed: number): () => number {
    let s = seed;
    return (): number => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }
}

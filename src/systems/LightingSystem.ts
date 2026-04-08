import Phaser from 'phaser';
import { PERF, DEPTH } from '../config/visualConfig';
import { LIGHT_COLORS } from '../config/paletteConfig';
import { Bus, GameEvent } from './EventBus';

// ── Lighting System ────────────────────────────────────────────────────────
// Approach:
//   1. Full-screen dark overlay (alpha driven by zone config)
//   2. Each point light = radial gradient RenderTexture, ADD blend
//   3. Multiply blend mode over everything below depth LIGHTING
//   4. Shadow casting: directional shadow sprites per entity
//
// All light-source math: every 3 frames (PERF.LIGHTING_TICK_FRAMES)
// Max 12 active lights per screen — furthest culled if exceeded

export type DarknessLevel = 'SURFACE' | 'DUSK' | 'TWILIGHT' | 'CAVE' | 'ABYSS' | 'VOID';

const DARKNESS_ALPHA: Record<DarknessLevel, number> = {
  SURFACE:  0.00,
  DUSK:     0.30,
  TWILIGHT: 0.55,
  CAVE:     0.80,
  ABYSS:    0.95,
  VOID:     1.00,
};

export interface LightSource {
  id:        string;
  x:         number;
  y:         number;
  radius:    number;
  color:     number;
  intensity: number; // 0-1
  flicker?:  { amplitude: number; frequency: number };
  // Runtime
  _tex?:     Phaser.GameObjects.RenderTexture;
  _phase:    number; // for flicker oscillation
}

export interface ShadowCaster {
  sprite: Phaser.Physics.Arcade.Sprite | Phaser.Physics.Arcade.Image;
  shadow: Phaser.GameObjects.Image;
}

export class LightingSystem {
  private _scene:       Phaser.Scene;
  private _overlay!:    Phaser.GameObjects.Rectangle;
  private _darkness:    DarknessLevel = 'SURFACE';
  private _lights:      Map<string, LightSource> = new Map();
  private _shadows:     Map<string, ShadowCaster> = new Map();
  private _tick:        number = 0;
  private _shadowColor: number = 0x1F150E;

  // Player light (always present)
  private _playerLightId = '__player';
  private _playerLightRadius = 120;

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
    this._buildOverlay();
    this._wireEvents();
  }

  // ── Public ────────────────────────────────────────────────────────────

  setDarkness(level: DarknessLevel): void {
    if (level === this._darkness) return;
    this._darkness = level;

    const targetAlpha = DARKNESS_ALPHA[level];
    this._scene.tweens.add({
      targets: this._overlay, alpha: targetAlpha, duration: 500, ease: 'Power1',
    });
  }

  setShadowColor(color: number): void {
    this._shadowColor = color;
  }

  // ── Light sources ─────────────────────────────────────────────────────

  addLight(source: LightSource): void {
    if (this._lights.size >= PERF.MAX_LIGHTS_PER_SCREEN) {
      this._cullFurthest();
    }
    const tex = this._buildLightTex(source);
    source._tex   = tex;
    source._phase = Math.random() * Math.PI * 2;
    this._lights.set(source.id, source);
  }

  removeLight(id: string): void {
    const light = this._lights.get(id);
    if (!light) return;
    light._tex?.destroy();
    this._lights.delete(id);
  }

  setPlayerPosition(x: number, y: number): void {
    const pl = this._lights.get(this._playerLightId);
    if (pl) {
      pl.x = x;
      pl.y = y;
    }
  }

  /** Set player light radius (upgrades: lantern, Luma Moth pet, etc.) */
  setPlayerLightRadius(radius: number): void {
    this._playerLightRadius = radius;
    const pl = this._lights.get(this._playerLightId);
    if (!pl) return;
    pl.radius = radius;
    pl._tex?.destroy();
    pl._tex = this._buildLightTex(pl);
  }

  // ── Shadow casters ────────────────────────────────────────────────────

  addShadowCaster(
    id: string,
    sprite: Phaser.Physics.Arcade.Sprite | Phaser.Physics.Arcade.Image,
  ): void {
    const shadow = this._scene.add.image(sprite.x, sprite.y, sprite.texture.key)
      .setOrigin(0.5, 0)
      .setDisplaySize(sprite.displayWidth, 4)
      .setTint(this._shadowColor)
      .setAlpha(0.35)
      .setDepth(DEPTH.GAME - 1);

    this._shadows.set(id, { sprite, shadow });
  }

  removeShadowCaster(id: string): void {
    const caster = this._shadows.get(id);
    caster?.shadow.destroy();
    this._shadows.delete(id);
  }

  // ── Update ────────────────────────────────────────────────────────────

  update(delta: number): void {
    this._tick++;
    if (this._tick % PERF.LIGHTING_TICK_FRAMES !== 0) return;

    const cam = this._scene.cameras.main;

    this._lights.forEach(light => {
      if (!light._tex) return;

      // Flicker
      if (light.flicker) {
        light._phase += (light.flicker.frequency * Math.PI * 2 * PERF.LIGHTING_TICK_FRAMES) / 60;
        const flick = 1 + Math.sin(light._phase) * light.flicker.amplitude;
        light._tex.setScale(flick);
      }

      // Position: convert world → screen
      const screenX = light.x - cam.scrollX;
      const screenY = light.y - cam.scrollY;
      light._tex.setPosition(screenX, screenY);
    });

    // Update shadows (runs every tick — lightweight)
    this._shadows.forEach(caster => {
      const { sprite, shadow } = caster;
      shadow.setPosition(Math.round(sprite.x), Math.round(sprite.y + sprite.displayHeight / 2));
      shadow.setAlpha(0.35 * sprite.alpha);
    });
  }

  destroy(): void {
    this._lights.forEach(l => l._tex?.destroy());
    this._lights.clear();
    this._shadows.forEach(c => c.shadow.destroy());
    this._shadows.clear();
    this._overlay.destroy();
  }

  // ── Build ─────────────────────────────────────────────────────────────

  private _buildOverlay(): void {
    const { width, height } = this._scene.scale;
    this._overlay = this._scene.add
      .rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.LIGHTING)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Player light — always exists
    const playerLight: LightSource = {
      id:        this._playerLightId,
      x:         width / 2,
      y:         height / 2,
      radius:    this._playerLightRadius,
      color:     LIGHT_COLORS.torch,
      intensity: 0.85,
      flicker:   { amplitude: 0.02, frequency: 0.3 },
      _phase:    0,
    };
    this.addLight(playerLight);
  }

  private _buildLightTex(source: LightSource): Phaser.GameObjects.RenderTexture {
    const d   = source.radius * 2;
    const tex = this._scene.add.renderTexture(source.x, source.y, d, d)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.LIGHTING + 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(source.intensity);

    // Draw radial gradient
    const gfx = this._scene.make.graphics({ x: 0, y: 0 });
    const r = source.radius;
    const steps = 8;

    for (let i = steps; i >= 0; i--) {
      const pct   = i / steps;
      const alpha = (1 - pct) * source.intensity;
      const stepR = r * pct;
      gfx.fillStyle(source.color, alpha);
      gfx.fillCircle(r, r, stepR);
    }

    tex.draw(gfx, 0, 0);
    gfx.destroy();
    return tex;
  }

  private _cullFurthest(): void {
    // Remove the light furthest from screen center
    const { width, height } = this._scene.scale;
    const cx = width / 2 + this._scene.cameras.main.scrollX;
    const cy = height / 2 + this._scene.cameras.main.scrollY;

    let farthestId = '';
    let farthestDist = -1;

    this._lights.forEach((light, id) => {
      if (id === this._playerLightId) return; // never cull player light
      const dx = light.x - cx;
      const dy = light.y - cy;
      const d  = dx * dx + dy * dy;
      if (d > farthestDist) { farthestDist = d; farthestId = id; }
    });

    if (farthestId) this.removeLight(farthestId);
  }

  // ── Event wiring ──────────────────────────────────────────────────────

  private _wireEvents(): void {
    Bus.on(GameEvent.LIGHT_ADD, (data: unknown) => {
      this.addLight(data as LightSource);
    });

    Bus.on(GameEvent.LIGHT_REMOVE, (data: unknown) => {
      this.removeLight(data as string);
    });

    Bus.on(GameEvent.TORCH_EXTINGUISH, (data: unknown) => {
      this.removeLight(data as string);
    });

    Bus.on(GameEvent.PARRY_PERFECT, () => {
      // Gold burst — 1f point light at player position
      const pl = this._lights.get(this._playerLightId);
      if (!pl) return;
      const burst: LightSource = {
        id: '__parry_burst', x: pl.x, y: pl.y,
        radius: 60, color: LIGHT_COLORS.perfect_parry, intensity: 1.0, _phase: 0,
      };
      this.addLight(burst);
      this._scene.time.delayedCall(80, () => this.removeLight('__parry_burst'));
    });

    Bus.on(GameEvent.BOSS_KILLED, () => {
      // White flash then desaturate — handled by JuiceSystem
      // Lighting: boost all lights briefly
      this._lights.forEach(l => {
        if (!l._tex) return;
        this._scene.tweens.add({
          targets: l._tex, alpha: 1.0, duration: 80, yoyo: true,
          onComplete: () => l._tex?.setAlpha(l.intensity),
        });
      });
    });

    Bus.on(GameEvent.ELEVATION_CHANGE, (data: unknown) => {
      const level = data as number;
      const darknessMap: DarknessLevel[] = [
        'CAVE', 'SURFACE', 'SURFACE', 'DUSK', 'TWILIGHT',
      ];
      this.setDarkness(darknessMap[level] ?? 'SURFACE');
    });
  }
}

import Phaser from 'phaser';
import { SKY, DEPTH, PARALLAX } from '../config/visualConfig';
import { REGION_PALETTES } from '../config/paletteConfig';
import { Bus, GameEvent } from './EventBus';

// ── Sky System — 5 parallax layers, per-region, time-of-day driven ─────────
// Layer order (back to front):
//   0: Base gradient (sky colour)
//   1: Distant clouds / mountains (very slow parallax)
//   2: Near clouds / background structures (medium parallax)
//   3: Atmospheric effects (fog, spores, ash)
//   4: Celestial (stars, moon, sun, void tears)
//
// Rules:
//   - All clouds: procedural pixel art — NOT sprites
//   - Sky redraws only on camera move or weather/region change
//   - Crossfade 3s between regions
//   - Interstitial: cycles all region palettes over 60s

export type SkyRegion =
  | 'ASHFIELDS' | 'VERDENMERE' | 'GREYVEIL'
  | 'GILDSPIRE' | 'VOIDMARSH' | 'UNNAMED_CITY' | 'INTERSTITIAL';

interface SkyLayer {
  rt:          Phaser.GameObjects.RenderTexture;
  scrollRatio: number;
  dirty:       boolean;
}

export class SkySystem {
  private _scene:      Phaser.Scene;
  private _region:     SkyRegion = 'ASHFIELDS';
  private _layers:     SkyLayer[] = [];
  private _stars:      Phaser.GameObjects.Graphics | null = null;
  private _celestial:  Phaser.GameObjects.Graphics | null = null;
  private _starsVisible = false;
  private _interstitialTimer = 0;
  private _interstitialRegions: SkyRegion[] = [
    'ASHFIELDS', 'VERDENMERE', 'GREYVEIL', 'GILDSPIRE', 'VOIDMARSH',
  ];
  private _interstitialIdx = 0;
  private _postSisterSilence = false;
  private _unnamedRevealTimer = 0;

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
    this._buildLayers();
    this._wireEvents();
  }

  // ── Public ────────────────────────────────────────────────────────────

  setRegion(region: SkyRegion, instant = false): void {
    if (region === this._region && !instant) return;

    const prev = this._region;
    this._region = region;

    if (instant) {
      this._redrawAll();
    } else {
      // Cross-fade: build new sky into separate RT, tween alpha
      this._crossfade(prev, region);
    }

    this._updateCelestial();
    Bus.emit(GameEvent.SKY_CHANGE_REGION, region);
  }

  /** Call every frame from scene update. */
  update(delta: number, camScrollX: number, starsVisible: boolean): void {
    // Interstitial cycling
    if (this._region === 'INTERSTITIAL') {
      this._interstitialTimer += delta;
      const cycleMs = SKY.INTERSTITIAL_CYCLE_S * 1000;
      if (this._interstitialTimer >= cycleMs / this._interstitialRegions.length) {
        this._interstitialTimer -= cycleMs / this._interstitialRegions.length;
        this._interstitialIdx = (this._interstitialIdx + 1) % this._interstitialRegions.length;
        this._crossfade(this._region, this._region); // blend within interstitial
      }
    }

    // Unnamed City post-reveal
    if (this._region === 'UNNAMED_CITY' && this._postSisterSilence) {
      this._unnamedRevealTimer += delta;
      if (this._unnamedRevealTimer < 60_000) {
        const pct = this._unnamedRevealTimer / 60_000;
        // Sky colour bleeds from white to violet-gold dusk
        this._blendUnnamedReveal(pct);
      }
    }

    // Parallax scroll
    this._layers.forEach(layer => {
      const scrollX = -(camScrollX * layer.scrollRatio);
      layer.rt.setX(scrollX % this._scene.scale.width);
    });

    // Star twinkle
    if (starsVisible !== this._starsVisible) {
      this._starsVisible = starsVisible;
      if (starsVisible) this._buildStars();
      else { this._stars?.destroy(); this._stars = null; }
    }

    if (this._stars) this._twinkleStars(delta);
  }

  onSisterSilenceKilled(): void {
    this._postSisterSilence = true;
    if (this._region === 'UNNAMED_CITY') {
      Bus.emit(GameEvent.SKY_UNNAMED_REVEAL);
    }
  }

  destroy(): void {
    this._layers.forEach(l => l.rt.destroy());
    this._stars?.destroy();
    this._celestial?.destroy();
  }

  // ── Layer construction ─────────────────────────────────────────────────

  private _buildLayers(): void {
    const { width, height } = this._scene.scale;
    const ratios = [PARALLAX.SKY, PARALLAX.BG_FAR, PARALLAX.BG_MID, 0.5, PARALLAX.SKY];

    for (let i = 0; i < 5; i++) {
      const rt = this._scene.add.renderTexture(0, 0, width * 2, height)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.SKY + i);

      this._layers.push({ rt, scrollRatio: ratios[i] ?? PARALLAX.SKY, dirty: true });
    }

    this._redrawAll();
  }

  private _redrawAll(): void {
    this._drawGradient();
    this._drawClouds(1, 'far');
    this._drawClouds(2, 'near');
    this._drawAtmosphere();
    this._updateCelestial();
  }

  // ── Region-specific gradient ───────────────────────────────────────────

  private _drawGradient(): void {
    const { width, height } = this._scene.scale;
    const layer = this._layers[0];
    if (!layer) return;
    const gfx = this._scene.make.graphics({ x: 0, y: 0 });
    const pal = REGION_PALETTES[this._region] ?? REGION_PALETTES['ASHFIELDS'];
    if (!pal) { gfx.destroy(); return; }

    // Fill with sky colour (simplified gradient — top=sky, bottom=horizon)
    gfx.fillGradientStyle(pal.sky, pal.sky, pal.primary, pal.primary, 1);
    gfx.fillRect(0, 0, width * 2, height);

    layer.rt.clear();
    layer.rt.draw(gfx, 0, 0);
    gfx.destroy();
  }

  // ── Cloud rendering (procedural pixel clusters) ────────────────────────

  private _drawClouds(layerIdx: number, scale: 'far' | 'near'): void {
    const { width, height } = this._scene.scale;
    const layer = this._layers[layerIdx];
    if (!layer) return;
    const gfx = this._scene.make.graphics({ x: 0, y: 0 });
    const pal = REGION_PALETTES[this._region] ?? REGION_PALETTES['ASHFIELDS'];
    if (!pal) { gfx.destroy(); return; }

    const isFar   = scale === 'far';
    const count   = isFar ? 5 : 3;
    const maxSize = isFar ? SKY.CLOUD_MAX_PX * 0.5 : SKY.CLOUD_MAX_PX;
    const minSize = SKY.CLOUD_MIN_PX;
    const yBand   = isFar ? 0.15 : 0.25;

    for (let c = 0; c < count; c++) {
      const cx = (c / count) * width * 2 + Phaser.Math.Between(-30, 30);
      const cy = Phaser.Math.Between(10, height * yBand);
      const cw = Phaser.Math.Between(minSize, maxSize);
      const ch = cw * 0.4;

      this._drawCloudCluster(gfx, cx, cy, cw, ch, pal.mist, pal.shadow);
    }

    layer.rt.clear();
    layer.rt.draw(gfx, 0, 0);
    gfx.destroy();
  }

  private _drawCloudCluster(
    gfx: Phaser.GameObjects.Graphics,
    cx: number, cy: number, cw: number, ch: number,
    lightColor: number, shadowColor: number,
  ): void {
    // Build from overlapping rounded rectangles — pixel art "soft" clouds
    const segments = Math.max(3, Math.floor(cw / 20));
    for (let s = 0; s < segments; s++) {
      const ox   = cx + (s / segments - 0.5) * cw;
      const oy   = cy + Math.sin((s / segments) * Math.PI) * -ch * 0.4;
      const r    = Phaser.Math.Between(8, Math.max(10, cw / segments));
      const isTop = s > 0 && s < segments - 1;
      gfx.fillStyle(isTop ? lightColor : shadowColor, isTop ? 0.9 : 0.6);
      gfx.fillEllipse(ox, oy, r * 2, r);
    }
    // Shadow base
    gfx.fillStyle(shadowColor, 0.4);
    gfx.fillEllipse(cx, cy + ch * 0.3, cw * 0.9, ch * 0.25);
  }

  // ── Atmospheric effects ────────────────────────────────────────────────

  private _drawAtmosphere(): void {
    const { width, height } = this._scene.scale;
    const layer = this._layers[3];
    if (!layer) return;
    const gfx = this._scene.make.graphics({ x: 0, y: 0 });
    const pal = REGION_PALETTES[this._region] ?? REGION_PALETTES['ASHFIELDS'];
    if (!pal) { gfx.destroy(); return; }

    // Horizon glow
    gfx.fillGradientStyle(0x000000, 0x000000, pal.accent, pal.accent, 0);
    gfx.fillRect(0, height * 0.7, width * 2, height * 0.3);

    layer.rt.clear();
    layer.rt.draw(gfx, 0, 0);
    gfx.destroy();
  }

  // ── Celestial objects ──────────────────────────────────────────────────

  private _updateCelestial(): void {
    this._celestial?.destroy();
    const { width, height } = this._scene.scale;
    const gfx = this._scene.make.graphics({ x: 0, y: 0 });
    gfx.setDepth(DEPTH.SKY + 4);
    gfx.setScrollFactor(0);

    switch (this._region) {
      case 'ASHFIELDS':
        // Dim red sun through smoke
        gfx.fillStyle(0x993300, 0.4);
        gfx.fillCircle(width * 0.6, height * 0.25, 8);
        break;

      case 'VERDENMERE':
        // Sun (day) — drawn by SeasonSystem context
        gfx.fillStyle(0xFFDD88, 1.0);
        gfx.fillCircle(width * 0.7, height * 0.15, 10);
        // Warm rays
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          gfx.fillRect(
            width * 0.7 + Math.cos(angle) * 12,
            height * 0.15 + Math.sin(angle) * 12,
            2, 6,
          );
        }
        break;

      case 'GILDSPIRE':
        // Perfect sun, bright
        gfx.fillStyle(0xFFFFDD, 1.0);
        gfx.fillCircle(width * 0.65, height * 0.12, 12);
        break;

      case 'VOIDMARSH': {
        // Shattered moon — 4 pieces
        const moonPieces: [number, number][] = [[-8, -12], [8, -10], [-10, 5], [9, 8]];
        for (const piece of moonPieces) {
          const ox = piece[0] ?? 0;
          const oy = piece[1] ?? 0;
          gfx.fillStyle(0xCCB0FF, 0.8);
          gfx.fillCircle(width * 0.4 + ox, height * 0.2 + oy, 5);
        }
        break;
      }

      case 'UNNAMED_CITY':
        // Single black dot in white sky
        if (!this._postSisterSilence) {
          gfx.fillStyle(0x000000, 1.0);
          gfx.fillCircle(width / 2, height * 0.1, 1);
        }
        break;
    }

    this._celestial = gfx;
    this._scene.add.existing(gfx);
  }

  // ── Stars ─────────────────────────────────────────────────────────────

  private _buildStars(): void {
    this._stars?.destroy();
    const { width, height } = this._scene.scale;
    const gfx = this._scene.make.graphics({ x: 0, y: 0 });
    gfx.setDepth(DEPTH.SKY + 4).setScrollFactor(0);

    for (let i = 0; i < SKY.STAR_COUNT; i++) {
      const x       = Math.random() * width;
      const y       = Math.random() * height * 0.6;
      const bright  = Math.floor(Math.random() * 3); // 0=dim, 1=mid, 2=bright
      const alpha   = ([0.3, 0.6, 1.0][bright]) ?? 0.3;
      const size    = ([1, 1, 2][bright]) ?? 1;
      gfx.fillStyle(0xE0E8FF, alpha);
      gfx.fillRect(Math.round(x), Math.round(y), size, size);
    }

    this._stars = gfx;
    this._scene.add.existing(gfx);
  }

  private _twinkleStars(_delta: number): void {
    // Stars twinkle individually — handled by random alpha pulse per update
    // For performance: only 10 stars twinkle per frame
    if (!this._stars) return;
    // Note: in production this would animate individual star rects via RT
    // Simplified: random alpha on whole layer
    const baseAlpha = 0.9 + Math.sin(Date.now() * 0.001) * 0.1;
    this._stars.setAlpha(baseAlpha);
  }

  // ── Transitions ────────────────────────────────────────────────────────

  private _crossfade(_from: SkyRegion, _to: SkyRegion): void {
    // Fade old layers out, redraw, fade back in
    const allLayers = this._layers.map(l => l.rt);
    this._scene.tweens.add({
      targets:  allLayers,
      alpha:    0,
      duration: SKY.CROSSFADE_MS / 2,
      ease:     'Power1',
      onComplete: () => {
        this._redrawAll();
        this._scene.tweens.add({
          targets: allLayers, alpha: 1, duration: SKY.CROSSFADE_MS / 2,
        });
      },
    });
  }

  private _blendUnnamedReveal(pct: number): void {
    // White drains → violet-gold dusk emerges
    const layer = this._layers[0];
    if (!layer) return;
    const gfx = this._scene.make.graphics({ x: 0, y: 0 });
    const { width, height } = this._scene.scale;

    // Manual lerp: white (#F5F0E8) → violet-gold dusk
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * pct);
    const topHex = Phaser.Display.Color.GetColor(lerp(245, 30),  lerp(240, 10),  lerp(232, 60));
    const botHex = Phaser.Display.Color.GetColor(lerp(245, 180), lerp(240, 120), lerp(232, 30));

    gfx.fillGradientStyle(topHex, topHex, botHex, botHex, 1);
    gfx.fillRect(0, 0, width * 2, height);
    layer.rt.clear();
    layer.rt.draw(gfx, 0, 0);
    gfx.destroy();
  }

  // ── Event wiring ──────────────────────────────────────────────────────

  private _wireEvents(): void {
    Bus.on(GameEvent.REGION_ENTER, (data: unknown) => {
      this.setRegion(data as SkyRegion);
    });

    Bus.on(GameEvent.BOSS_KILLED, (data: unknown) => {
      const d = data as { id: string };
      if (d.id === 'SisterSilence') this.onSisterSilenceKilled();
    });

    Bus.on(GameEvent.SKY_VOIDBLOOM_HEAL, () => {
      // When all Voidborn in Voidmarsh are killed — sky begins clearing
      if (this._region === 'VOIDMARSH') {
        this._scene.time.delayedCall(1000, () => this.setRegion('VERDENMERE', false));
      }
    });
  }
}

import Phaser from 'phaser';
import { BaseWorldScene, type WorldSceneConfig } from './BaseWorldScene';
import { getWorldArea, getRegionForArea, WORLD_MAP, type WorldAreaConfig, type WorldTransition } from '../config/worldMap';
import { Input, InputAction } from '../systems/InputSystem';
import { Bus, GameEvent }     from '../systems/EventBus';
import { DEPTH }              from '../config/visualConfig';
import { W, H, FONT }        from '../config/Constants';

// ── AreaScene — Generic multi-area scene ────────────────────────────────────
// A single scene class that loads any area by its WorldAreaConfig.
// Receives `{ areaId, spawnX?, spawnY? }` via init data.
// Background at depth 5, player y-sorted between 10-9998.
// Collision grid loaded from JSON — blocks player from walking into buildings.
// Rooms without real backgrounds render a dark placeholder with the room name.

const MOVE_SPEED   = 80;
const FADE_MS      = 500;
const LABEL_LINGER = 800;   // how long "Entering X..." stays visible

interface AreaInitData {
  areaId: string;
  spawnX?: number;
  spawnY?: number;
}

export default class AreaScene extends BaseWorldScene {
  private _area!:      WorldAreaConfig;
  private _player!:    Phaser.Physics.Arcade.Image;
  private _walls!:     Phaser.Physics.Arcade.StaticGroup;
  private _transitioning = false;
  private _lastDirection = 'south';
  // walk bob removed — caused camera vibration. Waiting for God Mode AI sprite sheets.
  private _regionMap:  RegionMapOverlay | null = null;
  private _mKey:       Phaser.Input.Keyboard.Key | null = null;
  private _escKey:     Phaser.Input.Keyboard.Key | null = null;

  constructor() { super({ key: 'AreaScene' }); }

  // ── Init — receive area ID + optional spawn override ──────────────────
  init(data: AreaInitData): void {
    this._area = getWorldArea(data.areaId);
    // Store spawn override on the config object temporarily
    if (data.spawnX !== undefined && data.spawnY !== undefined) {
      this._area = {
        ...this._area,
        playerSpawn: { x: data.spawnX, y: data.spawnY },
      };
    }
    this._transitioning = false;
    this._regionMap = null;
  }

  // ── Create ────────────────────────────────────────────────────────────
  override create(): void {
    const area = this._area;
    const config: WorldSceneConfig = {
      worldWidth:  area.worldW,
      worldHeight: area.worldH,
    };
    super.create(config);

    // ── Background ───────────────────────────────────────────────────
    if (area.hasRealBackground && area.background && this.textures.exists(area.background)) {
      // Real background image (depth 5)
      const bgImage = this.add.image(area.worldW / 2, area.worldH / 2, area.background);
      bgImage.setDisplaySize(area.worldW, area.worldH);
      bgImage.setDepth(5);

      // Ground layer (depth 5, rendered on top of base bg)
      const groundKey = `${area.background}_ground`;
      if (this.textures.exists(groundKey)) {
        const groundImg = this.add.image(area.worldW / 2, area.worldH / 2, groundKey);
        groundImg.setDisplaySize(area.worldW, area.worldH);
        groundImg.setDepth(5);
      }

      // Foreground layer (depth 9999, renders over player)
      const fgKey = `${area.background}_foreground`;
      if (this.textures.exists(fgKey)) {
        const fgImg = this.add.image(area.worldW / 2, area.worldH / 2, fgKey);
        fgImg.setDisplaySize(area.worldW, area.worldH);
        fgImg.setDepth(9999);
      }
    } else {
      // Dark placeholder with room name
      const bg = this.add.graphics();
      bg.fillStyle(0x0a0a12, 1);
      bg.fillRect(0, 0, area.worldW, area.worldH);
      bg.setDepth(5);

      this.add.text(area.worldW / 2, area.worldH / 2, area.name, {
        fontFamily: "'Press Start 2P'", fontSize: '8px',
        color: '#4a4a5a', stroke: '#0a0a0e', strokeThickness: 1,
      }).setOrigin(0.5).setDepth(6);
    }

    // ── Player — small scale to match building proportions ─────────
    this._player = this.physics.add.image(
      area.playerSpawn.x,
      area.playerSpawn.y,
      'hero_idle_0',
    );
    this._player.setScale(0.25); // 128px * 0.25 = 32px — fits doors/buildings properly
    this._player.setAlpha(1.0);  // ALWAYS fully opaque
    this._player.setBlendMode(Phaser.BlendModes.NORMAL);
    this._player.setDepth(area.playerSpawn.y);
    this._player.setCollideWorldBounds(true);
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    body.setDrag(800, 800);
    // Tighter bounds so player doesn't walk off edges into void
    const margin = 20;
    this.physics.world.setBounds(margin, margin, area.worldW - margin * 2, area.worldH - margin * 2);

    this.addYSortable(this._player);
    this.followTarget(this._player);

    // ── Collision walls from JSON grid ──────────────────────────────
    this._walls = this.physics.add.staticGroup();
    this._buildCollisionFromJson(area);

    // ── Input ────────────────────────────────────────────────────────
    Input.init(this);

    // ── Region event ─────────────────────────────────────────────────
    Bus.emit(GameEvent.REGION_ENTER, { region: area.region.toUpperCase() });

    // ── DoF vignette for diorama / tilt-shift feel ────────────────────
    this.cameras.main.postFX.addVignette(0.5, 0.5, 0.9, 0.3);

    // ── Lighting overlay — unifies background art + sprites ─────────
    if (area.lightTint) {
      const lightOverlay = this.add.rectangle(
        area.worldW / 2, area.worldH / 2,
        area.worldW, area.worldH,
        area.lightTint.color, area.lightTint.alpha,
      );
      lightOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
      lightOverlay.setDepth(8); // between ground (5) and sprites (10+)
    }

    // ── Ambient particles ────────────────────────────────────────────
    this._spawnParticles(area);

    // ── Camera fade in ───────────────────────────────────────────────
    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);

    // ── Area name toast ──────────────────────────────────────────────
    this._showAreaName(area.name);

    // ── Region Map (M key) ───────────────────────────────────────────
    this._mKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.M) ?? null;
    this._escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC) ?? null;

    // ── Cleanup ──────────────────────────────────────────────────────
    this.events.once('shutdown', () => {
      this.shutdown();
      Bus.clear(GameEvent.REGION_ENTER);
    });
  }

  // ── Update ────────────────────────────────────────────────────────────
  override update(time: number, delta: number): void {
    super.update(time, delta);
    Input.tick();

    // ── Region map toggle ────────────────────────────────────────────
    if (this._mKey && Phaser.Input.Keyboard.JustDown(this._mKey)) {
      this._toggleRegionMap();
    }
    if (this._escKey && this._regionMap && Phaser.Input.Keyboard.JustDown(this._escKey)) {
      this._closeRegionMap();
    }

    // If region map is open, block movement
    if (this._regionMap) return;

    if (this._transitioning) return;

    // ── Smooth movement — single sprite, NO bob, NO camera shake ────
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    const mv = Input.moveVector();
    body.setVelocity(mv.x * MOVE_SPEED, mv.y * MOVE_SPEED);

    const moving = Math.abs(mv.x) > 0.1 || Math.abs(mv.y) > 0.1;

    if (moving) {
      // 8-direction from movement angle
      const angle = Math.atan2(mv.y, mv.x);
      const deg = ((angle * 180 / Math.PI) + 360) % 360;
      const dirs = ['east', 'south_east', 'south', 'south_west', 'west', 'north_west', 'north', 'north_east'];
      const idx = Math.round(deg / 45) % 8;
      this._lastDirection = dirs[idx] ?? 'south';

      // Use proper 8-direction knight sprite
      const dirKey = `hero_${this._lastDirection}`;
      if (this.textures.exists(dirKey)) {
        this._player.setTexture(dirKey);
      }
      this._player.setFlipX(false);
    } else {
      // Hold last direction
      const idleKey = `hero_${this._lastDirection}`;
      if (this.textures.exists(idleKey)) {
        this._player.setTexture(idleKey);
      }
    }

    // Force alpha — NEVER transparent
    this._player.setAlpha(1.0);

    // ── Transition zone check ────────────────────────────────────────
    const px = this._player.x;
    const py = this._player.y;
    for (const t of this._area.transitions) {
      if (px > t.x && px < t.x + t.w &&
          py > t.y && py < t.y + t.h) {
        this._transitionTo(t);
        return;
      }
    }
  }

  // ── Transition to another area ────────────────────────────────────────
  private _transitionTo(t: WorldTransition): void {
    if (this._transitioning) return;
    this._transitioning = true;

    // Stop player movement
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    // Show transition label
    if (t.label) {
      const label = this.add.text(W / 2, H / 2, t.label + '...', {
        fontFamily: "'Press Start 2P'",
        fontSize: FONT.SM,
        color: '#c8b890',
        stroke: '#0a0a0e',
        strokeThickness: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.UI + 10).setAlpha(0);

      this.tweens.add({
        targets: label,
        alpha: 1,
        duration: 200,
        hold: LABEL_LINGER,
        yoyo: true,
      });
    }

    // Fade out then restart scene with new area
    this.time.delayedCall(300, () => {
      this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart({
          areaId: t.targetArea,
          spawnX: t.targetSpawn.x,
          spawnY: t.targetSpawn.y,
        } satisfies AreaInitData);
      });
    });
  }

  // ── Collision grid from JSON ───────────────────────────────────────────
  private _buildCollisionFromJson(area: WorldAreaConfig): void {
    const key = `${area.id}_collision`;
    const data = this.cache.json.get(key) as {
      cellSize: number; cols: number; rows: number; grid: number[][];
    } | undefined;

    if (!data) return; // no collision map for this area

    const { cellSize, cols, rows, grid } = data;
    // Scale factor: image is 1024px, world is area.worldW (480)
    const scaleX = area.worldW / (cols * cellSize);
    const scaleY = area.worldH / (rows * cellSize);
    const cellW = cellSize * scaleX;
    const cellH = cellSize * scaleY;

    for (let r = 0; r < rows; r++) {
      const row = grid[r];
      if (!row) continue;
      for (let c = 0; c < cols; c++) {
        if (row[c] !== 1) continue; // walkable
        const wx = c * cellW + cellW / 2;
        const wy = r * cellH + cellH / 2;
        const wall = this.add.rectangle(wx, wy, cellW, cellH, 0xff0000, 0)
          .setOrigin(0.5);
        this.physics.add.existing(wall, true); // static body
        this._walls.add(wall);
      }
    }

    // Collide player with walls
    this.physics.add.collider(this._player, this._walls);
    console.log(`[AreaScene] Loaded collision grid for ${area.id}: ${cols}x${rows}`);
  }

  // ── Ambient particles ─────────────────────────────────────────────────
  private _spawnParticles(area: WorldAreaConfig): void {
    const type = area.particles ?? 'none';
    if (type === 'none') return;

    const count = 12;
    const isEmbers = type === 'embers';
    const isFireflies = type === 'fireflies';
    const color = isEmbers ? 0xee8833 : isFireflies ? 0x88ff88 : 0xddccaa;

    for (let i = 0; i < count; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(20, area.worldW - 20),
        Phaser.Math.Between(20, area.worldH - 20),
        Phaser.Math.FloatBetween(0.5, 1.5),
        color,
        Phaser.Math.FloatBetween(0.1, 0.3),
      );
      dot.setDepth(100); // above sprites, below UI

      if (isEmbers) {
        // Embers float upward
        this.tweens.add({
          targets: dot,
          x: `+=${Phaser.Math.Between(-15, 15)}`,
          y: `-=${Phaser.Math.Between(30, 60)}`,
          alpha: { from: 0.3, to: 0 },
          duration: Phaser.Math.Between(3000, 6000),
          yoyo: false,
          repeat: -1,
          delay: Phaser.Math.Between(0, 5000),
          onRepeat: () => {
            dot.setPosition(
              Phaser.Math.Between(20, area.worldW - 20),
              Phaser.Math.Between(area.worldH * 0.5, area.worldH - 20),
            );
          },
        });
      } else if (isFireflies) {
        // Fireflies pulse and drift randomly
        this.tweens.add({
          targets: dot,
          x: `+=${Phaser.Math.Between(-25, 25)}`,
          y: `+=${Phaser.Math.Between(-25, 25)}`,
          alpha: { from: 0.05, to: 0.35 },
          duration: Phaser.Math.Between(2000, 5000),
          yoyo: true,
          repeat: -1,
          delay: Phaser.Math.Between(0, 4000),
        });
      } else {
        // Dust motes drift gently
        this.tweens.add({
          targets: dot,
          x: `+=${Phaser.Math.Between(-30, 30)}`,
          y: `+=${Phaser.Math.Between(-20, 20)}`,
          alpha: { from: 0.1, to: 0.3 },
          duration: Phaser.Math.Between(4000, 8000),
          yoyo: true,
          repeat: -1,
          delay: Phaser.Math.Between(0, 5000),
        });
      }
    }
  }

  // ── Area name toast ───────────────────────────────────────────────────
  private _showAreaName(name: string): void {
    const toast = this.add.text(W / 2, 20, name, {
      fontFamily: "'Press Start 2P'",
      fontSize: FONT.SM,
      color: '#c8b890',
      stroke: '#0a0a0e',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.UI + 5).setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 600,
      hold: 1500,
      yoyo: true,
      onComplete: () => toast.destroy(),
    });
  }

  // ── Region Map ────────────────────────────────────────────────────────
  private _toggleRegionMap(): void {
    if (this._regionMap) {
      this._closeRegionMap();
    } else {
      this._openRegionMap();
    }
  }

  private _openRegionMap(): void {
    this._regionMap = new RegionMapOverlay(this, this._area);
  }

  private _closeRegionMap(): void {
    if (this._regionMap) {
      this._regionMap.destroy();
      this._regionMap = null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RegionMapOverlay — fullscreen overlay showing rooms in current region
// ═══════════════════════════════════════════════════════════════════════════

class RegionMapOverlay {
  private _container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, currentArea: WorldAreaConfig) {
    const region = getRegionForArea(currentArea.id);
    const areaIds = Object.keys(region.areas);

    // ── Fullscreen dark overlay ──────────────────────────────────────
    const bg = scene.add.rectangle(W / 2, H / 2, W, H, 0x0a0a12, 0.92)
      .setScrollFactor(0).setDepth(DEPTH.UI + 20);

    // ── Title ────────────────────────────────────────────────────────
    const title = scene.add.text(W / 2, 10, region.name, {
      fontFamily: "'Press Start 2P'", fontSize: '7px',
      color: '#c8b890', stroke: '#0a0a0e', strokeThickness: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.UI + 21);

    // ── Layout rooms in a grid ───────────────────────────────────────
    // Simple grid layout: up to 5 columns
    const cols = Math.min(5, areaIds.length);
    const rows = Math.ceil(areaIds.length / cols);
    const cellW = 55;
    const cellH = 28;
    const startX = W / 2 - (cols * cellW) / 2 + cellW / 2;
    const startY = 28;

    const roomRects: Map<string, { cx: number; cy: number }> = new Map();
    const items: Phaser.GameObjects.GameObject[] = [bg, title];

    areaIds.forEach((id, i) => {
      const area = region.areas[id];
      if (!area) return;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * cellW;
      const cy = startY + row * cellH;

      roomRects.set(id, { cx, cy });

      const isCurrent = id === currentArea.id;
      const fillColor = isCurrent ? 0xffd60a : 0x3a3a4a;
      const fillAlpha = isCurrent ? 0.8 : 0.5;

      const rect = scene.add.rectangle(cx, cy, 48, 18, fillColor, fillAlpha)
        .setScrollFactor(0).setDepth(DEPTH.UI + 22)
        .setStrokeStyle(1, isCurrent ? 0xffd60a : 0x5a5a6a);
      items.push(rect);

      // Truncate name to fit
      const displayName = area.name.length > 12
        ? area.name.substring(0, 11) + '.'
        : area.name;
      const label = scene.add.text(cx, cy, displayName, {
        fontFamily: "'Press Start 2P'", fontSize: '4px',
        color: isCurrent ? '#0a0a12' : '#8a8a9a',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.UI + 23);
      items.push(label);
    });

    // ── Draw connection lines ────────────────────────────────────────
    const lines = scene.add.graphics()
      .setScrollFactor(0).setDepth(DEPTH.UI + 21);
    lines.lineStyle(1, 0x5a5a6a, 0.4);

    for (const id of areaIds) {
      const area = region.areas[id];
      if (!area) continue;
      const from = roomRects.get(id);
      if (!from) continue;

      for (const t of area.transitions) {
        const to = roomRects.get(t.targetArea);
        if (!to) continue; // target in different region
        lines.lineBetween(from.cx, from.cy, to.cx, to.cy);
      }
    }
    items.push(lines);

    // ── Hint ──────────────────────────────────────────────────────────
    const hint = scene.add.text(W / 2, H - 8, 'M / ESC to close', {
      fontFamily: "'Press Start 2P'", fontSize: '4px',
      color: '#5a5a6a',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.UI + 21);
    items.push(hint);

    this._container = scene.add.container(0, 0, items)
      .setScrollFactor(0).setDepth(DEPTH.UI + 20);
  }

  destroy(): void {
    this._container.destroy(true);
  }
}

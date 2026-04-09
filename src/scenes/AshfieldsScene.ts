import Phaser from 'phaser';
import { BaseWorldScene, type WorldSceneConfig } from './BaseWorldScene';
import { SkySystem }            from '../systems/SkySystem';
import { WeatherSystem }        from '../systems/WeatherSystem';
import { PostFXSystem }         from '../systems/PostFXSystem';
import { Audio }                from '../systems/AudioSystem';
import { Input, InputAction }   from '../systems/InputSystem';
import { Bus, GameEvent }       from '../systems/EventBus';
import { DEPTH }                from '../config/visualConfig';
import { W, H }                 from '../config/Constants';

// ── AshfieldsScene — HD-2D with collision map ───────────────────────────────
// Full 1024x1024 Leonardo AI background. Player walks in walkable zones only.
// Press F2 to toggle collision editor (paint walkable/blocked zones).

// World = 480x480 game pixels. The 1024x1024 image scales to fit.
// Camera viewport is 320x180, so you see ~67% width at a time with scroll at edges.
const WORLD_W = 480;
const WORLD_H = 480;
const MOVE_SPEED = 80;

// Collision grid — 16x16 cells over 480x480 = 30 cells each axis
const GRID_SIZE = 16;
const GRID_COLS = Math.ceil(WORLD_W / GRID_SIZE);  // 30
const GRID_ROWS = Math.ceil(WORLD_H / GRID_SIZE);  // 30

// Version tag — bump to invalidate saved collision data on grid size change
const COLLISION_VERSION = 'v3_480';

export default class AshfieldsScene extends BaseWorldScene {
  private _sky!:      SkySystem;
  private _weather!:  WeatherSystem;
  private _postfx!:   PostFXSystem;
  private _player!:   Phaser.Physics.Arcade.Image;
  private _bgImage!:  Phaser.GameObjects.Image;
  private _fgImage!:  Phaser.GameObjects.Image;

  // Collision grid: true = blocked, false = walkable
  private _collisionGrid: boolean[][] = [];
  private _walls!: Phaser.Physics.Arcade.StaticGroup;

  // Editor mode
  private _editMode = false;
  private _editGraphics!: Phaser.GameObjects.Graphics;
  private _editText!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'AshfieldsScene' }); }

  override create(): void {
    const config: WorldSceneConfig = { worldWidth: WORLD_W, worldHeight: WORLD_H };
    super.create(config);

    // ── HD-2D 3-layer rendering ────────────────────────────────────────
    // Ground layer (depth 5) — roads, floor tiles, below characters
    const groundKey = this.textures.exists('ashfields_ground') ? 'ashfields_ground' : 'ashfields_hub_2';
    this._bgImage = this.add.image(WORLD_W / 2, WORLD_H / 2, groundKey);
    this._bgImage.setDisplaySize(WORLD_W, WORLD_H);
    this._bgImage.setDepth(5);

    // Foreground layer (depth 9999) — rooftops, awnings, renders above characters
    if (this.textures.exists('ashfields_foreground')) {
      this._fgImage = this.add.image(WORLD_W / 2, WORLD_H / 2, 'ashfields_foreground');
      this._fgImage.setDisplaySize(WORLD_W, WORLD_H);
      this._fgImage.setDepth(9999);
    }

    // ── Collision grid — load saved or generate default ───────────────
    this._initCollisionGrid();
    this._walls = this.physics.add.staticGroup();
    this._buildWallsFromGrid();

    // ── Player — spawn dead center of the courtyard area
    this._player = this.physics.add.image(WORLD_W * 0.5, WORLD_H * 0.55, 'hero_idle_0');
    this._player.setDepth(DEPTH.GAME);
    this._player.setCollideWorldBounds(true);
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    body.setDrag(600, 600);
    body.setSize(12, 8);     // smaller hitbox so player fits between buildings
    body.setOffset(10, 22);  // offset to feet area

    this.addYSortable(this._player);
    this.followTarget(this._player);
    this.physics.add.collider(this._player, this._walls);

    // ── Input ─────────────────────────────────────────────────────────
    Input.init(this);

    // ── Systems ───────────────────────────────────────────────────────
    this._sky = new SkySystem(this);
    this._sky.setRegion('ASHFIELDS', true);
    this._weather = new WeatherSystem(this, 'ASHFIELDS', 'autumn');
    this._postfx = new PostFXSystem();
    this._postfx.init(this, {
      bloomEnabled: true, bloomStrength: 0.5, bloomBlur: 2, bloomOffset: 0.8,
      dofEnabled: false, dofRadius: 0, dofAmount: 0,
    });

    Audio.crossfadeToRegion('ashfields');
    Bus.emit(GameEvent.REGION_ENTER, { region: 'ASHFIELDS' });

    // ── Collision editor overlay ──────────────────────────────────────
    this._editGraphics = this.add.graphics();
    this._editGraphics.setDepth(DEPTH.UI + 20);
    this._editGraphics.setVisible(false);

    this._editText = this.add.text(4, 4, '', {
      fontFamily: 'monospace', fontSize: '8px', color: '#00ff00',
      backgroundColor: '#000000aa',
    }).setScrollFactor(0).setDepth(DEPTH.UI + 21).setVisible(false);

    // F2 toggles editor
    this.input.keyboard?.on('keydown-F2', () => this._toggleEditor());

    // ── Death handling ────────────────────────────────────────────────
    Bus.on(GameEvent.PLAYER_DEATH, () => {
      const died = this.add.text(W / 2, H / 2, 'YOU DIED', {
        fontFamily: "'Press Start 2P'", fontSize: '14px',
        color: '#8a2a1a', stroke: '#0a0a0e', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0).setScrollFactor(0).setDepth(500);
      this.tweens.add({
        targets: died, alpha: 1, duration: 1500, hold: 2000,
        onComplete: () => {
          this.cameras.main.fadeOut(1000, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart());
        },
      });
    });

    // ── Cleanup ───────────────────────────────────────────────────────
    this.events.once('shutdown', () => {
      this.shutdown();
      this._sky.destroy();
      this._postfx.destroy();
      Audio.stopAll();
      Bus.clear(GameEvent.REGION_ENTER);
      Bus.clear(GameEvent.PLAYER_DEATH);
    });
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    Input.tick();

    if (this._editMode) {
      this._updateEditor();
      return; // freeze player during editing
    }

    // ── Player movement ───────────────────────────────────────────────
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    const mv = Input.moveVector();
    body.setVelocity(mv.x * MOVE_SPEED, mv.y * MOVE_SPEED);
    if (mv.x < -0.1) this._player.setFlipX(true);
    else if (mv.x > 0.1) this._player.setFlipX(false);

    const cam = this.cameras.main;
    this._sky.update(delta, cam.scrollX, false);
    this._weather.update(delta);
    this._postfx.update(delta);
  }

  // ── Collision Grid ────────────────────────────────────────────────────

  private _initCollisionGrid(): void {
    // Version check — invalidate saved data when grid size changes
    const savedVersion = localStorage.getItem('ashfields_collision_version');
    if (savedVersion === COLLISION_VERSION) {
      const saved = localStorage.getItem('ashfields_collision');
      if (saved) {
        this._collisionGrid = JSON.parse(saved) as boolean[][];
        return;
      }
    } else {
      // Clear stale collision data from old grid size
      localStorage.removeItem('ashfields_collision');
      localStorage.setItem('ashfields_collision_version', COLLISION_VERSION);
    }

    // Default collision for 64x64 grid (16px cells) matching tavern image:
    //   - Top 35% blocked (rooftops)
    //   - Left building: cols 0-6, rows 35%-80%
    //   - Right building: cols 58-63, rows 35%-80%
    //   - Center courtyard open: cols 10-54, rows 40%-85%
    //   - Bottom 10% blocked (image edge)
    this._collisionGrid = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      this._collisionGrid[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const rowPct = row / GRID_ROWS;

        const isRoof = rowPct < 0.35;
        const isBottomEdge = rowPct >= 0.90;
        const isLeftBuilding = col <= 6 && rowPct >= 0.35 && rowPct < 0.80;
        const isRightBuilding = col >= 58 && rowPct >= 0.35 && rowPct < 0.80;

        // Default: blocked unless in the open courtyard zone
        const isCenterOpen = col >= 10 && col <= 54 && rowPct >= 0.40 && rowPct < 0.85;

        // Block everything except the center courtyard and paths
        this._collisionGrid[row]![col] = isRoof || isBottomEdge || isLeftBuilding || isRightBuilding || !isCenterOpen;
      }
    }
  }

  private _buildWallsFromGrid(): void {
    this._walls.clear(true, true);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (this._collisionGrid[row]?.[col]) {
          const x = col * GRID_SIZE + GRID_SIZE / 2;
          const y = row * GRID_SIZE + GRID_SIZE / 2;
          const wall = this.add.rectangle(x, y, GRID_SIZE, GRID_SIZE, 0x000000, 0);
          this.physics.add.existing(wall, true);
          this._walls.add(wall);
        }
      }
    }
  }

  // ── Collision Editor ──────────────────────────────────────────────────

  private _toggleEditor(): void {
    this._editMode = !this._editMode;
    this._editGraphics.setVisible(this._editMode);
    this._editText.setVisible(this._editMode);

    if (this._editMode) {
      this._drawEditorOverlay();
      this._editText.setText('COLLISION EDITOR\nClick: toggle blocked\nF2: exit + save');
    } else {
      // Save and rebuild
      localStorage.setItem('ashfields_collision', JSON.stringify(this._collisionGrid));
      localStorage.setItem('ashfields_collision_version', COLLISION_VERSION);
      this._buildWallsFromGrid();
      // Re-add collider
      this.physics.add.collider(this._player, this._walls);
      this._editGraphics.clear();
    }
  }

  private _drawEditorOverlay(): void {
    this._editGraphics.clear();
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x = col * GRID_SIZE;
        const y = row * GRID_SIZE;
        if (this._collisionGrid[row]?.[col]) {
          // Blocked — red overlay
          this._editGraphics.fillStyle(0xff0000, 0.3);
          this._editGraphics.fillRect(x, y, GRID_SIZE, GRID_SIZE);
        }
        // Grid lines
        this._editGraphics.lineStyle(0.5, 0xffffff, 0.15);
        this._editGraphics.strokeRect(x, y, GRID_SIZE, GRID_SIZE);
      }
    }
  }

  private _updateEditor(): void {
    const pointer = this.input.activePointer;
    if (pointer.isDown) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const col = Math.floor(worldPoint.x / GRID_SIZE);
      const row = Math.floor(worldPoint.y / GRID_SIZE);

      if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
        // Toggle on first click, then paint with the same value while dragging
        if ((pointer as unknown as { justDown: boolean }).justDown) {
          this._collisionGrid[row]![col] = !this._collisionGrid[row]![col];
        } else {
          // Paint mode — use whatever the first click set
        }
        this._drawEditorOverlay();
      }
    }
  }
}

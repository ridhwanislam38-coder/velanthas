import Phaser from 'phaser';
import { BaseWorldScene, type WorldSceneConfig } from './BaseWorldScene';
import { LightingSystem }       from '../systems/LightingSystem';
import { SkySystem }            from '../systems/SkySystem';
import { WeatherSystem }        from '../systems/WeatherSystem';
import { OccluderSystem }       from '../systems/OccluderSystem';
import { PostFXSystem }         from '../systems/PostFXSystem';
import { Audio }                from '../systems/AudioSystem';
import { Input, InputAction }   from '../systems/InputSystem';
import { Bus, GameEvent }       from '../systems/EventBus';
import { DEPTH }                from '../config/visualConfig';
import { W, H }                 from '../config/Constants';
import { generateMap, renderMap } from '../systems/ProceduralMapSystem';

// ── AshfieldsScene — first birds-eye region ─────────────────────────────────
// Build-queue item 07. This is the template all future region scenes copy.
//
// Assets expected (from AI tool pipelines, stubbed until sourced):
//   maps/ashfields.ldtk   — LDtk tilemap (32×32 grid)
//   assets/sprites/ashfields_tiles.png — RetroDiffusion tileset
//   assets/audio/ambient/ashfields_bed.webm — FreeSound wind bed
//   assets/audio/ambient/ashfields_layer.webm — FreeSound distant bells
//   assets/audio/voice/magistra_eon_*.mp3 — ElevenLabs voice lines

// ── World dimensions — large enough for a full region ───────────────────
const WORLD_W = 2560;  // 80 tiles wide — room for a city
const WORLD_H = 1920;  // 60 tiles tall

// ── Player movement (birds-eye, no gravity) ─────────────────────────────
const MOVE_SPEED = 120; // px/s

export default class AshfieldsScene extends BaseWorldScene {
  // Systems
  // Lighting disabled for outdoor daylight scenes
  private _lighting: LightingSystem | null = null;
  private _sky!:      SkySystem;
  private _weather!:  WeatherSystem;
  private _occluder!: OccluderSystem;
  private _postfx!:   PostFXSystem;

  // Player (temp: physics image until Player entity is refactored for birds-eye)
  private _player!: Phaser.Physics.Arcade.Image;

  constructor() { super({ key: 'AshfieldsScene' }); }

  override create(): void {
    const config: WorldSceneConfig = {
      worldWidth:  WORLD_W,
      worldHeight: WORLD_H,
    };
    super.create(config);

    // ── HD-2D Parallax Background Layers ──────────────────────────────
    // Layer 0: Far background (mountains/sky) — slow parallax
    if (this.textures.exists('ashfields_bg_far')) {
      const bgFar = this.add.image(WORLD_W / 2, WORLD_H * 0.3, 'ashfields_bg_far');
      bgFar.setDisplaySize(WORLD_W * 1.4, WORLD_H * 0.7);
      bgFar.setDepth(DEPTH.BG_FAR);
      bgFar.setScrollFactor(0.15);  // moves very slowly — distant feel
      bgFar.setAlpha(0.8);
    } else {
      // Gradient fallback
      const skyGrad = this.add.graphics();
      skyGrad.fillGradientStyle(0x1a1520, 0x1a1520, 0x2a1a0e, 0x2a1a0e, 1);
      skyGrad.fillRect(0, 0, WORLD_W, WORLD_H);
      skyGrad.setDepth(DEPTH.BG_FAR);
      skyGrad.setScrollFactor(0.15);
    }

    // Layer 1: Mid background (ruins/structures) — medium parallax
    if (this.textures.exists('ashfields_bg_mid')) {
      const bgMid = this.add.image(WORLD_W / 2, WORLD_H * 0.5, 'ashfields_bg_mid');
      bgMid.setDisplaySize(WORLD_W * 1.2, WORLD_H * 0.6);
      bgMid.setDepth(DEPTH.BG_MID);
      bgMid.setScrollFactor(0.35);  // moves at medium speed
      bgMid.setAlpha(0.6);
    }

    // Layer 2: Ground base color — below map tiles but above parallax
    const groundBase = this.add.graphics();
    groundBase.fillStyle(0x2a1e14, 1); // slightly lighter so tiles contrast
    groundBase.fillRect(0, 0, WORLD_W, WORLD_H);
    groundBase.setDepth(DEPTH.BG_PROPS);

    // ── Procedural map generation ───────────────────────────────────────
    const mapData = generateMap('ASHFIELDS', WORLD_W / 32, WORLD_H / 32, 32, 42);
    const mapOccluders = renderMap(this, mapData);

    // ── Environmental props ────────────────────────────────────────────
    // Bonfires near player spawn
    const spawnX = mapData.playerSpawn.x;
    const spawnY = mapData.playerSpawn.y;
    const bonfireOffsets = [
      { dx: -48, dy: -32 }, { dx: 56, dy: 16 }, { dx: -24, dy: 48 },
      { dx: 64, dy: -40 }, { dx: 0, dy: 64 },
    ];
    for (const off of bonfireOffsets) {
      if (this.textures.exists('env_bonfire')) {
        const bf = this.add.image(spawnX + off.dx, spawnY + off.dy, 'env_bonfire');
        bf.setDepth(DEPTH.GAME);
      }
    }
    // Dead trees along map edges
    const treePositions = [
      { x: 32, y: 48 }, { x: 96, y: 32 }, { x: WORLD_W - 48, y: 64 },
      { x: WORLD_W - 80, y: WORLD_H - 48 }, { x: 48, y: WORLD_H - 32 },
      { x: WORLD_W / 2 - 80, y: 40 }, { x: WORLD_W / 2 + 100, y: WORLD_H - 40 },
      { x: 64, y: WORLD_H / 2 },
    ];
    for (const pos of treePositions) {
      if (this.textures.exists('env_dead_tree')) {
        const tree = this.add.image(pos.x, pos.y, 'env_dead_tree');
        tree.setDepth(DEPTH.GAME);
      }
    }
    // Ruined walls as decoration
    const wallPositions = [
      { x: WORLD_W / 4, y: WORLD_H / 4 },
      { x: (WORLD_W * 3) / 4, y: WORLD_H / 3 },
      { x: WORLD_W / 3, y: (WORLD_H * 3) / 4 },
      { x: (WORLD_W * 2) / 3, y: (WORLD_H * 2) / 3 },
    ];
    for (const pos of wallPositions) {
      if (this.textures.exists('env_ruin_wall')) {
        const wall = this.add.image(pos.x, pos.y, 'env_ruin_wall');
        wall.setDepth(DEPTH.GAME);
      }
    }

    // ── Player ────────────────────────────────────────────────────────
    this._player = this.physics.add.image(mapData.playerSpawn.x, mapData.playerSpawn.y, 'hero_idle_0');
    this._player.setDepth(DEPTH.GAME);
    // No scale — 32x32 sprite at native pixel resolution (like Triangle Strategy)
    this._player.setCollideWorldBounds(true);
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    body.setDrag(600, 600);

    // Register for y-sort + camera follow
    this.addYSortable(this._player);
    this.followTarget(this._player);

    // No zoom — 320x180 internal res shows a wide view of the world (HD-2D style)

    // ── Input ─────────────────────────────────────────────────────────
    Input.init(this);

    // ── Systems ───────────────────────────────────────────────────────
    this._sky      = new SkySystem(this);
    this._sky.setRegion('ASHFIELDS', true);
    // Lighting disabled for outdoor daylight — no darkness overlay, no radial glow
    // this._lighting = new LightingSystem(this);
    this._weather  = new WeatherSystem(this, 'ASHFIELDS', 'autumn');
    this._occluder = new OccluderSystem();
    this._occluder.setPlayer(this._player);

    // PostFX: subtle only — no heavy bloom that washes out the scene
    this._postfx = new PostFXSystem();
    this._postfx.init(this, { bloomEnabled: false, dofEnabled: false, dofRadius: 0, dofAmount: 0 });

    // ── Ambient audio ─────────────────────────────────────────────────
    Audio.crossfadeToRegion('ashfields');

    // ── Region enter event ────────────────────────────────────────────
    Bus.emit(GameEvent.REGION_ENTER, { region: 'ASHFIELDS' });

    // ── Register procedural map occluders ──────────────────────────────
    for (const occ of mapOccluders) {
      this._occluder.addOccluder(occ);
    }

    // ── Death handling ─────────────────────────────────────────────────
    Bus.on(GameEvent.PLAYER_DEATH, () => {
      // "YOU DIED" text
      const died = this.add.text(W / 2, H / 2, 'YOU DIED', {
        fontFamily: "'Press Start 2P'", fontSize: '14px',
        color: '#8a2a1a', stroke: '#0a0a0e', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0).setScrollFactor(0).setDepth(500);

      this.tweens.add({
        targets: died, alpha: 1, duration: 1500, hold: 2000,
        onComplete: () => {
          this.cameras.main.fadeOut(1000, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.restart();
          });
        },
      });
    });

    // ── Cleanup ───────────────────────────────────────────────────────
    this.events.once('shutdown', () => {
      this.shutdown();
      this._sky.destroy();
      this._lighting?.destroy();
      this._occluder.destroy();
      this._postfx.destroy();
      Audio.stopAll();
      Bus.clear(GameEvent.REGION_ENTER);
    });
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);

    Input.tick();

    // ── Player movement (birds-eye) ───────────────────────────────────
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    const mv = Input.moveVector();
    body.setVelocity(mv.x * MOVE_SPEED, mv.y * MOVE_SPEED);

    // Facing
    if (mv.x < -0.1) this._player.setFlipX(true);
    else if (mv.x > 0.1) this._player.setFlipX(false);

    // ── Systems ───────────────────────────────────────────────────────
    const cam = this.cameras.main;
    this._sky.update(delta, cam.scrollX, false);
    this._weather.update(delta);
    this._occluder.update();
    this._postfx.update(delta);
    this._lighting?.update(delta);
  }

}

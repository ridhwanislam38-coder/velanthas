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

// ── World dimensions (stub — will come from LDtk map once authored) ─────
const WORLD_W = 640;   // 20 tiles wide
const WORLD_H = 480;   // 15 tiles tall

// ── Player movement (birds-eye, no gravity) ─────────────────────────────
const MOVE_SPEED = 100; // px/s

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

    // ── Procedural map generation ───────────────────────────────────────
    const mapData = generateMap('ASHFIELDS', WORLD_W / 32, WORLD_H / 32, 32, 42);
    const mapOccluders = renderMap(this, mapData);

    // ── Player ────────────────────────────────────────────────────────
    this._player = this.physics.add.image(mapData.playerSpawn.x, mapData.playerSpawn.y, 'hero_idle_0');
    this._player.setDepth(DEPTH.GAME);
    this._player.setCollideWorldBounds(true);
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    body.setDrag(600, 600);

    // Register for y-sort + camera follow
    this.addYSortable(this._player);
    this.followTarget(this._player);

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

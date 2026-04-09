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

// ── GildspireScene — wealthy merchant city region ───────────────────────────
// Gold/warm palette. Clear weather. Largest region (960x720).
// Market stalls, tall guild buildings. Ambient NPC-sized rectangles (placeholder crowd).

const WORLD_W = 960;
const WORLD_H = 720;
const MOVE_SPEED = 100;

export default class GildspireScene extends BaseWorldScene {
  private _lighting!: LightingSystem;
  private _sky!:      SkySystem;
  private _weather!:  WeatherSystem;
  private _occluder!: OccluderSystem;
  private _postfx!:   PostFXSystem;
  private _player!:   Phaser.Physics.Arcade.Image;

  constructor() { super({ key: 'GildspireScene' }); }

  override create(): void {
    const config: WorldSceneConfig = {
      worldWidth:  WORLD_W,
      worldHeight: WORLD_H,
    };
    super.create(config);

    // ── Ground fill (placeholder — LDtk tilemap later) ────────────────
    const bg = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x3a2a10);
    bg.setDepth(DEPTH.SKY);

    // ── Player ────────────────────────────────────────────────────────
    this._player = this.physics.add.image(WORLD_W / 2, WORLD_H / 2, 'hero_idle_0');
    this._player.setDepth(DEPTH.GAME);
    this._player.setCollideWorldBounds(true);
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    body.setDrag(600, 600);

    this.addYSortable(this._player);
    this.followTarget(this._player);

    // ── Input ─────────────────────────────────────────────────────────
    Input.init(this);

    // ── Systems ───────────────────────────────────────────────────────
    this._sky = new SkySystem(this);
    this._sky.setRegion('GILDSPIRE', true);
    this._lighting = new LightingSystem(this);
    this._weather  = new WeatherSystem(this, 'GILDSPIRE', 'summer');
    this._occluder = new OccluderSystem();
    this._occluder.setPlayer(this._player);

    this._postfx = new PostFXSystem();
    this._postfx.init(this, {
      bloomEnabled: true,
      bloomStrength: 1.0,
      dofEnabled: true,
      dofRadius: 0.3,
      dofAmount: 0.6,
    });

    // ── Ambient audio ─────────────────────────────────────────────────
    Audio.crossfadeToRegion('gildspire');

    // ── Region enter ──────────────────────────────────────────────────
    Bus.emit(GameEvent.REGION_ENTER, { region: 'GILDSPIRE' });

    // ── Placeholder occluders (market stalls, guild buildings) ─────────
    this._spawnPlaceholderOccluders();

    // ── Ambient NPC placeholders (crowd feel) ─────────────────────────
    this._spawnAmbientNPCs();

    // ── Cleanup ───────────────────────────────────────────────────────
    this.events.once('shutdown', () => {
      this.shutdown();
      this._sky.destroy();
      this._lighting.destroy();
      this._occluder.destroy();
      this._postfx.destroy();
      Audio.stopAll();
    });
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    Input.tick();

    const body = this._player.body as Phaser.Physics.Arcade.Body;
    const mv = Input.moveVector();
    body.setVelocity(mv.x * MOVE_SPEED, mv.y * MOVE_SPEED);
    if (mv.x < -0.1) this._player.setFlipX(true);
    else if (mv.x > 0.1) this._player.setFlipX(false);

    const cam = this.cameras.main;
    this._sky.update(delta, cam.scrollX, false);
    this._weather.update(delta);
    this._occluder.update();
    this._postfx.update(delta);
    this._lighting.update(delta);
  }

  // ── Placeholder content ───────────────────────────────────────────────

  private _spawnPlaceholderOccluders(): void {
    // Market stalls
    const stalls = [
      { x: 200, y: 250, w: 48, h: 32 },
      { x: 400, y: 300, w: 48, h: 32 },
      { x: 600, y: 200, w: 48, h: 32 },
      { x: 750, y: 450, w: 48, h: 32 },
    ];
    for (const s of stalls) {
      const stall = this.add.rectangle(s.x, s.y, s.w, s.h, 0x8a6a2a);
      stall.setOrigin(0.5, 1.0);
      stall.setDepth(DEPTH.OCCLUDERS);
      this._occluder.addOccluder(stall as unknown as Phaser.GameObjects.Image);
    }

    // Tall guild buildings
    const buildings = [
      { x: 150, y: 400, w: 56, h: 96 },
      { x: 500, y: 550, w: 64, h: 112 },
      { x: 800, y: 300, w: 56, h: 96 },
      { x: 350, y: 600, w: 64, h: 104 },
    ];
    for (const b of buildings) {
      const bldg = this.add.rectangle(b.x, b.y, b.w, b.h, 0x6a5a3a);
      bldg.setOrigin(0.5, 1.0);
      bldg.setDepth(DEPTH.OCCLUDERS);
      this._occluder.addOccluder(bldg as unknown as Phaser.GameObjects.Image);
    }
  }

  private _spawnAmbientNPCs(): void {
    // Scattered NPC-sized rectangles — stationary, placeholder crowd feel
    const npcPositions = [
      { x: 250, y: 280 }, { x: 420, y: 340 }, { x: 580, y: 220 },
      { x: 700, y: 480 }, { x: 320, y: 520 }, { x: 850, y: 350 },
      { x: 130, y: 450 }, { x: 460, y: 620 }, { x: 680, y: 160 },
      { x: 550, y: 500 },
    ];
    for (const pos of npcPositions) {
      const npc = this.add.rectangle(pos.x, pos.y, 10, 16, 0x9a7a4a, 0.7);
      npc.setOrigin(0.5, 1.0);
      npc.setDepth(DEPTH.GAME);
      this.addYSortable(npc);
    }
  }
}

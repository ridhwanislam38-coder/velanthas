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

// ── UnnamedCityScene — secret final region ──────────────────────────────────
// Stark white + dark contrast. Accord white (#F5F0E8). No weather. No particles.
// Eerie, almost empty. Silence is the atmosphere.

const WORLD_W = 480;
const WORLD_H = 480;
const MOVE_SPEED = 100;

// Accord white — the signature pale of the Unnamed City
const ACCORD_WHITE = 0xF5F0E8;

export default class UnnamedCityScene extends BaseWorldScene {
  private _lighting!: LightingSystem;
  private _sky!:      SkySystem;
  private _weather!:  WeatherSystem;
  private _occluder!: OccluderSystem;
  private _postfx!:   PostFXSystem;
  private _player!:   Phaser.Physics.Arcade.Image;

  constructor() { super({ key: 'UnnamedCityScene' }); }

  override create(): void {
    const config: WorldSceneConfig = {
      worldWidth:  WORLD_W,
      worldHeight: WORLD_H,
    };
    super.create(config);

    // ── Ground fill (stark dark — contrast with white occluders) ──────
    const bg = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x0a0a0e);
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
    this._sky.setRegion('UNNAMED_CITY', true);
    this._lighting = new LightingSystem(this);
    this._weather  = new WeatherSystem(this, 'UNNAMED_CITY', 'summer');
    this._occluder = new OccluderSystem();
    this._occluder.setPlayer(this._player);

    this._postfx = new PostFXSystem();
    this._postfx.init(this, {
      bloomEnabled: false,
      dofEnabled: false,
    });

    // ── Ambient audio ─────────────────────────────────────────────────
    Audio.crossfadeToRegion('unnamed_city');

    // ── Region enter ──────────────────────────────────────────────────
    Bus.emit(GameEvent.REGION_ENTER, { region: 'UNNAMED_CITY' });

    // ── Placeholder occluders (broken pillars — Accord white tint) ────
    this._spawnPlaceholderOccluders();

    // No particles — silence is the atmosphere.

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
    // A few broken pillars — deliberately sparse for eerie emptiness
    const pillars = [
      { x: 160, y: 200 },
      { x: 340, y: 350 },
      { x: 280, y: 140 },
    ];
    for (const pos of pillars) {
      const pillar = this.add.rectangle(pos.x, pos.y, 16, 56, ACCORD_WHITE);
      pillar.setOrigin(0.5, 1.0);
      pillar.setDepth(DEPTH.OCCLUDERS);
      this._occluder.addOccluder(pillar as unknown as Phaser.GameObjects.Image);
    }
  }
}

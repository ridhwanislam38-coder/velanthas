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

// ── GreyveilScene — haunted ruins region ────────────────────────────────────
// Gray/blue palette. Crumbled walls and broken archways. Rain weather.
// Ghost-wisp particles instead of fireflies — white, very low alpha, slow drift.

const WORLD_W = 800;
const WORLD_H = 600;
const MOVE_SPEED = 100;

export default class GreyveilScene extends BaseWorldScene {
  private _lighting!: LightingSystem;
  private _sky!:      SkySystem;
  private _weather!:  WeatherSystem;
  private _occluder!: OccluderSystem;
  private _postfx!:   PostFXSystem;
  private _player!:   Phaser.Physics.Arcade.Image;

  constructor() { super({ key: 'GreyveilScene' }); }

  override create(): void {
    const config: WorldSceneConfig = {
      worldWidth:  WORLD_W,
      worldHeight: WORLD_H,
    };
    super.create(config);

    // ── Ground fill (placeholder — LDtk tilemap later) ────────────────
    const bg = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x1a1e2a);
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
    this._sky.setRegion('GREYVEIL', true);
    this._lighting = new LightingSystem(this);
    this._weather  = new WeatherSystem(this, 'GREYVEIL', 'autumn');
    this._occluder = new OccluderSystem();
    this._occluder.setPlayer(this._player);

    this._postfx = new PostFXSystem();
    this._postfx.init(this, {
      bloomEnabled: true,
      bloomStrength: 0.8,
      dofEnabled: true,
      dofRadius: 0.5,
      dofAmount: 1.2,
    });

    // ── Ambient audio ─────────────────────────────────────────────────
    Audio.crossfadeToRegion('greyveil');

    // ── Region enter ──────────────────────────────────────────────────
    Bus.emit(GameEvent.REGION_ENTER, { region: 'GREYVEIL' });

    // ── Placeholder occluders (crumbled walls, broken archways) ───────
    this._spawnPlaceholderOccluders();

    // ── Ghost-wisp particles ──────────────────────────────────────────
    this._spawnGhostWisps();

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
    // Crumbled walls
    const walls = [
      { x: 180, y: 160, w: 64, h: 48 },
      { x: 500, y: 280, w: 72, h: 40 },
      { x: 650, y: 450, w: 56, h: 52 },
    ];
    for (const p of walls) {
      const wall = this.add.rectangle(p.x, p.y, p.w, p.h, 0x3a3e4a);
      wall.setOrigin(0.5, 1.0);
      wall.setDepth(DEPTH.OCCLUDERS);
      this._occluder.addOccluder(wall as unknown as Phaser.GameObjects.Image);
    }

    // Broken archways
    const arches = [
      { x: 350, y: 200 },
      { x: 600, y: 140 },
      { x: 200, y: 400 },
    ];
    for (const pos of arches) {
      const arch = this.add.rectangle(pos.x, pos.y, 36, 80, 0x4a4e5a);
      arch.setOrigin(0.5, 1.0);
      arch.setDepth(DEPTH.OCCLUDERS);
      this._occluder.addOccluder(arch as unknown as Phaser.GameObjects.Image);
    }
  }

  private _spawnGhostWisps(): void {
    for (let i = 0; i < 12; i++) {
      const wx = Phaser.Math.Between(40, WORLD_W - 40);
      const wy = Phaser.Math.Between(40, WORLD_H - 40);
      const wisp = this.add.circle(wx, wy, 2, 0xffffff, 0.08);
      wisp.setDepth(DEPTH.PARTICLES);
      this.tweens.add({
        targets: wisp,
        alpha: { from: 0.03, to: 0.12 },
        x: `+=${Phaser.Math.Between(-40, 40)}`,
        y: `+=${Phaser.Math.Between(-30, 30)}`,
        duration: Phaser.Math.Between(5000, 9000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 4000),
      });
    }
  }
}

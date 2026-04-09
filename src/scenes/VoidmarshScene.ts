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

// ── VoidmarshScene — corrupted swamp region ─────────────────────────────────
// Purple/dark palette. Fog weather. Twisted trees, void crystals.
// Slow-pulsing purple particles.

const WORLD_W = 640;
const WORLD_H = 640;
const MOVE_SPEED = 100;

export default class VoidmarshScene extends BaseWorldScene {
  private _lighting!: LightingSystem;
  private _sky!:      SkySystem;
  private _weather!:  WeatherSystem;
  private _occluder!: OccluderSystem;
  private _postfx!:   PostFXSystem;
  private _player!:   Phaser.Physics.Arcade.Image;

  constructor() { super({ key: 'VoidmarshScene' }); }

  override create(): void {
    const config: WorldSceneConfig = {
      worldWidth:  WORLD_W,
      worldHeight: WORLD_H,
    };
    super.create(config);

    // ── Ground fill (placeholder — LDtk tilemap later) ────────────────
    const bg = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x1a0a2a);
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
    this._sky.setRegion('VOIDMARSH', true);
    this._lighting = new LightingSystem(this);
    this._weather  = new WeatherSystem(this, 'VOIDMARSH', 'autumn');
    this._occluder = new OccluderSystem();
    this._occluder.setPlayer(this._player);

    this._postfx = new PostFXSystem();
    this._postfx.init(this, {
      bloomEnabled: true,
      bloomStrength: 1.8,
      dofEnabled: true,
      dofRadius: 0.6,
      dofAmount: 1.4,
    });

    // ── Ambient audio ─────────────────────────────────────────────────
    Audio.crossfadeToRegion('voidmarsh');

    // ── Region enter ──────────────────────────────────────────────────
    Bus.emit(GameEvent.REGION_ENTER, { region: 'VOIDMARSH' });

    // ── Placeholder occluders (twisted trees, void crystals) ──────────
    this._spawnPlaceholderOccluders();

    // ── Slow-pulsing purple particles ─────────────────────────────────
    this._spawnVoidParticles();

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
    // Twisted trees
    const trees = [
      { x: 120, y: 200 },
      { x: 350, y: 150 },
      { x: 500, y: 400 },
      { x: 180, y: 500 },
    ];
    for (const pos of trees) {
      const tree = this.add.rectangle(pos.x, pos.y, 28, 72, 0x2a1a3a);
      tree.setOrigin(0.5, 1.0);
      tree.setDepth(DEPTH.OCCLUDERS);
      this._occluder.addOccluder(tree as unknown as Phaser.GameObjects.Image);
    }

    // Void crystals
    const crystals = [
      { x: 280, y: 320 },
      { x: 450, y: 250 },
      { x: 550, y: 550 },
    ];
    for (const pos of crystals) {
      const crystal = this.add.rectangle(pos.x, pos.y, 20, 40, 0x6a2a8a);
      crystal.setOrigin(0.5, 1.0);
      crystal.setDepth(DEPTH.OCCLUDERS);
      this._occluder.addOccluder(crystal as unknown as Phaser.GameObjects.Image);
    }
  }

  private _spawnVoidParticles(): void {
    for (let i = 0; i < 10; i++) {
      const px = Phaser.Math.Between(30, WORLD_W - 30);
      const py = Phaser.Math.Between(30, WORLD_H - 30);
      const dot = this.add.circle(px, py, 2.5, 0x8844cc, 0.3);
      dot.setDepth(DEPTH.PARTICLES);
      this.tweens.add({
        targets: dot,
        alpha: { from: 0.1, to: 0.5 },
        scaleX: { from: 0.8, to: 1.4 },
        scaleY: { from: 0.8, to: 1.4 },
        x: `+=${Phaser.Math.Between(-20, 20)}`,
        y: `+=${Phaser.Math.Between(-15, 15)}`,
        duration: Phaser.Math.Between(4000, 7000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
      });
    }
  }
}

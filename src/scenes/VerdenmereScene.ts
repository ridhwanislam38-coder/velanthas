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

// ── VerdenmereScene — bioluminescent forest region ──────────────────────────
// Second region after Ashfields. Dense canopy, glowing spores, shallow water.
// Enemies: MossWalker, SporeWitch, BriarHound, SongbirdArcher, TheOldGrove (mini-boss)
// Ambient: layered forest + water + distant bird calls

const WORLD_W = 800;
const WORLD_H = 600;
const MOVE_SPEED = 100;

export default class VerdenmereScene extends BaseWorldScene {
  private _lighting!: LightingSystem;
  private _sky!:      SkySystem;
  private _weather!:  WeatherSystem;
  private _occluder!: OccluderSystem;
  private _postfx!:   PostFXSystem;
  private _player!:   Phaser.Physics.Arcade.Image;

  constructor() { super({ key: 'VerdenmereScene' }); }

  override create(): void {
    const config: WorldSceneConfig = {
      worldWidth:  WORLD_W,
      worldHeight: WORLD_H,
    };
    super.create(config);

    // ── Ground fill (placeholder — LDtk tilemap later) ────────────────
    const bg = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x0a2a1a);
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
    this._sky.setRegion('VERDENMERE', true);
    this._lighting = new LightingSystem(this);
    this._weather  = new WeatherSystem(this, 'VERDENMERE', 'spring');
    this._occluder = new OccluderSystem();
    this._occluder.setPlayer(this._player);

    this._postfx = new PostFXSystem();
    this._postfx.init(this, {
      bloomEnabled: true,
      bloomStrength: 1.5, // extra bloom for bioluminescence
      dofEnabled: true,
      dofRadius: 0.4,
      dofAmount: 1.0,
    });

    // ── Ambient audio ─────────────────────────────────────────────────
    Audio.crossfadeToRegion('verdenmere');

    // ── Region enter ──────────────────────────────────────────────────
    Bus.emit(GameEvent.REGION_ENTER, { region: 'VERDENMERE' });

    // ── Placeholder occluders (large trees) ───────────────────────────
    const treePositions = [
      { x: 150, y: 200 }, { x: 350, y: 120 }, { x: 550, y: 350 },
      { x: 200, y: 450 }, { x: 650, y: 180 }, { x: 400, y: 500 },
    ];
    for (const pos of treePositions) {
      const tree = this.add.rectangle(pos.x, pos.y, 40, 80, 0x1a3a1a);
      tree.setOrigin(0.5, 1.0);
      tree.setDepth(DEPTH.OCCLUDERS);
      this._occluder.addOccluder(tree as unknown as Phaser.GameObjects.Image);
    }

    // ── Fireflies ─────────────────────────────────────────────────────
    // Using VerdenmereFirefly ambient creatures for atmosphere
    // (spawned here rather than imported to keep scene self-contained)
    for (let i = 0; i < 15; i++) {
      const fx = Phaser.Math.Between(50, WORLD_W - 50);
      const fy = Phaser.Math.Between(50, WORLD_H - 50);
      const dot = this.add.circle(fx, fy, 1.5, 0x88ff44, 0.6);
      dot.setDepth(DEPTH.PARTICLES);
      this.tweens.add({
        targets: dot,
        alpha: { from: 0.2, to: 0.8 },
        x: `+=${Phaser.Math.Between(-30, 30)}`,
        y: `+=${Phaser.Math.Between(-20, 20)}`,
        duration: Phaser.Math.Between(3000, 6000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
      });
    }

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
}

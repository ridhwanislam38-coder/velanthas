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

// ── AshfieldsScene — HD-2D Pre-rendered Background ──────────────────────────
// Uses Leonardo AI-generated isometric background as the world.
// Character walks on top of the pre-rendered scene.
// This is the HD-2D approach: 3D-looking environment + 2D pixel characters.

const MOVE_SPEED = 80; // px/s — slightly slower for exploration feel

export default class AshfieldsScene extends BaseWorldScene {
  private _sky!:      SkySystem;
  private _weather!:  WeatherSystem;
  private _postfx!:   PostFXSystem;
  private _player!:   Phaser.Physics.Arcade.Image;
  private _bgImage!:  Phaser.GameObjects.Image;

  constructor() { super({ key: 'AshfieldsScene' }); }

  override create(): void {
    // ── World sized to fit the background image in game coordinates ────
    // Background images are ~1024px. We display them scaled down to fit
    // the 320x180 game world, then the player walks on top.
    const WORLD_W = 640;
    const WORLD_H = 640;
    const bgKey = this.textures.exists('ashfields_hub_2') ? 'ashfields_hub_2' : 'ashfields_hub_1';

    const config: WorldSceneConfig = {
      worldWidth:  WORLD_W,
      worldHeight: WORLD_H,
    };
    super.create(config);

    // ── HD-2D Background — THE WORLD ──────────────────────────────────
    this._bgImage = this.add.image(WORLD_W / 2, WORLD_H / 2, bgKey);
    this._bgImage.setDisplaySize(WORLD_W, WORLD_H);
    this._bgImage.setDepth(DEPTH.BG_PROPS);

    // ── Collision walls (invisible) — keep player in walkable courtyard ──
    const walls = this.physics.add.staticGroup();

    // Top buildings — block upper 40% of the map
    walls.add(this.add.rectangle(WORLD_W / 2, 100, WORLD_W, 200, 0x000000, 0).setOrigin(0.5));
    // Left building wall
    walls.add(this.add.rectangle(60, WORLD_H / 2, 120, WORLD_H * 0.4, 0x000000, 0).setOrigin(0.5));
    // Right building wall
    walls.add(this.add.rectangle(WORLD_W - 60, WORLD_H / 2, 120, WORLD_H * 0.4, 0x000000, 0).setOrigin(0.5));
    // Bottom edge
    walls.add(this.add.rectangle(WORLD_W / 2, WORLD_H - 20, WORLD_W, 40, 0x000000, 0).setOrigin(0.5));

    // ── Player — spawn in open courtyard area (lower center) ─────────
    this._player = this.physics.add.image(WORLD_W / 2, WORLD_H * 0.65, 'hero_idle_0');
    this._player.setDepth(DEPTH.GAME);
    this._player.setCollideWorldBounds(true);
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    body.setDrag(600, 600);

    this.addYSortable(this._player);
    this.followTarget(this._player);

    // Collide player with walls
    this.physics.add.collider(this._player, walls);

    // ── Input ─────────────────────────────────────────────────────────
    Input.init(this);

    // ── Systems ───────────────────────────────────────────────────────
    this._sky = new SkySystem(this);
    this._sky.setRegion('ASHFIELDS', true);
    this._weather = new WeatherSystem(this, 'ASHFIELDS', 'autumn');

    // Subtle PostFX — gentle bloom for torch lights in the background
    this._postfx = new PostFXSystem();
    this._postfx.init(this, {
      bloomEnabled: true,
      bloomStrength: 0.5,
      bloomBlur: 2,
      bloomOffset: 0.8,
      dofEnabled: false,
      dofRadius: 0,
      dofAmount: 0,
    });

    // ── Ambient audio ─────────────────────────────────────────────────
    Audio.crossfadeToRegion('ashfields');
    Bus.emit(GameEvent.REGION_ENTER, { region: 'ASHFIELDS' });

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
      this._postfx.destroy();
      Audio.stopAll();
      Bus.clear(GameEvent.REGION_ENTER);
      Bus.clear(GameEvent.PLAYER_DEATH);
    });
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    Input.tick();

    // ── Player movement ───────────────────────────────────────────────
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    const mv = Input.moveVector();
    body.setVelocity(mv.x * MOVE_SPEED, mv.y * MOVE_SPEED);

    if (mv.x < -0.1) this._player.setFlipX(true);
    else if (mv.x > 0.1) this._player.setFlipX(false);

    // ── Systems ───────────────────────────────────────────────────────
    const cam = this.cameras.main;
    this._sky.update(delta, cam.scrollX, false);
    this._weather.update(delta);
    this._postfx.update(delta);
  }
}

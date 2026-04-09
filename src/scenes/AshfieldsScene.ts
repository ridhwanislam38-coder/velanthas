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
    // ── Get background image dimensions to set world size ─────────────
    const bgKey = this.textures.exists('ashfields_hub_2') ? 'ashfields_hub_2' : 'ashfields_hub_1';
    const bgTex = this.textures.get(bgKey);
    const bgFrame = bgTex.getSourceImage();
    const bgW = bgFrame.width;
    const bgH = bgFrame.height;

    // World size = background image size (scaled to game resolution)
    // The images are ~1024px, we display at native size so the world IS the image
    const config: WorldSceneConfig = {
      worldWidth:  bgW,
      worldHeight: bgH,
    };
    super.create(config);

    // ── HD-2D Background — THE WORLD ──────────────────────────────────
    this._bgImage = this.add.image(bgW / 2, bgH / 2, bgKey);
    this._bgImage.setDepth(DEPTH.BG_PROPS);

    // ── Player ────────────────────────────────────────────────────────
    this._player = this.physics.add.image(bgW / 2, bgH / 2, 'hero_idle_0');
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
      const died = this.add.text(bgW / 2, bgH / 2, 'YOU DIED', {
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

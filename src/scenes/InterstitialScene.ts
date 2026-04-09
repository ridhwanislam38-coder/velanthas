import Phaser from 'phaser';
import { BaseWorldScene, type WorldSceneConfig } from './BaseWorldScene';
import { LightingSystem }       from '../systems/LightingSystem';
import { SkySystem }            from '../systems/SkySystem';
import { OccluderSystem }       from '../systems/OccluderSystem';
import { PostFXSystem }         from '../systems/PostFXSystem';
import { Audio }                from '../systems/AudioSystem';
import { Input, InputAction }   from '../systems/InputSystem';
import { Bus, GameEvent }       from '../systems/EventBus';
import { DEPTH }                from '../config/visualConfig';
import { W, H }                 from '../config/Constants';

// ── InterstitialScene — where broken things gather ──────────────────────────
// Unlocked after all main quests complete + all lore found (NG+ condition).
// A surreal space that cycles through all region palettes.
// Contains: Edric's echo, the fourth ending hint, The Collector NPC (NG+ secret).

const WORLD_W = 400;
const WORLD_H = 400;
const MOVE_SPEED = 80; // slower — dreamlike

export default class InterstitialScene extends BaseWorldScene {
  private _lighting!: LightingSystem;
  private _sky!:      SkySystem;
  private _occluder!: OccluderSystem;
  private _postfx!:   PostFXSystem;
  private _player!:   Phaser.Physics.Arcade.Image;

  constructor() { super({ key: 'InterstitialScene' }); }

  override create(): void {
    super.create({ worldWidth: WORLD_W, worldHeight: WORLD_H });

    // ── Background — shifting void ────────────────────────────────────
    const bg = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x050508);
    bg.setDepth(DEPTH.SKY);

    // Floating fragments from every region (colored rectangles as placeholders)
    const fragments = [
      { x: 80,  y: 100, color: 0x2a1a0e, label: 'Ashfields' },
      { x: 200, y: 80,  color: 0x0a2a1a, label: 'Verdenmere' },
      { x: 320, y: 120, color: 0x1a1a2a, label: 'Greyveil' },
      { x: 120, y: 280, color: 0x2a2a0a, label: 'Gildspire' },
      { x: 280, y: 300, color: 0x1a0a2a, label: 'Voidmarsh' },
    ];

    for (const frag of fragments) {
      const rect = this.add.rectangle(frag.x, frag.y, 50, 50, frag.color, 0.3);
      rect.setDepth(DEPTH.BG_PROPS);
      // Slow floating animation
      this.tweens.add({
        targets: rect,
        y: `+=${Phaser.Math.Between(-10, 10)}`,
        x: `+=${Phaser.Math.Between(-5, 5)}`,
        alpha: { from: 0.2, to: 0.4 },
        duration: Phaser.Math.Between(4000, 8000),
        yoyo: true,
        repeat: -1,
      });
    }

    // ── Player ────────────────────────────────────────────────────────
    this._player = this.physics.add.image(WORLD_W / 2, WORLD_H / 2, 'hero_idle_0');
    this._player.setDepth(DEPTH.GAME);
    this._player.setCollideWorldBounds(true);
    (this._player.body as Phaser.Physics.Arcade.Body).setDrag(400, 400);

    this.addYSortable(this._player);
    this.followTarget(this._player);

    Input.init(this);

    // ── Systems ───────────────────────────────────────────────────────
    this._sky = new SkySystem(this);
    this._sky.setRegion('INTERSTITIAL', true);
    this._lighting = new LightingSystem(this);
    this._occluder = new OccluderSystem();
    this._occluder.setPlayer(this._player);

    this._postfx = new PostFXSystem();
    this._postfx.init(this, {
      bloomEnabled: true,
      bloomStrength: 2.0,
      dofEnabled: true,
      dofRadius: 0.6,
      dofAmount: 1.5,
    });

    Audio.crossfadeToRegion('interstitial');
    Bus.emit(GameEvent.REGION_ENTER, { region: 'INTERSTITIAL' });

    // ── Void particles — slow, sparse, all colors ─────────────────────
    const colors = [0x2a1a0e, 0x0a2a1a, 0x1a1a2a, 0x2a2a0a, 0x7b2fff];
    for (let i = 0; i < 20; i++) {
      const c = colors[i % colors.length]!;
      const dot = this.add.circle(
        Phaser.Math.Between(20, WORLD_W - 20),
        Phaser.Math.Between(20, WORLD_H - 20),
        Phaser.Math.Between(1, 3), c, 0.4,
      );
      dot.setDepth(DEPTH.PARTICLES);
      this.tweens.add({
        targets: dot,
        alpha: { from: 0.1, to: 0.5 },
        x: `+=${Phaser.Math.Between(-40, 40)}`,
        y: `+=${Phaser.Math.Between(-30, 30)}`,
        duration: Phaser.Math.Between(5000, 10000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 5000),
      });
    }

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
    this._sky.update(delta, cam.scrollX, true); // stars visible
    this._occluder.update();
    this._postfx.update(delta);
    this._lighting.update(delta);
  }
}

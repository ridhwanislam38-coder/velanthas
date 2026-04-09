import Phaser from 'phaser';
import { BaseWorldScene, type WorldSceneConfig } from './BaseWorldScene';
import { getAreaConfig, type AreaConfig, type TransitionConfig } from '../config/areaConfig';
import { Input, InputAction } from '../systems/InputSystem';
import { Bus, GameEvent }     from '../systems/EventBus';
import { DEPTH }              from '../config/visualConfig';
import { W, H, FONT }        from '../config/Constants';

// ── AreaScene — Generic multi-area scene ────────────────────────────────────
// A single scene class that loads any area by its AreaConfig.
// Receives `{ areaId, spawnX?, spawnY? }` via init data.
// Background at depth 5, player y-sorted between 10-9998.
// No collision grid, no foreground layer — player walks freely.

const MOVE_SPEED   = 80;
const FADE_MS      = 500;
const LABEL_LINGER = 800;   // how long "Entering X..." stays visible

interface AreaInitData {
  areaId: string;
  spawnX?: number;
  spawnY?: number;
}

export default class AreaScene extends BaseWorldScene {
  private _area!:      AreaConfig;
  private _player!:    Phaser.Physics.Arcade.Image;
  private _bgImage!:   Phaser.GameObjects.Image;
  private _transitioning = false;

  constructor() { super({ key: 'AreaScene' }); }

  // ── Init — receive area ID + optional spawn override ──────────────────
  init(data: AreaInitData): void {
    this._area = getAreaConfig(data.areaId);
    // Store spawn override on the config object temporarily
    if (data.spawnX !== undefined && data.spawnY !== undefined) {
      this._area = {
        ...this._area,
        playerSpawn: { x: data.spawnX, y: data.spawnY },
      };
    }
    this._transitioning = false;
  }

  // ── Create ────────────────────────────────────────────────────────────
  override create(): void {
    const area = this._area;
    const config: WorldSceneConfig = {
      worldWidth:  area.worldW,
      worldHeight: area.worldH,
    };
    super.create(config);

    // ── Background image (depth 5) ───────────────────────────────────
    this._bgImage = this.add.image(area.worldW / 2, area.worldH / 2, area.background);
    this._bgImage.setDisplaySize(area.worldW, area.worldH);
    this._bgImage.setDepth(5);

    // ── Player — small scale to match building proportions ─────────
    this._player = this.physics.add.image(
      area.playerSpawn.x,
      area.playerSpawn.y,
      'hero_idle_0',
    );
    this._player.setScale(0.35);  // small relative to buildings, like Triangle Strategy
    this._player.setDepth(area.playerSpawn.y); // y-sorted
    this._player.setCollideWorldBounds(true);
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    body.setDrag(800, 800);
    // Tighter bounds so player doesn't walk off edges into void
    const margin = 20;
    this.physics.world.setBounds(margin, margin, area.worldW - margin * 2, area.worldH - margin * 2);

    this.addYSortable(this._player);
    this.followTarget(this._player);

    // ── Input ────────────────────────────────────────────────────────
    Input.init(this);

    // ── Region event ─────────────────────────────────────────────────
    Bus.emit(GameEvent.REGION_ENTER, { region: 'ASHFIELDS' });

    // ── DoF vignette for diorama / tilt-shift feel ────────────────────
    this.cameras.main.postFX.addVignette(0.5, 0.5, 0.9, 0.3);

    // ── Lighting overlay — unifies background art + sprites ─────────
    if (area.lightTint) {
      const lightOverlay = this.add.rectangle(
        area.worldW / 2, area.worldH / 2,
        area.worldW, area.worldH,
        area.lightTint.color, area.lightTint.alpha,
      );
      lightOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
      lightOverlay.setDepth(8); // between ground (5) and sprites (10+)
    }

    // ── Ambient particles ────────────────────────────────────────────
    this._spawnParticles(area);

    // ── Camera fade in ───────────────────────────────────────────────
    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);

    // ── Area name toast ──────────────────────────────────────────────
    this._showAreaName(area.name);

    // ── Cleanup ──────────────────────────────────────────────────────
    this.events.once('shutdown', () => {
      this.shutdown();
      Bus.clear(GameEvent.REGION_ENTER);
    });
  }

  // ── Update ────────────────────────────────────────────────────────────
  override update(time: number, delta: number): void {
    super.update(time, delta);
    Input.tick();

    if (this._transitioning) return;

    // ── 8-directional movement with walk animation ─────────────────
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    const mv = Input.moveVector();
    body.setVelocity(mv.x * MOVE_SPEED, mv.y * MOVE_SPEED);

    const moving = Math.abs(mv.x) > 0.1 || Math.abs(mv.y) > 0.1;

    if (moving) {
      // Pick texture based on dominant direction
      if (Math.abs(mv.x) > Math.abs(mv.y)) {
        // Horizontal dominant — use right sprite, flip for left
        if (this.textures.exists('hero_right')) {
          this._player.setTexture('hero_right');
        }
        this._player.setFlipX(mv.x < 0);
      } else if (mv.y < 0) {
        // Moving up
        if (this.textures.exists('hero_up')) {
          this._player.setTexture('hero_up');
        }
        this._player.setFlipX(false);
      } else {
        // Moving down
        if (this.textures.exists('hero_down')) {
          this._player.setTexture('hero_down');
        }
        this._player.setFlipX(false);
      }
    } else {
      // Idle
      this._player.setTexture('hero_idle_0');
      this._player.setFlipX(false);
    }

    // ── Transition zone check ────────────────────────────────────────
    const px = this._player.x;
    const py = this._player.y;
    for (const t of this._area.transitions) {
      if (px > t.x && px < t.x + t.w &&
          py > t.y && py < t.y + t.h) {
        this._transitionTo(t);
        return;
      }
    }
  }

  // ── Transition to another area ────────────────────────────────────────
  private _transitionTo(t: TransitionConfig): void {
    if (this._transitioning) return;
    this._transitioning = true;

    // Stop player movement
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    // Show transition label
    if (t.label) {
      const label = this.add.text(W / 2, H / 2, t.label + '...', {
        fontFamily: "'Press Start 2P'",
        fontSize: FONT.SM,
        color: '#c8b890',
        stroke: '#0a0a0e',
        strokeThickness: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.UI + 10).setAlpha(0);

      this.tweens.add({
        targets: label,
        alpha: 1,
        duration: 200,
        hold: LABEL_LINGER,
        yoyo: true,
      });
    }

    // Fade out then restart scene with new area
    this.time.delayedCall(300, () => {
      this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart({
          areaId: t.targetArea,
          spawnX: t.targetSpawn.x,
          spawnY: t.targetSpawn.y,
        } satisfies AreaInitData);
      });
    });
  }

  // ── Ambient particles ─────────────────────────────────────────────────
  private _spawnParticles(area: AreaConfig): void {
    const type = area.particles ?? 'none';
    if (type === 'none') return;

    const count = 12;
    const isEmbers = type === 'embers';
    const color  = isEmbers ? 0xee8833 : 0xddccaa;

    for (let i = 0; i < count; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(20, area.worldW - 20),
        Phaser.Math.Between(20, area.worldH - 20),
        Phaser.Math.FloatBetween(0.5, 1.5),
        color,
        Phaser.Math.FloatBetween(0.1, 0.3),
      );
      dot.setDepth(100); // above sprites, below UI

      if (isEmbers) {
        // Embers float upward
        this.tweens.add({
          targets: dot,
          x: `+=${Phaser.Math.Between(-15, 15)}`,
          y: `-=${Phaser.Math.Between(30, 60)}`,
          alpha: { from: 0.3, to: 0 },
          duration: Phaser.Math.Between(3000, 6000),
          yoyo: false,
          repeat: -1,
          delay: Phaser.Math.Between(0, 5000),
          onRepeat: () => {
            dot.setPosition(
              Phaser.Math.Between(20, area.worldW - 20),
              Phaser.Math.Between(area.worldH * 0.5, area.worldH - 20),
            );
          },
        });
      } else {
        // Dust motes drift gently
        this.tweens.add({
          targets: dot,
          x: `+=${Phaser.Math.Between(-30, 30)}`,
          y: `+=${Phaser.Math.Between(-20, 20)}`,
          alpha: { from: 0.1, to: 0.3 },
          duration: Phaser.Math.Between(4000, 8000),
          yoyo: true,
          repeat: -1,
          delay: Phaser.Math.Between(0, 5000),
        });
      }
    }
  }

  // ── Area name toast ───────────────────────────────────────────────────
  private _showAreaName(name: string): void {
    const toast = this.add.text(W / 2, 20, name, {
      fontFamily: "'Press Start 2P'",
      fontSize: FONT.SM,
      color: '#c8b890',
      stroke: '#0a0a0e',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.UI + 5).setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 600,
      hold: 1500,
      yoyo: true,
      onComplete: () => toast.destroy(),
    });
  }
}

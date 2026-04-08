import Phaser from 'phaser';
import type { ParryResult } from './ParrySystem';
import type { DodgeResult } from './DodgeSystem';

// ── Juice System ───────────────────────────────────────────────────────────
// Every hit MUST land like E33. Non-negotiable.
// Owns: hit-stop, screen shake, time-scale, flash, vignette.

interface HitStopTarget {
  sprite: { body: Phaser.Physics.Arcade.Body | null };
  _savedVx: number;
  _savedVy: number;
}

export class JuiceSystem {
  private _scene: Phaser.Scene;
  private _cam: Phaser.Cameras.Scene2D.Camera;
  private _hitstopTargets: HitStopTarget[] = [];
  private _hitstopFrames = 0;
  private _timeScaleTimer: Phaser.Time.TimerEvent | null = null;

  // Reusable flash overlay (filled rect, alpha tweened)
  private _flash: Phaser.GameObjects.Rectangle;
  // Vignette for telegraph (heavy attack / unblockable)
  private _vignette: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
    this._cam   = scene.cameras.main;

    // Flash layer (top of everything)
    const { width, height } = scene.scale;
    this._flash = scene.add
      .rectangle(width / 2, height / 2, width, height, 0xffffff, 0)
      .setDepth(1000)
      .setScrollFactor(0);

    this._vignette = scene.add
      .rectangle(width / 2, height / 2, width, height, 0xe94560, 0)
      .setDepth(999)
      .setScrollFactor(0);
  }

  // ── Hit stop ─────────────────────────────────────────────────────────
  // Freeze physics bodies for N frames; movement resumes automatically.
  hitStop(frames: number, sprites: Phaser.Physics.Arcade.Image[]): void {
    this._hitstopFrames = frames;
    this._hitstopTargets = sprites.map(s => {
      const body = s.body as Phaser.Physics.Arcade.Body;
      const saved = { sprite: s as unknown as HitStopTarget['sprite'], _savedVx: body.velocity.x, _savedVy: body.velocity.y };
      body.setVelocity(0, 0);
      body.setAcceleration(0, 0);
      return saved;
    });
  }

  // Call from scene.update() every frame
  updateHitStop(): void {
    if (this._hitstopFrames <= 0) return;
    this._hitstopFrames--;
    if (this._hitstopFrames === 0) {
      // Restore velocities
      for (const t of this._hitstopTargets) {
        const body = t.sprite.body as Phaser.Physics.Arcade.Body | null;
        if (body) body.setVelocity(t._savedVx, t._savedVy);
      }
      this._hitstopTargets = [];
    }
  }

  get hitstopActive(): boolean { return this._hitstopFrames > 0; }

  // ── Screen shake ──────────────────────────────────────────────────────
  shake(intensity: number, duration = 150, rotation = 0): void {
    this._cam.shake(duration, intensity);
    if (rotation > 0) {
      this._scene.tweens.add({
        targets: this._cam,
        rotation: { from: -rotation, to: rotation },
        duration: duration / 2,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // ── Screen flash ──────────────────────────────────────────────────────
  flash(color = 0xffffff, alpha = 0.8, duration = 80): void {
    this._flash.setFillStyle(color, alpha);
    this._scene.tweens.add({
      targets: this._flash,
      alpha: { from: alpha, to: 0 },
      duration,
      ease: 'Power2',
    });
  }

  // ── Time scale (slow-mo) ──────────────────────────────────────────────
  slowMo(scale: number, durationMs: number): void {
    this._timeScaleTimer?.remove();
    this._scene.physics.world.timeScale = scale;
    this._timeScaleTimer = this._scene.time.delayedCall(durationMs, () => {
      this._scene.physics.world.timeScale = 1;
    });
  }

  // ── Composite events ──────────────────────────────────────────────────

  onLightHit(sprites: Phaser.Physics.Arcade.Image[]): void {
    this.hitStop(3, sprites);
    this.shake(0.002, 100);
    this.flash(0xffffff, 0.3, 60);
  }

  onHeavyHit(sprites: Phaser.Physics.Arcade.Image[]): void {
    this.hitStop(6, sprites);
    this.shake(0.005, 200, 0.017); // 1 degree rotation
    this.flash(0xffffff, 0.5, 80);
  }

  onSpecialHit(sprites: Phaser.Physics.Arcade.Image[]): void {
    this.hitStop(10, sprites);
    this.shake(0.008, 300, 0.035); // ~2 degrees
    this.flash(0xffffff, 0.9, 120);
  }

  onPerfectParry(sprites: Phaser.Physics.Arcade.Image[]): void {
    this.hitStop(4, sprites);
    this.slowMo(0.15, 400);
    this.flash(0xffd60a, 0.6, 200); // gold flash
    this._spawnParryRing(sprites[0]);
  }

  onParry(sprites: Phaser.Physics.Arcade.Image[]): void {
    this.hitStop(2, sprites);
    this.flash(0x4cc9f0, 0.4, 100); // blue flash
    this._spawnParryRing(sprites[0], false);
  }

  onPerfectDodge(): void {
    this.slowMo(0.2, 300);
    this.flash(0x4cc9f0, 0.3, 150);
  }

  onKill(killedSprite: Phaser.Physics.Arcade.Image): void {
    this.slowMo(0.5, 500);
    this.flash(0xffffff, 1.0, 100); // 2-frame white flash (80ms ≈ 5 frames)
    void killedSprite;
  }

  onPlayerDeath(): void {
    this.slowMo(0.8, 800); // actually we want 20% speed = 0.2
    this._scene.physics.world.timeScale = 0.2;
    this._scene.time.delayedCall(800, () => {
      this._scene.physics.world.timeScale = 1;
    });
    this.flash(0xff0000, 0.5, 500);
    // Desaturate via camera postprocessing (not available in base Phaser — use tint)
    this._scene.tweens.add({
      targets: this._vignette,
      alpha: { from: 0, to: 0.4 },
      duration: 500,
      yoyo: false,
    });
  }

  onTelegraphLight(sprite: Phaser.Physics.Arcade.Image): void {
    // Weapon/arm red flash on attacker
    this._scene.tweens.add({
      targets: sprite,
      tint: { from: 0xffffff, to: 0xff4444 },
      duration: 200,
      yoyo: true,
    });
  }

  onTelegraphHeavy(sprite: Phaser.Physics.Arcade.Image): void {
    this.onTelegraphLight(sprite);
    // Vignette pulse on screen edge
    this._scene.tweens.add({
      targets: this._vignette,
      alpha: { from: 0, to: 0.25 },
      duration: 300,
      yoyo: true,
    });
  }

  onTelegraphUnblockable(sprite: Phaser.Physics.Arcade.Image): void {
    // Full glowing red outline tween — full body red
    this._scene.tweens.add({
      targets: sprite,
      tint: { from: 0xe94560, to: 0xff0000 },
      duration: 400,
      yoyo: true,
      repeat: 2,
    });
    this._scene.tweens.add({
      targets: this._vignette,
      alpha: { from: 0, to: 0.4 },
      duration: 350,
      yoyo: true,
      repeat: 2,
    });
  }

  resolveParryResult(
    result: ParryResult,
    sprites: Phaser.Physics.Arcade.Image[],
  ): void {
    if (result === 'perfect') this.onPerfectParry(sprites);
    else if (result === 'parry') this.onParry(sprites);
  }

  resolveDodgeResult(result: DodgeResult): void {
    if (result === 'perfect') this.onPerfectDodge();
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private _spawnParryRing(
    sprite: Phaser.Physics.Arcade.Image | undefined,
    perfect = true,
  ): void {
    if (!sprite) return;
    const color = perfect ? 0xffd60a : 0x4cc9f0;
    const ring = this._scene.add.circle(sprite.x, sprite.y, 12, color, 0)
      .setDepth(200)
      .setStrokeStyle(2, color, 1);

    this._scene.tweens.add({
      targets: ring,
      scaleX: { from: 1, to: 2.5 },
      scaleY: { from: 1, to: 2.5 },
      alpha:  { from: 1, to: 0 },
      duration: perfect ? 400 : 250,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });
  }
}

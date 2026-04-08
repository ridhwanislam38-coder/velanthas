import Phaser from 'phaser';
import { DEPTH, CINEMATIC } from '../config/visualConfig';
import { Bus, GameEvent } from './EventBus';

// ── Cinematic System ───────────────────────────────────────────────────────
// Shared infrastructure for special attack cinematics:
//   - Name card (slides in bottom-left)
//   - Camera zoom sequences (smooth, never instant except IMPACT FRAME)
//   - Full-screen color frames (white/black)
//   - Input lock / unlock
//   - Screen split (multi-region panel reveal for WORLD'S WEIGHT)
//
// Owns the tween queue — all transitions run here, never ad-hoc.

export interface CameraMove {
  zoom?:      number;
  shakeIntensity?: number;
  shakeDuration?:  number;
  rotateDeg?: number;
  duration:   number;
  ease?:      string;
}

export interface ScreenPanel {
  color:   number;
  alpha:   number;
  x:       number;
  y:       number;
  width:   number;
  height:  number;
  label?:  string;
}

export class CinematicSystem {
  private _scene:     Phaser.Scene;
  private _nameCard!: Phaser.GameObjects.Container;
  private _nameText!: Phaser.GameObjects.Text;
  private _overlay!:  Phaser.GameObjects.Rectangle;
  private _panels:    Phaser.GameObjects.Rectangle[] = [];
  private _inputLocked = false;

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
    this._build();
  }

  // ── Input lock ────────────────────────────────────────────────────────

  lockInput(durationMs: number): void {
    this._inputLocked = true;
    this._scene.time.delayedCall(durationMs, () => {
      this._inputLocked = false;
    });
  }

  get inputLocked(): boolean { return this._inputLocked; }

  // ── Name card ─────────────────────────────────────────────────────────

  showNameCard(name: string): void {
    const { height } = this._scene.scale;
    const targetY = height - CINEMATIC.NAME_CARD_Y_FROM_BOTTOM;

    this._nameText.setText(name);
    this._nameCard.setPosition(-120, targetY).setAlpha(1).setVisible(true);

    // Slide in
    this._scene.tweens.add({
      targets:  this._nameCard,
      x:        CINEMATIC.NAME_CARD_X,
      duration: CINEMATIC.NAME_CARD_SLIDE_FRAMES * (1000 / 60),
      ease:     'Back.easeOut',
      onComplete: () => {
        // Hold
        this._scene.time.delayedCall(
          CINEMATIC.NAME_CARD_HOLD_FRAMES * (1000 / 60),
          () => {
            // Fade out
            this._scene.tweens.add({
              targets:  this._nameCard,
              alpha:    0,
              duration: CINEMATIC.NAME_CARD_FADE_FRAMES * (1000 / 60),
              onComplete: () => this._nameCard.setVisible(false),
            });
          },
        );
      },
    });
  }

  // ── Camera moves ──────────────────────────────────────────────────────

  cameraMove(move: CameraMove, onComplete?: () => void): void {
    const cam = this._scene.cameras.main;
    const tweenProps: Record<string, unknown> = {
      duration: move.duration,
      ease:     move.ease ?? CINEMATIC.ZOOM_EASE,
      onComplete,
    };

    if (move.zoom !== undefined) tweenProps['zoom'] = move.zoom;

    if (move.rotateDeg !== undefined) {
      const clampedDeg = Phaser.Math.Clamp(move.rotateDeg, -CINEMATIC.SHAKE_MAX_DEG, CINEMATIC.SHAKE_MAX_DEG);
      tweenProps['rotation'] = clampedDeg * Phaser.Math.DEG_TO_RAD;
    }

    this._scene.tweens.add({ targets: cam, ...tweenProps });

    if (move.shakeIntensity !== undefined) {
      cam.shake(move.shakeDuration ?? move.duration, move.shakeIntensity, false);
    }
  }

  resetCamera(duration = 400): void {
    this._scene.tweens.add({
      targets:  this._scene.cameras.main,
      zoom:     1,
      rotation: 0,
      duration,
      ease:     'Power2',
    });
  }

  // ── Color frames ──────────────────────────────────────────────────────

  /** Full-screen color flash, hold N frames, then fade. */
  colorFrame(color: number, holdFrames: number, fadeDuration = 200, onComplete?: () => void): void {
    const holdMs = holdFrames * (1000 / 60);
    this._overlay
      .setFillStyle(color, 1.0)
      .setVisible(true)
      .setAlpha(1);

    this._scene.time.delayedCall(holdMs, () => {
      this._scene.tweens.add({
        targets:    this._overlay,
        alpha:      0,
        duration:   fadeDuration,
        onComplete: () => {
          this._overlay.setVisible(false);
          onComplete?.();
        },
      });
    });
  }

  /** Desaturate scene to given level (0=grayscale, 1=normal). */
  desaturate(level: number, duration = 100): void {
    // In Phaser 3, desaturation requires a pipeline or post-fx.
    // We approximate with a grey tint overlay.
    const alpha = 1 - level;
    this._scene.tweens.add({
      targets:  this._overlay,
      alpha:    alpha * 0.5,
      duration,
    });
    if (!this._overlay.visible && alpha > 0) {
      this._overlay.setFillStyle(0x808080, 1).setVisible(true);
    }
  }

  // ── Multi-panel split ─────────────────────────────────────────────────

  /** Show multiple colored panels simultaneously (WORLD'S WEIGHT). */
  showPanels(panels: ScreenPanel[], holdMs: number, onComplete?: () => void): void {
    this._clearPanels();

    for (const p of panels) {
      const rect = this._scene.add.rectangle(p.x, p.y, p.width, p.height, p.color, p.alpha)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.CUTSCENE)
        .setAlpha(0);

      this._panels.push(rect);
      this._scene.tweens.add({ targets: rect, alpha: p.alpha, duration: 200 });
    }

    this._scene.time.delayedCall(holdMs, () => {
      this._scene.tweens.add({
        targets:    this._panels,
        alpha:      0,
        duration:   300,
        onComplete: () => {
          this._clearPanels();
          onComplete?.();
        },
      });
    });
  }

  destroy(): void {
    this._nameCard.destroy();
    this._overlay.destroy();
    this._clearPanels();
  }

  // ── Build ─────────────────────────────────────────────────────────────

  private _build(): void {
    const { width, height } = this._scene.scale;

    // Full-screen overlay (color frames)
    this._overlay = this._scene.add
      .rectangle(0, 0, width, height, 0xFFFFFF, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.CUTSCENE)
      .setVisible(false);

    // Name card container
    const bg = this._scene.add.rectangle(0, 0, 100, 14, 0x000000, 0.75).setOrigin(0, 0.5);
    const bar = this._scene.add.rectangle(0, 0, 2, 14, 0xe94560, 1).setOrigin(0, 0.5);
    this._nameText = this._scene.add.text(5, 0, '', {
      fontFamily: "'Press Start 2P'", fontSize: '5px', color: '#e8e8f0',
    }).setOrigin(0, 0.5);

    this._nameCard = this._scene.add.container(-120, height - CINEMATIC.NAME_CARD_Y_FROM_BOTTOM, [
      bg, bar, this._nameText,
    ]);
    this._nameCard.setScrollFactor(0).setDepth(DEPTH.UI + 10).setVisible(false);
  }

  private _clearPanels(): void {
    this._panels.forEach(p => p.destroy());
    this._panels = [];
  }
}

// ── Five-region panel layout for WORLD'S WEIGHT ───────────────────────────
export function buildWorldWeightPanels(width: number, height: number): ScreenPanel[] {
  const w = width / 5;
  return [
    { x: 0,      y: 0, width: w, height, color: 0x3D2B1F, alpha: 0.85, label: 'ASHFIELDS'  },
    { x: w,      y: 0, width: w, height, color: 0x1C3A2A, alpha: 0.85, label: 'VERDENMERE' },
    { x: w * 2,  y: 0, width: w, height, color: 0x2A2E38, alpha: 0.85, label: 'GREYVEIL'   },
    { x: w * 3,  y: 0, width: w, height, color: 0x3D2E0A, alpha: 0.85, label: 'GILDSPIRE'  },
    { x: w * 4,  y: 0, width: w, height, color: 0x1A0A2E, alpha: 0.85, label: 'VOIDMARSH'  },
  ];
}

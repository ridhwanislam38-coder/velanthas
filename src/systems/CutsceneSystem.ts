import Phaser from 'phaser';

// ── Cutscene System ────────────────────────────────────────────────────────
// Handles all non-interactive story sequences.
// POV types: WORLD (bonfire), CHARACTER_MEMORY (boss kill), AERIAL (first entry),
//            EDRIC_MEMORY (story beats), REGION_REVEAL (first visit).
//
// Usage:
//   const cs = new CutsceneSystem(scene);
//   cs.play('edric_1', () => console.log('done'));

export type CutscenePov = 'WORLD' | 'CHARACTER_MEMORY' | 'AERIAL' | 'EDRIC_MEMORY';

export interface CutsceneStep {
  /** Texture key or colour fill for this step's background */
  bgKey?:        string;
  bgColor?:      number;
  /** Sprite or texture to show in foreground */
  fgKey?:        string;
  /** Duration in ms */
  duration:      number;
  /** Music key to cross-fade to (optional) */
  musicKey?:     string;
  /** Caption text — never exposition, just context */
  caption?:      string;
}

export interface CutsceneDef {
  id:          string;
  pov:         CutscenePov;
  steps:       CutsceneStep[];
  letterbox:   boolean;  // 2:35:1 bars
  skipOnRepeat: boolean; // allow skip if player has seen this before
}

const SEEN_KEY = 'sq_seen_cutscenes';
const LETTERBOX_H = 18; // px (in 320×180 space — ~10% top/bottom)

export class CutsceneSystem {
  private _scene:       Phaser.Scene;
  private _active       = false;
  private _seen:        Set<string>;
  private _onComplete:  (() => void) | null = null;

  // Phaser objects
  private _topBar!:     Phaser.GameObjects.Rectangle;
  private _botBar!:     Phaser.GameObjects.Rectangle;
  private _bgRect!:     Phaser.GameObjects.Rectangle;
  private _caption!:    Phaser.GameObjects.Text;
  private _skipHint!:   Phaser.GameObjects.Text;
  private _container!:  Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
    this._seen  = this._loadSeen();
    this._build();
    this._hide();
  }

  // ── Public ────────────────────────────────────────────────────────────

  play(def: CutsceneDef, onComplete?: () => void): void {
    if (this._active) return;

    const canSkip = def.skipOnRepeat && this._seen.has(def.id);

    if (canSkip) {
      onComplete?.();
      return;
    }

    this._active    = true;
    this._onComplete = onComplete ?? null;
    this._seen.add(def.id);
    this._saveSeen();

    // Freeze player physics
    this._scene.events.emit('cutscene_start');

    if (def.letterbox) {
      this._showLetterbox();
    }

    this._show();

    if (def.skipOnRepeat) {
      this._skipHint.setVisible(false); // first view — no skip
    }

    this._playSteps(def.steps, 0, () => this._end(def));
  }

  get isActive(): boolean { return this._active; }

  destroy(): void { this._container.destroy(); }

  // ── Steps ─────────────────────────────────────────────────────────────

  private _playSteps(steps: CutsceneStep[], idx: number, onDone: () => void): void {
    if (idx >= steps.length) { onDone(); return; }

    const step = steps[idx];
    if (!step) { onDone(); return; }

    // Background
    if (step.bgColor !== undefined) {
      this._bgRect.setFillStyle(step.bgColor).setVisible(true);
    }

    // Caption
    if (step.caption) {
      this._caption.setText(step.caption).setAlpha(0).setVisible(true);
      this._scene.tweens.add({ targets: this._caption, alpha: 1, duration: 300 });
    } else {
      this._caption.setVisible(false);
    }

    // Music
    if (step.musicKey) {
      this._scene.events.emit('cutscene_music', step.musicKey);
    }

    // Wait, then fade to next
    this._scene.time.delayedCall(step.duration, () => {
      if (step.caption) {
        this._scene.tweens.add({
          targets: this._caption, alpha: 0, duration: 200,
          onComplete: () => this._playSteps(steps, idx + 1, onDone),
        });
      } else {
        this._playSteps(steps, idx + 1, onDone);
      }
    });
  }

  // ── Letterbox ─────────────────────────────────────────────────────────

  private _showLetterbox(): void {
    this._topBar.setVisible(true).setAlpha(0);
    this._botBar.setVisible(true).setAlpha(0);
    this._scene.tweens.add({
      targets: [this._topBar, this._botBar], alpha: 1, duration: 300,
    });
  }

  private _hideLetterbox(): void {
    this._scene.tweens.add({
      targets: [this._topBar, this._botBar], alpha: 0, duration: 300,
      onComplete: () => {
        this._topBar.setVisible(false);
        this._botBar.setVisible(false);
      },
    });
  }

  // ── End ───────────────────────────────────────────────────────────────

  private _end(def: CutsceneDef): void {
    if (def.letterbox) this._hideLetterbox();

    this._scene.tweens.add({
      targets: this._container, alpha: 0, duration: 300,
      onComplete: () => {
        this._hide();
        this._active = false;
        this._scene.events.emit('cutscene_end');
        this._onComplete?.();
        this._onComplete = null;
      },
    });
  }

  // ── Build & visibility ────────────────────────────────────────────────

  private _build(): void {
    const { width, height } = this._scene.scale;

    this._bgRect = this._scene.add
      .rectangle(0, 0, width, height, 0x000000)
      .setOrigin(0, 0).setVisible(false);

    this._topBar = this._scene.add
      .rectangle(0, 0, width, LETTERBOX_H, 0x000000)
      .setOrigin(0, 0);

    this._botBar = this._scene.add
      .rectangle(0, height - LETTERBOX_H, width, LETTERBOX_H, 0x000000)
      .setOrigin(0, 0);

    this._caption = this._scene.add.text(width / 2, height - LETTERBOX_H - 6, '', {
      fontFamily: "'Press Start 2P'", fontSize: '5px',
      color: '#e8e8f0', align: 'center',
    }).setOrigin(0.5, 1);

    this._skipHint = this._scene.add.text(width - 4, height - 4, 'Z: skip', {
      fontFamily: "'Press Start 2P'", fontSize: '4px', color: '#888',
    }).setOrigin(1, 1).setVisible(false);

    this._container = this._scene.add.container(0, 0, [
      this._bgRect, this._topBar, this._botBar, this._caption, this._skipHint,
    ]);
    this._container.setScrollFactor(0).setDepth(600);
  }

  private _show(): void {
    this._container.setVisible(true).setAlpha(1);
  }

  private _hide(): void {
    this._container.setVisible(false).setAlpha(0);
    this._bgRect.setVisible(false);
  }

  // ── Persistence ───────────────────────────────────────────────────────

  private _loadSeen(): Set<string> {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  }

  private _saveSeen(): void {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...this._seen]));
  }
}

// ── Pre-built cutscene definitions ────────────────────────────────────────

export const EDRIC_CUTSCENES: CutsceneDef[] = [
  {
    id: 'edric_1', pov: 'EDRIC_MEMORY', letterbox: true, skipOnRepeat: true,
    steps: [
      { bgColor: 0x3D2B1F, duration: 2000, caption: '' }, // warm world, full colour
      { bgColor: 0x2A1A0A, duration: 4000 },
      { bgColor: 0x1A0A00, duration: 2000 },
    ],
  },
  {
    id: 'edric_2', pov: 'EDRIC_MEMORY', letterbox: true, skipOnRepeat: true,
    steps: [
      { bgColor: 0x0A0A18, duration: 6000, caption: '' },
    ],
  },
  {
    id: 'edric_3', pov: 'EDRIC_MEMORY', letterbox: true, skipOnRepeat: true,
    steps: [
      { bgColor: 0x1C3A2A, duration: 3000 },
      { bgColor: 0x2A3A1C, duration: 4000 }, // garden — warm
      { bgColor: 0x1C3A2A, duration: 2000 },
    ],
  },
  {
    id: 'edric_4', pov: 'EDRIC_MEMORY', letterbox: true, skipOnRepeat: true,
    steps: [
      { bgColor: 0x2A2E38, duration: 8000, caption: '' }, // sundergate — long pause
    ],
  },
  {
    id: 'edric_5', pov: 'EDRIC_MEMORY', letterbox: true, skipOnRepeat: true,
    steps: [
      { bgColor: 0x3D2B1F, duration: 1000 }, // colour world
      { bgColor: 0x2A2020, duration: 1500 },
      { bgColor: 0x1A1818, duration: 1500 },
      { bgColor: 0x080808, duration: 2000 },
      { bgColor: 0x000000, duration: 2000, caption: '' }, // the silence
    ],
  },
  {
    id: 'edric_6_remember', pov: 'EDRIC_MEMORY', letterbox: true, skipOnRepeat: false,
    steps: [
      { bgColor: 0x2A2E38, duration: 4000 },      // grave
      { bgColor: 0x1C3A2A, duration: 2000 },      // garden colour bleeds in
      { bgColor: 0xC87DB0, duration: 3000 },      // Thessamine pink — just for a moment
      { bgColor: 0xFFFFFF, duration: 1000 },      // white — cut
    ],
  },
];

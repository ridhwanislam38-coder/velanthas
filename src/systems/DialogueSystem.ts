import Phaser from 'phaser';
import { COLOR, FONT } from '../config/Constants';
import { Audio } from './AudioSystem';
import { Factions } from './FactionSystem';
import type { FactionId } from '../config/enemyConfig';

// ── Dialogue System ────────────────────────────────────────────────────────
// Portrait + typewriter text box + branching choices (max 3 per node).
// Rep effects apply immediately on choice selection.
// Usage:
//   const dlg = new DialogueSystem(scene);
//   dlg.loadTree(myTree);
//   dlg.start('intro', () => console.log('done'));
//   // In scene update: if (dlg.isActive) dlg.update();
//   // Z / Space press: dlg.advance();

export interface DialogueLine {
  speaker:   string;
  text:      string;
  portrait?: string;  // texture key
  voiceSrc?: string;  // path to voice-line audio (played via AudioSystem)
}

export interface DialogueChoice {
  label:      string;
  repDelta?:  { faction: FactionId; delta: number };
  next?:      string;  // jump to this node key after selection
  action?:    () => void;
}

export interface DialogueNode {
  lines:    DialogueLine[];
  choices?: DialogueChoice[];
  onEnd?:   () => void;
}

export type DialogueTree = Record<string, DialogueNode>;

// ── Layout (320×180 coordinate space) ─────────────────────────────────────
const BOX_X    = 2;
const BOX_Y    = 120;
const BOX_W    = 316;
const BOX_H    = 56;
const PORT_W   = 32;
const PORT_H   = 40;
const TEXT_X   = BOX_X + PORT_W + 6;
const TEXT_W   = BOX_W - PORT_W - 10;
const CHAR_MS  = 28; // ms between characters

export class DialogueSystem {
  private _scene:   Phaser.Scene;
  private _tree:    DialogueTree = {};
  private _current: string | null = null;
  private _lineIdx  = 0;
  private _charIdx  = 0;
  private _typing   = false;
  private _lineEnd  = false;
  private _onFinish: (() => void) | null = null;

  // Phaser objects
  private _container!:   Phaser.GameObjects.Container;
  private _portrait!:    Phaser.GameObjects.Image;
  private _nameLabel!:   Phaser.GameObjects.Text;
  private _bodyText!:    Phaser.GameObjects.Text;
  private _arrow!:       Phaser.GameObjects.Text;
  private _choices:      Phaser.GameObjects.Text[] = [];
  private _typeEvent:    Phaser.Time.TimerEvent | null = null;
  private _arrowTween:   Phaser.Tweens.Tween | null = null;

  private _active = false;

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
    this._build();
    this._container.setVisible(false).setAlpha(0);
  }

  // ── Public ────────────────────────────────────────────────────────────

  loadTree(tree: DialogueTree): void { this._tree = tree; }

  start(nodeKey: string, onFinish?: () => void): void {
    if (this._active) return;
    const node = this._tree[nodeKey];
    if (!node) { console.warn(`DialogueSystem: missing node "${nodeKey}"`); return; }
    this._current  = nodeKey;
    this._lineIdx  = 0;
    this._active   = true;
    this._onFinish = onFinish ?? null;
    this._show();
    this._playLine();
  }

  /** Call when Z or Space is pressed. */
  advance(): void {
    if (!this._active) return;
    if (this._typing) { this._skipType(); return; }
    if (!this._lineEnd) return;
    if (this._choices.length > 0) return; // choices handle their own selection

    const node = this._tree[this._current!];
    if (!node) { this._endNode(); return; }
    this._lineIdx++;
    if (this._lineIdx < node.lines.length) {
      this._playLine();
    } else if (node.choices && node.choices.length > 0) {
      this._showChoices(node.choices);
    } else {
      this._endNode();
    }
  }

  get isActive(): boolean { return this._active; }

  destroy(): void { this._container.destroy(); }

  // ── Build ─────────────────────────────────────────────────────────────

  private _build(): void {
    const s = this._scene;

    const bg = s.add.rectangle(BOX_X, BOX_Y, BOX_W, BOX_H, 0x0a0a18, 0.92).setOrigin(0, 0);
    const border = s.add.rectangle(BOX_X, BOX_Y, BOX_W, BOX_H).setOrigin(0, 0)
      .setStrokeStyle(1, COLOR.LUMINA);

    this._portrait = s.add.image(BOX_X + 2, BOX_Y + 4, '__DEFAULT')
      .setOrigin(0, 0).setDisplaySize(PORT_W, PORT_H).setVisible(false);

    this._nameLabel = s.add.text(TEXT_X, BOX_Y + 4, '', {
      fontFamily: "'Press Start 2P'", fontSize: FONT.XS, color: '#e8e8f0',
    }).setOrigin(0, 0);

    this._bodyText = s.add.text(TEXT_X, BOX_Y + 16, '', {
      fontFamily: "'Press Start 2P'", fontSize: FONT.XS,
      color: '#c8c8d8', wordWrap: { width: TEXT_W },
    }).setOrigin(0, 0);

    this._arrow = s.add.text(BOX_X + BOX_W - 6, BOX_Y + BOX_H - 8, '▶', {
      fontFamily: "'Press Start 2P'", fontSize: FONT.XS, color: COLOR.GOLD_S,
    }).setOrigin(1, 0).setVisible(false);

    this._container = s.add.container(0, 0, [bg, border, this._portrait,
      this._nameLabel, this._bodyText, this._arrow]);
    this._container.setScrollFactor(0).setDepth(400);
  }

  private _show(): void {
    this._container.setVisible(true);
    this._scene.tweens.add({ targets: this._container, alpha: 1, duration: 150 });
  }

  // ── Typewriter ────────────────────────────────────────────────────────

  private _playLine(): void {
    const node = this._tree[this._current!];
    if (!node) return;
    const line = node.lines[this._lineIdx];
    if (!line) return;

    this._lineEnd  = false;
    this._charIdx  = 0;
    this._typing   = true;

    this._arrow.setVisible(false);
    this._arrowTween?.stop();
    this._arrowTween = null;
    this._clearChoices();

    this._nameLabel.setText(line.speaker);
    this._bodyText.setText('');

    if (line.portrait && this._scene.textures.exists(line.portrait)) {
      this._portrait.setTexture(line.portrait).setVisible(true);
    } else {
      this._portrait.setVisible(false);
    }

    // Play voice line if one is attached
    if (line.voiceSrc) {
      Audio.playVoice(line.voiceSrc);
    }

    this._typeEvent = this._scene.time.addEvent({
      delay:  CHAR_MS,
      repeat: line.text.length - 1,
      callback: () => {
        this._bodyText.setText(line.text.slice(0, ++this._charIdx));
        if (this._charIdx >= line.text.length) this._finishType();
      },
    });
  }

  private _finishType(): void {
    this._typing  = false;
    this._lineEnd = true;
    this._typeEvent = null;
    this._arrow.setVisible(true).setAlpha(1);
    this._arrowTween = this._scene.tweens.add({
      targets: this._arrow, alpha: 0, duration: 400, yoyo: true, repeat: -1,
    });
  }

  private _skipType(): void {
    this._typeEvent?.remove();
    this._typeEvent = null;
    const node = this._tree[this._current!];
    this._bodyText.setText(node?.lines[this._lineIdx]?.text ?? '');
    this._finishType();
  }

  // ── Choices ───────────────────────────────────────────────────────────

  private _showChoices(choices: DialogueChoice[]): void {
    this._arrow.setVisible(false);
    this._arrowTween?.stop();

    choices.slice(0, 3).forEach((choice, i) => {
      const t = this._scene.add.text(
        BOX_X + BOX_W + 4,
        BOX_Y + 8 + i * 12,
        `${i + 1}. ${choice.label}`,
        {
          fontFamily: "'Press Start 2P'", fontSize: FONT.XS,
          color: '#e8e8f0', backgroundColor: '#0a0a18',
          padding: { x: 2, y: 1 },
        },
      ).setScrollFactor(0).setDepth(401).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });

      t.on('pointerover', () => t.setColor(COLOR.GOLD_S));
      t.on('pointerout',  () => t.setColor('#e8e8f0'));
      t.on('pointerdown', () => this._selectChoice(choice));

      this._scene.input.keyboard?.once(`keydown-${i + 1}`, () => {
        if (this._choices.includes(t)) this._selectChoice(choice);
      });

      this._choices.push(t);
    });
  }

  private _selectChoice(choice: DialogueChoice): void {
    this._clearChoices();

    if (choice.repDelta) {
      Factions.processEvent({
        type: 'dialogue', faction: choice.repDelta.faction, delta: choice.repDelta.delta,
      });
    }

    choice.action?.();

    if (choice.next && this._tree[choice.next]) {
      this._current = choice.next;
      this._lineIdx = 0;
      this._playLine();
    } else {
      this._endNode();
    }
  }

  private _clearChoices(): void {
    this._choices.forEach(t => t.destroy());
    this._choices = [];
  }

  // ── End ───────────────────────────────────────────────────────────────

  private _endNode(): void {
    this._tree[this._current!]?.onEnd?.();
    this._active  = false;
    this._current = null;

    this._scene.tweens.add({
      targets: this._container, alpha: 0, duration: 200,
      onComplete: () => this._container.setVisible(false),
    });

    this._onFinish?.();
    this._onFinish = null;
  }
}

// Kept for backward-compat with placeholder import
export const DS = new (class {
  open(): void { console.warn('DS: create a scene-scoped DialogueSystem instead'); }
  openLines(): void { this.open(); }
  close(): void { /* no-op */ }
})();

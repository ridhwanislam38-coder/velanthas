import Phaser from 'phaser';
import STORY from '../data/story';
import { W, H } from '../config/Constants';

// Step 11 (polish): Full typewriter prologue.
// Step 1 (now): Minimal pass-through for movement testing.
export default class PrologueScene extends Phaser.Scene {
  private _idx  = 0;
  private _typing = false;
  private _fullText = '';
  private _typeTimer: Phaser.Time.TimerEvent | null = null;
  private _textObj!: Phaser.GameObjects.Text;
  private _nextPrompt!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'PrologueScene' }); }

  create(): void {
    const screens = STORY.prologue;

    this.cameras.main.setBackgroundColor(0x040408);
    this.add.image(W / 2, H / 2, 'bg_stars').setDisplaySize(W, H).setAlpha(0.5);

    this._textObj = this.add.text(W / 2, H * 0.50, '', {
      fontFamily: "'Press Start 2P'",
      fontSize: '10px',
      color: '#e8e8f0',
      align: 'center',
      lineSpacing: 16,
      wordWrap: { width: 700 },
    }).setOrigin(0.5).setAlpha(0);

    const chapterTitle = this.add.text(W / 2, H * 0.18, 'THE MEMORIA COLLAPSE', {
      fontFamily: "'Press Start 2P'", fontSize: '12px',
      color: '#ffd60a', stroke: '#7a5900', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: chapterTitle, alpha: 1, duration: 800, delay: 200 });

    this._nextPrompt = this.add.text(W - 30, H - 30, '▶ CONTINUE', {
      fontFamily: "'Press Start 2P'", fontSize: '8px', color: '#6b6b8a',
    }).setOrigin(1, 1);
    this.tweens.add({
      targets: this._nextPrompt,
      alpha: { from: 0.3, to: 1 }, duration: 700, yoyo: true, repeat: -1,
    });

    const advance = (): void => {
      if (this._typing) {
        // Skip to full text immediately
        this._typeTimer?.remove();
        this._textObj.setText(this._fullText);
        this._typing = false;
        return;
      }
      this._idx++;
      if (this._idx >= screens.length) {
        this._finish();
        return;
      }
      this._showScreen(this._idx);
    };

    this.input.keyboard?.on('keydown-ENTER', advance);
    this.input.keyboard?.on('keydown-SPACE', advance);
    this.input.on('pointerdown', advance);

    this._showScreen(0);
  }

  private _showScreen(idx: number): void {
    const screen = STORY.prologue[idx];
    if (!screen) { this._finish(); return; }

    this._typing = true;
    this._fullText = screen.lines.join('\n');
    this._textObj.setText('').setAlpha(1);

    let charIdx = 0;
    const typeNext = (): void => {
      if (charIdx >= this._fullText.length) {
        this._typing = false;
        return;
      }
      this._textObj.setText(this._fullText.slice(0, ++charIdx));
      this._typeTimer = this.time.delayedCall(22, typeNext);
    };
    typeNext();
  }

  private _finish(): void {
    this.cameras.main.fadeOut(800, 4, 4, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('TownScene');
    });
  }
}

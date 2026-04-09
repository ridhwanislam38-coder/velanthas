import Phaser from 'phaser';
import { W, H } from '../config/Constants';

// Prologue — minimal pass-through for now.
// The real prologue cinematic will be rendered via Remotion and played here
// as a video overlay when the AI tool pipeline lands (see CLAUDE.md build queue).
export default class PrologueScene extends Phaser.Scene {
  constructor() { super({ key: 'PrologueScene' }); }

  create(): void {
    this.cameras.main.setBackgroundColor(0x040408);
    this.add.image(W / 2, H / 2, 'bg_stars').setDisplaySize(W, H).setAlpha(0.5);

    const title = this.add.text(W / 2, H * 0.42, 'VELANTHAS', {
      fontFamily: "'Press Start 2P'", fontSize: '14px',
      color: '#e8e8f0', stroke: '#1a1a2a', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);

    const sub = this.add.text(W / 2, H * 0.52, "THE ACCORD'S SILENCE", {
      fontFamily: "'Press Start 2P'", fontSize: '9px',
      color: '#6b6b8a',
    }).setOrigin(0.5).setAlpha(0);

    const prompt = this.add.text(W / 2, H * 0.82, 'PRESS ENTER', {
      fontFamily: "'Press Start 2P'", fontSize: '8px', color: '#4cc9f0',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: title,  alpha: 1, duration: 1200, delay: 400 });
    this.tweens.add({ targets: sub,    alpha: 1, duration: 1000, delay: 1400 });
    this.tweens.add({
      targets: prompt,
      alpha: { from: 0, to: 1 }, duration: 600,
      yoyo: true, repeat: -1, delay: 2600,
    });

    const advance = (): void => {
      this.cameras.main.fadeOut(800, 4, 4, 8);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('TownScene');
      });
    };

    this.input.keyboard?.once('keydown-ENTER', advance);
    this.input.keyboard?.once('keydown-SPACE', advance);
    this.input.once('pointerdown', advance);
  }
}

import Phaser from 'phaser';
import { W, H, COLOR } from '../config/Constants';

// Step 1 (playable): Shows title, ENTER → TownScene movement test
// Step 11 (polish): Full cinematic title with hero silhouette + parallax stars
export default class TitleScene extends Phaser.Scene {
  private _started = false;

  constructor() { super({ key: 'TitleScene' }); }

  create(): void {
    // Background
    this.add.image(W / 2, H / 2, 'bg_stars').setDisplaySize(W, H);

    // Moon glow
    const moon = this.add.graphics();
    moon.fillStyle(0xfff5d6, 0.9);
    moon.fillCircle(780, 110, 55);
    moon.fillStyle(0xffd60a, 0.1);
    moon.fillCircle(780, 110, 80);

    // Mountain silhouettes
    const mtn = this.add.graphics();
    mtn.fillStyle(0x0a0a18, 1);
    mtn.fillTriangle(0, H, 200, 290, 420, H);
    mtn.fillTriangle(160, H, 380, 240, 620, H);
    mtn.fillTriangle(420, H, 630, 270, 830, H);
    mtn.fillTriangle(660, H, 860, 230, W, H);
    mtn.fillStyle(COLOR.BG, 1);
    mtn.fillTriangle(0, H, 150, 370, 330, H);
    mtn.fillTriangle(290, H, 510, 310, 740, H);
    mtn.fillTriangle(610, H, 810, 350, W, H);

    // Title
    const title = this.add.text(W / 2, H * 0.28, 'VELANTHAS', {
      fontFamily: "'Press Start 2P'",
      fontSize: '36px',
      color: '#e94560',
      stroke: '#6b0020',
      strokeThickness: 6,
      shadow: { offsetX: 4, offsetY: 4, color: '#6b0020', fill: true },
    }).setOrigin(0.5).setAlpha(0);

    const sub = this.add.text(W / 2, H * 0.39, "THE ACCORD'S SILENCE", {
      fontFamily: "'Press Start 2P'",
      fontSize: '13px',
      color: '#4cc9f0',
      stroke: '#0077b6',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);

    // Hero silhouette
    const hero = this.add.image(W / 2, H * 0.62, 'hero_idle_0')
      .setScale(4)
      .setAlpha(0)
      .setTint(0x4cc9f0);

    // Atmospheric glow
    const glow = this.add.graphics();
    glow.fillStyle(0x4cc9f0, 0.06);
    glow.fillEllipse(W / 2, H * 0.73, 280, 60);

    // Tagline
    const lore = this.add.text(
      W / 2, H * 0.79,
      '"FOUR HUNDRED YEARS OF ACCORD —\nAND THEN, SILENCE"',
      { fontFamily: "'Press Start 2P'", fontSize: '7px', color: '#6b6b8a', align: 'center' },
    ).setOrigin(0.5).setAlpha(0);

    // Press Enter prompt
    const prompt = this.add.text(W / 2, H * 0.90, 'PRESS ENTER TO BEGIN', {
      fontFamily: "'Press Start 2P'", fontSize: '11px', color: '#fffffe',
    }).setOrigin(0.5).setAlpha(0);

    // Reveal sequence
    this.tweens.add({ targets: title,  alpha: 1, duration: 1200, ease: 'Power2', delay: 300 });
    this.tweens.add({ targets: sub,    alpha: 1, duration: 800,  delay: 900 });
    this.tweens.add({ targets: hero,   alpha: 0.9, duration: 1000, ease: 'Back.easeOut', delay: 600 });
    this.tweens.add({ targets: lore,   alpha: 0.6, duration: 800, delay: 1400 });
    this.tweens.add({
      targets: prompt,
      alpha: { from: 0, to: 1 }, duration: 600,
      yoyo: true, repeat: -1, delay: 2500,
    });

    // Hero idle bob
    this.time.addEvent({
      delay: 600,
      callback: () => {
        const next = hero.texture.key === 'hero_idle_0' ? 'hero_idle_1' : 'hero_idle_0';
        hero.setTexture(next);
      },
      loop: true,
    });

    // Star particles
    this._spawnStars();

    // Input
    const start = (): void => {
      if (this._started) return;
      this._started = true;
      this.cameras.main.fadeOut(600, 4, 4, 8);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('PrologueScene');
      });
    };

    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.once('pointerdown', start);
  }

  private _spawnStars(): void {
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, W);
      const y = Phaser.Math.Between(0, H * 0.75);
      const star = this.add.graphics();
      const size = Phaser.Math.Between(1, 2);
      star.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.3, 0.9));
      star.fillRect(0, 0, size, size);
      star.setPosition(x, y);

      this.tweens.add({
        targets: star,
        alpha: { from: Phaser.Math.FloatBetween(0.1, 0.4), to: Phaser.Math.FloatBetween(0.7, 1) },
        duration: Phaser.Math.Between(1200, 4000),
        yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
      });
    }
  }
}

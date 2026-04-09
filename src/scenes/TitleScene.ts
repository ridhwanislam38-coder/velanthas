import Phaser from 'phaser';
import { W, H } from '../config/Constants';

// ── TitleScene — Dark Fantasy Title Screen ──────────────────────────────────
// Coordinates in 320×180 internal resolution (Phaser scales 3× to screen).
// No hero sprite — just atmosphere: stars, mountains, moon, title text.

export default class TitleScene extends Phaser.Scene {
  private _started = false;

  constructor() { super({ key: 'TitleScene' }); }

  create(): void {
    this._started = false;

    // ── Background (starfield) ────────────────────────────────────────
    this.add.image(W / 2, H / 2, 'bg_stars').setDisplaySize(W, H);

    // ── Moon (subtle, upper right) ────────────────────────────────────
    const moon = this.add.graphics();
    moon.fillStyle(0xd0c8a0, 0.6);
    moon.fillCircle(260, 35, 14);
    moon.fillStyle(0xd0c8a0, 0.08);
    moon.fillCircle(260, 35, 22);

    // ── Mountain silhouettes (320×180 coordinates) ────────────────────
    const mtn = this.add.graphics();
    // Far mountains (dark)
    mtn.fillStyle(0x0a0a14, 1);
    mtn.fillTriangle(0, H, 60, 95, 130, H);
    mtn.fillTriangle(50, H, 120, 80, 200, H);
    mtn.fillTriangle(130, H, 200, 90, 280, H);
    mtn.fillTriangle(210, H, 270, 75, W, H);
    // Near mountains (slightly lighter)
    mtn.fillStyle(0x0e0e1a, 1);
    mtn.fillTriangle(0, H, 45, 120, 100, H);
    mtn.fillTriangle(80, H, 160, 105, 240, H);
    mtn.fillTriangle(190, H, 265, 115, W, H);

    // ── Ground fog line ───────────────────────────────────────────────
    const fog = this.add.graphics();
    fog.fillStyle(0x1a1a2a, 0.5);
    fog.fillRect(0, 145, W, 35);

    // ── Title ─────────────────────────────────────────────────────────
    const title = this.add.text(W / 2, 55, 'VELANTHAS', {
      fontFamily: "'Press Start 2P'",
      fontSize: '18px',
      color: '#c8b890',
      stroke: '#2a1a0e',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);

    const sub = this.add.text(W / 2, 72, "THE ACCORD'S SILENCE", {
      fontFamily: "'Press Start 2P'",
      fontSize: '6px',
      color: '#6a6a7a',
      stroke: '#0a0a0e',
      strokeThickness: 1,
    }).setOrigin(0.5).setAlpha(0);

    // ── Accord white line (eerie) ─────────────────────────────────────
    const accordLine = this.add.graphics();
    accordLine.fillStyle(0xF5F0E8, 0.15);
    accordLine.fillRect(W * 0.2, 85, W * 0.6, 1);

    // ── Tagline ───────────────────────────────────────────────────────
    const lore = this.add.text(W / 2, 105,
      '"FOUR HUNDRED YEARS OF ACCORD —\nAND THEN, SILENCE"',
      { fontFamily: "'Press Start 2P'", fontSize: '4px', color: '#4a4a5a', align: 'center' },
    ).setOrigin(0.5).setAlpha(0);

    // ── Prompt ────────────────────────────────────────────────────────
    const prompt = this.add.text(W / 2, 155, 'PRESS ENTER TO BEGIN', {
      fontFamily: "'Press Start 2P'", fontSize: '5px', color: '#8a8a9a',
    }).setOrigin(0.5).setAlpha(0);

    // ── Reveal sequence ───────────────────────────────────────────────
    this.tweens.add({ targets: title, alpha: 1, duration: 2000, ease: 'Power2', delay: 500 });
    this.tweens.add({ targets: sub,   alpha: 0.8, duration: 1200, delay: 1500 });
    this.tweens.add({ targets: lore,  alpha: 0.5, duration: 1000, delay: 2500 });
    this.tweens.add({
      targets: prompt,
      alpha: { from: 0, to: 0.8 }, duration: 800,
      yoyo: true, repeat: -1, delay: 3500,
    });

    // ── Twinkling stars ───────────────────────────────────────────────
    for (let i = 0; i < 20; i++) {
      const sx = Phaser.Math.Between(0, W);
      const sy = Phaser.Math.Between(0, 130);
      const star = this.add.graphics();
      star.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.2, 0.6));
      star.fillRect(0, 0, 1, 1);
      star.setPosition(sx, sy);

      this.tweens.add({
        targets: star,
        alpha: { from: Phaser.Math.FloatBetween(0.05, 0.2), to: Phaser.Math.FloatBetween(0.4, 0.8) },
        duration: Phaser.Math.Between(2000, 5000),
        yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 4000),
      });
    }

    // ── Drifting ash particles ─────────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const ash = this.add.graphics();
      ash.fillStyle(0x8a7a5a, 0.3);
      ash.fillRect(0, 0, 1, 1);
      ash.setPosition(Phaser.Math.Between(0, W), Phaser.Math.Between(60, 140));

      this.tweens.add({
        targets: ash,
        x: `+=${Phaser.Math.Between(-20, 20)}`,
        y: `+=${Phaser.Math.Between(10, 30)}`,
        alpha: { from: 0.3, to: 0 },
        duration: Phaser.Math.Between(4000, 8000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 5000),
      });
    }

    // ── Input ─────────────────────────────────────────────────────────
    const start = (): void => {
      if (this._started) return;
      this._started = true;
      this.cameras.main.fadeOut(800, 4, 4, 8);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('AshfieldsScene');
      });
    };

    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.once('pointerdown', start);
  }
}

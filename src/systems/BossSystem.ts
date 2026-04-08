import Phaser from 'phaser';
import { JuiceSystem } from './JuiceSystem';
import { COLOR, FONT } from '../config/Constants';
import { PHASE_THRESHOLDS } from '../config/enemyConfig';

// ── Boss System ────────────────────────────────────────────────────────────
// Shared logic for all bosses:
//   - Phase transitions (cutscene flash, music shift, name card)
//   - Top-of-screen boss health bar
//   - Name card on encounter start
//   - Death slow-mo + silence + music swell
//   - Death counter per boss (shown on kill screen)
//   - Rematch from fog gate (no penalty)
//   - Lore fragment drop

export type BossPhase = 1 | 2 | 3;

export interface BossConfig {
  id:    string;
  name:  string;
  title: string;  // e.g. "The Forsaken Knight"
  phase2MusicKey?: string;
  phase3MusicKey?: string;
  loreFragment: string;  // shown on kill
}

export class BossSystem {
  private _scene:    Phaser.Scene;
  private _juice:    JuiceSystem;
  private _config:   BossConfig;
  private _phase:    BossPhase = 1;
  private _hpBarBg!: Phaser.GameObjects.Rectangle;
  private _hpBarFill!: Phaser.GameObjects.Rectangle;
  private _hpBarDelay!: Phaser.GameObjects.Rectangle;
  private _nameCard!: Phaser.GameObjects.Container;
  private _deathCount: number;
  private _phaseTransitioning = false;

  // HP bar dimensions (top of screen)
  private readonly BAR_W = 200;
  private readonly BAR_H = 5;

  constructor(scene: Phaser.Scene, juice: JuiceSystem, config: BossConfig) {
    this._scene  = scene;
    this._juice  = juice;
    this._config = config;

    const deathKey = `sq_boss_deaths_${config.id}`;
    this._deathCount = parseInt(localStorage.getItem(deathKey) ?? '0', 10);

    this._buildBossBar();
    this._showNameCard();
  }

  // ── Boss HP bar (top center, full-width style) ─────────────────────────
  private _buildBossBar(): void {
    const { width } = this._scene.scale;
    const cx = width / 2;
    const y  = 14;

    this._scene.add.text(cx, y - 7, this._config.name, {
      fontFamily: "'Press Start 2P'", fontSize: FONT.XS, color: '#e8e8f0',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(200);

    this._hpBarBg = this._scene.add
      .rectangle(cx - this.BAR_W / 2, y, this.BAR_W, this.BAR_H, 0x1a1a2e)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(200);

    this._hpBarDelay = this._scene.add
      .rectangle(cx - this.BAR_W / 2, y, this.BAR_W, this.BAR_H, COLOR.GOLD)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(201);

    this._hpBarFill = this._scene.add
      .rectangle(cx - this.BAR_W / 2, y, this.BAR_W, this.BAR_H, COLOR.DANGER)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(202);
  }

  setHpPercent(pct: number): void {
    const clamped = Phaser.Math.Clamp(pct, 0, 1);
    this._hpBarFill.setSize(this.BAR_W * clamped, this.BAR_H);

    // Delay bar catches up
    this._scene.tweens.add({
      targets: this._hpBarDelay,
      scaleX: clamped,
      duration: 600,
      ease: 'Power1',
    });

    // Check phase transitions
    if (!this._phaseTransitioning) {
      if (this._phase === 1 && pct <= PHASE_THRESHOLDS.PHASE_2) {
        this._transitionPhase(2);
      } else if (this._phase === 2 && pct <= PHASE_THRESHOLDS.PHASE_3) {
        this._transitionPhase(3);
      }
    }
  }

  // ── Phase transition ───────────────────────────────────────────────────
  private _transitionPhase(newPhase: BossPhase): void {
    this._phaseTransitioning = true;
    this._phase = newPhase;

    // Freeze 0.8s
    this._scene.physics.world.timeScale = 0;
    this._scene.time.delayedCall(800, () => {
      this._scene.physics.world.timeScale = 1;
      this._phaseTransitioning = false;
    });

    // Flash
    this._juice.flash(COLOR.WHITE, 1.0, 400);

    // New name card with phase subtitle
    const subtitle = newPhase === 2 ? '— PHASE II —' : '— PHASE III —';
    this._showNameCard(subtitle);

    // Music shift (handled by AudioSystem in actual implementation)
    const musicKey = newPhase === 2
      ? this._config.phase2MusicKey
      : this._config.phase3MusicKey;
    if (musicKey) {
      this._scene.events.emit('boss_phase_music', musicKey);
    }

    this._scene.events.emit('boss_phase_change', newPhase);
  }

  // ── Name card (slides in from left) ───────────────────────────────────
  private _showNameCard(subtitle?: string): void {
    this._nameCard?.destroy();

    const { width, height } = this._scene.scale;
    const container = this._scene.add.container(-120, height * 0.75);
    container.setScrollFactor(0).setDepth(300);

    const bg = this._scene.add.rectangle(0, 0, 130, 28, 0x000000, 0.7)
      .setOrigin(0, 0.5);
    const line = this._scene.add.rectangle(0, -14, 3, 28, COLOR.DANGER, 1)
      .setOrigin(0, 0.5);
    const nameText = this._scene.add.text(8, subtitle ? -6 : 0, this._config.name, {
      fontFamily: "'Press Start 2P'", fontSize: FONT.XS, color: '#e8e8f0',
    }).setOrigin(0, 0.5);
    const subText = subtitle
      ? this._scene.add.text(8, 5, subtitle, {
          fontFamily: "'Press Start 2P'", fontSize: '4px', color: COLOR.DANGER_S,
        }).setOrigin(0, 0.5)
      : null;

    container.add([bg, line, nameText, ...(subText ? [subText] : [])]);

    // Slide in
    this._scene.tweens.add({
      targets: container,
      x: 12, duration: 400, ease: 'Back.easeOut',
      onComplete: () => {
        // Slide out after 2s
        this._scene.time.delayedCall(2000, () => {
          this._scene.tweens.add({
            targets: container,
            x: -140, duration: 300, ease: 'Power2',
            onComplete: () => container.destroy(),
          });
        });
      },
    });

    this._nameCard = container;
    void width;
  }

  // ── Death sequence ─────────────────────────────────────────────────────
  onBossDeath(bossSprite: Phaser.Physics.Arcade.Image): void {
    // Record death count (this was a kill — increment)
    this._deathCount = 0; // reset on kill
    localStorage.setItem(`sq_boss_deaths_${this._config.id}`, '0');

    this._juice.onKill(bossSprite);

    // Silence 0.5s
    this._scene.time.delayedCall(500, () => {
      this._scene.events.emit('boss_killed', {
        id:            this._config.id,
        loreFragment:  this._config.loreFragment,
      });
    });

    // Show lore fragment
    this._scene.time.delayedCall(1200, () => {
      this._showLoreFragment();
    });
  }

  onPlayerDeath(): void {
    this._deathCount++;
    localStorage.setItem(
      `sq_boss_deaths_${this._config.id}`,
      String(this._deathCount),
    );
  }

  private _showLoreFragment(): void {
    const { width, height } = this._scene.scale;
    const bg = this._scene.add
      .rectangle(width / 2, height / 2, 220, 60, 0x000000, 0.85)
      .setScrollFactor(0).setDepth(500);
    const text = this._scene.add.text(width / 2, height / 2, this._config.loreFragment, {
      fontFamily: "'Press Start 2P'", fontSize: FONT.XS,
      color: '#e8e8f0', align: 'center', wordWrap: { width: 200 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501);

    this._scene.time.delayedCall(4000, () => {
      this._scene.tweens.add({
        targets: [bg, text], alpha: 0, duration: 500,
        onComplete: () => { bg.destroy(); text.destroy(); },
      });
    });
  }

  get phase(): BossPhase { return this._phase; }
  get deathCount(): number { return this._deathCount; }
}

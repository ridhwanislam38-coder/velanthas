import Phaser from 'phaser';
import { DEPTH } from '../config/visualConfig';
import { FONT, COLOR } from '../config/Constants';
import { Bus, GameEvent } from '../systems/EventBus';

// ── HUD — Heads-Up Display for birds-eye gameplay ───────────────────────────
// Renders at UI depth (400), unaffected by lighting/postFX.
// Shows: HP bar, AP orbs, currency counter, region name.
// All values update via EventBus — HUD never imports game systems directly.

export class HUD {
  private _scene: Phaser.Scene;

  // HP
  private _hpBarBg!:   Phaser.GameObjects.Rectangle;
  private _hpBarFill!: Phaser.GameObjects.Rectangle;
  private _hpText!:    Phaser.GameObjects.Text;
  private _hpPct = 1;

  // AP orbs
  private _apOrbs: Phaser.GameObjects.Arc[] = [];
  private _apCount = 0;
  private _apMax   = 3;

  // Currency
  private _currencyText!: Phaser.GameObjects.Text;
  private _lumens = 0;

  // Region name (fades in on enter, fades out after 3s)
  private _regionText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
    this._buildHP();
    this._buildAP();
    this._buildCurrency();
    this._buildRegionLabel();
    this._wireEvents();
  }

  // ── Build ─────────────────────────────────────────────────────────────

  private _buildHP(): void {
    const x = 8;
    const y = 6;
    const w = 60;
    const h = 6;

    this._hpBarBg = this._scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x1a1a2e);
    this._hpBarBg.setDepth(DEPTH.UI).setScrollFactor(0);

    this._hpBarFill = this._scene.add.rectangle(x + w / 2, y + h / 2, w, h, COLOR.DANGER);
    this._hpBarFill.setDepth(DEPTH.UI).setScrollFactor(0);

    this._hpText = this._scene.add.text(x + w + 4, y - 1, '100', {
      fontFamily: "'Press Start 2P'", fontSize: FONT.XS, color: '#e8e8f0',
    }).setDepth(DEPTH.UI).setScrollFactor(0);
  }

  private _buildAP(): void {
    const startX = 8;
    const y = 16;
    for (let i = 0; i < this._apMax; i++) {
      const orb = this._scene.add.circle(startX + i * 10, y, 3, COLOR.AP_EMPTY);
      orb.setDepth(DEPTH.UI).setScrollFactor(0);
      this._apOrbs.push(orb);
    }
  }

  private _buildCurrency(): void {
    this._currencyText = this._scene.add.text(260, 6, '0', {
      fontFamily: "'Press Start 2P'", fontSize: FONT.XS, color: COLOR.GOLD_S,
    }).setDepth(DEPTH.UI).setScrollFactor(0).setOrigin(1, 0);
  }

  private _buildRegionLabel(): void {
    this._regionText = this._scene.add.text(160, 80, '', {
      fontFamily: "'Press Start 2P'", fontSize: FONT.SM, color: '#e8e8f0',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(DEPTH.UI).setScrollFactor(0).setOrigin(0.5).setAlpha(0);
  }

  // ── Update (call from scene.update) ───────────────────────────────────
  update(_delta: number): void {
    // HP bar fill width
    const maxW = this._hpBarBg.width;
    this._hpBarFill.width = maxW * this._hpPct;
    this._hpBarFill.x = this._hpBarBg.x - (maxW - this._hpBarFill.width) / 2;

    // HP bar color shift
    if (this._hpPct < 0.2) {
      this._hpBarFill.setFillStyle(0xff0000);
    } else if (this._hpPct < 0.5) {
      this._hpBarFill.setFillStyle(0xff8800);
    } else {
      this._hpBarFill.setFillStyle(COLOR.DANGER);
    }

    // AP orbs
    for (let i = 0; i < this._apOrbs.length; i++) {
      this._apOrbs[i]!.setFillStyle(i < this._apCount ? COLOR.AP_FULL : COLOR.AP_EMPTY);
    }

    // Currency
    this._currencyText.setText(String(this._lumens));
  }

  // ── Region name flash ─────────────────────────────────────────────────
  showRegionName(name: string): void {
    this._regionText.setText(name);
    this._regionText.setAlpha(0);
    this._scene.tweens.add({
      targets: this._regionText,
      alpha: 1,
      duration: 800,
      hold: 2500,
      yoyo: true,
    });
  }

  // ── Cleanup ───────────────────────────────────────────────────────────
  destroy(): void {
    // GameObjects are destroyed with the scene
  }

  // ── Event wiring ──────────────────────────────────────────────────────
  private _wireEvents(): void {
    Bus.on(GameEvent.HP_CHANGED, (data: unknown) => {
      const d = data as { hp: number; maxHp: number };
      this._hpPct = d.maxHp > 0 ? d.hp / d.maxHp : 0;
      this._hpText.setText(String(Math.ceil(d.hp)));
    });

    Bus.on(GameEvent.AP_CHANGED, (data: unknown) => {
      const d = data as { current: number; max: number };
      this._apCount = d.current;
      this._apMax = d.max;
    });

    Bus.on(GameEvent.CURRENCY_GAIN, (data: unknown) => {
      const d = data as { total: number };
      this._lumens = d.total;
    });

    Bus.on(GameEvent.CURRENCY_SPEND, (data: unknown) => {
      const d = data as { total: number };
      this._lumens = d.total;
    });

    Bus.on(GameEvent.REGION_ENTER, (data: unknown) => {
      const d = data as { region?: string };
      if (d.region) {
        const displayName = d.region.replace(/_/g, ' ');
        this.showRegionName(displayName);
      }
    });
  }
}

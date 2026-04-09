import Phaser from 'phaser';
import { DEPTH } from '../config/visualConfig';
import { FONT, COLOR, W, H } from '../config/Constants';
import { Bus, GameEvent } from '../systems/EventBus';
import { Audio } from '../systems/AudioSystem';
import { Input, InputAction } from '../systems/InputSystem';

// ── PauseMenu — ESC key overlay ─────────────────────────────────────────────
// Pauses the game, shows settings (audio volumes, input rebinding stub),
// resume, and quit-to-title options. Rendered at UI depth.

type MenuOption = 'resume' | 'settings' | 'quit';

export class PauseMenu {
  private _scene: Phaser.Scene;
  private _container!: Phaser.GameObjects.Container;
  private _options: Phaser.GameObjects.Text[] = [];
  private _selectedIdx = 0;
  private _isOpen = false;

  // Settings sub-panel
  private _settingsOpen = false;
  private _volumeTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
    this._build();
  }

  get isOpen(): boolean { return this._isOpen; }

  toggle(): void {
    if (this._isOpen) this.close();
    else this.open();
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this._container.setVisible(true);
    this._selectedIdx = 0;
    this._updateSelection();
    this._scene.physics.pause();
    Bus.emit(GameEvent.GAME_PAUSE, {});
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._settingsOpen = false;
    this._container.setVisible(false);
    this._scene.physics.resume();
    Bus.emit(GameEvent.GAME_RESUME, {});
  }

  update(): void {
    if (!this._isOpen) return;

    if (this._settingsOpen) {
      this._updateSettings();
      return;
    }

    if (Input.justDown(InputAction.MOVE_UP)) {
      this._selectedIdx = (this._selectedIdx - 1 + this._options.length) % this._options.length;
      this._updateSelection();
    }
    if (Input.justDown(InputAction.MOVE_DOWN)) {
      this._selectedIdx = (this._selectedIdx + 1) % this._options.length;
      this._updateSelection();
    }
    if (Input.justDown(InputAction.INTERACT) || Input.justDown(InputAction.ATTACK_LIGHT)) {
      this._selectOption();
    }
    if (Input.justDown(InputAction.MENU)) {
      this.close();
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────

  private _build(): void {
    this._container = this._scene.add.container(0, 0);
    this._container.setDepth(DEPTH.UI + 10); // above normal UI
    this._container.setScrollFactor(0);
    this._container.setVisible(false);

    // Darkened backdrop
    const bg = this._scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7);
    this._container.add(bg);

    // Title
    const title = this._scene.add.text(W / 2, H * 0.25, 'PAUSED', {
      fontFamily: "'Press Start 2P'", fontSize: FONT.LG, color: '#e8e8f0',
    }).setOrigin(0.5);
    this._container.add(title);

    // Menu options
    const labels: Array<{ text: string; key: MenuOption }> = [
      { text: 'RESUME',   key: 'resume' },
      { text: 'SETTINGS', key: 'settings' },
      { text: 'QUIT TO TITLE', key: 'quit' },
    ];

    for (let i = 0; i < labels.length; i++) {
      const opt = this._scene.add.text(W / 2, H * 0.45 + i * 20, labels[i]!.text, {
        fontFamily: "'Press Start 2P'", fontSize: FONT.SM, color: '#6b6b8a',
      }).setOrigin(0.5).setData('key', labels[i]!.key);
      this._container.add(opt);
      this._options.push(opt);
    }

    // Settings sub-panel (hidden by default)
    this._buildSettingsPanel();
  }

  private _buildSettingsPanel(): void {
    const channels = ['Ambient Bed', 'Ambient Layer', 'SFX'] as const;
    const channelKeys = ['ambientBed', 'ambientLayer', 'sfx'] as const;

    for (let i = 0; i < channels.length; i++) {
      const label = this._scene.add.text(W * 0.2, H * 0.45 + i * 16, channels[i]!, {
        fontFamily: "'Press Start 2P'", fontSize: FONT.XS, color: '#e8e8f0',
      }).setVisible(false);
      this._container.add(label);

      const vol = Audio.getVolume(channelKeys[i]!);
      const volText = this._scene.add.text(W * 0.75, H * 0.45 + i * 16, `${Math.round(vol * 100)}%`, {
        fontFamily: "'Press Start 2P'", fontSize: FONT.XS, color: COLOR.GOLD_S,
      }).setVisible(false).setData('channel', channelKeys[i]!);
      this._container.add(volText);
      this._volumeTexts.push(volText);
    }
  }

  // ── Selection ─────────────────────────────────────────────────────────

  private _updateSelection(): void {
    for (let i = 0; i < this._options.length; i++) {
      this._options[i]!.setColor(i === this._selectedIdx ? '#ffffff' : '#6b6b8a');
    }
  }

  private _selectOption(): void {
    const key = this._options[this._selectedIdx]?.getData('key') as MenuOption | undefined;
    if (!key) return;

    if (key === 'resume') {
      this.close();
    } else if (key === 'settings') {
      this._settingsOpen = true;
      this._selectedIdx = 0;
      // Show volume controls, hide menu options
      for (const opt of this._options) opt.setVisible(false);
      for (const vt of this._volumeTexts) vt.setVisible(true);
      // Show labels too (they're the previous siblings in the container)
      const children = this._container.getAll();
      for (const child of children) {
        if (child instanceof Phaser.GameObjects.Text && !this._options.includes(child) && !this._volumeTexts.includes(child)) {
          // Label texts for settings
        }
      }
    } else if (key === 'quit') {
      this.close();
      this._scene.scene.start('TitleScene');
    }
  }

  private _updateSettings(): void {
    if (Input.justDown(InputAction.MENU) || Input.justDown(InputAction.PARRY)) {
      // Back to main menu
      this._settingsOpen = false;
      for (const opt of this._options) opt.setVisible(true);
      for (const vt of this._volumeTexts) vt.setVisible(false);
      this._updateSelection();
      return;
    }

    const channelKeys = ['ambientBed', 'ambientLayer', 'sfx'] as const;

    if (Input.justDown(InputAction.MOVE_UP)) {
      this._selectedIdx = (this._selectedIdx - 1 + channelKeys.length) % channelKeys.length;
    }
    if (Input.justDown(InputAction.MOVE_DOWN)) {
      this._selectedIdx = (this._selectedIdx + 1) % channelKeys.length;
    }

    const channel = channelKeys[this._selectedIdx];
    if (channel) {
      let vol = Audio.getVolume(channel);
      if (Input.justDown(InputAction.MOVE_RIGHT)) vol = Math.min(1, vol + 0.1);
      if (Input.justDown(InputAction.MOVE_LEFT))  vol = Math.max(0, vol - 0.1);
      Audio.setVolume(channel, vol);
    }

    // Update display
    for (let i = 0; i < this._volumeTexts.length; i++) {
      const ch = channelKeys[i];
      if (!ch) continue;
      const v = Audio.getVolume(ch);
      this._volumeTexts[i]!.setText(`${Math.round(v * 100)}%`);
      this._volumeTexts[i]!.setColor(i === this._selectedIdx ? '#ffffff' : COLOR.GOLD_S);
    }
  }

  destroy(): void {
    this._container.destroy();
  }
}

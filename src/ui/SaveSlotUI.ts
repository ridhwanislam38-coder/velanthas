import Phaser from 'phaser';
import { DEPTH } from '../config/visualConfig';
import { FONT, COLOR, W, H } from '../config/Constants';

// ── SaveSlotUI — 5 save slots on title screen ──────────────────────────────
// Shows saved game slots with region, playtime, level.
// Select to load, or pick empty slot for new game.

export interface SaveSlotData {
  index:    number;
  label:    string;
  region?:  string;
  level?:   number;
  playtime?:string; // formatted "HH:MM"
  empty:    boolean;
}

export class SaveSlotUI {
  private _scene: Phaser.Scene;
  private _container!: Phaser.GameObjects.Container;
  private _slots: Phaser.GameObjects.Text[] = [];
  private _selectedIdx = 0;
  private _visible = false;
  private _onSelect: ((slot: SaveSlotData) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
    this._build();
  }

  show(data: SaveSlotData[], onSelect: (slot: SaveSlotData) => void): void {
    this._onSelect = onSelect;
    this._visible = true;
    this._container.setVisible(true);
    this._selectedIdx = 0;

    for (let i = 0; i < 5; i++) {
      const slot = data[i];
      if (slot && !slot.empty) {
        this._slots[i]!.setText(`${slot.label}  Lv.${slot.level}  ${slot.region}  ${slot.playtime}`);
      } else {
        this._slots[i]!.setText(`Slot ${i + 1}  — Empty —`);
      }
    }
    this._updateSelection();
  }

  hide(): void {
    this._visible = false;
    this._container.setVisible(false);
    this._onSelect = null;
  }

  get isVisible(): boolean { return this._visible; }

  update(cursors: { up: boolean; down: boolean; confirm: boolean; back: boolean }): void {
    if (!this._visible) return;

    if (cursors.up) {
      this._selectedIdx = (this._selectedIdx - 1 + 5) % 5;
      this._updateSelection();
    }
    if (cursors.down) {
      this._selectedIdx = (this._selectedIdx + 1) % 5;
      this._updateSelection();
    }
    if (cursors.confirm && this._onSelect) {
      this._onSelect({
        index: this._selectedIdx,
        label: `Slot ${this._selectedIdx + 1}`,
        empty: this._slots[this._selectedIdx]!.text.includes('Empty'),
      });
    }
    if (cursors.back) {
      this.hide();
    }
  }

  private _build(): void {
    this._container = this._scene.add.container(0, 0);
    this._container.setDepth(DEPTH.UI + 5);
    this._container.setScrollFactor(0);
    this._container.setVisible(false);

    // Background
    const bg = this._scene.add.rectangle(W / 2, H / 2, W * 0.8, H * 0.7, 0x0a0a18, 0.9);
    bg.setStrokeStyle(1, 0x4cc9f0);
    this._container.add(bg);

    // Title
    const title = this._scene.add.text(W / 2, H * 0.2, 'SAVE SLOTS', {
      fontFamily: "'Press Start 2P'", fontSize: FONT.SM, color: '#e8e8f0',
    }).setOrigin(0.5);
    this._container.add(title);

    // 5 slots
    for (let i = 0; i < 5; i++) {
      const txt = this._scene.add.text(W / 2, H * 0.32 + i * 18, `Slot ${i + 1}  — Empty —`, {
        fontFamily: "'Press Start 2P'", fontSize: FONT.XS, color: '#6b6b8a',
      }).setOrigin(0.5);
      this._container.add(txt);
      this._slots.push(txt);
    }
  }

  private _updateSelection(): void {
    for (let i = 0; i < this._slots.length; i++) {
      this._slots[i]!.setColor(i === this._selectedIdx ? '#ffffff' : '#6b6b8a');
    }
  }

  destroy(): void {
    this._container.destroy();
  }
}

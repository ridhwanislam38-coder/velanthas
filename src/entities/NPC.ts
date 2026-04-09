import Phaser from 'phaser';
import { DialogueSystem, type DialogueTree } from '../systems/DialogueSystem';
import { Bus, GameEvent } from '../systems/EventBus';
import { DEPTH } from '../config/visualConfig';
import { FONT, COLOR } from '../config/Constants';

export interface NpcConfig {
  id:         string;
  name:       string;
  x:          number;
  y:          number;
  textureKey: string;
  dialogueTree: DialogueTree;
  startNode:  string;
  patrolX?:   [number, number]; // [leftBound, rightBound] — optional wander
}

// ── NPC Entity ─────────────────────────────────────────────────────────────
// Wanders between patrol bounds.
// Shows "!" indicator when player is within talk range.
// Z / Space key while in range starts dialogue via DialogueSystem.
export class NPC {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly config: NpcConfig;

  private _scene:     Phaser.Scene;
  private _dlg:       DialogueSystem;
  private _indicator: Phaser.GameObjects.Text;
  private _nameLabel: Phaser.GameObjects.Text;
  private _inRange    = false;
  private _patrolDir: 1 | -1 = 1;

  private static readonly TALK_RANGE  = 40;  // px — trigger "!" at this distance
  private static readonly PATROL_SPEED = 20; // px/s

  constructor(scene: Phaser.Scene, config: NpcConfig) {
    this._scene  = scene;
    this.config  = config;

    this.sprite = scene.physics.add.image(config.x, config.y, config.textureKey)
      .setDepth(DEPTH.GAME + 1)
      .setCollideWorldBounds(true);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setImmovable(true);

    // "!" talk indicator
    this._indicator = scene.add.text(config.x, config.y - 20, '!', {
      fontFamily: "'Press Start 2P'",
      fontSize:   FONT.SM,
      color:      COLOR.GOLD_S,
    }).setOrigin(0.5).setDepth(DEPTH.UI).setVisible(false);

    // Name label (always visible, above sprite)
    this._nameLabel = scene.add.text(config.x, config.y - 14, config.name, {
      fontFamily: "'Press Start 2P'",
      fontSize:   FONT.XS,
      color:      '#c0c0d8',
    }).setOrigin(0.5).setDepth(DEPTH.UI);

    // Dialogue system (scene-scoped)
    this._dlg = new DialogueSystem(scene);
    this._dlg.loadTree(config.dialogueTree);

    if (config.patrolX) {
      this._startWander(config.patrolX[0], config.patrolX[1]);
    }
  }

  // ── Update — call from scene update ─────────────────────────────────
  update(playerX: number, playerY: number, talkPressed: boolean): void {
    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y, playerX, playerY,
    );

    const wasInRange = this._inRange;
    this._inRange = dist <= NPC.TALK_RANGE;

    // Show/hide indicator on enter/exit range
    if (this._inRange !== wasInRange) {
      this._indicator.setVisible(this._inRange);
    }

    // Pulse indicator
    if (this._inRange) {
      const a = 0.6 + 0.4 * Math.sin(Date.now() * 0.004);
      this._indicator.setAlpha(a);
    }

    // Trigger dialogue
    if (this._inRange && talkPressed && !this._dlg.isActive) {
      this._dlg.start(this.config.startNode, () => {
        Bus.emit(GameEvent.DIALOGUE_END, { npcId: this.config.id });
      });
      Bus.emit(GameEvent.DIALOGUE_START, { npcId: this.config.id });
    }

    if (this._dlg.isActive) {
      // advance() called externally from scene when Z is pressed
    }

    // Sync label position
    this._indicator.setPosition(this.sprite.x, this.sprite.y - 20);
    this._nameLabel.setPosition(this.sprite.x, this.sprite.y - 14);
  }

  /** Forward Z-press to dialogue system. */
  advance(): void { this._dlg.advance(); }

  get isInDialogue(): boolean { return this._dlg.isActive; }

  destroy(): void {
    this._dlg.destroy();
    this._indicator.destroy();
    this._nameLabel.destroy();
    this.sprite.destroy();
  }

  // ── Wander patrol ─────────────────────────────────────────────────
  private _startWander(left: number, right: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    // Recursive tween between patrol bounds
    const move = () => {
      if (this._dlg.isActive) {
        this._scene.time.delayedCall(500, move);
        return;
      }
      const target = this._patrolDir === 1 ? right : left;
      const dist   = Math.abs(this.sprite.x - target);
      const durationMs = (dist / NPC.PATROL_SPEED) * 1000;

      this._scene.tweens.add({
        targets:  this.sprite,
        x:        target,
        duration: durationMs,
        ease:     'Linear',
        onUpdate: () => {
          this.sprite.setFlipX(this._patrolDir < 0);
        },
        onComplete: () => {
          this._patrolDir = (this._patrolDir * -1) as 1 | -1;
          this._scene.time.delayedCall(800, move);
        },
      });
    };

    void body;
    move();
  }
}

// ── Starter dialogue tree — Magistra Eon ─────────────────────────────────
// Scholar of the Accord, found in the Ashfields hub. Not a mentor — an NPC
// with knowledge the player can choose to engage with or ignore.
export const MAGISTRA_EON_TREE: DialogueTree = {
  intro: {
    lines: [
      {
        speaker: 'Magistra Eon',
        text: 'You felt it too, didn\'t you? The silence where the Accord used to be.',
      },
      {
        speaker: 'Magistra Eon',
        text: 'I have studied it for thirty years. I still don\'t know what broke it.',
      },
    ],
    choices: [
      {
        label: 'What was the Accord?',
        next:  'accord_explain',
      },
      {
        label: 'Where do I start?',
        next:  'where_start',
      },
      {
        label: 'I\'ll find out myself.',
        next:  'dismiss',
      },
    ],
  },
  accord_explain: {
    lines: [
      {
        speaker: 'Magistra Eon',
        text: 'A pact between the old powers. It kept VELANTHAS breathing — barely.',
      },
      {
        speaker: 'Magistra Eon',
        text: 'Someone chose to end it. That choice changed everything.',
      },
    ],
    choices: [
      { label: 'Who made that choice?', next: 'who_chose' },
      { label: 'Where do I start?',     next: 'where_start' },
    ],
  },
  who_chose: {
    lines: [
      {
        speaker: 'Magistra Eon',
        text: 'The ruins in the Ashfields speak of someone named Edric. Beyond that... silence.',
      },
    ],
    onEnd: () => { /* lore fragment unlocked */ },
  },
  where_start: {
    lines: [
      {
        speaker: 'Magistra Eon',
        text: 'The Ashfields. Every answer starts in ash.',
      },
    ],
  },
  dismiss: {
    lines: [
      {
        speaker: 'Magistra Eon',
        text: 'Of course. The ruins won\'t wait.',
      },
    ],
  },
};

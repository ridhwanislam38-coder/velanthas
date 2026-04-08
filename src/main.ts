import Phaser from 'phaser';
import { gameConfig } from './config/GameConfig';
import type { GameState } from './types/game';

// ── Global game state ──────────────────────────────────────────────────────
// Exposed on window so HTML overlays and systems can reach it without
// complex dependency injection at this early stage.
declare global {
  interface Window {
    GS: GameState;
    game: Phaser.Game;
  }
}

window.GS = {
  player: {
    name: 'Scholar',
    level: 1,
    xp: 0,
    xpToNext: 120,
    hp: 100,
    maxHp: 100,
    atk: 10,
    gold: 100,
    combo: 0,
    breakCount: 0,
    subject: null,
    items: { hints: 0, shields: 0, surges: 0, elixirs: 0 },
    buffs: { atkMult: 1, shieldActive: false, surgeActive: false },
    questionsAnswered: 0,
    totalDamage: 0,
    maxCombo: 0,
  },
  battle: null,
  apiKey: '',
  detectedTopic: '',
  customQuestions: [],
  saveId: null,
};

window.game = new Phaser.Game(gameConfig);

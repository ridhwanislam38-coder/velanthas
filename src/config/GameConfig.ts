import Phaser from 'phaser';
import { W, H, GRAVITY } from './Constants';
import BootScene      from '../scenes/BootScene';
import TitleScene     from '../scenes/TitleScene';
import PrologueScene  from '../scenes/PrologueScene';
import TownScene      from '../scenes/TownScene';
import DungeonScene   from '../scenes/DungeonScene';
import AshfieldsScene  from '../scenes/AshfieldsScene';
import VerdenmereScene  from '../scenes/VerdenmereScene';
import GreyveilScene    from '../scenes/GreyveilScene';
import GildspireScene   from '../scenes/GildspireScene';
import VoidmarshScene   from '../scenes/VoidmarshScene';
import UnnamedCityScene from '../scenes/UnnamedCityScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  // Internal resolution: 320×180 — Phaser renders here, Scale.FIT zooms 3× to screen
  width: W,
  height: H,
  parent: 'game-container',
  backgroundColor: '#040408',
  pixelArt: true,      // nearest-neighbour scaling — no blur ever
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: GRAVITY }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    TitleScene,
    PrologueScene,
    TownScene,
    DungeonScene,
    AshfieldsScene,
    VerdenmereScene,
    GreyveilScene,
    GildspireScene,
    VoidmarshScene,
    UnnamedCityScene,
  ],
};

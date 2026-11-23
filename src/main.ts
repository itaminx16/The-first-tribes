import './ui/menuStyles.css';
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GAME_DPR, installCrispPhaserText } from './utils/display';
import { pwaManager } from './utils/pwa';

pwaManager.init();
installCrispPhaserText();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#110a06',
  render: {
    antialias: true,
    antialiasGL: true,
    roundPixels: false
  },
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: Math.max(1, Math.round(window.innerWidth * GAME_DPR)),
    height: Math.max(1, Math.round(window.innerHeight * GAME_DPR)),
    zoom: 1 / GAME_DPR
  },
  input: {
    activePointers: 3
  },
  scene: [GameScene, UIScene]
};

const game = new Phaser.Game(config);

const syncGameCanvasSize = (): void => {
  const w = Math.max(1, Math.round(window.innerWidth * GAME_DPR));
  const h = Math.max(1, Math.round(window.innerHeight * GAME_DPR));
  if (game.scale.width !== w || game.scale.height !== h) {
    game.scale.resize(w, h);
  }
};

window.addEventListener('resize', syncGameCanvasSize);
window.addEventListener('orientationchange', () => {
  syncGameCanvasSize();
  window.setTimeout(syncGameCanvasSize, 160);
});

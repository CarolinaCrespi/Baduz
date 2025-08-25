import MazeScene from './scene.js';
import { saveGameSnapshot } from './storage.js';

const game = new Phaser.Game({
  type: Phaser.CANVAS,
  width: 1000,
  height: 700,
  canvas: document.getElementById('gameCanvas'),
  transparent: true,
  physics: { default:'arcade', arcade:{ gravity:{ y:0 }, debug:false } },
  scene: MazeScene
});

// Autosave on exit
window.addEventListener('beforeunload', ()=>{
  const scene = game?.scene?.keys?.['MazeScene'];
  if (scene && scene.getSnapshot) saveGameSnapshot(scene.getSnapshot(true));
});

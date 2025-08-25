import MazeScene from './scene.js';

const config = {
  type: Phaser.CANVAS,
  width: 1000,
  height: 700,
  canvas: document.getElementById('gameCanvas'), // deve esistere nell’HTML
  transparent: true,
  physics: { default:'arcade', arcade:{ gravity:{y:0}, debug:false } },
  scene: MazeScene
};

const game = new Phaser.Game(config);

// Autosave su chiusura
window.addEventListener('beforeunload', ()=>{
  const scene = game?.scene?.keys?.['MazeScene'];
  if (scene && scene.getSnapshot) {
    // eslint-disable-next-line no-undef
    (await import('./storage.js')).saveGameSnapshot(scene.getSnapshot(true));
  }
});

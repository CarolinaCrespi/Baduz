/* =========================================================
   BADUZ – Phaser Game Initialization
   Entry point. Depends on MazeScene.js being loaded first.
   ========================================================= */

function getCanvasFrameSize() {
  const frame = document.querySelector('.canvas-wrapper') || document.querySelector('.canvas-frame');
  if (!frame) {
    return { width: Math.max(320, window.innerWidth), height: Math.max(240, window.innerHeight) };
  }
  const r = frame.getBoundingClientRect();
  return {
    width:  Math.max(320, Math.floor(r.width  || 0)),
    height: Math.max(240, Math.floor(r.height || 0))
  };
}

let game = null;

function initPhaserGame() {
  const { width, height } = getCanvasFrameSize();

  const config = {
    type:    Phaser.CANVAS,
    width,
    height,
    canvas:  document.getElementById('gameCanvas'),
    transparent: true,
    physics: {
      default: 'arcade',
      arcade:  { gravity: { y: 0 }, debug: false }
    },
    scene: MazeScene
  };

  game        = new Phaser.Game(config);
  window.game = game;

  // Keep Phaser canvas size aligned with visible container
  const frame = document.querySelector('.canvas-wrapper') || document.querySelector('.canvas-frame');
  if (frame && window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      if (!game || !game.scale) return;
      const s = getCanvasFrameSize();
      game.scale.resize(s.width, s.height);
    });
    ro.observe(frame);
  } else {
    window.addEventListener('resize', () => {
      if (!game || !game.scale) return;
      const s = getCanvasFrameSize();
      game.scale.resize(s.width, s.height);
    });
  }
}

if (document.readyState === 'loading') {
  // Wait for both DOM and ui.js DOMContentLoaded handler to finish
  document.addEventListener('DOMContentLoaded', () => {
    // Small timeout ensures ui.js DOMContentLoaded listeners run first
    setTimeout(initPhaserGame, 0);
  });
} else {
  setTimeout(initPhaserGame, 0);
}

/* =========================================================
   BADUZ – Player Management
   ========================================================= */

function getPlayerName() {
  let name = localStorage.getItem(STORAGE_PLAYER_KEY);
  if (!name) {
    name = prompt('Enter your nickname:', 'CyberPlayer') || 'CyberPlayer';
    localStorage.setItem(STORAGE_PLAYER_KEY, name);
  }
  return name;
}

// PLAYER_NAME is initialized lazily on first access to avoid
// prompt() blocking script parsing before the DOM is ready.
let PLAYER_NAME = localStorage.getItem(STORAGE_PLAYER_KEY) || null;

function ensurePlayerName() {
  if (!PLAYER_NAME) {
    PLAYER_NAME = prompt('Enter your nickname:', 'CyberPlayer') || 'CyberPlayer';
    localStorage.setItem(STORAGE_PLAYER_KEY, PLAYER_NAME);
  }
  return PLAYER_NAME;
}

function changePlayerName() {
  const newName = prompt('Enter new nickname:', PLAYER_NAME) || PLAYER_NAME;
  PLAYER_NAME = newName;
  localStorage.setItem(STORAGE_PLAYER_KEY, newName);

  const nameDisplay = document.getElementById('playerNameDisplay');
  if (nameDisplay) nameDisplay.textContent = newName;

  if (window.game && window.game.scene.keys['MazeScene']) {
    window.game.scene.keys['MazeScene'].PLAYER_NAME = newName;
    window.game.scene.keys['MazeScene'].updateHUD();
  }
}

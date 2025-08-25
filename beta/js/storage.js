let _playerName = null;

export function getPlayerName(){
  if (_playerName) return _playerName;
  let n = localStorage.getItem('baduz-player-name');
  if (!n){
    n = prompt("Insert nickname:", "Guest") || "Guest";
    localStorage.setItem('baduz-player-name', n);
  }
  _playerName = n;
  return _playerName;
}

export function changePlayerName(){
  const current = getPlayerName();
  const n = prompt("Insert new nickname:", current) || current;
  _playerName = n;
  localStorage.setItem('baduz-player-name', n);
  const el = document.getElementById('playerNameDisplay');
  if (el) el.firstChild.textContent = n + " ";
  return n;
}

function saveKey(){ return `baduz-save-v1:${getPlayerName()}`; }

export function saveGameSnapshot(state){
  try { localStorage.setItem(saveKey(), JSON.stringify(state)); return true; }
  catch(e){ console.error('Save failed', e); return false; }
}
export function loadGameSnapshot(){
  try { const s = localStorage.getItem(saveKey()); return s ? JSON.parse(s) : null; }
  catch(e){ console.error('Load failed', e); return null; }
}
export function resetGameSnapshot(){ localStorage.removeItem(saveKey()); }

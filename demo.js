/* =========================================================
   BADUZ – DEMO (20 livelli)
   Phaser 3 – Maze + Orbs + Hint (BFS)
   ---------------------------------------------------------
   ========================================================= */

/* =========================
   COSTANTI / CONFIGURAZIONE
   ========================= */
const STORAGE_PLAYER_KEY = 'baduz-player-name';
const SAVE_VERSION_PREFIX = 'baduz-save-v1:';

const TILE_SIZE = 50;
const PLAYER_SPEED = 200;

const SCORE_K = 5;
const SCORE_ALPHA = 1.0;
const SCORE_EPS = 1.0;

const HINT_COST = 3; // Orbs richiesti per usare un hint

// Colori palla (Baduz) + glow
const BALL_COLOR = 0xff00ff;
const BALL_GLOW_COLOR = 0xff99ff;
const BALL_GLOW_WIDTHS = [10, 5, 2];
const BALL_GLOW_ALPHAS = [0.15, 0.35, 0.8];

// Colori ORB (riempimento + bordo) + pulse
const ORB_FILL_COLOR = 0x00ff66;
const ORB_STROKE_COLOR = 0x33ffaa;
const ORB_PULSE_OPACITY = 0.25;

// Colori hint glow (traccia)
const HINT_GLOW_COLORS = [0x33ffaa, 0x00ff66, 0x00ff66];
const HINT_GLOW_WIDTHS = [10, 6, 3];
const HINT_GLOW_ALPHAS = [0.15, 0.35, 0.9];

// Colore riempimento delle pareti del labirinto.  Un viola scuro
// che richiama l'atmosfera neon senza risultare troppo brillante.
const WALL_FILL_COLOR = 0x1b0b33;



// Helper to determine the open side (towards the corridor) of a special tile
// such as START or EXIT. We look for the neighbouring cell that is walkable
// (value === 1) and return the side as one of: 'left', 'right', 'up', 'down'.
// If more than one neighbour is walkable we still pick one, preferring
// horizontal movement (right/left) and then vertical (down/up). This matches
// the visual intuition that the entrance usually opens towards the interior
// of the maze along a main direction.
function getOpenSide(mazeLayout, row, col) {
  const size = mazeLayout.length;

  // Prefer RIGHT, then LEFT, then DOWN, then UP.
  if (col < size - 1 && mazeLayout[row][col + 1] === 1) return 'right';
  if (col > 0 && mazeLayout[row][col - 1] === 1) return 'left';
  if (row < size - 1 && mazeLayout[row + 1][col] === 1) return 'down';
  if (row > 0 && mazeLayout[row - 1][col] === 1) return 'up';

  // No open neighbour (should not normally happen for start/exit).
  return null;
}


// For START/EXIT tiles placed on the outer border of the maze, the "inward"
// side is deterministic: it is the side that points inside the maze area.
// This avoids ambiguous cases where more than one neighbour is walkable
// and ensures the open side is always the corridor-facing one.
function getInwardSide(row, col, size) {
  if (row === 0) return 'down'; // top border -> inside is down
  if (row === size - 1) return 'up'; // bottom border -> inside is up
  if (col === 0) return 'right'; // left border -> inside is right
  if (col === size - 1) return 'left'; // right border -> inside is left
  return null;
}

// Draw a neon-like glow around a tile. If openSide is provided, the glow
// is omitted on that side (used for START/EXIT so that the inner side,
// where the ball moves, stays open). If openSide is null, the glow is
// drawn on all four sides (used for regular wall tiles).
function drawTileGlow(graphics, centerX, centerY, tileSize, color, openSide) {
  const half = tileSize / 2;
  const layers = [
    { inflate: 9, alpha: 0.15 },
    { inflate: 5, alpha: 0.35 },
    { inflate: 1, alpha: 0.8 }
  ];
  layers.forEach((layer) => {
    const inflate = layer.inflate;
    const alpha = layer.alpha;
    const left = centerX - half - inflate;
    const right = centerX + half + inflate;
    const top = centerY - half - inflate;
    const bottom = centerY + half + inflate;

    graphics.lineStyle(4, color, alpha);

    // Top edge
    if (openSide !== 'up') {
      graphics.beginPath();
      graphics.moveTo(left, top);
      graphics.lineTo(right, top);
      graphics.strokePath();
    }
    // Bottom edge
    if (openSide !== 'down') {
      graphics.beginPath();
      graphics.moveTo(left, bottom);
      graphics.lineTo(right, bottom);
      graphics.strokePath();
    }
    // Left edge
    if (openSide !== 'left') {
      graphics.beginPath();
      graphics.moveTo(left, top);
      graphics.lineTo(left, bottom);
      graphics.strokePath();
    }
    // Right edge
    if (openSide !== 'right') {
      graphics.beginPath();
      graphics.moveTo(right, top);
      graphics.lineTo(right, bottom);
      graphics.strokePath();
    }
  });
}

// Global variable to store the base tile size.  This is computed on the
// first level based on the available canvas space and remains constant
// for subsequent levels, preventing the maze and player from scaling
// down as levels increase.
let BASE_TILE_SIZE_GLOBAL = null;

/* ===============
   RNG / SEEDS
   =============== */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeLevelSeed(runSeed, level) {
  return (runSeed ^ (level * 2654435761)) >>> 0;
}

/* =================
   PLAYER / NICKNAME
   ================= */
function getPlayerName() {
  let name = localStorage.getItem(STORAGE_PLAYER_KEY);
  if (!name) {
    name = prompt('Insert nickname:', 'Guest') || 'Guest';
    localStorage.setItem(STORAGE_PLAYER_KEY, name);
  }
  return name;
}
let PLAYER_NAME = getPlayerName();

function changePlayerName() {
  const newName = prompt('Insert new nickname:', PLAYER_NAME) || PLAYER_NAME;
  PLAYER_NAME = newName;
  localStorage.setItem(STORAGE_PLAYER_KEY, newName);
  const nameEl = document.getElementById('playerNameDisplay');
  if (nameEl) nameEl.firstChild.textContent = newName + ' ';
}

/* =============
   SALVATAGGI
   ============= */
function saveKey() {
  return `${SAVE_VERSION_PREFIX}${PLAYER_NAME}`;
}
function saveGameSnapshot(state) {
  try {
    localStorage.setItem(saveKey(), JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Save failed', e);
    return false;
  }
}
function loadGameSnapshot() {
  try {
    const s = localStorage.getItem(saveKey());
    return s ? JSON.parse(s) : null;
  } catch (e) {
    console.error('Load failed', e);
    return null;
  }
}
function resetGameSnapshot() {
  localStorage.removeItem(saveKey());
}

/* =====================
   PUNTEGGIO / FORMULA
   ===================== */
function computeLevelScore(level, elapsedMs) {
  const tSec = Math.max(0, elapsedMs / 1000);
  const raw = (SCORE_K * Math.pow(level, SCORE_ALPHA)) / (tSec + SCORE_EPS);
  return Math.max(1, Math.round(raw));
}

/* =============================
   SCENA PRINCIPALE – MazeScene
   ============================= */
class MazeScene extends Phaser.Scene {
  constructor() {
    super('MazeScene');
  }

  /* --------------------------
     HUD
     -------------------------- */
  updateHUD() {
    const levelEl = document.getElementById('levelDisplay');
    const timerEl = document.getElementById('timer-display');
    const scoreEl = document.getElementById('score');
    const nameEl = document.getElementById('playerNameDisplay');
    const orbsEl =
      document.getElementById('orbsDisplay') ||
      document.getElementById('energyDisplay'); // fallback

    if (levelEl) levelEl.textContent = `${this.currentLevel}`;
    if (timerEl)
      timerEl.textContent = this.timerStarted
        ? this.formatTime(Date.now() - this.startTime)
        : '00:00:00';
    if (scoreEl) scoreEl.textContent = `${this.score}`.padStart(5, '0');
    if (nameEl) nameEl.firstChild.textContent = PLAYER_NAME + ' ';
    if (orbsEl) orbsEl.textContent = `${this.coins}`;
  }

  showToast(msg, color = '#00ff00') {
    if (this.toast) this.toast.destroy();
    this.toast = this.add
      .text(this.cameras.main.centerX, this.cameras.main.height - 40, msg, {
        fontSize: '16px',
        fill: color,
        fontFamily: 'Arial',
        backgroundColor: '#000',
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(2000);
    this.time.delayedCall(1200, () => {
      if (this.toast) this.toast.destroy();
    });
  }

  /* --------------------------
     LIFECYCLE: init / create / update
     -------------------------- */
  init(data) {
    this.currentLevel =
      data && data.currentLevel !== undefined ? data.currentLevel : 1;
    this.totalTime =
      data && data.totalTime !== undefined ? data.totalTime : 0;
    this.score = data && data.score !== undefined ? data.score : 0;
    this.coins = data && data.coins !== undefined ? data.coins : 0;

    this.isGameOver = false;
    this.paused = false;

    this.tileSize = TILE_SIZE;
    this.mazeLayout = [];
    this.timerStarted = false;
    this.startTime = 0;
    this.antStartPos = { x: 0, y: 0 };

    if (data && data.snapshot) {
      this.restoreSnapshot = data.snapshot;
      this.runSeed = data.snapshot.runSeed ?? (Date.now() >>> 0);
      this.rngSeed =
        data.snapshot.rngSeed ??
        makeLevelSeed(this.runSeed, data.snapshot.currentLevel || 1);
      this.currentLevel = data.snapshot.currentLevel ?? this.currentLevel;
      this.totalTime = data.snapshot.totalTime ?? this.totalTime;
      this.score = data.snapshot.score ?? this.score;
      this.coins = data.snapshot.coins ?? this.coins;
    } else {
      this.restoreSnapshot = null;
      this.runSeed = (data && data.runSeed) ? data.runSeed : (Date.now() >>> 0);
      this.rngSeed =
        (data && data.rngSeed !== undefined)
          ? data.rngSeed
          : makeLevelSeed(this.runSeed, this.currentLevel);
    }
  }

  create() {
    /* ---- Maze build (layout + start/exit) ---- */
    let size,
      startPos = { x: 0, y: 0 },
      exitPos = { x: 0, y: 0 };

    if (
      this.restoreSnapshot &&
      this.restoreSnapshot.mazeLayout &&
      this.restoreSnapshot.entrance &&
      this.restoreSnapshot.exit
    ) {
      this.mazeLayout = this.restoreSnapshot.mazeLayout;
      this.entrance = this.restoreSnapshot.entrance;
      this.exit = this.restoreSnapshot.exit;
      size = this.mazeLayout.length;
    } else {
      const rng = mulberry32(this.rngSeed);
      const mazeData = this.generateMaze(this.currentLevel, rng);
      this.mazeLayout = mazeData.maze;
      this.entrance = mazeData.entrance;
      this.exit = mazeData.exit;
      size = mazeData.size;
    }

    /*
     * Dynamically adjust the tile size so that smaller mazes occupy more of the
     * available canvas and are centered.  We never shrink the tile below the
     * default TILE_SIZE, but will enlarge it up to the maximum that still
     * allows the maze to fit within the canvas with a small margin.  We also
     * compute offsets so that the maze is centered horizontally and vertically.
     */
    {
      const canvasW = this.cameras.main.width;
      const canvasH = this.cameras.main.height;
      const margin = 80; // margin to leave around the maze (increased to give more breathing room)
      const availW = canvasW - 2 * margin;
      const availH = canvasH - 2 * margin;
      if (BASE_TILE_SIZE_GLOBAL === null) {
        // On the first level, compute the largest tile size that allows the
        // maze to fit within the available canvas area with a margin.  We
        // never go below the default TILE_SIZE so that large mazes remain
        // playable.  Store the result for reuse on subsequent levels.
        const candidate = Math.floor(Math.min(availW / size, availH / size));
        if (candidate > TILE_SIZE) {
          this.tileSize = candidate;
        } else {
          this.tileSize = TILE_SIZE;
        }
        BASE_TILE_SIZE_GLOBAL = this.tileSize;
      } else {
        // Reuse the previously computed base tile size for all later levels.
        this.tileSize = BASE_TILE_SIZE_GLOBAL;
      }
      // Compute maze dimensions using the chosen tile size and center it.
      const mazeW = this.tileSize * size;
      const mazeH = this.tileSize * size;
      const offsetX = Math.max(0, Math.floor((canvasW - mazeW) / 2));
      const offsetY = Math.max(0, Math.floor((canvasH - mazeH) / 2));
      this.offsetX = offsetX;
      this.offsetY = offsetY;
    }
    // Set the physics world bounds to match the maze area exactly.  This
    // prevents the player from moving outside the entrance tile or beyond
    // the maze boundaries.  We leave camera bounds larger for panning but
    // restrict physical movement to within the maze.
    const worldX = this.offsetX;
    const worldY = this.offsetY;
    const worldW = this.tileSize * size;
    const worldH = this.tileSize * size;
    this.physics.world.setBounds(worldX, worldY, worldW, worldH);
    this.topWalls = this.physics.add.staticGroup();

    // Restrict the camera so that panning cannot move more than a certain
    // margin beyond the maze edges.  We allow a margin of 80 pixels in
    // every direction.  This prevents the player from getting lost by
    // panning too far away from the maze.
    {
      const marginPan = 80;
      const boundX = worldX - marginPan;
      const boundY = worldY - marginPan;
      const boundW = worldW + marginPan * 2;
      const boundH = worldH + marginPan * 2;
      this.cameras.main.setBounds(boundX, boundY, boundW, boundH);
    }

// Disegno labirinto
// IMPORTANT: per evitare che il glow di START/EXIT venga "coperto" da tile
// create successivamente (ordine di rendering di Phaser), rimandiamo il disegno
// del glow a fine generazione, su un unico Graphics layer con depth alto.
const glowLayer = this.add.graphics().setDepth(5);

const wallGlowList = [];
let startGlowInfo = null;
let exitGlowInfo = null;

for (let row = 0; row < size; row++) {
  for (let col = 0; col < size; col++) {
    // Apply offsets so the maze is centered in the canvas
    const x = col * this.tileSize + this.offsetX;
    const y = row * this.tileSize + this.offsetY;
    const centerX = x + this.tileSize / 2;
    const centerY = y + this.tileSize / 2;

    if (this.mazeLayout[row][col] === 0) {
      // Wall tile: viola scuro con bordo ciano
      const wall = this.add.rectangle(
        centerX,
        centerY,
        this.tileSize,
        this.tileSize,
        WALL_FILL_COLOR
      );
      wall.setStrokeStyle(2, 0x00ffff, 1);
      wall.setDepth(1);

      this.physics.add.existing(wall, true);
      this.topWalls.add(wall);

      // Glow muri: lo disegniamo DOPO (così non viene coperto da altre tile)
      wallGlowList.push({ centerX, centerY });
    } else {
      // Tile corridoio. Per START ed EXIT applichiamo un glow parziale:
      // viene escluso il lato interno verso il corridoio (openSide).
      if (row === this.entrance.y && col === this.entrance.x) {
        // Lato interno deterministico (START sta sul bordo)
        const openSide =
          getInwardSide(row, col, size) || getOpenSide(this.mazeLayout, row, col);

        // Tile START: background scuro magenta, bordo ciano
        const startTile = this.add.rectangle(
          centerX,
          centerY,
          this.tileSize,
          this.tileSize,
          0x110011,
          0.6
        );
        startTile.setStrokeStyle(2, 0x00ffff, 1);
        startTile.setDepth(1);

        // Glow solo sui tre lati chiusi (2 tra muri + 1 confine)
        startGlowInfo = { centerX, centerY, openSide };

        // Save the pixel coordinates of the start tile center for spawning
        startPos = { x: centerX, y: centerY };
      } else if (row === this.exit.y && col === this.exit.x) {
        // Lato interno deterministico (EXIT sta sul bordo)
        const openSide =
          getInwardSide(row, col, size) || getOpenSide(this.mazeLayout, row, col);

        // Tile EXIT: background scuro verde, bordo ciano
        const exitTile = this.add.rectangle(
          centerX,
          centerY,
          this.tileSize,
          this.tileSize,
          0x001100,
          0.6
        );
        exitTile.setStrokeStyle(2, 0x00ffff, 1);
        exitTile.setDepth(1);

        // Glow solo sui tre lati chiusi
        exitGlowInfo = { centerX, centerY, openSide };

        // Save the pixel coordinates of the exit tile center for overlap detection
        exitPos = { x: centerX, y: centerY };
      }
    }
  }
}

// Ora disegniamo TUTTO il glow sopra alle tile (non viene più coperto)
wallGlowList.forEach(({ centerX, centerY }) => {
  drawTileGlow(glowLayer, centerX, centerY, this.tileSize, 0x00ffff, null);
});

if (startGlowInfo) {
  drawTileGlow(
    glowLayer,
    startGlowInfo.centerX,
    startGlowInfo.centerY,
    this.tileSize,
    BALL_COLOR,
    startGlowInfo.openSide
  );
}

if (exitGlowInfo) {
  drawTileGlow(
    glowLayer,
    exitGlowInfo.centerX,
    exitGlowInfo.centerY,
    this.tileSize,
    0x00ff00,
    exitGlowInfo.openSide
  );
}



    /* ---- Player (Baduz) + glow ---- */
    if (this.ant) this.ant.destroy();
    const startFromSnapshot = this.restoreSnapshot && this.restoreSnapshot.player;
    const spawn = startFromSnapshot ? this.restoreSnapshot.player : startPos;

    // Scale the player (Baduz) radius relative to the current tile size so that it
    // remains proportionate to the maze.  Use a minimum radius to avoid making it
    // too small on very large mazes.
    // Scale the player (Baduz) radius relative to the current tile size.  Increase
    // the scaling factor slightly to make the ball larger.  Use a larger
    // minimum radius to ensure visibility.
    const ballRadius = Math.max(12, Math.floor(this.tileSize * 0.25));
    this.ant = this.add.circle(spawn.x, spawn.y, ballRadius, BALL_COLOR);
    this.ant.setDepth(3);
    this.ballRadius = ballRadius;
    this.physics.add.existing(this.ant, false);
    this.ant.body.setCircle(ballRadius);
    this.ant.body.setCollideWorldBounds(true);
    this.ant.body.setBounce(0);
    this.physics.add.collider(this.ant, this.topWalls);

    // Glow “dinamico” che segue la palla
    this.antGlow = this.add.graphics().setDepth((this.ant.depth || 0) - 1);
    this.events.on('update', () => {
      this.antGlow.clear();
        BALL_GLOW_WIDTHS.forEach((w, i) => {
        this.antGlow.lineStyle(w, BALL_GLOW_COLOR, BALL_GLOW_ALPHAS[i]);
        const r = this.ant.body?.radius || 10;
        this.antGlow.strokeCircle(this.ant.x, this.ant.y, r);
      });
    });

    /* ---- Camera / input / goal ---- */
    this.cameras.main.startFollow(this.ant, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
    this.cursors = this.input.keyboard.createCursorKeys();

    this.exitPos = { x: exitPos.x, y: exitPos.y };

    this.levelCleared = false;
    const exitZone = this.add.zone(exitPos.x, exitPos.y, this.tileSize, this.tileSize);
    this.physics.add.existing(exitZone, true);
    this.physics.add.overlap(this.ant, exitZone, () => {
      if (this.levelCleared) return;
      if (this.isPlayerFullyInsideExit()) {
        this.levelCleared = true;
        this.nextLevel();
      }
    }, null, this);

    /* ---- Orbs (collezionabili) ---- */
    this.energyGroup = this.physics.add.group();
    const rngForOrbs = mulberry32((this.rngSeed >>> 0) + 999);
    const orbsCount = Math.max(3, 3 + Math.floor(this.currentLevel / 2));
    let placed = 0;

    while (placed < orbsCount) {
      const rx = Math.floor(rngForOrbs() * size);
      const ry = Math.floor(rngForOrbs() * size);

      // Solo corridoi, non sull'entrata
      if (
        this.mazeLayout[ry][rx] === 1 &&
        !(rx === this.entrance.x && ry === this.entrance.y)
      ) {
        // Position the orb using the tile offsets so that it aligns with the
        // centered and scaled maze.  Scale the orb radius relative to the tile
        // size to maintain proportions across different maze sizes.
        const px = rx * this.tileSize + this.tileSize / 2 + this.offsetX;
        const py = ry * this.tileSize + this.tileSize / 2 + this.offsetY;
        // Scale the orb radius relative to the tile size.  Increase the factor
        // to make orbs larger and use a larger minimum radius.
        const orbRadius = Math.max(6, Math.floor(this.tileSize * 0.18));
        const pulseRadius = Math.floor(orbRadius * 1.3);

        // Orb base
        const orb = this.add.circle(px, py, orbRadius, ORB_FILL_COLOR);
        orb.setStrokeStyle(2, ORB_STROKE_COLOR, 1);

        this.physics.add.existing(orb);
        orb.body.setCircle(orbRadius);
        orb.body.setImmovable(true);
        this.energyGroup.add(orb);

        // Pulse “respiro”
        const pulse = this.add.circle(px, py, pulseRadius, ORB_FILL_COLOR, ORB_PULSE_OPACITY);
        pulse.setDepth((orb.depth || 0) - 1);
        orb.pulse = pulse;
        orb.pulseTween = this.tweens.add({
          targets: pulse,
          scale: 1.8,
          alpha: 0,
          duration: 1200,
          ease: 'Sine.out',
          yoyo: false,
          repeat: -1,
          onRepeat: () => {
            pulse.setScale(1);
            pulse.setAlpha(ORB_PULSE_OPACITY);
          }
        });

        placed++;
      }
    }

    // Raccolta Orbs
    this.physics.add.overlap(
      this.ant,
      this.energyGroup,
      (ant, orb) => {
        if (orb.pulseTween) orb.pulseTween.stop();
        if (orb.pulse && orb.pulse.destroy) orb.pulse.destroy();
        orb.destroy();

        this.coins++;
        this.showToast('+1 Orb', '#00ffff');
        this.updateHUD();
      },
      null,
      this
    );

    /* ---- Timer ---- */
    this.antStartPos = { x: startPos.x, y: startPos.y };
    this.timerStarted = false;
    this.startTime = 0;

    /* ---- Entrance blocker ---- */
    // To prevent the player from leaving the maze through the entrance after
    // moving away from it, we prepare an invisible static blocker at the
    // adjacent tile outside the maze.  It will be activated once the
    // player leaves the start tile.  We determine the direction of the
    // entrance relative to the maze: if the entrance is on the left edge
    // (x === 0), the outside tile is to the left of the start; if on the
    // right (x === size-1) then outside tile is to the right; similarly
    // for top/bottom edges.  The blocker remains disabled until the
    // player has moved off of the start tile.
    this.hasLeftStart = false;
    this.startBlocker = null;
    {
      const gridX = this.entrance.x;
      const gridY = this.entrance.y;
      let outX = 0,
        outY = 0;
      if (gridX === 0) {
        // Entrance on left edge: blocker goes one tile to the left
        outX = startPos.x - this.tileSize;
        outY = startPos.y;
      } else if (gridX === size - 1) {
        // Right edge: blocker goes to the right
        outX = startPos.x + this.tileSize;
        outY = startPos.y;
      } else if (gridY === 0) {
        // Top edge: blocker goes above
        outX = startPos.x;
        outY = startPos.y - this.tileSize;
      } else if (gridY === size - 1) {
        // Bottom edge: blocker goes below
        outX = startPos.x;
        outY = startPos.y + this.tileSize;
      }
      // Only create the blocker if the outside coordinates differ from start
      if (outX !== 0 || outY !== 0) {
        const blocker = this.add.rectangle(outX, outY, this.tileSize, this.tileSize);
        blocker.setFillStyle(0xffffff, 0); // invisible
        this.physics.add.existing(blocker, true);
        // Add collider but disable it initially.  We'll enable once the
        // player leaves the start tile.
        this.startBlocker = blocker;
        blocker.body.enable = false;
        this.physics.add.collider(this.ant, blocker);
      }
    }

    /* ---- Shortcuts ---- */
    this.input.keyboard.on('keydown-P', this.togglePause, this);
    this.input.keyboard.on('keydown-S', () => {
      this.handleSave();
      this.showToast('Saved');
    });
    this.input.keyboard.on('keydown-L', () => {
      this.handleLoad();
      this.showToast('Loaded');
    });
    this.input.keyboard.on('keydown-R', () => {
      this.handleReset();
      this.showToast('Level reset');
    });
    this.input.keyboard.on('keydown-H', () => {
      this.useHint();
    });

    /* ---- Bottoni UI ---- */
    const withBtn = (id, fn) => {
      // Avoid stacking multiple click handlers on the same button by using
      // the onclick property instead of addEventListener.  Each time a
      // new scene is created, this will overwrite any previous handler.
      const el = document.getElementById(id);
      if (el) el.onclick = () => fn.call(this);
    };
    // Map the Pause button to toggle pause/resume.  Save and Load buttons
    // have been removed from the UI.
    withBtn('btnPause', function () {
      this.togglePause();
    });
    withBtn('btnReset', function () {
      this.handleReset();
      this.showToast('Level reset');
    });
    // Recenter the camera on the player when the user has panned around.
    withBtn('btnCenter', function () {
      // Resume following the player and center immediately.
      this.cameras.main.startFollow(this.ant, true, 0.1, 0.1);
      this.cameras.main.centerOn(this.ant.x, this.ant.y);
    });
    withBtn('btnHint', function () {
      this.useHint();
    });

    // ----------------------------------------------------------------------
    // Camera panning for exploration
    // Allow the player to drag the canvas (mouse or touch) to explore the maze
    // without moving the ant.  While dragging, the camera stops following
    // the ant.  When released, the player can tap the "Center" button to
    // recenter on the ant.
    this.isDraggingCamera = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.cameraStartX = 0;
    this.cameraStartY = 0;
    this.input.on('pointerdown', (pointer) => {
      // If the pointer originates from a UI element (like a button or the
      // on-screen d-pad), don't start dragging the camera.
      const eventTarget = pointer.event?.target;
      if (
        eventTarget &&
        (eventTarget.closest('.controls-area') ||
          eventTarget.closest('.main-header') ||
          eventTarget.closest('.modal'))
      ) {
        return;
      }
      this.isDraggingCamera = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.cameraStartX = this.cameras.main.scrollX;
      this.cameraStartY = this.cameras.main.scrollY;
      // Stop following the ant while dragging.
      this.cameras.main.stopFollow();
    });
    this.input.on('pointermove', (pointer) => {
      if (!this.isDraggingCamera) return;
      const dx = pointer.x - this.dragStartX;
      const dy = pointer.y - this.dragStartY;
      this.cameras.main.setScroll(
        this.cameraStartX - dx,
        this.cameraStartY - dy
      );
    });
    this.input.on('pointerup', () => {
      this.isDraggingCamera = false;
    });

    const btnChange = document.getElementById('btnChangeName');
    if (btnChange)
      btnChange.addEventListener('click', () => {
        changePlayerName();
        this.updateHUD();
      });

    this.updateHUD();
  }

  update() {
    if (this.isGameOver || this.paused) return;

    this.ant.body.setVelocity(0);

    // If the player has moved away from the start tile, activate the
    // entrance blocker so they cannot exit the maze through the entrance.
    if (!this.hasLeftStart) {
      const dx = Math.abs(this.ant.x - this.antStartPos.x);
      const dy = Math.abs(this.ant.y - this.antStartPos.y);
      // Consider the player off the start tile once they have moved more
      // than a quarter of a tile in any direction.  Using a fraction of
      // tileSize avoids false positives due to jitter.
      if (dx > this.tileSize * 0.25 || dy > this.tileSize * 0.25) {
        this.hasLeftStart = true;
        if (this.startBlocker && this.startBlocker.body) {
          this.startBlocker.body.enable = true;
        }
      }
    }
    // Support keyboard and on-screen mobile controls. If a direction is pressed on either,
    // set the velocity accordingly. Keyboard input takes precedence over mobile input.
    const mInput = (typeof window !== 'undefined' && window.mobileInput) ? window.mobileInput : null;
    const mDir = mInput ? mInput.dir : null;
    // Horizontal movement
    if (this.cursors.left.isDown || mDir === 'left') {
      this.ant.body.setVelocityX(-PLAYER_SPEED);
    } else if (this.cursors.right.isDown || mDir === 'right') {
      this.ant.body.setVelocityX(PLAYER_SPEED);
    }
    // Vertical movement
    if (this.cursors.up.isDown || mDir === 'up') {
      this.ant.body.setVelocityY(-PLAYER_SPEED);
    } else if (this.cursors.down.isDown || mDir === 'down') {
      this.ant.body.setVelocityY(PLAYER_SPEED);
    }

    if (!this.timerStarted) {
      if (
        Math.abs(this.ant.x - this.antStartPos.x) > 4 ||
        Math.abs(this.ant.y - this.antStartPos.y) > 4
      ) {
        this.startTime = Date.now();
        this.timerStarted = true;
      }
    }

    if (this.timerStarted) {
      const timerEl = document.getElementById('timer-display');
      if (timerEl)
        timerEl.textContent = this.formatTime(Date.now() - this.startTime);
    }
  }

  /* --------------------------
     PAUSA / TIMER
     -------------------------- */
  togglePause() {
    if (!this.paused) {
      this.paused = true;
      this.pauseStart = Date.now();
      this.physics.pause();
      if (this.pauseText) this.pauseText.destroy();
      this.pauseText = this.add
        .text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'PAUSE', {
          fontSize: '100px',
          fill: '#00ff00',
          fontFamily: 'Arial',
          stroke: '#000',
          strokeThickness: 2
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(9999);
    } else {
      this.paused = false;
      const pausedDuration = Date.now() - this.pauseStart;
      if (this.timerStarted) {
        this.startTime += pausedDuration;
      }
      this.physics.resume();
      if (this.pauseText) this.pauseText.destroy();
    }
  }

  formatTime(elapsedMilliseconds) {
    const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /* --------------------------
     HINT (BFS + glow fade)
     -------------------------- */
  useHint() {
    if (this.coins < HINT_COST) {
      this.showToast('Not enough orbs!', '#ffcc00');
      return;
    }
    this.coins -= HINT_COST;
    this.updateHUD();

    const path = this.findPath();
    if (!path) {
      this.showToast('No path found!', '#ff0000');
      return;
    }

    // Disegno multi-layer per effetto glow
    for (let i = 0; i < HINT_GLOW_COLORS.length; i++) {
      const g = this.add.graphics();
      g.lineStyle(HINT_GLOW_WIDTHS[i], HINT_GLOW_COLORS[i], HINT_GLOW_ALPHAS[i]);
      g.beginPath();
        path.forEach((p, j) => {
        const x = p.x * this.tileSize + this.tileSize / 2 + this.offsetX;
        const y = p.y * this.tileSize + this.tileSize / 2 + this.offsetY;
        if (j === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.strokePath();

      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: 3000,
        onComplete: () => g.destroy()
      });
    }

    this.showToast('Hint used!', '#00ffff');
  }

  findPath() {
    const size = this.mazeLayout.length;
    const start = {
      // Convert the ant's pixel position back into maze grid coordinates by
      // subtracting the offset and dividing by the current tile size.
      x: Math.floor((this.ant.x - this.offsetX) / this.tileSize),
      y: Math.floor((this.ant.y - this.offsetY) / this.tileSize)
    };
    const end = this.exit;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    const key = (x, y) => `${x},${y}`;
    const q = [start];
    const seen = new Set([key(start.x, start.y)]);
    const prev = {};

    while (q.length) {
      const c = q.shift();
      if (c.x === end.x && c.y === end.y) {
        const path = [];
        let cur = c;
        while (cur) {
          path.unshift(cur);
          cur = prev[key(cur.x, cur.y)];
        }
        return path;
      }
      for (const [dx, dy] of dirs) {
        const nx = c.x + dx,
          ny = c.y + dy;
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < size &&
          ny < size &&
          this.mazeLayout[ny][nx] === 1 &&
          !seen.has(key(nx, ny))
        ) {
          seen.add(key(nx, ny));
          prev[key(nx, ny)] = c;
          q.push({ x: nx, y: ny });
        }
      }
    }
    return null;
    }

  /* --------------------------
     SAVE / LOAD / RESET
     -------------------------- */
  getSnapshot(full = false) {
    const elapsed = this.timerStarted ? Date.now() - this.startTime : 0;
    const base = {
      currentLevel: this.currentLevel,
      totalTime: this.totalTime + elapsed,
      score: this.score,
      coins: this.coins,
      runSeed: this.runSeed,
      rngSeed: this.rngSeed,
      playerName: PLAYER_NAME
    };
    if (full) {
      base.mazeLayout = this.mazeLayout;
      base.entrance = this.entrance;
      base.exit = this.exit;
      if (this.ant) base.player = { x: this.ant.x, y: this.ant.y };
    }
    return base;
  }

  handleSave() {
    saveGameSnapshot(this.getSnapshot(true));
  }

  handleLoad() {
    const snap = loadGameSnapshot();
    if (!snap) {
      this.showToast('No save found', '#ffcc00');
      return;
    }
    this.scene.stop('MazeScene');
    this.scene.start('MazeScene', { snapshot: snap });
  }

  handleReset() {
    const sameLevel = this.currentLevel;
    const sameRunSeed = this.runSeed;
    const sameLevelSeed = makeLevelSeed(sameRunSeed, sameLevel);

    saveGameSnapshot({
      currentLevel: sameLevel,
      totalTime: this.totalTime,
      score: this.score,
      coins: this.coins,
      runSeed: sameRunSeed,
      rngSeed: sameLevelSeed,
      playerName: PLAYER_NAME
    });

    this.scene.restart({
      currentLevel: sameLevel,
      totalTime: this.totalTime,
      score: this.score,
      coins: this.coins,
      runSeed: sameRunSeed,
      rngSeed: sameLevelSeed,
      snapshot: null
    });
  }

  /* --------------------------
     AVANZA LIVELLO / FINE DEMO
     -------------------------- */

  /* --------------------------
     CHECK USCITA (EXIT)
     - evita completamento repentino: richiede che l'intera palla
       sia entrata nella tile EXIT (non basta toccare il bordo esposto)
     -------------------------- */
  isPlayerFullyInsideExit() {
    if (!this.ant || !this.exitPos) return false;

    const r =
      (this.ant.body && typeof this.ant.body.radius === 'number')
        ? this.ant.body.radius
        : (this.ballRadius || 0);

    const half = this.tileSize / 2;
    const margin = half - r;
    if (margin <= 0) return false;

    const dx = Math.abs(this.ant.x - this.exitPos.x);
    const dy = Math.abs(this.ant.y - this.exitPos.y);

    // La palla deve stare interamente dentro la cella EXIT
    return dx <= margin && dy <= margin;
  }

  nextLevel() {
    let levelTime = 0;
    if (this.timerStarted) {
      levelTime = Date.now() - this.startTime;
      this.totalTime += levelTime;
    }
    const gain = computeLevelScore(this.currentLevel, levelTime);
    this.score += gain;
    this.showToast(`+${gain} pts`, '#00ff00');
    this.updateHUD();

    this.currentLevel++;
    saveGameSnapshot({
      currentLevel: this.currentLevel,
      totalTime: this.totalTime,
      score: this.score,
      coins: this.coins,
      runSeed: this.runSeed,
      rngSeed: makeLevelSeed(this.runSeed, this.currentLevel),
      playerName: PLAYER_NAME
    });

    // Demo estesa fino a 20
    if (this.currentLevel > 20) {
      this.isGameOver = true;
      this.cameras.main.stopFollow();
      this.cameras.main.centerOn(
        this.game.config.width / 2,
        this.game.config.height / 2
      );

      const totalSeconds = Math.floor(this.totalTime / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const formattedTotal = `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      // Schermata finale: pannello + testi
      const cx = this.cameras.main.centerX;
      const cy = this.cameras.main.centerY;

      const endContainer = this.add
        .container(cx, cy)
        .setScrollFactor(0)
        .setDepth(2000);

      const title = this.add
        .text(0, -35, `DEMO COMPLETED!\nThank you for playing, ${PLAYER_NAME}!`, {
          fontSize: '40px',
          fill: '#ffffff',
          fontFamily: 'Arial',
          align: 'center'
        })
        .setOrigin(0.5);

      const stats = this.add
        .text(0, 60, `Total Time: ${formattedTotal}\nScore: ${this.score}`, {
          fontSize: '24px',
          fill: '#00ff00',
          fontFamily: 'Arial',
          stroke: '#000',
          strokeThickness: 2,
          align: 'center'
        })
        .setOrigin(0.5);

      const padX = 30,
        padY = 30,
        gap = 20;
      const panelWidth = Math.max(title.width, stats.width) + padX * 2;
      const panelHeight = title.height + stats.height + gap + padY * 2;

      const panel = this.add
        .rectangle(0, 10, panelWidth, panelHeight, 0x000000, 0.85)
        .setStrokeStyle(2, 0x00ffff, 0.8);

      endContainer.add([panel, title, stats]);

      this.currentLevel = 21;
      this.physics.pause();
      this.ant.body.setVelocity(0);
      return;
    }

    // Reset timer e avvia livello seguente
    this.isGameOver = false;
    this.timerStarted = false;
    this.startTime = 0;
    const timerEl = document.getElementById('timer-display');
    if (timerEl) timerEl.textContent = '00:00:00';

    this.scene.restart({
      currentLevel: this.currentLevel,
      totalTime: this.totalTime,
      score: this.score,
      coins: this.coins,
      runSeed: this.runSeed,
      rngSeed: makeLevelSeed(this.runSeed, this.currentLevel)
    });
  }

  /* --------------------------
     GENERAZIONE LABIRINTO
     -------------------------- */
  generateMaze(level, rng) {
    const size = 5 + level * 2;
    const maze = Array(size)
      .fill()
      .map(() => Array(size).fill(0));
    this.generatePrimMaze(maze, rng);
    const [start, end] = this.placeEntranceExit(maze, rng);
    return {
      maze,
      entrance: { x: start.x, y: start.y },
      exit: { x: end.x, y: end.y },
      size
    };
  }

  generatePrimMaze(maze, rng) {
    const size = maze.length;
    let walls = [];
    const possibleCells = [];
    for (let y = 1; y < size - 1; y += 2) {
      for (let x = 1; x < size - 1; x += 2) {
        possibleCells.push({ x, y });
      }
    }
    const startCell = possibleCells[Math.floor(rng() * possibleCells.length)];
    maze[startCell.y][startCell.x] = 1;
    this.addWalls(startCell.x, startCell.y, maze, walls);

    while (walls.length > 0) {
      const randomIndex = Math.floor(rng() * walls.length);
      const wall = walls.splice(randomIndex, 1)[0];
      const { wx, wy, cx, cy } = wall;
      if (maze[cy][cx] === 0) {
        maze[wy][wx] = 1;
        maze[cy][cx] = 1;
        this.addWalls(cx, cy, maze, walls);
      }
    }
  }

  addWalls(x, y, maze, walls) {
    const size = maze.length;
    const dirs = [
      { dx: 0, dy: -2 },
      { dx: 0, dy: 2 },
      { dx: -2, dy: 0 },
      { dx: 2, dy: 0 }
    ];
    dirs.forEach((d) => {
      const nx = x + d.dx,
        ny = y + d.dy;
      if (
        nx > 0 &&
        nx < size - 1 &&
        ny > 0 &&
        ny < size - 1 &&
        maze[ny][nx] === 0
      ) {
        const wx = x + d.dx / 2,
          wy = y + d.dy / 2;
        walls.push({ wx, wy, cx: nx, cy: ny });
      }
    });
  }

  placeEntranceExit(maze, rng) {
    const size = maze.length;
    const isTopBottom = rng() < 0.5;
    let start, end;

    if (isTopBottom) {
      const odd = [];
      for (let x = 1; x < size - 1; x += 2) odd.push(x);
      const ex = odd[Math.floor(rng() * odd.length)];
      start = { x: ex, y: 0 };
      end = { x: ex, y: size - 1 };
      maze[1][ex] = 1;
      maze[size - 2][ex] = 1;
    } else {
      const odd = [];
      for (let y = 1; y < size - 1; y += 2) odd.push(y);
      const ey = odd[Math.floor(rng() * odd.length)];
      start = { x: 0, y: ey };
      end = { x: size - 1, y: ey };
      maze[ey][1] = 1;
      maze[ey][size - 2] = 1;
    }
    maze[start.y][start.x] = 1;
    maze[end.y][end.x] = 1;
    return [start, end];
  }
}

/* =========================
   PHASER – AVVIO GIOCO
   ========================= */
const config = {
  type: Phaser.CANVAS,
  width: 1000,
  height: 700,
  canvas: document.getElementById('gameCanvas'),
  transparent: true, // canvas trasparente fuori dal disegno
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: MazeScene
};

const game = new Phaser.Game(config);

/* =========================
   AUTOSAVE ON EXIT
   ========================= */
window.addEventListener('beforeunload', () => {
  const scene = game?.scene?.keys?.['MazeScene'];
  if (scene) saveGameSnapshot(scene.getSnapshot(true));
});

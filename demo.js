/* =========================================================
   BADUZ – DEMO (20 livelli)
   Phaser 3 – Maze + Orbs + Hint (BFS)
   ========================================================= */

// =========================================================
// 1. CONSTANTS & CONFIGURATION
// =========================================================
const STORAGE_PLAYER_KEY = 'baduz-player-name';
// Save/Load removed (simpler gameplay loop)

const IS_MOBILE_VIEW = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
const TILE_SIZE = IS_MOBILE_VIEW ? 50 : 50; // più grande su mobile per riempire meglio il canvas
const PLAYER_SPEED = 230;

// Enable snapping of analog joystick input to 8 directions. When true, analog input is quantized to the nearest 45° angle.
const SNAP_8_DIR = true;

// Score tuning: reward higher levels more steeply while still penalizing time
const SCORE_K = 10;       // base multiplier
const SCORE_ALPHA = 1.25; // level exponent (was 1.0)
const SCORE_EPS = 0.8;    // time damping to avoid huge scores on very short runs

const HINT_COST = 3;

// Cyberpunk Colors (matching new UI)
const CYBER_CYAN = 0x00f3ff;
const CYBER_MAGENTA = 0xff00ff;
const CYBER_GREEN = 0x00ff9d;
const CYBER_BLUE = 0x0066ff;
const CYBER_PURPLE = 0x9d00ff;
const CYBER_RED = 0xff0066;
const CYBER_YELLOW = 0xffea00;
const CYBER_GRAY = 0xc5c9d3;

// Player colors
const BALL_COLOR = CYBER_MAGENTA;
const BALL_GLOW_COLOR = 0xff99ff;
const BALL_GLOW_WIDTHS = [10, 5, 2];
const BALL_GLOW_ALPHAS = [0.15, 0.35, 0.8];

// Orb colors
const ORB_FILL_COLOR = CYBER_GREEN;
const ORB_STROKE_COLOR = 0x33ffaa;
const ORB_PULSE_OPACITY = 0.25;

// Hint colors
const HINT_GLOW_COLORS = [CYBER_GREEN, 0x00ff66, 0x00ff66];
const HINT_GLOW_WIDTHS = [10, 6, 3];
const HINT_GLOW_ALPHAS = [0.15, 0.35, 0.9];

// Maze colors
const WALL_FILL_COLOR = 0x1b0b33;

// =========================================================
// 2. UTILITY FUNCTIONS
// =========================================================
function getOpenSide(mazeLayout, row, col) {
  const size = mazeLayout.length;
  if (col < size - 1 && mazeLayout[row][col + 1] === 1) return 'right';
  if (col > 0 && mazeLayout[row][col - 1] === 1) return 'left';
  if (row < size - 1 && mazeLayout[row + 1][col] === 1) return 'down';
  if (row > 0 && mazeLayout[row - 1][col] === 1) return 'up';
  return null;
}

function getInwardSide(row, col, size) {
  if (row === 0) return 'down';
  if (row === size - 1) return 'up';
  if (col === 0) return 'right';
  if (col === size - 1) return 'left';
  return null;
}

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

    if (openSide !== 'up') {
      graphics.beginPath();
      graphics.moveTo(left, top);
      graphics.lineTo(right, top);
      graphics.strokePath();
    }
    if (openSide !== 'down') {
      graphics.beginPath();
      graphics.moveTo(left, bottom);
      graphics.lineTo(right, bottom);
      graphics.strokePath();
    }
    if (openSide !== 'left') {
      graphics.beginPath();
      graphics.moveTo(left, top);
      graphics.lineTo(left, bottom);
      graphics.strokePath();
    }
    if (openSide !== 'right') {
      graphics.beginPath();
      graphics.moveTo(right, top);
      graphics.lineTo(right, bottom);
      graphics.strokePath();
    }
  });
}

// Global tile size
let BASE_TILE_SIZE_GLOBAL = null;

// =========================================================
// 3. RNG / SEEDS
// =========================================================
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

// =========================================================
// 4. PLAYER MANAGEMENT
// =========================================================
function getPlayerName() {
  let name = localStorage.getItem(STORAGE_PLAYER_KEY);
  if (!name) {
    name = prompt('Enter your nickname:', 'CyberPlayer') || 'CyberPlayer';
    localStorage.setItem(STORAGE_PLAYER_KEY, name);
  }
  return name;
}

let PLAYER_NAME = getPlayerName();

function changePlayerName() {
  const newName = prompt('Enter new nickname:', PLAYER_NAME) || PLAYER_NAME;
  PLAYER_NAME = newName;
  localStorage.setItem(STORAGE_PLAYER_KEY, newName);
  
  // Update UI
  const nameDisplay = document.getElementById('playerNameDisplay');
  if (nameDisplay) nameDisplay.textContent = newName;
  
  // Update game if running
  if (window.game && window.game.scene.keys['MazeScene']) {
    window.game.scene.keys['MazeScene'].PLAYER_NAME = newName;
    window.game.scene.keys['MazeScene'].updateHUD();
  }
}

// =========================================================
// 5. SAVE SYSTEM (REMOVED)
// =========================================================

// =========================================================
// 6. SCORING SYSTEM
// =========================================================
function computeLevelScore(level, elapsedMs) {
  const tSec = Math.max(0, elapsedMs / 1000);
  const raw = (SCORE_K * Math.pow(level, SCORE_ALPHA)) / (tSec + SCORE_EPS);
  return Math.max(1, Math.round(raw));
}

// =========================================================
// 7. MAZE SCENE CLASS
// =========================================================
class MazeScene extends Phaser.Scene {
  constructor() {
    super('MazeScene');
  }

  // =======================================================
  // 7.1 HUD & UI MANAGEMENT
  // =======================================================
  updateHUD() {
    const levelEl = document.getElementById('levelDisplay');
    const timerEl = document.getElementById('timer-display');
    const scoreEl = document.getElementById('score');
    const nameEl = document.getElementById('playerNameDisplay');
    const orbsEl = document.getElementById('orbsDisplay');
    const jumpEl = document.getElementById('jumpDisplay');

    if (levelEl) levelEl.textContent = `${this.currentLevel}`;
    if (timerEl) {
      timerEl.textContent = this.timerStarted ? 
        this.formatTime(Date.now() - this.startTime) : '00:00:00';
    }
    if (scoreEl) scoreEl.textContent = `${this.score}`.padStart(5, '0');
    if (nameEl) nameEl.textContent = PLAYER_NAME;
    if (orbsEl) orbsEl.textContent = `${this.coins}`;
    if (jumpEl) jumpEl.textContent = `${this.jumpCharges || 0}`;
    const orbsCircleEl = document.getElementById('orbsCircle');
    if (orbsCircleEl) orbsCircleEl.textContent = `${this.coins}`;
    const jumpCircleEl = document.getElementById('jumpCircle');
    if (jumpCircleEl) jumpCircleEl.textContent = `${this.jumpCharges || 0}`;
    
    // Update UI animations if available
    if (typeof window.updateOrbAnimation === 'function') {
      window.updateOrbAnimation(this.coins);
    }
    
    if (typeof window.updateLevelDots === 'function') {
      window.updateLevelDots(this.currentLevel);
    }
  }

  showToast(msg, color = '#00ff00') {
    if (this.toast) this.toast.destroy();
    
    // Convert hex color to cyberpunk colors
    let cyberColor = CYBER_GREEN;
    if (color === '#ffcc00') cyberColor = CYBER_YELLOW;
    if (color === '#c5c9d3') cyberColor = CYBER_GRAY;
    if (color === '#ff0000') cyberColor = CYBER_RED;
    if (color === '#00ffff') cyberColor = CYBER_CYAN;
    
    this.toast = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.height - 40,
      msg,
      {
        fontSize: '20px',
        fill: `#${cyberColor.toString(16)}`,
        fontFamily: 'Orbitron, Arial',
        backgroundColor: '#000',
        padding: { x: 15, y: 8 },
        stroke: '#000',
        strokeThickness: 4
      }
    )
    .setOrigin(0.5, 1)
    .setScrollFactor(0)
    .setDepth(2000);
    
    this.time.delayedCall(1500, () => {
      if (this.toast) this.toast.destroy();
    });
  }

  // =======================================================
  // 7.2 SCENE LIFECYCLE
  // =======================================================
  init(data) {
    this.currentLevel = data?.currentLevel ?? 1;
    this.totalTime = data?.totalTime ?? 0;
    this.score = data?.score ?? 0;
    this.coins = data?.coins ?? 0;

    this.isGameOver = false;
    this.paused = false;
    this.introPaused = false;
    this.lastWallHitAt = 0;
    this.wallContacting = false;
    this.wasTouchingWall = false;

    this.tileSize = TILE_SIZE;
    this.mazeLayout = [];
    this.timerStarted = false;
    this.startTime = 0;
    this.antStartPos = { x: 0, y: 0 };
    // Clear per-level feature maps so data from previous tiers can't leak
    // (e.g., zone slowdown persisting into hazard levels 16-20).
    this.zoneMap = null;
    this.hazardMap = null;

    // Save/Load removed. We keep deterministic generation via runSeed+rngSeed.
    this.runSeed = data?.runSeed ?? (Date.now() >>> 0);
    this.rngSeed = data?.rngSeed ?? makeLevelSeed(this.runSeed, this.currentLevel);
  }

  create() {
    // ===================================================
    // 7.2.1 Maze Generation
    // ===================================================
    let size, startPos = { x: 0, y: 0 }, exitPos = { x: 0, y: 0 };

    const rng = mulberry32(this.rngSeed);
    const mazeData = this.generateMaze(this.currentLevel, rng);
    this.mazeLayout = mazeData.maze;
    this.entrance = mazeData.entrance;
    this.exit = mazeData.exit;
    size = mazeData.size;

    // ===================================================
    // 7.2.2 Tile sizing (KEEP ORIGINAL FEEL)
    // Tiles stay constant across levels. Larger mazes require panning.
    // ===================================================
    {
      const canvasW = this.cameras.main.width;
      const canvasH = this.cameras.main.height;
      this.tileSize = TILE_SIZE;

      // Center small mazes; large ones start at (0,0)
      const mazeW = this.tileSize * size;
      const mazeH = this.tileSize * size;
      this.offsetX = Math.max(0, Math.floor((canvasW - mazeW) / 2));
      this.offsetY = Math.max(0, Math.floor((canvasH - mazeH) / 2));
    }

    // Set physics bounds
    const worldX = this.offsetX;
    const worldY = this.offsetY;
    const worldW = this.tileSize * size;
    const worldH = this.tileSize * size;
    this.physics.world.setBounds(worldX, worldY, worldW, worldH);
    this.topWalls = this.physics.add.staticGroup();

    // Camera bounds
    {
      const marginPan = 80;
      this.cameras.main.setBounds(
        worldX - marginPan,
        worldY - marginPan,
        worldW + marginPan * 2,
        worldH + marginPan * 2
      );
    }

    // ===================================================
    // 7.2.3 Maze Rendering
    // ===================================================
    const glowLayer = this.add.graphics().setDepth(5);
    const wallGlowList = [];
    let startGlowInfo = null, exitGlowInfo = null;

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const x = col * this.tileSize + this.offsetX;
        const y = row * this.tileSize + this.offsetY;
        const centerX = x + this.tileSize / 2;
        const centerY = y + this.tileSize / 2;

        if (this.mazeLayout[row][col] === 0) {
          // Wall tile
          const wall = this.add.rectangle(
            centerX, centerY, this.tileSize, this.tileSize, WALL_FILL_COLOR
          );
          wall.setStrokeStyle(2, CYBER_CYAN, 1).setDepth(1);
          this.physics.add.existing(wall, true);
          this.topWalls.add(wall);
          wallGlowList.push({ centerX, centerY });
        } else {
          // Corridor tile
          if (row === this.entrance.y && col === this.entrance.x) {
            const openSide = getInwardSide(row, col, size) || 
                           getOpenSide(this.mazeLayout, row, col);
            
            const startTile = this.add.rectangle(
              centerX, centerY, this.tileSize, this.tileSize, 0x110011, 0.6
            );
            startTile.setStrokeStyle(2, CYBER_CYAN, 1).setDepth(1);
            startGlowInfo = { centerX, centerY, openSide };
            startPos = { x: centerX, y: centerY };
          } else if (row === this.exit.y && col === this.exit.x) {
            const openSide = getInwardSide(row, col, size) || 
                           getOpenSide(this.mazeLayout, row, col);
            
            const exitTile = this.add.rectangle(
              centerX, centerY, this.tileSize, this.tileSize, 0x001100, 0.6
            );
            exitTile.setStrokeStyle(2, CYBER_CYAN, 1).setDepth(1);
            exitGlowInfo = { centerX, centerY, openSide };
            exitPos = { x: centerX, y: centerY };
          }
        }
      }
    }

    // Draw glows
    wallGlowList.forEach(({ centerX, centerY }) => {
      drawTileGlow(glowLayer, centerX, centerY, this.tileSize, CYBER_CYAN, null);
    });
    
    if (startGlowInfo) {
      drawTileGlow(
        glowLayer,
        startGlowInfo.centerX,
        startGlowInfo.centerY,
        this.tileSize,
        CYBER_MAGENTA,
        startGlowInfo.openSide
      );
    }
    
    if (exitGlowInfo) {
      drawTileGlow(
        glowLayer,
        exitGlowInfo.centerX,
        exitGlowInfo.centerY,
        this.tileSize,
        CYBER_GREEN,
        exitGlowInfo.openSide
      );
    }

    // ===================================================
    // 7.2.4 Player Setup
    // ===================================================
    if (this.ant) this.ant.destroy();
    const spawn = this.restoreSnapshot?.player ? this.restoreSnapshot.player : startPos;

    const ballRadius = Math.max(12, Math.floor(this.tileSize * 0.25));
    this.ant = this.add.circle(spawn.x, spawn.y, ballRadius, BALL_COLOR)
      .setDepth(3);
    this.ballRadius = ballRadius;
    
    this.physics.add.existing(this.ant, false);
    this.ant.body.setCircle(ballRadius);
    this.ant.body.setCollideWorldBounds(true);
    this.ant.body.setBounce(0);
    // Collider with walls triggers wall bump effects
    this.physics.add.collider(this.ant, this.topWalls, this.onWallHit, null, this);

    // Player glow effect
    this.antGlow = this.add.graphics().setDepth(this.ant.depth - 1);
    this.events.on('update', () => {
      this.antGlow.clear();
      BALL_GLOW_WIDTHS.forEach((w, i) => {
        this.antGlow.lineStyle(w, BALL_GLOW_COLOR, BALL_GLOW_ALPHAS[i]);
        const r = this.ant.body?.radius || 10;
        this.antGlow.strokeCircle(this.ant.x, this.ant.y, r);
      });
    });

    // ===================================================
    // 7.2.5 Camera & Exit
    // ===================================================
    this.cameras.main.startFollow(this.ant, true, 0.1, 0.1);
    const mobileZoom = IS_MOBILE_VIEW ? 0.6 : 1.1;
    this.cameras.main.setZoom(mobileZoom);
    this.cursors = this.input.keyboard.createCursorKeys();
    // WASD support
    this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' });
    this.exitPos = { x: exitPos.x, y: exitPos.y };

    this.levelCleared = false;
    const exitZone = this.add.zone(exitPos.x, exitPos.y, this.tileSize, this.tileSize);
    this.physics.add.existing(exitZone, true);
    this.physics.add.overlap(
      this.ant,
      exitZone,
      () => {
        if (!this.levelCleared && this.isPlayerFullyInsideExit()) {
          this.levelCleared = true;
          this.playExitEffect();
        }
      },
      null,
      this
    );

    // ===================================================
    // 7.2.6 Orbs Collection
    // ===================================================
    this.energyGroup = this.physics.add.group();
    const rngForOrbs = mulberry32((this.rngSeed >>> 0) + 999);
    const orbsCount = Math.max(3, 3 + Math.floor(this.currentLevel / 2));
    let placed = 0;

    while (placed < orbsCount) {
      const rx = Math.floor(rngForOrbs() * size);
      const ry = Math.floor(rngForOrbs() * size);

      if (this.mazeLayout[ry][rx] === 1 && 
          !(rx === this.entrance.x && ry === this.entrance.y)) {
        
        const px = rx * this.tileSize + this.tileSize / 2 + this.offsetX;
        const py = ry * this.tileSize + this.tileSize / 2 + this.offsetY;
        const orbRadius = Math.max(6, Math.floor(this.tileSize * 0.18));
        const pulseRadius = Math.floor(orbRadius * 1.3);

        const orb = this.add.circle(px, py, orbRadius, ORB_FILL_COLOR)
          .setStrokeStyle(2, ORB_STROKE_COLOR, 1);
        
        this.physics.add.existing(orb);
        orb.body.setCircle(orbRadius);
        orb.body.setImmovable(true);
        this.energyGroup.add(orb);

        // Pulse effect
        const pulse = this.add.circle(px, py, pulseRadius, ORB_FILL_COLOR, ORB_PULSE_OPACITY)
          .setDepth(orb.depth - 1);
        
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
            pulse.setScale(1).setAlpha(ORB_PULSE_OPACITY);
          }
        });

        placed++;
      }
    }

    // Orb collection
    this.physics.add.overlap(
      this.ant,
      this.energyGroup,
      (ant, orb) => {
        // Remove pulse effect and destroy orb
        if (orb.pulseTween) orb.pulseTween.stop();
        if (orb.pulse?.destroy) orb.pulse.destroy();
        const px = orb.x;
        const py = orb.y;
        orb.destroy();
        this.coins++;
        // Play pickup FX
        this.playOrbPickupEffect(px, py);
        // Show toast with translation
        const lang = window.getBaduzLang ? window.getBaduzLang() : 'en';
        const t = window.baduzTranslations?.[lang] || {};
        const msg = '+1 ' + (t.ORBS || 'Orb');
        this.showToast(msg, '#00ffff');
        this.updateHUD();
      },
      null,
      this
    );

    // ===================================================
    // 7.2.7 Feature Initialization
    // Initialize modifiers and special elements depending on level.
    // Speed modifier defaults to 1 and can be altered by zones.
    this.speedModifier = 1;
    this.lastMoveDir = { x: 1, y: 0 };

    // Run-level persistent state (no save/load). Jump charges accumulate across levels.
    window.baduzRun = window.baduzRun || { jumpCharges: 0 };
    this.jumpCharges = window.baduzRun.jumpCharges || 0;
    this.jumpActiveUntil = 0;
    this.dashUntil = 0;
    this.dashVec = { x: 1, y: 0 };
    this.dashSpeed = PLAYER_SPEED * 3;
    if (this.currentLevel >= 6 && this.currentLevel <= 10) {
      this.setupKeyDoor(size);
    }
    if (this.currentLevel >= 11 && this.currentLevel <= 15) {
      this.setupZones(size);
    }
    if (this.currentLevel >= 16 && this.currentLevel <= 20) {
      this.setupHazards(size);
      this.setupJumpPickups(size);
    }

    // ===================================================
    // 7.2.7 Timer & Entrance Blocker
    // ===================================================
    this.antStartPos = { x: startPos.x, y: startPos.y };
    this.timerStarted = false;
    this.startTime = 0;
    this.hasLeftStart = false;
    this.startBlocker = null;

    {
      const gridX = this.entrance.x;
      const gridY = this.entrance.y;
      let outX = 0, outY = 0;
      
      if (gridX === 0) { outX = startPos.x - this.tileSize; outY = startPos.y; }
      else if (gridX === size - 1) { outX = startPos.x + this.tileSize; outY = startPos.y; }
      else if (gridY === 0) { outX = startPos.x; outY = startPos.y - this.tileSize; }
      else if (gridY === size - 1) { outX = startPos.x; outY = startPos.y + this.tileSize; }
      
      if (outX !== 0 || outY !== 0) {
        const blocker = this.add.rectangle(outX, outY, this.tileSize, this.tileSize)
          .setFillStyle(0xffffff, 0);
        this.physics.add.existing(blocker, true);
        this.startBlocker = blocker;
        blocker.body.enable = false;
        this.physics.add.collider(this.ant, blocker);
      }
    }

    // ===================================================
    // 7.2.8 Input & Controls
    // ===================================================
    this.input.keyboard.on('keydown-P', this.togglePause, this);
    this.input.keyboard.on('keydown-R', () => {
      this.handleReset();
      this.showToast('Level Reset', CYBER_YELLOW);
    });
    this.input.keyboard.on('keydown-H', () => {
      this.useHint();
    });

    this.input.keyboard.on('keydown-J', () => {
      this.handleJump();
    });

    // Camera panning
    this.isDraggingCamera = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.cameraStartX = 0;
    this.cameraStartY = 0;
    
    this.input.on('pointerdown', (pointer) => {
      const eventTarget = pointer.event?.target;
      if (eventTarget?.closest('.game-controls, .main-header, .modal, .quick-actions, .save-panel')) {
        return;
      }
      this.isDraggingCamera = true;
      this.dragStartScreenX = pointer.x;
      this.dragStartScreenY = pointer.y;
      this.cameraStartX = this.cameras.main.scrollX;
      this.cameraStartY = this.cameras.main.scrollY;
      this.cameras.main.stopFollow();
    });
    
    this.input.on('pointermove', (pointer) => {
      if (!this.isDraggingCamera) return;
      const cam = this.cameras.main;
      const dx = (pointer.x - this.dragStartScreenX) / (cam.zoom || 1);
      const dy = (pointer.y - this.dragStartScreenY) / (cam.zoom || 1);
      cam.setScroll(this.cameraStartX - dx, this.cameraStartY - dy);
    });
    
    this.input.on('pointerup', () => {
      this.isDraggingCamera = false;
    });

    // Initialize HUD
    this.updateHUD();

    // Show a short intro when a new tier of mechanics starts
    this.maybeShowTierIntro();
  }

  maybeShowTierIntro() {
    const lvl = this.currentLevel;
    let tierKey = null;
    if (lvl === 1) tierKey = 't1';
    else if (lvl === 6) tierKey = 't2';
    else if (lvl === 11) tierKey = 't3';
    else if (lvl === 16) tierKey = 't4';

    if (!tierKey || typeof window.showTierIntro !== 'function') return;

    this.introPaused = true;
    this.physics.pause();
    this.ant.body.setVelocity(0);
    window.showTierIntro(tierKey, () => {
      this.introPaused = false;
      if (!this.paused) this.physics.resume();
    });
  }

  update() {
    if (this.isGameOver || this.paused || this.introPaused) return;

    this.ant.body.setVelocity(0);

    // Check if player left start
    if (!this.hasLeftStart) {
      const dx = Math.abs(this.ant.x - this.antStartPos.x);
      const dy = Math.abs(this.ant.y - this.antStartPos.y);
      if (dx > this.tileSize * 0.25 || dy > this.tileSize * 0.25) {
        this.hasLeftStart = true;
        if (this.startBlocker?.body) {
          this.startBlocker.body.enable = true;
        }
      }
    }

    // Movement controls (unified analog/digital)
    let vx = 0;
    let vy = 0;
    const mInput = window.mobileInput;
    const analog = mInput?.analog;
    const mDir = mInput?.dir;
    if (analog) {
      let ax = analog.x || 0;
      let ay = analog.y || 0;
      if (SNAP_8_DIR) {
        const angle = Math.atan2(ay, ax);
        const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        ax = Math.cos(snapAngle);
        ay = Math.sin(snapAngle);
      }
      vx = ax;
      vy = ay;
    } else {
      // Keyboard or digital joystick
      const w = this.wasd;
      if (this.cursors.left.isDown || w?.left?.isDown || mDir === 'left') vx -= 1;
      if (this.cursors.right.isDown || w?.right?.isDown || mDir === 'right') vx += 1;
      if (this.cursors.up.isDown || w?.up?.isDown || mDir === 'up') vy -= 1;
      if (this.cursors.down.isDown || w?.down?.isDown || mDir === 'down') vy += 1;
    }
    // Normalize diagonal movement
    if (vx !== 0 || vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      vx /= len;
      vy /= len;
    }
    if (vx !== 0 || vy !== 0) {
      this.lastMoveDir = { x: vx, y: vy };
    }
    // Apply zone speed modifier (only on levels 11-15)
    let speedMod = 1;
    const cellX = Math.floor((this.ant.x - this.offsetX) / this.tileSize);
    const cellY = Math.floor((this.ant.y - this.offsetY) / this.tileSize);
    if (this.currentLevel >= 11 && this.currentLevel <= 15 && this.zoneMap) {
      const zKey = `${cellX},${cellY}`;
      const zType = this.zoneMap[zKey];
      if (zType === 'slow') speedMod = 0.2;
      else if (zType === 'ice') speedMod = 5.5;
      else speedMod = 1;
      this.speedModifier = speedMod;
    } else {
      this.speedModifier = 1;
    }
    // Dash override during Jump (more physical feel)
    const now = Date.now();
    if (this.dashUntil && now < this.dashUntil) {
      vx = this.dashVec.x;
      vy = this.dashVec.y;
      speedMod = (this.dashSpeed || (PLAYER_SPEED*3)) / PLAYER_SPEED;
    }

    // Hazard detection (ignored briefly during Jump)
    if (this.hazardMap && !(this.jumpActiveUntil && Date.now() < this.jumpActiveUntil)) {
      const hKey = `${cellX},${cellY}`;
      if (this.hazardMap[hKey]) {
        this.onHazardHit();
        return;
      }
    }
    this.ant.body.setVelocity(vx * PLAYER_SPEED * speedMod, vy * PLAYER_SPEED * speedMod);

    // Start timer
    if (!this.timerStarted && 
        (Math.abs(this.ant.x - this.antStartPos.x) > 4 || 
         Math.abs(this.ant.y - this.antStartPos.y) > 4)) {
      this.startTime = Date.now();
      this.timerStarted = true;
    }

    // Update timer display
    if (this.timerStarted) {
      const timerEl = document.getElementById('timer-display');
      if (timerEl) timerEl.textContent = this.formatTime(Date.now() - this.startTime);
    }

    // Allow one bump per contact: trigger on transition into wall contact
    const body = this.ant?.body;
    if (body) {
      const touchingWall =
        (body.blocked && (body.blocked.up || body.blocked.down || body.blocked.left || body.blocked.right)) ||
        (body.touching && (body.touching.up || body.touching.down || body.touching.left || body.touching.right));
      if (touchingWall && !this.wasTouchingWall) {
        this.playWallBumpEffect();
      }
      this.wasTouchingWall = touchingWall;
    }

  }

  // =======================================================
  // 7.3 GAME MECHANICS
  // =======================================================
  togglePause() {
    if (!this.paused) {
      this.paused = true;
      this.pauseStart = Date.now();
      this.physics.pause();
      
      if (this.pauseText) this.pauseText.destroy();
      
      this.pauseText = this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2,
        'PAUSE',
        {
          fontSize: '100px',
          fill: `#${CYBER_GREEN.toString(16)}`,
          fontFamily: 'Orbitron, Arial',
          stroke: '#000',
          strokeThickness: 6,
          shadow: {
            offsetX: 0,
            offsetY: 0,
            color: `#${CYBER_GREEN.toString(16)}`,
            blur: 20,
            stroke: true
          }
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(9999);
    } else {
      this.paused = false;
      const pausedDuration = Date.now() - this.pauseStart;
      if (this.timerStarted) this.startTime += pausedDuration;
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

    // Draw hint path
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
      x: Math.floor((this.ant.x - this.offsetX) / this.tileSize),
      y: Math.floor((this.ant.y - this.offsetY) / this.tileSize)
    };
    const end = this.exit;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    
    const key = (x, y) => `${x},${y}`;
    const queue = [start];
    const seen = new Set([key(start.x, start.y)]);
    const prev = {};

    while (queue.length) {
      const current = queue.shift();
      if (current.x === end.x && current.y === end.y) {
        const path = [];
        let cur = current;
        while (cur) {
          path.unshift(cur);
          cur = prev[key(cur.x, cur.y)];
        }
        return path;
      }
      
      for (const [dx, dy] of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nKey = key(nx, ny);
        
        if (nx >= 0 && ny >= 0 && nx < size && ny < size &&
            this.mazeLayout[ny][nx] === 1 && !seen.has(nKey)) {
          seen.add(nKey);
          prev[nKey] = current;
          queue.push({ x: nx, y: ny });
        }
      }
    }
    
    return null;
  }

  /**
   * Compute path in grid coordinates between two points (BFS on walkable tiles).
   * Used to protect the unique solution path from hazards.
   */
  computePathCells(start, end) {
    const size = this.mazeLayout.length;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const key = (x, y) => `${x},${y}`;
    const queue = [{ x: start.x, y: start.y }];
    const seen = new Set([key(start.x, start.y)]);
    const prev = {};

    while (queue.length) {
      const current = queue.shift();
      if (current.x === end.x && current.y === end.y) {
        const path = [];
        let cur = current;
        while (cur) {
          path.unshift(cur);
          cur = prev[key(cur.x, cur.y)];
        }
        return path;
      }
      for (const [dx, dy] of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        if (this.mazeLayout[ny][nx] !== 1) continue;
        const nK = key(nx, ny);
        if (seen.has(nK)) continue;
        seen.add(nK);
        prev[nK] = current;
        queue.push({ x: nx, y: ny });
      }
    }
    return null;
  }

  // =======================================================
  // 7.6 EXTRA FEATURES (Key/Door, Zones, Hazards, FX)
  // =======================================================

  /**
   * Setup a key and a door for levels 6–10. The door blocks the tile adjacent
   * to the exit until the key is collected. The key is placed at a random
   * corridor cell away from entrance/exit/door. The door is placed directly
   * adjacent to the exit on the inward side. When the player collides with the
   * door without the key, a toast is shown. Once the key is collected the
   * door disappears and the player may exit.
   */
  setupKeyDoor(size) {
    // Determine door location: one tile adjacent to exit on the inward side.
    let doorGridX = this.exit.x;
    let doorGridY = this.exit.y;
    if (this.exit.x === 0) doorGridX = 1;
    else if (this.exit.x === size - 1) doorGridX = size - 2;
    else if (this.exit.y === 0) doorGridY = 1;
    else if (this.exit.y === size - 1) doorGridY = size - 2;
    // Coordinates in pixels
    const doorCx = doorGridX * this.tileSize + this.tileSize / 2 + this.offsetX;
    const doorCy = doorGridY * this.tileSize + this.tileSize / 2 + this.offsetY;
    // Create door visual
    this.door = this.add.rectangle(
      doorCx,
      doorCy,
      this.tileSize,
      this.tileSize,
      0x330000,
      0.8
    ).setStrokeStyle(2, CYBER_RED, 1).setDepth(2);
    this.physics.add.existing(this.door, true);
    // Flag for key
    this.hasKey = false;
    // Door collider logic
    this.doorCollider = this.physics.add.collider(this.ant, this.door, () => {
      if (this.hasKey) {
        // remove door and collider
        if (this.doorCollider) this.doorCollider.destroy();
        if (this.door) this.door.destroy();
      } else {
        const lang = window.getBaduzLang ? window.getBaduzLang() : 'en';
        const t = window.baduzTranslations?.[lang] || {};
        this.showToast(t.needKey || 'Find the key!', '#ff0000');
      }
    }, null, this);
    // Place key: choose random corridor cell not at entrance, exit or door
    let kx = 0;
    let ky = 0;
    let tries = 0;
    do {
      kx = Math.floor(Math.random() * size);
      ky = Math.floor(Math.random() * size);
      tries++;
      // Avoid infinite loop
      if (tries > 500) break;
    } while (
      this.mazeLayout[ky][kx] === 0 ||
      (kx === this.entrance.x && ky === this.entrance.y) ||
      (kx === this.exit.x && ky === this.exit.y) ||
      (kx === doorGridX && ky === doorGridY)
    );
    const keyCx = kx * this.tileSize + this.tileSize / 2 + this.offsetX;
    const keyCy = ky * this.tileSize + this.tileSize / 2 + this.offsetY;
    const keyRadius = Math.max(6, Math.floor(this.tileSize * 0.2));
    this.keyItem = this.add.circle(keyCx, keyCy, keyRadius, 0xffdd00)
      .setStrokeStyle(2, 0xffaa00, 1)
      .setDepth(2);
    this.physics.add.existing(this.keyItem);
    this.keyItem.body.setCircle(keyRadius);
    this.keyItem.body.setImmovable(true);
    this.physics.add.overlap(this.ant, this.keyItem, () => {
      this.hasKey = true;
      this.keyItem.destroy();
      const lang = window.getBaduzLang ? window.getBaduzLang() : 'en';
      const t = window.baduzTranslations?.[lang] || {};
      this.showToast(t.keyCollected || 'Key collected!', '#ffff00');
      // Change door tint to indicate unlocked
      if (this.door) this.door.setFillStyle(0x003300, 0.8);
    }, null, this);
  }

  /**
   * Setup speed-modifying zones for levels 11–15. Creates a number of zone
   * rectangles on random corridor tiles. Zones can be 'slow' (reduce speed)
   * or 'ice' (increase speed / slippery). The zone positions are tracked in
   * this.zoneMap keyed by "row,col" and used in update() to apply modifiers.
   */
  setupZones(size) {
    this.zoneMap = {};
    const zoneCount = Math.max(3, Math.floor(size / 4));
    for (let i = 0; i < zoneCount; i++) {
      let zx = 0;
      let zy = 0;
      let attempts = 0;
      do {
        zx = Math.floor(Math.random() * size);
        zy = Math.floor(Math.random() * size);
        attempts++;
        if (attempts > 500) break;
      } while (
        this.mazeLayout[zy][zx] === 0 ||
        (zx === this.entrance.x && zy === this.entrance.y) ||
        (zx === this.exit.x && zy === this.exit.y)
      );
      const type = (i % 2 === 0) ? 'slow' : 'ice';
      const zoneKey = `${zx},${zy}`;
      this.zoneMap[zoneKey] = type;
      const cx = zx * this.tileSize + this.tileSize / 2 + this.offsetX;
      const cy = zy * this.tileSize + this.tileSize / 2 + this.offsetY;
      const rect = this.add.rectangle(
        cx,
        cy,
        this.tileSize,
        this.tileSize,
        type === 'slow' ? 0x004400 : 0x001144,
        0.4
      ).setStrokeStyle(2, type === 'slow' ? 0x00aa00 : 0x0033aa, 0.8)
      .setDepth(0.5);
    }
  }

  /**
   * Setup hazard tiles for levels 16–20. Hazard tiles instantly reset the
   * level when the player steps on them. Hazard positions are tracked in
   * this.hazardMap keyed by "row,col" and used in update() to detect
   * collisions. Visual red tiles are added for feedback.
   */
  setupHazards(size) {
    this.hazardMap = {};
    // Protect the unique solution path (perfect maze) so the level is always completable.
    const protectedPath = this.computePathCells(this.entrance, this.exit);
    const protectedSet = new Set((protectedPath || []).map(p => `${p.x},${p.y}`));

    const hazardCount = Math.max(3, Math.floor(size / 5));
    for (let i = 0; i < hazardCount; i++) {
      let hx = 0;
      let hy = 0;
      let attempts = 0;
      do {
        hx = Math.floor(Math.random() * size);
        hy = Math.floor(Math.random() * size);
        attempts++;
        if (attempts > 500) break;
      } while (
        this.mazeLayout[hy][hx] === 0 ||
        (hx === this.entrance.x && hy === this.entrance.y) ||
        (hx === this.exit.x && hy === this.exit.y) ||
        protectedSet.has(`${hx},${hy}`)
      );
      const hazardKey = `${hx},${hy}`;
      this.hazardMap[hazardKey] = true;
      const cx = hx * this.tileSize + this.tileSize / 2 + this.offsetX;
      const cy = hy * this.tileSize + this.tileSize / 2 + this.offsetY;
      this.add.rectangle(
        cx,
        cy,
        this.tileSize,
        this.tileSize,
        0x550000,
        0.5
      ).setStrokeStyle(2, 0xff0000, 0.9).setDepth(1);
    }
  }

  /**
   * Setup Jump pickups (springs) for levels 16–20.
   * Each pickup grants 1 Jump charge. Jump lets you ignore hazards
   * for a brief window (skill/timing mechanic).
   */
  setupJumpPickups(size) {
    this.jumpGroup = this.physics.add.staticGroup();
    const count = Math.max(1, Math.floor(size / 5));
    let placed = 0;
    let attempts = 0;
    const forbidden = new Set([
      `${this.entrance.x},${this.entrance.y}`,
      `${this.exit.x},${this.exit.y}`
    ]);
    if (this.hazardMap) {
      Object.keys(this.hazardMap).forEach(k => forbidden.add(k));
    }
    while (placed < count && attempts < 2000) {
      attempts++;
      const gx = Math.floor(Math.random() * size);
      const gy = Math.floor(Math.random() * size);
      const k = `${gx},${gy}`;
      if (forbidden.has(k)) continue;
      if (this.mazeLayout[gy][gx] !== 1) continue;
      // Place
      const cx = gx * this.tileSize + this.tileSize / 2 + this.offsetX;
      const cy = gy * this.tileSize + this.tileSize / 2 + this.offsetY;
      const spring = this.add.circle(cx, cy, Math.max(6, this.tileSize * 0.14), CYBER_GRAY, 0.92);
      spring.setStrokeStyle(2, 0xe6ebf5, 1);
      this.jumpGroup.add(spring);
      spring._jumpKey = k;
      forbidden.add(k);
      placed++;
    }

    this.physics.add.overlap(this.ant, this.jumpGroup, (ant, spring) => {
      spring.destroy();
      this.jumpCharges = (this.jumpCharges || 0) + 1;
      if (window.baduzRun) window.baduzRun.jumpCharges = this.jumpCharges;
      this.showToast('+1 Jump', '#c5c9d3');
      this.updateHUD();
    }, null, this);
  }

  /** Activate Jump if you have charges */
  handleJump() {
    if (this.paused || this.introPaused) return;
    if (!this.jumpCharges || this.jumpCharges <= 0) {
      this.showToast('No Jump charges', '#c5c9d3');
      return;
    }

    // Consume a charge
    this.jumpCharges -= 1;
    if (window.baduzRun) window.baduzRun.jumpCharges = this.jumpCharges;
    this.updateHUD();

    // Activate hazard immunity window
    const start = Date.now();
    this.jumpActiveUntil = start + 280; // ~one tile window

    // Dash direction = last movement direction (fallback to right)
    const d = this.lastMoveDir || { x: 1, y: 0 };
    const len = Math.hypot(d.x, d.y) || 1;
    this.dashVec = { x: d.x / len, y: d.y / len };
    this.dashSpeed = PLAYER_SPEED * 3.2;
    this.dashUntil = start + 180;

    // Camera punch + slight zoom
    this.cameras.main.shake(90, 0.004);
    this.cameras.main.zoomTo(1.05, 120);
    this.time.delayedCall(220, () => this.cameras.main.zoomTo(1.0, 160));

    // Visual: glow ring + squash/stretch
    const glow = this.add.circle(this.ant.x, this.ant.y, Math.max(12, this.tileSize * 0.28), CYBER_GRAY, 0.28);
    glow.setDepth(10);
    this.tweens.add({ targets: glow, alpha: 0, scale: 2.0, duration: 220, onComplete: () => glow.destroy() });

    this.tweens.add({
      targets: this.ant,
      scaleX: 1.18,
      scaleY: 0.88,
      yoyo: true,
      duration: 120,
      ease: 'Sine.easeOut'
    });

    // Afterimages to communicate motion
    const ghosts = 5;
    for (let i = 1; i <= ghosts; i++) {
      this.time.delayedCall(i * 25, () => {
        const g = this.add.circle(this.ant.x, this.ant.y, Math.max(3, this.tileSize * 0.12), CYBER_GRAY, 0.18);
        g.setDepth(5);
        this.tweens.add({ targets: g, alpha: 0, duration: 240, onComplete: () => g.destroy() });
      });
    }
  }

  /**
   * Effects for orb pickup: creates a small burst of particles and a brief
   * camera shake.
   */
  playOrbPickupEffect(x, y) {
    // Small camera shake
    this.cameras.main.shake(120, 0.004);
    // Create radial particles using graphics and tween
    const particles = [];
    const count = 8;
    const colors = [CYBER_GREEN, CYBER_CYAN, CYBER_YELLOW];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const px = x;
      const py = y;
      const dot = this.add.circle(px, py, 2, colors[i % colors.length]);
      dot.setDepth(6);
      particles.push(dot);
      this.tweens.add({
        targets: dot,
        x: px + Math.cos(angle) * this.tileSize * 0.4,
        y: py + Math.sin(angle) * this.tileSize * 0.4,
        alpha: 0,
        duration: 300,
        onComplete: () => dot.destroy()
      });
    }
  }

  /**
   * Effect for wall bump: tiny shake and flash.
   */
  playWallBumpEffect() {
    this.cameras.main.shake(80, 0.002);
  }

  /**
   * Effect when player reaches the exit: freeze for 120ms, flash and then
   * proceed to next level.
   */
  playExitEffect() {
    // Flash screen
    this.cameras.main.flash(120, 255, 255, 255);
    // Freeze physics briefly
    this.physics.pause();
    // After 120ms resume and go to next level
    this.time.delayedCall(120, () => {
      this.physics.resume();
      this.nextLevel();
    });
  }

  /**
   * Wall collision callback. Triggered when the player collides with a wall
   * tile. Plays a wall bump effect.
   */
  onWallHit() {
    // Keep collision resolution but defer shake logic to update() state change
    this.wallContacting = true;
  }

  /**
   * Called when the player steps on a hazard tile. Restarts the level and
   * shows a toast.
   */
  onHazardHit() {
    const lang = window.getBaduzLang ? window.getBaduzLang() : 'en';
    const t = window.baduzTranslations?.[lang] || {};
    this.showToast(t.hazard || 'Hazard!', '#ff0066');
    // Reset level state (restarts from current level)
    this.handleReset();
  }

  // =======================================================
  // 7.4 RESET
  // =======================================================
  handleReset() {
    const sameLevel = this.currentLevel;
    const sameRunSeed = this.runSeed;
    const sameLevelSeed = makeLevelSeed(sameRunSeed, sameLevel);

    this.scene.restart({
      currentLevel: sameLevel,
      totalTime: this.totalTime,
      score: this.score,
      coins: this.coins,
      runSeed: sameRunSeed,
      rngSeed: sameLevelSeed
    });
  }

  // =======================================================
  // 7.5 LEVEL PROGRESSION
  // =======================================================
  isPlayerFullyInsideExit() {
    if (!this.ant || !this.exitPos) return false;
    
    const r = this.ant.body?.radius ?? this.ballRadius ?? 0;
    const half = this.tileSize / 2;
    const margin = half - r;
    
    if (margin <= 0) return false;
    
    const dx = Math.abs(this.ant.x - this.exitPos.x);
    const dy = Math.abs(this.ant.y - this.exitPos.y);
    
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

    // Check for game completion
    if (this.currentLevel > 20) {
      this.showGameCompletion();
      return;
    }

    // Reset and load next level
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

  showGameCompletion() {
    this.isGameOver = true;
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(this.game.config.width / 2, this.game.config.height / 2);

    const totalSeconds = Math.floor(this.totalTime / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const formattedTotal = `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Cyberpunk completion screen
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    const endContainer = this.add.container(cx, cy)
      .setScrollFactor(0)
      .setDepth(2000);

    const panelWidth = 600;
    const panelHeight = 400;
    const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x000000, 0.9)
      .setStrokeStyle(4, CYBER_CYAN, 0.8);

    const title = this.add.text(0, -100, 
      `DEMO COMPLETED!\nThank you for playing, ${PLAYER_NAME}!`,
      {
        fontSize: '40px',
        fill: `#${CYBER_MAGENTA.toString(16)}`,
        fontFamily: 'Orbitron, Arial',
        align: 'center',
        stroke: '#000',
        strokeThickness: 4,
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: `#${CYBER_MAGENTA.toString(16)}`,
          blur: 20,
          stroke: true
        }
      }
    ).setOrigin(0.5);

    const stats = this.add.text(0, 40,
      `Total Time: ${formattedTotal}\nFinal Score: ${this.score}`,
      {
        fontSize: '30px',
        fill: `#${CYBER_GREEN.toString(16)}`,
        fontFamily: 'Orbitron, Arial',
        stroke: '#000',
        strokeThickness: 3,
        align: 'center',
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: `#${CYBER_GREEN.toString(16)}`,
          blur: 15,
          stroke: true
        }
      }
    ).setOrigin(0.5);

    endContainer.add([panel, title, stats]);
    this.currentLevel = 21;
    this.physics.pause();
    this.ant.body.setVelocity(0);
  }

  // =======================================================
  // 7.6 MAZE GENERATION
  // =======================================================
  generateMaze(level, rng) {
    const size = 5 + level * 2;
    const maze = Array(size).fill().map(() => Array(size).fill(0));
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
      const nx = x + d.dx;
      const ny = y + d.dy;
      
      if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && maze[ny][nx] === 0) {
        const wx = x + d.dx / 2;
        const wy = y + d.dy / 2;
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

// =========================================================
// 8. PHASER GAME INITIALIZATION
// =========================================================

function getCanvasFrameSize() {
  const frame = document.querySelector('.canvas-wrapper') || document.querySelector('.canvas-frame');
  if (!frame) {
    // Fallback: use current viewport
    return { width: Math.max(320, window.innerWidth), height: Math.max(240, window.innerHeight) };
  }
  const r = frame.getBoundingClientRect();
  // Guard against 0 during first layout pass
  const w = Math.max(320, Math.floor(r.width || 0));
  const h = Math.max(240, Math.floor(r.height || 0));
  return { width: w, height: h };
}

let game = null;

function initPhaserGame() {
  const { width, height } = getCanvasFrameSize();

  const config = {
    type: Phaser.CANVAS,
    width,
    height,
    canvas: document.getElementById('gameCanvas'),
    transparent: true,
    physics: { 
      default: 'arcade', 
      arcade: { 
        gravity: { y: 0 }, 
        debug: false 
      } 
    },
    scene: MazeScene
  };

  game = new Phaser.Game(config);
  window.game = game; // Expose game globally for UI access

  // Keep Phaser internal size aligned with the visible container (desktop responsive)
  const frame = document.querySelector('.canvas-wrapper') || document.querySelector('.canvas-frame');
  if (frame && window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      if (!game || !game.scale) return;
      const s = getCanvasFrameSize();
      game.scale.resize(s.width, s.height);
    });
    ro.observe(frame);
  } else {
    // Fallback
    window.addEventListener('resize', () => {
      if (!game || !game.scale) return;
      const s = getCanvasFrameSize();
      game.scale.resize(s.width, s.height);
    });
  }
}

// Boot after DOM is ready (safe on desktop + mobile)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPhaserGame);
} else {
  initPhaserGame();
}

window.game = game; // Expose game globally for UI access

// =========================================================
// 9. GLOBAL UTILITY FUNCTIONS FOR UI INTEGRATION
// =========================================================
window.updateOrbAnimation = function(currentOrbs) {
  const orbFill = document.getElementById('orbFill');
  if (!orbFill) return;
  
  const maxOrbs = 10;
  const percentage = Math.min((currentOrbs / maxOrbs) * 100, 100);
  orbFill.style.width = `${percentage}%`;
  
  if (currentOrbs > (window.lastOrbs || 0)) {
    orbFill.classList.add('pulse');
    setTimeout(() => orbFill.classList.remove('pulse'), 300);
  }
  window.lastOrbs = currentOrbs;
};

window.updateLevelDots = function(currentLevel) {
  const dots = document.querySelectorAll('.level-dots .dot');
  if (!dots.length) return;
  
  dots.forEach(dot => {
    dot.classList.remove('active');
    dot.style.background = 'rgba(0, 243, 255, 0.3)';
  });
  
  const levelIndex = Math.min(currentLevel - 1, 4);
  for (let i = 0; i <= levelIndex; i++) {
    if (dots[i]) dots[i].classList.add('active');
  }
};

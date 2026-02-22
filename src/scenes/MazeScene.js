/* =========================================================
   BADUZ – MazeScene (Phaser 3)
   Main game scene. Depends on: constants.js, rng.js,
   scoring.js, player.js, pathfinding.js
   ========================================================= */

// =========================================================
// UTILITY FUNCTIONS (maze-drawing helpers)
// =========================================================
function getOpenSide(mazeLayout, row, col) {
  const size = mazeLayout.length;
  if (col < size - 1 && mazeLayout[row][col + 1] === 1) return 'right';
  if (col > 0       && mazeLayout[row][col - 1] === 1) return 'left';
  if (row < size - 1 && mazeLayout[row + 1][col] === 1) return 'down';
  if (row > 0       && mazeLayout[row - 1][col] === 1) return 'up';
  return null;
}

function getInwardSide(row, col, size) {
  if (row === 0)        return 'down';
  if (row === size - 1) return 'up';
  if (col === 0)        return 'right';
  if (col === size - 1) return 'left';
  return null;
}

function drawTileGlow(graphics, centerX, centerY, tileSize, color, openSide) {
  const half = tileSize / 2;
  const layers = [
    { inflate: 9, alpha: 0.15 },
    { inflate: 5, alpha: 0.35 },
    { inflate: 1, alpha: 0.8  }
  ];

  layers.forEach((layer) => {
    const { inflate, alpha } = layer;
    const left   = centerX - half - inflate;
    const right  = centerX + half + inflate;
    const top    = centerY - half - inflate;
    const bottom = centerY + half + inflate;

    graphics.lineStyle(4, color, alpha);

    if (openSide !== 'up') {
      graphics.beginPath(); graphics.moveTo(left, top);    graphics.lineTo(right, top);    graphics.strokePath();
    }
    if (openSide !== 'down') {
      graphics.beginPath(); graphics.moveTo(left, bottom); graphics.lineTo(right, bottom); graphics.strokePath();
    }
    if (openSide !== 'left') {
      graphics.beginPath(); graphics.moveTo(left, top);    graphics.lineTo(left, bottom);  graphics.strokePath();
    }
    if (openSide !== 'right') {
      graphics.beginPath(); graphics.moveTo(right, top);   graphics.lineTo(right, bottom); graphics.strokePath();
    }
  });
}

// =========================================================
// MAZE SCENE CLASS
// =========================================================
class MazeScene extends Phaser.Scene {
  constructor() {
    super('MazeScene');
  }

  // =======================================================
  // HUD & UI
  // =======================================================
  updateHUD() {
    const levelEl  = document.getElementById('levelDisplay');
    const timerEl  = document.getElementById('timer-display');
    const scoreEl  = document.getElementById('score');
    const nameEl   = document.getElementById('playerNameDisplay');
    const orbsEl   = document.getElementById('orbsDisplay');
    const jumpEl   = document.getElementById('jumpDisplay');

    if (levelEl) levelEl.textContent = `${this.currentLevel}`;
    if (timerEl) timerEl.textContent = this.timerStarted
      ? this.formatTime(Date.now() - this.startTime) : '00:00:00';
    if (scoreEl) scoreEl.textContent = `${this.score}`.padStart(5, '0');
    if (nameEl)  nameEl.textContent  = PLAYER_NAME;
    if (orbsEl)  orbsEl.textContent  = `${this.coins}`;
    if (jumpEl)  jumpEl.textContent  = `${this.jumpCharges || 0}`;

    const orbsCircleEl = document.getElementById('orbsCircle');
    if (orbsCircleEl) orbsCircleEl.textContent = `${this.coins}`;
    const jumpCircleEl = document.getElementById('jumpCircle');
    if (jumpCircleEl) jumpCircleEl.textContent = `${this.jumpCharges || 0}`;

    if (typeof window.updateOrbAnimation === 'function') window.updateOrbAnimation(this.coins);
    if (typeof window.updateLevelDots    === 'function') window.updateLevelDots(this.currentLevel);
  }

  showToast(msg, color = '#00ff00') {
    if (this.toast) this.toast.destroy();

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

    this.time.delayedCall(1500, () => { if (this.toast) this.toast.destroy(); });
  }

  // =======================================================
  // SCENE LIFECYCLE
  // =======================================================
  init(data) {
    // Ensure player name is set before scene starts
    ensurePlayerName();

    this.currentLevel   = data?.currentLevel ?? 1;
    this.totalTime      = data?.totalTime    ?? 0;
    this.score          = data?.score        ?? 0;
    this.coins          = data?.coins        ?? 0;

    this.isGameOver     = false;
    this.paused         = false;
    this.introPaused    = false;
    this.lastWallHitAt  = 0;
    this.wallContacting = false;
    this.wasTouchingWall= false;

    this.tileSize       = TILE_SIZE;
    this.mazeLayout     = [];
    this.timerStarted   = false;
    this.startTime      = 0;
    this.antStartPos    = { x: 0, y: 0 };
    this.zoneMap        = null;
    this.hazardMap      = null;

    this.runSeed  = data?.runSeed  ?? (Date.now() >>> 0);
    this.rngSeed  = data?.rngSeed  ?? makeLevelSeed(this.runSeed, this.currentLevel);
  }

  create() {
    // ---------------------------------------------------
    // Maze Generation
    // ---------------------------------------------------
    let size, startPos = { x: 0, y: 0 }, exitPos = { x: 0, y: 0 };

    const rng      = mulberry32(this.rngSeed);
    const mazeData = this.generateMaze(this.currentLevel, rng);
    this.mazeLayout = mazeData.maze;
    this.entrance   = mazeData.entrance;
    this.exit       = mazeData.exit;
    size            = mazeData.size;

    // ---------------------------------------------------
    // Tile sizing & world bounds
    // ---------------------------------------------------
    {
      const canvasW = this.cameras.main.width;
      const canvasH = this.cameras.main.height;
      this.tileSize = TILE_SIZE;

      const mazeW = this.tileSize * size;
      const mazeH = this.tileSize * size;
      this.offsetX = Math.max(0, Math.floor((canvasW - mazeW) / 2));
      this.offsetY = Math.max(0, Math.floor((canvasH - mazeH) / 2));
    }

    const worldX = this.offsetX;
    const worldY = this.offsetY;
    const worldW = this.tileSize * size;
    const worldH = this.tileSize * size;
    this.physics.world.setBounds(worldX, worldY, worldW, worldH);
    this.topWalls = this.physics.add.staticGroup();

    {
      const marginPan = 80;
      this.cameras.main.setBounds(
        worldX - marginPan, worldY - marginPan,
        worldW + marginPan * 2, worldH + marginPan * 2
      );
    }

    // ---------------------------------------------------
    // Maze Rendering
    // ---------------------------------------------------
    const glowLayer    = this.add.graphics().setDepth(5);
    const wallGlowList = [];
    let startGlowInfo  = null;
    let exitGlowInfo   = null;

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const x       = col * this.tileSize + this.offsetX;
        const y       = row * this.tileSize + this.offsetY;
        const centerX = x + this.tileSize / 2;
        const centerY = y + this.tileSize / 2;

        if (this.mazeLayout[row][col] === 0) {
          const wall = this.add.rectangle(centerX, centerY, this.tileSize, this.tileSize, WALL_FILL_COLOR);
          wall.setStrokeStyle(2, CYBER_CYAN, 1).setDepth(1);
          this.physics.add.existing(wall, true);
          this.topWalls.add(wall);
          wallGlowList.push({ centerX, centerY });
        } else {
          if (row === this.entrance.y && col === this.entrance.x) {
            const openSide = getInwardSide(row, col, size) || getOpenSide(this.mazeLayout, row, col);
            const startTile = this.add.rectangle(centerX, centerY, this.tileSize, this.tileSize, 0x110011, 0.6);
            startTile.setStrokeStyle(2, CYBER_CYAN, 1).setDepth(1);
            startGlowInfo = { centerX, centerY, openSide };
            startPos = { x: centerX, y: centerY };
          } else if (row === this.exit.y && col === this.exit.x) {
            const openSide = getInwardSide(row, col, size) || getOpenSide(this.mazeLayout, row, col);
            const exitTile = this.add.rectangle(centerX, centerY, this.tileSize, this.tileSize, 0x001100, 0.6);
            exitTile.setStrokeStyle(2, CYBER_CYAN, 1).setDepth(1);
            exitGlowInfo = { centerX, centerY, openSide };
            exitPos = { x: centerX, y: centerY };
          }
        }
      }
    }

    wallGlowList.forEach(({ centerX, centerY }) => {
      drawTileGlow(glowLayer, centerX, centerY, this.tileSize, CYBER_CYAN, null);
    });
    if (startGlowInfo) {
      drawTileGlow(glowLayer, startGlowInfo.centerX, startGlowInfo.centerY, this.tileSize, CYBER_MAGENTA, startGlowInfo.openSide);
    }
    if (exitGlowInfo) {
      drawTileGlow(glowLayer, exitGlowInfo.centerX, exitGlowInfo.centerY, this.tileSize, CYBER_GREEN, exitGlowInfo.openSide);
    }

    // ---------------------------------------------------
    // Player Setup
    // ---------------------------------------------------
    if (this.ant) this.ant.destroy();
    const spawn = this.restoreSnapshot?.player ? this.restoreSnapshot.player : startPos;

    const ballRadius = Math.max(12, Math.floor(this.tileSize * 0.25));
    this.ant = this.add.circle(spawn.x, spawn.y, ballRadius, BALL_COLOR).setDepth(3);
    this.ballRadius = ballRadius;

    this.physics.add.existing(this.ant, false);
    this.ant.body.setCircle(ballRadius);
    this.ant.body.setCollideWorldBounds(true);
    this.ant.body.setBounce(0);
    this.physics.add.collider(this.ant, this.topWalls, this.onWallHit, null, this);

    this.antGlow = this.add.graphics().setDepth(this.ant.depth - 1);
    this.events.on('update', () => {
      this.antGlow.clear();
      BALL_GLOW_WIDTHS.forEach((w, i) => {
        this.antGlow.lineStyle(w, BALL_GLOW_COLOR, BALL_GLOW_ALPHAS[i]);
        const r = this.ant.body?.radius || 10;
        this.antGlow.strokeCircle(this.ant.x, this.ant.y, r);
      });
    });

    // ---------------------------------------------------
    // Camera & Exit zone
    // ---------------------------------------------------
    this.cameras.main.startFollow(this.ant, true, 0.1, 0.1);
    const mobileZoom = IS_MOBILE_VIEW ? 0.6 : 1.1;
    this.cameras.main.setZoom(mobileZoom);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' });
    this.exitPos = { x: exitPos.x, y: exitPos.y };

    this.levelCleared = false;
    const exitZone    = this.add.zone(exitPos.x, exitPos.y, this.tileSize, this.tileSize);
    this.physics.add.existing(exitZone, true);
    this.physics.add.overlap(this.ant, exitZone, () => {
      if (!this.levelCleared && this.isPlayerFullyInsideExit()) {
        this.levelCleared = true;
        this.playExitEffect();
      }
    }, null, this);

    // ---------------------------------------------------
    // Orbs
    // ---------------------------------------------------
    this.energyGroup = this.physics.add.group();
    const rngForOrbs = mulberry32((this.rngSeed >>> 0) + 999);
    const orbsCount  = Math.max(3, 3 + Math.floor(this.currentLevel / 2));
    let placed = 0;

    while (placed < orbsCount) {
      const rx = Math.floor(rngForOrbs() * size);
      const ry = Math.floor(rngForOrbs() * size);

      if (this.mazeLayout[ry][rx] === 1 &&
          !(rx === this.entrance.x && ry === this.entrance.y)) {

        const px = rx * this.tileSize + this.tileSize / 2 + this.offsetX;
        const py = ry * this.tileSize + this.tileSize / 2 + this.offsetY;
        const orbRadius  = Math.max(6, Math.floor(this.tileSize * 0.18));
        const pulseRadius = Math.floor(orbRadius * 1.3);

        const orb = this.add.circle(px, py, orbRadius, ORB_FILL_COLOR)
          .setStrokeStyle(2, ORB_STROKE_COLOR, 1);

        this.physics.add.existing(orb);
        orb.body.setCircle(orbRadius);
        orb.body.setImmovable(true);
        this.energyGroup.add(orb);

        const pulse = this.add.circle(px, py, pulseRadius, ORB_FILL_COLOR, ORB_PULSE_OPACITY)
          .setDepth(orb.depth - 1);

        orb.pulse = pulse;
        orb.pulseTween = this.tweens.add({
          targets: pulse, scale: 1.8, alpha: 0, duration: 1200,
          ease: 'Sine.out', yoyo: false, repeat: -1,
          onRepeat: () => { pulse.setScale(1).setAlpha(ORB_PULSE_OPACITY); }
        });
        placed++;
      }
    }

    this.physics.add.overlap(this.ant, this.energyGroup, (ant, orb) => {
      if (orb.pulseTween) orb.pulseTween.stop();
      if (orb.pulse?.destroy) orb.pulse.destroy();
      const px = orb.x;
      const py = orb.y;
      orb.destroy();
      this.coins++;
      this.playOrbPickupEffect(px, py);
      const lang = window.getBaduzLang ? window.getBaduzLang() : 'en';
      const t    = window.baduzTranslations?.[lang] || {};
      this.showToast('+1 ' + (t.ORBS || 'Orb'), '#00ffff');
      this.updateHUD();
    }, null, this);

    // ---------------------------------------------------
    // Feature initialization (tier-based mechanics)
    // ---------------------------------------------------
    this.speedModifier = 1;
    this.lastMoveDir   = { x: 1, y: 0 };

    window.baduzRun    = window.baduzRun || { jumpCharges: 0 };
    this.jumpCharges   = window.baduzRun.jumpCharges || 0;
    this.jumpActiveUntil = 0;
    this.dashUntil     = 0;
    this.dashVec       = { x: 1, y: 0 };
    this.dashSpeed     = PLAYER_SPEED * 3;

    if (this.currentLevel >= 6  && this.currentLevel <= 10) this.setupKeyDoor(size);
    if (this.currentLevel >= 11 && this.currentLevel <= 15) this.setupZones(size);
    if (this.currentLevel >= 16 && this.currentLevel <= 20) {
      this.setupHazards(size);
      this.setupJumpPickups(size);
    }

    // ---------------------------------------------------
    // Timer & entrance blocker
    // ---------------------------------------------------
    this.antStartPos  = { x: startPos.x, y: startPos.y };
    this.timerStarted = false;
    this.startTime    = 0;
    this.hasLeftStart = false;
    this.startBlocker = null;

    {
      const gridX = this.entrance.x;
      const gridY = this.entrance.y;
      let outX = 0, outY = 0;

      if      (gridX === 0)        { outX = startPos.x - this.tileSize; outY = startPos.y; }
      else if (gridX === size - 1) { outX = startPos.x + this.tileSize; outY = startPos.y; }
      else if (gridY === 0)        { outX = startPos.x; outY = startPos.y - this.tileSize; }
      else if (gridY === size - 1) { outX = startPos.x; outY = startPos.y + this.tileSize; }

      if (outX !== 0 || outY !== 0) {
        const blocker = this.add.rectangle(outX, outY, this.tileSize, this.tileSize).setFillStyle(0xffffff, 0);
        this.physics.add.existing(blocker, true);
        this.startBlocker = blocker;
        blocker.body.enable = false;
        this.physics.add.collider(this.ant, blocker);
      }
    }

    // ---------------------------------------------------
    // Input & keyboard shortcuts
    // ---------------------------------------------------
    this.input.keyboard.on('keydown-P', this.togglePause, this);
    this.input.keyboard.on('keydown-R', () => {
      this.handleReset();
      this.showToast('Level Reset', CYBER_YELLOW);
    });
    this.input.keyboard.on('keydown-H', () => this.useHint());
    this.input.keyboard.on('keydown-J', () => this.handleJump());

    // Camera panning on drag
    this.isDraggingCamera = false;
    this.input.on('pointerdown', (pointer) => {
      const eventTarget = pointer.event?.target;
      if (eventTarget?.closest('.game-controls, .main-header, .modal, .quick-actions, .save-panel')) return;
      this.isDraggingCamera  = true;
      this.dragStartScreenX  = pointer.x;
      this.dragStartScreenY  = pointer.y;
      this.cameraStartX      = this.cameras.main.scrollX;
      this.cameraStartY      = this.cameras.main.scrollY;
      this.cameras.main.stopFollow();
    });
    this.input.on('pointermove', (pointer) => {
      if (!this.isDraggingCamera) return;
      const cam = this.cameras.main;
      const dx  = (pointer.x - this.dragStartScreenX) / (cam.zoom || 1);
      const dy  = (pointer.y - this.dragStartScreenY) / (cam.zoom || 1);
      cam.setScroll(this.cameraStartX - dx, this.cameraStartY - dy);
    });
    this.input.on('pointerup', () => { this.isDraggingCamera = false; });

    this.updateHUD();
    this.maybeShowTierIntro();
  }

  maybeShowTierIntro() {
    const lvl = this.currentLevel;
    let tierKey = null;
    if      (lvl === 1)  tierKey = 't1';
    else if (lvl === 6)  tierKey = 't2';
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

  // =======================================================
  // UPDATE LOOP
  // =======================================================
  update() {
    if (this.isGameOver || this.paused || this.introPaused) return;

    this.ant.body.setVelocity(0);

    // Check if player has left start
    if (!this.hasLeftStart) {
      const dx = Math.abs(this.ant.x - this.antStartPos.x);
      const dy = Math.abs(this.ant.y - this.antStartPos.y);
      if (dx > this.tileSize * 0.25 || dy > this.tileSize * 0.25) {
        this.hasLeftStart = true;
        if (this.startBlocker?.body) this.startBlocker.body.enable = true;
      }
    }

    // Movement input
    let vx = 0, vy = 0;
    const mInput = window.mobileInput;
    const analog = mInput?.analog;
    const mDir   = mInput?.dir;

    if (analog) {
      let ax = analog.x || 0;
      let ay = analog.y || 0;
      if (SNAP_8_DIR) {
        const angle     = Math.atan2(ay, ax);
        const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        ax = Math.cos(snapAngle);
        ay = Math.sin(snapAngle);
      }
      vx = ax; vy = ay;
    } else {
      const w = this.wasd;
      if (this.cursors.left.isDown  || w?.left?.isDown  || mDir === 'left')  vx -= 1;
      if (this.cursors.right.isDown || w?.right?.isDown || mDir === 'right') vx += 1;
      if (this.cursors.up.isDown    || w?.up?.isDown    || mDir === 'up')    vy -= 1;
      if (this.cursors.down.isDown  || w?.down?.isDown  || mDir === 'down')  vy += 1;
    }

    // Normalize diagonal movement
    if (vx !== 0 || vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      vx /= len; vy /= len;
    }
    if (vx !== 0 || vy !== 0) this.lastMoveDir = { x: vx, y: vy };

    // Zone speed modifier (levels 11-15)
    let speedMod = 1;
    const cellX  = Math.floor((this.ant.x - this.offsetX) / this.tileSize);
    const cellY  = Math.floor((this.ant.y - this.offsetY) / this.tileSize);
    if (this.currentLevel >= 11 && this.currentLevel <= 15 && this.zoneMap) {
      const zType = this.zoneMap[`${cellX},${cellY}`];
      speedMod = zType === 'slow' ? 0.2 : zType === 'ice' ? 5.5 : 1;
      this.speedModifier = speedMod;
    } else {
      this.speedModifier = 1;
    }

    // Dash override during Jump
    const now = Date.now();
    if (this.dashUntil && now < this.dashUntil) {
      vx = this.dashVec.x;
      vy = this.dashVec.y;
      speedMod = (this.dashSpeed || (PLAYER_SPEED * 3)) / PLAYER_SPEED;
    }

    // Hazard detection
    if (this.hazardMap && !(this.jumpActiveUntil && Date.now() < this.jumpActiveUntil)) {
      if (this.hazardMap[`${cellX},${cellY}`]) {
        this.onHazardHit();
        return;
      }
    }

    this.ant.body.setVelocity(vx * PLAYER_SPEED * speedMod, vy * PLAYER_SPEED * speedMod);

    // Start timer
    if (!this.timerStarted &&
        (Math.abs(this.ant.x - this.antStartPos.x) > 4 ||
         Math.abs(this.ant.y - this.antStartPos.y) > 4)) {
      this.startTime    = Date.now();
      this.timerStarted = true;
    }

    if (this.timerStarted) {
      const timerEl = document.getElementById('timer-display');
      if (timerEl) timerEl.textContent = this.formatTime(Date.now() - this.startTime);
    }

    // Wall bump detection
    const body = this.ant?.body;
    if (body) {
      const touchingWall =
        (body.blocked && (body.blocked.up || body.blocked.down || body.blocked.left || body.blocked.right)) ||
        (body.touching && (body.touching.up || body.touching.down || body.touching.left || body.touching.right));
      if (touchingWall && !this.wasTouchingWall) this.playWallBumpEffect();
      this.wasTouchingWall = touchingWall;
    }
  }

  // =======================================================
  // GAME MECHANICS
  // =======================================================
  togglePause() {
    if (!this.paused) {
      this.paused     = true;
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
          stroke: '#000', strokeThickness: 6,
          shadow: { offsetX: 0, offsetY: 0, color: `#${CYBER_GREEN.toString(16)}`, blur: 20, stroke: true }
        }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
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
    const hours   = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  useHint() {
    if (this.coins < HINT_COST) {
      this.showToast('Not enough orbs!', '#ffcc00');
      return;
    }
    this.coins -= HINT_COST;
    this.updateHUD();

    const path = findPath(
      this.mazeLayout,
      this.ant.x, this.ant.y,
      this.offsetX, this.offsetY,
      this.tileSize,
      this.exit
    );
    if (!path) {
      this.showToast('No path found!', '#ff0000');
      return;
    }

    for (let i = 0; i < HINT_GLOW_COLORS.length; i++) {
      const g = this.add.graphics();
      g.lineStyle(HINT_GLOW_WIDTHS[i], HINT_GLOW_COLORS[i], HINT_GLOW_ALPHAS[i]);
      g.beginPath();
      path.forEach((p, j) => {
        const x = p.x * this.tileSize + this.tileSize / 2 + this.offsetX;
        const y = p.y * this.tileSize + this.tileSize / 2 + this.offsetY;
        if (j === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.strokePath();
      this.tweens.add({ targets: g, alpha: 0, duration: 3000, onComplete: () => g.destroy() });
    }
    this.showToast('Hint used!', '#00ffff');
  }

  // =======================================================
  // EXTRA FEATURES (Tier mechanics)
  // =======================================================
  setupKeyDoor(size) {
    let doorGridX = this.exit.x;
    let doorGridY = this.exit.y;
    if      (this.exit.x === 0)        doorGridX = 1;
    else if (this.exit.x === size - 1) doorGridX = size - 2;
    else if (this.exit.y === 0)        doorGridY = 1;
    else if (this.exit.y === size - 1) doorGridY = size - 2;

    const doorCx = doorGridX * this.tileSize + this.tileSize / 2 + this.offsetX;
    const doorCy = doorGridY * this.tileSize + this.tileSize / 2 + this.offsetY;
    this.door = this.add.rectangle(doorCx, doorCy, this.tileSize, this.tileSize, 0x330000, 0.8)
      .setStrokeStyle(2, CYBER_RED, 1).setDepth(2);
    this.physics.add.existing(this.door, true);
    this.hasKey = false;

    this.doorCollider = this.physics.add.collider(this.ant, this.door, () => {
      if (this.hasKey) {
        if (this.doorCollider) this.doorCollider.destroy();
        if (this.door) this.door.destroy();
      } else {
        const lang = window.getBaduzLang ? window.getBaduzLang() : 'en';
        const t = window.baduzTranslations?.[lang] || {};
        this.showToast(t.needKey || 'Find the key!', '#ff0000');
      }
    }, null, this);

    let kx = 0, ky = 0, tries = 0;
    do {
      kx = Math.floor(Math.random() * size);
      ky = Math.floor(Math.random() * size);
      tries++;
      if (tries > 500) break;
    } while (
      this.mazeLayout[ky][kx] === 0 ||
      (kx === this.entrance.x && ky === this.entrance.y) ||
      (kx === this.exit.x    && ky === this.exit.y) ||
      (kx === doorGridX      && ky === doorGridY)
    );

    const keyCx    = kx * this.tileSize + this.tileSize / 2 + this.offsetX;
    const keyCy    = ky * this.tileSize + this.tileSize / 2 + this.offsetY;
    const keyRadius = Math.max(6, Math.floor(this.tileSize * 0.2));
    this.keyItem   = this.add.circle(keyCx, keyCy, keyRadius, 0xffdd00)
      .setStrokeStyle(2, 0xffaa00, 1).setDepth(2);
    this.physics.add.existing(this.keyItem);
    this.keyItem.body.setCircle(keyRadius);
    this.keyItem.body.setImmovable(true);
    this.physics.add.overlap(this.ant, this.keyItem, () => {
      this.hasKey = true;
      this.keyItem.destroy();
      const lang = window.getBaduzLang ? window.getBaduzLang() : 'en';
      const t    = window.baduzTranslations?.[lang] || {};
      this.showToast(t.keyCollected || 'Key collected!', '#ffff00');
      if (this.door) this.door.setFillStyle(0x003300, 0.8);
    }, null, this);
  }

  setupZones(size) {
    this.zoneMap = {};
    const zoneCount = Math.max(3, Math.floor(size / 4));
    for (let i = 0; i < zoneCount; i++) {
      let zx = 0, zy = 0, attempts = 0;
      do {
        zx = Math.floor(Math.random() * size);
        zy = Math.floor(Math.random() * size);
        attempts++;
        if (attempts > 500) break;
      } while (
        this.mazeLayout[zy][zx] === 0 ||
        (zx === this.entrance.x && zy === this.entrance.y) ||
        (zx === this.exit.x    && zy === this.exit.y)
      );
      const type    = (i % 2 === 0) ? 'slow' : 'ice';
      this.zoneMap[`${zx},${zy}`] = type;
      const cx = zx * this.tileSize + this.tileSize / 2 + this.offsetX;
      const cy = zy * this.tileSize + this.tileSize / 2 + this.offsetY;
      this.add.rectangle(cx, cy, this.tileSize, this.tileSize,
        type === 'slow' ? 0x004400 : 0x001144, 0.4)
        .setStrokeStyle(2, type === 'slow' ? 0x00aa00 : 0x0033aa, 0.8)
        .setDepth(0.5);
    }
  }

  setupHazards(size) {
    this.hazardMap = {};
    const protectedPath = computePathCells(this.mazeLayout, this.entrance, this.exit);
    const protectedSet  = new Set((protectedPath || []).map(p => `${p.x},${p.y}`));
    const hazardCount   = Math.max(3, Math.floor(size / 5));

    for (let i = 0; i < hazardCount; i++) {
      let hx = 0, hy = 0, attempts = 0;
      do {
        hx = Math.floor(Math.random() * size);
        hy = Math.floor(Math.random() * size);
        attempts++;
        if (attempts > 500) break;
      } while (
        this.mazeLayout[hy][hx] === 0 ||
        (hx === this.entrance.x && hy === this.entrance.y) ||
        (hx === this.exit.x    && hy === this.exit.y) ||
        protectedSet.has(`${hx},${hy}`)
      );
      this.hazardMap[`${hx},${hy}`] = true;
      const cx = hx * this.tileSize + this.tileSize / 2 + this.offsetX;
      const cy = hy * this.tileSize + this.tileSize / 2 + this.offsetY;
      this.add.rectangle(cx, cy, this.tileSize, this.tileSize, 0x550000, 0.5)
        .setStrokeStyle(2, 0xff0000, 0.9).setDepth(1);
    }
  }

  setupJumpPickups(size) {
    this.jumpGroup = this.physics.add.staticGroup();
    const count    = Math.max(1, Math.floor(size / 5));
    let placed = 0, attempts = 0;
    const forbidden = new Set([
      `${this.entrance.x},${this.entrance.y}`,
      `${this.exit.x},${this.exit.y}`
    ]);
    if (this.hazardMap) Object.keys(this.hazardMap).forEach(k => forbidden.add(k));

    while (placed < count && attempts < 2000) {
      attempts++;
      const gx = Math.floor(Math.random() * size);
      const gy = Math.floor(Math.random() * size);
      const k  = `${gx},${gy}`;
      if (forbidden.has(k) || this.mazeLayout[gy][gx] !== 1) continue;
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

  handleJump() {
    if (this.paused || this.introPaused) return;
    if (!this.jumpCharges || this.jumpCharges <= 0) {
      this.showToast('No Jump charges', '#c5c9d3');
      return;
    }
    this.jumpCharges -= 1;
    if (window.baduzRun) window.baduzRun.jumpCharges = this.jumpCharges;
    this.updateHUD();

    const start = Date.now();
    this.jumpActiveUntil = start + 280;

    const d = this.lastMoveDir || { x: 1, y: 0 };
    const len = Math.hypot(d.x, d.y) || 1;
    this.dashVec   = { x: d.x / len, y: d.y / len };
    this.dashSpeed = PLAYER_SPEED * 3.2;
    this.dashUntil = start + 180;

    this.cameras.main.shake(90, 0.004);
    this.cameras.main.zoomTo(1.05, 120);
    this.time.delayedCall(220, () => this.cameras.main.zoomTo(1.0, 160));

    const glow = this.add.circle(this.ant.x, this.ant.y, Math.max(12, this.tileSize * 0.28), CYBER_GRAY, 0.28);
    glow.setDepth(10);
    this.tweens.add({ targets: glow, alpha: 0, scale: 2.0, duration: 220, onComplete: () => glow.destroy() });
    this.tweens.add({ targets: this.ant, scaleX: 1.18, scaleY: 0.88, yoyo: true, duration: 120, ease: 'Sine.easeOut' });

    for (let i = 1; i <= 5; i++) {
      this.time.delayedCall(i * 25, () => {
        const g = this.add.circle(this.ant.x, this.ant.y, Math.max(3, this.tileSize * 0.12), CYBER_GRAY, 0.18);
        g.setDepth(5);
        this.tweens.add({ targets: g, alpha: 0, duration: 240, onComplete: () => g.destroy() });
      });
    }
  }

  // =======================================================
  // EFFECTS
  // =======================================================
  playOrbPickupEffect(x, y) {
    this.cameras.main.shake(120, 0.004);
    const count  = 8;
    const colors = [CYBER_GREEN, CYBER_CYAN, CYBER_YELLOW];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const dot   = this.add.circle(x, y, 2, colors[i % colors.length]);
      dot.setDepth(6);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * this.tileSize * 0.4,
        y: y + Math.sin(angle) * this.tileSize * 0.4,
        alpha: 0, duration: 300,
        onComplete: () => dot.destroy()
      });
    }
  }

  playWallBumpEffect() {
    this.cameras.main.shake(80, 0.002);
  }

  playExitEffect() {
    this.cameras.main.flash(120, 255, 255, 255);
    this.physics.pause();
    this.time.delayedCall(120, () => { this.physics.resume(); this.nextLevel(); });
  }

  onWallHit() {
    this.wallContacting = true;
  }

  onHazardHit() {
    const lang = window.getBaduzLang ? window.getBaduzLang() : 'en';
    const t    = window.baduzTranslations?.[lang] || {};
    this.showToast(t.hazard || 'Hazard!', '#ff0066');
    this.handleReset();
  }

  // =======================================================
  // RESET & LEVEL PROGRESSION
  // =======================================================
  handleReset() {
    this.scene.restart({
      currentLevel: this.currentLevel,
      totalTime:    this.totalTime,
      score:        this.score,
      coins:        this.coins,
      runSeed:      this.runSeed,
      rngSeed:      makeLevelSeed(this.runSeed, this.currentLevel)
    });
  }

  isPlayerFullyInsideExit() {
    if (!this.ant || !this.exitPos) return false;
    const r      = this.ant.body?.radius ?? this.ballRadius ?? 0;
    const half   = this.tileSize / 2;
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

    if (this.currentLevel > 20) {
      this.showGameCompletion();
      return;
    }

    this.isGameOver   = false;
    this.timerStarted = false;
    this.startTime    = 0;

    const timerEl = document.getElementById('timer-display');
    if (timerEl) timerEl.textContent = '00:00:00';

    this.scene.restart({
      currentLevel: this.currentLevel,
      totalTime:    this.totalTime,
      score:        this.score,
      coins:        this.coins,
      runSeed:      this.runSeed,
      rngSeed:      makeLevelSeed(this.runSeed, this.currentLevel)
    });
  }

  showGameCompletion() {
    this.isGameOver = true;
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(this.game.config.width / 2, this.game.config.height / 2);

    const totalSeconds  = Math.floor(this.totalTime / 1000);
    const hours         = Math.floor(totalSeconds / 3600);
    const minutes       = Math.floor((totalSeconds % 3600) / 60);
    const seconds       = totalSeconds % 60;
    const formattedTotal = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;
    const endContainer = this.add.container(cx, cy).setScrollFactor(0).setDepth(2000);

    const panelWidth  = 600;
    const panelHeight = 400;
    const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x000000, 0.9)
      .setStrokeStyle(4, CYBER_CYAN, 0.8);

    const title = this.add.text(0, -100,
      `DEMO COMPLETED!\nThank you for playing, ${PLAYER_NAME}!`,
      {
        fontSize: '40px', fill: `#${CYBER_MAGENTA.toString(16)}`,
        fontFamily: 'Orbitron, Arial', align: 'center',
        stroke: '#000', strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 0, color: `#${CYBER_MAGENTA.toString(16)}`, blur: 20, stroke: true }
      }
    ).setOrigin(0.5);

    const stats = this.add.text(0, 40,
      `Total Time: ${formattedTotal}\nFinal Score: ${this.score}`,
      {
        fontSize: '30px', fill: `#${CYBER_GREEN.toString(16)}`,
        fontFamily: 'Orbitron, Arial', stroke: '#000', strokeThickness: 3, align: 'center',
        shadow: { offsetX: 0, offsetY: 0, color: `#${CYBER_GREEN.toString(16)}`, blur: 15, stroke: true }
      }
    ).setOrigin(0.5);

    endContainer.add([panel, title, stats]);
    this.currentLevel = 21;
    this.physics.pause();
    this.ant.body.setVelocity(0);
  }

  // =======================================================
  // MAZE GENERATION
  // =======================================================
  generateMaze(level, rng) {
    const size = 5 + level * 2;
    const maze = Array(size).fill().map(() => Array(size).fill(0));
    this.generatePrimMaze(maze, rng);
    const [start, end] = this.placeEntranceExit(maze, rng);
    return { maze, entrance: { x: start.x, y: start.y }, exit: { x: end.x, y: end.y }, size };
  }

  generatePrimMaze(maze, rng) {
    const size  = maze.length;
    let walls   = [];
    const possibleCells = [];
    for (let y = 1; y < size - 1; y += 2)
      for (let x = 1; x < size - 1; x += 2)
        possibleCells.push({ x, y });

    const startCell = possibleCells[Math.floor(rng() * possibleCells.length)];
    maze[startCell.y][startCell.x] = 1;
    this.addWalls(startCell.x, startCell.y, maze, walls);

    while (walls.length > 0) {
      const randomIndex = Math.floor(rng() * walls.length);
      const wall        = walls.splice(randomIndex, 1)[0];
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
    const dirs = [{ dx: 0, dy: -2 }, { dx: 0, dy: 2 }, { dx: -2, dy: 0 }, { dx: 2, dy: 0 }];
    dirs.forEach((d) => {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && maze[ny][nx] === 0) {
        walls.push({ wx: x + d.dx / 2, wy: y + d.dy / 2, cx: nx, cy: ny });
      }
    });
  }

  placeEntranceExit(maze, rng) {
    const size        = maze.length;
    const isTopBottom = rng() < 0.5;
    let start, end;
    if (isTopBottom) {
      const odd = [];
      for (let x = 1; x < size - 1; x += 2) odd.push(x);
      const ex = odd[Math.floor(rng() * odd.length)];
      start = { x: ex, y: 0 };
      end   = { x: ex, y: size - 1 };
      maze[1][ex]          = 1;
      maze[size - 2][ex]   = 1;
    } else {
      const odd = [];
      for (let y = 1; y < size - 1; y += 2) odd.push(y);
      const ey = odd[Math.floor(rng() * odd.length)];
      start = { x: 0,        y: ey };
      end   = { x: size - 1, y: ey };
      maze[ey][1]          = 1;
      maze[ey][size - 2]   = 1;
    }
    maze[start.y][start.x] = 1;
    maze[end.y][end.x]     = 1;
    return [start, end];
  }
}

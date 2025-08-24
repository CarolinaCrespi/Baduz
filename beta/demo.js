// =========================
// RNG utilities
// =========================
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeLevelSeed(runSeed, level) {
  return (runSeed ^ (level * 2654435761)) >>> 0;
}

// =========================
/* Player Name */
// =========================
function getPlayerName() {
  let name = localStorage.getItem("baduz-player-name");
  if (!name) {
    name = prompt("Insert nickname:", "Guest") || "Guest";
    localStorage.setItem("baduz-player-name", name);
  }
  return name;
}
let PLAYER_NAME = getPlayerName();

function changePlayerName() {
  const newName = prompt("Insert new nickname:", PLAYER_NAME) || PLAYER_NAME;
  PLAYER_NAME = newName;
  localStorage.setItem("baduz-player-name", newName);
  const nameEl = document.getElementById("playerNameDisplay");
  if (nameEl) nameEl.firstChild.textContent = newName + " ";
}

// =========================
/* Save system (namespaced) */
// =========================
function saveKey() {
  return `baduz-save-v1:${PLAYER_NAME}`;
}
function saveGameSnapshot(state) {
  try {
    localStorage.setItem(saveKey(), JSON.stringify(state));
    return true;
  } catch (e) {
    console.error("Save failed", e);
    return false;
  }
}
function loadGameSnapshot() {
  try {
    const s = localStorage.getItem(saveKey());
    return s ? JSON.parse(s) : null;
  } catch (e) {
    console.error("Load failed", e);
    return null;
  }
}
function resetGameSnapshot() {
  localStorage.removeItem(saveKey());
}

// =========================
/* Score tuning */
// =========================
const SCORE_K = 5;
const SCORE_ALPHA = 1.0;
const SCORE_EPS = 1.0;
function computeLevelScore(level, elapsedMs) {
  const tSec = Math.max(0, elapsedMs / 1000);
  const raw = (SCORE_K * Math.pow(level, SCORE_ALPHA)) / (tSec + SCORE_EPS);
  return Math.max(1, Math.round(raw));
}

// =========================
/* Hint tuning / cost */
// =========================
const HINT_COST = 3; // Orbs required

// =========================
/* Maze Scene */
// =========================
class MazeScene extends Phaser.Scene {
  constructor() {
    super("MazeScene");
  }

  // ---------- HUD ----------
  updateHUD() {
    const levelEl = document.getElementById("levelDisplay");
    const timerEl = document.getElementById("timer-display");
    const scoreEl = document.getElementById("score");
    const nameEl = document.getElementById("playerNameDisplay");
    const orbsEl =
      document.getElementById("orbsDisplay") ||
      document.getElementById("energyDisplay");

    if (levelEl) levelEl.textContent = `${this.currentLevel}`;
    if (timerEl)
      timerEl.textContent = this.timerStarted
        ? this.formatTime(Date.now() - this.startTime)
        : "00:00:00";
    if (scoreEl) scoreEl.textContent = `${this.score}`.padStart(5, "0");
    if (nameEl) nameEl.firstChild.textContent = PLAYER_NAME + " ";
    if (orbsEl) orbsEl.textContent = `${this.coins}`;

    // --- HUD mobile (opzionale, se presenti in HTML) ---
    const mP = document.getElementById("mPlayer");
    const mS = document.getElementById("mScore");
    const mO = document.getElementById("mOrbs");
    const mT = document.getElementById("mTimer");
    if (mP) mP.textContent = PLAYER_NAME;
    if (mS) mS.textContent = `${this.score}`.padStart(5, "0");
    if (mO) mO.textContent = `${this.coins}`;
    if (mT)
      mT.textContent = this.timerStarted
        ? this.formatTime(Date.now() - this.startTime)
        : "00:00:00";
  }

  showToast(msg, color = "#00ff00") {
    if (this.toast) this.toast.destroy();
    this.toast = this.add
      .text(this.cameras.main.centerX, this.cameras.main.height - 40, msg, {
        fontSize: "16px",
        fill: color,
        fontFamily: "Arial",
        backgroundColor: "#000",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(2000);
    this.time.delayedCall(1200, () => {
      if (this.toast) this.toast.destroy();
    });
  }

  // ---------- Scene lifecycle ----------
  init(data) {
    this.currentLevel =
      data && data.currentLevel !== undefined ? data.currentLevel : 1;
    this.totalTime =
      data && data.totalTime !== undefined ? data.totalTime : 0;
    this.score = data && data.score !== undefined ? data.score : 0;
    this.coins = data && data.coins !== undefined ? data.coins : 0;
    this.isGameOver = false;
    this.paused = false;

    this.tileSize = 50;
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
      this.currentLevel =
        data.snapshot.currentLevel ?? this.currentLevel;
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

    this.physics.world.setBounds(
      0,
      0,
      size * this.tileSize,
      size * this.tileSize
    );
    this.topWalls = this.physics.add.staticGroup();

    // Disegno labirinto
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const x = col * this.tileSize;
        const y = row * this.tileSize;
        if (this.mazeLayout[row][col] === 0) {
          const wall = this.add.rectangle(
            x + this.tileSize / 2,
            y + this.tileSize / 2,
            this.tileSize,
            this.tileSize,
            0x000000
          );
          wall.setStrokeStyle(2, 0x00ffff);
          this.physics.add.existing(wall, true);
          this.topWalls.add(wall);
        } else {
          if (row === this.entrance.y && col === this.entrance.x) {
            startPos = {
              x: x + this.tileSize / 2,
              y: y + this.tileSize / 2,
            };
            this.add.text(x + 5, y + 5, "START", {
              fontSize: "13px",
              fill: "#00ff00",
              fontFamily: "Arial",
              stroke: "#000",
              strokeThickness: 2,
            });
          }
          if (row === this.exit.y && col === this.exit.x) {
            exitPos = {
              x: x + this.tileSize / 2,
              y: y + this.tileSize / 2,
            };
            this.add.text(x + 5, y + 5, "EXIT", {
              fontSize: "13px",
              fill: "#ff0000",
              fontFamily: "Arial",
              stroke: "#000",
              strokeThickness: 2,
            });
          }
        }
      }
    }

    // Player (Baduz) + glow
    if (this.ant) this.ant.destroy();
    const startFromSnapshot = this.restoreSnapshot && this.restoreSnapshot.player;
    const spawn = startFromSnapshot ? this.restoreSnapshot.player : startPos;
    const BALL_COLOR = 0xff00ff;

    this.ant = this.add.circle(spawn.x, spawn.y, 10, BALL_COLOR);
    this.physics.add.existing(this.ant, false);
    this.ant.body.setCircle(10);
    this.ant.body.setCollideWorldBounds(true);
    this.ant.body.setBounce(0);
    this.physics.add.collider(this.ant, this.topWalls);

    const GLOW_COLOR = 0xff99ff;
    const glowWidths = [10, 5, 2];
    const glowAlphas = [0.15, 0.35, 0.8];
    this.antGlow = this.add.graphics();
    this.events.on("update", () => {
      this.antGlow.clear();
      glowWidths.forEach((w, i) => {
        this.antGlow.lineStyle(w, GLOW_COLOR, glowAlphas[i]);
        this.antGlow.strokeCircle(this.ant.x, this.ant.y, 10);
      });
    });

    // Camera, input, goal
    this.cameras.main.startFollow(this.ant, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
    this.cursors = this.input.keyboard.createCursorKeys();

    const exitZone = this.add.zone(
      exitPos.x,
      exitPos.y,
      this.tileSize,
      this.tileSize
    );
    this.physics.add.existing(exitZone, true);
    this.physics.add.overlap(this.ant, exitZone, this.nextLevel, null, this);

    // Orbs (collectibles)
    this.energyGroup = this.physics.add.group();
    const rngForOrbs = mulberry32((this.rngSeed >>> 0) + 999);
    const orbsCount = Math.max(3, 3 + Math.floor(this.currentLevel / 2));
    let placed = 0;
    while (placed < orbsCount) {
      const rx = Math.floor(rngForOrbs() * size);
      const ry = Math.floor(rngForOrbs() * size);
      if (
        this.mazeLayout[ry][rx] === 1 &&
        !(rx === this.entrance.x && ry === this.entrance.y)
      ) {
        const px = rx * this.tileSize + this.tileSize / 2;
        const py = ry * this.tileSize + this.tileSize / 2;

        const FILL_COLOR = 0x00ff66;
        const STROKE_COLOR = 0x33ffaa;
        const orb = this.add.circle(px, py, 6, FILL_COLOR);
        orb.setStrokeStyle(2, STROKE_COLOR, 1);

        this.physics.add.existing(orb);
        orb.body.setCircle(6);
        orb.body.setImmovable(true);
        this.energyGroup.add(orb);

        // Pulse "breathing"
        const pulse = this.add.circle(px, py, 8, FILL_COLOR, 0.25);
        pulse.setDepth(orb.depth - 1);
        orb.pulse = pulse;
        orb.pulseTween = this.tweens.add({
          targets: pulse,
          scale: 1.8,
          alpha: 0,
          duration: 1200,
          ease: "Sine.out",
          yoyo: false,
          repeat: -1,
          onRepeat: () => {
            pulse.setScale(1);
            pulse.setAlpha(0.25);
          },
        });

        placed++;
      }
    }
    this.physics.add.overlap(
      this.ant,
      this.energyGroup,
      (ant, orb) => {
        if (orb.pulseTween) {
          orb.pulseTween.stop();
        }
        if (orb.pulse && orb.pulse.destroy) {
          orb.pulse.destroy();
        }
        orb.destroy();
        this.coins++;
        this.showToast("+1 Orb", "#00ffff");
        this.updateHUD();
      },
      null,
      this
    );

    // Timer
    this.antStartPos = { x: startPos.x, y: startPos.y };
    this.timerStarted = false;
    this.startTime = 0;

    // Shortcuts
    this.input.keyboard.on("keydown-P", this.togglePause, this);
    this.input.keyboard.on("keydown-S", () => {
      this.handleSave();
      this.showToast("Saved");
    });
    this.input.keyboard.on("keydown-L", () => {
      this.handleLoad();
      this.showToast("Loaded");
    });
    this.input.keyboard.on("keydown-R", () => {
      this.handleReset();
      this.showToast("Level reset");
    });
    this.input.keyboard.on("keydown-H", () => {
      this.useHint();
    });

    // Bottoni UI desktop
    const withBtn = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", () => fn.call(this));
    };
    withBtn("btnSave", function () {
      this.handleSave();
      this.showToast("Saved");
    });
    withBtn("btnLoad", function () {
      this.handleLoad();
      this.showToast("Loaded");
    });
    withBtn("btnReset", function () {
      this.handleReset();
      this.showToast("Level reset");
    });
    withBtn("btnHint", function () {
      this.useHint();
    });

    // Bottoni UI mobile (se esistono)
    withBtn("btnSaveM", function () {
      this.handleSave();
      this.showToast("Saved");
    });
    withBtn("btnLoadM", function () {
      this.handleLoad();
      this.showToast("Loaded");
    });
    withBtn("btnResetM", function () {
      this.handleReset();
      this.showToast("Level reset");
    });
    withBtn("btnHintM", function () {
      this.useHint();
    });

    // Cambia nome
    const btnChange = document.getElementById("btnChangeName");
    if (btnChange)
      btnChange.addEventListener("click", () => {
        changePlayerName();
        this.updateHUD();
      });

    // Joystick (mobile)
    this.hookJoystick();

    this.updateHUD();
  }

  // ---------- Joystick handlers ----------
  hookJoystick() {
    const root = document.getElementById("joystick");
    if (!root) return;

    this.mobileDir = { up: false, down: false, left: false, right: false };

    const setDir = (dir, val) => {
      this.mobileDir[dir] = val;
    };

    // supporta sia .btn-up/.btn-left/... che .up/.left/... e .joy.up
    const pick = (sel) =>
      root.querySelector(
        `${sel}, .joy${sel}, .btn-${sel.replace(".", "")}, .${sel.replace(
          ".",
          ""
        )}`
      ) || root.querySelector(sel);

    const bindOne = (selector, dir) => {
      const el =
        root.querySelector(selector) ||
        pick(selector); // prova alternative
      if (!el) return;

      const onDown = (e) => {
        e.preventDefault();
        setDir(dir, true);
      };
      const onUp = (e) => {
        e.preventDefault();
        setDir(dir, false);
      };

      const add = (ev, fn, opts) =>
        el.addEventListener(ev, fn, opts || { passive: false });

      ["pointerdown", "touchstart", "mousedown"].forEach((ev) =>
        add(ev, onDown)
      );
      ["pointerup", "touchend", "mouseup", "pointerleave", "touchcancel"].forEach(
        (ev) => add(ev, onUp)
      );
    };

    bindOne(".btn-up", "up");
    bindOne(".btn-down", "down");
    bindOne(".btn-left", "left");
    bindOne(".btn-right", "right");

    // fallback per markup tipo ".up/.down/..."
    bindOne(".up", "up");
    bindOne(".down", "down");
    bindOne(".left", "left");
    bindOne(".right", "right");
  }

  // ---------- Update loop ----------
  update() {
    if (this.isGameOver || this.paused) return;

    const left =
      this.cursors.left.isDown || (this.mobileDir && this.mobileDir.left);
    const right =
      this.cursors.right.isDown || (this.mobileDir && this.mobileDir.right);
    const up =
      this.cursors.up.isDown || (this.mobileDir && this.mobileDir.up);
    const down =
      this.cursors.down.isDown || (this.mobileDir && this.mobileDir.down);

    this.ant.body.setVelocity(0);
    if (left) this.ant.body.setVelocityX(-200);
    if (right) this.ant.body.setVelocityX(200);
    if (up) this.ant.body.setVelocityY(-200);
    if (down) this.ant.body.setVelocityY(200);

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
      const timerEl = document.getElementById("timer-display");
      if (timerEl)
        timerEl.textContent = this.formatTime(Date.now() - this.startTime);
      const mT = document.getElementById("mTimer");
      if (mT) mT.textContent = this.formatTime(Date.now() - this.startTime);
    }
  }

  // ---------- Pause ----------
  togglePause() {
    if (!this.paused) {
      this.paused = true;
      this.pauseStart = Date.now();
      this.physics.pause();
      if (this.pauseText) this.pauseText.destroy();
      this.pauseText = this.add
        .text(this.cameras.main.width / 2, this.cameras.main.height / 2, "PAUSE", {
          fontSize: "100px",
          fill: "#00ff00",
          fontFamily: "Arial",
          stroke: "#000",
          strokeThickness: 2,
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

  // ---------- Utils ----------
  formatTime(elapsedMilliseconds) {
    const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  // ---------- Hint ----------
  useHint() {
    if (this.coins < HINT_COST) {
      this.showToast("Not enough orbs!", "#ffcc00");
      return;
    }
    this.coins -= HINT_COST;
    this.updateHUD();

    const path = this.findPath();
    if (!path) {
      this.showToast("No path found!", "#ff0000");
      return;
    }

    const glowColors = [0x33ffaa, 0x00ff66, 0x00ff66];
    const glowWidths = [10, 6, 3];
    const glowAlphas = [0.15, 0.35, 0.9];

    for (let i = 0; i < glowColors.length; i++) {
      const g = this.add.graphics();
      g.lineStyle(glowWidths[i], glowColors[i], glowAlphas[i]);
      g.beginPath();
      path.forEach((p, j) => {
        const x = p.x * this.tileSize + this.tileSize / 2;
        const y = p.y * this.tileSize + this.tileSize / 2;
        if (j === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.strokePath();

      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: 3000,
        onComplete: () => g.destroy(),
      });
    }

    this.showToast("Hint used!", "#00ffff");
  }

  findPath() {
    const size = this.mazeLayout.length;
    const start = {
      x: Math.floor(this.ant.x / this.tileSize),
      y: Math.floor(this.ant.y / this.tileSize),
    };
    const end = this.exit;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
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

  // ---------- Save/Load/Reset ----------
  getSnapshot(full = false) {
    const elapsed = this.timerStarted ? Date.now() - this.startTime : 0;
    const base = {
      currentLevel: this.currentLevel,
      totalTime: this.totalTime + elapsed,
      score: this.score,
      coins: this.coins,
      runSeed: this.runSeed,
      rngSeed: this.rngSeed,
      playerName: PLAYER_NAME,
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
      this.showToast("No save found", "#ffcc00");
      return;
    }
    this.scene.stop("MazeScene");
    this.scene.start("MazeScene", { snapshot: snap });
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
      playerName: PLAYER_NAME,
    });
    this.scene.restart({
      currentLevel: sameLevel,
      totalTime: this.totalTime,
      score: this.score,
      coins: this.coins,
      runSeed: sameRunSeed,
      rngSeed: sameLevelSeed,
      snapshot: null,
    });
  }

  // ---------- Next Level / End screen ----------
  nextLevel() {
    let levelTime = 0;
    if (this.timerStarted) {
      levelTime = Date.now() - this.startTime;
      this.totalTime += levelTime;
    }
    const gain = computeLevelScore(this.currentLevel, levelTime);
    this.score += gain;
    this.showToast(`+${gain} pts`, "#00ff00");
    this.updateHUD();

    this.currentLevel++;
    saveGameSnapshot({
      currentLevel: this.currentLevel,
      totalTime: this.totalTime,
      score: this.score,
      coins: this.coins,
      runSeed: this.runSeed,
      rngSeed: makeLevelSeed(this.runSeed, this.currentLevel),
      playerName: PLAYER_NAME,
    });

    // Demo fino a 20
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
      const formattedTotal = `${hours
        .toString()
        .padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      const cx = this.cameras.main.centerX;
      const cy = this.cameras.main.centerY;
      const endContainer = this.add
        .container(cx, cy)
        .setScrollFactor(0)
        .setDepth(2000);

      const title = this.add
        .text(
          0,
          -35,
          `DEMO COMPLETED!\nThank you for playing, ${PLAYER_NAME}!`,
          { fontSize: "40px", fill: "#ffffff", fontFamily: "Arial", align: "center" }
        )
        .setOrigin(0.5);

      const stats = this.add
        .text(0, 60, `Total Time: ${formattedTotal}\nScore: ${this.score}`, {
          fontSize: "24px",
          fill: "#00ff00",
          fontFamily: "Arial",
          stroke: "#000",
          strokeThickness: 2,
          align: "center",
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

    // Restart per livello successivo
    this.isGameOver = false;
    this.timerStarted = false;
    this.startTime = 0;
    const timerEl = document.getElementById("timer-display");
    if (timerEl) timerEl.textContent = "00:00:00";

    this.scene.restart({
      currentLevel: this.currentLevel,
      totalTime: this.totalTime,
      score: this.score,
      coins: this.coins,
      runSeed: this.runSeed,
      rngSeed: makeLevelSeed(this.runSeed, this.currentLevel),
    });
  }

  // ---------- Maze generation ----------
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
      size,
    };
  }

  generatePrimMaze(maze, rng) {
    const size = maze.length;
    let walls = [];
    const possible = [];
    for (let y = 1; y < size - 1; y += 2) {
      for (let x = 1; x < size - 1; x += 2) {
        possible.push({ x, y });
      }
    }
    const startCell = possible[Math.floor(rng() * possible.length)];
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
      { dx: 2, dy: 0 },
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

// =========================
/* Phaser config & boot */
// =========================
const config = {
  type: Phaser.CANVAS,
  width: 1000,
  height: 700,
  canvas: document.getElementById("gameCanvas"),
  transparent: true,
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: MazeScene,
};
const game = new Phaser.Game(config);

// Autosave on exit
window.addEventListener("beforeunload", () => {
  const scene = game?.scene?.keys?.["MazeScene"];
  if (scene) saveGameSnapshot(scene.getSnapshot(true));
});

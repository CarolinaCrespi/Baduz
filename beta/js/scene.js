import { getPlayerName, changePlayerName, saveGameSnapshot, loadGameSnapshot } from './storage.js';
import { mulberry32, makeLevelSeed } from './rng.js';
import { computeLevelScore, HINT_COST } from './scoring.js';
import { generateMaze } from './maze-gen.js';

const TILE_SIZE   = 50;
const PLAYER_SPEED = 200;
const MAX_LEVEL   = 20;   // demo cap centralizzato

export default class MazeScene extends Phaser.Scene{
  constructor(){ super('MazeScene'); }

  init(data){
    this.currentLevel = (data && data.currentLevel != null) ? data.currentLevel : 1;
    this.totalTime    = (data && data.totalTime    != null) ? data.totalTime    : 0;
    this.score        = (data && data.score        != null) ? data.score        : 0;
    this.coins        = (data && data.coins        != null) ? data.coins        : 0;
    this.isGameOver   = false; 
    this.paused       = false;

    this.tileSize     = TILE_SIZE;
    this.mazeLayout   = [];
    this.timerStarted = false; 
    this.startTime    = 0;
    this.antStartPos  = { x: 0, y: 0 };

    this._pathCache   = null;   // { key: "cx,cy", path: [...] }
    this._hintLock    = false;  // cooldown anti‑spam

    this.playerName = getPlayerName();

    if (data && data.snapshot){
      this.restoreSnapshot = data.snapshot;
      this.runSeed   = data.snapshot.runSeed ?? (Date.now() >>> 0);
      this.rngSeed   = data.snapshot.rngSeed ?? makeLevelSeed(this.runSeed, data.snapshot.currentLevel || 1);
      this.currentLevel = data.snapshot.currentLevel ?? this.currentLevel;
      this.totalTime    = data.snapshot.totalTime    ?? this.totalTime;
      this.score        = data.snapshot.score        ?? this.score;
      this.coins        = data.snapshot.coins        ?? this.coins;
    } else {
      this.restoreSnapshot = null;
      this.runSeed = (data && data.runSeed) ? data.runSeed : (Date.now() >>> 0);
      this.rngSeed = (data && data.rngSeed != null) ? data.rngSeed : makeLevelSeed(this.runSeed, this.currentLevel);
    }

    // cleanup garantito: ferma tween/pulse degli orbs allo shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, ()=>{
      if (this.energyGroup?.children) {
        this.energyGroup.children.each(o=>{
          if (o.pulseTween) o.pulseTween.stop();
        });
      }
    });
  }

  create(){
    let size, startPos={x:0,y:0}, exitPos={x:0,y:0};

    if (this.restoreSnapshot?.mazeLayout && this.restoreSnapshot?.entrance && this.restoreSnapshot?.exit){
      this.mazeLayout = this.restoreSnapshot.mazeLayout;
      this.entrance   = this.restoreSnapshot.entrance;
      this.exit       = this.restoreSnapshot.exit;
      size = this.mazeLayout.length;
    } else {
      const data = generateMaze(this.currentLevel, this.rngSeed);
      this.mazeLayout = data.maze; this.entrance = data.entrance; this.exit = data.exit; size = data.size;
    }

    this.physics.world.setBounds(0,0, size*this.tileSize, size*this.tileSize);
    this.topWalls = this.physics.add.staticGroup();

    // === COSTRUZIONE MURI: merge per riga per ridurre il numero di bodies ===
    this._buildMergedWalls(this.mazeLayout, this.tileSize, this.topWalls);

    // START/EXIT label (dopo aver disegnato i muri)
    for (let r=0; r<size; r++){
      for (let c=0; c<size; c++){
        const x=c*this.tileSize, y=r*this.tileSize;
        if (r===this.entrance.y && c===this.entrance.x){
          startPos = { x:x+this.tileSize/2, y:y+this.tileSize/2 };
          this.add.text(x+5,y+5,'START',{ fontSize:'13px', fill:'#00ff00', fontFamily:'Arial', stroke:'#000', strokeThickness:2 });
        }
        if (r===this.exit.y && c===this.exit.x){
          exitPos = { x:x+this.tileSize/2, y:y+this.tileSize/2 };
          this.add.text(x+5,y+5,'EXIT',{ fontSize:'13px', fill:'#ff0000', fontFamily:'Arial', stroke:'#000', strokeThickness:2 });
        }
      }
    }

    // Player
    if (this.ant) this.ant.destroy();
    const spawn = (this.restoreSnapshot && this.restoreSnapshot.player) ? this.restoreSnapshot.player : startPos;
    this.ant = this.add.circle(spawn.x, spawn.y, 10, 0xff00ff);
    this.physics.add.existing(this.ant, false);
    this.ant.body.setCircle(10);
    this.ant.body.setCollideWorldBounds(true);
    this.physics.add.collider(this.ant, this.topWalls);

    // glow costante attorno al player
    const GLOW_COLOR = 0xff99ff, widths=[10,5,2], alphas=[0.15,0.35,0.8];
    this.antGlow = this.add.graphics();
    this.events.on('update', ()=>{
      this.antGlow.clear();
      widths.forEach((w,i)=>{ 
        this.antGlow.lineStyle(w, GLOW_COLOR, alphas[i]); 
        this.antGlow.strokeCircle(this.ant.x, this.ant.y, 10); 
      });
    });

    // camera & input
    this.cameras.main.startFollow(this.ant, true, 0.1, 0.1);
    this.cursors = this.input.keyboard.createCursorKeys();

    // exit trigger
    const exitZone = this.add.zone(exitPos.x, exitPos.y, this.tileSize, this.tileSize);
    this.physics.add.existing(exitZone, true);
    this.physics.add.overlap(this.ant, exitZone, this.nextLevel, null, this);

    // === ORBS con alone “breathing” ===
    this.energyGroup = this.physics.add.group();
    const rng = mulberry32((this.rngSeed>>>0) + 999);
    const orbsCount = Math.max(3, 3 + Math.floor(this.currentLevel / 2));
    let placed = 0;

    while (placed < orbsCount){
      const rx = Math.floor(rng() * size);
      const ry = Math.floor(rng() * size);

      if (this.mazeLayout[ry][rx] === 1 && !(rx === this.entrance.x && ry === this.entrance.y)){
        const px = rx * this.tileSize + this.tileSize/2;
        const py = ry * this.tileSize + this.tileSize/2;

        const FILL_COLOR   = 0x00ff66;
        const STROKE_COLOR = 0x33ffaa;

        const orb = this.add.circle(px, py, 6, FILL_COLOR);
        orb.setStrokeStyle(2, STROKE_COLOR, 1);
        orb.setDepth(10);

        this.physics.add.existing(orb);
        orb.body.setCircle(6);
        orb.body.setImmovable(true);
        this.energyGroup.add(orb);

        // alone pulsante dietro l’orb
        const pulse = this.add.circle(px, py, 8, FILL_COLOR, 0.25);
        pulse.setDepth(orb.depth - 1);
        orb.pulse = pulse;

        orb.pulseTween = this.tweens.add({
          targets: pulse,
          scale: 1.8,
          alpha: 0,
          duration: 1200,
          ease: 'Sine.out',
          yoyo: false,
          repeat: -1,
          onRepeat: () => { pulse.setScale(1); pulse.setAlpha(0.25); }
        });

        placed++;
      }
    }

    this.physics.add.overlap(this.ant, this.energyGroup, (_ant, orb) => {
      if (orb.pulseTween) { orb.pulseTween.stop(); }
      if (orb.pulse && orb.pulse.destroy) { orb.pulse.destroy(); }
      orb.destroy();
      this.coins++;
      this.showToast('+1 Orb', '#00ffff');
      this.updateHUD();
    }, null, this);

    // timer
    this.antStartPos = { x:startPos.x, y:startPos.y };
    this.timerStarted=false; this.startTime=0;

    // shortcuts & UI
    this.input.keyboard.on('keydown-P', this.togglePause, this);
    this.input.keyboard.on('keydown-S', ()=>{ this.handleSave();  this.showToast('Saved');  });
    this.input.keyboard.on('keydown-L', ()=>{ this.handleLoad();  this.showToast('Loaded'); });
    this.input.keyboard.on('keydown-R', ()=>{ this.handleReset(); this.showToast('Level reset'); });
    this.input.keyboard.on('keydown-H', ()=>{ this.useHint(); });

    const on = (id, fn)=>{ const el=document.getElementById(id); if (el) el.addEventListener('click', ()=>fn.call(this)); };
    on('btnSave', this.handleSave); on('btnLoad', this.handleLoad); on('btnReset', this.handleReset); on('btnHint', this.useHint);

    const btnChange = document.getElementById('btnChangeName');
    if (btnChange) btnChange.addEventListener('click', ()=>{ changePlayerName(); this.updateHUD(); });

    this.updateHUD();
  }

  // ===== helper: muri merged per riga =====
  _buildMergedWalls(maze, tile, group){
    const size = maze.length;
    for (let r = 0; r < size; r++){
      let c = 0;
      while (c < size){
        if (maze[r][c] === 0){ // muro
          let c2 = c;
          while (c2 < size && maze[r][c2] === 0) c2++;
          const w = (c2 - c) * tile, h = tile;
          const x = c * tile + w/2, y = r * tile + h/2;
          const wall = this.add.rectangle(x, y, w, h, 0x000000).setStrokeStyle(2, 0x00FFFF);
          this.physics.add.existing(wall, true);
          group.add(wall);
          c = c2;
        } else {
          c++;
        }
      }
    }
  }

  update(){
    if (this.isGameOver || this.paused) return;

    // === movimento con normalizzazione diagonale ===
    const L=this.cursors.left.isDown, R=this.cursors.right.isDown, U=this.cursors.up.isDown, D=this.cursors.down.isDown;

    let vx = 0, vy = 0;
    if (L) vx -= 1; if (R) vx += 1;
    if (U) vy -= 1; if (D) vy += 1;

    if (vx || vy){
      const inv = 1 / Math.hypot(vx, vy);
      this.ant.body.setVelocity(vx * PLAYER_SPEED * inv, vy * PLAYER_SPEED * inv);
    } else {
      this.ant.body.setVelocity(0,0);
    }

    // start timer al primo movimento "vero"
    if (!this.timerStarted){
      if (Math.abs(this.ant.x-this.antStartPos.x)>4 || Math.abs(this.ant.y-this.antStartPos.y)>4){
        this.startTime = Date.now(); this.timerStarted = true;
      }
    }
    if (this.timerStarted){
      const t = this.formatTime(Date.now()-this.startTime);
      const timerEl = document.getElementById('timer-display'); if (timerEl) timerEl.textContent = t;
    }

    // invalida cache hint quando cambia cella
    const cx = Math.floor(this.ant.x / this.tileSize);
    const cy = Math.floor(this.ant.y / this.tileSize);
    const cacheKey = `${cx},${cy}`;
    if (this._pathCache && this._pathCache.key !== cacheKey){
      this._pathCache = null;
    }
  }

  updateHUD(){
    const levelEl = document.getElementById('levelDisplay');
    const scoreEl = document.getElementById('score');
    const nameEl  = document.getElementById('playerNameDisplay');
    const orbsEl  = document.getElementById('orbsDisplay') || document.getElementById('energyDisplay');
    const timerEl = document.getElementById('timer-display');

    if (levelEl) levelEl.textContent = `${this.currentLevel}`;
    if (scoreEl) scoreEl.textContent = `${this.score}`.padStart(5,'0');
    if (nameEl && nameEl.firstChild)  nameEl.firstChild.textContent = (getPlayerName() + " ");
    if (orbsEl)  orbsEl.textContent = String(this.coins);
    if (timerEl) timerEl.textContent = this.timerStarted
      ? this.formatTime(Date.now() - this.startTime)
      : '00:00:00';
  }

  showToast(msg, color='#00ff00'){
    if (this.toast) this.toast.destroy();
    this.toast = this.add.text(this.cameras.main.centerX, 40, msg,
      { fontSize:'18px', fill:color, fontFamily:'Arial', backgroundColor:'#000', padding:{x:10,y:6} }
    ).setOrigin(0.5,0).setScrollFactor(0).setDepth(2000);
    this.time.delayedCall(1200, ()=>{ if (this.toast) this.toast.destroy(); });
  }

  togglePause(){
    if (!this.paused){
      this.paused=true; this.pauseStart=Date.now(); this.physics.pause();
      if (this.pauseText) this.pauseText.destroy();
      this.pauseText = this.add.text(this.cameras.main.width/2, this.cameras.main.height/2, "PAUSE",
        { fontSize:'100px', fill:'#00ff00', fontFamily:'Arial', stroke:'#000', strokeThickness:2 }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
    } else {
      this.paused=false; const dt=Date.now()-this.pauseStart; if (this.timerStarted) this.startTime += dt;
      this.physics.resume(); if (this.pauseText) this.pauseText.destroy();
    }
  }

  formatTime(ms){
    const s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), ss=s%60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}`;
  }

  findPath(){
    const size  = this.mazeLayout.length;
    const start = {
      x: Math.floor(this.ant.x / this.tileSize),
      y: Math.floor(this.ant.y / this.tileSize)
    };
    const end   = this.exit;            
    const dirs  = [[1,0],[-1,0],[0,1],[0,-1]];

    const key = (x,y)=> `${x},${y}`;
    const q = [start];
    const seen = new Set([key(start.x, start.y)]);
    const prev = {};

    while (q.length){
      const c = q.shift();
      if (c.x === end.x && c.y === end.y){
        const path = [];
        let cur = c;
        while (cur){
          path.unshift(cur);
          cur = prev[key(cur.x, cur.y)];
        }
        return path;
      }
      for (const [dx,dy] of dirs){
        const nx = c.x + dx, ny = c.y + dy;
        if (nx>=0 && ny>=0 && nx<size && ny<size &&
            this.mazeLayout[ny][nx] === 1 && !seen.has(key(nx,ny))){
          seen.add(key(nx,ny));
          prev[key(nx,ny)] = c;
          q.push({x:nx, y:ny});
        }
      }
    }
    return null; 
  }

  _drawGlowingPath(path){
    const glowColors = [0x33ffaa, 0x00ff66, 0x00ff66];
    const glowWidths = [10, 6, 3];
    const glowAlphas = [0.15, 0.35, 0.9];

    for (let i = 0; i < glowColors.length; i++){
      const g = this.add.graphics();
      g.lineStyle(glowWidths[i], glowColors[i], glowAlphas[i]);
      g.beginPath();
      path.forEach((p, j) => {
        const x = p.x * this.tileSize + this.tileSize/2;
        const y = p.y * this.tileSize + this.tileSize/2;
        if (j === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.strokePath();
      this.tweens.add({ targets: g, alpha: 0, duration: 3000, onComplete: () => g.destroy() });
    }
  }

  useHint(){
    if (this._hintLock) return;               // cooldown
    this._hintLock = true; this.time.delayedCall(1000, ()=> this._hintLock=false);

    if (this.coins < HINT_COST){
      this.showToast("Not enough orbs!", "#ffcc00");
      return;
    }

    const cx = Math.floor(this.ant.x / this.tileSize);
    const cy = Math.floor(this.ant.y / this.tileSize);
    const cacheKey = `${cx},${cy}`;

    let path = null;
    if (this._pathCache && this._pathCache.key === cacheKey){
      path = this._pathCache.path;
    } else {
      path = this.findPath();
      if (!path){ this.showToast("No path found!", "#ff4444"); return; }
      this._pathCache = { key: cacheKey, path };
    }

    this.coins = Math.max(0, this.coins - HINT_COST);
    this.updateHUD();

    this._drawGlowingPath(path);
    this.showToast("Hint used!", "#00ffff");
  }

  getSnapshot(full=false){
    const elapsed = this.timerStarted ? (Date.now()-this.startTime) : 0;
    const base = { currentLevel:this.currentLevel, totalTime:this.totalTime+elapsed, score:this.score, coins:this.coins,
                   runSeed:this.runSeed, rngSeed:this.rngSeed, playerName:getPlayerName() };
    if (full){ base.mazeLayout=this.mazeLayout; base.entrance=this.entrance; base.exit=this.exit;
               if (this.ant) base.player={x:this.ant.x,y:this.ant.y}; }
    return base;
  }

  handleSave(){ saveGameSnapshot(this.getSnapshot(true)); }
  handleLoad(){
    const snap = loadGameSnapshot();
    if (!snap){ this.showToast('No save found','#ffcc00'); return; }
    this.scene.stop('MazeScene'); this.scene.start('MazeScene', { snapshot:snap });
  }
  handleReset(){
    const same=this.currentLevel, rs=this.runSeed, ls=makeLevelSeed(rs, same);
    saveGameSnapshot({ currentLevel:same, totalTime:this.totalTime, score:this.score, coins:this.coins,
                       runSeed:rs, rngSeed:ls, playerName:getPlayerName() });
    this.scene.restart({ currentLevel:same, totalTime:this.totalTime, score:this.score, coins:this.coins,
                         runSeed:rs, rngSeed:ls, snapshot:null });
  }

  nextLevel(){
    let levelTime=0; if (this.timerStarted){ levelTime=Date.now()-this.startTime; this.totalTime += levelTime; }
    const gain = computeLevelScore(this.currentLevel, levelTime);
    this.score += gain; this.showToast(`+${gain} pts`, '#00ff00'); this.updateHUD();

    this.currentLevel++;
    saveGameSnapshot({ currentLevel:this.currentLevel, totalTime:this.totalTime, score:this.score, coins:this.coins,
                       runSeed:this.runSeed, rngSeed:makeLevelSeed(this.runSeed, this.currentLevel), playerName:getPlayerName() });

    if (this.currentLevel > MAX_LEVEL){
      this.isGameOver=true; this.physics.pause(); this.ant.body.setVelocity(0);
      this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, "DEMO COMPLETED!",
        { fontSize:'40px', fill:'#ffffff', fontFamily:'Arial' }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
      return;
    }

    const timerEl = document.getElementById('timer-display'); if (timerEl) timerEl.textContent='00:00:00';
    this.timerStarted=false; this.startTime=0;
    this.scene.restart({ currentLevel:this.currentLevel, totalTime:this.totalTime, score:this.score, coins:this.coins,
                         runSeed:this.runSeed, rngSeed:makeLevelSeed(this.runSeed, this.currentLevel) });
  }
}

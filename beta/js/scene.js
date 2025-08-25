import { getPlayerName, changePlayerName, saveGameSnapshot, loadGameSnapshot } from './storage.js';
import { mulberry32, makeLevelSeed } from './rng.js';
import { computeLevelScore, HINT_COST } from './scoring.js';
import { generateMaze } from './maze-gen.js';

export default class MazeScene extends Phaser.Scene{
  constructor(){ super('MazeScene'); }

  init(data){
    this.currentLevel = (data && data.currentLevel != null) ? data.currentLevel : 1;
    this.totalTime    = (data && data.totalTime    != null) ? data.totalTime    : 0;
    this.score        = (data && data.score        != null) ? data.score        : 0;
    this.coins        = (data && data.coins        != null) ? data.coins        : 0;
    this.isGameOver   = false; this.paused = false;

    this.tileSize     = 50;
    this.mazeLayout   = [];
    this.timerStarted = false; this.startTime = 0;
    this.antStartPos  = { x: 0, y: 0 };

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

    for (let r=0; r<size; r++){
      for (let c=0; c<size; c++){
        const x=c*this.tileSize, y=r*this.tileSize;
        if (this.mazeLayout[r][c]===0){
          const wall = this.add.rectangle(x+this.tileSize/2, y+this.tileSize/2, this.tileSize, this.tileSize, 0x000000);
          wall.setStrokeStyle(2, 0x00FFFF);
          this.physics.add.existing(wall, true);
          this.topWalls.add(wall);
        } else {
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
    }

    if (this.ant) this.ant.destroy();
    const spawn = (this.restoreSnapshot && this.restoreSnapshot.player) ? this.restoreSnapshot.player : startPos;
    this.ant = this.add.circle(spawn.x, spawn.y, 10, 0xff00ff);
    this.physics.add.existing(this.ant, false);
    this.ant.body.setCircle(10);
    this.ant.body.setCollideWorldBounds(true);
    this.physics.add.collider(this.ant, this.topWalls);

    // glow
    const GLOW_COLOR = 0xff99ff, widths=[10,5,2], alphas=[0.15,0.35,0.8];
    this.antGlow = this.add.graphics();
    this.events.on('update', ()=>{
      this.antGlow.clear();
      widths.forEach((w,i)=>{ this.antGlow.lineStyle(w, GLOW_COLOR, alphas[i]); this.antGlow.strokeCircle(this.ant.x, this.ant.y, 10); });
    });

    // camera & input
    this.cameras.main.startFollow(this.ant, true, 0.1, 0.1);
    this.cursors = this.input.keyboard.createCursorKeys();

    // exit
    const exitZone = this.add.zone(exitPos.x, exitPos.y, this.tileSize, this.tileSize);
    this.physics.add.existing(exitZone, true);
    this.physics.add.overlap(this.ant, exitZone, this.nextLevel, null, this);

    // orbs
    this.energyGroup = this.physics.add.group();
    const rng = mulberry32((this.rngSeed>>>0) + 999);
    const orbsCount = Math.max(3, 3 + Math.floor(this.currentLevel / 2));
    let placed=0;
    while(placed < orbsCount){
      const rx = Math.floor(rng()*size), ry = Math.floor(rng()*size);
      if (this.mazeLayout[ry][rx]===1 && !(rx===this.entrance.x && ry===this.entrance.y)){
        const px=rx*this.tileSize+this.tileSize/2, py=ry*this.tileSize+this.tileSize/2;
        const orb = this.add.circle(px,py,6,0x00ff66).setStrokeStyle(2,0x33ffaa,1);
        this.physics.add.existing(orb); orb.body.setCircle(6); orb.body.setImmovable(true);
        this.energyGroup.add(orb);
        placed++;
      }
    }
    this.physics.add.overlap(this.ant, this.energyGroup, (_ant, orb)=>{
      orb.destroy(); this.coins++; this.showToast('+1 Orb','#00ffff'); this.updateHUD();
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

  update(){
    if (this.isGameOver || this.paused) return;
    const L=this.cursors.left.isDown, R=this.cursors.right.isDown, U=this.cursors.up.isDown, D=this.cursors.down.isDown;
    this.ant.body.setVelocity(0);
    if (L) this.ant.body.setVelocityX(-200);
    if (R) this.ant.body.setVelocityX(200);
    if (U) this.ant.body.setVelocityY(-200);
    if (D) this.ant.body.setVelocityY(200);

    if (!this.timerStarted){
      if (Math.abs(this.ant.x-this.antStartPos.x)>4 || Math.abs(this.ant.y-this.antStartPos.y)>4){
        this.startTime = Date.now(); this.timerStarted = true;
      }
    }
    if (this.timerStarted){
      const t = this.formatTime(Date.now()-this.startTime);
      const timerEl = document.getElementById('timer-display'); if (timerEl) timerEl.textContent = t;
    }
  }

  updateHUD(){
    const levelEl=document.getElementById('levelDisplay');
    const scoreEl=document.getElementById('score');
    const nameEl =document.getElementById('playerNameDisplay');
    const orbsEl =document.getElementById('energyDisplay');
    if (levelEl) levelEl.textContent = `${this.currentLevel}`;
    if (scoreEl) scoreEl.textContent = `${this.score}`.padStart(5,'0');
    if (nameEl)  nameEl.firstChild.textContent = getPlayerName() + " ";
    if (orbsEl)  orbsEl.textContent = `${this.coins}`;
    const timerEl=document.getElementById('timer-display');
    if (timerEl) timerEl.textContent = this.timerStarted ? this.formatTime(Date.now()-this.startTime) : '00:00:00';
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

  useHint(){
    if (this.coins < HINT_COST){ this.showToast("Not enough orbs!", "#ffcc00"); return; }
    this.coins--; this.updateHUD();
    // semplice highlight diretto da player a exit (dimostrativo: puoi reinserire il BFS path se vuoi)
    const glow = this.add.graphics().lineStyle(4, 0x00ff99, 0.9);
    glow.strokeCircle(this.ant.x, this.ant.y, 16);
    this.tweens.add({ targets: glow, alpha:0, duration:1500, onComplete:()=>glow.destroy() });
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

    if (this.currentLevel > 20){
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

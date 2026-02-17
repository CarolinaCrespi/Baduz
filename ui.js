// ui.js - Enhanced UI Interactions for BADUZ

document.addEventListener('DOMContentLoaded', function() {
  // ====================
  // Modal functionality
  // ====================
  const aboutModal = document.getElementById('aboutModal');
  const aboutBtn = document.getElementById('aboutBtn');
  const closeAbout = document.getElementById('closeAbout');
  
  aboutBtn.addEventListener('click', () => {
    aboutModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
  
  closeAbout.addEventListener('click', () => {
    aboutModal.classList.remove('open');
    document.body.style.overflow = '';
  });
  
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
      aboutModal.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
  
  // ====================
  // Sound toggle
  // ====================
  const soundBtn = document.getElementById('soundToggle');
  const sfxBtn = document.getElementById('sfxToggle');
  let soundEnabled = true;
  let sfxEnabled = true;
  window.sfxEnabled = true;
  
  soundBtn.addEventListener('click', function() {
    soundEnabled = !soundEnabled;
    this.classList.toggle('muted');
    this.innerHTML = soundEnabled ? 
      '<i class="fas fa-volume-up"></i>' : 
      '<i class="fas fa-volume-mute"></i>';
    
    // In un gioco reale, qui controlleresti l'audio di Phaser
    if (window.game && window.game.sound) {
      window.game.sound.mute = !soundEnabled;
    }
  });
  
  // Effects toggle (independent from master audio mute)
  sfxBtn.addEventListener('click', function() {
    sfxEnabled = !sfxEnabled;
    window.sfxEnabled = sfxEnabled;
    this.classList.toggle('muted');
    this.innerHTML = sfxEnabled ?
      '<i class="fas fa-bell"></i>' :
      '<i class="fas fa-bell-slash"></i>';
  });
  
  // ====================
  // Change player name
  // ====================
  const changeNameBtn = document.getElementById('btnChangeName');
  const playerNameDisplay = document.getElementById('playerNameDisplay');
  
  changeNameBtn.addEventListener('click', function() {
    const currentName = playerNameDisplay.textContent.trim();
    const newName = prompt('Enter your new nickname:', currentName);
    
    if (newName && newName.trim() !== '' && newName !== currentName) {
      playerNameDisplay.textContent = newName;
      
      // Update in game if it's running
      if (window.game && window.game.scene.keys['MazeScene']) {
        window.game.scene.keys['MazeScene'].PLAYER_NAME = newName;
        localStorage.setItem('baduz-player-name', newName);
        window.game.scene.keys['MazeScene'].updateHUD();
      }
    }
  });
  
  // ====================
  // Quick action buttons
  // ====================
  document.getElementById('btnQuickHint').addEventListener('click', () => {
    triggerGameAction('hint');
  });
  
  document.getElementById('btnQuickPause').addEventListener('click', () => {
    triggerGameAction('pause');
  });
  
  document.getElementById('btnQuickCenter').addEventListener('click', () => {
    triggerGameAction('center');
  });
  
  // Mobile buttons
  document.getElementById('btnMobileHint').addEventListener('click', () => {
    triggerGameAction('hint');
  });

  const btnMobileReset = document.getElementById('btnMobileReset');
  if (btnMobileReset) {
    btnMobileReset.addEventListener('click', () => {
      triggerGameAction('reset');
    });
  }

  const btnMobileCenter = document.getElementById('btnMobileCenter');
  if (btnMobileCenter) {
    btnMobileCenter.addEventListener('click', () => {
      triggerGameAction('center');
    });
  }

  const btnMobileJump = document.getElementById('btnMobileJump');
  if (btnMobileJump) {
    btnMobileJump.addEventListener('click', () => {
      triggerGameAction('jump');
    });
  }
  
  document.getElementById('btnMobilePause').addEventListener('click', () => {
    triggerGameAction('pause');
  });
  
  // Main control buttons (present only on some layouts)
  const btnHint = document.getElementById('btnHint');
  if (btnHint) {
    btnHint.addEventListener('click', () => triggerGameAction('hint'));
  }
  
  const btnPause = document.getElementById('btnPause');
  if (btnPause) {
    btnPause.addEventListener('click', () => triggerGameAction('pause'));
  }
  
  const btnReset = document.getElementById('btnReset');
  if (btnReset) {
    btnReset.addEventListener('click', () => triggerGameAction('reset'));
  }
  
  const btnCenter = document.getElementById('btnCenter');
  if (btnCenter) {
    btnCenter.addEventListener('click', () => triggerGameAction('center'));
  }
  
  function triggerGameAction(action) {
    if (!window.game || !window.game.scene.keys['MazeScene']) return;
    
    const scene = window.game.scene.keys['MazeScene'];
    
    switch(action) {
      case 'hint':
        scene.useHint();
        break;
      case 'pause':
        scene.togglePause();
        break;
      case 'reset':
        scene.handleReset();
        scene.showToast('Level reset');
        break;
      case 'center':
        scene.cameras.main.startFollow(scene.ant, true, 0.1, 0.1);
        scene.cameras.main.centerOn(scene.ant.x, scene.ant.y);
        break;
      case 'jump':
        if (scene.handleJump) scene.handleJump();
        break;
    }
  }
  
  // Save/Load removed
  
  // ====================
  // Orb counter animation
  // ====================
  let lastOrbs = 0;
  window.updateOrbAnimation = function(currentOrbs) {
    const orbFill = document.getElementById('orbFill');
    const orbsCircle = document.getElementById('orbsCircle');

    if (orbsCircle) orbsCircle.textContent = currentOrbs;
    if (typeof window.updateOrbsCircle === 'function') {
      window.updateOrbsCircle(currentOrbs);
    }

    // If the bar element is absent (desktop layout), just update counters safely.
    if (!orbFill) {
      lastOrbs = currentOrbs;
      return;
    }

    const maxOrbs = 10;
    const percentage = Math.min((currentOrbs / maxOrbs) * 100, 100);
    orbFill.style.width = `${percentage}%`;
    
    if (currentOrbs > lastOrbs) {
      orbFill.classList.add('pulse');
      setTimeout(() => orbFill.classList.remove('pulse'), 300);
    }
    lastOrbs = currentOrbs;
  };

  // Mirror stat values into circular badges on the canvas
  syncStatCircle('orbsDisplay', 'orbsCircle');
  syncStatCircle('jumpDisplay', 'jumpCircle');

  // Expose manual updaters if game wants to push values directly
  window.updateJumpCircle = function(value) {
    const jumpCircle = document.getElementById('jumpCircle');
    if (jumpCircle) jumpCircle.textContent = value;
  };
  window.updateOrbsCircle = function(value) {
    const orbsCircle = document.getElementById('orbsCircle');
    if (orbsCircle) orbsCircle.textContent = value;
  };

  function syncStatCircle(sourceId, targetId) {
    const source = document.getElementById(sourceId);
    const target = document.getElementById(targetId);
    if (!source || !target) return;
    const update = () => target.textContent = source.textContent.trim();
    update();
    const observer = new MutationObserver(update);
    observer.observe(source, { characterData: true, childList: true, subtree: true });
  }
  
  // ====================
  // Virtual joystick
  // ====================
  setupVirtualJoystick();

  function setupVirtualJoystick() {
    const joystickBase = document.querySelector('.joystick-base');
    const joystickCap = document.querySelector('.joystick-cap');
    if (!joystickBase || !joystickCap) return;

    // Global mobile input: holds discrete dir and analog vector
    window.mobileInput = window.mobileInput || { dir: null, analog: null };

    let isActive = false;
    let activePointerId = null;

    function getCenter() {
      const r = joystickBase.getBoundingClientRect();
      // Maximum distance is half of size minus a small margin
      const maxDist = Math.min(r.width, r.height) / 2 - 8;
      return {
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        maxDist: maxDist > 0 ? maxDist : 1
      };
    }

    function updateJoystick(clientX, clientY) {
      const { cx, cy, maxDist } = getCenter();
      const dx = clientX - cx;
      const dy = clientY - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const limitedDistance = Math.min(distance, maxDist);
      const moveX = Math.cos(angle) * limitedDistance;
      const moveY = Math.sin(angle) * limitedDistance;
      joystickCap.style.transform = `translate(${moveX}px, ${moveY}px)`;
      // Analog values normalised to [-1,1]
      const analogX = moveX / maxDist;
      const analogY = moveY / maxDist;
      window.mobileInput.analog = { x: analogX, y: analogY };
      // Determine digital direction if outside dead zone
      const deadZone = Math.max(10, maxDist * 0.3);
      if (limitedDistance < deadZone) {
        window.mobileInput.dir = null;
        return;
      }
      const absX = Math.abs(moveX);
      const absY = Math.abs(moveY);
      if (absX > absY) {
        window.mobileInput.dir = moveX > 0 ? 'right' : 'left';
      } else {
        window.mobileInput.dir = moveY > 0 ? 'down' : 'up';
      }
    }

    function startJoystick(e) {
      // Only one pointer active
      if (activePointerId !== null && e.pointerId !== activePointerId) return;
      activePointerId = e.pointerId;
      isActive = true;
      joystickBase.classList.add('active');
      joystickBase.setPointerCapture?.(e.pointerId);
      updateJoystick(e.clientX, e.clientY);
    }

    function moveJoystick(e) {
      if (!isActive || e.pointerId !== activePointerId) return;
      updateJoystick(e.clientX, e.clientY);
    }

    function stopJoystick(e) {
      if (!isActive || (e && e.pointerId !== activePointerId)) return;
      isActive = false;
      activePointerId = null;
      window.mobileInput.dir = null;
      window.mobileInput.analog = null;
      joystickCap.style.transform = 'translate(0, 0)';
      joystickBase.classList.remove('active');
    }

    joystickBase.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      startJoystick(e);
    });
    window.addEventListener('pointermove', (e) => {
      if (!isActive) return;
      e.preventDefault?.();
      moveJoystick(e);
    }, { passive: false });
    window.addEventListener('pointerup', (e) => stopJoystick(e));
    window.addEventListener('pointercancel', (e) => stopJoystick(e));
    // Prevent context menu on joystick
    joystickBase.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  
  // ====================
  // Background particles
  // ====================
  createBackgroundParticles();
  
  function createBackgroundParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = Math.min(20, Math.floor(window.innerWidth / 50));
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      
      // Random position
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      
      // Random animation
      const duration = 3 + Math.random() * 4;
      const delay = Math.random() * 5;
      particle.style.animationDuration = `${duration}s`;
      particle.style.animationDelay = `${delay}s`;
      
      // Random size
      const size = 1 + Math.random() * 2;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      
      // Random color variation
      const colors = ['#00f3ff', '#ff00ff', '#00ff9d', '#0066ff'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.backgroundColor = color;
      particle.style.boxShadow = `0 0 8px ${color}`;
      
      particlesContainer.appendChild(particle);
    }
  }
  
  // ====================
  // Update level dots
  // ====================
  window.updateLevelDots = function(currentLevel) {
    const dots = document.querySelectorAll('.level-dots .dot');
    if (!dots.length) return;
    
    // Reset all dots
    dots.forEach(dot => {
      dot.classList.remove('active');
      dot.style.background = 'rgba(0, 243, 255, 0.3)';
    });
    
    // Activate dots up to current level (max 5 dots shown)
    const levelIndex = Math.min(currentLevel - 1, 4);
    for (let i = 0; i <= levelIndex; i++) {
      if (dots[i]) {
        dots[i].classList.add('active');
      }
    }
  };
  
  // ====================
  // Keyboard shortcuts (UI only)
  // NOTE: Gameplay keys are handled inside Phaser to avoid double triggers.
  // (e.g. pressing H should cost 3 orbs, not 6)
  // ====================
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  });
  
  // ====================
  // Window resize handling
  // ====================
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Re-center joystick calculations
      const joystickBase = document.querySelector('.joystick-base');
      if (joystickBase) {
        // Force reflow for new position calculations
        joystickBase.style.display = 'none';
        void joystickBase.offsetWidth;
        joystickBase.style.display = 'flex';
      }
    }, 250);
  });
  
  console.log('BADUZ UI initialized successfully!');

  // ====================
  // Language toggle & translations
  // ====================
  const translations = {
    en: {
      PLAYER: 'PLAYER',
      SCORE: 'SCORE',
      ORBS: 'ORBS',
      TIME: 'TIME',
      LEVEL: 'LEVEL',
      JUMP: 'JUMP',
      hint: 'Hint',
      jump: 'Jump',
      pause: 'Pause',
      reset: 'Reset',
      center: 'Center View',
      keyCollected: 'Key collected!',
      needKey: 'Find the key!',
      levelCleared: 'LEVEL CLEARED',
      hazard: 'Hazard!',
      tierOk: 'OK',
      tierTip: 'Press OK to start.',
      about: {
        title: 'ABOUT',
        lead: 'BADUZ is a neon sphere lost in a maze. Navigate the labyrinth, collect Energy Orbs, and find the exit as fast as you can.',
        tipLabel: 'Pro Tip',
        features: [
          { title: '20 Levels', desc: 'Progressively challenging mazes' },
          { title: 'Smart Hints', desc: 'Use Orbs to reveal paths' },
          { title: 'Score System', desc: 'Speed & efficiency matter' },
          { title: 'Cross-Platform', desc: 'Play anywhere' },
        ],
        controls: {
          move: 'Move Baduz',
          hint: 'Use Hint',
          pause: 'Pause Game',
          reset: 'Reset Level'
        },
        tip: 'Complete levels quickly for higher scores! The timer affects your final points.'
      },
      tiers: {
         t1: { name: 'FIRST STEPS', html: `
          <div class="tier-lead">Welcome to <b>BADUZ</b>. Explore the maze, collect <b>ORBS</b>, and find the <b>Exit</b>.</div>
          <div class="tier-feature-grid">
            <div class="tier-feature"><i class="fas fa-gem"></i><div><b>ORBS</b> <span class="pickup-swatch orb"></span><small>Collect them to score points and use hints</small></div></div>
            <div class="tier-feature"><i class="fas fa-door-open"></i><div><b>Exit</b><small>Reach it to clear the level</small></div></div>
            <div class="tier-feature"><i class="fas fa-route"></i><div><b>Hint</b><small><span class="kbd">H</span> costs <b>3</b> Orbs</small></div></div>
          </div>
          <div class="tier-tipline">Drag the maze to explore. Re-center the view to see BADUZ moving again.</div>
        ` },

        t2: { name: 'LOCK & KEY', html: `
          <div class="tier-lead">The exit is blocked. Explore the maze and find the <b>Key</b> to open the <b>Door</b>.</div>
          <div class="tier-feature-grid">
            <div class="tier-feature"><i class="fas fa-key"></i><div><b>Key</b> <span class="pickup-swatch key"></span><small>Collect it to unlock the door</small></div></div>
            <div class="tier-feature"><i class="fas fa-door-closed"></i><div><b>Door</b><small>Blocks the exit until you have the key</small></div></div>
            <div class="tier-feature"><i class="fas fa-gem"></i><div><b>ORBS</b> <span class="pickup-swatch orb"></span><small>Use them to get hints</small></div></div>
          </div>
          <div class="tier-tipline">If you see the exit but can’t reach it, the key is still out there.</div>
        ` },


        t3: { name: 'ICE & FRICTION', html: `
        <div class="tier-lead">New terrain: movement control changes. Move carefully!</div>
        <div class="tier-feature-grid">
          <div class="tier-feature"><i class="fas fa-snowflake"></i><div><b>Ice</b> <span class="tile-swatch ice"></span><small>You slide easily — one extra push can send you off course</small></div></div>
          <div class="tier-feature"><i class="fas fa-person-walking"></i><div><b>Friction</b> <span class="tile-swatch slow"></span><small>Slows you down and wastes precious time</small></div></div>
          <div class="tier-feature"><i class="fas fa-crosshairs"></i><div><b>Control</b><small>Short, precise moves help on ice</small></div></div>
        </div>
        <div class="tier-tipline">Move carefully on ice. Avoid slow zones — every second matters.</div>
      ` },


        t4: { name: 'RED ZONE', html: `
          <div class="tier-lead">Some areas of the maze are deadly. Touching them resets the level.</div>
          <div class="tier-feature-grid">
            <div class="tier-feature"><i class="fas fa-triangle-exclamation"></i><div><b>Red Zone</b> <span class="tile-swatch hazard"></span><small>Entering it triggers an instant reset</small></div></div>
            <div class="tier-feature"><i class="fas fa-arrow-up"></i><div><b>Jump</b><small><span class="kbd">J</span> a quick dash to cross dangerous areas</small></div></div>
            <div class="tier-feature"><i class="fas fa-arrow-up"></i><div><b>Spring</b> <span class="pickup-swatch spring"></span><small>Collect it to gain +1 Jump charge</small></div></div>
          </div>
          <div class="tier-tipline">Jump follows your movement direction — timing is everything.</div>
        ` },

      }
    },
    it: {
      PLAYER: 'GIOCATORE',
      SCORE: 'PUNTEGGIO',
      ORBS: 'SFERE',
      TIME: 'TEMPO',
      LEVEL: 'LIVELLO',
      JUMP: 'SALTO',
      hint: 'Suggerimento',
      jump: 'Salto',
      pause: 'Pausa',
      reset: 'Ricomincia',
      center: 'Centra Vista',
      keyCollected: 'Chiave raccolta!',
      needKey: 'Trova la chiave!',
      levelCleared: 'LIVELLO COMPLETATO',
      hazard: 'Pericolo!',
      tierOk: 'OK',
      tierTip: 'Premi OK per iniziare.',
      about: {
        title: 'INFORMAZIONI',
        lead: 'BADUZ è una pallina neon persa in un labirinto. Esplora i corridoi, raccogli le Sfere di Energia e trova la via d’uscita il più velocemente possibile.',
        tipLabel: 'Consiglio',
        features: [
          { title: '20 Livelli', desc: 'Labirinti sempre più impegnativi' },
          { title: 'Hint Intelligenti', desc: 'Usa le Sfere per rivelare il percorso' },
          { title: 'Sistema Punteggio', desc: 'Velocità ed efficienza contano' },
          { title: 'Cross-Platform', desc: 'Gioca ovunque' },
        ],
        controls: {
          move: 'Muovi Baduz',
          hint: 'Usa Suggerimento',
          pause: 'Pausa',
          reset: 'Ricomincia livello'
        },
        tip: 'Completa i livelli in fretta per punteggi piu alti! Il timer incide sui punti finali.'
      },
      tiers: {
        t1: { name: 'PRIMI PASSI', html: `
          <div class="tier-lead">Benvenuto in <b>BADUZ</b>. Esplora il labirinto, raccogli le <b>SFERE</b> e trova l’<b>Uscita</b>.</div>
          <div class="tier-feature-grid">
            <div class="tier-feature"><i class="fas fa-gem"></i><div><b>SFERE</b> <span class="pickup-swatch orb"></span><small>Raccoglile per fare punti e usare i suggerimenti</small></div></div>
            <div class="tier-feature"><i class="fas fa-door-open"></i><div><b>Uscita</b><small>Raggiungila per completare il livello</small></div></div>
            <div class="tier-feature"><i class="fas fa-route"></i><div><b>Suggerimento</b><small><span class="kbd">H</span> costa <b>3</b> Sfere</small></div></div>
          </div>
          <div class="tier-tipline">Trascina il labirinto per esplorare. Ricentra la vista per rivedere BADUZ e riprendere il movimento.</div>
        ` },

        t2: { name: 'CHIAVE & PORTA', html: `
          <div class="tier-lead">L’uscita è bloccata. Esplora il labirinto e trova la <b>Chiave</b> per aprire la <b>Porta</b>.</div>
          <div class="tier-feature-grid">
            <div class="tier-feature"><i class="fas fa-key"></i><div><b>Chiave</b> <span class="pickup-swatch key"></span><small>Raccoglila per sbloccare la porta</small></div></div>
            <div class="tier-feature"><i class="fas fa-door-closed"></i><div><b>Porta</b><small>Ti impedisce di uscire finché non hai la chiave</small></div></div>
            <div class="tier-feature"><i class="fas fa-gem"></i><div><b>SFERE</b> <span class="pickup-swatch orb"></span><small>Usale per ottenere suggerimenti</small></div></div>
          </div>
          <div class="tier-tipline">Vedi l’uscita ma non puoi passare? La chiave è ancora da qualche parte.</div>
        ` },

        
        t3: { name: 'GHIACCIO & ATTRITO', html: `
          <div class="tier-lead">Nuovo terreno: il controllo del movimento cambia. Muoviti con attenzione!</div>
          <div class="tier-feature-grid">
            <div class="tier-feature"><i class="fas fa-snowflake"></i><div><b>Ghiaccio</b> <span class="tile-swatch ice"></span><small>Scivoli facilmente: una spinta di troppo e perdi direzione</small></div></div>
            <div class="tier-feature"><i class="fas fa-person-walking"></i><div><b>Attrito</b> <span class="tile-swatch slow"></span><small>Ti rallenta e ti fa perdere tempo prezioso</small></div></div>
            <div class="tier-feature"><i class="fas fa-crosshairs"></i><div><b>Controllo</b><small>Movimenti brevi e precisi aiutano sul ghiaccio</small></div></div>
          </div>
          <div class="tier-tipline">Sul ghiaccio vai piano. Evita le zone di rallentamento: ogni secondo conta.</div>
        ` },
        
      t4: { name: 'ZONA ROSSA', html: `
          <div class="tier-lead">Alcune zone del labirinto sono letali. Toccandole, il livello riparte.</div>
          <div class="tier-feature-grid">
            <div class="tier-feature"><i class="fas fa-triangle-exclamation"></i><div><b>Zona Rossa</b> <span class="tile-swatch hazard"></span><small>Entrarci significa reset immediato</small></div></div>
            <div class="tier-feature"><i class="fas fa-arrow-up"></i><div><b>Salto</b><small><span class="kbd">J</span> scatto rapido per superare il pericolo</small></div></div>
            <div class="tier-feature"><i class="fas fa-arrow-up"></i><div><b>Molla</b> <span class="pickup-swatch spring"></span><small>Raccoglila per ottenere +1 carica Salto</small></div></div>
          </div>
          <div class="tier-tipline">Il salto segue la tua direzione di movimento: usalo con tempismo.</div>
        ` },


      }
    }
  };

  // Determine initial language from localStorage or default to Italian
  let currentLang = localStorage.getItem('baduz-lang') || 'it';
  document.documentElement.setAttribute('lang', currentLang);

  // Utility to update UI text based on current language
  function applyTranslations() {
    const t = translations[currentLang] || translations.it;
    // Update stat headers
    const playerH = document.querySelector('.player-card .stat-header h3');
    const scoreH = document.querySelector('.stat-card:nth-child(2) .stat-header h3');
    const orbsH = document.querySelector('.energy-card .stat-header h3');
    const jumpH = document.querySelector('.jump-card .stat-header h3');
    const timeH = document.querySelector('.time-card .stat-header h3');
    const levelH = document.querySelector('.level-card .stat-header h3');
    if (playerH) playerH.textContent = t.PLAYER;
    if (scoreH) scoreH.textContent = t.SCORE;
    if (orbsH) orbsH.textContent = t.ORBS;
    if (jumpH) jumpH.textContent = (t.jump || 'Jump').toUpperCase();
    if (timeH) timeH.textContent = t.TIME;
    if (levelH) levelH.textContent = t.LEVEL;
    // Update main action buttons
    const hintBtn = document.getElementById('btnHint');
    const pauseBtn = document.getElementById('btnPause');
    const resetBtn = document.getElementById('btnReset');
    const centerBtn = document.getElementById('btnCenter');
    if (hintBtn) {
      const span = hintBtn.querySelector('.btn-text');
      if (span) span.textContent = `${t.hint} (H)`;
    }
    if (pauseBtn) {
      const span = pauseBtn.querySelector('.btn-text');
      if (span) span.textContent = `${t.pause} (P)`;
    }
    if (resetBtn) {
      const span = resetBtn.querySelector('.btn-text');
      if (span) span.textContent = `${t.reset} (R)`;
    }
    if (centerBtn) {
      const span = centerBtn.querySelector('.btn-text');
      if (span) span.textContent = t.center;
    }
    // Save/Load removed
    // Update mobile buttons labels
    const mobileHintBtn = document.getElementById('btnMobileHint');
    const mobileJumpBtn = document.getElementById('btnMobileJump');
    const mobilePauseBtn = document.getElementById('btnMobilePause');
    const mobileResetBtn = document.getElementById('btnMobileReset');
    const mobileCenterBtn = document.getElementById('btnMobileCenter');
    if (mobileHintBtn) {
      const span = mobileHintBtn.querySelector('span');
      if (span) span.textContent = t.hint;
    }
    if (mobileJumpBtn) {
      const span = mobileJumpBtn.querySelector('span');
      if (span) span.textContent = t.jump;
    }
    if (mobilePauseBtn) {
      const span = mobilePauseBtn.querySelector('span');
      if (span) span.textContent = t.pause;
    }
    if (mobileResetBtn) {
      const span = mobileResetBtn.querySelector('span');
      if (span) span.textContent = t.reset;
    }
    if (mobileCenterBtn) {
      const span = mobileCenterBtn.querySelector('span');
      if (span) span.textContent = t.center;
    }

    // About modal translations
    const about = t.about;
    if (about) {
      const titleEl = document.getElementById('aboutTitleText');
      const leadEl = document.getElementById('aboutLeadText');
      const tipEl = document.getElementById('aboutTip');
      if (titleEl) titleEl.textContent = about.title;
      if (leadEl) leadEl.innerHTML = `<i class="fas fa-gamepad"></i> ${about.lead}`;
      const tipLabel = about.tipLabel || 'Pro Tip';
      if (tipEl) tipEl.innerHTML = `<strong>${tipLabel}:</strong> ${about.tip}`;

      const feats = about.features || [];
      const featIds = [
        ['feat1Title', 'feat1Desc'],
        ['feat2Title', 'feat2Desc'],
        ['feat3Title', 'feat3Desc'],
        ['feat4Title', 'feat4Desc'],
      ];
      featIds.forEach((ids, i) => {
        const data = feats[i];
        if (!data) return;
        const [tId, dId] = ids;
        const tEl = document.getElementById(tId);
        const dEl = document.getElementById(dId);
        if (tEl) tEl.textContent = data.title;
        if (dEl) dEl.textContent = data.desc;
      });

      const ctrl = about.controls || {};
      const ctrlMap = {
        ctrlMove: ctrl.move,
        ctrlHint: ctrl.hint,
        ctrlPause: ctrl.pause,
        ctrlReset: ctrl.reset
      };
      Object.entries(ctrlMap).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el && text) el.textContent = text;
      });
    }
  }

  // Initial application of translations
  applyTranslations();

  
  // Keep track of the last shown Tier (so we can re-render it after a language switch)
  let lastTierKey = null;

  function refreshTierModalIfOpen() {
    const tierModalEl = document.getElementById('tierModal');
    if (!tierModalEl || !tierModalEl.classList.contains('open') || !lastTierKey) return;

    const tierTitleEl = document.getElementById('tierModalTitle');
    const tierTextEl = document.getElementById('tierModalText');
    const tierHintEl = document.getElementById('tierModalHint');
    const tierOkLabelEl = document.getElementById('tierOkLabel');

    const t = translations[currentLang] || translations.it;
    const tier = t.tiers?.[lastTierKey] || translations.en.tiers?.[lastTierKey];

    const iconMap = { t1: 'fa-bolt', t2: 'fa-key', t3: 'fa-snowflake', t4: 'fa-triangle-exclamation' };
    const icon = iconMap[lastTierKey] || 'fa-bolt';

    if (tierTitleEl) tierTitleEl.innerHTML = `<i class="fas ${icon}"></i> ${tier?.name || 'NEW MECHANICS'}`;
    if (tierTextEl) tierTextEl.innerHTML = tier?.html || tier?.text || '';
    if (tierHintEl) tierHintEl.textContent = t.tierTip || 'Tip: Press OK to start.';
    if (tierOkLabelEl) tierOkLabelEl.textContent = t.tierOk || 'OK';
  }

  function toggleLanguage() {
    currentLang = currentLang === 'it' ? 'en' : 'it';
    localStorage.setItem('baduz-lang', currentLang);
    document.documentElement.setAttribute('lang', currentLang);
    applyTranslations();
    refreshTierModalIfOpen();
  }

// Language toggle button listener
  const langToggleBtn = document.getElementById('langToggle');
  if (langToggleBtn) {
    langToggleBtn.addEventListener('click', toggleLanguage);
  }

  // Tier "First Steps" modal: language toggle inside the modal too
  const tierLangToggleBtn = document.getElementById('tierLangToggle');
  if (tierLangToggleBtn) {
    tierLangToggleBtn.addEventListener('click', toggleLanguage);
  }

  // Expose translation strings for other modules (e.g., demo.js)
  window.baduzTranslations = translations;
  window.getBaduzLang = () => currentLang;

  // ====================
  // Tier Intro Modal API (called from demo.js)
  // ====================
  const tierModal = document.getElementById('tierModal');
  const tierTitle = document.getElementById('tierModalTitle');
  const tierText = document.getElementById('tierModalText');
  const tierHint = document.getElementById('tierModalHint');
  const tierOkLabel = document.getElementById('tierOkLabel');
  const closeTier = document.getElementById('closeTier');
  const btnTierOk = document.getElementById('btnTierOk');

  let _tierOnClose = null;
  function hideTierModal() {
    if (!tierModal) return;
    tierModal.classList.remove('open');
    document.body.style.overflow = '';
    if (typeof _tierOnClose === 'function') {
      const cb = _tierOnClose; _tierOnClose = null;
      cb();
    } else {
      _tierOnClose = null;
    }
  }
  function showTierIntro(tierKey, onClose) {
    lastTierKey = tierKey;
    const t = translations[currentLang] || translations.it;
    const tier = t.tiers?.[tierKey] || translations.en.tiers?.[tierKey];

    // Choose a themed icon per tier
    const iconMap = { t1: 'fa-bolt', t2: 'fa-key', t3: 'fa-snowflake', t4: 'fa-triangle-exclamation' };
    const icon = iconMap[tierKey] || 'fa-bolt';

    if (tierTitle) tierTitle.innerHTML = `<i class="fas ${icon}"></i> ${tier?.name || 'NEW MECHANICS'}`;
    if (tierText) tierText.innerHTML = tier?.html || tier?.text || '';
    if (tierHint) tierHint.textContent = t.tierTip || 'Tip: Press OK to start.';
    if (tierOkLabel) tierOkLabel.textContent = t.tierOk || 'OK';
    _tierOnClose = onClose || null;
    if (tierModal) {
      tierModal.classList.add('open');
    }
  }
  if (closeTier) closeTier.addEventListener('click', hideTierModal);
  if (btnTierOk) btnTierOk.addEventListener('click', hideTierModal);
  if (tierModal) tierModal.addEventListener('click', (e) => {
    if (e.target === tierModal) hideTierModal();
  });

  window.showTierIntro = showTierIntro;
});

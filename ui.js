/* =========================================================
   BADUZ – UI Interactions
   DOM-only logic: modals, buttons, HUD updates, particles.
   Translations → src/i18n/translations.js
   Joystick      → src/systems/joystick.js
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {

  // ====================
  // Modal: About
  // ====================
  const aboutModal = document.getElementById('aboutModal');
  const aboutBtn   = document.getElementById('aboutBtn');
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
  // Sound toggles
  // ====================
  const soundBtn  = document.getElementById('soundToggle');
  const sfxBtn    = document.getElementById('sfxToggle');
  let soundEnabled = true;
  let sfxEnabled   = true;
  window.sfxEnabled = true;

  soundBtn.addEventListener('click', function () {
    soundEnabled = !soundEnabled;
    this.classList.toggle('muted');
    this.innerHTML = soundEnabled
      ? '<i class="fas fa-volume-up"></i>'
      : '<i class="fas fa-volume-mute"></i>';
    if (window.game?.sound) window.game.sound.mute = !soundEnabled;
  });

  sfxBtn.addEventListener('click', function () {
    sfxEnabled = !sfxEnabled;
    window.sfxEnabled = sfxEnabled;
    this.classList.toggle('muted');
    this.innerHTML = sfxEnabled
      ? '<i class="fas fa-bell"></i>'
      : '<i class="fas fa-bell-slash"></i>';
  });

  // ====================
  // Change player name
  // ====================
  const changeNameBtn     = document.getElementById('btnChangeName');
  const playerNameDisplay = document.getElementById('playerNameDisplay');

  changeNameBtn.addEventListener('click', function () {
    const currentName = playerNameDisplay.textContent.trim();
    const newName     = prompt('Enter your new nickname:', currentName);
    if (newName && newName.trim() !== '' && newName !== currentName) {
      playerNameDisplay.textContent = newName;
      if (window.game?.scene.keys['MazeScene']) {
        window.game.scene.keys['MazeScene'].PLAYER_NAME = newName;
        localStorage.setItem('baduz-player-name', newName);
        window.game.scene.keys['MazeScene'].updateHUD();
      }
    }
  });

  // ====================
  // Quick action buttons (canvas overlay)
  // ====================
  document.getElementById('btnQuickHint').addEventListener('click',   () => triggerGameAction('hint'));
  document.getElementById('btnQuickPause').addEventListener('click',  () => triggerGameAction('pause'));
  document.getElementById('btnQuickCenter').addEventListener('click', () => triggerGameAction('center'));

  // Mobile buttons
  document.getElementById('btnMobileHint').addEventListener('click',  () => triggerGameAction('hint'));
  document.getElementById('btnMobilePause').addEventListener('click', () => triggerGameAction('pause'));

  const btnMobileReset  = document.getElementById('btnMobileReset');
  const btnMobileCenter = document.getElementById('btnMobileCenter');
  const btnMobileJump   = document.getElementById('btnMobileJump');
  if (btnMobileReset)  btnMobileReset.addEventListener('click',  () => triggerGameAction('reset'));
  if (btnMobileCenter) btnMobileCenter.addEventListener('click', () => triggerGameAction('center'));
  if (btnMobileJump)   btnMobileJump.addEventListener('click',   () => triggerGameAction('jump'));

  // Top-level control buttons (some layouts only)
  const btnHint   = document.getElementById('btnHint');
  const btnPause  = document.getElementById('btnPause');
  const btnReset  = document.getElementById('btnReset');
  const btnCenter = document.getElementById('btnCenter');
  if (btnHint)   btnHint.addEventListener('click',   () => triggerGameAction('hint'));
  if (btnPause)  btnPause.addEventListener('click',  () => triggerGameAction('pause'));
  if (btnReset)  btnReset.addEventListener('click',  () => triggerGameAction('reset'));
  if (btnCenter) btnCenter.addEventListener('click', () => triggerGameAction('center'));

  function triggerGameAction(action) {
    if (!window.game?.scene.keys['MazeScene']) return;
    const scene = window.game.scene.keys['MazeScene'];
    switch (action) {
      case 'hint':   scene.useHint(); break;
      case 'pause':  scene.togglePause(); break;
      case 'reset':  scene.handleReset(); scene.showToast('Level reset'); break;
      case 'center':
        scene.cameras.main.startFollow(scene.ant, true, 0.1, 0.1);
        scene.cameras.main.centerOn(scene.ant.x, scene.ant.y);
        break;
      case 'jump':   if (scene.handleJump) scene.handleJump(); break;
    }
  }

  // ====================
  // Orb counter animation
  // ====================
  let lastOrbs = 0;
  window.updateOrbAnimation = function (currentOrbs) {
    const orbFill    = document.getElementById('orbFill');
    const orbsCircle = document.getElementById('orbsCircle');

    if (orbsCircle) orbsCircle.textContent = currentOrbs;
    if (typeof window.updateOrbsCircle === 'function') window.updateOrbsCircle(currentOrbs);

    if (!orbFill) { lastOrbs = currentOrbs; return; }

    const maxOrbs    = 10;
    const percentage = Math.min((currentOrbs / maxOrbs) * 100, 100);
    orbFill.style.width = `${percentage}%`;
    if (currentOrbs > lastOrbs) {
      orbFill.classList.add('pulse');
      setTimeout(() => orbFill.classList.remove('pulse'), 300);
    }
    lastOrbs = currentOrbs;
  };

  // Sync stat values into circular badges on the canvas
  syncStatCircle('orbsDisplay', 'orbsCircle');
  syncStatCircle('jumpDisplay',  'jumpCircle');

  window.updateJumpCircle = function (value) {
    const jumpCircle = document.getElementById('jumpCircle');
    if (jumpCircle) jumpCircle.textContent = value;
  };
  window.updateOrbsCircle = function (value) {
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
  // Virtual joystick (logic in joystick.js)
  // ====================
  setupVirtualJoystick();

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
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top  = `${Math.random() * 100}%`;
      const duration = 3 + Math.random() * 4;
      const delay    = Math.random() * 5;
      particle.style.animationDuration = `${duration}s`;
      particle.style.animationDelay    = `${delay}s`;
      const size = 1 + Math.random() * 2;
      particle.style.width  = `${size}px`;
      particle.style.height = `${size}px`;
      const colors = ['#00f3ff', '#ff00ff', '#00ff9d', '#0066ff'];
      const color  = colors[Math.floor(Math.random() * colors.length)];
      particle.style.backgroundColor = color;
      particle.style.boxShadow = `0 0 8px ${color}`;
      particlesContainer.appendChild(particle);
    }
  }

  // ====================
  // Level dots
  // ====================
  window.updateLevelDots = function (currentLevel) {
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

  // ====================
  // Window resize
  // ====================
  let resizeTimeout;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const joystickBase = document.querySelector('.joystick-base');
      if (joystickBase) {
        joystickBase.style.display = 'none';
        void joystickBase.offsetWidth;
        joystickBase.style.display = 'flex';
      }
    }, 250);
  });

  // ====================
  // Language & translations
  // (Data in src/i18n/translations.js)
  // ====================
  let currentLang = localStorage.getItem('baduz-lang') || 'it';
  document.documentElement.setAttribute('lang', currentLang);

  function applyTranslations() {
    const t = translations[currentLang] || translations.it;

    const playerH = document.querySelector('.player-card .stat-header h3');
    const scoreH  = document.querySelector('.stat-card:nth-child(2) .stat-header h3');
    const orbsH   = document.querySelector('.energy-card .stat-header h3');
    const jumpH   = document.querySelector('.jump-card .stat-header h3');
    const timeH   = document.querySelector('.time-card .stat-header h3');
    const levelH  = document.querySelector('.level-card .stat-header h3');
    if (playerH) playerH.textContent = t.PLAYER;
    if (scoreH)  scoreH.textContent  = t.SCORE;
    if (orbsH)   orbsH.textContent   = t.ORBS;
    if (jumpH)   jumpH.textContent   = (t.jump || 'Jump').toUpperCase();
    if (timeH)   timeH.textContent   = t.TIME;
    if (levelH)  levelH.textContent  = t.LEVEL;

    ['btnHint', 'btnPause', 'btnReset', 'btnCenter'].forEach((id, idx) => {
      const el   = document.getElementById(id);
      const span = el?.querySelector('.btn-text');
      if (!span) return;
      const labels = [`${t.hint} (H)`, `${t.pause} (P)`, `${t.reset} (R)`, t.center];
      span.textContent = labels[idx];
    });

    const mobileMap = {
      btnMobileHint:   t.hint,
      btnMobileJump:   t.jump,
      btnMobilePause:  t.pause,
      btnMobileReset:  t.reset,
      btnMobileCenter: t.center
    };
    Object.entries(mobileMap).forEach(([id, text]) => {
      const span = document.getElementById(id)?.querySelector('span');
      if (span && text) span.textContent = text;
    });

    const about = t.about;
    if (about) {
      const titleEl = document.getElementById('aboutTitleText');
      const leadEl  = document.getElementById('aboutLeadText');
      const tipEl   = document.getElementById('aboutTip');
      if (titleEl) titleEl.textContent = about.title;
      if (leadEl)  leadEl.innerHTML    = `<i class="fas fa-gamepad"></i> ${about.lead}`;
      const tipLabel = about.tipLabel || 'Pro Tip';
      if (tipEl) tipEl.innerHTML = `<strong>${tipLabel}:</strong> ${about.tip}`;

      const featIds = [
        ['feat1Title', 'feat1Desc'],
        ['feat2Title', 'feat2Desc'],
        ['feat3Title', 'feat3Desc'],
        ['feat4Title', 'feat4Desc'],
      ];
      featIds.forEach(([tId, dId], i) => {
        const data = about.features?.[i];
        if (!data) return;
        const tEl = document.getElementById(tId);
        const dEl = document.getElementById(dId);
        if (tEl) tEl.textContent = data.title;
        if (dEl) dEl.textContent = data.desc;
      });

      const ctrl    = about.controls || {};
      const ctrlMap = { ctrlMove: ctrl.move, ctrlHint: ctrl.hint, ctrlPause: ctrl.pause, ctrlReset: ctrl.reset };
      Object.entries(ctrlMap).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el && text) el.textContent = text;
      });
    }
  }

  applyTranslations();

  // Expose translations globally for Phaser scene to read
  window.baduzTranslations = translations;
  window.getBaduzLang      = () => currentLang;

  // ====================
  // Tier intro modal
  // ====================
  let lastTierKey = null;

  function refreshTierModalIfOpen() {
    const tierModalEl = document.getElementById('tierModal');
    if (!tierModalEl?.classList.contains('open') || !lastTierKey) return;
    const t    = translations[currentLang] || translations.it;
    const tier = t.tiers?.[lastTierKey] || translations.en.tiers?.[lastTierKey];
    const iconMap = { t1: 'fa-bolt', t2: 'fa-key', t3: 'fa-snowflake', t4: 'fa-triangle-exclamation' };
    const icon = iconMap[lastTierKey] || 'fa-bolt';
    const tierTitleEl  = document.getElementById('tierModalTitle');
    const tierTextEl   = document.getElementById('tierModalText');
    const tierHintEl   = document.getElementById('tierModalHint');
    const tierOkLabelEl = document.getElementById('tierOkLabel');
    if (tierTitleEl)   tierTitleEl.innerHTML  = `<i class="fas ${icon}"></i> ${tier?.name || 'NEW MECHANICS'}`;
    if (tierTextEl)    tierTextEl.innerHTML   = tier?.html || tier?.text || '';
    if (tierHintEl)    tierHintEl.textContent = t.tierTip || 'Tip: Press OK to start.';
    if (tierOkLabelEl) tierOkLabelEl.textContent = t.tierOk || 'OK';
  }

  function toggleLanguage() {
    currentLang = currentLang === 'it' ? 'en' : 'it';
    localStorage.setItem('baduz-lang', currentLang);
    document.documentElement.setAttribute('lang', currentLang);
    applyTranslations();
    refreshTierModalIfOpen();
  }

  const langToggleBtn     = document.getElementById('langToggle');
  const tierLangToggleBtn = document.getElementById('tierLangToggle');
  if (langToggleBtn)     langToggleBtn.addEventListener('click',     toggleLanguage);
  if (tierLangToggleBtn) tierLangToggleBtn.addEventListener('click', toggleLanguage);

  const tierModal   = document.getElementById('tierModal');
  const tierTitle   = document.getElementById('tierModalTitle');
  const tierText    = document.getElementById('tierModalText');
  const tierHint    = document.getElementById('tierModalHint');
  const tierOkLabel = document.getElementById('tierOkLabel');
  const closeTier   = document.getElementById('closeTier');
  const btnTierOk   = document.getElementById('btnTierOk');

  let _tierOnClose = null;

  function hideTierModal() {
    if (!tierModal) return;
    tierModal.classList.remove('open');
    document.body.style.overflow = '';
    if (typeof _tierOnClose === 'function') {
      const cb = _tierOnClose; _tierOnClose = null; cb();
    } else {
      _tierOnClose = null;
    }
  }

  function showTierIntro(tierKey, onClose) {
    lastTierKey = tierKey;
    const t    = translations[currentLang] || translations.it;
    const tier = t.tiers?.[tierKey] || translations.en.tiers?.[tierKey];
    const iconMap = { t1: 'fa-bolt', t2: 'fa-key', t3: 'fa-snowflake', t4: 'fa-triangle-exclamation' };
    const icon = iconMap[tierKey] || 'fa-bolt';

    if (tierTitle)   tierTitle.innerHTML   = `<i class="fas ${icon}"></i> ${tier?.name || 'NEW MECHANICS'}`;
    if (tierText)    tierText.innerHTML    = tier?.html || tier?.text || '';
    if (tierHint)    tierHint.textContent  = t.tierTip || 'Tip: Press OK to start.';
    if (tierOkLabel) tierOkLabel.textContent = t.tierOk || 'OK';
    _tierOnClose = onClose || null;
    if (tierModal) tierModal.classList.add('open');
  }

  if (closeTier) closeTier.addEventListener('click', hideTierModal);
  if (btnTierOk) btnTierOk.addEventListener('click', hideTierModal);
  if (tierModal) tierModal.addEventListener('click', (e) => { if (e.target === tierModal) hideTierModal(); });

  window.showTierIntro = showTierIntro;

  console.log('BADUZ UI initialized successfully!');
});

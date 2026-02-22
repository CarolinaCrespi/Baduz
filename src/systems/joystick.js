/* =========================================================
   BADUZ – Virtual Joystick
   Extracted from ui.js. Handles touch/pointer input and
   exposes window.mobileInput for the Phaser scene to read.
   ========================================================= */

function setupVirtualJoystick() {
  const joystickBase = document.querySelector('.joystick-base');
  const joystickCap  = document.querySelector('.joystick-cap');
  if (!joystickBase || !joystickCap) return;

  window.mobileInput = window.mobileInput || { dir: null, analog: null };

  let isActive = false;
  let activePointerId = null;

  function getCenter() {
    const r = joystickBase.getBoundingClientRect();
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

    const analogX = moveX / maxDist;
    const analogY = moveY / maxDist;
    window.mobileInput.analog = { x: analogX, y: analogY };

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
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    activePointerId = e.pointerId;
    isActive = true;
    joystickBase.classList.add('active');
    joystickBase.setPointerCapture?.(e.pointerId);
    // Prevent text selection while dragging
    document.body.style.userSelect = '-webkit-user-select';
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    if (window.getSelection) window.getSelection().removeAllRanges();
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
    // Restore text selection
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
  }

  joystickBase.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startJoystick(e);
  });

  window.addEventListener('pointermove', (e) => {
    if (!isActive) return;
    e.preventDefault();
    moveJoystick(e);
  }, { passive: false });

  window.addEventListener('pointerup',     (e) => stopJoystick(e));
  window.addEventListener('pointercancel', (e) => stopJoystick(e));

  joystickBase.addEventListener('contextmenu', (e) => e.preventDefault());
  joystickBase.addEventListener('selectstart', (e) => e.preventDefault());
  joystickBase.addEventListener('dragstart',   (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => {
    if (isActive) e.preventDefault();
  });
}

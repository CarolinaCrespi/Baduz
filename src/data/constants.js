/* =========================================================
   BADUZ – Constants & Configuration
   Extracted from demo.js for clean separation of concerns.
   ========================================================= */

const STORAGE_PLAYER_KEY = 'baduz-player-name';

const IS_MOBILE_VIEW = typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(max-width: 768px)').matches;

const TILE_SIZE = 50;
const PLAYER_SPEED = 230;

// Enable snapping of analog joystick input to 8 directions.
const SNAP_8_DIR = true;

// Score tuning
const SCORE_K = 10;
const SCORE_ALPHA = 1.25;
const SCORE_EPS = 0.8;

const HINT_COST = 3;

// Cyberpunk color palette
const CYBER_CYAN    = 0x00f3ff;
const CYBER_MAGENTA = 0xff00ff;
const CYBER_GREEN   = 0x00ff9d;
const CYBER_BLUE    = 0x0066ff;
const CYBER_PURPLE  = 0x9d00ff;
const CYBER_RED     = 0xff0066;
const CYBER_YELLOW  = 0xffea00;
const CYBER_GRAY    = 0xc5c9d3;

// Player visuals
const BALL_COLOR        = CYBER_MAGENTA;
const BALL_GLOW_COLOR   = 0xff99ff;
const BALL_GLOW_WIDTHS  = [10, 5, 2];
const BALL_GLOW_ALPHAS  = [0.15, 0.35, 0.8];

// Orb visuals
const ORB_FILL_COLOR    = CYBER_GREEN;
const ORB_STROKE_COLOR  = 0x33ffaa;
const ORB_PULSE_OPACITY = 0.25;

// Hint path visuals
const HINT_GLOW_COLORS  = [CYBER_GREEN, 0x00ff66, 0x00ff66];
const HINT_GLOW_WIDTHS  = [10, 6, 3];
const HINT_GLOW_ALPHAS  = [0.15, 0.35, 0.9];

// Maze wall color
const WALL_FILL_COLOR = 0x1b0b33;

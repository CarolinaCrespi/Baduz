/* =========================================================
   BADUZ – Scoring System
   ========================================================= */

function computeLevelScore(level, elapsedMs) {
  const tSec = Math.max(0, elapsedMs / 1000);
  const raw = (SCORE_K * Math.pow(level, SCORE_ALPHA)) / (tSec + SCORE_EPS);
  return Math.max(1, Math.round(raw));
}

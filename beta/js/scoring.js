export const SCORE_K = 5;
export const SCORE_ALPHA = 1.0;
export const SCORE_EPS = 1.0;
export const HINT_COST = 3;

export function computeLevelScore(level, elapsedMs){
  const tSec = Math.max(0, elapsedMs / 1000);
  const raw = SCORE_K * Math.pow(level, SCORE_ALPHA) / (tSec + SCORE_EPS);
  return Math.max(1, Math.round(raw));
}

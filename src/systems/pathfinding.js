/* =========================================================
   BADUZ – Pathfinding (BFS)
   Used by the hint system and hazard path protection.
   ========================================================= */

/**
 * BFS from the player's current grid position to the exit.
 * Returns an array of {x, y} grid cells or null if no path.
 */
function findPath(mazeLayout, playerX, playerY, offsetX, offsetY, tileSize, exit) {
  const size = mazeLayout.length;
  const start = {
    x: Math.floor((playerX - offsetX) / tileSize),
    y: Math.floor((playerY - offsetY) / tileSize)
  };
  const end = exit;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const key = (x, y) => `${x},${y}`;
  const queue = [start];
  const seen = new Set([key(start.x, start.y)]);
  const prev = {};

  while (queue.length) {
    const current = queue.shift();
    if (current.x === end.x && current.y === end.y) {
      const path = [];
      let cur = current;
      while (cur) {
        path.unshift(cur);
        cur = prev[key(cur.x, cur.y)];
      }
      return path;
    }

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nKey = key(nx, ny);
      if (nx >= 0 && ny >= 0 && nx < size && ny < size &&
          mazeLayout[ny][nx] === 1 && !seen.has(nKey)) {
        seen.add(nKey);
        prev[nKey] = current;
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return null;
}

/**
 * BFS between two arbitrary grid points.
 * Used to protect the solution path from hazard placement.
 */
function computePathCells(mazeLayout, start, end) {
  const size = mazeLayout.length;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const key = (x, y) => `${x},${y}`;
  const queue = [{ x: start.x, y: start.y }];
  const seen = new Set([key(start.x, start.y)]);
  const prev = {};

  while (queue.length) {
    const current = queue.shift();
    if (current.x === end.x && current.y === end.y) {
      const path = [];
      let cur = current;
      while (cur) {
        path.unshift(cur);
        cur = prev[key(cur.x, cur.y)];
      }
      return path;
    }
    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (mazeLayout[ny][nx] !== 1) continue;
      const nK = key(nx, ny);
      if (seen.has(nK)) continue;
      seen.add(nK);
      prev[nK] = current;
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

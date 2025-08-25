import { mulberry32 } from './rng.js';

export function generateMaze(level, seed){
  const rng = mulberry32(seed);
  const size = 5 + level * 2;
  const maze = Array(size).fill().map(()=>Array(size).fill(0));
  generatePrimMaze(maze, rng);
  const [start, end] = placeEntranceExit(maze, rng);
  return { maze, entrance:{x:start.x,y:start.y}, exit:{x:end.x,y:end.y}, size };
}

function generatePrimMaze(maze, rng){
  const size = maze.length;
  let walls = [];
  const possible = [];
  for (let y=1; y<size-1; y+=2){
    for (let x=1; x<size-1; x+=2){ possible.push({x,y}); }
  }
  const startCell = possible[Math.floor(rng() * possible.length)];
  maze[startCell.y][startCell.x] = 1;
  addWalls(startCell.x, startCell.y, maze, walls);

  while (walls.length > 0){
    const randomIndex = Math.floor(rng() * walls.length);
    const wall = walls.splice(randomIndex, 1)[0];
    const { wx, wy, cx, cy } = wall;
    if (maze[cy][cx] === 0){
      maze[wy][wx] = 1;
      maze[cy][cx] = 1;
      addWalls(cx, cy, maze, walls);
    }
  }
}

function addWalls(x, y, maze, walls){
  const size = maze.length;
  const dirs = [ {dx:0,dy:-2}, {dx:0,dy:2}, {dx:-2,dy:0}, {dx:2,dy:0} ];
  dirs.forEach(d=>{
    const nx=x+d.dx, ny=y+d.dy;
    if (nx>0 && nx<size-1 && ny>0 && ny<size-1 && maze[ny][nx]===0){
      const wx=x+d.dx/2, wy=y+d.dy/2;
      walls.push({ wx, wy, cx:nx, cy:ny });
    }
  });
}

function placeEntranceExit(maze, rng){
  const size = maze.length;
  const isTopBottom = rng() < 0.5;
  let start, end;
  if (isTopBottom){
    const odd=[]; for (let x=1; x<size-1; x+=2) odd.push(x);
    const ex = odd[Math.floor(rng()*odd.length)];
    start = {x:ex,y:0}; end = {x:ex,y:size-1};
    maze[1][ex]=1; maze[size-2][ex]=1;
  } else {
    const odd=[]; for (let y=1; y<size-1; y+=2) odd.push(y);
    const ey = odd[Math.floor(rng()*odd.length)];
    start = {x:0,y:ey}; end = {x:size-1,y:ey};
    maze[ey][1]=1; maze[ey][size-2]=1;
  }
  maze[start.y][start.x]=1; maze[end.y][end.x]=1;
  return [start,end];
}

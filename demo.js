const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#999999',
    physics: { 
        default: 'arcade', 
        arcade: { 
            gravity: { y: 0 },
            debug: false
        } 
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let ant, cursors, topWalls, currentLevel = 1;
const tileSize = 50;
let mazeLayout = [];
let entrance, exit;
let startTime = 0;     
let timerStarted = false; 
let antStartPos = { x: 0, y: 0 }; 


function preload() {
    this.load.image('wall', 'https://upload.wikimedia.org/wikipedia/commons/5/50/Black_colour.jpg');
}

function create() {
    const mazeData = generateMaze(currentLevel);
    mazeLayout = mazeData.maze;
    entrance = mazeData.entrance;
    exit = mazeData.exit;
    const size = mazeData.size;

    this.physics.world.setBounds(0, 0, size * tileSize, size * tileSize);

    topWalls = this.physics.add.staticGroup();
    
    let startPos = { x: 0, y: 0 };
    let exitPos = { x: 0, y: 0 };

    document.getElementById('level-display').textContent = `Livello: ${currentLevel}`;

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const x = col * tileSize;
            const y = row * tileSize;
            if (mazeLayout[row][col] === 0) {
                const wall = this.add.image(x + tileSize / 2, y + tileSize / 2, 'wall');
                wall.setDisplaySize(tileSize, tileSize);
                this.physics.add.existing(wall, true);
                topWalls.add(wall);
            } else {
                if (row === entrance.y && col === entrance.x) {
                    startPos = { x: x + tileSize / 2, y: y + tileSize / 2 };
                    this.add.text(x + 5, y + 5, 'START', {
                        fontSize: '13px',
                        fill: '#00ff00',
                        fontFamily: 'Arial',
                        stroke: '#000',
                        strokeThickness: 2
                    });
                }
                if (row === exit.y && col === exit.x) {
                    exitPos = { x: x + tileSize / 2, y: y + tileSize / 2 };
                    this.add.text(x + 5, y + 5, 'EXIT', {
                        fontSize: '13px',
                        fill: '#ff0000',
                        fontFamily: 'Arial',
                        stroke: '#000',
                        strokeThickness: 2
                    });
                }
            }
        }
    }

    if (ant) ant.destroy();
    ant = this.add.circle(startPos.x, startPos.y, 10, 0xff0000);
    this.physics.add.existing(ant, false);
    ant.body.setCircle(10);
    ant.body.setCollideWorldBounds(true);
    ant.body.setBounce(0);
    this.physics.add.collider(ant, topWalls);

    this.cameras.main.startFollow(ant, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);

    cursors = this.input.keyboard.createCursorKeys();

    const exitZone = this.add.zone(exitPos.x, exitPos.y, tileSize, tileSize);
    this.physics.add.existing(exitZone, true);
    this.physics.add.overlap(ant, exitZone, nextLevel, null, this);

    antStartPos = { x: startPos.x, y: startPos.y };
    timerStarted = false;
    startTime = 0;
}

function update() {
    ant.body.setVelocity(0);
    if (cursors.left.isDown) ant.body.setVelocityX(-200);
    if (cursors.right.isDown) ant.body.setVelocityX(200);
    if (cursors.up.isDown) ant.body.setVelocityY(-200);
    if (cursors.down.isDown) ant.body.setVelocityY(200);

    if (!timerStarted) {
        if (Math.abs(ant.x - antStartPos.x) > 4 || Math.abs(ant.y - antStartPos.y) > 4) {
            startTime = Date.now();
            timerStarted = true;
        }
    }

    if (timerStarted) {
        const elapsedMilliseconds = Date.now() - startTime;
        const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('timer-display').textContent = `Timer: ${formattedTime}`;
    }
}

let isGameOver = false;
let totalTime = 0;
function nextLevel() {
    if (timerStarted) {
        const levelTime = Date.now() - startTime;
        totalTime += levelTime;
    }

    currentLevel++;

    if (currentLevel > 10) {
        isGameOver = true;
        this.cameras.main.stopFollow();
        this.cameras.main.centerOn(game.config.width/2, game.config.height/2);
        
        const totalSeconds = Math.floor(totalTime / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const formattedTotal = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const demoEndText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            'DEMO COMPLETED!\nThank you for playing!',
            { 
                fontSize: '40px', 
                fill: '#ffffff', 
                fontFamily: 'Arial',
                backgroundColor: '#000000',
                padding: { x: 20, y: 15 },
                align: 'center'
            }
        )
        .setOrigin(0.5)
        .setDepth(1000)
        .setScrollFactor(0);

        this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 70,
            `Total Time: ${formattedTotal}`,
            {
                fontSize: '24px',
                fill: '#00ff00',
                fontFamily: 'Arial',
                stroke: '#000',
                strokeThickness: 2
            }
        )
        .setOrigin(0.5)
        .setScrollFactor(0);

        currentLevel = 10;
        this.physics.pause();
        ant.body.setVelocity(0);
        return;
    }

    isGameOver = false;
    timerStarted = false;
    startTime = 0;
    document.getElementById('timer-display').textContent = 'Timer: 00:00:00';
    this.scene.restart();
}

function update() {
    if (isGameOver) return;
    
    ant.body.setVelocity(0);
    if (cursors.left.isDown) ant.body.setVelocityX(-200);
    if (cursors.right.isDown) ant.body.setVelocityX(200);
    if (cursors.up.isDown) ant.body.setVelocityY(-200);
    if (cursors.down.isDown) ant.body.setVelocityY(200);

    if (!timerStarted) {
        if (Math.abs(ant.x - antStartPos.x) > 4 || Math.abs(ant.y - antStartPos.y) > 4) {
            startTime = Date.now();
            timerStarted = true;
        }
    }

    if (timerStarted) {
        const elapsedMilliseconds = Date.now() - startTime;
        const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('timer-display').textContent = `Livello ${currentLevel}: ${formattedTime}`;
    }
}

function update() {
    if (isGameOver) return; 
    
    ant.body.setVelocity(0);
    if (cursors.left.isDown) ant.body.setVelocityX(-200);
    if (cursors.right.isDown) ant.body.setVelocityX(200);
    if (cursors.up.isDown) ant.body.setVelocityY(-200);
    if (cursors.down.isDown) ant.body.setVelocityY(200);

    if (!timerStarted) {
        if (Math.abs(ant.x - antStartPos.x) > 4 || Math.abs(ant.y - antStartPos.y) > 4) {
            startTime = Date.now();
            timerStarted = true;
        }
    }

    if (timerStarted) {
        const elapsedMilliseconds = Date.now() - startTime;
        const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('timer-display').textContent = `Timer: ${formattedTime}`;
    }
}

if (row === exit.y && col === exit.x) {
    const exitText = currentLevel === 10 ? 'FINE' : 'EXIT'; 
    this.add.text(x + 5, y + 5, exitText, {
        fontSize: '13px',
        fill: currentLevel === 10? '#ff9900' : '#ff0000', 
        fontFamily: 'Arial',
        stroke: '#000',
        strokeThickness: 2
    });
}

function generateMaze(level) {
    const size = 5 + level * 2; 
    const maze = Array(size).fill().map(() => Array(size).fill(0));

    generatePrimMaze(maze);

    const [start, end] = placeEntranceExit(maze);

    return {
        maze: maze,
        entrance: { x: start.x, y: start.y },
        exit: { x: end.x, y: end.y },
        size: size
    };
}

function generatePrimMaze(maze) {
    const size = maze.length;
    let walls = [];
    const possibleCells = [];
    for (let y = 1; y < size - 1; y += 2) {
        for (let x = 1; x < size - 1; x += 2) {
            possibleCells.push({ x: x, y: y });
        }
    }
    const startCell = possibleCells[Math.floor(Math.random() * possibleCells.length)];
    maze[startCell.y][startCell.x] = 1;
    addWalls(startCell.x, startCell.y, maze, walls);

    while (walls.length > 0) {
        const randomIndex = Math.floor(Math.random() * walls.length);
        const wall = walls.splice(randomIndex, 1)[0];
        const { wx, wy, cx, cy } = wall;
        if (maze[cy][cx] === 0) {
            maze[wy][wx] = 1;
            maze[cy][cx] = 1;
            addWalls(cx, cy, maze, walls);
        }
    }
}

function addWalls(x, y, maze, walls) {
    const size = maze.length;
    const directions = [
        { dx: 0, dy: -2 },
        { dx: 0, dy: 2 },
        { dx: -2, dy: 0 },
        { dx: 2, dy: 0 }
    ];
    directions.forEach(d => {
        const nx = x + d.dx;
        const ny = y + d.dy;
        if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && maze[ny][nx] === 0) {
            const wx = x + d.dx / 2;
            const wy = y + d.dy / 2;
            walls.push({ wx: wx, wy: wy, cx: nx, cy: ny });
        }
    });
}

function placeEntranceExit(maze) {
    const size = maze.length;
    const isTopBottom = Math.random() < 0.5;
    let start, end;
    if (isTopBottom) {
        const oddOptions = [];
        for (let x = 1; x < size - 1; x += 2) {
            oddOptions.push(x);
        }
        const entranceX = oddOptions[Math.floor(Math.random() * oddOptions.length)];
        start = { x: entranceX, y: 0 };
        end = { x: entranceX, y: size - 1 };
        maze[1][entranceX] = 1;
        maze[size - 2][entranceX] = 1;
    } else {
        const oddOptions = [];
        for (let y = 1; y < size - 1; y += 2) {
            oddOptions.push(y);
        }
        const entranceY = oddOptions[Math.floor(Math.random() * oddOptions.length)];
        start = { x: 0, y: entranceY };
        end = { x: size - 1, y: entranceY };
        maze[entranceY][1] = 1;
        maze[entranceY][size - 2] = 1;
    }
    maze[start.y][start.x] = 1;
    maze[end.y][end.x] = 1;
    return [start, end];
}

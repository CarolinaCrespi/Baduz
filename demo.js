class MazeScene extends Phaser.Scene {
    constructor() {
      super('MazeScene');
    }
  
    init(data) {

      this.currentLevel =
        data && data.currentLevel !== undefined ? data.currentLevel : 1;
      this.totalTime =
        data && data.totalTime !== undefined ? data.totalTime : 0;
      this.isGameOver = false;
      this.paused = false;
  

      this.tileSize = 50;
      this.mazeLayout = [];
      this.timerStarted = false;
      this.startTime = 0;
      this.antStartPos = { x: 0, y: 0 };
    }
  
    create() {
      const mazeData = this.generateMaze(this.currentLevel);
      this.mazeLayout = mazeData.maze;
      this.entrance = mazeData.entrance;
      this.exit = mazeData.exit;
      const size = mazeData.size;
  
      this.physics.world.setBounds(0, 0, size * this.tileSize, size * this.tileSize);
      this.topWalls = this.physics.add.staticGroup();
  
      let startPos = { x: 0, y: 0 };
      let exitPos = { x: 0, y: 0 };
  
      document.getElementById('levelDisplay').textContent = `${this.currentLevel}`;
  
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const x = col * this.tileSize;
          const y = row * this.tileSize;
          if (this.mazeLayout[row][col] === 0) {
            const wall = this.add.rectangle(
              x + this.tileSize / 2,
              y + this.tileSize / 2,
              this.tileSize,
              this.tileSize,
              0x000000
            );
            wall.setStrokeStyle(2, 0x00FFFF);
            this.physics.add.existing(wall, true);
            this.topWalls.add(wall);
          } else {
            if (row === this.entrance.y && col === this.entrance.x) {
              startPos = { x: x + this.tileSize / 2, y: y + this.tileSize / 2 };
              this.add.text(x + 5, y + 5, 'START', {
                fontSize: '13px',
                fill: '#00ff00',
                fontFamily: 'Arial',
                stroke: '#000',
                strokeThickness: 2
              });
            }
            if (row === this.exit.y && col === this.exit.x) {
              exitPos = { x: x + this.tileSize / 2, y: y + this.tileSize / 2 };
              const exitText = this.currentLevel === 10 ? 'FINE' : 'EXIT';
              const exitColor = this.currentLevel === 10 ? '#ff9900' : '#ff0000';
              this.add.text(x + 5, y + 5, exitText, {
                fontSize: '13px',
                fill: exitColor,
                fontFamily: 'Arial',
                stroke: '#000',
                strokeThickness: 2
              });
            }
          }
        }
      }
  
      if (this.ant) this.ant.destroy();
      this.ant = this.add.circle(startPos.x, startPos.y, 10, 0xff00ff);
      this.physics.add.existing(this.ant, false);
      this.ant.body.setCircle(10);
      this.ant.body.setCollideWorldBounds(true);
      this.ant.body.setBounce(0);
      this.physics.add.collider(this.ant, this.topWalls);
  
      this.cameras.main.startFollow(this.ant, true, 0.1, 0.1);
      this.cameras.main.setZoom(1);
      this.cursors = this.input.keyboard.createCursorKeys();
  
      const exitZone = this.add.zone(exitPos.x, exitPos.y, this.tileSize, this.tileSize);
      this.physics.add.existing(exitZone, true);
      this.physics.add.overlap(this.ant, exitZone, this.nextLevel, null, this);
  
      this.antStartPos = { x: startPos.x, y: startPos.y };
      this.timerStarted = false;
      this.startTime = 0;
      document.getElementById('timer-display').textContent = '00:00:00';
  
      this.input.keyboard.on('keydown-P', this.togglePause, this);
    }
  
    update() {
      if (this.isGameOver || this.paused) return;
  
      this.ant.body.setVelocity(0);
      if (this.cursors.left.isDown) this.ant.body.setVelocityX(-200);
      if (this.cursors.right.isDown) this.ant.body.setVelocityX(200);
      if (this.cursors.up.isDown) this.ant.body.setVelocityY(-200);
      if (this.cursors.down.isDown) this.ant.body.setVelocityY(200);
  
      if (!this.timerStarted) {
        if (
          Math.abs(this.ant.x - this.antStartPos.x) > 4 ||
          Math.abs(this.ant.y - this.antStartPos.y) > 4
        ) {
          this.startTime = Date.now();
          this.timerStarted = true;
        }
      }
  
      if (this.timerStarted) {
        const elapsedMilliseconds = Date.now() - this.startTime;
        const formattedTime = this.formatTime(elapsedMilliseconds);
        document.getElementById('timer-display').textContent = `${formattedTime}`;
      }
    }
  
    togglePause() {
        if (!this.paused) {
          this.paused = true;
          this.pauseStart = Date.now();
          this.physics.pause();
      

          if (this.pauseText) {
            this.pauseText.destroy();  
          }
      
          this.pauseText = this.add.text(
            this.cameras.main.centerX,  
            this.cameras.main.centerY,  
            "PAUSE",                   
            {
              fontSize: '100px',
              fill: '#00feff',
              fontFamily: 'Arial',
            }
          ).setOrigin(1.5);  
        } else {
          this.paused = false;
          const pausedDuration = Date.now() - this.pauseStart;
          if (this.timerStarted) {
            this.startTime += pausedDuration;
          }
          this.physics.resume();
      
          if (this.pauseText) {
            this.pauseText.destroy();
          }
        }
      }
      
  
    formatTime(elapsedMilliseconds) {
      const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  
    nextLevel() {
      if (this.timerStarted) {
        const levelTime = Date.now() - this.startTime;
        this.totalTime += levelTime;
      }
  
      this.currentLevel++;
  
      if (this.currentLevel > 10) {
        this.isGameOver = true;
        this.cameras.main.stopFollow();
        this.cameras.main.centerOn(this.game.config.width / 2, this.game.config.height / 2);
  
        const totalSeconds = Math.floor(this.totalTime / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const formattedTotal = `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
        this.add.text(
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
  
        this.currentLevel = 11;
        this.physics.pause();
        this.ant.body.setVelocity(0);
        return;
      }
  
      this.isGameOver = false;
      this.timerStarted = false;
      this.startTime = 0;
      document.getElementById('timer-display').textContent = '00:00:00';
      
      this.scene.restart({
        currentLevel: this.currentLevel,
        totalTime: this.totalTime
      });
    }
  
    generateMaze(level) {
      const size = 5 + level * 2;
      const maze = Array(size).fill().map(() => Array(size).fill(0));
  
      this.generatePrimMaze(maze);
      const [start, end] = this.placeEntranceExit(maze);
  
      return {
        maze: maze,
        entrance: { x: start.x, y: start.y },
        exit: { x: end.x, y: end.y },
        size: size
      };
    }
  
    generatePrimMaze(maze) {
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
      this.addWalls(startCell.x, startCell.y, maze, walls);
  
      while (walls.length > 0) {
        const randomIndex = Math.floor(Math.random() * walls.length);
        const wall = walls.splice(randomIndex, 1)[0];
        const { wx, wy, cx, cy } = wall;
        if (maze[cy][cx] === 0) {
          maze[wy][wx] = 1;
          maze[cy][cx] = 1;
          this.addWalls(cx, cy, maze, walls);
        }
      }
    }
  
    addWalls(x, y, maze, walls) {
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
  
    placeEntranceExit(maze) {
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
  }
  
  const config = {
    type: Phaser.CANVAS,
    width: 800,
    height: 500,
    canvas: document.getElementById('gameCanvas'),
    backgroundColor: '#999999',
    physics: { 
      default: 'arcade',
      arcade: { 
        gravity: { y: 0 },
        debug: false
      }
    },
    scene: MazeScene
  };
  
  const game = new Phaser.Game(config);

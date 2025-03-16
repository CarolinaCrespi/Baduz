// Configurazione base del gioco Phaser
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

// Variabili globali
let ant, cursors, topWalls, currentLevel = 1;
const tileSize = 50;
let mazeLayout = [];
let entrance, exit;
let startTime = 0;      // Tempo d'inizio del livello (quando la formica lascia lo start)
let timerStarted = false; // Flag per indicare se il timer è stato avviato
let antStartPos = { x: 0, y: 0 };  // Memorizza la posizione di partenza della formica

/*
  Funzione preload: carica le risorse necessarie.
*/
function preload() {
    this.load.image('wall', 'https://upload.wikimedia.org/wikipedia/commons/5/50/Black_colour.jpg');
}

/*
  Funzione create: inizializza il labirinto, posiziona i muri, la formica (ant)
  e configura le collisioni, la camera e la zona per passare al livello successivo.
*/
function create() {
    // Genera il labirinto per il livello corrente
    const mazeData = generateMaze(currentLevel);
    mazeLayout = mazeData.maze;
    entrance = mazeData.entrance;
    exit = mazeData.exit;
    const size = mazeData.size;

    // Imposta i limiti del mondo fisico in base alle dimensioni del labirinto
    this.physics.world.setBounds(0, 0, size * tileSize, size * tileSize);

    // Crea il gruppo statico per i muri
    topWalls = this.physics.add.staticGroup();

    // Variabili per le posizioni di START ed EXIT
    let startPos = { x: 0, y: 0 };
    let exitPos = { x: 0, y: 0 };

    // Aggiorna il display del livello in HTML
    document.getElementById('level-display').textContent = `Livello: ${currentLevel}`;

    // Disegna il labirinto: muri e celle libere, e aggiunge i testi START/EXIT
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const x = col * tileSize;
            const y = row * tileSize;
            if (mazeLayout[row][col] === 0) {
                // Crea il muro
                const wall = this.add.image(x + tileSize / 2, y + tileSize / 2, 'wall');
                wall.setDisplaySize(tileSize, tileSize);
                this.physics.add.existing(wall, true);
                topWalls.add(wall);
            } else {
                // Se la cella è libera, controlla se è START o EXIT
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

    
    // Posiziona la formica all'entrata e configura le collisioni
    if (ant) ant.destroy();
    ant = this.add.circle(startPos.x, startPos.y, 10, 0xff0000);
    this.physics.add.existing(ant, false);
    ant.body.setCircle(10);
    ant.body.setCollideWorldBounds(true);
    ant.body.setBounce(0);
    this.physics.add.collider(ant, topWalls);

    // La telecamera segue la formica
    this.cameras.main.startFollow(ant, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);

    cursors = this.input.keyboard.createCursorKeys();

    // Zona invisibile sull'uscita per passare al livello successivo
    const exitZone = this.add.zone(exitPos.x, exitPos.y, tileSize, tileSize);
    this.physics.add.existing(exitZone, true);
    this.physics.add.overlap(ant, exitZone, nextLevel, null, this);

    // Memorizza la posizione iniziale della formica e resetta il timer
    antStartPos = { x: startPos.x, y: startPos.y };
    timerStarted = false;
    startTime = 0;
}

/*
  Funzione update: gestisce il movimento della formica in base all'input e aggiorna il timer.
*/
function update() {
    ant.body.setVelocity(0);
    if (cursors.left.isDown) ant.body.setVelocityX(-200);
    if (cursors.right.isDown) ant.body.setVelocityX(200);
    if (cursors.up.isDown) ant.body.setVelocityY(-200);
    if (cursors.down.isDown) ant.body.setVelocityY(200);

    // Avvia il timer solo se la formica si è spostata oltre una soglia di 5 pixel dallo start
    if (!timerStarted) {
        if (Math.abs(ant.x - antStartPos.x) > 4 || Math.abs(ant.y - antStartPos.y) > 4) {
            startTime = Date.now();
            timerStarted = true;
        }
    }

    // Se il timer è partito, calcola e aggiorna il display in formato HH:MM:SS
    if (timerStarted) {
        const elapsedMilliseconds = Date.now() - startTime;
        const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        // Format con due cifre per ciascuna unità
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('timer-display').textContent = `Timer: ${formattedTime}`;
    }
}


/*
  Funzione nextLevel: passa al livello successivo e riavvia la scena.
*/
// Aggiungi una variabile globale per controllare lo stato del gioco
let isGameOver = false;

// Aggiungi una variabile globale per il tempo totale
let totalTime = 0;

// Modifica la funzione nextLevel
function nextLevel() {
    // Calcola il tempo del livello corrente e aggiungilo al totale
    if (timerStarted) {
        const levelTime = Date.now() - startTime;
        totalTime += levelTime;
    }

    currentLevel++;

    if (currentLevel > 7) {
        isGameOver = true;
        this.cameras.main.stopFollow();
        this.cameras.main.centerOn(game.config.width/2, game.config.height/2);
        
        // Converti il tempo totale in formato leggibile
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

    // Reset per il nuovo livello
    isGameOver = false;
    timerStarted = false;
    startTime = 0;
    document.getElementById('timer-display').textContent = 'Timer: 00:00:00';
    this.scene.restart();
}

// Modifica la funzione update per mostrare solo il timer del livello corrente
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

    // Mostra solo il timer del livello corrente
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

// Modifica la funzione update per fermare il timer
function update() {
    if (isGameOver) return; // Blocca ogni movimento e aggiornamento
    
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

    // Il resto del codice del timer rimane invariato
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

// Modifica nel loop di creazione del labirinto (funzione create)
if (row === exit.y && col === exit.x) {
    const exitText = currentLevel === 10 ? 'FINE' : 'EXIT'; // Cambia testo per livello 10
    this.add.text(x + 5, y + 5, exitText, {
        fontSize: '13px',
        fill: currentLevel === 7? '#ff9900' : '#ff0000', // Colore diverso per FINE
        fontFamily: 'Arial',
        stroke: '#000',
        strokeThickness: 2
    });
}

/* ============================================================
   Sistema di generazione labirinti con algoritmo di Prim
   ============================================================ */

/*
  generateMaze:
  - Calcola la dimensione in funzione del livello
  - Inizializza il labirinto pieno di muri (0 = muro, 1 = percorso)
  - Genera il labirinto usando l'algoritmo di Prim randomizzato
  - Posiziona l'entrata e l'uscita sul perimetro, collegandole al labirinto
*/
function generateMaze(level) {
    const size = 5 + level * 2; // Dimensione crescente linearmente
    // Inizializza il labirinto pieno di muri
    const maze = Array(size).fill().map(() => Array(size).fill(0));

    // Genera il labirinto interno con Prim randomizzato
    generatePrimMaze(maze);

    // Posiziona entrance ed exit sul perimetro e assicura la connessione con l'interno
    const [start, end] = placeEntranceExit(maze);

    return {
        maze: maze,
        entrance: { x: start.x, y: start.y },
        exit: { x: end.x, y: end.y },
        size: size
    };
}

/*
  generatePrimMaze:
  - Seleziona una cella iniziale casuale (tra quelle interne con coordinate dispari)
  - Aggiunge i "muri" adiacenti alla cella di partenza in una lista
  - Finché la lista non è vuota, sceglie a caso un muro e, se la cella oltre il muro è ancora un muro,
    apre il muro e la cella, aggiungendo i nuovi muri adiacenti alla lista
*/
function generatePrimMaze(maze) {
    const size = maze.length;
    let walls = [];

    // Crea un array di celle interne disponibili (coordinate dispari)
    const possibleCells = [];
    for (let y = 1; y < size - 1; y += 2) {
        for (let x = 1; x < size - 1; x += 2) {
            possibleCells.push({ x: x, y: y });
        }
    }
    // Sceglie una cella iniziale casuale
    const startCell = possibleCells[Math.floor(Math.random() * possibleCells.length)];
    maze[startCell.y][startCell.x] = 1;
    addWalls(startCell.x, startCell.y, maze, walls);

    while (walls.length > 0) {
        // Sceglie a caso una parete dalla lista
        const randomIndex = Math.floor(Math.random() * walls.length);
        const wall = walls.splice(randomIndex, 1)[0];
        const { wx, wy, cx, cy } = wall;
        // Se la cella oltre il muro non è ancora stata aperta, crea un percorso
        if (maze[cy][cx] === 0) {
            maze[wy][wx] = 1;
            maze[cy][cx] = 1;
            addWalls(cx, cy, maze, walls);
        }
    }
}

/*
  addWalls:
  - Dato un punto (x, y) già aperto, aggiunge alla lista i muri adiacenti,
    considerando le celle a distanza due (in verticale e orizzontale)
*/
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
        // Verifica che la cella destinazione sia all'interno e ancora chiusa
        if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && maze[ny][nx] === 0) {
            const wx = x + d.dx / 2;
            const wy = y + d.dy / 2;
            walls.push({ wx: wx, wy: wy, cx: nx, cy: ny });
        }
    });
}

/*
  placeEntranceExit:
  - Sceglie casualmente se posizionare l'entrata e l'uscita sui lati top-bottom o left-right
  - Imposta le celle sul perimetro come percorsi (1) e forza la connessione
    tra il labirinto interno e gli ingressi/uscite
*/
function placeEntranceExit(maze) {
    const size = maze.length;
    const isTopBottom = Math.random() < 0.5;
    let start, end;
    if (isTopBottom) {
        // Sceglie un valore dispari casuale per la colonna
        const oddOptions = [];
        for (let x = 1; x < size - 1; x += 2) {
            oddOptions.push(x);
        }
        const entranceX = oddOptions[Math.floor(Math.random() * oddOptions.length)];
        start = { x: entranceX, y: 0 };
        end = { x: entranceX, y: size - 1 };
        // Collega la cella interna adiacente all'entrata e all'uscita
        maze[1][entranceX] = 1;
        maze[size - 2][entranceX] = 1;
    } else {
        // Sceglie un valore dispari casuale per la riga
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
    // Rende effettivamente le aperture sul perimetro
    maze[start.y][start.x] = 1;
    maze[end.y][end.x] = 1;
    return [start, end];
}

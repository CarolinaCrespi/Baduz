# Baduz – A Maze Challenge

Baduz is a maze navigation game where you control a glowing ball named Baduz and guide it to the exit while avoiding walls and obstacles. The game features procedurally generated mazes, increasing in size and difficulty as you progress.

🚀 Current Version: Extended Demo  
The demo features 20 levels, offering a progressively challenging experience with new mechanics introduced every 5 levels.

---

## ✨ What's New

- Collectible Orbs scattered through the maze.
- Use your Orbs to unlock Hints that reveal a glowing path to the exit (BFS pathfinding).
- 4 tiers of mechanics: Basic navigation → Key & Door → Ice & Friction zones → Hazards & Jump.
- Virtual joystick for mobile with fixed text-selection bug.
- Bilingual UI (Italian / English).

---

## 🎯 How to Play

- Move Baduz with the **arrow keys** (or WASD) to reach the exit.
- Collect **Orbs** to unlock hints when you're stuck (costs 3 orbs).
- The timer starts when Baduz begins moving — finish as fast as you can!
- Press **H** for hint, **P** to pause, **R** to reset the level, **J** to jump (levels 16–20).

---

## 📁 Project Structure

```
baduz/
├── index.html              # Main HTML (updated script order)
├── style.css               # All styles
├── ui.js                   # DOM events: modals, buttons, HUD, language
├── favicon.ico
└── src/
    ├── data/
    │   └── constants.js    # Colors, speeds, game config
    ├── i18n/
    │   └── translations.js # IT / EN strings (extracted from ui.js)
    ├── systems/
    │   ├── rng.js          # Seeded RNG (mulberry32)
    │   ├── scoring.js      # Score formula
    │   ├── player.js       # Player name management
    │   ├── pathfinding.js  # BFS for hint & hazard protection
    │   └── joystick.js     # Virtual joystick (touch/pointer)
    └── scenes/
        ├── MazeScene.js    # Main Phaser 3 scene
        └── main.js         # Phaser initialization & resize
```

---

## 🚧 Roadmap

- Improved score system (orb bonuses, hint penalties)
- Screen shake & squash/stretch improvements
- Sound effects
- Leaderboard

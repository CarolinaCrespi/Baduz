/* =========================================================
   BADUZ – Translations (i18n)
   Extracted from ui.js for clean separation of data/logic.
   ========================================================= */

const translations = {
  en: {
    PLAYER: 'PLAYER',
    SCORE: 'SCORE',
    ORBS: 'ORBS',
    TIME: 'TIME',
    LEVEL: 'LEVEL',
    JUMP: 'JUMP',
    hint: 'Hint',
    jump: 'Jump',
    pause: 'Pause',
    reset: 'Reset',
    center: 'Center View',
    keyCollected: 'Key collected!',
    needKey: 'Find the key!',
    levelCleared: 'LEVEL CLEARED',
    hazard: 'Hazard!',
    tierOk: 'OK',
    tierTip: 'Press OK to start.',
    about: {
      title: 'ABOUT',
      lead: 'BADUZ is a neon sphere lost in a maze. Navigate the labyrinth, collect Energy Orbs, and find the exit as fast as you can.',
      tipLabel: 'Pro Tip',
      features: [
        { title: '20 Levels', desc: 'Progressively challenging mazes' },
        { title: 'Smart Hints', desc: 'Use Orbs to reveal paths' },
        { title: 'Score System', desc: 'Speed & efficiency matter' },
        { title: 'Cross-Platform', desc: 'Play anywhere' },
      ],
      controls: {
        move: 'Move Baduz',
        hint: 'Use Hint',
        pause: 'Pause Game',
        reset: 'Reset Level'
      },
      tip: 'Complete levels quickly for higher scores! The timer affects your final points.'
    },
    tiers: {
      t1: { name: 'FIRST STEPS', html: `
        <div class="tier-lead">Welcome to <b>BADUZ</b>. Explore the maze, collect <b>ORBS</b>, and find the <b>Exit</b>.</div>
        <div class="tier-feature-grid">
          <div class="tier-feature"><i class="fas fa-gem"></i><div><b>ORBS</b> <span class="pickup-swatch orb"></span><small>Collect them to score points and use hints</small></div></div>
          <div class="tier-feature"><i class="fas fa-door-open"></i><div><b>Exit</b><small>Reach it to clear the level</small></div></div>
          <div class="tier-feature"><i class="fas fa-route"></i><div><b>Hint</b><small><span class="kbd">H</span> costs <b>3</b> Orbs</small></div></div>
        </div>
        <div class="tier-tipline">Drag the maze to explore. Re-center the view to see BADUZ moving again.</div>
      ` },

      t2: { name: 'LOCK & KEY', html: `
        <div class="tier-lead">The exit is blocked. Explore the maze and find the <b>Key</b> to open the <b>Door</b>.</div>
        <div class="tier-feature-grid">
          <div class="tier-feature"><i class="fas fa-key"></i><div><b>Key</b> <span class="pickup-swatch key"></span><small>Collect it to unlock the door</small></div></div>
          <div class="tier-feature"><i class="fas fa-door-closed"></i><div><b>Door</b><small>Blocks the exit until you have the key</small></div></div>
          <div class="tier-feature"><i class="fas fa-gem"></i><div><b>ORBS</b> <span class="pickup-swatch orb"></span><small>Use them to get hints</small></div></div>
        </div>
        <div class="tier-tipline">If you see the exit but can't reach it, the key is still out there.</div>
      ` },

      t3: { name: 'ICE & FRICTION', html: `
        <div class="tier-lead">New terrain: movement control changes. Move carefully!</div>
        <div class="tier-feature-grid">
          <div class="tier-feature"><i class="fas fa-snowflake"></i><div><b>Ice</b> <span class="tile-swatch ice"></span><small>You slide easily — one extra push can send you off course</small></div></div>
          <div class="tier-feature"><i class="fas fa-person-walking"></i><div><b>Friction</b> <span class="tile-swatch slow"></span><small>Slows you down and wastes precious time</small></div></div>
          <div class="tier-feature"><i class="fas fa-crosshairs"></i><div><b>Control</b><small>Short, precise moves help on ice</small></div></div>
        </div>
        <div class="tier-tipline">Move carefully on ice. Avoid slow zones — every second matters.</div>
      ` },

      t4: { name: 'RED ZONE', html: `
        <div class="tier-lead">Some areas of the maze are deadly. Touching them resets the level.</div>
        <div class="tier-feature-grid">
          <div class="tier-feature"><i class="fas fa-triangle-exclamation"></i><div><b>Red Zone</b> <span class="tile-swatch hazard"></span><small>Entering it triggers an instant reset</small></div></div>
          <div class="tier-feature"><i class="fas fa-arrow-up"></i><div><b>Jump</b><small><span class="kbd">J</span> a quick dash to cross dangerous areas</small></div></div>
          <div class="tier-feature"><i class="fas fa-arrow-up"></i><div><b>Spring</b> <span class="pickup-swatch spring"></span><small>Collect it to gain +1 Jump charge</small></div></div>
        </div>
        <div class="tier-tipline">Jump follows your movement direction — timing is everything.</div>
      ` },
    }
  },

  it: {
    PLAYER: 'GIOCATORE',
    SCORE: 'PUNTEGGIO',
    ORBS: 'SFERE',
    TIME: 'TEMPO',
    LEVEL: 'LIVELLO',
    JUMP: 'SALTO',
    hint: 'Suggerimento',
    jump: 'Salto',
    pause: 'Pausa',
    reset: 'Ricomincia',
    center: 'Centra Vista',
    keyCollected: 'Chiave raccolta!',
    needKey: 'Trova la chiave!',
    levelCleared: 'LIVELLO COMPLETATO',
    hazard: 'Pericolo!',
    tierOk: 'OK',
    tierTip: 'Premi OK per iniziare.',
    about: {
      title: 'INFORMAZIONI',
      lead: 'BADUZ è una pallina neon persa in un labirinto. Esplora i corridoi, raccogli le Sfere di Energia e trova la via d\'uscita il più velocemente possibile.',
      tipLabel: 'Consiglio',
      features: [
        { title: '20 Livelli', desc: 'Labirinti sempre più impegnativi' },
        { title: 'Hint Intelligenti', desc: 'Usa le Sfere per rivelare il percorso' },
        { title: 'Sistema Punteggio', desc: 'Velocità ed efficienza contano' },
        { title: 'Cross-Platform', desc: 'Gioca ovunque' },
      ],
      controls: {
        move: 'Muovi Baduz',
        hint: 'Usa Suggerimento',
        pause: 'Pausa',
        reset: 'Ricomincia livello'
      },
      tip: 'Completa i livelli in fretta per punteggi più alti! Il timer incide sui punti finali.'
    },
    tiers: {
      t1: { name: 'PRIMI PASSI', html: `
        <div class="tier-lead">Benvenuto in <b>BADUZ</b>. Esplora il labirinto, raccogli le <b>SFERE</b> e trova l'<b>Uscita</b>.</div>
        <div class="tier-feature-grid">
          <div class="tier-feature"><i class="fas fa-gem"></i><div><b>SFERE</b> <span class="pickup-swatch orb"></span><small>Raccoglile per fare punti e usare i suggerimenti</small></div></div>
          <div class="tier-feature"><i class="fas fa-door-open"></i><div><b>Uscita</b><small>Raggiungila per completare il livello</small></div></div>
          <div class="tier-feature"><i class="fas fa-route"></i><div><b>Suggerimento</b><small><span class="kbd">H</span> costa <b>3</b> Sfere</small></div></div>
        </div>
        <div class="tier-tipline">Trascina il labirinto per esplorare. Ricentra la vista per rivedere BADUZ e riprendere il movimento.</div>
      ` },

      t2: { name: 'CHIAVE & PORTA', html: `
        <div class="tier-lead">L'uscita è bloccata. Esplora il labirinto e trova la <b>Chiave</b> per aprire la <b>Porta</b>.</div>
        <div class="tier-feature-grid">
          <div class="tier-feature"><i class="fas fa-key"></i><div><b>Chiave</b> <span class="pickup-swatch key"></span><small>Raccoglila per sbloccare la porta</small></div></div>
          <div class="tier-feature"><i class="fas fa-door-closed"></i><div><b>Porta</b><small>Ti impedisce di uscire finché non hai la chiave</small></div></div>
          <div class="tier-feature"><i class="fas fa-gem"></i><div><b>SFERE</b> <span class="pickup-swatch orb"></span><small>Usale per ottenere suggerimenti</small></div></div>
        </div>
        <div class="tier-tipline">Vedi l'uscita ma non puoi passare? La chiave è ancora da qualche parte.</div>
      ` },

      t3: { name: 'GHIACCIO & ATTRITO', html: `
        <div class="tier-lead">Nuovo terreno: il controllo del movimento cambia. Muoviti con attenzione!</div>
        <div class="tier-feature-grid">
          <div class="tier-feature"><i class="fas fa-snowflake"></i><div><b>Ghiaccio</b> <span class="tile-swatch ice"></span><small>Scivoli facilmente: una spinta di troppo e perdi direzione</small></div></div>
          <div class="tier-feature"><i class="fas fa-person-walking"></i><div><b>Attrito</b> <span class="tile-swatch slow"></span><small>Ti rallenta e fa perdere tempo prezioso</small></div></div>
          <div class="tier-feature"><i class="fas fa-crosshairs"></i><div><b>Controllo</b><small>Mosse brevi e precise aiutano sul ghiaccio</small></div></div>
        </div>
        <div class="tier-tipline">Sul ghiaccio muoviti piano. Evita le zone lente: ogni secondo conta.</div>
      ` },

      t4: { name: 'ZONA ROSSA', html: `
        <div class="tier-lead">Alcune aree del labirinto sono letali. Toccarle reimposta il livello.</div>
        <div class="tier-feature-grid">
          <div class="tier-feature"><i class="fas fa-triangle-exclamation"></i><div><b>Zona Rossa</b> <span class="tile-swatch hazard"></span><small>Entrarci provoca un reset immediato</small></div></div>
          <div class="tier-feature"><i class="fas fa-arrow-up"></i><div><b>Salto</b><small><span class="kbd">J</span> uno scatto rapido per attraversare zone pericolose</small></div></div>
          <div class="tier-feature"><i class="fas fa-arrow-up"></i><div><b>Molla</b> <span class="pickup-swatch spring"></span><small>Raccoglila per ottenere +1 carica Salto</small></div></div>
        </div>
        <div class="tier-tipline">Il salto segue la tua direzione di movimento: usalo con tempismo.</div>
      ` },
    }
  }
};

// ===== MAIN ENTRY POINT =====
// Wires together: UI, grid renderer, simulation engine, scoring, and levels.

const TICK_INTERVAL_MS = 160; // milliseconds between ticks (~6 ticks/sec)

let ui, grid, engine;
let currentLevel = null;
let tickTimer = null;
let hintTimer = null;
let tutorialPhase = 0;
let selectedDir = DIRS.RIGHT;
let eraseMode = false;

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  ui = new UIController();
  grid = new GridRenderer(document.getElementById('grid-canvas'));
  engine = new SimEngine();

  // Unlock level 1 by default
  unlockLevel(1);

  bindGlobalEvents();
  ui.showScreen('title');
});

// ===== GLOBAL EVENTS =====
function bindGlobalEvents() {
  // Title screen
  document.getElementById('btn-start').addEventListener('click', () => {
    ui.renderLevelSelect();
    ui.showScreen('levelselect');
  });
  document.getElementById('btn-title-levelselect').addEventListener('click', () => {
    ui.renderLevelSelect();
    ui.showScreen('levelselect');
  });

  // Level select back button
  document.getElementById('btn-levelselect-back').addEventListener('click', () => {
    ui.showScreen('title');
  });

  // Level cards
  document.querySelectorAll('.level-card').forEach((card, i) => {
    card.addEventListener('click', () => {
      const levelId = i + 1;
      if (!isLevelUnlocked(levelId)) return;
      currentLevel = LEVELS[levelId - 1];
      ui.showMission(currentLevel);
    });
  });

  // Mission brief buttons
  document.getElementById('btn-mission-back').addEventListener('click', () => {
    ui.renderLevelSelect();
    ui.showScreen('levelselect');
  });
  document.getElementById('btn-mission-start').addEventListener('click', () => {
    startLevel(currentLevel || LEVELS[0]);
  });

  // HUD controls
  document.getElementById('btn-run').addEventListener('click', runSimulation);
  document.getElementById('btn-pause').addEventListener('click', pauseSimulation);
  document.getElementById('btn-reset').addEventListener('click', resetLevel);
  document.getElementById('btn-hint').addEventListener('click', () => ui.showHint(currentLevel));
  document.getElementById('hint-close').addEventListener('click', () => ui.hideHint());
  document.getElementById('btn-back-to-levels').addEventListener('click', () => {
    stopSimulation();
    ui.renderLevelSelect();
    ui.showScreen('levelselect');
  });

  // Erase toggle
  document.getElementById('btn-erase').addEventListener('click', toggleErase);

  // Rotate key (R)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') rotateSelected();
    if (e.key === 'Escape') ui.hideHint();
    if (e.key === ' ') {
      e.preventDefault();
      if (engine.running) pauseSimulation();
      else if (currentLevel) runSimulation();
    }
  });

  // Results modal buttons
  document.getElementById('btn-retry').addEventListener('click', () => {
    ui.hideResults();
    resetLevel();
  });
  document.getElementById('btn-next-level').addEventListener('click', () => {
    ui.hideResults();
    const nextId = currentLevel.id + 1;
    if (nextId <= LEVELS.length) {
      ui.showMission(LEVELS[nextId - 1]);
    }
  });
  document.getElementById('btn-results-levelselect').addEventListener('click', () => {
    ui.hideResults();
    stopSimulation();
    ui.renderLevelSelect();
    ui.showScreen('levelselect');
  });

  // Component palette buttons
  document.querySelectorAll('.component-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectTool(btn.dataset.tool);
    });
  });

  // Toolbar rotate button
  document.getElementById('btn-rotate').addEventListener('click', rotateSelected);
}

// ===== TOOL SELECTION =====
function selectTool(toolId) {
  document.querySelectorAll('.component-btn').forEach(b => b.classList.remove('selected'));
  const btn = document.querySelector(`.component-btn[data-tool="${toolId}"]`);
  if (btn) btn.classList.add('selected');

  eraseMode = false;
  document.getElementById('btn-erase').classList.remove('selected');
  grid.eraseMode = false;
  grid.selectedTool = toolId;
  grid.selectedDir = selectedDir;
  document.getElementById('grid-canvas').classList.remove('erasing');
  updateRotateIndicator();
}

function toggleErase() {
  eraseMode = !eraseMode;
  document.getElementById('btn-erase').classList.toggle('selected', eraseMode);
  document.querySelectorAll('.component-btn').forEach(b => b.classList.remove('selected'));
  grid.selectedTool = null;
  grid.eraseMode = eraseMode;
  document.getElementById('grid-canvas').classList.toggle('erasing', eraseMode);
}

function rotateSelected() {
  selectedDir = (selectedDir + 1) % 4;
  grid.selectedDir = selectedDir;
  updateRotateIndicator();
}

function updateRotateIndicator() {
  const dirLabels = ['→ Right', '↓ Down', '← Left', '↑ Up'];
  const el = document.getElementById('rotate-indicator');
  if (el) el.textContent = `Direction: ${dirLabels[selectedDir]}`;
}

// ===== LEVEL SETUP =====
function startLevel(level) {
  currentLevel = level;
  tutorialPhase = 0;

  // Show game screen
  ui.showScreen('game');
  ui.setupHUD(level);
  ui.hideHint();
  ui.clearTutorialTips();

  // Reset tool selection
  eraseMode = false;
  grid.eraseMode = false;
  document.getElementById('btn-erase').classList.remove('selected');
  document.querySelectorAll('.component-btn').forEach(b => b.classList.remove('selected'));
  grid.selectedTool = null;

  // Init grid
  grid.init(level.gridCols, level.gridRows);
  grid.engine = null; // no engine while placing

  // Place fixed components
  for (const f of level.fixed) {
    grid.placeCell(f.col, f.row, f.type, f.dir, true);
  }
  // Place preset components
  for (const p of level.preset) {
    grid.placeCell(p.col, p.row, p.type, p.dir, false);
  }

  // Bind click handler
  grid.onCellClick = (c, r, btn) => {
    if (engine.running) return; // no editing while running
    if (btn === 2 || eraseMode) {
      grid.removeCell(c, r);
    } else if (grid.selectedTool) {
      const cell = grid.grid[c]?.[r];
      if (cell && cell.locked) return; // can't overwrite fixed
      grid.placeCell(c, r, grid.selectedTool, grid.selectedDir, false);
    }
    // Tutorial progression
    if (level.tutorial) advanceTutorial(level);
  };

  // Build available component toolbar
  buildToolbar(level.availableComponents);

  // Tutorial tips for level 1
  if (level.tutorial) {
    startTutorial(level);
  }

  ui.setRunning(false);
  document.getElementById('btn-run').disabled = false;
  updateRotateIndicator();
}

function buildToolbar(available) {
  document.querySelectorAll('.component-btn[data-tool]').forEach(btn => {
    const tool = btn.dataset.tool;
    btn.style.display = available.includes(tool) ? '' : 'none';
  });
}

// ===== TUTORIAL =====
function startTutorial(level) {
  tutorialPhase = 0;
  showTutorialStep(level, 0);
}

function showTutorialStep(level, step) {
  const steps = level.tutorialSteps;
  if (!steps || step >= steps.length) {
    ui.clearTutorialTips();
    ui.clearToolHighlight();
    return;
  }
  const s = steps[step];
  const positions = [
    { x: 220, y: 90, side: 'left' },   // toolbar
    { x: 320, y: 200, side: 'bottom' }, // grid
    { x: 220, y: 300, side: 'left' },   // toolbar
    { x: 600, y: 60, side: 'bottom' },  // controls
  ];
  const pos = positions[step] || { x: 300, y: 100, side: 'bottom' };
  ui.showTutorialTip(s.text, pos);

  if (s.target === 'toolbar' && step === 0) {
    ui.highlightTool('BELT_STRAIGHT');
  } else if (step === 2) {
    ui.highlightTool('BELT_TURN');
  } else {
    ui.clearToolHighlight();
  }
}

function advanceTutorial(level) {
  if (!level.tutorial) return;
  tutorialPhase++;
  if (tutorialPhase === 1) {
    showTutorialStep(level, 1);
  } else if (tutorialPhase === 5) {
    showTutorialStep(level, 2);
  } else if (tutorialPhase === 10) {
    showTutorialStep(level, 3);
    ui.clearToolHighlight();
  }
}

// ===== SIMULATION CONTROL =====
function runSimulation() {
  if (engine.running) return;

  ui.clearTutorialTips();
  ui.clearToolHighlight();
  ui.hideHint();

  // Re-init engine with current grid
  engine.init(currentLevel, grid.grid, currentLevel.gridCols, currentLevel.gridRows);
  grid.engine = engine;

  engine.onTick = (metrics, tick) => {
    ui.updateHUD(metrics, tick);
  };
  engine.onComplete = (metrics) => {
    stopSimulation();
    onRunComplete(metrics);
  };

  engine.start();
  ui.setRunning(true);

  tickTimer = setInterval(() => {
    engine.step();
  }, TICK_INTERVAL_MS);
}

function pauseSimulation() {
  engine.pause();
  ui.setRunning(false);
  clearInterval(tickTimer);
  tickTimer = null;

  document.getElementById('btn-run').disabled = false;
  document.getElementById('btn-run').textContent = '▶ Resume';
}

function stopSimulation() {
  clearInterval(tickTimer);
  tickTimer = null;
  engine.running = false;
  ui.setRunning(false);
  document.getElementById('btn-run').textContent = '▶ Run';
}

function resetLevel() {
  stopSimulation();
  document.getElementById('btn-run').textContent = '▶ Run';
  document.getElementById('btn-run').disabled = false;
  if (currentLevel) startLevel(currentLevel);
}

// ===== RUN COMPLETION =====
function onRunComplete(metrics) {
  const summary = buildSummary(currentLevel, metrics);
  const report = generateCoachReport(currentLevel, metrics, summary);

  // Save score
  saveScore(currentLevel.id, summary.stars);

  // Unlock next level on any stars
  if (summary.stars > 0 && currentLevel.id < LEVELS.length) {
    unlockLevel(currentLevel.id + 1);
  }

  // Short delay before showing results for dramatic effect
  setTimeout(() => {
    ui.showResults(currentLevel, summary, report);
    // Set currentLevel reference in mission brief for next level button
    document.getElementById('btn-next-level').onclick = () => {
      ui.hideResults();
      const nextId = currentLevel.id + 1;
      if (nextId <= LEVELS.length) {
        const next = LEVELS[nextId - 1];
        ui.showMission(next);
        // Update currentLevel so btn-mission-start knows which level
        currentLevel = next;
      }
    };
  }, 600);

  // Update current level reference for retry
  const lvl = currentLevel;
  document.getElementById('btn-retry').onclick = () => {
    ui.hideResults();
    currentLevel = lvl;
    resetLevel();
  };
}


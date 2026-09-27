// ===== COMPONENT DEFINITIONS =====
// All component types, their properties, rendering, and behavior

const DIRS = { RIGHT: 0, DOWN: 1, LEFT: 2, UP: 3 };
const DIR_NAMES = ['right', 'down', 'left', 'up'];
const DIR_VEC = [[1,0],[0,1],[-1,0],[0,-1]];

// Package types
const PKG_TYPES = {
  NORMAL:   { id: 'normal',   color: '#4a9eff', icon: '📦', label: 'Normal' },
  FRAGILE:  { id: 'fragile',  color: '#f39c12', icon: '🔮', label: 'Fragile' },
  HEAVY:    { id: 'heavy',    color: '#e74c3c', icon: '⚙️',  label: 'Heavy' },
};

// Component type registry
const COMP_TYPES = {
  BELT_STRAIGHT: {
    id: 'BELT_STRAIGHT',
    name: 'Straight Belt',
    icon: '➡️',
    hint: 'Moves packages in one direction',
    rotatable: true,
    defaultDir: DIRS.RIGHT,
    isFixed: false,
  },
  BELT_TURN: {
    id: 'BELT_TURN',
    name: 'Turn Belt',
    icon: '↩️',
    hint: 'Routes packages 90° (right→down)',
    rotatable: true,
    defaultDir: DIRS.RIGHT,
    isFixed: false,
  },
  BUFFER: {
    id: 'BUFFER',
    name: 'Buffer',
    icon: '🗄️',
    hint: 'Holds up to 4 packages; slows flow',
    rotatable: false,
    defaultDir: DIRS.RIGHT,
    isFixed: false,
    capacity: 4,
  },
  SORTER: {
    id: 'SORTER',
    name: 'Sorter',
    icon: '🔀',
    hint: 'Routes fragile packages onto alt exit',
    rotatable: true,
    defaultDir: DIRS.RIGHT,
    isFixed: false,
  },
  SENSOR: {
    id: 'SENSOR',
    name: 'Sensor',
    icon: '📡',
    hint: 'Counts packages passing through',
    rotatable: true,
    defaultDir: DIRS.RIGHT,
    isFixed: false,
  },
  WEIGHT_STATION: {
    id: 'WEIGHT_STATION',
    name: 'Weight Station',
    icon: '⚖️',
    hint: 'Flags heavy packages; slows them',
    rotatable: true,
    defaultDir: DIRS.RIGHT,
    isFixed: false,
  },
  SPAWNER: {
    id: 'SPAWNER',
    name: 'Input Spawner',
    icon: '🏭',
    hint: 'Level input — cannot be moved',
    rotatable: false,
    defaultDir: DIRS.RIGHT,
    isFixed: true,
  },
  COLLECTOR: {
    id: 'COLLECTOR',
    name: 'Output Collector',
    icon: '🎯',
    hint: 'Level output — cannot be moved',
    rotatable: false,
    defaultDir: DIRS.RIGHT,
    isFixed: true,
  },
};

// Placeable palette (not spawner/collector — those are level-fixed)
const PALETTE = [
  'BELT_STRAIGHT',
  'BELT_TURN',
  'BUFFER',
  'SORTER',
  'SENSOR',
  'WEIGHT_STATION',
];

// Create a new cell object
function makeCell(type, dir, extra = {}) {
  const def = COMP_TYPES[type];
  return {
    type,
    dir: dir !== undefined ? dir : def.defaultDir,
    // Runtime state
    packages: [],         // packages currently on this cell
    bufferQueue: [],      // for BUFFER only
    sensorCount: 0,       // for SENSOR only
    jammed: false,
    flagged: false,       // for weight station
    ...extra,
  };
}

// Get the output direction(s) of a cell
// Returns array of [dx, dy] vectors
function getOutputDirs(cell) {
  const d = cell.dir;
  switch (cell.type) {
    case 'BELT_STRAIGHT':
    case 'SENSOR':
    case 'WEIGHT_STATION':
      return [DIR_VEC[d]];
    case 'BELT_TURN': {
      // turn: input from behind, output is 90° clockwise
      const outDir = (d + 1) % 4;
      return [DIR_VEC[outDir]];
    }
    case 'BUFFER':
      return [DIR_VEC[d]];
    case 'SORTER': {
      // main output: forward. alt output: 90° counter-clockwise (for fragile)
      // A RIGHT-facing sorter sends fragile UP (toward safe top collector)
      const main = DIR_VEC[d];
      const alt = DIR_VEC[(d + 3) % 4];
      return [main, alt];
    }
    case 'SPAWNER':
      return [DIR_VEC[d]];
    case 'COLLECTOR':
      return [];
    default:
      return [DIR_VEC[d]];
  }
}

// Get the main input direction for a cell (what direction packages come FROM)
function getInputDir(cell) {
  const d = cell.dir;
  switch (cell.type) {
    case 'BELT_TURN': {
      // input from the opposite of d (turn takes packages coming from behind)
      return (d + 2) % 4;
    }
    default:
      return (d + 2) % 4;
  }
}

// Which output a package should use given its type
function routePackage(cell, pkg) {
  if (cell.type === 'SORTER' && pkg.type === 'FRAGILE') {
    return 1; // alt output
  }
  return 0; // main output
}

// ===== LEVEL DEFINITIONS =====
// Each level defines: grid size, fixed components, available components,
// win conditions, tutorial tips, and metadata.

const LEVELS = [
  // ===== LEVEL 1: Straight Line Basics =====
  {
    id: 1,
    title: "Straight Line Basics",
    subtitle: "Get the flow moving",
    brief: "Welcome to FlowForge! Your job is simple: connect the input to the output so packages can flow through. Use straight belts and turn belts to build the path. Every package must reach the output — no package left behind!",
    goals: [
      { label: "Deliver 100% of packages", icon: "📦" },
      { label: "All delivered within 60 ticks", icon: "⏱️" },
      { label: "Zero blocked packages", icon: "🚫" },
    ],
    gridCols: 10,
    gridRows: 7,
    spawnRate: 1,        // 1 package every N ticks
    totalPackages: 8,
    timeLimit: 80,
    packageTypes: ['NORMAL'],
    // Fixed cells: [col, row, type, dir, locked]
    fixed: [
      { col: 0, row: 3, type: 'SPAWNER', dir: DIRS.RIGHT },
      { col: 9, row: 3, type: 'COLLECTOR', dir: DIRS.RIGHT },
    ],
    // Player must build a path across; no preset belts — player builds all
    preset: [],
    // Win conditions evaluated after run
    winCondition: (metrics) => {
      return metrics.delivered >= metrics.totalSpawned &&
             metrics.blocked === 0;
    },
    starThresholds: [
      // [minStars, condition fn]
      (m) => m.delivered >= m.totalSpawned && m.blocked === 0 && m.ticks <= 60,  // 3 stars
      (m) => m.delivered >= m.totalSpawned && m.blocked === 0,                   // 2 stars
      (m) => m.delivered >= Math.ceil(m.totalSpawned * 0.8),                     // 1 star
    ],
    availableComponents: ['BELT_STRAIGHT', 'BELT_TURN'],
    tutorial: true,
    tutorialSteps: [
      { text: "Select a Straight Belt from the left toolbar", target: 'toolbar' },
      { text: "Click grid cells to place belts — build a path from 🏭 to 🎯", target: 'grid' },
      { text: "Right-click or press R to rotate before placing", target: 'toolbar' },
      { text: "Press RUN when your path is ready!", target: 'controls' },
    ],
    hints: [
      "Try placing straight belts in a line from the spawner to the collector.",
      "Use turn belts if you need to change direction — they bend the path 90°.",
    ],
    coachConcept: "flow direction",
  },

  // ===== LEVEL 2: The Bottleneck =====
  {
    id: 2,
    title: "The Bottleneck",
    subtitle: "Break the choke point",
    brief: "The warehouse has a busy day and packages keep piling up! There's only one narrow path and it can't handle the load. You need to either add a buffer to absorb the surge, or build a second parallel route to split the flow.",
    goals: [
      { label: "Deliver at least 85% of packages", icon: "📦" },
      { label: "Fewer than 4 blocked packages", icon: "🚫" },
      { label: "Throughput ≥ 1 pkg/3 ticks", icon: "📊" },
    ],
    gridCols: 12,
    gridRows: 9,
    spawnRate: 2,
    totalPackages: 16,
    timeLimit: 120,
    packageTypes: ['NORMAL', 'HEAVY'],
    fixed: [
      { col: 0, row: 4, type: 'SPAWNER', dir: DIRS.RIGHT },
      { col: 11, row: 4, type: 'COLLECTOR', dir: DIRS.RIGHT },
    ],
    // Pre-placed narrow path — one single-lane path with a pinch point
    preset: [
      { col: 1, row: 4, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 2, row: 4, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 3, row: 4, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 7, row: 4, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 8, row: 4, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 9, row: 4, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 10, row: 4, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
    ],
    winCondition: (metrics) => {
      return metrics.delivered >= Math.ceil(metrics.totalSpawned * 0.85) &&
             metrics.blocked < 4;
    },
    starThresholds: [
      (m) => m.delivered >= m.totalSpawned && m.blocked === 0,
      (m) => m.delivered >= Math.ceil(m.totalSpawned * 0.85) && m.blocked < 4,
      (m) => m.delivered >= Math.ceil(m.totalSpawned * 0.6),
    ],
    availableComponents: ['BELT_STRAIGHT', 'BELT_TURN', 'BUFFER', 'SENSOR'],
    tutorial: false,
    hints: [
      "Notice how packages pile up in the middle? That's a bottleneck — one path, too much traffic.",
      "Try adding a Buffer (🗄️) in the middle to absorb the overflow, or route around it.",
      "A Sensor (📡) can help you see exactly where packages are backing up.",
    ],
    coachConcept: "bottleneck and throughput",
  },

  // ===== LEVEL 3: Fragile Cargo =====
  {
    id: 3,
    title: "Fragile Cargo",
    subtitle: "Handle with care",
    brief: "Today's shipment includes delicate items that break if they hit the high-speed belts or the weight station. A Sorter can detect fragile packages and redirect them to a safe slow path. Build a conditional routing system — normal packages go fast, fragile packages go carefully.",
    goals: [
      { label: "Zero broken fragile packages", icon: "🔮" },
      { label: "Deliver at least 80% overall", icon: "📦" },
      { label: "Use a Sorter to split the flow", icon: "🔀" },
    ],
    gridCols: 12,
    gridRows: 10,
    spawnRate: 3,
    totalPackages: 14,
    timeLimit: 140,
    packageTypes: ['NORMAL', 'FRAGILE'],
    fragileBreakOnFastBelt: true,
    fastBeltSpeed: 2,  // belts placed below row 5 are "fast" (sim handles this)
    fixed: [
      { col: 0, row: 4, type: 'SPAWNER', dir: DIRS.RIGHT },
      { col: 11, row: 2, type: 'COLLECTOR', dir: DIRS.RIGHT },  // safe output (top)
      { col: 11, row: 6, type: 'COLLECTOR', dir: DIRS.RIGHT },  // fast output (bottom)
    ],
    preset: [
      { col: 1, row: 4, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 2, row: 4, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
    ],
    winCondition: (metrics) => {
      return metrics.brokenFragile === 0 &&
             metrics.delivered >= Math.ceil(metrics.totalSpawned * 0.8);
    },
    starThresholds: [
      (m) => m.brokenFragile === 0 && m.delivered >= m.totalSpawned,
      (m) => m.brokenFragile === 0 && m.delivered >= Math.ceil(m.totalSpawned * 0.8),
      (m) => m.brokenFragile <= 1 && m.delivered >= Math.ceil(m.totalSpawned * 0.6),
    ],
    availableComponents: ['BELT_STRAIGHT', 'BELT_TURN', 'BUFFER', 'SORTER', 'SENSOR', 'WEIGHT_STATION'],
    tutorial: false,
    hints: [
      "Fragile packages (🔮) break on fast belts in the lower half of the grid.",
      "Place a Sorter (🔀) early in the path — it reads fragile packages and sends them upward.",
      "Build a safe slow route in the upper lanes and a fast route below for normal packages.",
    ],
    coachConcept: "conditional routing and specialization",
  },

  // ===== LEVEL 4: Peak Load Challenge =====
  {
    id: 4,
    title: "Peak Load Challenge",
    subtitle: "Survive the surge",
    brief: "It's holiday season and package volume triples at tick 40! Your current layout will get overwhelmed. You need a resilient system: parallel routes, buffers to absorb the spike, and smart routing so no path becomes a permanent jam. Can your factory stay functional through the peak?",
    goals: [
      { label: "No permanent jams (≤6 blocked total)", icon: "🚫" },
      { label: "Deliver 75% through the full run", icon: "📦" },
      { label: "Survive the demand spike at tick 40", icon: "⚡" },
    ],
    gridCols: 14,
    gridRows: 11,
    spawnRate: 4,
    totalPackages: 24,
    timeLimit: 160,
    packageTypes: ['NORMAL', 'FRAGILE', 'HEAVY'],
    demandSpike: {
      tick: 40,
      newRate: 1,        // After tick 40: spawn every tick instead of every 4
      duration: 40,      // spike lasts 40 ticks
    },
    fixed: [
      { col: 0, row: 5, type: 'SPAWNER', dir: DIRS.RIGHT },
      { col: 13, row: 5, type: 'COLLECTOR', dir: DIRS.RIGHT },
    ],
    preset: [
      { col: 1, row: 5, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 2, row: 5, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 3, row: 5, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 9, row: 5, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 10, row: 5, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 11, row: 5, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
      { col: 12, row: 5, type: 'BELT_STRAIGHT', dir: DIRS.RIGHT },
    ],
    winCondition: (metrics) => {
      return metrics.blocked <= 6 &&
             metrics.delivered >= Math.ceil(metrics.totalSpawned * 0.75);
    },
    starThresholds: [
      (m) => m.blocked === 0 && m.delivered >= m.totalSpawned,
      (m) => m.blocked <= 6 && m.delivered >= Math.ceil(m.totalSpawned * 0.75),
      (m) => m.blocked <= 12 && m.delivered >= Math.ceil(m.totalSpawned * 0.5),
    ],
    availableComponents: ['BELT_STRAIGHT', 'BELT_TURN', 'BUFFER', 'SORTER', 'SENSOR', 'WEIGHT_STATION'],
    tutorial: false,
    hints: [
      "At tick 40 the spawn rate quadruples — make sure you have spare capacity built in.",
      "Buffers are great surge absorbers — place them before the middle of the path.",
      "Try splitting into two parallel lanes early to double your throughput capacity.",
    ],
    coachConcept: "load balancing and buffering",
  },
];

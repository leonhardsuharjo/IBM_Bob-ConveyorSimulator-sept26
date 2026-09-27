// ===== SIMULATION ENGINE =====
// Tick-based simulation. Operates on a 2D grid of cells.
// Each tick: spawn packages, move packages cell-by-cell, handle collisions and jams.

class SimEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.grid = null;         // 2D array [col][row] of cell objects (or null)
    this.cols = 0;
    this.rows = 0;
    this.tick = 0;
    this.running = false;
    this.level = null;

    // Metrics
    this.metrics = {
      delivered: 0,
      blocked: 0,
      brokenFragile: 0,
      totalSpawned: 0,
      totalPackages: 0,
      ticks: 0,
      throughputHistory: [],   // delivered count per 10-tick window
      spikeActive: false,
    };

    this.packages = [];       // all live package objects
    this.nextPkgId = 1;
    this.deliveryFlashes = []; // {col, row, t} for visual feedback
    this.jamFlashes = [];
    this.currentSpawnRate = 0;
    this._bufferLastMove = {};
    this.onTick = null;        // callback
    this.onComplete = null;    // callback
  }

  init(level, grid, cols, rows) {
    this.reset();
    this.level = level;
    this.grid = grid;
    this.cols = cols;
    this.rows = rows;
    this.metrics.totalPackages = level.totalPackages;
    this.currentSpawnRate = level.spawnRate;
  }

  // Create a new package at spawner location
  _spawnPackage(col, row, dir) {
    const types = this.level.packageTypes || ['NORMAL'];
    // Weighted random: NORMAL 60%, others split remainder
    let type;
    if (types.length === 1) {
      type = types[0];
    } else {
      const r = Math.random();
      if (types.includes('FRAGILE') && types.includes('HEAVY')) {
        type = r < 0.5 ? 'NORMAL' : r < 0.75 ? 'FRAGILE' : 'HEAVY';
      } else if (types.includes('FRAGILE')) {
        type = r < 0.55 ? 'NORMAL' : 'FRAGILE';
      } else if (types.includes('HEAVY')) {
        type = r < 0.55 ? 'NORMAL' : 'HEAVY';
      } else {
        type = 'NORMAL';
      }
    }
    const pkg = {
      id: this.nextPkgId++,
      type,
      col, row,
      // fractional position within cell for animation (0..1)
      progress: 0,
      dir,
      state: 'moving',   // moving | blocked | delivered | broken
      waitTicks: 0,
    };
    this.packages.push(pkg);
    this.metrics.totalSpawned++;
    return pkg;
  }

  // Advance simulation by one tick
  step() {
    if (!this.running) return;

    this.tick++;
    this.metrics.ticks = this.tick;

    // Check demand spike
    const spike = this.level.demandSpike;
    if (spike) {
      if (this.tick === spike.tick) {
        this.currentSpawnRate = spike.newRate;
        this.metrics.spikeActive = true;
      }
      if (this.tick === spike.tick + spike.duration) {
        this.currentSpawnRate = this.level.spawnRate;
        this.metrics.spikeActive = false;
      }
    }

    // Spawn packages from all spawners
    if (this.metrics.totalSpawned < this.level.totalPackages) {
      if (this.tick % this.currentSpawnRate === 0) {
        for (let c = 0; c < this.cols; c++) {
          for (let r = 0; r < this.rows; r++) {
            const cell = this.grid[c][r];
            if (cell && cell.type === 'SPAWNER' && this.metrics.totalSpawned < this.level.totalPackages) {
              this._spawnPackage(c, r, cell.dir);
            }
          }
        }
      }
    }

    // Move packages
    // Process in reverse order so packages don't "cascade" in one tick
    const stillLive = [];
    // Sort: packages further along path move first to prevent stacking
    const sorted = [...this.packages].sort((a, b) => {
      // Priority: packages further in direction of flow move first
      if (a.dir === DIRS.RIGHT) return b.col - a.col;
      if (a.dir === DIRS.LEFT) return a.col - b.col;
      if (a.dir === DIRS.DOWN) return b.row - a.row;
      if (a.dir === DIRS.UP) return a.row - b.row;
      return 0;
    });

    // Build occupancy map for this tick (to prevent two packages on same cell)
    const occupied = new Set();
    for (const pkg of this.packages) {
      if (pkg.state === 'moving') {
        occupied.add(`${pkg.col},${pkg.row}`);
      }
    }

    for (const pkg of sorted) {
      if (pkg.state !== 'moving') {
        stillLive.push(pkg);
        continue;
      }

      const cell = this.grid[pkg.col]?.[pkg.row];
      if (!cell) {
        // Package fell off grid — count as blocked/lost
        pkg.state = 'blocked';
        this.metrics.blocked++;
        this.jamFlashes.push({ col: pkg.col, row: pkg.row, t: 8 });
        stillLive.push(pkg);
        continue;
      }

      // Handle BUFFER: package waits here for up to capacity
      if (cell.type === 'BUFFER') {
        // Check if buffer has room
        const bufPkgs = this.packages.filter(p => p.state === 'moving' && p.col === pkg.col && p.row === pkg.row);
        const bufCap = COMP_TYPES.BUFFER.capacity;
        if (bufPkgs.length > bufCap) {
          pkg.waitTicks++;
          if (pkg.waitTicks > 8) {
            pkg.state = 'blocked';
            this.metrics.blocked++;
            this.jamFlashes.push({ col: pkg.col, row: pkg.row, t: 8 });
          }
          stillLive.push(pkg);
          continue;
        }
        // Throttle output: only move 1 package out per 2 ticks
        const key = `buf_${pkg.col}_${pkg.row}`;
        if (this._bufferLastMove[key] && this.tick - this._bufferLastMove[key] < 2) {
          stillLive.push(pkg);
          continue;
        }
        this._bufferLastMove[key] = this.tick;
      }

      // Handle WEIGHT_STATION: flag heavy packages, slow them
      if (cell.type === 'WEIGHT_STATION' && pkg.type === 'HEAVY') {
        cell.flagged = true;
        pkg.waitTicks++;
        if (pkg.waitTicks < 2) {
          stillLive.push(pkg);
          continue; // slows heavy packages by 2 ticks
        }
        pkg.waitTicks = 0;
      }

      // Handle SENSOR: increment count
      if (cell.type === 'SENSOR') {
        if (!pkg._counted) {
          cell.sensorCount++;
          pkg._counted = true;
        }
      }

      // Determine next cell
      const outputDirs = getOutputDirs(cell);
      if (outputDirs.length === 0) {
        // COLLECTOR
        pkg.state = 'delivered';
        this.metrics.delivered++;
        this.deliveryFlashes.push({ col: pkg.col, row: pkg.row, t: 6 });
        cell.packages = cell.packages.filter(p => p.id !== pkg.id);
        stillLive.push(pkg);
        continue;
      }

      // Choose output direction based on routing
      const outIdx = routePackage(cell, pkg);
      const [dx, dy] = outputDirs[Math.min(outIdx, outputDirs.length - 1)];
      const nc = pkg.col + dx;
      const nr = pkg.row + dy;

      // Bounds check
      if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) {
        pkg.state = 'blocked';
        this.metrics.blocked++;
        this.jamFlashes.push({ col: pkg.col, row: pkg.row, t: 8 });
        stillLive.push(pkg);
        continue;
      }

      const nextCell = this.grid[nc]?.[nr];
      if (!nextCell) {
        // No component — package blocked
        pkg.waitTicks++;
        if (pkg.waitTicks > 6) {
          pkg.state = 'blocked';
          this.metrics.blocked++;
          this.jamFlashes.push({ col: pkg.col, row: pkg.row, t: 8 });
        }
        stillLive.push(pkg);
        continue;
      }

      // Check fragile breaking on fast belt (level 3)
      // Only break if BOTH the current cell and destination are in the danger zone.
      // This prevents the Sorter (sitting safely in row 4) from breaking fragile
      // just because its alt-exit points downward into row 5.
      if (this.level.fragileBreakOnFastBelt && pkg.type === 'FRAGILE') {
        const half = Math.floor(this.rows / 2);
        if (pkg.row >= half && nr >= half) {
          pkg.state = 'broken';
          this.metrics.brokenFragile++;
          this.jamFlashes.push({ col: pkg.col, row: pkg.row, t: 8 });
          stillLive.push(pkg);
          continue;
        }
      }

      // Check occupancy
      const nkey = `${nc},${nr}`;
      if (occupied.has(nkey) && nextCell.type !== 'BUFFER' && nextCell.type !== 'COLLECTOR') {
        pkg.waitTicks++;
        if (pkg.waitTicks > 8) {
          pkg.state = 'blocked';
          this.metrics.blocked++;
          this.jamFlashes.push({ col: pkg.col, row: pkg.row, t: 8 });
        }
        stillLive.push(pkg);
        continue;
      }

      // Move package
      occupied.delete(`${pkg.col},${pkg.row}`);
      pkg.col = nc;
      pkg.row = nr;
      pkg.waitTicks = 0;
      pkg._counted = false; // reset sensor flag on each cell
      // Update direction to match next cell's output
      const nextOut = getOutputDirs(nextCell);
      if (nextOut.length > 0) {
        const [nx, ny] = nextOut[routePackage(nextCell, pkg)];
        pkg.dir = nx === 1 ? DIRS.RIGHT : nx === -1 ? DIRS.LEFT : ny === 1 ? DIRS.DOWN : DIRS.UP;
      }
      occupied.add(`${pkg.col},${pkg.row}`);
      pkg.progress = 0;
      stillLive.push(pkg);
    }

    this.packages = stillLive.filter(p => p.state !== 'delivered' && p.state !== 'broken' && p.state !== 'blocked');

    // Update flash timers
    this.deliveryFlashes = this.deliveryFlashes.filter(f => { f.t--; return f.t > 0; });
    this.jamFlashes = this.jamFlashes.filter(f => { f.t--; return f.t > 0; });

    // Update throughput history
    if (this.tick % 10 === 0) {
      this.metrics.throughputHistory.push(this.metrics.delivered);
    }

    // Check end conditions
    const allSpawned = this.metrics.totalSpawned >= this.level.totalPackages;
    const allSettled = this.packages.length === 0;
    const timedOut = this.tick >= this.level.timeLimit;

    if ((allSpawned && allSettled) || timedOut) {
      this.running = false;
      if (this.onComplete) this.onComplete(this.metrics);
    }

    if (this.onTick) this.onTick(this.metrics, this.tick);
  }

  start() {
    this.running = true;
  }

  pause() {
    this.running = false;
  }

  resume() {
    this.running = true;
  }

  getBufferFill(col, row) {
    const pkgs = this.packages.filter(p => p.col === col && p.row === row);
    return pkgs.length;
  }

  getSensorCount(col, row) {
    const cell = this.grid[col]?.[row];
    return cell ? cell.sensorCount : 0;
  }
}

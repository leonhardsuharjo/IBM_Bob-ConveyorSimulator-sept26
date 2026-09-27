// ===== GRID RENDERING =====
// Canvas-based top-down grid renderer.
// Handles component placement, package drawing, animations, and user input.

const CELL = 52;  // pixel size per grid cell
const HALF = CELL / 2;

// Belt stripe animation phase (incremented each render frame)
let beltPhase = 0;

class GridRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cols = 0;
    this.rows = 0;
    this.grid = null;       // [col][row] = cell | null
    this.engine = null;
    this.selectedTool = null;
    this.selectedDir = DIRS.RIGHT;
    this.eraseMode = false;
    this.hoverCol = -1;
    this.hoverRow = -1;
    this.animFrame = null;
    this._setupInput();
    this._lastTime = 0;
    this.onCellClick = null;  // callback(col, row, btn)
  }

  init(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.grid = [];
    for (let c = 0; c < cols; c++) {
      this.grid[c] = [];
      for (let r = 0; r < rows; r++) {
        this.grid[c][r] = null;
      }
    }
    this.canvas.width = cols * CELL;
    this.canvas.height = rows * CELL;
    this._startLoop();
  }

  destroy() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('mousedown', this._onDown);
    this.canvas.removeEventListener('contextmenu', this._onContext);
    this.canvas.removeEventListener('mouseleave', this._onLeave);
  }

  _setupInput() {
    this._onMove = (e) => {
      const [c, r] = this._cellAt(e);
      this.hoverCol = c; this.hoverRow = r;
      if (e.buttons === 1 && this.onCellClick) this.onCellClick(c, r, 0);
    };
    this._onDown = (e) => {
      if (e.button === 2) return; // handled by contextmenu
      const [c, r] = this._cellAt(e);
      if (this.onCellClick) this.onCellClick(c, r, 0);
    };
    this._onContext = (e) => {
      e.preventDefault();
      const [c, r] = this._cellAt(e);
      if (this.onCellClick) this.onCellClick(c, r, 2);
    };
    this._onLeave = () => { this.hoverCol = -1; this.hoverRow = -1; };
    this.canvas.addEventListener('mousemove', this._onMove);
    this.canvas.addEventListener('mousedown', this._onDown);
    this.canvas.addEventListener('contextmenu', this._onContext);
    this.canvas.addEventListener('mouseleave', this._onLeave);
  }

  _cellAt(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    return [Math.floor(x / CELL), Math.floor(y / CELL)];
  }

  placeCell(col, row, type, dir, locked = false) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const cell = makeCell(type, dir);
    cell.locked = locked;
    this.grid[col][row] = cell;
  }

  removeCell(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const cell = this.grid[col][row];
    if (cell && cell.locked) return;
    this.grid[col][row] = null;
  }

  _startLoop() {
    const loop = (time) => {
      const dt = time - this._lastTime;
      this._lastTime = time;
      beltPhase += dt * 0.025; // belt scroll speed
      this._draw();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background grid
    ctx.fillStyle = '#1e222a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#2a2f3a';
    ctx.lineWidth = 1;
    for (let c = 0; c <= this.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, this.rows * CELL);
      ctx.stroke();
    }
    for (let r = 0; r <= this.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(this.cols * CELL, r * CELL);
      ctx.stroke();
    }

    // Draw cells
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const cell = this.grid[c][r];
        if (cell) this._drawCell(ctx, c, r, cell);
      }
    }

    // Draw jam/delivery flashes
    if (this.engine) {
      for (const f of this.engine.deliveryFlashes) {
        const alpha = f.t / 6;
        ctx.fillStyle = `rgba(46, 204, 113, ${alpha * 0.35})`;
        ctx.fillRect(f.col * CELL, f.row * CELL, CELL, CELL);
        ctx.strokeStyle = `rgba(46, 204, 113, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(f.col * CELL + 1, f.row * CELL + 1, CELL - 2, CELL - 2);
      }
      for (const f of this.engine.jamFlashes) {
        const alpha = f.t / 8;
        ctx.fillStyle = `rgba(231, 76, 60, ${alpha * 0.4})`;
        ctx.fillRect(f.col * CELL, f.row * CELL, CELL, CELL);
      }

      // Draw spike indicator
      if (this.engine.metrics.spikeActive) {
        ctx.fillStyle = `rgba(243, 156, 18, ${0.08 + 0.06 * Math.sin(beltPhase * 2)})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.strokeStyle = 'rgba(243,156,18,0.5)';
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);
      }

      // Draw packages
      for (const pkg of this.engine.packages) {
        this._drawPackage(ctx, pkg);
      }
    }

    // Hover highlight
    if (this.hoverCol >= 0 && this.hoverRow >= 0 && this.selectedTool) {
      ctx.fillStyle = 'rgba(74, 158, 255, 0.15)';
      ctx.fillRect(this.hoverCol * CELL, this.hoverRow * CELL, CELL, CELL);
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.hoverCol * CELL + 1, this.hoverRow * CELL + 1, CELL - 2, CELL - 2);

      // Ghost preview of component
      ctx.globalAlpha = 0.5;
      const ghost = makeCell(this.selectedTool, this.selectedDir);
      this._drawCell(ctx, this.hoverCol, this.hoverRow, ghost);
      ctx.globalAlpha = 1;
    }
  }

  _drawCell(ctx, c, r, cell) {
    const x = c * CELL, y = r * CELL;
    const pad = 2;

    // Base background per type
    const bg = this._cellBg(cell);
    ctx.fillStyle = bg;
    ctx.beginPath();
    this._roundRect(ctx, x + pad, y + pad, CELL - pad*2, CELL - pad*2, 5);
    ctx.fill();

    // Belt lanes / direction arrows
    this._drawCellDecor(ctx, x, y, cell);

    // Jammed border
    if (cell.jammed) {
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      this._roundRect(ctx, x + pad, y + pad, CELL - pad*2, CELL - pad*2, 5);
      ctx.stroke();
    }

    // Buffer fill bar
    if (cell.type === 'BUFFER' && this.engine) {
      const fill = this.engine.getBufferFill(c, r);
      const cap = COMP_TYPES.BUFFER.capacity;
      const ratio = Math.min(fill / cap, 1);
      const bw = CELL - 8;
      const bh = 5;
      const bx = x + 4;
      const by = y + CELL - 9;
      ctx.fillStyle = '#3a404d';
      ctx.fillRect(bx, by, bw, bh);
      const fillColor = ratio > 0.8 ? '#e74c3c' : ratio > 0.5 ? '#f39c12' : '#2ecc71';
      ctx.fillStyle = fillColor;
      ctx.fillRect(bx, by, bw * ratio, bh);
    }

    // Sensor count
    if (cell.type === 'SENSOR' && this.engine) {
      const cnt = this.engine.getSensorCount(c, r);
      ctx.fillStyle = '#fff';
      ctx.font = `bold 9px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(cnt, x + HALF, y + CELL - 5);
    }

    // Locked indicator (fixed component)
    if (cell.locked) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + CELL - 12, y + 2, 10, 10);
      ctx.fillStyle = '#aaa';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚙', x + CELL - 7, y + 10);
    }
  }

  _cellBg(cell) {
    switch(cell.type) {
      case 'SPAWNER': return '#1e3a2a';
      case 'COLLECTOR': return '#1e2a3a';
      case 'BELT_STRAIGHT': return '#3a3f4d';
      case 'BELT_TURN': return '#3a3f4d';
      case 'BUFFER': return '#2a3028';
      case 'SORTER': return '#2a2a40';
      case 'SENSOR': return '#282a3a';
      case 'WEIGHT_STATION': return '#3a2a28';
      default: return '#35394a';
    }
  }

  _drawCellDecor(ctx, x, y, cell) {
    ctx.save();
    ctx.translate(x + HALF, y + HALF);

    // Rotate canvas to cell direction for easy directional drawing
    const rot = cell.dir * Math.PI / 2;
    ctx.rotate(rot);

    switch(cell.type) {
      case 'SPAWNER':
        ctx.fillStyle = '#2ecc71';
        // Factory icon
        this._drawFactoryIcon(ctx);
        break;

      case 'COLLECTOR':
        ctx.fillStyle = '#4a9eff';
        this._drawCollectorIcon(ctx);
        break;

      case 'BELT_STRAIGHT': {
        // Belt lane with moving stripes
        this._drawBeltLane(ctx, beltPhase, '#4a5168', '#5a6180');
        // Arrow
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        this._drawArrow(ctx, 0, 0, HALF - 6, 0);
        break;
      }

      case 'BELT_TURN': {
        // Turn belt — curve visualization
        ctx.strokeStyle = '#5a6180';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        // Arc from bottom to right
        ctx.arc(HALF - 2, -(HALF - 2), HALF - 4, 0, Math.PI / 2);
        ctx.stroke();
        ctx.strokeStyle = '#6a7190';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(HALF - 2, -(HALF - 2), HALF - 4, 0, Math.PI / 2);
        ctx.stroke();
        // Arrow on curve
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(2, 8);
        ctx.lineTo(8, 2);
        ctx.lineTo(8, 6);
        ctx.lineTo(12, 6);
        ctx.lineTo(12, -2);
        ctx.lineTo(16, -2);
        ctx.lineTo(10, -8);
        ctx.lineTo(4, -2);
        ctx.lineTo(8, -2);
        ctx.lineTo(8, 2);
        ctx.fill();
        break;
      }

      case 'BUFFER': {
        ctx.fillStyle = '#3a4a38';
        this._roundRect(ctx, -HALF + 3, -HALF + 3, CELL - 6, CELL - 6, 4);
        ctx.fill();
        // Slots visual
        for (let i = 0; i < 4; i++) {
          const sx = -14 + (i % 2) * 14;
          const sy = -6 + Math.floor(i / 2) * 12;
          ctx.fillStyle = '#2a3028';
          ctx.fillRect(sx, sy, 10, 8);
        }
        // Arrow in
        ctx.fillStyle = 'rgba(46,204,113,0.7)';
        this._drawArrow(ctx, -HALF + 4, 0, 0, 0);
        // Arrow out
        this._drawArrow(ctx, 0, 0, HALF - 4, 0);
        break;
      }

      case 'SORTER': {
        // Main lane
        this._drawBeltLane(ctx, beltPhase, '#3a3a58', '#4a4a68');
        // Split arrow
        ctx.fillStyle = 'rgba(124,92,216,0.8)';
        this._drawArrow(ctx, 0, 0, HALF - 4, 0);
        // Secondary split upward
        ctx.fillStyle = 'rgba(243,156,18,0.8)';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -(HALF - 6));
        ctx.strokeStyle = 'rgba(243,156,18,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-4, -(HALF - 10));
        ctx.lineTo(0, -(HALF - 6));
        ctx.lineTo(4, -(HALF - 10));
        ctx.fillStyle = 'rgba(243,156,18,0.8)';
        ctx.fill();
        break;
      }

      case 'SENSOR': {
        this._drawBeltLane(ctx, beltPhase, '#3a3a50', '#4a4a60');
        // Sensor beam
        ctx.strokeStyle = 'rgba(74,158,255,0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, -HALF + 6); ctx.lineTo(0, HALF - 6);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }

      case 'WEIGHT_STATION': {
        this._drawBeltLane(ctx, beltPhase, '#3a2a2a', '#4a3a3a');
        // Scale icon
        ctx.fillStyle = cell.flagged ? '#e74c3c' : '#f39c12';
        ctx.font = `${Math.floor(HALF * 0.8)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚖', 0, 0);
        break;
      }
    }
    ctx.restore();
  }

  _drawBeltLane(ctx, phase, colorA, colorB) {
    const w = CELL - 6;
    const h = 14;
    // Lane background
    ctx.fillStyle = colorA;
    ctx.fillRect(-w/2, -h/2, w, h);
    // Moving stripes
    const stripeW = 10;
    const offset = (phase * 2) % stripeW;
    ctx.fillStyle = colorB;
    for (let sx = -w/2 - stripeW + offset; sx < w/2; sx += stripeW) {
      ctx.fillRect(sx, -h/2, stripeW * 0.5, h);
    }
  }

  _drawArrow(ctx, x1, y1, x2, y2) {
    const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    if (len < 6) return;
    const angle = Math.atan2(y2-y1, x2-x1);
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -3); ctx.lineTo(len - 7, -3);
    ctx.lineTo(len - 7, -6); ctx.lineTo(len, 0);
    ctx.lineTo(len - 7, 6); ctx.lineTo(len - 7, 3);
    ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawFactoryIcon(ctx) {
    // Simple factory silhouette
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(-12, -4, 24, 14);
    ctx.fillRect(-10, -14, 6, 10);
    ctx.fillRect(4, -10, 5, 6);
    // chimney smoke dots
    ctx.fillStyle = 'rgba(46,204,113,0.5)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-7 + i*10, -17 - i*3, 2 + i, 0, Math.PI * 2);
      ctx.fill();
    }
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('IN', 0, 6);
  }

  _drawCollectorIcon(ctx) {
    ctx.fillStyle = '#4a9eff';
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    // Target rings
    ctx.beginPath();
    ctx.arc(0, 0, HALF - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, HALF - 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OUT', 0, HALF - 2);
  }

  _drawPackage(ctx, pkg) {
    const x = pkg.col * CELL + HALF;
    const y = pkg.row * CELL + HALF;

    const pkgDef = PKG_TYPES[pkg.type];
    const color = pkg.state === 'blocked' ? '#e74c3c' :
                  pkg.state === 'broken' ? '#7f8c8d' : pkgDef.color;

    const size = pkg.type === 'HEAVY' ? 16 : 12;

    // Pulsing for blocked/broken
    let scale = 1;
    if (pkg.state === 'blocked') scale = 0.85 + 0.15 * Math.sin(beltPhase * 4);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-size/2 + 2, -size/2 + 2, size, size);

    // Package body
    ctx.fillStyle = color;
    ctx.beginPath();
    this._roundRect(ctx, -size/2, -size/2, size, size, 3);
    ctx.fill();

    // Inner lighter square (box lid)
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(-size/2 + 3, -size/2 + 3, size - 6, size - 6);

    // Type indicator
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(size * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = pkg.type === 'NORMAL' ? 'N' :
                 pkg.type === 'FRAGILE' ? 'F' : 'H';
    ctx.fillText(icon, 0, 0);

    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    if (w < 2*r) r = w/2;
    if (h < 2*r) r = h/2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
}

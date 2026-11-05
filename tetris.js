// Klassen-Tetris – Spiellogik (läuft komplett im Browser des Schülers)
'use strict';

const COLS = 10, ROWS = 20;
const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};
// Index 1..7 = Farbe des Steins
const COLORS = [null, '#38bdf8', '#facc15', '#c084fc', '#4ade80', '#f87171', '#60a5fa', '#fb923c'];
const LINE_POINTS = [0, 100, 300, 500, 800];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rotateCW(m) {
  const n = m.length;
  const r = m.map(row => row.slice());
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) r[x][n - 1 - y] = m[y][x];
  return r;
}
function rotateCCW(m) { return rotateCW(rotateCW(rotateCW(m))); }

class TetrisGame {
  constructor(seed) {
    this.rng = mulberry32(seed);
    this.board = new Uint8Array(COLS * ROWS);
    this.bag = [];
    this.queue = [];
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.topOuts = 0;
    this.gravityAcc = 0;
    this.lockAcc = 0;
    this.lockResets = 0;
    this.version = 0;       // steigt bei jeder sichtbaren Änderung
    this.flash = 0;         // kurzer Effekt nach Top-Out
    this.fillQueue();
    this.spawn();
  }

  fillQueue() {
    while (this.queue.length < 3) {
      if (this.bag.length === 0) {
        this.bag = TYPES.slice();
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      this.queue.push(this.bag.pop());
    }
  }

  get nextType() { return this.queue[0]; }

  spawn() {
    const type = this.queue.shift();
    this.fillQueue();
    const m = SHAPES[type].map(r => r.slice());
    this.piece = { type, id: TYPES.indexOf(type) + 1, m, x: Math.floor((COLS - m.length) / 2), y: type === 'I' ? -1 : 0 };
    this.gravityAcc = 0;
    this.lockAcc = 0;
    this.lockResets = 0;
    if (this.collides(this.piece.m, this.piece.x, this.piece.y)) this.topOut();
    this.version++;
  }

  // Klassisch auf Zeit: Wer oben anstößt, bekommt ein leeres Feld und spielt weiter.
  topOut() {
    this.topOuts++;
    this.board.fill(0);
    this.flash = 600;
  }

  collides(m, px, py) {
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m.length; x++) {
        if (!m[y][x]) continue;
        const bx = px + x, by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && this.board[by * COLS + bx]) return true;
      }
    }
    return false;
  }

  grounded() { return this.collides(this.piece.m, this.piece.x, this.piece.y + 1); }

  afterMove() {
    if (this.lockResets < 15) { this.lockAcc = 0; this.lockResets++; }
    this.version++;
  }

  move(dx) {
    const p = this.piece;
    if (!this.collides(p.m, p.x + dx, p.y)) { p.x += dx; this.afterMove(); return true; }
    return false;
  }

  rotate(dir) {
    const p = this.piece;
    if (p.type === 'O') return false;
    const m = dir > 0 ? rotateCW(p.m) : rotateCCW(p.m);
    const kicks = [[0,0],[-1,0],[1,0],[0,-1],[-2,0],[2,0],[-1,-1],[1,-1]];
    for (const [kx, ky] of kicks) {
      if (!this.collides(m, p.x + kx, p.y + ky)) {
        p.m = m; p.x += kx; p.y += ky;
        this.afterMove();
        return true;
      }
    }
    return false;
  }

  softDrop() {
    const p = this.piece;
    if (!this.collides(p.m, p.x, p.y + 1)) {
      p.y++; this.score += 1; this.gravityAcc = 0; this.version++;
      return true;
    }
    return false;
  }

  hardDrop() {
    const p = this.piece;
    let d = 0;
    while (!this.collides(p.m, p.x, p.y + 1)) { p.y++; d++; }
    this.score += 2 * d;
    this.lock();
  }

  ghostY() {
    const p = this.piece;
    let y = p.y;
    while (!this.collides(p.m, p.x, y + 1)) y++;
    return y;
  }

  lock() {
    const p = this.piece;
    let above = false;
    for (let y = 0; y < p.m.length; y++) for (let x = 0; x < p.m.length; x++) {
      if (!p.m[y][x]) continue;
      const by = p.y + y;
      if (by < 0) { above = true; continue; }
      this.board[by * COLS + p.x + x] = p.id;
    }
    this.clearLines();
    if (above) this.topOut();
    this.spawn();
  }

  clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      let full = true;
      for (let x = 0; x < COLS; x++) if (!this.board[y * COLS + x]) { full = false; break; }
      if (full) {
        this.board.copyWithin(COLS, 0, y * COLS);
        this.board.fill(0, 0, COLS);
        cleared++;
        y++; // dieselbe Zeile noch einmal prüfen
      }
    }
    if (cleared) {
      this.score += LINE_POINTS[cleared] * this.level;
      this.lines += cleared;
      this.level = 1 + Math.floor(this.lines / 10);
    }
  }

  gravityInterval() { return Math.max(60, 800 * Math.pow(0.85, this.level - 1)); }

  update(dt) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.grounded()) {
      this.lockAcc += dt;
      if (this.lockAcc >= 500) this.lock();
      return;
    }
    this.lockAcc = 0;
    this.gravityAcc += dt;
    const iv = this.gravityInterval();
    while (this.gravityAcc >= iv) {
      this.gravityAcc -= iv;
      if (this.grounded()) break;
      this.piece.y++;
      this.version++;
    }
  }

  // Spielfeld inkl. aktuellem Stein als 200-Zeichen-String ('0'..'7')
  serialize() {
    const b = Array.from(this.board);
    const p = this.piece;
    for (let y = 0; y < p.m.length; y++) for (let x = 0; x < p.m.length; x++) {
      if (!p.m[y][x]) continue;
      const by = p.y + y;
      if (by >= 0 && by < ROWS) b[by * COLS + p.x + x] = p.id;
    }
    return b.join('');
  }
}

// ---------- Zeichnen ----------
function drawBoard(canvas, cells, cell, opts = {}) {
  const w = COLS * cell, h = ROWS * cell;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = opts.bg || '#0b1020';
  ctx.fillRect(0, 0, w, h);
  // dezentes Raster
  if (cell >= 14) {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, h); }
    for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(w, y * cell + 0.5); }
    ctx.stroke();
  }
  const gap = cell >= 14 ? 1 : 0;
  if (opts.ghost) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (const [x, y] of opts.ghost) if (y >= 0) ctx.fillRect(x * cell + gap, y * cell + gap, cell - 2 * gap, cell - 2 * gap);
  }
  if (!cells) return;
  for (let i = 0; i < COLS * ROWS; i++) {
    const v = typeof cells === 'string' ? cells.charCodeAt(i) - 48 : cells[i];
    if (!v) continue;
    const x = i % COLS, y = (i / COLS) | 0;
    ctx.fillStyle = opts.dim ? '#475569' : COLORS[v];
    ctx.fillRect(x * cell + gap, y * cell + gap, cell - 2 * gap, cell - 2 * gap);
  }
  if (opts.flash) {
    ctx.fillStyle = `rgba(248,113,113,${0.35 * opts.flash})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawPreview(canvas, type, cell) {
  const size = 4 * cell;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr; canvas.height = size * dpr;
  canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  if (!type) return;
  const m = SHAPES[type];
  const id = TYPES.indexOf(type) + 1;
  let minX = 9, maxX = -1, minY = 9, maxY = -1;
  for (let y = 0; y < m.length; y++) for (let x = 0; x < m.length; x++) if (m[y][x]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const ox = (size - (maxX - minX + 1) * cell) / 2 - minX * cell;
  const oy = (size - (maxY - minY + 1) * cell) / 2 - minY * cell;
  ctx.fillStyle = COLORS[id];
  for (let y = 0; y < m.length; y++) for (let x = 0; x < m.length; x++) if (m[y][x]) {
    ctx.fillRect(ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2);
  }
}

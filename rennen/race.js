// Klassen-Rennen – Strecken, Fahrphysik und Zeichnen
'use strict';

const WORLD_W = 1600, WORLD_H = 900;
const KART_R = 13;           // Radius für Zusammenstöße
const SAMPLE_STEP = 6;       // Abstand der Mittellinien-Punkte in px

// Strecken: geschlossene Mittellinie aus Kontrollpunkten (wird geglättet)
const TRACKS = [
  {
    id: 'rund', name: 'Rundkurs', width: 120,
    pts: [[330, 150], [800, 130], [1270, 150], [1460, 280], [1470, 620], [1300, 770], [1050, 780],
      [880, 640], [720, 640], [550, 780], [300, 770], [140, 620], [130, 300]],
  },
  {
    id: 'kurve', name: 'Kurvenreich', width: 110,
    pts: [[250, 130], [700, 120], [860, 230], [800, 400], [560, 440], [470, 560], [600, 660], [990, 665],
      [1080, 540], [1030, 380], [1100, 200], [1300, 130], [1480, 250], [1490, 600], [1390, 800],
      [800, 838], [260, 812], [120, 620], [110, 300]],
  },
  {
    id: 'haken', name: 'Haken', width: 110,
    pts: [[220, 140], [1350, 130], [1480, 250], [1440, 400], [1150, 430], [700, 400], [520, 480],
      [600, 600], [1100, 600], [1420, 640], [1460, 790], [1250, 830], [300, 820], [130, 700], [120, 280]],
  },
];

// ------------------------------------------------------------ Geometrie
function buildTrack(def) {
  const P = def.pts, n = P.length, dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let s = 0; s < 40; s++) {
      const t = s / 40, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  // gleichmäßig neu abtasten
  const pts = [dense[0]];
  let carry = 0;
  for (let i = 1; i <= dense.length; i++) {
    let a = dense[i - 1];
    const b = dense[i % dense.length];
    let seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (carry + seg >= SAMPLE_STEP) {
      const need = SAMPLE_STEP - carry, t = need / seg;
      a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      pts.push(a);
      seg -= need; carry = 0;
    }
    carry += seg;
  }
  if (Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]) < SAMPLE_STEP * 0.5) pts.pop();
  const N = pts.length;
  const tan = pts.map((p, i) => {
    const q = pts[(i + 1) % N], r = pts[(i - 1 + N) % N];
    const dx = q[0] - r[0], dy = q[1] - r[1], l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  });
  const track = { def, pts, tan, N, half: def.width / 2, boosts: [] };
  // Turbo-Felder an festen Stellen der Strecke
  for (const f of [0.22, 0.55, 0.8]) {
    const i = Math.floor(f * N), side = (Math.floor(f * 10) % 2 ? 1 : -1) * track.half * 0.45;
    const [tx, ty] = tan[i];
    track.boosts.push({ x: pts[i][0] - ty * side, y: pts[i][1] + tx * side, a: Math.atan2(ty, tx) });
  }
  return track;
}

// nächster Mittellinien-Punkt (zuerst in der Nähe des letzten Index suchen)
function nearest(track, x, y, hint) {
  const { pts, N } = track;
  let best = -1, bd = Infinity;
  if (hint >= 0) {
    for (let k = -50; k <= 50; k++) {
      const i = (hint + k + N) % N, dx = pts[i][0] - x, dy = pts[i][1] - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
  }
  if (best < 0 || bd > (track.half * 3) ** 2) {
    for (let i = 0; i < N; i++) {
      const dx = pts[i][0] - x, dy = pts[i][1] - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
  }
  return { i: best, d: Math.sqrt(bd) };
}

// Startaufstellung: Plätze hinter der Ziellinie, zwei nebeneinander
function gridSlot(track, slot) {
  const row = Math.floor(slot / 2), col = slot % 2 ? 1 : -1;
  const back = Math.round((30 + row * 42) / SAMPLE_STEP);
  const i = (track.N - back) % track.N;
  const [tx, ty] = track.tan[i], [px, py] = track.pts[i], side = col * track.half * 0.38;
  return { x: px - ty * side, y: py + tx * side, a: Math.atan2(ty, tx) };
}

// ------------------------------------------------------------ Eigenes Kart
class Kart {
  constructor(track, slot, laps) {
    const s = gridSlot(track, slot);
    this.track = track; this.laps = laps;
    this.x = s.x; this.y = s.y; this.a = s.a; this.v = 0;
    this.idx = nearest(track, this.x, this.y, -1).i;
    this.crossings = 0;          // wie oft die Ziellinie vorwärts überquert wurde
    this.boost = 0;              // verbleibende Turbo-Zeit in s
    this.offroad = false;
    this.finished = false;
  }

  get lap() { return Math.max(1, Math.min(this.laps, this.crossings)); }
  get progress() { return this.crossings * this.track.N + this.idx; }

  update(dt, input, others) {
    const t = this.track;
    // Fahren
    const maxV = this.boost > 0 ? 560 : this.offroad ? 130 : 340;
    if (input.up) this.v += (this.v < 0 ? 900 : 430) * dt;
    else if (input.down) this.v -= (this.v > 0 ? 700 : 260) * dt;
    else this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), 180 * dt);
    if (this.v > maxV) this.v = Math.max(maxV, this.v - 600 * dt);
    if (this.v < -120) this.v = -120;
    if (this.boost > 0) { this.boost -= dt; this.v = Math.max(this.v, 480); }
    // Lenken (wirkt stärker bei Fahrt, rückwärts andersherum)
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const grip = Math.min(1, Math.abs(this.v) / 120);
    this.a += steer * 3.0 * grip * dt * Math.sign(this.v || 1);
    this.x += Math.cos(this.a) * this.v * dt;
    this.y += Math.sin(this.a) * this.v * dt;
    // Rand der Welt
    if (this.x < KART_R || this.x > WORLD_W - KART_R || this.y < KART_R || this.y > WORLD_H - KART_R) {
      this.x = Math.max(KART_R, Math.min(WORLD_W - KART_R, this.x));
      this.y = Math.max(KART_R, Math.min(WORLD_H - KART_R, this.y));
      this.v *= -0.3;
    }
    // andere Karts wegschieben (jeder schiebt nur sich selbst)
    for (const o of others) {
      const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy);
      if (d > 0.01 && d < KART_R * 2) {
        const push = (KART_R * 2 - d) * 0.6;
        this.x += dx / d * push; this.y += dy / d * push;
        this.v *= 0.97;
      }
    }
    // Strecke / Rasen
    const prev = this.idx, n = nearest(t, this.x, this.y, this.idx);
    this.idx = n.i;
    this.offroad = n.d > t.half;
    if (prev > t.N * 0.75 && n.i < t.N * 0.25) this.crossings++;
    else if (prev < t.N * 0.25 && n.i > t.N * 0.75) this.crossings--;
    if (this.crossings > this.laps) this.finished = true;
    // Turbo-Felder
    for (const b of t.boosts) if (Math.hypot(b.x - this.x, b.y - this.y) < 26 && this.boost <= 0) this.boost = 0.9;
  }
}

// ------------------------------------------------------------ Zeichnen
const KART_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#06b6d4', '#ec4899', '#f1f5f9'];

function drawTrackImage(track) {
  const c = document.createElement('canvas');
  c.width = WORLD_W; c.height = WORLD_H;
  const g = c.getContext('2d');
  g.fillStyle = '#14532d'; g.fillRect(0, 0, WORLD_W, WORLD_H);
  // dezentes Rasenmuster
  g.fillStyle = '#166534';
  for (let y = 0; y < WORLD_H; y += 60) for (let x = (y / 60) % 2 * 60; x < WORLD_W; x += 120) g.fillRect(x, y, 60, 60);
  const path = () => {
    g.beginPath();
    track.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
    g.closePath();
  };
  g.lineJoin = 'round';
  path(); g.strokeStyle = '#e2e8f0'; g.lineWidth = track.def.width + 10; g.stroke();
  path(); g.strokeStyle = '#475569'; g.lineWidth = track.def.width; g.stroke();
  g.setLineDash([18, 22]); path(); g.strokeStyle = 'rgba(226,232,240,.35)'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
  // Ziellinie (Schachbrett)
  const [px, py] = track.pts[0], [tx, ty] = track.tan[0];
  g.save(); g.translate(px, py); g.rotate(Math.atan2(ty, tx));
  const sq = 10, rows = Math.ceil(track.def.width / sq);
  for (let r = 0; r < rows; r++) for (let k = 0; k < 2; k++) {
    g.fillStyle = (r + k) % 2 ? '#0f172a' : '#f8fafc';
    g.fillRect(-sq + k * sq, -track.half + r * sq, sq, sq);
  }
  g.restore();
  // Turbo-Felder
  for (const b of track.boosts) {
    g.save(); g.translate(b.x, b.y); g.rotate(b.a);
    g.fillStyle = '#facc15'; g.globalAlpha = 0.9;
    g.fillRect(-20, -14, 40, 28);
    g.fillStyle = '#0f172a';
    for (const off of [-10, 4]) { g.beginPath(); g.moveTo(off, -8); g.lineTo(off + 10, 0); g.lineTo(off, 8); g.closePath(); g.fill(); }
    g.restore();
  }
  return c;
}

function drawKart(g, k, color, opts) {
  g.save();
  g.translate(k.x, k.y);
  if (opts.me) {
    g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2);
    g.fillStyle = 'rgba(250,204,21,.25)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = '#facc15'; g.stroke();
  }
  g.rotate(k.a);
  g.globalAlpha = opts.dim ? 0.4 : 1;
  g.fillStyle = '#0f172a';
  for (const [x, y] of [[-9, -10], [6, -10], [-9, 7], [6, 7]]) g.fillRect(x, y, 7, 3);   // Räder
  g.fillStyle = color;
  g.beginPath(); g.roundRect(-12, -7, 24, 14, 4); g.fill();
  g.fillStyle = 'rgba(15,23,42,.6)'; g.fillRect(2, -4, 5, 8);                           // Fahrer
  if (opts.boost) { g.fillStyle = '#facc15'; g.beginPath(); g.moveTo(-12, -4); g.lineTo(-22, 0); g.lineTo(-12, 4); g.fill(); }
  g.restore();
  // Name
  g.save();
  g.font = (opts.me ? '700 15px' : '600 13px') + ' system-ui, "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 4; g.strokeStyle = 'rgba(15,23,42,.85)';
  const label = opts.label;
  g.strokeText(label, k.x, k.y - 28); g.fillStyle = opts.me ? '#facc15' : '#f8fafc';
  g.globalAlpha = opts.dim ? 0.5 : 1;
  g.fillText(label, k.x, k.y - 28);
  g.restore();
}

if (typeof module !== 'undefined') module.exports = { TRACKS, buildTrack, nearest, gridSlot, Kart, WORLD_W, WORLD_H };

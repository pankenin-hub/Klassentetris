// Physik-Team – Szenario "Frage-Labyrinth"
// Jeder steuert seinen Avatar durch ein großes Labyrinth. Auf den ?-Feldern (auf dem richtigen Weg und in
// Sackgassen) bekommt genau dieser Spieler eine Aufgabe. Erst nach einer richtigen Antwort geht es weiter.
// Gewonnen ist das Level, wenn alle im Ziel sind, bevor die Zeit abläuft.
'use strict';

const MZ_COLS = 41, MZ_ROWS = 21;          // Rasterzellen (ungerade, damit Wände dazwischen passen)
const MZ_CELL = 38;
const MZ_OX = Math.round((WORLD_W - MZ_COLS * MZ_CELL) / 2);
const MZ_OY = WORLD_H - MZ_ROWS * MZ_CELL - 12;
const MZ_STEP = 0.14;                       // Sekunden pro Schritt, solange die Richtung gehalten wird
const MZ_DIRS = [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]]; // 0 = stehen, 1 hoch, 2 rechts, 3 runter, 4 links

// ------------------------------------------------------------ Fragen
// Level 1: 30 Aufgaben zum kleinen Einmaleins (Malaufgaben, Lückenaufgaben, Geteiltaufgaben), jedes Mal neu ausgelost
function mzEinmaleins(R) {
  const qs = [], seen = new Set();
  const pick = (arr, n) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  let guard = 0;
  while (qs.length < 30 && guard++ < 5000) {
    const a = 2 + Math.floor(R() * 9), b = 2 + Math.floor(R() * 9), i = qs.length;
    const kind = i % 5 === 3 ? 'gap' : i % 5 === 4 ? 'div' : 'mul';
    const key = kind + (kind === 'mul' ? Math.min(a, b) + 'x' + Math.max(a, b) : a + 'x' + b);
    if (seen.has(key)) continue;
    seen.add(key);
    let text, ans, cand;
    if (kind === 'mul') {
      text = a + ' · ' + b + ' = ?'; ans = a * b;
      cand = [(a + 1) * b, (a - 1) * b, a * (b + 1), a * (b - 1), ans + 1, ans - 1, ans + 10, ans - 10, ans + 2];
    } else {
      text = kind === 'gap' ? '? · ' + b + ' = ' + (a * b) : (a * b) + ' : ' + b + ' = ?';
      ans = a;
      cand = [a + 1, a - 1, a + 2, a - 2, b === a ? a + 3 : b, a + 3];
    }
    cand = [...new Set(cand.filter(v => v > 0 && v !== ans))];
    const opts = [ans, ...pick(cand, 3)].map(String);
    qs.push({ text, opts });
  }
  return qs;
}

// Level 2: Energieformen und Energiewandlung (erste Antwort ist jeweils richtig, die Reihenfolge wird gemischt)
const MZ_ENERGIE = [
  ['Welche Energie hat ein rollender Ball?', 'Bewegungsenergie', 'Lageenergie', 'chemische Energie', 'Kernenergie'],
  ['Ein Buch liegt oben auf dem Schrank. Welche Energie hat es dort?', 'Lageenergie (potenzielle Energie)', 'Bewegungsenergie', 'elektrische Energie', 'Strahlungsenergie'],
  ['In welcher Form ist Energie in Brot, Benzin und Batterien gespeichert?', 'chemische Energie', 'thermische Energie', 'Lageenergie', 'Spannenergie'],
  ['Ein gespannter Bogen oder eine aufgezogene Feder speichert …', 'Spannenergie', 'chemische Energie', 'thermische Energie', 'Strahlungsenergie'],
  ['Welche Umwandlung passiert in einer Solarzelle?', 'Strahlungsenergie → elektrische Energie', 'elektrische Energie → Strahlungsenergie', 'chemische Energie → elektrische Energie', 'thermische Energie → Bewegungsenergie'],
  ['Welche Umwandlung passiert in einem Elektromotor?', 'elektrische Energie → Bewegungsenergie', 'Bewegungsenergie → elektrische Energie', 'thermische Energie → Bewegungsenergie', 'chemische Energie → Strahlungsenergie'],
  ['Welche Umwandlung passiert in einem Fahrrad-Dynamo?', 'Bewegungsenergie → elektrische Energie', 'elektrische Energie → Bewegungsenergie', 'Strahlungsenergie → elektrische Energie', 'chemische Energie → Bewegungsenergie'],
  ['Eine Glühlampe leuchtet. In welche Energieformen wird die elektrische Energie umgewandelt?', 'Licht und vor allem Wärme', 'nur Licht', 'chemische Energie', 'Bewegungsenergie'],
  ['Du reibst deine Hände aneinander und sie werden warm. Was wird umgewandelt?', 'Bewegungsenergie → thermische Energie', 'thermische Energie → Bewegungsenergie', 'chemische Energie → Lageenergie', 'elektrische Energie → Wärme'],
  ['Ein Apfel fällt vom Baum. Welche Umwandlung findet statt?', 'Lageenergie → Bewegungsenergie', 'Bewegungsenergie → Lageenergie', 'chemische Energie → Lageenergie', 'thermische Energie → Bewegungsenergie'],
  ['Ein Handy-Akku wird geladen. Was passiert im Akku?', 'elektrische Energie → chemische Energie', 'chemische Energie → elektrische Energie', 'Strahlungsenergie → chemische Energie', 'thermische Energie → elektrische Energie'],
  ['Welche Energie des gestauten Wassers nutzt ein Wasserkraftwerk?', 'Lageenergie', 'chemische Energie', 'Kernenergie', 'Strahlungsenergie'],
  ['Woher kommt die Energie der Sonne?', 'Kernenergie (Kernfusion)', 'chemische Energie (Verbrennung)', 'elektrische Energie', 'Lageenergie'],
  ['Beim Rennen wird in deinem Körper umgewandelt:', 'chemische Energie → Bewegungsenergie und Wärme', 'Bewegungsenergie → chemische Energie', 'elektrische Energie → Bewegungsenergie', 'Strahlungsenergie → Wärme'],
  ['Was gilt bei jeder Energieumwandlung?', 'Die Gesamtenergie bleibt gleich.', 'Ein Teil der Energie verschwindet.', 'Es entsteht neue Energie.', 'Die Energie wird immer mehr.'],
  ['In welcher Einheit wird Energie gemessen?', 'Joule (J)', 'Watt (W)', 'Newton (N)', 'Volt (V)'],
];

function mzShuffleOpts(R, text, opts) {
  const order = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { text, opts: order.map(k => opts[k]), ok: order.indexOf(0) };
}

// ------------------------------------------------------------ Labyrinth erzeugen
function mzGenerate(R) {
  const C = MZ_COLS, Rw = MZ_ROWS, W = (C - 1) / 2, H = (Rw - 1) / 2;
  const cells = new Uint8Array(C * Rw); // 0 Wand, 1 Weg
  const seen = new Uint8Array(W * H);
  const open = (x, y) => { cells[y * C + x] = 1; };
  const stack = [[0, 0]];
  seen[0] = 1; open(1, 1);
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const nb = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[ny * W + nx]) nb.push([nx, ny]);
    }
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny] = nb[Math.floor(R() * nb.length)];
    seen[ny * W + nx] = 1;
    open(x + nx + 1, y + ny + 1);       // Wand dazwischen
    open(2 * nx + 1, 2 * ny + 1);
    stack.push([nx, ny]);
  }
  // ein paar Querverbindungen, damit es mehrere Wege (und trotzdem viele Sackgassen) gibt
  let loops = 0, guard = 0;
  while (loops < 7 && guard++ < 2000) {
    const x = 1 + Math.floor(R() * (C - 2)), y = 1 + Math.floor(R() * (Rw - 2));
    if (cells[y * C + x] || (x + y) % 2 === 0) continue;
    const horiz = x % 2 === 0;
    const a = horiz ? cells[y * C + x - 1] && cells[y * C + x + 1] : cells[(y - 1) * C + x] && cells[(y + 1) * C + x];
    if (a) { open(x, y); loops++; }
  }
  return cells;
}

function mzBfs(cells, sx, sy) {
  const C = MZ_COLS, dist = new Int32Array(C * MZ_ROWS).fill(-1), prev = new Int32Array(C * MZ_ROWS).fill(-1);
  const q = [sy * C + sx]; dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % C, y = (i / C) | 0;
    for (let d = 1; d <= 4; d++) {
      const nx = x + MZ_DIRS[d][0], ny = y + MZ_DIRS[d][1], j = ny * C + nx;
      if (nx < 0 || ny < 0 || nx >= C || ny >= MZ_ROWS || !cells[j] || dist[j] >= 0) continue;
      dist[j] = dist[i] + 1; prev[j] = i; q.push(j);
    }
  }
  return { dist, prev };
}

function mzCellXY(x, y) { return [MZ_OX + (x + 0.5) * MZ_CELL, MZ_OY + (y + 0.5) * MZ_CELL]; }

const mzCache = new WeakMap(); // vorgezeichnetes Labyrinth je Level

const MODE_LABYRINTH = {
  id: 'labyrinth',
  name: 'Frage-Labyrinth',
  topic: 'Quiz: Einmaleins und Energie',
  color: NEON.violet,
  levels: [
    { name: 'Kleines Einmaleins', dur: 360, fields: 20, task: 'Steuert alle euren Avatar ins Ziel ★ unten rechts! Auf jedem ?-Feld bekommst du eine Rechenaufgabe. Erst wenn du richtig antwortest, geht es weiter. Vorsicht, auch in Sackgassen lauern Fragen!' },
    { name: 'Energieformen & Energiewandlung', dur: 360, fields: 14, task: 'Ein neues Labyrinth! Auf den ?-Feldern geht es um Energieformen und Energiewandlung. Alle müssen ins Ziel ★, bevor die Zeit abläuft.' },
  ],

  init(li, players, seed) {
    const lv = this.levels[li], R = rng(seed);
    const start = [1, 1], goal = [MZ_COLS - 2, MZ_ROWS - 2], gi = goal[1] * MZ_COLS + goal[0];
    // mehrere Labyrinthe auslosen und das mit dem längsten Weg nehmen (soll schön verwinkelt sein)
    let cells = null, best = null;
    for (let k = 0; k < 12; k++) {
      const c = mzGenerate(R), b = mzBfs(c, start[0], start[1]);
      if (!best || b.dist[gi] > best.dist[gi]) { cells = c; best = b; }
    }
    const { dist, prev } = best;
    // Lösungsweg
    const path = [];
    for (let i = gi; i >= 0; i = prev[i]) path.push(i);
    path.reverse();
    const onPath = new Set(path);
    // Frage-Felder: etwa 40 % auf dem richtigen Weg (gleichmäßig verteilt), der Rest auf Abwegen und in Sackgassen
    const fields = [], taken = [];
    const far = i => taken.every(j => Math.abs(i % MZ_COLS - j % MZ_COLS) + Math.abs(((i / MZ_COLS) | 0) - ((j / MZ_COLS) | 0)) >= 4);
    const nOn = Math.round(lv.fields * 0.4);
    for (let k = 1; k <= nOn; k++) {
      let idx = Math.round(4 + (k - 0.5) * (path.length - 7) / nOn);
      idx = clamp(idx, 4, path.length - 3);
      const i = path[idx];
      if (far(i)) { taken.push(i); fields.push([i % MZ_COLS, (i / MZ_COLS) | 0, 1]); }
    }
    const deg = i => { let n = 0; const x = i % MZ_COLS, y = (i / MZ_COLS) | 0; for (let d = 1; d <= 4; d++) if (cells[(y + MZ_DIRS[d][1]) * MZ_COLS + x + MZ_DIRS[d][0]]) n++; return n; };
    const off = [];
    for (let i = 0; i < cells.length; i++) if (cells[i] && !onPath.has(i) && dist[i] > 4) off.push(i);
    // zuerst Sackgassen, dann zufällige Abwege
    const dead = off.filter(i => deg(i) === 1), other = off.filter(i => deg(i) !== 1);
    for (let i = other.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [other[i], other[j]] = [other[j], other[i]]; }
    for (let i = dead.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [dead[i], dead[j]] = [dead[j], dead[i]]; }
    for (const i of [...dead.slice(0, Math.ceil((lv.fields - nOn) * 0.6)), ...other, ...dead.slice(Math.ceil((lv.fields - nOn) * 0.6))]) {
      if (fields.length >= lv.fields) break;
      if (far(i)) { taken.push(i); fields.push([i % MZ_COLS, (i / MZ_COLS) | 0, 0]); }
    }
    const fieldAt = new Map(fields.map((f, k) => [f[1] * MZ_COLS + f[0], k]));

    const qs = li === 0
      ? mzEinmaleins(R).map(q => mzShuffleOpts(R, q.text, q.opts))
      : MZ_ENERGIE.map(q => mzShuffleOpts(R, q[0], q.slice(1)));

    const p = {};
    for (const pl of players) {
      const order = qs.map((_, k) => k);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      p[pl.id] = { x: start[0], y: start[1], dir: 0, moveT: 0, q: -1, field: -1, fbT: 0, fbq: -1, fbok: false, pending: false,
        mask: 0, right: 0, wrong: 0, goal: false, goalT: 0, order, oi: 0, gone: false };
    }
    return { li, lv, cells, start, goal, path, fields, fieldAt, qs, p, t: 0, over: null };
  },

  setup(st) {
    return {
      li: st.li, cols: MZ_COLS, rows: MZ_ROWS, cells: Array.from(st.cells).join(''),
      start: st.start, goal: st.goal, fields: st.fields, dur: st.lv.dur,
      path: st.path.map(i => [i % MZ_COLS, (i / MZ_COLS) | 0]),
      qs: st.qs.map(q => ({ text: q.text, opts: q.opts, ok: q.ok })),
    };
  },

  nextQ(st, p) { return p.order[p.oi++ % p.order.length]; },

  input(st, id, msg) {
    const p = st.p[id];
    if (!p) return;
    p.gone = false;
    if (typeof msg.dir === 'number') {
      p.dir = clamp(msg.dir | 0, 0, 4);
      if (!p.dir) p.moveT = 0;
    }
    if (typeof msg.ans === 'number' && p.q >= 0 && (msg.q | 0) === p.q && p.fbT <= 0) {
      const ok = (msg.ans | 0) === st.qs[p.q].ok;
      p.fbq = p.q; p.fbok = ok; p.q = -1;
      if (ok) { p.right++; if (p.field >= 0 && p.field < 31) p.mask |= 1 << p.field; p.fbT = 1.2; }
      else { p.wrong++; p.fbT = 3; p.pending = true; }
    }
  },

  leave(st, id) { if (st.p[id]) { st.p[id].gone = true; st.p[id].dir = 0; } },

  step(st, dt) {
    if (st.over) return null;
    st.t += dt;
    for (const id in st.p) {
      const p = st.p[id];
      if (p.gone || p.goal) continue;
      if (p.fbT > 0) {
        p.fbT -= dt;
        if (p.fbT <= 0) { p.fbT = 0; if (p.pending) { p.pending = false; p.q = this.nextQ(st, p); } }
        continue;
      }
      if (p.q >= 0 || !p.dir) continue;
      p.moveT -= dt;
      if (p.moveT > 0) continue;
      const nx = p.x + MZ_DIRS[p.dir][0], ny = p.y + MZ_DIRS[p.dir][1];
      if (nx < 0 || ny < 0 || nx >= MZ_COLS || ny >= MZ_ROWS || !st.cells[ny * MZ_COLS + nx]) { p.moveT = 0; continue; }
      p.x = nx; p.y = ny; p.moveT += MZ_STEP;
      const f = st.fieldAt.get(ny * MZ_COLS + nx);
      if (f !== undefined && !(p.mask >> f & 1)) { p.field = f; p.q = this.nextQ(st, p); p.moveT = 0; }
      if (nx === st.goal[0] && ny === st.goal[1]) { p.goal = true; p.goalT = st.t; p.dir = 0; }
    }
    const act = Object.values(st.p).filter(p => !p.gone);
    const right = act.reduce((s, p) => s + p.right, 0), wrong = act.reduce((s, p) => s + p.wrong, 0);
    const tally = right + ' Aufgaben richtig gelöst' + (wrong ? ', ' + wrong + ' falsch' : '') + '.';
    if (act.length && act.every(p => p.goal)) {
      const share = st.t / st.lv.dur, stars = share <= 0.5 ? 3 : share <= 0.8 ? 2 : 1;
      st.over = { win: true, stars, text: '★'.repeat(stars) + '☆'.repeat(3 - stars) + '  Alle ' + act.length + ' sind im Ziel! Zeit: ' + this.clock(st.t) + '. Zusammen habt ihr ' + tally };
      return st.over;
    }
    if (st.t >= st.lv.dur) {
      const n = act.filter(p => p.goal).length;
      st.over = { win: false, text: 'Die Zeit ist um. ' + n + ' von ' + act.length + ' haben das Ziel erreicht. Zusammen habt ihr ' + tally };
      return st.over;
    }
    return null;
  },

  clock(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },

  snap(st) {
    const p = [];
    for (const id in st.p) {
      const q = st.p[id];
      if (q.gone) continue;
      p.push([Number(id), q.x, q.y, q.q, Math.ceil(q.fbT * 10), q.fbq, q.fbok ? 1 : 0, q.goal ? 1 : 0, q.right, q.wrong, q.mask]);
    }
    return { t: Math.round(st.t * 10) / 10, p };
  },

  // ------------------------------------------------------------ Zeichnen
  background(setup) {
    let c = mzCache.get(setup);
    if (c) return c;
    const k = 1.5;
    c = document.createElement('canvas');
    c.width = WORLD_W * k; c.height = WORLD_H * k;
    const g = c.getContext('2d');
    g.scale(k, k);
    drawBackdrop(g);
    const cells = setup.cells, C = setup.cols, S = MZ_CELL;
    const wall = (x, y) => x < 0 || y < 0 || x >= C || y >= setup.rows || cells[y * C + x] !== '1';
    g.fillStyle = 'rgba(10,14,30,0.9)';
    g.fillRect(MZ_OX, MZ_OY, C * S, setup.rows * S);
    // Wege leicht aufhellen
    g.fillStyle = '#0d1430';
    for (let y = 0; y < setup.rows; y++) for (let x = 0; x < C; x++) if (!wall(x, y)) g.fillRect(MZ_OX + x * S, MZ_OY + y * S, S, S);
    // Wandkanten als Neonlinien
    g.beginPath();
    for (let y = 0; y < setup.rows; y++) for (let x = 0; x < C; x++) {
      if (!wall(x, y)) continue;
      const X = MZ_OX + x * S, Y = MZ_OY + y * S;
      if (!wall(x, y - 1)) { g.moveTo(X, Y); g.lineTo(X + S, Y); }
      if (!wall(x, y + 1)) { g.moveTo(X, Y + S); g.lineTo(X + S, Y + S); }
      if (!wall(x - 1, y)) { g.moveTo(X, Y); g.lineTo(X, Y + S); }
      if (!wall(x + 1, y)) { g.moveTo(X + S, Y); g.lineTo(X + S, Y + S); }
    }
    g.lineCap = 'round';
    glow(g, NEON.violet, 10);
    g.strokeStyle = NEON.violet; g.lineWidth = 3; g.stroke();
    noGlow(g);
    // Start
    const [sx, sy] = mzCellXY(setup.start[0], setup.start[1]);
    g.fillStyle = hexA(NEON.green, 0.25);
    g.fillRect(sx - S / 2 + 3, sy - S / 2 + 3, S - 6, S - 6);
    mzCache.set(setup, c);
    return c;
  },

  draw(g, setup, snap, ctx) {
    g.drawImage(this.background(setup), 0, 0, WORLD_W, WORLD_H);
    const S = MZ_CELL, me = snap.p.find(e => e[0] === ctx.myId);
    const myMask = me ? me[10] : 0;

    // Hilfe der Lehrkraft: Weg zum Ziel einblenden
    if (ctx.help) {
      g.strokeStyle = hexA(NEON.yellow, 0.45); g.lineWidth = 4; g.setLineDash([2, 10]); g.lineCap = 'round';
      g.beginPath();
      setup.path.forEach(([x, y], i) => { const [px, py] = mzCellXY(x, y); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
      g.stroke(); g.setLineDash([]);
    }

    // Ziel
    const [gx, gy] = mzCellXY(setup.goal[0], setup.goal[1]);
    const pulse = 1 + Math.sin(ctx.t * 4) * 0.08;
    glow(g, NEON.yellow, 22);
    g.fillStyle = NEON.yellow;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = (i % 2 ? 7 : 16) * pulse, a = -Math.PI / 2 + i * Math.PI / 5;
      g.lineTo(gx + Math.cos(a) * r, gy + Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    noGlow(g);

    // Frage-Felder
    setup.fields.forEach(([x, y], k) => {
      const [px, py] = mzCellXY(x, y);
      const done = (myMask >> k) & 1;
      if (done) {
        g.strokeStyle = hexA(NEON.green, 0.7); g.lineWidth = 3;
        g.beginPath(); g.moveTo(px - 8, py); g.lineTo(px - 2, py + 7); g.lineTo(px + 9, py - 7); g.stroke();
        return;
      }
      const s = S * 0.36 * (1 + Math.sin(ctx.t * 3 + k) * 0.06);
      glow(g, NEON.pink, 12);
      g.fillStyle = hexA(NEON.pink, 0.28); g.strokeStyle = NEON.pink; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px, py - s); g.lineTo(px + s, py); g.lineTo(px, py + s); g.lineTo(px - s, py); g.closePath();
      g.fill(); g.stroke();
      noGlow(g);
      text(g, '?', px, py + 1, { size: 18, weight: '800', color: '#fff' });
    });

    // Avatare (mehrere auf einem Feld werden etwas auseinandergeschoben)
    const byCell = new Map();
    for (const e of snap.p) { if (!ctx.meta.has(e[0])) continue; const k = e[2] * MZ_COLS + e[1]; if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(e); }
    const draws = [];
    for (const list of byCell.values()) {
      list.forEach((e, i) => {
        let [px, py] = mzCellXY(e[1], e[2]);
        if (list.length > 1) {
          const a = i / list.length * Math.PI * 2, rr = Math.min(S * 0.34, 3 + list.length * 1.4);
          px += Math.cos(a) * rr; py += Math.sin(a) * rr;
        }
        draws.push([e, ctx.smooth('mx' + e[0], px), ctx.smooth('my' + e[0], py)]);
      });
    }
    draws.sort((a, b) => (a[0][0] === ctx.myId) - (b[0][0] === ctx.myId)); // eigener Avatar zuletzt (oben)
    for (const [e, px, py] of draws) {
      const pm = ctx.meta.get(e[0]), mine = e[0] === ctx.myId;
      const r = mine ? 14 : 11.5;
      if (mine) {
        g.strokeStyle = hexA('#ffffff', 0.5 + 0.4 * Math.sin(ctx.t * 6)); g.lineWidth = 3;
        g.beginPath(); g.arc(px, py, r + 12, 0, Math.PI * 2); g.stroke();
      }
      drawAvatar(g, px, py, r, pm.color, pm.av, { me: mine, t: ctx.t, seed: e[0], mood: e[3] >= 0 ? 'oh' : '' });
      const badge = e[3] >= 0 ? ['?', NEON.yellow] : e[4] > 0 ? (e[6] ? ['✓', NEON.green] : ['✗', NEON.red]) : null;
      if (badge) {
        g.fillStyle = '#0a0d18'; g.beginPath(); g.arc(px + r * 0.9, py - r * 1.1, 9, 0, 7); g.fill();
        text(g, badge[0], px + r * 0.9, py - r * 1.1 + 1, { size: 15, weight: '800', color: badge[1] });
      }
      if (mine) text(g, 'Du', px, py + r + 13, { size: 14, weight: '800', color: '#fff' });
    }

    // Kopfzeile
    const left = Math.max(0, setup.dur - snap.t), tf = clamp(snap.t / setup.dur, 0, 1);
    const n = snap.p.filter(e => ctx.meta.has(e[0])).length, inGoal = snap.p.filter(e => e[7]).length;
    const right = snap.p.reduce((s, e) => s + e[8], 0);
    g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(MZ_OX, 18, 600, 12);
    const tc = left < 30 ? NEON.red : left < 90 ? NEON.orange : NEON.cyan;
    glow(g, tc, 10); g.fillStyle = tc; g.fillRect(MZ_OX, 18, 600 * (1 - tf), 12); noGlow(g);
    text(g, '⏱ ' + this.clock(left), MZ_OX, 56, { size: 24, weight: '800', align: 'left', color: tc });
    text(g, '★ im Ziel: ' + inGoal + ' / ' + n, 800, 40, { size: 26, weight: '800', color: NEON.yellow });
    if (me) text(g, 'Deine Antworten: ' + me[8] + ' ✓  ' + me[9] + ' ✗', WORLD_W - MZ_OX, 40, { size: 22, weight: '700', align: 'right', color: '#dbe7ff' });
    else text(g, '✓ ' + right + ' Aufgaben gelöst', WORLD_W - MZ_OX, 40, { size: 22, weight: '700', align: 'right', color: NEON.green });
  },

  // ------------------------------------------------------------ Steuerung auf dem iPad
  controls(el, setup, api) {
    el.innerHTML = `
      <div class="mz">
        <div class="mz-panel">
          <div class="mz-status ctl-info"></div>
          <div class="mz-q" hidden><div class="mz-qtext"></div><div class="mz-opts"></div></div>
          <div class="mz-fb" hidden></div>
        </div>
        <div class="dpad"><span class="u">▲</span><span class="r">▶</span><span class="d">▼</span><span class="l">◀</span><i></i></div>
      </div>`;
    const status = el.querySelector('.mz-status'), qBox = el.querySelector('.mz-q'), qText = el.querySelector('.mz-qtext');
    const opts = el.querySelector('.mz-opts'), fb = el.querySelector('.mz-fb'), pad = el.querySelector('.dpad');
    let dir = 0, shownQ = -1, locked = false;
    const setDir = d => {
      if (locked) d = 0;
      if (d === dir) return;
      dir = d;
      pad.dataset.dir = d;
      api.send({ dir: d });
    };
    const fromPoint = e => {
      const r = pad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < r.width * 0.12) return 0;
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 4) : (dy > 0 ? 3 : 1);
    };
    let pid = null;
    pad.addEventListener('pointerdown', e => { e.preventDefault(); pid = e.pointerId; try { pad.setPointerCapture(pid); } catch (err) {} setDir(fromPoint(e)); });
    pad.addEventListener('pointermove', e => { if (e.pointerId === pid) setDir(fromPoint(e)); });
    const up = e => { if (e.pointerId === pid) { pid = null; setDir(0); } };
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    pad.addEventListener('contextmenu', e => e.preventDefault());
    // Pfeiltasten (für Laptops)
    const keys = { ArrowUp: 1, ArrowRight: 2, ArrowDown: 3, ArrowLeft: 4, w: 1, d: 2, s: 3, a: 4 };
    const kd = e => { if (keys[e.key]) { e.preventDefault(); setDir(keys[e.key]); } };
    const ku = e => { if (keys[e.key] === dir) setDir(0); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    const showQ = q => {
      shownQ = q;
      const Q = setup.qs[q];
      qText.textContent = Q.text;
      opts.textContent = '';
      Q.opts.forEach((o, k) => {
        const b = document.createElement('button');
        b.textContent = o;
        b.addEventListener('click', () => {
          for (const x of opts.children) x.disabled = true;
          b.classList.add('picked');
          api.send({ ans: k, q });
        });
        opts.appendChild(b);
      });
    };
    status.textContent = 'Ziehe auf dem Steuerkreuz, um zu laufen. Finde den Weg ins Ziel ★!';
    return {
      update(snap) {
        const me = snap.p.find(e => e[0] === api.myId);
        if (!me) return;
        const [, , , q, fbT, fbq, fbok, goal] = me;
        locked = q >= 0 || fbT > 0 || !!goal;
        if (locked && dir) setDir(0);
        pad.classList.toggle('off', locked);
        if (fbT > 0) {
          shownQ = -1;
          qBox.hidden = true; status.hidden = true; fb.hidden = false;
          const Q = setup.qs[fbq];
          fb.className = 'mz-fb ' + (fbok ? 'ok' : 'bad');
          fb.textContent = fbok ? 'Richtig! ✓  Weiter geht’s.' :
            'Leider falsch. Richtig ist: ' + (Q ? Q.opts[Q.ok] : '') + '. Gleich kommt eine neue Aufgabe … (' + Math.ceil(fbT / 10) + ')';
        } else if (q >= 0) {
          if (shownQ !== q) showQ(q);
          qBox.hidden = false; status.hidden = true; fb.hidden = true;
        } else {
          shownQ = -1;
          qBox.hidden = true; fb.hidden = true; status.hidden = false;
          status.textContent = goal ? 'Du bist im Ziel! ★ Feuere die anderen an.' : 'Ziehe auf dem Steuerkreuz, um zu laufen. Auf ?-Feldern gibt es Aufgaben.';
        }
      },
      destroy() { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); },
    };
  },
};

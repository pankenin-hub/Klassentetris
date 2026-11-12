// Physik-Team – Szenario "Mischtemperatur" (Wärme, Richmannsche Mischungsregel, Schmelzwärme)
// Wasser mischen: T = (m1·T1 + m2·T2) / (m1 + m2)   (gleiche spezifische Wärmekapazität)
// Eis: zum Schmelzen braucht 1 g Eis 334 J. Das Eis schmilzt nach und nach und kühlt dabei das Wasser.
'use strict';

const C_WATER = 4.19;    // J/(g·K)
const L_ICE = 334;       // J/g
const POUR_RATE = 50;    // g pro Sekunde
const MELT_RATE = 1.2;   // g pro Sekunde und Grad Wassertemperatur
const T_ICE_EQ = -L_ICE / C_WATER; // Eis wirkt beim Mischen wie Wasser von etwa -80 °C

const MODE_MISCHEN = {
  id: 'mischen',
  name: 'Mischtemperatur',
  topic: 'Wärme: Mischen und Schmelzen',
  color: NEON.orange,
  levels: [
    { name: 'Lauwarm', task: 'Füllt den Topf. Das Wasser soll die Zieltemperatur haben (±2 °C) und es muss genug sein.',
      temps: [10, 20, 60, 80], masses: [100, 150, 200], pot: [0, 20], target: null, tol: 2 },
    { name: 'Babybad', task: 'Das Badewasser für das Baby muss genau 37 °C haben (±1 °C). Und es muss genug sein!',
      temps: [8, 15, 50, 70, 90], masses: [100, 150, 200, 250], pot: [0, 20], target: 37, tol: 1 },
    { name: 'Teewasser', task: 'Im Topf ist schon kaltes Wasser. Bringt es mit heißem Wasser auf 70 °C (±1,5 °C).',
      temps: [95, 100, 100, 15], masses: [100, 150, 200], pot: [0.25, 20], target: 70, tol: 1.5 },
    { name: 'Eiskalte Limo', task: 'Kühlt die warme Limo mit Eis und kaltem Wasser auf 8 °C (±1 °C). Alles Eis muss geschmolzen sein!',
      temps: ['eis', 'eis', 4, 4, 30], masses: [50, 100], pot: [0.5, 25], target: 8, tol: 1 },
  ],

  init(li, players, seed) {
    const lv = this.levels[li];
    for (let attempt = 0; attempt < 60; attempt++) {
      const R = rng(seed + attempt * 7919);
      const cups = {};
      players.forEach((p, i) => {
        // gleichmäßig über die Temperaturen verteilen, dann mischen
        const T = lv.temps[(i + Math.floor(R() * lv.temps.length)) % lv.temps.length];
        const m = lv.masses[Math.floor(R() * lv.masses.length)];
        cups[p.id] = T === 'eis' ? { m, rest: m, T: 0, ice: true, pour: false, seen: 0 } : { m, rest: m, T, ice: false, pour: false, seen: 0 };
      });
      const totalCups = Object.values(cups).reduce((s, c) => s + c.m, 0);
      const m0 = Math.round(lv.pot[0] * Math.max(400, totalCups) / 50) * 50;
      const pot = { m: m0, T: lv.pot[1], ice: 0 };
      let target = lv.target;
      if (target == null) target = 30 + Math.floor(R() * 16);
      const maxMass = mixMaxMass(cups, pot, target);
      if (maxMass == null || maxMass < m0 + 100) continue;
      const minMass = Math.max(m0 + 50, Math.floor(maxMass * 0.6 / 50) * 50);
      const cap = Math.max(minMass * 1.6, (m0 + totalCups) * 0.85);
      return { li, lv, cups, pot, target, tol: lv.tol, minMass, cap, hold: 0, over: null, spilled: 0 };
    }
    // Notlösung (z. B. nur ein Spieler mit Eis): einfacheres Ziel
    const cups = {};
    for (const p of players) cups[p.id] = { m: 200, rest: 200, T: 60, ice: false, pour: false, seen: 0 };
    return { li, lv, cups, pot: { m: 200, T: 20, ice: 0 }, target: 40, tol: 2, minMass: 300, cap: 2000, hold: 0, over: null, spilled: 0 };
  },

  setup(st) {
    const cups = {};
    for (const id in st.cups) { const c = st.cups[id]; cups[id] = { m: c.m, T: c.T, ice: c.ice }; }
    return { li: st.li, cups, target: st.target, tol: st.tol, minMass: st.minMass, cap: st.cap };
  },

  input(st, id, msg) {
    const c = st.cups[id];
    if (!c) return;
    c.pour = !!msg.pour;
    c.seen = 0;
  },

  leave(st, id) { if (st.cups[id]) st.cups[id].pour = false; },

  step(st, dt) {
    if (st.over) return null;
    const pot = st.pot;
    let anyPour = false;
    for (const id in st.cups) {
      const c = st.cups[id];
      c.seen += dt;
      if (c.seen > 1.2) c.pour = false; // keine Meldung mehr vom iPad: aufhören
      if (!c.pour || c.rest <= 0) continue;
      anyPour = true;
      const dm = Math.min(c.rest, POUR_RATE * dt);
      c.rest -= dm;
      if (c.ice) pot.ice += dm;
      else { pot.T = (pot.m * pot.T + dm * c.T) / (pot.m + dm || 1); pot.m += dm; }
    }
    // Eis schmilzt: die Schmelzwärme kommt aus dem Wasser
    if (pot.ice > 0 && pot.m > 0 && pot.T > 0) {
      let dm = Math.min(pot.ice, MELT_RATE * pot.T * dt * Math.min(1, pot.m / 300));
      dm = Math.min(dm, pot.m * C_WATER * pot.T / L_ICE);
      const Q = pot.m * C_WATER * pot.T - dm * L_ICE;
      pot.m += dm; pot.ice -= dm;
      pot.T = Math.max(0, Q / (C_WATER * pot.m));
      if (pot.ice < 0.05) pot.ice = 0;
    }
    // Überlaufen
    if (pot.m + pot.ice > st.cap) { const ex = pot.m + pot.ice - st.cap; st.spilled += ex; pot.m -= ex; }

    const ok = !anyPour && pot.ice === 0 && pot.m >= st.minMass && Math.abs(pot.T - st.target) <= st.tol;
    st.hold = ok ? st.hold + dt : 0;
    if (st.hold >= 3) { st.over = { win: true, text: 'Perfekt gemischt: ' + fmt(pot.T, 1) + ' °C und ' + fmt(pot.m / 1000, 2) + ' kg Wasser.' }; return st.over; }
    const left = Object.values(st.cups).some(c => c.rest > 0.5);
    if (!left && !ok && pot.ice === 0) {
      st.stuck = (st.stuck || 0) + dt;
      if (st.stuck > 4) { st.over = { win: false, text: 'Alle Becher sind leer, aber das Ziel ist nicht erreicht.' }; return st.over; }
    } else st.stuck = 0;
    return null;
  },

  snap(st) {
    const c = [];
    for (const id in st.cups) { const x = st.cups[id]; c.push([Number(id), Math.round(x.rest), x.pour && x.rest > 0 ? 1 : 0]); }
    return { h: Math.round(st.hold / 3 * 100) / 100, T: Math.round(st.pot.T * 100) / 100, m: Math.round(st.pot.m), ice: Math.round(st.pot.ice), c };
  },

  // ------------------------------------------------------------ Zeichnen
  potRect: { x: 590, y: 400, w: 420, h: 330 },

  draw(g, setup, snap, ctx) {
    const P = this.potRect;
    drawBackdrop(g);
    const T = ctx.smooth('T', snap.T), fill = clamp((snap.m + snap.ice) / setup.cap, 0, 1);
    // Flüssigkeit
    const lh = P.h * fill, col = tempColor(T);
    glow(g, col, 20);
    g.fillStyle = hexA(col, 0.55);
    g.fillRect(P.x + 4, P.y + P.h - lh, P.w - 8, lh);
    noGlow(g);
    // Eiswürfel
    const cubes = Math.ceil(snap.ice / 25);
    for (let i = 0; i < Math.min(cubes, 24); i++) {
      const x = P.x + 30 + (i * 67) % (P.w - 60), y = P.y + P.h - lh - 6 + Math.sin(ctx.t * 2 + i) * 3 + Math.floor(i / 6) * 22;
      g.fillStyle = 'rgba(220,245,255,0.85)'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.save(); g.translate(x, y); g.rotate(i * 0.7); g.fillRect(-11, -11, 22, 22); g.strokeRect(-11, -11, 22, 22); g.restore();
    }
    // Topf
    glow(g, NEON.cyan, 14);
    g.strokeStyle = NEON.cyan; g.lineWidth = 5;
    g.beginPath(); g.moveTo(P.x - 20, P.y); g.lineTo(P.x, P.y); g.lineTo(P.x, P.y + P.h); g.lineTo(P.x + P.w, P.y + P.h); g.lineTo(P.x + P.w, P.y); g.lineTo(P.x + P.w + 20, P.y); g.stroke();
    noGlow(g);
    // Mindestmenge
    const minY = P.y + P.h - P.h * setup.minMass / setup.cap;
    g.strokeStyle = NEON.green; g.setLineDash([10, 8]); g.lineWidth = 2;
    g.beginPath(); g.moveTo(P.x, minY); g.lineTo(P.x + P.w, minY); g.stroke(); g.setLineDash([]);
    text(g, 'mindestens ' + fmt(setup.minMass / 1000, 2) + ' kg', P.x + 10, minY - 12, { size: 15, align: 'left', color: NEON.green });
    text(g, fmt(T, 1) + ' °C', P.x + P.w / 2, P.y + P.h - 60, { size: 46, weight: '800', color: '#fff', glow: col });
    text(g, fmt(snap.m / 1000, 2) + ' kg Wasser' + (snap.ice ? ' + ' + fmt(snap.ice) + ' g Eis' : ''), P.x + P.w / 2, P.y + P.h - 22, { size: 18, color: '#dbe7ff' });

    this.drawThermo(g, T, setup);

    // Avatare mit Bechern im Bogen über dem Topf
    const ents = snap.c.filter(c => ctx.meta.has(c[0]));
    const n = ents.length;
    const order = ents.map((c, i) => i).sort((a, b) => (ents[a][0] === ctx.myId) - (ents[b][0] === ctx.myId));
    for (const i of order) {
      const [id, rest, pouring] = ents[i], pm = ctx.meta.get(id), cup = setup.cups[id], me = id === ctx.myId;
      // bis 9 Spieler eine Reihe, sonst zwei versetzte Reihen über dem Topf
      const perRow = n > 9 ? Math.ceil(n / 2) : n, row = i < perRow ? 0 : 1;
      const cnt = row ? n - perRow : perRow, j = row ? i - perRow : i;
      const ax = 110 + (j + 0.5) * (1380 / cnt) + (row ? 40 : 0);
      const ay = (n > 9 ? (row ? 310 : 150) : 190) + Math.abs(ax - 800) / 800 * 60;
      const toPot = ax < 800 ? 1 : -1;
      const r = 24;
      // Becher
      const cx = ax + toPot * 36, cy = ay + 6, cw = 26, chh = 34;
      const cc = cup.ice ? '#dff6ff' : tempColor(cup.T);
      if (pouring) {
        const sx = cx + toPot * 10, sy = cy - chh / 2;
        const ex = clamp(sx + toPot * 40, P.x + 30, P.x + P.w - 30), ey = P.y + P.h - lh;
        glow(g, cc, 12);
        g.strokeStyle = hexA(cc, 0.9); g.lineWidth = 6;
        g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(ex, sy - 10, ex, ey); g.stroke();
        noGlow(g);
      }
      g.save(); g.translate(cx, cy); if (pouring) g.rotate(toPot * 1.1);
      g.strokeStyle = cc; g.lineWidth = 2.5;
      g.strokeRect(-cw / 2, -chh / 2, cw, chh);
      const f = cup.m ? rest / cup.m : 0;
      g.fillStyle = hexA(cc, 0.7); g.fillRect(-cw / 2 + 2, chh / 2 - (chh - 4) * f - 2, cw - 4, (chh - 4) * f);
      g.restore();
      drawAvatar(g, ax, ay, me ? r + 4 : r, pm.color, pm.av, { me, t: ctx.t, seed: id, look: [toPot * 0.6, 0.6], mood: pouring ? 'oh' : '' });
      text(g, me ? 'Du' : pm.name, ax, ay - r - 16, { size: me ? 17 : 13, weight: '700', color: me ? '#fff' : pm.color });
      text(g, cup.ice ? 'Eis 0 °C' : fmt(cup.T) + ' °C', ax, ay + r + 14, { size: 15, weight: '800', color: cc });
      text(g, fmt(rest) + ' g', ax, ay + r + 31, { size: 13, color: '#c9d6ee', weight: '500' });
    }

    if (ctx.help) {
      drawHelpBox(g, ['Mischungsregel', 'T = (m₁·T₁ + m₂·T₂) / (m₁ + m₂)', 'Eis schmelzen: 334 J pro Gramm', 'Wasser erwärmen: 4,19 J pro g und °C'], 20, 20, 430);
    }
    drawHold(g, snap.h);
  },

  drawThermo(g, T, setup) {
    const x = 1110, top = 450, bot = 760, tmin = -10, tmax = 100;
    const yOf = v => bot - (clamp(v, tmin, tmax) - tmin) / (tmax - tmin) * (bot - top);
    g.fillStyle = 'rgba(0,255,156,0.25)';
    g.fillRect(x - 22, yOf(setup.target + setup.tol), 44, yOf(setup.target - setup.tol) - yOf(setup.target + setup.tol));
    g.strokeStyle = '#8aa0c8'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(x - 12, top - 10, 24, bot - top + 20, 12); g.stroke();
    const col = tempColor(T);
    glow(g, col, 14);
    g.fillStyle = col; g.fillRect(x - 6, yOf(T), 12, bot + 10 - yOf(T));
    g.beginPath(); g.arc(x, bot + 22, 20, 0, Math.PI * 2); g.fill();
    noGlow(g);
    for (let v = 0; v <= 100; v += 20) {
      g.strokeStyle = '#8aa0c8'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x + 14, yOf(v)); g.lineTo(x + 24, yOf(v)); g.stroke();
      text(g, v + '°', x + 30, yOf(v), { size: 14, align: 'left', color: '#8aa0c8' });
    }
    text(g, 'Ziel ' + fmt(setup.target) + ' °C', x + 72, yOf(setup.target), { size: 20, align: 'left', weight: '800', color: NEON.green, glow: NEON.green });
  },

  // ------------------------------------------------------------ Steuerung auf dem iPad
  controls(el, setup, api) {
    const cup = setup.cups[api.myId] || { m: 0, T: 20, ice: false };
    const cc = cup.ice ? '#dff6ff' : tempColor(cup.T);
    el.innerHTML = `
      <div class="ctl-row">
        <div class="cupinfo" style="color:${cc}">
          <div class="cupT">${cup.ice ? 'Eis (0 °C)' : fmt(cup.T) + ' °C'}</div>
          <div class="cupM"><span class="rest">${cup.m}</span> g übrig</div>
        </div>
        <button class="big pour">${cup.ice ? 'Eis reinwerfen' : 'Eingießen'}<small>gedrückt halten</small></button>
      </div>
      <div class="ctl-hint">Ziel: ${fmt(setup.target)} °C (±${fmt(setup.tol, setup.tol % 1 ? 1 : 0)}), mindestens ${fmt(setup.minMass / 1000, 2)} kg. Sprecht euch ab, wer gießt!</div>`;
    const btn = el.querySelector('.pour'), restEl = el.querySelector('.rest');
    let pouring = false, keep = 0;
    const set = on => {
      if (on === pouring) return;
      pouring = on;
      btn.classList.toggle('active', on);
      api.send({ pour: on });
      clearInterval(keep);
      if (on) keep = setInterval(() => api.send({ pour: true }), 400);
    };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (err) {} set(true); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, () => set(false));
    btn.addEventListener('contextmenu', e => e.preventDefault());
    return {
      update(snap) {
        const me = snap.c.find(c => c[0] === api.myId);
        if (me) { restEl.textContent = me[1]; if (me[1] <= 0) { btn.disabled = true; set(false); } }
      },
      destroy() { set(false); clearInterval(keep); },
    };
  },
};

function tempColor(T) {
  // blau (kalt) → violett → rot (heiß)
  const stops = [[0, [61, 169, 255]], [35, [157, 123, 255]], [60, [255, 43, 214]], [100, [255, 59, 92]]];
  T = clamp(T, 0, 100);
  for (let i = 1; i < stops.length; i++) {
    if (T <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], f = (T - t0) / (t1 - t0);
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
      return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    }
  }
  return '#ff3b5c';
}

// Größte Wassermenge, mit der die Zieltemperatur exakt erreichbar ist (oder null, wenn unmöglich).
// Eis zählt wie Wasser mit -80 °C, weil es zusätzlich die Schmelzwärme braucht.
function mixMaxMass(cups, pot, target) {
  const S0 = pot.m * (pot.T - target);
  let H = 0, C = 0, mh = 0, mc = 0;
  for (const id in cups) {
    const c = cups[id], Te = c.ice ? T_ICE_EQ : c.T, e = c.m * (Te - target);
    if (e > 0) { H += e; mh += c.m; } else if (e < 0) { C -= e; mc += c.m; } else { mh += c.m; }
  }
  let best = null;
  // alles Kalte, Teil des Heißen
  const hotNeed = C - S0;
  if (hotNeed >= 0 && hotNeed <= H) best = pot.m + mc + (H ? mh * hotNeed / H : mh);
  // alles Heiße, Teil des Kalten
  const coldNeed = H + S0;
  if (coldNeed >= 0 && coldNeed <= C) best = Math.max(best || 0, pot.m + mh + (C ? mc * coldNeed / C : 0));
  return best;
}

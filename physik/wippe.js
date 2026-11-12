// Physik-Team – Szenario "Wippe & Hebel" (Drehmoment, Hebelgesetz)
// Modell: starrer Balken um einen Drehpunkt. Drehmoment M = m · g · r (r = Abstand zum Drehpunkt).
// Am Drehpunkt sitzt ein Dämpfer mit Haftreibung, deshalb bleibt der Balken stehen,
// wenn die Drehmomente (fast) gleich groß sind.
'use strict';

const MODE_WIPPE = {
  id: 'wippe',
  name: 'Wippe & Hebel',
  topic: 'Mechanik: Drehmoment und Hebelgesetz',
  color: NEON.cyan,
  levels: [
    { name: 'Gleichgewicht', task: 'Bringt die Wippe ins Gleichgewicht und haltet sie 5 Sekunden lang waagerecht.',
      L: 8, p: 4, h: 0.9, beam: 20, loads: [], start: 'left', hold: 5 },
    { name: 'Der Felsbrocken', task: 'Links liegt ein schwerer Stein. Gleicht ihn aus und haltet die Wippe 5 Sekunden waagerecht.',
      L: 8, p: 4, h: 0.9, beam: 20, loads: [{ x: -2.6, frac: 0.35, kind: 'stein' }], start: 'mid', hold: 5 },
    { name: 'Zwei Lasten', task: 'Ein Stein links, eine Kiste rechts. Findet das Gleichgewicht!',
      L: 8, p: 4, h: 0.9, beam: 20, loads: [{ x: -3.4, frac: 0.25, kind: 'stein' }, { x: 1.2, frac: 0.6, kind: 'kiste' }], start: 'mid', hold: 5 },
    { name: 'Hebel: Kiste anheben', task: 'Hebt die schwere Kiste in den grünen Bereich und haltet sie dort 4 Sekunden. Nicht zu schnell und nicht zu hoch, sonst fällt sie herunter!',
      L: 5.9, p: 4, h: 1.5, beam: 30, loads: [], start: 'mid', hold: 4,
      lift: { d: 1.6, frac: 1.375, band: [0.30, 0.44], ceil: 0.52, vmax: 0.30 } },
    { name: 'Hebel: Ganz vorsichtig', task: 'Diesmal ist der grüne Bereich schmal und die Kiste empfindlich. Ganz langsam anheben und 4 Sekunden halten!',
      L: 5.9, p: 4, h: 1.5, beam: 30, loads: [], start: 'mid', hold: 4,
      lift: { d: 1.6, frac: 1.5, band: [0.36, 0.44], ceil: 0.50, vmax: 0.20 } },
  ],

  init(li, players, seed) {
    const lv = this.levels[li], R = rng(seed);
    const pL = lv.p, pR = lv.L - lv.p;
    const st = { li, lv, th: 0, om: 0, hold: 0, ents: {}, loads: [], crate: null, over: null };
    let M = 0;
    for (const p of players) {
      const m = 25 + 5 * Math.floor(R() * 8);
      M += m;
      let x;
      if (lv.start === 'left') x = -(0.3 + R() * 0.6) * (pL - 0.3);
      else x = (R() - 0.5) * 1.2;
      st.ents[p.id] = { m, x, tx: x };
    }
    st.M = M;
    for (const l of lv.loads) st.loads.push({ x: l.x, m: Math.max(10, Math.round(l.frac * M / 5) * 5), kind: l.kind });
    if (lv.lift) st.crate = { x: lv.lift.d, m: Math.max(20, Math.round(lv.lift.frac * M / 10) * 10) };
    st.thMax = Math.asin(Math.min(0.95, lv.h / pL));               // linkes Ende auf dem Boden
    st.thMin = lv.lift ? 0 : -Math.asin(Math.min(0.95, lv.h / pR)); // rechtes Ende auf dem Boden / Kiste auf dem Boden
    st.xmin = -(pL - 0.25);
    st.xmax = lv.lift ? lv.lift.d - 0.45 : pR - 0.25;
    const Mt = M + st.loads.reduce((s, l) => s + l.m, 0) + (st.crate ? st.crate.m : 0) + lv.beam;
    st.damp = Mt * G / 0.35;              // Dämpfer: Winkelgeschwindigkeit ~ Drehmoment / damp
    st.fric = Math.max(30, M * G * 0.06); // Haftreibung am Drehpunkt in Nm
    // Gleichgewicht am Anfang vermeiden
    if (!lv.lift && Math.abs(this.torque(st, 0)) < st.fric * 3) {
      for (const id in st.ents) { const e = st.ents[id]; e.x = e.tx = clamp(e.x - 1.2, st.xmin, st.xmax); }
    }
    if (!lv.lift) st.th = this.torque(st, 0) > 0 ? st.thMax : st.thMin;
    return st;
  },

  setup(st) {
    const mass = {};
    for (const id in st.ents) mass[id] = st.ents[id].m;
    return { li: st.li, mass, loads: st.loads, crate: st.crate, thMax: st.thMax, thMin: st.thMin, xmin: st.xmin, xmax: st.xmax };
  },

  // Drehmoment der Gewichtskräfte, positiv = gegen den Uhrzeigersinn (rechte Seite geht hoch)
  torque(st, th) {
    const lv = st.lv, c = Math.cos(th);
    let t = 0;
    for (const id in st.ents) t -= st.ents[id].m * G * st.ents[id].x;
    for (const l of st.loads) t -= l.m * G * l.x;
    if (st.crate) t -= st.crate.m * G * st.crate.x;
    t -= lv.beam * G * (lv.L / 2 - lv.p);
    return t * c;
  },

  inertia(st) {
    const lv = st.lv, xb = lv.L / 2 - lv.p;
    let I = lv.beam * (lv.L * lv.L / 12 + xb * xb);
    for (const id in st.ents) I += st.ents[id].m * st.ents[id].x ** 2;
    for (const l of st.loads) I += l.m * l.x * l.x;
    if (st.crate) I += st.crate.m * st.crate.x ** 2;
    return Math.max(I, 50);
  },

  input(st, id, msg) {
    const e = st.ents[id];
    if (e && typeof msg.x === 'number' && isFinite(msg.x)) e.tx = clamp(msg.x, st.xmin, st.xmax);
  },

  leave() { /* Avatar bleibt sitzen, damit sich beim Wiederverbinden nichts ändert */ },

  step(st, dt) {
    if (st.over) return null;
    const lv = st.lv;
    for (const id in st.ents) {
      const e = st.ents[id], d = e.tx - e.x, v = 1.4 * dt;
      e.x = Math.abs(d) <= v ? e.tx : e.x + Math.sign(d) * v;
    }
    const tau = this.torque(st, st.th), I = this.inertia(st);
    const atMax = st.th >= st.thMax - 1e-6, atMin = st.th <= st.thMin + 1e-6;
    if ((atMax && tau >= 0 && st.om >= 0) || (atMin && tau <= 0 && st.om <= 0)) {
      st.om = 0; // liegt auf dem Boden auf
    } else if (Math.abs(st.om) < 1e-4 && Math.abs(tau) <= st.fric) {
      st.om = 0; // Haftreibung hält den Balken fest
    } else {
      const dir = st.om !== 0 ? Math.sign(st.om) : Math.sign(tau);
      const before = st.om;
      st.om += (tau - st.damp * st.om - dir * st.fric * 0.8) / I * dt;
      if (before !== 0 && Math.sign(st.om) !== Math.sign(before) && Math.abs(tau) <= st.fric) st.om = 0;
    }
    st.th += st.om * dt;
    if (st.th > st.thMax) { st.th = st.thMax; st.om = 0; }
    if (st.th < st.thMin) { st.th = st.thMin; st.om = 0; }

    let ok;
    if (lv.lift) {
      const L = lv.lift, rise = L.d * Math.sin(st.th), v = L.d * st.om * Math.cos(st.th);
      if (v > L.vmax) { st.over = { win: false, text: 'Zu schnell! Die Kiste ist heruntergefallen.' }; return st.over; }
      if (rise >= L.ceil) { st.over = { win: false, text: 'Zu hoch! Die Kiste ist oben angestoßen und heruntergefallen.' }; return st.over; }
      ok = rise >= L.band[0] && rise <= L.band[1] && st.om === 0;
    } else {
      ok = Math.abs(st.th) < 1 * Math.PI / 180 && st.om === 0;
    }
    st.hold = ok ? st.hold + dt : 0;
    if (st.hold >= lv.hold) {
      st.over = { win: true, text: lv.lift ? 'Die Kiste ist oben – super gehebelt!' : 'Die Wippe ist im Gleichgewicht!' };
      return st.over;
    }
    return null;
  },

  snap(st) {
    const e = [];
    for (const id in st.ents) e.push([Number(id), Math.round(st.ents[id].x * 100) / 100]);
    return { th: Math.round(st.th * 1e4) / 1e4, h: Math.round(st.hold / st.lv.hold * 100) / 100, e };
  },

  // ------------------------------------------------------------ Zeichnen
  layout(lv) {
    const ppm = Math.min(1300 / lv.L, 230);
    const x0 = (WORLD_W - lv.L * ppm) / 2;
    const groundY = 800;
    return { ppm, px: x0 + lv.p * ppm, py: groundY - lv.h * ppm, groundY };
  },

  draw(g, setup, snap, ctx) {
    const lv = this.levels[setup.li], lay = this.layout(lv), ppm = lay.ppm;
    const th = ctx.smooth('th', snap.th);
    drawBackdrop(g);
    // Boden
    glow(g, NEON.violet, 12);
    g.strokeStyle = NEON.violet; g.lineWidth = 4;
    g.beginPath(); g.moveTo(40, lay.groundY); g.lineTo(WORLD_W - 40, lay.groundY); g.stroke();
    noGlow(g);
    // Drehpunkt (Dreieck)
    glow(g, NEON.yellow, 14);
    g.strokeStyle = NEON.yellow; g.lineWidth = 4; g.fillStyle = 'rgba(255,230,0,0.12)';
    g.beginPath(); g.moveTo(lay.px, lay.py); g.lineTo(lay.px - 0.35 * ppm, lay.groundY); g.lineTo(lay.px + 0.35 * ppm, lay.groundY); g.closePath();
    g.fill(); g.stroke();
    noGlow(g);

    // Zielbereich beim Heben
    if (lv.lift) {
      const L = lv.lift, cx = lay.px + L.d * ppm;
      const crateSide = this.crateSide(setup.crate.m, ppm);
      const yb = lay.py - crateSide; // Unterkante Kiste bei rise = 0 ... Oberkante
      const top = rise => yb - rise * ppm;
      g.fillStyle = 'rgba(0,255,156,0.12)';
      g.fillRect(cx - crateSide * 0.9, top(L.band[1]), crateSide * 1.8, (L.band[1] - L.band[0]) * ppm);
      g.strokeStyle = NEON.green; g.lineWidth = 2; glow(g, NEON.green, 10);
      g.strokeRect(cx - crateSide * 0.9, top(L.band[1]), crateSide * 1.8, (L.band[1] - L.band[0]) * ppm);
      noGlow(g);
      g.strokeStyle = NEON.red; g.setLineDash([10, 8]); g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx - crateSide * 1.1, top(L.ceil)); g.lineTo(cx + crateSide * 1.1, top(L.ceil)); g.stroke();
      g.setLineDash([]);
      text(g, 'zu hoch', cx + crateSide * 1.15, top(L.ceil), { size: 16, align: 'left', color: NEON.red });
      text(g, 'Ziel', cx + crateSide * 0.95, top((L.band[0] + L.band[1]) / 2), { size: 16, align: 'left', color: NEON.green });
    }

    // Balken im gedrehten Koordinatensystem
    g.save();
    g.translate(lay.px, lay.py);
    g.rotate(-th);
    const xl = -lv.p * ppm, xr = (lv.L - lv.p) * ppm;
    glow(g, NEON.cyan, 16);
    g.fillStyle = '#0d2a35'; g.strokeStyle = NEON.cyan; g.lineWidth = 3;
    g.beginPath(); g.roundRect(xl, -7, xr - xl, 14, 6); g.fill(); g.stroke();
    noGlow(g);
    // Meter-Markierungen ab dem Drehpunkt
    g.strokeStyle = 'rgba(0,240,255,0.6)'; g.lineWidth = 2;
    for (let m = Math.ceil(-lv.p); m <= lv.L - lv.p; m++) {
      g.beginPath(); g.moveTo(m * ppm, 7); g.lineTo(m * ppm, m === 0 ? 20 : 14); g.stroke();
      if (ctx.help && m !== 0) text(g, Math.abs(m) + ' m', m * ppm, 30, { size: 14, color: 'rgba(0,240,255,0.8)' });
    }
    // feste Lasten
    for (const l of setup.loads) this.drawLoad(g, l, ppm, ctx.help);
    if (setup.crate) this.drawLoad(g, { x: setup.crate.x, m: setup.crate.m, kind: 'kiste' }, ppm, ctx.help, true);
    // Avatare stapeln, wenn sie am selben Platz stehen
    const list = snap.e.map(([id, x]) => ({ id, x: ctx.smooth('x' + id, x), m: setup.mass[id] || 40 }))
      .filter(a => ctx.meta.has(a.id)).sort((a, b) => a.x - b.x);
    const placed = [];
    for (const a of list) {
      a.r = 20 * Math.sqrt(a.m / 30);
      a.u = a.x * ppm;
      let base = 7;
      for (const b of placed) if (Math.abs(a.u - b.u) < (a.r + b.r) * 0.85) base = Math.max(base, b.base + 2 * b.r);
      a.base = base;
      placed.push(a);
    }
    // eigener Avatar zuletzt
    placed.sort((a, b) => (a.id === ctx.myId) - (b.id === ctx.myId));
    for (const a of placed) {
      const pm = ctx.meta.get(a.id);
      g.save();
      g.translate(a.u, -a.base - a.r);
      g.rotate(th); // Avatare bleiben aufrecht
      drawAvatar(g, 0, 0, a.r, pm.color, pm.av, { me: a.id === ctx.myId, t: ctx.t, seed: a.id, look: [Math.sign(-a.x) * 0.6, 0.5],
        mood: Math.abs(th) > 0.12 ? 'oh' : '' });
      g.restore();
    }
    g.restore();
    // Beschriftungen (Name + Masse) aufrecht rechts neben den Avataren, mit dunklem Hintergrund
    for (const a of placed) {
      const pm = ctx.meta.get(a.id), me = a.id === ctx.myId;
      const lx = a.u, ly = -a.base - a.r;
      const sx = lay.px + lx * Math.cos(th) + ly * Math.sin(th), sy = lay.py - lx * Math.sin(th) + ly * Math.cos(th);
      const label = (me ? 'Du' : pm.name) + ' ' + a.m + ' kg', size = me ? 17 : 13;
      g.font = '700 ' + size + 'px system-ui, "Segoe UI", sans-serif';
      const w = g.measureText(label).width + 10, x = sx + a.r + (me ? 10 : 3);
      g.fillStyle = 'rgba(7,10,20,0.78)';
      g.beginPath(); g.roundRect(x, sy - size * 0.7, w, size * 1.4, 5); g.fill();
      text(g, label, x + 5, sy, { size, weight: '700', align: 'left', color: me ? '#fff' : pm.color });
    }

    if (ctx.help) this.drawHelp(g, setup, snap, th, list);
    drawHold(g, snap.h);
  },

  crateSide(m, ppm) { return clamp(28 * Math.cbrt(m / 40), 30, 0.9 * ppm); },

  drawLoad(g, l, ppm, help, isCrate) {
    const u = l.x * ppm;
    if (l.kind === 'stein') {
      const s = clamp(26 * Math.cbrt(l.m / 40), 26, 110);
      glow(g, NEON.violet, 14);
      g.fillStyle = '#2a2050'; g.strokeStyle = NEON.violet; g.lineWidth = 3;
      g.beginPath();
      g.moveTo(u - s, -7); g.lineTo(u - s * 0.85, -s * 0.9); g.lineTo(u - s * 0.2, -s * 1.35); g.lineTo(u + s * 0.6, -s * 1.15);
      g.lineTo(u + s, -s * 0.4); g.lineTo(u + s * 0.9, -7); g.closePath(); g.fill(); g.stroke();
      noGlow(g);
      text(g, fmt(l.m) + ' kg', u, -s * 0.6, { size: 18, weight: '800', color: '#fff' });
    } else {
      const s = isCrate ? this.crateSide(l.m, ppm) : clamp(28 * Math.cbrt(l.m / 40), 30, 120);
      glow(g, NEON.orange, 14);
      g.fillStyle = '#3a2208'; g.strokeStyle = NEON.orange; g.lineWidth = 3;
      g.fillRect(u - s / 2, -7 - s, s, s); g.strokeRect(u - s / 2, -7 - s, s, s);
      g.beginPath(); g.moveTo(u - s / 2, -7 - s); g.lineTo(u + s / 2, -7); g.moveTo(u + s / 2, -7 - s); g.lineTo(u - s / 2, -7); g.stroke();
      noGlow(g);
      g.save(); g.translate(u, -7 - s / 2);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(-48, -14, 96, 28);
      text(g, fmt(l.m) + ' kg', 0, 0, { size: 18, weight: '800', color: '#fff' });
      g.restore();
    }
  },

  drawHelp(g, setup, snap, th, list) {
    const lv = this.levels[setup.li];
    let left = 0, right = 0;
    const add = (m, x) => { const t = m * G * x; if (x < 0) left -= t; else right += t; };
    for (const a of list) add(a.m, a.x);
    for (const l of setup.loads) add(l.m, l.x);
    if (setup.crate) add(setup.crate.m, setup.crate.x);
    const xb = lv.L / 2 - lv.p;
    if (xb !== 0) add(lv.beam, xb);
    const lines = ['Drehmoment  M = m · g · r', 'links:   ' + fmt(left) + ' Nm', 'rechts:  ' + fmt(right) + ' Nm'];
    if (lv.lift) lines.push('Kiste: ' + fmt(lv.lift.d * Math.sin(th) * 100) + ' cm hoch');
    else lines.push('Neigung: ' + fmt(th * 180 / Math.PI, 1) + '°');
    drawHelpBox(g, lines, 30, 30, 340);
    // Balkenvergleich
    const max = Math.max(left, right, 1), w = 300;
    g.fillStyle = NEON.pink; g.fillRect(400, 52, w * left / max, 18);
    g.fillStyle = NEON.lime; g.fillRect(400, 82, w * right / max, 18);
    text(g, 'links', 400 + w + 12, 61, { size: 15, align: 'left', color: NEON.pink });
    text(g, 'rechts', 400 + w + 12, 91, { size: 15, align: 'left', color: NEON.lime });
  },

  // ------------------------------------------------------------ Steuerung auf dem iPad
  controls(el, setup, api) {
    const myMass = setup.mass[api.myId] || 0;
    el.innerHTML = `
      <div class="ctl-info"><b>Deine Masse: ${myMass} kg</b> · <span class="pos"></span></div>
      <div class="ctl-row">
        <button class="big step" data-d="-0.1">◀</button>
        <input type="range" class="slider" min="${setup.xmin}" max="${setup.xmax}" step="0.05">
        <button class="big step" data-d="0.1">▶</button>
      </div>
      <div class="ctl-hint">Schiebe deinen Avatar auf dem Balken. Der gelbe Strich ist der Drehpunkt.</div>`;
    const slider = el.querySelector('.slider'), pos = el.querySelector('.pos');
    let val = null, lastSent = 0, pending = false;
    // Drehpunkt als Markierung auf dem Schieberegler
    const pivotPct = (0 - setup.xmin) / (setup.xmax - setup.xmin) * 100;
    slider.style.setProperty('--pivot', pivotPct + '%');
    const label = x => {
      const d = Math.abs(x);
      pos.textContent = d < 0.05 ? 'genau über dem Drehpunkt' : fmt(d, 2) + ' m ' + (x < 0 ? 'links' : 'rechts') + ' vom Drehpunkt';
    };
    const send = () => {
      const now = performance.now();
      if (now - lastSent < 60) { if (!pending) { pending = true; setTimeout(() => { pending = false; send(); }, 70); } return; }
      lastSent = now;
      api.send({ x: val });
    };
    const set = x => { val = clamp(Math.round(x * 100) / 100, setup.xmin, setup.xmax); slider.value = val; label(val); send(); };
    slider.addEventListener('input', () => set(Number(slider.value)));
    for (const b of el.querySelectorAll('.step')) b.addEventListener('click', () => set((val ?? 0) + Number(b.dataset.d)));
    return {
      update(snap) {
        if (val !== null) return;
        const me = snap.e.find(e => e[0] === api.myId);
        if (me) { val = me[1]; slider.value = val; label(val); }
      },
    };
  },
};

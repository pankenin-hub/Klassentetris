// Physik-Team – Szenario "Kurbel-Kraftwerk" (Energie und Leistung: E = P · t)
// Jeder Tipp auf dem iPad ist eine Kurbelumdrehung am Generator und liefert 20 J.
// Ein Mensch schafft auf Dauer etwa 50–100 W. Der Akku speichert die Energie für die Geräte der Stadt.
'use strict';

const TAP_J = 20;           // Joule pro Kurbelumdrehung
const MAX_TAPS_PER_S = 10;  // mehr zählt nicht (Schutz gegen Dauerfeuer)

const MODE_KRAFTWERK = {
  id: 'kraftwerk',
  name: 'Kurbel-Kraftwerk',
  topic: 'Energie: Leistung, Energie und Speicher',
  color: NEON.yellow,
  levels: [
    { name: 'Lichterkette', dur: 40, task: 'Kurbelt Strom für die Lampen! Der Akku darf nicht leer werden – aber auch nicht überlaufen.' },
    { name: 'Ein Abend zu Hause', dur: 60, task: 'Am Abend gehen nach und nach Fernseher, Laptops und Licht an. Haltet den Akku im grünen Bereich!' },
    { name: 'Wasserkocher-Alarm', dur: 60, task: 'Ab und zu braucht jemand sehr viel Strom auf einmal. Ladet den Akku vorher auf, wenn die Warnung kommt!' },
  ],

  init(li, players, seed) {
    const lv = this.levels[li], R = rng(seed);
    const n = Math.max(1, players.length);
    const dev = []; // {name, W, kind, on, off}
    const add = (name, W, kind, on, off) => dev.push({ name, W, kind, on, off });
    if (li === 0) {
      const lamps = Math.max(4, 5 * n);
      for (let i = 0; i < lamps; i++) {
        const on = i < lamps * 0.4 ? 0 : 3 + (i / lamps) * 9;
        const off = i % 3 === 0 && i > lamps * 0.4 ? lv.dur - 8 + R() * 4 : lv.dur + 1;
        add('LED-Lampe', 10, 'lampe', on, off);
      }
    } else if (li === 1) {
      if (n >= 4) for (let i = 0; i < Math.ceil(n / 9); i++) add('Kühlschrank', 150, 'kuehl', 0, lv.dur + 1);
      for (let i = 0; i < 2 * n; i++) add('LED-Lampe', 10, 'lampe', 5 + R() * 20, lv.dur - R() * 10);
      for (let i = 0; i < Math.max(1, Math.round(n / 4)); i++) add('Laptop', 50, 'laptop', R() * 30, 25 + R() * 35);
      for (let i = 0; i < Math.max(1, Math.round(n / 6)); i++) add('Fernseher', 100, 'tv', 20 + R() * 15, lv.dur - R() * 8);
      for (let i = 0; i < Math.round(n / 5); i++) add('Spielkonsole', 120, 'konsole', 28 + R() * 10, 45 + R() * 15);
    } else {
      if (n >= 4) for (let i = 0; i < Math.ceil(n / 9); i++) add('Kühlschrank', 150, 'kuehl', 0, lv.dur + 1);
      for (let i = 0; i < 2 * n; i++) add('LED-Lampe', 10, 'lampe', 0, lv.dur + 1);
      const big = n >= 12 ? ['Wasserkocher', 2000] : n >= 6 ? ['Toaster', 800] : n >= 3 ? ['Mixer', 400] : ['Föhn (Stufe 1)', 200];
      for (const t of [14, 31, 47]) add(big[0], big[1], 'kocher', t, t + 4);
    }
    const cap = Math.max(3000, 1500 * n);
    return { li, lv, n, dev, cap, E: cap * 0.5, t: 0, gen: {}, inGreen: 0, made: 0, over: null };
  },

  setup(st) {
    return { li: st.li, dev: st.dev, cap: st.cap, dur: st.lv.dur, n: st.n };
  },

  input(st, id, msg) {
    const taps = clamp(num(msg.taps) | 0, 0, 20);
    let g = st.gen[id];
    if (!g) g = st.gen[id] = { P: 0, acc: 0, win: [] };
    const now = st.t;
    g.win = g.win.filter(w => now - w[0] < 1);
    const recent = g.win.reduce((s, w) => s + w[1], 0);
    const ok = Math.min(taps, Math.max(0, MAX_TAPS_PER_S - recent));
    if (!ok) return;
    g.win.push([now, ok]);
    g.acc += ok * TAP_J;
    st.E += ok * TAP_J;
    st.made += ok * TAP_J;
  },

  leave(st, id) { delete st.gen[id]; },

  demand(dev, t) {
    let P = 0;
    for (const d of dev) if (t >= d.on && t < d.off) P += d.W;
    return P;
  },

  step(st, dt) {
    if (st.over) return null;
    st.t += dt;
    const P = this.demand(st.dev, st.t);
    st.E -= P * dt;
    st.Pd = P;
    let Pin = 0;
    for (const id in st.gen) {
      const g = st.gen[id];
      // geglättete Leistung jedes Generators (Watt = Joule pro Sekunde)
      g.P += (g.acc / dt - g.P) * Math.min(1, dt / 0.8);
      g.acc = 0;
      Pin += g.P;
    }
    st.Pin = Pin;
    const f = st.E / st.cap;
    if (f >= 0.3 && f <= 0.7) st.inGreen += dt;
    if (st.E <= 0) { st.E = 0; st.over = { win: false, text: 'Stromausfall! Der Akku ist leer.' }; return st.over; }
    if (st.E >= st.cap) { st.E = st.cap; st.over = { win: false, text: 'Überladung! Der Akku ist zu voll, die Sicherung ist rausgeflogen.' }; return st.over; }
    if (st.t >= st.lv.dur) {
      const share = st.inGreen / st.lv.dur, stars = share >= 0.8 ? 3 : share >= 0.5 ? 2 : 1;
      const wh = st.made / 3600;
      st.over = { win: true, stars, text: 'Geschafft! ' + '★'.repeat(stars) + '☆'.repeat(3 - stars) + '  Ihr habt zusammen ' + fmt(wh, 1) + ' Wh erzeugt. ' +
        'Damit leuchtet eine LED-Lampe (10 W) ' + fmt(wh / 10 * 60) + ' Minuten lang.' };
      return st.over;
    }
    return null;
  },

  snap(st) {
    const g = [];
    for (const id in st.gen) g.push([Number(id), Math.round(st.gen[id].P)]);
    return { t: Math.round(st.t * 10) / 10, E: Math.round(st.E), Pd: st.Pd || 0, Pin: Math.round(st.Pin || 0), g, made: Math.round(st.made) };
  },

  // ------------------------------------------------------------ Zeichnen
  draw(g, setup, snap, ctx) {
    drawBackdrop(g);
    const players = [...ctx.meta.keys()].filter(id => ctx.inGame(id));
    const power = new Map(snap.g);
    // Generatoren links
    const cols = players.length > 12 ? 3 : players.length > 4 ? 2 : 1;
    const rows = Math.ceil(players.length / cols) || 1;
    const cw = 560 / cols, rh = Math.min(130, 700 / rows);
    players.forEach((id, i) => {
      const pm = ctx.meta.get(id), me = id === ctx.myId;
      const x = 50 + (i % cols) * cw + cw / 2, y = 170 + Math.floor(i / cols) * rh + rh / 2;
      const P = power.get(id) || 0;
      const rot = ctx.spin(id, P);
      const R = Math.min(34, rh * 0.32);
      // Kurbelrad
      g.save(); g.translate(x + R + 12, y);
      glow(g, NEON.yellow, P > 5 ? 14 : 0);
      g.strokeStyle = P > 5 ? NEON.yellow : '#6b7a99'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
      noGlow(g);
      g.rotate(rot);
      for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, 0); g.lineTo(R, 0); g.stroke(); }
      g.restore();
      drawAvatar(g, x - R * 0.5, y, Math.min(26, rh * 0.25) + (me ? 3 : 0), pm.color, pm.av, { me, t: ctx.t, seed: id, look: [0.7, 0], mood: P > 120 ? 'oh' : '' });
      text(g, (me ? 'Du' : pm.name), x - R * 0.5, y - rh * 0.25 - 16, { size: me ? 16 : 13, weight: '700', color: me ? '#fff' : pm.color });
      text(g, fmt(P) + ' W', x + R + 12, y + R + 14, { size: 14, weight: '700', color: P > 5 ? NEON.yellow : '#6b7a99' });
    });

    // Akku in der Mitte
    const bx = 720, by = 210, bw = 170, bh = 520, f = clamp(snap.E / setup.cap, 0, 1);
    g.fillStyle = 'rgba(0,255,156,0.08)';
    g.fillRect(bx, by + bh * 0.3, bw, bh * 0.4);
    const bc = f < 0.15 || f > 0.85 ? NEON.red : f < 0.3 || f > 0.7 ? NEON.orange : NEON.green;
    glow(g, bc, 20);
    g.fillStyle = hexA(bc, 0.6);
    g.fillRect(bx + 6, by + bh - (bh - 12) * f - 6, bw - 12, (bh - 12) * f);
    noGlow(g);
    g.strokeStyle = '#dbe7ff'; g.lineWidth = 4;
    g.strokeRect(bx, by, bw, bh);
    g.fillStyle = '#dbe7ff'; g.fillRect(bx + bw / 2 - 30, by - 16, 60, 16);
    g.strokeStyle = 'rgba(0,255,156,0.6)'; g.setLineDash([8, 6]); g.lineWidth = 2;
    for (const q of [0.3, 0.7]) { g.beginPath(); g.moveTo(bx, by + bh * (1 - q)); g.lineTo(bx + bw, by + bh * (1 - q)); g.stroke(); }
    g.setLineDash([]);
    text(g, fmt(f * 100) + ' %', bx + bw / 2, by + bh / 2, { size: 44, weight: '800', color: '#fff', glow: bc });
    text(g, 'Akku', bx + bw / 2, by + bh + 28, { size: 20, weight: '700', color: '#dbe7ff' });
    text(g, fmt(snap.E / 1000, 1) + ' von ' + fmt(setup.cap / 1000, 1) + ' kJ', bx + bw / 2, by + bh + 54, { size: 16, color: '#9fb0d0' });
    // Leistungsbilanz
    const diff = snap.Pin - snap.Pd;
    text(g, '⚡ erzeugt ' + fmt(snap.Pin) + ' W', bx + bw / 2, 120, { size: 22, weight: '700', color: NEON.yellow });
    text(g, '💡 verbraucht ' + fmt(snap.Pd) + ' W', bx + bw / 2, 152, { size: 22, weight: '700', color: NEON.cyan });
    // Pfeile
    text(g, diff >= 0 ? '▲ lädt' : '▼ entlädt', bx + bw + 20, by + bh / 2, { size: 20, align: 'left', weight: '800', color: diff >= 0 ? NEON.green : NEON.orange });

    // Stadt rechts
    this.drawCity(g, setup, snap, ctx);

    // Tag-Fortschritt oben
    const tf = clamp(snap.t / setup.dur, 0, 1);
    g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(40, 40, 1520, 14);
    glow(g, NEON.yellow, 10); g.fillStyle = NEON.yellow; g.fillRect(40, 40, 1520 * tf, 14); noGlow(g);
    text(g, 'noch ' + Math.ceil(Math.max(0, setup.dur - snap.t)) + ' s', 1560, 72, { size: 18, align: 'right', color: '#dbe7ff' });
    // Warnung vor großem Verbraucher
    const soon = setup.dev.find(d => d.kind === 'kocher' && snap.t > d.on - 5 && snap.t < d.on);
    if (soon) text(g, '⚠ Gleich: ' + soon.name + ' mit ' + fmt(soon.W) + ' W! Akku aufladen!', 800, 92, { size: 28, weight: '800', color: NEON.orange, glow: NEON.orange });

    if (ctx.help) drawHelpBox(g, ['Energie = Leistung · Zeit', 'E = P · t   (1 W = 1 J pro s)', '1 Kurbel-Tipp = 20 J', 'Mensch auf Dauer: ca. 50–100 W'], 30, 70, 400);
  },

  drawCity(g, setup, snap, ctx) {
    const x0 = 980, y0 = 180, w = 590;
    // gleiche Geräte zusammenfassen
    const groups = new Map();
    for (const d of setup.dev) {
      const k = d.name;
      if (!groups.has(k)) groups.set(k, { name: d.name, W: d.W, kind: d.kind, on: 0, all: 0 });
      const gr = groups.get(k);
      gr.all++;
      if (snap.t >= d.on && snap.t < d.off) gr.on++;
    }
    text(g, 'Stadt', x0 + w / 2, y0 - 30, { size: 22, weight: '700', color: '#dbe7ff' });
    let y = y0;
    for (const gr of groups.values()) {
      const active = gr.on > 0, c = active ? (gr.kind === 'kocher' ? NEON.orange : NEON.cyan) : '#3b4763';
      g.strokeStyle = c; g.lineWidth = 2;
      g.fillStyle = active ? hexA(c, 0.12) : 'rgba(255,255,255,0.03)';
      g.beginPath(); g.roundRect(x0, y, w, 92, 12); g.fill(); g.stroke();
      // Symbol
      g.save(); g.translate(x0 + 50, y + 46);
      if (active) glow(g, c, 18);
      this.icon(g, gr.kind, c, active);
      noGlow(g);
      g.restore();
      text(g, gr.name, x0 + 100, y + 30, { size: 20, align: 'left', weight: '700', color: active ? '#fff' : '#7d89a6' });
      text(g, gr.on + ' von ' + gr.all + ' an · je ' + fmt(gr.W) + ' W', x0 + 100, y + 62, { size: 16, align: 'left', color: active ? c : '#5d6985' });
      text(g, fmt(gr.on * gr.W) + ' W', x0 + w - 16, y + 46, { size: 22, align: 'right', weight: '800', color: active ? c : '#5d6985' });
      y += 104;
    }
  },

  icon(g, kind, c, on) {
    g.strokeStyle = c; g.fillStyle = on ? hexA(c, 0.5) : 'transparent'; g.lineWidth = 3;
    if (kind === 'lampe') {
      g.beginPath(); g.arc(0, -6, 18, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeRect(-8, 12, 16, 12);
    } else if (kind === 'tv' || kind === 'laptop' || kind === 'konsole') {
      g.beginPath(); g.roundRect(-26, -18, 52, 32, 4); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-14, 22); g.lineTo(14, 22); g.stroke();
    } else if (kind === 'kuehl') {
      g.beginPath(); g.roundRect(-16, -28, 32, 56, 4); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-16, -6); g.lineTo(16, -6); g.stroke();
    } else {
      g.beginPath(); g.moveTo(-18, 24); g.lineTo(-14, -16); g.lineTo(14, -16); g.lineTo(18, 24); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(14, -6); g.quadraticCurveTo(30, 0, 16, 14); g.stroke();
      if (on) { g.beginPath(); g.moveTo(-6, -22); g.quadraticCurveTo(-12, -30, -4, -38); g.moveTo(6, -22); g.quadraticCurveTo(0, -30, 8, -38); g.stroke(); }
    }
  },

  // ------------------------------------------------------------ Steuerung auf dem iPad
  controls(el, setup, api) {
    el.innerHTML = `
      <div class="ctl-row">
        <button class="big crank">
          <svg viewBox="-50 -50 100 100" width="90" height="90"><g class="wheel">
            <circle r="40" fill="none" stroke="currentColor" stroke-width="6"/>
            <path d="M0 0L40 0M0 0L-40 0M0 0L0 40M0 0L0 -40" stroke="currentColor" stroke-width="5"/>
            <circle cx="28" cy="28" r="8" fill="currentColor"/></g></svg>
          <span>Kurbeln!<small>schnell tippen</small></span>
        </button>
        <div class="crankinfo"><div class="myP">0 W</div><div class="muted">deine Leistung</div></div>
      </div>
      <div class="ctl-hint">Jeder Tipp = 20 J. Ist der Akku über 70 %, macht lieber eine Pause!</div>`;
    const btn = el.querySelector('.crank'), wheel = el.querySelector('.wheel'), myP = el.querySelector('.myP');
    let taps = 0, rot = 0;
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      taps++; rot += 40;
      wheel.setAttribute('transform', 'rotate(' + rot + ')');
    });
    btn.addEventListener('contextmenu', e => e.preventDefault());
    const iv = setInterval(() => { if (taps) { api.send({ taps }); taps = 0; } }, 150);
    return {
      update(snap) { const me = snap.g.find(x => x[0] === api.myId); myP.textContent = fmt(me ? me[1] : 0) + ' W'; },
      destroy() { clearInterval(iv); },
    };
  },
};

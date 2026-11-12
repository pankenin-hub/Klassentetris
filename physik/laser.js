// Physik-Team – Szenario "Laser & Spiegel" (Reflexionsgesetz: Einfallswinkel = Ausfallswinkel)
// Jeder Spiegel wirft 90 % des Lichts zurück, nach vielen Spiegeln wird der Strahl also schwächer.
'use strict';

const MIRROR_LEN = 90;
const PARK_Y = 825;           // darunter liegen Spiegel auf der Ablage und sind ausgeschaltet
const REFLECT = 0.9;          // Reflexionsgrad eines Spiegels
const SENSOR_MIN = 0.3;       // so viel Licht braucht eine Zielscheibe mindestens
const SENSOR_R = 26;

const MODE_LASER = {
  id: 'laser',
  name: 'Laser & Spiegel',
  topic: 'Optik: Reflexionsgesetz',
  color: NEON.red,
  levels: [
    { name: 'Um die Ecke', task: 'Lenkt den Laser mit euren Spiegeln um die Wand herum in die Zielscheibe.',
      laser: [60, 180, 0], walls: [[720, 0, 40, 620]], sensors: [[1350, 690]], min: 2 },
    { name: 'Doppelt hält besser', task: 'Der Strahl muss durch beide Zielscheiben gehen – gleichzeitig!',
      laser: [60, 700, 0], walls: [[600, 430, 40, 395], [980, 230, 40, 340]], sensors: [[400, 260], [1250, 470]], min: 3 },
    { name: 'Rundherum', task: 'Vier Zielscheiben rund um den Block. Schafft ihr alle vier mit einem Strahl?',
      laser: [60, 450, 0], walls: [[700, 330, 200, 240]], sensors: [[400, 220], [1200, 300], [1200, 630], [620, 740]], min: 4 },
    { name: 'Zickzack', task: 'Drei Zielscheiben, zwei Wände. Jeder Spiegel schluckt etwas Licht – nehmt nicht zu viele!',
      laser: [60, 120, 0], walls: [[440, 0, 40, 600], [880, 260, 40, 565]], sensors: [[300, 450], [700, 400], [1300, 600]], min: 5 },
  ],

  init(li, players, seed) {
    const lv = this.levels[li];
    const ids = players.map(p => p.id);
    const n = Math.max(ids.length, lv.min);
    const mirrors = [];
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 800 : 70 + i * (1460 / (n - 1));
      mirrors.push({ owner: ids.length ? ids[i % ids.length] : 0, x, y: 865, a: 0 });
    }
    return { li, lv, mirrors, hold: 0, over: null };
  },

  setup(st) { return { li: st.li }; },

  input(st, id, msg) {
    const m = st.mirrors[msg.k | 0];
    if (!m || m.owner !== id) return;
    m.x = clamp(num(msg.x, m.x), 30, WORLD_W - 30);
    m.y = clamp(num(msg.y, m.y), 30, WORLD_H - 25);
    m.a = ((num(msg.a, m.a) % 180) + 180) % 180;
  },

  leave() { /* Spiegel bleiben liegen; beim Wiederverbinden mit demselben Namen gehören sie wieder dir */ },

  step(st, dt) {
    if (st.over) return null;
    const tr = laserTrace(st.lv, st.mirrors);
    const all = tr.lit.every(Boolean);
    st.hold = all ? st.hold + dt : 0;
    if (st.hold >= 3) { st.over = { win: true, text: 'Volltreffer! ' + (tr.mirrorsUsed) + ' Spiegel im Einsatz.' }; return st.over; }
    return null;
  },

  snap(st) {
    return { h: Math.round(st.hold / 3 * 100) / 100, m: st.mirrors.map(m => [m.owner, Math.round(m.x), Math.round(m.y), Math.round(m.a * 10) / 10]) };
  },

  draw(g, setup, snap, ctx) {
    const lv = this.levels[setup.li];
    const local = ctx.local || {};
    const mirrors = snap.m.map(([owner, x, y, a], i) => local[i] ? Object.assign({ owner }, local[i]) : { owner, x, y, a });
    drawBackdrop(g);
    // Ablage
    g.fillStyle = 'rgba(157,123,255,0.07)';
    g.fillRect(0, PARK_Y, WORLD_W, WORLD_H - PARK_Y);
    g.strokeStyle = 'rgba(157,123,255,0.35)'; g.setLineDash([8, 8]); g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, PARK_Y); g.lineTo(WORLD_W, PARK_Y); g.stroke(); g.setLineDash([]);
    text(g, 'Ablage (Spiegel hier sind aus)', WORLD_W - 16, PARK_Y + 14, { size: 13, align: 'right', color: 'rgba(196,168,255,0.7)' });
    // Wände
    for (const [x, y, w, h] of lv.walls) {
      glow(g, NEON.violet, 14);
      g.fillStyle = '#1b1438'; g.strokeStyle = NEON.violet; g.lineWidth = 3;
      g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
      noGlow(g);
    }
    const tr = laserTrace(lv, mirrors);
    // Zielscheiben
    lv.sensors.forEach(([x, y], i) => {
      const on = tr.lit[i], c = on ? NEON.green : NEON.cyan;
      glow(g, c, on ? 30 : 10);
      g.strokeStyle = c; g.lineWidth = 4;
      g.beginPath(); g.arc(x, y, SENSOR_R, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(x, y, SENSOR_R * 0.55, 0, Math.PI * 2); g.stroke();
      if (on) { g.fillStyle = hexA(NEON.green, 0.35); g.beginPath(); g.arc(x, y, SENSOR_R, 0, Math.PI * 2); g.fill(); }
      noGlow(g);
      g.fillStyle = c; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
      if (ctx.help) text(g, fmt(tr.light[i] * 100) + ' %', x, y - SENSOR_R - 14, { size: 15, color: c });
    });
    // Strahl
    g.lineCap = 'round';
    for (const [x1, y1, x2, y2, I] of tr.segs) {
      glow(g, NEON.red, 18);
      g.strokeStyle = `rgba(255,59,92,${0.35 + 0.65 * I})`; g.lineWidth = 7;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      noGlow(g);
      g.strokeStyle = `rgba(255,220,225,${0.4 + 0.6 * I})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    // Laser-Gerät
    const [lx, ly, la] = lv.laser;
    g.save(); g.translate(lx, ly); g.rotate(la * Math.PI / 180);
    glow(g, NEON.red, 16);
    g.fillStyle = '#2a0b14'; g.strokeStyle = NEON.red; g.lineWidth = 3;
    g.beginPath(); g.roundRect(-46, -18, 56, 36, 6); g.fill(); g.stroke();
    noGlow(g);
    g.restore();
    // Winkel bei Hilfe
    if (ctx.help) {
      for (const b of tr.bounces) {
        text(g, fmt(b.ang) + '°', b.x + b.nx * 34, b.y + b.ny * 34, { size: 15, weight: '700', color: NEON.yellow });
        g.strokeStyle = 'rgba(255,230,0,0.6)'; g.setLineDash([4, 4]); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(b.x - b.nx * 40, b.y - b.ny * 40); g.lineTo(b.x + b.nx * 40, b.y + b.ny * 40); g.stroke();
        g.setLineDash([]);
      }
      drawHelpBox(g, ['Reflexionsgesetz', 'Einfallswinkel = Ausfallswinkel', '(gemessen zum gelben Lot)', 'Spiegel werfen 90 % zurück'], 1200, 20, 380);
    }
    // Spiegel mit Avataren
    const order = mirrors.map((m, i) => i).sort((a, b) => (mirrors[a].owner === ctx.myId) - (mirrors[b].owner === ctx.myId));
    for (const i of order) {
      const m = mirrors[i], pm = ctx.meta.get(m.owner), me = m.owner === ctx.myId && ctx.myId != null;
      const sel = me && ctx.sel === i;
      const off = m.y > PARK_Y;
      if (pm) drawAvatar(g, m.x, m.y, 17, pm.color, pm.av, { t: ctx.t, seed: m.owner * 7 + i, dim: off && !me, me: sel });
      const r = m.a * Math.PI / 180, dx = Math.cos(r) * MIRROR_LEN / 2, dy = Math.sin(r) * MIRROR_LEN / 2;
      glow(g, '#ffffff', off ? 0 : 12);
      g.strokeStyle = off ? 'rgba(220,230,255,0.45)' : '#f2f7ff'; g.lineWidth = sel ? 8 : 6;
      g.beginPath(); g.moveTo(m.x - dx, m.y - dy); g.lineTo(m.x + dx, m.y + dy); g.stroke();
      noGlow(g);
      if (pm) g.strokeStyle = pm.color;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(m.x - dx, m.y - dy); g.lineTo(m.x + dx, m.y + dy); g.stroke();
      if (pm && (me || !off)) text(g, me ? 'Du' : pm.name, m.x, m.y + 32, { size: me ? 17 : 13, weight: '700', color: me ? '#fff' : pm.color });
    }
    drawHold(g, snap.h);
  },

  // ------------------------------------------------------------ Steuerung auf dem iPad
  controls(el, setup, api) {
    el.innerHTML = `
      <div class="ctl-info"><b>Ziehe auf dem Bild</b>, um deinen Spiegel zu bewegen. Unten drehst du ihn.</div>
      <div class="ctl-row">
        <button class="big rot" data-d="-1">⟲</button>
        <input type="range" class="slider" min="0" max="179" step="1">
        <button class="big rot" data-d="1">⟳</button>
      </div>
      <div class="ctl-row small-row">
        <span class="ang"></span>
        <button class="park">Auf die Ablage</button>
        <button class="next" hidden>Nächster Spiegel</button>
      </div>`;
    const slider = el.querySelector('.slider'), angEl = el.querySelector('.ang'), nextBtn = el.querySelector('.next');
    const ctrl = { local: {}, sel: -1 };
    let mine = [], lastSent = 0, timer = 0, drag = null;
    const cur = () => ctrl.local[ctrl.sel];
    const send = () => {
      const m = cur();
      if (!m) return;
      const now = performance.now();
      clearTimeout(timer);
      if (now - lastSent < 50) { timer = setTimeout(send, 55); return; }
      lastSent = now;
      api.send({ k: ctrl.sel, x: Math.round(m.x), y: Math.round(m.y), a: m.a });
    };
    const showAng = () => { const m = cur(); if (m) { slider.value = Math.round(m.a); angEl.textContent = 'Winkel: ' + Math.round(m.a) + '°'; } };
    slider.addEventListener('input', () => { const m = cur(); if (m) { m.a = Number(slider.value); showAng(); send(); } });
    for (const b of el.querySelectorAll('.rot')) {
      b.addEventListener('click', () => { const m = cur(); if (m) { m.a = (m.a + Number(b.dataset.d) + 180) % 180; showAng(); send(); } });
    }
    el.querySelector('.park').addEventListener('click', () => {
      const m = cur(); if (!m) return;
      m.y = 865; m.a = 0; showAng(); send();
    });
    nextBtn.addEventListener('click', () => {
      const i = mine.indexOf(ctrl.sel);
      ctrl.sel = mine[(i + 1) % mine.length]; showAng();
    });
    ctrl.pointer = (type, wx, wy) => {
      const m = cur(); if (!m) return;
      if (type === 'down') {
        // Beim Antippen eines anderen eigenen Spiegels diesen auswählen
        for (const k of mine) {
          const o = ctrl.local[k];
          if (Math.hypot(o.x - wx, o.y - wy) < 50) { ctrl.sel = k; showAng(); break; }
        }
        const s = cur();
        drag = { wx, wy, x: s.x, y: s.y };
      } else if (type === 'move' && drag) {
        m.x = clamp(drag.x + (wx - drag.wx), 30, WORLD_W - 30);
        m.y = clamp(drag.y + (wy - drag.wy), 30, WORLD_H - 25);
        send();
      } else if (type === 'up') drag = null;
    };
    ctrl.update = snap => {
      // eigene Spiegel beim ersten Mal übernehmen
      const ids = [];
      snap.m.forEach((m, i) => { if (m[0] === api.myId) ids.push(i); });
      if (ids.join() !== mine.join()) {
        mine = ids;
        for (const i of ids) if (!ctrl.local[i]) ctrl.local[i] = { x: snap.m[i][1], y: snap.m[i][2], a: snap.m[i][3] };
        if (!mine.includes(ctrl.sel)) ctrl.sel = mine.length ? mine[0] : -1;
        nextBtn.hidden = mine.length < 2;
        showAng();
      }
    };
    return ctrl;
  },
};

// Strahlverfolgung. Gibt Teilstrecken, beleuchtete Zielscheiben und Auftreffpunkte zurück.
function laserTrace(lv, mirrors) {
  const segs = [], bounces = [], lit = lv.sensors.map(() => false), light = lv.sensors.map(() => 0);
  const lines = []; // [ax, ay, bx, by, mirrorIndex | -1]
  for (const [x, y, w, h] of lv.walls) {
    lines.push([x, y, x + w, y, -1], [x + w, y, x + w, y + h, -1], [x + w, y + h, x, y + h, -1], [x, y + h, x, y, -1]);
  }
  mirrors.forEach((m, i) => {
    if (m.y > PARK_Y) return;
    const r = m.a * Math.PI / 180, dx = Math.cos(r) * MIRROR_LEN / 2, dy = Math.sin(r) * MIRROR_LEN / 2;
    lines.push([m.x - dx, m.y - dy, m.x + dx, m.y + dy, i]);
  });
  const used = new Set();
  let [ox, oy, a] = lv.laser;
  a = a * Math.PI / 180;
  let dx = Math.cos(a), dy = Math.sin(a), I = 1, skip = -2;
  for (let n = 0; n < 40 && I > 0.02; n++) {
    // Rand des Spielfelds
    let t = Infinity, hit = null;
    if (dx > 1e-9) t = Math.min(t, (WORLD_W - ox) / dx); else if (dx < -1e-9) t = Math.min(t, -ox / dx);
    if (dy > 1e-9) t = Math.min(t, (WORLD_H - oy) / dy); else if (dy < -1e-9) t = Math.min(t, -oy / dy);
    for (let k = 0; k < lines.length; k++) {
      if (k === skip) continue;
      const [ax, ay, bx, by] = lines[k], ex = bx - ax, ey = by - ay;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const tt = ((ax - ox) * ey - (ay - oy) * ex) / den;
      const s = ((ax - ox) * dy - (ay - oy) * dx) / den;
      if (tt > 1e-6 && tt < t && s >= 0 && s <= 1) { t = tt; hit = k; }
    }
    const x2 = ox + dx * t, y2 = oy + dy * t;
    segs.push([ox, oy, x2, y2, I]);
    // Zielscheiben auf dieser Strecke
    lv.sensors.forEach(([sx, sy], i) => {
      const u = clamp((sx - ox) * dx + (sy - oy) * dy, 0, t);
      if (Math.hypot(ox + dx * u - sx, oy + dy * u - sy) <= SENSOR_R) {
        light[i] = Math.max(light[i], I);
        if (I >= SENSOR_MIN) lit[i] = true;
      }
    });
    if (hit === null || lines[hit][4] < 0) break; // Wand oder Rand: Licht wird geschluckt
    const [ax, ay, bx, by, mi] = lines[hit];
    let nx = -(by - ay), ny = bx - ax;
    const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
    const dot = dx * nx + dy * ny;
    if (dot > 0) { nx = -nx; ny = -ny; }
    const ang = Math.acos(Math.min(1, Math.abs(dot))) * 180 / Math.PI;
    bounces.push({ x: x2, y: y2, nx, ny, ang });
    const d2 = dx * nx + dy * ny;
    dx -= 2 * d2 * nx; dy -= 2 * d2 * ny;
    ox = x2; oy = y2; I *= REFLECT; skip = hit;
    used.add(mi);
  }
  return { segs, bounces, lit, light, mirrorsUsed: used.size };
}

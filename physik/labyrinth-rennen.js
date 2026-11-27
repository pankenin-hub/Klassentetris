// Physik-Team – Szenario "Labyrinth-Wettlauf"
// Wie das Frage-Labyrinth, aber als Wettrennen: Wer zuerst im Ziel ist, bekommt Platz 1. Sobald die ersten drei
// im Ziel sind, ist das Spiel vorbei. Danach gibt es eine Siegerehrung auf dem Podest (Platz 3, dann 2, dann 1),
// die anderen Avatare stehen daneben und schauen zu.
'use strict';

// ------------------------------------------------------------ Fragen
// Fragen aus dem Kahoot "Der Bunsenbrenner – Physik Klasse 6". Erste Antwort ist jeweils richtig.
// Richtig/Falsch-Fragen haben nur zwei Antworten. Die Reihenfolge hier ist egal: Beim Spielen werden die Fragen
// nach Textmenge sortiert (Frage + Antworten). Viel Text kommt zuerst, wenig Text zum Schluss.
const MZR_BUNSEN = [
  ['Welchen Brennstoff nutzt der Bunsenbrenner?', 'Gas', 'Benzin', 'Diesel', 'Holz'],
  ['Was setzt du auf, bevor du mit dem Brenner arbeitest?', 'Schutzbrille', 'Mütze', 'Sonnenbrille', 'Kopfhörer'],
  ['Was machst du mit langen Haaren?', 'Zusammenbinden', 'Nach vorne legen', 'Nass machen', 'Offen lassen'],
  ['Was prüfst du zuerst?', 'Sind Gaszufuhr und Luftzufuhr geschlossen?', 'Brennt schon eine Flamme?', 'Ist der Brenner warm?', 'Ist das Fenster offen?'],
  ['Woran schließt du den Schlauch an?', 'An die Gaszufuhr am Tisch', 'An die Heizung', 'An den Wasserhahn', 'An die Steckdose'],
  ['Welche Farbe hat der Gashahn am Tisch?', 'Gelb', 'Blau', 'Rot', 'Grün'],
  ['Was hältst du oben an das Brennerrohr?', 'Ein brennendes Streichholz', 'Ein Glas Wasser', 'Ein Blatt Papier', 'Einen Finger'],
  ['Du öffnest die Luftzufuhr. Wie sieht die Flamme dann aus?', 'Blau und sie rauscht', 'Grün und leise', 'Gelb und sie leuchtet', 'Sie geht aus'],
  ['Die gelbe, leuchtende Flamme ist am heißesten.', 'Falsch', 'Richtig'],
  ['Wo ist die heißeste Zone der Flamme?', 'Über der Spitze des Innenkegels', 'Unten am Rohr', 'Im Innenkegel', 'Neben der Flamme'],
  ['Wie heiß ist die heißeste Zone ungefähr?', '1500 °C', '37 °C', '300 °C', '100 °C'],
  ['Wie heiß ist der Innenkegel ungefähr?', '300 °C', '1500 °C', '1200 °C', '20 °C'],
  ['Du darfst dein Gesicht über die Flamme halten.', 'Falsch', 'Richtig'],
  ['Wie machst du den Brenner aus?', 'Gelben Gashahn schließen', 'Auspusten', 'Luftzufuhr ganz öffnen', 'Wasser drüber kippen'],
  ['Was machst du nach dem Ausmachen mit dem Brenner?', 'Abkühlen lassen', 'Sofort anfassen', 'Ins Wasser legen', 'In die Tasche stecken'],
];

const mzrLen = q => q.reduce((s, t) => s + t.length, 0);

// Zeitplan der Siegerehrung (Sekunden ab Spielende)
const MZR_REVEAL = [8.5, 5.5, 2.5]; // Platz 1, 2, 3 (Platz 3 kommt zuerst)
const MZR_CERE = 13;
const MZR_MEDAL = ['#ffd84a', '#d6e2f0', '#e0915a']; // Gold, Silber, Bronze

const MODE_LABYRINTH_RENNEN = Object.assign({}, MODE_LABYRINTH, {
  id: 'labyrinth-rennen',
  name: 'Labyrinth-Wettlauf',
  topic: 'Wettrennen mit Siegerpodest: Bunsenbrenner',
  color: NEON.orange,
  levels: [
    { name: 'Der Bunsenbrenner', dur: 420, fields: 22, onShare: 0.65, task: 'Wettlauf! Wer ist zuerst im Ziel ★ unten rechts? Auf jedem ?-Feld kommt eine Frage zum Bunsenbrenner. Sobald drei im Ziel sind, ist das Spiel vorbei. Dann gibt es die Siegerehrung!' },
  ],

  questions(li, R) {
    // lange Fragen zuerst, kurze zum Schluss
    return MZR_BUNSEN.slice().sort((a, b) => mzrLen(b) - mzrLen(a)).map(q => q.length === 3
      ? { text: q[0], opts: ['Richtig', 'Falsch'], ok: q[1] === 'Richtig' ? 0 : 1 }
      : mzShuffleOpts(R, q[0], q.slice(1)));
  },

  init(li, players, seed) {
    const st = MODE_LABYRINTH.init.call(this, li, players, seed);
    st.names = {};
    for (const pl of players) st.names[pl.id] = pl.name || '';
    // alle bekommen die Fragen in derselben Reihenfolge (viel Text → wenig Text)
    for (const id in st.p) { st.p[id].order = st.qs.map((_, k) => k); st.p[id].place = 0; }
    st.dg = mzBfs(st.cells, st.goal[0], st.goal[1]).dist; // Abstand zum Ziel (für die Wertung, falls die Zeit abläuft)
    st.places = 0;
    st.cere = null;
    return st;
  },

  input(st, id, msg) { if (!st.cere) MODE_LABYRINTH.input.call(this, st, id, msg); },

  step(st, dt) {
    if (st.cere) {
      st.cere.t += dt;
      return st.cere.t >= MZR_CERE ? st.over : null;
    }
    const res = MODE_LABYRINTH.step.call(this, st, dt);
    // neue Ankünfte im Ziel bekommen ihren Platz
    const fresh = Object.entries(st.p).filter(([, p]) => p.goal && !p.place).sort((a, b) => a[1].goalT - b[1].goalT || a[0] - b[0]);
    for (const [, p] of fresh) p.place = ++st.places;
    const act = Object.entries(st.p).filter(([, p]) => !p.gone);
    const need = Math.min(3, act.length);
    if (!res && !(act.length && act.filter(([, p]) => p.goal).length >= need)) return null;

    // Spiel vorbei: Rangliste (erst nach Platz im Ziel, dann nach Abstand zum Ziel, dann nach richtigen Antworten)
    const key = p => p.goal ? p.place : 1000 + st.dg[p.y * MZ_COLS + p.x];
    const rank = act.sort((a, b) => key(a[1]) - key(b[1]) || b[1].right - a[1].right).map(([id]) => Number(id));
    const top = rank.slice(0, 3), rest = rank.slice(3);
    st.cere = { t: 0, top, rest };
    for (const id in st.p) st.p[id].dir = 0;
    const right = act.reduce((s, [, p]) => s + p.right, 0);
    const who = top.map((id, i) => (i + 1) + '. ' + (st.names[id] || '?')).join(' · ');
    const timeUp = st.t >= st.lv.dur && act.filter(([, p]) => p.goal).length < need;
    st.over = {
      win: true, low: true, title: '🏆 Siegerehrung',
      text: who + (timeUp ? ' (Die Zeit war um.)' : '') + ' – Zusammen habt ihr ' + right + ' Fragen richtig beantwortet.',
    };
    return null;
  },

  snap(st) {
    const s = MODE_LABYRINTH.snap.call(this, st);
    for (const e of s.p) e.push(st.p[e[0]].place || 0);
    if (st.cere) s.c = [Math.round(st.cere.t * 10) / 10, st.cere.top, st.cere.rest];
    return s;
  },

  goalLabel(inGoal, n) { return '🏆 im Ziel: ' + inGoal + ' / ' + Math.min(3, n); },

  // Platz-Abzeichen am Avatar
  drawExtra(g, e, px, py, r) {
    const pl = e[11];
    if (!pl) return;
    const c = MZR_MEDAL[pl - 1] || NEON.white;
    glow(g, c, 10);
    g.fillStyle = c; g.beginPath(); g.arc(px - r * 0.95, py - r * 1.1, 11, 0, 7); g.fill();
    noGlow(g);
    text(g, String(pl), px - r * 0.95, py - r * 1.1 + 1, { size: 15, weight: '900', color: '#1a1206' });
  },

  draw(g, setup, snap, ctx) {
    if (snap.c) this.drawCeremony(g, snap, ctx);
    else MODE_LABYRINTH.draw.call(this, g, setup, snap, ctx);
  },

  // ------------------------------------------------------------ Siegerehrung
  drawCeremony(g, snap, ctx) {
    const [ct, top, rest] = snap.c, t = ctx.t;
    const ease = x => { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); };
    drawBackdrop(g);
    const floor = 690, cx = WORLD_W / 2;

    // Scheinwerfer
    const beams = [[cx - 260, MZR_REVEAL[1]], [cx, MZR_REVEAL[0]], [cx + 260, MZR_REVEAL[2]]];
    for (const [bx, tr] of beams) {
      const on = ct >= tr ? 0.16 : 0.04 + 0.03 * Math.sin(t * 3 + bx);
      const gr = g.createLinearGradient(0, 0, 0, floor);
      gr.addColorStop(0, hexA('#ffffff', on)); gr.addColorStop(1, hexA('#ffffff', 0));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(bx - 30, 0); g.lineTo(bx + 30, 0); g.lineTo(bx + 150, floor); g.lineTo(bx - 150, floor); g.closePath(); g.fill();
    }
    // Boden
    g.fillStyle = 'rgba(157,123,255,0.12)'; g.fillRect(0, floor, WORLD_W, WORLD_H - floor);
    glow(g, NEON.violet, 12); g.strokeStyle = NEON.violet; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, floor); g.lineTo(WORLD_W, floor); g.stroke(); noGlow(g);

    text(g, '🏆 Siegerehrung', cx, 70, { size: 54, weight: '900', color: NEON.yellow, glow: NEON.yellow });

    // Podest: links Platz 2, Mitte Platz 1, rechts Platz 3
    const blocks = [[cx, 270, 250], [cx - 260, 195, 230], [cx + 260, 140, 230]]; // [x, Höhe, Breite] je Platz 1..3
    let caption = '';
    for (let i = 0; i < 3; i++) {
      const [bx, bh, bw] = blocks[i], top_ = floor - bh, col = MZR_MEDAL[i];
      const shown = top[i] !== undefined && ct >= MZR_REVEAL[i];
      g.fillStyle = hexA(col, shown ? 0.32 : 0.16);
      g.strokeStyle = col; g.lineWidth = 3;
      glow(g, col, shown ? 18 : 6);
      g.beginPath(); g.roundRect(bx - bw / 2, top_, bw, bh, 8); g.fill(); g.stroke();
      noGlow(g);
      text(g, String(i + 1), bx, top_ + 50, { size: 70, weight: '900', color: col, glow: col });
      if (top[i] === undefined) continue;
      const pm = ctx.meta.get(top[i]) || { color: '#ffffff', av: 0, name: '' };
      const r = i === 0 ? 62 : 52;
      if (!shown) {
        // Trommelwirbel: Fragezeichen über dem Platz, der als Nächstes dran ist
        const next = [2, 1, 0].find(k => top[k] !== undefined && ct < MZR_REVEAL[k]);
        if (next === i) {
          const s = 1 + 0.12 * Math.sin(t * 14);
          text(g, '?', bx + Math.sin(t * 30) * 3, top_ - 70, { size: 90 * s, weight: '900', color: '#ffffff', glow: col });
          caption = 'Platz ' + (i + 1) + ' geht an …';
        }
        continue;
      }
      const k = (ct - MZR_REVEAL[i]) / 0.7;
      const drop = (1 - ease(k)) * 520, hop = k > 1 ? Math.abs(Math.sin(t * 5 + i)) * (i === 0 ? 14 : 8) : 0;
      const ay = top_ - r - 6 - drop - hop;
      drawAvatar(g, bx, ay, r, pm.color, pm.av, { t, seed: top[i], me: top[i] === ctx.myId, look: [0, 0.2] });
      text(g, pm.name || '', bx, top_ + 108, { size: i === 0 ? 34 : 28, weight: '800', color: '#ffffff' });
      if (k < 3) caption = 'Platz ' + (i + 1) + ': ' + (pm.name || '');
      if (i === 0 && ct >= MZR_REVEAL[0]) {
        // Krone über dem Sieger
        const kx = bx, ky = ay - r * 1.55 - 16;
        g.fillStyle = NEON.yellow; glow(g, NEON.yellow, 16);
        g.beginPath();
        g.moveTo(kx - 32, ky + 14); g.lineTo(kx - 36, ky - 18); g.lineTo(kx - 16, ky); g.lineTo(kx, ky - 26);
        g.lineTo(kx + 16, ky); g.lineTo(kx + 36, ky - 18); g.lineTo(kx + 32, ky + 14); g.closePath(); g.fill();
        noGlow(g);
      }
    }
    if (caption) text(g, caption, cx, 150, { size: 38, weight: '800', color: '#ffffff' });

    // Zuschauer links und rechts vom Podest
    const lastReveal = Math.max(...MZR_REVEAL.filter((v, i) => top[i] !== undefined && ct >= v), -9);
    const cheer = ct - lastReveal < 1.6;
    // Tribüne für die hintere Reihe
    if (rest.length > 8) {
      g.fillStyle = 'rgba(157,123,255,0.10)'; g.strokeStyle = hexA(NEON.violet, 0.5); g.lineWidth = 2;
      for (const x0 of [40, WORLD_W - 40 - 370]) { g.beginPath(); g.rect(x0, floor - 70, 370, 70); g.fill(); g.stroke(); }
    }
    rest.map((id, n) => [id, n]).sort((a, b) => (b[1] >> 3) - (a[1] >> 3)).forEach(([id, n]) => {
      const pm = ctx.meta.get(id);
      if (!pm) return;
      const side = n % 2 ? 1 : -1, m = n >> 1, row = Math.floor(m / 4), col = m % 4;
      const x = side < 0 ? 80 + col * 84 + row * 42 : WORLD_W - 80 - col * 84 - row * 42;
      const y = floor - 34 - row * 70;
      const jump = cheer ? Math.abs(Math.sin(t * 9 + n)) * 18 : Math.abs(Math.sin(t * 2 + n)) * 3;
      drawAvatar(g, x, y - jump, 30, pm.color, pm.av, { t, seed: id, me: id === ctx.myId, look: [-side * 0.8, -0.3] });
      text(g, pm.name, x, y + 42, { size: 15, weight: '700', color: pm.color });
    });

    // Konfetti für Platz 1
    if (top.length && ct >= MZR_REVEAL[0]) {
      const ft = ct - MZR_REVEAL[0];
      for (let i = 0; i < 120; i++) {
        const h1 = (Math.sin(i * 12.9898) * 43758.5453) % 1, h2 = (Math.sin(i * 78.233) * 12543.123) % 1;
        const a1 = Math.abs(h1), a2 = Math.abs(h2);
        const y = ft * (140 + a1 * 160) - a2 * 500 - 20;
        if (y < -20 || y > floor) continue;
        const x = a2 * WORLD_W + Math.sin(ft * 2 + i) * 30;
        g.save(); g.translate(x, y); g.rotate(ft * (2 + a1 * 4) + i);
        g.fillStyle = PLAYER_COLORS[i % PLAYER_COLORS.length];
        g.fillRect(-6, -3, 12, 6);
        g.restore();
      }
    }
  },

  // ------------------------------------------------------------ Steuerung auf dem iPad
  controls(el, setup, api) {
    const base = MODE_LABYRINTH.controls.call(this, el, setup, api);
    const status = el.querySelector('.mz-status'), qBox = el.querySelector('.mz-q'), fb = el.querySelector('.mz-fb');
    const pad = el.querySelector('.dpad');
    return {
      update(snap) {
        base.update(snap);
        const me = snap.p.find(e => e[0] === api.myId);
        if (!me) return;
        if (snap.c) {
          const pl = snap.c[1].indexOf(api.myId);
          qBox.hidden = true; fb.hidden = true; status.hidden = false; pad.classList.add('off');
          status.textContent = 'Siegerehrung! Schau nach vorne. ' + (pl >= 0 && snap.c[0] >= MZR_REVEAL[pl] ? '🏆 Du bist auf Platz ' + (pl + 1) + '!' : '');
        } else if (me[7] && me[11]) {
          status.textContent = 'Du bist im Ziel! 🏆 Platz ' + me[11] + '. Warte auf die anderen.';
        }
      },
      destroy() { base.destroy(); },
    };
  },
});

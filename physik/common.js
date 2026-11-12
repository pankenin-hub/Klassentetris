// Physik-Team – gemeinsame Helfer: Farben, Avatare, Zufall, Zeichnen
'use strict';

const WORLD_W = 1600, WORLD_H = 900;
const G = 9.81;

const NEON = {
  cyan: '#00f0ff', pink: '#ff2bd6', lime: '#a6ff00', yellow: '#ffe600', orange: '#ff8a00',
  violet: '#9d7bff', green: '#00ff9c', red: '#ff3b5c', blue: '#3da9ff', white: '#e8f4ff',
};

// 18 gut unterscheidbare Neonfarben für die Spieler
const PLAYER_COLORS = [
  '#00f0ff', '#ff2bd6', '#a6ff00', '#ffe600', '#ff8a00', '#9d7bff', '#00ff9c', '#ff4d6d', '#3da9ff',
  '#ffa8e8', '#d4ff5a', '#ffc46b', '#00c8b4', '#ff6bff', '#a8fff0', '#ff9f68', '#c4a8ff', '#6dff6d',
];

const AVATAR_TYPES = ['Blob', 'Alien', 'Katze', 'Teufelchen', 'König', 'Propeller', 'Schleife', 'Zyklop'];

// deterministischer Zufall (damit alle dieselben Werte sehen)
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function num(v, d = 0) { return typeof v === 'number' && isFinite(v) ? v : d; }

// Zahl auf Deutsch formatieren
function fmt(v, digits = 0) {
  return Number(v).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

function glow(g, color, blur) { g.shadowColor = color; g.shadowBlur = blur; }
function noGlow(g) { g.shadowBlur = 0; g.shadowColor = 'transparent'; }

function text(g, s, x, y, o = {}) {
  g.font = (o.weight || '600') + ' ' + (o.size || 20) + 'px system-ui, "Segoe UI", sans-serif';
  g.textAlign = o.align || 'center';
  g.textBaseline = o.base || 'middle';
  if (o.glow) glow(g, o.glow, 10);
  g.fillStyle = o.color || NEON.white;
  g.fillText(s, x, y);
  if (o.glow) noGlow(g);
}

// Hintergrund mit feinem Raster
function drawBackdrop(g) {
  g.fillStyle = '#070a14';
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  g.strokeStyle = 'rgba(80,110,180,0.08)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x <= WORLD_W; x += 50) { g.moveTo(x, 0); g.lineTo(x, WORLD_H); }
  for (let y = 0; y <= WORLD_H; y += 50) { g.moveTo(0, y); g.lineTo(WORLD_W, y); }
  g.stroke();
}

// ------------------------------------------------------------ Avatare
// Ein runder Kerl mit Augen und einem Extra je nach Typ. o: {me, label, t, seed, look:[dx,dy], dim, sub}
function drawAvatar(g, x, y, r, color, type, o = {}) {
  const t = o.t || 0, seed = o.seed || 0;
  g.save();
  g.translate(x, y);
  if (o.dim) g.globalAlpha = 0.35;
  const dark = '#0a0d18';
  g.lineJoin = 'round';

  // Extras hinter dem Körper
  if (type === 1) { // Alien: Antennen
    g.strokeStyle = color; g.lineWidth = Math.max(2, r * 0.1);
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * r * 0.35, -r * 0.8); g.lineTo(s * r * 0.6, -r * 1.45); g.stroke();
      g.beginPath(); g.arc(s * r * 0.6, -r * 1.45, r * 0.16, 0, 7); g.fillStyle = color; g.fill();
    }
  } else if (type === 2) { // Katze: Ohren
    g.fillStyle = color;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * r * 0.85, -r * 0.35); g.lineTo(s * r * 0.75, -r * 1.25); g.lineTo(s * r * 0.15, -r * 0.85); g.fill();
    }
  } else if (type === 3) { // Teufelchen: Hörner
    g.fillStyle = '#fff3';
    g.strokeStyle = color; g.lineWidth = Math.max(1.5, r * 0.08);
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * r * 0.25, -r * 0.9); g.quadraticCurveTo(s * r * 0.55, -r * 1.2, s * r * 0.75, -r * 1.35);
      g.quadraticCurveTo(s * r * 0.75, -r * 0.95, s * r * 0.65, -r * 0.7); g.closePath();
      g.fillStyle = '#ffffff'; g.fill(); g.stroke();
    }
  }

  // Körper
  glow(g, color, o.me ? r * 1.2 : r * 0.6);
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
  g.fillStyle = color; g.fill();
  noGlow(g);
  // leichter Glanz
  g.beginPath(); g.arc(-r * 0.35, -r * 0.4, r * 0.28, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fill();

  // Augen
  const look = o.look || [0, 0];
  const blink = ((t * 0.7 + seed * 0.37) % 4) < 0.12;
  const eyes = type === 7 ? [[0, -r * 0.12, r * 0.36]] : [[-r * 0.36, -r * 0.12, r * 0.24], [r * 0.36, -r * 0.12, r * 0.24]];
  for (const [ex, ey, er] of eyes) {
    if (blink) {
      g.strokeStyle = dark; g.lineWidth = Math.max(2, r * 0.09);
      g.beginPath(); g.moveTo(ex - er, ey); g.lineTo(ex + er, ey); g.stroke();
    } else {
      g.beginPath(); g.arc(ex, ey, er, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
      g.beginPath(); g.arc(ex + look[0] * er * 0.45, ey + look[1] * er * 0.45, er * 0.5, 0, Math.PI * 2);
      g.fillStyle = dark; g.fill();
    }
  }
  // Mund
  g.strokeStyle = dark; g.lineWidth = Math.max(1.5, r * 0.09); g.lineCap = 'round';
  g.beginPath();
  if (o.mood === 'oh') { g.arc(0, r * 0.42, r * 0.13, 0, Math.PI * 2); g.stroke(); }
  else { g.arc(0, r * 0.22, r * 0.32, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }

  // Extras vor dem Körper
  if (type === 4) { // Krone
    g.fillStyle = '#ffe600'; glow(g, '#ffe600', 8);
    g.beginPath();
    g.moveTo(-r * 0.55, -r * 0.82); g.lineTo(-r * 0.6, -r * 1.35); g.lineTo(-r * 0.3, -r * 1.08); g.lineTo(0, -r * 1.45);
    g.lineTo(r * 0.3, -r * 1.08); g.lineTo(r * 0.6, -r * 1.35); g.lineTo(r * 0.55, -r * 0.82); g.closePath(); g.fill();
    noGlow(g);
  } else if (type === 5) { // Propellermütze
    g.fillStyle = '#ff2bd6';
    g.beginPath(); g.arc(0, -r * 0.78, r * 0.5, Math.PI, 0); g.fill();
    g.strokeStyle = '#ffe600'; g.lineWidth = Math.max(2, r * 0.1);
    const w = Math.cos(t * 12 + seed) * r * 0.75;
    g.beginPath(); g.moveTo(0, -r * 1.28); g.lineTo(0, -r * 1.42); g.stroke();
    g.beginPath(); g.moveTo(-w, -r * 1.45); g.lineTo(w, -r * 1.45); g.stroke();
  } else if (type === 6) { // Schleife
    g.fillStyle = '#ff2bd6'; g.strokeStyle = '#fff'; g.lineWidth = 1;
    g.save(); g.translate(r * 0.55, -r * 0.8); g.rotate(-0.3);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-r * 0.45, -r * 0.28); g.lineTo(-r * 0.45, r * 0.28); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(r * 0.45, -r * 0.28); g.lineTo(r * 0.45, r * 0.28); g.closePath(); g.fill();
    g.beginPath(); g.arc(0, 0, r * 0.12, 0, 7); g.fillStyle = '#fff'; g.fill();
    g.restore();
  }

  if (o.me) {
    g.strokeStyle = '#ffffff'; g.lineWidth = 3;
    g.setLineDash([6, 5]);
    g.beginPath(); g.arc(0, 0, r + 7, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
  }
  g.restore();

  if (o.label) {
    const ly = y + r + (o.me ? 20 : 15);
    text(g, o.me ? 'Du' : o.label, x, ly, { size: o.me ? 18 : 14, weight: '700', color: o.me ? '#fff' : color });
    if (o.sub) text(g, o.sub, x, ly + (o.me ? 18 : 15), { size: o.me ? 15 : 13, color: '#c9d6ee', weight: '500' });
  }
}

// Fortschrittsring "Halten!" oben rechts
function drawHold(g, frac, label) {
  if (frac <= 0) return;
  const x = WORLD_W - 90, y = 90;
  g.lineWidth = 12;
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.beginPath(); g.arc(x, y, 48, 0, Math.PI * 2); g.stroke();
  glow(g, NEON.green, 16);
  g.strokeStyle = NEON.green;
  g.beginPath(); g.arc(x, y, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac)); g.stroke();
  noGlow(g);
  text(g, label || 'Halten!', x, y, { size: 18, weight: '800', color: NEON.green });
}

// Kasten mit Hilfe-/Formeltext
function drawHelpBox(g, lines, x, y, w) {
  const lh = 26, h = lines.length * lh + 20;
  g.fillStyle = 'rgba(8,14,30,0.85)';
  g.strokeStyle = 'rgba(0,240,255,0.5)'; g.lineWidth = 2;
  g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill(); g.stroke();
  lines.forEach((s, i) => text(g, s, x + 16, y + 22 + i * lh, { size: 18, align: 'left', color: i === 0 ? NEON.cyan : '#dbe7ff', weight: i === 0 ? '700' : '500' }));
}

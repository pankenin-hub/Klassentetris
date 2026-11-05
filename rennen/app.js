// Klassen-Rennen – Netzwerk und Oberfläche
// Der Browser der Lehrkraft ist der "Host". Schüler verbinden sich per WebRTC (PeerJS) direkt mit ihm.
// Jeder Schüler-Browser berechnet sein eigenes Kart und schickt die Position an den Host,
// der Host verteilt alle Positionen an alle.
'use strict';

const PREFIX = 'klassenrennen-v1-';
const MAX_PLAYERS = 8;
const COUNTDOWN = 3;
const AFTER_FIRST = 30;      // Sekunden, die nach dem ersten Zieleinlauf noch gefahren wird
const MAX_RACE = 600;        // Sicherheitsgrenze in Sekunden
const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);

function peerOptions() {
  // Für Tests: ?peerserver=localhost:9000 nutzt einen eigenen PeerJS-Server
  const s = params.get('peerserver');
  if (s) {
    const [host, port] = s.split(':');
    return { host, port: Number(port), path: '/', secure: false, debug: 1 };
  }
  return { debug: 1 };
}

function show(screen) {
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== 'screen-' + screen;
}

function fmtTime(ms, tenths) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  let t = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  if (tenths) t += ',' + Math.floor((ms % 1000) / 100);
  return t;
}

function cleanName(n) {
  return String(n || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 16);
}

function joinUrl() { return location.origin + location.pathname; }

const trackCache = new Map();
function getTrack(id) {
  if (!trackCache.has(id)) {
    const def = TRACKS.find(t => t.id === id) || TRACKS[0];
    const tr = buildTrack(def);
    tr.img = drawTrackImage(tr);
    trackCache.set(id, tr);
  }
  return trackCache.get(id);
}

// Rangfolge: erst wer im Ziel ist (nach Zeit), dann nach gefahrener Strecke
function ranked(players) {
  return players.filter(p => p.playing).sort((a, b) => {
    if (a.fin != null || b.fin != null) {
      if (a.fin == null) return 1;
      if (b.fin == null) return -1;
      return a.fin - b.fin;
    }
    return b.prog - a.prog;
  });
}

// ---------------------------------------------------------------- Rennansicht (Lehrkraft und Schüler)
const view = {
  shown: new Map(),   // id -> geglättete Position {x,y,a}
  track: null, laps: 3,

  reset(track, laps) { this.track = track; this.laps = laps; this.shown.clear(); },

  smooth(players, dt) {
    const f = Math.min(1, dt * 14);
    for (const p of players) {
      if (p.x == null) continue;
      let s = this.shown.get(p.id);
      if (!s || Math.hypot(s.x - p.x, s.y - p.y) > 200) { s = { x: p.x, y: p.y, a: p.a }; this.shown.set(p.id, s); }
      s.x += (p.x - s.x) * f; s.y += (p.y - s.y) * f;
      let da = p.a - s.a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      s.a += da * f;
    }
  },

  draw(players, myId, own) {
    const canvas = $('race-canvas'), stage = $('stage'), tr = this.track;
    if (!tr) return;
    const sc = Math.min(stage.clientWidth / WORLD_W, stage.clientHeight / WORLD_H);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(WORLD_W * sc), h = Math.floor(WORLD_H * sc);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    }
    const g = canvas.getContext('2d');
    g.setTransform(sc * dpr, 0, 0, sc * dpr, 0, 0);
    g.drawImage(tr.img, 0, 0);
    // eigenes Kart zuletzt zeichnen, damit es oben liegt
    for (const p of players) {
      if (!p.playing || p.id === myId) continue;
      const s = this.shown.get(p.id);
      if (!s) continue;
      drawKart(g, s, p.color, { label: p.name, dim: !p.connected, boost: p.b });
    }
    if (own) drawKart(g, own.kart, own.color, { label: 'Du', me: true, boost: own.kart.boost > 0 });
  },

  standings(list, myId) {
    const ol = $('standings');
    ol.textContent = '';
    for (const p of list) {
      const li = document.createElement('li');
      if (p.id === myId) li.className = 'me';
      if (!p.connected) li.classList.add('off');
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = p.color;
      const n = document.createElement('span'); n.className = 'n'; n.textContent = p.name;
      const s = document.createElement('span'); s.className = 's';
      s.textContent = p.fin != null ? 'Ziel ' + fmtTime(p.fin, true) : 'Runde ' + Math.max(1, Math.min(this.laps, p.lap || 1)) + '/' + this.laps;
      li.append(dot, n, s);
      ol.appendChild(li);
    }
  },
};

function showResults(ranking, myId, isHost) {
  const ol = $('results-list');
  ol.textContent = '';
  for (const r of ranking) {
    const li = document.createElement('li');
    if (r.id === myId) li.className = 'me';
    const pts = document.createElement('span');
    pts.className = 'pts';
    pts.textContent = r.fin != null ? fmtTime(r.fin, true) : 'nicht im Ziel';
    li.append(document.createTextNode(r.name), pts);
    ol.appendChild(li);
  }
  if (!ranking.length) {
    const li = document.createElement('li'); li.textContent = 'Niemand ist gefahren.'; ol.appendChild(li);
  }
  $('host-again').hidden = !isHost;
  $('results-wait').hidden = isHost;
  $('results').hidden = false;
}

function drawPreview(trackId) {
  const c = $('host-preview'), g = c.getContext('2d');
  g.drawImage(getTrack(trackId).img, 0, 0, c.width, c.height);
}

// ---------------------------------------------------------------- Lehrkraft (Host)
const host = {
  peer: null, code: '', phase: 'lobby', players: [], nextId: 1,
  trackId: TRACKS[0].id, laps: 3, startAt: 0, firstFinish: 0, loop: null, raf: 0, lastFrame: 0,

  start() {
    $('host-error').hidden = true;
    $('host-btn').disabled = true;
    this.tryOpen(0);
  },

  tryOpen(attempt) {
    this.code = String(1000 + Math.floor(Math.random() * 9000));
    const peer = new Peer(PREFIX + this.code, peerOptions());
    this.peer = peer;
    peer.on('open', () => this.openLobby());
    peer.on('connection', conn => this.onConnection(conn));
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    peer.on('error', err => {
      if (err.type === 'unavailable-id' && attempt < 5) { peer.destroy(); this.tryOpen(attempt + 1); return; }
      if (this.phase === 'lobby' && !$('screen-home').hidden) {
        $('host-error').textContent = 'Raum konnte nicht erstellt werden (' + err.type + '). Ist das Internet erreichbar?';
        $('host-error').hidden = false;
        $('host-btn').disabled = false;
      }
      console.warn('Host-Fehler', err);
    });
  },

  openLobby() {
    const url = joinUrl();
    $('host-url').textContent = url.replace(/^https?:\/\//, '');
    $('host-code').textContent = this.code;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url + '?code=' + this.code);
      qr.make();
      $('host-qr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 0 });
    } catch (e) { $('host-qr').hidden = true; }
    $('game-code').textContent = 'Code ' + this.code;
    const sel = $('host-track');
    for (const t of TRACKS) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); }
    sel.onchange = () => drawPreview(sel.value);
    drawPreview(sel.value);
    window.addEventListener('beforeunload', e => {
      if (this.players.length) { e.preventDefault(); e.returnValue = ''; }
    });
    $('host-start').onclick = () => this.startRace();
    $('host-again').onclick = () => this.backToLobby();
    show('host-lobby');
    this.renderLobby();
  },

  onConnection(conn) {
    let player = null;
    conn.on('data', msg => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'join' && !player) {
        player = this.join(conn, msg.name);
      } else if (player && msg.t === 'st' && player.conn === conn) {
        if (this.phase !== 'racing' || !player.playing) return;
        const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
        player.x = num(msg.x); player.y = num(msg.y); player.a = num(msg.a);
        player.b = !!msg.b; player.prog = num(msg.p); player.lap = num(msg.l);
        if (msg.f && player.fin == null) {
          player.fin = Date.now() - this.startAt;
          if (!this.firstFinish) this.firstFinish = Date.now();
        }
      }
    });
    conn.on('close', () => {
      if (!player || player.conn !== conn) return;
      player.connected = false;
      if (this.phase === 'lobby') this.players = this.players.filter(p => p !== player);
      this.renderLobby();
      this.broadcastLobby();
    });
  },

  join(conn, rawName) {
    const name = cleanName(rawName);
    if (!name) { conn.send({ t: 'reject', reason: 'Bitte gib einen Namen ein.' }); return null; }
    let p = this.players.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (p && p.connected) {
      conn.send({ t: 'reject', reason: 'Der Name „' + name + '“ ist schon vergeben.' });
      return null;
    }
    if (p) {
      // Wiederverbinden (z. B. nach Neuladen): fährt ab dem nächsten Rennen wieder mit
      p.conn = conn; p.connected = true;
    } else {
      if (this.players.length >= MAX_PLAYERS) {
        conn.send({ t: 'reject', reason: 'Der Raum ist voll (maximal ' + MAX_PLAYERS + ' Fahrer).' });
        return null;
      }
      const used = new Set(this.players.map(x => x.color));
      const color = KART_COLORS.find(c => !used.has(c)) || KART_COLORS[0];
      p = { id: this.nextId++, name, conn, color, connected: true, playing: false };
      this.players.push(p);
    }
    conn.send({ t: 'welcome', id: p.id, code: this.code, phase: this.phase });
    if (this.phase !== 'lobby') {
      this.send(p, { t: 'watch', track: this.trackId, laps: this.laps, players: this.publicPlayers(true) });
    }
    this.renderLobby();
    this.broadcastLobby();
    return p;
  },

  send(p, msg) { if (p.connected && p.conn.open) { try { p.conn.send(msg); } catch (e) {} } },
  broadcast(msg) { for (const p of this.players) this.send(p, msg); },

  broadcastLobby() {
    if (this.phase !== 'lobby') return;
    this.broadcast({ t: 'lobby', players: this.players.filter(p => p.connected).map(p => ({ id: p.id, name: p.name, color: p.color })) });
  },

  renderLobby() {
    if (this.phase !== 'lobby') return;
    const ul = $('host-players');
    ul.textContent = '';
    const list = this.players.filter(p => p.connected);
    for (const p of list) {
      const li = document.createElement('li');
      li.textContent = p.name;
      li.style.borderLeft = '8px solid ' + p.color;
      ul.appendChild(li);
    }
    $('host-count').textContent = list.length;
    $('host-start').disabled = list.length === 0;
  },

  startRace() {
    this.trackId = $('host-track').value;
    this.laps = Number($('host-laps').value) || 3;
    const tr = getTrack(this.trackId);
    // Startplätze zufällig verteilen
    const racers = this.players.filter(p => p.connected).sort(() => Math.random() - 0.5);
    for (const p of this.players) { p.playing = false; p.fin = null; }
    racers.forEach((p, i) => {
      const s = gridSlot(tr, i);
      Object.assign(p, { playing: true, slot: i, x: s.x, y: s.y, a: s.a, b: false, prog: 0, lap: 1, fin: null });
    });
    this.phase = 'countdown';
    this.firstFinish = 0;
    this.startAt = Date.now() + COUNTDOWN * 1000;
    this.broadcast({ t: 'start', track: this.trackId, laps: this.laps, countdown: COUNTDOWN, players: this.publicPlayers(true) });
    view.reset(tr, this.laps);
    $('results').hidden = true;
    $('hud').hidden = true; $('keys').hidden = true;
    show('game');
    clearInterval(this.loop);
    this.loop = setInterval(() => this.tick(), 50);
    this.tick();
    cancelAnimationFrame(this.raf);
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(t => this.frame(t));
  },

  tick() {
    const now = Date.now();
    if (this.phase === 'countdown' && now >= this.startAt) {
      this.phase = 'racing';
      this.broadcast({ t: 'go' });
    }
    if (this.phase === 'racing') {
      const active = this.players.filter(p => p.playing && p.connected);
      const allDone = active.every(p => p.fin != null);
      if (allDone || (this.firstFinish && now - this.firstFinish > AFTER_FIRST * 1000) || now - this.startAt > MAX_RACE * 1000) {
        this.finish();
        return;
      }
    }
    const msg = { t: 'states', phase: this.phase, elapsed: now - this.startAt, players: this.publicPlayers(false) };
    if (this.firstFinish) msg.left = AFTER_FIRST * 1000 - (now - this.firstFinish);
    this.broadcast(msg);
    this.renderHud(msg);
  },

  publicPlayers(full) {
    return this.players.map(p => {
      const o = {
        id: p.id, playing: !!p.playing, connected: p.connected,
        x: p.x == null ? null : Math.round(p.x * 10) / 10, y: p.y == null ? null : Math.round(p.y * 10) / 10,
        a: p.a == null ? 0 : Math.round(p.a * 1000) / 1000, b: !!p.b, prog: p.prog || 0, lap: p.lap || 1, fin: p.fin,
      };
      o.name = p.name; o.color = p.color;
      if (full) o.slot = p.slot;
      return o;
    });
  },

  renderHud(msg) {
    const t = $('game-timer'), ov = $('overlay');
    if (this.phase === 'countdown') {
      const c = Math.ceil((this.startAt - Date.now()) / 1000);
      ov.hidden = false; ov.textContent = c > 0 ? String(c) : 'Los!';
      t.textContent = '0:00';
    } else {
      ov.hidden = !(msg.elapsed < 1000);
      ov.textContent = 'Los!';
      t.textContent = fmtTime(msg.elapsed) + (msg.left != null ? '  (noch ' + Math.ceil(Math.max(0, msg.left) / 1000) + ' s)' : '');
    }
    view.standings(ranked(this.players), null);
  },

  frame(t) {
    const dt = Math.min(0.1, (t - this.lastFrame) / 1000);
    this.lastFrame = t;
    view.smooth(this.players.filter(p => p.playing), dt);
    view.draw(this.players, null, null);
    if (this.phase === 'countdown' || this.phase === 'racing' || this.phase === 'ended') {
      this.raf = requestAnimationFrame(tt => this.frame(tt));
    }
  },

  finish() {
    this.phase = 'ended';
    clearInterval(this.loop);
    const ranking = ranked(this.players).map(p => ({ id: p.id, name: p.name, fin: p.fin }));
    this.broadcast({ t: 'end', ranking });
    $('overlay').hidden = true;
    showResults(ranking, null, true);
  },

  backToLobby() {
    this.phase = 'lobby';
    cancelAnimationFrame(this.raf);
    this.players = this.players.filter(p => p.connected);
    for (const p of this.players) { p.playing = false; p.fin = null; p.x = null; }
    $('results').hidden = true;
    show('host-lobby');
    this.renderLobby();
    this.broadcastLobby();
  },
};

// ---------------------------------------------------------------- Schüler (Client)
const client = {
  peer: null, conn: null, myId: null, name: '', code: '',
  state: 'connecting', // connecting | lobby | countdown | racing | done | watching | ended
  own: null, players: [], laps: 3, elapsed: 0, left: null, startLocal: 0,
  input: { up: false, down: false, left: false, right: false },
  raf: 0, lastFrame: 0, lastSent: 0, joinTimer: null, sentFin: false,

  start(code, name) {
    this.code = code; this.name = name;
    $('join-error').hidden = true;
    show('wait');
    this.wait('Verbinde mit Raum ' + code + ' …', '');
    const peer = new Peer(peerOptions());
    this.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true });
      this.conn = conn;
      conn.on('open', () => conn.send({ t: 'join', name }));
      conn.on('data', msg => this.onMessage(msg));
      conn.on('close', () => this.lost());
      conn.on('error', () => this.lost());
    });
    peer.on('error', err => {
      if (err.type === 'peer-unavailable') this.fail('Raum ' + code + ' wurde nicht gefunden. Stimmt der Code?');
      else if (this.state === 'connecting') this.fail('Verbindung fehlgeschlagen (' + err.type + ').');
      console.warn('Client-Fehler', err);
    });
    clearTimeout(this.joinTimer);
    this.joinTimer = setTimeout(() => {
      if (this.state === 'connecting') this.fail('Keine Verbindung zum Raum. Bitte noch einmal versuchen.');
    }, 15000);
  },

  fail(text) {
    clearTimeout(this.joinTimer);
    if (this.peer) this.peer.destroy();
    this.state = 'failed';
    show('home');
    $('join-error').textContent = text;
    $('join-error').hidden = false;
  },

  lost() {
    if (this.state === 'failed' || this.state === 'lost') return;
    if (this.state === 'connecting') { this.fail('Verbindung fehlgeschlagen.'); return; }
    this.state = 'lost';
    cancelAnimationFrame(this.raf);
    $('results').hidden = true;
    show('wait');
    this.wait('Verbindung verloren', 'Die Verbindung zum Raum ist abgebrochen. Lade die Seite neu und tritt mit demselben Namen wieder bei.');
    $('wait-players').textContent = '';
    $('wait-home').hidden = false;
  },

  wait(title, text) {
    $('wait-title').textContent = title;
    $('wait-text').textContent = text;
  },

  onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'reject':
        this.fail(msg.reason || 'Beitritt abgelehnt.');
        break;
      case 'welcome':
        clearTimeout(this.joinTimer);
        this.myId = msg.id;
        $('game-code').textContent = 'Code ' + this.code;
        if (msg.phase === 'lobby') this.toLobby([]);
        else { this.state = 'watching'; this.wait('Du bist drin!', 'Gerade läuft ein Rennen. Du fährst ab dem nächsten Rennen mit.'); }
        break;
      case 'lobby':
        this.toLobby(msg.players || []);
        break;
      case 'watch':
        this.state = 'watching';
        this.own = null;
        this.setup(msg.track, msg.laps, msg.players);
        break;
      case 'start':
        this.startRace(msg);
        break;
      case 'go':
        if (this.state === 'countdown') { this.state = 'racing'; this.startLocal = performance.now(); }
        break;
      case 'states':
        this.players = msg.players || [];
        this.elapsed = msg.elapsed; this.left = msg.left;
        this.renderHud();
        break;
      case 'end':
        this.state = 'ended';
        $('overlay').hidden = true;
        showResults(msg.ranking || [], this.myId, false);
        break;
    }
  },

  toLobby(players) {
    this.state = 'lobby';
    this.own = null;
    cancelAnimationFrame(this.raf);
    $('results').hidden = true;
    show('wait');
    this.wait('Du bist drin, ' + this.name + '!', 'Warte, bis die Lehrkraft das Rennen startet.');
    const ul = $('wait-players');
    ul.textContent = '';
    for (const p of players) {
      const li = document.createElement('li');
      li.textContent = p.name;
      li.style.borderLeft = '8px solid ' + p.color;
      if (p.id === this.myId) li.className = 'me';
      ul.appendChild(li);
    }
  },

  setup(trackId, laps, players) {
    this.laps = laps;
    this.players = players || [];
    view.reset(getTrack(trackId), laps);
    $('results').hidden = true;
    show('game');
    cancelAnimationFrame(this.raf);
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(t => this.frame(t));
  },

  startRace(msg) {
    const me = (msg.players || []).find(p => p.id === this.myId);
    this.setup(msg.track, msg.laps, msg.players);
    if (!me || !me.playing) { this.state = 'watching'; this.own = null; $('hud').hidden = true; return; }
    this.own = { kart: new Kart(view.track, me.slot, msg.laps), color: me.color };
    this.state = 'countdown';
    this.countdownEnd = performance.now() + msg.countdown * 1000;
    this.sentFin = false;
    this.input = { up: false, down: false, left: false, right: false };
    $('hud').hidden = false; $('keys').hidden = false;
    $('overlay').hidden = false;
  },

  frame(t) {
    const dt = Math.min(0.05, (t - this.lastFrame) / 1000);
    this.lastFrame = t;
    const own = this.own, ov = $('overlay');
    if (own) {
      const k = own.kart;
      if (this.state === 'racing' || this.state === 'done') {
        const others = [];
        for (const p of this.players) {
          if (p.id === this.myId || !p.playing) continue;
          const s = view.shown.get(p.id);
          if (s) others.push(s);
        }
        let inp = this.state === 'racing' ? this.input : { up: false, down: false, left: false, right: false };
        if (this.state === 'racing' && params.has('bot')) inp = autopilot(k);
        // kleine Schritte für stabile Physik
        const steps = Math.ceil(dt / 0.017);
        for (let i = 0; i < steps; i++) k.update(dt / steps, inp, others);
        if (k.finished && this.state === 'racing') this.state = 'done';
        if (t - this.lastSent > 50) { this.sendState(); this.lastSent = t; }
      }
      if (this.state === 'countdown') {
        const c = Math.ceil((this.countdownEnd - t) / 1000);
        ov.hidden = false; ov.textContent = c > 0 ? String(c) : 'Los!';
      } else if (this.state === 'racing') {
        ov.hidden = t - this.startLocal > 900;
        ov.textContent = 'Los!';
      } else if (this.state === 'done') {
        ov.hidden = false; ov.textContent = 'Ziel!';
      }
      $('hud-lap').textContent = k.lap + '/' + this.laps;
    }
    view.smooth(this.players.filter(p => p.playing && p.id !== this.myId), dt);
    view.draw(this.players, this.myId, own);
    if (['countdown', 'racing', 'done', 'watching', 'ended'].includes(this.state)) {
      this.raf = requestAnimationFrame(tt => this.frame(tt));
    }
  },

  sendState() {
    const k = this.own && this.own.kart;
    if (!k || !this.conn || !this.conn.open) return;
    try {
      this.conn.send({ t: 'st', x: k.x, y: k.y, a: k.a, b: k.boost > 0, p: k.progress, l: k.lap, f: k.finished });
    } catch (e) {}
  },

  // Liste mit dem eigenen, aktuellen Stand zusammenführen
  merged() {
    return this.players.map(p => {
      if (p.id !== this.myId || !this.own) return p;
      const k = this.own.kart;
      return Object.assign({}, p, { prog: k.progress, lap: k.lap });
    });
  },

  renderHud() {
    const t = $('game-timer');
    if (this.state === 'countdown') t.textContent = '0:00';
    else t.textContent = fmtTime(this.elapsed) + (this.left != null ? '  (noch ' + Math.ceil(Math.max(0, this.left) / 1000) + ' s)' : '');
    const list = ranked(this.merged());
    view.standings(list, this.myId);
    const place = list.findIndex(p => p.id === this.myId);
    if (place >= 0) $('hud-place').textContent = (place + 1) + '/' + list.length;
  },

  // --- Tastatur ---
  key(e, down) {
    const map = {
      ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
    };
    const k = map[e.key];
    if (!k) return;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    this.input[k] = down;
    if (this.own) e.preventDefault();
  },
};

// Nur für Tests (?bot=1): fährt automatisch die Mittellinie entlang
function autopilot(k) {
  const tr = k.track, tgt = tr.pts[(k.idx + 14) % tr.N];
  let da = Math.atan2(tgt[1] - k.y, tgt[0] - k.x) - k.a;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  return { up: Math.random() < 0.9, down: false, left: da < -0.08, right: da > 0.08 };
}

// ---------------------------------------------------------------- Start
(function init() {
  const code = (params.get('code') || '').replace(/\D/g, '').slice(0, 4);
  if (code) { $('join-code').value = code; $('join-name').focus(); }
  else $('join-code').focus();
  try { const n = localStorage.getItem('kr-name'); if (n) $('join-name').value = n; } catch (e) {}

  $('join-form').addEventListener('submit', e => {
    e.preventDefault();
    const c = $('join-code').value.replace(/\D/g, '');
    const n = cleanName($('join-name').value);
    if (c.length !== 4) { $('join-error').textContent = 'Der Code hat 4 Ziffern.'; $('join-error').hidden = false; return; }
    if (!n) { $('join-error').textContent = 'Bitte gib deinen Namen ein.'; $('join-error').hidden = false; return; }
    try { localStorage.setItem('kr-name', n); } catch (err) {}
    document.activeElement.blur();
    client.start(c, n);
  });
  $('host-btn').addEventListener('click', () => host.start());
  $('wait-home').addEventListener('click', () => { location.href = joinUrl() + '?code=' + client.code; });
  window.addEventListener('keydown', e => client.key(e, true));
  window.addEventListener('keyup', e => client.key(e, false));
  window.addEventListener('blur', () => { client.input = { up: false, down: false, left: false, right: false }; });
})();

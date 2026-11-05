// Klassen-Tetris – Netzwerk und Oberfläche
// Der Browser der Lehrkraft ist der "Host". Schüler verbinden sich per WebRTC (PeerJS) direkt mit ihm.
'use strict';

const PREFIX = 'klassentetris-v1-';
const MAX_PLAYERS = 8;
const COUNTDOWN = 3;
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

function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function cleanName(n) {
  return String(n || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 16);
}

function joinUrl() { return location.origin + location.pathname; }

// ---------------------------------------------------------------- Spielfeld-Übersicht
const boardsView = {
  items: new Map(), // id -> {el, canvas, name, score}
  key: '',
  render(players, opts) {
    const box = $('others');
    const key = players.map(p => p.id).join(',');
    if (key !== this.key) {
      this.key = key;
      box.textContent = '';
      this.items.clear();
      for (const p of players) {
        const el = document.createElement('div');
        el.className = 'mini';
        const wrap = document.createElement('div');
        wrap.className = 'board-wrap';
        const canvas = document.createElement('canvas');
        wrap.appendChild(canvas);
        const label = document.createElement('div');
        label.className = 'label';
        const name = document.createElement('span'); name.className = 'n';
        const score = document.createElement('span'); score.className = 's';
        label.append(name, score);
        el.append(wrap, label);
        box.appendChild(el);
        this.items.set(p.id, { el, wrap, canvas, name, score });
      }
    }
    const cell = this.cellSize(players.length, box);
    const ranks = rankMap(players);
    for (const p of players) {
      const it = this.items.get(p.id);
      const me = p.id === opts.myId;
      it.el.classList.toggle('me', me);
      it.wrap.classList.toggle('me', me);
      it.el.classList.toggle('off', !p.connected);
      it.el.style.width = (10 * cell + 4) + 'px';
      it.name.textContent = p.name + (p.connected ? '' : ' (weg)');
      it.score.textContent = (p.playing ? '#' + ranks.get(p.id) + ' · ' : '') + p.score + ' Pkt · ' + p.lines + ' R';
      drawBoard(it.canvas, p.board, cell, { dim: !p.playing });
    }
  },
  cellSize(n, box) {
    if (!n) return 10;
    const W = box.clientWidth, H = box.clientHeight;
    for (let c = 30; c > 5; c--) {
      const bw = 10 * c + 4 + 16, bh = 20 * c + 4 + 52 + 16;
      const perRow = Math.max(1, Math.floor((W + 16) / bw));
      const rows = Math.ceil(n / perRow);
      if (rows * bh <= H && (perRow >= n || perRow * bw <= W + 16)) return c;
    }
    return 6;
  },
};

function rankMap(players) {
  const sorted = players.filter(p => p.playing).sort((a, b) => b.score - a.score);
  const m = new Map();
  sorted.forEach((p, i) => m.set(p.id, i + 1));
  return m;
}

function showResults(ranking, myId, isHost) {
  const ol = $('results-list');
  ol.textContent = '';
  for (const r of ranking) {
    const li = document.createElement('li');
    if (r.id === myId) li.className = 'me';
    const pts = document.createElement('span');
    pts.className = 'pts';
    pts.textContent = r.score + ' Pkt · ' + r.lines + ' Reihen';
    li.append(document.createTextNode(r.name), pts);
    ol.appendChild(li);
  }
  if (!ranking.length) {
    const li = document.createElement('li'); li.textContent = 'Niemand hat gespielt.'; ol.appendChild(li);
  }
  $('host-again').hidden = !isHost;
  $('results-wait').hidden = isHost;
  $('results').hidden = false;
}

function setTimer(ms) {
  const t = $('game-timer');
  t.textContent = fmtTime(ms);
  t.classList.toggle('low', ms <= 10000);
}

// ---------------------------------------------------------------- Lehrkraft (Host)
const host = {
  peer: null, code: '', phase: 'lobby', players: [], nextId: 1,
  duration: 180, seed: 0, startAt: 0, endAt: 0, loop: null,

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
    $('own-panel').hidden = true;
    window.addEventListener('beforeunload', e => {
      if (this.players.length) { e.preventDefault(); e.returnValue = ''; }
    });
    $('host-start').onclick = () => this.startRound();
    $('host-again').onclick = () => this.backToLobby();
    window.addEventListener('resize', () => { if (this.phase !== 'lobby') this.renderGame(); });
    show('host-lobby');
    this.renderLobby();
  },

  onConnection(conn) {
    let player = null;
    conn.on('data', msg => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'join' && !player) {
        player = this.join(conn, msg.name);
      } else if (player && (msg.t === 'state' || msg.t === 'final') && player.conn === conn) {
        if (this.phase !== 'playing' && this.phase !== 'stopping') return;
        if (!player.playing) return;
        if (typeof msg.board === 'string' && msg.board.length === 200) player.board = msg.board;
        player.score = Number(msg.score) || 0;
        player.lines = Number(msg.lines) || 0;
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
      // Wiederverbinden (z. B. nach Neuladen): Punkte bleiben, spielt ab nächster Runde wieder mit
      p.conn = conn; p.connected = true;
    } else {
      if (this.players.length >= MAX_PLAYERS) {
        conn.send({ t: 'reject', reason: 'Der Raum ist voll (maximal ' + MAX_PLAYERS + ' Spieler).' });
        return null;
      }
      p = { id: this.nextId++, name, conn, connected: true, playing: false, board: null, score: 0, lines: 0 };
      this.players.push(p);
    }
    conn.send({ t: 'welcome', id: p.id, code: this.code, phase: this.phase });
    this.renderLobby();
    this.broadcastLobby();
    return p;
  },

  send(p, msg) { if (p.connected && p.conn.open) { try { p.conn.send(msg); } catch (e) {} } },
  broadcast(msg) { for (const p of this.players) this.send(p, msg); },

  broadcastLobby() {
    if (this.phase !== 'lobby') return;
    this.broadcast({ t: 'lobby', players: this.players.filter(p => p.connected).map(p => ({ id: p.id, name: p.name })) });
  },

  renderLobby() {
    if (this.phase !== 'lobby') return;
    const ul = $('host-players');
    ul.textContent = '';
    const list = this.players.filter(p => p.connected);
    for (const p of list) {
      const li = document.createElement('li');
      li.textContent = p.name;
      ul.appendChild(li);
    }
    $('host-count').textContent = list.length;
    $('host-start').disabled = list.length === 0;
  },

  startRound() {
    this.duration = Number($('host-duration').value) || 180;
    this.seed = Math.floor(Math.random() * 2 ** 31);
    this.phase = 'countdown';
    for (const p of this.players) {
      p.playing = p.connected; p.board = null; p.score = 0; p.lines = 0;
    }
    this.startAt = Date.now() + COUNTDOWN * 1000;
    this.endAt = this.startAt + this.duration * 1000;
    this.broadcast({ t: 'start', seed: this.seed, duration: this.duration, countdown: COUNTDOWN });
    $('results').hidden = true;
    show('game');
    clearInterval(this.loop);
    this.loop = setInterval(() => this.tick(), 150);
    this.tick();
  },

  tick() {
    const now = Date.now();
    if (this.phase === 'countdown' && now >= this.startAt) {
      this.phase = 'playing';
      this.broadcast({ t: 'go' });
    }
    if (this.phase === 'playing' && now >= this.endAt) {
      this.phase = 'stopping';
      this.broadcast({ t: 'stop' });
      // kurz auf die letzten Spielstände warten
      setTimeout(() => this.finish(), 800);
    }
    const remaining = this.phase === 'countdown' ? this.startAt - now + this.duration * 1000 : this.endAt - now;
    const pub = this.publicPlayers();
    this.broadcast({ t: 'states', phase: this.phase, remaining, duration: this.duration, players: pub });
    this.renderGame(remaining);
  },

  publicPlayers() {
    return this.players.map(p => ({
      id: p.id, name: p.name, board: p.board, score: p.score, lines: p.lines,
      connected: p.connected, playing: p.playing,
    }));
  },

  renderGame(remaining) {
    if (remaining !== undefined) {
      if (this.phase === 'countdown') {
        $('game-timer').textContent = 'Start in ' + Math.ceil((this.startAt - Date.now()) / 1000);
        $('game-timer').classList.remove('low');
      } else setTimer(remaining);
    }
    boardsView.render(this.publicPlayers(), { myId: null });
  },

  finish() {
    this.phase = 'ended';
    clearInterval(this.loop);
    const ranking = this.players.filter(p => p.playing).sort((a, b) => b.score - a.score)
      .map(p => ({ id: p.id, name: p.name, score: p.score, lines: p.lines }));
    this.broadcast({ t: 'end', ranking });
    setTimer(0);
    boardsView.render(this.publicPlayers(), { myId: null });
    showResults(ranking, null, true);
  },

  backToLobby() {
    this.phase = 'lobby';
    this.players = this.players.filter(p => p.connected);
    for (const p of this.players) { p.playing = false; p.board = null; p.score = 0; p.lines = 0; }
    $('results').hidden = true;
    show('host-lobby');
    this.renderLobby();
    this.broadcastLobby();
  },
};

// ---------------------------------------------------------------- Schüler (Client)
const client = {
  peer: null, conn: null, myId: null, name: '', code: '',
  game: null, state: 'connecting', // connecting | lobby | countdown | playing | stopped | spectating
  players: [], remaining: 0, duration: 180, lastSent: 0, sentVersion: -1, sentScore: -1,
  keys: { dir: 0, das: 0, down: false, downAcc: 0 },
  raf: 0, lastFrame: 0, joinTimer: null,

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
        $('own-name').textContent = this.name;
        if (msg.phase === 'lobby') this.toLobby([]);
        else { this.state = 'spectating'; this.wait('Du bist drin!', 'Gerade läuft eine Runde. Du spielst ab der nächsten Runde mit.'); }
        break;
      case 'lobby':
        this.toLobby(msg.players || []);
        break;
      case 'start':
        this.startGame(msg.seed, msg.duration);
        break;
      case 'go':
        if (this.state === 'countdown') { this.state = 'playing'; $('own-overlay').hidden = true; }
        break;
      case 'stop':
        if (this.game) { this.state = 'stopped'; this.sendState('final'); }
        break;
      case 'states':
        this.players = msg.players || [];
        this.remaining = msg.remaining;
        this.duration = msg.duration;
        if (this.state === 'spectating' && $('screen-game').hidden) {
          $('own-panel').hidden = true;
          show('game');
        }
        this.renderOthers();
        break;
      case 'end':
        this.state = 'ended';
        showResults(msg.ranking || [], this.myId, false);
        break;
    }
  },

  toLobby(players) {
    this.state = 'lobby';
    this.game = null;
    cancelAnimationFrame(this.raf);
    $('results').hidden = true;
    show('wait');
    this.wait('Du bist drin, ' + this.name + '!', 'Warte, bis die Lehrkraft das Spiel startet.');
    const ul = $('wait-players');
    ul.textContent = '';
    for (const p of players) {
      const li = document.createElement('li');
      li.textContent = p.name;
      if (p.id === this.myId) li.className = 'me';
      ul.appendChild(li);
    }
  },

  startGame(seed, duration) {
    this.duration = duration;
    this.remaining = duration * 1000 + COUNTDOWN * 1000;
    this.game = new TetrisGame(seed);
    this.state = 'countdown';
    this.sentVersion = -1; this.sentScore = -1;
    this.keys = { dir: 0, das: 0, down: false, downAcc: 0 };
    $('results').hidden = true;
    $('own-panel').hidden = false;
    show('game');
    $('own-overlay').hidden = false;
    this.lastFrame = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(t => this.frame(t));
  },

  frame(t) {
    const dt = Math.min(100, t - this.lastFrame);
    this.lastFrame = t;
    const g = this.game;
    if (!g) return;
    if (this.state === 'playing') {
      this.handleHeld(dt);
      g.update(dt);
      if (t - this.lastSent > 100 && (g.version !== this.sentVersion || g.score !== this.sentScore)) {
        this.sendState('state');
        this.lastSent = t;
      }
    }
    if (this.state === 'countdown') {
      const c = Math.ceil((this.remaining - this.duration * 1000) / 1000);
      $('own-overlay').textContent = c > 0 ? String(c) : 'Los!';
    }
    this.renderOwn();
    if (this.state === 'countdown' || this.state === 'playing' || this.state === 'stopped') {
      this.raf = requestAnimationFrame(tt => this.frame(tt));
    }
  },

  sendState(type) {
    const g = this.game;
    if (!g || !this.conn || !this.conn.open) return;
    this.sentVersion = g.version; this.sentScore = g.score;
    try {
      this.conn.send({ t: type, board: g.serialize(), score: g.score, lines: g.lines, level: g.level });
    } catch (e) {}
  },

  ownCell() {
    const h = window.innerHeight - 110;
    return Math.max(12, Math.min(34, Math.floor(h / 20)));
  },

  renderOwn() {
    const g = this.game;
    if (!g) return;
    const p = g.piece;
    let ghost = null;
    if (this.state === 'playing') {
      const gy = g.ghostY();
      ghost = [];
      for (let y = 0; y < p.m.length; y++) for (let x = 0; x < p.m.length; x++) if (p.m[y][x]) ghost.push([p.x + x, gy + y]);
    }
    drawBoard($('own-canvas'), g.serialize(), this.ownCell(), { ghost, flash: g.flash / 600, dim: this.state === 'stopped' || this.state === 'ended' });
    $('own-score').textContent = g.score;
    $('own-lines').textContent = g.lines;
    $('own-level').textContent = g.level;
    if ($('own-next').dataset.t !== g.nextType) {
      $('own-next').dataset.t = g.nextType;
      drawPreview($('own-next'), g.nextType, 22);
    }
  },

  renderOthers() {
    if (this.state === 'countdown') {
      $('game-timer').textContent = fmtTime(this.duration * 1000);
      $('game-timer').classList.remove('low');
    } else setTimer(this.remaining);
    // Eigenes Feld ist groß links zu sehen; rechts alle anderen
    const others = this.game ? this.players.filter(p => p.id !== this.myId) : this.players;
    boardsView.render(others, { myId: this.myId });
  },

  // --- Tastatur ---
  keyDown(e) {
    if (this.state !== 'playing' || !this.game) return;
    const g = this.game;
    const k = e.key;
    let handled = true;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { if (!e.repeat) { g.move(-1); this.keys.dir = -1; this.keys.das = 170; } }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { if (!e.repeat) { g.move(1); this.keys.dir = 1; this.keys.das = 170; } }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { if (!e.repeat) { g.softDrop(); this.keys.down = true; this.keys.downAcc = 0; } }
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'x' || k === 'X') { if (!e.repeat) g.rotate(1); }
    else if (k === 'y' || k === 'Y' || k === 'z' || k === 'Z' || k === 'Control') { if (!e.repeat) g.rotate(-1); }
    else if (k === ' ') { if (!e.repeat) g.hardDrop(); }
    else handled = false;
    if (handled) e.preventDefault();
  },

  keyUp(e) {
    const k = e.key;
    if ((k === 'ArrowLeft' || k === 'a' || k === 'A') && this.keys.dir === -1) this.keys.dir = 0;
    if ((k === 'ArrowRight' || k === 'd' || k === 'D') && this.keys.dir === 1) this.keys.dir = 0;
    if (k === 'ArrowDown' || k === 's' || k === 'S') this.keys.down = false;
  },

  handleHeld(dt) {
    const g = this.game, k = this.keys;
    if (k.dir) {
      k.das -= dt;
      let n = 0;
      while (k.das <= 0 && n++ < 10) { g.move(k.dir); k.das += 45; }
    }
    if (k.down) {
      k.downAcc += dt;
      while (k.downAcc >= 40) { k.downAcc -= 40; if (!g.softDrop()) break; }
    }
  },
};

// ---------------------------------------------------------------- Start
(function init() {
  const code = (params.get('code') || '').replace(/\D/g, '').slice(0, 4);
  if (code) { $('join-code').value = code; $('join-name').focus(); }
  else $('join-code').focus();
  try { const n = localStorage.getItem('kt-name'); if (n) $('join-name').value = n; } catch (e) {}

  $('join-form').addEventListener('submit', e => {
    e.preventDefault();
    const c = $('join-code').value.replace(/\D/g, '');
    const n = cleanName($('join-name').value);
    if (c.length !== 4) { $('join-error').textContent = 'Der Code hat 4 Ziffern.'; $('join-error').hidden = false; return; }
    if (!n) { $('join-error').textContent = 'Bitte gib deinen Namen ein.'; $('join-error').hidden = false; return; }
    try { localStorage.setItem('kt-name', n); } catch (err) {}
    client.start(c, n);
  });
  $('host-btn').addEventListener('click', () => host.start());
  $('wait-home').addEventListener('click', () => { location.href = joinUrl() + '?code=' + client.code; });
  window.addEventListener('keydown', e => client.keyDown(e));
  window.addEventListener('keyup', e => client.keyUp(e));
  window.addEventListener('resize', () => { if (client.game) client.renderOthers(); });
})();

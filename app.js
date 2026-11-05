// Klassen-Tetris – Netzwerk und Oberfläche
// Der Browser der Lehrkraft ist der "Host". Schüler verbinden sich per WebRTC (PeerJS) direkt mit ihm.
// Spielt die Lehrkraft mit, läuft ihr Spiel als lokaler Client über eine interne Verbindung (loopback).
'use strict';

const PREFIX = 'klassentetris-v1-';
const MAX_PLAYERS = 8;          // Schüler; die Lehrkraft kommt ggf. dazu
const COUNTDOWN = 3;
const MODES = {
  classic: { name: 'Klassisch', info: 'Jeder spielt für sich auf Zeit. Wer oben anstößt, bekommt ein leeres Feld. Die meisten Punkte gewinnen.' },
  battle: { name: 'Angriff', info: 'Wer 2 oder mehr Reihen auf einmal löscht, schickt Müllreihen an einen anderen Spieler. Wer oben anstößt, ist raus. Wer zuletzt übrig bleibt, gewinnt.' },
};
const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
let IS_HOST = false;

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

function modeName(m) { return (MODES[m] || MODES.classic).name; }

// Interne Verbindung zwischen Host und dem Spiel der Lehrkraft im selben Browser
function loopback() {
  const a = { open: true, handlers: {} }, b = { open: true, handlers: {} };
  const wire = (self, other) => {
    self.on = (ev, fn) => { (self.handlers[ev] = self.handlers[ev] || []).push(fn); };
    self.send = msg => {
      if (!self.open) return;
      const copy = JSON.parse(JSON.stringify(msg));
      setTimeout(() => { if (other.open) (other.handlers.data || []).forEach(f => f(copy)); }, 0);
    };
    self.close = () => {
      if (!self.open) return;
      self.open = other.open = false;
      for (const c of [self, other]) (c.handlers.close || []).forEach(f => f());
    };
  };
  wire(a, b); wire(b, a);
  return [a, b];
}

// ---------------------------------------------------------------- Spielfeld-Übersicht
const boardsView = {
  items: new Map(),
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
    const ranks = rankMap(players, opts.mode);
    for (const p of players) {
      const it = this.items.get(p.id);
      const me = p.id === opts.myId;
      it.el.classList.toggle('me', me);
      it.wrap.classList.toggle('me', me);
      it.el.classList.toggle('off', !p.connected || !!p.over);
      it.el.style.width = (10 * cell + 4) + 'px';
      it.name.textContent = p.name + (p.connected ? '' : ' (weg)');
      let info = p.score + ' Pkt · ' + p.lines + ' R';
      if (p.playing) info = (p.over ? 'raus · ' : '#' + ranks.get(p.id) + ' · ') + info;
      it.score.textContent = info;
      drawBoard(it.canvas, p.board, cell, { dim: !p.playing || !!p.over });
    }
  },
  cellSize(n, box) {
    if (!n) return 10;
    const W = box.clientWidth, H = box.clientHeight;
    for (let c = 30; c > 5; c--) {
      const bw = 10 * c + 4 + 16, bh = 20 * c + 4 + 52 + 16;
      const perRow = Math.max(1, Math.floor((W + 16) / bw));
      const rows = Math.ceil(n / perRow);
      if (rows * bh <= H) return c;
    }
    return 6;
  },
};

// Reihenfolge: im Modus Angriff zuerst wer noch drin ist, dann wer später ausgeschieden ist
function sortPlayers(list, mode) {
  return list.slice().sort((a, b) => {
    if (mode === 'battle') {
      if (!!a.over !== !!b.over) return a.over ? 1 : -1;
      if (a.over && b.over && a.outAt !== b.outAt) return (b.outAt || 0) - (a.outAt || 0);
    }
    return b.score - a.score;
  });
}

function rankMap(players, mode) {
  const m = new Map();
  sortPlayers(players.filter(p => p.playing), mode).forEach((p, i) => m.set(p.id, i + 1));
  return m;
}

function showResults(ranking, myId, mode) {
  $('results').querySelector('h2').textContent = 'Ergebnis · ' + modeName(mode);
  const ol = $('results-list');
  ol.textContent = '';
  for (const r of ranking) {
    const li = document.createElement('li');
    if (r.id === myId) li.className = 'me';
    const pts = document.createElement('span');
    pts.className = 'pts';
    pts.textContent = (mode === 'battle' && r.over ? 'raus · ' : '') + r.score + ' Pkt · ' + r.lines + ' Reihen';
    li.append(document.createTextNode(r.name), pts);
    ol.appendChild(li);
  }
  if (!ranking.length) {
    const li = document.createElement('li'); li.textContent = 'Niemand hat gespielt.'; ol.appendChild(li);
  }
  $('host-again').hidden = !IS_HOST;
  $('results-wait').hidden = IS_HOST;
  $('results').hidden = false;
}

function setTimer(ms) {
  const t = $('game-timer');
  t.textContent = fmtTime(ms);
  t.classList.toggle('low', ms <= 10000);
}

// ---------------------------------------------------------------- Lehrkraft (Host)
const host = {
  peer: null, code: '', phase: 'lobby', players: [], nextId: 1, mode: 'classic',
  duration: 180, seed: 0, startAt: 0, endAt: 0, loop: null, localConn: null,

  start() {
    IS_HOST = true;
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
      if (this.players.some(p => !p.local)) { e.preventDefault(); e.returnValue = ''; }
    });
    $('host-start').onclick = () => this.startRound();
    $('host-again').onclick = () => this.backToLobby();
    $('host-mode').onchange = () => { this.mode = $('host-mode').value; this.updateModeInfo(); this.broadcastLobby(); };
    $('host-play').onchange = () => this.setLocalPlayer();
    $('host-name').onchange = () => { if ($('host-play').checked) { this.removeLocal(); this.setLocalPlayer(); } };
    try { const n = localStorage.getItem('kt-host-name'); if (n) $('host-name').value = n; } catch (e) {}
    window.addEventListener('resize', () => { if (this.phase !== 'lobby') this.renderGame(); });
    this.updateModeInfo();
    show('host-lobby');
    this.renderLobby();
  },

  updateModeInfo() {
    this.mode = $('host-mode').value;
    $('host-mode-info').textContent = MODES[this.mode].info;
  },

  setLocalPlayer() {
    if (!$('host-play').checked) { this.removeLocal(); return; }
    if (this.localConn) return;
    const name = cleanName($('host-name').value) || 'Lehrkraft';
    $('host-name').value = name;
    try { localStorage.setItem('kt-host-name', name); } catch (e) {}
    const [clientSide, hostSide] = loopback();
    this.localConn = clientSide;
    client.startLocal(name, clientSide);
    this.onConnection(hostSide, true);
  },

  removeLocal() {
    if (!this.localConn) return;
    const c = this.localConn;
    this.localConn = null;
    c.close();
  },

  localPlaying() { return this.players.some(p => p.local && p.playing); },

  onConnection(conn, local = false) {
    let player = null;
    conn.on('data', msg => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'join' && !player) {
        player = this.join(conn, msg.name, local);
        return;
      }
      if (!player || player.conn !== conn) return;
      if (msg.t === 'state' || msg.t === 'final') this.onState(player, msg);
      else if (msg.t === 'attack') this.onAttack(player, Number(msg.n) || 0);
    });
    conn.on('close', () => {
      if (!player || player.conn !== conn) return;
      player.connected = false;
      if (this.phase === 'lobby') this.players = this.players.filter(p => p !== player);
      this.renderLobby();
      this.broadcastLobby();
    });
  },

  onState(p, msg) {
    if (this.phase !== 'playing' && this.phase !== 'stopping') return;
    if (!p.playing) return;
    if (typeof msg.board === 'string' && msg.board.length === 200) p.board = msg.board;
    p.score = Number(msg.score) || 0;
    p.lines = Number(msg.lines) || 0;
    if (msg.over && !p.over && this.mode === 'battle') { p.over = true; p.outAt = Date.now(); }
  },

  onAttack(from, n) {
    if (this.mode !== 'battle' || this.phase !== 'playing' || n <= 0 || from.over) return;
    const targets = this.players.filter(p => p !== from && p.playing && p.connected && !p.over);
    if (!targets.length) return;
    const t = targets[Math.floor(Math.random() * targets.length)];
    this.send(t, { t: 'garbage', n: Math.min(n, 4), from: from.name });
  },

  join(conn, rawName, local) {
    const name = cleanName(rawName);
    if (!name) { conn.send({ t: 'reject', reason: 'Bitte gib einen Namen ein.' }); return null; }
    let p = this.players.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (p && p.connected) {
      conn.send({ t: 'reject', reason: 'Der Name „' + name + '“ ist schon vergeben.' });
      return null;
    }
    if (p && !p.local && !local) {
      // Wiederverbinden (z. B. nach Neuladen): spielt ab der nächsten Runde wieder mit
      p.conn = conn; p.connected = true;
    } else {
      if (!local && this.players.filter(x => !x.local && x.connected).length >= MAX_PLAYERS) {
        conn.send({ t: 'reject', reason: 'Der Raum ist voll (maximal ' + MAX_PLAYERS + ' Spieler).' });
        return null;
      }
      p = { id: this.nextId++, name, conn, local, connected: true, playing: false, over: false, outAt: 0, board: null, score: 0, lines: 0 };
      if (local) this.players.unshift(p); else this.players.push(p);
    }
    conn.send({ t: 'welcome', id: p.id, code: this.code, phase: this.phase, mode: this.mode });
    this.renderLobby();
    this.broadcastLobby();
    return p;
  },

  send(p, msg) { if (p.connected && p.conn.open) { try { p.conn.send(msg); } catch (e) {} } },
  broadcast(msg) { for (const p of this.players) this.send(p, msg); },

  broadcastLobby() {
    if (this.phase !== 'lobby') return;
    this.broadcast({ t: 'lobby', mode: this.mode, players: this.players.filter(p => p.connected).map(p => ({ id: p.id, name: p.name, local: p.local })) });
  },

  renderLobby() {
    if (this.phase !== 'lobby') return;
    const ul = $('host-players');
    ul.textContent = '';
    const list = this.players.filter(p => p.connected);
    for (const p of list) {
      const li = document.createElement('li');
      li.textContent = p.name;
      if (p.local) {
        const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = '(Lehrkraft)';
        li.appendChild(tag);
      }
      ul.appendChild(li);
    }
    $('host-count').textContent = list.filter(p => !p.local).length;
    $('host-start').disabled = list.length === 0;
  },

  startRound() {
    this.duration = Number($('host-duration').value) || 180;
    this.mode = $('host-mode').value;
    this.seed = Math.floor(Math.random() * 2 ** 31);
    this.phase = 'countdown';
    for (const p of this.players) {
      p.playing = p.connected; p.over = false; p.outAt = 0; p.board = null; p.score = 0; p.lines = 0;
    }
    this.startAt = Date.now() + COUNTDOWN * 1000;
    this.endAt = this.startAt + this.duration * 1000;
    $('game-title').textContent = 'Klassen-Tetris · ' + modeName(this.mode);
    this.broadcast({ t: 'start', seed: this.seed, duration: this.duration, countdown: COUNTDOWN, mode: this.mode });
    $('results').hidden = true;
    $('own-panel').hidden = !this.localPlaying();
    show('game');
    clearInterval(this.loop);
    this.loop = setInterval(() => this.tick(), 150);
    this.tick();
  },

  battleDecided() {
    if (this.mode !== 'battle') return false;
    const playing = this.players.filter(p => p.playing);
    const alive = playing.filter(p => p.connected && !p.over);
    return playing.length >= 2 ? alive.length <= 1 : alive.length === 0;
  },

  tick() {
    const now = Date.now();
    if (this.phase === 'countdown' && now >= this.startAt) {
      this.phase = 'playing';
      this.broadcast({ t: 'go' });
    }
    if (this.phase === 'playing' && (now >= this.endAt || this.battleDecided())) {
      this.phase = 'stopping';
      this.broadcast({ t: 'stop' });
      // kurz auf die letzten Spielstände warten
      setTimeout(() => this.finish(), 800);
    }
    const remaining = this.phase === 'countdown' ? this.startAt - now + this.duration * 1000 : Math.max(0, this.endAt - now);
    this.broadcast({ t: 'states', phase: this.phase, mode: this.mode, remaining, duration: this.duration, players: this.publicPlayers() });
    this.renderGame(remaining);
  },

  publicPlayers() {
    return this.players.map(p => ({
      id: p.id, name: p.name, board: p.board, score: p.score, lines: p.lines,
      connected: p.connected, playing: p.playing, over: p.over, outAt: p.outAt,
    }));
  },

  renderGame(remaining) {
    if (this.localPlaying()) return; // dann zeichnet das eigene Spiel der Lehrkraft die Ansicht
    if (remaining !== undefined) {
      if (this.phase === 'countdown') {
        $('game-timer').textContent = 'Start in ' + Math.ceil((this.startAt - Date.now()) / 1000);
        $('game-timer').classList.remove('low');
      } else setTimer(remaining);
    }
    boardsView.render(this.publicPlayers(), { myId: null, mode: this.mode });
  },

  finish() {
    this.phase = 'ended';
    clearInterval(this.loop);
    const ranking = sortPlayers(this.players.filter(p => p.playing), this.mode)
      .map(p => ({ id: p.id, name: p.name, score: p.score, lines: p.lines, over: p.over }));
    this.broadcast({ t: 'end', ranking, mode: this.mode });
    if (!this.localPlaying()) {
      setTimer(0);
      boardsView.render(this.publicPlayers(), { myId: null, mode: this.mode });
      showResults(ranking, null, this.mode);
    }
  },

  backToLobby() {
    this.phase = 'lobby';
    this.players = this.players.filter(p => p.connected);
    for (const p of this.players) { p.playing = false; p.over = false; p.board = null; p.score = 0; p.lines = 0; }
    $('results').hidden = true;
    show('host-lobby');
    this.renderLobby();
    this.broadcastLobby();
  },
};

// ---------------------------------------------------------------- Spieler (Schüler oder Lehrkraft)
const client = {
  peer: null, conn: null, myId: null, name: '', code: '', local: false, mode: 'classic',
  game: null, state: 'connecting', // connecting | lobby | countdown | playing | out | stopped | ended | spectating
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

  // Spiel der Lehrkraft im selben Browser wie der Host
  startLocal(name, conn) {
    this.local = true; this.name = name; this.conn = conn; this.state = 'connecting';
    this.game = null; this.myId = null;
    conn.on('data', msg => this.onMessage(msg));
    conn.on('close', () => {
      this.state = 'connecting'; this.game = null; this.myId = null;
      cancelAnimationFrame(this.raf);
    });
    conn.send({ t: 'join', name });
  },

  fail(text) {
    clearTimeout(this.joinTimer);
    if (this.local) { alert(text); $('host-play').checked = false; host.removeLocal(); return; }
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
        this.mode = msg.mode || 'classic';
        $('own-name').textContent = this.name;
        if (this.local) { this.state = 'lobby'; break; }
        $('game-code').textContent = 'Code ' + this.code;
        if (msg.phase === 'lobby') this.toLobby([]);
        else { this.state = 'spectating'; this.wait('Du bist drin!', 'Gerade läuft eine Runde. Du spielst ab der nächsten Runde mit.'); }
        break;
      case 'lobby':
        this.mode = msg.mode || 'classic';
        this.toLobby(msg.players || []);
        break;
      case 'start':
        this.startGame(msg.seed, msg.duration, msg.mode);
        break;
      case 'go':
        if (this.state === 'countdown') { this.state = 'playing'; $('own-overlay').hidden = true; }
        break;
      case 'garbage':
        if (this.game && this.state === 'playing') this.game.addGarbage(Number(msg.n) || 0);
        break;
      case 'stop':
        if (this.game) { if (this.state !== 'out') this.state = 'stopped'; this.sendState('final'); }
        break;
      case 'states':
        this.players = msg.players || [];
        this.remaining = msg.remaining;
        this.duration = msg.duration;
        if (this.state === 'spectating' && $('screen-game').hidden) {
          $('game-title').textContent = 'Klassen-Tetris · ' + modeName(msg.mode);
          $('own-panel').hidden = true;
          show('game');
        }
        if (this.game || this.state === 'spectating') this.renderOthers();
        break;
      case 'end':
        this.state = 'ended';
        cancelAnimationFrame(this.raf);
        if (this.game) this.renderOwn();
        showResults(msg.ranking || [], this.myId, msg.mode);
        break;
    }
  },

  toLobby(players) {
    this.state = 'lobby';
    this.game = null;
    cancelAnimationFrame(this.raf);
    if (this.local) return; // die Lehrkraft sieht ihre eigene Lobby
    $('results').hidden = true;
    show('wait');
    this.wait('Du bist drin, ' + this.name + '!', 'Spielmodus: ' + modeName(this.mode) + '. Warte, bis die Lehrkraft das Spiel startet.');
    const ul = $('wait-players');
    ul.textContent = '';
    for (const p of players) {
      const li = document.createElement('li');
      li.textContent = p.name + (p.local ? ' (Lehrkraft)' : '');
      if (p.id === this.myId) li.className = 'me';
      ul.appendChild(li);
    }
  },

  startGame(seed, duration, mode) {
    this.duration = duration;
    this.mode = mode || 'classic';
    this.remaining = duration * 1000 + COUNTDOWN * 1000;
    this.game = new TetrisGame(seed, this.mode);
    this.game.onAttack = n => { if (this.conn && this.conn.open) this.conn.send({ t: 'attack', n }); };
    this.state = 'countdown';
    this.sentVersion = -1; this.sentScore = -1;
    this.keys = { dir: 0, das: 0, down: false, downAcc: 0 };
    $('game-title').textContent = 'Klassen-Tetris · ' + modeName(this.mode);
    $('own-garbage-row').hidden = this.mode !== 'battle';
    $('results').hidden = true;
    $('own-panel').hidden = false;
    show('game');
    $('own-overlay').hidden = false;
    $('own-overlay').classList.remove('out');
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
      if (g.over) {
        this.state = 'out';
        this.sendState('state');
        const ov = $('own-overlay');
        ov.textContent = 'Raus!';
        ov.classList.add('out');
        ov.hidden = false;
      } else if (t - this.lastSent > 100 && (g.version !== this.sentVersion || g.score !== this.sentScore)) {
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
      this.conn.send({ t: type, board: g.serialize(), score: g.score, lines: g.lines, level: g.level, over: g.over });
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
    const dim = this.state === 'stopped' || this.state === 'ended' || this.state === 'out';
    drawBoard($('own-canvas'), g.serialize(), this.ownCell(), { ghost, flash: g.flash / 600, dim });
    $('own-score').textContent = g.score;
    $('own-lines').textContent = g.lines;
    $('own-level').textContent = g.level;
    $('own-garbage').textContent = g.pendingGarbage;
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
    boardsView.render(others, { myId: this.myId, mode: this.mode });
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
  window.addEventListener('keydown', e => {
    // Während des Spiels sollen Pfeiltasten keine Auswahlfelder der Lobby verändern
    if (client.state === 'playing' && document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    client.keyDown(e);
  });
  window.addEventListener('keyup', e => client.keyUp(e));
  window.addEventListener('resize', () => { if (client.game) client.renderOthers(); });
})();

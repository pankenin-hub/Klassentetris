// Physik-Team – Netzwerk, Lobby und Ablauf
// Der Browser der Lehrkraft ist der "Host" und rechnet die Physik. Die iPads verbinden sich per WebRTC (PeerJS)
// direkt mit ihm, schicken nur ihre Eingaben und bekommen etwa 20-mal pro Sekunde den aktuellen Zustand.
'use strict';

const PREFIX = 'physikteam-v1-';
const MAX_PLAYERS = 18;
const INTRO_S = 6;
const TICK_MS = 50;
const SUBSTEPS = 6;
const MODES = [MODE_WIPPE, MODE_LASER, MODE_MISCHEN, MODE_KRAFTWERK];
const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}

function peerOptions() {
  const s = params.get('peerserver'); // nur für Tests: eigener PeerJS-Server
  if (s) { const [host, port] = s.split(':'); return { host, port: Number(port), path: '/', secure: false, debug: 1 }; }
  return { debug: 1 };
}

function show(screen) {
  for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== 'screen-' + screen;
}
function cleanName(n) { return String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14); }
function joinUrl() { return location.origin + location.pathname; }
function modeById(id) { return MODES.find(m => m.id === id); }

function avatarCanvas(color, type, size = 64) {
  const c = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  c.width = c.height = size * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  drawAvatar(g, size / 2, size / 2 + size * 0.1, size * 0.3, color, type, { t: 1 });
  return c;
}

function renderPlayers(el, players, myId) {
  el.textContent = '';
  for (const p of players) {
    const d = document.createElement('div');
    d.className = 'pl' + (p.id === myId ? ' me' : '');
    d.append(avatarCanvas(p.color, p.av, 44));
    d.append(document.createTextNode(p.name));
    el.appendChild(d);
  }
}

// ---------------------------------------------------------------- Ansicht (Lehrkraft und Schüler)
const view = {
  mode: null, setup: null, snap: null, meta: new Map(), myId: null, help: false, ctrl: null,
  vals: new Map(), spins: new Map(), raf: 0, last: 0, t: 0, dt: 0,

  begin(mode, setup) {
    this.mode = mode; this.setup = setup; this.snap = null;
    this.vals.clear(); this.spins.clear();
    this.fit();
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this.raf = requestAnimationFrame(t => this.frame(t));
  },

  stop() { cancelAnimationFrame(this.raf); this.mode = null; },

  setMeta(players) { this.meta = new Map(players.map(p => [p.id, p])); },

  fit() {
    const stage = $('stage'), c = $('canvas');
    const w0 = stage.clientWidth - 12, h0 = stage.clientHeight - 12;
    const sc = Math.max(0.1, Math.min(w0 / WORLD_W, h0 / WORLD_H));
    const w = Math.floor(WORLD_W * sc), h = Math.floor(WORLD_H * sc), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
      c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
    }
    c.style.width = w + 'px'; c.style.height = h + 'px';
    this.scale = sc * dpr;
  },

  frame(t) {
    this.dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    this.t += this.dt;
    if (this.mode && this.snap) {
      this.fit();
      const g = $('canvas').getContext('2d');
      g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      const self = this, ids = new Set(this.setup.ids || []);
      const ctx = {
        meta: this.meta, myId: this.myId, help: this.help, t: this.t,
        local: this.ctrl && this.ctrl.local, sel: this.ctrl && this.ctrl.sel,
        inGame: id => ids.has(id),
        smooth(k, v) {
          let s = self.vals.get(k);
          if (s === undefined || Math.abs(s - v) > 50) s = v;
          else s += (v - s) * Math.min(1, self.dt * 12);
          self.vals.set(k, s);
          return s;
        },
        spin(id, P) { const r = (self.spins.get(id) || 0) + P * self.dt * 0.04; self.spins.set(id, r); return r; },
      };
      try { this.mode.draw(g, this.setup, this.snap, ctx); } catch (e) { console.error(e); }
    }
    if (this.mode) this.raf = requestAnimationFrame(tt => this.frame(tt));
  },

  toWorld(e) {
    const r = $('canvas').getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * WORLD_W, (e.clientY - r.top) / r.height * WORLD_H];
  },
};

function showIntro(mode, li, seconds) {
  const lv = mode.levels[li];
  $('intro-topic').textContent = mode.name + ' · ' + mode.topic;
  $('intro-name').textContent = 'Level ' + (li + 1) + ': ' + lv.name;
  $('intro-task').textContent = lv.task;
  $('intro-count').textContent = seconds > 0 ? String(seconds) : '';
  $('intro').hidden = false;
  $('result').hidden = true;
  $('game-title').textContent = mode.name + ' · Level ' + (li + 1) + ': ' + lv.name;
}

function showResult(res, isHost, hasNext) {
  const box = $('result');
  box.classList.toggle('win', !!res.win);
  box.classList.toggle('fail', !res.win);
  $('result-title').textContent = res.win ? 'Geschafft!' : 'Leider nicht …';
  $('result-text').textContent = res.text || '';
  $('result-host').hidden = !isHost;
  $('result-wait').hidden = isHost;
  $('btn-next').hidden = !hasNext;
  $('intro').hidden = true;
  box.hidden = false;
}

// ---------------------------------------------------------------- Lehrkraft (Host)
const host = {
  peer: null, code: '', phase: 'lobby', players: [], nextId: 1,
  modeIdx: 0, li: 0, st: null, setup: null, introEnd: 0, loop: 0, lastTick: 0, result: null,

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
      if (!$('screen-home').hidden) {
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
      $('host-qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0 });
    } catch (e) { $('host-qr').hidden = true; }
    $('game-code').textContent = 'Code ' + this.code;
    $('host-tools').hidden = false;
    this.buildModeCards();
    window.addEventListener('beforeunload', e => { if (this.players.length) { e.preventDefault(); e.returnValue = ''; } });
    $('host-start').onclick = () => this.startLevel(this.modeIdx, Number($('host-level').value) || 0);
    $('btn-restart').onclick = () => this.startLevel(this.modeIdx, this.li);
    $('btn-again').onclick = () => this.startLevel(this.modeIdx, this.li);
    $('btn-next').onclick = () => this.startLevel(this.modeIdx, this.li + 1);
    $('btn-menu').onclick = $('btn-menu2').onclick = () => this.backToLobby();
    $('help-toggle').onchange = () => { view.help = $('help-toggle').checked; this.broadcast({ t: 'help', on: view.help }); };
    view.myId = null;
    show('host-lobby');
    this.renderLobby();
  },

  buildModeCards() {
    const box = $('mode-cards');
    box.textContent = '';
    MODES.forEach((m, i) => {
      const b = document.createElement('button');
      b.className = 'mode-card';
      b.style.setProperty('--glow', m.color);
      b.innerHTML = '<b></b><span></span>';
      b.querySelector('b').textContent = m.name;
      b.querySelector('span').textContent = m.topic + ' · ' + m.levels.length + ' Level';
      b.onclick = () => this.selectMode(i);
      box.appendChild(b);
    });
    this.selectMode(this.modeIdx);
  },

  selectMode(i, li = 0) {
    this.modeIdx = i;
    [...$('mode-cards').children].forEach((b, k) => b.classList.toggle('sel', k === i));
    const sel = $('host-level');
    sel.textContent = '';
    MODES[i].levels.forEach((lv, k) => {
      const o = document.createElement('option');
      o.value = k; o.textContent = (k + 1) + '. ' + lv.name;
      sel.appendChild(o);
    });
    sel.value = li;
  },

  onConnection(conn) {
    let player = null;
    conn.on('data', msg => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'join' && !player) player = this.join(conn, msg);
      else if (player && player.conn === conn && msg.t === 'in') {
        if (this.phase === 'play' && this.st && this.setup.ids.includes(player.id)) {
          try { MODES[this.modeIdx].input(this.st, player.id, msg); } catch (e) { console.warn(e); }
        }
      }
    });
    conn.on('close', () => {
      if (!player || player.conn !== conn) return;
      player.connected = false;
      if (this.st && MODES[this.modeIdx].leave) MODES[this.modeIdx].leave(this.st, player.id);
      if (this.phase === 'lobby') this.players = this.players.filter(p => p !== player);
      this.renderLobby();
      this.broadcastMeta();
    });
  },

  join(conn, msg) {
    const name = cleanName(msg.name), av = clamp(msg.av | 0, 0, AVATAR_TYPES.length - 1);
    if (!name) { conn.send({ t: 'reject', reason: 'Bitte gib einen Namen ein.' }); return null; }
    let p = this.players.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (p && p.connected) { conn.send({ t: 'reject', reason: 'Der Name „' + name + '“ ist schon vergeben.' }); return null; }
    if (p) { p.conn = conn; p.connected = true; p.av = av; } // Wiederverbinden mit demselben Namen
    else {
      if (this.players.filter(x => x.connected).length >= MAX_PLAYERS) {
        conn.send({ t: 'reject', reason: 'Der Raum ist voll (maximal ' + MAX_PLAYERS + ').' });
        return null;
      }
      const used = new Set(this.players.map(x => x.color));
      const color = PLAYER_COLORS.find(c => !used.has(c)) || PLAYER_COLORS[this.nextId % PLAYER_COLORS.length];
      p = { id: this.nextId++, name, av, color, conn, connected: true };
      this.players.push(p);
    }
    conn.send({ t: 'welcome', id: p.id, code: this.code });
    this.broadcastMeta();
    if (this.phase !== 'lobby') {
      this.send(p, this.startMsg());
      if (this.phase === 'play') this.send(p, { t: 'go' });
      if (this.phase === 'result') this.send(p, Object.assign({ t: 'result' }, this.result));
    } else this.send(p, { t: 'lobby' });
    this.renderLobby();
    return p;
  },

  send(p, msg) { if (p.connected && p.conn && p.conn.open) { try { p.conn.send(msg); } catch (e) {} } },
  broadcast(msg) { for (const p of this.players) this.send(p, msg); },

  publicPlayers() { return this.players.map(p => ({ id: p.id, name: p.name, av: p.av, color: p.color, connected: p.connected })); },

  broadcastMeta() {
    const list = this.publicPlayers();
    view.setMeta(list);
    this.broadcast({ t: 'meta', players: list });
  },

  renderLobby() {
    if (this.phase !== 'lobby') return;
    const list = this.players.filter(p => p.connected);
    renderPlayers($('host-players'), list, null);
    $('host-count').textContent = list.length;
    $('host-start').disabled = list.length === 0;
  },

  startMsg() {
    const m = MODES[this.modeIdx];
    const left = Math.max(0, Math.ceil((this.introEnd - Date.now()) / 1000));
    return { t: 'start', mode: m.id, li: this.li, setup: this.setup, intro: this.phase === 'intro' ? left : 0, help: view.help };
  },

  startLevel(modeIdx, li) {
    const m = MODES[modeIdx];
    if (li >= m.levels.length) { this.backToLobby(); return; }
    const playing = this.players.filter(p => p.connected);
    if (!playing.length) { this.backToLobby(); return; }
    this.modeIdx = modeIdx; this.li = li;
    this.st = m.init(li, playing.map(p => ({ id: p.id })), Math.floor(Math.random() * 1e9));
    this.setup = m.setup(this.st);
    this.setup.ids = playing.map(p => p.id);
    this.phase = 'intro';
    this.result = null;
    this.introEnd = Date.now() + INTRO_S * 1000;
    this.broadcastMeta();
    this.broadcast(this.startMsg());
    show('game');
    $('controls').hidden = true;
    view.begin(m, this.setup);
    view.snap = m.snap(this.st);
    showIntro(m, li, INTRO_S);
    clearInterval(this.loop);
    this.lastTick = performance.now();
    this.loop = setInterval(() => this.tick(), TICK_MS);
  },

  tick() {
    const m = MODES[this.modeIdx], now = performance.now();
    const dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (this.phase === 'intro') {
      const left = Math.ceil((this.introEnd - Date.now()) / 1000);
      $('intro-count').textContent = left > 0 ? String(left) : 'Los!';
      if (left <= 0) { this.phase = 'play'; $('intro').hidden = true; this.broadcast({ t: 'go' }); }
    } else if (this.phase === 'play') {
      let res = null;
      for (let i = 0; i < SUBSTEPS && !res; i++) res = m.step(this.st, dt / SUBSTEPS);
      if (res) this.finish(res);
    }
    if (this.phase === 'lobby') return;
    view.snap = m.snap(this.st);
    this.broadcast({ t: 's', s: view.snap });
  },

  finish(res) {
    this.phase = 'result';
    this.result = { win: !!res.win, text: res.text || '', next: this.li + 1 < MODES[this.modeIdx].levels.length };
    this.broadcast(Object.assign({ t: 'result' }, this.result));
    showResult(this.result, true, this.result.next && res.win);
    if (!res.win) $('btn-next').hidden = !this.result.next;
  },

  backToLobby() {
    clearInterval(this.loop);
    view.stop();
    this.phase = 'lobby';
    this.st = null;
    this.players = this.players.filter(p => p.connected);
    this.broadcastMeta();
    this.broadcast({ t: 'lobby' });
    $('intro').hidden = true; $('result').hidden = true;
    this.selectMode(this.modeIdx, Math.min(this.li + (this.result && this.result.win ? 1 : 0), MODES[this.modeIdx].levels.length - 1));
    show('host-lobby');
    this.renderLobby();
  },
};

// ---------------------------------------------------------------- Schüler (iPad)
const client = {
  peer: null, conn: null, myId: null, name: '', av: 0, code: '', state: 'connecting',
  mode: null, ctrl: null, joinTimer: 0, players: [], bot: 0,

  start(code, name, av) {
    this.code = code; this.name = name; this.av = av;
    $('join-error').hidden = true;
    show('wait');
    this.wait('Verbinde mit Raum ' + code + ' …', '');
    const peer = new Peer(peerOptions());
    this.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true });
      this.conn = conn;
      conn.on('open', () => conn.send({ t: 'join', name, av }));
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
    this.joinTimer = setTimeout(() => { if (this.state === 'connecting') this.fail('Keine Verbindung zum Raum. Bitte noch einmal versuchen.'); }, 15000);
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
    this.dropControls();
    view.stop();
    show('wait');
    this.wait('Verbindung verloren', 'Die Verbindung zum Raum ist abgebrochen. Lade die Seite neu und tritt mit demselben Namen wieder bei.');
    $('wait-players').textContent = '';
    $('wait-home').hidden = false;
  },

  wait(title, text) { $('wait-title').textContent = title; $('wait-text').textContent = text; },

  send(msg) {
    if (!this.conn || !this.conn.open) return;
    try { this.conn.send(Object.assign({ t: 'in' }, msg)); } catch (e) {}
  },

  onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'reject': this.fail(msg.reason || 'Beitritt abgelehnt.'); break;
      case 'welcome':
        clearTimeout(this.joinTimer);
        this.myId = view.myId = msg.id;
        this.state = 'lobby';
        $('game-code').textContent = this.name + ' · Code ' + this.code;
        break;
      case 'meta':
        this.players = msg.players || [];
        view.setMeta(this.players);
        if (this.state === 'lobby') this.toLobby();
        break;
      case 'lobby': this.toLobby(); break;
      case 'start': this.startLevel(msg); break;
      case 'go':
        $('intro').hidden = true;
        this.state = 'play';
        break;
      case 's':
        if (!view.mode) break;
        view.snap = msg.s;
        if (this.ctrl && this.ctrl.update) this.ctrl.update(msg.s);
        break;
      case 'help': view.help = !!msg.on; break;
      case 'result':
        this.state = 'result';
        this.dropControls();
        showResult(msg, false, false);
        break;
    }
  },

  toLobby() {
    this.state = 'lobby';
    this.dropControls();
    view.stop();
    $('intro').hidden = true; $('result').hidden = true;
    show('wait');
    const me = this.players.find(p => p.id === this.myId);
    this.wait('Du bist drin, ' + this.name + '!', 'Warte, bis die Lehrkraft das Spiel startet.');
    const c = $('wait-avatar'), g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    if (me) drawAvatar(g, 80, 88, 46, me.color, me.av, { t: 1 });
    renderPlayers($('wait-players'), this.players.filter(p => p.connected), this.myId);
  },

  dropControls() {
    if (this.ctrl && this.ctrl.destroy) this.ctrl.destroy();
    this.ctrl = view.ctrl = null;
    clearInterval(this.bot);
    $('controls').hidden = true;
    $('controls').textContent = '';
  },

  startLevel(msg) {
    const m = modeById(msg.mode);
    if (!m) return;
    this.dropControls();
    this.mode = m;
    view.help = !!msg.help;
    show('game');
    const el = $('controls');
    el.hidden = false;
    const inGame = (msg.setup.ids || []).includes(this.myId);
    if (inGame) {
      this.ctrl = view.ctrl = m.controls(el, msg.setup, { myId: this.myId, send: x => this.send(x) });
      if (params.has('bot')) this.startBot(m, msg.setup);
    } else {
      el.innerHTML = '<div class="ctl-info">Dieses Level läuft schon. Ab dem nächsten Level bist du dabei!</div>';
    }
    view.begin(m, msg.setup);
    this.state = msg.intro > 0 ? 'intro' : 'play';
    if (msg.intro > 0) {
      showIntro(m, msg.li, msg.intro);
      let left = msg.intro;
      const iv = setInterval(() => {
        left--;
        if (this.state !== 'intro' || left < 0) { clearInterval(iv); return; }
        $('intro-count').textContent = left > 0 ? String(left) : 'Los!';
      }, 1000);
    } else {
      showIntro(m, msg.li, 0);
      $('intro').hidden = true;
    }
  },

  // nur für Tests (?bot=1): spielt zufällig mit
  startBot(m, setup) {
    let on = false;
    this.bot = setInterval(() => {
      if (this.state !== 'play') return;
      const r = Math.random();
      if (m.id === 'wippe') { if (r < 0.3) this.send({ x: setup.xmin + Math.random() * (setup.xmax - setup.xmin) }); }
      else if (m.id === 'laser') {
        const c = this.ctrl, k = c.sel;
        if (k >= 0 && r < 0.3) { const o = c.local[k]; o.x = 100 + Math.random() * 1400; o.y = 100 + Math.random() * 650; o.a = Math.random() * 180; this.send({ k, x: o.x, y: o.y, a: o.a }); }
      } else if (m.id === 'mischen') { if (r < 0.2) { on = !on; } this.send({ pour: on }); }
      else if (m.id === 'kraftwerk') this.send({ taps: Math.random() < 0.8 ? 1 : 0 });
    }, 300);
  },
};

// ---------------------------------------------------------------- Start
(function init() {
  const code = (params.get('code') || '').replace(/\D/g, '').slice(0, 4);
  if (code) $('join-code').value = code;
  try { const n = localStorage.getItem('pt-name'); if (n) $('join-name').value = n; } catch (e) {}
  let av = 0;
  try { av = clamp(Number(localStorage.getItem('pt-av')) || 0, 0, AVATAR_TYPES.length - 1); } catch (e) {}
  const pick = $('avatar-pick');
  AVATAR_TYPES.forEach((name, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.append(avatarCanvas(PLAYER_COLORS[i * 2 % PLAYER_COLORS.length], i, 56));
    b.append(document.createTextNode(name));
    b.onclick = () => { av = i; [...pick.children].forEach((x, k) => x.classList.toggle('sel', k === i)); };
    if (i === av) b.classList.add('sel');
    pick.appendChild(b);
  });

  $('join-form').addEventListener('submit', e => {
    e.preventDefault();
    const c = $('join-code').value.replace(/\D/g, '');
    const n = cleanName($('join-name').value);
    if (c.length !== 4) { $('join-error').textContent = 'Der Code hat 4 Ziffern.'; $('join-error').hidden = false; return; }
    if (!n) { $('join-error').textContent = 'Bitte gib deinen Namen ein.'; $('join-error').hidden = false; return; }
    try { localStorage.setItem('pt-name', n); localStorage.setItem('pt-av', av); } catch (err) {}
    if (document.activeElement) document.activeElement.blur();
    client.start(c, n, av);
  });
  $('host-btn').addEventListener('click', () => host.start());
  $('wait-home').addEventListener('click', () => { location.href = joinUrl() + '?code=' + client.code; });

  // Ziehen auf dem Spielbild (für den Laser)
  const canvas = $('canvas');
  const fwd = (type, e) => {
    if (!client.ctrl || !client.ctrl.pointer || client.state !== 'play') return;
    e.preventDefault();
    const [x, y] = view.toWorld(e);
    client.ctrl.pointer(type, x, y);
  };
  canvas.addEventListener('pointerdown', e => { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} fwd('down', e); });
  canvas.addEventListener('pointermove', e => fwd('move', e));
  canvas.addEventListener('pointerup', e => fwd('up', e));
  canvas.addEventListener('pointercancel', e => fwd('up', e));
  // iOS: Doppeltipp-Zoom und Gummiband-Scrollen im Spiel verhindern
  document.addEventListener('touchmove', e => { if (!$('screen-game').hidden) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault());
  window.addEventListener('resize', () => view.fit());
})();

/**
 * ludo-royale/js/app.js
 * -----------------------------------------------------------------------
 * Real-time multiplayer Ludo (2-4 players) on Firebase Realtime Database.
 *
 * Networking, matchmaking and turn-taking are still fully server-validated
 * through Firebase transactions on the whole room object — that part is
 * unchanged in spirit from the rest of the collection. What's new here is
 * the *presentation* layer, rebuilt for a Ludo King-style feel:
 *
 *   • A proper 15x15 cross-shaped board with colored bases, home runways,
 *     safe stars and a crowned centre.
 *   • Glossy 3-D pawn tokens with per-color icons.
 *   • An animated dice (tumbling faces + shake) instead of a static glyph.
 *   • Client-side animation of every state change: tokens *hop* cell to
 *     cell, captured tokens *fly* back to their yard, finishing a token
 *     bursts, and a win rains confetti. Animations are derived by diffing
 *     each incoming Firebase snapshot against the last one, so the server
 *     stays authoritative and all clients stay in sync.
 *   • Procedural sound for the dice rattle, each step, captures and homes.
 *
 * Rule set matches Ludo King:
 *   • Need a 6 to leave the yard.
 *   • Extra turn after a 6, after a capture, and after sending a token home.
 *   • Three 6s in a row forfeits the turn.
 *   • Safe cells (colored starts + stars) can't be captured on.
 *   • Exact roll required to finish a token.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, randInt } from '../../common/utils.js';

const GAME_ID = 'ludo-royale';
const MATCH_WAIT_SECONDS = 10;
const COLORS = ['RED', 'GREEN', 'YELLOW', 'BLUE'];
const CNAME = { RED: 'Red', GREEN: 'Green', YELLOW: 'Yellow', BLUE: 'Blue' };
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

const START_OFFSET = { RED: 0, GREEN: 13, YELLOW: 26, BLUE: 39 };
const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const HEX = {
  RED:    { top: '#ff5a67', bot: '#c0263a', flat: '#ff4757' },
  GREEN:  { top: '#33dd7a', bot: '#1c8a4a', flat: '#2ed573' },
  YELLOW: { top: '#ffcf33', bot: '#d69512', flat: '#ffcf4d' },
  BLUE:   { top: '#4a8dff', bot: '#1b57b0', flat: '#3a7bff' },
};
const ICON = { RED: '♥', GREEN: '♣', YELLOW: '★', BLUE: '◆' };

// ---------------------------------------------------------------------
// Board geometry — a true 15x15 cross board
// ---------------------------------------------------------------------
const N = 15;
const SIZE = 600;
const CELL = SIZE / N;

// 52-cell clockwise main track as [row, col]
const TRACK = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],
  [6,0],
];
const HOME_COL = {
  RED:    Array.from({ length: 6 }, (_, s) => [7, 1 + s]),
  GREEN:  Array.from({ length: 6 }, (_, s) => [1 + s, 7]),
  YELLOW: Array.from({ length: 6 }, (_, s) => [7, 13 - s]),
  BLUE:   Array.from({ length: 6 }, (_, s) => [13 - s, 7]),
};
const YARD = {
  RED:    [[1.9, 1.9], [1.9, 3.6], [3.6, 1.9], [3.6, 3.6]],
  GREEN:  [[1.9, 10.4], [1.9, 12.1], [3.6, 10.4], [3.6, 12.1]],
  YELLOW: [[10.4, 10.4], [10.4, 12.1], [12.1, 10.4], [12.1, 12.1]],
  BLUE:   [[10.4, 1.9], [10.4, 3.6], [12.1, 1.9], [12.1, 3.6]],
};
const HOME_REST = { RED: [7, 6.0], GREEN: [6.0, 7], YELLOW: [7, 8.0], BLUE: [8.0, 7] };

function coordOf(color, pos, tokenIndex) {
  if (pos === 0) { const [r, c] = YARD[color][tokenIndex]; return { r, c }; }
  if (pos >= 1 && pos <= 51) { const abs = (START_OFFSET[color] + pos - 1) % 52; const [r, c] = TRACK[abs]; return { r, c }; }
  if (pos >= 52 && pos <= 57) { const [r, c] = HOME_COL[color][pos - 52]; return { r, c }; }
  if (pos === 58) {
    const [r, c] = HOME_REST[color];
    const off = [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]][tokenIndex] || [0, 0];
    return { r: r + off[0], c: c + off[1] };
  }
  return null;
}
function absTrackCell(color, pos) { return (pos >= 1 && pos <= 51) ? (START_OFFSET[color] + pos - 1) % 52 : -1; }
function px(r, c) { return { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL }; }
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

// ---------------------------------------------------------------------
// Firebase / shell wiring
// ---------------------------------------------------------------------
const db = firebase.database();
const gameRoomsBase = db.ref(`games/${GAME_ID}/rooms`);
const lobbyRef = db.ref(`games/${GAME_ID}/lobby/waitingRoom`);
const shell = new GameShell({ gameTitle: 'Ludo Royale' });
const sounds = new SoundManager();

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const fxCanvas = document.getElementById('fx-canvas');
const fxc = fxCanvas.getContext('2d');
const diceCanvas = document.getElementById('dice-canvas');
const dcx = diceCanvas.getContext('2d');
const diceBtn = document.getElementById('dice-btn');
const statusBar = document.getElementById('status-bar');
const lobbyPanel = document.getElementById('lobby-panel');
const lobbySeatsEl = document.getElementById('lobby-seats');
const lobbyCountEl = document.getElementById('lobby-count');
const lobbyHintEl = document.getElementById('lobby-hint');
const startGameBtn = document.getElementById('start-game-btn');
const gameArea = document.getElementById('game-area');
const seatsRow = document.getElementById('seats-row');
const rollBtn = document.getElementById('roll-btn');
const turnHint = document.getElementById('turn-hint');
const spectatorCount = document.getElementById('spectator-count');
const playAgainBtn = document.getElementById('play-again-btn');

let roomRef = null;
let playersRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastStatus = null;
let lastEventSeq = -1;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
let botActing = false;

// ---------------------------------------------------------------------
// Extra procedural SFX (dice rattle / step / capture textures) — layered
// on top of the shared SoundManager, which owns join/leave/win/lose.
// ---------------------------------------------------------------------
const SFX = (() => {
  let ac = null;
  function ctxA() { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; }
  function on() { return sounds.enabled; }
  function tone(freq, dur, type = 'sine', vol = 0.16, slideTo = null, delay = 0) {
    if (!on()) return;
    const a = ctxA(), t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.13) {
    if (!on()) return;
    const a = ctxA(), n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(); s.buffer = buf;
    const g = a.createGain(); g.gain.value = vol;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400;
    s.connect(f).connect(g).connect(a.destination); s.start();
  }
  return {
    resume() { try { ctxA(); } catch (e) {} },
    // Peppy "pop" when the dice is tapped — bright two-note blip.
    pop() { tone(520, 0.09, 'triangle', 0.22, 920); tone(780, 0.08, 'sine', 0.16, 1250, 0.05); },
    rattle() { for (let i = 0; i < 5; i++) noise(0.05, 0.09); },
    land() { tone(300, 0.12, 'triangle', 0.16, 180); noise(0.06, 0.11); },
    // Each cell a token hops over — clear little tick.
    step() { tone(720, 0.07, 'square', 0.11, 1040); },
    // Soft "plop" as a token settles on its destination cell.
    plop() { tone(560, 0.12, 'triangle', 0.2, 300); noise(0.05, 0.08); },
    leave() { tone(440, 0.12, 'square', 0.15, 720); },
    capture() { tone(180, 0.22, 'sawtooth', 0.2, 60); noise(0.14, 0.16); },
    home() { [660, 880, 1175].forEach((f, i) => tone(f, 0.14, 'triangle', 0.15, null, i * 0.09)); },
  };
})();

const DICE_PIPS = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
const DSZ = 132;
let diceValueShown = 1;
let diceAnimating = false;

function drawDice(val, tilt = 0, scale = 1) {
  dcx.clearRect(0, 0, DSZ, DSZ);
  dcx.save();
  dcx.translate(DSZ / 2, DSZ / 2); dcx.rotate(tilt); dcx.scale(scale, scale);
  const s = 96, r = 20;
  const g = dcx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  g.addColorStop(0, '#fffdf6'); g.addColorStop(1, '#e4dac2');
  dcx.fillStyle = g; dcx.strokeStyle = 'rgba(0,0,0,.12)'; dcx.lineWidth = 2;
  roundRect(dcx, -s / 2, -s / 2, s, s, r); dcx.fill(); dcx.stroke();
  dcx.fillStyle = 'rgba(255,255,255,.5)';
  roundRect(dcx, -s / 2 + 8, -s / 2 + 8, s - 16, s * 0.34, 14); dcx.fill();
  const q = s * 0.27; dcx.fillStyle = '#3a2b12';
  for (const [ux, uy] of DICE_PIPS[val]) {
    dcx.beginPath(); dcx.arc(ux * q, uy * q, s * 0.085, 0, Math.PI * 2); dcx.fill();
    dcx.save(); dcx.fillStyle = 'rgba(255,255,255,.25)';
    dcx.beginPath(); dcx.arc(ux * q - 2, uy * q - 2, s * 0.03, 0, Math.PI * 2); dcx.fill(); dcx.restore();
  }
  dcx.restore();
}

function animateDice(val) {
  return new Promise((resolve) => {
    diceAnimating = true;
    diceBtn.classList.add('shake');
    SFX.pop();
    SFX.rattle();
    const start = performance.now(), dur = 620;
    function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      if (t < 1) {
        drawDice(1 + Math.floor(Math.random() * 6), Math.sin(t * 30) * (1 - t) * 0.6, 1 + Math.sin(t * 20) * (1 - t) * 0.12);
        requestAnimationFrame(frame);
      } else {
        drawDice(val, 0, 1); diceValueShown = val; SFX.land();
        diceBtn.classList.remove('shake'); diceAnimating = false; resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}
drawDice(1);

// ---------------------------------------------------------------------
// Animation engine — token visual offsets + snapshot diffing
// ---------------------------------------------------------------------
const VIS = {};                         // color -> [{dx,dy,hop,scale}]
let viewTokens = null;                  // last displayed positions
let animQueue = Promise.resolve();      // serialize animations
let animating = false;

function ensureVis(color) { if (!VIS[color]) VIS[color] = [0, 1, 2, 3].map(() => ({ dx: 0, dy: 0, hop: 0, scale: 1 })); }
function cloneTokens(tokens) { const o = {}; for (const c in tokens) o[c] = tokens[c].slice(); return o; }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function animateHopPath(color, i, fromPos, toPos) {
  return new Promise((resolve) => {
    ensureVis(color);
    const v = VIS[color][i];
    const seq = [];
    if (fromPos === 0) seq.push(1);            // leaving the yard: single jump onto start
    else for (let s = fromPos + 1; s <= toPos; s++) seq.push(s);
    let prev = fromPos, idx = 0;
    if (idx === 0 && fromPos === 0) SFX.leave();
    function stepTo() {
      if (idx >= seq.length) { v.dx = 0; v.dy = 0; v.hop = 0; SFX.plop(); resolve(); return; }
      const from = coordOf(color, prev, i);
      const to = coordOf(color, seq[idx], i);
      // The token is rendered at coordOf(fromPos) for the whole hop (viewTokens
      // isn't advanced until the animation resolves), so all offsets must be
      // measured from that same fixed anchor — NOT from each step's destination.
      const base = coordOf(color, fromPos, i);
      const start = performance.now(), dur = fromPos === 0 ? 240 : 140;
      if (!(idx === 0 && fromPos === 0)) SFX.step();
      function frame(now) {
        const t = Math.min(1, (now - start) / dur), e = easeOut(t);
        v.dx = (from.c + (to.c - from.c) * e) - base.c;
        v.dy = (from.r + (to.r - from.r) * e) - base.r;
        v.hop = Math.sin(t * Math.PI) * CELL * 0.5;
        if (t < 1) requestAnimationFrame(frame);
        // Don't zero dx/dy here — the next step continues seamlessly from this
        // cell. Zeroing them mid-hop snaps the token back to fromPos each step.
        else { v.hop = 0; prev = seq[idx]; idx++; stepTo(); }
      }
      requestAnimationFrame(frame);
    }
    stepTo();
  });
}

function animateFlyBack(color, i, fromPos) {
  return new Promise((resolve) => {
    ensureVis(color);
    const v = VIS[color][i];
    const from = coordOf(color, fromPos, i), to = coordOf(color, 0, i);
    const start = performance.now(), dur = 520;
    function frame(now) {
      const t = Math.min(1, (now - start) / dur), e = easeOut(t);
      v.dx = (from.c + (to.c - from.c) * e) - from.c;
      v.dy = (from.r + (to.r - from.r) * e) - from.r;
      v.hop = Math.sin(t * Math.PI) * CELL * 1.6;
      v.scale = 1 + Math.sin(t * Math.PI) * 0.15;
      if (t < 1) requestAnimationFrame(frame);
      else { v.dx = 0; v.dy = 0; v.hop = 0; v.scale = 1; resolve(); }
    }
    requestAnimationFrame(frame);
  });
}

/**
 * Diff the incoming room snapshot's tokens against what we're currently
 * showing, and enqueue the right animations. Runs the acting seat's mover
 * hop first, then any captured tokens flying home, then bursts/confetti.
 */
function syncTokens(room) {
  const target = room.tokens;
  if (!target) { viewTokens = null; return; }
  for (const c of Object.keys(target)) ensureVis(c);

  // First paint or a fresh game (all zeros / different shape): snap instantly.
  if (!viewTokens || room.status !== 'playing') { viewTokens = cloneTokens(target); return; }
  const changed = JSON.stringify(viewTokens) !== JSON.stringify(target);
  if (!changed) return;

  const from = viewTokens;
  viewTokens = cloneTokens(from); // we mutate this incrementally as anims resolve
  const actor = room.event && room.event.seat;

  // Identify mover: a token of the actor whose position advanced.
  let mover = null;
  if (actor && from[actor] && target[actor]) {
    for (let i = 0; i < 4; i++) {
      if (target[actor][i] > from[actor][i]) { mover = { color: actor, i, fromPos: from[actor][i], toPos: target[actor][i] }; break; }
    }
  }
  // Identify captures: any token that went to 0 from a track cell.
  const caps = [];
  for (const c of Object.keys(target)) {
    for (let i = 0; i < 4; i++) {
      const a = from[c] ? from[c][i] : 0, b = target[c][i];
      if (a >= 1 && a <= 51 && b === 0) caps.push({ color: c, i, fromPos: a });
    }
  }

  animating = true;
  animQueue = animQueue.then(async () => {
    if (mover) {
      await animateHopPath(mover.color, mover.i, mover.fromPos, mover.toPos);
      viewTokens[mover.color][mover.i] = mover.toPos;
      if (mover.toPos === 58) {
        const rest = px(...HOME_REST[mover.color]);
        burst(rest.x, rest.y, HEX[mover.color].flat, 22);
      }
    }
    if (caps.length) {
      await Promise.all(caps.map((cap) => {
        const p = px(coordOf(cap.color, cap.fromPos, cap.i).r, coordOf(cap.color, cap.fromPos, cap.i).c);
        burst(p.x, p.y, HEX[cap.color].flat, 16);
        return animateFlyBack(cap.color, cap.i, cap.fromPos);
      }));
      for (const cap of caps) viewTokens[cap.color][cap.i] = 0;
    }
    // Snap anything still out of sync (safety).
    viewTokens = cloneTokens(target);
    animating = false;
  });
}

// ---------------------------------------------------------------------
// FX layer (bursts + confetti)
// ---------------------------------------------------------------------
let particles = [];
function burst(x, y, color, count = 18) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 1, color, size: 2 + Math.random() * 3 });
  }
}
function confetti() {
  const cols = ['#ff5a67', '#33dd7a', '#ffcf33', '#4a8dff', '#ff9c3d', '#ffffff'];
  for (let i = 0; i < 140; i++) {
    particles.push({ x: Math.random() * SIZE, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, life: 1, decay: 0.004, color: cols[i % cols.length], size: 4 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, conf: true });
  }
}
function stepFX() {
  fxc.clearRect(0, 0, SIZE, SIZE);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.conf ? 0.05 : 0.14; p.life -= p.decay || 0.02;
    if (p.rot !== undefined) p.rot += p.vr;
    if (p.life <= 0 || p.y > SIZE + 40) { particles.splice(i, 1); continue; }
    fxc.save(); fxc.globalAlpha = Math.max(0, p.life); fxc.translate(p.x, p.y);
    if (p.rot !== undefined) fxc.rotate(p.rot);
    fxc.fillStyle = p.color;
    if (p.conf) fxc.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
    else { fxc.beginPath(); fxc.arc(0, 0, p.size, 0, Math.PI * 2); fxc.fill(); }
    fxc.restore();
  }
}

// ---------------------------------------------------------------------
// Game rules (server-side, run inside transactions)
// ---------------------------------------------------------------------
function computeMovableTokens(tokens, roll) {
  const movable = [];
  for (let i = 0; i < 4; i++) {
    const pos = tokens[i];
    if (pos === 0) { if (roll === 6) movable.push(i); }
    else if (pos >= 1 && pos <= 57) { if (pos + roll <= 58) movable.push(i); }
  }
  return movable;
}
function advanceTurn(room) {
  const idx = room.turnOrder.indexOf(room.turn);
  room.turn = room.turnOrder[(idx + 1) % room.turnOrder.length];
}
function pushEvent(room, event) {
  room.eventSeq = (room.eventSeq || 0) + 1;
  room.event = { ...event, seq: room.eventSeq };
}

// ---------------------------------------------------------------------
// Room bootstrap / matchmaking (unchanged networking behaviour)
// ---------------------------------------------------------------------
function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human', status: 'waiting', turnOrder: [], turn: null,
    diceValue: null, movableTokens: [], sixStreak: 0, tokens: {},
    winner: null, eventSeq: 0, event: null,
  };
}

async function findOrCreateRoom() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const snap = await lobbyRef.once('value');
    const code = snap.val();
    if (code) {
      const roomSnap = await gameRoomsBase.child(code).once('value');
      const room = roomSnap.val();
      const occupied = room && room.players ? Object.values(room.players).filter((p) => COLORS.includes(p.seat)).length : 0;
      if (room && room.status === 'waiting' && occupied < MAX_PLAYERS) return code;
      await lobbyRef.transaction((cur) => (cur === code ? null : cur));
      continue;
    }
    const newCode = generateRoomCode();
    const txResult = await lobbyRef.transaction((cur) => cur || newCode);
    if (txResult.committed && txResult.snapshot.val() === newCode) {
      await gameRoomsBase.child(newCode).set(buildInitialRoom());
      return newCode;
    }
  }
  const fallbackCode = generateRoomCode();
  await gameRoomsBase.child(fallbackCode).set(buildInitialRoom());
  await lobbyRef.set(fallbackCode);
  return fallbackCode;
}

async function handlePlay(rawNickname) {
  const nickname = sanitizeNickname(rawNickname);
  shell.setBusy(true);
  try {
    const roomCode = await findOrCreateRoom();
    await enterRoom(roomCode, nickname);
  } catch (err) {
    console.error(err);
    shell.showError('Could not find or create a match. Check your Firebase configuration.');
  } finally { shell.setBusy(false); }
}

async function handleJoinCode(rawNickname, rawCode) {
  const nickname = sanitizeNickname(rawNickname);
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) { shell.showError('Enter a room code to join.'); return; }
  shell.setBusy(true);
  try {
    const snap = await gameRoomsBase.child(code).once('value');
    if (!snap.exists()) { shell.showError(`Room "${code}" doesn't exist.`); return; }
    await enterRoom(code, nickname);
  } catch (err) {
    console.error(err);
    shell.showError('Could not join room. Check your Firebase configuration.');
  } finally { shell.setBusy(false); }
}

async function enterRoom(roomCode, nickname) {
  playerId = generatePlayerId();
  roomRef = gameRoomsBase.child(roomCode);
  playersRef = roomRef.child('players');
  selfRef = playersRef.child(playerId);

  mySeat = await claimSeat(playersRef, COLORS, playerId, nickname);
  setupPresence(selfRef);

  if (COLORS.includes(mySeat)) {
    const occSnap = await playersRef.once('value');
    const occupied = Object.values(occSnap.val() || {}).filter((p) => COLORS.includes(p.seat)).length;
    if (occupied >= MAX_PLAYERS) {
      await lobbyRef.transaction((cur) => (cur === roomCode ? null : cur));
      await startGame(true);
    }
  }

  attachListeners();
  playersMap = (await playersRef.once('value')).val() || {};
  renderLobby({ status: 'waiting', players: playersMap });

  shell.showGameScreen(roomCode);
  shell.setSoundIcon(sounds.enabled);
  sounds.playJoin();
  shell.toast(mySeat === 'spectator' ? "Room is full — you're spectating." : `You're ${CNAME[mySeat] || mySeat}`, 'info');

  canvas.addEventListener('pointerdown', handleCanvasTap);
  requestAnimationFrame(drawLoop);
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    handleStatusTransition(room);
    if (room.status === 'playing' || room.status === 'finished') syncTokens(room);
    handleEvent(room);
    if (room.status === 'waiting') renderLobby(room);
    else renderGame(room);
    handleMatchmakingCountdown(room);
    maybeRunBot(room);
  });

  playersRef.on('value', (snap) => { playersMap = snap.val() || {}; renderPlayerLists(); });

  playersRef.on('child_removed', (snap) => {
    const data = snap.val();
    if (data && COLORS.includes(data.seat)) {
      shell.toast(`${data.nickname} left`, 'info');
      sounds.playLeave();
      resetRoomForDisconnect();
    }
  });

  watchConnectionState(db, (connected) => { if (!connected) shell.toast('Connection lost — reconnecting…', 'warn'); });

  shell.bindChromeActions({
    onShare: () => { sounds.playClick(); shell.shareRoom(roomRef.key); },
    onSoundToggle: () => { const next = !sounds.enabled; sounds.setEnabled(next); shell.setSoundIcon(next); },
    onLeave: handleLeave,
  });

  startGameBtn.addEventListener('click', () => { sounds.playClick(); startGame(false); });
  rollBtn.addEventListener('click', () => { sounds.playClick(); humanRoll(); });
  diceBtn.addEventListener('click', () => humanRoll());
  playAgainBtn.addEventListener('click', () => { sounds.playClick(); playAgain(); });
}

async function resetRoomForDisconnect() {
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.status = 'waiting'; room.turnOrder = []; room.turn = null;
    room.diceValue = null; room.movableTokens = []; room.sixStreak = 0;
    room.tokens = {}; room.winner = null; room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
  viewTokens = null;
}

// ---------------------------------------------------------------------
// Start / restart
// ---------------------------------------------------------------------
async function startGame(silent) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    const occupiedColors = COLORS.filter((c) => Object.values(room.players || {}).some((p) => p.seat === c));
    if (occupiedColors.length < MIN_PLAYERS) return;
    room.turnOrder = occupiedColors;
    room.turn = occupiedColors[0];
    room.tokens = {};
    for (const c of occupiedColors) room.tokens[c] = [0, 0, 0, 0];
    room.diceValue = null; room.movableTokens = []; room.sixStreak = 0;
    room.winner = null; room.status = 'playing';
    pushEvent(room, { type: 'start' });
    return room;
  });
  if (!silent && !txResult.committed) shell.toast('Need at least 2 players to start.', 'warn');
  if (txResult.committed) await lobbyRef.transaction((cur) => (cur === roomRef.key ? null : cur));
}

async function playAgain() {
  viewTokens = null;
  await roomRef.transaction((room) => {
    if (!room) return room;
    const occupiedColors = COLORS.filter((c) => Object.values(room.players || {}).some((p) => p.seat === c));
    if (occupiedColors.length < MIN_PLAYERS) { room.status = 'waiting'; return room; }
    room.turnOrder = occupiedColors;
    room.turn = occupiedColors[0];
    room.tokens = {};
    for (const c of occupiedColors) room.tokens[c] = [0, 0, 0, 0];
    room.diceValue = null; room.movableTokens = []; room.sixStreak = 0;
    room.winner = null; room.status = 'playing';
    pushEvent(room, { type: 'start' });
    return room;
  });
}

// ---------------------------------------------------------------------
// Roll / move — server-validated transactions
// ---------------------------------------------------------------------
// The human taps to roll: pre-decide the value, play the tumble on their own
// screen, then commit that value so the die lands on what it showed.
async function humanRoll() {
  if (!lastRoomSnapshot) return;
  const room = lastRoomSnapshot;
  if (room.status !== 'playing' || room.turn !== mySeat) return;
  if (room.diceValue !== null && room.diceValue !== undefined) return;
  if (diceAnimating) return;
  SFX.resume();
  const roll = randInt(1, 6);
  await animateDice(roll);
  await commitRoll(mySeat, roll);
}

// Commit a pre-decided roll (used by both the human and the bot).
async function commitRoll(seat, roll) {
  if (!COLORS.includes(seat)) return;
  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.turn !== seat) return;
    if (room.diceValue !== null && room.diceValue !== undefined) return;

    const streak = roll === 6 ? (room.sixStreak || 0) + 1 : 0;
    if (streak >= 3) {
      room.sixStreak = 0; room.diceValue = null; room.movableTokens = [];
      advanceTurn(room);
      pushEvent(room, { type: 'forfeit', seat, value: roll });
      return room;
    }
    const tokens = room.tokens[seat] || [0, 0, 0, 0];
    const movable = computeMovableTokens(tokens, roll);
    if (movable.length === 0) {
      room.sixStreak = 0; room.diceValue = null; room.movableTokens = [];
      advanceTurn(room);
      pushEvent(room, { type: 'noMoves', seat, value: roll });
      return room;
    }
    room.sixStreak = streak; room.diceValue = roll; room.movableTokens = movable;
    pushEvent(room, { type: 'roll', seat, value: roll });
    return room;
  });
}

// Shared move resolution used by both the human path and the bot.
function resolveMove(room, seat, tokenIndex) {
  const roll = room.diceValue;
  const tokens = room.tokens[seat];
  const pos = tokens[tokenIndex];
  const newPos = pos === 0 ? 1 : pos + roll;
  tokens[tokenIndex] = newPos;
  room.tokens[seat] = tokens;

  let capturedColor = null;
  if (newPos >= 1 && newPos <= 51) {
    const absCell = (START_OFFSET[seat] + newPos - 1) % 52;
    if (!SAFE_CELLS.has(absCell)) {
      for (const other of room.turnOrder) {
        if (other === seat) continue;
        const otherTokens = room.tokens[other];
        if (!otherTokens) continue;
        for (let j = 0; j < 4; j++) {
          const opos = otherTokens[j];
          if (opos >= 1 && opos <= 51) {
            const oabs = (START_OFFSET[other] + opos - 1) % 52;
            if (oabs === absCell) { otherTokens[j] = 0; capturedColor = other; }
          }
        }
        room.tokens[other] = otherTokens;
      }
    }
  }

  const won = tokens.every((p) => p === 58);
  if (won) {
    room.status = 'finished'; room.winner = seat;
    room.diceValue = null; room.movableTokens = [];
    pushEvent(room, { type: 'win', seat });
    return;
  }

  if (capturedColor) pushEvent(room, { type: 'capture', seat, victim: capturedColor });
  else if (newPos === 58) pushEvent(room, { type: 'home', seat });
  else pushEvent(room, { type: 'move', seat });

  // Ludo King: extra turn on a 6, on a capture, or on getting a token home.
  const extra = roll === 6 || !!capturedColor || newPos === 58;
  room.diceValue = null; room.movableTokens = [];
  if (extra) { if (roll !== 6) room.sixStreak = 0; }
  else { room.sixStreak = 0; advanceTurn(room); }
}

async function attemptMove(tokenIndex) {
  const seat = mySeat;
  if (!COLORS.includes(seat)) return;
  if (animating) return; // wait for the current hop to finish
  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.turn !== seat) return;
    if (room.diceValue === null || room.diceValue === undefined) return;
    if (!Array.isArray(room.movableTokens) || !room.movableTokens.includes(tokenIndex)) return;
    resolveMove(room, seat, tokenIndex);
    return room;
  });
}

async function attemptMoveFor(seat, tokenIndex) {
  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.turn !== seat) return;
    if (room.diceValue === null || room.diceValue === undefined) return;
    if (!Array.isArray(room.movableTokens) || !room.movableTokens.includes(tokenIndex)) return;
    resolveMove(room, seat, tokenIndex);
    return room;
  });
}

// ---------------------------------------------------------------------
// Bot AI (driven by RED, the always-present first joiner)
// ---------------------------------------------------------------------
function botColorOf(room) {
  for (const [id, p] of Object.entries(room.players || {})) {
    if (id === 'bot' || p.nickname === 'Computer') return p.seat;
  }
  return null;
}

function maybeRunBot(room) {
  if (mySeat !== 'RED' || room.mode !== 'bot' || room.status !== 'playing') return;
  const botSeat = botColorOf(room);
  if (!botSeat || room.turn !== botSeat || botActing) return;

  botActing = true;
  setTimeout(async () => {
    if (room.diceValue === null || room.diceValue === undefined) {
      const roll = randInt(1, 6);
      await animateDice(roll);           // show the tumble locally
      await commitRoll(botSeat, roll);
    }
    setTimeout(async () => {
      const fresh = (await roomRef.once('value')).val();
      if (fresh && fresh.turn === botSeat && Array.isArray(fresh.movableTokens) && fresh.movableTokens.length) {
        const choice = botChoose(fresh, botSeat);
        // wait out any in-flight hop so animations don't stack
        await animQueue;
        await attemptMoveFor(botSeat, choice);
      }
      botActing = false;
    }, 850);
  }, 650);
}

function botChoose(room, seat) {
  const tokens = room.tokens[seat];
  const roll = room.diceValue;
  let best = room.movableTokens[0], bestScore = -1e9;
  for (const i of room.movableTokens) {
    const pos = tokens[i];
    const newPos = pos === 0 ? 1 : pos + roll;
    let score = newPos;
    if (newPos === 58) score += 1000;                         // finish a token
    if (newPos >= 1 && newPos <= 51) {
      const abs = (START_OFFSET[seat] + newPos - 1) % 52;
      if (!SAFE_CELLS.has(abs)) {
        for (const o of room.turnOrder) {
          if (o === seat || !room.tokens[o]) continue;
          for (let j = 0; j < 4; j++) {
            const opp = room.tokens[o][j];
            if (opp >= 1 && opp <= 51 && (START_OFFSET[o] + opp - 1) % 52 === abs) score += 500; // capture
          }
        }
      } else score += 40;                                     // land safe
    }
    if (pos === 0 && roll === 6) score += 120;                // leave the yard
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    const occupiedColors = COLORS.filter((c) => Object.values(room.players || {}).some((p) => p.seat === c));
    if (occupiedColors.length !== 1) return;
    const nextColor = COLORS.find((c) => !occupiedColors.includes(c));
    room.mode = 'bot';
    room.players = room.players || {};
    room.players['bot'] = { nickname: 'Computer', seat: nextColor, joinedAt: Date.now() };
    return room;
  });
  if (txResult.committed) shell.toast('A Computer player joined — start whenever you like!', 'info');
}

// ---------------------------------------------------------------------
// Matchmaking countdown
// ---------------------------------------------------------------------
function handleMatchmakingCountdown(room) {
  const occupiedColors = COLORS.filter((c) => Object.values(room.players || {}).some((p) => p.seat === c));
  const iAmWaitingAlone = mySeat === 'RED' && room.status === 'waiting' && occupiedColors.length === 1;
  if (!iAmWaitingAlone) { stopMatchmakingCountdown(); return; }
  if (matchmakingInterval) return;
  matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
  shell.showWaitingCountdown(matchmakingSecondsLeft);
  matchmakingInterval = setInterval(() => {
    matchmakingSecondsLeft -= 1;
    if (matchmakingSecondsLeft <= 0) { stopMatchmakingCountdown(); activateBot(); return; }
    shell.showWaitingCountdown(matchmakingSecondsLeft);
  }, 1000);
}
function stopMatchmakingCountdown() {
  if (matchmakingInterval) { clearInterval(matchmakingInterval); matchmakingInterval = null; }
  shell.hideWaitingCountdown();
}

// ---------------------------------------------------------------------
// Event -> sound / toast side effects
// ---------------------------------------------------------------------
function handleEvent(room) {
  const ev = room.event;
  if (!ev || ev.seq === lastEventSeq) return;
  const firstSeen = lastEventSeq !== -1;
  lastEventSeq = ev.seq;

  // Show the die face for any roll-derived event on observers' screens.
  if (firstSeen && ev.value && ev.seat !== (room.mode === 'bot' ? botColorOf(room) : null) && !diceAnimating) {
    if (ev.type === 'roll' || ev.type === 'noMoves' || ev.type === 'forfeit') {
      // only animate for other players' rolls; my own roll animates on tap
      if (ev.seat !== mySeat) animateDice(ev.value);
    }
  }

  if (ev.type === 'capture') {
    if (ev.victim === mySeat) shell.toast(`${CNAME[ev.seat]} sent your token home!`, 'warn');
    else if (firstSeen) shell.toast(`${CNAME[ev.seat]} captured ${CNAME[ev.victim]}! 🎯`, 'info');
  } else if (ev.type === 'home') {
    if (firstSeen) shell.toast(`${CNAME[ev.seat]} sent a token home! 🏠`, 'info');
  } else if (ev.type === 'forfeit') {
    shell.toast(`${CNAME[ev.seat]} rolled three 6s in a row — turn forfeited!`, 'warn');
  } else if (ev.type === 'noMoves' && firstSeen) {
    if (ev.seat === mySeat) shell.toast(`No moves for a ${ev.value}.`, 'info');
  }
}

function handleStatusTransition(room) {
  if (lastStatus === room.status) return;
  const prev = lastStatus;
  lastStatus = room.status;
  if (room.status === 'playing') viewTokens = room.tokens ? cloneTokens(room.tokens) : null;
  if (prev === null) return;
  if (room.status === 'finished') {
    confetti();
    if (mySeat === room.winner) sounds.playWin();
    else if (mySeat !== 'spectator') sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

async function handleLeave() {
  stopMatchmakingCountdown();
  botActing = false;
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {}; lastStatus = null; lastEventSeq = -1; roomRef = null;
  viewTokens = null; particles = [];
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Canvas interaction
// ---------------------------------------------------------------------
let lastRoomSnapshot = null;

function handleCanvasTap(e) {
  if (!lastRoomSnapshot) return;
  const room = lastRoomSnapshot;
  if (room.status !== 'playing' || room.turn !== mySeat) return;
  if (!Array.isArray(room.movableTokens) || !room.movableTokens.length) return;
  if (animating) return;

  const rect = canvas.getBoundingClientRect();
  const scale = SIZE / rect.width;
  const x = (e.clientX - rect.left) * scale;
  const y = (e.clientY - rect.top) * scale;

  const tokens = room.tokens[mySeat] || [0, 0, 0, 0];
  let best = null, bestDist = Infinity;
  for (const idx of room.movableTokens) {
    const coord = coordOf(mySeat, tokens[idx], idx);
    if (!coord) continue;
    const p = px(coord.r, coord.c);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < CELL * 0.75 && d < bestDist) { bestDist = d; best = idx; }
  }
  if (best !== null) attemptMove(best);
}

// ---------------------------------------------------------------------
// Rendering — lobby + seats + status
// ---------------------------------------------------------------------
function renderLobby(room) {
  lobbyPanel.classList.remove('hidden');
  gameArea.classList.add('hidden');

  const seatOf = {};
  for (const p of Object.values(room.players || {})) if (COLORS.includes(p.seat)) seatOf[p.seat] = p;

  lobbySeatsEl.innerHTML = '';
  let occupiedCount = 0;
  for (const c of COLORS) {
    const p = seatOf[c];
    const div = document.createElement('div');
    div.className = 'lobby-seat ' + (p ? `filled c-${c}` : 'c-empty');
    if (p && c === mySeat) div.classList.add('you');
    if (p) { occupiedCount++; div.innerHTML = `<span class="dot"></span> ${p.nickname}${p.nickname === 'Computer' ? ' 🤖' : ''}`; }
    else div.textContent = `${CNAME[c]} — open`;
    lobbySeatsEl.appendChild(div);
  }
  lobbyCountEl.textContent = `(${occupiedCount}/${MAX_PLAYERS})`;
  const canStart = occupiedCount >= MIN_PLAYERS;
  startGameBtn.disabled = !canStart;
  lobbyHintEl.textContent = canStart
    ? 'Anyone can tap Start when ready — more players can still join until then.'
    : `Need at least ${MIN_PLAYERS} players to start.`;
  spectatorCount.textContent = '';
}

function renderPlayerLists() {
  if (gameArea.classList.contains('hidden')) return;
  let spectators = 0;
  for (const p of Object.values(playersMap)) if (p.seat === 'spectator') spectators++;
  spectatorCount.textContent = spectators > 0 ? `👀 ${spectators} watching` : '';
}

function renderGame(room) {
  lastRoomSnapshot = room;
  lobbyPanel.classList.add('hidden');
  gameArea.classList.remove('hidden');

  const seatOf = {};
  for (const p of Object.values(room.players || {})) if (COLORS.includes(p.seat)) seatOf[p.seat] = p;

  seatsRow.innerHTML = '';
  for (const c of COLORS) {
    const p = seatOf[c];
    const div = document.createElement('div');
    const homeCount = room.tokens && room.tokens[c] ? room.tokens[c].filter((v) => v === 58).length : 0;
    div.className = 'seat-card c-' + (p ? c : 'empty');
    if (p) div.classList.add('occupied');
    if (room.status === 'playing' && room.turn === c) div.classList.add('active-turn');
    div.innerHTML = p
      ? `<span class="seat-name">${p.nickname}${c === mySeat ? ' (you)' : ''}</span><span class="seat-home">🏠 ${homeCount}/4</span>`
      : `<span class="seat-name">${CNAME[c]}</span>`;
    seatsRow.appendChild(div);
  }
  renderPlayerLists();

  // status text
  let text = '';
  if (room.status === 'playing') {
    if (mySeat === 'spectator') text = `${CNAME[room.turn]}'s turn…`;
    else if (room.turn === mySeat) text = room.diceValue ? 'Pick a token to move!' : 'Your turn — roll the dice!';
    else text = `Waiting for ${CNAME[room.turn]}…`;
  } else if (room.status === 'finished') {
    if (mySeat === room.winner) text = 'You win! 🎉';
    else if (mySeat === 'spectator') text = `${CNAME[room.winner]} wins!`;
    else text = `${CNAME[room.winner]} wins — play again?`;
  }
  statusBar.textContent = text;
  statusBar.className = 'status-bar ' + (room.status === 'finished' ? (mySeat === room.winner ? 'status-won' : 'status-lost') : '');

  // dice face (skip while a tumble is playing)
  if (!diceAnimating) {
    if (room.diceValue) { drawDice(room.diceValue); diceValueShown = room.diceValue; }
    else if (room.status !== 'playing') drawDice(diceValueShown);
  }

  const canRoll = room.status === 'playing' && room.turn === mySeat && (room.diceValue === null || room.diceValue === undefined);
  rollBtn.classList.toggle('hidden', !canRoll);
  diceBtn.disabled = !canRoll;
  turnHint.innerHTML = room.status === 'playing' && room.turn === mySeat
    ? (room.diceValue ? 'Tap a <b>glowing</b> token to move it.' : 'Tap the <b>dice</b> to roll.')
    : '';
  playAgainBtn.classList.toggle('hidden', room.status !== 'finished');
}

// ---------------------------------------------------------------------
// Rendering — the board
// ---------------------------------------------------------------------
function drawLoop() {
  if (lastRoomSnapshot) { drawBoard(); drawTokens(lastRoomSnapshot); }
  stepFX();
  requestAnimationFrame(drawLoop);
}

function drawBoard() {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#efe7d2'; roundRect(ctx, 0, 0, SIZE, SIZE, 22); ctx.fill();

  drawBase(0, 0, 'RED'); drawBase(0, 9, 'GREEN'); drawBase(9, 9, 'YELLOW'); drawBase(9, 0, 'BLUE');

  ctx.fillStyle = '#faf6ec';
  ctx.fillRect(6 * CELL, 0, 3 * CELL, SIZE);
  ctx.fillRect(0, 6 * CELL, SIZE, 3 * CELL);

  for (let i = 0; i < 52; i++) {
    const [r, c] = TRACK[i]; cellRect(r, c, '#faf6ec', '#e0d6bd');
    if (SAFE_CELLS.has(i)) drawStar(r, c);
  }
  for (const col of COLORS) { const [r, c] = TRACK[START_OFFSET[col]]; cellRect(r, c, HEX[col].flat, 'rgba(0,0,0,.12)'); drawStar(r, c, 'rgba(255,255,255,.85)'); }
  for (const col of COLORS) for (const [r, c] of HOME_COL[col]) cellRect(r, c, HEX[col].flat, 'rgba(0,0,0,.10)');

  drawCentre();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(120,90,40,.35)';
  roundRect(ctx, 1.5, 1.5, SIZE - 3, SIZE - 3, 22); ctx.stroke();
}

function drawBase(rr, cc, color) {
  const x = cc * CELL, y = rr * CELL, w = 6 * CELL;
  const g = ctx.createLinearGradient(x, y, x + w, y + w);
  g.addColorStop(0, HEX[color].top); g.addColorStop(1, HEX[color].bot);
  ctx.fillStyle = g; roundRect(ctx, x + 3, y + 3, w - 6, w - 6, 16); ctx.fill();
  ctx.fillStyle = '#faf6ec'; roundRect(ctx, x + CELL * 0.9, y + CELL * 0.9, w - CELL * 1.8, w - CELL * 1.8, 14); ctx.fill();
  ctx.strokeStyle = HEX[color].bot; ctx.lineWidth = 3;
  for (const [sr, sc] of YARD[color]) {
    const p = px(sr, sc);
    ctx.beginPath(); ctx.arc(p.x, p.y, CELL * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fill(); ctx.stroke();
  }
}

function cellRect(r, c, fill, stroke) {
  const x = c * CELL, y = r * CELL;
  ctx.fillStyle = fill; ctx.fillRect(x, y, CELL, CELL);
  ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
}
function drawStar(r, c, col = 'rgba(90,70,30,.5)') {
  const p = px(r, c); ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = col;
  ctx.font = `${CELL * 0.6}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('★', 0, 1); ctx.restore();
}
function drawCentre() {
  const c0 = 6 * CELL, c1 = 9 * CELL, mid = 7.5 * CELL;
  const dirs = {
    RED: [[c0, c0], [c0, c1]], GREEN: [[c0, c0], [c1, c0]],
    YELLOW: [[c1, c1], [c1, c0]], BLUE: [[c1, c1], [c0, c1]],
  };
  for (const col of COLORS) {
    const [a, b] = dirs[col];
    ctx.beginPath(); ctx.moveTo(mid, mid); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath();
    const g = ctx.createLinearGradient(mid, mid, a[0], a[1]);
    g.addColorStop(0, HEX[col].top); g.addColorStop(1, HEX[col].bot);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.save(); ctx.translate(mid, mid);
  ctx.font = `${CELL * 1.1}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('👑', 0, 2); ctx.restore();
}

function drawPawn(x, y, color, R, glow) {
  const top = HEX[color].top, bot = HEX[color].bot;
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.ellipse(0, R * 0.95, R * 0.85, R * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
  if (glow) { ctx.shadowColor = top; ctx.shadowBlur = 16; }
  ctx.beginPath();
  ctx.moveTo(-R * 0.78, R * 0.95);
  ctx.quadraticCurveTo(-R * 0.95, R * 0.4, -R * 0.45, R * 0.1);
  ctx.quadraticCurveTo(-R * 0.2, -R * 0.05, -R * 0.28, -R * 0.2);
  ctx.lineTo(R * 0.28, -R * 0.2);
  ctx.quadraticCurveTo(R * 0.2, -R * 0.05, R * 0.45, R * 0.1);
  ctx.quadraticCurveTo(R * 0.95, R * 0.4, R * 0.78, R * 0.95);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, -R, 0, R);
  bg.addColorStop(0, top); bg.addColorStop(1, bot);
  ctx.fillStyle = bg; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -R * 0.5, R * 0.5, 0, Math.PI * 2);
  const hg = ctx.createRadialGradient(-R * 0.15, -R * 0.7, R * 0.05, 0, -R * 0.5, R * 0.55);
  hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.35, top); hg.addColorStop(1, bot);
  ctx.fillStyle = hg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.font = `bold ${R * 0.6}px 'Nunito',sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ICON[color], 0, R * 0.42);
  ctx.restore();
}

function drawTokens(room) {
  const positions = viewTokens || room.tokens;
  if (!positions) return;
  const movable = (room.status === 'playing' && room.turn === mySeat && !animating) ? (room.movableTokens || []) : [];

  const cells = {};
  for (const c of Object.keys(positions)) {
    ensureVis(c);
    for (let i = 0; i < 4; i++) {
      const pos = positions[c][i];
      const co = coordOf(c, pos, i); if (!co) continue;
      const v = VIS[c][i];
      const gx = co.c + v.dx, gy = co.r + v.dy;
      const key = pos >= 1 && pos <= 51 ? 'T' + absTrackCell(c, pos) : `${c}_${pos}_${i}`;
      (cells[key] = cells[key] || []).push({ c, i, gx, gy, pos, v });
    }
  }
  for (const key in cells) {
    const grp = cells[key], n = grp.length;
    grp.forEach((t, gi) => {
      const onTrack = t.pos >= 1 && t.pos <= 51;
      const spread = onTrack && n > 1 ? (gi - (n - 1) / 2) : 0;
      const p = px(t.gy, t.gx); // gy = row, gx = col — px expects (row, col)
      const jitter = spread * CELL * 0.28;
      const R = CELL * 0.42 * (t.v.scale || 1);
      const glow = t.c === mySeat && movable.includes(t.i);
      drawPawn(p.x + jitter, p.y - (t.v.hop || 0), t.c, R, glow);
    });
  }
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
shell.bindLandingActions({ onPlay: handlePlay, onJoinCode: handleJoinCode });


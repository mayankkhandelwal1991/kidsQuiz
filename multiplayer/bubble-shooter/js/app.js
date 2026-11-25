/**
 * bubble-shooter/js/app.js — Bubble Shooter Duel (turn by turn, one shared board)
 * -----------------------------------------------------------------------
 * Both players see the SAME board and take turns: my shot, your shot …
 *
 *  - Aim: drag on the board (dotted guide line with wall bounces), let go to
 *    shoot. A quick tap shoots at that spot. The opponent's aim line is shown
 *    live while they aim (room/aim/{seat}).
 *  - The shooter's phone works out the whole shot (flight path, where it
 *    sticks, what pops, what falls, the points) and publishes it as ONE
 *    record (room/game) in a transaction on game.seq — only the player whose
 *    turn it is can write, so the two phones can never disagree.
 *  - Every phone replays that record with the same animation: the bubble
 *    flies along the path, the group pops, loose bubbles drop, "+30" floats up.
 *  - Points: popped bubble 10, dropped bubble 15, big combo +20, clearing the
 *    board +50. Every 8 shots two new rows push down. First to WIN_SCORE wins;
 *    if the bubbles reach the danger line the higher score wins.
 *  - Turn timer: when it runs out the shot is fired for you; if a phone falls
 *    asleep the other player skips its turn, so a game never freezes.
 *  - Computer mode: P1's phone plays the Computer's turns. It tries many
 *    angles and usually (not always) takes the best one.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, randInt, clamp } from '../../common/utils.js';

const GAME_ID = 'bubble-shooter';
const MATCH_WAIT_SECONDS = 10;
const SEATS = ['P1', 'P2'];
const WIN_SCORE = 250;

const W = 300, H = 460;
const R = 15;
const COLS = 8;                 // even rows: 8 bubbles, odd rows: 7
const MARGIN = 22;
const TOP_MARGIN = 18;
const ROWH = 26;
const MAX_ROWS = 14;
const DANGER_ROW = 12;          // a bubble in this row = the board is full
const START_ROWS = 5;
const ADD_EVERY = 8;            // shots between new rows
const SHOOTER_Y = H - 34;
const SPEED = 620;              // px/s of a flying bubble (animation)
const TURN_MS = 15000;
const SKIP_GRACE_MS = 4000;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

const PALETTE = ['#22d3ee', '#f472b6', '#facc15', '#4ade80', '#a78bfa'];
const COLOR_NAMES = ['blue', 'pink', 'yellow', 'green', 'purple'];

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Bubble Shooter Duel' });
const sounds = new SoundManager();

let serverOffset = 0;
db.ref('.info/serverTimeOffset').on('value', (s) => { serverOffset = s.val() || 0; });
const now = () => Date.now() + serverOffset;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = W * DPR; canvas.height = H * DPR;
const statusBar = document.getElementById('status-bar');
const scoreP1 = document.getElementById('score-p1');
const scoreP2 = document.getElementById('score-p2');
const cardP1 = document.getElementById('card-p1');
const cardP2 = document.getElementById('card-p2');
const nameP1 = document.getElementById('name-p1');
const nameP2 = document.getElementById('name-p2');
const spectatorCount = document.getElementById('spectator-count');
const playAgainBtn = document.getElementById('play-again-btn');
const vsLabel = document.querySelector('.vs-label');
const hintLine = document.querySelector('.hint-line');
if (vsLabel) vsLabel.textContent = 'FIRST TO ' + WIN_SCORE;
if (hintLine) hintLine.textContent = 'Your turn: drag to aim, let go to shoot. Match 3+ of the same colour to pop them!';

let roomRef = null, playersRef = null, selfRef = null, playerId = null, mySeat = null;
let playersMap = {};
let lastStatus = null;
let listening = [];
let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;

const room = { status: 'waiting', mode: 'human', winner: null };
let game = null;                // the shared game record
let shown = null;               // Map key -> colour index currently drawn
let shownSeq = -1;
let queue = [];                 // game records waiting to be animated
let anim = null;                // the shot being animated
let aim = { P1: null, P2: null };
let myAim = null;               // angle while dragging
let aiming = false;
let fx = [];                    // pops, falling bubbles, floating text
let running = false;
let decidedSeq = '';            // guards auto-shot / skip / bot from firing twice
let namesKey = '';
const other = (s) => (s === 'P1' ? 'P2' : 'P1');

// ---------------------------------------------------------------------
// Board helpers (a board is a Map "r_c" -> colour index)
// ---------------------------------------------------------------------
const key = (r, c) => r + '_' + c;
const parse = (k) => k.split('_').map(Number);
function cellPos(r, c) { return { x: MARGIN + R + c * 2 * R + (r % 2 === 1 ? R : 0), y: TOP_MARGIN + R + r * ROWH }; }
const maxColFor = (r) => (r % 2 === 1 ? COLS - 2 : COLS - 1);
function neighbors(r, c) {
  return r % 2 === 0
    ? [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]]
    : [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]];
}
function encode(b) {
  let s = '';
  for (let r = 0; r < MAX_ROWS; r++) for (let c = 0; c < COLS; c++) { const v = b.get(key(r, c)); s += v == null ? '.' : String(v); }
  return s;
}
function decode(s) {
  const b = new Map();
  for (let i = 0; i < (s || '').length; i++) if (s[i] !== '.') b.set(key(Math.floor(i / COLS), i % COLS), +s[i]);
  return b;
}
function maxRow(b) { let m = -1; for (const k of b.keys()) m = Math.max(m, parse(k)[0]); return m; }
function colorsOn(b) { return [...new Set(b.values())]; }
function pickColor(b) { const pool = colorsOn(b); return pool.length ? pool[randInt(0, pool.length - 1)] : randInt(0, PALETTE.length - 1); }
function fillRows(b, rows) { for (let r = 0; r < rows; r++) for (let c = 0; c <= maxColFor(r); c++) b.set(key(r, c), randInt(0, PALETTE.length - 1)); }
function pushRows(b) {           // two new rows on top (two keeps the zig-zag pattern)
  const moved = new Map();
  for (const [k, v] of b) { const [r, c] = parse(k); if (r + 2 < MAX_ROWS) moved.set(key(r + 2, c), v); }
  for (let r = 0; r < 2; r++) for (let c = 0; c <= maxColFor(r); c++) moved.set(key(r, c), pickColor(b));
  return moved;
}

/** Fly a bubble from the shooter at `angle` (radians, 0 = right, PI/2 = straight up). */
function simulate(b, angle) {
  let x = W / 2, y = SHOOTER_Y, vx = Math.cos(angle), vy = -Math.sin(angle);
  const path = [[x, y]], STEP = 3;
  for (let i = 0; i < 1200; i++) {
    x += vx * STEP; y += vy * STEP;
    if (x < R) { x = R; vx = -vx; path.push([x, y]); }
    else if (x > W - R) { x = W - R; vx = -vx; path.push([x, y]); }
    if (y - R <= TOP_MARGIN) break;
    let hit = false;
    for (const k of b.keys()) { const [r, c] = parse(k), p = cellPos(r, c); if ((p.x - x) ** 2 + (p.y - y) ** 2 < (2 * R - 4) ** 2) { hit = true; break; } }
    if (hit) break;
  }
  path.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  // nearest free cell
  const estRow = clamp(Math.round((y - TOP_MARGIN - R) / ROWH), 0, MAX_ROWS - 1);
  let best = null, bd = Infinity;
  for (let r = Math.max(0, estRow - 1); r <= Math.min(MAX_ROWS - 1, estRow + 1); r++) {
    for (let c = 0; c <= maxColFor(r); c++) {
      if (b.has(key(r, c))) continue;
      const p = cellPos(r, c), d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = { r, c }; }
    }
  }
  if (!best) best = { r: estRow, c: clamp(Math.round((x - MARGIN - R) / (2 * R)), 0, maxColFor(estRow)) };
  return { path, land: best };
}
/** Stick `color` at land, pop 3+ and drop loose bubbles. Mutates b. */
function resolve(b, land, color) {
  const lk = key(land.r, land.c);
  b.set(lk, color);
  const group = [lk], seen = new Set([lk]), stack = [[land.r, land.c]];
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [nr, nc] of neighbors(r, c)) {
      const nk = key(nr, nc);
      if (seen.has(nk) || b.get(nk) !== color) continue;
      seen.add(nk); stack.push([nr, nc]); group.push(nk);
    }
  }
  if (group.length < 3) return { popped: [], dropped: [] };
  group.forEach((k) => b.delete(k));
  const reach = new Set(), q = [];
  for (const k of b.keys()) if (parse(k)[0] === 0) { reach.add(k); q.push(parse(k)); }
  while (q.length) {
    const [r, c] = q.pop();
    for (const [nr, nc] of neighbors(r, c)) { const nk = key(nr, nc); if (!reach.has(nk) && b.has(nk)) { reach.add(nk); q.push([nr, nc]); } }
  }
  const dropped = [];
  for (const k of [...b.keys()]) if (!reach.has(k)) { dropped.push(k + ':' + b.get(k)); b.delete(k); }
  return { popped: group, dropped };
}
function pathLength(path) { let L = 0; for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); return L; }
const shotMs = (path) => pathLength(path) / SPEED * 1000 + 450;   // flight + pop time

function freshGame(starter, prevSeq) {
  const b = new Map(); fillRows(b, START_ROWS);
  return { seq: (prevSeq || 0) + 1, turn: starter, starter, board: encode(b), cur: pickColor(b), next: pickColor(b), shots: 0,
    scores: { P1: 0, P2: 0 }, turnStart: Math.round(now() + 1200), last: null };
}

// ---------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------
function buildInitialRoom() {
  return { createdAt: firebase.database.ServerValue.TIMESTAMP, mode: 'human', status: 'waiting', winner: null, game: freshGame('P1', 0) };
}

async function handlePlay(rawNickname) {
  const nickname = sanitizeNickname(rawNickname);
  shell.setBusy(true);
  try {
    const { roomCode } = await quickMatch.findOrCreateMatch(buildInitialRoom, generateRoomCode);
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
    if (!(await quickMatch.roomExists(code))) { shell.showError(`Room "${code}" doesn't exist.`); return; }
    await enterRoom(code, nickname);
  } catch (err) {
    console.error(err);
    shell.showError('Could not join room. Check your Firebase configuration.');
  } finally { shell.setBusy(false); }
}

async function enterRoom(roomCode, nickname) {
  playerId = generatePlayerId();
  roomRef = quickMatch.roomRef(roomCode);
  playersRef = roomRef.child('players');
  selfRef = playersRef.child(playerId);
  game = null; shown = null; shownSeq = -1; queue = []; anim = null; fx = []; decidedSeq = '';

  mySeat = await claimSeat(playersRef, SEATS, playerId, nickname);
  setupPresence(selfRef);
  if (mySeat === 'P2') {
    await roomRef.transaction((r) => {
      if (r && r.status === 'waiting') { r.status = 'playing'; r.mode = 'human'; r.winner = null; r.game = freshGame('P1', r.game && r.game.seq); r.aim = null; }
      return r;
    });
    await quickMatch.clearIfMatches(roomCode);
  }

  attachListeners();
  bindControls();
  playersMap = (await playersRef.once('value')).val() || {};
  renderPlayers();
  shell.showGameScreen(roomCode);
  shell.setSoundIcon(sounds.enabled);
  sounds.playJoin();
  shell.toast(mySeat === 'spectator' ? "Both seats are taken — you're spectating." : `You're ${mySeat}`, 'info');
  running = true;
  requestAnimationFrame(loop);
}

function on(ref, fn) { ref.on('value', fn); listening.push(ref); }
function attachListeners() {
  on(roomRef.child('status'), (s) => { room.status = s.val() || 'waiting'; onRoom(); });
  on(roomRef.child('mode'), (s) => { room.mode = s.val() || 'human'; });
  on(roomRef.child('winner'), (s) => { room.winner = s.val(); onRoom(); });
  on(roomRef.child('game'), (s) => receiveGame(s.val()));
  on(roomRef.child('aim'), (s) => { const a = s.val() || {}; aim = { P1: a.P1 ?? null, P2: a.P2 ?? null }; });
  on(playersRef, (snap) => {
    playersMap = snap.val() || {};
    const k = Object.entries(playersMap).map(([id, p]) => id + p.seat + p.nickname).sort().join('|');
    if (k !== namesKey) { namesKey = k; renderPlayers(); }
  });
  playersRef.on('child_removed', (snap) => {
    const data = snap.val();
    if (data && (data.seat === 'P1' || data.seat === 'P2')) {
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
  playAgainBtn.onclick = () => {
    sounds.playClick();
    roomRef.transaction((r) => {
      if (!r || r.status !== 'finished') return;             // the other player already restarted
      const prev = (r.game && r.game.starter) || 'P1';
      r.status = 'playing'; r.winner = null; r.aim = null;
      r.game = freshGame(other(prev), r.game && r.game.seq);  // the first turn alternates
      return r;
    });
  };
}

function onRoom() { handleStatusTransition(); renderBoard(); handleMatchmakingCountdown(); }

/** A new game record arrived (from Firebase or from my own shot). */
function receiveGame(g) {
  if (!g || !g.board) return;
  if (game && g.seq < game.seq) return;
  if (game && g.seq === game.seq) { game = g; return; }        // same state (my own write coming back)
  // first state, a new match, or we missed a turn (asleep): just show the board
  const jump = !game || !shown || !g.last || g.seq > game.seq + 1;
  game = g;
  if (jump) { shown = decode(g.board); shownSeq = g.seq; queue = []; anim = null; }
  else queue.push(g);
  renderBoard();
}

function resetRoomForDisconnect() {
  roomRef.transaction((r) => {
    if (!r) return r;
    r.status = 'waiting'; r.winner = null; r.mode = 'human'; r.aim = null;
    r.game = freshGame('P1', r.game && r.game.seq);
    if (r.players && r.players.bot) delete r.players.bot;
    return r;
  });
}

// ---------------------------------------------------------------------
// Taking a shot (the player whose turn it is, or P1's phone for the Computer)
// ---------------------------------------------------------------------
function canShoot(seat) {
  return game && room.status === 'playing' && game.turn === seat && !anim && !queue.length && now() >= game.turnStart - 50;
}
function shoot(seat, angle) {
  const g = game;
  if (!canShoot(seat)) return false;
  angle = clamp(angle, 0.14, Math.PI - 0.14);
  const b = decode(g.board), color = g.cur;
  const { path, land } = simulate(b, angle);
  const res = resolve(b, land, color);
  let gained = res.popped.length * 10 + res.dropped.length * 15;
  let combo = res.popped.length + res.dropped.length >= 6;
  if (combo) gained += 20;
  let cleared = false, rows = false;
  const shots = g.shots + 1;
  let board = b;
  if (board.size === 0) { cleared = true; gained += 50; fillRows(board, START_ROWS); }
  else if (shots % ADD_EVERY === 0) { board = pushRows(board); rows = true; }
  const scores = { P1: g.scores.P1 || 0, P2: g.scores.P2 || 0 };
  scores[seat] += gained;
  const full = maxRow(board) >= DANGER_ROW;
  let winner = null;
  if (scores[seat] >= WIN_SCORE) winner = seat;
  else if (full) winner = scores.P1 === scores.P2 ? 'draw' : (scores.P1 > scores.P2 ? 'P1' : 'P2');
  const next = {
    seq: g.seq + 1, turn: other(seat), starter: g.starter, board: encode(board), cur: g.next, next: pickColor(board), shots, scores,
    turnStart: Math.round(now() + shotMs(path) + 250),
    last: { by: seat, color, path, land: key(land.r, land.c), popped: res.popped, dropped: res.dropped, gained, combo, cleared, rows, full: !!full },
  };
  publish(g, next, winner);
  roomRef.child('aim').child(seat).set(null);
  return true;
}
function skipTurn(seat) {                                           // phone asleep: pass the turn on
  const g = game;
  const next = Object.assign({}, g, { seq: g.seq + 1, turn: other(seat), turnStart: Math.round(now() + 300), last: { by: seat, skip: true } });
  publish(g, next, null);
}
function publish(base, next, winner) {
  receiveGame(next);                                                // show it on this phone right away
  roomRef.child('game').transaction((cur) => {
    if (cur && cur.seq !== base.seq) return;                      // someone else already moved
    return next;
  }, (err, committed, snap) => {
    if (!committed && snap && snap.val()) { game = null; shown = null; receiveGame(snap.val()); }
    else if (committed && winner) setTimeout(() => roomRef.update({ status: 'finished', winner }), shotMs(next.last && next.last.path || [[0, 0]]));
  }, false);
}

// Computer: try many angles on a copy of the board, usually pick the best
function botAngle() {
  const b0 = decode(game.board), color = game.cur, tries = [];
  for (let i = 0; i <= 40; i++) {
    const a = 0.2 + (Math.PI - 0.4) * i / 40, b = new Map(b0);
    const { land } = simulate(b, a), res = resolve(b, land, color);
    tries.push({ a, v: res.popped.length * 10 + res.dropped.length * 15 + Math.random() * 3 });
  }
  tries.sort((x, y) => y.v - x.v);
  // kid-friendly: the best shot only half the time, otherwise one of the top 10, aimed a bit loosely
  const pickI = Math.random() < 0.5 ? 0 : randInt(0, Math.min(9, tries.length - 1));
  return tries[pickI].a + (Math.random() - 0.5) * 0.09;
}

// ---------------------------------------------------------------------
// Aiming
// ---------------------------------------------------------------------
function angleFrom(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
  return clamp(Math.atan2(SHOOTER_Y - Math.min(y, SHOOTER_Y - 30), x - W / 2), 0.14, Math.PI - 0.14);
}
let aimSent = 0;
function sendAim(a) {
  const t = performance.now();
  if (t - aimSent < 90) return;
  aimSent = t;
  roomRef.child('aim').child(mySeat).set(Math.round(a * 1000) / 1000);
}
function bindControls() {
  canvas.onpointerdown = (e) => {
    if (!canShoot(mySeat)) return;
    aiming = true; myAim = angleFrom(e); sendAim(myAim);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  };
  canvas.onpointermove = (e) => { if (!aiming) return; myAim = angleFrom(e); sendAim(myAim); };
  canvas.onpointerup = (e) => {
    if (!aiming) return;
    aiming = false; myAim = angleFrom(e);
    if (shoot(mySeat, myAim)) sounds.playWhoosh();
    myAim = null;
  };
  canvas.onpointercancel = () => { aiming = false; myAim = null; };
}

// ---------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------
let lastT = 0;
function loop(t) {
  if (!running) return;
  const dt = Math.min((t - (lastT || t)) / 1000, 0.05);
  lastT = t;
  stepAnim(t);
  decide();
  fx = fx.filter((f) => t - f.t0 < f.life);
  fx.forEach((f) => { if (f.vy != null) { f.vy += 900 * dt; f.y += f.vy * dt; f.x += f.vx * dt; } });
  draw(t);
  requestAnimationFrame(loop);
}

/** Turn bookkeeping: auto-shot when my time runs out, the Computer's turn, skipping a sleeping phone. */
function decide() {
  const g = game;
  if (!g || room.status !== 'playing' || anim || queue.length) return;
  const t = now(), tag = g.seq + ':' + g.turn;
  if (decidedSeq === tag) return;
  if (g.turn === mySeat && t > g.turnStart + TURN_MS) {
    decidedSeq = tag; aiming = false;
    if (shoot(mySeat, myAim != null ? myAim : Math.PI / 2 + (Math.random() - 0.5) * 1.2)) { sounds.playWhoosh(); shell.toast('Time up — shot fired for you ⏱', 'info'); }
  } else if (room.mode === 'bot' && mySeat === 'P1' && g.turn === 'P2' && t > g.turnStart + 900) {
    decidedSeq = tag;
    const a = botAngle();
    roomRef.child('aim').child('P2').set(Math.round(a * 1000) / 1000);
    setTimeout(() => { if (game && game.seq === g.seq && shoot('P2', a)) sounds.playWhoosh(); }, 650);   // show its aim first
  } else if (room.mode !== 'bot' && (mySeat === 'P1' || mySeat === 'P2') && g.turn === other(mySeat) && t > g.turnStart + TURN_MS + SKIP_GRACE_MS) {
    decidedSeq = tag;
    skipTurn(g.turn);
  }
}

function stepAnim(t) {
  if (!anim && queue.length) {
    const g = queue.shift(), L = g.last;
    if (!L || L.skip) { shown = decode(g.board); shownSeq = g.seq; if (L && L.skip && L.by !== mySeat) shell.toast('Turn skipped ⏭', 'info'); renderBoard(); return; }
    anim = { g, L, start: t, flight: pathLength(L.path) / SPEED * 1000, landed: false };
    if (L.by !== mySeat || (room.mode === 'bot' && L.by === 'P2')) sounds.playWhoosh();
  }
  if (!anim) return;
  const { g, L } = anim, el = t - anim.start;
  if (!anim.landed && el >= anim.flight) {
    anim.landed = true;
    // stick, then pop + drop
    const [lr, lc] = parse(L.land);
    const b = new Map(shown); b.set(L.land, L.color);
    const lp = cellPos(lr, lc);
    if (L.popped.length) {
      sounds.playBlast();
      L.popped.forEach((k) => { const [r, c] = parse(k), p = cellPos(r, c); fx.push({ kind: 'pop', x: p.x, y: p.y, col: L.color, t0: t, life: 380 }); b.delete(k); });
      (L.dropped || []).forEach((d) => { const [k, col] = d.split(':'), [r, c] = parse(k), p = cellPos(r, c); b.delete(k); fx.push({ kind: 'fall', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 80, vy: -120 - Math.random() * 80, col: +col, t0: t, life: 900 }); });
    } else sounds.playHit();
    if (L.gained) fx.push({ kind: 'text', x: lp.x, y: lp.y, text: '+' + L.gained, t0: t, life: 1100, color: '#fde047' });
    if (L.combo) fx.push({ kind: 'text', x: W / 2, y: H / 2 - 40, text: 'COMBO! 🔥', t0: t, life: 1300, color: '#fb923c', big: true });
    if (L.cleared) fx.push({ kind: 'text', x: W / 2, y: H / 2, text: 'Board cleared! +50 🎉', t0: t, life: 1600, color: '#4ade80', big: true });
    if (L.rows) fx.push({ kind: 'text', x: W / 2, y: H / 2 + 40, text: 'New rows! ⬇️', t0: t, life: 1300, color: '#fff', big: true });
    shown = b;
  }
  if (anim.landed && el >= anim.flight + 420) { shown = decode(g.board); shownSeq = g.seq; anim = null; renderBoard(); }
}

// ---------------------------------------------------------------------
// Matchmaking / status
// ---------------------------------------------------------------------
async function activateBot() {
  const tx = await roomRef.transaction((r) => {
    if (!r || r.status !== 'waiting') return;
    r.mode = 'bot'; r.status = 'playing'; r.winner = null; r.aim = null;
    r.game = freshGame('P1', r.game && r.game.seq);
    r.players = r.players || {};
    r.players.bot = { nickname: 'Computer', seat: 'P2', joinedAt: Date.now() };
    return r;
  });
  if (tx.committed) await quickMatch.clearIfMatches(roomRef.key);
}
function handleMatchmakingCountdown() {
  const alone = mySeat === 'P1' && room.status === 'waiting';
  if (!alone) { stopMatchmakingCountdown(); return; }
  if (matchmakingInterval) return;
  matchmakingSecondsLeft = (window.kqBotWaitSeconds ? kqBotWaitSeconds() : MATCH_WAIT_SECONDS);   // admin: App settings -> Multiplayer
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
function handleStatusTransition() {
  if (lastStatus === room.status) return;
  const prev = lastStatus; lastStatus = room.status;
  if (prev === null) return;
  if (room.status === 'finished') {
    try { onMultiplayerGameComplete(); } catch (e) {}
    if (mySeat === room.winner) sounds.playWin();
    else if (mySeat !== 'spectator' && room.winner !== 'draw') sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}
async function handleLeave() {
  running = false;
  stopMatchmakingCountdown();
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  listening.forEach((r) => r.off()); listening = [];
  if (playersRef) playersRef.off();
  playersMap = {}; lastStatus = null; roomRef = null; game = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------
function nameOf(seat) {
  for (const [id, p] of Object.entries(playersMap)) if (p.seat === seat) return id === playerId ? 'You' : p.nickname;
  return seat;
}
function drawBubble(x, y, col, s = 1, alpha = 1) {
  const color = PALETTE[col] || '#fff';
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x - R * s * 0.35, y - R * s * 0.35, 1, x, y, R * s);
  g.addColorStop(0, '#fff'); g.addColorStop(0.25, color); g.addColorStop(1, color);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * s - 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawGuide(angle, color, dashed, alpha) {
  if (!shown) return;
  const { path } = simulate(shown, angle);
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.setLineDash(dashed ? [2, 9] : []); ctx.lineCap = 'round';
  ctx.beginPath(); path.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  ctx.restore();
}
function pointOnPath(path, d) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= L) { const k = L ? d / L : 0; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
    d -= L;
  }
  return path[path.length - 1];
}
function draw(t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1e3a8a'); bg.addColorStop(1, '#312e81');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // danger line
  const dy = TOP_MARGIN + R + DANGER_ROW * ROWH - R;
  ctx.strokeStyle = 'rgba(248,113,113,.55)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, dy); ctx.lineTo(W, dy); ctx.stroke(); ctx.setLineDash([]);

  if (shown) for (const [k, v] of shown) { const [r, c] = parse(k), p = cellPos(r, c); drawBubble(p.x, p.y, v); }

  const g = game, playing = g && room.status === 'playing';
  // aim guides: mine while dragging, the opponent's live
  if (playing && !anim && !queue.length) {
    if (aiming && myAim != null) drawGuide(myAim, '#fff', true, 0.9);
    else if (g.turn !== mySeat && aim[g.turn] != null) drawGuide(aim[g.turn], g.turn === 'P1' ? '#86efac' : '#fca5a5', true, 0.75);
  }
  // flying bubble
  if (anim && !anim.landed) {
    const p = pointOnPath(anim.L.path, (t - anim.start) / 1000 * SPEED);
    drawBubble(p[0], p[1], anim.L.color);
  }
  // effects
  for (const f of fx) {
    const k = (t - f.t0) / f.life;
    if (f.kind === 'pop') { ctx.strokeStyle = PALETTE[f.col]; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, R * (0.6 + k * 1.2), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    else if (f.kind === 'fall') drawBubble(f.x, f.y, f.col, 1, 1 - k * 0.6);
    else if (f.kind === 'text') {
      ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.textAlign = 'center'; ctx.font = (f.big ? '800 24px' : '800 20px') + ' "Baloo 2", Rubik, sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.strokeText(f.text, f.x, f.y - k * 40); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - k * 40); ctx.globalAlpha = 1;
    }
  }
  // shooter: current + next
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(W / 2, SHOOTER_Y, R + 9, 0, Math.PI * 2); ctx.fill();
  if (g && !(anim && !anim.landed)) {
    const showCur = anim || queue.length ? (queue.length ? queue[queue.length - 1].cur : g.cur) : g.cur;
    drawBubble(W / 2, SHOOTER_Y, showCur);
    drawBubble(W - 34, SHOOTER_Y + 6, g.next, 0.62);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '600 10px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('next', W - 34, SHOOTER_Y + 26);
  }
  // turn banner + timer
  if (playing) {
    const mine = g.turn === mySeat, busy = anim || queue.length;
    const left = Math.max(0, (g.turnStart + TURN_MS - now()) / TURN_MS);
    const label = busy ? '' : mine ? 'Your turn! Drag & let go 🎯' : (room.mode === 'bot' && g.turn === 'P2' ? 'Computer is aiming… 🤖' : nameOf(g.turn) + ' is aiming…');
    if (label) {
      ctx.textAlign = 'left'; ctx.font = '700 13px "Baloo 2", Rubik, sans-serif'; ctx.fillStyle = mine ? '#fde047' : '#e0e7ff';
      ctx.fillText(label, 10, SHOOTER_Y + 22);
      if (now() >= g.turnStart) { ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(10, H - 6, W - 20, 4); ctx.fillStyle = left < 0.3 ? '#f87171' : mine ? '#fde047' : '#a5b4fc'; ctx.fillRect(10, H - 6, (W - 20) * left, 4); }
    }
  }
}

let lastBoardKey = '';
function renderBoard() {
  const g = game, sc = (g && g.scores) || { P1: 0, P2: 0 };
  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    if (mySeat === 'spectator') text = 'Watching — ' + (g ? nameOf(g.turn) + '’s turn' : '');
    else text = g && g.turn === mySeat ? 'Your turn — pop 3 or more!' : (g ? nameOf(g.turn) + '’s turn' : '');
  } else if (room.status === 'finished') {
    if (room.winner === 'draw') text = 'It’s a draw! 🤝';
    else if (mySeat === room.winner) text = 'You win the duel! 🎉';
    else if (mySeat === 'spectator') text = `${nameOf(room.winner)} wins!`;
    else text = 'You lost — play again?';
  }
  const k = [sc.P1, sc.P2, room.status, room.winner, text, g && g.turn].join('|');
  if (k === lastBoardKey) return;
  lastBoardKey = k;
  scoreP1.textContent = sc.P1 || 0;
  scoreP2.textContent = sc.P2 || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing' && g && g.turn === 'P1');
  cardP2.classList.toggle('active-turn', room.status === 'playing' && g && g.turn === 'P2');
  statusBar.textContent = text;
  statusBar.className = 'status-bar ' + (room.status === 'finished' ? (mySeat === room.winner ? 'status-won' : 'status-lost') : '');
  playAgainBtn.classList.toggle('hidden', room.status !== 'finished');
}
function renderPlayers() {
  let p1 = '--', p2 = '--', spect = 0;
  for (const [id, p] of Object.entries(playersMap)) {
    const label = id === playerId ? `${p.nickname} (you)` : p.nickname;
    if (p.seat === 'P1') p1 = label; else if (p.seat === 'P2') p2 = label; else spect++;
  }
  nameP1.textContent = p1; nameP2.textContent = p2;
  spectatorCount.textContent = spect > 0 ? `👀 ${spect} watching` : '';
  lastBoardKey = ''; renderBoard();
}

shell.bindLandingActions({ onPlay: handlePlay, onJoinCode: handleJoinCode });

// read-only peek for automated tests (no game effect)
window.__bubbleDebug = () => ({ mySeat, status: room.status, mode: room.mode, winner: room.winner, seq: game && game.seq, turn: game && game.turn, scores: game && game.scores, board: game && game.board, shownSize: shown && shown.size, anim: !!anim, queue: queue.length, canShoot: canShoot(mySeat) });
window.__bubbleShoot = (a) => shoot(mySeat, a);   // tests only: same as drag-and-release at angle a

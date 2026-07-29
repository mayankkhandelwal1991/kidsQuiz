/**
 * bubble-shooter/js/app.js
 * -----------------------------------------------------------------------
 * Each player pops bubbles on their OWN board — there's no shared board
 * state to keep in sync, so (like Typing Race / Basketball Shootout)
 * the only networked data is a shared scoreboard. Every shot, match
 * check, and cascade is resolved entirely on the shooter's own device;
 * points are pushed to `scores/{seat}` via a Firebase transaction, which
 * is contention-free because only that seat's own client ever writes it.
 * First player to reach WIN_SCORE ends the match via the same
 * transaction-guarded "attemptFinish" pattern Typing Race uses.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, randInt, clamp } from '../../common/utils.js';

const GAME_ID = 'bubble-shooter';
const MATCH_WAIT_SECONDS = 30;
const SEATS = ['P1', 'P2'];
const WIN_SCORE = 120;

const R = 15;
const COLS = 8;
const MARGIN = 22;
const TOP_MARGIN = 18;
const ROWH = 26;
const MAX_ROWS = 14;
const CANVAS_W = 300;
const CANVAS_H = 460;
const SHOOTER_Y = CANVAS_H - 30;
const BUBBLE_SPEED = 480;
const REFILL_THRESHOLD = 12;

const PALETTE = ['#33e5ff', '#ff3ec8', '#ffcf4d', '#4dffa0', '#a463ff'];

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Bubble Shooter Duel' });
const sounds = new SoundManager();

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('status-bar');
const scoreP1 = document.getElementById('score-p1');
const scoreP2 = document.getElementById('score-p2');
const cardP1 = document.getElementById('card-p1');
const cardP2 = document.getElementById('card-p2');
const nameP1 = document.getElementById('name-p1');
const nameP2 = document.getElementById('name-p2');
const spectatorCount = document.getElementById('spectator-count');
const playAgainBtn = document.getElementById('play-again-btn');

let roomRef = null;
let playersRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastStatus = null;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
let botInterval = null;

let running = false;
let canPlay = false;
let grid = {};
let shooterColor = PALETTE[0];
let nextColor = PALETTE[1];
let flying = null; // { x, y, vx, vy, color }
let sparks = [];
let myScore = 0;

// ---------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------

function key(r, c) { return `${r}_${c}`; }

function cellPos(r, c) {
  const x = MARGIN + R + c * 2 * R + (r % 2 === 1 ? R : 0);
  const y = TOP_MARGIN + R + r * ROWH;
  return { x, y };
}

function maxColFor(r) { return r % 2 === 1 ? COLS - 2 : COLS - 1; }

function neighbors(r, c) {
  if (r % 2 === 0) {
    return [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]];
  }
  return [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]];
}

function randomPaletteColor() {
  const present = [...new Set(Object.values(grid))];
  const pool = present.length ? present : PALETTE;
  return pool[randInt(0, pool.length - 1)];
}

function initGrid() {
  grid = {};
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c <= maxColFor(r); c++) {
      grid[key(r, c)] = PALETTE[randInt(0, PALETTE.length - 1)];
    }
  }
}

function bubbleCount() { return Object.keys(grid).length; }

function maxRowInGrid() {
  let m = -1;
  for (const k of Object.keys(grid)) {
    const r = parseInt(k.split('_')[0], 10);
    if (r > m) m = r;
  }
  return m;
}

function addRows() {
  const mx = maxRowInGrid();
  if (mx + 2 >= MAX_ROWS - 2) return;
  const shifted = {};
  for (const [k, color] of Object.entries(grid)) {
    const [r, c] = k.split('_').map(Number);
    shifted[key(r + 2, c)] = color;
  }
  grid = shifted;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c <= maxColFor(r); c++) {
      grid[key(r, c)] = randomPaletteColor();
    }
  }
}

function newShooterBubbles() {
  shooterColor = nextColor;
  nextColor = randomPaletteColor();
}

// ---------------------------------------------------------------------
// Boot / matchmaking (standard pattern)
// ---------------------------------------------------------------------

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    scores: { P1: 0, P2: 0 },
    winner: null,
  };
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
  } finally {
    shell.setBusy(false);
  }
}

async function handleJoinCode(rawNickname, rawCode) {
  const nickname = sanitizeNickname(rawNickname);
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) { shell.showError('Enter a room code to join.'); return; }
  shell.setBusy(true);
  try {
    const exists = await quickMatch.roomExists(code);
    if (!exists) { shell.showError(`Room "${code}" doesn't exist.`); return; }
    await enterRoom(code, nickname);
  } catch (err) {
    console.error(err);
    shell.showError('Could not join room. Check your Firebase configuration.');
  } finally {
    shell.setBusy(false);
  }
}

async function enterRoom(roomCode, nickname) {
  playerId = generatePlayerId();
  roomRef = quickMatch.roomRef(roomCode);
  playersRef = roomRef.child('players');
  selfRef = playersRef.child(playerId);

  mySeat = await claimSeat(playersRef, SEATS, playerId, nickname);
  setupPresence(selfRef);

  if (mySeat === 'P2') {
    await roomRef.transaction((room) => {
      if (room && room.status === 'waiting') room.status = 'playing';
      return room;
    });
    await quickMatch.clearIfMatches(roomCode);
  }

  attachListeners();
  playersMap = (await playersRef.once('value')).val() || {};
  renderPlayers();

  shell.showGameScreen(roomCode);
  shell.setSoundIcon(sounds.enabled);
  sounds.playJoin();
  shell.toast(mySeat === 'spectator' ? "Both seats are taken — you're spectating." : `You're ${mySeat}`, 'info');

  initGrid();
  shooterColor = randomPaletteColor();
  nextColor = randomPaletteColor();
  canPlay = mySeat === 'P1' || mySeat === 'P2';
  canvas.addEventListener('pointerdown', handleAim);
  running = true;
  requestAnimationFrame(loop);
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    handleStatusTransition(room);
    renderRoom(room);
    handleMatchmakingCountdown(room);
    maybeRunBot(room);
    canPlay = room.status === 'playing' && (mySeat === 'P1' || mySeat === 'P2');
    if (room.status === 'playing' && bubbleCount() === 0 && Object.keys(grid).length === 0) {
      // freshly (re)started match — grid already inited in enterRoom / playAgain
    }
  });

  playersRef.on('value', (snap) => {
    playersMap = snap.val() || {};
    renderPlayers();
  });

  playersRef.on('child_removed', (snap) => {
    const data = snap.val();
    if (data && (data.seat === 'P1' || data.seat === 'P2')) {
      shell.toast(`${data.nickname} left`, 'info');
      sounds.playLeave();
      resetRoomForDisconnect();
    }
  });

  watchConnectionState(db, (connected) => {
    if (!connected) shell.toast('Connection lost — reconnecting…', 'warn');
  });

  shell.bindChromeActions({
    onShare: () => { sounds.playClick(); shell.shareRoom(roomRef.key); },
    onSoundToggle: () => {
      const next = !sounds.enabled;
      sounds.setEnabled(next);
      shell.setSoundIcon(next);
    },
    onLeave: handleLeave,
  });

  playAgainBtn.addEventListener('click', () => {
    sounds.playClick();
    initGrid();
    shooterColor = randomPaletteColor();
    nextColor = randomPaletteColor();
    myScore = 0;
    flying = null;
    roomRef.transaction((room) => {
      if (!room) return room;
      room.status = 'playing';
      room.scores = { P1: 0, P2: 0 };
      room.winner = null;
      return room;
    });
  });
}

async function resetRoomForDisconnect() {
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.status = 'waiting';
    room.winner = null;
    room.scores = { P1: 0, P2: 0 };
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

// ---------------------------------------------------------------------
// Shooting
// ---------------------------------------------------------------------

function handleAim(e) {
  if (!canPlay || flying) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_W / rect.width;
  const scaleY = CANVAS_H / rect.height;
  const tx = (e.clientX - rect.left) * scaleX;
  const ty = (e.clientY - rect.top) * scaleY;

  let dx = tx - CANVAS_W / 2;
  let dy = ty - SHOOTER_Y;
  if (dy > -40) dy = -40; // always shoot upward
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;

  flying = { x: CANVAS_W / 2, y: SHOOTER_Y - R - 2, vx: dx * BUBBLE_SPEED, vy: dy * BUBBLE_SPEED, color: shooterColor };
  sounds.playClick();
}

function stepFlying(dt) {
  if (!flying) return;
  flying.x += flying.vx * dt;
  flying.y += flying.vy * dt;

  if (flying.x - R < 0) { flying.x = R; flying.vx = -flying.vx; }
  else if (flying.x + R > CANVAS_W) { flying.x = CANVAS_W - R; flying.vx = -flying.vx; }

  let collided = false;
  if (flying.y - R <= TOP_MARGIN) collided = true;
  if (!collided) {
    for (const k of Object.keys(grid)) {
      const [r, c] = k.split('_').map(Number);
      const p = cellPos(r, c);
      if (Math.hypot(p.x - flying.x, p.y - flying.y) < 2 * R - 3) { collided = true; break; }
    }
  }

  if (collided) landBubble();
}

function landBubble() {
  const estRow = clamp(Math.round((flying.y - TOP_MARGIN - R) / ROWH), 0, MAX_ROWS - 1);
  let best = null;
  let bestDist = Infinity;
  for (let r = Math.max(0, estRow - 1); r <= estRow + 1; r++) {
    for (let c = -1; c <= COLS; c++) {
      if (c < 0 || c > maxColFor(r)) continue;
      const k = key(r, c);
      if (grid[k]) continue;
      const p = cellPos(r, c);
      if (p.x < -R || p.x > CANVAS_W + R) continue;
      const d = Math.hypot(p.x - flying.x, p.y - flying.y);
      if (d < bestDist) { bestDist = d; best = { r, c }; }
    }
  }
  if (!best) best = { r: estRow, c: clamp(Math.round((flying.x - MARGIN - R) / (2 * R)), 0, maxColFor(estRow)) };

  grid[key(best.r, best.c)] = flying.color;
  const landedColor = flying.color;
  flying = null;
  resolveMatches(best.r, best.c, landedColor);
  newShooterBubbles();

  if (bubbleCount() < REFILL_THRESHOLD) addRows();
}

function resolveMatches(r, c, color) {
  const visited = new Set([key(r, c)]);
  const stack = [[r, c]];
  const group = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    for (const [nr, nc] of neighbors(cr, cc)) {
      const nk = key(nr, nc);
      if (visited.has(nk) || !grid[nk] || grid[nk] !== color) continue;
      visited.add(nk);
      stack.push([nr, nc]);
      group.push([nr, nc]);
    }
  }

  let gained = 0;
  if (group.length >= 3) {
    for (const [gr, gc] of group) {
      const p = cellPos(gr, gc);
      sparks.push({ x: p.x, y: p.y, color, t: performance.now() });
      delete grid[key(gr, gc)];
    }
    gained += group.length * 10;
    sounds.playSuccess();

    // Drop floating clusters not connected to the top row.
    const reachable = new Set();
    const q = [];
    for (const k of Object.keys(grid)) {
      const [rr, cc] = k.split('_').map(Number);
      if (rr === 0) { reachable.add(k); q.push([rr, cc]); }
    }
    while (q.length) {
      const [cr, cc] = q.pop();
      for (const [nr, nc] of neighbors(cr, cc)) {
        const nk = key(nr, nc);
        if (reachable.has(nk) || !grid[nk]) continue;
        reachable.add(nk);
        q.push([nr, nc]);
      }
    }
    let dropped = 0;
    for (const k of Object.keys(grid)) {
      if (!reachable.has(k)) {
        const [rr, cc] = k.split('_').map(Number);
        const p = cellPos(rr, cc);
        sparks.push({ x: p.x, y: p.y, color: grid[k], t: performance.now() });
        delete grid[k];
        dropped++;
      }
    }
    gained += dropped * 5;
  }

  if (gained > 0) {
    myScore += gained;
    roomRef.child('scores').child(mySeat).transaction((cur) => (cur || 0) + gained);
    if (myScore >= WIN_SCORE) attemptFinish(mySeat);
  }
}

async function attemptFinish(seat) {
  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    room.status = 'finished';
    room.winner = seat;
    return room;
  });
}

function maybeRunBot(room) {
  const shouldRun = room.mode === 'bot' && room.status === 'playing' && mySeat === 'P1';
  if (!shouldRun) {
    if (botInterval && room.status !== 'playing') { clearInterval(botInterval); botInterval = null; }
    return;
  }
  if (botInterval) return;
  let botScore = 0;
  botInterval = setInterval(() => {
    const gained = [10, 10, 20, 30][randInt(0, 3)];
    botScore += gained;
    roomRef.child('scores').child('P2').transaction((cur) => (cur || 0) + gained);
    if (botScore >= WIN_SCORE) {
      clearInterval(botInterval);
      botInterval = null;
      attemptFinish('P2');
    }
  }, randInt(1300, 2100));
}

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    room.mode = 'bot';
    room.status = 'playing';
    room.players = room.players || {};
    room.players['bot'] = { nickname: 'Computer', seat: 'P2', joinedAt: Date.now() };
    return room;
  });
  if (txResult.committed) await quickMatch.clearIfMatches(roomRef.key);
}

function handleMatchmakingCountdown(room) {
  const iAmWaitingAlone = mySeat === 'P1' && room.status === 'waiting';
  if (!iAmWaitingAlone) { stopMatchmakingCountdown(); return; }
  if (matchmakingInterval) return;
  matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
  shell.showWaitingCountdown(matchmakingSecondsLeft);
  matchmakingInterval = setInterval(() => {
    matchmakingSecondsLeft -= 1;
    if (matchmakingSecondsLeft <= 0) {
      stopMatchmakingCountdown();
      activateBot();
      return;
    }
    shell.showWaitingCountdown(matchmakingSecondsLeft);
  }, 1000);
}

function stopMatchmakingCountdown() {
  if (matchmakingInterval) { clearInterval(matchmakingInterval); matchmakingInterval = null; }
  shell.hideWaitingCountdown();
}

function handleStatusTransition(room) {
  if (lastStatus === room.status) return;
  const prev = lastStatus;
  lastStatus = room.status;
  if (prev === null) return;
  if (room.status === 'finished') {
    try { onMultiplayerGameComplete(); } catch (e) {}
    if (mySeat === room.winner) sounds.playWin();
    else if (mySeat !== 'spectator') sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

async function handleLeave() {
  running = false;
  stopMatchmakingCountdown();
  if (botInterval) { clearInterval(botInterval); botInterval = null; }
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Loop / rendering
// ---------------------------------------------------------------------

let lastFrameTime = 0;

function loop(now) {
  if (!running) return;
  const dt = Math.min((now - (lastFrameTime || now)) / 1000, 0.032);
  lastFrameTime = now;
  stepFlying(dt);
  draw(now);
  requestAnimationFrame(loop);
}

function draw(now) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(0, TOP_MARGIN);
  ctx.lineTo(CANVAS_W, TOP_MARGIN);
  ctx.stroke();

  for (const k of Object.keys(grid)) {
    const [r, c] = k.split('_').map(Number);
    const p = cellPos(r, c);
    drawBubble(p.x, p.y, grid[k]);
  }

  sparks = sparks.filter((s) => now - s.t < 350);
  for (const s of sparks) {
    const p = (now - s.t) / 350;
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = 1 - p;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, R * 0.6 + p * 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (flying) drawBubble(flying.x, flying.y, flying.color);

  // shooter
  drawBubble(CANVAS_W / 2, SHOOTER_Y, shooterColor);
  drawBubble(CANVAS_W - 30, SHOOTER_Y, nextColor, 0.65);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px Rubik, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('next', CANVAS_W - 30, SHOOTER_Y + R + 12);
}

function drawBubble(x, y, color, scale = 1) {
  ctx.beginPath();
  ctx.arc(x, y, R * scale, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - R * scale * 0.32, y - R * scale * 0.32, R * scale * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
}

function renderRoom(room) {
  const scores = room.scores || { P1: 0, P2: 0 };
  scoreP1.textContent = scores.P1 || 0;
  scoreP2.textContent = scores.P2 || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing');
  cardP2.classList.toggle('active-turn', room.status === 'playing');

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') text = mySeat === 'spectator' ? 'Watching the pop-off…' : 'Tap to aim and shoot!';
  else if (room.status === 'finished') {
    if (mySeat === room.winner) text = 'You win the duel! 🎉';
    else if (mySeat === 'spectator') text = `${room.winner} wins!`;
    else text = 'You lost — play again?';
  }
  statusBar.textContent = text;
  statusBar.className = 'status-bar ' + (room.status === 'finished' ? (mySeat === room.winner ? 'status-won' : 'status-lost') : '');

  playAgainBtn.classList.toggle('hidden', room.status !== 'finished');
}

function renderPlayers() {
  let p1Name = '--';
  let p2Name = '--';
  let spectators = 0;
  for (const [id, p] of Object.entries(playersMap)) {
    const label = id === playerId ? `${p.nickname} (you)` : p.nickname;
    if (p.seat === 'P1') p1Name = label;
    else if (p.seat === 'P2') p2Name = label;
    else spectators++;
  }
  nameP1.textContent = p1Name;
  nameP2.textContent = p2Name;
  spectatorCount.textContent = spectators > 0 ? `👀 ${spectators} watching` : '';
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

shell.bindLandingActions({ onPlay: handlePlay, onJoinCode: handleJoinCode });

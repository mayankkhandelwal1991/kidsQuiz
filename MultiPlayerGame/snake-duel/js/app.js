/**
 * snake-duel/js/app.js
 * -----------------------------------------------------------------------
 * Real-time grid Snake using the same host-authoritative model as
 * pong-duel: P1 (whoever created the room) runs the actual tick
 * simulation (movement, collisions, food) locally and throttles the
 * result to Firebase; P2 just renders that state and sends its own
 * requested direction. First to WIN_SCORE round wins takes the duel —
 * a "round" ends the instant either snake hits a wall, itself, or the
 * other snake; the survivor scores a point (a head-on crash between
 * both snakes scores nobody and just replays the round).
 *
 * KNOWN LIMITATION: same as pong-duel — because P1 is the only client
 * running the simulation, if P1 disconnects mid-match the room resets
 * the same way any other game's disconnect cleanup does, rather than
 * handing authority to P2.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, throttle, randInt } from '../../common/utils.js';

const GAME_ID = 'snake-duel';
const MATCH_WAIT_SECONDS = 10;
const SEATS = ['P1', 'P2'];
const WIN_SCORE = 5;

const GRID = 18;
const TICK_MS = 160;
const STATE_SEND_INTERVAL_MS = 80;
const ROUND_PAUSE_MS = 1600;
const BOT_THINK_MS = 160;

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Snake Duel' });
const sounds = new SoundManager();

const canvas = document.getElementById('snake-canvas');
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
const dpad = document.getElementById('dpad');

let roomRef = null;
let playersRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastStatus = null;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;

let running = false;
let tickInterval = null;
let currentMode = 'human';
let currentRoomStatus = 'waiting';
let currentWinner = null;

let myPendingDir = null;
let remoteDir = null;

// Host-authoritative state (meaningful only when mySeat === 'P1').
let host = null; // { snakes: {P1:[...], P2:[...]}, dirs, food, alive, scores, phase }

// Guest render target (meaningful only when mySeat !== 'P1').
let guestState = null;

function freshSnake(seat) {
  return seat === 'P1'
    ? [{ x: 4, y: 9 }, { x: 3, y: 9 }, { x: 2, y: 9 }]
    : [{ x: 13, y: 9 }, { x: 14, y: 9 }, { x: 15, y: 9 }];
}

function cellKey(c) { return c.x + ',' + c.y; }

function randomFood(occupied) {
  let f;
  let attempts = 0;
  do {
    f = { x: randInt(0, GRID - 1), y: randInt(0, GRID - 1) };
    attempts++;
  } while (occupied.has(cellKey(f)) && attempts < 200);
  return f;
}

function freshRound() {
  const snakes = { P1: freshSnake('P1'), P2: freshSnake('P2') };
  const occupied = new Set([...snakes.P1, ...snakes.P2].map(cellKey));
  return {
    snakes,
    dirs: { P1: 'right', P2: 'left' },
    food: randomFood(occupied),
    alive: { P1: true, P2: true },
    phase: 'playing', // 'playing' | 'roundover'
  };
}

function buildInitialRoom() {
  const round = freshRound();
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    scores: { P1: 0, P2: 0 },
    winner: null,
    lastRoundWinner: null,
    snakes: round.snakes,
    dirs: round.dirs,
    food: round.food,
    alive: round.alive,
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
  if (mySeat === 'P1' || mySeat === 'P2') {
    await selfRef.update({ dir: mySeat === 'P1' ? 'right' : 'left' });
  }
  setupPresence(selfRef);

  if (mySeat === 'P2') {
    await roomRef.transaction((room) => {
      if (room && room.status === 'waiting') room.status = 'playing';
      return room;
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
  requestAnimationFrame(drawLoop);
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    currentMode = room.mode || 'human';
    handleStatusTransition(room);
    currentRoomStatus = room.status;
    currentWinner = room.winner;

    if (mySeat !== 'P1') {
      guestState = room;
    } else if (room.status === 'playing' && !host) {
      startHostSimulation();
    } else if (room.status !== 'playing') {
      stopHostSimulation();
    }

    renderScoreboardAndStatus(room);
    handleMatchmakingCountdown(room);
  });

  playersRef.on('value', (snap) => {
    const players = snap.val() || {};
    playersMap = players;
    const oppositeSeat = mySeat === 'P1' ? 'P2' : 'P1';
    for (const p of Object.values(players)) {
      if (p.seat === oppositeSeat && p.dir) remoteDir = p.dir;
    }
    renderPlayers();
  });

  playersRef.on('child_removed', (snap) => {
    const data = snap.val();
    if (data) {
      shell.toast(`${data.nickname} left`, 'info');
      sounds.playLeave();
      if (data.seat === 'P1' || data.seat === 'P2') resetRoomForDisconnect();
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
    const round = freshRound();
    roomRef.update({
      status: 'playing', winner: null, scores: { P1: 0, P2: 0 }, lastRoundWinner: null,
      snakes: round.snakes, dirs: round.dirs, food: round.food, alive: round.alive,
    });
  });
}

async function resetRoomForDisconnect() {
  stopHostSimulation();
  const round = freshRound();
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.status = 'waiting';
    room.mode = 'human';
    room.scores = { P1: 0, P2: 0 };
    room.winner = null;
    room.lastRoundWinner = null;
    room.snakes = round.snakes;
    room.dirs = round.dirs;
    room.food = round.food;
    room.alive = round.alive;
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function bindControls() {
  window.addEventListener('keydown', (e) => {
    const map = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    const dir = map[e.key.toLowerCase()];
    if (dir) requestDirection(dir);
  });

  dpad.addEventListener('click', (e) => {
    const btn = e.target.closest('.dpad-btn');
    if (!btn) return;
    requestDirection(btn.dataset.dir);
  });

  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) requestDirection(dx > 0 ? 'right' : 'left');
    else requestDirection(dy > 0 ? 'down' : 'up');
  }, { passive: true });
}

const sendMyDirection = throttle((dir) => {
  if (selfRef) selfRef.update({ dir });
}, 60);

function requestDirection(dir) {
  if (mySeat !== 'P1' && mySeat !== 'P2') return;
  myPendingDir = dir;
  sendMyDirection(dir);
}

// ---------------------------------------------------------------------
// Host simulation
// ---------------------------------------------------------------------

function startHostSimulation() {
  host = freshRoundFromRoom();
  hostSyncFromLiveRoom();
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(hostTick, TICK_MS);
}

function stopHostSimulation() {
  host = null;
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
}

function freshRoundFromRoom() {
  return { phase: 'playing', botDir: 'left', botThinkAccum: 0 };
}

async function hostSyncFromLiveRoom() {
  const snap = await roomRef.once('value');
  const room = snap.val();
  if (!room || !host) return;
  host.snakes = room.snakes;
  host.dirs = room.dirs;
  host.food = room.food;
  host.alive = room.alive;
  host.scores = room.scores || { P1: 0, P2: 0 };
}

function nextDirFor(seat, requested, currentDir) {
  if (!requested) return currentDir;
  if (OPPOSITE[requested] === currentDir) return currentDir; // no 180 reversals
  return requested;
}

function computeBotDirection() {
  if (!host || !host.snakes) return host.dirs.P2;
  const head = host.snakes.P2[0];
  const food = host.food;
  const options = ['up', 'down', 'left', 'right'].filter((d) => OPPOSITE[d] !== host.dirs.P2);
  const occupied = new Set([...host.snakes.P1, ...host.snakes.P2].map(cellKey));

  const safe = options.filter((d) => {
    const v = DIRS[d];
    const nx = head.x + v.x, ny = head.y + v.y;
    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) return false;
    return !occupied.has(nx + ',' + ny);
  });
  const pool = safe.length ? safe : options;

  pool.sort((a, b) => {
    const da = Math.abs((head.x + DIRS[a].x) - food.x) + Math.abs((head.y + DIRS[a].y) - food.y);
    const db_ = Math.abs((head.x + DIRS[b].x) - food.x) + Math.abs((head.y + DIRS[b].y) - food.y);
    return da - db_;
  });
  return pool[0] || host.dirs.P2;
}

function hostTick() {
  if (!host || !running || currentRoomStatus !== 'playing') return;
  if (host.phase !== 'playing') return;

  const requestedP1 = myPendingDir;
  const requestedP2 = currentMode === 'bot' ? computeBotDirection() : remoteDir;

  host.dirs.P1 = nextDirFor('P1', requestedP1, host.dirs.P1);
  host.dirs.P2 = nextDirFor('P2', requestedP2, host.dirs.P2);

  const newHeads = {};
  for (const seat of SEATS) {
    if (!host.alive[seat]) continue;
    const body = host.snakes[seat];
    const v = DIRS[host.dirs[seat]];
    newHeads[seat] = { x: body[0].x + v.x, y: body[0].y + v.y };
  }

  const diedThisTick = new Set();
  const occupiedBefore = {
    P1: new Set(host.snakes.P1.map(cellKey)),
    P2: new Set(host.snakes.P2.map(cellKey)),
  };

  for (const seat of SEATS) {
    if (!host.alive[seat]) continue;
    const head = newHeads[seat];
    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) { diedThisTick.add(seat); continue; }
    const ownBodyNoTail = host.snakes[seat].slice(0, -1).map(cellKey);
    if (ownBodyNoTail.includes(cellKey(head))) { diedThisTick.add(seat); continue; }
    const otherSeat = seat === 'P1' ? 'P2' : 'P1';
    if (host.alive[otherSeat]) {
      const otherBody = host.snakes[otherSeat].map(cellKey);
      if (otherBody.includes(cellKey(head))) { diedThisTick.add(seat); continue; }
      if (newHeads[otherSeat] && newHeads[otherSeat].x === head.x && newHeads[otherSeat].y === head.y) {
        diedThisTick.add(seat); diedThisTick.add(otherSeat);
      }
    }
  }

  for (const seat of SEATS) {
    if (!host.alive[seat] || diedThisTick.has(seat)) continue;
    const head = newHeads[seat];
    const ateFood = head.x === host.food.x && head.y === host.food.y;
    host.snakes[seat] = [head, ...host.snakes[seat].slice(0, ateFood ? undefined : -1)];
    if (ateFood) {
      const occ = new Set([...host.snakes.P1, ...host.snakes.P2].map(cellKey));
      host.food = randomFood(occ);
      sounds.playTick();
    }
  }

  if (diedThisTick.size > 0) {
    for (const seat of diedThisTick) host.alive[seat] = false;
    let roundWinner = null;
    if (diedThisTick.size === 1) {
      roundWinner = [...diedThisTick][0] === 'P1' ? 'P2' : 'P1';
      host.scores[roundWinner] = (host.scores[roundWinner] || 0) + 1;
      sounds.playHit();
    }
    host.phase = 'roundover';
    const finished = roundWinner && host.scores[roundWinner] >= WIN_SCORE;
    roomRef.update({
      snakes: host.snakes, dirs: host.dirs, food: host.food, alive: host.alive,
      scores: host.scores, lastRoundWinner: roundWinner,
      status: finished ? 'finished' : 'playing',
      winner: finished ? roundWinner : null,
    });
    if (!finished) {
      setTimeout(() => {
        if (!host) return;
        const round = freshRound();
        host.snakes = round.snakes; host.dirs = round.dirs; host.food = round.food; host.alive = round.alive;
        host.phase = 'playing';
        roomRef.update({ snakes: host.snakes, dirs: host.dirs, food: host.food, alive: host.alive, lastRoundWinner: null });
      }, ROUND_PAUSE_MS);
    }
    return;
  }

  sendBoardState(host.snakes, host.dirs, host.food, host.alive);
}

const sendBoardState = throttle((snakes, dirs, food, alive) => {
  if (roomRef) roomRef.update({ snakes, dirs, food, alive });
}, STATE_SEND_INTERVAL_MS);

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    room.mode = 'bot';
    room.status = 'playing';
    room.players = room.players || {};
    room.players['bot'] = { nickname: 'Computer', seat: 'P2', joinedAt: Date.now(), dir: 'left' };
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
  stopHostSimulation();
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  guestState = null;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function drawLoop() {
  if (!running) return;
  const room = mySeat === 'P1' ? (host ? { snakes: host.snakes, food: host.food, alive: host.alive } : null) : guestState;
  draw(room);
  requestAnimationFrame(drawLoop);
}

function draw(room) {
  const cell = canvas.width / GRID;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let i = 1; i < GRID; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell); ctx.stroke();
  }

  if (!room || !room.snakes) return;

  if (room.food) {
    ctx.beginPath();
    ctx.arc((room.food.x + 0.5) * cell, (room.food.y + 0.5) * cell, cell * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#ffcf4d';
    ctx.shadowColor = '#ffcf4d';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawSnake(room.snakes.P1, '#33e5ff', room.alive ? room.alive.P1 : true, cell);
  drawSnake(room.snakes.P2, '#ff3ec8', room.alive ? room.alive.P2 : true, cell);
}

function drawSnake(body, color, alive, cell) {
  if (!body) return;
  ctx.globalAlpha = alive ? 1 : 0.28;
  body.forEach((seg, i) => {
    ctx.fillStyle = color;
    if (i === 0) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
    else { ctx.shadowBlur = 0; }
    const pad = i === 0 ? 1 : 2;
    ctx.fillRect(seg.x * cell + pad, seg.y * cell + pad, cell - pad * 2, cell - pad * 2);
  });
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function renderScoreboardAndStatus(room) {
  scoreP1.textContent = (room.scores && room.scores.P1) || 0;
  scoreP2.textContent = (room.scores && room.scores.P2) || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing' && room.alive && room.alive.P1);
  cardP2.classList.toggle('active-turn', room.status === 'playing' && room.alive && room.alive.P2);

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    if (mySeat === 'spectator') text = 'Watching the duel…';
    else if (room.lastRoundWinner) text = `${room.lastRoundWinner} wins the round!`;
    else text = 'Steer and survive!';
  } else if (room.status === 'finished') {
    if (mySeat === room.winner) text = 'You win the duel! 🎉';
    else if (mySeat === 'spectator') text = `${room.winner} wins the duel!`;
    else text = 'You lost the duel — play again?';
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

document.getElementById('win-target').textContent = WIN_SCORE;
shell.bindLandingActions({ onPlay: handlePlay, onJoinCode: handleJoinCode });

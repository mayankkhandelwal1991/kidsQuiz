/**
 * archery-duel/js/app.js
 * -----------------------------------------------------------------------
 * Structurally this is Reaction Duel with a different skill test: instead
 * of raw reaction time, both players are racing a moving 2D crosshair
 * toward the bullseye and tap to "release" at the moment they judge best.
 * The crosshair position is computed purely from local elapsed time since
 * the shared `roundStartAt + delayMs` timestamp (a sine-wave offset), so
 * no cross-device position syncing is needed — only that one shared
 * timestamp, exactly like Reaction Duel's shared GO moment. Distance from
 * center is submitted (lower = better) through the same
 * transaction-guarded round-resolution pattern.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, randInt } from '../../common/utils.js';

const GAME_ID = 'archery-duel';
const MATCH_WAIT_SECONDS = 30;
const SEATS = ['P1', 'P2'];
const WIN_SCORE = 3;
const RESULT_PAUSE_MS = 2400;
const SHOT_WINDOW_MS = 4500;

const CX = 130, CY = 130;
const AMP_X = 88, PERIOD_X = 1500;
const AMP_Y = 82, PERIOD_Y = 2050;
const PHASE_Y = 1.1;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Archery Duel' });
const sounds = new SoundManager();

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('status-bar');
const roundNum = document.getElementById('round-num');
const scoreP1 = document.getElementById('score-p1');
const scoreP2 = document.getElementById('score-p2');
const cardP1 = document.getElementById('card-p1');
const cardP2 = document.getElementById('card-p2');
const nameP1 = document.getElementById('name-p1');
const nameP2 = document.getElementById('name-p2');
const aimText = document.getElementById('aim-text');
const ringP1 = document.getElementById('ring-p1');
const ringP2 = document.getElementById('ring-p2');
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
let botTimeout = null;
let botPendingRound = null;

let goTimeout = null;
let missTimeout = null;
let goTimeLocal = 0;
let currentPhase = 'idle'; // idle | wait | go | result
let submittedThisRound = false;
let lastHandledRound = 0;
let running = false;

function randomDelayMs() {
  return randInt(1000, 2200);
}

function ringForDistance(d) {
  if (d < 12) return 10;
  if (d < 28) return 8;
  if (d < 46) return 6;
  if (d < 66) return 4;
  if (d < 90) return 2;
  return 0;
}

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    round: 1,
    roundStartAt: Date.now(),
    delayMs: randomDelayMs(),
    shots: { P1: null, P2: null },
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

  canvas.addEventListener('pointerdown', handleTap);
  running = true;
  requestAnimationFrame(draw);
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    handleStatusTransition(room);
    renderRoom(room);
    handleMatchmakingCountdown(room);
    manageLocalTimer(room);
    maybeTriggerBotShot(room);
  });

  playersRef.on('child_added', (snap) => {
    if (snap.key === playerId) return;
    playersMap[snap.key] = snap.val();
    renderPlayers();
    shell.toast(`${snap.val().nickname} joined`, 'info');
    sounds.playJoin();
  });

  playersRef.on('child_removed', (snap) => {
    const data = snap.val();
    delete playersMap[snap.key];
    renderPlayers();
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
    roomRef.transaction((room) => {
      if (!room) return room;
      room.round = 1;
      room.roundStartAt = Date.now();
      room.delayMs = randomDelayMs();
      room.shots = { P1: null, P2: null };
      room.scores = { P1: 0, P2: 0 };
      room.winner = null;
      room.status = 'playing';
      return room;
    });
  });
}

async function resetRoomForDisconnect() {
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.round = 1;
    room.roundStartAt = Date.now();
    room.delayMs = randomDelayMs();
    room.shots = { P1: null, P2: null };
    room.scores = { P1: 0, P2: 0 };
    room.winner = null;
    room.status = 'waiting';
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function reticleOffset(elapsedMs) {
  const ox = AMP_X * Math.sin((elapsedMs / PERIOD_X) * Math.PI * 2);
  const oy = AMP_Y * Math.sin((elapsedMs / PERIOD_Y) * Math.PI * 2 + PHASE_Y);
  return { ox, oy };
}

function handleTap() {
  if (mySeat !== 'P1' && mySeat !== 'P2') return;
  if (submittedThisRound || currentPhase !== 'go') return;
  submittedThisRound = true;
  const elapsed = performance.now() - goTimeLocal;
  const { ox, oy } = reticleOffset(elapsed);
  const dist = Math.round(Math.hypot(ox, oy));
  attemptSubmit(mySeat, dist);
}

async function attemptSubmit(seat, value) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    room.shots = room.shots || { P1: null, P2: null };
    if (room.shots[seat] !== null && room.shots[seat] !== undefined) return; // already submitted
    room.shots[seat] = value;

    if (room.shots.P1 !== null && room.shots.P1 !== undefined && room.shots.P2 !== null && room.shots.P2 !== undefined) {
      resolveRoundInPlace(room);
    }
    return room;
  });
  if (txResult.committed) sounds.playHit();
}

function resolveRoundInPlace(room) {
  const r1 = room.shots.P1;
  const r2 = room.shots.P2;
  const p1Miss = r1 === 'MISS';
  const p2Miss = r2 === 'MISS';

  let winnerSeat = null;
  if (p1Miss && p2Miss) {
    winnerSeat = null;
  } else if (p1Miss) {
    winnerSeat = 'P2';
  } else if (p2Miss) {
    winnerSeat = 'P1';
  } else {
    winnerSeat = r1 <= r2 ? 'P1' : 'P2';
  }

  room.lastRoundWinner = winnerSeat;

  if (winnerSeat) {
    room.scores = room.scores || { P1: 0, P2: 0 };
    room.scores[winnerSeat] = (room.scores[winnerSeat] || 0) + 1;
    if (room.scores[winnerSeat] >= WIN_SCORE) {
      room.status = 'finished';
      room.winner = winnerSeat;
    }
  }

  if (room.status !== 'finished') {
    scheduleNextRound(room.round);
  }
}

function scheduleNextRound(prevRound) {
  setTimeout(() => {
    roomRef.transaction((room) => {
      if (!room) return room;
      if (room.status !== 'playing') return;
      if (room.round !== prevRound) return;
      room.round = prevRound + 1;
      room.roundStartAt = Date.now();
      room.delayMs = randomDelayMs();
      room.shots = { P1: null, P2: null };
      room.lastRoundWinner = null;
      return room;
    });
  }, RESULT_PAUSE_MS);
}

function manageLocalTimer(room) {
  clearTimeout(goTimeout);
  clearTimeout(missTimeout);
  if (room.status !== 'playing') {
    currentPhase = 'idle';
    return;
  }

  const bothSubmitted = room.shots && room.shots.P1 != null && room.shots.P2 != null;
  if (bothSubmitted) {
    currentPhase = 'result';
    return;
  }

  if (room.round !== lastHandledRound) {
    lastHandledRound = room.round;
    submittedThisRound = false;
  }

  const goAt = (room.roundStartAt || 0) + (room.delayMs || 0);
  const remaining = goAt - Date.now();

  if (remaining > 0) {
    currentPhase = 'wait';
    goTimeout = setTimeout(() => {
      currentPhase = 'go';
      goTimeLocal = performance.now();
      sounds.playCountdown();
      scheduleMissTimeout();
    }, remaining);
  } else {
    currentPhase = 'go';
    goTimeLocal = performance.now() - Math.min(-remaining, 50);
    scheduleMissTimeout();
  }
}

function scheduleMissTimeout() {
  missTimeout = setTimeout(() => {
    if (!submittedThisRound && (mySeat === 'P1' || mySeat === 'P2')) {
      submittedThisRound = true;
      attemptSubmit(mySeat, 'MISS');
    }
  }, SHOT_WINDOW_MS);
}

function maybeTriggerBotShot(room) {
  const botCanShoot = room.mode === 'bot' && room.status === 'playing' && (room.shots ? room.shots.P2 == null : true);
  if (!botCanShoot || mySeat !== 'P1') return;
  if (botPendingRound === room.round) return;
  botPendingRound = room.round;
  clearTimeout(botTimeout);

  const goAt = (room.roundStartAt || 0) + (room.delayMs || 0);
  const fireDelay = randInt(400, SHOT_WINDOW_MS - 300);
  const fireAt = goAt + fireDelay;
  const delay = Math.max(0, fireAt - Date.now());
  const skillNoise = randInt(-15, 55); // occasionally great, occasionally sloppy
  botTimeout = setTimeout(() => {
    const dist = Math.max(2, Math.round(Math.hypot(skillNoise, randInt(-15, 15))));
    attemptSubmit('P2', dist);
  }, delay);
}

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    room.mode = 'bot';
    room.status = 'playing';
    room.roundStartAt = Date.now();
    room.delayMs = randomDelayMs();
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
    if (mySeat === room.winner) sounds.playWin();
    else if (mySeat !== 'spectator') sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

async function handleLeave() {
  running = false;
  stopMatchmakingCountdown();
  clearTimeout(botTimeout);
  clearTimeout(goTimeout);
  clearTimeout(missTimeout);
  botPendingRound = null;
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  lastHandledRound = 0;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function draw(now) {
  if (!running) return;
  ctx.clearRect(0, 0, 260, 260);

  const rings = [
    { r: 110, color: '#0b0f22' },
    { r: 92, color: '#1a2140' },
    { r: 72, color: '#33e5ff33' },
    { r: 52, color: '#ff3ec833' },
    { r: 30, color: '#ffcf4d55' },
    { r: 14, color: '#ffcf4d' },
  ];
  for (const ring of rings) {
    ctx.beginPath();
    ctx.arc(CX, CY, ring.r, 0, Math.PI * 2);
    ctx.fillStyle = ring.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.stroke();
  }

  if (currentPhase === 'go') {
    const elapsed = performance.now() - goTimeLocal;
    const { ox, oy } = reticleOffset(elapsed);
    drawCrosshair(CX + ox, CY + oy, mySeat === 'P2' ? '#ff3ec8' : '#33e5ff');
    aimText.textContent = 'Tap to release!';
  } else if (currentPhase === 'wait') {
    aimText.textContent = 'Draw your bow…';
  } else if (currentPhase === 'result') {
    aimText.textContent = 'Round result';
  } else {
    aimText.textContent = 'Get ready…';
  }

  requestAnimationFrame(draw);
}

function drawCrosshair(x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x, y + 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function formatShot(v) {
  if (v === null || v === undefined) return '--';
  if (v === 'MISS') return 'Miss!';
  return `Ring ${ringForDistance(v)}`;
}

function renderRoom(room) {
  roundNum.textContent = room.round || 1;
  scoreP1.textContent = (room.scores && room.scores.P1) || 0;
  scoreP2.textContent = (room.scores && room.scores.P2) || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing');
  cardP2.classList.toggle('active-turn', room.status === 'playing');

  ringP1.textContent = formatShot(room.shots && room.shots.P1);
  ringP2.textContent = formatShot(room.shots && room.shots.P2);

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    const bothIn = room.shots && room.shots.P1 != null && room.shots.P2 != null;
    if (bothIn) {
      text = room.lastRoundWinner ? `${room.lastRoundWinner} wins the round!` : 'Both missed — replaying!';
    } else if (mySeat === 'spectator') {
      text = 'Watching the duel…';
    } else {
      text = 'Tap when the crosshair is on the bullseye!';
    }
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

shell.bindLandingActions({ onPlay: handlePlay, onJoinCode: handleJoinCode });

/**
 * basketball-shootout/js/app.js
 * -----------------------------------------------------------------------
 * Both players shoot at their OWN hoop independently — there's no shared
 * physics to keep in sync (unlike Pong/Blaster Arena), so this plays
 * more like Typing Race: a shared match clock (raceStartAt/matchEndAt)
 * plus a scoreboard both clients read and write. Because a shot can only
 * ever be made by its own player, incrementing `scores/{seat}` via a
 * Firebase transaction is contention-free even though both players write
 * to the same room object.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, randInt, clamp } from '../../common/utils.js';

const GAME_ID = 'basketball-shootout';
const MATCH_WAIT_SECONDS = 10;
const SEATS = ['P1', 'P2'];
const COUNTDOWN_MS = 3000;
const MATCH_DURATION_MS = 45000;
const MAKE_POINTS = 2;
const ANIM_MS = 550;
const BAR_PERIOD_MS = 1150;
const BAR_X1 = 30, BAR_X2 = 290, BAR_Y = 300;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Basketball Shootout' });
const sounds = new SoundManager();

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const countdownOverlay = document.getElementById('countdown-overlay');
const timeLeftEl = document.getElementById('time-left');
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

let raceStartAt = 0;
let matchEndAt = 0;
let countdownInterval = null;
let matchTimerInterval = null;

let running = false;
let canShoot = false;
let busy = false;
let target = { start: 0.55, width: 0.16 };
let ballAnim = null; // { startedAt, type: 'make'|'miss' }
let animFrameHandle = null;

function newTarget() {
  const width = 0.14;
  const start = Math.random() * (1 - width);
  target = { start, width };
}

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    raceStartAt: null,
    matchEndAt: null,
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
      if (room && room.status === 'waiting') {
        room.status = 'playing';
        room.raceStartAt = Date.now() + COUNTDOWN_MS;
        room.matchEndAt = room.raceStartAt + MATCH_DURATION_MS;
      }
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

  canvas.addEventListener('pointerdown', handleShoot);
  running = true;
  newTarget();
  requestAnimationFrame(drawLoop);
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    handleStatusTransition(room);
    renderRoom(room);
    handleMatchmakingCountdown(room);
    manageMatchTimer(room);
    maybeRunBot(room);
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
    roomRef.transaction((room) => {
      if (!room) return room;
      room.status = 'playing';
      room.raceStartAt = Date.now() + COUNTDOWN_MS;
      room.matchEndAt = room.raceStartAt + MATCH_DURATION_MS;
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
    room.raceStartAt = null;
    room.matchEndAt = null;
    room.winner = null;
    room.scores = { P1: 0, P2: 0 };
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function handleShoot() {
  if (!canShoot || busy || (mySeat !== 'P1' && mySeat !== 'P2')) return;
  const t = (performance.now() % BAR_PERIOD_MS) / BAR_PERIOD_MS;
  const pos = t < 0.5 ? t * 2 : 2 - t * 2; // triangle wave 0..1..0
  const hit = pos >= target.start && pos <= target.start + target.width;
  busy = true;
  ballAnim = { startedAt: performance.now(), type: hit ? 'make' : 'miss' };

  if (hit) {
    sounds.playDing();
    scoreRef().transaction((cur) => (cur || 0) + MAKE_POINTS);
  } else {
    sounds.playError();
  }

  setTimeout(() => {
    busy = false;
    ballAnim = null;
    newTarget();
  }, ANIM_MS);
}

function scoreRef() {
  return roomRef.child('scores').child(mySeat);
}

function maybeRunBot(room) {
  const shouldRun = room.mode === 'bot' && room.status === 'playing' && mySeat === 'P1' && Date.now() >= (room.raceStartAt || Infinity) && Date.now() < (room.matchEndAt || 0);
  if (!shouldRun) {
    if (botInterval && room.status !== 'playing') { clearInterval(botInterval); botInterval = null; }
    return;
  }
  if (botInterval) return;
  botInterval = setInterval(() => {
    if (Date.now() >= (room.matchEndAt || 0)) { clearInterval(botInterval); botInterval = null; return; }
    if (Math.random() < 0.5) {
      roomRef.child('scores').child('P2').transaction((cur) => (cur || 0) + MAKE_POINTS);
    }
  }, randInt(1100, 1700));
}

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    room.mode = 'bot';
    room.status = 'playing';
    room.raceStartAt = Date.now() + COUNTDOWN_MS;
    room.matchEndAt = room.raceStartAt + MATCH_DURATION_MS;
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

function manageMatchTimer(room) {
  raceStartAt = room.raceStartAt || 0;
  matchEndAt = room.matchEndAt || 0;
  if (countdownInterval) clearInterval(countdownInterval);
  if (matchTimerInterval) clearInterval(matchTimerInterval);

  if (room.status !== 'playing') {
    countdownOverlay.classList.add('hidden');
    canShoot = false;
    return;
  }

  const preTick = () => {
    const remaining = raceStartAt - Date.now();
    if (remaining <= 0) {
      countdownOverlay.classList.add('hidden');
      canShoot = mySeat === 'P1' || mySeat === 'P2';
      clearInterval(countdownInterval);
      return;
    }
    countdownOverlay.classList.remove('hidden');
    countdownOverlay.textContent = Math.ceil(remaining / 1000);
  };
  preTick();
  countdownInterval = setInterval(preTick, 100);

  matchTimerInterval = setInterval(() => {
    const remaining = Math.max(0, matchEndAt - Date.now());
    const secs = Math.ceil(remaining / 1000);
    timeLeftEl.textContent = `0:${String(secs).padStart(2, '0')}`;
    if (remaining <= 0) {
      clearInterval(matchTimerInterval);
      canShoot = false;
      finalizeMatch();
    }
  }, 200);
}

async function finalizeMatch() {
  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (Date.now() < (room.matchEndAt || 0)) return;
    const s = room.scores || { P1: 0, P2: 0 };
    room.status = 'finished';
    room.winner = s.P1 === s.P2 ? null : (s.P1 > s.P2 ? 'P1' : 'P2');
    return room;
  });
}

function handleStatusTransition(room) {
  if (lastStatus === room.status) return;
  const prev = lastStatus;
  lastStatus = room.status;
  if (prev === null) return;
  if (room.status === 'finished') {
    try { onMultiplayerGameComplete(); } catch (e) {}
    if (mySeat === room.winner) sounds.playWin();
    else if (room.winner === null) sounds.playDraw();
    else if (mySeat !== 'spectator') sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

async function handleLeave() {
  running = false;
  stopMatchmakingCountdown();
  if (botInterval) { clearInterval(botInterval); botInterval = null; }
  if (countdownInterval) clearInterval(countdownInterval);
  if (matchTimerInterval) clearInterval(matchTimerInterval);
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function drawLoop(now) {
  if (!running) return;
  draw(now);
  animFrameHandle = requestAnimationFrame(drawLoop);
}

function draw(now) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0e1e';
  ctx.fillRect(0, 0, W, H);

  // backboard + rim
  ctx.fillStyle = '#e9e9f5';
  ctx.fillRect(W / 2 - 44, 40, 88, 54);
  ctx.strokeStyle = '#ff5a5a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(W / 2, 96, 26, 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  for (let i = -20; i <= 20; i += 10) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i, 96);
    ctx.lineTo(W / 2 + i, 130);
    ctx.stroke();
  }

  // power bar
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(BAR_X1, BAR_Y - 8, BAR_X2 - BAR_X1, 16);
  const zoneX1 = BAR_X1 + target.start * (BAR_X2 - BAR_X1);
  const zoneW = target.width * (BAR_X2 - BAR_X1);
  ctx.fillStyle = 'rgba(77,255,160,0.55)';
  ctx.shadowColor = '#4dffa0';
  ctx.shadowBlur = 10;
  ctx.fillRect(zoneX1, BAR_Y - 8, zoneW, 16);
  ctx.shadowBlur = 0;

  if (canShoot && !busy) {
    const t = (now % BAR_PERIOD_MS) / BAR_PERIOD_MS;
    const pos = t < 0.5 ? t * 2 : 2 - t * 2;
    const mx = BAR_X1 + pos * (BAR_X2 - BAR_X1);
    ctx.fillStyle = '#33e5ff';
    ctx.shadowColor = '#33e5ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(mx, BAR_Y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ball
  let ballX = W / 2, ballY = BAR_Y - 20;
  if (ballAnim) {
    const p = clamp((now - ballAnim.startedAt) / ANIM_MS, 0, 1);
    if (ballAnim.type === 'make') {
      ballX = lerp2(W / 2, W / 2, p);
      ballY = lerp2(BAR_Y - 20, 96, p);
    } else {
      const dir = Math.random() < 0.5 ? -1 : 1;
      ballX = lerp2(W / 2, W / 2 + dir * 46, p);
      ballY = lerp2(BAR_Y - 20, 150, easeOutBounce(p));
    }
  }
  ctx.beginPath();
  ctx.arc(ballX, ballY, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#ff9f43';
  ctx.fill();
  ctx.strokeStyle = '#7a3d0a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (!canShoot && !ballAnim) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px Rubik, sans-serif';
    ctx.textAlign = 'center';
  }
}

function lerp2(a, b, t) { return a + (b - a) * t; }
function easeOutBounce(t) { return 1 - Math.pow(1 - t, 2); }

function renderRoom(room) {
  const scores = room.scores || { P1: 0, P2: 0 };
  scoreP1.textContent = scores.P1 || 0;
  scoreP2.textContent = scores.P2 || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing');
  cardP2.classList.toggle('active-turn', room.status === 'playing');

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') text = mySeat === 'spectator' ? 'Watching the shootout…' : 'Tap when the marker hits the green zone!';
  else if (room.status === 'finished') {
    if (room.winner === null) text = "It's a tie!";
    else if (mySeat === room.winner) text = 'You win the shootout! 🎉';
    else if (mySeat === 'spectator') text = `${room.winner} wins!`;
    else text = 'You lost — play again?';
  }
  statusBar.textContent = text;
  statusBar.className = 'status-bar ' + (room.status === 'finished' ? (room.winner === null ? 'status-draw' : (mySeat === room.winner ? 'status-won' : 'status-lost')) : '');

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

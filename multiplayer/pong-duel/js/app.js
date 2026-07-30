/**
 * pong-duel/js/app.js
 * -----------------------------------------------------------------------
 * Real-time canvas Pong using a host-authoritative model: P1 (whoever
 * created the room) runs the actual ball physics locally every frame and
 * throttles the result to Firebase; P2 just renders that state and sends
 * its own paddle position. This avoids two clients disagreeing about
 * physics and keeps the network traffic light (one small ball update
 * ~20x/sec instead of trying to keep two independent simulations in
 * lockstep).
 *
 * KNOWN LIMITATION: because P1 is the only client running physics, if
 * the P1 player disconnects mid-rally the match pauses/resets (handled
 * the same way as every other game's disconnect cleanup) rather than
 * handing physics authority to P2. For a casual game this trade-off is
 * fine; a production version would likely use a small server instead.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, clamp, lerp, throttle } from '../../common/utils.js';

const GAME_ID = 'pong-duel';
const MATCH_WAIT_SECONDS = 10;
const SEATS = ['P1', 'P2'];

const W = 480;
const H = 300;
const PADDLE_W = 10;
const PADDLE_H = 64;
const BALL_R = 6;
const P1_X = 14;
const P2_X = W - 14 - PADDLE_W;
const WIN_SCORE = 7;
const BASE_SPEED = 220;
const MAX_SPEED = 480;
const KEYBOARD_SPEED = 320;
const BOT_SPEED = 230;

const BALL_SEND_INTERVAL_MS = 50;
const PADDLE_SEND_INTERVAL_MS = 60;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Pong Duel' });
const sounds = new SoundManager();

const canvas = document.getElementById('pong-canvas');
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

let running = false;
let lastFrameTime = 0;
let myPaddleY = H / 2;
let remoteOpponentPaddleY = H / 2;
let botPaddleY = H / 2;
let currentMode = 'human';
let currentRoomStatus = 'waiting';
let currentWinner = null;

// Host-authoritative state (meaningful only when mySeat === 'P1').
let hostBall = null;
let hostScores = { P1: 0, P2: 0 };
let hostRunning = false;

// Guest render target (meaningful only when mySeat === 'P2' or spectator).
let renderBall = { x: W / 2, y: H / 2 };
let targetBall = { x: W / 2, y: H / 2 };
let guestScores = { P1: 0, P2: 0 };

const keys = {};

function freshBall(direction = Math.random() < 0.5 ? 1 : -1) {
  return {
    x: W / 2,
    y: H / 2,
    vx: direction * BASE_SPEED,
    vy: (Math.random() * 2 - 1) * (BASE_SPEED * 0.6),
  };
}

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    ball: freshBall(),
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
  if (mySeat === 'P1' || mySeat === 'P2') {
    await selfRef.update({ paddleY: H / 2 });
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
  lastFrameTime = performance.now();
  requestAnimationFrame(loop);
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
      targetBall = room.ball || targetBall;
      guestScores = room.scores || guestScores;
    } else if (room.status === 'playing' && !hostRunning) {
      hostBall = freshBall();
      hostScores = { P1: 0, P2: 0 };
      hostRunning = true;
    } else if (room.status !== 'playing') {
      hostRunning = false;
    }

    renderScoreboardAndStatus(room);
    handleMatchmakingCountdown(room);
  });

  playersRef.on('value', (snap) => {
    const players = snap.val() || {};
    playersMap = players;
    const oppositeSeat = mySeat === 'P1' ? 'P2' : 'P1';
    for (const p of Object.values(players)) {
      if (p.seat === oppositeSeat && typeof p.paddleY === 'number') {
        remoteOpponentPaddleY = p.paddleY;
      }
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
    roomRef.update({ status: 'playing', winner: null, scores: { P1: 0, P2: 0 } });
  });
}

async function resetRoomForDisconnect() {
  hostRunning = false;
  await roomRef.update({
    status: 'waiting',
    winner: null,
    scores: { P1: 0, P2: 0 },
    ball: freshBall(),
    mode: 'human',
  });
  if (playersMap.bot) {
    await playersRef.child('bot').remove();
  }
}

function bindControls() {
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  canvas.addEventListener('pointermove', (e) => {
    if (mySeat !== 'P1' && mySeat !== 'P2') return;
    const rect = canvas.getBoundingClientRect();
    const scaleY = H / rect.height;
    const y = (e.clientY - rect.top) * scaleY;
    myPaddleY = clamp(y, PADDLE_H / 2, H - PADDLE_H / 2);
  });
}

const sendMyPaddle = throttle((y) => {
  if (selfRef) selfRef.update({ paddleY: y });
}, PADDLE_SEND_INTERVAL_MS);

const sendBallState = throttle((ball, scores) => {
  if (roomRef) roomRef.update({ ball, scores });
}, BALL_SEND_INTERVAL_MS);

function loop(now) {
  if (!running) return;
  const dt = Math.min((now - lastFrameTime) / 1000, 0.032);
  lastFrameTime = now;

  if (mySeat === 'P1' || mySeat === 'P2') {
    if (keys['arrowup'] || keys['w']) myPaddleY = clamp(myPaddleY - KEYBOARD_SPEED * dt, PADDLE_H / 2, H - PADDLE_H / 2);
    if (keys['arrowdown'] || keys['s']) myPaddleY = clamp(myPaddleY + KEYBOARD_SPEED * dt, PADDLE_H / 2, H - PADDLE_H / 2);
    sendMyPaddle(myPaddleY);
  }

  if (mySeat === 'P1' && hostRunning) {
    stepHostPhysics(dt);
  } else if (mySeat !== 'P1') {
    renderBall.x = lerp(renderBall.x, targetBall.x, clamp(10 * dt, 0, 1));
    renderBall.y = lerp(renderBall.y, targetBall.y, clamp(10 * dt, 0, 1));
  }

  if (currentMode === 'bot' && mySeat === 'P1' && hostRunning) {
    const target = hostBall.y;
    const diff = target - botPaddleY;
    const maxStep = BOT_SPEED * dt;
    botPaddleY = clamp(botPaddleY + clamp(diff, -maxStep, maxStep), PADDLE_H / 2, H - PADDLE_H / 2);
  }

  draw();
  requestAnimationFrame(loop);
}

function stepHostPhysics(dt) {
  const ball = hostBall;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.y - BALL_R <= 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }
  else if (ball.y + BALL_R >= H) { ball.y = H - BALL_R; ball.vy = -Math.abs(ball.vy); }

  const p2Y = currentMode === 'bot' ? botPaddleY : remoteOpponentPaddleY;

  // Left paddle (P1, the host) collision.
  if (ball.vx < 0 && ball.x - BALL_R <= P1_X + PADDLE_W && ball.x - BALL_R >= P1_X - 6 && ball.y >= myPaddleY - PADDLE_H / 2 && ball.y <= myPaddleY + PADDLE_H / 2) {
    const offset = (ball.y - myPaddleY) / (PADDLE_H / 2);
    ball.vx = clamp(Math.abs(ball.vx) * 1.04, BASE_SPEED, MAX_SPEED);
    ball.vy = offset * (BASE_SPEED * 0.9);
    ball.x = P1_X + PADDLE_W + BALL_R;
    sounds.playHit();
  }

  // Right paddle (P2 or bot) collision.
  if (ball.vx > 0 && ball.x + BALL_R >= P2_X && ball.x + BALL_R <= P2_X + 6 && ball.y >= p2Y - PADDLE_H / 2 && ball.y <= p2Y + PADDLE_H / 2) {
    const offset = (ball.y - p2Y) / (PADDLE_H / 2);
    ball.vx = -clamp(Math.abs(ball.vx) * 1.04, BASE_SPEED, MAX_SPEED);
    ball.vy = offset * (BASE_SPEED * 0.9);
    ball.x = P2_X - BALL_R;
    sounds.playHit();
  }

  let scored = false;
  if (ball.x < -20) {
    hostScores.P2 += 1;
    scored = true;
    hostBall = freshBall(-1);
  } else if (ball.x > W + 20) {
    hostScores.P1 += 1;
    scored = true;
    hostBall = freshBall(1);
  }

  if (scored) {
    sounds.playWhoosh();
    if (hostScores.P1 >= WIN_SCORE || hostScores.P2 >= WIN_SCORE) {
      hostRunning = false;
      const winner = hostScores.P1 >= WIN_SCORE ? 'P1' : 'P2';
      roomRef.update({ status: 'finished', winner, scores: hostScores, ball: hostBall });
      return;
    }
  }

  sendBallState(hostBall, hostScores);
}

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    room.mode = 'bot';
    room.status = 'playing';
    room.players = room.players || {};
    room.players['bot'] = { nickname: 'Computer', seat: 'P2', joinedAt: Date.now(), paddleY: H / 2 };
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
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  hostRunning = false;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  const myX = mySeat === 'P2' ? P2_X : P1_X;
  const otherX = mySeat === 'P2' ? P1_X : P2_X;
  const otherY = mySeat === 'P1' ? (currentMode === 'bot' ? botPaddleY : remoteOpponentPaddleY) : remoteOpponentPaddleY;

  drawPaddle(myX, myPaddleY, mySeat === 'P2' ? '#ff3ec8' : '#33e5ff');
  drawPaddle(otherX, otherY, mySeat === 'P2' ? '#33e5ff' : '#ff3ec8');

  const ballPos = mySeat === 'P1' ? hostBall || { x: W / 2, y: H / 2 } : renderBall;
  ctx.beginPath();
  ctx.arc(ballPos.x, ballPos.y, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawPaddle(x, y, color) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillRect(x, y - PADDLE_H / 2, PADDLE_W, PADDLE_H);
  ctx.shadowBlur = 0;
}

function renderScoreboardAndStatus(room) {
  const scores = mySeat === 'P1' ? hostScores : (room.scores || guestScores);
  scoreP1.textContent = (scores && scores.P1) || 0;
  scoreP2.textContent = (scores && scores.P2) || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing');
  cardP2.classList.toggle('active-turn', room.status === 'playing');

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') text = mySeat === 'spectator' ? 'Watching the rally…' : 'Move your paddle and defend!';
  else if (room.status === 'finished') {
    if (mySeat === room.winner) text = 'You win! 🎉';
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

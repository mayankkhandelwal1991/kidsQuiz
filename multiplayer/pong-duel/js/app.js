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

// Portrait table, same look as the single-player Ping Pong. World coordinates:
// P1's paddle is at the bottom, P2's at the top. P2 sees the table turned
// round (rotated 180°) so everyone plays from the bottom of the screen.
const W = 300;
const H = 480;
const PADDLE_W = 72;   // paddle length (along x)
const PADDLE_T = 14;   // paddle thickness
const BALL_R = 8;
const EDGE = 26;       // paddle distance from the table end
const P1_TOP = H - EDGE - PADDLE_T;  // P1 (bottom) paddle front face
const P2_BOT = EDGE + PADDLE_T;      // P2 (top) paddle front face
const WIN_SCORE = 7;
const BASE_SPEED = 240;
const MAX_SPEED = 520;
const KEYBOARD_SPEED = 360;
const BOT_SPEED = 250;
const SERVE_WAIT = 0.9;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

const BALL_SEND_INTERVAL_MS = 50;
const PADDLE_SEND_INTERVAL_MS = 60;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Ping Pong Duel' });
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
let myPaddleX = W / 2;          // world x of my paddle
let remoteOpponentPaddleX = W / 2;
let botPaddleX = W / 2;
let trail = [];
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

// direction +1 = towards P1 (bottom), -1 = towards P2 (top). The ball waits a moment before the serve.
function freshBall(direction = Math.random() < 0.5 ? 1 : -1) {
  return {
    x: W / 2,
    y: H / 2,
    vx: (Math.random() * 2 - 1) * (BASE_SPEED * 0.45),
    vy: direction * BASE_SPEED,
    wait: SERVE_WAIT,
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
    await selfRef.update({ paddleX: W / 2 });
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
      if (p.seat === oppositeSeat && typeof p.paddleX === 'number') {
        remoteOpponentPaddleX = p.paddleX;
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

  const follow = (e) => {
    if (mySeat !== 'P1' && mySeat !== 'P2') return;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (W / rect.width);
    const x = mySeat === 'P2' ? W - sx : sx;   // P2's view is turned round
    myPaddleX = clamp(x, PADDLE_W / 2, W - PADDLE_W / 2);
  };
  canvas.addEventListener('pointerdown', follow);
  canvas.addEventListener('pointermove', follow);
}

const sendMyPaddle = throttle((x) => {
  if (selfRef) selfRef.update({ paddleX: Math.round(x * 10) / 10 });
}, PADDLE_SEND_INTERVAL_MS);

const sendBallState = throttle((ball, scores) => {
  if (roomRef) roomRef.update({ ball, scores });
}, BALL_SEND_INTERVAL_MS);

function loop(now) {
  if (!running) return;
  const dt = Math.min((now - lastFrameTime) / 1000, 0.032);
  lastFrameTime = now;

  if (mySeat === 'P1' || mySeat === 'P2') {
    const flip = mySeat === 'P2' ? -1 : 1;  // ← → follow the screen, not the world
    if (keys['arrowleft'] || keys['a']) myPaddleX = clamp(myPaddleX - flip * KEYBOARD_SPEED * dt, PADDLE_W / 2, W - PADDLE_W / 2);
    if (keys['arrowright'] || keys['d']) myPaddleX = clamp(myPaddleX + flip * KEYBOARD_SPEED * dt, PADDLE_W / 2, W - PADDLE_W / 2);
    sendMyPaddle(myPaddleX);
  }

  if (mySeat === 'P1' && hostRunning) {
    stepHostPhysics(dt);
  } else if (mySeat !== 'P1') {
    if (Math.hypot(targetBall.x - renderBall.x, targetBall.y - renderBall.y) > 120) { renderBall.x = targetBall.x; renderBall.y = targetBall.y; } // new serve: jump
    renderBall.x = lerp(renderBall.x, targetBall.x, clamp(12 * dt, 0, 1));
    renderBall.y = lerp(renderBall.y, targetBall.y, clamp(12 * dt, 0, 1));
  }

  if (currentMode === 'bot' && mySeat === 'P1' && hostRunning) {
    // the Computer follows the ball when it comes its way, with a little wobble so it can be beaten
    const target = hostBall.vy < 0 && !hostBall.wait ? hostBall.x + Math.sin(now / 420) * 24 : W / 2;
    const diff = target - botPaddleX;
    const maxStep = BOT_SPEED * dt;
    botPaddleX = clamp(botPaddleX + clamp(diff, -maxStep, maxStep), PADDLE_W / 2, W - PADDLE_W / 2);
  }

  const bp = mySeat === 'P1' ? (hostBall || { x: W / 2, y: H / 2 }) : renderBall;
  trail.push({ x: bp.x, y: bp.y }); if (trail.length > 10) trail.shift();

  draw();
  requestAnimationFrame(loop);
}

function stepHostPhysics(dt) {
  const ball = hostBall;
  if (ball.wait > 0) { ball.wait = Math.max(0, ball.wait - dt); sendBallState(hostBall, hostScores); return; }
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x - BALL_R <= 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
  else if (ball.x + BALL_R >= W) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }

  const p2X = currentMode === 'bot' ? botPaddleX : remoteOpponentPaddleX;

  // Bottom paddle (P1, the host).
  if (ball.vy > 0 && ball.y + BALL_R >= P1_TOP && ball.y + BALL_R <= P1_TOP + PADDLE_T + 8 && Math.abs(ball.x - myPaddleX) <= PADDLE_W / 2 + BALL_R) {
    const offset = clamp((ball.x - myPaddleX) / (PADDLE_W / 2), -1, 1);
    ball.vy = -clamp(Math.abs(ball.vy) * 1.05, BASE_SPEED, MAX_SPEED);
    ball.vx = offset * (BASE_SPEED * 1.1);
    ball.y = P1_TOP - BALL_R;
    sounds.playHit();
  }

  // Top paddle (P2 or the Computer).
  if (ball.vy < 0 && ball.y - BALL_R <= P2_BOT && ball.y - BALL_R >= P2_BOT - PADDLE_T - 8 && Math.abs(ball.x - p2X) <= PADDLE_W / 2 + BALL_R) {
    const offset = clamp((ball.x - p2X) / (PADDLE_W / 2), -1, 1);
    ball.vy = clamp(Math.abs(ball.vy) * 1.05, BASE_SPEED, MAX_SPEED);
    ball.vx = offset * (BASE_SPEED * 1.1);
    ball.y = P2_BOT + BALL_R;
    sounds.playHit();
  }

  let scored = false;
  if (ball.y > H + 20) {        // went past P1
    hostScores.P2 += 1;
    scored = true;
    hostBall = freshBall(1);
  } else if (ball.y < -20) {    // went past P2
    hostScores.P1 += 1;
    scored = true;
    hostBall = freshBall(-1);
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
    room.players['bot'] = { nickname: 'Computer', seat: 'P2', joinedAt: Date.now(), paddleX: W / 2 };
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

canvas.width = W * DPR;
canvas.height = H * DPR;
const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // table (symmetric, so it looks the same from both ends)
  ctx.fillStyle = '#1d4ed8'; rr(0, 0, W, H, 16); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; rr(8, 8, W - 16, H - 16, 10); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2, 8); ctx.lineTo(W / 2, H - 8); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(0, H / 2 - 3, W, 6);

  // everything below is drawn in world coordinates; P2 sees the table turned round
  if (mySeat === 'P2') { ctx.translate(W, H); ctx.rotate(Math.PI); }
  const p2X = mySeat === 'P1' ? (currentMode === 'bot' ? botPaddleX : remoteOpponentPaddleX) : (mySeat === 'P2' ? myPaddleX : remoteOpponentPaddleX);
  const p1X = mySeat === 'P1' ? myPaddleX : remoteOpponentPaddleX;
  const meP1 = mySeat !== 'P2';   // spectators watch from P1's end
  drawPaddle(p1X, P1_TOP, meP1 ? '#22c55e' : '#ef4444', true);
  drawPaddle(p2X, EDGE, meP1 ? '#ef4444' : '#22c55e', false);

  const ballPos = mySeat === 'P1' ? hostBall || { x: W / 2, y: H / 2 } : renderBall;
  trail.forEach((p, i) => { ctx.globalAlpha = (i / trail.length) * 0.4; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R * (i / trail.length), 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(ballPos.x + 5, ballPos.y + 6, BALL_R, BALL_R * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(ballPos.x - 3, ballPos.y - 3, 1, ballPos.x, ballPos.y, BALL_R);
  g.addColorStop(0, '#fff'); g.addColorStop(1, '#fdba74');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ballPos.x, ballPos.y, BALL_R, 0, Math.PI * 2); ctx.fill();

  // score on the table while the ball waits to be served (my score first)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const waiting = mySeat === 'P1' ? hostBall && hostBall.wait > 0 : targetBall && targetBall.wait > 0;
  if (waiting && currentRoomStatus === 'playing') {
    const sc = mySeat === 'P1' ? hostScores : guestScores, mine = mySeat === 'P2' ? 'P2' : 'P1', other = mine === 'P1' ? 'P2' : 'P1';
    ctx.font = '800 30px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText(((sc && sc[mine]) || 0) + ' – ' + ((sc && sc[other]) || 0), W / 2, H / 2 + 40);
  }
}

// y = the paddle's top edge (world). `near` = the paddle at the bottom end (its handle points down).
function drawPaddle(x, y, color, near) {
  ctx.fillStyle = 'rgba(0,0,0,.2)'; rr(x - PADDLE_W / 2 + 3, y + 4, PADDLE_W, PADDLE_T, 7); ctx.fill();
  ctx.fillStyle = '#92400e'; ctx.fillRect(x - 6, near ? y + PADDLE_T - 2 : y - 22, 12, 24);
  ctx.fillStyle = color; rr(x - PADDLE_W / 2, y, PADDLE_W, PADDLE_T, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.4)'; rr(x - PADDLE_W / 2 + 6, y + 3, PADDLE_W * 0.5, 4, 2); ctx.fill();
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

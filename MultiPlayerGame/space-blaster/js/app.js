/**
 * space-blaster/js/app.js
 * -----------------------------------------------------------------------
 * Real-time 1v1 arcade shooter. Both players see the SAME falling
 * asteroid field (host-authoritative simulation, exactly like Pong
 * Duel's ball) and race to tap/click asteroids before the other player
 * does. Whoever's shot lands first gets the point.
 *
 * P1 (the host) runs the actual physics + spawn schedule locally and
 * broadcasts a throttled snapshot. P1's own clicks are resolved
 * instantly against its local simulation; P2's clicks are sent as a
 * lightweight "shot" event that the host resolves against its own
 * live asteroid positions the moment it arrives — this keeps shot
 * resolution fair and avoids two clients disagreeing about who hit
 * what first.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, clamp, lerp, throttle, randInt } from '../../common/utils.js';

const GAME_ID = 'space-blaster';
const MATCH_WAIT_SECONDS = 10;
const SEATS = ['P1', 'P2'];

const W = 480;
const H = 320;
const WIN_SCORE = 15;
const MAX_ASTEROIDS = 6;
const SPAWN_INTERVAL_MS = 950;
const HIT_RADIUS = 30;
const STATE_SEND_INTERVAL_MS = 90;
const TURRET_Y = H - 20;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Space Blaster Duel' });
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
let shotsRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastStatus = null;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;

let running = false;
let lastFrameTime = 0;
let currentMode = 'human';
let currentWinner = null;

// Host-authoritative state (meaningful only when mySeat === 'P1').
let hostAsteroids = {};
let hostScores = { P1: 0, P2: 0 };
let hostRunning = false;
let hostNextId = 1;
let lastSpawnAt = 0;
let botFireAt = 0;

// Render state (used by everyone for drawing; guests lerp toward target).
let renderAsteroids = {};
let targetAsteroids = {};
let guestScores = { P1: 0, P2: 0 };
let beams = []; // transient laser-beam visuals: {x1,y1,x2,y2,color,t}
let sparks = []; // transient hit-spark visuals: {x,y,color,t}

function randomAsteroid(id) {
  return {
    id,
    x: randInt(30, W - 30),
    y: -20,
    vy: randInt(40, 85),
    r: randInt(14, 22),
  };
}

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    asteroids: {},
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
  shotsRef = roomRef.child('shots');
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
    currentWinner = room.winner;

    if (mySeat !== 'P1') {
      targetAsteroids = room.asteroids || {};
      guestScores = room.scores || guestScores;
    } else if (room.status === 'playing' && !hostRunning) {
      hostAsteroids = {};
      hostScores = { P1: 0, P2: 0 };
      hostNextId = 1;
      lastSpawnAt = performance.now();
      botFireAt = performance.now() + randInt(600, 1200);
      hostRunning = true;
    } else if (room.status !== 'playing') {
      hostRunning = false;
    }

    renderScoreboardAndStatus(room);
    handleMatchmakingCountdown(room);
  });

  playersRef.on('value', (snap) => {
    playersMap = snap.val() || {};
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

  if (mySeat === 'P1') {
    shotsRef.on('child_added', (snap) => {
      const shot = snap.val();
      if (shot && shot.seat === 'P2') processShotHost('P2', shot.x, shot.y);
      snap.ref.remove();
    });
  }

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
    roomRef.update({ status: 'playing', winner: null, scores: { P1: 0, P2: 0 }, asteroids: {} });
  });
}

async function resetRoomForDisconnect() {
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.status = 'waiting';
    room.mode = 'human';
    room.winner = null;
    room.scores = { P1: 0, P2: 0 };
    room.asteroids = {};
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function bindControls() {
  const fire = (clientX, clientY) => {
    if (mySeat !== 'P1' && mySeat !== 'P2') return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    spawnBeam(mySeat, x, y);
    if (mySeat === 'P1') {
      processShotHost('P1', x, y);
    } else {
      shotsRef.push({ seat: 'P2', x, y });
    }
  };
  canvas.addEventListener('pointerdown', (e) => fire(e.clientX, e.clientY));
}

function spawnBeam(seat, x, y) {
  const originX = seat === 'P1' ? 60 : W - 60;
  beams.push({ x1: originX, y1: TURRET_Y, x2: x, y2: y, color: seat === 'P1' ? '#33e5ff' : '#ff3ec8', t: performance.now() });
  sounds.playClick();
}

function processShotHost(seat, x, y) {
  if (!hostRunning) return;
  let bestId = null;
  let bestDist = Infinity;
  for (const id of Object.keys(hostAsteroids)) {
    const a = hostAsteroids[id];
    const d = Math.hypot(a.x - x, a.y - y);
    if (d <= HIT_RADIUS + a.r && d < bestDist) { bestDist = d; bestId = id; }
  }
  if (bestId === null) return;
  const hit = hostAsteroids[bestId];
  sparks.push({ x: hit.x, y: hit.y, color: seat === 'P1' ? '#33e5ff' : '#ff3ec8', t: performance.now() });
  delete hostAsteroids[bestId];
  hostScores[seat] = (hostScores[seat] || 0) + 1;
  sounds.playHit();

  if (hostScores[seat] >= WIN_SCORE) {
    hostRunning = false;
    roomRef.update({ status: 'finished', winner: seat, scores: hostScores, asteroids: hostAsteroids });
    return;
  }
  sendState();
}

const sendState = throttle(() => {
  if (roomRef && hostRunning) roomRef.update({ asteroids: hostAsteroids, scores: hostScores });
}, STATE_SEND_INTERVAL_MS);

function stepHostPhysics(dt, now) {
  for (const id of Object.keys(hostAsteroids)) {
    const a = hostAsteroids[id];
    a.y += a.vy * dt;
    if (a.y - a.r > H + 20) delete hostAsteroids[id];
  }
  if (now - lastSpawnAt > SPAWN_INTERVAL_MS && Object.keys(hostAsteroids).length < MAX_ASTEROIDS) {
    const id = 'a' + hostNextId++;
    hostAsteroids[id] = randomAsteroid(id);
    lastSpawnAt = now;
  }

  if (currentMode === 'bot' && now >= botFireAt) {
    const ids = Object.keys(hostAsteroids).filter((id) => hostAsteroids[id].y > 40);
    if (ids.length) {
      let target = hostAsteroids[ids[0]];
      for (const id of ids) if (hostAsteroids[id].y > target.y) target = hostAsteroids[id];
      spawnBeam('P2', target.x, target.y);
      processShotHost('P2', target.x, target.y);
    }
    botFireAt = now + randInt(650, 1250);
  }

  sendState();
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
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  if (shotsRef) shotsRef.off();
  playersMap = {};
  lastStatus = null;
  hostRunning = false;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Loop / rendering
// ---------------------------------------------------------------------

function loop(now) {
  if (!running) return;
  const dt = Math.min((now - lastFrameTime) / 1000, 0.032);
  lastFrameTime = now;

  if (mySeat === 'P1' && hostRunning) {
    stepHostPhysics(dt, now);
    renderAsteroids = hostAsteroids;
  } else if (mySeat !== 'P1') {
    const next = {};
    for (const id of Object.keys(targetAsteroids)) {
      const t = targetAsteroids[id];
      const prev = renderAsteroids[id];
      next[id] = prev
        ? { ...t, x: lerp(prev.x, t.x, clamp(12 * dt, 0, 1)), y: lerp(prev.y, t.y, clamp(12 * dt, 0, 1)) }
        : { ...t };
    }
    renderAsteroids = next;
  }

  draw(now);
  requestAnimationFrame(loop);
}

function draw(now) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, W, H);

  // starfield
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40; i++) {
    const sx = (i * 53) % W;
    const sy = (i * 97 + (now / 40)) % H;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }

  drawTurret(60, TURRET_Y, '#33e5ff');
  drawTurret(W - 60, TURRET_Y, '#ff3ec8');

  const asteroids = mySeat === 'P1' ? hostAsteroids : renderAsteroids;
  for (const id of Object.keys(asteroids)) {
    const a = asteroids[id];
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
    ctx.fillStyle = '#8a7a6a';
    ctx.fill();
    ctx.strokeStyle = '#c9b8a4';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(a.x - a.r * 0.3, a.y - a.r * 0.25, a.r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
  }

  beams = beams.filter((b) => now - b.t < 140);
  for (const b of beams) {
    const alpha = 1 - (now - b.t) / 140;
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 3;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  sparks = sparks.filter((s) => now - s.t < 300);
  for (const s of sparks) {
    const p = (now - s.t) / 300;
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = 1 - p;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6 + p * 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawTurret(x, y, color) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(x - 14, y + 14);
  ctx.lineTo(x + 14, y + 14);
  ctx.lineTo(x, y - 16);
  ctx.closePath();
  ctx.fill();
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
  else if (room.status === 'playing') text = mySeat === 'spectator' ? 'Watching the blast-off…' : 'Blast asteroids before they blast past you!';
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

/**
 * blaster-arena/js/app.js
 * -----------------------------------------------------------------------
 * Real-time top-down 1v1 arena shooter (foam-bolt "blasters", not real
 * weapons — cartoon arena, no gore). Each player moves their own avatar
 * locally (WASD/arrows or the on-screen d-pad) and throttles their
 * position to Firebase, exactly like Pong Duel's paddleY. P1 (the host)
 * is the sole authority for bolt physics and hit detection — bolts
 * fired by P2 are sent as lightweight "fire" events that the host spawns
 * and simulates locally, the same host-authoritative pattern Pong Duel
 * uses for its ball.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, clamp, lerp, throttle, randInt } from '../../common/utils.js';

const GAME_ID = 'blaster-arena';
const MATCH_WAIT_SECONDS = 10;
const SEATS = ['P1', 'P2'];

const W = 480;
const H = 320;
const PLAYER_R = 14;
const BOLT_R = 5;
const BOLT_SPEED = 280;
const MOVE_SPEED = 170;
const WIN_SCORE = 5;
const FIRE_COOLDOWN_MS = 450;
const POS_SEND_INTERVAL_MS = 70;
const STATE_SEND_INTERVAL_MS = 80;

const OBSTACLES = [
  { x: 140, y: 70, w: 24, h: 100 },
  { x: 316, y: 150, w: 24, h: 100 },
  { x: 214, y: 20, w: 52, h: 16 },
];

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Blaster Arena' });
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
let firesRef = null;
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

let myPos = { x: 60, y: H / 2 };
let oppPos = { x: W - 60, y: H / 2 };
let lastLocalFireAt = 0;

// Host-authoritative state (meaningful only when mySeat === 'P1').
let hostBolts = {};
let hostScores = { P1: 0, P2: 0 };
let hostRunning = false;
let hostNextId = 1;
let hostLastFireAt = { P1: 0, P2: 0 };
let botPos = { x: W - 60, y: H / 2 };
let botFireAt = 0;
let botMoveTargetAt = 0;
let botMoveTarget = { x: W - 60, y: H / 2 };

// Guest render state
let targetBolts = {};
let renderBolts = {};
let guestScores = { P1: 0, P2: 0 };
let sparks = [];

const keys = {};

function spawnPositionFor(seat) {
  return seat === 'P1' ? { x: 60, y: H / 2 } : { x: W - 60, y: H / 2 };
}

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    bolts: {},
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
  firesRef = roomRef.child('fires');
  selfRef = playersRef.child(playerId);

  mySeat = await claimSeat(playersRef, SEATS, playerId, nickname);
  if (mySeat === 'P1' || mySeat === 'P2') {
    myPos = spawnPositionFor(mySeat);
    oppPos = spawnPositionFor(mySeat === 'P1' ? 'P2' : 'P1');
    await selfRef.update({ pos: myPos });
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

    if (mySeat !== 'P1') {
      targetBolts = room.bolts || {};
      guestScores = room.scores || guestScores;
    } else if (room.status === 'playing' && !hostRunning) {
      hostBolts = {};
      hostScores = { P1: 0, P2: 0 };
      hostNextId = 1;
      hostLastFireAt = { P1: 0, P2: 0 };
      botPos = spawnPositionFor('P2');
      botFireAt = performance.now() + randInt(700, 1300);
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
      if (p.seat === oppositeSeat && p.pos) oppPos = p.pos;
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

  if (mySeat === 'P1') {
    firesRef.on('child_added', (snap) => {
      const fire = snap.val();
      if (fire && fire.seat === 'P2') spawnBoltHost('P2', oppPos.x, oppPos.y, fire.dx, fire.dy);
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
    myPos = spawnPositionFor(mySeat);
    if (selfRef) selfRef.update({ pos: myPos });
    roomRef.update({ status: 'playing', winner: null, scores: { P1: 0, P2: 0 }, bolts: {} });
  });
}

async function resetRoomForDisconnect() {
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.status = 'waiting';
    room.mode = 'human';
    room.winner = null;
    room.scores = { P1: 0, P2: 0 };
    room.bolts = {};
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function bindControls() {
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  document.querySelectorAll('.dpad-btn').forEach((btn) => {
    const dir = btn.dataset.dir;
    const down = (e) => { e.preventDefault(); keys[dir] = true; };
    const up = (e) => { e.preventDefault(); keys[dir] = false; };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (mySeat !== 'P1' && mySeat !== 'P2') return;
    const now = performance.now();
    if (now - lastLocalFireAt < FIRE_COOLDOWN_MS) return;
    lastLocalFireAt = now;

    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const dx0 = x - myPos.x;
    const dy0 = y - myPos.y;
    const len = Math.hypot(dx0, dy0) || 1;
    const dx = dx0 / len;
    const dy = dy0 / len;

    if (mySeat === 'P1') {
      spawnBoltHost('P1', myPos.x, myPos.y, dx, dy);
    } else {
      firesRef.push({ seat: 'P2', dx, dy });
    }
    sounds.playClick();
  });
}

function rectBlocks(px, py) {
  for (const o of OBSTACLES) {
    if (px + PLAYER_R > o.x && px - PLAYER_R < o.x + o.w && py + PLAYER_R > o.y && py - PLAYER_R < o.y + o.h) return true;
  }
  return false;
}

function moveAvatar(pos, dt, up, down, left, right) {
  let dx = 0, dy = 0;
  if (up) dy -= 1;
  if (down) dy += 1;
  if (left) dx -= 1;
  if (right) dx += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy) || 1;
    dx = (dx / len) * MOVE_SPEED * dt;
    dy = (dy / len) * MOVE_SPEED * dt;
  }
  const nx = clamp(pos.x + dx, PLAYER_R, W - PLAYER_R);
  if (!rectBlocks(nx, pos.y)) pos.x = nx;
  const ny = clamp(pos.y + dy, PLAYER_R, H - PLAYER_R);
  if (!rectBlocks(pos.x, ny)) pos.y = ny;
}

const sendMyPos = throttle((pos) => {
  if (selfRef) selfRef.update({ pos: { x: pos.x, y: pos.y } });
}, POS_SEND_INTERVAL_MS);

function spawnBoltHost(owner, x, y, dx, dy) {
  const now = performance.now();
  if (now - (hostLastFireAt[owner] || 0) < FIRE_COOLDOWN_MS - 40) return;
  hostLastFireAt[owner] = now;
  const id = 'b' + hostNextId++;
  hostBolts[id] = { x, y, vx: dx * BOLT_SPEED, vy: dy * BOLT_SPEED, owner };
}

function circleHitsObstacle(x, y, r) {
  for (const o of OBSTACLES) {
    const cx = clamp(x, o.x, o.x + o.w);
    const cy = clamp(y, o.y, o.y + o.h);
    if (Math.hypot(x - cx, y - cy) < r) return true;
  }
  return false;
}

const sendState = throttle(() => {
  if (roomRef && hostRunning) roomRef.update({ bolts: hostBolts, scores: hostScores });
}, STATE_SEND_INTERVAL_MS);

function stepHostPhysics(dt, now) {
  if (keys['w'] || keys['arrowup'] || keys['up']) {} // handled generically below via mySeat branch

  // Move host's own avatar if host is a seated player.
  if (mySeat === 'P1') {
    moveAvatar(myPos, dt, keys['w'] || keys['arrowup'] || keys['up'], keys['s'] || keys['arrowdown'] || keys['down'], keys['a'] || keys['arrowleft'] || keys['left'], keys['d'] || keys['arrowright'] || keys['right']);
    sendMyPos(myPos);
  }

  // Bot movement + firing.
  if (currentMode === 'bot') {
    if (now >= botMoveTargetAt) {
      botMoveTarget = { x: randInt(W / 2 + 20, W - 30), y: randInt(30, H - 30) };
      botMoveTargetAt = now + randInt(900, 1800);
    }
    const bdx = botMoveTarget.x - botPos.x;
    const bdy = botMoveTarget.y - botPos.y;
    const blen = Math.hypot(bdx, bdy) || 1;
    const step = Math.min(blen, MOVE_SPEED * 0.85 * dt);
    const nbx = clamp(botPos.x + (bdx / blen) * step, PLAYER_R, W - PLAYER_R);
    if (!rectBlocks(nbx, botPos.y)) botPos.x = nbx;
    const nby = clamp(botPos.y + (bdy / blen) * step, PLAYER_R, H - PLAYER_R);
    if (!rectBlocks(botPos.x, nby)) botPos.y = nby;

    if (now >= botFireAt) {
      const ddx = myPos.x - botPos.x + randInt(-24, 24);
      const ddy = myPos.y - botPos.y + randInt(-24, 24);
      const dlen = Math.hypot(ddx, ddy) || 1;
      spawnBoltHost('P2', botPos.x, botPos.y, ddx / dlen, ddy / dlen);
      botFireAt = now + randInt(750, 1400);
    }
  }

  // Step bolts.
  const opponentOf = { P1: 'P2', P2: 'P1' };
  const posFor = (seat) => (seat === 'P1' ? myPos : (currentMode === 'bot' ? botPos : oppPos));
  for (const id of Object.keys(hostBolts)) {
    const b = hostBolts[id];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) { delete hostBolts[id]; continue; }
    if (circleHitsObstacle(b.x, b.y, BOLT_R)) { delete hostBolts[id]; continue; }
    const targetSeat = opponentOf[b.owner];
    const targetPos = posFor(targetSeat);
    if (Math.hypot(b.x - targetPos.x, b.y - targetPos.y) < BOLT_R + PLAYER_R) {
      sparks.push({ x: b.x, y: b.y, color: b.owner === 'P1' ? '#33e5ff' : '#ff3ec8', t: now });
      delete hostBolts[id];
      hostScores[b.owner] = (hostScores[b.owner] || 0) + 1;
      sounds.playBlast();
      if (hostScores[b.owner] >= WIN_SCORE) {
        hostRunning = false;
        roomRef.update({ status: 'finished', winner: b.owner, scores: hostScores, bolts: hostBolts });
        return;
      }
    }
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
  if (firesRef) firesRef.off();
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

  if (mySeat === 'P2') {
    moveAvatar(myPos, dt, keys['w'] || keys['arrowup'] || keys['up'], keys['s'] || keys['arrowdown'] || keys['down'], keys['a'] || keys['arrowleft'] || keys['left'], keys['d'] || keys['arrowright'] || keys['right']);
    sendMyPos(myPos);
  }

  if (mySeat === 'P1' && hostRunning) {
    stepHostPhysics(dt, now);
    renderBolts = hostBolts;
  } else if (mySeat !== 'P1') {
    const next = {};
    for (const id of Object.keys(targetBolts)) {
      const t = targetBolts[id];
      next[id] = { ...t };
    }
    renderBolts = next;
  }

  draw(now);
  requestAnimationFrame(loop);
}

function draw(now) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let gx = 0; gx < W; gx += 24) ctx.fillRect(gx, 0, 1, H);
  for (let gy = 0; gy < H; gy += 24) ctx.fillRect(0, gy, W, 1);

  ctx.fillStyle = '#2a3050';
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  for (const o of OBSTACLES) {
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }

  const myColor = mySeat === 'P2' ? '#ff3ec8' : '#33e5ff';
  const oppColor = mySeat === 'P2' ? '#33e5ff' : '#ff3ec8';
  const otherPos = currentMode === 'bot' && mySeat === 'P1' ? botPos : oppPos;

  drawAvatar(otherPos.x, otherPos.y, oppColor);
  drawAvatar(myPos.x, myPos.y, myColor);

  const bolts = mySeat === 'P1' ? hostBolts : renderBolts;
  for (const id of Object.keys(bolts)) {
    const b = bolts[id];
    ctx.beginPath();
    ctx.arc(b.x, b.y, BOLT_R, 0, Math.PI * 2);
    ctx.fillStyle = b.owner === 'P1' ? '#33e5ff' : '#ff3ec8';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  sparks = sparks.filter((s) => now - s.t < 300);
  for (const s of sparks) {
    const p = (now - s.t) / 300;
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = 1 - p;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 8 + p * 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawAvatar(x, y, color) {
  ctx.beginPath();
  ctx.arc(x, y, PLAYER_R, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function renderScoreboardAndStatus(room) {
  const scores = mySeat === 'P1' ? hostScores : (room.scores || guestScores);
  scoreP1.textContent = (scores && scores.P1) || 0;
  scoreP2.textContent = (scores && scores.P2) || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing');
  cardP2.classList.toggle('active-turn', room.status === 'playing');

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') text = mySeat === 'spectator' ? 'Watching the arena…' : 'Dodge, aim, and fire!';
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

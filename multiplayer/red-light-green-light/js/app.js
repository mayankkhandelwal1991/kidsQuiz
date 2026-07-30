/**
 * red-light-green-light/js/app.js
 * -----------------------------------------------------------------------
 * Another 2-8 player room using the same lobby pattern as Ludo Royale /
 * Trivia Party (see ludo-royale/js/app.js for the full rationale on why
 * this can't just reuse the 2-seat QuickMatch class).
 *
 * The "referee" (the shared red/green light) is run by a single
 * authority — P1, the always-present first joiner — who writes
 * `lightState` + `lightChangedAt` to the room on a randomized timer.
 * That's the ONLY thing that's centrally authoritative; each player's
 * own forward progress is tracked entirely on their own client and
 * written to their own player node (contention-free, same pattern as
 * Blaster Arena's `pos` writes). Getting "caught" moving on red is
 * self-reported by each client comparing their own tap time against the
 * shared light state — an honor-system check, consistent with this
 * whole project's zero-backend, no-hidden-server-state design (see the
 * fairness note in the top-level README).
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, randInt, clamp, throttle } from '../../common/utils.js';

const GAME_ID = 'red-light-green-light';
const MATCH_WAIT_SECONDS = 10;
const SEATS = Array.from({ length: 8 }, (_, i) => `P${i + 1}`);
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

const FINISH_DISTANCE = 100;
const MOVE_STEP = 3.2;
const GRACE_MS = 250; // small leeway so network delay doesn't unfairly eliminate
const GREEN_MIN = 1500, GREEN_MAX = 3200;
const RED_MIN = 900, RED_MAX = 2200;
const DISTANCE_SEND_MS = 90;

const db = firebase.database();
const gameRoomsBase = db.ref(`games/${GAME_ID}/rooms`);
const lobbyRef = db.ref(`games/${GAME_ID}/lobby/waitingRoom`);
const shell = new GameShell({ gameTitle: 'Red Light, Green Light' });
const sounds = new SoundManager();

const lobbyPanel = document.getElementById('lobby-panel');
const lobbySeatsEl = document.getElementById('lobby-seats');
const lobbyCountEl = document.getElementById('lobby-count');
const lobbyHintEl = document.getElementById('lobby-hint');
const startGameBtn = document.getElementById('start-game-btn');
const gameArea = document.getElementById('game-area');
const lightDot = document.getElementById('light-dot');
const lightText = document.getElementById('light-text');
const statusBar = document.getElementById('status-bar');
const lanesEl = document.getElementById('lanes');
const moveBtn = document.getElementById('move-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const boardWrap = document.querySelector('.board-wrap');

let roomRef = null;
let playersRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastStatus = null;
let lastLightState = null;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;

let myDistance = 0;
let myEliminated = false;
let myFinished = false;
let hostLightLoopRunning = false;
let botInterval = null;
let winnerCheckLock = false;

function occupiedSeats(room) {
  return SEATS.filter((s) => Object.values(room.players || {}).some((p) => p.seat === s));
}

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    lightState: 'green',
    lightChangedAt: null,
    winner: null,
  };
}

async function findOrCreateRoom() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const snap = await lobbyRef.once('value');
    const code = snap.val();

    if (code) {
      const roomSnap = await gameRoomsBase.child(code).once('value');
      const room = roomSnap.val();
      const occupied = room ? occupiedSeats(room).length : 0;
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
    const snap = await gameRoomsBase.child(code).once('value');
    if (!snap.exists()) { shell.showError(`Room "${code}" doesn't exist.`); return; }
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
  roomRef = gameRoomsBase.child(roomCode);
  playersRef = roomRef.child('players');
  selfRef = playersRef.child(playerId);

  mySeat = await claimSeat(playersRef, SEATS, playerId, nickname);
  if (SEATS.includes(mySeat)) {
    myDistance = 0; myEliminated = false; myFinished = false;
    await selfRef.update({ distance: 0, eliminated: false, finished: false });
  }
  setupPresence(selfRef);

  if (SEATS.includes(mySeat)) {
    const occSnap = await playersRef.once('value');
    const occupied = occupiedSeats({ players: occSnap.val() }).length;
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
  shell.toast(mySeat === 'spectator' ? "Room is full — you're spectating." : `You're ${mySeat}`, 'info');

  moveBtn.addEventListener('pointerdown', handleTap);
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    handleStatusTransition(room);
    handleLightChange(room);
    if (room.status === 'waiting') renderLobby(room);
    else renderGame(room);
    handleMatchmakingCountdown(room);
    maybeRunHostLightLoop(room);
    maybeRunBot(room);
  });

  playersRef.on('value', (snap) => {
    playersMap = snap.val() || {};
    if (roomRef && !lobbyPanel.classList.contains('hidden')) return; // lobby re-renders from room listener
    maybeCheckWinner();
  });

  playersRef.on('child_removed', (snap) => {
    const data = snap.val();
    if (data && SEATS.includes(data.seat)) {
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

  startGameBtn.addEventListener('click', () => { sounds.playClick(); startGame(false); });
  playAgainBtn.addEventListener('click', () => { sounds.playClick(); playAgain(); });
}

async function resetRoomForDisconnect() {
  hostLightLoopRunning = false;
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.status = 'waiting';
    room.lightState = 'green';
    room.lightChangedAt = null;
    room.winner = null;
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
  // Reset everyone's race progress for the next attempt.
  if (playersRef) {
    const snap = await playersRef.once('value');
    const updates = {};
    for (const id of Object.keys(snap.val() || {})) {
      updates[`${id}/distance`] = 0;
      updates[`${id}/eliminated`] = false;
      updates[`${id}/finished`] = false;
    }
    if (Object.keys(updates).length) await playersRef.update(updates);
  }
}

// ---------------------------------------------------------------------
// Start / restart
// ---------------------------------------------------------------------

async function resetAllProgress() {
  const snap = await playersRef.once('value');
  const updates = {};
  for (const id of Object.keys(snap.val() || {})) {
    updates[`${id}/distance`] = 0;
    updates[`${id}/eliminated`] = false;
    updates[`${id}/finished`] = false;
  }
  if (Object.keys(updates).length) await playersRef.update(updates);
  myDistance = 0; myEliminated = false; myFinished = false;
}

async function startGame(silent) {
  await resetAllProgress();
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    const occ = occupiedSeats(room);
    if (occ.length < MIN_PLAYERS) return;
    room.status = 'playing';
    room.lightState = 'green';
    room.lightChangedAt = Date.now();
    room.winner = null;
    return room;
  });
  if (!silent && !txResult.committed) shell.toast('Need at least 2 players to start.', 'warn');
  if (txResult.committed) await lobbyRef.transaction((cur) => (cur === roomRef.key ? null : cur));
}

async function playAgain() {
  await resetAllProgress();
  await roomRef.transaction((room) => {
    if (!room) return room;
    const occ = occupiedSeats(room);
    if (occ.length < MIN_PLAYERS) { room.status = 'waiting'; return room; }
    room.status = 'playing';
    room.lightState = 'green';
    room.lightChangedAt = Date.now();
    room.winner = null;
    return room;
  });
}

// ---------------------------------------------------------------------
// Movement / elimination (self-reported against the shared light state)
// ---------------------------------------------------------------------

const sendDistance = throttle(() => {
  if (selfRef) selfRef.update({ distance: myDistance });
}, DISTANCE_SEND_MS);

function handleTap() {
  if (!SEATS.includes(mySeat) || myEliminated || myFinished) return;
  if (!lastRoomSnapshot || lastRoomSnapshot.status !== 'playing') return;

  const light = lastRoomSnapshot.lightState;
  const changedAt = lastRoomSnapshot.lightChangedAt || 0;
  const sinceChange = Date.now() - changedAt;

  if (light === 'red' && sinceChange > GRACE_MS) {
    myEliminated = true;
    selfRef.update({ eliminated: true });
    sounds.playError();
    boardWrap.classList.add('flash-caught');
    setTimeout(() => boardWrap.classList.remove('flash-caught'), 400);
    shell.toast('Caught moving on red — you\'re out!', 'warn');
    maybeCheckWinner();
    return;
  }

  myDistance = clamp(myDistance + MOVE_STEP, 0, FINISH_DISTANCE);
  sendDistance();
  if (myDistance >= FINISH_DISTANCE && !myFinished) {
    myFinished = true;
    selfRef.update({ distance: FINISH_DISTANCE, finished: true });
    attemptFinish(mySeat);
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

async function maybeCheckWinner() {
  if (!roomRef || winnerCheckLock) return;
  if (!lastRoomSnapshot || lastRoomSnapshot.status !== 'playing') return;
  const occ = occupiedSeats(lastRoomSnapshot);
  const alive = occ.filter((s) => {
    const p = Object.values(playersMap).find((pl) => pl.seat === s);
    return p && !p.eliminated && !p.finished;
  });
  if (alive.length > 1) return;

  winnerCheckLock = true;
  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    room.status = 'finished';
    room.winner = alive.length === 1 ? alive[0] : null;
    return room;
  });
  winnerCheckLock = false;
}

// ---------------------------------------------------------------------
// Host-driven red/green light loop
// ---------------------------------------------------------------------

function maybeRunHostLightLoop(room) {
  if (mySeat !== 'P1') return;
  if (room.status === 'playing' && !hostLightLoopRunning) {
    hostLightLoopRunning = true;
    stepLight('green');
  } else if (room.status !== 'playing') {
    hostLightLoopRunning = false;
  }
}

function stepLight(color) {
  if (!hostLightLoopRunning || !roomRef) return;
  roomRef.update({ lightState: color, lightChangedAt: Date.now() });
  const dur = color === 'green' ? randInt(GREEN_MIN, GREEN_MAX) : randInt(RED_MIN, RED_MAX);
  setTimeout(async () => {
    if (!hostLightLoopRunning || !roomRef) return;
    const snap = await roomRef.once('value');
    const room = snap.val();
    if (!room || room.status !== 'playing') { hostLightLoopRunning = false; return; }
    stepLight(color === 'green' ? 'red' : 'green');
  }, dur);
}

// ---------------------------------------------------------------------
// Bot (driven by P1)
// ---------------------------------------------------------------------

function botSeatOf(room) {
  for (const [id, p] of Object.entries(room.players || {})) {
    if (id === 'bot' || p.nickname === 'Computer') return p.seat;
  }
  return null;
}

function maybeRunBot(room) {
  const shouldRun = mySeat === 'P1' && room.mode === 'bot' && room.status === 'playing';
  if (!shouldRun) {
    if (botInterval) { clearInterval(botInterval); botInterval = null; }
    return;
  }
  if (botInterval) return;
  const botSeat = botSeatOf(room);
  if (!botSeat) return;
  let botDistance = 0;
  let botDone = false;
  botInterval = setInterval(async () => {
    if (botDone) return;
    const snap = await roomRef.once('value');
    const fresh = snap.val();
    if (!fresh || fresh.status !== 'playing') { botDone = true; clearInterval(botInterval); botInterval = null; return; }
    if (fresh.lightState === 'green') {
      botDistance = Math.min(FINISH_DISTANCE, botDistance + randInt(3, 7));
      playersRef.child('bot').update({ distance: botDistance });
      if (botDistance >= FINISH_DISTANCE) {
        botDone = true;
        playersRef.child('bot').update({ finished: true });
        attemptFinish(botSeat);
      }
    } else if (Math.random() < 0.12) {
      // occasional slip-up so the bot is beatable
      botDone = true;
      playersRef.child('bot').update({ eliminated: true });
      maybeCheckWinner();
    }
  }, 260);
}

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    const occ = occupiedSeats(room);
    if (occ.length !== 1) return;
    const nextSeat = SEATS.find((s) => !occ.includes(s));
    room.mode = 'bot';
    room.players = room.players || {};
    room.players['bot'] = { nickname: 'Computer', seat: nextSeat, joinedAt: Date.now(), distance: 0, eliminated: false, finished: false };
    return room;
  });
  if (txResult.committed) shell.toast('A Computer player joined — start whenever you like!', 'info');
}

function handleMatchmakingCountdown(room) {
  const occ = occupiedSeats(room);
  const iAmWaitingAlone = mySeat === 'P1' && room.status === 'waiting' && occ.length === 1;
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

// ---------------------------------------------------------------------
// Sound / toast side effects
// ---------------------------------------------------------------------

function handleLightChange(room) {
  if (room.status !== 'playing') { lastLightState = null; return; }
  if (room.lightState === lastLightState) return;
  lastLightState = room.lightState;
  lightDot.classList.remove('flash');
  void lightDot.offsetWidth;
  lightDot.classList.add('flash');
  if (room.lightState === 'red') sounds.playError(); else sounds.playSuccess();
}

function handleStatusTransition(room) {
  if (lastStatus === room.status) return;
  const prev = lastStatus;
  lastStatus = room.status;
  if (prev === null) return;
  if (room.status === 'finished') {
    if (room.winner === null) sounds.playDraw();
    else if (mySeat === room.winner) sounds.playWin();
    else if (mySeat !== 'spectator') sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

async function handleLeave() {
  stopMatchmakingCountdown();
  hostLightLoopRunning = false;
  if (botInterval) { clearInterval(botInterval); botInterval = null; }
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  lastLightState = null;
  lastRoomSnapshot = null;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

let lastRoomSnapshot = null;

function seatClass(seat) {
  const i = SEATS.indexOf(seat);
  return i >= 0 ? `p-${i + 1}` : 'p-empty';
}

function renderLobby(room) {
  lastRoomSnapshot = room;
  lobbyPanel.classList.remove('hidden');
  gameArea.classList.add('hidden');

  const seatOf = {};
  for (const p of Object.values(room.players || {})) if (SEATS.includes(p.seat)) seatOf[p.seat] = p;

  lobbySeatsEl.innerHTML = '';
  let occupiedCount = 0;
  for (const s of SEATS) {
    const p = seatOf[s];
    const div = document.createElement('div');
    div.className = 'lobby-seat ' + (p ? `filled ${seatClass(s)}` : 'p-empty');
    if (p && s === mySeat) div.classList.add('you');
    if (p) { occupiedCount++; div.textContent = `${p.nickname}${p.nickname === 'Computer' ? ' 🤖' : ''}`; }
    else div.textContent = 'Open';
    lobbySeatsEl.appendChild(div);
  }

  lobbyCountEl.textContent = `(${occupiedCount}/${MAX_PLAYERS})`;
  const canStart = occupiedCount >= MIN_PLAYERS;
  startGameBtn.disabled = !canStart;
  lobbyHintEl.textContent = canStart
    ? 'Anyone can tap Start when ready — more players can still join until then.'
    : `Need at least ${MIN_PLAYERS} players to start.`;
}

function renderGame(room) {
  lastRoomSnapshot = room;
  lobbyPanel.classList.add('hidden');
  gameArea.classList.remove('hidden');

  if (room.status === 'playing') {
    const isGreen = room.lightState === 'green';
    lightDot.textContent = isGreen ? '🟢' : '🔴';
    lightText.textContent = isGreen ? 'GO! GO! GO!' : 'FREEZE!';
    lightText.className = 'light-text ' + (isGreen ? 'green' : 'red');
  } else {
    lightDot.textContent = '🏁';
    lightText.textContent = room.status === 'finished' ? 'FINISH' : 'GET READY';
    lightText.className = 'light-text';
  }

  let text = '';
  if (room.status === 'playing') {
    if (!SEATS.includes(mySeat)) text = 'Watching the race…';
    else if (myFinished) text = 'You crossed the finish line — waiting on others…';
    else if (myEliminated) text = "You're out — watching the rest of the race…";
    else text = room.lightState === 'green' ? 'Tap fast to move forward!' : 'FREEZE! Don\'t tap!';
  } else if (room.status === 'finished') {
    if (room.winner === null) text = "Everyone's out — no winner this time!";
    else if (mySeat === room.winner) text = 'You won the race! 🎉';
    else text = `${room.winner} wins the race!`;
  }
  statusBar.textContent = text;
  statusBar.className = 'status-bar ' + (room.status === 'finished' ? (mySeat === room.winner ? 'status-won' : 'status-lost') : '');

  renderLanes(room);

  const canMove = room.status === 'playing' && SEATS.includes(mySeat) && !myEliminated && !myFinished;
  moveBtn.disabled = !canMove;
  moveBtn.textContent = myEliminated ? 'OUT!' : (myFinished ? 'FINISHED!' : 'TAP TO MOVE!');

  playAgainBtn.classList.toggle('hidden', room.status !== 'finished');
}

function renderLanes(room) {
  const seatOf = {};
  for (const [id, p] of Object.entries(room.players || {})) if (SEATS.includes(p.seat)) seatOf[p.seat] = p;
  const occ = SEATS.filter((s) => seatOf[s]);

  lanesEl.innerHTML = '';
  for (const s of occ) {
    const p = seatOf[s];
    const dist = clamp(p.distance || 0, 0, FINISH_DISTANCE);
    const div = document.createElement('div');
    div.className = 'lane' + (s === mySeat ? ' me' : '') + (p.eliminated ? ' eliminated' : '');
    div.innerHTML = `
      <span class="lane-name">${p.nickname}${s === mySeat ? ' (you)' : ''}</span>
      <div class="lane-track">
        <div class="lane-fill ${seatClass(s)}" style="width:${dist}%"></div>
        <div class="lane-runner" style="left:${dist}%">${p.eliminated ? '❌' : (p.finished ? '🏆' : '🏃')}</div>
      </div>
      <span class="lane-tag">${p.finished ? 'DONE' : (p.eliminated ? 'OUT' : Math.round(dist) + '%')}</span>
    `;
    lanesEl.appendChild(div);
  }
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

shell.bindLandingActions({ onPlay: handlePlay, onJoinCode: handleJoinCode });

/**
 * whack-a-mole/js/app.js
 * -----------------------------------------------------------------------
 * A single 30-second match: the host (P1, whoever created the room)
 * decides which of the 9 holes pops a mole and for how long, streaming
 * that to Firebase exactly like pong-duel streams the ball. Both players
 * race to tap the SAME mole — whoever's tap transaction lands first (by
 * matching the room's current `moleId`) claims the point, so scoring
 * itself needs no host mediation, only the "which hole is live" state
 * does. Most whacks when the clock hits zero wins; equal scores is a
 * draw.
 *
 * KNOWN LIMITATION: same as pong-duel/snake-duel — only the host runs
 * the spawn schedule, so a host disconnect resets the room like any
 * other game's disconnect cleanup rather than handing off authority.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, randInt } from '../../common/utils.js';

const GAME_ID = 'whack-a-mole';
const MATCH_WAIT_SECONDS = 30;
const SEATS = ['P1', 'P2'];
const HOLES = 9;
const DURATION_MS = 30000;
const MOLE_UP_MS = 900;
const GAP_MIN_MS = 300;
const GAP_MAX_MS = 750;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Whack-a-Mole Duel' });
const sounds = new SoundManager();

const statusBar = document.getElementById('status-bar');
const timeLeftEl = document.getElementById('time-left');
const scoreP1 = document.getElementById('score-p1');
const scoreP2 = document.getElementById('score-p2');
const cardP1 = document.getElementById('card-p1');
const cardP2 = document.getElementById('card-p2');
const nameP1 = document.getElementById('name-p1');
const nameP2 = document.getElementById('name-p2');
const moleGrid = document.getElementById('mole-grid');
const spectatorCount = document.getElementById('spectator-count');
const playAgainBtn = document.getElementById('play-again-btn');

let roomRef = null;
let playersRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastStatus = null;
let currentMode = 'human';
let latestRoom = null;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
let countdownInterval = null;

let holeEls = [];

// Host-only state.
let hostRunning = false;
let hostMoleCounter = 0;
let hostActiveMoleId = -1;
let hostHandledMoleId = -1;
let hostLastHole = -1;
let hostSpawnTimer = null;
let hostBotTimer = null;

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    roundStartAt: Date.now(),
    duration: DURATION_MS,
    moleIndex: -1,
    moleId: 0,
    whackedBy: null,
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
      if (room && room.status === 'waiting') { room.status = 'playing'; room.roundStartAt = Date.now(); }
      return room;
    });
    await quickMatch.clearIfMatches(roomCode);
  }

  buildGrid();
  attachListeners();
  playersMap = (await playersRef.once('value')).val() || {};
  renderPlayers();

  shell.showGameScreen(roomCode);
  shell.setSoundIcon(sounds.enabled);
  sounds.playJoin();
  shell.toast(mySeat === 'spectator' ? "Both seats are taken — you're spectating." : `You're ${mySeat}`, 'info');
}

function buildGrid() {
  moleGrid.innerHTML = '';
  holeEls = [];
  for (let i = 0; i < HOLES; i++) {
    const hole = document.createElement('div');
    hole.className = 'mole-hole';
    hole.dataset.index = i;
    const mole = document.createElement('span');
    mole.className = 'mole';
    mole.textContent = '🐹';
    hole.appendChild(mole);
    hole.addEventListener('click', () => handleTap(i));
    moleGrid.appendChild(hole);
    holeEls.push(hole);
  }
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    latestRoom = room;
    currentMode = room.mode || 'human';
    handleStatusTransition(room);
    renderRoom(room);
    handleMatchmakingCountdown(room);
    manageCountdown(room);
    if (mySeat === 'P1') driveHost(room);
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
    roomRef.update({
      status: 'playing', winner: null, scores: { P1: 0, P2: 0 },
      roundStartAt: Date.now(), moleIndex: -1, moleId: (latestRoom && latestRoom.moleId || 0) + 1, whackedBy: null,
    });
  });
}

async function resetRoomForDisconnect() {
  stopHost();
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.status = 'waiting';
    room.mode = 'human';
    room.roundStartAt = Date.now();
    room.moleIndex = -1;
    room.moleId = (room.moleId || 0) + 1;
    room.whackedBy = null;
    room.scores = { P1: 0, P2: 0 };
    room.winner = null;
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function handleTap(index) {
  if (mySeat !== 'P1' && mySeat !== 'P2') return;
  if (!latestRoom || latestRoom.status !== 'playing') return;
  if (latestRoom.moleIndex !== index || latestRoom.whackedBy) { sounds.playClick(); return; }
  attemptWhack(mySeat, latestRoom.moleId);
}

async function attemptWhack(seat, moleId) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.moleId !== moleId) return; // that mole is already gone
    if (room.whackedBy) return; // already claimed
    room.whackedBy = seat;
    room.scores = room.scores || { P1: 0, P2: 0 };
    room.scores[seat] = (room.scores[seat] || 0) + 1;
    return room;
  });
  if (txResult.committed && txResult.snapshot.val() && txResult.snapshot.val().whackedBy === seat) {
    sounds.playHit();
  }
}

// ---------------------------------------------------------------------
// Host spawn loop (mySeat === 'P1' only)
// ---------------------------------------------------------------------

function driveHost(room) {
  if (room.status === 'playing' && !hostRunning) {
    hostRunning = true;
    hostMoleCounter = (room.moleId || 0) + 1;
    hostActiveMoleId = -1;
    hostHandledMoleId = -1;
    hostLastHole = -1;
    scheduleSpawn(GAP_MIN_MS);
  } else if (room.status !== 'playing' && hostRunning) {
    stopHost();
  }

  if (hostRunning && room.whackedBy && room.moleId === hostActiveMoleId && hostHandledMoleId !== room.moleId) {
    hostHandledMoleId = room.moleId;
    clearTimeout(hostSpawnTimer);
    clearTimeout(hostBotTimer);
    duckThenSpawnNext();
  }
}

function stopHost() {
  hostRunning = false;
  clearTimeout(hostSpawnTimer);
  clearTimeout(hostBotTimer);
}

function remainingMs(room) {
  return (room.roundStartAt || 0) + (room.duration || DURATION_MS) - Date.now();
}

function scheduleSpawn(delay) {
  clearTimeout(hostSpawnTimer);
  hostSpawnTimer = setTimeout(spawnMole, delay);
}

function spawnMole() {
  if (!hostRunning || !latestRoom) return;
  if (remainingMs(latestRoom) <= 400) { finishGame(); return; }

  let hole;
  do { hole = randInt(0, HOLES - 1); } while (hole === hostLastHole && HOLES > 1);
  hostLastHole = hole;

  const id = hostMoleCounter++;
  hostActiveMoleId = id;
  roomRef.update({ moleIndex: hole, moleId: id, whackedBy: null });

  if (currentMode === 'bot') {
    const botDelay = randInt(280, 700);
    if (botDelay < MOLE_UP_MS) {
      hostBotTimer = setTimeout(() => attemptWhack('P2', id), botDelay);
    }
  }

  hostSpawnTimer = setTimeout(() => onMoleTimeout(id), MOLE_UP_MS);
}

function onMoleTimeout(id) {
  if (!hostRunning || hostActiveMoleId !== id) return;
  roomRef.update({ moleIndex: -1 });
  duckThenSpawnNext();
}

function duckThenSpawnNext() {
  if (!hostRunning || !latestRoom) return;
  if (remainingMs(latestRoom) <= 400) { finishGame(); return; }
  scheduleSpawn(randInt(GAP_MIN_MS, GAP_MAX_MS));
}

function finishGame() {
  hostRunning = false;
  clearTimeout(hostSpawnTimer);
  clearTimeout(hostBotTimer);
  const scores = (latestRoom && latestRoom.scores) || { P1: 0, P2: 0 };
  let winner = null;
  if ((scores.P1 || 0) > (scores.P2 || 0)) winner = 'P1';
  else if ((scores.P2 || 0) > (scores.P1 || 0)) winner = 'P2';
  roomRef.update({ status: 'finished', winner, moleIndex: -1 });
}

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    room.mode = 'bot';
    room.status = 'playing';
    room.roundStartAt = Date.now();
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

function manageCountdown(room) {
  if (countdownInterval) clearInterval(countdownInterval);
  if (room.status !== 'playing') {
    timeLeftEl.textContent = Math.ceil((room.duration || DURATION_MS) / 1000);
    return;
  }
  const tick = () => {
    const remaining = Math.max(0, Math.ceil(remainingMs(room) / 1000));
    timeLeftEl.textContent = remaining;
  };
  tick();
  countdownInterval = setInterval(tick, 250);
}

function handleStatusTransition(room) {
  if (lastStatus === room.status) return;
  const prev = lastStatus;
  lastStatus = room.status;
  if (prev === null) return;
  if (room.status === 'finished') {
    try { onMultiplayerGameComplete(); } catch (e) {}
    if (mySeat === 'spectator') { /* no personal result sound */ }
    else if (room.winner === null) sounds.playDraw();
    else if (mySeat === room.winner) sounds.playWin();
    else sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

async function handleLeave() {
  stopMatchmakingCountdown();
  stopHost();
  if (countdownInterval) clearInterval(countdownInterval);
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  latestRoom = null;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function renderRoom(room) {
  scoreP1.textContent = (room.scores && room.scores.P1) || 0;
  scoreP2.textContent = (room.scores && room.scores.P2) || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing');
  cardP2.classList.toggle('active-turn', room.status === 'playing');

  holeEls.forEach((hole, i) => {
    hole.classList.remove('up', 'whacked', 'mine', 'theirs');
    if (room.status === 'playing' && i === room.moleIndex) {
      if (room.whackedBy) {
        hole.classList.add('whacked', room.whackedBy === mySeat ? 'mine' : 'theirs');
      } else {
        hole.classList.add('up');
      }
    }
  });

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') text = mySeat === 'spectator' ? 'Watching the whacking…' : 'Whack the moles as they pop up!';
  else if (room.status === 'finished') {
    if (room.winner === null) text = "It's a tie!";
    else if (mySeat === room.winner) text = 'You win! 🎉';
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

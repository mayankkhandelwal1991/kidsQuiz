/**
 * reaction-duel/js/app.js
 * -----------------------------------------------------------------------
 * Both players wait for the panel to flip from red to green, then tap as
 * fast as possible. Reaction time is measured entirely on each player's
 * own device (elapsed time from when THEIR screen turned green to when
 * THEY tapped), so no cross-device clock sync is needed — only the random
 * wait duration (`delayMs`) is shared, driving both local timers off the
 * same room-provided round-start timestamp.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, randInt } from '../../common/utils.js';

const GAME_ID = 'reaction-duel';
const MATCH_WAIT_SECONDS = 30;
const SEATS = ['P1', 'P2'];
const WIN_SCORE = 3;
const RESULT_PAUSE_MS = 2200;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Reaction Duel' });
const sounds = new SoundManager();

const statusBar = document.getElementById('status-bar');
const roundNum = document.getElementById('round-num');
const scoreP1 = document.getElementById('score-p1');
const scoreP2 = document.getElementById('score-p2');
const cardP1 = document.getElementById('card-p1');
const cardP2 = document.getElementById('card-p2');
const nameP1 = document.getElementById('name-p1');
const nameP2 = document.getElementById('name-p2');
const tapPanel = document.getElementById('tap-panel');
const tapPanelText = document.getElementById('tap-panel-text');
const timeP1 = document.getElementById('time-p1');
const timeP2 = document.getElementById('time-p2');
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
let goTimeLocal = 0; // performance.now() timestamp for this device's own GO moment
let currentPhase = 'idle'; // idle | wait | go | result
let submittedThisRound = false;
let lastHandledRound = 0;

function randomDelayMs() {
  return randInt(1800, 4500);
}

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    round: 1,
    roundStartAt: Date.now(),
    delayMs: randomDelayMs(),
    reactions: { P1: null, P2: null },
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

  tapPanel.addEventListener('click', handlePanelTap);
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    handleStatusTransition(room);
    renderRoom(room);
    handleMatchmakingCountdown(room);
    manageLocalTimer(room);
    maybeTriggerBotTap(room);
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
      room.reactions = { P1: null, P2: null };
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
    room.reactions = { P1: null, P2: null };
    room.scores = { P1: 0, P2: 0 };
    room.winner = null;
    room.status = 'waiting';
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function handlePanelTap() {
  if (mySeat !== 'P1' && mySeat !== 'P2') return;
  if (submittedThisRound || currentPhase === 'idle' || currentPhase === 'result') return;

  if (currentPhase === 'wait') {
    submittedThisRound = true;
    attemptSubmit(mySeat, 'FALSE_START');
  } else if (currentPhase === 'go') {
    const ms = Math.round(performance.now() - goTimeLocal);
    submittedThisRound = true;
    attemptSubmit(mySeat, ms);
  }
}

async function attemptSubmit(seat, value) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    room.reactions = room.reactions || { P1: null, P2: null };
    if (room.reactions[seat] !== null && room.reactions[seat] !== undefined) return; // already submitted
    room.reactions[seat] = value;

    if (room.reactions.P1 !== null && room.reactions.P1 !== undefined && room.reactions.P2 !== null && room.reactions.P2 !== undefined) {
      resolveRoundInPlace(room);
    }
    return room;
  });

  if (txResult.committed) {
    if (value === 'FALSE_START') sounds.playError();
    else sounds.playClick();
  }
}

/** Mutates `room` in place to decide the round's winner given both reactions are in. */
function resolveRoundInPlace(room) {
  const r1 = room.reactions.P1;
  const r2 = room.reactions.P2;
  const p1False = r1 === 'FALSE_START';
  const p2False = r2 === 'FALSE_START';

  let winnerSeat = null;
  if (p1False && p2False) {
    winnerSeat = null; // both jumped the gun — replay, no point awarded
  } else if (p1False) {
    winnerSeat = 'P2';
  } else if (p2False) {
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
      if (room.round !== prevRound) return; // already advanced
      room.round = prevRound + 1;
      room.roundStartAt = Date.now();
      room.delayMs = randomDelayMs();
      room.reactions = { P1: null, P2: null };
      room.lastRoundWinner = null;
      return room;
    });
  }, RESULT_PAUSE_MS);
}

function manageLocalTimer(room) {
  clearTimeout(goTimeout);
  if (room.status !== 'playing') {
    currentPhase = 'idle';
    return;
  }

  const bothSubmitted = room.reactions && room.reactions.P1 != null && room.reactions.P2 != null;
  if (bothSubmitted) {
    currentPhase = 'result';
    renderPanel(currentPhase);
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
      renderPanel(currentPhase);
      sounds.playCountdown();
    }, remaining);
  } else {
    currentPhase = 'go';
    goTimeLocal = performance.now() - Math.min(-remaining, 50); // small correction if we're late attaching
  }
  renderPanel(currentPhase);
}

function computeBotReactionMs() {
  return randInt(190, 420);
}

function maybeTriggerBotTap(room) {
  const botCanTap = room.mode === 'bot' && room.status === 'playing' && (room.reactions ? room.reactions.P2 == null : true);
  if (!botCanTap || mySeat !== 'P1') return;
  if (botPendingRound === room.round) return;
  botPendingRound = room.round;
  clearTimeout(botTimeout);

  const goAt = (room.roundStartAt || 0) + (room.delayMs || 0);
  const falseStartChance = 0.08;
  if (Math.random() < falseStartChance) {
    const earlyBy = randInt(100, 600);
    const fireAt = goAt - earlyBy;
    const delay = Math.max(0, fireAt - Date.now());
    botTimeout = setTimeout(() => attemptSubmit('P2', 'FALSE_START'), delay);
  } else {
    const reaction = computeBotReactionMs();
    const fireAt = goAt + reaction;
    const delay = Math.max(0, fireAt - Date.now());
    botTimeout = setTimeout(() => attemptSubmit('P2', reaction), delay);
  }
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
  }
}

async function handleLeave() {
  stopMatchmakingCountdown();
  clearTimeout(botTimeout);
  clearTimeout(goTimeout);
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

function renderPanel(phase) {
  tapPanel.className = 'tap-panel ' + phase;
  if (phase === 'idle') tapPanelText.textContent = 'Get ready…';
  else if (phase === 'wait') tapPanelText.textContent = 'Wait for it…';
  else if (phase === 'go') tapPanelText.textContent = 'TAP NOW!';
  else if (phase === 'result') tapPanelText.textContent = 'Round result';
}

function formatReaction(v) {
  if (v === null || v === undefined) return '--';
  if (v === 'FALSE_START') return 'Jumped!';
  return `${v}ms`;
}

function renderRoom(room) {
  roundNum.textContent = room.round || 1;
  scoreP1.textContent = (room.scores && room.scores.P1) || 0;
  scoreP2.textContent = (room.scores && room.scores.P2) || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing');
  cardP2.classList.toggle('active-turn', room.status === 'playing');

  timeP1.textContent = formatReaction(room.reactions && room.reactions.P1);
  timeP2.textContent = formatReaction(room.reactions && room.reactions.P2);

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    const bothIn = room.reactions && room.reactions.P1 != null && room.reactions.P2 != null;
    if (bothIn) {
      text = room.lastRoundWinner ? `${room.lastRoundWinner} wins the round!` : "Both jumped the gun — replaying!";
    } else if (mySeat === 'spectator') {
      text = 'Watching the duel…';
    } else {
      text = 'Tap the instant it turns green!';
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

/**
 * typing-race/js/app.js
 * -----------------------------------------------------------------------
 * Both racers type the same passage (picked from a shared list so every
 * client agrees on the text). Progress is the length of the correct
 * prefix typed so far, throttled to Firebase like a position update in a
 * real-time game. First to reach 100% wins.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, throttle } from '../../common/utils.js';
import { PASSAGES } from './passages.js';

const GAME_ID = 'typing-race';
const MATCH_WAIT_SECONDS = 10;
const SEATS = ['P1', 'P2'];
const COUNTDOWN_MS = 3000;
const PROGRESS_SEND_INTERVAL_MS = 200;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Typing Race' });
const sounds = new SoundManager();

const statusBar = document.getElementById('status-bar');
const countdownOverlay = document.getElementById('countdown-overlay');
const passageBox = document.getElementById('passage-box');
const typingInput = document.getElementById('typing-input');
const nameP1 = document.getElementById('name-p1');
const nameP2 = document.getElementById('name-p2');
const wpmP1 = document.getElementById('wpm-p1');
const wpmP2 = document.getElementById('wpm-p2');
const progressP1 = document.getElementById('progress-p1');
const progressP2 = document.getElementById('progress-p2');
const spectatorCount = document.getElementById('spectator-count');
const playAgainBtn = document.getElementById('play-again-btn');

let roomRef = null;
let playersRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastStatus = null;
let currentPassage = '';
let raceStartAt = 0;
let countdownInterval = null;
let hasStartedTyping = false;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
let botInterval = null;
let botProgress = 0;

function buildInitialRoom() {
  const passageIndex = Math.floor(Math.random() * PASSAGES.length);
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    passageIndex,
    raceStartAt: null,
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
  await selfRef.update({ progress: 0, wpm: 0, finished: false });
  setupPresence(selfRef);

  if (mySeat === 'P2') {
    await roomRef.transaction((room) => {
      if (room && room.status === 'waiting') {
        room.status = 'playing';
        room.raceStartAt = Date.now() + COUNTDOWN_MS;
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

  typingInput.addEventListener('input', handleTypingInput);
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    handleStatusTransition(room);
    renderRoom(room);
    handleMatchmakingCountdown(room);
    manageRaceCountdown(room);
    maybeRunBotGhost(room);
  });

  playersRef.on('value', (snap) => {
    playersMap = snap.val() || {};
    renderPlayers();
    renderProgress();
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

  playAgainBtn.addEventListener('click', async () => {
    sounds.playClick();
    const passageIndex = Math.floor(Math.random() * PASSAGES.length);
    await playersRef.child(playerId).update({ progress: 0, wpm: 0, finished: false });
    roomRef.transaction((room) => {
      if (!room) return room;
      room.passageIndex = passageIndex;
      room.status = 'playing';
      room.raceStartAt = Date.now() + COUNTDOWN_MS;
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
    room.winner = null;
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

const sendProgress = throttle((progress, wpm) => {
  if (!selfRef) return;
  selfRef.update({ progress, wpm });
}, PROGRESS_SEND_INTERVAL_MS);

function handleTypingInput() {
  if (!currentPassage || Date.now() < raceStartAt) {
    typingInput.value = '';
    return;
  }
  if (!hasStartedTyping) {
    hasStartedTyping = true;
    typingInput.dataset.startTime = String(Date.now());
  }

  const typed = typingInput.value;
  let correctLen = 0;
  while (correctLen < typed.length && correctLen < currentPassage.length && typed[correctLen] === currentPassage[correctLen]) {
    correctLen++;
  }
  renderPassageHighlight(typed, correctLen);

  const progress = Math.round((correctLen / currentPassage.length) * 100);
  const elapsedMin = (Date.now() - Number(typingInput.dataset.startTime || Date.now())) / 60000;
  const wordsTyped = correctLen / 5; // standard WPM approximation: 5 chars = 1 "word"
  const wpm = elapsedMin > 0 ? Math.round(wordsTyped / elapsedMin) : 0;
  sendProgress(progress, wpm);

  if (correctLen >= currentPassage.length) {
    typingInput.disabled = true;
    attemptFinish(mySeat, wpm);
  }
}

async function attemptFinish(seat, wpm) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return; // already finished
    room.status = 'finished';
    room.winner = seat;
    return room;
  });
  if (txResult.committed && txResult.snapshot.val().winner === seat) {
    selfRef.update({ progress: 100, wpm, finished: true });
  }
}

function computeBotWpmProfile() {
  return 32 + Math.random() * 26; // ~32-58 WPM, a beatable but competent typist
}

function maybeRunBotGhost(room) {
  const shouldRun = room.mode === 'bot' && room.status === 'playing' && mySeat === 'P1' && Date.now() >= (room.raceStartAt || Infinity);
  if (!shouldRun) {
    if (botInterval && room.status !== 'playing') { clearInterval(botInterval); botInterval = null; }
    return;
  }
  if (botInterval) return; // already running for this race

  const passage = PASSAGES[room.passageIndex];
  const wpm = computeBotWpmProfile();
  const charsPerSecond = (wpm * 5) / 60;
  botProgress = 0;
  const startedAt = Date.now();

  botInterval = setInterval(async () => {
    const elapsedSec = (Date.now() - startedAt) / 1000;
    const targetChars = Math.min(passage.length, Math.round(elapsedSec * charsPerSecond * (0.85 + Math.random() * 0.3)));
    if (targetChars <= botProgress) return;
    botProgress = targetChars;
    const progress = Math.round((botProgress / passage.length) * 100);
    await playersRef.child('bot').update({ progress, wpm: Math.round(wpm) });
    if (botProgress >= passage.length) {
      clearInterval(botInterval);
      botInterval = null;
      attemptFinish('P2', Math.round(wpm));
    }
  }, 300);
}

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    room.mode = 'bot';
    room.status = 'playing';
    room.raceStartAt = Date.now() + COUNTDOWN_MS;
    room.players = room.players || {};
    room.players['bot'] = { nickname: 'Computer', seat: 'P2', joinedAt: Date.now(), progress: 0, wpm: 0, finished: false };
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

function manageRaceCountdown(room) {
  raceStartAt = room.raceStartAt || 0;
  if (countdownInterval) clearInterval(countdownInterval);
  if (room.status !== 'playing' || !raceStartAt) {
    countdownOverlay.classList.add('hidden');
    return;
  }

  const tick = () => {
    const remaining = raceStartAt - Date.now();
    if (remaining <= 0) {
      countdownOverlay.classList.add('hidden');
      typingInput.disabled = mySeat !== 'P1' && mySeat !== 'P2';
      if (!typingInput.disabled) typingInput.focus();
      clearInterval(countdownInterval);
      return;
    }
    countdownOverlay.classList.remove('hidden');
    countdownOverlay.textContent = Math.ceil(remaining / 1000);
  };
  tick();
  countdownInterval = setInterval(tick, 100);
}

function handleStatusTransition(room) {
  if (lastStatus === room.status) return;
  const prev = lastStatus;
  lastStatus = room.status;
  if (prev === null) return;
  if (room.status === 'playing') {
    hasStartedTyping = false;
    typingInput.value = '';
    typingInput.disabled = true;
    currentPassage = PASSAGES[room.passageIndex];
    renderPassageHighlight('', 0);
  } else if (room.status === 'finished') {
    try { onMultiplayerGameComplete(); } catch (e) {}
    if (mySeat === room.winner) sounds.playWin();
    else if (mySeat !== 'spectator') sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

async function handleLeave() {
  stopMatchmakingCountdown();
  if (botInterval) { clearInterval(botInterval); botInterval = null; }
  if (countdownInterval) clearInterval(countdownInterval);
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

function renderPassageHighlight(typed, correctLen) {
  const passage = currentPassage || (passageBox.dataset.passage || '');
  passageBox.dataset.passage = passage;
  let html = '';
  for (let i = 0; i < passage.length; i++) {
    const ch = passage[i];
    let cls = 'char-pending';
    if (i < correctLen) cls = 'char-correct';
    else if (i === correctLen && i < typed.length) cls = 'char-wrong';
    else if (i === correctLen) cls = 'char-current';
    html += `<span class="${cls}">${ch === ' ' ? '&nbsp;' : ch}</span>`;
  }
  passageBox.innerHTML = html;
}

function renderRoom(room) {
  if (!currentPassage) {
    currentPassage = PASSAGES[room.passageIndex];
    renderPassageHighlight('', 0);
  }

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') text = Date.now() < (room.raceStartAt || 0) ? 'Get ready…' : 'Type as fast (and accurately) as you can!';
  else if (room.status === 'finished') {
    if (mySeat === room.winner) text = 'You win the race! 🎉';
    else if (mySeat === 'spectator') text = `${room.winner} wins the race!`;
    else text = 'You lost the race — try again?';
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

function renderProgress() {
  let p1 = { progress: 0, wpm: 0 };
  let p2 = { progress: 0, wpm: 0 };
  for (const p of Object.values(playersMap)) {
    if (p.seat === 'P1') p1 = p;
    else if (p.seat === 'P2') p2 = p;
  }
  progressP1.style.width = (p1.progress || 0) + '%';
  progressP2.style.width = (p2.progress || 0) + '%';
  wpmP1.textContent = `${p1.wpm || 0} WPM`;
  wpmP2.textContent = `${p2.wpm || 0} WPM`;
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

shell.bindLandingActions({ onPlay: handlePlay, onJoinCode: handleJoinCode });

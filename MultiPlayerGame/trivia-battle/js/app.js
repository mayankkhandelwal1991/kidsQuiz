/**
 * trivia-battle/js/app.js
 * -----------------------------------------------------------------------
 * First player to answer a question correctly scores a point; first to 5
 * points (out of up to 8 questions) wins. Each question has a 10s timer;
 * if nobody answers correctly in time it's skipped with no score change.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager } from '../../common/utils.js';
import { QUESTIONS } from './questions.js';

const GAME_ID = 'trivia-battle';
const MATCH_WAIT_SECONDS = 10;
const SEATS = ['P1', 'P2'];
const WIN_SCORE = 5;
const ROUND_SECONDS = 10;
const NEXT_ROUND_DELAY_MS = 1800;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Trivia Battle' });
const sounds = new SoundManager();

const statusBar = document.getElementById('status-bar');
const categoryBadge = document.getElementById('category-badge');
const questionText = document.getElementById('question-text');
const timerFill = document.getElementById('timer-fill');
const answerOptionsEl = document.getElementById('answer-options');
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
let myAnswerThisRound = null;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
let botAnswerTimeout = null;
let botAnswerPendingIndex = null;
let roundTimerInterval = null;
let roundTimeoutFired = null;

function pickQuestionIndex(usedIndices) {
  let idx;
  let attempts = 0;
  do {
    idx = Math.floor(Math.random() * QUESTIONS.length);
    attempts++;
  } while (usedIndices.includes(idx) && attempts < 50);
  return idx;
}

function buildInitialRoom() {
  const questionIndex = pickQuestionIndex([]);
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    round: 1,
    questionIndex,
    roundStartAt: Date.now(),
    usedIndices: String(questionIndex),
    solvedBy: null,
    answers: { P1: null, P2: null },
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
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    handleStatusTransition(room);
    renderRoom(room);
    handleMatchmakingCountdown(room);
    manageRoundTimer(room);
    maybeTriggerBotAnswer(room);
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
    const questionIndex = pickQuestionIndex([]);
    roomRef.transaction((room) => {
      if (!room) return room;
      room.round = 1;
      room.scores = { P1: 0, P2: 0 };
      room.questionIndex = questionIndex;
      room.roundStartAt = Date.now();
      room.usedIndices = String(questionIndex);
      room.solvedBy = null;
      room.answers = { P1: null, P2: null };
      room.winner = null;
      room.status = 'playing';
      return room;
    });
  });
}

async function resetRoomForDisconnect() {
  const questionIndex = pickQuestionIndex([]);
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.round = 1;
    room.scores = { P1: 0, P2: 0 };
    room.questionIndex = questionIndex;
    room.roundStartAt = Date.now();
    room.usedIndices = String(questionIndex);
    room.solvedBy = null;
    room.answers = { P1: null, P2: null };
    room.winner = null;
    room.status = 'waiting';
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function handleAnswerClick(optionIndex) {
  if (mySeat !== 'P1' && mySeat !== 'P2') return;
  if (myAnswerThisRound !== null) return;
  myAnswerThisRound = optionIndex;
  attemptAnswer(mySeat, optionIndex);
}

async function attemptAnswer(seat, optionIndex) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    room.answers = room.answers || { P1: null, P2: null };
    if (room.answers[seat] !== null && room.answers[seat] !== undefined) return; // already answered
    room.answers[seat] = optionIndex;

    if (!room.solvedBy && optionIndex === QUESTIONS[room.questionIndex].correct) {
      room.solvedBy = seat;
      room.scores = room.scores || { P1: 0, P2: 0 };
      room.scores[seat] = (room.scores[seat] || 0) + 1;
      if (room.scores[seat] >= WIN_SCORE) {
        room.status = 'finished';
        room.winner = seat;
      }
    }
    return room;
  });

  if (txResult.committed) {
    const room = txResult.snapshot.val();
    const wasCorrect = optionIndex === QUESTIONS[room.questionIndex].correct;
    sounds[wasCorrect ? 'playSuccess' : 'playError']();
    if (room.solvedBy === seat && room.status === 'playing') {
      scheduleNextRound(room.questionIndex);
    }
  }
}

function scheduleNextRound(prevQuestionIndex) {
  setTimeout(() => advanceRound(prevQuestionIndex), NEXT_ROUND_DELAY_MS);
}

async function advanceRound(prevQuestionIndex) {
  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.questionIndex !== prevQuestionIndex) return; // already advanced

    const used = (room.usedIndices || '').split(',').filter(Boolean).map(Number);
    if (!used.includes(room.questionIndex)) used.push(room.questionIndex);
    const nextIndex = pickQuestionIndex(used);
    let newUsed = [...used, nextIndex];
    if (newUsed.length >= QUESTIONS.length) newUsed = [nextIndex];

    room.usedIndices = newUsed.join(',');
    room.questionIndex = nextIndex;
    room.roundStartAt = Date.now();
    room.solvedBy = null;
    room.answers = { P1: null, P2: null };
    room.round = (room.round || 1) + 1;
    return room;
  });
}

function maybeTriggerBotAnswer(room) {
  const botCanAnswer = room.mode === 'bot' && room.status === 'playing' && !(room.answers && room.answers.P2 != null);
  if (!botCanAnswer || mySeat !== 'P1') return;
  if (botAnswerPendingIndex === room.questionIndex) return;
  botAnswerPendingIndex = room.questionIndex;
  clearTimeout(botAnswerTimeout);

  const question = QUESTIONS[room.questionIndex];
  const willBeCorrect = Math.random() < 0.65;
  const chosen = willBeCorrect
    ? question.correct
    : (question.correct + 1 + Math.floor(Math.random() * (question.options.length - 1))) % question.options.length;

  const delay = 2500 + Math.random() * 6000; // 2.5s-8.5s "thinking"
  botAnswerTimeout = setTimeout(() => attemptAnswer('P2', chosen), delay);
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

function manageRoundTimer(room) {
  if (roundTimerInterval) clearInterval(roundTimerInterval);
  if (room.status !== 'playing') {
    timerFill.style.width = '100%';
    return;
  }

  const tick = () => {
    const elapsed = (Date.now() - (room.roundStartAt || Date.now())) / 1000;
    const remaining = Math.max(0, ROUND_SECONDS - elapsed);
    const pct = (remaining / ROUND_SECONDS) * 100;
    timerFill.style.width = pct + '%';
    timerFill.classList.toggle('low', remaining < 4);
    if (remaining <= 0 && roundTimeoutFired !== room.questionIndex) {
      roundTimeoutFired = room.questionIndex;
      advanceRound(room.questionIndex);
    }
  };
  tick();
  roundTimerInterval = setInterval(tick, 250);
}

function handleStatusTransition(room) {
  if (lastStatus === room.status) return;
  const prev = lastStatus;
  lastStatus = room.status;
  if (prev === null) return;
  if (room.status === 'playing') myAnswerThisRound = null;
  if (room.status === 'finished') {
    try { onMultiplayerGameComplete(); } catch (e) {}
    if (mySeat === room.winner) sounds.playWin();
    else if (mySeat !== 'spectator') sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

async function handleLeave() {
  stopMatchmakingCountdown();
  clearTimeout(botAnswerTimeout);
  botAnswerPendingIndex = null;
  if (roundTimerInterval) clearInterval(roundTimerInterval);
  roundTimeoutFired = null;
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

let lastRenderedQuestionIndex = -1;

function renderRoom(room) {
  const question = QUESTIONS[room.questionIndex];
  categoryBadge.textContent = question.category;
  questionText.textContent = question.q;

  if (lastRenderedQuestionIndex !== room.questionIndex) {
    lastRenderedQuestionIndex = room.questionIndex;
    myAnswerThisRound = mySeat === 'P1' || mySeat === 'P2' ? (room.answers && room.answers[mySeat] != null ? room.answers[mySeat] : null) : null;
    renderAnswerButtons(question, room);
  } else {
    updateAnswerButtonStates(question, room);
  }

  scoreP1.textContent = (room.scores && room.scores.P1) || 0;
  scoreP2.textContent = (room.scores && room.scores.P2) || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing');
  cardP2.classList.toggle('active-turn', room.status === 'playing');

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    text = room.solvedBy ? `${room.solvedBy} answered correctly! Next question…` : 'Answer as fast as you can!';
  } else if (room.status === 'finished') {
    if (mySeat === room.winner) text = 'You win the battle! 🎉';
    else if (mySeat === 'spectator') text = `${room.winner} wins the battle!`;
    else text = 'You lost the battle — play again?';
  }
  statusBar.textContent = text;
  statusBar.className = 'status-bar ' + (room.status === 'finished' ? (mySeat === room.winner ? 'status-won' : 'status-lost') : '');

  playAgainBtn.classList.toggle('hidden', room.status !== 'finished');
}

function renderAnswerButtons(question, room) {
  answerOptionsEl.innerHTML = '';
  question.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = opt;
    btn.dataset.index = i;
    btn.addEventListener('click', () => handleAnswerClick(i));
    answerOptionsEl.appendChild(btn);
  });
  updateAnswerButtonStates(question, room);
}

function updateAnswerButtonStates(question, room) {
  const canAnswer = room.status === 'playing' && (mySeat === 'P1' || mySeat === 'P2') && myAnswerThisRound === null;
  const revealAnswers = room.status !== 'playing' || !!room.solvedBy;

  Array.from(answerOptionsEl.children).forEach((btn, i) => {
    btn.disabled = !canAnswer;
    btn.classList.toggle('selected', myAnswerThisRound === i);
    btn.classList.remove('correct', 'wrong');
    if (revealAnswers) {
      if (i === question.correct) btn.classList.add('correct');
      else if (myAnswerThisRound === i) btn.classList.add('wrong');
    }
  });
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

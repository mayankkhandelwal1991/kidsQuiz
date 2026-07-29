/**
 * word-duel/js/app.js
 * -----------------------------------------------------------------------
 * First to solve each scrambled word scores a point; first to 4 points
 * wins the duel. Each round has a 25s timer; if nobody solves it in time
 * the round is skipped with no score change. Uses the shared word bank so
 * both clients always agree on the correct answer for a given index.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager } from '../../common/utils.js';
import { WORD_BANK, scrambleWord } from './wordbank.js';

const GAME_ID = 'word-duel';
const MATCH_WAIT_SECONDS = 10;
const SEATS = ['P1', 'P2'];
const WIN_SCORE = 4;
const ROUND_SECONDS = 25;
const NEXT_ROUND_DELAY_MS = 1600;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Word Duel' });
const sounds = new SoundManager();

const statusBar = document.getElementById('status-bar');
const categoryBadge = document.getElementById('category-badge');
const scrambledWordEl = document.getElementById('scrambled-word');
const timerFill = document.getElementById('timer-fill');
const guessForm = document.getElementById('guess-form');
const guessInput = document.getElementById('guess-input');
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
let botSolveTimeout = null;
let botSolvePendingIndex = null;
let roundTimerInterval = null;
let roundTimeoutFired = null; // wordIndex we've already scheduled a timeout-advance for

function pickWordIndex(usedIndices) {
  let idx;
  let attempts = 0;
  do {
    idx = Math.floor(Math.random() * WORD_BANK.length);
    attempts++;
  } while (usedIndices.includes(idx) && attempts < 50);
  return idx;
}

function buildInitialRoom() {
  const wordIndex = pickWordIndex([]);
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    round: 1,
    wordIndex,
    scrambled: scrambleWord(WORD_BANK[wordIndex].word),
    roundStartAt: Date.now(),
    usedIndices: String(wordIndex),
    solvedBy: null,
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

  guessForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleGuess();
  });
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    handleStatusTransition(room);
    renderRoom(room);
    handleMatchmakingCountdown(room);
    manageRoundTimer(room);
    maybeTriggerBotSolve(room);
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
    const wordIndex = pickWordIndex([]);
    roomRef.transaction((room) => {
      if (!room) return room;
      room.round = 1;
      room.scores = { P1: 0, P2: 0 };
      room.wordIndex = wordIndex;
      room.scrambled = scrambleWord(WORD_BANK[wordIndex].word);
      room.roundStartAt = Date.now();
      room.usedIndices = String(wordIndex);
      room.solvedBy = null;
      room.winner = null;
      room.status = 'playing';
      return room;
    });
  });
}

async function resetRoomForDisconnect() {
  const wordIndex = pickWordIndex([]);
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.round = 1;
    room.scores = { P1: 0, P2: 0 };
    room.wordIndex = wordIndex;
    room.scrambled = scrambleWord(WORD_BANK[wordIndex].word);
    room.roundStartAt = Date.now();
    room.usedIndices = String(wordIndex);
    room.solvedBy = null;
    room.winner = null;
    room.status = 'waiting';
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function handleGuess() {
  const guess = guessInput.value.trim();
  guessInput.value = '';
  if (!guess || (mySeat !== 'P1' && mySeat !== 'P2')) return;
  attemptSolve(mySeat, guess);
}

async function attemptSolve(seat, guess) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.solvedBy) return; // someone already solved this round — abort
    const correct = WORD_BANK[room.wordIndex].word;
    if (guess.trim().toUpperCase() !== correct) return; // wrong guess — abort (no penalty)

    room.solvedBy = seat;
    room.scores = room.scores || { P1: 0, P2: 0 };
    room.scores[seat] = (room.scores[seat] || 0) + 1;

    if (room.scores[seat] >= WIN_SCORE) {
      room.status = 'finished';
      room.winner = seat;
    }
    return room;
  });

  if (txResult.committed && txResult.snapshot.val() && txResult.snapshot.val().solvedBy === seat) {
    sounds.playSuccess();
    const room = txResult.snapshot.val();
    if (room.status === 'playing') scheduleNextRound(room.wordIndex);
  } else if (txResult.committed === false) {
    // Transaction aborted — either wrong guess or already solved; only
    // give feedback for a genuinely wrong guess by the still-open round.
  }
}

function scheduleNextRound(prevWordIndex) {
  setTimeout(() => advanceRound(prevWordIndex), NEXT_ROUND_DELAY_MS);
}

async function advanceRound(prevWordIndex) {
  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return; // finished or not started — nothing to advance
    if (room.wordIndex !== prevWordIndex) return; // someone already advanced — abort

    const used = (room.usedIndices || '').split(',').filter(Boolean).map(Number);
    if (!used.includes(room.wordIndex)) used.push(room.wordIndex);
    const nextIndex = pickWordIndex(used);
    let newUsed = [...used, nextIndex];
    if (newUsed.length >= WORD_BANK.length) newUsed = [nextIndex]; // cycle exhausted — start fresh

    room.usedIndices = newUsed.join(',');
    room.wordIndex = nextIndex;
    room.scrambled = scrambleWord(WORD_BANK[nextIndex].word);
    room.roundStartAt = Date.now();
    room.solvedBy = null;
    room.round = (room.round || 1) + 1;
    return room;
  });
}

function computeBotGuessDelayMs() {
  // Bot "thinks" for somewhere between 4s and 16s — beatable by a quick human,
  // and sometimes doesn't finish before the 25s timer runs out at all.
  return 4000 + Math.random() * 12000;
}

function maybeTriggerBotSolve(room) {
  const botCanSolve = room.mode === 'bot' && room.status === 'playing' && !room.solvedBy;
  if (!botCanSolve || mySeat !== 'P1') return;
  if (botSolvePendingIndex === room.wordIndex) return;
  botSolvePendingIndex = room.wordIndex;
  clearTimeout(botSolveTimeout);
  const correctWord = WORD_BANK[room.wordIndex].word;
  botSolveTimeout = setTimeout(() => {
    attemptSolve('P2', correctWord);
  }, computeBotGuessDelayMs());
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

/** Client-side round timer: ticks the visual bar and, if it expires with
 * nobody having solved, calls advanceRound (guarded so only the first
 * caller across all connected clients actually advances). */
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
    timerFill.classList.toggle('low', remaining < 8);
    if (remaining <= 0 && roundTimeoutFired !== room.wordIndex) {
      roundTimeoutFired = room.wordIndex;
      advanceRound(room.wordIndex);
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
  if (room.status === 'finished') {
    try { onMultiplayerGameComplete(); } catch (e) {}
    if (mySeat === room.winner) sounds.playWin();
    else if (mySeat !== 'spectator') sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

async function handleLeave() {
  stopMatchmakingCountdown();
  clearTimeout(botSolveTimeout);
  botSolvePendingIndex = null;
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

function renderRoom(room) {
  categoryBadge.textContent = WORD_BANK[room.wordIndex].category;
  scrambledWordEl.textContent = room.scrambled;
  scoreP1.textContent = (room.scores && room.scores.P1) || 0;
  scoreP2.textContent = (room.scores && room.scores.P2) || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing');
  cardP2.classList.toggle('active-turn', room.status === 'playing');

  const canGuess = room.status === 'playing' && (mySeat === 'P1' || mySeat === 'P2');
  guessForm.classList.toggle('disabled', !canGuess);

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    text = room.solvedBy ? `${room.solvedBy} solved it! Next word coming up…` : 'Unscramble the word!';
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

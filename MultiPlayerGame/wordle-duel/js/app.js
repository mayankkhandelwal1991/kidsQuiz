/**
 * wordle-duel/js/app.js
 * -----------------------------------------------------------------------
 * Both players guess the SAME secret word independently, up to 6 tries
 * each. Whoever guesses it correctly first wins the round and scores a
 * point (first to WIN_SCORE round wins takes the duel). If both players
 * exhaust all 6 guesses without solving it, the round is a draw and a
 * new word is dealt.
 *
 * NOTE ON FAIRNESS: same caveat as word-duel/trivia-battle — because
 * this project intentionally uses only the Realtime Database with open
 * rules, the secret word is technically derivable from the shared word
 * list plus the room's `wordIndex`. See the project README.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager } from '../../common/utils.js';
import { WORDS, WORD_LENGTH, MAX_GUESSES, computeFeedback } from './wordbank.js';

const GAME_ID = 'wordle-duel';
const MATCH_WAIT_SECONDS = 30;
const SEATS = ['P1', 'P2'];
const WIN_SCORE = 2;
const NEXT_ROUND_DELAY_MS = 2200;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Wordle Duel' });
const sounds = new SoundManager();

const statusBar = document.getElementById('status-bar');
const roundNum = document.getElementById('round-num');
const scoreP1 = document.getElementById('score-p1');
const scoreP2 = document.getElementById('score-p2');
const cardP1 = document.getElementById('card-p1');
const cardP2 = document.getElementById('card-p2');
const nameP1 = document.getElementById('name-p1');
const nameP2 = document.getElementById('name-p2');
const opponentProgress = document.getElementById('opponent-progress');
const guessGrid = document.getElementById('guess-grid');
const keyboardEl = document.getElementById('keyboard');
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
let botPendingKey = null;

let currentInput = '';
let lastRenderedWordIndex = -1;
let shakeRow = -1;

function pickWordIndex(usedIndices) {
  let idx;
  let attempts = 0;
  do {
    idx = Math.floor(Math.random() * WORDS.length);
    attempts++;
  } while (usedIndices.includes(idx) && attempts < 80);
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
    usedIndices: String(wordIndex),
    guesses: { P1: [], P2: [] },
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
  bindKeyboard();
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
    maybeTriggerBotGuess(room);
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
      room.usedIndices = String(wordIndex);
      room.solvedBy = null;
      room.guesses = { P1: [], P2: [] };
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
    room.usedIndices = String(wordIndex);
    room.solvedBy = null;
    room.guesses = { P1: [], P2: [] };
    room.winner = null;
    room.status = 'waiting';
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

async function attemptGuess(seat, guessWord) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.solvedBy) return; // round already decided, waiting on the pause before advancing
    room.guesses = room.guesses || { P1: [], P2: [] };
    room.guesses[seat] = room.guesses[seat] || [];
    if (room.guesses[seat].length >= MAX_GUESSES) return; // no tries left this round
    room.guesses[seat] = [...room.guesses[seat], guessWord];

    const secret = WORDS[room.wordIndex];
    const bothDone = room.guesses.P1.length >= MAX_GUESSES && room.guesses.P2.length >= MAX_GUESSES;

    if (guessWord === secret) {
      room.solvedBy = seat;
      room.scores = room.scores || { P1: 0, P2: 0 };
      room.scores[seat] = (room.scores[seat] || 0) + 1;
      if (room.scores[seat] >= WIN_SCORE) {
        room.status = 'finished';
        room.winner = seat;
      }
    } else if (bothDone) {
      room.solvedBy = 'draw';
    }
    return room;
  });

  if (txResult.committed) {
    const room = txResult.snapshot.val();
    const secret = WORDS[room.wordIndex];
    sounds[guessWord === secret ? 'playSuccess' : 'playClick']();
    if (room.solvedBy && room.status === 'playing') {
      scheduleNextRound(room.wordIndex);
    }
  }
}

function scheduleNextRound(prevWordIndex) {
  setTimeout(() => advanceRound(prevWordIndex), NEXT_ROUND_DELAY_MS);
}

async function advanceRound(prevWordIndex) {
  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.wordIndex !== prevWordIndex) return; // already advanced

    const used = (room.usedIndices || '').split(',').filter(Boolean).map(Number);
    if (!used.includes(room.wordIndex)) used.push(room.wordIndex);
    const nextIndex = pickWordIndex(used);
    let newUsed = [...used, nextIndex];
    if (newUsed.length >= WORDS.length) newUsed = [nextIndex];

    room.usedIndices = newUsed.join(',');
    room.wordIndex = nextIndex;
    room.solvedBy = null;
    room.guesses = { P1: [], P2: [] };
    room.round = (room.round || 1) + 1;
    return room;
  });
}

function maybeTriggerBotGuess(room) {
  const botGuesses = (room.guesses && room.guesses.P2) || [];
  const botCanGuess = room.mode === 'bot' && room.status === 'playing' && !room.solvedBy && botGuesses.length < MAX_GUESSES;
  if (!botCanGuess || mySeat !== 'P1') return;
  const key = room.wordIndex + '-' + botGuesses.length;
  if (botPendingKey === key) return;
  botPendingKey = key;
  clearTimeout(botTimeout);

  const secret = WORDS[room.wordIndex];
  const chance = Math.min(0.15 + botGuesses.length * 0.15, 0.9);
  let guess;
  if (Math.random() < chance) {
    guess = secret;
  } else {
    const pool = WORDS.filter((w) => w !== secret && !botGuesses.includes(w));
    guess = pool[Math.floor(Math.random() * pool.length)] || secret;
  }
  const delay = 2000 + Math.random() * 4500;
  botTimeout = setTimeout(() => attemptGuess('P2', guess), delay);
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
  stopMatchmakingCountdown();
  clearTimeout(botTimeout);
  botPendingKey = null;
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  currentInput = '';
  lastRenderedWordIndex = -1;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Keyboard input
// ---------------------------------------------------------------------

const KB_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

function bindKeyboard() {
  keyboardEl.innerHTML = '';
  KB_ROWS.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    row.forEach((key) => {
      const btn = document.createElement('button');
      btn.className = 'kb-key' + (key === 'ENTER' || key === 'BACK' ? ' wide' : '');
      btn.dataset.key = key;
      btn.textContent = key === 'BACK' ? '⌫' : (key === 'ENTER' ? 'ENTER' : key);
      btn.addEventListener('click', () => handleKeyInput(key));
      rowEl.appendChild(btn);
    });
    keyboardEl.appendChild(rowEl);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleKeyInput('ENTER');
    else if (e.key === 'Backspace') handleKeyInput('BACK');
    else if (/^[a-zA-Z]$/.test(e.key)) handleKeyInput(e.key.toUpperCase());
  });
}

function canCurrentlyType() {
  if (mySeat !== 'P1' && mySeat !== 'P2') return false;
  if (!latestRoom) return false;
  if (latestRoom.status !== 'playing') return false;
  if (latestRoom.solvedBy) return false;
  const mine = (latestRoom.guesses && latestRoom.guesses[mySeat]) || [];
  return mine.length < MAX_GUESSES;
}

function handleKeyInput(key) {
  if (!canCurrentlyType()) return;
  if (key === 'BACK') {
    currentInput = currentInput.slice(0, -1);
  } else if (key === 'ENTER') {
    if (currentInput.length !== WORD_LENGTH) {
      triggerShake();
      return;
    }
    const word = currentInput;
    currentInput = '';
    attemptGuess(mySeat, word);
  } else if (/^[A-Z]$/.test(key) && currentInput.length < WORD_LENGTH) {
    currentInput += key;
  }
  renderGrid(latestRoom);
}

function triggerShake() {
  const mine = (latestRoom.guesses && latestRoom.guesses[mySeat]) || [];
  shakeRow = mine.length;
  renderGrid(latestRoom);
  setTimeout(() => { shakeRow = -1; }, 400);
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

let latestRoom = null;

function renderRoom(room) {
  latestRoom = room;
  roundNum.textContent = room.round || 1;
  scoreP1.textContent = (room.scores && room.scores.P1) || 0;
  scoreP2.textContent = (room.scores && room.scores.P2) || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing');
  cardP2.classList.toggle('active-turn', room.status === 'playing');

  if (lastRenderedWordIndex !== room.wordIndex) {
    lastRenderedWordIndex = room.wordIndex;
    currentInput = '';
  }

  renderGrid(room);
  renderKeyboardColors(room);

  const oppSeat = mySeat === 'P1' ? 'P2' : (mySeat === 'P2' ? 'P1' : null);
  if (oppSeat) {
    const oppCount = ((room.guesses && room.guesses[oppSeat]) || []).length;
    if (room.solvedBy === oppSeat) opponentProgress.textContent = `${oppSeat === 'P1' ? nameP1.textContent : nameP2.textContent} solved it!`;
    else opponentProgress.textContent = room.status === 'playing' ? `Opponent: ${oppCount}/${MAX_GUESSES} guesses` : '';
  } else {
    opponentProgress.textContent = '';
  }

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    if (room.solvedBy === 'draw') text = "Nobody cracked it — new word!";
    else if (room.solvedBy) text = `${room.solvedBy} guessed it! Next word…`;
    else if (mySeat === 'spectator') text = 'Watching the duel…';
    else text = 'Guess the 5-letter word!';
  } else if (room.status === 'finished') {
    if (mySeat === room.winner) text = 'You win the duel! 🎉';
    else if (mySeat === 'spectator') text = `${room.winner} wins the duel!`;
    else text = 'You lost the duel — play again?';
  }
  statusBar.textContent = text;
  statusBar.className = 'status-bar ' + (room.status === 'finished' ? (mySeat === room.winner ? 'status-won' : 'status-lost') : '');

  playAgainBtn.classList.toggle('hidden', room.status !== 'finished');
}

function renderGrid(room) {
  if (!room) return;
  guessGrid.innerHTML = '';
  const secret = WORDS[room.wordIndex];
  const mySeatSafe = mySeat === 'P1' || mySeat === 'P2' ? mySeat : 'P1';
  const mine = (room.guesses && room.guesses[mySeatSafe]) || [];

  for (let r = 0; r < MAX_GUESSES; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'guess-row' + (shakeRow === r ? ' pop' : '');
    let letters = ['', '', '', '', ''];
    let feedback = null;

    if (r < mine.length) {
      letters = mine[r].split('');
      feedback = computeFeedback(mine[r], secret);
    } else if (r === mine.length && currentInput) {
      letters = currentInput.split('');
    }

    for (let c = 0; c < WORD_LENGTH; c++) {
      const cell = document.createElement('div');
      cell.className = 'guess-cell' + (letters[c] ? ' filled' : '');
      if (feedback) cell.classList.add(feedback[c]);
      cell.textContent = letters[c] || '';
      rowEl.appendChild(cell);
    }
    guessGrid.appendChild(rowEl);
  }
}

function renderKeyboardColors(room) {
  const secret = WORDS[room.wordIndex];
  const mySeatSafe = mySeat === 'P1' || mySeat === 'P2' ? mySeat : 'P1';
  const mine = (room.guesses && room.guesses[mySeatSafe]) || [];
  const best = {};
  const rank = { absent: 0, present: 1, correct: 2 };

  mine.forEach((guess) => {
    const feedback = computeFeedback(guess, secret);
    guess.split('').forEach((ch, i) => {
      if (!best[ch] || rank[feedback[i]] > rank[best[ch]]) best[ch] = feedback[i];
    });
  });

  const canType = canCurrentlyType();
  Array.from(keyboardEl.querySelectorAll('.kb-key')).forEach((btn) => {
    const key = btn.dataset.key;
    btn.classList.remove('correct', 'present', 'absent');
    if (best[key]) btn.classList.add(best[key]);
    btn.disabled = !canType;
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

document.getElementById('win-target').textContent = WIN_SCORE;
shell.bindLandingActions({ onPlay: handlePlay, onJoinCode: handleJoinCode });

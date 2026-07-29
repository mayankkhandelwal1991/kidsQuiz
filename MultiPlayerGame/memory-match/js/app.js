/**
 * memory-match/js/app.js
 * -----------------------------------------------------------------------
 * Classic Concentration: 4x4 grid, 8 emoji pairs. Current player flips two
 * cards; a match scores a point and grants another turn, a mismatch passes
 * the turn after a brief reveal. The deck is generated once at room
 * creation and stored in Firebase so both clients see identical cards.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, shuffle } from '../../common/utils.js';

const GAME_ID = 'memory-match';
const MATCH_WAIT_SECONDS = 30;
const SEATS = ['P1', 'P2'];
const SYMBOLS = ['🎮', '🎧', '🍕', '🚀', '🏀', '⚽', '🎸', '🔥'];
const MISMATCH_PAUSE_MS = 900;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Memory Match' });
const sounds = new SoundManager();

const boardEl = document.getElementById('board');
const statusBar = document.getElementById('status-bar');
const scoreP1 = document.getElementById('score-p1');
const scoreP2 = document.getElementById('score-p2');
const cardP1 = document.getElementById('card-p1');
const cardP2 = document.getElementById('card-p2');
const nameP1 = document.getElementById('name-p1');
const nameP2 = document.getElementById('name-p2');
const spectatorCount = document.getElementById('spectator-count');
const playAgainBtn = document.getElementById('play-again-btn');

const cellEls = [];
for (let i = 0; i < 16; i++) {
  const cell = document.createElement('div');
  cell.className = 'memory-card face-down';
  cell.dataset.index = i;
  cell.textContent = '❔';
  boardEl.appendChild(cell);
  cellEls.push(cell);
}
boardEl.addEventListener('click', (e) => {
  const cellEl = e.target.closest('.memory-card');
  if (!cellEl) return;
  handleCardClick(Number(cellEl.dataset.index));
});

let roomRef = null;
let playersRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastStatus = null;
let lastRevealedKey = '';

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
let botMoveTimeout = null;
let botMemory = {}; // index -> symbol, only cards the bot has actually seen revealed
let botFirstPick = null;
let botTurnKey = null;

function buildDeck() {
  return shuffle([...SYMBOLS, ...SYMBOLS]);
}

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    deck: buildDeck(),
    revealed: [],
    matched: [],
    turn: 'P1',
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
    updateBotMemory(room);
    renderRoom(room);
    handleMatchmakingCountdown(room);
    maybeTriggerBotMove(room);
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
    botMemory = {};
    roomRef.transaction((room) => {
      if (!room) return room;
      room.deck = buildDeck();
      room.revealed = [];
      room.matched = [];
      room.turn = 'P1';
      room.scores = { P1: 0, P2: 0 };
      room.winner = null;
      room.status = 'playing';
      return room;
    });
  });
}

async function resetRoomForDisconnect() {
  botMemory = {};
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.deck = buildDeck();
    room.revealed = [];
    room.matched = [];
    room.turn = 'P1';
    room.scores = { P1: 0, P2: 0 };
    room.winner = null;
    room.status = 'waiting';
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function handleCardClick(index) {
  if (mySeat !== 'P1' && mySeat !== 'P2') return;
  attemptFlip(mySeat, index);
}

async function attemptFlip(seat, index) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.turn !== seat) return;
    const matched = room.matched || [];
    const revealed = room.revealed || [];
    if (matched.includes(index) || revealed.includes(index)) return;
    if (revealed.length >= 2) return; // still resolving previous pair

    revealed.push(index);
    room.revealed = revealed;

    if (revealed.length === 2) {
      const [a, b] = revealed;
      if (room.deck[a] === room.deck[b]) {
        room.matched = [...matched, a, b];
        room.revealed = [];
        room.scores = room.scores || { P1: 0, P2: 0 };
        room.scores[seat] = (room.scores[seat] || 0) + 1;
        if (room.matched.length >= 16) {
          room.status = 'finished';
          const s = room.scores;
          room.winner = s.P1 === s.P2 ? null : (s.P1 > s.P2 ? 'P1' : 'P2');
        }
        // Matching player keeps their turn (room.turn unchanged).
      }
      // Mismatches are left visible in `revealed` for the caller to
      // schedule a delayed clear + turn-pass (see scheduleMismatchClear).
    }
    return room;
  });

  if (txResult.committed) {
    const room = txResult.snapshot.val();
    if (room && room.revealed && room.revealed.length === 2) {
      const [a, b] = room.revealed;
      if (room.deck[a] === room.deck[b]) {
        sounds.playSuccess();
      } else {
        sounds.playClick();
        scheduleMismatchClear(seat, a, b);
      }
    } else {
      sounds.playClick();
    }
  }
}

function scheduleMismatchClear(revealedBySeat, a, b) {
  setTimeout(() => {
    roomRef.transaction((room) => {
      if (!room) return room;
      const revealed = room.revealed || [];
      if (revealed.length !== 2 || revealed[0] !== a || revealed[1] !== b) return; // already resolved
      room.revealed = [];
      room.turn = revealedBySeat === 'P1' ? 'P2' : 'P1';
      return room;
    });
  }, MISMATCH_PAUSE_MS);
}

// ---------------------------------------------------------------------
// Bot: only "remembers" cards it has actually watched get revealed
// (including the human's flips), same as a fair human opponent would.
// ---------------------------------------------------------------------

function updateBotMemory(room) {
  const deck = room.deck || [];
  for (const i of room.matched || []) botMemory[i] = deck[i];
  for (const i of room.revealed || []) botMemory[i] = deck[i];
}

function findKnownPair(excludeIndices, matched) {
  const bySymbol = {};
  for (const [idxStr, symbol] of Object.entries(botMemory)) {
    const idx = Number(idxStr);
    if (matched.includes(idx) || excludeIndices.includes(idx)) continue;
    if (!bySymbol[symbol]) bySymbol[symbol] = [];
    bySymbol[symbol].push(idx);
  }
  for (const indices of Object.values(bySymbol)) {
    if (indices.length >= 2) return indices.slice(0, 2);
  }
  return null;
}

function pickRandomUnknown(matched, excludeIndices) {
  const options = [];
  for (let i = 0; i < 16; i++) {
    if (!matched.includes(i) && !excludeIndices.includes(i)) options.push(i);
  }
  return options[Math.floor(Math.random() * options.length)];
}

function maybeTriggerBotMove(room) {
  const isBotTurn = room.mode === 'bot' && room.status === 'playing' && room.turn === 'P2';
  if (!isBotTurn || mySeat !== 'P1') return;

  const revealed = room.revealed || [];
  const matched = room.matched || [];
  const key = `${room.turn}-${matched.length}-${revealed.join(',')}`;
  if (botTurnKey === key) return;
  botTurnKey = key;

  clearTimeout(botMoveTimeout);

  if (revealed.length === 0) {
    // First flip of the bot's turn.
    const knownPair = findKnownPair([], matched);
    const useMemory = knownPair && Math.random() < 0.75;
    const first = useMemory ? knownPair[0] : pickRandomUnknown(matched, []);
    botMoveTimeout = setTimeout(() => attemptFlip('P2', first), 700 + Math.random() * 500);
  } else if (revealed.length === 1) {
    // Second flip: use memory of the first card's match if we have it.
    const firstIndex = revealed[0];
    const firstSymbol = botMemory[firstIndex];
    let second = null;
    if (firstSymbol && Math.random() < 0.75) {
      for (const [idxStr, symbol] of Object.entries(botMemory)) {
        const idx = Number(idxStr);
        if (idx !== firstIndex && symbol === firstSymbol && !matched.includes(idx)) { second = idx; break; }
      }
    }
    if (second === null) second = pickRandomUnknown(matched, [firstIndex]);
    botMoveTimeout = setTimeout(() => attemptFlip('P2', second), 700 + Math.random() * 500);
  }
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
    if (room.winner === null) sounds.playDraw();
    else if (mySeat === room.winner) sounds.playWin();
    else if (mySeat !== 'spectator') sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

async function handleLeave() {
  stopMatchmakingCountdown();
  clearTimeout(botMoveTimeout);
  botTurnKey = null;
  botMemory = {};
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
  const deck = room.deck || [];
  const revealed = room.revealed || [];
  const matched = room.matched || [];

  cellEls.forEach((cellEl, i) => {
    const isMatched = matched.includes(i);
    const isRevealed = revealed.includes(i);
    cellEl.classList.toggle('matched', isMatched);
    cellEl.classList.toggle('face-up', isRevealed && !isMatched);
    cellEl.classList.toggle('face-down', !isRevealed && !isMatched);
    cellEl.textContent = isMatched || isRevealed ? deck[i] : '❔';
  });

  const locked = room.status !== 'playing' || mySeat !== room.turn || revealed.length >= 2;
  boardEl.classList.toggle('locked', locked);

  scoreP1.textContent = (room.scores && room.scores.P1) || 0;
  scoreP2.textContent = (room.scores && room.scores.P2) || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing' && room.turn === 'P1');
  cardP2.classList.toggle('active-turn', room.status === 'playing' && room.turn === 'P2');

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    if (mySeat === 'spectator') text = `${room.turn}'s turn`;
    else text = mySeat === room.turn ? 'Your turn — flip two cards' : "Opponent's turn";
  } else if (room.status === 'finished') {
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

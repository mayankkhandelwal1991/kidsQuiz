/**
 * connect-four/js/app.js
 * -----------------------------------------------------------------------
 * Full game logic for Connect Four: quick-match pairing, seat claiming,
 * drop-move transactions with win detection, a 30s bot fallback, and
 * rendering. Uses the shared common/ modules for networking + UI chrome.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState, measurePing } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager } from '../../common/utils.js';

const GAME_ID = 'connect4';
const COLS = 7;
const ROWS = 6;
const MATCH_WAIT_SECONDS = 30;
const BOT_MOVE_DELAY_MS = 550;
const SEATS = ['R', 'Y'];

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Connect Four Arena' });
const sounds = new SoundManager();

const boardEl = document.getElementById('board');
const statusBar = document.getElementById('status-bar');
const scoreR = document.getElementById('score-r');
const scoreY = document.getElementById('score-y');
const cardR = document.getElementById('card-r');
const cardY = document.getElementById('card-y');
const nameR = document.getElementById('name-r');
const nameY = document.getElementById('name-y');
const spectatorCount = document.getElementById('spectator-count');
const playAgainBtn = document.getElementById('play-again-btn');

// Build the 6x7 cell grid once.
const cellEls = [];
for (let i = 0; i < ROWS * COLS; i++) {
  const cell = document.createElement('div');
  cell.className = 'c4-cell';
  cell.dataset.index = i;
  boardEl.appendChild(cell);
  cellEls.push(cell);
}
boardEl.addEventListener('click', (e) => {
  const cellEl = e.target.closest('.c4-cell');
  if (!cellEl) return;
  const index = Number(cellEl.dataset.index);
  const col = index % COLS;
  handleColumnClick(col);
});

let roomRef = null;
let playersRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastStatus = null;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
let botMoveTimeout = null;
let botMovePendingKey = null;

function emptyCells() {
  const c = {};
  for (let i = 0; i < ROWS * COLS; i++) c[i] = '';
  return c;
}

/** All 4-in-a-row winning lines are checked dynamically rather than precomputed (board is small). */
function checkConnect4Winner(cells) {
  const get = (r, c) => (r < 0 || r >= ROWS || c < 0 || c >= COLS ? '' : cells[r * COLS + c] || '');
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = get(r, c);
      if (!v) continue;
      for (const [dr, dc] of dirs) {
        const line = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]);
        if (line.every(([rr, cc]) => get(rr, cc) === v)) {
          return { winner: v, line: line.map(([rr, cc]) => rr * COLS + cc) };
        }
      }
    }
  }
  return { winner: null, line: null };
}

function isBoardFull(cells) {
  for (let c = 0; c < COLS; c++) if (!cells[c]) return false; // top row empty means column open
  return true;
}

/** Find the lowest empty row in `col`, or -1 if the column is full. */
function lowestEmptyRow(cells, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!cells[r * COLS + col]) return r;
  }
  return -1;
}

// ---------------------------------------------------------------------
// Bot AI: win > block > center preference > mostly-optimal with a little
// randomness so it stays beatable.
// ---------------------------------------------------------------------
function computeBotMove(cells) {
  const validCols = [];
  for (let c = 0; c < COLS; c++) if (lowestEmptyRow(cells, c) >= 0) validCols.push(c);
  if (!validCols.length) return -1;

  const tryMove = (col, symbol) => {
    const row = lowestEmptyRow(cells, col);
    if (row < 0) return false;
    const copy = { ...cells };
    copy[row * COLS + col] = symbol;
    return checkConnect4Winner(copy).winner === symbol;
  };

  for (const col of validCols) if (tryMove(col, 'Y')) return col;
  for (const col of validCols) if (tryMove(col, 'R')) return col;

  const playsWell = Math.random() < 0.8;
  if (playsWell) {
    const center = Math.floor(COLS / 2);
    const byCenterDistance = [...validCols].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    return byCenterDistance[0];
  }
  return validCols[Math.floor(Math.random() * validCols.length)];
}

// ---------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    turn: 'R',
    winner: null,
    winningLine: null,
    cells: emptyCells(),
    scores: { R: 0, Y: 0 },
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
  if (!code) {
    shell.showError('Enter a room code to join.');
    return;
  }
  shell.setBusy(true);
  try {
    const exists = await quickMatch.roomExists(code);
    if (!exists) {
      shell.showError(`Room "${code}" doesn't exist.`);
      return;
    }
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

  if (mySeat === 'Y') {
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
  shell.toast(mySeat === 'spectator' ? "Both seats are taken — you're spectating." : `You're playing as ${mySeat === 'R' ? '🔴 Red' : '🟡 Yellow'}`, 'info');

  pingLoop();
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    handleStatusTransition(room);
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
      if (data.seat === 'R' || data.seat === 'Y') resetRoomForDisconnect();
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
      room.cells = emptyCells();
      room.turn = 'R';
      room.status = 'playing';
      room.winner = null;
      room.winningLine = null;
      return room;
    });
  });
}

async function resetRoomForDisconnect() {
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.cells = emptyCells();
    room.turn = 'R';
    room.status = 'waiting';
    room.winner = null;
    room.winningLine = null;
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

async function handleColumnClick(col) {
  if (mySeat !== 'R' && mySeat !== 'Y') return;
  const committed = await attemptDrop(col, mySeat);
  if (committed) sounds.playClick();
}

async function attemptDrop(col, symbol) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.turn !== symbol) return;
    const cells = room.cells || {};
    const row = lowestEmptyRow(cells, col);
    if (row < 0) return;
    cells[row * COLS + col] = symbol;
    room.cells = cells;

    const { winner, line } = checkConnect4Winner(cells);
    if (winner) {
      room.status = 'won';
      room.winner = winner;
      room.winningLine = line.join(',');
      room.scores = room.scores || { R: 0, Y: 0 };
      room.scores[winner] = (room.scores[winner] || 0) + 1;
    } else if (isBoardFull(cells)) {
      room.status = 'draw';
    } else {
      room.turn = room.turn === 'R' ? 'Y' : 'R';
    }
    return room;
  });
  return txResult.committed;
}

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    room.mode = 'bot';
    room.status = 'playing';
    room.players = room.players || {};
    room.players['bot'] = { nickname: 'Computer', seat: 'Y', joinedAt: Date.now() };
    return room;
  });
  if (txResult.committed) await quickMatch.clearIfMatches(roomRef.key);
}

function handleMatchmakingCountdown(room) {
  const iAmWaitingAlone = mySeat === 'R' && room.status === 'waiting';
  if (!iAmWaitingAlone) {
    stopMatchmakingCountdown();
    return;
  }
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
  if (matchmakingInterval) {
    clearInterval(matchmakingInterval);
    matchmakingInterval = null;
  }
  shell.hideWaitingCountdown();
}

function maybeTriggerBotMove(room) {
  const isBotTurn = room.mode === 'bot' && room.status === 'playing' && room.turn === 'Y';
  if (!isBotTurn || mySeat !== 'R') return;
  const key = Object.values(room.cells || {}).join('');
  if (botMovePendingKey === key) return;
  botMovePendingKey = key;
  clearTimeout(botMoveTimeout);
  botMoveTimeout = setTimeout(() => {
    const col = computeBotMove(room.cells || {});
    if (col >= 0) attemptDrop(col, 'Y');
  }, BOT_MOVE_DELAY_MS);
}

function handleStatusTransition(room) {
  if (lastStatus === room.status) return;
  const prev = lastStatus;
  lastStatus = room.status;
  if (prev === null) return;
  if (room.status === 'won') {
    sounds.playWin();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
  else if (room.status === 'draw') sounds.playDraw();
}

async function handleLeave() {
  stopMatchmakingCountdown();
  clearTimeout(botMoveTimeout);
  botMovePendingKey = null;
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  roomRef = null;
  shell.showLandingScreen();
}

function pingLoop() {
  // Ping isn't shown in this game's compact HUD, but we still keep the
  // connection state watcher warm via measurePing for parity/diagnostics.
  measurePing(db);
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function renderRoom(room) {
  const cells = room.cells || {};
  const winLine = room.winningLine ? room.winningLine.split(',').map(Number) : [];

  cellEls.forEach((cellEl, i) => {
    const value = cells[i] || '';
    cellEl.innerHTML = '';
    cellEl.classList.remove('win');
    if (value) {
      const disc = document.createElement('div');
      disc.className = `c4-disc ${value.toLowerCase()}`;
      cellEl.appendChild(disc);
    }
    if (winLine.includes(i)) cellEl.classList.add('win');
  });

  const clickable = room.status === 'playing' && mySeat === room.turn;
  boardEl.classList.toggle('clickable', clickable);

  scoreR.textContent = (room.scores && room.scores.R) || 0;
  scoreY.textContent = (room.scores && room.scores.Y) || 0;
  cardR.classList.toggle('active-turn', room.status === 'playing' && room.turn === 'R');
  cardY.classList.toggle('active-turn', room.status === 'playing' && room.turn === 'Y');

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    if (mySeat === 'spectator') text = `${room.turn === 'R' ? '🔴' : '🟡'}'s turn`;
    else text = mySeat === room.turn ? 'Your turn' : "Opponent's turn";
  } else if (room.status === 'won') {
    if (mySeat === room.winner) text = 'You win! 🎉';
    else if (mySeat === 'spectator') text = `${room.winner === 'R' ? '🔴 Red' : '🟡 Yellow'} wins!`;
    else text = 'You lost — play again?';
  } else if (room.status === 'draw') {
    text = "It's a draw!";
  }
  statusBar.textContent = text;
  statusBar.className = 'status-bar status-' + room.status;

  playAgainBtn.classList.toggle('hidden', !(room.status === 'won' || room.status === 'draw'));
}

function renderPlayers() {
  let rName = '--';
  let yName = '--';
  let spectators = 0;
  for (const [id, p] of Object.entries(playersMap)) {
    const label = id === playerId ? `${p.nickname} (you)` : p.nickname;
    if (p.seat === 'R') rName = label;
    else if (p.seat === 'Y') yName = label;
    else spectators++;
  }
  nameR.textContent = rName;
  nameY.textContent = yName;
  spectatorCount.textContent = spectators > 0 ? `👀 ${spectators} watching` : '';
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

shell.bindLandingActions({ onPlay: handlePlay, onJoinCode: handleJoinCode });

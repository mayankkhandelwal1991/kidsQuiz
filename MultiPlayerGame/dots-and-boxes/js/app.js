/**
 * dots-and-boxes/js/app.js
 * -----------------------------------------------------------------------
 * Classic Dots and Boxes on a 4x4 box grid (5x5 dots). Drawing a line
 * that completes one or more boxes scores a point per box and grants
 * another turn; otherwise the turn passes. Most boxes when the board
 * fills up wins.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager } from '../../common/utils.js';

const GAME_ID = 'dots-and-boxes';
const MATCH_WAIT_SECONDS = 30;
const SEATS = ['P1', 'P2'];
const BOX_ROWS = 4;
const BOX_COLS = 4;
const TOTAL_BOXES = BOX_ROWS * BOX_COLS;
const BOT_MOVE_DELAY_MS = 600;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Dots and Boxes' });
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

const hKey = (r, c) => `h-${r}-${c}`;
const vKey = (r, c) => `v-${r}-${c}`;
const boxKey = (r, c) => `b-${r}-${c}`;

function boxSides(r, c) {
  return [hKey(r, c), hKey(r + 1, c), vKey(r, c), vKey(r, c + 1)];
}

function boxesTouchingLine(key) {
  const [type, rs, cs] = key.split('-');
  const r = Number(rs);
  const c = Number(cs);
  const boxes = [];
  if (type === 'h') {
    if (r < BOX_ROWS) boxes.push([r, c]);
    if (r - 1 >= 0) boxes.push([r - 1, c]);
  } else {
    if (c < BOX_COLS) boxes.push([r, c]);
    if (c - 1 >= 0) boxes.push([r, c - 1]);
  }
  return boxes;
}

function allLineKeys() {
  const keys = [];
  for (let r = 0; r < BOX_ROWS + 1; r++) for (let c = 0; c < BOX_COLS; c++) keys.push(hKey(r, c));
  for (let r = 0; r < BOX_ROWS; r++) for (let c = 0; c < BOX_COLS + 1; c++) keys.push(vKey(r, c));
  return keys;
}
const ALL_LINE_KEYS = allLineKeys();

function countSides(lines, r, c) {
  return boxSides(r, c).filter((k) => lines[k]).length;
}

// ---------------------------------------------------------------------
// Bot AI: take any completing move (preferring the most boxes at once);
// otherwise play a "safe" move that doesn't hand the opponent a free
// box; otherwise (forced) play randomly.
// ---------------------------------------------------------------------
function computeBotMove(lines) {
  const remaining = ALL_LINE_KEYS.filter((k) => !lines[k]);
  if (!remaining.length) return null;

  let bestCompleting = null;
  let bestCompletingCount = 0;
  const safeMoves = [];

  for (const key of remaining) {
    const simulated = { ...lines, [key]: 'X' };
    const touching = boxesTouchingLine(key);
    let completedCount = 0;
    let makesUnsafe = false;
    for (const [r, c] of touching) {
      const before = countSides(lines, r, c);
      const after = countSides(simulated, r, c);
      if (after === 4) completedCount++;
      else if (after === 3) makesUnsafe = true;
    }
    if (completedCount > bestCompletingCount) {
      bestCompletingCount = completedCount;
      bestCompleting = key;
    }
    if (completedCount === 0 && !makesUnsafe) safeMoves.push(key);
  }

  if (bestCompleting) return bestCompleting;
  if (safeMoves.length) return safeMoves[Math.floor(Math.random() * safeMoves.length)];
  return remaining[Math.floor(Math.random() * remaining.length)];
}

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

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    lines: {},
    boxes: {},
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

  buildBoardDom();
  attachListeners();
  playersMap = (await playersRef.once('value')).val() || {};
  renderPlayers();

  shell.showGameScreen(roomCode);
  shell.setSoundIcon(sounds.enabled);
  sounds.playJoin();
  shell.toast(mySeat === 'spectator' ? "Both seats are taken — you're spectating." : `You're ${mySeat}`, 'info');
}

function buildBoardDom() {
  boardEl.innerHTML = '';
  const dotRows = BOX_ROWS + 1;
  const dotCols = BOX_COLS + 1;
  const rowsCount = 2 * dotRows - 1;
  const colsCount = 2 * dotCols - 1;

  for (let i = 0; i < rowsCount; i++) {
    for (let j = 0; j < colsCount; j++) {
      const el = document.createElement('div');
      if (i % 2 === 0 && j % 2 === 0) {
        el.className = 'dab-dot';
      } else if (i % 2 === 0 && j % 2 === 1) {
        el.className = 'dab-hline';
        el.dataset.key = hKey(i / 2, (j - 1) / 2);
      } else if (i % 2 === 1 && j % 2 === 0) {
        el.className = 'dab-vline';
        el.dataset.key = vKey((i - 1) / 2, j / 2);
      } else {
        el.className = 'dab-box';
        el.dataset.key = boxKey((i - 1) / 2, (j - 1) / 2);
      }
      boardEl.appendChild(el);
    }
  }

  boardEl.addEventListener('click', (e) => {
    const el = e.target.closest('.dab-hline, .dab-vline');
    if (!el || el.classList.contains('drawn')) return;
    handleLineClick(el.dataset.key);
  });
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
      room.lines = {};
      room.boxes = {};
      room.turn = 'P1';
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
    room.lines = {};
    room.boxes = {};
    room.turn = 'P1';
    room.scores = { P1: 0, P2: 0 };
    room.winner = null;
    room.status = 'waiting';
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function handleLineClick(key) {
  if (mySeat !== 'P1' && mySeat !== 'P2') return;
  attemptDrawLine(mySeat, key);
}

async function attemptDrawLine(seat, key) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.turn !== seat) return;
    room.lines = room.lines || {};
    if (room.lines[key]) return; // already drawn

    room.lines[key] = seat;
    room.boxes = room.boxes || {};

    let completed = 0;
    for (const [r, c] of boxesTouchingLine(key)) {
      const bKey = boxKey(r, c);
      if (!room.boxes[bKey] && countSides(room.lines, r, c) === 4) {
        room.boxes[bKey] = seat;
        completed++;
      }
    }

    if (completed > 0) {
      room.scores = room.scores || { P1: 0, P2: 0 };
      room.scores[seat] = (room.scores[seat] || 0) + completed;
      if (Object.keys(room.boxes).length >= TOTAL_BOXES) {
        room.status = 'finished';
        const s = room.scores;
        room.winner = s.P1 === s.P2 ? null : (s.P1 > s.P2 ? 'P1' : 'P2');
      }
      // Completing a box grants another turn — room.turn stays the same.
    } else {
      room.turn = room.turn === 'P1' ? 'P2' : 'P1';
    }
    return room;
  });

  if (txResult.committed) {
    const room = txResult.snapshot.val();
    const gotBox = room.boxes && Object.values(room.boxes).length > 0 && room.lines[key] === seat &&
      boxesTouchingLine(key).some(([r, c]) => room.boxes[boxKey(r, c)] === seat && countSides(room.lines, r, c) === 4);
    sounds[gotBox ? 'playSuccess' : 'playClick']();
  }
}

function maybeTriggerBotMove(room) {
  const isBotTurn = room.mode === 'bot' && room.status === 'playing' && room.turn === 'P2';
  if (!isBotTurn || mySeat !== 'P1') return;
  const key = `${Object.keys(room.lines || {}).length}-${room.turn}`;
  if (botMovePendingKey === key) return;
  botMovePendingKey = key;
  clearTimeout(botMoveTimeout);
  botMoveTimeout = setTimeout(() => {
    const move = computeBotMove(room.lines || {});
    if (move) attemptDrawLine('P2', move);
  }, BOT_MOVE_DELAY_MS);
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
  botMovePendingKey = null;
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
  const lines = room.lines || {};
  const boxes = room.boxes || {};

  boardEl.querySelectorAll('.dab-hline, .dab-vline').forEach((el) => {
    const seat = lines[el.dataset.key];
    el.classList.toggle('drawn', !!seat);
    el.classList.remove('p1', 'p2');
    if (seat) el.classList.add(seat.toLowerCase());
  });

  boardEl.querySelectorAll('.dab-box').forEach((el) => {
    const seat = boxes[el.dataset.key];
    el.classList.remove('owned-p1', 'owned-p2');
    if (seat) el.classList.add(seat === 'P1' ? 'owned-p1' : 'owned-p2');
  });

  const locked = room.status !== 'playing' || mySeat !== room.turn;
  boardEl.classList.toggle('locked', locked);

  scoreP1.textContent = (room.scores && room.scores.P1) || 0;
  scoreP2.textContent = (room.scores && room.scores.P2) || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing' && room.turn === 'P1');
  cardP2.classList.toggle('active-turn', room.status === 'playing' && room.turn === 'P2');

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    if (mySeat === 'spectator') text = `${room.turn}'s turn`;
    else text = mySeat === room.turn ? 'Your turn — draw a line' : "Opponent's turn";
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

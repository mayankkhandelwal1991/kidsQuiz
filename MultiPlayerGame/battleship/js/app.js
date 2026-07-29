/**
 * battleship/js/app.js
 * -----------------------------------------------------------------------
 * 8x8 Battleship with auto-placed fleets (4 ships: sizes 4/3/3/2) — no
 * manual placement UI, so play starts immediately once both seats fill.
 * Turns alternate regardless of hit/miss to keep matches brisk. A shot
 * is a single transaction on the whole room: it checks whose turn it is,
 * marks the cell on the target's `hitsTaken` list, and determines hit /
 * miss / sunk / game-over all atomically.
 *
 * NOTE ON FAIRNESS: as with the other games in this project, there's no
 * Firebase Auth / server function separating each player's private data,
 * so a technically savvy opponent could open devtools and read your
 * fleet layout directly instead of waiting to be shot. This is a known
 * trade-off of the "Realtime Database only, no backend" design — see the
 * project README.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager } from '../../common/utils.js';

const GAME_ID = 'battleship';
const MATCH_WAIT_SECONDS = 30;
const SEATS = ['P1', 'P2'];
const BOARD_SIZE = 8;
const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE;
const SHIP_SIZES = [4, 3, 3, 2];
const BOT_MOVE_DELAY_MS = 700;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Battleship' });
const sounds = new SoundManager();

const boardMineEl = document.getElementById('board-mine');
const boardEnemyEl = document.getElementById('board-enemy');
const statusBar = document.getElementById('status-bar');
const shipsP1 = document.getElementById('ships-p1');
const shipsP2 = document.getElementById('ships-p2');
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
let botMoveTimeout = null;
let botMovePendingKey = null;
let botTargetQueue = [];

/** Randomly place SHIP_SIZES on an empty 8x8 grid with no overlap. */
function generateFleet() {
  const occupied = new Set();
  const ships = [];
  for (const size of SHIP_SIZES) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 300) {
      attempts++;
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);
      const cells = [];
      for (let k = 0; k < size; k++) {
        const r = horizontal ? row : row + k;
        const c = horizontal ? col + k : col;
        if (r >= BOARD_SIZE || c >= BOARD_SIZE) { cells.length = 0; break; }
        cells.push(r * BOARD_SIZE + c);
      }
      if (cells.length === size && cells.every((i) => !occupied.has(i))) {
        cells.forEach((i) => occupied.add(i));
        ships.push(cells);
        placed = true;
      }
    }
  }
  return ships;
}

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    turn: 'P1',
    winner: null,
    lastShot: null,
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

  if (mySeat === 'P1' || mySeat === 'P2') {
    await selfRef.update({ ships: generateFleet(), hitsTaken: [] });
  }

  if (mySeat === 'P2') {
    await roomRef.transaction((room) => {
      if (room && room.status === 'waiting') room.status = 'playing';
      return room;
    });
    await quickMatch.clearIfMatches(roomCode);
  }

  buildBoardsDom();
  attachListeners();
  playersMap = (await playersRef.once('value')).val() || {};
  renderPlayers();

  shell.showGameScreen(roomCode);
  shell.setSoundIcon(sounds.enabled);
  sounds.playJoin();
  shell.toast(mySeat === 'spectator' ? "Both seats are taken — you're spectating." : `You're ${mySeat} — fleet deployed!`, 'info');
}

function buildBoardsDom() {
  boardMineEl.innerHTML = '';
  boardEnemyEl.innerHTML = '';
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const mineCell = document.createElement('div');
    mineCell.className = 'bs-cell empty';
    mineCell.dataset.index = i;
    boardMineEl.appendChild(mineCell);

    const enemyCell = document.createElement('div');
    enemyCell.className = 'bs-cell empty';
    enemyCell.dataset.index = i;
    boardEnemyEl.appendChild(enemyCell);
  }
  boardEnemyEl.addEventListener('click', (e) => {
    const cellEl = e.target.closest('.bs-cell');
    if (!cellEl) return;
    handleEnemyClick(Number(cellEl.dataset.index));
  });
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    playersMap = room.players || playersMap;
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

  playAgainBtn.addEventListener('click', async () => {
    sounds.playClick();
    botTargetQueue = [];
    if (mySeat === 'P1' || mySeat === 'P2') {
      await selfRef.update({ ships: generateFleet(), hitsTaken: [] });
    }
    roomRef.transaction((room) => {
      if (!room) return room;
      room.turn = 'P1';
      room.winner = null;
      room.lastShot = null;
      room.status = 'playing';
      return room;
    });
  });
}

async function resetRoomForDisconnect() {
  botTargetQueue = [];
  if (mySeat === 'P1' || mySeat === 'P2') {
    await selfRef.update({ ships: generateFleet(), hitsTaken: [] });
  }
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.turn = 'P1';
    room.winner = null;
    room.lastShot = null;
    room.status = 'waiting';
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function handleEnemyClick(index) {
  if (mySeat !== 'P1' && mySeat !== 'P2') return;
  attemptShot(mySeat, index);
}

function findPlayerIdBySeat(players, seat) {
  return Object.keys(players || {}).find((id) => players[id].seat === seat) || null;
}

async function attemptShot(shooterSeat, targetIndex) {
  const targetSeat = shooterSeat === 'P1' ? 'P2' : 'P1';

  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.turn !== shooterSeat) return;
    room.players = room.players || {};

    const targetId = findPlayerIdBySeat(room.players, targetSeat);
    if (!targetId) return;
    const targetPlayer = room.players[targetId];
    const ships = targetPlayer.ships || [];
    const hits = targetPlayer.hitsTaken || [];
    if (hits.includes(targetIndex)) return; // already fired here — abort

    hits.push(targetIndex);
    targetPlayer.hitsTaken = hits;

    let isHit = false;
    let sunkShip = null;
    for (const ship of ships) {
      if (ship.includes(targetIndex)) {
        isHit = true;
        if (ship.every((i) => hits.includes(i))) sunkShip = ship;
        break;
      }
    }

    room.lastShot = { by: shooterSeat, index: targetIndex, hit: isHit, sunk: !!sunkShip };
    room.players[targetId] = targetPlayer;

    const allShipCells = ships.flat ? ships.flat() : [].concat(...ships);
    const allSunk = allShipCells.length > 0 && allShipCells.every((i) => hits.includes(i));
    if (allSunk) {
      room.status = 'finished';
      room.winner = shooterSeat;
    } else {
      room.turn = targetSeat;
    }
    return room;
  });

  if (txResult.committed) {
    const room = txResult.snapshot.val();
    if (room && room.lastShot && room.lastShot.index === targetIndex) {
      sounds[room.lastShot.hit ? 'playHit' : 'playSplash']();
    }
  }
  return txResult.committed;
}

// ---------------------------------------------------------------------
// Bot: hunt/target heuristic — fires randomly until it scores a hit,
// then hunts the immediate neighbors of that hit until the ship sinks.
// ---------------------------------------------------------------------
function neighborsOf(index) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const out = [];
  if (row > 0) out.push(index - BOARD_SIZE);
  if (row < BOARD_SIZE - 1) out.push(index + BOARD_SIZE);
  if (col > 0) out.push(index - 1);
  if (col < BOARD_SIZE - 1) out.push(index + 1);
  return out;
}

function computeBotTarget(triedIndices) {
  while (botTargetQueue.length) {
    const next = botTargetQueue.shift();
    if (!triedIndices.includes(next)) return next;
  }
  const options = [];
  for (let i = 0; i < TOTAL_CELLS; i++) if (!triedIndices.includes(i)) options.push(i);
  return options[Math.floor(Math.random() * options.length)];
}

function maybeTriggerBotMove(room) {
  const isBotTurn = room.mode === 'bot' && room.status === 'playing' && room.turn === 'P2';
  if (!isBotTurn || mySeat !== 'P1') return;

  const humanId = findPlayerIdBySeat(room.players, 'P1');
  const humanPlayer = humanId ? room.players[humanId] : null;
  const triedIndices = (humanPlayer && humanPlayer.hitsTaken) || [];

  const key = triedIndices.length;
  if (botMovePendingKey === key) return;
  botMovePendingKey = key;

  clearTimeout(botMoveTimeout);
  botMoveTimeout = setTimeout(async () => {
    const target = computeBotTarget(triedIndices);
    if (target === undefined) return;
    await attemptShot('P2', target);

    // Re-read the freshly-committed room to update hunt/target memory.
    const snap = await roomRef.once('value');
    const updated = snap.val();
    if (updated && updated.lastShot && updated.lastShot.index === target) {
      if (updated.lastShot.hit && !updated.lastShot.sunk) {
        for (const n of neighborsOf(target)) {
          if (!triedIndices.includes(n) && !botTargetQueue.includes(n)) botTargetQueue.push(n);
        }
      } else if (updated.lastShot.sunk) {
        botTargetQueue = [];
      }
    }
  }, BOT_MOVE_DELAY_MS);
}

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    room.mode = 'bot';
    room.status = 'playing';
    room.players = room.players || {};
    room.players['bot'] = { nickname: 'Computer', seat: 'P2', joinedAt: Date.now(), ships: generateFleet(), hitsTaken: [] };
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
  clearTimeout(botMoveTimeout);
  botMovePendingKey = null;
  botTargetQueue = [];
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

function classifyCell(playerObj, index, revealShipsWhenNotHit) {
  if (!playerObj) return 'empty';
  const ships = playerObj.ships || [];
  const hits = playerObj.hitsTaken || [];
  const ship = ships.find((s) => s.includes(index));
  const wasHit = hits.includes(index);
  if (wasHit) {
    if (ship) return ship.every((i) => hits.includes(i)) ? 'sunk' : 'hit';
    return 'miss';
  }
  if (revealShipsWhenNotHit && ship) return 'ship';
  return 'empty';
}

function countRemainingShips(playerObj) {
  if (!playerObj || !playerObj.ships) return SHIP_SIZES.length;
  const hits = playerObj.hitsTaken || [];
  return playerObj.ships.filter((ship) => !ship.every((i) => hits.includes(i))).length;
}

function renderRoom(room) {
  const players = room.players || {};
  const myPlayer = players[playerId];
  const opponentSeat = mySeat === 'P1' ? 'P2' : mySeat === 'P2' ? 'P1' : null;
  const opponentId = opponentSeat ? findPlayerIdBySeat(players, opponentSeat) : findPlayerIdBySeat(players, 'P2');
  const opponentPlayer = opponentId ? players[opponentId] : null;

  Array.from(boardMineEl.children).forEach((cellEl, i) => {
    const cls = classifyCell(myPlayer, i, true);
    cellEl.className = 'bs-cell ' + cls;
  });

  Array.from(boardEnemyEl.children).forEach((cellEl, i) => {
    const cls = classifyCell(opponentPlayer, i, false);
    cellEl.className = 'bs-cell ' + cls;
  });

  const canFire = room.status === 'playing' && mySeat === room.turn;
  boardEnemyEl.classList.toggle('clickable', canFire);
  boardEnemyEl.classList.toggle('locked', !canFire);

  const p1Id = findPlayerIdBySeat(players, 'P1');
  const p2Id = findPlayerIdBySeat(players, 'P2');
  shipsP1.textContent = countRemainingShips(p1Id ? players[p1Id] : null);
  shipsP2.textContent = countRemainingShips(p2Id ? players[p2Id] : null);

  cardP1.classList.toggle('active-turn', room.status === 'playing' && room.turn === 'P1');
  cardP2.classList.toggle('active-turn', room.status === 'playing' && room.turn === 'P2');

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    if (mySeat === 'spectator') text = `${room.turn}'s turn`;
    else text = mySeat === room.turn ? 'Your turn — fire at enemy waters!' : "Opponent's turn";
  } else if (room.status === 'finished') {
    if (mySeat === room.winner) text = 'You sank the enemy fleet! 🎉';
    else if (mySeat === 'spectator') text = `${room.winner} wins!`;
    else text = 'Your fleet was sunk — play again?';
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

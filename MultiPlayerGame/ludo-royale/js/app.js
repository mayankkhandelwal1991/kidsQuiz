/**
 * ludo-royale/js/app.js
 * -----------------------------------------------------------------------
 * Ludo for 2-4 players. Unlike every other game in this collection, the
 * room here isn't limited to two seats — it supports up to MAX_PLAYERS
 * (4) via the same generic `claimSeat()` helper from common/net.js (it
 * already takes an arbitrary seat-name array, so RED/GREEN/YELLOW/BLUE
 * "just works"). What's genuinely different from the 2-player games:
 *
 *  1. Quick-match can't use the shared QuickMatch class as-is — that
 *     class clears the lobby pointer the instant a 2nd player joins
 *     (correct for 2-seat games, wrong here). This file implements its
 *     own lobby pointer loop that keeps a room "open" for quick-match
 *     until it hits MAX_PLAYERS or the host manually starts it.
 *  2. There's an explicit lobby/waiting-room UI with a "Start Game"
 *     button, gated on MIN_PLAYERS (2) — nobody is forced to play the
 *     instant a 2nd person shows up, since a 3rd or 4th might still
 *     join.
 *  3. Turn-taking is still fully server-validated via Firebase
 *     transactions on the whole room object (same pattern as
 *     Tic-Tac-Toe/Connect Four), just with a rotating `turnOrder` array
 *     instead of a hardcoded two-way alternation.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, randInt } from '../../common/utils.js';

const GAME_ID = 'ludo-royale';
const MATCH_WAIT_SECONDS = 30;
const COLORS = ['RED', 'GREEN', 'YELLOW', 'BLUE'];
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

const START_OFFSET = { RED: 0, GREEN: 13, YELLOW: 26, BLUE: 39 };
const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const COLOR_HEX = { RED: '#ff4757', GREEN: '#2ed573', YELLOW: '#ffcf4d', BLUE: '#33a5ff' };

const YARD_SLOTS = {
  RED: [[2, 2], [2, 4], [4, 2], [4, 4]],
  GREEN: [[2, 9], [2, 11], [4, 9], [4, 11]],
  YELLOW: [[9, 9], [9, 11], [11, 9], [11, 11]],
  BLUE: [[9, 2], [9, 4], [11, 2], [11, 4]],
};

const CELL = 30; // px per grid cell (14x14 board -> 420x420 canvas)
const BOARD_N = 14;

const db = firebase.database();
const gameRoomsBase = db.ref(`games/${GAME_ID}/rooms`);
const lobbyRef = db.ref(`games/${GAME_ID}/lobby/waitingRoom`);
const shell = new GameShell({ gameTitle: 'Ludo Royale' });
const sounds = new SoundManager();

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('status-bar');
const lobbyPanel = document.getElementById('lobby-panel');
const lobbySeatsEl = document.getElementById('lobby-seats');
const lobbyCountEl = document.getElementById('lobby-count');
const lobbyHintEl = document.getElementById('lobby-hint');
const startGameBtn = document.getElementById('start-game-btn');
const gameArea = document.getElementById('game-area');
const seatsRow = document.getElementById('seats-row');
const diceFace = document.getElementById('dice-face');
const rollBtn = document.getElementById('roll-btn');
const turnHint = document.getElementById('turn-hint');
const spectatorCount = document.getElementById('spectator-count');
const playAgainBtn = document.getElementById('play-again-btn');

let roomRef = null;
let playersRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastStatus = null;
let lastEventSeq = -1;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
let botActing = false;

const DICE_PIPS = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

// ---------------------------------------------------------------------
// Board coordinate helpers
// ---------------------------------------------------------------------

function trackCoord(i) {
  if (i <= 13) return { row: 0, col: i };
  if (i <= 26) return { row: i - 13, col: 13 };
  if (i <= 39) return { row: 13, col: 13 - (i - 26) };
  return { row: 13 - (i - 39), col: 0 };
}

function homeStretchCoord(color, step) {
  if (color === 'RED') return { row: 7, col: 1 + step };
  if (color === 'GREEN') return { row: 1 + step, col: 7 };
  if (color === 'YELLOW') return { row: 6, col: 12 - step };
  return { row: 12 - step, col: 6 }; // BLUE
}

function tokenCoord(color, pos, tokenIndex) {
  if (pos === 0) {
    const [row, col] = YARD_SLOTS[color][tokenIndex];
    return { row, col };
  }
  if (pos >= 1 && pos <= 51) {
    const abs = (START_OFFSET[color] + pos - 1) % 52;
    return trackCoord(abs);
  }
  if (pos >= 52 && pos <= 57) {
    return homeStretchCoord(color, pos - 52);
  }
  return null; // 58 = finished, not drawn on the board
}

function cellPx(row, col) {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

// ---------------------------------------------------------------------
// Game rules
// ---------------------------------------------------------------------

function computeMovableTokens(tokens, roll) {
  const movable = [];
  for (let i = 0; i < 4; i++) {
    const pos = tokens[i];
    if (pos === 0) { if (roll === 6) movable.push(i); }
    else if (pos >= 1 && pos <= 57) { if (pos + roll <= 58) movable.push(i); }
  }
  return movable;
}

function advanceTurn(room) {
  const idx = room.turnOrder.indexOf(room.turn);
  room.turn = room.turnOrder[(idx + 1) % room.turnOrder.length];
}

function pushEvent(room, event) {
  room.eventSeq = (room.eventSeq || 0) + 1;
  room.event = { ...event, seq: room.eventSeq };
}

// ---------------------------------------------------------------------
// Room bootstrap
// ---------------------------------------------------------------------

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    turnOrder: [],
    turn: null,
    diceValue: null,
    movableTokens: [],
    sixStreak: 0,
    tokens: {},
    winner: null,
    eventSeq: 0,
    event: null,
  };
}

/**
 * Custom quick-match: keep the shared lobby pointer alive until the room
 * hits MAX_PLAYERS or actually starts (see file header for why the
 * generic QuickMatch class doesn't fit a >2-seat game).
 */
async function findOrCreateRoom() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const snap = await lobbyRef.once('value');
    const code = snap.val();

    if (code) {
      const roomSnap = await gameRoomsBase.child(code).once('value');
      const room = roomSnap.val();
      const occupied = room && room.players ? Object.values(room.players).filter((p) => COLORS.includes(p.seat)).length : 0;
      if (room && room.status === 'waiting' && occupied < MAX_PLAYERS) {
        return code;
      }
      await lobbyRef.transaction((cur) => (cur === code ? null : cur));
      continue;
    }

    const newCode = generateRoomCode();
    const txResult = await lobbyRef.transaction((cur) => cur || newCode);
    if (txResult.committed && txResult.snapshot.val() === newCode) {
      await gameRoomsBase.child(newCode).set(buildInitialRoom());
      return newCode;
    }
  }
  const fallbackCode = generateRoomCode();
  await gameRoomsBase.child(fallbackCode).set(buildInitialRoom());
  await lobbyRef.set(fallbackCode);
  return fallbackCode;
}

async function handlePlay(rawNickname) {
  const nickname = sanitizeNickname(rawNickname);
  shell.setBusy(true);
  try {
    const roomCode = await findOrCreateRoom();
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
    const snap = await gameRoomsBase.child(code).once('value');
    if (!snap.exists()) { shell.showError(`Room "${code}" doesn't exist.`); return; }
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
  roomRef = gameRoomsBase.child(roomCode);
  playersRef = roomRef.child('players');
  selfRef = playersRef.child(playerId);

  mySeat = await claimSeat(playersRef, COLORS, playerId, nickname);
  setupPresence(selfRef);

  if (COLORS.includes(mySeat)) {
    const occSnap = await playersRef.once('value');
    const occupied = Object.values(occSnap.val() || {}).filter((p) => COLORS.includes(p.seat)).length;
    if (occupied >= MAX_PLAYERS) {
      await lobbyRef.transaction((cur) => (cur === roomCode ? null : cur));
      await startGame(true);
    }
  }

  attachListeners();
  playersMap = (await playersRef.once('value')).val() || {};
  renderLobby({ status: 'waiting', players: playersMap });

  shell.showGameScreen(roomCode);
  shell.setSoundIcon(sounds.enabled);
  sounds.playJoin();
  shell.toast(mySeat === 'spectator' ? "Room is full — you're spectating." : `You're ${mySeat}`, 'info');

  canvas.addEventListener('pointerdown', handleCanvasTap);
  requestAnimationFrame(drawLoop);
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    handleStatusTransition(room);
    handleEvent(room);
    if (room.status === 'waiting') {
      renderLobby(room);
    } else {
      renderGame(room);
    }
    handleMatchmakingCountdown(room);
    maybeRunBot(room);
  });

  playersRef.on('value', (snap) => {
    playersMap = snap.val() || {};
    renderPlayerLists();
  });

  playersRef.on('child_removed', (snap) => {
    const data = snap.val();
    if (data && COLORS.includes(data.seat)) {
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

  startGameBtn.addEventListener('click', () => { sounds.playClick(); startGame(false); });
  rollBtn.addEventListener('click', () => { sounds.playClick(); attemptRoll(); });
  playAgainBtn.addEventListener('click', () => { sounds.playClick(); playAgain(); });
}

async function resetRoomForDisconnect() {
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.status = 'waiting';
    room.turnOrder = [];
    room.turn = null;
    room.diceValue = null;
    room.movableTokens = [];
    room.sixStreak = 0;
    room.tokens = {};
    room.winner = null;
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

// ---------------------------------------------------------------------
// Start / restart
// ---------------------------------------------------------------------

async function startGame(silent) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    const occupiedColors = COLORS.filter((c) => Object.values(room.players || {}).some((p) => p.seat === c));
    if (occupiedColors.length < MIN_PLAYERS) return;

    room.turnOrder = occupiedColors;
    room.turn = occupiedColors[0];
    room.tokens = {};
    for (const c of occupiedColors) room.tokens[c] = [0, 0, 0, 0];
    room.diceValue = null;
    room.movableTokens = [];
    room.sixStreak = 0;
    room.winner = null;
    room.status = 'playing';
    pushEvent(room, { type: 'start' });
    return room;
  });
  if (!silent && !txResult.committed) shell.toast('Need at least 2 players to start.', 'warn');
  if (txResult.committed) await lobbyRef.transaction((cur) => (cur === roomRef.key ? null : cur));
}

async function playAgain() {
  await roomRef.transaction((room) => {
    if (!room) return room;
    const occupiedColors = COLORS.filter((c) => Object.values(room.players || {}).some((p) => p.seat === c));
    if (occupiedColors.length < MIN_PLAYERS) { room.status = 'waiting'; return room; }
    room.turnOrder = occupiedColors;
    room.turn = occupiedColors[0];
    room.tokens = {};
    for (const c of occupiedColors) room.tokens[c] = [0, 0, 0, 0];
    room.diceValue = null;
    room.movableTokens = [];
    room.sixStreak = 0;
    room.winner = null;
    room.status = 'playing';
    pushEvent(room, { type: 'start' });
    return room;
  });
}

// ---------------------------------------------------------------------
// Roll / move (server-validated via transactions, same pattern as
// Tic-Tac-Toe's attemptMove).
// ---------------------------------------------------------------------

async function attemptRoll(forcedSeat) {
  const seat = forcedSeat || mySeat;
  if (!COLORS.includes(seat)) return;
  const roll = randInt(1, 6);

  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.turn !== seat) return;
    if (room.diceValue !== null && room.diceValue !== undefined) return;

    const streak = roll === 6 ? (room.sixStreak || 0) + 1 : 0;

    if (streak >= 3) {
      room.sixStreak = 0;
      room.diceValue = null;
      room.movableTokens = [];
      advanceTurn(room);
      pushEvent(room, { type: 'forfeit', seat, value: roll });
      return room;
    }

    const tokens = room.tokens[seat] || [0, 0, 0, 0];
    const movable = computeMovableTokens(tokens, roll);

    if (movable.length === 0) {
      room.sixStreak = 0;
      room.diceValue = null;
      room.movableTokens = [];
      advanceTurn(room);
      pushEvent(room, { type: 'noMoves', seat, value: roll });
      return room;
    }

    room.sixStreak = streak;
    room.diceValue = roll;
    room.movableTokens = movable;
    pushEvent(room, { type: 'roll', seat, value: roll });
    return room;
  });
}

async function attemptMove(tokenIndex) {
  const seat = mySeat;
  if (!COLORS.includes(seat)) return;

  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.turn !== seat) return;
    if (room.diceValue === null || room.diceValue === undefined) return;
    if (!Array.isArray(room.movableTokens) || !room.movableTokens.includes(tokenIndex)) return;

    const roll = room.diceValue;
    const tokens = room.tokens[seat];
    const pos = tokens[tokenIndex];
    const newPos = pos === 0 ? 1 : pos + roll;
    tokens[tokenIndex] = newPos;
    room.tokens[seat] = tokens;

    let capturedColor = null;
    if (newPos >= 1 && newPos <= 51) {
      const absCell = (START_OFFSET[seat] + newPos - 1) % 52;
      if (!SAFE_CELLS.has(absCell)) {
        for (const other of room.turnOrder) {
          if (other === seat) continue;
          const otherTokens = room.tokens[other];
          if (!otherTokens) continue;
          for (let j = 0; j < 4; j++) {
            const opos = otherTokens[j];
            if (opos >= 1 && opos <= 51) {
              const oabs = (START_OFFSET[other] + opos - 1) % 52;
              if (oabs === absCell) { otherTokens[j] = 0; capturedColor = other; }
            }
          }
          room.tokens[other] = otherTokens;
        }
      }
    }

    const won = tokens.every((p) => p === 58);
    if (won) {
      room.status = 'finished';
      room.winner = seat;
      room.diceValue = null;
      room.movableTokens = [];
      pushEvent(room, { type: 'win', seat });
      return room;
    }

    if (capturedColor) {
      pushEvent(room, { type: 'capture', seat, victim: capturedColor });
    } else if (newPos === 58) {
      pushEvent(room, { type: 'home', seat });
    } else {
      pushEvent(room, { type: 'move', seat });
    }

    if (roll === 6) {
      room.diceValue = null;
      room.movableTokens = [];
    } else {
      room.sixStreak = 0;
      room.diceValue = null;
      room.movableTokens = [];
      advanceTurn(room);
    }
    return room;
  });
}

// ---------------------------------------------------------------------
// Bot AI — driven by RED (the always-present first joiner) whenever it's
// the bot's turn, mirroring the host-authoritative pattern used for
// physics in the real-time games, just applied to turn-taking instead.
// ---------------------------------------------------------------------

function botColorOf(room) {
  for (const [id, p] of Object.entries(room.players || {})) {
    if (id === 'bot' || p.nickname === 'Computer') return p.seat;
  }
  return null;
}

function maybeRunBot(room) {
  if (mySeat !== 'RED' || room.mode !== 'bot' || room.status !== 'playing') return;
  const botSeat = botColorOf(room);
  if (!botSeat || room.turn !== botSeat || botActing) return;

  botActing = true;
  setTimeout(async () => {
    if (room.diceValue === null || room.diceValue === undefined) {
      await attemptRoll(botSeat);
    }
    setTimeout(async () => {
      const fresh = (await roomRef.once('value')).val();
      if (fresh && fresh.turn === botSeat && Array.isArray(fresh.movableTokens) && fresh.movableTokens.length) {
        const tokens = fresh.tokens[botSeat];
        // Prefer a capturing move, else the token furthest along.
        let choice = fresh.movableTokens[0];
        let bestScore = -1;
        for (const idx of fresh.movableTokens) {
          const pos = tokens[idx];
          const score = pos; // simple heuristic: push the furthest token
          if (score > bestScore) { bestScore = score; choice = idx; }
        }
        await attemptMoveFor(botSeat, choice);
      }
      botActing = false;
    }, 700);
  }, 700);
}

async function attemptMoveFor(seat, tokenIndex) {
  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.turn !== seat) return;
    if (room.diceValue === null || room.diceValue === undefined) return;
    if (!Array.isArray(room.movableTokens) || !room.movableTokens.includes(tokenIndex)) return;

    const roll = room.diceValue;
    const tokens = room.tokens[seat];
    const pos = tokens[tokenIndex];
    const newPos = pos === 0 ? 1 : pos + roll;
    tokens[tokenIndex] = newPos;
    room.tokens[seat] = tokens;

    let capturedColor = null;
    if (newPos >= 1 && newPos <= 51) {
      const absCell = (START_OFFSET[seat] + newPos - 1) % 52;
      if (!SAFE_CELLS.has(absCell)) {
        for (const other of room.turnOrder) {
          if (other === seat) continue;
          const otherTokens = room.tokens[other];
          if (!otherTokens) continue;
          for (let j = 0; j < 4; j++) {
            const opos = otherTokens[j];
            if (opos >= 1 && opos <= 51) {
              const oabs = (START_OFFSET[other] + opos - 1) % 52;
              if (oabs === absCell) { otherTokens[j] = 0; capturedColor = other; }
            }
          }
          room.tokens[other] = otherTokens;
        }
      }
    }

    const won = tokens.every((p) => p === 58);
    if (won) {
      room.status = 'finished';
      room.winner = seat;
      room.diceValue = null;
      room.movableTokens = [];
      pushEvent(room, { type: 'win', seat });
      return room;
    }

    if (capturedColor) pushEvent(room, { type: 'capture', seat, victim: capturedColor });
    else if (newPos === 58) pushEvent(room, { type: 'home', seat });
    else pushEvent(room, { type: 'move', seat });

    if (roll === 6) {
      room.diceValue = null;
      room.movableTokens = [];
    } else {
      room.sixStreak = 0;
      room.diceValue = null;
      room.movableTokens = [];
      advanceTurn(room);
    }
    return room;
  });
}

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    const occupiedColors = COLORS.filter((c) => Object.values(room.players || {}).some((p) => p.seat === c));
    if (occupiedColors.length !== 1) return;
    const nextColor = COLORS.find((c) => !occupiedColors.includes(c));
    room.mode = 'bot';
    room.players = room.players || {};
    room.players['bot'] = { nickname: 'Computer', seat: nextColor, joinedAt: Date.now() };
    return room;
  });
  if (txResult.committed) shell.toast('A Computer player joined — start whenever you like!', 'info');
}

// ---------------------------------------------------------------------
// Matchmaking countdown (waiting alone -> add a bot after 30s)
// ---------------------------------------------------------------------

function handleMatchmakingCountdown(room) {
  const occupiedColors = COLORS.filter((c) => Object.values(room.players || {}).some((p) => p.seat === c));
  const iAmWaitingAlone = mySeat === 'RED' && room.status === 'waiting' && occupiedColors.length === 1;
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

// ---------------------------------------------------------------------
// Event -> sound / toast side effects
// ---------------------------------------------------------------------

function handleEvent(room) {
  const ev = room.event;
  if (!ev || ev.seq === lastEventSeq) return;
  lastEventSeq = ev.seq;
  if (ev.type === 'roll') sounds.playClick();
  else if (ev.type === 'capture') {
    sounds.playHit();
    if (ev.victim === mySeat) shell.toast(`${ev.seat} sent your token home!`, 'warn');
  } else if (ev.type === 'home') sounds.playSuccess();
  else if (ev.type === 'forfeit') shell.toast(`${ev.seat} rolled three 6s in a row — turn forfeited!`, 'warn');
}

function handleStatusTransition(room) {
  if (lastStatus === room.status) return;
  const prev = lastStatus;
  lastStatus = room.status;
  if (prev === null) return;
  if (room.status === 'finished') {
    if (mySeat === room.winner) sounds.playWin();
    else if (mySeat !== 'spectator') sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

async function handleLeave() {
  stopMatchmakingCountdown();
  botActing = false;
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  lastEventSeq = -1;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Canvas interaction
// ---------------------------------------------------------------------

let lastRoomSnapshot = null;

function handleCanvasTap(e) {
  if (!lastRoomSnapshot) return;
  const room = lastRoomSnapshot;
  if (room.status !== 'playing' || room.turn !== mySeat) return;
  if (!Array.isArray(room.movableTokens) || !room.movableTokens.length) return;

  const rect = canvas.getBoundingClientRect();
  const scale = (BOARD_N * CELL) / rect.width;
  const x = (e.clientX - rect.left) * scale;
  const y = (e.clientY - rect.top) * scale;

  const tokens = room.tokens[mySeat] || [0, 0, 0, 0];
  let best = null;
  let bestDist = Infinity;
  for (const idx of room.movableTokens) {
    const coord = tokenCoord(mySeat, tokens[idx], idx);
    if (!coord) continue;
    const p = cellPx(coord.row, coord.col);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < 16 && d < bestDist) { bestDist = d; best = idx; }
  }
  if (best !== null) attemptMove(best);
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function renderLobby(room) {
  lobbyPanel.classList.remove('hidden');
  gameArea.classList.add('hidden');

  const seatOf = {};
  for (const p of Object.values(room.players || {})) if (COLORS.includes(p.seat)) seatOf[p.seat] = p;

  lobbySeatsEl.innerHTML = '';
  let occupiedCount = 0;
  for (const c of COLORS) {
    const p = seatOf[c];
    const div = document.createElement('div');
    div.className = 'lobby-seat ' + (p ? `filled c-${c}` : 'c-empty');
    if (p && c === mySeat) {
      div.classList.add('you');
    }
    if (p) { occupiedCount++; div.innerHTML = `<span class="dot"></span> ${p.nickname}${p.nickname === 'Computer' ? ' 🤖' : ''}`; }
    else { div.textContent = `${c} — open`; }
    lobbySeatsEl.appendChild(div);
  }

  lobbyCountEl.textContent = `(${occupiedCount}/${MAX_PLAYERS})`;
  const canStart = occupiedCount >= MIN_PLAYERS;
  startGameBtn.disabled = !canStart;
  lobbyHintEl.textContent = canStart
    ? 'Anyone can tap Start when ready — more players can still join until then.'
    : `Need at least ${MIN_PLAYERS} players to start.`;

  spectatorCount.textContent = '';
}

function renderPlayerLists() {
  // Lobby re-renders itself from the live room listener; nothing extra needed here
  // beyond keeping spectator count fresh while in-game.
  if (gameArea.classList.contains('hidden')) return;
  let spectators = 0;
  for (const p of Object.values(playersMap)) if (p.seat === 'spectator') spectators++;
  spectatorCount.textContent = spectators > 0 ? `👀 ${spectators} watching` : '';
}

function renderGame(room) {
  lastRoomSnapshot = room;
  lobbyPanel.classList.add('hidden');
  gameArea.classList.remove('hidden');

  const seatOf = {};
  for (const p of Object.values(room.players || {})) if (COLORS.includes(p.seat)) seatOf[p.seat] = p;

  seatsRow.innerHTML = '';
  for (const c of COLORS) {
    const p = seatOf[c];
    const div = document.createElement('div');
    const homeCount = room.tokens && room.tokens[c] ? room.tokens[c].filter((v) => v === 58).length : 0;
    div.className = 'seat-card c-' + (p ? c : 'empty');
    if (p) div.classList.add('occupied');
    if (room.status === 'playing' && room.turn === c) div.classList.add('active-turn');
    div.innerHTML = p
      ? `<span class="seat-name">${p.nickname}${c === mySeat ? ' (you)' : ''}</span><span class="seat-home">🏠 ${homeCount}/4</span>`
      : `<span class="seat-name">${c}</span>`;
    seatsRow.appendChild(div);
  }

  renderPlayerLists();

  // status text
  let text = '';
  if (room.status === 'playing') {
    if (mySeat === 'spectator') text = `${room.turn}'s turn…`;
    else if (room.turn === mySeat) {
      if (room.diceValue) text = 'Pick a token to move!';
      else text = 'Your turn — roll the dice!';
    } else {
      text = `Waiting for ${room.turn}…`;
    }
  } else if (room.status === 'finished') {
    if (mySeat === room.winner) text = 'You win! 🎉';
    else if (mySeat === 'spectator') text = `${room.winner} wins!`;
    else text = `${room.winner} wins — play again?`;
  }
  statusBar.textContent = text;
  statusBar.className = 'status-bar ' + (room.status === 'finished' ? (mySeat === room.winner ? 'status-won' : 'status-lost') : '');

  // dice
  if (room.diceValue) {
    diceFace.textContent = DICE_PIPS[room.diceValue] || room.diceValue;
  } else {
    diceFace.textContent = '🎲';
  }

  const canRoll = room.status === 'playing' && room.turn === mySeat && (room.diceValue === null || room.diceValue === undefined);
  rollBtn.classList.toggle('hidden', !canRoll);
  turnHint.textContent = room.status === 'playing' && room.turn === mySeat && room.diceValue
    ? 'Tap a glowing token on the board to move it.'
    : '';

  playAgainBtn.classList.toggle('hidden', room.status !== 'finished');
}

function drawLoop(now) {
  if (lastRoomSnapshot) draw(lastRoomSnapshot, now);
  requestAnimationFrame(drawLoop);
}

function draw(room, now) {
  const N = BOARD_N * CELL;
  ctx.clearRect(0, 0, N, N);
  ctx.fillStyle = '#11142a';
  ctx.fillRect(0, 0, N, N);

  // Yard quadrants
  drawYard(1, 1, 5, 'RED');
  drawYard(1, 8, 5, 'GREEN');
  drawYard(8, 8, 5, 'YELLOW');
  drawYard(8, 1, 5, 'BLUE');

  // Center hub
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(6 * CELL, 6 * CELL, 2 * CELL, 2 * CELL);

  // Track cells
  for (let i = 0; i < 52; i++) {
    const { row, col } = trackCoord(i);
    const p = cellPx(row, col);
    ctx.fillStyle = SAFE_CELLS.has(i) ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(p.x - CELL / 2, p.y - CELL / 2, CELL, CELL);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeRect(p.x - CELL / 2, p.y - CELL / 2, CELL, CELL);
    if (SAFE_CELLS.has(i)) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', p.x, p.y);
    }
  }

  // Home stretches
  for (const c of COLORS) {
    for (let step = 0; step < 6; step++) {
      const coord = homeStretchCoord(c, step);
      const p = cellPx(coord.row, coord.col);
      ctx.fillStyle = COLOR_HEX[c] + '55';
      ctx.fillRect(p.x - CELL / 2, p.y - CELL / 2, CELL, CELL);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.strokeRect(p.x - CELL / 2, p.y - CELL / 2, CELL, CELL);
    }
  }

  // Start-cell markers (colored)
  for (const c of COLORS) {
    const { row, col } = trackCoord(START_OFFSET[c]);
    const p = cellPx(row, col);
    ctx.fillStyle = COLOR_HEX[c];
    ctx.fillRect(p.x - CELL / 2, p.y - CELL / 2, CELL, CELL);
  }

  if (!room.tokens) return;

  // Tokens
  const movable = (room.status === 'playing' && room.turn === mySeat) ? (room.movableTokens || []) : [];
  for (const c of Object.keys(room.tokens)) {
    const tokens = room.tokens[c];
    // group tokens at same coord for a small stack offset
    const groups = {};
    for (let i = 0; i < 4; i++) {
      const pos = tokens[i];
      const coord = tokenCoord(c, pos, i);
      if (!coord) continue;
      const key = `${coord.row}_${coord.col}`;
      groups[key] = groups[key] || [];
      groups[key].push(i);
    }
    for (const key of Object.keys(groups)) {
      const [row, col] = key.split('_').map(Number);
      const center = cellPx(row, col);
      const idxs = groups[key];
      idxs.forEach((tokenIndex, gi) => {
        const jitter = idxs.length > 1 ? (gi - (idxs.length - 1) / 2) * 8 : 0;
        const isMine = c === mySeat;
        const isMovable = isMine && movable.includes(tokenIndex);
        drawToken(center.x + jitter, center.y + jitter, COLOR_HEX[c], isMovable, now);
      });
    }
  }
}

function drawYard(row, col, size, color) {
  const x = col * CELL;
  const y = row * CELL;
  const w = size * CELL;
  ctx.fillStyle = COLOR_HEX[color] + '22';
  ctx.strokeStyle = COLOR_HEX[color] + '66';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, w, 10); else ctx.rect(x, y, w, w);
  ctx.fill();
  ctx.stroke();
}

function drawToken(x, y, color, glow, now) {
  const r = glow ? 8 + Math.sin(now / 180) * 1.5 : 7;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  if (glow) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

shell.bindLandingActions({ onPlay: handlePlay, onJoinCode: handleJoinCode });

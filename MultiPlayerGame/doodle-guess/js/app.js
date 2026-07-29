/**
 * doodle-guess/js/app.js
 * -----------------------------------------------------------------------
 * Roles alternate every round: the drawer sees a secret word and doodles
 * it on a shared canvas; the guesser watches the strokes stream in (via
 * a throttled write per in-progress stroke, redrawn fully on every
 * update — cheap for a small canvas) and races to type the word before
 * the 45s round timer runs out. Only the guesser can score, so a full
 * match is TOTAL_ROUNDS rounds (each player draws half of them); highest
 * total when the rounds run out wins. Against the Computer, the human
 * always draws (a bot obviously can't doodle) and the bot does the
 * guessing.
 *
 * Round advancement is symmetric like trivia-battle/reaction-duel: any
 * connected client's local timer can trigger it, guarded by a Firebase
 * transaction that only commits once per round.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, throttle } from '../../common/utils.js';
import { WORDS } from './wordbank.js';

const GAME_ID = 'doodle-guess';
const MATCH_WAIT_SECONDS = 30;
const SEATS = ['P1', 'P2'];
const TOTAL_ROUNDS = 6;
const ROUND_DURATION_MS = 45000;
const NEXT_ROUND_DELAY_MS = 2200;
const STROKE_SEND_INTERVAL_MS = 90;
const COLORS = ['#111111', '#e53935', '#1e88e5', '#2e7d32', '#fdd835', '#8e24aa'];

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Doodle Guess' });
const sounds = new SoundManager();

const statusBar = document.getElementById('status-bar');
const roundNum = document.getElementById('round-num');
const scoreP1 = document.getElementById('score-p1');
const scoreP2 = document.getElementById('score-p2');
const cardP1 = document.getElementById('card-p1');
const cardP2 = document.getElementById('card-p2');
const nameP1 = document.getElementById('name-p1');
const nameP2 = document.getElementById('name-p2');
const promptBanner = document.getElementById('prompt-banner');
const secretWordDisplay = document.getElementById('secret-word-display');
const drawTimerEl = document.getElementById('draw-timer');
const canvas = document.getElementById('doodle-canvas');
const ctx = canvas.getContext('2d');
const toolRow = document.getElementById('tool-row');
const colorSwatchesEl = document.getElementById('color-swatches');
const clearBtn = document.getElementById('clear-btn');
const guessRowEl = document.getElementById('guess-row');
const guessInput = document.getElementById('guess-input');
const guessSubmitBtn = document.getElementById('guess-submit-btn');
const guessLog = document.getElementById('guess-log');
const spectatorCount = document.getElementById('spectator-count');
const playAgainBtn = document.getElementById('play-again-btn');

let roomRef = null;
let strokesRef = null;
let playersRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastStatus = null;
let latestRoom = null;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
let botTimeout = null;
let botPendingRound = null;
let roundTimerInterval = null;
let roundTimeoutFired = null;
let lastRenderedRound = -1;

let selectedColor = COLORS[0];
let isDrawing = false;
let currentStrokeId = null;
let currentStrokePoints = [];

function drawerOf(round, mode) {
  if (mode === 'bot') return 'P1';
  return (round % 2 === 1) ? 'P1' : 'P2';
}

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
    totalRounds: TOTAL_ROUNDS,
    wordIndex,
    usedIndices: String(wordIndex),
    roundStartAt: Date.now(),
    duration: ROUND_DURATION_MS,
    solvedBy: null,
    guesses: [],
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
  strokesRef = roomRef.child('strokes');
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

  buildColorSwatches();
  attachListeners();
  bindDrawing();
  playersMap = (await playersRef.once('value')).val() || {};
  renderPlayers();

  shell.showGameScreen(roomCode);
  shell.setSoundIcon(sounds.enabled);
  sounds.playJoin();
  shell.toast(mySeat === 'spectator' ? "Both seats are taken — you're spectating." : `You're ${mySeat}`, 'info');
}

function buildColorSwatches() {
  colorSwatchesEl.innerHTML = '';
  COLORS.forEach((c) => {
    const sw = document.createElement('button');
    sw.className = 'swatch' + (c === selectedColor ? ' selected' : '');
    sw.style.background = c;
    sw.addEventListener('click', () => {
      selectedColor = c;
      Array.from(colorSwatchesEl.children).forEach((el) => el.classList.remove('selected'));
      sw.classList.add('selected');
    });
    colorSwatchesEl.appendChild(sw);
  });
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    latestRoom = room;
    handleStatusTransition(room);
    handleRoundChange(room);
    renderRoom(room);
    handleMatchmakingCountdown(room);
    manageRoundTimer(room);
    maybeTriggerBotGuess(room);
  });

  strokesRef.on('value', (snap) => {
    if (!latestRoom) return;
    const myTurn = mySeat === drawerOf(latestRoom.round, latestRoom.mode);
    if (myTurn && isDrawing) return; // I'm actively drawing — my own canvas is already up to date
    redrawFromStrokes(snap.val());
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

  clearBtn.addEventListener('click', () => {
    if (!latestRoom || mySeat !== drawerOf(latestRoom.round, latestRoom.mode)) return;
    clearMyCanvas();
    strokesRef.set(null);
  });

  guessSubmitBtn.addEventListener('click', submitGuess);
  guessInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitGuess(); });

  playAgainBtn.addEventListener('click', () => {
    sounds.playClick();
    const wordIndex = pickWordIndex([]);
    roomRef.transaction((room) => {
      if (!room) return room;
      room.round = 1;
      room.scores = { P1: 0, P2: 0 };
      room.wordIndex = wordIndex;
      room.usedIndices = String(wordIndex);
      room.roundStartAt = Date.now();
      room.solvedBy = null;
      room.guesses = [];
      room.winner = null;
      room.status = 'playing';
      return room;
    });
    strokesRef.set(null);
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
    room.roundStartAt = Date.now();
    room.solvedBy = null;
    room.guesses = [];
    room.winner = null;
    room.status = 'waiting';
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
  strokesRef.set(null);
}

function submitGuess() {
  if (!latestRoom) return;
  const text = guessInput.value.trim();
  if (!text) return;
  guessInput.value = '';
  attemptGuess(mySeat, text);
}

async function attemptGuess(seat, rawText) {
  const text = rawText.trim();
  if (!text) return;
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.solvedBy) return;
    if (seat !== drawerGuesserSeat(room)) return; // not the guesser this round

    const secret = WORDS[room.wordIndex];
    const correct = text.trim().toUpperCase() === secret;
    room.guesses = room.guesses || [];
    room.guesses = [...room.guesses, { seat, text, correct, at: Date.now() }];

    if (correct) {
      room.solvedBy = seat;
      room.scores = room.scores || { P1: 0, P2: 0 };
      room.scores[seat] = (room.scores[seat] || 0) + 1;
    }
    return room;
  });

  if (txResult.committed) {
    const room = txResult.snapshot.val();
    if (room && room.solvedBy === seat) {
      sounds.playSuccess();
      scheduleNextRound(room.round);
    } else {
      sounds.playClick();
    }
  }
}

function drawerGuesserSeat(room) {
  const drawer = drawerOf(room.round, room.mode);
  return drawer === 'P1' ? 'P2' : 'P1';
}

function scheduleNextRound(prevRound) {
  setTimeout(() => advanceRound(prevRound), NEXT_ROUND_DELAY_MS);
}

async function advanceRound(prevRound) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    if (room.round !== prevRound) return; // already advanced

    const total = room.totalRounds || TOTAL_ROUNDS;
    if (prevRound >= total) {
      room.status = 'finished';
      const s = room.scores || { P1: 0, P2: 0 };
      room.winner = s.P1 === s.P2 ? null : (s.P1 > s.P2 ? 'P1' : 'P2');
      return room;
    }

    const used = (room.usedIndices || '').split(',').filter(Boolean).map(Number);
    if (!used.includes(room.wordIndex)) used.push(room.wordIndex);
    const nextIndex = pickWordIndex(used);
    let newUsed = [...used, nextIndex];
    if (newUsed.length >= WORDS.length) newUsed = [nextIndex];

    room.usedIndices = newUsed.join(',');
    room.wordIndex = nextIndex;
    room.roundStartAt = Date.now();
    room.solvedBy = null;
    room.guesses = [];
    room.round = prevRound + 1;
    return room;
  });

  if (txResult.committed && txResult.snapshot.val() && txResult.snapshot.val().round === prevRound + 1) {
    strokesRef.set(null);
  }
}

function maybeTriggerBotGuess(room) {
  const botCanGuess = room.mode === 'bot' && room.status === 'playing' && !room.solvedBy && drawerGuesserSeat(room) === 'P2';
  if (!botCanGuess || mySeat !== 'P1') return;
  if (botPendingRound === room.round) return;
  botPendingRound = room.round;
  clearTimeout(botTimeout);

  const willGuessCorrectly = Math.random() < 0.55;
  const secret = WORDS[room.wordIndex];
  const guessWord = willGuessCorrectly ? secret : WORDS[(room.wordIndex + 1 + Math.floor(Math.random() * (WORDS.length - 1))) % WORDS.length];
  const delay = 6000 + Math.random() * 18000;
  botTimeout = setTimeout(() => attemptGuess('P2', guessWord), Math.min(delay, ROUND_DURATION_MS - 2000));
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
    drawTimerEl.textContent = '';
    return;
  }
  const tick = () => {
    const elapsed = (Date.now() - (room.roundStartAt || Date.now())) / 1000;
    const remaining = Math.max(0, Math.ceil((room.duration || ROUND_DURATION_MS) / 1000 - elapsed));
    drawTimerEl.textContent = `⏱ ${remaining}s`;
    if (remaining <= 0 && roundTimeoutFired !== room.round) {
      roundTimeoutFired = room.round;
      advanceRound(room.round);
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
    if (mySeat === 'spectator') { /* no personal result sound */ }
    else if (room.winner === null) sounds.playDraw();
    else if (mySeat === room.winner) sounds.playWin();
    else sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

function handleRoundChange(room) {
  if (lastRenderedRound === room.round) return;
  lastRenderedRound = room.round;
  guessInput.value = '';
  clearMyCanvas();
}

async function handleLeave() {
  stopMatchmakingCountdown();
  clearTimeout(botTimeout);
  botPendingRound = null;
  if (roundTimerInterval) clearInterval(roundTimerInterval);
  roundTimeoutFired = null;
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (strokesRef) strokesRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  latestRoom = null;
  lastRenderedRound = -1;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function amIDrawer() {
  return latestRoom && latestRoom.status === 'playing' && mySeat === drawerOf(latestRoom.round, latestRoom.mode);
}

function bindDrawing() {
  canvas.addEventListener('pointerdown', (e) => {
    if (!amIDrawer()) return;
    isDrawing = true;
    currentStrokeId = 's' + Date.now() + Math.floor(Math.random() * 1000);
    const p = canvasPoint(e);
    currentStrokePoints = [p];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing || !amIDrawer()) return;
    const p = canvasPoint(e);
    currentStrokePoints.push(p);
    drawSegment(ctx, currentStrokePoints[currentStrokePoints.length - 2], p, selectedColor);
    sendStroke();
  });

  const endStroke = () => {
    if (!isDrawing) return;
    isDrawing = false;
    if (strokesRef && currentStrokeId) {
      strokesRef.child(currentStrokeId).set({ color: selectedColor, points: currentStrokePoints });
    }
    currentStrokeId = null;
    currentStrokePoints = [];
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointerleave', endStroke);
}

const sendStroke = throttle(() => {
  if (!strokesRef || !currentStrokeId) return;
  strokesRef.child(currentStrokeId).set({ color: selectedColor, points: currentStrokePoints });
}, STROKE_SEND_INTERVAL_MS);

function drawSegment(context, from, to, color) {
  context.strokeStyle = color;
  context.lineWidth = 5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
}

function clearMyCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function redrawFromStrokes(strokesObj) {
  clearMyCanvas();
  if (!strokesObj) return;
  Object.values(strokesObj).forEach((stroke) => {
    if (!stroke || !stroke.points || stroke.points.length < 2) return;
    for (let i = 1; i < stroke.points.length; i++) {
      drawSegment(ctx, stroke.points[i - 1], stroke.points[i], stroke.color || '#111111');
    }
  });
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function renderRoom(room) {
  roundNum.textContent = Math.min(room.round || 1, room.totalRounds || TOTAL_ROUNDS);
  scoreP1.textContent = (room.scores && room.scores.P1) || 0;
  scoreP2.textContent = (room.scores && room.scores.P2) || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing' && drawerOf(room.round, room.mode) === 'P1');
  cardP2.classList.toggle('active-turn', room.status === 'playing' && drawerOf(room.round, room.mode) === 'P2');

  const iAmDrawer = room.status === 'playing' && mySeat === drawerOf(room.round, room.mode);
  const iAmGuesser = room.status === 'playing' && mySeat === drawerGuesserSeat(room);

  promptBanner.classList.toggle('hidden', !iAmDrawer);
  if (iAmDrawer) secretWordDisplay.textContent = WORDS[room.wordIndex];

  toolRow.classList.toggle('hidden', !iAmDrawer);
  guessRowEl.classList.toggle('hidden', !iAmGuesser || !!room.solvedBy);
  guessInput.disabled = !iAmGuesser || !!room.solvedBy;
  guessSubmitBtn.disabled = !iAmGuesser || !!room.solvedBy;

  guessLog.innerHTML = '';
  (room.guesses || []).slice(-6).forEach((g) => {
    const div = document.createElement('div');
    div.className = 'entry' + (g.correct ? ' correct' : '');
    const label = g.seat === mySeat ? 'You' : g.seat;
    div.textContent = g.correct ? `${label} guessed it: ${g.text}! 🎉` : `${label}: ${g.text}`;
    guessLog.appendChild(div);
  });

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    if (room.solvedBy) text = `${room.solvedBy === mySeat ? 'You' : room.solvedBy} guessed it! Next round…`;
    else if (iAmDrawer) text = 'Draw your word — the clock is ticking!';
    else if (iAmGuesser) text = 'Watch and guess the doodle!';
    else text = 'Watching the doodle…';
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

clearMyCanvas();
shell.bindLandingActions({ onPlay: handlePlay, onJoinCode: handleJoinCode });

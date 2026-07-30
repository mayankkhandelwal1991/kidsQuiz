/**
 * trivia-party/js/app.js
 * -----------------------------------------------------------------------
 * A 2-8 player trivia room. Like Ludo Royale, this needed its own lobby
 * (findOrCreateRoom) instead of the shared 2-seat QuickMatch class — see
 * ludo-royale/js/app.js for the full rationale, it's identical here.
 *
 * Unlike Ludo, there's no turn order at all: every seated player answers
 * the SAME question simultaneously and independently. That makes this
 * the simplest possible >2-player game to reason about — each player's
 * answer is written to `answers/{seat}`, which only that seat ever
 * touches, so there's no transaction contention between players, only
 * between a player's own answer-submit and the shared round-advance
 * checker (which any client may call, transaction-guarded via a
 * `phase` field so only one "reveal -> next round" transition ever
 * actually commits).
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, randInt } from '../../common/utils.js';
import { QUESTIONS } from './questions.js';

const GAME_ID = 'trivia-party';
const MATCH_WAIT_SECONDS = 10;
const SEATS = Array.from({ length: 8 }, (_, i) => `P${i + 1}`);
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const TOTAL_ROUNDS = 8;
const ROUND_TIME_MS = 12000;
const REVEAL_PAUSE_MS = 2200;

const db = firebase.database();
const gameRoomsBase = db.ref(`games/${GAME_ID}/rooms`);
const lobbyRef = db.ref(`games/${GAME_ID}/lobby/waitingRoom`);
const shell = new GameShell({ gameTitle: 'Trivia Party' });
const sounds = new SoundManager();

const lobbyPanel = document.getElementById('lobby-panel');
const lobbySeatsEl = document.getElementById('lobby-seats');
const lobbyCountEl = document.getElementById('lobby-count');
const lobbyHintEl = document.getElementById('lobby-hint');
const startGameBtn = document.getElementById('start-game-btn');
const gameArea = document.getElementById('game-area');
const roundLabel = document.getElementById('round-label');
const timerFill = document.getElementById('timer-fill');
const categoryLabel = document.getElementById('category-label');
const questionText = document.getElementById('question-text');
const optionsGrid = document.getElementById('options-grid');
const statusBar = document.getElementById('status-bar');
const leaderboardEl = document.getElementById('leaderboard');
const playAgainBtn = document.getElementById('play-again-btn');

let roomRef = null;
let playersRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastStatus = null;
let lastPhase = null;
let lastRound = 0;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
let tickInterval = null;
let timerRaf = null;
let botHandledRound = 0;
let botTimeout = null;

function occupiedSeats(room) {
  return SEATS.filter((s) => Object.values(room.players || {}).some((p) => p.seat === s));
}

function shuffledQuestionOrder() {
  const idx = QUESTIONS.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, TOTAL_ROUNDS);
}

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    phase: 'question',
    round: 0,
    totalRounds: TOTAL_ROUNDS,
    questionOrder: [],
    questionStartAt: null,
    roundEndAt: null,
    revealUntil: null,
    answers: {},
    scores: {},
    winner: null,
  };
}

async function findOrCreateRoom() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const snap = await lobbyRef.once('value');
    const code = snap.val();

    if (code) {
      const roomSnap = await gameRoomsBase.child(code).once('value');
      const room = roomSnap.val();
      const occupied = room ? occupiedSeats(room).length : 0;
      if (room && room.status === 'waiting' && occupied < MAX_PLAYERS) return code;
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

  mySeat = await claimSeat(playersRef, SEATS, playerId, nickname);
  setupPresence(selfRef);

  if (SEATS.includes(mySeat)) {
    const occSnap = await playersRef.once('value');
    const occupied = SEATS.filter((s) => Object.values(occSnap.val() || {}).some((p) => p.seat === s)).length;
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

  tickInterval = setInterval(() => { finalizeCheck(); }, 300);
  timerRaf = requestAnimationFrame(timerLoop);
}

let lastRoomSnapshot = null;

function timerLoop() {
  if (lastRoomSnapshot && lastRoomSnapshot.status === 'playing' && lastRoomSnapshot.phase === 'question') {
    const remaining = Math.max(0, (lastRoomSnapshot.roundEndAt || 0) - Date.now());
    timerFill.style.width = `${Math.round((remaining / ROUND_TIME_MS) * 100)}%`;
  }
  timerRaf = requestAnimationFrame(timerLoop);

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    lastRoomSnapshot = room;
    handleStatusTransition(room);
    if (room.status === 'waiting') renderLobby(room);
    else renderGame(room);
    handleMatchmakingCountdown(room);
    maybeRunBot(room);
  });

  playersRef.on('value', (snap) => {
    playersMap = snap.val() || {};
    renderSpectatorCount();
  });

  playersRef.on('child_removed', (snap) => {
    const data = snap.val();
    if (data && SEATS.includes(data.seat)) {
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
  playAgainBtn.addEventListener('click', () => { sounds.playClick(); playAgain(); });
}

async function resetRoomForDisconnect() {
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.status = 'waiting';
    room.phase = 'question';
    room.round = 0;
    room.questionOrder = [];
    room.answers = {};
    room.scores = {};
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
  const order = shuffledQuestionOrder();
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    const occ = occupiedSeats(room);
    if (occ.length < MIN_PLAYERS) return;

    room.questionOrder = order;
    room.round = 1;
    room.phase = 'question';
    room.questionStartAt = Date.now();
    room.roundEndAt = Date.now() + ROUND_TIME_MS;
    room.revealUntil = null;
    room.answers = {};
    room.scores = {};
    for (const s of occ) room.scores[s] = 0;
    room.winner = null;
    room.status = 'playing';
    return room;
  });
  if (!silent && !txResult.committed) shell.toast('Need at least 2 players to start.', 'warn');
  if (txResult.committed) await lobbyRef.transaction((cur) => (cur === roomRef.key ? null : cur));
}

async function playAgain() {
  const order = shuffledQuestionOrder();
  await roomRef.transaction((room) => {
    if (!room) return room;
    const occ = occupiedSeats(room);
    if (occ.length < MIN_PLAYERS) { room.status = 'waiting'; return room; }
    room.questionOrder = order;
    room.round = 1;
    room.phase = 'question';
    room.questionStartAt = Date.now();
    room.roundEndAt = Date.now() + ROUND_TIME_MS;
    room.revealUntil = null;
    room.answers = {};
    room.scores = {};
    for (const s of occ) room.scores[s] = 0;
    room.winner = null;
    room.status = 'playing';
    return room;
  });
}

// ---------------------------------------------------------------------
// Answering + round advance
// ---------------------------------------------------------------------

async function attemptAnswer(seat, choice) {
  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing' || room.phase !== 'question') return;
    room.answers = room.answers || {};
    if (room.answers[seat]) return; // already answered this round

    const qIndex = room.questionOrder[room.round - 1];
    const question = QUESTIONS[qIndex];
    const correct = choice === question.correct;
    room.answers[seat] = { choice, correct, t: Date.now() };

    if (correct) {
      const elapsed = Date.now() - (room.questionStartAt || Date.now());
      const remaining = Math.max(0, ROUND_TIME_MS - elapsed);
      const points = 50 + Math.round((remaining / ROUND_TIME_MS) * 50);
      room.scores = room.scores || {};
      room.scores[seat] = (room.scores[seat] || 0) + points;
    }
    return room;
  });
  sounds.playClick();
}

function computeWinner(scores, occ) {
  let best = null, bestScore = -1, tie = false;
  for (const s of occ) {
    const v = scores[s] || 0;
    if (v > bestScore) { bestScore = v; best = s; tie = false; }
    else if (v === bestScore) { tie = true; }
  }
  return tie ? null : best;
}

async function finalizeCheck() {
  if (!roomRef) return;
  await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    const occ = occupiedSeats(room);

    if (room.phase === 'question') {
      const answeredCount = Object.keys(room.answers || {}).length;
      const timeUp = Date.now() >= (room.roundEndAt || 0);
      if (answeredCount >= occ.length || timeUp) {
        room.phase = 'reveal';
        room.revealUntil = Date.now() + REVEAL_PAUSE_MS;
        return room;
      }
      return; // nothing to do yet
    }

    if (room.phase === 'reveal') {
      if (Date.now() < (room.revealUntil || 0)) return;
      if (room.round >= room.totalRounds) {
        room.status = 'finished';
        room.winner = computeWinner(room.scores || {}, occ);
        return room;
      }
      room.round += 1;
      room.phase = 'question';
      room.answers = {};
      room.questionStartAt = Date.now();
      room.roundEndAt = Date.now() + ROUND_TIME_MS;
      room.revealUntil = null;
      return room;
    }
    return;
  });
}

// ---------------------------------------------------------------------
// Bot (driven by P1, the always-present first joiner, same convention
// as every other bot-enabled game in this collection)
// ---------------------------------------------------------------------

function botSeatOf(room) {
  for (const [id, p] of Object.entries(room.players || {})) {
    if (id === 'bot' || p.nickname === 'Computer') return p.seat;
  }
  return null;
}

function maybeRunBot(room) {
  if (mySeat !== 'P1' || room.mode !== 'bot' || room.status !== 'playing' || room.phase !== 'question') return;
  const botSeat = botSeatOf(room);
  if (!botSeat) return;
  if (room.answers && room.answers[botSeat]) return;
  if (botHandledRound === room.round) return;
  botHandledRound = room.round;
  clearTimeout(botTimeout);

  const qIndex = room.questionOrder[room.round - 1];
  const question = QUESTIONS[qIndex];
  const willBeCorrect = Math.random() < 0.65;
  const choice = willBeCorrect ? question.correct : randInt(0, 3);
  const delay = randInt(1500, Math.min(6000, ROUND_TIME_MS - 1500));
  botTimeout = setTimeout(() => attemptAnswer(botSeat, choice), delay);
}

async function activateBot() {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'waiting') return;
    const occ = occupiedSeats(room);
    if (occ.length !== 1) return;
    const nextSeat = SEATS.find((s) => !occ.includes(s));
    room.mode = 'bot';
    room.players = room.players || {};
    room.players['bot'] = { nickname: 'Computer', seat: nextSeat, joinedAt: Date.now() };
    return room;
  });
  if (txResult.committed) shell.toast('A Computer player joined — start whenever you like!', 'info');
}

function handleMatchmakingCountdown(room) {
  const occ = occupiedSeats(room);
  const iAmWaitingAlone = mySeat === 'P1' && room.status === 'waiting' && occ.length === 1;
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
    if (room.winner === null) sounds.playDraw();
    else if (mySeat === room.winner) sounds.playWin();
    else if (mySeat !== 'spectator') sounds.playLose();
    try { if (window.KQ && KQ.addWin && mySeat === room.winner) KQ.addWin('multi', GAME_ID); } catch (e) {}
  }
}

async function handleLeave() {
  stopMatchmakingCountdown();
  clearTimeout(botTimeout);
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
  if (timerRaf) { cancelAnimationFrame(timerRaf); timerRaf = null; }
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  lastPhase = null;
  lastRound = 0;
  botHandledRound = 0;
  lastRoomSnapshot = null;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function seatClass(seat) {
  const i = SEATS.indexOf(seat);
  return i >= 0 ? `p-${i + 1}` : 'p-empty';
}

function renderLobby(room) {
  lobbyPanel.classList.remove('hidden');
  gameArea.classList.add('hidden');

  const seatOf = {};
  for (const p of Object.values(room.players || {})) if (SEATS.includes(p.seat)) seatOf[p.seat] = p;

  lobbySeatsEl.innerHTML = '';
  let occupiedCount = 0;
  for (const s of SEATS) {
    const p = seatOf[s];
    const div = document.createElement('div');
    div.className = 'lobby-seat ' + (p ? `filled ${seatClass(s)}` : 'p-empty');
    if (p && s === mySeat) div.classList.add('you');
    if (p) { occupiedCount++; div.textContent = `${p.nickname}${p.nickname === 'Computer' ? ' 🤖' : ''}`; }
    else div.textContent = 'Open';
    lobbySeatsEl.appendChild(div);
  }

  lobbyCountEl.textContent = `(${occupiedCount}/${MAX_PLAYERS})`;
  const canStart = occupiedCount >= MIN_PLAYERS;
  startGameBtn.disabled = !canStart;
  lobbyHintEl.textContent = canStart
    ? 'Anyone can tap Start when ready — more players can still join until then.'
    : `Need at least ${MIN_PLAYERS} players to start.`;
}

function renderSpectatorCount() {
  // Trivia Party has no dedicated spectator element on the game screen;
  // spectators simply see the leaderboard/questions read-only.
}

function renderGame(room) {
  lobbyPanel.classList.add('hidden');
  gameArea.classList.remove('hidden');

  roundLabel.textContent = `Round ${Math.min(room.round, room.totalRounds)}/${room.totalRounds}`;

  if (room.status !== 'playing' || room.phase !== 'question') {
    timerFill.style.width = room.status === 'finished' ? '0%' : '100%';
  }

  const qIndex = room.questionOrder && room.questionOrder[room.round - 1];
  const question = qIndex !== undefined ? QUESTIONS[qIndex] : null;

  if (question && room.status !== 'finished') {
    categoryLabel.textContent = question.category;
    questionText.textContent = question.q;
    const myAnswer = room.answers && room.answers[mySeat];
    const revealing = room.phase === 'reveal';

    optionsGrid.innerHTML = '';
    question.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      if (myAnswer && myAnswer.choice === i) btn.classList.add('picked');
      if (revealing) {
        if (i === question.correct) btn.classList.add('correct');
        else if (myAnswer && myAnswer.choice === i) btn.classList.add('wrong');
      }
      const disabled = !SEATS.includes(mySeat) || !!myAnswer || revealing;
      btn.disabled = disabled;
      if (!disabled) btn.addEventListener('click', () => attemptAnswer(mySeat, i));
      optionsGrid.appendChild(btn);
    });
  } else if (room.status !== 'finished') {
    categoryLabel.textContent = '';
    questionText.textContent = 'Get ready…';
    optionsGrid.innerHTML = '';
  }

  let text = '';
  if (room.status === 'playing') {
    if (room.phase === 'reveal') {
      text = 'Correct answer highlighted!';
    } else if (!SEATS.includes(mySeat)) {
      text = 'Watching the round…';
    } else if (room.answers && room.answers[mySeat]) {
      text = 'Answer locked in — waiting on others…';
    } else {
      text = 'Pick your answer!';
    }
  } else if (room.status === 'finished') {
    if (room.winner === null) text = "It's a tie!";
    else if (mySeat === room.winner) text = 'You won Trivia Party! 🎉';
    else text = `${room.winner} wins! Final scores below.`;
  }
  statusBar.textContent = text;
  statusBar.className = 'status-bar ' + (room.status === 'finished' ? (mySeat === room.winner ? 'status-won' : 'status-lost') : '');

  renderLeaderboard(room);
  playAgainBtn.classList.toggle('hidden', room.status !== 'finished');
}

function renderLeaderboard(room) {
  const seatOf = {};
  for (const p of Object.values(room.players || {})) if (SEATS.includes(p.seat)) seatOf[p.seat] = p;
  const occ = SEATS.filter((s) => seatOf[s]);
  const rows = occ
    .map((s) => ({ seat: s, name: seatOf[s].nickname, score: (room.scores && room.scores[s]) || 0 }))
    .sort((a, b) => b.score - a.score);

  leaderboardEl.innerHTML = '';
  rows.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'lb-row' + (r.seat === mySeat ? ' me' : '');
    div.innerHTML = `<span class="lb-name"><span class="lb-dot ${seatClass(r.seat)}"></span>#${i + 1} ${r.name}${r.seat === mySeat ? ' (you)' : ''}</span><span class="lb-score">${r.score}</span>`;
    leaderboardEl.appendChild(div);
  });
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

shell.bindLandingActions({ onPlay: handlePlay, onJoinCode: handleJoinCode });

/**
 * rock-paper-scissors/js/app.js
 * -----------------------------------------------------------------------
 * Best-of-5 Rock Paper Scissors. Both players submit a choice for the
 * current round; once both are in, a transaction resolves the round
 * (ties replay the same round, decisive rounds award a point and advance)
 * and rounds continue until someone reaches 3 points.
 *
 * NOTE ON FAIRNESS: because this project intentionally uses only the
 * Realtime Database with open rules (no Firebase Auth / server function),
 * a technically savvy player could open devtools and read the room's
 * `choices` node before choosing themselves. For a casual game among
 * friends this is an accepted trade-off of the "Firebase RTDB only, no
 * backend" design — see the project README for details.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager } from '../../common/utils.js';

const GAME_ID = 'rps';
const MATCH_WAIT_SECONDS = 30;
const SEATS = ['P1', 'P2'];
const WIN_SCORE = 3;
const REVEAL_PAUSE_MS = 1800;
const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'RPS Duel' });
const sounds = new SoundManager();

const statusBar = document.getElementById('status-bar');
const roundNum = document.getElementById('round-num');
const scoreP1 = document.getElementById('score-p1');
const scoreP2 = document.getElementById('score-p2');
const cardP1 = document.getElementById('card-p1');
const cardP2 = document.getElementById('card-p2');
const nameP1 = document.getElementById('name-p1');
const nameP2 = document.getElementById('name-p2');
const revealP1 = document.getElementById('reveal-p1');
const revealP2 = document.getElementById('reveal-p2');
const spectatorCount = document.getElementById('spectator-count');
const playAgainBtn = document.getElementById('play-again-btn');
const choiceButtons = Array.from(document.querySelectorAll('.choice-btn'));

let roomRef = null;
let playersRef = null;
let selfRef = null;
let playerId = null;
let mySeat = null;
let playersMap = {};
let lastRoundShown = 0;
let lastStatus = null;

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
let botChoiceTimeout = null;
let botChoicePendingRound = null;

function beats(a, b) {
  return (a === 'rock' && b === 'scissors') || (a === 'scissors' && b === 'paper') || (a === 'paper' && b === 'rock');
}

function buildInitialRoom() {
  return {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    mode: 'human',
    status: 'waiting',
    round: 1,
    scores: { P1: 0, P2: 0 },
    choices: { P1: null, P2: null },
    lastResult: null,
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

  choiceButtons.forEach((btn) => {
    btn.addEventListener('click', () => handleChoice(btn.dataset.choice));
  });
}

function attachListeners() {
  roomRef.on('value', (snap) => {
    const room = snap.val();
    if (!room) return;
    handleStatusTransition(room);
    renderRoom(room);
    handleMatchmakingCountdown(room);
    maybeTriggerBotChoice(room);
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
      room.round = 1;
      room.scores = { P1: 0, P2: 0 };
      room.choices = { P1: null, P2: null };
      room.lastResult = null;
      room.winner = null;
      room.status = 'playing';
      return room;
    });
  });
}

async function resetRoomForDisconnect() {
  await roomRef.transaction((room) => {
    if (!room) return room;
    room.round = 1;
    room.scores = { P1: 0, P2: 0 };
    room.choices = { P1: null, P2: null };
    room.lastResult = null;
    room.winner = null;
    room.status = 'waiting';
    room.mode = 'human';
    if (room.players && room.players.bot) delete room.players.bot;
    return room;
  });
}

function handleChoice(choice) {
  if (mySeat !== 'P1' && mySeat !== 'P2') return;
  attemptChoice(mySeat, choice);
}

async function attemptChoice(seat, choice) {
  const txResult = await roomRef.transaction((room) => {
    if (!room) return room;
    if (room.status !== 'playing') return;
    room.choices = room.choices || { P1: null, P2: null };
    if (room.choices[seat]) return; // already chose this round — abort

    room.choices[seat] = choice;

    if (room.choices.P1 && room.choices.P2) {
      const p1 = room.choices.P1;
      const p2 = room.choices.P2;
      let winnerSeat = null;
      if (p1 !== p2) winnerSeat = beats(p1, p2) ? 'P1' : 'P2';

      room.lastResult = { round: room.round, p1Choice: p1, p2Choice: p2, winner: winnerSeat };

      if (winnerSeat) {
        room.scores = room.scores || { P1: 0, P2: 0 };
        room.scores[winnerSeat] = (room.scores[winnerSeat] || 0) + 1;
        if (room.scores[winnerSeat] >= WIN_SCORE) {
          room.status = 'finished';
          room.winner = winnerSeat;
        } else {
          room.round = (room.round || 1) + 1;
        }
      }
      // Ties keep the same round number and just get re-picked after the reveal.
    }
    return room;
  });

  if (txResult.committed) {
    sounds.playClick();
    const room = txResult.snapshot.val();
    if (room && room.choices && room.choices.P1 && room.choices.P2) {
      // Both picks are in — schedule this client to help clear for the next round.
      scheduleAdvance();
    }
  }
}

/** Bot always plays P2. */
async function attemptBotChoice(choice) {
  return attemptChoice('P2', choice);
}

function scheduleAdvance() {
  setTimeout(() => {
    roomRef.transaction((room) => {
      if (!room) return room;
      if (room.status === 'finished') return room; // game over, nothing to clear
      if (!room.choices || !room.choices.P1 || !room.choices.P2) return; // already cleared
      room.choices = { P1: null, P2: null };
      return room;
    });
  }, REVEAL_PAUSE_MS);
}

function computeBotChoice() {
  const options = ['rock', 'paper', 'scissors'];
  return options[Math.floor(Math.random() * options.length)];
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

function maybeTriggerBotChoice(room) {
  const botNeedsToChoose = room.mode === 'bot' && room.status === 'playing' && !(room.choices && room.choices.P2);
  if (!botNeedsToChoose || mySeat !== 'P1') return;
  if (botChoicePendingRound === room.round) return;
  botChoicePendingRound = room.round;
  clearTimeout(botChoiceTimeout);
  botChoiceTimeout = setTimeout(() => {
    attemptBotChoice(computeBotChoice());
  }, 400 + Math.random() * 700);
}

function handleStatusTransition(room) {
  if (lastStatus === room.status) return;
  const prev = lastStatus;
  lastStatus = room.status;
  if (prev === null) return;
  if (room.status === 'finished') {
    if (mySeat === room.winner) sounds.playWin();
    else if (mySeat !== 'spectator') sounds.playLose();
  }
}

async function handleLeave() {
  stopMatchmakingCountdown();
  clearTimeout(botChoiceTimeout);
  botChoicePendingRound = null;
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  if (roomRef) roomRef.off();
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  lastRoundShown = 0;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function renderRoom(room) {
  roundNum.textContent = Math.min(room.round || 1, 5);
  scoreP1.textContent = (room.scores && room.scores.P1) || 0;
  scoreP2.textContent = (room.scores && room.scores.P2) || 0;

  const myChoiceMade = mySeat === 'P1' || mySeat === 'P2' ? !!(room.choices && room.choices[mySeat]) : false;
  const gameActive = room.status === 'playing';
  choiceButtons.forEach((btn) => {
    btn.disabled = !gameActive || mySeat === 'spectator' || myChoiceMade;
    btn.classList.toggle('selected', room.choices && room.choices[mySeat] === btn.dataset.choice);
  });

  // Reveal display: show the last result's emojis while both choices are
  // still populated (i.e. during the pause before the next round clears
  // them) or once the match has finished. Otherwise show placeholders.
  const bothChosen = !!(room.choices && room.choices.P1 && room.choices.P2);
  const result = room.lastResult;
  if (result && (bothChosen || room.status === 'finished')) {
    revealP1.textContent = EMOJI[result.p1Choice] || '❔';
    revealP2.textContent = EMOJI[result.p2Choice] || '❔';
    revealP1.classList.toggle('win', result.winner === 'P1');
    revealP1.classList.toggle('lose', result.winner === 'P2');
    revealP2.classList.toggle('win', result.winner === 'P2');
    revealP2.classList.toggle('lose', result.winner === 'P1');
  } else {
    revealP1.textContent = '❔';
    revealP2.textContent = '❔';
    revealP1.classList.remove('win', 'lose');
    revealP2.classList.remove('win', 'lose');
  }

  cardP1.classList.toggle('active-turn', gameActive && !(room.choices && room.choices.P1));
  cardP2.classList.toggle('active-turn', gameActive && !(room.choices && room.choices.P2));

  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') {
    if (mySeat === 'spectator') text = 'Watching the duel…';
    else text = myChoiceMade ? 'Waiting for opponent…' : 'Make your move!';
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

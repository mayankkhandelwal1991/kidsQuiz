/**
 * pong-duel/js/app.js
 * -----------------------------------------------------------------------
 * Real-time Ping Pong for two players over Firebase Realtime Database.
 *
 * How it stays smooth and fair over a slow network:
 *
 *  1. The ball is NOT streamed. The room keeps one small "match" record:
 *       ball = { x0, y0, vx, vy, t0 }   (position + speed at server time t0)
 *     Ball flight is fully predictable (straight lines + side-wall bounces),
 *     so every phone computes the exact same ball position for "now" on its
 *     own, every frame (ballAt). Nothing lags behind; Firebase is only
 *     written when something happens (a hit, a miss, a new serve).
 *
 *  2. Each player decides the hits on THEIR OWN paddle, exactly as they see
 *     it on their screen (defend). When the ball reaches my paddle line my
 *     phone checks my paddle: hit -> it publishes the new ball; miss -> it
 *     publishes the point + the next serve. So your paddle always matters.
 *     Every write is a transaction on match.seq, so two writes can never
 *     both win.
 *
 *  3. While waiting for the opponent's answer, my phone predicts their
 *     return from where their paddle is shown (displayBall), and blends
 *     smoothly into the real answer when it arrives.
 *
 *  4. Time is Firebase server time (.info/serverTimeOffset), so both phones
 *     agree on when a serve starts and where the ball is.
 *
 *  Computer mode: P1 alone; P1's phone also plays the Computer's end.
 *  If a player's phone stalls (app in background), the other player
 *  awards the point after a short grace time so the game never freezes.
 * -----------------------------------------------------------------------
 */

import { GameShell } from '../../common/shell.js';
import { QuickMatch, claimSeat, setupPresence, watchConnectionState } from '../../common/net.js';
import { generateRoomCode, generatePlayerId, sanitizeNickname, SoundManager, clamp } from '../../common/utils.js';

const GAME_ID = 'pong-duel';
const MATCH_WAIT_SECONDS = 10;
const SEATS = ['P1', 'P2'];

// Portrait table, same look as the single-player Ping Pong. World coordinates:
// P1's paddle is at the bottom, P2's at the top. P2 sees the table turned
// round (rotated 180°) so everyone plays from the bottom of the screen.
const W = 300;
const H = 480;
const PADDLE_W = 72;   // paddle length (along x)
const PADDLE_T = 14;   // paddle thickness
const BALL_R = 8;
const EDGE = 26;       // paddle distance from the table end
const P1_TOP = H - EDGE - PADDLE_T;  // P1 (bottom) paddle front face
const P2_BOT = EDGE + PADDLE_T;      // P2 (top) paddle front face
const WIN_SCORE = 7;
const BASE_SPEED = 240;
const MAX_SPEED = 520;
const KEYBOARD_SPEED = 360;
const BOT_SPEED = 250;
const SERVE_MS = 1300;         // ball waits in the middle before a serve
const OUT_MS = 500;            // after a miss the old ball keeps flying this long
const STALL_MS = 1500;         // opponent didn't answer: their phone is asleep -> point
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const PADDLE_SEND_MS = 40;

const XMIN = BALL_R, XMAX = W - BALL_R, SPAN = XMAX - XMIN;

const db = firebase.database();
const quickMatch = new QuickMatch(db, GAME_ID);
const shell = new GameShell({ gameTitle: 'Ping Pong Duel' });
const sounds = new SoundManager();

// shared clock: Firebase server time
let serverOffset = 0;
db.ref('.info/serverTimeOffset').on('value', (s) => { serverOffset = s.val() || 0; });
const now = () => Date.now() + serverOffset;

const canvas = document.getElementById('pong-canvas');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('status-bar');
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
let listening = [];            // refs to .off() when leaving

let matchmakingInterval = null;
let matchmakingSecondsLeft = MATCH_WAIT_SECONDS;

let running = false;
let lastFrameTime = 0;
let myPaddleX = W / 2;                         // world x of my paddle (exact, local)
const remoteX = { P1: W / 2, P2: W / 2 };      // last received paddle positions
const shownX = { P1: W / 2, P2: W / 2 };       // smoothed, what is drawn
let botPaddleX = W / 2;
let trail = [];
const room = { status: 'waiting', mode: 'human', winner: null };
let match = null;              // { seq, ball, scores, by, miss, out }
let handled = '';              // "<seq>:<seat>" already decided by this phone
let lastShown = null, shownSeq = -1, smooth = { x: 0, y: 0 };
let namesKey = '';
const keys = {};

// ---------------------------------------------------------------------
// Ball maths (identical on every phone)
// ---------------------------------------------------------------------
function serve(towardSeat, delay = SERVE_MS) {           // ball goes to towardSeat first
  return {
    x0: W / 2, y0: H / 2,
    vx: Math.round((Math.random() * 2 - 1) * BASE_SPEED * 0.45),
    vy: towardSeat === 'P1' ? BASE_SPEED : -BASE_SPEED,
    t0: Math.round(now() + delay),
  };
}
function freshMatch(prevSeq) {
  return { seq: (prevSeq || 0) + 1, ball: serve(Math.random() < 0.5 ? 'P1' : 'P2', SERVE_MS + 400), scores: { P1: 0, P2: 0 }, by: '', miss: '', out: null };
}
/** Where the ball is at server time t (straight line, bouncing off the side walls). */
function ballAt(b, t) {
  if (t <= b.t0) return { x: b.x0, y: b.y0, waiting: true };
  const s = (t - b.t0) / 1000;
  let u = (b.x0 - XMIN + b.vx * s) % (2 * SPAN); if (u < 0) u += 2 * SPAN;
  return { x: XMIN + (u <= SPAN ? u : 2 * SPAN - u), y: b.y0 + b.vy * s, waiting: false };
}
const lineFor = (seat) => (seat === 'P1' ? P1_TOP - BALL_R : P2_BOT + BALL_R);
/** Server time when the ball reaches seat's paddle, or null if it is flying away from it. */
function arrival(b, seat) {
  if (seat === 'P1' ? b.vy <= 0 : b.vy >= 0) return null;
  return b.t0 + (lineFor(seat) - b.y0) / b.vy * 1000;
}
function hits(b, seat, px, tHit) { return Math.abs(ballAt(b, tHit).x - px) <= PADDLE_W / 2 + BALL_R; }
function bounceFrom(b, seat, px, tHit) {
  const p = ballAt(b, tHit), off = clamp((p.x - px) / (PADDLE_W / 2), -1, 1);
  const sp = clamp(Math.abs(b.vy) * 1.05, BASE_SPEED, MAX_SPEED);
  return { x0: Math.round(p.x * 10) / 10, y0: lineFor(seat), vx: Math.round(off * BASE_SPEED * 1.1), vy: seat === 'P1' ? -sp : sp, t0: Math.round(tHit) };
}
const other = (seat) => (seat === 'P1' ? 'P2' : 'P1');

// ---------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------
function buildInitialRoom() {
  return { createdAt: firebase.database.ServerValue.TIMESTAMP, mode: 'human', status: 'waiting', match: freshMatch(0), winner: null };
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
  if (mySeat === 'P1' || mySeat === 'P2') await selfRef.update({ paddleX: W / 2 });
  setupPresence(selfRef);
  myPaddleX = W / 2; handled = ''; match = null; shownSeq = -1; lastShown = null;

  if (mySeat === 'P2') {
    // second player: start the match (fresh serve on the shared clock)
    await roomRef.transaction((r) => {
      if (r && r.status === 'waiting') { r.status = 'playing'; r.mode = 'human'; r.winner = null; r.match = freshMatch(r.match && r.match.seq); }
      return r;
    });
    await quickMatch.clearIfMatches(roomCode);
  }

  attachListeners();
  bindControls();
  playersMap = (await playersRef.once('value')).val() || {};
  renderPlayers();

  shell.showGameScreen(roomCode);
  shell.setSoundIcon(sounds.enabled);
  sounds.playJoin();
  shell.toast(mySeat === 'spectator' ? "Both seats are taken — you're spectating." : `You're ${mySeat}`, 'info');

  running = true;
  lastFrameTime = performance.now();
  requestAnimationFrame(loop);
}

// Listen to the small parts separately: paddle moves no longer re-run the whole room.
function on(ref, fn) { ref.on('value', fn); listening.push(ref); }
function attachListeners() {
  on(roomRef.child('status'), (s) => { room.status = s.val() || 'waiting'; onRoom(); });
  on(roomRef.child('mode'), (s) => { room.mode = s.val() || 'human'; });
  on(roomRef.child('winner'), (s) => { room.winner = s.val(); onRoom(); });
  on(roomRef.child('match'), (s) => applyMatch(s.val()));

  on(playersRef, (snap) => {
    const players = snap.val() || {};
    playersMap = players;
    for (const p of Object.values(players)) {
      if ((p.seat === 'P1' || p.seat === 'P2') && p.seat !== mySeat && typeof p.paddleX === 'number') remoteX[p.seat] = p.paddleX;
    }
    const key = Object.entries(players).map(([id, p]) => id + p.seat + p.nickname).sort().join('|');
    if (key !== namesKey) { namesKey = key; renderPlayers(); }
  });

  playersRef.on('child_removed', (snap) => {
    const data = snap.val();
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

  playAgainBtn.onclick = () => {
    sounds.playClick();
    roomRef.update({ status: 'playing', winner: null, match: freshMatch(match && match.seq) });
  };
}

function onRoom() {
  handleStatusTransition();
  renderScoreboardAndStatus();
  handleMatchmakingCountdown();
}

function applyMatch(m) {
  if (!m || !m.ball) return;
  if (match && m.seq < match.seq) return;                      // older than what we already have
  const fresh = !match || m.seq !== match.seq;
  if (fresh && match && m.by && m.by !== mySeat && !(room.mode === 'bot' && m.by === 'P2' && mySeat === 'P1')) {
    if (m.miss) sounds.playWhoosh(); else sounds.playHit();   // the other end's hit / miss
  }
  match = m;
  renderScoreboardAndStatus();
}

/** Write the next match state, only if nobody else has written since `base` (seq check). */
function publish(base, patch, win) {
  const next = Object.assign({ by: '', miss: '', out: null }, base, patch, { seq: base.seq + 1 });
  if (!patch.miss) { next.miss = ''; next.out = null; }
  match = next;                                                 // show it right away on this phone
  roomRef.child('match').transaction((cur) => {
    if (cur && cur.seq !== base.seq) return;                     // someone was faster: keep theirs
    return next;
  }, (err, committed, snap) => {
    if (!committed && snap && snap.val()) { match = null; applyMatch(snap.val()); }
    else if (committed && win) roomRef.update({ status: 'finished', winner: win });
  }, false);
  renderScoreboardAndStatus();
}

/** Decide the ball at seat's end with paddle px (my own paddle, or the Computer's). */
function defend(seat, px) {
  const m = match;
  if (!m || room.status !== 'playing') return;
  const tHit = arrival(m.ball, seat);
  if (tHit == null || now() < tHit) return;
  const tag = m.seq + ':' + seat;
  if (handled === tag) return;
  handled = tag;
  if (hits(m.ball, seat, px, tHit)) {
    sounds.playHit();
    publish(m, { ball: bounceFrom(m.ball, seat, px, tHit), by: seat });
  } else {
    missAt(m, seat);
  }
}
function missAt(m, seat) {
  const win = other(seat), scores = { P1: (m.scores && m.scores.P1) || 0, P2: (m.scores && m.scores.P2) || 0 };
  scores[win] += 1;
  sounds.playWhoosh();
  const done = scores[win] >= WIN_SCORE ? win : null;
  // the next serve goes to the player who lost the point
  publish(m, { ball: serve(seat, OUT_MS + SERVE_MS), scores, by: seat, miss: seat, out: m.ball }, done);
}
/** The opponent's phone didn't answer for a while (asleep / background): award the point. */
function watchStall() {
  const m = match;
  if (!m || room.status !== 'playing' || room.mode === 'bot') return;
  const opp = other(mySeat), tHit = arrival(m.ball, opp);
  if (tHit == null || now() < tHit + STALL_MS) return;
  const tag = m.seq + ':stall';
  if (handled === tag) return;
  handled = tag;
  missAt(m, opp);
}

/** What to draw: the shared ball, the opponent's return predicted until their answer arrives. */
function displayBall(t) {
  const m = match;
  if (!m || room.status !== 'playing') return { x: W / 2, y: H / 2, waiting: true };
  if (m.out && t < m.ball.t0 - SERVE_MS) return ballAt(m.out, t);       // missed ball flying off the table
  let b = m.ball;
  const mine = (seat) => seat === mySeat || (room.mode === 'bot' && mySeat === 'P1');
  for (const seat of ['P1', 'P2']) {
    if (mine(seat)) continue;                                            // my end: decided exactly in defend()
    const tHit = arrival(b, seat);
    if (tHit != null && t > tHit) {
      const px = shownX[seat];
      if (hits(b, seat, px, tHit)) b = bounceFrom(b, seat, px, tHit);
      break;
    }
  }
  return ballAt(b, t);
}

function resetRoomForDisconnect() {
  roomRef.update({ status: 'waiting', winner: null, mode: 'human', match: freshMatch(match && match.seq) });
  if (playersMap.bot) playersRef.child('bot').remove();
}

function bindControls() {
  window.onkeydown = (e) => { keys[e.key.toLowerCase()] = true; };
  window.onkeyup = (e) => { keys[e.key.toLowerCase()] = false; };
  const follow = (e) => {
    if (mySeat !== 'P1' && mySeat !== 'P2') return;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (W / rect.width);
    const x = mySeat === 'P2' ? W - sx : sx;   // P2's view is turned round
    myPaddleX = clamp(x, PADDLE_W / 2, W - PADDLE_W / 2);
  };
  canvas.onpointerdown = follow;
  canvas.onpointermove = follow;
}

// paddle: only when it moved, at most every 40 ms (+ a final position after the last move)
let sentX = null, sendTimer = null, lastSend = 0;
function sendPaddle() {
  if (!selfRef || (mySeat !== 'P1' && mySeat !== 'P2')) return;
  const x = Math.round(myPaddleX * 10) / 10;
  if (x === sentX) return;
  const wait = PADDLE_SEND_MS - (performance.now() - lastSend);
  if (wait > 0) { if (!sendTimer) sendTimer = setTimeout(() => { sendTimer = null; sendPaddle(); }, wait); return; }
  lastSend = performance.now(); sentX = x;
  selfRef.update({ paddleX: x });
}
let botSent = 0;

function loop(frameTime) {
  if (!running) return;
  const dt = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
  lastFrameTime = frameTime;
  const t = now();

  if (mySeat === 'P1' || mySeat === 'P2') {
    const flip = mySeat === 'P2' ? -1 : 1;  // ← → follow the screen, not the world
    if (keys['arrowleft'] || keys['a']) myPaddleX = clamp(myPaddleX - flip * KEYBOARD_SPEED * dt, PADDLE_W / 2, W - PADDLE_W / 2);
    if (keys['arrowright'] || keys['d']) myPaddleX = clamp(myPaddleX + flip * KEYBOARD_SPEED * dt, PADDLE_W / 2, W - PADDLE_W / 2);
    sendPaddle();
    shownX[mySeat] = myPaddleX;
  }
  // opponent paddle glides to its latest position
  const k = 1 - Math.exp(-dt * 18);
  for (const seat of ['P1', 'P2']) if (seat !== mySeat) shownX[seat] += (remoteX[seat] - shownX[seat]) * k;

  if (room.mode === 'bot' && mySeat === 'P1' && match) {
    // the Computer follows the ball when it comes its way, with a little wobble so it can be beaten
    const bp = ballAt(match.ball, t);
    const target = match.ball.vy < 0 && !bp.waiting ? bp.x + Math.sin(frameTime / 420) * 24 : W / 2;
    botPaddleX = clamp(botPaddleX + clamp(target - botPaddleX, -BOT_SPEED * dt, BOT_SPEED * dt), PADDLE_W / 2, W - PADDLE_W / 2);
    shownX.P2 = botPaddleX;
    if (frameTime - botSent > 150 && playersMap.bot) { botSent = frameTime; playersRef.child('bot').update({ paddleX: Math.round(botPaddleX) }); }
  }

  // decide my end (and the Computer's end), and wake up a stalled game
  if (mySeat === 'P1' || mySeat === 'P2') {
    defend(mySeat, myPaddleX);
    if (room.mode === 'bot' && mySeat === 'P1') defend('P2', botPaddleX);
    watchStall();
  }

  // ball: blend small corrections when the real answer differs from the prediction
  const target = displayBall(t);
  if (match && match.seq !== shownSeq) {
    if (lastShown && !target.waiting && !lastShown.waiting) { smooth.x += lastShown.x - target.x; smooth.y += lastShown.y - target.y; }
    shownSeq = match.seq;
  }
  if (target.waiting || Math.hypot(smooth.x, smooth.y) > 90) smooth = { x: 0, y: 0 };
  const sk = Math.exp(-dt * 10); smooth.x *= sk; smooth.y *= sk;
  const bp = { x: target.x + smooth.x, y: target.y + smooth.y, waiting: target.waiting };
  lastShown = bp;
  if (bp.waiting) trail = []; else { trail.push({ x: bp.x, y: bp.y }); if (trail.length > 10) trail.shift(); }

  draw(bp, t);
  requestAnimationFrame(loop);
}

async function activateBot() {
  const txResult = await roomRef.transaction((r) => {
    if (!r) return r;
    if (r.status !== 'waiting') return;
    r.mode = 'bot';
    r.status = 'playing';
    r.winner = null;
    r.match = freshMatch(r.match && r.match.seq);
    r.players = r.players || {};
    r.players.bot = { nickname: 'Computer', seat: 'P2', joinedAt: Date.now(), paddleX: W / 2 };
    return r;
  });
  if (txResult.committed) await quickMatch.clearIfMatches(roomRef.key);
}

function handleMatchmakingCountdown() {
  const iAmWaitingAlone = mySeat === 'P1' && room.status === 'waiting';
  if (!iAmWaitingAlone) { stopMatchmakingCountdown(); return; }
  if (matchmakingInterval) return;
  matchmakingSecondsLeft = (window.kqBotWaitSeconds ? kqBotWaitSeconds() : MATCH_WAIT_SECONDS);   // admin: App settings -> Multiplayer
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

function handleStatusTransition() {
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
  running = false;
  stopMatchmakingCountdown();
  if (sendTimer) { clearTimeout(sendTimer); sendTimer = null; }
  if (selfRef) { selfRef.onDisconnect().cancel(); await selfRef.remove(); }
  listening.forEach((r) => r.off()); listening = [];
  if (playersRef) playersRef.off();
  playersMap = {};
  lastStatus = null;
  match = null;
  roomRef = null;
  shell.showLandingScreen();
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

canvas.width = W * DPR;
canvas.height = H * DPR;
const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };

function draw(ballPos, t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // table (symmetric, so it looks the same from both ends)
  ctx.fillStyle = '#1d4ed8'; rr(0, 0, W, H, 16); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; rr(8, 8, W - 16, H - 16, 10); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2, 8); ctx.lineTo(W / 2, H - 8); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(0, H / 2 - 3, W, 6);

  // everything below is drawn in world coordinates; P2 sees the table turned round
  if (mySeat === 'P2') { ctx.translate(W, H); ctx.rotate(Math.PI); }
  const meP1 = mySeat !== 'P2';   // spectators watch from P1's end
  drawPaddle(shownX.P1, P1_TOP, meP1 ? '#22c55e' : '#ef4444', true);
  drawPaddle(shownX.P2, EDGE, meP1 ? '#ef4444' : '#22c55e', false);

  trail.forEach((p, i) => { ctx.globalAlpha = (i / trail.length) * 0.4; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R * (i / trail.length), 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(ballPos.x + 5, ballPos.y + 6, BALL_R, BALL_R * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(ballPos.x - 3, ballPos.y - 3, 1, ballPos.x, ballPos.y, BALL_R);
  g.addColorStop(0, '#fff'); g.addColorStop(1, '#fdba74');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ballPos.x, ballPos.y, BALL_R, 0, Math.PI * 2); ctx.fill();

  // score (+ serve countdown) on the table while the ball waits (my score first)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (ballPos.waiting && room.status === 'playing' && match) {
    const sc = match.scores || {}, mine = mySeat === 'P2' ? 'P2' : 'P1';
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.font = '800 30px "Baloo 2", system-ui, sans-serif';
    ctx.fillText((sc[mine] || 0) + ' – ' + (sc[other(mine)] || 0), W / 2, H / 2 + 44);
    const left = (match.ball.t0 - t) / 1000;
    if (left > 0 && left < 1.2) { ctx.font = '700 16px "Baloo 2", system-ui, sans-serif'; ctx.fillText('Get ready…', W / 2, H / 2 - 22); }
  }
}

// y = the paddle's top edge (world). `near` = the paddle at the bottom end (its handle points down).
function drawPaddle(x, y, color, near) {
  ctx.fillStyle = 'rgba(0,0,0,.2)'; rr(x - PADDLE_W / 2 + 3, y + 4, PADDLE_W, PADDLE_T, 7); ctx.fill();
  ctx.fillStyle = '#92400e'; ctx.fillRect(x - 6, near ? y + PADDLE_T - 2 : y - 22, 12, 24);
  ctx.fillStyle = color; rr(x - PADDLE_W / 2, y, PADDLE_W, PADDLE_T, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.4)'; rr(x - PADDLE_W / 2 + 6, y + 3, PADDLE_W * 0.5, 4, 2); ctx.fill();
}

let lastBoard = '';
function renderScoreboardAndStatus() {
  const scores = (match && match.scores) || { P1: 0, P2: 0 };
  let text = '';
  if (room.status === 'waiting') text = 'Waiting for an opponent to join…';
  else if (room.status === 'playing') text = mySeat === 'spectator' ? 'Watching the rally…' : 'Move your paddle and defend!';
  else if (room.status === 'finished') {
    if (mySeat === room.winner) text = 'You win! 🎉';
    else if (mySeat === 'spectator') text = `${room.winner} wins!`;
    else text = 'You lost — play again?';
  }
  const key = [scores.P1, scores.P2, room.status, room.winner, text].join('|');
  if (key === lastBoard) return;                                 // nothing changed: no DOM work
  lastBoard = key;
  scoreP1.textContent = scores.P1 || 0;
  scoreP2.textContent = scores.P2 || 0;
  cardP1.classList.toggle('active-turn', room.status === 'playing');
  cardP2.classList.toggle('active-turn', room.status === 'playing');
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

// read-only peek for automated tests (no game effect)
window.__pongDebug = () => ({ mySeat, myPaddleX, shownX: { ...shownX }, ball: lastShown, seq: match && match.seq, scores: match && match.scores, status: room.status, mode: room.mode });

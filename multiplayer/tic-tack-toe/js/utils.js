/**
 * utils.js
 * -----------------------------------------------------------------------
 * Small dependency-free helpers shared across modules, plus a SoundManager
 * that synthesizes every sound effect with the Web Audio API — no binary
 * audio files needed.
 * -----------------------------------------------------------------------
 */

/** Generate a short, human-friendly random room code, e.g. "K3F9Q2". */
export function generateRoomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoids ambiguous O/0/I/1
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Generate a unique-enough client id (used as the Firebase player key). */
export function generatePlayerId() {
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Sanitize a nickname: trim, strip HTML, cap length. */
export function sanitizeNickname(name) {
  const clean = (name || '')
    .toString()
    .replace(/<[^>]*>?/gm, '')
    .trim()
    .slice(0, 14);
  return clean.length ? clean : 'Player' + Math.floor(Math.random() * 900 + 100);
}

/** All 8 winning line combinations for a 3x3 board, as index triples. */
export const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],           // diagonals
];

/**
 * Given a cells object/array (index -> '' | 'X' | 'O'), return
 * { winner: 'X'|'O'|null, line: [a,b,c]|null }.
 */
export function checkWinner(cells) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const v = cells[a];
    if (v && v === cells[b] && v === cells[c]) {
      return { winner: v, line };
    }
  }
  return { winner: null, line: null };
}

/** True if every one of the 9 cells is filled (used to detect a draw). */
export function isBoardFull(cells) {
  for (let i = 0; i < 9; i++) {
    if (!cells[i]) return false;
  }
  return true;
}

/**
 * SoundManager
 * Generates all game sound effects procedurally using Web Audio
 * oscillators + envelopes, so the game needs zero external audio files.
 */
export class SoundManager {
  constructor() {
    this.enabled = true;
    this.ctx = null; // created lazily on first user gesture (autoplay policies)
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setEnabled(value) {
    this.enabled = value;
  }

  _tone({ freq = 440, duration = 0.15, type = 'sine', gain = 0.2, slideTo = null, delay = 0 }) {
    if (!this.enabled) return;
    const ctx = this._ensureContext();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    const startTime = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(freq, startTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, startTime + duration);
    amp.gain.setValueAtTime(gain, startTime);
    amp.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  playPlaceX() {
    this._tone({ freq: 520, duration: 0.12, type: 'triangle', gain: 0.18 });
  }

  playPlaceO() {
    this._tone({ freq: 340, duration: 0.14, type: 'sine', gain: 0.18 });
  }

  playJoin() {
    this._tone({ freq: 440, slideTo: 660, duration: 0.18, type: 'triangle', gain: 0.15 });
  }

  playLeave() {
    this._tone({ freq: 440, slideTo: 220, duration: 0.2, type: 'triangle', gain: 0.12 });
  }

  playWin() {
    [523, 659, 784, 1046].forEach((f, i) => {
      this._tone({ freq: f, duration: 0.2, type: 'triangle', gain: 0.18, delay: i * 0.12 });
    });
  }

  playDraw() {
    this._tone({ freq: 300, slideTo: 260, duration: 0.4, type: 'sawtooth', gain: 0.14 });
  }

  playClick() {
    this._tone({ freq: 300, slideTo: 600, duration: 0.08, type: 'square', gain: 0.1 });
  }
}

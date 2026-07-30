/**
 * common/utils.js
 * -----------------------------------------------------------------------
 * Small dependency-free helpers shared by every game: room code / id
 * generation, nickname sanitizing + localStorage persistence, basic math,
 * and a procedural SoundManager (Web Audio — no binary audio files).
 * -----------------------------------------------------------------------
 */

const NICKNAME_STORAGE_KEY = 'arena-nickname';

/** Generate a short, human-friendly random room code, e.g. "K3F9Q2". */
export function generateRoomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoids ambiguous O/0/I/1
  let code = '';
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** Generate a unique-enough client id (used as a Firebase player key). */
export function generatePlayerId() {
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Sanitize a nickname: trim, strip HTML, cap length, fall back to a random default. */
export function sanitizeNickname(name) {
  const clean = (name || '')
    .toString()
    .replace(/<[^>]*>?/gm, '')
    .trim()
    .slice(0, 14);
  return clean.length ? clean : 'Player' + (Math.floor(Math.random() * 900) + 100);
}

/** Read a previously saved nickname from localStorage, or '' if none/unavailable. */
export function loadSavedNickname() {
  try {
    return localStorage.getItem(NICKNAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/** Persist a nickname to localStorage so the player doesn't retype it next time. */
export function saveNickname(name) {
  try {
    localStorage.setItem(NICKNAME_STORAGE_KEY, name);
  } catch {
    /* localStorage unavailable (private mode etc.) — non-fatal, just skip persisting */
  }
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Fisher-Yates shuffle, returns a new array (does not mutate input). */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Simple throttle: fires at most once per `ms`, always eventually fires with the latest args. */
export function throttle(fn, ms) {
  let last = 0;
  let timeout = null;
  let pendingArgs = null;
  return (...args) => {
    const now = performance.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      pendingArgs = args;
      if (!timeout) {
        timeout = setTimeout(() => {
          last = performance.now();
          timeout = null;
          fn(...pendingArgs);
        }, remaining);
      }
    }
  };
}

/**
 * SoundManager
 * Generates a small library of sound effects procedurally with the Web
 * Audio API — no binary audio files needed for any game.
 */
export class SoundManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this._pools = {};
    // Resolve common/sounds/*.mp3 relative to THIS module's own URL so it
    // works the same regardless of which game imported utils.js.
    this._soundBase = new URL('./sounds/', import.meta.url).href;
    ['click', 'join', 'leave', 'success', 'error', 'tick', 'countdown',
     'win', 'lose', 'draw', 'hit', 'splash', 'flip', 'blast', 'whoosh',
     'boing', 'drop', 'ding'].forEach((name) => this._makePool(name));
  }

  _makePool(name, size = 3) {
    const items = [];
    for (let i = 0; i < size; i++) {
      const a = new Audio(this._soundBase + name + '.mp3');
      a.preload = 'auto';
      a.volume = 0.85;
      items.push(a);
    }
    const pool = { items, i: 0, broken: false };
    items[0].addEventListener('error', () => { pool.broken = true; }, { once: true });
    this._pools[name] = pool;
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

  /** Plays a real mp3 sound effect; falls back to a synthesized tone if the
   *  file failed to load (offline, blocked request, etc). */
  _play(name, toneFallback) {
    if (!this.enabled) return;
    const pool = this._pools[name];
    if (pool && !pool.broken) {
      const el = pool.items[pool.i % pool.items.length];
      pool.i++;
      try {
        el.currentTime = 0;
        const p = el.play();
        if (p && p.catch) p.catch(() => { if (toneFallback) toneFallback(); });
      } catch (e) {
        if (toneFallback) toneFallback();
      }
      return;
    }
    if (toneFallback) toneFallback();
  }

  playClick() { this._play('click', () => this._tone({ freq: 300, slideTo: 600, duration: 0.08, type: 'square', gain: 0.1 })); }
  playJoin() { this._play('join', () => this._tone({ freq: 440, slideTo: 660, duration: 0.18, type: 'triangle', gain: 0.15 })); }
  playLeave() { this._play('leave', () => this._tone({ freq: 440, slideTo: 220, duration: 0.2, type: 'triangle', gain: 0.12 })); }
  playSuccess() { this._play('success', () => this._tone({ freq: 520, slideTo: 780, duration: 0.16, type: 'triangle', gain: 0.18 })); }
  playError() { this._play('error', () => this._tone({ freq: 220, slideTo: 140, duration: 0.22, type: 'sawtooth', gain: 0.15 })); }
  playTick() { this._play('tick', () => this._tone({ freq: 900, duration: 0.05, type: 'square', gain: 0.06 })); }
  playCountdown() { this._play('countdown', () => this._tone({ freq: 660, duration: 0.1, type: 'square', gain: 0.12 })); }
  playWin() {
    this._play('win', () => {
      [523, 659, 784, 1046].forEach((f, i) => this._tone({ freq: f, duration: 0.2, type: 'triangle', gain: 0.18, delay: i * 0.12 }));
    });
  }
  playLose() { this._play('lose', () => this._tone({ freq: 300, slideTo: 120, duration: 0.4, type: 'sawtooth', gain: 0.16 })); }
  playDraw() { this._play('draw', () => this._tone({ freq: 300, slideTo: 260, duration: 0.4, type: 'sawtooth', gain: 0.14 })); }
  playHit() { this._play('hit', () => this._tone({ freq: 180, duration: 0.18, type: 'square', gain: 0.2 })); }
  playSplash() { this._play('splash', () => this._tone({ freq: 700, slideTo: 300, duration: 0.15, type: 'sine', gain: 0.12 })); }

  /** New, game-flavored sound effects (card flips, explosions/pops,
   *  racing whooshes, springy bounces, disc drops, correct-answer dings). */
  playFlip() { this._play('flip', () => this._tone({ freq: 1400, duration: 0.05, type: 'sine', gain: 0.12 })); }
  playBlast() { this._play('blast', () => this._tone({ freq: 90, slideTo: 40, duration: 0.3, type: 'sawtooth', gain: 0.18 })); }
  playWhoosh() { this._play('whoosh', () => this._tone({ freq: 500, slideTo: 900, duration: 0.3, type: 'sine', gain: 0.1 })); }
  playBoing() { this._play('boing', () => this._tone({ freq: 500, slideTo: 180, duration: 0.28, type: 'sine', gain: 0.16 })); }
  playDrop() { this._play('drop', () => this._tone({ freq: 220, slideTo: 140, duration: 0.08, type: 'square', gain: 0.14 })); }
  playDing() { this._play('ding', () => this._tone({ freq: 1046, duration: 0.4, type: 'sine', gain: 0.16 })); }
}

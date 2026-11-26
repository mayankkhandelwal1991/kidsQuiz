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

/** Sanitize a nickname: first word, letters only, 12 max, fall back to a random default. */
export function sanitizeNickname(name) {
  // Children's app: a first name / nickname only — one word, letters only
  // (no numbers, emails, links or messages to other players).
  const clean = (name || '')
    .toString()
    .replace(/<[^>]*>?/gm, '')
    .trim()
    .split(/\s+/)[0]
    .replace(/[^\p{L}\p{M}'-]/gu, '')
    .slice(0, 12);
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
    // Guests: share the name with the rest of the app (quiz, leaderboard) too.
    if (name && !localStorage.getItem('kq_cached_auth')) localStorage.setItem('kq_nick', name);
  } catch {
    /* localStorage unavailable (private mode etc.) — non-fatal, just skip persisting */
  }
}

/** Fit a full name into the 14-char nickname limit ("Mayank Khandelwal" -> "Mayank"). */
function shortName(name) {
  const n = (name || '').toString().replace(/<[^>]*>?/gm, '').trim();
  if (n.length <= 14) return n;
  return (n.split(/\s+/)[0] || n).slice(0, 14);
}

/**
 * The name the kid already gave the app: Google sign-in name first,
 * then the name typed in the quiz / an earlier game. '' if none.
 */
export function knownPlayerName() {
  try {
    const auth = JSON.parse(localStorage.getItem('kq_cached_auth') || 'null');
    if (auth && auth.name && auth.name !== 'Player') return shortName(auth.name);
    return shortName(localStorage.getItem('kq_nick') || '');
  } catch {
    return '';
  }
}

/**
 * When the player's name is already known, hide the nickname box and show
 * "Playing as <name> · Change" instead. The input keeps the name as its value,
 * so the games' existing Play / Join handlers keep reading it from there.
 */
export function useKnownName(input) {
  if (!input) return;
  const field = input.closest('.field') || input.parentElement;
  if (!field) return;

  if (!document.getElementById('known-name-style')) {
    const st = document.createElement('style');
    st.id = 'known-name-style';
    st.textContent =
      '.known-name{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;' +
      'padding:10px 14px;margin-bottom:16px;border-radius:14px;background:#eef4ff;border:2px solid #cfe0ff;' +
      'font-weight:700;color:#1e3a8a;font-size:1rem}' +
      '.known-name b{color:#1d4ed8}' +
      '.known-name button{border:0;background:none;color:#2563eb;font:inherit;font-size:.9rem;' +
      'text-decoration:underline;cursor:pointer;padding:2px 4px}';
    document.head.appendChild(st);
  }

  let chip = null;
  let editing = false;
  const show = (name) => {
    if (!name || editing) return;
    input.value = name;
    if (!chip) {
      chip = document.createElement('div');
      chip.className = 'known-name';
      chip.innerHTML = '<span>🙂 Playing as <b></b></span><button type="button">Change</button>';
      chip.querySelector('button').addEventListener('click', () => {
        editing = true;
        chip.remove();
        field.style.display = '';
        input.focus();
        input.select();
      });
      field.parentNode.insertBefore(chip, field);
    }
    chip.querySelector('b').textContent = name;
    field.style.display = 'none';
  };

  show(knownPlayerName() || loadSavedNickname());

  // Google sign-in can finish after the page loads — pick the name up then.
  try {
    if (window.KQ && typeof window.KQ.onAuth === 'function') {
      window.KQ.onAuth((u) => { if (u && !u.isGuest && u.name) show(shortName(u.name)); });
    }
  } catch {
    /* KQ not available on this page — the stored name is enough */
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
    // Sounds are decoded once into Web Audio buffers (not 3 <audio> players
    // per sound = ~54 media players per page, which stutters on Android).
    this._buffers = {};
    setTimeout(() => ['click', 'join', 'leave', 'success', 'error', 'tick', 'countdown',
      'win', 'lose', 'draw', 'hit', 'splash', 'flip', 'blast', 'whoosh',
      'boing', 'drop', 'ding'].forEach((name) => this._load(name)), 600);
  }

  _load(name) {
    if (this._buffers[name]) return;
    let ctx;
    try { ctx = this._ensureContext(); } catch (e) { this._buffers[name] = 'broken'; return; }
    this._buffers[name] = 'loading';
    fetch(this._soundBase + name + '.mp3')
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then((buf) => { this._buffers[name] = buf; })
      .catch(() => { this._buffers[name] = 'broken'; });
  }

  _makePool(name, size = 2) {
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
    const buf = this._buffers[name];
    if (buf && typeof buf === 'object') {
      try {
        const ctx = this._ensureContext();
        if (!this._out) { this._out = ctx.createGain(); this._out.gain.value = 0.85; this._out.connect(ctx.destination); }
        const src = ctx.createBufferSource(); src.buffer = buf; src.connect(this._out); src.start();
        return;
      } catch (e) { /* fall through */ }
    }
    if (buf === 'broken') {   // no fetch/decoding (e.g. file://): a small <audio> pool
      if (!this._pools[name]) this._makePool(name);
      const pool = this._pools[name];
      if (!pool.broken) {
        const el = pool.items[pool.i++ % pool.items.length];
        try { el.currentTime = 0; const p = el.play(); if (p && p.catch) p.catch(() => { if (toneFallback) toneFallback(); }); return; } catch (e) { /* tone */ }
      }
    } else if (!buf) this._load(name);
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
    try { if (window.KQEnd) KQEnd.show('win'); } catch (e) {}
    this._play('win', () => {
      [523, 659, 784, 1046].forEach((f, i) => this._tone({ freq: f, duration: 0.2, type: 'triangle', gain: 0.18, delay: i * 0.12 }));
    });
  }
  playLose() { try { if (window.KQEnd) KQEnd.show('lose'); } catch (e) {} this._play('lose', () => this._tone({ freq: 300, slideTo: 120, duration: 0.4, type: 'sawtooth', gain: 0.16 })); }
  playDraw() { try { if (window.KQEnd) KQEnd.show('over'); } catch (e) {} this._play('draw', () => this._tone({ freq: 300, slideTo: 260, duration: 0.4, type: 'sawtooth', gain: 0.14 })); }
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

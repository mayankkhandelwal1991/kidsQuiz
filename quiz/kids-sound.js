/* ============================================================
   KIDS SOUND — themed sound effects made in code (Web Audio),
   so there are no files to download and it works offline.

   Each level has its own sound world:
     LKG       'toybox'  — bubble pops + toy xylophone
     UKG       'jungle'  — wooden marimba + little bird chirps
     Class 1–2 'arcade'  — happy chiptune coins
     Class 3–5 'space'   — soft synth sweeps + sparkles

   KidSound.setTheme(name)
   KidSound.tap() / count(n) / correct() / wrong() / finish(stars) / star(i)
   Respects the app-wide mute key (localStorage kq_muted = '1').
   ============================================================ */
(function () {
  'use strict';
  let ctx = null, theme = 'toybox';
  const muted = () => { try { return localStorage.getItem('kq_muted') === '1'; } catch (e) { return false; } };
  function ac() {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // one note: frequency, start offset (s), length (s), wave, volume, optional slide target
  function note(f, at, len, wave, vol, slide) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + (at || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = wave || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + len + 0.03);
  }
  // instruments
  const xylo = (f, at) => { note(f, at, 0.45, 'sine', 0.2); note(f * 4, at, 0.08, 'sine', 0.05); };
  const marimba = (f, at) => { note(f, at, 0.35, 'sine', 0.22); note(f * 2.01, at, 0.12, 'triangle', 0.06); };
  const chip = (f, at, len) => note(f, at, len || 0.09, 'square', 0.07);
  const bell = (f, at) => { note(f, at, 0.9, 'sine', 0.12); note(f * 2.76, at, 0.4, 'sine', 0.04); };
  const bubble = (at) => note(380, at, 0.12, 'sine', 0.2, 900);
  const chirp = (at) => { note(2400, at, 0.07, 'sine', 0.06, 3400); note(2600, at + 0.09, 0.07, 'sine', 0.06, 3800); };
  const sparkle = (at) => [2093, 2637, 3136].forEach((f, i) => note(f, (at || 0) + i * 0.05, 0.25, 'sine', 0.035));

  const C_MAJ = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1174.66, 1318.5, 1396.9, 1568, 1760, 1975.5, 2093, 2349.3, 2637, 2793.8, 3136, 3520];
  const PENTA = [392, 440, 523.25, 587.33, 659.25, 784, 880, 1046.5, 1174.66, 1318.5, 1568, 1760, 2093, 2349.3, 2637, 3136, 3520, 4186, 4698, 5274];

  const THEMES = {
    toybox: {
      tap: () => bubble(0),
      count: (n) => xylo(C_MAJ[Math.min(n - 1, C_MAJ.length - 1)], 0),
      correct: () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => xylo(f, i * 0.09)); bubble(0.4); },
      wrong: () => { note(440, 0, 0.25, 'sine', 0.12, 300); note(330, 0.2, 0.3, 'sine', 0.1, 260); },
      finish: () => { [783.99, 659.25, 783.99, 1046.5, 987.77, 1046.5, 1318.5].forEach((f, i) => xylo(f, i * 0.13)); sparkle(0.95); },
      star: (i) => xylo([1046.5, 1318.5, 1568][i] || 1568, 0),
    },
    jungle: {
      tap: () => marimba(784, 0),
      count: (n) => marimba(PENTA[Math.min(n - 1, PENTA.length - 1)], 0),
      correct: () => { [523.25, 659.25, 784, 1046.5].forEach((f, i) => marimba(f, i * 0.08)); chirp(0.38); },
      wrong: () => { marimba(330, 0); marimba(262, 0.16); },
      finish: () => { [523.25, 659.25, 784, 659.25, 784, 1046.5, 1318.5].forEach((f, i) => marimba(f, i * 0.12)); chirp(0.9); chirp(1.1); },
      star: (i) => marimba([784, 1046.5, 1318.5][i] || 1318.5, 0),
    },
    arcade: {
      tap: () => chip(1200, 0, 0.04),
      count: (n) => chip(C_MAJ[Math.min(n - 1, C_MAJ.length - 1)], 0, 0.08),
      correct: () => { chip(988, 0, 0.07); chip(1319, 0.07, 0.14); },
      wrong: () => { note(220, 0, 0.18, 'square', 0.06, 150); },
      finish: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => chip(f, i * 0.09, 0.12)); },
      star: (i) => { chip([988, 1175, 1319][i] || 1319, 0, 0.1); chip(([988, 1175, 1319][i] || 1319) * 1.5, 0.08, 0.12); },
    },
    space: {
      tap: () => note(880, 0, 0.08, 'triangle', 0.08, 1320),
      count: (n) => note(C_MAJ[Math.min(n - 1, C_MAJ.length - 1)], 0, 0.2, 'triangle', 0.1),
      correct: () => { note(660, 0, 0.25, 'triangle', 0.12, 1320); sparkle(0.12); },
      wrong: () => { note(300, 0, 0.3, 'triangle', 0.1, 180); },
      finish: () => { [523, 784, 1047, 1568].forEach((f, i) => bell(f, i * 0.15)); sparkle(0.7); },
      star: (i) => bell([1047, 1319, 1568][i] || 1568, 0),
    },
  };
  function run(fn, arg) { if (muted()) return; try { THEMES[theme][fn](arg); } catch (e) {} }

  window.KidSound = {
    themeForLevel(level) { level = parseInt(level, 10); return level === 0 ? 'toybox' : level === -1 ? 'jungle' : level <= 2 ? 'arcade' : 'space'; },
    setTheme(t) { if (THEMES[t]) theme = t; },
    unlock() { ac(); },
    tap: () => run('tap'), count: (n) => run('count', n), correct: () => run('correct'),
    wrong: () => run('wrong'), finish: () => run('finish'), star: (i) => run('star', i),
  };
})();

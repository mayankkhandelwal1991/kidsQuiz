/* ============================================================
   KQChant — cheerful sing-along backing music, made live with Web Audio
   (original music, no files). Used for rhymes (stories/index.html) and the
   times-tables chant (games/brain/times_tables.html).

     KQChant.start({ seed: 'twinkle', style: 'nursery' | 'hindi' | 'tables', bpm })
     KQChant.stop()            fade out now
     KQChant.outro()           a happy little ending, then stop
     KQChant.duck(true|false)  softer while a line is spoken
     KQChant.waitBeat(cb, n)   call cb on the next group of n beats (default 2),
                               so lines start on the beat like a song
     KQChant.playing()

   Each seed gets its own key, tempo, chords and tune, so every rhyme sounds
   different. Hindi style: dholak-like drums and a flute tune. Respects
   kq_muted. Quiet during ads (kq-leaderboard.js suspends Web Audio).
   ============================================================ */
(function () {
  'use strict';
  if (window.KQChant) return;
  var AC = null, master = null, on = false, timer = null, cfg = null, t0 = 0, nextBeat = 0, beatLen = 0.6, rnd = Math.random;
  var song = null, ducked = false, waits = [];
  function muted() { try { return localStorage.getItem('kq_muted') === '1'; } catch (e) { return false; } }
  function hash(s) { var h = 2166136261; s = String(s || 'kq'); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed || 1; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var pick = function (a) { return a[Math.floor(rnd() * a.length)]; };
  var hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  /* ---------------- instruments ---------------- */
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function osc(type, f, t, dur, peak, a, dest, detune) {
    var o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
    env(g, t, a || 0.005, peak, dur); o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + (a || 0.005) + dur + 0.05); return o;
  }
  var noiseBuf = null;
  function noise(t, dur, peak, type, freq, q) {
    if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    env(g, t, 0.002, peak, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
  }
  var I = {
    xylo: function (m, t, v) { osc('sine', hz(m), t, 0.55, 0.20 * v); osc('sine', hz(m) * 4.0, t, 0.08, 0.05 * v); },
    bell: function (m, t, v) { osc('sine', hz(m), t, 0.9, 0.12 * v); osc('sine', hz(m) * 2.76, t, 0.25, 0.03 * v); },
    flute: function (m, t, v, len) {
      var o = AC.createOscillator(), g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain();
      o.type = 'sine'; o.frequency.value = hz(m); lfo.frequency.value = 5.5; lg.gain.value = hz(m) * 0.012; lfo.connect(lg); lg.connect(o.frequency);
      var d = Math.max(0.2, len * 0.9); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13 * v, t + 0.05); g.gain.setValueAtTime(0.13 * v, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
    },
    bass: function (m, t, len) { osc('triangle', hz(m), t, Math.min(0.5, len), 0.30); },
    pluck: function (ms, t) { ms.forEach(function (m, i) { osc('triangle', hz(m), t + i * 0.012, 0.22, 0.045); }); },
    kick: function (t) { var o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); env(g, t, 0.003, 0.5, 0.16); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25); },
    clap: function (t) { noise(t, 0.09, 0.16, 'bandpass', 1400, 0.8); noise(t + 0.012, 0.07, 0.10, 'bandpass', 1800, 0.8); },
    shaker: function (t, v) { noise(t, 0.035, 0.05 * (v || 1), 'highpass', 6500); },
    // dholak: low "dha", high "na", small "ti"
    dha: function (t) { var o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(105, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25); env(g, t, 0.004, 0.45, 0.3); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4); noise(t, 0.04, 0.06, 'lowpass', 900); },
    na: function (t) { osc('sine', 340, t, 0.12, 0.16); noise(t, 0.05, 0.09, 'bandpass', 2600, 2); },
    ti: function (t) { osc('sine', 520, t, 0.06, 0.07); noise(t, 0.03, 0.05, 'bandpass', 3800, 2); }
  };

  /* ---------------- a song for this seed ---------------- */
  var PROGS = [[0, 7, 9, 5], [0, 5, 7, 0], [0, 9, 5, 7], [0, 5, 0, 7], [0, 7, 5, 7]];   // I V vi IV, I IV V I …
  var MAJ = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
  function chordOf(root) { return root === 9 ? [9, 12, 16] : [root, root + 4, root + 7]; }   // vi is minor
  function makeSong(c) {
    rnd = rng(hash(c.seed));
    var key = 60 + pick([0, 2, 3, 5, 7, -3, -2]);
    var style = c.style || 'nursery';
    var bpm = c.bpm || (style === 'hindi' ? 92 + Math.floor(rnd() * 14) : style === 'tables' ? 108 + Math.floor(rnd() * 8) : 98 + Math.floor(rnd() * 18));
    var prog = pick(PROGS);
    // a catchy 2-bar tune, repeated with a small change: A A' (in steps of the scale; null = rest)
    var mot = [], last = pick([2, 4, 7]);
    for (var k = 0; k < 8; k++) {
      if (k % 4 === 3 && rnd() < 0.55) { mot.push(null); continue; }
      last = Math.max(0, Math.min(9, last + pick([-2, -1, -1, 0, 1, 1, 2]))); mot.push(last);
    }
    var mot2 = mot.slice(0, 6).concat([pick([4, 2, 7]), null]);
    return { key: key, bpm: bpm, prog: prog, tune: mot.concat(mot2), style: style, lead: style === 'hindi' ? 'flute' : pick(['xylo', 'xylo', 'bell']) };
  }

  /* ---------------- scheduler (beats, a little ahead of time) ---------------- */
  var beatNo = 0;
  function playBeat(b, t) {
    var s = song, bar = Math.floor(b / 4), bt = b % 4, root = s.prog[bar % 4], ch = chordOf(root).map(function (n) { return s.key + n; });
    var intro = b < 4, v = ducked ? 0.55 : 1;
    // bass: 1 and 3 (root, fifth)
    if (bt === 0) I.bass(s.key - 24 + root, t, beatLen * 1.6); else if (bt === 2) I.bass(s.key - 24 + root + 7, t, beatLen * 1.4);
    if (s.style === 'hindi') {
      // dholak: dha . na dha | na . ti na
      var pat = [['dha', 0], ['na', 0.5], ['dha', 0.75], ['na', 1], ['ti', 1.5], ['na', 1.75]];
      if (bt % 2 === 0) pat.forEach(function (p) { I[p[0]](t + p[1] * beatLen); });
      if (bt === 1 || bt === 3) I.pluck(ch.map(function (n) { return n + 12; }), t);
    } else {
      if (bt === 0 || bt === 2) I.kick(t);
      if (bt === 1 || bt === 3) { I.clap(t); I.pluck(ch.map(function (n) { return n + 12; }), t); }
      I.shaker(t, 1); I.shaker(t + beatLen / 2, 0.6);
    }
    // tune (two notes per beat, from the tune; quieter while a line is spoken)
    if (!intro || bt >= 2) {
      for (var h = 0; h < 2; h++) {
        var step = s.tune[((bar % 2) * 8 + bt * 2 + h) % 16];
        if (step == null) continue;
        var m = s.key + 12 + MAJ[step];
        if (s.lead === 'flute') { if (h === 0) I.flute(m, t, v * 0.9, beatLen); }
        else I[s.lead](m, t + h * beatLen / 2, v * 0.8);
      }
    }
  }
  function pump() {
    if (!on || !AC) return;
    while (nextBeat < AC.currentTime + 0.25) {
      playBeat(beatNo, nextBeat);
      beatNo++; nextBeat += beatLen;
    }
    // waiting lines: start them on their beat
    var now = AC.currentTime, due = waits.filter(function (w) { return now >= w.at - 0.03; });
    if (due.length) { waits = waits.filter(function (w) { return due.indexOf(w) < 0; }); due.forEach(function (w) { try { w.cb(); } catch (e) {} }); }
  }

  function start(c) {
    c = c || {};
    if (on && cfg && cfg.seed === c.seed && cfg.style === c.style) return;   // already playing this song
    stop(true);
    if (muted()) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
    } catch (e) { AC = null; return; }
    cfg = c; song = makeSong(c); beatLen = 60 / song.bpm; beatNo = 0;
    master = AC.createGain(); master.gain.value = 0.0001; master.connect(AC.destination);
    master.gain.exponentialRampToValueAtTime(c.vol || 0.5, AC.currentTime + 0.4);
    t0 = nextBeat = AC.currentTime + 0.08; on = true; ducked = false;
    timer = setInterval(pump, 25); pump();
  }
  function stop(now) {
    var w0 = waits; waits = []; w0.forEach(function (w) { try { w.cb(); } catch (e) {} });
    clearInterval(timer); timer = null;
    if (!on) return; on = false;
    var m = master; master = null;
    try { if (m && AC) { m.gain.cancelScheduledValues(AC.currentTime); m.gain.setValueAtTime(m.gain.value || 0.3, AC.currentTime); m.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + (now ? 0.15 : 0.6)); setTimeout(function () { try { m.disconnect(); } catch (e) {} }, 900); } } catch (e) {}
  }
  function outro() {
    if (!on || !AC) return;
    var s = song, t = Math.max(AC.currentTime + 0.05, nextBeat);
    clearInterval(timer); timer = null; var w0 = waits; waits = []; w0.forEach(function (w) { try { w.cb(); } catch (e) {} });
    [0, 4, 7, 12].forEach(function (n, i) { I[s.lead === 'flute' ? 'bell' : s.lead](s.key + 12 + n, t + i * beatLen / 2, 1); });
    I.bass(s.key - 24, t + 2 * beatLen, 1.2); I.pluck([s.key, s.key + 4, s.key + 7, s.key + 12], t + 2 * beatLen);
    if (s.style === 'hindi') I.dha(t + 2 * beatLen); else { I.kick(t + 2 * beatLen); I.clap(t + 2 * beatLen); }
    on = false; var m = master; master = null;
    setTimeout(function () { try { m.disconnect(); } catch (e) {} }, (3 * beatLen + 1.5) * 1000);
  }
  function duck(d) {
    ducked = !!d;
    try { if (master && AC) { var g = master.gain; g.cancelScheduledValues(AC.currentTime); g.setValueAtTime(Math.max(0.0001, g.value), AC.currentTime); g.linearRampToValueAtTime((cfg && cfg.vol || 0.5) * (d ? 0.45 : 1), AC.currentTime + 0.25); } } catch (e) {}
  }
  // run cb on the next group of n beats (counted from the start, after the 1-bar intro)
  function waitBeat(cb, n) {
    if (!on || !AC || AC.state !== 'running') { setTimeout(cb, 0); return; }
    n = n || 2;
    var first = t0 + 4 * beatLen, now = AC.currentTime + 0.05;
    var k = Math.max(0, Math.ceil((now - first) / (n * beatLen)));
    waits.push({ at: first + k * n * beatLen, cb: cb });
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(true); });
  window.addEventListener('pagehide', function () { stop(true); });

  window.KQChant = { start: start, stop: stop, outro: outro, duck: duck, waitBeat: waitBeat, playing: function () { return on; }, beatMs: function () { return beatLen * 1000; } };
})();

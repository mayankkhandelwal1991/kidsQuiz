/* ============================================================
   KQEnd — end-of-game animations (win / game over / lose)
   ------------------------------------------------------------
   KQEnd.show('win' | 'over' | 'lose' [, { anim: name }])  -> name played
   KQEnd.list -> { win: [...], over: [...], lose: [...] }

   17 different full-screen animations + a bouncy banner word with
   5 different entrances. A different animation is picked every time
   (never the same one twice in a row for the same mood).
   Lose animations are gentle and friendly — the audience is kids.
   Loaded on every page by kq-leaderboard.js; no other dependencies.
   ============================================================ */
(function () {
  'use strict';
  if (window.KQEnd) return;

  var SRC = (document.currentScript && document.currentScript.src) || '';
  var EMOJI_DIR = SRC ? SRC.replace(/[^/]*$/, '') + '../images/emoji/' : 'images/emoji/';
  var COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'];
  var R = Math.random, PI2 = Math.PI * 2;
  var rnd = function (a, b) { return a + R() * (b - a); };
  var pick = function (a) { return a[Math.floor(R() * a.length)]; };

  /* ---------- emoji images (same SVG set the app uses) ---------- */
  var imgs = {};
  function emojiImg(e) {
    if (imgs[e]) return imgs[e];
    var cps = [];
    for (var i = 0; i < e.length; i++) { var c = e.codePointAt(i); if (c > 0xffff) i++; if (c !== 0xfe0f) cps.push(c.toString(16)); }
    var im = new Image(); im.src = EMOJI_DIR + cps.join('-') + '.svg';
    imgs[e] = im; return im;
  }
  // SVGs are rasterised once per size into a bitmap: drawing SVG every frame is slow and flickers on Android WebView
  var bmps = {}, DPR = Math.min(window.devicePixelRatio || 1, 2);
  function bitmap(e, im, s) {
    var px = s * DPR, b = px <= 48 ? 48 : px <= 96 ? 96 : px <= 160 ? 160 : px <= 256 ? 256 : 384, k = e + '@' + b;
    if (!bmps[k]) { var c = document.createElement('canvas'); c.width = c.height = b; try { c.getContext('2d').drawImage(im, 0, 0, b, b); } catch (err) { return im; } bmps[k] = c; }
    return bmps[k];
  }
  function drawEmoji(g, e, x, y, s, rot) {
    var im = emojiImg(e);
    g.save(); g.translate(x, y); if (rot) g.rotate(rot);
    if (im.complete && im.naturalWidth) g.drawImage(bitmap(e, im, s), -s / 2, -s / 2, s, s);
    else { g.font = Math.round(s * 0.85) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 0, 0); }
    g.restore();
  }

  /* ---------- shape helpers ---------- */
  function star(g, x, y, r, rot, col) {
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.beginPath();
    for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = col; g.fill(); g.restore();
  }
  function heart(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 30, s / 30); g.beginPath();
    g.moveTo(0, 9); g.bezierCurveTo(-16, -2, -10, -16, 0, -8); g.bezierCurveTo(10, -16, 16, -2, 0, 9);
    g.fillStyle = col; g.fill(); g.restore();
  }
  function drop(g, x, y, s) {
    g.save(); g.translate(x, y); g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * 0.7, s * 0.2, 0, s * 0.6); g.quadraticCurveTo(-s * 0.7, s * 0.2, 0, -s);
    g.fillStyle = 'rgba(96,165,250,.85)'; g.fill(); g.restore();
  }

  /* ---------- the animations ----------
     each: function (W, H, u) -> { step(g, t, dt) }   (u = 1 css px in canvas px) */
  var A = {};

  // WIN 1 — confetti cannons from both bottom corners
  A.cannons = function (W, H, u) {
    var p = [];
    [0, 1].forEach(function (side) {
      for (var i = 0; i < 70; i++) {
        var ang = side ? rnd(-2.35, -1.75) : rnd(-1.4, -0.8), sp = rnd(700, 1300) * u;
        p.push({ x: side ? W : 0, y: H, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, w: rnd(6, 12) * u, h: rnd(10, 18) * u, r: R() * 6, vr: rnd(-12, 12), c: pick(COLORS), d: rnd(0, 0.25) });
      }
    });
    return { step: function (g, t, dt) {
      p.forEach(function (q) {
        if (t < q.d) return;
        q.vy += 900 * u * dt; q.vx *= 0.985; q.vy *= 0.985; q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt;
        g.save(); g.translate(q.x, q.y); g.rotate(q.r); g.scale(1, Math.cos(q.r * 1.7)); g.fillStyle = q.c; g.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); g.restore();
      });
    } };
  };

  // WIN 2 — fireworks
  A.fireworks = function (W, H, u) {
    var rockets = [], sparks = [];
    for (var i = 0; i < 6; i++) rockets.push({ x: rnd(0.15, 0.85) * W, y: H, ty: rnd(0.15, 0.45) * H, vy: -rnd(900, 1200) * u, t0: i * 0.35, c: pick(COLORS), done: false });
    return { step: function (g, t, dt) {
      rockets.forEach(function (r) {
        if (t < r.t0 || r.done) return;
        r.y += r.vy * dt;
        g.fillStyle = '#fff7'; g.fillRect(r.x - 2 * u, r.y, 4 * u, 18 * u);
        if (r.y <= r.ty) {
          r.done = true;
          for (var k = 0; k < 46; k++) { var a = k / 46 * PI2, s = rnd(220, 420) * u; sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 1, c: k % 3 ? r.c : '#fff' }); }
        }
      });
      sparks.forEach(function (s) {
        s.vy += 260 * u * dt; s.vx *= 0.97; s.vy *= 0.97; s.x += s.vx * dt; s.y += s.vy * dt; s.l -= dt * 0.75;
        if (s.l <= 0) return;
        g.globalAlpha = Math.max(0, s.l); g.fillStyle = s.c; g.beginPath(); g.arc(s.x, s.y, 3.2 * u, 0, PI2); g.fill(); g.globalAlpha = 1;
      });
    } };
  };

  // WIN 3 — balloons float up
  A.balloons = function (W, H, u) {
    var b = [];
    for (var i = 0; i < 16; i++) b.push({ x: rnd(0.05, 0.95) * W, y: H + rnd(40, 420) * u, s: rnd(56, 90) * u, vy: rnd(260, 420) * u, ph: R() * 6 });
    return { step: function (g, t) {
      b.forEach(function (q) {
        var y = q.y - q.vy * t, x = q.x + Math.sin(t * 2 + q.ph) * 24 * u;
        g.strokeStyle = '#9ca3af'; g.lineWidth = 1.5 * u; g.beginPath(); g.moveTo(x, y + q.s * 0.45); g.quadraticCurveTo(x + 10 * u, y + q.s, x, y + q.s * 1.5); g.stroke();
        drawEmoji(g, '🎈', x, y, q.s, Math.sin(t * 2 + q.ph) * 0.12);
      });
    } };
  };

  // WIN 4 — golden star shower
  A.starshower = function (W, H, u) {
    var s = [];
    for (var i = 0; i < 70; i++) s.push({ x: R() * W, y: -rnd(0, H), r: rnd(8, 20) * u, vy: rnd(240, 480) * u, rot: R() * 6, vr: rnd(-4, 4), c: pick(['#facc15', '#fde047', '#f59e0b', '#fff']) });
    return { step: function (g, t, dt) {
      s.forEach(function (q) { q.y += q.vy * dt; q.rot += q.vr * dt; g.globalAlpha = 0.7 + 0.3 * Math.sin(t * 10 + q.x); star(g, q.x, q.y, q.r, q.rot, q.c); });
      g.globalAlpha = 1;
    } };
  };

  // WIN 5 — big trophy with spinning light rays
  A.trophy = function (W, H, u) {
    var cx = W / 2, cy = H * 0.42, sp = [];
    for (var i = 0; i < 30; i++) sp.push({ a: R() * PI2, d: rnd(90, 220) * u, s: rnd(10, 22) * u, p: R() * 6 });
    return { step: function (g, t) {
      var k = Math.min(1, t / 0.5), sc = k < 1 ? 1.25 * Math.sin(k * Math.PI / 2) : 1 + Math.sin(t * 4) * 0.04;
      g.save(); g.translate(cx, cy); g.rotate(t * 0.6);
      for (var i = 0; i < 12; i++) { g.rotate(PI2 / 12); g.fillStyle = i % 2 ? 'rgba(253,224,71,.28)' : 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-40 * u, -Math.max(W, H)); g.lineTo(40 * u, -Math.max(W, H)); g.fill(); }
      g.restore();
      drawEmoji(g, '🏆', cx, cy, 170 * u * sc);
      sp.forEach(function (q) { if (t < 0.4) return; var a = q.a + t * 0.8; g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8 + q.p); drawEmoji(g, '✨', cx + Math.cos(a) * q.d, cy + Math.sin(a) * q.d, q.s); });
      g.globalAlpha = 1;
    } };
  };

  // WIN 6 — coin fountain
  A.coins = function (W, H, u) {
    var c = [];
    for (var i = 0; i < 60; i++) c.push({ x: W / 2, y: H, vx: rnd(-420, 420) * u, vy: -rnd(900, 1400) * u, s: rnd(30, 46) * u, d: i * 0.03, ph: R() * 6 });
    return { step: function (g, t, dt) {
      c.forEach(function (q) {
        if (t < q.d) return;
        q.vy += 1300 * u * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        g.save(); g.translate(q.x, q.y); g.scale(Math.abs(Math.cos(t * 9 + q.ph)) * 0.9 + 0.1, 1); drawEmoji(g, '🪙', 0, 0, q.s); g.restore();
      });
    } };
  };

  // WIN 7 — rainbow arc painting across + sparkles
  A.rainbow = function (W, H, u) {
    var cx = W / 2, cy = H * 0.62, R0 = Math.min(W, H * 1.4) * 0.42, band = 16 * u, cols = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'], sp = [];
    return { step: function (g, t, dt) {
      var k = Math.min(1, t / 1.1), end = Math.PI + Math.PI * k;
      g.lineCap = 'round';
      cols.forEach(function (c, i) { g.strokeStyle = c; g.lineWidth = band; g.beginPath(); g.arc(cx, cy, R0 - i * band, Math.PI, end); g.stroke(); });
      if (k < 1 || R() < 0.5) sp.push({ x: cx + Math.cos(end) * (R0 - band * 2.5), y: cy + Math.sin(end) * (R0 - band * 2.5), vy: rnd(-60, 60) * u, vx: rnd(-60, 60) * u, l: 1, s: rnd(14, 26) * u });
      sp.forEach(function (q) { q.l -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.l > 0) { g.globalAlpha = q.l; drawEmoji(g, '✨', q.x, q.y, q.s); } });
      g.globalAlpha = 1;
      drawEmoji(g, '☁️', cx - R0 + band * 2.5, cy + 10 * u, 90 * u); if (k >= 1) drawEmoji(g, '☁️', cx + R0 - band * 2.5, cy + 10 * u, 90 * u);
    } };
  };

  // WIN 8 — rocket zooms across with a star trail, then bursts
  A.rocket = function (W, H, u) {
    var trail = [], boom = [], fired = false;
    return { step: function (g, t, dt) {
      var k = Math.min(1, t / 1.4), x = -60 * u + (W + 120 * u) * k, y = H * 0.85 - H * 0.6 * k - Math.sin(k * Math.PI) * H * 0.1;
      if (k < 1) { trail.push({ x: x - 30 * u, y: y + 30 * u, l: 1, c: pick(COLORS), r: rnd(6, 12) * u }); drawEmoji(g, '🚀', x, y, 90 * u, 0); }
      else if (!fired) { fired = true; for (var i = 0; i < 40; i++) { var a = R() * PI2, s = rnd(150, 420) * u; boom.push({ x: W * 0.8, y: H * 0.25, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 1.2, c: pick(COLORS), r: rnd(8, 16) * u }); } }
      trail.concat(boom).forEach(function (q) {
        q.l -= dt * 0.8; if (q.vx) { q.vy += 200 * u * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
        if (q.l > 0) { g.globalAlpha = Math.min(1, q.l); star(g, q.x, q.y, q.r, t * 3, q.c); }
      });
      g.globalAlpha = 1;
    } };
  };

  // OVER 1 — bubbles float up and pop
  A.bubbles = function (W, H, u) {
    var b = [];
    for (var i = 0; i < 34; i++) b.push({ x: R() * W, y: H + rnd(0, 500) * u, r: rnd(14, 40) * u, vy: rnd(160, 320) * u, ph: R() * 6, pop: rnd(0.1, 0.45) * H });
    return { step: function (g, t, dt) {
      b.forEach(function (q) {
        q.y -= q.vy * dt; var x = q.x + Math.sin(t * 3 + q.ph) * 14 * u;
        if (q.y < q.pop) { if (!q.p) q.p = 0; q.p += dt * 4; if (q.p > 1) return; g.strokeStyle = 'rgba(125,211,252,' + (1 - q.p) + ')'; g.lineWidth = 2 * u; g.beginPath(); g.arc(x, q.y, q.r * (1 + q.p), 0, PI2); g.stroke(); return; }
        var gr = g.createRadialGradient(x - q.r * 0.35, q.y - q.r * 0.35, q.r * 0.1, x, q.y, q.r);
        gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.3, 'rgba(186,230,253,.35)'); gr.addColorStop(1, 'rgba(56,189,248,.45)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, q.y, q.r, 0, PI2); g.fill();
      });
    } };
  };

  // OVER 2 — hearts float up
  A.hearts = function (W, H, u) {
    var h = [];
    for (var i = 0; i < 30; i++) h.push({ x: R() * W, y: H + rnd(0, 400) * u, s: rnd(22, 46) * u, vy: rnd(180, 300) * u, ph: R() * 6, c: pick(['#f43f5e', '#ec4899', '#fb7185', '#f472b6', '#e11d48']) });
    return { step: function (g, t, dt) {
      h.forEach(function (q) { q.y -= q.vy * dt; var sc = 1 + Math.sin(t * 8 + q.ph) * 0.1; heart(g, q.x + Math.sin(t * 2.5 + q.ph) * 20 * u, q.y, q.s * sc, q.c); });
    } };
  };

  // OVER 3 — butterflies flutter across
  A.butterflies = function (W, H, u) {
    var b = [];
    for (var i = 0; i < 10; i++) { var l = R() < 0.5; b.push({ l: l, x: l ? -rnd(40, 400) * u : W + rnd(40, 400) * u, y: rnd(0.15, 0.85) * H, vx: (l ? 1 : -1) * rnd(220, 360) * u, s: rnd(40, 64) * u, ph: R() * 6 }); }
    return { step: function (g, t, dt) {
      b.forEach(function (q) {
        q.x += q.vx * dt; var y = q.y + Math.sin(t * 3 + q.ph) * 40 * u;
        g.save(); g.translate(q.x, y); g.scale((q.l ? -1 : 1) * (0.55 + 0.45 * Math.abs(Math.sin(t * 14 + q.ph))), 1); drawEmoji(g, '🦋', 0, 0, q.s); g.restore();
      });
    } };
  };

  // OVER 4 — sparkle spiral from the middle
  A.spiral = function (W, H, u) {
    var cx = W / 2, cy = H * 0.45;
    return { step: function (g, t) {
      for (var i = 0; i < 48; i++) {
        var k = t * 1.2 - i * 0.03; if (k < 0) continue;
        var a = i * 0.55 + t * 2.4, d = k * Math.max(W, H) * 0.45;
        g.globalAlpha = Math.max(0, 1 - k * 0.6);
        if (i % 3 === 0) drawEmoji(g, '🌟', cx + Math.cos(a) * d, cy + Math.sin(a) * d, 26 * u);
        else star(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 9 * u, a, COLORS[i % COLORS.length]);
      }
      g.globalAlpha = 1;
    } };
  };

  // LOSE 1 — rain cloud passes, then the sun comes out
  A.raincloud = function (W, H, u) {
    var drops = [], cx = W / 2;
    return { step: function (g, t, dt) {
      var cyc = H * 0.2, cloudX = Math.min(cx, -150 * u + t * 900 * u);
      if (t < 2) { for (var i = 0; i < 4; i++) drops.push({ x: cloudX + rnd(-90, 90) * u, y: cyc + 40 * u, vy: rnd(500, 700) * u }); }
      drops.forEach(function (d) { d.y += d.vy * dt; if (d.y < H) drop(g, d.x, d.y, 7 * u); });
      var sun = Math.max(0, Math.min(1, (t - 1.6) / 0.6));
      if (sun > 0) { g.globalAlpha = sun; drawEmoji(g, '🌞', cx + 90 * u, cyc - 30 * u + (1 - sun) * 60 * u, 110 * u, t * 0.4); g.globalAlpha = 1; }
      drawEmoji(g, t < 1.6 ? '🌧️' : '☁️', cloudX + (t > 1.6 ? -(t - 1.6) * 600 * u : 0), cyc, 170 * u);
    } };
  };

  // LOSE 2 — dizzy stars circling
  A.dizzy = function (W, H, u) {
    var cx = W / 2, cy = H * 0.28;
    return { step: function (g, t) {
      for (var i = 0; i < 7; i++) {
        var a = t * 4 + i / 7 * PI2, x = cx + Math.cos(a) * 120 * u, y = cy + Math.sin(a) * 34 * u, front = Math.sin(a) > 0;
        g.globalAlpha = front ? 1 : 0.5; drawEmoji(g, i % 2 ? '💫' : '⭐', x, y, (front ? 46 : 34) * u, a);
      }
      g.globalAlpha = 1;
    } };
  };

  // LOSE 3 — gentle snow
  A.snow = function (W, H, u) {
    var s = [];
    for (var i = 0; i < 60; i++) s.push({ x: R() * W, y: -rnd(0, H * 0.8), s: rnd(16, 34) * u, vy: rnd(90, 200) * u, ph: R() * 6 });
    return { step: function (g, t, dt) {
      s.forEach(function (q) { q.y += q.vy * dt; drawEmoji(g, '❄️', q.x + Math.sin(t * 1.5 + q.ph) * 30 * u, q.y, q.s, t * 0.8 + q.ph); });
    } };
  };

  // LOSE 4 — leaves falling and swaying
  A.leaves = function (W, H, u) {
    var l = [];
    for (var i = 0; i < 36; i++) l.push({ x: R() * W, y: -rnd(0, H * 0.7), s: rnd(28, 46) * u, vy: rnd(140, 240) * u, ph: R() * 6, e: pick(['🍃', '🍂', '🍁']) });
    return { step: function (g, t, dt) {
      l.forEach(function (q) { q.y += q.vy * dt; var sw = Math.sin(t * 2.2 + q.ph); drawEmoji(g, q.e, q.x + sw * 60 * u, q.y, q.s, sw * 0.9); });
    } };
  };

  // LOSE 5 — a balloon that zips around while it deflates (pfffft!)
  A.deflate = function (W, H, u) {
    var x = W / 2, y = H * 0.45, vx = 0, vy = 0, a = 0, puffs = [];
    return { step: function (g, t, dt) {
      var k = Math.min(1, t / 2.4), s = (130 - 90 * k) * u;
      if (t > 0.35) { a += rnd(-6, 6) * dt; vx += Math.cos(a) * 1800 * u * dt; vy += Math.sin(a) * 1800 * u * dt - 300 * u * dt; }
      vx *= 0.96; vy *= 0.96; x += vx * dt; y += vy * dt;
      if (x < s || x > W - s) { vx = -vx; x = Math.max(s, Math.min(W - s, x)); }
      if (y < s || y > H - s) { vy = -vy; y = Math.max(s, Math.min(H - s, y)); }
      if (t > 0.35 && R() < 0.6) puffs.push({ x: x, y: y + s * 0.5, l: 1 });
      puffs.forEach(function (p) { p.l -= dt * 1.5; if (p.l > 0) { g.globalAlpha = p.l * 0.6; g.fillStyle = '#e5e7eb'; g.beginPath(); g.arc(p.x, p.y, (1.2 - p.l) * 18 * u, 0, PI2); g.fill(); } });
      g.globalAlpha = 1; drawEmoji(g, '🎈', x, y, s, Math.sin(t * 20) * 0.3 * Math.min(1, t));
    } };
  };

  var LIST = {
    win: ['cannons', 'fireworks', 'balloons', 'starshower', 'trophy', 'coins', 'rainbow', 'rocket'],
    over: ['bubbles', 'hearts', 'butterflies', 'spiral'],
    lose: ['raincloud', 'dizzy', 'snow', 'leaves', 'deflate']
  };
  var WORDS = {
    win: ['AMAZING!', 'YOU WIN!', 'SUPER STAR!', 'WOW!', 'FANTASTIC!', 'CHAMPION!', 'BRILLIANT!', 'AWESOME!'],
    over: ['GREAT TRY!', 'WELL PLAYED!', 'NICE ONE!', 'GOOD JOB!', 'KEEP GOING!'],
    lose: ['OOPS!', 'SO CLOSE!', 'TRY AGAIN!', 'ALMOST!', 'NEXT TIME!']
  };
  var GRAD = {
    win: 'linear-gradient(180deg,#fde047,#f97316)',
    over: 'linear-gradient(180deg,#7dd3fc,#6366f1)',
    lose: 'linear-gradient(180deg,#c4b5fd,#3b82f6)'
  };
  var ENTER = ['kqe-zoom', 'kqe-drop', 'kqe-spin', 'kqe-slide', 'kqe-jelly'];

  function css() {
    if (document.getElementById('kqe-css')) return;
    var st = document.createElement('style'); st.id = 'kqe-css';
    st.textContent =
      '.kqe-word{position:fixed;left:0;right:0;top:9%;z-index:2147483646;pointer-events:none;text-align:center;' +
      'font:900 clamp(40px,11vw,92px)/1 "Baloo 2","Fredoka",system-ui,sans-serif;letter-spacing:.02em;' +
      '-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:3px rgba(255,255,255,.95);' +
      'filter:drop-shadow(0 6px 0 rgba(30,27,75,.35)) drop-shadow(0 12px 18px rgba(30,27,75,.3));transition:opacity .5s}' +
      '@keyframes kqe-zoom{0%{transform:scale(0)}60%{transform:scale(1.25)}100%{transform:scale(1)}}' +
      '@keyframes kqe-drop{0%{transform:translateY(-140%)}55%{transform:translateY(12%)}75%{transform:translateY(-6%)}100%{transform:none}}' +
      '@keyframes kqe-spin{0%{transform:rotate(-540deg) scale(0)}100%{transform:none}}' +
      '@keyframes kqe-slide{0%{transform:translateX(-120%) skewX(-20deg)}70%{transform:translateX(6%) skewX(8deg)}100%{transform:none}}' +
      '@keyframes kqe-jelly{0%{transform:scale(0,0)}30%{transform:scale(1.3,.7)}50%{transform:scale(.8,1.2)}70%{transform:scale(1.1,.9)}100%{transform:none}}' +
      '.kqe-zoom{animation:kqe-zoom .6s cubic-bezier(.2,1.4,.5,1) both}.kqe-drop{animation:kqe-drop .8s ease-out both}' +
      '.kqe-spin{animation:kqe-spin .8s cubic-bezier(.2,1.2,.4,1) both}.kqe-slide{animation:kqe-slide .7s ease-out both}' +
      '.kqe-jelly{animation:kqe-jelly .8s ease-out both}';
    document.head.appendChild(st);
  }

  function choose(kind) {
    var list = LIST[kind], key = 'kq_endfx_last_' + kind, last = '';
    try { last = localStorage.getItem(key) || ''; } catch (e) {}
    var opts = list.filter(function (n) { return n !== last; });
    var name = pick(opts.length ? opts : list);
    try { localStorage.setItem(key, name); } catch (e) {}
    return name;
  }

  var running = null;
  function show(kind, opts) {
    opts = opts || {};
    kind = LIST[kind] ? kind : 'over';
    var name = opts.anim && A[opts.anim] ? opts.anim : choose(kind);
    if (!document.body) return name;
    css();
    if (running) running();

    // banner word
    var w = document.createElement('div');
    w.className = 'kqe-word ' + pick(ENTER);
    w.textContent = opts.word || pick(WORDS[kind]);
    w.style.backgroundImage = GRAD[kind];
    document.body.appendChild(w);

    var reduce = false;
    try { reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    var cv = null, raf = 0, dur = opts.duration || 3.2;
    if (!reduce) {
      cv = document.createElement('canvas');
      cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483645;transition:opacity .6s';
      document.body.appendChild(cv);
      var dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
      var g = cv.getContext('2d'), anim = A[name](W, H, dpr), t0 = performance.now(), last = t0;
      var frame = function (now) {
        var t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
        g.clearRect(0, 0, W, H);
        try { anim.step(g, t, dt); } catch (e) {}
        if (t > dur - 0.6) cv.style.opacity = '0';
        if (t < dur) raf = requestAnimationFrame(frame); else stop();
      };
      raf = requestAnimationFrame(frame);
    }
    var fade = setTimeout(function () { w.style.opacity = '0'; }, (dur - 0.8) * 1000);
    var kill = setTimeout(stop, dur * 1000 + 200);
    function stop() {
      cancelAnimationFrame(raf); clearTimeout(fade); clearTimeout(kill);
      if (cv && cv.parentNode) cv.remove(); if (w.parentNode) w.remove();
      if (running === stop) running = null;
    }
    running = stop;
    return name;
  }

  // warm the emoji images so the first animation isn't blank
  ['🎈', '🏆', '✨', '🪙', '☁️', '🚀', '🦋', '🌟', '🌧️', '🌞', '💫', '⭐', '❄️', '🍃', '🍂', '🍁'].forEach(emojiImg);

  window.KQEnd = { show: show, list: LIST };
})();

/* ============================================================================
   kq-fx.js  —  Shared Sounds + Animations for games & quiz
   ----------------------------------------------------------------------------
   • Sounds play from real MP3 files in /sounds (kid-friendly, happy chiptune
     style). If a file can't load for any reason (offline first paint, blocked
     request, etc.) each sound silently falls back to a synthesised Web Audio
     tone, so nothing ever stays silent.
   • Confetti is drawn on a lightweight canvas overlay for wins.
   • A little particle "blast" burst is available for shooters/breakers/pops.
   • Buttons get a click sound + a little "boop" press animation automatically.
   • A 🔊 / 🔇 mute toggle is added next to the leaderboard widget (or floats
     bottom-left if that widget isn't on the page). The choice is remembered.

   PUBLIC API (window.KQFX)
   ---------------------------------------------------------------------------
     KQFX.play(name)   click|tap|pop|coin|success|win|lose|draw|wrong|error
                       |levelup|join|leave|tick|countdown|hit|splash
                       |flip|blast|whoosh|boing|drop|ding|chime
     KQFX.celebrate(opts)      confetti burst  (opts.power 0..1)
     KQFX.blastAt(x, y, opts)  small particle pop/explosion at a page position
     KQFX.gameComplete()       finish sound + light confetti
     KQFX.win()                win jingle + big confetti
     KQFX.lose()                lose sound
     KQFX.quizComplete(score, outOf)   scales the celebration to the score
     KQFX.shake(el)             quick "wrong/lose" shake animation on an element
     KQFX.bounce(el)            quick "correct/win" bounce animation on an element
     KQFX.flipEl(el)            plays a 3D flip animation on an element (e.g. a card)
     KQFX.setMuted(bool) / KQFX.toggleMute() / KQFX.isMuted()
   ========================================================================== */
(function () {
  "use strict";
  if (window.KQFX) return;

  /* ------------------------------------------------------------ mute state */
  var MUTE_KEY = "kq_muted";
  function isMuted() { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { return false; } }
  function setMuted(v) { try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch (e) {} renderMuteBtn(); }

  /* ------------------------------------------------------- audio synthesis
     (kept as an automatic fallback for any sound file that fails to load) */
  var ctx = null;
  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { ctx = new AC(); } catch (e) { ctx = null; } }
    }
    if (ctx && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  // Unlock audio on the first user gesture (browsers block audio before that).
  function unlock() { ac(); }
  ["pointerdown", "touchstart", "keydown", "click"].forEach(function (ev) {
    window.addEventListener(ev, unlock, { once: true, passive: true, capture: true });
  });

  function tone(freq, start, dur, type, vol, slideTo) {
    var c = ac(); if (!c) return;
    var t0 = c.currentTime + start;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  var TONE_FALLBACK = {
    click:    function () { tone(880, 0, 0.05, "triangle", 0.10); },
    tap:      function () { tone(1200, 0, 0.04, "sine", 0.08); },
    pop:      function () { tone(700, 0, 0.09, "sine", 0.16, 1050); },
    coin:     function () { tone(988, 0, 0.06, "square", 0.10); tone(1319, 0.06, 0.10, "square", 0.10); },
    success:  function () { [523, 659, 784].forEach(function (f, i) { tone(f, i * 0.07, 0.14, "triangle", 0.14); }); },
    win:      function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.09, 0.22, "triangle", 0.16); });
                            tone(1568, 0.42, 0.3, "sine", 0.12); },
    levelup:  function () { [659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * 0.08, 0.18, "square", 0.10); }); },
    wrong:    function () { tone(300, 0, 0.18, "sawtooth", 0.14, 170); },
    error:    function () { tone(240, 0, 0.2, "sawtooth", 0.13, 150); },
    lose:     function () { tone(392, 0, 0.22, "sawtooth", 0.14, 262); tone(262, 0.18, 0.32, "sawtooth", 0.14, 150); },
    draw:     function () { tone(300, 0, 0.3, "triangle", 0.13, 260); },
    join:     function () { tone(440, 0, 0.16, "triangle", 0.14, 660); },
    leave:    function () { tone(460, 0, 0.18, "triangle", 0.11, 220); },
    tick:     function () { tone(900, 0, 0.04, "square", 0.08); },
    countdown:function () { tone(660, 0, 0.09, "square", 0.1); },
    hit:      function () { tone(180, 0, 0.14, "square", 0.16); },
    splash:   function () { tone(700, 0, 0.14, "sine", 0.12, 300); },
    flip:     function () { tone(1400, 0, 0.05, "sine", 0.12); tone(900, 0.02, 0.05, "sine", 0.08); },
    blast:    function () { tone(90, 0, 0.3, "sawtooth", 0.18, 40); tone(220, 0, 0.12, "square", 0.1, 60); },
    whoosh:   function () { tone(500, 0, 0.3, "sine", 0.1, 900); },
    boing:    function () { tone(500, 0, 0.28, "sine", 0.16, 180); },
    drop:     function () { tone(220, 0, 0.08, "square", 0.14, 140); tone(120, 0.03, 0.1, "sine", 0.1); },
    ding:     function () { tone(1046, 0, 0.4, "sine", 0.16); tone(2093, 0, 0.3, "sine", 0.08); },
    chime:    function () { [784, 1047, 1319].forEach(function (f, i) { tone(f, i * 0.12, 0.5, "sine", 0.1); }); }
  };

  /* --------------------------------------------------------- mp3 playback */
  // Resolve /sounds relative to THIS script's own URL so it works no matter
  // which page (or folder depth) includes kq-fx.js.
  var SOUND_BASE = (function () {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (/kq-fx\.js(\?|$)/.test(src)) return src.replace(/kq-fx\.js(\?.*)?$/, "sounds/");
    }
    return "sounds/";
  })();

  var POOL_SIZE = 3;
  var pools = {}; // name -> { items: [Audio], i: 0, broken: false }
  function makePool(name) {
    var items = [];
    for (var i = 0; i < POOL_SIZE; i++) {
      var a = new Audio(SOUND_BASE + name + ".mp3");
      a.preload = "auto";
      a.volume = 0.85;
      items.push(a);
    }
    var pool = { items: items, i: 0, broken: false };
    items[0].addEventListener("error", function () { pool.broken = true; }, { once: true });
    pools[name] = pool;
    return pool;
  }
  Object.keys(TONE_FALLBACK).forEach(makePool);

  function play(name) {
    if (isMuted()) return;
    var pool = pools[name];
    if (pool && !pool.broken) {
      var el = pool.items[pool.i % pool.items.length];
      pool.i++;
      try {
        el.currentTime = 0;
        var p = el.play();
        if (p && p.catch) p.catch(function () { var fb = TONE_FALLBACK[name]; if (fb) { try { fb(); } catch (e) {} } });
      } catch (e) {
        var fb2 = TONE_FALLBACK[name]; if (fb2) { try { fb2(); } catch (e2) {} }
      }
      return;
    }
    var fn = TONE_FALLBACK[name]; if (fn) { try { fn(); } catch (e) {} }
  }

  /* --------------------------------------------------------------- confetti */
  var COLORS = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#06b6d4", "#ec4899", "#eab308"];
  function celebrate(opts) {
    opts = opts || {};
    var power = Math.max(0.2, Math.min(1, opts.power == null ? 0.7 : opts.power));
    var count = Math.round(70 * power) + 30;
    var cv = document.createElement("canvas");
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483647";
    document.body.appendChild(cv);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    var g = cv.getContext("2d");
    var parts = [];
    for (var i = 0; i < count; i++) {
      parts.push({
        x: W * (0.2 + Math.random() * 0.6),
        y: H * (0.25 + Math.random() * 0.1),
        vx: (Math.random() - 0.5) * 14 * dpr,
        vy: (Math.random() * -10 - 6) * dpr,
        s: (6 + Math.random() * 7) * dpr,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.4,
        shape: Math.random() < 0.5 ? 0 : 1
      });
    }
    var grav = 0.35 * dpr, t = 0, max = 130;
    (function frame() {
      t++;
      g.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.vy += grav; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.globalAlpha = Math.max(0, 1 - t / max);
        g.fillStyle = p.c;
        if (p.shape === 0) g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        else { g.beginPath(); g.arc(0, 0, p.s / 2, 0, 6.28); g.fill(); }
        g.restore();
      }
      if (t < max) requestAnimationFrame(frame);
      else if (cv.parentNode) cv.parentNode.removeChild(cv);
    })();
  }

  /* ------------------------------------------------------- blast particles
     A small localized pop/explosion burst — for shooters, bubble/balloon
     pops, breakers, blasters, connect-four drops, etc. Plays the "blast"
     or "pop" sound alongside it unless opts.silent is set. */
  var BLAST_COLORS = ["#ffb703", "#fb5607", "#ff006e", "#8338ec", "#3a86ff", "#ffd166"];
  function blastAt(x, y, opts) {
    opts = opts || {};
    if (!opts.silent) play(opts.sound || "blast");
    var count = opts.count || 18;
    var cv = document.createElement("canvas");
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483647";
    document.body.appendChild(cv);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    var g = cv.getContext("2d");
    var cx = x * dpr, cy = y * dpr;
    var parts = [];
    for (var i = 0; i < count; i++) {
      var ang = Math.random() * Math.PI * 2;
      var spd = (2 + Math.random() * 6) * dpr;
      parts.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        s: (3 + Math.random() * 5) * dpr,
        c: BLAST_COLORS[(Math.random() * BLAST_COLORS.length) | 0]
      });
    }
    var t = 0, max = 34;
    (function frame() {
      t++;
      g.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92;
        g.globalAlpha = Math.max(0, 1 - t / max);
        g.fillStyle = p.c;
        g.beginPath(); g.arc(p.x, p.y, p.s * (1 - t / max), 0, 6.28); g.fill();
      }
      if (t < max) requestAnimationFrame(frame);
      else if (cv.parentNode) cv.parentNode.removeChild(cv);
    })();
  }

  /* ------------------------------------------------------ combined helpers */
  function gameComplete() { play("success"); celebrate({ power: 0.5 }); }
  function win() { play("win"); celebrate({ power: 1 }); }
  function lose() { play("lose"); }
  function quizComplete(score, outOf) {
    var ratio = outOf ? (score / outOf) : (score >= 20 ? 1 : score / 30);
    if (score <= 0) { play("lose"); return; }
    if (ratio >= 0.6 || score >= 20) { play("win"); celebrate({ power: 1 }); }
    else { play("levelup"); celebrate({ power: 0.5 }); }
  }

  /* --------------------------------------------------- element animations */
  function retrigger(el, cls) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }
  function shake(el) { retrigger(el, "kqfx-shake"); }
  function bounce(el) { retrigger(el, "kqfx-bounce"); }
  function flipEl(el) { retrigger(el, "kqfx-flip3d"); }

  /* --------------------------------------------- global click sfx + boop --- */
  var CLICK_SEL = "button, .btn, .menu-card, .play-card, .level-btn, .card, [role='button'], .android-action-btn, .lbhub-lv, .kqlb-btn, .daily-card, [onclick]";
  var lastClick = 0;
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest(CLICK_SEL) : null;
    if (!el) return;
    var now = Date.now();
    if (now - lastClick < 40) return; // debounce bursts
    lastClick = now;
    play("click");
    // gentle press animation on real <button>s only (avoids clobbering cards)
    if (el.tagName === "BUTTON") {
      el.classList.remove("kqfx-boop"); void el.offsetWidth; el.classList.add("kqfx-boop");
    }
  }, true);

  /* --------------------------------------------------------- mute button UI */
  var STYLE = "\
@keyframes kqfxBoop{0%{transform:scale(1)}45%{transform:scale(.9)}100%{transform:scale(1)}}\
.kqfx-boop{animation:kqfxBoop .18s ease}\
@keyframes kqfxPopIn{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}\
@keyframes kqfxShake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-5px)}40%,60%{transform:translateX(5px)}}\
.kqfx-shake{animation:kqfxShake .5s ease}\
@keyframes kqfxBounce{0%,100%{transform:translateY(0) scale(1)}30%{transform:translateY(-14px) scale(1.08)}50%{transform:translateY(0) scale(1)}70%{transform:translateY(-6px) scale(1.03)}}\
.kqfx-bounce{animation:kqfxBounce .6s ease}\
@keyframes kqfxFlip3d{0%{transform:rotateY(0deg)}50%{transform:rotateY(90deg)}100%{transform:rotateY(0deg)}}\
.kqfx-flip3d{animation:kqfxFlip3d .4s ease;transform-style:preserve-3d}\
.kqfx-mute{border:none;cursor:pointer;border-radius:999px;font-size:14px;line-height:1;padding:7px 9px;color:#fff;background:linear-gradient(135deg,#64748b,#475569);box-shadow:0 4px 12px rgba(0,0,0,.25);font-weight:800}\
.kqfx-mute.solo{position:fixed;left:10px;bottom:10px;z-index:2147483000;opacity:.85}\
";
  var muteBtn = null;
  function renderMuteBtn() { if (muteBtn) muteBtn.textContent = isMuted() ? "🔇" : "🔊"; }
  function makeMuteBtn() {
    var b = document.createElement("button");
    b.className = "kqfx-mute";
    b.title = "Sound on/off";
    b.onclick = function (e) { e.stopPropagation(); toggleMute(); };
    return b;
  }
  function toggleMute() { setMuted(!isMuted()); if (!isMuted()) play("tap"); }

  function injectFx() {
    if (document.getElementById("kqfx-style")) return;
    if (!document.body) { document.addEventListener("DOMContentLoaded", injectFx); return; }
    var st = document.createElement("style"); st.id = "kqfx-style"; st.textContent = STYLE;
    document.head.appendChild(st);

    // Try to sit inside the leaderboard widget (top-right). Poll briefly since
    // that widget injects asynchronously; fall back to a floating button.
    var tries = 0;
    (function place() {
      var fab = document.querySelector(".kqlb-fab");
      if (fab) {
        muteBtn = makeMuteBtn();
        fab.insertBefore(muteBtn, fab.firstChild);
        renderMuteBtn();
        return;
      }
      if (++tries < 40) return void setTimeout(place, 150); // ~6s
      muteBtn = makeMuteBtn(); muteBtn.classList.add("solo");
      document.body.appendChild(muteBtn); renderMuteBtn();
    })();
  }
  injectFx();

  /* --------------------------------------------------------------- export */
  window.KQFX = {
    play: play, celebrate: celebrate, blastAt: blastAt,
    gameComplete: gameComplete, win: win, lose: lose, quizComplete: quizComplete,
    shake: shake, bounce: bounce, flipEl: flipEl,
    isMuted: isMuted, setMuted: setMuted, toggleMute: toggleMute
  };
})();

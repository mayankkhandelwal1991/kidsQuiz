/* ============================================================================
   kq-fx.js  —  Shared Sounds + Animations for games & quiz
   ----------------------------------------------------------------------------
   • Sounds are SYNTHESISED with the Web Audio API — there are NO audio files to
     host, nothing to download, works offline and inside a WebView.
   • Confetti is drawn on a lightweight canvas overlay.
   • Buttons get a click sound + a little "boop" press animation automatically.
   • A 🔊 / 🔇 mute toggle is added next to the leaderboard widget (or floats
     bottom-left if that widget isn't on the page). The choice is remembered.

   PUBLIC API (window.KQFX)
   ---------------------------------------------------------------------------
     KQFX.play(name)        click|tap|pop|coin|success|win|lose|wrong|levelup
     KQFX.celebrate(opts)   confetti burst  (opts.power 0..1)
     KQFX.gameComplete()    finish sound + light confetti
     KQFX.win()             win jingle + big confetti
     KQFX.lose()            lose sound
     KQFX.quizComplete(score, outOf)   scales the celebration to the score
     KQFX.setMuted(bool) / KQFX.toggleMute() / KQFX.isMuted()
   ========================================================================== */
(function () {
  "use strict";
  if (window.KQFX) return;

  /* ------------------------------------------------------------ mute state */
  var MUTE_KEY = "kq_muted";
  function isMuted() { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { return false; } }
  function setMuted(v) { try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch (e) {} renderMuteBtn(); }

  /* ------------------------------------------------------- audio synthesis */
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

  // One tone with a smooth attack/decay so it never clicks.
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

  var SOUNDS = {
    click:   function () { tone(880, 0, 0.05, "triangle", 0.10); },
    tap:     function () { tone(1200, 0, 0.04, "sine", 0.08); },
    pop:     function () { tone(700, 0, 0.09, "sine", 0.16, 1050); },
    coin:    function () { tone(988, 0, 0.06, "square", 0.10); tone(1319, 0.06, 0.10, "square", 0.10); },
    success: function () { [523, 659, 784].forEach(function (f, i) { tone(f, i * 0.07, 0.14, "triangle", 0.14); }); },
    win:     function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.09, 0.22, "triangle", 0.16); });
                           tone(1568, 0.42, 0.3, "sine", 0.12); },
    levelup: function () { [659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * 0.08, 0.18, "square", 0.10); }); },
    wrong:   function () { tone(300, 0, 0.18, "sawtooth", 0.14, 170); },
    lose:    function () { tone(392, 0, 0.22, "sawtooth", 0.14, 262); tone(262, 0.18, 0.32, "sawtooth", 0.14, 150); }
  };
  function play(name) {
    if (isMuted()) return;
    var fn = SOUNDS[name]; if (fn) { try { fn(); } catch (e) {} }
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
    play: play, celebrate: celebrate,
    gameComplete: gameComplete, win: win, lose: lose, quizComplete: quizComplete,
    isMuted: isMuted, setMuted: setMuted, toggleMute: toggleMute
  };
})();

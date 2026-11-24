/* ============================================================
   KQ3D — shared shell for the 3D games (games/threed/*.html)
   ------------------------------------------------------------
   Load order in a game page:
     three.min.js  ->  kq3d.js  ->  ../ads.js  ->  game script
   (kq3d.js must come before ads.js so the floating leaderboard
   widget / mute button are skipped — the shell draws its own.)

   const G = KQ3D.init({
     id: 'car_race_3d', title: 'Car Race 3D',
     hero: ['🏎️','🪙','🚧'],            // pictures on the start screen
     colors: ['#38bdf8','#6366f1'],      // theme gradient
     how: [['👆','Swipe to change lane'], ...],
     bestKey: 'race3dBest',              // localStorage key for best score
     stars: [10, 30, 60],                // score needed for 1/2/3 stars
     hud: [{ id:'coins', icon:'🪙' }],    // extra HUD counters (optional)
     pick: { label:'Pick your car', options:[{ icon:'🚗', name:'Red', color:'#ef4444', value:... }] },
     buttons: [{ icon:'⬅️', down(){}, up(){} }],   // on-screen control pad (optional)
     onReset(choice) {},                 // build/clear the level (before countdown)
     onPause(paused) {}                  // optional
   });
   G.state   -> 'menu' | 'count' | 'play' | 'pause' | 'over'
   G.score(n), G.hudSet(id, n), G.pop(text, x, y, color), G.flash(color)
   G.over({ score, lines:['🪙 12 coins'], title:'Crash!' })
   KQ3D.renderer(el, opts) -> { renderer, camera, scene, resize }
   KQ3D.emojiTexture(emoji) / KQ3D.emojiSprite(emoji, size)
   KQ3D.sfx(name)  (names from kq-fx.js: coin, pop, whoosh, blast, jump ...)
   ============================================================ */
(function () {
  'use strict';
  window.KQ_NO_WIDGET = true;
  window.KQFX_NO_MUTE = true;

  // Root of the app, worked out from this script's own URL (games/threed/kq3d.js).
  var ROOT = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) { var all = document.getElementsByTagName('script'); for (var i = 0; i < all.length; i++) if (/kq3d\.js/.test(all[i].src)) s = all[i].src; }
    return s ? s.replace(/games\/threed\/kq3d\.js.*$/, '') : '../../';
  })();

  function emojiFile(e) {
    var cps = [];
    for (var i = 0; i < e.length; i++) {
      var c = e.codePointAt(i);
      if (c > 0xffff) i++;
      if (c !== 0xfe0f) cps.push(c.toString(16));
    }
    return ROOT + 'images/emoji/' + cps.join('-') + '.svg';
  }
  function pic(e, px) {
    return '<img class="k3e" src="' + emojiFile(e) + '" alt="" style="width:' + px + 'px;height:' + px + 'px" onerror="this.replaceWith(document.createTextNode(\'' + e + '\'))">';
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function sfx(n) { try { if (window.KQFX && !KQFX.isMuted()) KQFX.play(n); } catch (e) {} }
  function muted() { try { return localStorage.getItem('kq_muted') === '1'; } catch (e) { return false; } }

  var CSS = '\
@import url("https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&display=swap");\
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}\
html,body{height:100%;overflow:hidden;overscroll-behavior:none}\
body{font-family:"Baloo 2",system-ui,sans-serif;background:#0f172a;color:#fff;touch-action:none;user-select:none;-webkit-user-select:none}\
.k3e{vertical-align:middle;pointer-events:none;-webkit-user-drag:none}\
#k3{position:fixed;inset:0;overflow:hidden;background:var(--k3a)}\
#k3scene{position:absolute;inset:0}#k3scene canvas{display:block;width:100%!important;height:100%!important;touch-action:none}\
.k3hud{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;gap:8px;padding:max(10px,env(safe-area-inset-top)) 10px 10px;pointer-events:none}\
.k3hud>*{pointer-events:auto}\
.k3b{width:44px;height:44px;flex:0 0 auto;border:none;border-radius:15px;background:rgba(255,255,255,.92);color:#1e1b4b;font:800 20px "Baloo 2",sans-serif;display:grid;place-items:center;box-shadow:0 4px 0 rgba(0,0,0,.18);cursor:pointer}\
.k3b:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.18)}\
.k3pills{flex:1;display:flex;justify-content:center;gap:6px;flex-wrap:wrap}\
.k3pill{display:flex;align-items:center;gap:5px;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:2px solid rgba(255,255,255,.35);border-radius:999px;padding:3px 12px 3px 6px;font-weight:800;font-size:19px;line-height:1.2;min-width:64px;text-shadow:0 2px 0 rgba(0,0,0,.25)}\
.k3pill.bump{animation:k3bump .3s}@keyframes k3bump{50%{transform:scale(1.25)}}\
.k3pad{position:absolute;left:0;right:0;bottom:0;z-index:5;display:flex;justify-content:space-between;gap:12px;padding:12px 14px max(14px,env(safe-area-inset-bottom));pointer-events:none}\
.k3pad button{pointer-events:auto;width:78px;height:78px;border-radius:26px;border:3px solid rgba(255,255,255,.7);background:rgba(255,255,255,.28);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:grid;place-items:center;box-shadow:0 6px 0 rgba(0,0,0,.2);cursor:pointer;touch-action:none}\
.k3pad button.on,.k3pad button:active{transform:translateY(4px);box-shadow:0 2px 0 rgba(0,0,0,.2);background:rgba(255,255,255,.5)}\
.k3pad.hide{display:none}\
.k3scr{position:absolute;inset:0;z-index:10;display:none;align-items:center;justify-content:center;padding:16px;background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.18),rgba(0,0,0,0) 60%),linear-gradient(160deg,var(--k3a),var(--k3b));overflow-y:auto}\
.k3scr.on{display:flex}\
.k3scr.glass{background:rgba(15,23,42,.55);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}\
.k3card{width:100%;max-width:400px;margin:auto;background:#fff;color:#1e1b4b;border-radius:32px;padding:18px 18px 20px;text-align:center;box-shadow:0 10px 0 rgba(0,0,0,.15),0 24px 50px rgba(0,0,0,.3);animation:k3in .45s cubic-bezier(.34,1.56,.64,1)}\
@keyframes k3in{from{transform:scale(.6) translateY(40px);opacity:0}}\
.k3hero{height:120px;position:relative;margin:-6px 0 4px}\
.k3hero .k3e{position:absolute;filter:drop-shadow(0 6px 4px rgba(0,0,0,.2));animation:k3float 2.8s ease-in-out infinite}\
.k3hero .k3e:nth-child(1){left:50%;top:6px;margin-left:-50px}\
.k3hero .k3e:nth-child(2){left:6%;top:48px;animation-delay:.5s}\
.k3hero .k3e:nth-child(3){right:6%;top:40px;animation-delay:1s}\
@keyframes k3float{50%{transform:translateY(-10px) rotate(-6deg)}}\
.k3card h1{font-size:32px;line-height:1;margin:2px 0 6px;background:linear-gradient(135deg,var(--k3a),var(--k3b));-webkit-background-clip:text;background-clip:text;color:transparent}\
.k3best{display:inline-flex;align-items:center;gap:6px;background:#fef3c7;color:#92400e;font-weight:800;border-radius:999px;padding:3px 14px 3px 8px;margin-bottom:10px}\
.k3how{list-style:none;text-align:left;background:#f8fafc;border-radius:20px;padding:8px 12px;margin-bottom:12px}\
.k3how li{display:flex;align-items:center;gap:10px;padding:5px 0;font-weight:700;font-size:15px;line-height:1.25;color:#334155}\
.k3pick h3{font-size:15px;margin-bottom:6px;color:#475569}\
.k3opts{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:14px}\
.k3opt{border:3px solid #e2e8f0;background:#fff;border-radius:18px;padding:6px 8px 4px;min-width:64px;font:800 12px "Baloo 2",sans-serif;color:#334155;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer}\
.k3opt.on{border-color:var(--k3b);background:#eef2ff;transform:translateY(-3px);box-shadow:0 4px 0 var(--k3b)}\
.k3opt .sw{width:22px;height:8px;border-radius:4px}\
.k3go{width:100%;border:none;border-radius:22px;padding:13px;font:800 24px "Baloo 2",sans-serif;color:#fff;background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 7px 0 #15803d;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;animation:k3pulse 1.5s ease-in-out infinite}\
.k3go:active{transform:translateY(5px);box-shadow:0 2px 0 #15803d;animation:none}\
@keyframes k3pulse{50%{transform:scale(1.04)}}\
.k3row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}\
.k3alt{border:none;border-radius:18px;padding:10px;font:800 15px "Baloo 2",sans-serif;background:#f1f5f9;color:#1e293b;box-shadow:0 4px 0 #cbd5e1;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}\
.k3alt:active{transform:translateY(3px);box-shadow:0 1px 0 #cbd5e1}\
.k3big{font-size:64px;font-weight:800;line-height:1;margin:4px 0;color:#1e1b4b}\
.k3stars{display:flex;justify-content:center;gap:6px;margin:6px 0 2px}\
.k3stars .k3e{opacity:.18;filter:grayscale(1);transform:scale(.8)}\
.k3stars .k3e.on{opacity:1;filter:none;animation:k3star .5s cubic-bezier(.34,1.56,.64,1) both}\
@keyframes k3star{from{transform:scale(0) rotate(-90deg)}to{transform:scale(1)}}\
.k3rec{display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-weight:800;border-radius:999px;padding:3px 14px;margin:4px 0;animation:k3pulse 1s infinite}\
.k3lines{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:8px 0 4px}\
.k3lines span{background:#f1f5f9;border-radius:999px;padding:3px 12px;font-weight:800;color:#334155}\
.k3count{position:absolute;inset:0;z-index:9;display:none;align-items:center;justify-content:center;pointer-events:none}\
.k3count.on{display:flex}\
.k3count b{font-size:120px;font-weight:800;color:#fff;-webkit-text-stroke:4px rgba(30,27,75,.6);text-shadow:0 8px 0 rgba(0,0,0,.25);animation:k3cd .9s ease-out both}\
@keyframes k3cd{from{transform:scale(2.2);opacity:0}30%{transform:scale(1);opacity:1}to{transform:scale(.8);opacity:0}}\
.k3pop{position:absolute;z-index:6;pointer-events:none;font-weight:800;font-size:26px;color:#fde047;-webkit-text-stroke:1.5px rgba(0,0,0,.45);transform:translate(-50%,-50%);animation:k3pop 1s ease-out forwards;white-space:nowrap}\
@keyframes k3pop{from{opacity:1;transform:translate(-50%,-50%) scale(.6)}20%{transform:translate(-50%,-80%) scale(1.15)}to{opacity:0;transform:translate(-50%,-190%) scale(1)}}\
.k3flash{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;transition:opacity .35s}\
.k3hint{position:absolute;left:50%;bottom:calc(110px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:5;background:rgba(15,23,42,.6);border-radius:999px;padding:4px 14px;font-weight:800;font-size:14px;white-space:nowrap;pointer-events:none;transition:opacity .5s}\
.k3nogl{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;text-align:center;padding:30px;font-size:18px;font-weight:800;background:#1e1b4b}\
@media (min-width:700px){.k3pad{justify-content:center;gap:28px}.k3pill{font-size:22px}}\
';

  function init(cfg) {
    var colors = cfg.colors || ['#38bdf8', '#6366f1'];
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var meta = document.querySelector('meta[name=viewport]');
    if (meta) meta.setAttribute('content', 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
    var root = document.createElement('div'); root.id = 'k3';
    root.style.setProperty('--k3a', colors[0]); root.style.setProperty('--k3b', colors[1]);
    var hud = (cfg.hud || []).map(function (h) { return '<span class="k3pill" id="k3h_' + h.id + '">' + pic(h.icon, 26) + '<span>0</span></span>'; }).join('');
    root.innerHTML =
      '<div id="k3scene"></div><div class="k3flash" id="k3flash"></div>' +
      '<div class="k3hud"><button class="k3b" id="k3back" aria-label="Back to games">🏠</button>' +
        '<div class="k3pills"><span class="k3pill" id="k3score">' + pic(cfg.scoreIcon || '⭐', 26) + '<span>0</span></span>' + hud + '</div>' +
        '<button class="k3b" id="k3mute" aria-label="Sound"></button><button class="k3b" id="k3pause" aria-label="Pause">⏸</button></div>' +
      '<div class="k3pad hide" id="k3pad"></div>' +
      (cfg.hint ? '<div class="k3hint" id="k3hint" style="opacity:0">' + esc(cfg.hint) + '</div>' : '') +
      '<div class="k3count" id="k3count"></div>' +
      '<div class="k3scr on" id="k3start"></div><div class="k3scr glass" id="k3paused"></div><div class="k3scr glass" id="k3over"></div>';
    document.body.innerHTML = ''; document.body.appendChild(root);

    var $ = function (id) { return document.getElementById(id); };
    var best = 0; try { best = +(localStorage.getItem(cfg.bestKey) || 0) || 0; } catch (e) {}
    var choice = null, pickIdx = 0;
    try { pickIdx = +(localStorage.getItem('k3pick_' + cfg.id) || 0) || 0; } catch (e) {}
    if (cfg.pick && cfg.pick.options[pickIdx]) choice = cfg.pick.options[pickIdx]; else if (cfg.pick) { pickIdx = 0; choice = cfg.pick.options[0]; }

    var G = { state: 'menu', root: root, scene: $('k3scene'), best: best, choice: choice, _score: 0 };
    // Background music: each game gets its own generated tune (see SongMaker);
    // a game can still name an mp3 file instead (cfg.music = 'file.mp3').
    var music = null;
    if (typeof cfg.music === 'string') { try { var au = new Audio(ROOT + 'games/sounds/' + cfg.music); au.preload = 'none'; au.loop = true; au.volume = 0.22; music = { play: function () { var p = au.play(); if (p && p.catch) p.catch(function () {}); }, pause: function () { au.pause(); } }; } catch (e) {} }
    else if (cfg.music) music = SongMaker(cfg.id, cfg.musicStyle || styleFor());
    G.music = function (on) { if (!music) return; try { if (on && !muted()) music.play(); else music.pause(); } catch (e) {} };

    function renderMute() { $('k3mute').textContent = muted() ? '🔇' : '🔊'; }
    renderMute();
    $('k3mute').onclick = function () { try { localStorage.setItem('kq_muted', muted() ? '0' : '1'); } catch (e) {} renderMute(); sfx('tap'); G.music(G.state === 'play' && !muted()); };
    $('k3back').onclick = function () { location.href = '../index.html'; };
    $('k3pause').onclick = function () { if (G.state === 'play') pause(true); else if (G.state === 'pause') pause(false); };

    // ---- start screen
    function startScreen() {
      var h = '<div class="k3card"><div class="k3hero">' + (cfg.hero || []).slice(0, 3).map(function (e, i) { return pic(e, i === 0 ? 100 : 60); }).join('') + '</div>' +
        '<h1>' + esc(cfg.title) + '</h1>' +
        (best ? '<div class="k3best">' + pic('🏆', 22) + ' Best: ' + best + '</div>' : '<div class="k3best">' + pic('🌟', 22) + ' New game — have fun!</div>') +
        '<ul class="k3how">' + (cfg.how || []).map(function (x) { return '<li>' + pic(x[0], 30) + '<span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ul>';
      if (cfg.pick) {
        h += '<div class="k3pick"><h3>' + esc(cfg.pick.label) + '</h3><div class="k3opts">' + cfg.pick.options.map(function (o, i) {
          return '<button class="k3opt' + (i === pickIdx ? ' on' : '') + '" data-i="' + i + '">' + pic(o.icon, 36) + esc(o.name) + (o.color ? '<span class="sw" style="background:' + o.color + '"></span>' : '') + '</button>';
        }).join('') + '</div></div>';
      }
      h += '<button class="k3go" id="k3play">' + pic('▶️', 30) + ' Play!</button></div>';
      $('k3start').innerHTML = h;
      $('k3start').querySelectorAll('.k3opt').forEach(function (b) {
        b.onclick = function () {
          pickIdx = +b.dataset.i; choice = G.choice = cfg.pick.options[pickIdx];
          try { localStorage.setItem('k3pick_' + cfg.id, pickIdx); } catch (e) {}
          $('k3start').querySelectorAll('.k3opt').forEach(function (x) { x.classList.toggle('on', x === b); });
          sfx('pop'); if (cfg.onPick) cfg.onPick(choice);
        };
      });
      $('k3play').onclick = begin;
    }

    // ---- on-screen control pad
    if (cfg.buttons && cfg.buttons.length) {
      var pad = $('k3pad');
      cfg.buttons.forEach(function (b) {
        var el = document.createElement('button'); el.innerHTML = pic(b.icon, 40); el.setAttribute('aria-label', b.label || b.icon);
        var down = function (e) { e.preventDefault(); el.classList.add('on'); if (G.state === 'play' && b.down) b.down(); };
        var up = function (e) { if (e) e.preventDefault(); el.classList.remove('on'); if (b.up) b.up(); };
        el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up);
        el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
        pad.appendChild(el);
      });
    }

    function show(id) { ['k3start', 'k3paused', 'k3over'].forEach(function (s) { $(s).classList.toggle('on', s === id); }); $('k3pad').classList.toggle('hide', !(id === null && cfg.buttons && cfg.buttons.length)); }

    // Coins (admin setting): pay to start, or watch a video; free when coins are off.
    function begin() {
      if (window.KQ && KQ.gate) KQ.gate('single', cfg.id, beginNow); else beginNow();
    }
    function beginNow() {
      G.gen = (G.gen || 0) + 1; // new game: steps scheduled by the previous one are dropped
      sfx('click');
      try { if (window.KQ && KQ.markStart) KQ.markStart(); } catch (e) {}
      G._score = 0; setText('k3score', 0);
      (cfg.hud || []).forEach(function (h) { G.hudSet(h.id, 0); });
      if (cfg.onReset) cfg.onReset(choice);
      show(null);
      G.state = 'count';
      var n = 3, c = $('k3count');
      c.classList.add('on');
      (function tick() {
        if (G.state !== 'count') { c.classList.remove('on'); return; }
        c.innerHTML = '<b>' + (n > 0 ? n : 'GO!') + '</b>';
        sfx(n > 0 ? 'countdown' : 'levelup');
        if (n-- > 0) setTimeout(tick, 700);
        else setTimeout(function () {
          c.classList.remove('on'); if (G.state !== 'count') return; G.state = 'play'; G.t0 = performance.now(); G.music(true);
          var hint = $('k3hint'); if (hint) { hint.style.opacity = 1; setTimeout(function () { hint.style.opacity = 0; }, 3500); }
          if (cfg.onPlay) cfg.onPlay();
        }, 500);
      })();
    }
    G.restart = begin;

    /* Run a game step after `ms` while playing. If the game is paused at that
       moment (pause button, app switched, full-screen ad), it waits and runs as
       soon as play resumes instead of being lost — a lost step used to leave the
       game stuck with no next round and no game over. Dropped only if the game
       was restarted or ended meanwhile. */
    G.later = function (fn, ms) {
      var gen = G.gen;
      setTimeout(function run() {
        if (G.gen !== gen) return;
        if (G.state === 'pause') { setTimeout(run, 250); return; }
        if (G.state === 'play') fn();
      }, ms || 0);
    };

    function pause(on) {
      if (on && G.state !== 'play') return;
      G.state = on ? 'pause' : 'play';
      $('k3pause').textContent = on ? '▶' : '⏸';
      if (on) {
        $('k3paused').innerHTML = '<div class="k3card"><div class="k3hero" style="height:90px">' + pic('😴', 84) + '</div><h1>Paused</h1>' +
          '<button class="k3go" id="k3res">' + pic('▶️', 30) + ' Keep playing</button>' +
          '<div class="k3row"><button class="k3alt" id="k3rst">🔄 Restart</button><button class="k3alt" id="k3home">🏠 Games</button></div></div>';
        show('k3paused');
        $('k3res').onclick = function () { pause(false); };
        $('k3rst').onclick = begin;
        $('k3home').onclick = function () { try { if (window.KQ && KQ.adBreak) KQ.adBreak('quit'); } catch (e) {} location.href = '../index.html'; };
      } else show(null);
      G.music(!on);
      if (cfg.onPause) cfg.onPause(on);
    }
    G.pause = pause;
    document.addEventListener('visibilitychange', function () { if (document.hidden && G.state === 'play') pause(true); });
    window.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName) && e.key !== 'Escape') return;   // typing games
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (G.state === 'play') pause(true); else if (G.state === 'pause') pause(false); }
      else if ((e.key === 'Enter' || e.key === ' ') && (G.state === 'menu' || G.state === 'over')) { e.preventDefault(); begin(); }
    });

    /* Restarting the bump animation forces a layout; scores that change every
       frame (distance) did that 60×/s and made the HUD flicker. So the text
       always updates, but the bump plays at most every 350 ms per box. */
    var bumpAt = {};
    function setText(id, v) {
      var el = $(id); if (!el) return;
      var s = String(v); if (el.lastChild.textContent === s) return;
      el.lastChild.textContent = s;
      var now = performance.now(); if (now - (bumpAt[id] || 0) < 350) return; bumpAt[id] = now;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
    G.score = function (n) { if (n === G._score) return; G._score = n; setText('k3score', n); };
    G.hudSet = function (id, n) { setText('k3h_' + id, n); };
    G.pop = function (text, x, y, color) {
      var d = document.createElement('div'); d.className = 'k3pop'; d.textContent = text;
      d.style.left = (x == null ? innerWidth / 2 : x) + 'px'; d.style.top = (y == null ? innerHeight * 0.4 : y) + 'px';
      if (color) d.style.color = color;
      root.appendChild(d); setTimeout(function () { d.remove(); }, 1000);
    };
    G.flash = function (color) { var f = $('k3flash'); f.style.transition = 'none'; f.style.background = color || '#fff'; f.style.opacity = .55; void f.offsetWidth; f.style.transition = 'opacity .45s'; f.style.opacity = 0; };

    /* ---- Share my score: a picture of the result -> share sheet ----------
       Admin console -> App settings -> "Share score" can switch it off. */
    function shareOn() {
      try { var c = (window.KQ && KQ.appConfig) ? KQ.appConfig() : {}; return !(c.share && c.share.enabled === false); } catch (e) { return true; }
    }
    function shareScore(r) {
      var S = 1080, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
      var g = cv.getContext('2d');
      var bg = g.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, '#38bdf8'); bg.addColorStop(1, '#fde68a');
      g.fillStyle = bg; g.fillRect(0, 0, S, S);
      g.fillStyle = 'rgba(255,255,255,.95)'; roundRect(g, 70, 150, S - 140, S - 300, 56); g.fill();
      var font = '"Baloo 2","Fredoka",system-ui,sans-serif';
      function txt(t, y, size, color, weight) { g.font = (weight || 800) + ' ' + size + 'px ' + font; g.fillStyle = color; g.textAlign = 'center'; g.fillText(t, S / 2, y, S - 200); }
      function star(x, y, rad, on) {
        g.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? rad * 0.45 : rad; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        g.closePath(); g.fillStyle = on ? '#facc15' : '#e5e7eb'; g.fill(); g.lineWidth = 6; g.strokeStyle = on ? '#f59e0b' : '#d1d5db'; g.stroke();
      }
      var logo = new Image();
      var draw = function () {
        try { if (logo.naturalWidth) { g.save(); roundRect(g, S / 2 - 90, 40, 180, 180, 40); g.clip(); g.drawImage(logo, S / 2 - 90, 40, 180, 180); g.restore(); } } catch (e) {}
        txt(r.title || 'Kids Quiz', 300, 64, '#1e1b4b');
        txt(r.heading, 380, 48, '#4f46e5');
        for (var i = 0; i < 3; i++) star(S / 2 - 150 + i * 150, 480, 58, i < r.stars);
        txt(String(r.score), 690, 200, '#1e1b4b', 900);
        if (r.rec) txt('🏆 NEW BEST!', 770, 44, '#b45309');
        (r.lines || []).slice(0, 2).forEach(function (l, k) { txt(String(l), 830 + k * 50, 36, '#4b5563', 700); });
        txt('Play free: Kids Game & Quiz on Google Play', S - 70, 36, '#1e1b4b', 800);
        var url = cv.toDataURL('image/png');
        var text = 'I scored ' + r.score + ' in ' + (r.title || 'Kids Quiz') + '! 🎉 Can you beat me?\nhttps://play.google.com/store/apps/details?id=com.mk.kidsquiz';
        try { if (typeof Android !== 'undefined' && Android && typeof Android.shareImage === 'function') { Android.shareImage(url, text); return; } } catch (e) {}
        cv.toBlob(function (blob) {
          var file = null; try { file = new File([blob], 'kids-quiz-score.png', { type: 'image/png' }); } catch (e) {}
          if (file && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], text: text }).catch(function () {}); return; }
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kids-quiz-score.png'; document.body.appendChild(a); a.click(); a.remove();
        }, 'image/png');
      };
      logo.onload = draw; logo.onerror = draw; logo.src = ROOT + 'images/app-logo.png';
    }

    G.over = function (o) {
      if (G.state === 'over') return;
      G.state = 'over'; G.music(false);
      var score = o.score != null ? o.score : G._score;
      var rec = score > best && score > 0;
      if (rec) { best = G.best = score; try { localStorage.setItem(cfg.bestKey, best); } catch (e) {} }
      var th = cfg.stars || [1, 10, 25], stars = th.filter(function (t) { return score >= t; }).length;
      try { if (typeof onGameComplete === 'function') onGameComplete(score); } catch (e) {}
      var face = stars >= 3 ? '🥳' : stars === 2 ? '😎' : stars === 1 ? '🌟' : '💪';
      setTimeout(function () {
        $('k3over').innerHTML = '<div class="k3card"><div class="k3hero" style="height:90px">' + pic(face, 84) + '</div>' +
          '<h1>' + esc(o.title || (rec ? 'New record!' : 'Great try!')) + '</h1>' +
          '<div class="k3stars">' + [0, 1, 2].map(function (i) { return pic('⭐', 48).replace('class="k3e"', 'class="k3e' + (i < stars ? ' on' : '') + '" style="animation-delay:' + (0.2 + i * 0.25) + 's;width:48px;height:48px"'); }).join('') + '</div>' +
          '<div class="k3big">' + score + '</div>' +
          (rec ? '<div class="k3rec">🏆 NEW BEST!</div>' : '<div class="k3best">' + pic('🏆', 22) + ' Best: ' + best + '</div>') +
          (o.lines && o.lines.length ? '<div class="k3lines">' + o.lines.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>' : '') +
          '<button class="k3go" id="k3again" style="margin-top:10px">' + pic('🔁', 28) + ' Play again</button>' +
          '<div class="k3row"><button class="k3alt" id="k3lb">' + pic('🏆', 20) + ' Top players</button><button class="k3alt" id="k3home2">🏠 Games</button></div>' +
          (shareOn() ? '<button class="k3alt" id="k3share" style="width:100%;margin-top:8px">📤 Share my score</button>' : '') + '</div>';
        show('k3over');
        if ($('k3share')) $('k3share').onclick = function () { shareScore({ title: cfg.title, score: score, stars: stars, rec: rec, heading: o.title || (rec ? 'New record!' : 'Great try!'), lines: o.lines || [] }); };
        $('k3again').onclick = begin;
        $('k3home2').onclick = function () { try { if (window.KQ && KQ.adBreak) KQ.adBreak('quit'); } catch (e) {} location.href = '../index.html'; };
        $('k3lb').onclick = function () { if (window.KQ && KQ.open) KQ.open('single', cfg.id, cfg.title); else location.href = ROOT + 'leaderboard.html?cat=single'; };
        // win / game over / lose animation (a different one each time); games can force it with o.result
        var kind = o.result || (rec || stars >= 3 ? 'win' : stars ? 'over' : 'lose');
        sfx(kind === 'win' ? 'win' : kind === 'over' ? 'success' : 'lose');
        try { if (window.KQEnd) KQEnd.show(kind); else if (stars && window.KQFX) KQFX.celebrate({ power: rec ? 1 : 0.5 }); } catch (e) {}
      }, o.delay == null ? 900 : o.delay);
    };

    startScreen();
    show('k3start');
    if (/[?&]autoplay=1/.test(location.search)) setTimeout(begin, 300); // testing aids
    if (/[?&]testover=1/.test(location.search)) setTimeout(function () { G.over({ score: 345, lines: ['🧪 test'] }); }, 3800);
    return G;
  }

  /* ---- SongMaker: background music made in the browser ----------------------
     Every game gets its own little tune: the game id seeds the key, chords,
     tempo and melody, and the category picks the style. Nothing to download,
     and it loops for ever without the "same 3 seconds again" feel.
       arcade    (action)              fast, drums, bright square lead
       adventure (3D)                  driving beat, pad, triangle lead
       calm      (puzzle, word, brain) soft marimba, light hats, no kick
       bouncy    (strategy, fun, AI)   bouncy bass, claps, xylophone      */
  function styleFor() {
    var m = (location.pathname || '').match(/games\/([a-z]+)\//), c = m ? m[1] : '';
    return c === 'action' ? 'arcade' : c === 'threed' ? 'adventure' : (c === 'puzzle' || c === 'word' || c === 'brain') ? 'calm' : 'bouncy';
  }
  var sharedAC = null;
  function audioCtx() {
    try { if (window.KQFX && KQFX.audioContext) { var c = KQFX.audioContext(); if (c) return c; } } catch (e) {}
    if (!sharedAC) { var A = window.AudioContext || window.webkitAudioContext; if (A) try { sharedAC = new A(); } catch (e) {} }
    return sharedAC;
  }
  function SongMaker(id, style) {
    var seed = 0; for (var i = 0; i < String(id).length; i++) seed = (seed * 31 + String(id).charCodeAt(i)) >>> 0;
    var rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    var pick = function (a) { return a[Math.floor(rnd() * a.length)]; };
    var S = { arcade: { bpm: [132, 150], lead: 'square', drums: 2, pad: 0 }, adventure: { bpm: [118, 130], lead: 'triangle', drums: 2, pad: 1 }, calm: { bpm: [86, 100], lead: 'marimba', drums: 0, pad: 1 }, bouncy: { bpm: [106, 118], lead: 'xylo', drums: 1, pad: 0 } }[style] || { bpm: [110, 120], lead: 'triangle', drums: 1, pad: 0 };
    var bpm = S.bpm[0] + Math.floor(rnd() * (S.bpm[1] - S.bpm[0])), step = 60 / bpm / 2;   // eighth notes
    var root = pick([0, 2, 3, 5, 7, 9]), MAJ = [0, 2, 4, 5, 7, 9, 11], PENTA = [0, 2, 4, 7, 9];
    var prog = pick([[0, 5, 3, 4], [0, 4, 5, 3], [0, 3, 4, 4], [5, 3, 0, 4], [0, 3, 0, 4]]);
    var hz = function (semi) { return 261.63 * Math.pow(2, (semi + root) / 12); };
    // melody: two 8-step motifs (A, B) per chord, song form A A B A over 4 chords = 16 bars
    function motif() { var m = [], last = pick([0, 2, 4]); for (var k = 0; k < 8; k++) { if (rnd() < 0.28 && k % 2) { m.push(null); continue; } last = Math.max(-2, Math.min(7, last + pick([-2, -1, -1, 0, 1, 1, 2]))); m.push(last); } return m; }
    var A = motif(), B = motif(), FORM = [A, A, B, A];
    var noteOf = function (idx, chordDeg) { var o = Math.floor(idx / 5), p = ((idx % 5) + 5) % 5; return 12 + PENTA[p] + 12 * o + (chordDeg === 4 && p === 0 ? 0 : 0); };
    var ac = null, master = null, noise = null, timer = null, nextT = 0, n = 0, on = false;
    function setup() {
      ac = audioCtx(); if (!ac) return false;
      if (!master) {
        master = ac.createGain(); master.gain.value = 0;
        var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; master.connect(lp); lp.connect(ac.destination);
        noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate); var d = noise.getChannelData(0); for (var j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;
      }
      return true;
    }
    function env(t, a, peak, dec) { var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); g.connect(master); return g; }
    function osc(type, f, t, dur, g) { var o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(g); o.start(t); o.stop(t + dur + 0.05); return o; }
    function kick(t) { var g = env(t, 0.005, 0.7, 0.16), o = osc('sine', 140, t, 0.18, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); }
    function hiss(t, type, f, vol, dec) { var s = ac.createBufferSource(); s.buffer = noise; var fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; var g = env(t, 0.003, vol, dec); s.connect(fl); fl.connect(g); s.start(t); s.stop(t + dec + 0.05); }
    function lead(t, f) {
      if (S.lead === 'marimba') { var g = env(t, 0.004, 0.16, 0.35); osc('sine', f, t, 0.4, g); var g2 = env(t, 0.002, 0.05, 0.08); osc('sine', f * 4, t, 0.1, g2); }
      else if (S.lead === 'xylo') { var g3 = env(t, 0.003, 0.14, 0.22); osc('triangle', f * 2, t, 0.25, g3); }
      else { var g4 = env(t, 0.01, S.lead === 'square' ? 0.06 : 0.12, step * 1.6); osc(S.lead, f, t, step * 1.7, g4); }
    }
    function schedule() {
      if (!on) return;
      while (nextT < ac.currentTime + 0.25) {
        var bar = Math.floor(n / 8) % 16, s8 = n % 8, chordDeg = prog[bar % 4], ch = MAJ[chordDeg], t = nextT;
        var mel = FORM[Math.floor(bar / 4)][s8];
        if (mel != null && (bar % 4 !== 3 || s8 < 6)) lead(t, hz(noteOf(mel, chordDeg)));
        // bass
        if (style === 'bouncy') { var gb = env(t, 0.005, 0.22, step * 0.9); osc('triangle', hz(ch - 24 + (s8 % 2 ? 12 : 0)), t, step, gb); }
        else if (style === 'calm') { if (s8 % 4 === 0) { var gc = env(t, 0.02, 0.2, step * 3.5); osc('triangle', hz(ch - 24), t, step * 4, gc); } }
        else if (s8 % 2 === 0) { var gd = env(t, 0.005, 0.24, step * 1.5); osc('triangle', hz(ch - 24), t, step * 1.6, gd); }
        // pad: soft chord at the start of each bar
        if (S.pad && s8 === 0) [0, 4, 7].forEach(function (iv) { var semi = MAJ[(chordDeg + (iv === 4 ? 2 : iv === 7 ? 4 : 0)) % 7] + (chordDeg + (iv === 4 ? 2 : iv === 7 ? 4 : 0) >= 7 ? 12 : 0); var gp = env(t, 0.25, 0.035, step * 7); osc('sine', hz(semi - 12), t, step * 8, gp); });
        // drums
        if (S.drums === 2) { if (s8 % 2 === 0) kick(t); if (s8 === 2 || s8 === 6) hiss(t, 'bandpass', 1800, 0.25, 0.12); hiss(t, 'highpass', 7000, s8 % 2 ? 0.06 : 0.09, 0.04); }
        else if (S.drums === 1) { if (s8 === 0 || s8 === 4) kick(t); if (s8 === 2 || s8 === 6) hiss(t, 'bandpass', 1400, 0.2, 0.1); if (s8 % 2) hiss(t, 'highpass', 8000, 0.05, 0.03); }
        else if (s8 % 2) hiss(t, 'highpass', 9000, 0.035, 0.03);
        nextT += step; n++;
      }
    }
    return {
      play: function () {
        if (on || !setup()) return; on = true;
        try { if (ac.state === 'suspended') ac.resume(); } catch (e) {}
        nextT = Math.max(nextT, ac.currentTime + 0.05);
        master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.linearRampToValueAtTime(0.42, ac.currentTime + 0.4);
        schedule(); timer = setInterval(schedule, 60);
      },
      pause: function () {
        if (!on) return; on = false; clearInterval(timer); timer = null;
        if (ac && master) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.linearRampToValueAtTime(0, ac.currentTime + 0.15); }
        nextT = 0;
      }
    };
  }

  // ---- three.js helpers
  /* Free GPU memory automatically. Games remove meshes (old road rows, coins,
     maze walls, particles ...) but never disposed their geometry, so every
     round left hundreds of buffers on the GPU and the game got slower after
     1-2 plays. Now: anything removed from the scene that has not been added
     back by the next tick gets its geometries disposed. (A disposed geometry
     that is still shared by a live mesh is simply uploaded again by three.js,
     so this is always safe. Materials/textures are shared and kept.) */
  function autoFree() {
    var O = THREE.Object3D.prototype;
    if (O.__kqFree) return; O.__kqFree = true;
    var pending = [], queued = false, rm = O.remove;
    O.remove = function () {
      var r = rm.apply(this, arguments);
      for (var i = 0; i < arguments.length; i++) if (arguments[i] && arguments[i].isObject3D) pending.push(arguments[i]);
      if (!queued && pending.length) { queued = true; setTimeout(flush, 0); }
      return r;
    };
    function flush() {
      queued = false; var list = pending; pending = [];
      list.forEach(function (o) {
        if (o.parent) return;   // added back (moved or pooled) - keep it
        o.traverse(function (c) { if (c.geometry && c.geometry.dispose) c.geometry.dispose(); });
      });
    }
  }

  function renderer(el, o) {
    o = o || {};
    if (!window.THREE) { el.innerHTML = '<div class="k3nogl">Could not load the 3D engine. Please check your internet and try again.</div>'; return null; }
    autoFree();
    var r;
    try { r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch (e) { el.innerHTML = '<div class="k3nogl">This device can\'t show 3D games 😢<br>Try another game from the Game Zone!</div>'; return null; }
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (o.shadows) { r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; }
    el.appendChild(r.domElement);
    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(o.fov || 60, 1, 0.1, o.far || 300);
    function resize() {
      var w = el.clientWidth || innerWidth, h = el.clientHeight || innerHeight;
      r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      if (o.onResize) o.onResize(w, h);
    }
    window.addEventListener('resize', resize); resize();
    return { renderer: r, scene: scene, camera: cam, resize: resize };
  }

  var texCache = {};
  function emojiTexture(e, size) {
    size = size || 128;
    var key = e + size; if (texCache[key]) return texCache[key];
    var c = document.createElement('canvas'); c.width = c.height = size;
    var x = c.getContext('2d');
    x.font = Math.floor(size * 0.8) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(e, size / 2, size / 2 + size * 0.05);
    var t = new THREE.CanvasTexture(c);
    var img = new Image();
    img.onload = function () { x.clearRect(0, 0, size, size); x.drawImage(img, size * 0.04, size * 0.04, size * 0.92, size * 0.92); t.needsUpdate = true; };
    img.src = emojiFile(e);
    texCache[key] = t; return t;
  }
  function emojiSprite(e, s) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(e), transparent: true, depthWrite: false }));
    sp.scale.set(s || 1, s || 1, 1); return sp;
  }
  function toScreen(v, cam, el) {
    var p = v.clone().project(cam), r = el.getBoundingClientRect();
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  }
  // Swipe / tap helper: cb('left'|'right'|'up'|'down'|'tap', event)
  function swipe(el, cb) {
    var sx = 0, sy = 0, st = 0, done = false;
    el.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; st = Date.now(); done = false; });
    el.addEventListener('pointermove', function (e) {
      if (done || !st) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) { done = true; cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), e); }
    });
    el.addEventListener('pointerup', function (e) { if (!done && st && Date.now() - st < 400) cb('tap', e); st = 0; });
  }

  // ---- 2D canvas helpers (used by the arcade games)
  var imgCache = {};
  function img(e) {
    if (imgCache[e]) return imgCache[e];
    var im = new Image(); im.src = emojiFile(e); imgCache[e] = im; return im;
  }
  /* Emoji pictures are SVG files. Drawing an SVG on a canvas every frame makes
     Android WebView re-rasterise it each time (slow, and it can drop the
     picture for a frame = flicker). So each picture is rasterised once per size
     bucket into a small bitmap canvas and that bitmap is drawn instead. */
  var bmpCache = {};
  function bmp(e, im, px) {
    var b = px <= 48 ? 48 : px <= 96 ? 96 : px <= 160 ? 160 : px <= 256 ? 256 : 384, key = e + '@' + b, c = bmpCache[key];
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = b;
      try { c.getContext('2d').drawImage(im, 0, 0, b, b); } catch (err) { return im; }
      bmpCache[key] = c;
    }
    return c;
  }
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  // draw an emoji picture centred at x,y with size s (falls back to text until loaded)
  function drawPic(ctx, e, x, y, s, rot) {
    var im = img(e);
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    if (im.complete && im.naturalWidth) ctx.drawImage(bmp(e, im, s * DPR), -s / 2, -s / 2, s, s);
    else { ctx.font = Math.round(s * 0.85) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e, 0, s * 0.05); }
    ctx.restore();
  }
  // full-size hi-DPI canvas inside el; returns {cv, ctx, w, h} kept up to date on resize
  function canvas(el, onResize) {
    var cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none';
    el.appendChild(cv);
    var o = { cv: cv, ctx: cv.getContext('2d'), w: 0, h: 0 };
    function fit(first) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      o.w = el.clientWidth || innerWidth; o.h = el.clientHeight || innerHeight;
      cv.width = Math.round(o.w * dpr); cv.height = Math.round(o.h * dpr);
      o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (onResize && first !== true) onResize(o.w, o.h);
    }
    window.addEventListener('resize', fit); fit(true);
    return o;
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  window.KQ3D = { img: img, drawPic: drawPic, canvas: canvas, roundRect: roundRect, init: init, renderer: renderer, emojiTexture: emojiTexture, emojiSprite: emojiSprite, emojiFile: emojiFile, toScreen: toScreen, swipe: swipe, sfx: sfx, ROOT: ROOT };
})();

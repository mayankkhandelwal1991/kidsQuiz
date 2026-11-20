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
@media (min-width:700px){.k3pad{justify-content:center;gap:40vw}.k3pill{font-size:22px}}\
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

    function renderMute() { $('k3mute').textContent = muted() ? '🔇' : '🔊'; }
    renderMute();
    $('k3mute').onclick = function () { try { localStorage.setItem('kq_muted', muted() ? '0' : '1'); } catch (e) {} renderMute(); sfx('tap'); };
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

    function begin() {
      sfx('click');
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
          c.classList.remove('on'); G.state = 'play'; G.t0 = performance.now();
          var hint = $('k3hint'); if (hint) { hint.style.opacity = 1; setTimeout(function () { hint.style.opacity = 0; }, 3500); }
          if (cfg.onPlay) cfg.onPlay();
        }, 500);
      })();
    }
    G.restart = begin;

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
        $('k3home').onclick = function () { location.href = '../index.html'; };
      } else show(null);
      if (cfg.onPause) cfg.onPause(on);
    }
    G.pause = pause;
    document.addEventListener('visibilitychange', function () { if (document.hidden && G.state === 'play') pause(true); });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (G.state === 'play') pause(true); else if (G.state === 'pause') pause(false); }
      else if ((e.key === 'Enter' || e.key === ' ') && (G.state === 'menu' || G.state === 'over')) { e.preventDefault(); begin(); }
    });

    function setText(id, v) { var el = $(id); if (!el) return; el.lastChild.textContent = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    G.score = function (n) { if (n === G._score) return; G._score = n; setText('k3score', n); };
    G.hudSet = function (id, n) { setText('k3h_' + id, n); };
    G.pop = function (text, x, y, color) {
      var d = document.createElement('div'); d.className = 'k3pop'; d.textContent = text;
      d.style.left = (x == null ? innerWidth / 2 : x) + 'px'; d.style.top = (y == null ? innerHeight * 0.4 : y) + 'px';
      if (color) d.style.color = color;
      root.appendChild(d); setTimeout(function () { d.remove(); }, 1000);
    };
    G.flash = function (color) { var f = $('k3flash'); f.style.transition = 'none'; f.style.background = color || '#fff'; f.style.opacity = .55; void f.offsetWidth; f.style.transition = 'opacity .45s'; f.style.opacity = 0; };

    G.over = function (o) {
      if (G.state === 'over') return;
      G.state = 'over';
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
          '<div class="k3row"><button class="k3alt" id="k3lb">' + pic('🏆', 20) + ' Top players</button><button class="k3alt" id="k3home2">🏠 Games</button></div></div>';
        show('k3over');
        $('k3again').onclick = begin;
        $('k3home2').onclick = function () { location.href = '../index.html'; };
        $('k3lb').onclick = function () { if (window.KQ && KQ.open) KQ.open('single', cfg.id, cfg.title); else location.href = ROOT + 'leaderboard.html?cat=single'; };
        if (stars) { sfx(rec ? 'win' : 'success'); try { if (window.KQFX) KQFX.celebrate({ power: rec ? 1 : 0.5 }); } catch (e) {} }
        else sfx('lose');
      }, o.delay == null ? 900 : o.delay);
    };

    startScreen();
    show('k3start');
    if (/[?&]autoplay=1/.test(location.search)) setTimeout(begin, 300); // testing aids
    if (/[?&]testover=1/.test(location.search)) setTimeout(function () { G.over({ score: 345, lines: ['🧪 test'] }); }, 3800);
    return G;
  }

  // ---- three.js helpers
  function renderer(el, o) {
    o = o || {};
    if (!window.THREE) { el.innerHTML = '<div class="k3nogl">Could not load the 3D engine. Please check your internet and try again.</div>'; return null; }
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

  window.KQ3D = { init: init, renderer: renderer, emojiTexture: emojiTexture, emojiSprite: emojiSprite, emojiFile: emojiFile, toScreen: toScreen, swipe: swipe, sfx: sfx, ROOT: ROOT };
})();

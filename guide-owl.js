/* ============================================================
   GUIDE OWL — the home page owl that helps a child find new things.
   • Once a day, a moment after home opens: "Hi Aarav! Let's explore …"
   • After the child has been idle on home for a while: the next idea.
   • Prefers things this child has never tried (stories, rhymes, tracing,
     tables, Olympiad, friends, Fun zone …).
   Only on the home page — never inside a quiz, game, story or paper — and
   it waits while any popup, menu or name box is open.
   ============================================================ */
(function () {
  'use strict';
  if (window.KQGuide) return;
  var IDLE_MS = 40000, FIRST_MS = 2500, PER_VISIT = 3, PER_DAY = 8;
  var shownThisVisit = 0, idleTimer = null, el = null, current = null, nameFn = function () { return 'friend'; };

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsJ(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function setJ(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function today() { return new Date().toDateString(); }
  function day() { var s = lsJ('kq_owl_day', {}); if (s.d !== today()) s = { d: today(), n: 0, greeted: false }; return s; }
  function saveDay(s) { setJ('kq_owl_day', s); }
  function explored() { return lsJ('kq_owl_explored', {}); }
  function markExplored(id) { var e = explored(); e[id] = 1; setJ('kq_owl_explored', e); }
  function hasKey(prefix) { try { for (var i = 0; i < localStorage.length; i++) if ((localStorage.key(i) || '').indexOf(prefix) === 0) return true; } catch (e) {} return false; }
  function storiesRead() { return Object.keys(lsJ('kq_story_done', {})); }
  function lvl() { var l = parseInt(ls('kq_last_class'), 10); return isNaN(l) ? 0 : l; }
  function pre() { var l = lvl(); return l === 0 || l === -1; }

  // what the owl can suggest; tried() = this child already used it
  var IDEAS = [
    { id: 'stories', ic: '1f4d6', t: 'Story Time', say: 'listen to a picture story', go: 'stories/index.html', tried: function () { return storiesRead().some(function (k) { return !/^(twinkle|baa_baa|machli|humpty|johny|aloo|jack_jill|rain_rain|days_week|hickory|row_boat|months|itsy|old_mac|good_habits|planets|water_cycle_song|buckle|matter|india|body_song)/.test(k); }); } },
    { id: 'rhymes', ic: '1f3b5', t: 'Rhymes & Songs', say: 'sing a rhyme with me', go: function () { return 'stories/index.html#/r/' + lvl(); } },
    { id: 'tracing', ic: '270f', t: 'Letter Tracing', say: 'trace letters with your finger', go: 'games/word/tracing.html', tried: function () { return hasKey('kq_trace_pos_'); }, when: function () { return lvl() <= 2; } },
    { id: 'tables', ic: '2716', t: 'Times Tables', say: 'win stars on the times tables', go: 'games/brain/times_tables.html', tried: function () { return !!ls('kq_tt_stars'); }, when: function () { return lvl() >= 2; } },
    { id: 'phonics', ic: '1f50a', t: 'Phonics', say: 'play with letter sounds', go: function () { return 'quiz/play.html#/c/' + (pre() ? lvl() : 0) + '/k_phonics'; }, when: pre },
    { id: 'olympiad', ic: '1f3c5', t: 'Olympiad', say: 'try an Olympiad paper and win a certificate', go: 'Olympiad/index.html', tried: function () { return lsJ('olympiadHistory', []).length > 0; }, when: function () { return lvl() >= 1; } },
    { id: 'read', ic: '1f4da', t: 'Sight words', say: 'learn some new words to read', go: 'activities/read.html#go', tried: function () { return !!ls('kq_sight'); }, when: function () { return lvl() >= -1 && lvl() <= 2; } },
    { id: 'create', ic: '1f3a8', t: 'Creative corner', say: 'colour a picture or play music', go: 'activities/create.html', tried: function () { return !!ls('kq_drawing') || hasKey('kq_colour_'); } },
    { id: 'move', ic: '1f438', t: 'Move like an animal', say: 'hop like a frog and stretch like a giraffe', go: 'activities/move.html' },
    { id: 'friends', ic: '1f465', t: 'Play with Friends', say: 'play a game with a friend', go: 'multiplayer/index.html' },
    { id: 'path', ic: '1f5fa', t: 'My learning path', say: 'win stars on your learning map', fn: function () { if (window.KQPlay && KQPlay.openMap) KQPlay.openMap(); } },
    { id: 'qotd', ic: '2753', t: 'Question of the day', say: 'answer today’s question', fn: function () { if (window.KQPlay && KQPlay.openQotd) KQPlay.openQotd(); } },
    { id: 'league', ic: '1f3c6', t: 'Weekly league', say: 'see the weekly league', fn: function () { if (window.KQPlay && KQPlay.openLeague) KQPlay.openLeague(); } },
    { id: 'games3d', ic: '1f680', t: '3D Games', say: 'play a 3D game', go: 'games/index.html', tried: function () { return lsJ('kq_recent_games_single', []).length > 0; } },
    { id: 'badges', ic: '1f3c5', t: 'Badges', say: 'see which badges you can win', fn: function () { if (window.KQCoins && KQCoins.openBadges) KQCoins.openBadges(); } },
    { id: 'siblings', ic: '1f46a', t: 'Brother or sister?', say: 'add a profile for your brother or sister', fn: function () { if (window.KQProfiles) KQProfiles.open(); }, when: function () { return window.KQProfiles && !KQProfiles.isGoogle() && KQProfiles.list().length < 2; } },
  ];

  // learning ideas first, then the fun extras; rotate daily; skip what was said "Later" to today
  var LEARN = ['stories', 'rhymes', 'read', 'tracing', 'tables', 'phonics', 'olympiad'];
  function pick() {
    var ex = explored(), skip = day().skip || [], dayN = Math.floor(Date.now() / 86400000);
    var ok = IDEAS.filter(function (x) { return (!x.when || x.when()) && skip.indexOf(x.id) < 0 && (!current || x.id !== current.id); });
    var rot = function (a) { if (!a.length) return a; var k = dayN % a.length; return a.slice(k).concat(a.slice(0, k)); };
    var order = rot(ok.filter(function (x) { return LEARN.indexOf(x.id) >= 0; })).concat(rot(ok.filter(function (x) { return LEARN.indexOf(x.id) < 0; })));
    var fresh = order.filter(function (x) { return !ex[x.id] && !(x.tried && x.tried()); });
    if (fresh.length) return fresh[0];
    return order[Math.floor(Math.random() * order.length)];
  }

  // never interrupt: home must be the thing on screen, with no popup over it
  function free() {
    if (document.hidden) return false;
    var menu = document.getElementById('menuScreen');
    if (!menu || menu.classList.contains('hidden')) return false;
    var c = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    if (!c || !menu.contains(c)) return false;
    var acts = document.getElementById('hmActions'); if (acts && acts.classList.contains('open')) return false;
    return true;
  }

  function css() {
    if (document.getElementById('kqgo-css')) return;
    var st = document.createElement('style'); st.id = 'kqgo-css';
    st.textContent =
      '.kqgo{position:fixed;right:10px;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:60;display:flex;align-items:flex-end;gap:6px;max-width:min(360px,calc(100vw - 20px));font-family:"Baloo 2",system-ui,sans-serif;animation:kqgoIn .45s cubic-bezier(.34,1.56,.64,1)}' +
      '.kqgo.out{animation:kqgoOut .3s ease-in forwards}' +
      '@keyframes kqgoIn{from{transform:translateY(40px) scale(.6);opacity:0}}@keyframes kqgoOut{to{transform:translateY(40px) scale(.6);opacity:0}}' +
      '.kqgo-b{position:relative;flex:1;min-width:0;background:#fff;border-radius:22px 22px 6px 22px;padding:10px 12px;box-shadow:0 12px 30px rgba(30,27,75,.28);color:#1e1b4b}' +
      '.kqgo-b .h{display:flex;align-items:center;gap:8px}.kqgo-b .h img{width:38px;height:38px;flex:0 0 auto}' +
      '.kqgo-b b{display:block;font-size:15px;line-height:1.2}.kqgo-b small{display:block;font-size:12.5px;font-weight:700;color:#6b7280;line-height:1.2}' +
      '.kqgo-r{display:flex;gap:6px;margin-top:8px}.kqgo-r button{flex:1;border:none;border-radius:14px;padding:8px 6px;font:800 14px "Baloo 2",sans-serif;cursor:pointer}' +
      '.kqgo-go{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;box-shadow:0 3px 0 #15803d}.kqgo-no{background:#f1f5f9;color:#475569}' +
      '.kqgo-x{position:absolute;top:-8px;right:-6px;width:26px;height:26px;border-radius:50%;border:none;background:#ede9fe;color:#4c1d95;font-weight:900;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.15)}' +
      '.kqgo-owl{width:74px;height:74px;flex:0 0 auto;filter:drop-shadow(0 6px 8px rgba(0,0,0,.25));animation:kqgoBob 2.4s ease-in-out infinite;cursor:pointer}' +
      '@keyframes kqgoBob{50%{transform:translateY(-6px) rotate(-4deg)}}' +
      '@media (min-width:760px){.kqgo{bottom:110px;right:calc(50% - 270px)}}' +
      '@media (prefers-reduced-motion:reduce){.kqgo,.kqgo-owl{animation:none}}';
    document.head.appendChild(st);
  }
  var OWL = '<svg class="kqgo-owl" viewBox="0 0 120 120" aria-hidden="true"><path d="M30 30 L40 12 L50 30Z" fill="#7c3aed"/><path d="M70 30 L80 12 L90 30Z" fill="#7c3aed"/><ellipse cx="60" cy="70" rx="42" ry="44" fill="#8b5cf6"/><ellipse cx="60" cy="82" rx="26" ry="28" fill="#ede9fe"/><path d="M18 66 Q8 86 26 100 Q30 82 24 66Z" fill="#7c3aed"/><path d="M102 60 Q118 44 112 26 Q100 40 96 60Z" fill="#7c3aed"/><circle cx="44" cy="50" r="17" fill="#fff"/><circle cx="76" cy="50" r="17" fill="#fff"/><circle cx="46" cy="51" r="8" fill="#1e1b4b"/><circle cx="74" cy="51" r="8" fill="#1e1b4b"/><circle cx="49" cy="48" r="3" fill="#fff"/><circle cx="77" cy="48" r="3" fill="#fff"/><path d="M54 62 L66 62 L60 72Z" fill="#f59e0b"/><path d="M38 24 Q60 0 82 24Z" fill="#facc15"/><circle cx="60" cy="8" r="5" fill="#f43f5e"/></svg>';

  function hide(dismissed) {
    if (!el) return;
    if (dismissed && current) { var d = day(); d.skip = (d.skip || []).concat(current.id); saveDay(d); }
    var e = el; el = null; e.classList.add('out'); setTimeout(function () { e.remove(); }, 320);
    if (dismissed) armIdle();
  }
  function go(idea) {
    markExplored(idea.id); hide(false);
    if (idea.fn) { idea.fn(); armIdle(); return; }
    location.href = typeof idea.go === 'function' ? idea.go() : idea.go;
  }
  function show(greet) {
    if (el || !free()) { armIdle(); return; }
    var d = day(); if (d.n >= PER_DAY || shownThisVisit >= PER_VISIT) return;
    var idea = pick(); if (!idea) return;
    current = idea; shownThisVisit++; d.n++; if (greet) d.greeted = true; saveDay(d);
    css();
    var nm = nameFn(), h = new Date().getHours();
    var line = greet ? (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ', ' + nm + '! Let’s ' + idea.say + '!'
      : nm + ', let’s ' + idea.say + '!';
    el = document.createElement('div'); el.className = 'kqgo'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Owl guide');
    el.innerHTML = '<div class="kqgo-b"><button class="kqgo-x" aria-label="Close">×</button><div class="h"><img src="images/emoji/' + idea.ic + '.svg" alt=""><span><b>' + line.replace(/[<>&]/g, '') + '</b><small>Explore: ' + idea.t + '</small></span></div>' +
      '<div class="kqgo-r"><button class="kqgo-go">Let’s go! ▶</button><button class="kqgo-no">Later</button></div></div>' + OWL;
    document.body.appendChild(el);
    el.querySelector('.kqgo-go').onclick = function () { go(idea); };
    el.querySelector('.kqgo-no').onclick = function () { hide(true); };
    el.querySelector('.kqgo-x').onclick = function () { hide(true); };
    el.querySelector('.kqgo-owl').onclick = function () { say(line); };
    say(line);
    // goes away by itself if the child keeps playing around
    var mine = el; setTimeout(function () { if (el === mine) hide(true); }, 20000);
  }
  function say(t) { try { if (typeof speak === 'function') speak(t, { raw: false, rate: 0.95, pitch: 1.25 }); } catch (e) {} }
  function armIdle() {
    clearTimeout(idleTimer);
    if (shownThisVisit >= PER_VISIT) return;
    idleTimer = setTimeout(function () { show(false); }, IDLE_MS);
  }
  function start(opts) {
    opts = opts || {};
    if (opts.name) nameFn = opts.name;
    ['pointerdown', 'keydown', 'scroll'].forEach(function (ev) { window.addEventListener(ev, function () { if (!el) armIdle(); }, { passive: true }); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { clearTimeout(idleTimer); hide(false); } else armIdle(); });
    var d = day();
    if (!d.greeted) setTimeout(function () { show(true); }, FIRST_MS); else armIdle();
  }

  window.KQGuide = { start: start, show: show, hide: hide };
})();

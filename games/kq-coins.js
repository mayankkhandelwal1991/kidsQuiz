/* ============================================================
   KQCoins — coins + achievements (controlled from the admin console)
   ------------------------------------------------------------
   Admin console -> 🪙 Coins (Firebase config/app/coins):
     enabled      false = no coins anywhere, nothing is charged
     signupBonus  coins a new player starts with
     earn.{quiz,single,multi,olympiad}   coins for finishing one
     cost.{quiz,single,multi,olympiad}   coins to start one
     items.{"<section>/<id>"}            price for one quiz/game/subject
   Wallet: Firebase wallets/<player> { coins, earned, spent, stats, ach }.
   Not enough coins -> "Watch a video to play" (Android rewarded video, else
   rewarded interstitial). No video available / website -> they can play anyway
   (kids are never stuck).

   API: KQCoins.gate(section, id, start, onCancel)   KQCoins.earn(section, id)
        KQCoins.balance()  KQCoins.enabled()  KQCoins.price(section, id)
        KQCoins.mountChip(el)  KQCoins.openBadges()
   ============================================================ */
(function () {
  'use strict';
  if (window.KQCoins) return;

  var SECTIONS = ['quiz', 'single', 'multi', 'olympiad'];
  var DEF = {
    enabled: false, signupBonus: 100,
    requireGames: null, requireQuiz: null,   // separate admin switches; null = follow "enabled"
    earn: { quiz: 10, single: 10, multi: 10, olympiad: 20 },
    cost: { quiz: 5, single: 5, multi: 5, olympiad: 10 },
    items: {}
  };
  var ACH = [
    { id: 'first',    icon: '🌟', title: 'First step',      desc: 'Finish your first quiz or game',      coins: 20,  goal: function (s) { return [s.total, 1]; } },
    { id: 'quiz5',    icon: '🎯', title: 'Quiz kid',        desc: 'Finish 5 quizzes',                    coins: 30,  goal: function (s) { return [s.plays.quiz, 5]; } },
    { id: 'games10',  icon: '🎮', title: 'Game fan',        desc: 'Finish 10 games',                     coins: 30,  goal: function (s) { return [s.plays.single, 10]; } },
    { id: 'olympiad', icon: '🏅', title: 'Olympiad star',   desc: 'Finish an Olympiad paper',            coins: 40,  goal: function (s) { return [s.plays.olympiad, 1]; } },
    { id: 'friends',  icon: '👥', title: 'Team player',     desc: 'Play a game with friends',            coins: 30,  goal: function (s) { return [s.plays.multi, 1]; } },
    { id: 'explorer', icon: '🧭', title: 'Explorer',        desc: 'Play in all 4 sections',              coins: 60,  goal: function (s) { return [SECTIONS.filter(function (k) { return s.plays[k] > 0; }).length, 4]; } },
    { id: 'plays50',  icon: '🚀', title: 'Super player',    desc: 'Finish 50 quizzes and games',         coins: 100, goal: function (s) { return [s.total, 50]; } },
    { id: 'streak3',  icon: '🔥', title: '3-day streak',    desc: 'Play 3 days in a row',                coins: 50,  goal: function (s) { return [s.best, 3]; } },
    { id: 'streak7',  icon: '🏆', title: '7-day streak',    desc: 'Play 7 days in a row',                coins: 150, goal: function (s) { return [s.best, 7]; } },
    { id: 'rich500',  icon: '💰', title: 'Coin collector',  desc: 'Collect 500 coins',                   coins: 50,  goal: function (s, w) { return [w.earned || 0, 500]; } }
  ];

  var W = null, KEY = '', listeners = [], lastEarn = {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var dayKey = function (t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  function cfg() {
    var c = (window.KQ && KQ.appConfig && (KQ.appConfig() || {}).coins) || {};
    var o = JSON.parse(JSON.stringify(DEF));
    Object.keys(c).forEach(function (k) { o[k] = (c[k] && typeof c[k] === 'object' && !Array.isArray(c[k])) ? Object.assign({}, o[k] || {}, c[k]) : c[k]; });
    return o;
  }
  // Two admin switches: games (single-player + multiplayer) and quizzes (quiz,
  // picture papers, Olympiad). Older settings with one "enabled" switch still work.
  var GROUP = { single: 'requireGames', multi: 'requireGames', quiz: 'requireQuiz', olympiad: 'requireQuiz' };
  function enabledFor(sec) { var c = cfg(), v = c[GROUP[sec]]; return v == null ? c.enabled === true : v === true; }
  function enabled() { return enabledFor('single') || enabledFor('quiz'); }   // coins used anywhere
  function price(sec, id) {
    var c = cfg(), k = sec + '/' + id;
    if (id != null && c.items && c.items[k] != null && c.items[k] !== '') return Math.max(0, +c.items[k] || 0);
    return Math.max(0, +((c.cost || {})[sec]) || 0);
  }
  function reward(sec) { return Math.max(0, +((cfg().earn || {})[sec]) || 0); }

  function blank() { return { coins: 0, earned: 0, spent: 0, stats: { plays: { quiz: 0, single: 0, multi: 0, olympiad: 0 }, total: 0, day: '', streak: 0, best: 0 }, ach: {} }; }
  function norm(w) {
    var b = blank(); w = w || {};
    w.coins = Math.max(0, +w.coins || 0); w.earned = +w.earned || 0; w.spent = +w.spent || 0;
    w.stats = Object.assign(b.stats, w.stats || {}); w.stats.plays = Object.assign(b.stats.plays, (w.stats || {}).plays || {});
    w.ach = w.ach || {};
    w.log = Array.isArray(w.log) ? w.log.filter(Boolean) : (w.log && typeof w.log === 'object' ? Object.keys(w.log).sort(function (a, b) { return a - b; }).map(function (k) { return w.log[k]; }) : []);
    return w;
  }
  function saveLocal() { try { if (KEY && W) localStorage.setItem('kq_wallet_' + KEY, JSON.stringify(W)); } catch (e) {} }
  function db() { try { return firebase.database(); } catch (e) { return null; } }
  function notify() { listeners.forEach(function (f) { try { f(W); } catch (e) {} }); renderChips(); }

  /* Load (or create with the signup bonus) the wallet of the current player. */
  function load() {
    if (!window.KQ || !KQ.ready) return;
    KQ.ready.then(function () {
      var u = KQ.user(); if (!u || !u.key) return;
      if (u.key === KEY && W) return;
      KEY = u.key;
      var local = null;
      try { local = JSON.parse(localStorage.getItem('kq_wallet_' + KEY) || 'null'); } catch (e) {}
      if (local) W = norm(local);
      else {                                       // new on this device: start with the signup bonus
        W = norm(null); W.coins = Math.max(0, +cfg().signupBonus || 0); W.created = Date.now(); W.name = u.name || '';
        addLog(W, W.coins, '🎁 Welcome bonus');
        saveLocal();
      }
      notify();
      var d = db(); if (!d) return;
      d.ref('wallets/' + KEY).transaction(function (cur) {
        if (cur) return cur;                       // wallet already in Firebase (other device): use it
        return JSON.parse(JSON.stringify(W));      // new player: this device's wallet (with the bonus)
      }).then(function (r) {
        if (r && r.snapshot && r.snapshot.val()) {
          var fresh = !!(r.committed && r.snapshot.val().created && Date.now() - r.snapshot.val().created < 15000);
          W = norm(r.snapshot.val()); saveLocal(); notify();
          if (fresh && enabled() && W.coins > 0) toast('🎁 Welcome! You got ' + W.coins + ' coins', true);
        }
      }).catch(function () {});
    });
  }
  /* Coin history: last LOG_MAX changes { t: time, d: +/- coins, n: what for }. */
  var LOG_MAX = 40;
  function addLog(w, d, n, t) { if (!d) return; w.log.push({ t: t || Date.now(), d: d, n: String(n || '').slice(0, 60) }); if (w.log.length > LOG_MAX) w.log = w.log.slice(-LOG_MAX); }
  var SEC_NAME = { quiz: 'Quiz', single: 'Game', multi: 'Multiplayer', olympiad: 'Olympiad' };
  function nice(sec, id) { var t = document.title && document.title.split(/[|·–-]/)[0].trim(); return (SEC_NAME[sec] || sec) + ': ' + (id ? String(id).replace(/[-_]/g, ' ') : (t || '')); }

  /* Change coins (+ earn / - spend) and stats in one Firebase transaction.
     label = what it was for (coin history). */
  function change(delta, kind, mutate, label) {
    var t0 = Date.now();
    if (!W) W = norm(null);
    var apply = function (w) {
      w = norm(w);
      var before = w.coins;
      w.coins = Math.max(0, w.coins + delta);
      addLog(w, w.coins - before, label, t0);
      if (delta > 0 && kind !== 'reward') w.earned += delta;
      if (delta < 0) w.spent += -delta;
      if (mutate) mutate(w);
      w.updatedAt = Date.now();
      return w;
    };
    W = apply(JSON.parse(JSON.stringify(W))); saveLocal(); notify();
    var d = db(); if (!d || !KEY) return;
    d.ref('wallets/' + KEY).transaction(function (cur) { return apply(cur || blank()); })
      .then(function (r) { if (r && r.snapshot && r.snapshot.val()) { W = norm(r.snapshot.val()); saveLocal(); notify(); } })
      .catch(function () {});
  }

  /* Finished a quiz / game / paper / match: coins + stats + achievements. */
  // Achievements + streaks are always tracked (also with coins off);
  // coins are only earned / shown when coins are used.
  function earn(sec, id) {
    if (SECTIONS.indexOf(sec) < 0) return;
    var k = sec + '/' + id, now = Date.now();
    if (lastEarn[k] && now - lastEarn[k] < 4000) return;   // same finish reported twice
    lastEarn[k] = now;
    var useCoins = enabled(), amount = useCoins ? reward(sec) : 0, unlocked = [];
    change(amount, 'earn', function (w) {
      var s = w.stats; s.plays[sec] = (s.plays[sec] || 0) + 1; s.total = (s.total || 0) + 1;
      var today = dayKey(now), yest = dayKey(now - 86400000);
      if (s.day !== today) { s.streak = s.day === yest ? (s.streak || 0) + 1 : 1; s.day = today; }
      s.best = Math.max(s.best || 0, s.streak || 0);
      ACH.forEach(function (a) {
        if (w.ach[a.id]) return;
        var g = a.goal(s, w);
        if (g[0] >= g[1]) { w.ach[a.id] = now; if (useCoins) { w.coins += a.coins; w.earned += a.coins; addLog(w, a.coins, a.icon + ' ' + a.title, now + 1); } unlocked.push(a); }
      });
    }, '✅ ' + nice(sec, id));
    if (amount) toast('+' + amount + ' 🪙', false);
    unlocked.forEach(function (a, i) { setTimeout(function () { toast(a.icon + ' Achievement: ' + a.title + (useCoins ? '  +' + a.coins + ' 🪙' : ''), true); }, 1200 + i * 1800); });
  }

  /* Start a quiz/game: free when coins are off; otherwise pay, or watch a video. */
  function gate(sec, id, start, onCancel) {
    if (!enabledFor(sec)) { start(); return; }
    var p = price(sec, id);
    if (p <= 0) { start(); return; }
    if (!W) { start(); return; }                           // wallet not loaded yet: don't block
    if (W.coins >= p) { change(-p, 'spend', null, '▶️ ' + nice(sec, id)); toast('−' + p + ' 🪙', false); start(); return; }
    askVideo(sec, id, p, start, onCancel);
  }

  var pendingReward = {};
  window.onRewardResult = function (token, status) { var f = pendingReward[token]; delete pendingReward[token]; if (f) f(status); };
  function inApp() { try { return typeof Android !== 'undefined' && Android && typeof Android.showRewardFor === 'function'; } catch (e) { return false; } }

  function askVideo(sec, id, p, start, onCancel) {
    css();
    var box = document.createElement('div'); box.className = 'kqc-ov';
    var have = W ? W.coins : 0;
    box.innerHTML = '<div class="kqc-card"><div class="kqc-big">🪙</div><h3>You need ' + p + ' coins</h3>' +
      '<p>You have <b>' + have + '</b>. Finish quizzes and games to earn more!</p>' +
      '<button class="kqc-go" data-a="video">▶️ Watch a video to play</button>' +
      '<button class="kqc-alt" data-a="back">Not now</button><div class="kqc-msg"></div></div>';
    document.body.appendChild(box);
    var msg = box.querySelector('.kqc-msg'), go = box.querySelector('[data-a=video]');
    var close = function () { box.remove(); };
    box.querySelector('[data-a=back]').onclick = function () { close(); if (onCancel) onCancel(); };
    go.onclick = function () {
      if (!inApp()) { close(); start(); return; }          // website: no reward videos -> play
      go.disabled = true; go.textContent = 'Loading video…';
      var token = 'r' + Date.now().toString(36);
      var done = false;
      pendingReward[token] = function (status) {
        done = true;
        if (status === 'earned') {                       // watched: cover the price and play
          change(Math.max(0, p - (W ? W.coins : 0)), 'reward', null, '📺 Watched a video');
          change(-p, 'spend', null, '▶️ ' + nice(sec, id)); close(); start();
        } else if (status === 'none') {                  // no video right now: play anyway
          close(); start();
        } else {                                         // closed early
          go.disabled = false; go.textContent = '▶️ Watch a video to play';
          msg.textContent = 'Watch the video to the end to play 🙂';
        }
      };
      try { Android.showRewardFor(token); } catch (e) { delete pendingReward[token]; close(); start(); }
      setTimeout(function () { if (!done && pendingReward[token]) { delete pendingReward[token]; close(); start(); } }, 90000);
    };
  }

  /* ---------- UI: coin chip, price tags, toasts, badges ---------- */
  var BASE = (function () { var sc = document.currentScript && document.currentScript.src; return sc ? sc.replace(/[^/]*$/, '') : ''; })();
  var COIN_SRC = BASE + '../images/emoji/1fa99.svg';   // gold coin
  function coinImg(size) { return '<img src="' + COIN_SRC + '" alt="coins" width="' + size + '" height="' + size + '" style="width:' + size + 'px;height:' + size + 'px;vertical-align:middle">'; }

  /* Price tag on every card marked data-kq-cost="<section>/<id>" (games hub,
     multiplayer hub, quiz categories, picture-quiz topics, Olympiad subjects).
     Only when coins are required for that kind (games / quizzes). */
  function tagCards(root) {
    if (!document.body) return; css();
    (root || document).querySelectorAll('[data-kq-cost]').forEach(function (el) {
      var k = el.getAttribute('data-kq-cost') || '', i = k.indexOf('/'), sec = k.slice(0, i), id = k.slice(i + 1);
      var tag = el.querySelector(':scope > .kqc-cost');
      var p = enabledFor(sec) ? price(sec, id) : 0;
      if (!p) { if (tag) tag.remove(); return; }
      if (!tag) {
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        tag = document.createElement('span'); tag.className = 'kqc-cost'; el.appendChild(tag);
      }
      var win = reward(sec);
      tag.innerHTML = coinImg(16) + '<b>' + p + '</b>' + (win ? '<i>+' + win + '</i>' : '');
      tag.title = p + ' coins to play' + (win ? ', win ' + win + ' coins for finishing' : '');
    });
  }
  var tagTimer = 0;
  function tagSoon() { clearTimeout(tagTimer); tagTimer = setTimeout(function () { tagCards(); }, 60); }
  function watchCards() {
    if (!document.body || watchCards.on) return; watchCards.on = true;
    try { new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) if (ms[i].addedNodes.length) { tagSoon(); return; } }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    tagSoon();
  }

  var badgeBtns = [];
  function mountBadges(el) {
    if (!el) return; css();
    var b = document.createElement('button'); b.type = 'button'; b.className = 'kqc-chip kqc-badges'; b.title = 'My achievements'; b.setAttribute('aria-label', 'My achievements');
    b.onclick = openBadges; badgeBtns.push(b); el.insertBefore(b, el.firstChild); renderChips();
  }

  function css() {
    if (document.getElementById('kqc-css')) return;
    var st = document.createElement('style'); st.id = 'kqc-css';
    st.textContent =
      '.kqc-chip{display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 12px;border:0;border-radius:14px;background:rgba(255,255,255,.92);color:#92400e;font:800 15px "Baloo 2",system-ui,sans-serif;box-shadow:0 4px 0 rgba(146,64,14,.22);cursor:pointer}' +
      '.kqc-chip:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(146,64,14,.22)}' +
      '.kqc-toast{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483640;background:#fff7d6;color:#7c2d12;border:2px solid #fcd34d;border-radius:999px;padding:8px 16px;font:800 15px "Baloo 2",system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);animation:kqcin .35s ease-out;pointer-events:none;max-width:calc(100% - 24px);text-align:center}' +
      '.kqc-toast.big{font-size:17px;padding:10px 20px}@keyframes kqcin{from{transform:translate(-50%,-30px);opacity:0}}' +
      '.kqc-ov{position:fixed;inset:0;z-index:2147483641;background:rgba(15,10,40,.6);display:flex;align-items:center;justify-content:center;padding:16px}' +
      '.kqc-card{background:#fff;color:#1e1b4b;border-radius:26px;padding:22px 18px;width:100%;max-width:360px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:"Baloo 2",system-ui,sans-serif;max-height:90vh;overflow:auto}' +
      '.kqc-card h3{margin:6px 0 4px;font-size:22px}.kqc-card p{margin:0 0 14px;color:#6b7280;font-weight:700}.kqc-big{font-size:46px;line-height:1}' +
      '.kqc-go{width:100%;border:0;border-radius:16px;padding:13px;font:800 17px "Baloo 2",system-ui,sans-serif;background:#16a34a;color:#fff;box-shadow:0 5px 0 #15803d;cursor:pointer}' +
      '.kqc-go:disabled{opacity:.7}.kqc-alt{width:100%;margin-top:10px;border:0;border-radius:14px;padding:10px;font:800 15px "Baloo 2",system-ui,sans-serif;background:#f1f5f9;color:#334155;cursor:pointer}' +
      '.kqc-msg{margin-top:10px;color:#b45309;font-weight:800;min-height:1em}' +
      '.kqc-ach{display:flex;align-items:center;gap:10px;text-align:left;padding:8px 10px;border-radius:14px;margin:6px 0;background:#f8fafc}' +
      '.kqc-ach.on{background:#fef9c3}.kqc-ach .i{font-size:28px;width:36px;text-align:center}.kqc-ach .t{flex:1;min-width:0}.kqc-ach b{display:block}' +
      '.kqc-ach small{color:#6b7280;font-weight:700}.kqc-bar{height:6px;border-radius:6px;background:#e5e7eb;margin-top:4px;overflow:hidden}.kqc-bar i{display:block;height:100%;background:#f59e0b}' +
      '.kqc-ach .c{font-weight:800;color:#92400e;white-space:nowrap}' +
      '.kqc-cost{position:absolute;right:8px;bottom:8px;z-index:2;display:inline-flex;align-items:center;gap:3px;padding:2px 8px 2px 4px;border-radius:999px;background:#fffbeb;border:2px solid #fcd34d;color:#92400e;font:800 13px/1.3 "Baloo 2",system-ui,sans-serif;box-shadow:0 2px 6px rgba(146,64,14,.18);pointer-events:none}' +
      '.kqc-cost img{width:16px;height:16px}.kqc-cost i{font-style:normal;margin-left:3px;padding:0 5px;border-radius:999px;background:#dcfce7;color:#166534;font-size:11px}' +
      '.kqc-tabs{display:flex;gap:6px;justify-content:center;margin:8px 0}.kqc-tabs button{border:0;border-radius:999px;padding:6px 14px;font:800 14px "Baloo 2",system-ui,sans-serif;background:#f1f5f9;color:#334155;cursor:pointer}.kqc-tabs button.on{background:#f59e0b;color:#fff}' +
      '.kqc-log{display:flex;align-items:center;gap:8px;text-align:left;padding:7px 10px;border-radius:12px;margin:4px 0;background:#f8fafc}.kqc-log .t{flex:1;min-width:0;font-weight:700}.kqc-log small{display:block;color:#6b7280;font-weight:600}.kqc-log .d{font-weight:800;white-space:nowrap}.kqc-log .d.p{color:#16a34a}.kqc-log .d.m{color:#dc2626}.kqc-badges .n{font-size:12px;opacity:.85}';
    document.head.appendChild(st);
  }
  function toast(text, big) {
    if (!document.body) return; css();
    var t = document.createElement('div'); t.className = 'kqc-toast' + (big ? ' big' : ''); t.textContent = text;
    document.body.appendChild(t); setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, big ? 2600 : 1400);
    setTimeout(function () { t.remove(); }, big ? 3100 : 1900);
  }
  var chips = [];
  function mountChip(el) {
    if (!el) return; css();
    var b = document.createElement('button'); b.type = 'button'; b.className = 'kqc-chip'; b.title = 'My coins & badges';
    b.onclick = openBadges; chips.push(b); el.insertBefore(b, el.firstChild); renderChips();
  }
  function renderChips() {
    chips.forEach(function (b) { b.style.display = enabled() ? '' : 'none'; b.innerHTML = coinImg(22) + ' ' + (W ? W.coins : '…'); });
    var got = W ? Object.keys(W.ach || {}).length : 0;
    badgeBtns.forEach(function (b) { b.innerHTML = '🏅 <span class="n">' + got + '/' + ACH.length + '</span>'; });
    tagSoon();
  }
  function openBadges() {
    css();
    var w = W || norm(null), s = w.stats, got = ACH.filter(function (a) { return w.ach[a.id]; }).length;
    var box = document.createElement('div'); box.className = 'kqc-ov';
    var coinsOn = enabled();
    box.innerHTML = '<div class="kqc-card"><div class="kqc-big">' + (coinsOn ? coinImg(44) : '🏅') + '</div><h3>' + (coinsOn ? w.coins + ' coins' : 'My achievements') + '</h3>' +
      '<p>' + (coinsOn ? 'Earned ' + w.earned + ' · ' : '') + got + ' / ' + ACH.length + ' badges · 🔥 ' + (s.streak || 0) + '-day streak</p>' +
      (coinsOn ? '<div class="kqc-tabs"><button class="on" data-tab="b">🏅 Badges</button><button data-tab="h">📜 Coin history</button></div>' +
        '<div data-pane="h" style="display:none">' + (w.log.length ? w.log.slice().reverse().map(function (e) {
          var d = new Date(e.t || 0);
          return '<div class="kqc-log"><span class="t">' + esc(e.n || (e.d > 0 ? 'Coins' : 'Played')) + '<small>' + d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</small></span>' +
            '<span class="d ' + (e.d > 0 ? 'p' : 'm') + '">' + (e.d > 0 ? '+' : '−') + Math.abs(e.d) + ' 🪙</span></div>';
        }).join('') : '<p>No coins earned or spent yet.</p>') + '</div>' : '') +
      '<div data-pane="b">' + ACH.map(function (a) {
        var g = a.goal(s, w), on = !!w.ach[a.id], pct = Math.min(100, Math.round(g[0] / g[1] * 100));
        return '<div class="kqc-ach' + (on ? ' on' : '') + '"><span class="i">' + (on ? a.icon : '🔒') + '</span><span class="t"><b>' + esc(a.title) + '</b><small>' + esc(a.desc) + '</small>' +
          (on ? '' : '<span class="kqc-bar"><i style="width:' + pct + '%"></i></span>') + '</span><span class="c">' + (on ? '✅' : (coinsOn ? '+' + a.coins + ' 🪙' : '')) + '</span></div>';
      }).join('') + '</div>' +
      '<button class="kqc-alt" data-a="close" style="margin-top:12px">Close</button></div>';
    box.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () {
      box.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('on', x === b); });
      box.querySelectorAll('[data-pane]').forEach(function (p) { p.style.display = p.getAttribute('data-pane') === b.getAttribute('data-tab') ? '' : 'none'; });
    }; });
    box.onclick = function (e) { if (e.target === box || (e.target.getAttribute && e.target.getAttribute('data-a') === 'close')) box.remove(); };
    document.body.appendChild(box);
  }

  if (window.KQ && KQ.onAuth) KQ.onAuth(function () { load(); });
  if (window.KQ && KQ.onConfig) KQ.onConfig(function () { renderChips(); });
  load();
  if (document.body) watchCards(); else document.addEventListener('DOMContentLoaded', watchCards);

  window.KQCoins = {
    gate: gate, earn: earn, enabled: enabled, price: price, balance: function () { return W ? W.coins : 0; },
    wallet: function () { return W; }, onChange: function (f) { listeners.push(f); }, mountChip: mountChip, mountBadges: mountBadges, openBadges: openBadges, enabledFor: enabledFor, tagCards: tagCards, coinImg: coinImg,
    achievements: ACH, defaults: DEF
  };
})();

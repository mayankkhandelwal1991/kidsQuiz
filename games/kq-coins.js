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
  /* Achievements (54). Keep existing ids: wallets store unlocked ids. */
  function A(id, icon, title, desc, coins, goal) { return { id: id, icon: icon, title: title, desc: desc, coins: coins, goal: goal }; }
  function P(sec) { return function (s) { return s.plays[sec] || 0; }; }
  function tier(list, val) { return list.map(function (x) { return A(x[0], x[1], x[2], x[3], x[4], function (s, w) { return [val(s, w), x[5]]; }); }); }
  var ACH = [].concat(
    // Everything finished (quizzes + games + papers + matches)
    tier([['first', '🌟', 'First step', 'Finish your first quiz or game', 20, 1],
          ['total10', '✨', 'Getting started', 'Finish 10 quizzes and games', 30, 10],
          ['total25', '🎈', 'On a roll', 'Finish 25 quizzes and games', 50, 25],
          ['plays50', '🚀', 'Super player', 'Finish 50 quizzes and games', 100, 50],
          ['total100', '💯', 'Century', 'Finish 100 quizzes and games', 150, 100],
          ['total250', '🌈', 'Unstoppable', 'Finish 250 quizzes and games', 250, 250],
          ['total500', '👑', 'Champion', 'Finish 500 quizzes and games', 400, 500],
          ['total1000', '🏰', 'Legend', 'Finish 1000 quizzes and games', 800, 1000]], function (s) { return s.total || 0; }),
    // Quizzes
    tier([['quiz1', '❓', 'First quiz', 'Finish your first quiz', 10, 1],
          ['quiz5', '🎯', 'Quiz kid', 'Finish 5 quizzes', 30, 5],
          ['quiz10', '📝', 'Quiz fan', 'Finish 10 quizzes', 40, 10],
          ['quiz25', '🧠', 'Brainy', 'Finish 25 quizzes', 60, 25],
          ['quiz50', '🎓', 'Quiz master', 'Finish 50 quizzes', 100, 50],
          ['quiz100', '📚', 'Bookworm', 'Finish 100 quizzes', 200, 100],
          ['quiz250', '🦉', 'Wise owl', 'Finish 250 quizzes', 400, 250]], P('quiz')),
    // Single-player games
    tier([['game1', '🕹️', 'Player one', 'Finish your first game', 10, 1],
          ['game5', '🎲', 'Game time', 'Finish 5 games', 20, 5],
          ['games10', '🎮', 'Game fan', 'Finish 10 games', 30, 10],
          ['game25', '👾', 'Gamer', 'Finish 25 games', 60, 25],
          ['game50', '🏎️', 'Speedy', 'Finish 50 games', 100, 50],
          ['game100', '🦸', 'Game hero', 'Finish 100 games', 200, 100],
          ['game250', '🐉', 'Game dragon', 'Finish 250 games', 400, 250]], P('single')),
    // Multiplayer
    tier([['friends', '👥', 'Team player', 'Play a game with friends', 30, 1],
          ['multi5', '🤝', 'Good friend', 'Play 5 games with friends', 40, 5],
          ['multi10', '🎉', 'Party time', 'Play 10 games with friends', 60, 10],
          ['multi25', '🥳', 'Party star', 'Play 25 games with friends', 100, 25],
          ['multi50', '🎪', 'Best buddies', 'Play 50 games with friends', 200, 50]], P('multi')),
    // Olympiad
    tier([['olympiad', '🏅', 'Olympiad star', 'Finish an Olympiad paper', 40, 1],
          ['oly3', '🥉', 'Bronze', 'Finish 3 Olympiad papers', 50, 3],
          ['oly5', '🥈', 'Silver', 'Finish 5 Olympiad papers', 80, 5],
          ['oly10', '🥇', 'Gold', 'Finish 10 Olympiad papers', 150, 10],
          ['oly25', '🏆', 'Olympiad champ', 'Finish 25 Olympiad papers', 300, 25]], P('olympiad')),
    // Everything
    [A('explorer', '🧭', 'Explorer', 'Play in all 4 sections', 60, function (s) { return [SECTIONS.filter(function (k) { return s.plays[k] > 0; }).length, 4]; }),
     A('allround', '🌍', 'All-rounder', 'Finish 5 in every section', 150, function (s) { return [SECTIONS.reduce(function (n, k) { return n + Math.min(5, s.plays[k] || 0); }, 0), 20]; })],
    // Streaks (days in a row)
    tier([['streak3', '🔥', '3-day streak', 'Play 3 days in a row', 50, 3],
          ['streak7', '🏆', '7-day streak', 'Play 7 days in a row', 150, 7],
          ['streak14', '⚡', '2-week streak', 'Play 14 days in a row', 250, 14],
          ['streak30', '🌙', 'Month streak', 'Play 30 days in a row', 500, 30],
          ['streak60', '☄️', '60-day streak', 'Play 60 days in a row', 800, 60],
          ['streak100', '🌞', '100-day streak', 'Play 100 days in a row', 1200, 100]], function (s) { return s.best || 0; }),
    // Days played (any days)
    tier([['days5', '📅', 'Regular', 'Play on 5 different days', 30, 5],
          ['days10', '🗓️', 'Visitor', 'Play on 10 different days', 50, 10],
          ['days20', '🏡', 'Home sweet home', 'Play on 20 different days', 100, 20],
          ['days50', '🌳', 'Old friend', 'Play on 50 different days', 200, 50],
          ['days100', '🌟', 'Super fan', 'Play on 100 different days', 400, 100]], function (s) { return s.days || 0; }),
    // Coins collected / spent
    tier([['rich100', '🪙', 'Piggy bank', 'Collect 100 coins', 20, 100],
          ['rich500', '💰', 'Coin collector', 'Collect 500 coins', 50, 500],
          ['rich1000', '💎', 'Treasure', 'Collect 1000 coins', 100, 1000],
          ['rich2500', '🏦', 'Coin bank', 'Collect 2500 coins', 200, 2500],
          ['rich5000', '👸', 'Royal treasure', 'Collect 5000 coins', 400, 5000]], function (s, w) { return w.earned || 0; }),
    tier([['spend100', '🛒', 'Shopper', 'Spend 100 coins to play', 20, 100],
          ['spend500', '🎟️', 'Ticket fan', 'Spend 500 coins to play', 50, 500],
          ['spend1000', '🎡', 'Big spender', 'Spend 1000 coins to play', 100, 1000]], function (s, w) { return w.spent || 0; }),
    // Badges collected
    tier([['badges10', '🎖️', 'Badge hunter', 'Collect 10 badges', 50, 10],
          ['badges25', '🏵️', 'Badge collector', 'Collect 25 badges', 150, 25],
          ['badges40', '🌠', 'Badge legend', 'Collect 40 badges', 400, 40]], function (s, w) { return Object.keys(w.ach || {}).length; })
  );

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
    w.stats = Object.assign(b.stats, w.stats || {}); if (!w.stats.days && w.stats.day) w.stats.days = 1; w.stats.plays = Object.assign(b.stats.plays, (w.stats || {}).plays || {});
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
      if (s.day !== today) { s.streak = s.day === yest ? (s.streak || 0) + 1 : 1; s.day = today; s.days = (s.days || 0) + 1; }
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
      if (!p) { if (tag) tag.remove(); el.classList.remove('kqc-has-cost'); return; }
      if (!tag) { tag = document.createElement('span'); tag.className = 'kqc-cost'; el.appendChild(tag); }
      el.classList.add('kqc-has-cost');
      var win = reward(sec), html = coinImg(14) + '<b>' + p + '</b>' + (win ? '<i>+' + win + '</i>' : '');
      if (tag.getAttribute('data-h') === html) return;     // unchanged: don't touch the DOM
      tag.setAttribute('data-h', html); tag.innerHTML = html;
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
      /* Price pill: part of the card's own layout (never on top of its text).
         [data-kq-cost] > ... beats card rules like ".selection-card span". */
      '[data-kq-cost]>.kqc-cost{position:static;display:inline-flex;align-items:center;gap:3px;align-self:center;flex:0 0 auto;width:max-content;max-width:100%;box-sizing:border-box;margin:2px auto 8px;padding:1px 3px;border-radius:999px;background:#fff8e1;border:1.5px solid #fcd34d;color:#92400e;font:800 12px/1.35 "Baloo 2",system-ui,sans-serif;letter-spacing:0;text-shadow:none;white-space:nowrap;box-shadow:0 1px 0 rgba(146,64,14,.15);pointer-events:none;opacity:1;transform:none}' +
      '[data-kq-cost]>.kqc-cost img{width:14px;height:14px;margin:0;flex:0 0 auto}' +
      '[data-kq-cost]>.kqc-cost b{color:#92400e;font:inherit;padding-right:2px}' +
      '[data-kq-cost]>.kqc-cost i{font:inherit;font-style:normal;font-size:11px;color:#166534;background:#dcfce7;border-radius:999px;padding:0 6px}' +
      '.h-card>.kqc-cost{margin:-4px auto 9px}' +
      '.selection-card>.kqc-cost{align-self:flex-start;margin:2px 0 0}' +
      '.menu-card.kqc-has-cost{height:auto;min-height:100px}.menu-card>.kqc-cost{margin:0 auto}' +
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
      '<div data-pane="b">' + ACH.slice().sort(function (x, y) {   // unlocked (newest) first, then closest to done
        var ux = w.ach[x.id] || 0, uy = w.ach[y.id] || 0; if (ux || uy) return uy - ux;
        var gx = x.goal(s, w), gy = y.goal(s, w); return gy[0] / gy[1] - gx[0] / gx[1];
      }).map(function (a) {
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

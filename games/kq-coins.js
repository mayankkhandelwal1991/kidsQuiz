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

  var W = null, KEY = '', listeners = [], lastEarn = {}, earnHooks = [];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var dayKey = function (t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  // Week = Monday..Sunday (local time); id = the Monday's day key.
  var weekKey = function (t) { var d = new Date(t); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d.getTime()); };

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
      // This week's numbers (weekly report): per section + per weekday (Mon=0)
      var wk = weekKey(now);
      if (!w.wk || w.wk.id !== wk) { if (w.wk && w.wk.id) w.lastWk = w.wk; w.wk = { id: wk, quiz: 0, single: 0, multi: 0, olympiad: 0, total: 0, coins: 0, d: [0, 0, 0, 0, 0, 0, 0] }; }
      w.wk[sec] = (w.wk[sec] || 0) + 1; w.wk.total = (w.wk.total || 0) + 1; w.wk.coins = (w.wk.coins || 0) + amount;
      if (!Array.isArray(w.wk.d)) w.wk.d = [0, 0, 0, 0, 0, 0, 0]; w.wk.d[(new Date(now).getDay() + 6) % 7]++;
      s.best = Math.max(s.best || 0, s.streak || 0);
      ACH.forEach(function (a) {
        if (w.ach[a.id]) return;
        var g = a.goal(s, w);
        if (g[0] >= g[1]) { w.ach[a.id] = now; if (useCoins) { w.coins += a.coins; w.earned += a.coins; addLog(w, a.coins, a.icon + ' ' + a.title, now + 1); } unlocked.push(a); }
      });
    }, '✅ ' + nice(sec, id));
    if (amount) toast('+' + amount + ' 🪙', false);
    earnHooks.forEach(function (f) { try { f(sec, id, W); } catch (e) {} });
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
      /* badges popup */
      '.kqc-card.kqb{padding:0;max-width:400px;overflow-x:hidden;background:#fffdf7}.kqb-pad{padding:0 14px}' +
      '.kqb-hero{position:relative;padding:20px 16px 18px;color:#fff;border-radius:26px 26px 0 0;background:radial-gradient(circle at 15% 20%,rgba(255,255,255,.25) 0 6px,transparent 7px),radial-gradient(circle at 85% 30%,rgba(255,255,255,.2) 0 4px,transparent 5px),radial-gradient(circle at 70% 85%,rgba(255,255,255,.18) 0 5px,transparent 6px),linear-gradient(135deg,#8b5cf6,#ec4899 60%,#f97316)}' +
      '.kqb-hero h3{margin:8px 0 0;font-size:24px;color:#fff}.kqb-hero p{margin:0;color:rgba(255,255,255,.92);font-weight:700}.kqb-hero p b{font-size:18px}' +
      '.kqb-x{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.25);color:#fff;font:800 16px system-ui;cursor:pointer}' +
      '.kqb-ring{width:92px;height:92px;margin:0 auto;border-radius:50%;padding:7px;box-sizing:border-box;animation:kqbPop .5s cubic-bezier(.34,1.56,.64,1)}' +
      '.kqb-ring span{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:rgba(255,255,255,.95);box-shadow:inset 0 -4px 0 rgba(0,0,0,.08)}' +
      '@keyframes kqbPop{0%{transform:scale(.5)}100%{transform:scale(1)}}' +
      '.kqb-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:8px;padding:12px 14px 4px;margin-top:-14px;position:relative}' +
      '.kqb-st{background:#fff;border-radius:16px;padding:8px 4px;box-shadow:0 4px 12px rgba(79,70,229,.12);display:flex;flex-direction:column;align-items:center;gap:1px}' +
      '.kqb-st b{font-size:18px;line-height:1.1;color:#1e1b4b}.kqb-st small{font-size:11px;color:#6b7280;font-weight:700}' +
      '.kqb-next{margin:10px 0 4px;padding:10px;border-radius:18px;background:linear-gradient(135deg,#fef3c7,#fde68a);text-align:left}.kqb-next .lbl{display:block;font-weight:800;color:#92400e;font-size:13px;margin:0 0 4px 2px}.kqb-next.all{text-align:center;font-weight:800;color:#92400e}' +
      '.kqb-info{display:flex;align-items:center;gap:10px;text-align:left}.kqb-info .t{flex:1;min-width:0}.kqb-info b{display:block;font-size:16px;color:#1e1b4b}.kqb-info small{display:block;color:#6b7280;font-weight:700;font-size:12.5px}' +
      '.kqb-info .pr{font-size:11px;font-weight:800;color:#6b7280}.kqb-info .done{font-size:12px;font-weight:800;color:#16a34a}.kqb-info .rw{display:inline-flex;align-items:center;gap:3px;font-weight:800;color:#92400e;white-space:nowrap;background:#fff;border-radius:999px;padding:2px 8px}' +
      '.kqb-sel{margin:6px 0 8px;padding:10px;border-radius:16px;background:#eef2ff;animation:kqbPop .25s ease-out}' +
      '.kqb-grp{margin:14px 0 4px;text-align:left}.kqb-gh{display:flex;align-items:center;gap:8px;margin-bottom:8px}.kqb-gh .gi{display:grid;place-items:center;width:28px;height:28px;border-radius:10px}.kqb-gh b{flex:1;font-size:16px;color:#1e1b4b}.kqb-gh small{font-weight:800;color:#6b7280;background:#f1f5f9;border-radius:999px;padding:1px 8px}' +
      '.kqb-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px 4px}' +
      '.kqb-tile{border:0;background:none;padding:2px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;font:inherit;-webkit-tap-highlight-color:transparent}' +
      '.kqb-tile .nm{font-size:11px;font-weight:800;line-height:1.1;color:#94a3b8;text-align:center}.kqb-tile.on .nm{color:#1e1b4b}.kqb-tile:active{transform:scale(.94)}' +
      '.kqb-tile.sel .kqb-medal{outline:3px solid #6366f1;outline-offset:2px}' +
      '.kqb-medal{position:relative;display:grid;place-items:center;border-radius:50%;padding:4px;box-sizing:border-box;flex:0 0 auto}' +
      '.kqb-medal .in{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:#f8fafc}.kqb-medal:not(.on) .in img{filter:grayscale(1);opacity:.45}' +
      '.kqb-medal.on{box-shadow:0 4px 0 rgba(0,0,0,.12),0 6px 14px rgba(0,0,0,.12)}.kqb-medal.on .in{background:rgba(255,255,255,.88)}' +
      '.kqb-medal .lock{position:absolute;right:-2px;bottom:-2px;width:20px;height:20px;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.2)}' +
      '.kqb-cert{display:inline-block;margin:4px 0 0 6px;border:0;border-radius:999px;padding:2px 10px;background:#6366f1;color:#fff;font:800 12px "Baloo 2",system-ui,sans-serif;cursor:pointer}' +
      '.kqb-empty{color:#6b7280;font-weight:700;padding:20px 0}.kqb-cr{margin:8px 0 0!important;font-size:10px;color:#9ca3af!important;font-weight:600!important}' +
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
  /* ---------- Badges popup ---------- */
  // Twemoji pictures from images/emoji (same full-color look on every phone).
  function emo(e, size) {
    var cp = Array.from(e).map(function (c) { return c.codePointAt(0); }).filter(function (c) { return c !== 0xfe0f; }).map(function (c) { return c.toString(16); }).join('-');
    return '<img src="' + BASE + '../images/emoji/' + cp + '.svg" alt="' + e + '" width="' + size + '" height="' + size + '" style="width:' + size + 'px;height:' + size + 'px" onerror="this.replaceWith(document.createTextNode(this.alt))">';
  }
  var GROUPS = [
    { id: 'play', name: 'Play & finish', icon: '🌟', c: ['#fbbf24', '#f97316'], re: /^(first|total\d+|plays50|explorer|allround)$/ },
    { id: 'quiz', name: 'Quizzes', icon: '🎯', c: ['#60a5fa', '#4f46e5'], re: /^quiz\d+$/ },
    { id: 'game', name: 'Games', icon: '🎮', c: ['#34d399', '#059669'], re: /^games?\d+$/ },
    { id: 'friends', name: 'With friends', icon: '👥', c: ['#f472b6', '#db2777'], re: /^(friends|multi\d+)$/ },
    { id: 'oly', name: 'Olympiad', icon: '🏅', c: ['#a78bfa', '#7c3aed'], re: /^(olympiad|oly\d+)$/ },
    { id: 'streak', name: 'Streaks', icon: '🔥', c: ['#fb923c', '#dc2626'], re: /^streak\d+$/ },
    { id: 'days', name: 'Days played', icon: '📅', c: ['#2dd4bf', '#0d9488'], re: /^days\d+$/ },
    { id: 'coins', name: 'Coins', icon: '🪙', c: ['#fde047', '#d97706'], re: /^(rich|spend)\d+$/ },
    { id: 'collect', name: 'Collector', icon: '🎖️', c: ['#94a3b8', '#475569'], re: /^badges\d+$/ }
  ];
  function groupOf(a) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].re.test(a.id)) return GROUPS[i]; return GROUPS[0]; }

  function openBadges() {
    css();
    var w = W || norm(null), s = w.stats, coinsOn = enabled();
    var got = ACH.filter(function (a) { return w.ach[a.id]; }).length, pctAll = Math.round(got / ACH.length * 100);
    var prog = function (a) { var g = a.goal(s, w); return { have: Math.min(g[0] || 0, g[1]), need: g[1], pct: Math.min(100, Math.round((g[0] || 0) / g[1] * 100)) }; };
    var next = ACH.filter(function (a) { return !w.ach[a.id]; }).sort(function (x, y) { return prog(y).pct - prog(x).pct; })[0];
    var stat = function (icon, val, lbl) { return '<div class="kqb-st">' + icon + '<b>' + val + '</b><small>' + lbl + '</small></div>'; };
    var medal = function (a, big) {
      var gr = groupOf(a), on = !!w.ach[a.id], p = prog(a), sz = big ? 64 : 54;
      return '<span class="kqb-medal' + (on ? ' on' : '') + '" style="width:' + sz + 'px;height:' + sz + 'px;' +
        (on ? 'background:linear-gradient(135deg,' + gr.c[0] + ',' + gr.c[1] + ')' : 'background:conic-gradient(' + gr.c[1] + ' ' + p.pct + '%,#e5e7eb 0)') + '">' +
        '<span class="in">' + emo(a.icon, big ? 34 : 28) + '</span>' + (on ? '' : '<span class="lock">' + emo('🔒', 14) + '</span>') + '</span>';
    };
    var info = function (a) {
      var p = prog(a), on = !!w.ach[a.id];
      return medal(a, true) + '<div class="t"><b>' + esc(a.title) + '</b><small>' + esc(a.desc) + '</small>' +
        (on ? '<span class="done">✅ Unlocked ' + new Date(w.ach[a.id]).toLocaleDateString([], { day: 'numeric', month: 'short' }) + '</span>' +
              (window.KQPlay ? '<button type="button" class="kqb-cert" data-cert="' + a.id + '">🎓 Certificate</button>' : '')
            : '<span class="kqc-bar"><i style="width:' + p.pct + '%"></i></span><span class="pr">' + (p.pct >= 100 ? '🎉 Finish any quiz or game to collect it!' : p.have + ' / ' + p.need) + '</span>') + '</div>' +
        (coinsOn ? '<span class="rw">' + (on ? '' : '+') + a.coins + ' ' + coinImg(16) + '</span>' : '');
    };
    var byId = {}; ACH.forEach(function (a) { byId[a.id] = a; });
    var hist = (w.log.length ? w.log.slice().reverse().map(function (e) {
      var d = new Date(e.t || 0);
      return '<div class="kqc-log"><span class="t">' + esc(e.n || (e.d > 0 ? 'Coins' : 'Played')) + '<small>' + d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</small></span>' +
        '<span class="d ' + (e.d > 0 ? 'p' : 'm') + '">' + (e.d > 0 ? '+' : '−') + Math.abs(e.d) + ' 🪙</span></div>';
    }).join('') : '<p class="kqb-empty">' + emo('📜', 40) + '<br>No coins earned or spent yet.</p>');

    var box = document.createElement('div'); box.className = 'kqc-ov';
    box.innerHTML = '<div class="kqc-card kqb">' +
      '<div class="kqb-hero"><button class="kqb-x" data-a="close" aria-label="Close">✕</button>' +
        '<div class="kqb-ring" style="background:conic-gradient(#fde047 ' + pctAll + '%,rgba(255,255,255,.25) 0)"><span>' + emo('🏆', 46) + '</span></div>' +
        '<h3>My badges</h3><p><b>' + got + '</b> of ' + ACH.length + ' collected</p></div>' +
      '<div class="kqb-stats">' + (coinsOn ? stat(coinImg(22), w.coins, 'coins') : '') + stat(emo('🔥', 22), s.streak || 0, 'day streak') +
        stat(emo('📅', 22), s.days || 0, 'days') + stat(emo('🎮', 22), s.total || 0, 'played') + '</div>' +
      (coinsOn ? '<div class="kqc-tabs"><button class="on" data-tab="b">🏅 Badges</button><button data-tab="h">📜 Coin history</button></div>' : '') +
      '<div data-pane="h" class="kqb-pad" style="display:none">' + hist + '</div>' +
      '<div data-pane="b" class="kqb-pad">' +
        (next ? '<div class="kqb-next"><span class="lbl">⭐ Next up</span><div class="kqb-info">' + info(next) + '</div></div>' : '<div class="kqb-next all">🎉 You collected every badge!</div>') +
        '<div class="kqb-info kqb-sel" style="display:none"></div>' +
        GROUPS.map(function (gr) {
          var list = ACH.filter(function (a) { return groupOf(a) === gr; }); if (!list.length) return '';
          var n = list.filter(function (a) { return w.ach[a.id]; }).length;
          return '<div class="kqb-grp"><div class="kqb-gh"><span class="gi" style="background:linear-gradient(135deg,' + gr.c[0] + ',' + gr.c[1] + ')">' + emo(gr.icon, 18) + '</span><b>' + gr.name + '</b><small>' + n + ' / ' + list.length + '</small></div>' +
            '<div class="kqb-grid">' + list.map(function (a) {
              return '<button type="button" class="kqb-tile' + (w.ach[a.id] ? ' on' : '') + '" data-id="' + a.id + '">' + medal(a) + '<span class="nm">' + esc(a.title) + '</span></button>';
            }).join('') + '</div></div>';
        }).join('') +
      '</div>' +
      '<div class="kqb-pad"><button class="kqc-alt" data-a="close">Close</button><p class="kqb-cr">Emoji graphics by Twemoji, CC-BY 4.0</p></div></div>';

    var sel = box.querySelector('.kqb-sel');
    box.addEventListener('click', function (e) {
      var c = e.target.closest && e.target.closest('[data-cert]'); if (!c || !window.KQPlay) return;
      var a = byId[c.getAttribute('data-cert')]; if (a) KQPlay.certificate({ icon: a.icon, title: a.title, line: a.desc, date: w.ach[a.id] });
    });
    box.querySelectorAll('.kqb-tile').forEach(function (t) { t.onclick = function () {
      var a = byId[t.getAttribute('data-id')]; if (!a) return;
      box.querySelectorAll('.kqb-tile.sel').forEach(function (x) { x.classList.remove('sel'); }); t.classList.add('sel');
      sel.innerHTML = info(a); sel.style.display = '';
      t.closest('.kqb-grp').insertBefore(sel, t.closest('.kqb-grid'));   // details right above that group's tiles
    }; });
    box.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () {
      box.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('on', x === b); });
      box.querySelectorAll('[data-pane]').forEach(function (p) { p.style.display = p.getAttribute('data-pane') === b.getAttribute('data-tab') ? '' : 'none'; });
    }; });
    box.onclick = function (e) { var c = e.target.closest && e.target.closest('[data-a="close"]'); if (e.target === box || c) box.remove(); };
    document.body.appendChild(box);
  }

  if (window.KQ && KQ.onAuth) KQ.onAuth(function () { load(); });
  if (window.KQ && KQ.onConfig) KQ.onConfig(function () { renderChips(); });
  load();
  if (document.body) watchCards(); else document.addEventListener('DOMContentLoaded', watchCards);

  window.KQCoins = {
    gate: gate, earn: earn, enabled: enabled, price: price, balance: function () { return W ? W.coins : 0; },
    wallet: function () { return W; }, onChange: function (f) { listeners.push(f); }, mountChip: mountChip, mountBadges: mountBadges, openBadges: openBadges, enabledFor: enabledFor, tagCards: tagCards, coinImg: coinImg,
    achievements: ACH, defaults: DEF,
    // for kq-play.js (shop, daily gift, leagues, weekly report)
    tx: function (delta, label, mutate) { change(delta, delta < 0 ? 'spend' : 'reward', mutate, label); },
    onEarn: function (f) { earnHooks.push(f); }, emo: emo, toast: toast, weekKey: weekKey, dayKey: dayKey, esc: esc, groupOf: groupOf
  };
})();

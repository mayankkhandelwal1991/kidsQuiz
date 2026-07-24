/* ============================================================
   COMMON AD HELPER — shared by all games
   ------------------------------------------------------------
   How it works:
   - Every game file includes this with:  <script src="ads.js"></script>
   - Every game calls  onGameComplete();  when a game finishes
     (game over, win, or time up).
   - onGameComplete() decides whether to actually show an ad,
     based on the two settings in AD_CONFIG below.
   - It calls your existing Android bridge: Android.showAd(type)
     so NO changes are needed in your Android code.
   - In a normal browser (no Android object) it does nothing,
     so the games still work for testing on PC.

   You can also force an ad anytime from any game or from the
   hub with:  showGameAd("interstitial");  or showGameAd("rewarded");
   ============================================================ */

var AD_CONFIG = {
  minSecondsBetweenAds: 60,   // never show ads more often than this
  showEveryNCompletions: 2    // show an ad on every Nth game-over (1 = every time)
};

function showGameAd(type) {
  type = type || "interstitial";
  try {
    if (typeof Android !== "undefined" && Android.showAd) {
      Android.showAd(type);
      try { localStorage.setItem('kq_lastAdTime', Date.now()); } catch (e) {}
      return true;
    }
  } catch (e) { console.log('Ad error:', e); }
  console.log('Ad skipped (not inside app):', type);
  return false;
}

function onGameComplete() {
  try {
    var n = (+(localStorage.getItem('kq_adCounter') || 0)) + 1;
    localStorage.setItem('kq_adCounter', n);
    var last = +(localStorage.getItem('kq_lastAdTime') || 0);
    var enoughTime  = (Date.now() - last) >= AD_CONFIG.minSecondsBetweenAds * 1000;
    var enoughGames = (n % AD_CONFIG.showEveryNCompletions) === 0;
    if (enoughTime && enoughGames) {
      showGameAd("interstitial");
    }
  } catch (e) { console.log(e); }
}

/* ============================================================
   LEADERBOARD GLUE  (added)  —  wires every single-player game
   into Firebase leaderboards + optional Google login, WITHOUT
   editing any individual game file. All games already include
   this ads.js, so this code runs everywhere automatically.
   ------------------------------------------------------------
   How scores are captured (dynamic — new games work too):
     1. When a game saves a personal best via
        localStorage.setItem('<x>Best', value)  we submit it.
     2. When a game calls onGameComplete(score) with a number,
        we submit that. If called with no argument we try to
        read a score from the page (#score / #finalScore / #wpm).
   ============================================================ */
(function () {
  // Load the shared leaderboard module (sits next to ads.js in /Game).
  if (!window.KQ) {
    var s = document.createElement('script');
    s.src = 'kq-leaderboard.js';
    s.async = false;
    document.head.appendChild(s);
  }

  // Derive a stable game id from the page filename, e.g. snake.html -> "snake".
  var GAME_ID = (function () {
    var p = (location.pathname || '').split('/').pop() || '';
    return p.replace(/\.html?$/i, '') || 'game';
  })();

  // Tell the floating widget which board its 🏆 button opens.
  window.KQ_CONTEXT = { category: 'single', gameId: GAME_ID };

  // Games where a LOWER score is better (time / moves).
  var LOWER_GAMES = { reaction_test: 1, number_order: 1, slide_puzzle: 1, memory_match: 1 };
  // localStorage "*Best" keys that are lower-is-better.
  var LOWER_KEYS = { reactBest: 1, rushBest: 1, slideBest: 1 };
  var lowerForKey = function (k) { return !!LOWER_KEYS[k]; };
  var lowerForGame = function () { return !!LOWER_GAMES[GAME_ID]; };

  function send(score, lower) {
    score = Number(score);
    if (!isFinite(score)) return;
    if (window.KQ && KQ.submit) KQ.submit('single', GAME_ID, score, { lowerIsBetter: !!lower });
  }

  /* --- 1. Auto-capture every "*Best" high-score write ------------------- */
  try {
    var _set = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, val) {
      var r = _set(key, val);
      try {
        if (/Best$/.test(key)) {
          var n = parseFloat(val);
          if (isFinite(n)) send(n, lowerForKey(key));
        }
      } catch (e) {}
      return r;
    };
  } catch (e) {}

  /* --- 2. Enhance onGameComplete to also submit a score ---------------- */
  function sniffScore() {
    var ids = ['score', 'finalScore', 'wpm'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) {
        var m = String(el.textContent || '').match(/-?\d+(\.\d+)?/);
        if (m) return parseFloat(m[0]);
      }
    }
    return null;
  }

  var _orig = window.onGameComplete;
  window.onGameComplete = function (score) {
    try { if (typeof _orig === 'function') _orig.apply(this, arguments); } catch (e) {}
    try { if (window.KQFX) KQFX.gameComplete(); } catch (e) {}
    try {
      var val = (typeof score === 'number' && isFinite(score)) ? score : sniffScore();
      if (val != null) send(val, lowerForGame());
    } catch (e) {}
  };
})();

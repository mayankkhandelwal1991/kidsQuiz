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

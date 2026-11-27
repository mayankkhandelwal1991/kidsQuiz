/* Shared multiplayer ad helper. Adjust these two values to tune ad frequency. */
var MULTIPLAYER_AD_CONFIG = {
  minSecondsBetweenAds: 60,
  showEveryNCompletions: 2,
  completionAdDelayMs: 1500
};

(function () {
  var s = document.createElement('script');
  s.src = '../../games/rating.js';
  document.head.appendChild(s);
})();

function onMultiplayerGameComplete() {
  // Coins for finishing a match (admin setting)
  try { if (window.KQCoins) KQCoins.earn('multi', (location.pathname.split('/').filter(Boolean).slice(-2, -1)[0]) || 'multi'); } catch (e) {}
  // Shared rule (kq-leaderboard.js) when available; the old local rule otherwise.
  if (window.KQ && KQ.adBreak) { try { KQ.adBreak('complete'); } catch (e) {} try { if (window.KQRating) KQRating.onComplete(); } catch (e) {} return; }
  try {
    var n = (+(localStorage.getItem('kq_adCounter') || 0)) + 1;
    localStorage.setItem('kq_adCounter', n);
    var last = +(localStorage.getItem('kq_lastAdTime') || 0);
    var enoughTime = (Date.now() - last) >= MULTIPLAYER_AD_CONFIG.minSecondsBetweenAds * 1000;
    var enoughGames = (n % MULTIPLAYER_AD_CONFIG.showEveryNCompletions) === 0;
    if (enoughTime && enoughGames && typeof Android !== 'undefined' && Android.showAd) {
      setTimeout(function () {
        if (typeof Android !== 'undefined' && Android.showAd) {
          var shown = Android.showAd('interstitial');
          if (shown !== false) { localStorage.setItem('kq_lastAdTime', Date.now()); try { if (window.KQ && KQ.adQuiet) KQ.adQuiet(true); } catch (e) {} }   // no ad ready: try again next time
          else localStorage.setItem('kq_adCounter', n - 1);
        }
      }, MULTIPLAYER_AD_CONFIG.completionAdDelayMs);
    }
  } catch (e) { console.log('Multiplayer ad error:', e); }
  try { if (window.KQRating) KQRating.onComplete(); } catch (e) {}
}

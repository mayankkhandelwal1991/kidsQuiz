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
          Android.showAd('interstitial');
          localStorage.setItem('kq_lastAdTime', Date.now());
        }
      }, MULTIPLAYER_AD_CONFIG.completionAdDelayMs);
    }
  } catch (e) { console.log('Multiplayer ad error:', e); }
  try { if (window.KQRating) KQRating.onComplete(); } catch (e) {}
}

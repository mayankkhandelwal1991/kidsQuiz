/* Shared multiplayer ad helper. Adjust these two values to tune ad frequency. */
var MULTIPLAYER_AD_CONFIG = {
  minSecondsBetweenAds: 60,
  showEveryNCompletions: 2
};

function onMultiplayerGameComplete() {
  try {
    var n = (+(localStorage.getItem('kq_adCounter') || 0)) + 1;
    localStorage.setItem('kq_adCounter', n);
    var last = +(localStorage.getItem('kq_lastAdTime') || 0);
    var enoughTime = (Date.now() - last) >= MULTIPLAYER_AD_CONFIG.minSecondsBetweenAds * 1000;
    var enoughGames = (n % MULTIPLAYER_AD_CONFIG.showEveryNCompletions) === 0;
    if (enoughTime && enoughGames && typeof Android !== 'undefined' && Android.showAd) {
      Android.showAd('interstitial');
      localStorage.setItem('kq_lastAdTime', Date.now());
    }
  } catch (e) { console.log('Multiplayer ad error:', e); }
}

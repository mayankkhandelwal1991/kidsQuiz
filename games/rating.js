/* Shared in-app rating prompt. Adjust this value to change when it appears. */
window.KQRating = window.KQRating || (function () {
  var RATING_CONFIG = {
    showAfterCompletions: 7 // Recommended range: 5–10 completed games
  };

  function onComplete() {
    try {
      if (localStorage.getItem('kq_ratingPromptShown') === '1') return;
      var count = (+(localStorage.getItem('kq_ratingCompletionCount') || 0)) + 1;
      localStorage.setItem('kq_ratingCompletionCount', count);
      if (count < RATING_CONFIG.showAfterCompletions) return;

      localStorage.setItem('kq_ratingPromptShown', '1');
      if (typeof Android !== 'undefined' && Android.showRatingPrompt) {
        setTimeout(function () { Android.showRatingPrompt(); }, 600);
      }
    } catch (e) { console.log('Rating prompt error:', e); }
  }

  return { onComplete: onComplete, config: RATING_CONFIG };
})();

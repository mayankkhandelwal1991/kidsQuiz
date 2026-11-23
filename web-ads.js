/* ============================================================
   WEB ADS (Google AdSense) — website only
   ------------------------------------------------------------
   Inside the Android app, ads come from the app itself (AdMob via
   Android.showAd), so this file does NOTHING there — AdSense is not
   allowed inside app WebViews anyway.

   On the website it loads AdSense with the same publisher account
   as the app (pub-6850862418034067, see app-ads.txt):
     • Auto ads — Google places banner / anchor / vignette ads
       automatically (turn Auto ads ON for this site in AdSense).
     • Optional fixed slots — fill AD_SLOTS with ad-unit ids from
       AdSense (Ads → By ad unit → Display ads) to also show a
       banner at the marked spots (e.g. the quiz result screen).

   The audience is kids, so ads are requested as non-personalised.
   ============================================================ */
(function () {
  'use strict';
  var CLIENT = 'ca-pub-6850862418034067';
  // Fill in to enable fixed banner units, e.g. { result: '1234567890' }.
  var AD_SLOTS = { result: '', page: '' };

  function inApp() {
    try { if (typeof Android !== 'undefined' && Android) return true; } catch (e) {}
    return /; wv\)/.test(navigator.userAgent || '');
  }
  var enabled = !inApp() && /^https?:$/.test(location.protocol);
  var loaded = false;

  function load() {
    if (!enabled || loaded) return;
    loaded = true;
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.requestNonPersonalizedAds = 1; // child audience: no personalised ads
    // The page <head> already has the AdSense tag (needed for site verification): don't add it twice.
    if (document.querySelector('script[src*="adsbygoogle.js"]')) return;
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
    document.head.appendChild(s);
  }

  /** Put a responsive banner into `el` (only if a slot id is configured). */
  function slot(el, name) {
    if (!enabled || !el) return;
    var id = AD_SLOTS[name || 'result'];
    if (!id) return; // Auto ads still run without fixed slots
    load();
    el.innerHTML = '<ins class="adsbygoogle" style="display:block" data-ad-client="' + CLIENT +
      '" data-ad-slot="' + id + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();

  window.KQWebAds = { enabled: enabled, slot: slot };
})();

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
  //   rail: a "Vertical" display ad unit (AdSense -> Ads -> By ad unit -> Display ads)
  //         shown left and right of the home page on wide desktop screens.
  var AD_SLOTS = { result: '', page: '', rail: '' };
  var RAIL_W = 160, RAIL_H = 600, CONTENT_W = 1040;

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

  /**
   * Desktop side ads for the home page. On wide screens the page content is
   * centred at CONTENT_W so there is free space at both sides — AdSense Auto
   * ads "Side rails" (turn on in AdSense) use that space, and if AD_SLOTS.rail is
   * set, two fixed 160x600 units are placed there too. Phones / app: nothing.
   */
  function rails() {
    if (!enabled || !document.body) return;
    if (!document.getElementById('kq-rails-css')) {
      var st = document.createElement('style'); st.id = 'kq-rails-css';
      st.textContent =
        '@media (min-width:1200px){html.kq-rails .container{max-width:' + CONTENT_W + 'px!important;margin-left:auto!important;margin-right:auto!important}}' +
        '.kq-rail{position:fixed;top:96px;width:' + RAIL_W + 'px;min-height:' + RAIL_H + 'px;z-index:5;display:none}' +
        '.kq-rail.l{left:max(12px,calc((100vw - ' + CONTENT_W + 'px)/2 - ' + (RAIL_W + 20) + 'px))}' +
        '.kq-rail.r{right:max(12px,calc((100vw - ' + CONTENT_W + 'px)/2 - ' + (RAIL_W + 20) + 'px))}' +
        '@media (min-width:' + (CONTENT_W + 2 * (RAIL_W + 32)) + 'px){html.kq-rails .kq-rail{display:block}}';
      document.head.appendChild(st);
    }
    document.documentElement.classList.add('kq-rails');
    if (!AD_SLOTS.rail || document.querySelector('.kq-rail')) return;
    if (window.innerWidth < CONTENT_W + 2 * (RAIL_W + 32)) return; // not enough room: don't request
    load();
    ['l', 'r'].forEach(function (side) {
      var d = document.createElement('div'); d.className = 'kq-rail ' + side;
      d.innerHTML = '<ins class="adsbygoogle" style="display:inline-block;width:' + RAIL_W + 'px;height:' + RAIL_H + 'px" data-ad-client="' + CLIENT + '" data-ad-slot="' + AD_SLOTS.rail + '"></ins>';
      document.body.appendChild(d);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  }

  window.KQWebAds = { enabled: enabled, slot: slot, rails: rails };
})();

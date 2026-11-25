/**
 * firebase-config.js
 * -----------------------------------------------------------------------
 * PASTE YOUR OWN FIREBASE PROJECT CONFIG BELOW.
 *
 * How to get this object:
 *   1. Go to https://console.firebase.google.com
 *   2. Create a project (or open an existing one).
 *   3. Project settings (gear icon) -> General -> "Your apps" -> Web app (</>)
 *   4. Copy the firebaseConfig object shown there and paste it below.
 *   5. Make sure you've enabled "Realtime Database" (not Firestore) in the
 *      Firebase console, in test mode or with the rules from README.md.
 *
 * This file must be loaded with a plain <script> tag AFTER the Firebase
 * compat SDK scripts and BEFORE js/game.js — see index.html.
 * -----------------------------------------------------------------------
 */

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB0eMyeIUtCsuMVk-8LtRQs_iwOJV3ksv8",
  authDomain: "kidsgames-3987c.firebaseapp.com",
  databaseURL: "https://kidsgames-3987c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kidsgames-3987c",
  storageBucket: "kidsgames-3987c.appspot.com",
  messagingSenderId: "851797718600",
  appId: "1:851797718600:web:e990b3435751d209228a7d",
  measurementId: "G-3JDMHBXKRK"
};

// Guard against re-initialization if a page ever loads this twice.
if (!window.firebase.apps || !window.firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

/* Seconds a lone player waits for a real opponent before the Computer joins.
   Admin console -> App settings -> 👥 Multiplayer (config/app/multi/botWaitSec).
   Read once when the game opens (and kept for the next visit); 10 s if unset. */
(function () {
  var KEY = 'kq_bot_wait';
  try { firebase.database().ref('config/app/multi/botWaitSec').once('value').then(function (s) {
    var v = Number(s.val()); if (v >= 3 && v <= 120) localStorage.setItem(KEY, String(Math.round(v))); else localStorage.removeItem(KEY);
    sayWait();
  }).catch(function () {}); } catch (e) {}
  // keep the landing text ("You'll play the Computer after N seconds") in step with the setting
  function sayWait() {
    var n = window.kqBotWaitSeconds ? kqBotWaitSeconds() : 10;
    document.querySelectorAll('.landing-footnote, .landing-card p, .landing-card div').forEach(function (el) {
      if (el.children.length || !/Computer\s+after\s+\d+\s+seconds/.test(el.textContent)) return;
      el.textContent = el.textContent.replace(/after\s+\d+\s+seconds/, 'after ' + n + ' seconds');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sayWait); else setTimeout(sayWait, 0);
  window.kqBotWaitSeconds = function () {
    var v = NaN;
    try { v = Number(localStorage.getItem(KEY)); } catch (e) {}
    if (!(v >= 3 && v <= 120)) {
      try { var c = window.KQ && KQ.appConfig && KQ.appConfig(); v = Number(c && c.multi && c.multi.botWaitSec); } catch (e) {}
    }
    return v >= 3 && v <= 120 ? Math.round(v) : 10;
  };
})();

/* ============================================================
   Admin gate — keeps an admin page hidden until the admin has
   signed in with Google.

   Include right after <body> (after the Firebase compat scripts):
     <script src="admin-gate.js"></script>
   The page content stays hidden; a sign-in card is shown instead.
   Access = the Firebase rules: only the admin account may read /admin
   (see README-admin.md). After sign-in a bar is added to the page
   <header>: the admin's email and "Sign out" (page links: admin-nav.js).
   window.KQAdmin = { user, signOut } for the page's own code.
   ============================================================ */
(function () {
  'use strict';
  var html = document.documentElement;
  html.classList.add('kq-locked');

  var css = document.createElement('style');
  css.textContent =
    'html.kq-locked body > *:not(#kqGate){display:none!important}' +
    '#kqGate{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;' +
    'background:linear-gradient(135deg,#ede9fe,#e0f2fe);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1e1b4b}' +
    '#kqGate .c{background:#fff;border-radius:22px;padding:28px 22px;max-width:400px;width:100%;text-align:center;box-shadow:0 18px 40px rgba(30,27,75,.15)}' +
    '#kqGate h2{margin:8px 0 6px}#kqGate p{color:#6b7280;margin:0 0 16px}' +
    '#kqGate .g{display:inline-flex;align-items:center;gap:10px;background:#fff;color:#1f1f1f;border:1px solid #747775;border-radius:999px;padding:10px 22px;font:600 15px system-ui,sans-serif;cursor:pointer}' +
    '#kqGate .g svg{width:18px;height:18px}#kqGate .err{color:#dc2626;font-weight:600;margin-top:14px}' +
    '#kqGate .alt{background:none;border:1px solid #e5e7eb;border-radius:10px;padding:8px 14px;font:600 14px system-ui,sans-serif;cursor:pointer}' +
    '.kq-adminbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px}' +
    '.kq-adminbar .em{opacity:.9;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.kq-adminbar button{border:0;border-radius:999px;padding:5px 12px;font:700 13px system-ui,sans-serif;cursor:pointer;background:rgba(255,255,255,.22);color:inherit}';
  document.head.appendChild(css);

  var G = '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var gate = null;
  function card(inner) {
    if (!gate) {
      gate = document.createElement('div'); gate.id = 'kqGate';
      document.body.insertBefore(gate, document.body.firstChild);
    }
    gate.innerHTML = '<div class="c">' + inner + '</div>';
  }

  function start() {
    if (!window.firebase) { card('<h2>Can\'t load sign-in</h2><p>Check your internet connection and reload.</p>'); return; }
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey: "AIzaSyB0eMyeIUtCsuMVk-8LtRQs_iwOJV3ksv8",
        authDomain: "kidsgames-3987c.firebaseapp.com",
        databaseURL: "https://kidsgames-3987c-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "kidsgames-3987c",
        storageBucket: "kidsgames-3987c.appspot.com",
        messagingSenderId: "851797718600",
        appId: "1:851797718600:web:e990b3435751d209228a7d"
      });
    }
    var auth = firebase.auth(), db = firebase.database();
    var signOut = function () { return auth.signOut(); };
    window.KQAdmin = { user: null, signOut: signOut };

    function showSignIn(msg) {
      card('<div style="font-size:42px">🔐</div><h2>Admin sign-in</h2><p>Sign in with the admin Google account to continue.</p>' +
        '<button class="g" id="kqgIn">' + G + 'Sign in with Google</button>' + (msg ? '<div class="err">' + esc(msg) + '</div>' : ''));
      document.getElementById('kqgIn').onclick = function () {
        var p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
        auth.signInWithPopup(p).catch(function (e) {
          if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return auth.signInWithRedirect(p);
          if (e && e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') showSignIn('Sign-in failed: ' + (e.message || e.code));
        });
      };
    }
    function lock() { html.classList.add('kq-locked'); var b = document.querySelector('.kq-adminbar'); if (b) b.remove(); }
    function unlock(u) {
      window.KQAdmin.user = u;
      if (gate) { gate.remove(); gate = null; }
      html.classList.remove('kq-locked');
      var header = document.querySelector('header');
      if (header && !header.querySelector('.kq-adminbar')) {
        var bar = document.createElement('div'); bar.className = 'kq-adminbar';
        var here = (location.pathname.split('/').pop() || 'index.html');
        bar.innerHTML = '<span class="em" title="' + esc(u.email) + '">' + esc(u.email || u.displayName || '') + '</span>' +
          // page links ("Open app", "Players" …) are in the common header (admin-nav.js)
          '<button type="button" id="kqgOut">Sign out</button>';
        header.appendChild(bar);
        bar.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { location.href = b.getAttribute('data-go'); }; });
        document.getElementById('kqgOut').onclick = signOut;
      }
    }

    auth.getRedirectResult().catch(function () {});
    auth.onAuthStateChanged(function (u) {
      if (!u) { lock(); showSignIn(); return; }
      lock();
      card('<p>Checking admin access…</p>');
      // Only the admin account can read /admin (Firebase rules).
      db.ref('admin/check').once('value').then(function () { unlock(u); }, function () {
        card('<div style="font-size:42px">⛔</div><h2>Not an admin</h2><p>' + esc(u.email || '') + ' doesn\'t have admin access.</p>' +
          '<button class="alt" id="kqgSw">Use another account</button>');
        document.getElementById('kqgSw').onclick = signOut;
      });
    });
  }

  if (document.body) { card('<p>Loading…</p>'); start(); }
  else document.addEventListener('DOMContentLoaded', function () { card('<p>Loading…</p>'); start(); });
})();

/* ============================================================================
   kq-leaderboard.js  —  Shared Google Login + Firebase Leaderboards
   ----------------------------------------------------------------------------
   ONE file powers login + leaderboards across ALL three parts of the app:
     • Single-player games   (category: "single")
     • Multiplayer games      (category: "multi")
     • Quiz                    (category: "quiz")

   It is buildless: it injects the Firebase *compat* SDK from the CDN itself,
   so any page only needs a single <script src=".../kq-leaderboard.js"></script>.

   PUBLIC API  (all under window.KQ)
   ---------------------------------------------------------------------------
     KQ.ready                      -> Promise, resolves once Firebase is up
     KQ.user()                     -> { key, name, photo, uid, isGuest }
     KQ.signIn()                   -> Google popup sign-in (optional)
     KQ.signOut()
     KQ.onAuth(fn)                 -> fn(user) whenever auth state changes
     KQ.setNick(name)              -> set a display name for a guest player
     KQ.submit(cat, gameId, score, opts)
                                   -> keep this player's BEST score for a level
                                      opts = { lowerIsBetter:false, meta:{} }
     KQ.addWin(cat, gameId, opts)  -> +1 win (atomic) — for win/lose games
     KQ.open(cat, gameId, title)   -> open the leaderboard viewer modal
     KQ.gameName(gameId)           -> pretty display name for a game id

   CONTEXT
   ---------------------------------------------------------------------------
   A page tells the widget which board its 🏆 button should open by setting,
   before this script runs (or any time after):
        window.KQ_CONTEXT = { category:'single', gameId:'snake', title:'Snake' };
   ========================================================================== */
(function () {
  "use strict";
  if (window.KQ) return; // guard against double-inclusion

  // Directory this script lives in (so we can load siblings like kq-fx.js).
  var SELF_BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*$/, "") : "";
  })();

  /* ----- Firebase project config (same project as the multiplayer game) --- */
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyB0eMyeIUtCsuMVk-8LtRQs_iwOJV3ksv8",
    authDomain: "kidsgames-3987c.firebaseapp.com",
    databaseURL: "https://kidsgames-3987c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "kidsgames-3987c",
    storageBucket: "kidsgames-3987c.appspot.com",
    messagingSenderId: "851797718600",
    appId: "1:851797718600:web:e990b3435751d209228a7d",
    measurementId: "G-3JDMHBXKRK"
  };

  var SDK_VERSION = "10.12.2";
  var CDN = "https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/";

  /* Pretty display names for the built-in games (id = html filename stem).
     Anything not listed is auto-prettified, so NEW games work with no edits. */
  var GAME_NAMES = {
    egg_jump:"Egg Jump", car_race:"Car Race", memory_match:"Memory Match", snake:"Snake",
    whack_mole:"Whack-a-Mole", tic_tac_toe:"Tic Tac Toe", balloon_pop:"Balloon Pop",
    fruit_catch:"Fruit Catch", simon_says:"Simon Says", quick_math:"Quick Math",
    flappy_bee:"Flappy Bee", brick_breaker:"Brick Breaker", ping_pong:"Ping Pong",
    maze_run:"Maze Run", slide_puzzle:"Slide Puzzle", word_scramble:"Word Scramble",
    rock_paper:"Rock Paper Scissors", odd_one_out:"Odd One Out", color_tap:"Color Tap",
    number_order:"Number Rush", car_race_3d:"Car Race 3D", game_2048:"2048", tetris:"Tetris",
    piano_tiles:"Piano Tiles", stack_tower:"Stack Tower", bubble_shooter:"Bubble Shooter",
    space_shooter:"Space Shooter", doodle_jump:"Sky Hopper", water_sort:"Water Sort",
    slingshot:"Sling Blast", connect_four:"Connect Four", sudoku_mini:"Sudoku Mini",
    reaction_test:"Reaction Test", typing_speed:"Typing Speed", endless_runner_3d:"Neon Runner 3D",
    crossy_road_3d:"Lane Hopper 3D", basketball_3d:"Hoops 3D", ball_maze_3d:"Gravity Maze 3D",
    drift_racer_3d:"Neon Drift 3D", platform_runner:"Platform Runner", neon_lane_dash:"Neon Lane Dash",
    word_search:"Word Search", spelling_bee:"Spelling Bee", hangman:"Hangman",
    missing_letter:"Missing Letter", word_match:"Word Match", rhyme_time:"Rhyme Time",
    first_letter_find:"First Letter Find", category_sort:"Category Sort", word_ladder:"Word Ladder",
    synonym_match:"Synonym Match", word_builder:"Word Builder", speed_spell:"Speed Spell",
    train_the_robot:"Train the Robot", ai_quiz_master:"AI Quiz Master",
    "tic-tac-toe":"Tic Tac Toe"
  };

  /* ---------------------------------------------------------------- helpers */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.async = false;
      s.onload = res; s.onerror = function () { rej(new Error("load " + src)); };
      document.head.appendChild(s);
    });
  }
  function loadAll(list) {
    return list.reduce(function (p, src) {
      return p.then(function () { return loadScript(src); });
    }, Promise.resolve());
  }

  // Load the shared sounds + animations module (sits next to this file).
  if (!window.KQFX) { loadScript(SELF_BASE + "kq-fx.js").catch(function () {}); }
  function prettify(id) {
    if (GAME_NAMES[id]) return GAME_NAMES[id];
    return String(id || "").replace(/[_-]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function guestId() {
    var k = "kq_guest_id", v = null;
    try { v = localStorage.getItem(k); } catch (e) {}
    if (!v) {
      v = "g_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
      try { localStorage.setItem(k, v); } catch (e) {}
    }
    return v;
  }
  function guestNick() {
    try { return localStorage.getItem("kq_nick") || ""; } catch (e) { return ""; }
  }

  /* --------------------------------------------------------------- KQ state */
  var db = null, auth = null;
  var authUser = null;                 // firebase user, or null
  var authCbs = [];
  var readyResolve, ready = new Promise(function (r) { readyResolve = r; });

  function currentUser() {
    if (authUser) {
      return {
        key: authUser.uid,
        uid: authUser.uid,
        name: authUser.displayName || (authUser.email ? authUser.email.split("@")[0] : "Player"),
        photo: authUser.photoURL || "",
        isGuest: false
      };
    }
    return {
      key: guestId(),
      uid: null,
      name: guestNick() || "Guest",
      photo: "",
      isGuest: true
    };
  }

  function notifyAuth() {
    var u = currentUser();
    authCbs.forEach(function (fn) { try { fn(u); } catch (e) {} });
    renderWidget();
  }

  /* ------------------------------------------------------------- bootstrap
     Some pages (e.g. the multiplayer game) already load the Firebase compat
     SDK and even call initializeApp themselves. We must NOT load duplicate
     copies or re-initialize, or Firebase throws. So: load only the pieces
     that are missing, and reuse any app that already exists. */
  function ensureSDK() {
    var need = [];
    if (typeof window.firebase === "undefined" || !firebase.initializeApp) {
      need.push(CDN + "firebase-app-compat.js");
    }
    return loadAll(need).then(function () {
      var extra = [];
      if (!firebase.database) extra.push(CDN + "firebase-database-compat.js");
      if (!firebase.auth) extra.push(CDN + "firebase-auth-compat.js");
      return loadAll(extra);
    });
  }

  ensureSDK().then(function () {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    db = firebase.database();
    try { auth = firebase.auth(); } catch (e) { auth = null; }
    if (auth) {
      // IMPORTANT: `ready` must not resolve until we actually know the auth
      // state. Firebase reports null->real-user asynchronously, and until the
      // first callback fires `currentUser()` falls back to a *guest*. If we
      // resolved `ready` (or let onAuth fire) before this point, callers would
      // mistake a logged-in user for a guest and route them to the sign-in
      // page. So we resolve `ready` from inside the first auth callback.
      var firstAuth = false;

      // (1) Force LOCAL persistence so a completed Google login SURVIVES the
      //     reloads/redirects the app does between quiz2.html and quiz-home.html.
      //     Without this, some browsers drop the session on the next page load
      //     and the two pages bounce the user back and forth forever.
      var persistReady = auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .catch(function (e) { console.warn("[KQ] setPersistence failed:", e); });

      // (2) THE reload-loop fix: after a signInWithRedirect() the browser comes
      //     back to this page and Firebase has a PENDING result that must be
      //     collected with getRedirectResult(). The previous version never
      //     called it, so on mobile / when popups are blocked the redirect
      //     login never "landed": onAuthStateChanged stayed null, the gate
      //     showed again, the user tapped Sign in, redirected again… endlessly.
      persistReady.then(function () {
        return auth.getRedirectResult();
      }).then(function (result) {
        // Success: clear the redirect-in-progress guard. onAuthStateChanged
        // below will fire with the user and routing sends them home.
        try { sessionStorage.removeItem("kq_redirecting"); } catch (e) {}
        if (result && result.user) {
          try { sessionStorage.removeItem("kq_redirect_failed"); } catch (e) {}
        } else {
          // Came back from a redirect we started, but with no user -> the
          // browser (in-app webview / partitioned storage) blocked it. Flag it
          // so signIn() shows a clear message instead of redirecting AGAIN.
          var wasRedirecting = false;
          try { wasRedirecting = sessionStorage.getItem("kq_redirecting") === "1"; } catch (e) {}
          if (wasRedirecting) {
            try { sessionStorage.setItem("kq_redirect_failed", "1"); } catch (e) {}
          }
        }
      }).catch(function (e) {
        console.warn("[KQ] getRedirectResult failed:", e);
        try {
          if (sessionStorage.getItem("kq_redirecting") === "1") {
            sessionStorage.setItem("kq_redirect_failed", "1");
          }
          sessionStorage.removeItem("kq_redirecting");
        } catch (x) {}
      }).then(function () {
        // (3) Only NOW start listening for auth state — after the redirect
        //     result (if any) has been folded in, so the very first callback
        //     already reflects the just-completed Google login.
        auth.onAuthStateChanged(function (u) {
          authUser = u || null;
          // Persist Google name as the guest nick fallback too (nice for quiz).
          if (u && u.displayName) { try { localStorage.setItem("kq_nick", u.displayName); } catch (e) {} }
          if (!firstAuth) { firstAuth = true; readyResolve(); }
          notifyAuth();
        });
      });

      // If the auth callback never arrives (offline/blocked), don't hang forever.
      setTimeout(function () {
        if (!firstAuth) { firstAuth = true; readyResolve(); notifyAuth(); }
      }, 6000);
    } else {
      readyResolve();
      notifyAuth();
    }
    injectWidget();
  }).catch(function (e) {
    console.warn("[KQ] Firebase failed to load:", e);
    readyResolve(); // resolve anyway so games never hang
    injectWidget(); // still show login widget shell (will just log errors)
  });

  /* -------------------------------------------------------- submit / read  */
  function playerRef(cat, gameId) {
    var u = currentUser();
    return db.ref("leaderboards/" + cat + "/" + gameId + "/" + u.key);
  }

  function submit(cat, gameId, score, opts) {
    opts = opts || {};
    score = Number(score);
    if (!isFinite(score)) return Promise.resolve(false);
    return ready.then(function () {
      if (!db) return false;
      var u = currentUser();
      var lower = !!opts.lowerIsBetter;
      var ref = playerRef(cat, gameId);
      return ref.transaction(function (cur) {
        if (cur && typeof cur.score === "number") {
          var better = lower ? score < cur.score : score > cur.score;
          if (!better) { cur.name = u.name; cur.photo = u.photo; return cur; } // keep best, refresh name
        }
        return {
          name: u.name, photo: u.photo, uid: u.uid || null, guest: u.isGuest,
          score: score, lowerIsBetter: lower, meta: opts.meta || null,
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        };
      }).then(function () { return true; }).catch(function (e) {
        console.warn("[KQ] submit failed:", e); return false;
      });
    });
  }

  function addWin(cat, gameId, opts) {
    opts = opts || {};
    return ready.then(function () {
      if (!db) return false;
      var u = currentUser();
      var ref = playerRef(cat, gameId);
      return ref.transaction(function (cur) {
        cur = cur || { name: u.name, photo: u.photo, uid: u.uid || null, guest: u.isGuest, score: 0 };
        cur.name = u.name; cur.photo = u.photo;
        cur.score = (Number(cur.score) || 0) + 1;
        cur.updatedAt = firebase.database.ServerValue.TIMESTAMP;
        return cur;
      }).then(function () { return true; }).catch(function (e) {
        console.warn("[KQ] addWin failed:", e); return false;
      });
    });
  }

  function fetchBoard(cat, gameId, limit) {
    limit = limit || 50;
    return ready.then(function () {
      if (!db) return [];
      return db.ref("leaderboards/" + cat + "/" + gameId).once("value").then(function (snap) {
        var rows = [];
        snap.forEach(function (c) {
          var v = c.val() || {};
          rows.push({
            key: c.key, name: v.name || "Player", photo: v.photo || "",
            score: Number(v.score) || 0, lowerIsBetter: !!v.lowerIsBetter,
            guest: !!v.guest, updatedAt: v.updatedAt || 0
          });
        });
        var lower = rows.length && rows[0].lowerIsBetter;
        rows.sort(function (a, b) { return lower ? a.score - b.score : b.score - a.score; });
        return rows.slice(0, limit);
      });
    });
  }

  /* ------------------------------------------------------------- auth ops  */
  // True when we're running inside an Android WebView (Google blocks its web
  // OAuth flow here, so we must use a native token instead).
  function isAndroidWebView() {
    var ua = navigator.userAgent || "";
    return /; wv\)/.test(ua) || (/\bAndroid\b/.test(ua) && /\bVersion\/[\d.]+/.test(ua) && /\bChrome\//.test(ua));
  }
  // True when the native app exposes a Google sign-in method for us to call.
  function hasNativeGoogle() {
    try { return typeof Android !== "undefined" && Android && typeof Android.googleSignIn === "function"; }
    catch (e) { return false; }
  }

  // Complete Firebase sign-in using a Google ID token obtained natively.
  function signInWithIdToken(idToken) {
    return ready.then(function () {
      if (!auth || !idToken) return null;
      var cred = firebase.auth.GoogleAuthProvider.credential(idToken);
      return auth.signInWithCredential(cred).then(function (r) { return r.user; })
        .catch(function (e) {
          console.warn("[KQ] signInWithCredential failed:", e);
          alert("Google sign-in failed on this device. Please try again.");
          return null;
        });
    });
  }
  // Android calls this (via evaluateJavascript) after native Google Sign-In.
  window.onGoogleIdToken = function (idToken) { return signInWithIdToken(idToken); };

  function signIn() {
    return ready.then(function () {
      // Inside the Android app: hand off to native Google Sign-In. The app
      // then calls window.onGoogleIdToken('<idToken>') to finish the login.
      if (hasNativeGoogle()) {
        try { Android.googleSignIn(); return null; } catch (e) { console.warn("[KQ] native googleSignIn() threw:", e); }
      }
      if (!auth) { alert("Login is unavailable right now."); return null; }

      // If a previous redirect attempt already came back empty (blocked by an
      // in-app webview or partitioned storage), do NOT silently redirect again
      // — that is exactly what caused the endless reload. Tell the user once.
      var redirectFailed = false;
      try { redirectFailed = sessionStorage.getItem("kq_redirect_failed") === "1"; } catch (e) {}
      if (redirectFailed) {
        try { sessionStorage.removeItem("kq_redirect_failed"); } catch (e) {}
        alert("Google sign-in couldn't complete in this browser. Try opening the app in Chrome, or use \"Continue as Guest\".");
        return null;
      }

      // Real browsers: normal Google popup (with a ONE-SHOT redirect fallback).
      var provider = new firebase.auth.GoogleAuthProvider();
      return auth.signInWithPopup(provider).then(function (r) {
        return r.user;
      }).catch(function (e) {
        console.warn("[KQ] signIn failed:", e);
        var canRedirect = e && (e.code === "auth/popup-blocked" ||
          e.code === "auth/cancelled-popup-request" ||
          e.code === "auth/operation-not-supported-in-this-environment");
        if (canRedirect) {
          try {
            // Mark that a redirect is in flight so getRedirectResult() on the
            // way back knows whether an empty result means "blocked" (and must
            // NOT auto-redirect a second time).
            sessionStorage.setItem("kq_redirecting", "1");
          } catch (x) {}
          try {
            auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
            return null; // page navigates away to Google now
          } catch (x2) {
            try { sessionStorage.removeItem("kq_redirecting"); } catch (x3) {}
          }
        }
        var disallowed = e && (e.code === "auth/operation-not-supported-in-this-environment" ||
          /disallowed_useragent/i.test(e.message || ""));
        if (disallowed || isAndroidWebView()) {
          alert("Google sign-in isn't allowed inside the app's browser view. Please update the app so it can sign you in.");
        } else if (e && e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
          alert("Google sign-in failed. Make sure Google is enabled in Firebase Auth and this domain is authorized.");
        }
        return null;
      });
    });
  }
  function signOut() {
    try {
      if (typeof Android !== "undefined" && Android && typeof Android.googleSignOut === "function") {
        Android.googleSignOut();
      }
    } catch (e) {}
    return ready.then(function () { return auth ? auth.signOut() : null; });
  }

  /* =====================================================================  UI
     Floating widget  (login button / avatar)  +  🏆 leaderboard button
     +  a full-screen leaderboard viewer modal.
     Everything is Shadow-DOM-free but heavily namespaced (kqlb-) to avoid
     clashing with each game's own CSS.
  ===================================================================== */
  var STYLE = "\
.kqlb-fab{position:fixed;top:10px;right:10px;z-index:2147483000;display:flex;gap:6px;align-items:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}\
.kqlb-fab.kqlb-multi{right:60px}\
.kqlb-fab.kqlb-multi .kqlb-trophy,.kqlb-fab.kqlb-multi .kqlb-nm{display:none}\
.kqlb-fab.kqlb-multi .kqlb-user{padding:3px;max-width:none}\
.kqlb-fab *{box-sizing:border-box}\
.kqlb-btn{border:none;border-radius:999px;cursor:pointer;font-weight:800;font-size:12px;padding:7px 12px;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;gap:6px;line-height:1}\
.kqlb-trophy{background:linear-gradient(135deg,#f59e0b,#f43f5e)}\
.kqlb-login{background:linear-gradient(135deg,#4285F4,#7c3aed)}\
.kqlb-user{background:rgba(255,255,255,.92);color:#222;padding:4px 6px 4px 4px;border-radius:999px;display:flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(0,0,0,.25);cursor:pointer;font-weight:700;font-size:12px;max-width:150px}\
.kqlb-user img{width:24px;height:24px;border-radius:50%;object-fit:cover}\
.kqlb-user .kqlb-av{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#4285F4,#f43f5e);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px}\
.kqlb-user .kqlb-nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px}\
.kqlb-menu{position:absolute;top:44px;right:0;background:#fff;color:#222;border-radius:14px;box-shadow:0 12px 34px rgba(0,0,0,.28);padding:8px;min-width:180px;display:none}\
.kqlb-menu.open{display:block}\
.kqlb-menu .kqlb-mi{padding:9px 10px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}\
.kqlb-menu .kqlb-mi:hover{background:#f1f2f6}\
.kqlb-menu .kqlb-head{font-size:11px;color:#888;padding:4px 10px}\
.kqlb-overlay{position:fixed;inset:0;z-index:2147483600;background:rgba(10,10,25,.55);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;padding:14px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}\
.kqlb-overlay.open{display:flex}\
.kqlb-modal{background:#fff;color:#1f2430;width:100%;max-width:440px;max-height:88vh;border-radius:24px;box-shadow:0 24px 60px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden;animation:kqlbpop .25s cubic-bezier(.34,1.56,.64,1)}\
@keyframes kqlbpop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}\
.kqlb-mtop{background:linear-gradient(135deg,#7c3aed,#4285F4);color:#fff;padding:16px 18px;display:flex;align-items:center;justify-content:space-between}\
.kqlb-mtop h3{margin:0;font-size:17px;font-weight:800;display:flex;align-items:center;gap:8px}\
.kqlb-x{background:rgba(255,255,255,.2);border:none;color:#fff;width:30px;height:30px;border-radius:50%;font-size:16px;cursor:pointer;font-weight:800}\
.kqlb-sub{font-size:12px;opacity:.9;margin-top:2px}\
.kqlb-body{overflow-y:auto;padding:10px 12px 16px}\
.kqlb-row{display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:12px}\
.kqlb-row+.kqlb-row{margin-top:4px}\
.kqlb-row.me{background:linear-gradient(135deg,#fff7ed,#fef2f2);outline:2px solid #f59e0b33}\
.kqlb-rk{width:30px;text-align:center;font-weight:800;color:#7c3aed;font-size:14px}\
.kqlb-rk.g{color:#f59e0b}.kqlb-rk.s{color:#94a3b8}.kqlb-rk.b{color:#b45309}\
.kqlb-pa{width:32px;height:32px;border-radius:50%;object-fit:cover;background:#eee;flex:0 0 auto}\
.kqlb-pav{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;background:linear-gradient(135deg,#4285F4,#f43f5e);flex:0 0 auto}\
.kqlb-pn{flex:1;min-width:0;font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.kqlb-tag{font-size:10px;font-weight:700;color:#9ca3af;margin-left:5px}\
.kqlb-sc{font-weight:800;font-size:15px;color:#111827}\
.kqlb-empty{text-align:center;color:#8a8fa3;padding:34px 10px;font-size:14px}\
.kqlb-load{text-align:center;color:#8a8fa3;padding:30px;font-size:14px}\
.kqlb-tabs{display:flex;gap:6px;padding:10px 12px 0}\
.kqlb-tab{flex:1;text-align:center;padding:8px;border-radius:10px 10px 0 0;background:#f1f2f6;font-weight:700;font-size:12px;cursor:pointer;color:#555}\
.kqlb-tab.active{background:#fff;color:#7c3aed;box-shadow:0 -2px 6px rgba(0,0,0,.05)}\
.kqlb-note{font-size:11px;color:#9aa0b0;text-align:center;padding:8px 12px}\
";

  var widgetEl = null, menuEl = null, overlayEl = null;

  function injectWidget() {
    if (document.getElementById("kqlb-style")) { renderWidget(); return; }
    if (!document.body) { document.addEventListener("DOMContentLoaded", injectWidget); return; }
    var st = document.createElement("style");
    st.id = "kqlb-style"; st.textContent = STYLE;
    document.head.appendChild(st);

    widgetEl = document.createElement("div");
    widgetEl.className = "kqlb-fab" + (window.KQ_CONTEXT && window.KQ_CONTEXT.category === "multi" ? " kqlb-multi" : "");
    document.body.appendChild(widgetEl);

    overlayEl = document.createElement("div");
    overlayEl.className = "kqlb-overlay";
    overlayEl.addEventListener("click", function (e) { if (e.target === overlayEl) closeModal(); });
    document.body.appendChild(overlayEl);

    document.addEventListener("click", function (e) {
      if (menuEl && menuEl.classList.contains("open") && widgetEl && !widgetEl.contains(e.target)) {
        menuEl.classList.remove("open");
      }
    });
    renderWidget();
  }

  function initials(name) {
    var p = String(name || "?").trim().split(/\s+/);
    return ((p[0] || "?")[0] + (p[1] ? p[1][0] : "")).toUpperCase();
  }

  function renderWidget() {
    if (!widgetEl) return;
    var ctx = window.KQ_CONTEXT;
    var u = currentUser();
    var html = "";

    if (ctx && ctx.gameId) {
      html += '<button class="kqlb-btn kqlb-trophy" id="kqlb-open">🏆 <span>Leaderboard</span></button>';
    }
    if (!u.isGuest) {
      var av = u.photo
        ? '<img src="' + esc(u.photo) + '" referrerpolicy="no-referrer" alt="">'
        : '<span class="kqlb-av">' + esc(initials(u.name)) + '</span>';
      html += '<div class="kqlb-user" id="kqlb-userchip">' + av +
              '<span class="kqlb-nm">' + esc(u.name) + '</span></div>';
    }
    html += '<div class="kqlb-menu" id="kqlb-menu"></div>';
    widgetEl.innerHTML = html;
    menuEl = document.getElementById("kqlb-menu");

    var openBtn = document.getElementById("kqlb-open");
    if (openBtn) openBtn.onclick = function () { open(ctx.category, ctx.gameId, ctx.title); };

    var chip = document.getElementById("kqlb-userchip");
    if (chip) chip.onclick = function (e) {
      e.stopPropagation();
      menuEl.innerHTML =
        '<div class="kqlb-head">Signed in as</div>' +
        '<div class="kqlb-mi" style="pointer-events:none;color:#111;font-weight:800">' + esc(u.name) + '</div>' +
        (ctx && ctx.gameId ? '<div class="kqlb-mi" id="kqlb-mopen">🏆 View leaderboard</div>' : '') +
        '<div class="kqlb-mi" id="kqlb-mout">Sign out</div>';
      menuEl.classList.toggle("open");
      var mo = document.getElementById("kqlb-mopen");
      if (mo) mo.onclick = function () { menuEl.classList.remove("open"); open(ctx.category, ctx.gameId, ctx.title); };
      document.getElementById("kqlb-mout").onclick = function () { menuEl.classList.remove("open"); signOut(); };
    };
  }

  /* ------------------------------------------------------- viewer modal --- */
  function medal(i) { return i === 0 ? "g" : i === 1 ? "s" : i === 2 ? "b" : ""; }

  function rowHtml(r, i, meKey) {
    var rc = medal(i);
    var rankTxt = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1);
    var av = r.photo
      ? '<img class="kqlb-pa" src="' + esc(r.photo) + '" referrerpolicy="no-referrer" alt="">'
      : '<span class="kqlb-pav">' + esc(initials(r.name)) + '</span>';
    var tag = r.guest ? '<span class="kqlb-tag">guest</span>' : "";
    return '<div class="kqlb-row' + (r.key === meKey ? " me" : "") + '">' +
      '<div class="kqlb-rk ' + rc + '">' + rankTxt + '</div>' +
      av +
      '<div class="kqlb-pn">' + esc(r.name) + tag + '</div>' +
      '<div class="kqlb-sc">' + r.score + '</div>' +
    '</div>';
  }

  function open(cat, gameId, title) {
    if (!overlayEl) injectWidget();
    var meKey = currentUser().key;
    var nice = title || prettify(gameId);
    var catLabel = { single: "Single Player", multi: "Multiplayer", quiz: "Quiz" }[cat] || cat;
    overlayEl.innerHTML =
      '<div class="kqlb-modal">' +
        '<div class="kqlb-mtop"><div><h3>🏆 ' + esc(nice) + '</h3>' +
          '<div class="kqlb-sub">' + esc(catLabel) + ' • top scores</div></div>' +
          '<button class="kqlb-x" id="kqlb-close">✕</button></div>' +
        '<div class="kqlb-body" id="kqlb-list"><div class="kqlb-load">Loading leaderboard…</div></div>' +
        '<div class="kqlb-note" id="kqlb-note"></div>' +
      '</div>';
    overlayEl.classList.add("open");
    document.getElementById("kqlb-close").onclick = closeModal;

    fetchBoard(cat, gameId, 50).then(function (rows) {
      var list = document.getElementById("kqlb-list");
      if (!list) return;
      if (!rows.length) {
        list.innerHTML = '<div class="kqlb-empty">No scores yet.<br>Be the first on the board! 🎮</div>';
      } else {
        list.innerHTML = rows.map(function (r, i) { return rowHtml(r, i, meKey); }).join("");
      }
      var note = document.getElementById("kqlb-note");
      if (note) note.textContent = currentUser().isGuest
        ? "You're playing as a guest — sign in to save your name across devices."
        : "";
    }).catch(function () {
      var list = document.getElementById("kqlb-list");
      if (list) list.innerHTML = '<div class="kqlb-empty">Could not load the leaderboard.<br>Check your connection.</div>';
    });
  }
  function closeModal() { if (overlayEl) overlayEl.classList.remove("open"); }

  /* --------------------------------------------------------------- export */
  window.KQ = {
    ready: ready,
    user: currentUser,
    onAuth: function (fn) { if (typeof fn === "function") { authCbs.push(fn); try { fn(currentUser()); } catch (e) {} } },
    signIn: signIn,
    signInWithIdToken: signInWithIdToken,
    signOut: signOut,
    setNick: function (name) {
      name = String(name || "").trim().slice(0, 24);
      if (name) { try { localStorage.setItem("kq_nick", name); } catch (e) {} notifyAuth(); }
    },
    submit: submit,
    addWin: addWin,
    fetchBoard: fetchBoard,
    open: open,
    gameName: prettify
  };
})();

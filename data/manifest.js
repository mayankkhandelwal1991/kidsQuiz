/* ============================================================
   KQData — shared content-manifest loader
   ------------------------------------------------------------
   Loads games.json / quizzes.json so content can be updated
   WITHOUT shipping a new app build.

   Order of preference on each launch:
     1. Firebase Realtime Database  (config/games, config/quizzes)
        -> read over its public REST endpoint, no SDK needed.
        Whatever you put there wins, so you can add / feature /
        reorder games or edit questions and it goes live the
        same day — no Play Store review.
     2. Last good copy cached on THIS device (keeps things fresh
        even offline / on a flaky connection).
     3. The bundled JSON that ships inside the app (data/*.json)
        — guarantees the app always works, even first launch
        with no internet.

   To push a remote update: write the same JSON shape to
     https://<db>/config/games.json   (or /config/quizzes.json)
   in the Firebase console (or via a script). Leaving those
   nodes empty simply falls back to the bundled files.
   ============================================================ */
window.KQData = (function () {
  var DB_URL = "https://kidsgames-3987c-default-rtdb.asia-southeast1.firebasedatabase.app";
  var REMOTE_TIMEOUT_MS = 2500; // don't let a slow network stall the app

  function fetchWithTimeout(url, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = setTimeout(function () {
        if (!done) { done = true; reject(new Error("timeout")); }
      }, ms);
      fetch(url, { cache: "no-store" }).then(
        function (r) { if (!done) { done = true; clearTimeout(t); resolve(r); } },
        function (e) { if (!done) { done = true; clearTimeout(t); reject(e); } }
      );
    });
  }

  function nonEmpty(d) {
    if (!d) return false;
    if (Array.isArray(d)) return d.length > 0;
    if (typeof d === "object") return Object.keys(d).length > 0;
    return false;
  }

  // remoteKey: "games" | "quizzes"; localUrl: bundled fallback for THIS page
  function load(remoteKey, localUrl) {
    var cacheKey = "kq_manifest_" + remoteKey;

    return fetchWithTimeout(DB_URL + "/config/" + remoteKey + ".json", REMOTE_TIMEOUT_MS)
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (d) {
        if (!nonEmpty(d)) throw new Error("no remote content");
        try { localStorage.setItem(cacheKey, JSON.stringify(d)); } catch (e) {}
        return { data: d, source: "remote" };
      })
      .catch(function () {
        // device cache (last successful remote)
        try {
          var cached = localStorage.getItem(cacheKey);
          if (cached) {
            var parsed = JSON.parse(cached);
            if (nonEmpty(parsed)) return { data: parsed, source: "cache" };
          }
        } catch (e) {}
        // bundled file that ships with the app
        return fetch(localUrl, { cache: "force-cache" })
          .then(function (r) { return r.json(); })
          .then(function (d) { return { data: d, source: "local" }; });
      });
  }

  return {
    loadGames: function (localUrl) { return load("games", localUrl); },
    loadQuizzes: function (localUrl) { return load("quizzes", localUrl); }
  };
})();

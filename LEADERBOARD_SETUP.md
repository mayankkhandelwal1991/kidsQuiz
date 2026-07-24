# Google Login + Firebase Leaderboards — Setup & How It Works

This adds **Google login** and **per-level leaderboards** to all three
parts of your app — single-player games, the multiplayer game, and the quiz —
all stored in your existing Firebase project (`kidsgames-3987c`, Realtime
Database).

**Sign-in is now MANDATORY at the app entry.** When the app first opens
(`quiz2.html`), the user must sign in with Google before they can reach the
menu or play anything — there is no more "type your name" step. Once signed in,
the session persists, so the games and multiplayer screens they open from the
menu inherit the same account automatically. Signing out returns them to the
sign-in gate.

---

## 1. One-time Firebase console setup

You only do this once, in the [Firebase console](https://console.firebase.google.com)
for project **kidsgames-3987c**.

**a) Enable Google sign-in**
- Build → **Authentication** → **Sign-in method**
- Enable **Google**, pick a support email, Save.

**b) Authorize the domains you serve from**
- Authentication → **Settings** → **Authorized domains**
- Add the domain(s) where you host the HTML (e.g. `yourgame.web.app`,
  `localhost` is already allowed for testing).

**c) Publish the database rules**
- Build → **Realtime Database** → **Rules**
- Paste the contents of `firebase-database-rules.json` and **Publish**.
- These rules keep your multiplayer `rooms`/`lobby` open (as before) and add a
  public-readable, validated `leaderboards` branch.

That's it — no code changes needed.

---

## 2. What was added (and what was NOT touched)

**New file**
- `Game/kq-leaderboard.js` — the whole feature: Firebase init, optional Google
  login, a floating login/🏆 widget, score submission, and the leaderboard
  viewer popup. It loads the Firebase SDK itself, so pages only include this one
  file.

**Single-player games — ZERO game files changed.**
Every game already loads `Game/ads.js`, so the hook lives there. `ads.js` now:
- loads `kq-leaderboard.js`,
- auto-submits a score whenever a game saves a personal best
  (`localStorage.setItem('...Best', value)`) — this covers all the score games
  automatically, including any **new** game that follows the same pattern,
- also reads a score from `onGameComplete(score)` or from the page's
  `#score` / `#finalScore` / `#wpm` element.
- `Game/index.html` got a **🏆 Leaderboard** button on each game's detail card.

**Quiz (`quiz2.html`)** — submits the score to `quiz/<category>__<class-level>`
after each quiz, syncs the child's chosen quiz name to the leaderboard, and has
a **🏆 Leaderboard** button on the results screen (one board per subject + class).

**Multiplayer (`MultiPlayerGame/`)** — records a **win** for the player who
actually won each Tic Tac Toe game, and adds a **🏆 Leaderboard** button on the
multiplayer home screen.

---

## 3. Data layout in Realtime Database

```
leaderboards/
  single/<gameId>/<playerKey>   -> { name, photo, score, lowerIsBetter, ... }
  multi/<gameId>/<playerKey>    -> { name, photo, score(=total wins), ... }
  quiz/<category>__<level>/<playerKey> -> { name, photo, score, meta{correct,wrong} }
```
- `playerKey` is the Google `uid` when signed in, or a stable per-device guest id.
- Only the player's **best** score per level is kept (min for time/moves games).

---

## 4. Adding a leaderboard to a brand-new game (dynamic)

Nothing to do for score games that save a `...Best` value — they're picked up
automatically. To submit explicitly from any new game/screen:

```js
// higher score is better (default):
KQ.submit('single', 'my_new_game', score);

// lower is better (time / moves):
KQ.submit('single', 'my_new_game', seconds, { lowerIsBetter: true });

// win/lose game — count total wins:
KQ.addWin('single', 'my_new_game');

// open its leaderboard:
KQ.open('single', 'my_new_game', 'My New Game');
```

---

## 5. IMPORTANT for the Android app (WebView) — read this

Your `ads.js` talks to an `Android` bridge, so these pages also run inside an
Android **WebView**. Google's `signInWithPopup` **does not work inside a plain
WebView** (Google blocks OAuth in embedded browsers — you'll see
`disallowed_useragent`). In a normal **web browser** it works fine, which is
what you asked for.

**Because sign-in is now mandatory, this matters a lot:** if you ship these
pages inside a WebView without native sign-in, users will be stuck at the gate
and unable to enter the app. Options:

- **Web / PWA build:** works as-is in a real browser.
- **Android app:** implement native **Google Sign-In** in your Android code,
  then pass the ID token into the page and call
  `firebase.auth().signInWithCredential(...)`. The gate and leaderboard code
  stay the same. (Tell me if you want this wired up — I can add a small
  `Android`→page bridge hook.)

---

## 6. Sounds & animations (kq-fx.js)

`Game/kq-fx.js` adds sound effects and animations everywhere, with **no audio
files** — all sounds are generated in-browser with the Web Audio API, so there
is nothing extra to host and it works offline / in a WebView.

- **Button clicks** play a soft tick and a little press "boop" automatically.
- **Quiz:** a chime on each correct answer, a buzz on wrong, and a confetti
  celebration on finish (bigger for higher scores).
- **Games:** a success sound + confetti when a game completes (`onGameComplete`).
- **Mute toggle:** a 🔊 / 🔇 button appears next to the leaderboard widget
  (top-right); the choice is remembered.

It loads automatically — `kq-leaderboard.js` pulls it in, so every page that
already has the leaderboard also has sounds and animations. No setup required.
Browsers only allow audio after the first tap/click, which happens naturally.

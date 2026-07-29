# Game Zone — Multiplayer Game Collection

A collection of real-time multiplayer browser games, all built with the
same lightweight stack: **HTML5, CSS3, vanilla ES6 JavaScript, and the
Firebase Realtime Database.** No frameworks, no build step, no backend
server of your own — every game just needs its `index.html` served
statically.

`index.html` at the project root is the **hub page** — a simple game
picker that links out to each game's own folder. Every game shares one
Firebase project (via `common/firebase-config.js`) but keeps its data
fully isolated under its own `games/{gameId}/...` path, so nothing ever
collides between games.

---

## The 16 games

| Game | Folder | What it is |
|---|---|---|
| Tic Tac Toe | `tic-tack-toe/` | Classic 3-in-a-row |
| Connect Four | `connect-four/` | Drop discs, connect 4 in a row |
| RPS Duel | `rock-paper-scissors/` | Best-of-5 rock/paper/scissors |
| Word Duel | `word-duel/` | Race to unscramble a word, first to 4 |
| Typing Race | `typing-race/` | Same passage, fastest accurate typer wins |
| Memory Match | `memory-match/` | Flip-and-match card pairs, most pairs wins |
| Reaction Duel | `reaction-duel/` | Tap the instant it turns green, best of 5 |
| Trivia Battle | `trivia-battle/` | Multiple-choice race, first to 5 points |
| Dots & Boxes | `dots-and-boxes/` | Draw lines, claim boxes, most boxes wins |
| Battleship | `battleship/` | Auto-placed fleets, sink the enemy first |
| Pong Duel | `pong-duel/` | Real-time canvas Pong, first to 7 |
| **Space Blaster Duel** 🆕 | `space-blaster/` | Host-synced falling asteroid field — tap the fastest to blast them, first to 15 |
| **Blaster Arena** 🆕 | `blaster-arena/` | Top-down foam-bolt arena shooter, dodge and fire, first to 5 hits |
| **Basketball Shootout** 🆕 | `basketball-shootout/` | Time your release on a moving power bar, most baskets in 45s |
| **Bubble Shooter Duel** 🆕 | `bubble-shooter/` | Classic pop-3-match bubble shooter, race to 120 points |
| **Archery Duel** 🆕 | `archery-duel/` | Time your release as a 2D crosshair drifts toward the bullseye, best of 5 |

### About the 5 new games

- **Space Blaster Duel** and **Blaster Arena** reuse Pong Duel's host-authoritative
  pattern (P1 runs the real simulation, P2's actions are sent as lightweight
  events the host resolves) — see `common/net.js` and the note at the top of
  `pong-duel/js/app.js` for the underlying design this is based on.
- **Basketball Shootout** and **Bubble Shooter Duel** are independent
  per-player minigames (like Typing Race) — no physics need to be
  synced, only a shared scoreboard (`scores/{seat}`) and a shared match
  clock or "first to X" finish line.
- **Archery Duel** is structurally Reaction Duel with a 2D aim-timing skill
  test swapped in for raw reaction time; it reuses the exact same
  shared-timestamp + transaction-guarded round resolution.
- All five are family-friendly arcade-style games — "shooting" here means
  cartoon foam bolts / arrows / asteroid blasts, no real weapons or gore,
  consistent with the rest of the collection's tone.

Every game follows the same flow: **enter a nickname, tap Play.** You're
instantly paired with anyone else waiting; if nobody shows up within 30
seconds, you automatically play a built-in **Computer** opponent instead
— so nobody is ever stuck staring at an empty screen. A "Have a friend's
room code?" link on each landing screen also lets two specific people
play each other directly, bypassing random matchmaking.

---

## Project structure

```
MultiPlayerGame/
├── index.html                 # Hub page — pick a game
├── common/                    # Shared code used by every game
│   ├── firebase-config.js     #   ONE Firebase project config for all games
│   ├── utils.js                #   room codes, nickname persistence, SoundManager, math helpers
│   ├── net.js                  #   QuickMatch (matchmaking), seat claiming, presence
│   ├── shell.js                 #   Landing screen + in-game chrome UI wiring
│   └── theme.css                #   Shared neon visual theme (landing, chrome, toasts)
├── tic-tack-toe/
│   ├── index.html
│   ├── css/style.css
│   └── js/*.js
├── connect-four/               # same 3-part structure (index.html, css/, js/) …
├── rock-paper-scissors/
├── word-duel/
├── typing-race/
├── memory-match/
├── reaction-duel/
├── trivia-battle/
├── dots-and-boxes/
├── battleship/
├── pong-duel/
├── space-blaster/
├── blaster-arena/
├── basketball-shootout/
├── bubble-shooter/
└── archery-duel/
```

Each game folder is small on purpose — all the repetitive plumbing
(landing screen, matchmaking, presence, toasts, sound) lives once in
`common/`, imported via relative paths (`../../common/...`). Each game's
own `js/app.js` only has to implement its actual rules and rendering.

---

## 1. Firebase setup (shared by every game)

You only need to do this **once** — every game reuses the same project.

1. [https://console.firebase.google.com](https://console.firebase.google.com) → create a project (or reuse an existing one).
2. Register a **Web app** (`</>` icon) → copy the `firebaseConfig` object.
3. **Build → Realtime Database → Create Database** (test mode is fine to start).
4. Confirm the **databaseURL** shown in the console — if your database
   isn't in the default US region, the URL includes a region segment
   (e.g. `...asia-southeast1.firebasedatabase.app`). Use that exact URL.
5. Open `common/firebase-config.js` and paste your config in:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.<region>.firebasedatabase.app",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

That's the only code change needed — every game picks this up
automatically via a relative `<script src="../common/firebase-config.js">` tag.

### Security rules

Test-mode rules expire after 30 days. For a longer-lived deployment, use
shape-validated but still-open rules (no Firebase Auth is used anywhere
in this project, by design — see the fairness note below):

```json
{
  "rules": {
    "games": {
      "$gameId": {
        "lobby": {
          ".read": true,
          ".write": true,
          "waitingRoom": { ".validate": "newData.isString() || newData.val() == null" }
        },
        "rooms": {
          "$roomCode": {
            ".read": true,
            ".write": true,
            "players": {
              "$playerId": {
                ".validate": "newData.hasChildren(['nickname', 'seat'])",
                "nickname": { ".validate": "newData.isString() && newData.val().length <= 20" }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## 2. Run it

Because every game uses ES modules (`<script type="module">`), you need
a real HTTP server — opening `index.html` via `file://` will be blocked
by the browser's CORS rules on module imports.

```bash
cd MultiPlayerGame
python3 -m http.server 8080
# open http://localhost:8080
```

Open the hub, pick a game, tap **Play**. To test 2-player matches, open a
second tab (or a friend's device on the same network/deployment) and tap
Play on the same game within 10 seconds.

### Hosting for real

Any static host works:

- **Firebase Hosting** (pairs naturally with the Realtime Database):
  ```bash
  npm install -g firebase-tools
  firebase login
  firebase init hosting     # public dir = "." (or copy this folder into "public/")
  firebase deploy
  ```
- **GitHub Pages / Netlify / Vercel**: push the folder to a repo, or
  drag-and-drop it into the dashboard.

---

## 3. How matchmaking + the Computer fallback work

- Each game has its own `games/{gameId}/lobby/waitingRoom` pointer.
  Tapping **Play** runs a single Firebase transaction against it: if a
  room code is already waiting there, you join it (as the second seat);
  if it's empty, you reserve it with a freshly generated code and become
  the one waiting. Because transactions retry against the latest server
  value, two people tapping Play at the same instant can never both end
  up waiting, or both create separate rooms.
- The waiting player runs a 10-second client-side countdown. If nobody
  joins in time, a transaction seats a "Computer" player and flips the
  room into bot mode — the human's own browser then computes the
  Computer's moves and submits them through the exact same game-logic
  functions used for a real opponent, so a bot match behaves identically
  to a human one from the sync/rules side.
- Presence uses `onDisconnect().remove()` on each player's own node, so a
  closed tab, lost connection, or crash removes them within moments on
  every other connected screen — no server needed.
- Every game's turn/round logic goes through a **Firebase transaction**
  on the whole room object, so simultaneous or racing actions (two
  clicks, a click racing a timeout, etc.) can never corrupt shared state
  or double-count a result.

---

## 4. A note on fairness (please read before relying on this for anything competitive)

This project deliberately has **no Firebase Auth and no server-side
validation** — everything lives in one open Realtime Database, exactly
as scoped ("Firebase RTDB only, no backend"). That keeps every game
buildable with zero infrastructure beyond a Firebase project, but it
means a technically determined player could open their browser's
devtools and read data intended to be hidden from them before it's
officially revealed — for example:

- **RPS Duel**: seeing your opponent's rock/paper/scissors pick before
  choosing your own.
- **Word Duel / Trivia Battle**: the correct answer is derivable from a
  shared word/question list plus an index stored in the room.
- **Battleship**: reading the opponent's fleet layout directly instead
  of waiting to be shot.

For casual play with friends this is a reasonable trade-off — nobody
is going to devtools their way through a game night — but it's worth
knowing about. A "trustless" version of these games would need Firebase
Auth plus either Cloud Functions or per-user security rules to keep
hidden information truly hidden, which is out of scope for this
zero-backend build.

---

## 5. Troubleshooting

- **"Could not find or create a match. Check your Firebase configuration."**
  Double-check `common/firebase-config.js` has real values and that
  Realtime Database (not Firestore) is enabled with the matching
  `databaseURL`.
- **Blank page / console errors about CORS or modules** — you opened a
  game via `file://`. Serve the folder with an HTTP server (see section 2).
- **Stuck on "waiting for an opponent"** — confirm the second player
  actually tapped **Play** (or used the matching room code + "Join that
  room"), and that both are pointed at the same Firebase project.
- **Nothing happens after 10 seconds** — check the browser console; if
  Realtime Database rules are too restrictive, the `activateBot()`
  transaction will silently fail. Compare your rules against section 1.
- **Sounds don't play on mobile** — browsers require a user gesture
  before starting audio; the first tap (Play/Join) unlocks it. If sound
  still seems off, check the 🔊 icon hasn't been toggled to muted.

Each game folder also has game-specific quirks noted in comments at the
top of its `js/app.js` (e.g. Pong Duel's host-authority limitation,
Battleship's auto-placement).

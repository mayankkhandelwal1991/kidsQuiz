# Tic-Tac-Toe Arena

A real-time, browser-based multiplayer tic-tac-toe game — same stack as
Tag Arena: **HTML5, CSS3, vanilla ES6 JavaScript, Firebase Realtime
Database**. No frameworks, no build step, no backend server of your own.

Enter a nickname and tap **Play** — that's it. You're instantly paired with
anyone else who's also waiting; if no one shows up within **30 seconds**,
you automatically start a match against a built-in **Computer** opponent
instead, so you're never stuck staring at an empty board. Two players get
seated as **X** and **O**; anyone else who joins the same room spectates
live. Moves, turns, win/draw detection, score, and presence are all synced
instantly across devices.

---

## Folder structure

```
tic-tac-toe/
├── index.html            # Landing screen + game screen markup
├── firebase-config.js    # <-- paste your Firebase project config here
├── css/
│   └── style.css         # Visual styling & animations (same family as Tag Arena)
├── js/
│   ├── game.js             # Orchestrates network + UI + local player list + bot triggering
│   ├── network.js          # All Firebase Realtime Database logic + matchmaking
│   ├── ui.js                # Landing screen, board rendering, status/scoreboard
│   ├── bot.js                # Heuristic "Computer" opponent (win/block/positional play)
│   └── utils.js             # Helpers + procedural SoundManager
└── README.md
```

Sounds (place, join, leave, win, draw, click) are synthesized live via the
Web Audio API in `js/utils.js` — no binary asset files required.

---

## 1. Firebase setup

You can reuse the **same Firebase project** you already created for Tag
Arena — this game just uses its own `rooms/{code}` shape, so the two
games never conflict even sharing a database.

If starting fresh:

1. [https://console.firebase.google.com](https://console.firebase.google.com) → create a project.
2. Register a **Web app** (`</>` icon) → copy the `firebaseConfig` object shown.
3. **Build → Realtime Database → Create Database** (test mode is fine to start).
4. Confirm the `databaseURL` shown in the console — if your database isn't
   in the default US region, the URL will include a region segment (e.g.
   `...asia-southeast1.firebasedatabase.app`). Use that **exact** URL.

Paste the config into `firebase-config.js`:

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

### Security rules

Same approach as Tag Arena — shape-validated but open (no Firebase Auth is
used, matching the "Firebase RTDB only" brief):

```json
{
  "rules": {
    "lobby": {
      ".read": true,
      ".write": true,
      "waitingRoom": { ".validate": "newData.isString() || newData.val() == null" }
    },
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true,
        "cells": {
          "$i": { ".validate": "newData.isString()" }
        },
        "turn": { ".validate": "newData.val() == 'X' || newData.val() == 'O'" },
        "status": { ".validate": "newData.isString()" },
        "players": {
          "$playerId": {
            ".validate": "newData.hasChildren(['nickname', 'symbol'])",
            "nickname": { ".validate": "newData.isString() && newData.val().length <= 20" },
            "symbol": { ".validate": "newData.val() == 'X' || newData.val() == 'O' || newData.val() == 'spectator'" }
          }
        }
      }
    }
  }
}
```

---

## 2. Run it

ES modules require a real HTTP server (not `file://`):

```bash
cd tic-tac-toe
python3 -m http.server 8080
# open http://localhost:8080
```

## 3. Play

1. Enter a nickname and click **Play**.
   - If someone else is already waiting, you're paired with them
     instantly — one of you is **X**, the other **O**.
   - If nobody's waiting, you become the one waiting: a countdown appears
     ("No opponent yet — starting a match vs Computer in 30s…"). If a
     human joins before it runs out, you play them. If it hits zero, the
     **Computer** takes the O seat automatically and the match begins.
2. X always moves first. Click any empty cell on your turn — the board,
   turn indicator, and score update instantly (played live over Firebase
   against a human opponent; played locally against the Computer).
3. When someone gets three in a row (or the board fills up), the result
   banner shows and a **Play Again** button appears — click it to reset
   the board while keeping the running score. Against the Computer this
   just starts another round against the same bot; against a human it
   rematches them.
4. Want to play a specific friend instead of the random-match queue? Tap
   **"Have a friend's room code?"** on the landing screen to reveal a
   room-code field — one of you creates by tapping Play normally and
   shares the code (🔗 button in-game), the other pastes it there and
   taps **Join that room**.
5. A third person who joins the same room code becomes a **spectator** —
   they see the live board and status but can't click cells.
6. Close a seated human player's tab mid-match — the other player is
   notified and the board resets to "waiting", ready for a new opponent
   (or another 30-second countdown to the Computer) to take that seat.

### About the Computer opponent

The bot (`js/bot.js`) plays a simple heuristic ladder — it always takes an
immediate win, always blocks your immediate win, and otherwise favors the
center/corners with a touch of randomness. It's solid but intentionally
beatable, rather than a flawless minimax player, since the goal is a fun
solo fallback rather than an unbeatable wall.

---

## How the sync works (short version)

- **Matchmaking**: a single `lobby/waitingRoom` value holds the room code
  of whoever's currently waiting. Tapping Play runs one Firebase
  transaction against it: if it already holds a code, you join that room
  as O and the pointer clears; if it's empty, you reserve it with a
  freshly generated code and become X. Because transactions retry against
  the latest server value, two people tapping Play at nearly the same
  instant can never both end up "waiting" or both create separate rooms —
  exactly one room gets created and the other player lands in it.
- **Bot fallback**: the waiting player runs a 30-second client-side
  countdown. If it expires with the room still `status: 'waiting'`, a
  transaction seats a virtual "Computer" player as O and flips the room
  into `mode: 'bot'`. From then on, whenever it's O's turn, the human's
  own client computes the bot's move (see `js/bot.js`) and submits it
  through the same room transaction used for real moves — so a bot match
  still goes through Firebase exactly like a human one, just with only
  one real player attached.
- Each room lives at `rooms/{roomCode}`, holding `cells` (9 slots),
  `turn`, `status`, `winner`, `winningLine`, and running `scores`.
- Seating (`X` / `O` / `spectator`) is assigned via a Firebase
  **transaction** on the `players` node, so two people joining at the same
  instant can never both become `X`.
- Every move runs as a single **transaction on the whole room**: it
  checks turn legality, cell occupancy, and game status; applies the
  move; and computes win/draw detection — all atomically. This means two
  near-simultaneous clicks can never corrupt the board or double-count a
  win.
- Presence uses `onDisconnect().remove()` on each player's own node, so a
  closed tab, lost connection, or crash removes them within moments on
  every other connected screen, no server needed.
- The whole room object is small, so the UI just listens to a single
  `value` event on the room and re-renders the board each time — simple
  and cheap at this scale.

---

## Troubleshooting

Same checklist as Tag Arena applies here — see that project's README for
the full list (config typos, wrong database region, CORS/`file://`
issues, security rules). A couple of tic-tac-toe-specific notes:

- **"Waiting for an opponent…" never changes** — confirm the second
  player actually clicked **Join Room** with the exact code, not **Create
  Room** (Create always makes a brand-new room).
- **My click doesn't place a mark** — check it's actually your turn (X
  goes first) and that you aren't a spectator (a third+ joiner in the
  same room watches only).

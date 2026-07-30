# Kids Quiz & Games

A kid-friendly educational app: a 20-topic quiz (Class 1–5), 56 single-player
games, and 24 real-time multiplayer games — all in one place.

## Start point

**`quiz2.html` is the app's home screen and entry point.** The Android WebView
should load `quiz2.html`. A tiny `index.html` at the root simply redirects to
`quiz2.html`, so opening the bare domain also lands on the home screen.

## Folder structure

```
/
├── quiz2.html      ← START POINT — home screen + all quiz logic
├── index.html      ← redirect to quiz2.html (for the bare domain)
├── quiz/           ← quiz question banks (one folder per subject, one file per class)
├── games/          ← single-player games (was "Game/")
│                     engine files: ads.js, kq-leaderboard.js, kq-fx.js, rating.js
│                     categories: action/ puzzle/ brain/ word/ strategy/ ai/ threed/
├── multiplayer/    ← real-time multiplayer games (was "MultiPlayerGame/")
│                     shared code lives in multiplayer/common/
└── shared/
    └── firebase-database-rules.json
```

## How the home screen links everything

The home screen (`quiz2.html`) opens each section with a **relative** path:

- Start Quiz → in-page quiz flow
- Solo Games → `games/index.html`
- Play with Friends → `multiplayer/index.html`
- Leaderboard → in-page leaderboard hub

Relative paths mean the app works the same whether it's opened locally, on
GitHub Pages, or bundled inside the Android app — no hardcoded site URL.

## What changed in this pass

- Renamed `Game/` → `games/` and `MultiPlayerGame/` → `multiplayer/` for a
  clean, lowercase, consistent top level.
- Moved `firebase-database-rules.json` into `shared/`.
- Added `index.html` (redirect) and this `README.md`.
- Redesigned the home screen: the 24 multiplayer games are now reachable
  directly from home via a **Play with Friends** card, instead of being hidden
  behind a pop-up. Games and multiplayer now open by relative path, so testing
  locally no longer jumps to the live site.

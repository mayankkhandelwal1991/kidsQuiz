# Content manifests — how updating works now

All game and quiz content is data, not code. You add or change content by
editing JSON — you no longer touch page logic or add `<script>` tags.

## The two manifests

### `games.json`
```json
{
  "version": 1,
  "categories": [
    { "id": "action", "icon": "🏃", "title": "Action & Arcade",
      "bg": "#FF6B57", "shadow": "#D6432F", "order": 1 }
  ],
  "games": [
    { "id": "egg_jump", "file": "action/egg_jump.html", "icon": "🥚",
      "title": "Egg Jump", "how": "Tap to jump…", "category": "action",
      "badge": null, "featured": false, "order": 1 }
  ]
}
```

**To add a game:** drop its HTML file into `games/<category>/`, then add one
entry to the `games` array. That's it — the Games hub renders it automatically.

- `badge` — show a corner ribbon: `"NEW"`, `"3D"`, `"HOT"`, or `null`.
- `featured` — reserved flag for a future "Featured" row (already in the shape).
- `order` — lower numbers show first (within a category, and for categories).

### `quizzes.json`
```json
{
  "science": {
    "3": [
      { "question": "Boiling point of water?", "answer": "100°C",
        "options": ["100°C", "90°C", "110°C", "120°C"] }
    ]
  }
}
```
Shape is `subject → class(1–5) → [questions]`. Exactly 4 options; `answer` must
match one option exactly. Math subjects (Add & Subtract, Multiplication, etc.)
are generated in code and don't live here.

You can edit `quizzes.json` directly, **or** edit the friendlier
`quiz/<subject>/class<N>.js` files and recompile:
```bash
node tools/build-quizzes.js
```

## Loading order (see `data/manifest.js`)

On every launch each manifest is loaded in this order:

1. **Firebase Realtime Database** — `config/games` and `config/quizzes`.
   Whatever is there wins, so you can update content live.
2. **Device cache** — the last good remote copy (keeps things fresh offline).
3. **Bundled JSON** — these files, shipped in the app (always works, even
   first launch with no internet).

## Pushing an update WITHOUT a new app release

Put the same JSON under `config/` in your Realtime Database:

```
config/
  games     ← full contents of games.json
  quizzes   ← full contents of quizzes.json
```

You can paste it in the Firebase console (Realtime Database → import JSON at the
`config` node) or push it with a script. Next time anyone opens the app they get
the new content — no Play Store review, same day. Leave those nodes empty and
the app simply uses the bundled files.

> Note: the database is currently world-readable/writable. Before relying on
> remote config in production, lock `config/` to read-only for clients so only
> you can change it (see `shared/firebase-database-rules.json`).

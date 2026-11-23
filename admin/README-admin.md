# Kids Quiz admin — Players portal

**Page:** `admin/users.html` (live: `https://mayankkhandelwal1991.github.io/kidsQuiz/admin/users.html`)

- Sign in with Google. Only the admin account set in the Firebase rules gets in;
  everyone else sees "Not an admin".
- Lists every player (Google and guest) from Firebase: name, ID, type, points,
  plays, time played, first seen / last active. Search, filter, sort, CSV export.
- Click a player: best scores, recent plays and visits.
- Delete one player, or tick several and "Delete selected": removes their
  leaderboard entries, play history (`attempts`) and visits (`sessions`).
  Type DELETE to confirm. Their Google sign-in account itself stays — remove it
  in Firebase console → Authentication if needed.

## Firebase rules (required)

The page has no secret in it; the Realtime Database rules are what protect the data.
Firebase console → Realtime Database → Rules: add these to the existing rules
(replace `ADMIN_EMAIL` with the admin Google address), then **Publish**.

```
"admin":        { ".read":  "<ADMIN>", ".write": "<ADMIN>" },
"config":       { ".read":  true,      ".write": "<ADMIN>" },
"attempts":     { ".write": "<ADMIN>", ...existing children... },
"sessions":     { ".write": "<ADMIN>", ...existing children... },
"leaderboards": { ".write": "<ADMIN>", ...existing children... }
```

where `<ADMIN>` is:

```
auth != null && auth.token.email == 'ADMIN_EMAIL' && auth.token.email_verified == true
```

Reading `/admin` is how the page checks access, so without the `"admin"` rule
nobody (not even the admin) gets in.

## App settings (📱 tab) → `config/app`

Read by the Android app on every launch (saved on the phone for offline) and by
the web pages: reminder (off / daily / weekly, time, day, text), offline play,
"Share my score" button, floating 🏆 in the app, banner ad, full-screen ad
frequency and quit ads. Needs the `"config"` rule above (public read so the app
can fetch it without signing in; only the admin can change it).

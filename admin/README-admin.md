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

## Coins (🪙 tab) → `config/app/coins`, wallets → `wallets/<player>`

Rule (add next to "config"):

```
"wallets": {
  ".read": true,
  ".write": "<ADMIN>",
  "$player": {
    ".write": "(auth != null && auth.uid === $player) || $player.beginsWith('g_')",
    ".validate": "!newData.exists() || (newData.child('coins').isNumber() && newData.child('coins').val() >= 0)"
  }
}
```
Signed-in players can only change their own wallet; guest wallets (`g_…`) have
no sign-in, so they are open like guest scores. The admin can set or delete any.

## Weekly leagues → `leagues/<week>/<group>/<player>`

Used by the Fun zone (games/kq-play.js). `<week>` is the Monday (e.g. `2026-11-23`),
`<group>` is `c3` (Class 3), `c0` (LKG), `cu` (UKG) or `k_<CODE>` (class code).
Each row: `{ n: first name, cc: country, p: points, t: time }`. Add next to "wallets":

```
"leagues": {
  ".read": true,
  ".write": "<ADMIN>",
  "$week": {
    "$group": {
      ".indexOn": ["p"],
      "$player": {
        ".write": "(auth != null && auth.uid === $player) || $player.beginsWith('g_')",
        ".validate": "!newData.exists() || (newData.child('p').isNumber() && newData.child('p').val() >= 0 && newData.child('p').val() <= 100000 && newData.child('n').isString() && newData.child('n').val().length <= 20)"
      }
    }
  }
}
```
Without this rule the league screen says "Leagues are not switched on yet".

The complete rules (with the real admin e-mail) are in `admin/firebase-rules.json` on the
server only — it is in `.gitignore`, so it never goes to the public GitHub repo.
Old weeks can be deleted from the Firebase console any time.

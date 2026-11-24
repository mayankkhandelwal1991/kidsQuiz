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

## Instagram from GitHub Pages (no PHP server) — Instagram Studio "browser mode"

`admin/index.html` opened on **github.io** switches to browser mode automatically
(or add `?mode=browser`). It talks to Instagram directly from the browser; photos and
videos are put on a small **public media repo** that GitHub Pages serves, so Instagram
can download them. After posting, the file is deleted again (checkbox).

One-time setup:
1. **Media repo:** GitHub → New repository → name `kq-social` → **Public** → tick
   "Add a README file" → Create. Then repo **Settings → Pages** → Source: *Deploy from a
   branch* → Branch `main` / `(root)` → Save. (Wait ~1 minute: Pages is on at
   `https://<you>.github.io/kq-social/`.)
2. **GitHub token:** GitHub → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → Generate new token → Repository access: **Only select
   repositories → kq-social** → Permissions → Repository permissions → **Contents: Read and
   write** → Generate → copy (`github_pat_…`). It cannot touch the app's code repo.
3. Open `https://<you>.github.io/kidsQuiz/admin/index.html`, sign in as admin. In
   **3 · Publish to Instagram**: type a passphrase, open **🔐 Connection settings**, fill in
   Instagram user ID, Instagram access token, GitHub token and `<you>/kq-social`, press
   **Save (encrypted)**, then **Check connection**.
4. Next time: type the passphrase → **Publish now**.

Tokens are stored only in that browser, AES-GCM encrypted with the passphrase (never
on GitHub). Use **Forget** to remove them. Instagram tokens expire (Facebook-login
tokens: extend to 60 days in Meta's Access Token Debugger → "Extend Access Token").
Videos up to 45 MB (GitHub API limit); photos are converted to JPEG and padded to an
Instagram shape (4:5 … 1.91:1) automatically.

## Post links & clicks → `promo/`

Instagram Studio captions contain a tracking link
`https://<you>.github.io/kidsQuiz/app/?s=ig&m=<post|reel>&p=<post code>`.
`app/index.html` adds one row to `promo/clicks/<code>` and opens Google Play with
`referrer=utm_source=instagram&utm_medium=…&utm_campaign=<code>` (Play Console →
Statistics shows installs per UTM campaign). Published posts are saved in
`promo/posts/<code>` (title, kind, permalink) so the Studio's **📈 Links & clicks**
card can list clicks per post. `android-app.html` forwards to `app/` too.
Other networks: change `s=` (fb, yt, wa, web, school…).

Rule (next to "leagues"):
```
"promo": {
  ".read": "<ADMIN>", ".write": "<ADMIN>",
  "clicks": { "$code": { "$id": {
    ".write": "!data.exists()",
    ".validate": "newData.hasChildren(['t']) && newData.child('t').isNumber() && newData.child('t').val() <= now && (!newData.child('s').exists() || (newData.child('s').isString() && newData.child('s').val().length <= 24)) && (!newData.child('m').exists() || (newData.child('m').isString() && newData.child('m').val().length <= 24))"
  } } }
}
```
Anyone can add a click (the landing page has no login) but not change or read them;
only the admin reads the counts.

## Instagram Studio — steps, Reels and History

**Create** tab, five steps: ① what to post → ② design → ③ Reel video → ④ caption → ⑤ publish.
The right side shows the post exactly as big as on a phone, inside the Instagram feed or Reels
screen (untick "Instagram buttons" to hide the overlay). Text in Reels stays out of the areas
Instagram covers with its buttons.

**Reels** are drawn and recorded in the browser (no AI service, no cost): app splash → Ollie the
owl asks the question → countdown → answer with confetti → real gameplay → "Play FREE".
Picking a game in step ① puts that game's own gameplay first (games marked 🎬 in the list).
Gameplay clips live in `images/reel/` (WebP sprite sheets + `clips.json`); re-record them after
changing games: `python3 PlayStoreThings/store-listing/record-gameplay.py [game ids]`.

**History** tab: the latest 25 posts with likes and comments from Instagram, plus link clicks from
`promo/`. Views, reach, saves and shares also need the **instagram_manage_insights** permission:
Graph API Explorer → add it → Generate Access Token → paste the new token in ⑤ → Connection settings → Save.

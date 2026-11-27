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

**Reel sound** (step ③ → 🎵 Music): 🎉 Happy pop, 🎮 Arcade or 🌈 Calm music is written by the
Studio for each scene (no copyright issues), or use your own file (YouTube Audio Library /
Pixabay Music), or 🔇 effects only. Instagram's trending sounds can't be added by any app —
download the Reel and add the sound in the Instagram app. Chrome on Linux can't record AAC
sound, so the Studio converts it with ffmpeg.wasm (`admin/vendor/ffmpeg/`, engine loaded from
jsDelivr the first time, ~31 MB).

## Growth tracker (admin → 📈 Growth, `admin/growth.html`)

Tracks progress towards 10,000 downloads in one place:

| Metric | Where it comes from |
|---|---|
| New devices per day, daily active devices | The app (automatic) |
| Day 1 / Day 7 retention, "back within 7 days" | The app (automatic), by first-day group |
| Store listing visitors, first-time installers, uninstalls | Play Console → Statistics — type them in on the page |
| Ad spend, paid installs → cost per install | Google Ads — type them in on the page |
| Install conversion rate | installs ÷ listing visitors (from the typed-in numbers) |

**Child-safe:** the app records only a random device id made on the device (no name,
email or advertising id), the first day it was seen, `app`/`web`, and which days it was
used — at most one small write a day (`games/kq-leaderboard.js` → `growthTick`).

**Switch it on:** Firebase console → Realtime Database → Rules → add the `growth` block
from `admin/firebase-rules.json` (only the admin can read; devices can only add their own
first day and used days; typed-in numbers are admin-only) → **Publish**. Until then the
page shows "Growth data is not switched on yet" and the app's writes are refused.

### Automatic Play Console numbers (daily import)

`.github/workflows/play-stats.yml` runs every day at 11:00 IST (and on demand: GitHub →
Actions → "Play Console stats -> Firebase" → Run workflow). It runs
`tools/play-stats/import_play_stats.py`, which reads Play Console's daily bulk-report files
and writes **first-time installers, uninstalls and store listing visitors** into Firebase
`growth/manual/<date>` (marked 🤖 Play on the Growth page). Ad spend, paid installs and notes
you type on the page are kept — the import only updates its own three numbers.

One-time setup (about 10 minutes) — one key does both jobs:

1. **Firebase key** — Firebase console → project `kidsgames-3987c` → ⚙️ Project settings →
   **Service accounts** → note the email (`firebase-adminsdk-…@kidsgames-3987c.iam.gserviceaccount.com`)
   → **Generate new private key** → a JSON file downloads. Keep it private (never in the repo:
   `.gitignore` blocks `*firebase-adminsdk*.json`).
2. **Play Console access** — Play Console → Manage account → **Users and permissions** →
   Invite new users → that `firebase-adminsdk-…` email → **Account permissions** → tick
   **"View app information and download bulk reports (read-only)"** → Invite.
   Google can take **24–48 hours** before the account can read the reports (until then the
   job says "NO PERMISSION YET").
3. **Bucket** — Play Console → Manage account → **Download reports** → Statistics →
   **Copy Cloud Storage URI** (`gs://pubsite_prod_rev_…`). Ours: `pubsite_prod_rev_10169471778906171674`.
4. **GitHub secrets** — repo → Settings → Secrets and variables → Actions → New secret:
   - `PLAY_SA_JSON` = the whole JSON from step 1
   - `PLAY_BUCKET` = the URI from step 3
   (`FIREBASE_SA_JSON` is not needed: the script writes to Firebase with `PLAY_SA_JSON`.)
5. GitHub → Actions → "Play Console stats -> Firebase" → **Run workflow** with
   "dry run" ticked: the log lists the files and numbers it found. Then run it without
   dry run (or wait for the next day's automatic run at 11:00 IST).

Notes: Play updates the reports about once a day and can be 1–2 days behind. Store listing
visitors come from the store-performance report if Play puts it in the bucket for your
app; if not, type them in. GitHub pauses scheduled jobs after 60 days with no commits in
the repo — any push (or Run workflow) starts it again.


## Privacy: sessions are admin-only, play time is public as daily totals

`sessions/<player>/<id>` (start/end times, country, name) is readable **only by the admin**.
The public leaderboard's "time played" uses `playtime/<player>/<YYYYMMDD>` = seconds that day
(no times of day, names or country), written by `games/kq-leaderboard.js`. Both rules are in
`admin/firebase-rules.json` (`sessions` `.read` = admin, new `playtime` block) — **publish them
in Firebase** together.

## 🔔 Notifications (users.html#push)

Send a push notification to phones with the Android app **1.0.15 or newer**.

1. Open the admin console **from your computer** (`http://localhost/mayank/MK/kidsQuiz/admin/users.html#push`)
   or from the `start-public.sh` link — sending runs in `admin/api.php`, which uses the Firebase
   service-account key on this computer (`PlayStoreThings/*firebase-adminsdk*.json`, never in git;
   or set `fcm_service_account` in `config.php`).
2. Type the admin password (`admin_password` in `config.php`) and press **Check** → "✅ Ready".
3. Pick a **type** (News · Reminder · Homework & teachers · Parent report — each is its own
   Android channel, so parents can mute one kind), what it **opens** on tap, a title and a message.
4. Pick **who**: everyone, classes (LKG–Class 5), teachers (phones with a teacher-mode class),
   an interest from the 3 starting questions, children who like friends, Google families, guests,
   or **selected players** (tick them in 👥 Players → "🔔 Notify selected").
5. **Send.** Everything sent is listed under 📜 Sent (`pushlog/`).

How phones are grouped: `push.js` subscribes each phone to topics (`all`, `class_lkg`…`class_5`,
`teachers`, `google`/`guest`, `like_<interest>`, `friends`) and saves its token in
`push/tokens/<player>` for "selected players". Parents can switch notifications off in For parents.
Needs the `push` and `pushlog` rules from `admin/firebase-rules.proposed.json`.
Children's app (Play Families): keep messages friendly and useful — no ads or offers for other apps.

## Teacher mode and classes (2026-11-28)

- **Mode switch** (`role.js`, phone-wide `kq_role`): after Google sign-in the app asks once "A child / A teacher". Home has a Student mode / Teacher mode toggle; Teacher mode is behind the grown-up question. In Teacher mode home is `teacher.html` (Classes · Quizzes · Stories · Results) and quizzes/stories are previews: no leaderboard, coins or homework result.
- **Teacher's classes** are now kept with the Google account (`teachers/<uid>/classes`), so they show on any phone and after switching child profiles. Old codes found on the phone are moved there automatically.
- **Students** (`class.js`): join with the class code, or find the teacher by name (only classes with "Students can find this class" on, `tdir/<code>`) and send a request the teacher accepts. A child can be in up to 10 classes; all tests show on home under "My class(es)", with "See all".
- **Ranking**: per test, the teacher switches "🏆 Ranking: shown/hidden" (`tasks/<code>/<id>/pub`). Students then see who came first (best score, then who finished first).
- **New test notification**: the app (1.0.15+) checks the child's classes every ~3 hours (`ClassWatch.kt`, public `tasks/<code>` read) and shows "📝 New test from Mrs Sharma". No server needed. On home a "🔔 New test" banner shows too.
- **Rules**: publish `admin/firebase-rules.proposed.json` (adds `teachers`, `tdir`, `classes/<code>/tn`, `classes/<code>/requests`, `tasks/.../pub`).

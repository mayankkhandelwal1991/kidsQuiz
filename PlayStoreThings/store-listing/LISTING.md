# Play Store listing — Kids Quiz (version 1.0.13)

Everything to paste into **Play Console → Grow users → Store presence → Main store listing**.
Images are in this folder:

| What | File | Play Console field |
|---|---|---|
| Phone screenshots (8) | `screenshots/01…08-*.png` (1080 × 1920) | Phone screenshots — upload in this order |
| Feature graphic | `feature-graphic.png` (1024 × 500) | Feature graphic |
| App icon | your current 512 × 512 icon (no change needed) | App icon |

The same screenshots can also go into **7-inch and 10-inch tablet screenshots**.
To remake the images after the app changes: `./make-assets.sh` (needs the local web server).

---

## App name (max 30 characters)

Pick one. The first words matter most for search.

1. `Kids Quiz: GK & Olympiad Games` ← recommended (30)
2. `Kids Quiz – Learning Games` (26)
3. `Kids Quiz: GK, Maths & Games` (28)

## Short description (max 80 characters)

```
GK quiz, maths & Olympiad practice for LKG–Class 5. Fun games & badges!
```

Alternative (A/B test it in Store listing experiments):

```
Learn with fun quizzes, 50+ games & Olympiad papers. LKG to Class 5.
```

## Full description (max 4000 characters)

```
Kids Quiz makes learning feel like playing! Fun quizzes, brain games and Olympiad practice papers for children from LKG and UKG to Class 5 — with stars, badges, coins and a friendly owl to cheer them on.

🎯 FUN QUIZZES IN 14 SUBJECTS
GK, English, Hindi, Science, Maths (add & subtract, multiplication, division), Animals, Plants, Space, Human Body, Geography, Computers, Sports, History and Capitals. Questions are made for each class, from picture questions with read-aloud for LKG and UKG to Class 5 GK quiz questions with answers.

🗺️ MY LEARNING PATH
Every class has its own colourful map. Finish a quiz to win stars ⭐ — get 1, 2 or 3 stars and unlock the next stop. Children always know what to play next.

🏅 OLYMPIAD PRACTICE PAPERS
Practice papers for Maths, Science, English, GK, Computers, Social Studies, Reasoning and Creative Arts Olympiads. Great for school Olympiad preparation — and every finished paper earns a certificate.

🎮 50+ BRAIN GAMES & 3D GAMES
Puzzles, word games, spelling, quick maths, memory match, racing and 3D runner games. Play alone or with friends online (2–8 players).

🎁 SOMETHING NEW EVERY DAY
• Question of the day with bonus coins
• Daily gift calendar — day 7 is a big treasure chest!
• Daily mission and play streaks 🔥

🛍️ DRESS UP YOUR OWL
Earn coins by learning and spend them in the owl shop: crowns, hats, cool glasses, photo frames and colourful home themes.

🏆 56 BADGES & WEEKLY LEAGUES
Collect badges for quizzes, games, streaks and Olympiad papers. Join the weekly league for your class, or make a class code so classmates and friends can compete together.

👨‍👩‍👧 MADE FOR PARENTS TOO
• Weekly report every Sunday: how many quizzes and games your child finished
• Shareable certificates for badges and Olympiad papers — send them to family on WhatsApp
• Play history and accuracy for each subject

🔒 SAFE FOR KIDS
• No chat with strangers — leagues show only first names and country flags
• Child-friendly ads only (rated G)
• Play as a guest, or sign in with Google to keep progress on every device

Perfect for:
✔ LKG, UKG and Class 1, 2, 3, 4, 5 students
✔ GK quiz for kids and general knowledge practice
✔ Olympiad preparation (maths, science, English, GK)
✔ Learning English, Hindi and maths through play
✔ Parents and teachers looking for educational games

Download Kids Quiz and make learning the best part of the day! 🦉
```

## What's new in 1.0.13 (release notes, max 500 characters)

```
🎉 New Fun zone!
• 🗺️ My learning path — win stars to unlock the next subject
• 🎁 Daily gift calendar and ❓ Question of the day
• 🛍️ Owl shop — hats, glasses, frames and themes for your coins
• 🏆 Weekly leagues by class or with a class code
• 🏅 56 badges and certificates to share
• 📊 Weekly report for parents every Sunday
• Faster ads, bug fixes and a new badges screen
```

## Store settings

- **Category:** Education (secondary tag ideas: Educational games, Quiz, Brain games)
- **Tags** (Store settings → Tags): Educational, Quiz, Trivia, Puzzle, Learning, Kids
- **Contact email / website / privacy policy:** keep your current ones (privacy policy page: `privacy_policy.html`)
- **Target audience (Policy → App content):** ages 5 & under, 6–8 and 9–12 → the app is in the **Families program**. Keep "Teacher Approved" consideration on.

## Before you upload 1.0.13 — App content updates

1. **Data safety form** — new ad SDKs (Chartboost, Unity Ads, Liftoff/Vungle, DT Exchange) collect *device or other IDs* and *app interactions* for advertising and analytics. Update the form: Play Console → Policy → App content → Data safety. Each network publishes a "Google Play Data safety" guide — use it.
2. **Ads declaration:** "Yes, my app contains ads" (already).
3. **app-ads.txt** on your developer website: add the lines each network gives you (Chartboost, Unity, Liftoff, DT Exchange) next to the AdMob line in `PlayStoreThings/ads.txt`.
4. **Firebase rule for leagues** — see `admin/README-admin.md` → "Weekly leagues". Without it the league screen shows "Leagues are not switched on yet".

## Custom store listing for India (Hindi / Hinglish)

Play Console → Store presence → Custom store listings → **Create** → Country: India, Language: Hindi.

- **Name:** `Kids Quiz: GK Hindi & English` (29)
- **Short description:**
  ```
  बच्चों के लिए GK quiz, maths, Hindi, English, Olympiad practice – LKG से Class 5
  ```
- **Full description:** start with
  ```
  Kids Quiz – बच्चों के लिए मज़ेदार GK quiz, Maths, Hindi, English और Olympiad practice papers! LKG, UKG और Class 1 से 5 तक के बच्चों के लिए। हर दिन Question of the day, daily gift, 56 badges, weekly league और parents के लिए weekly report.
  ```
  then paste the English full description below it (Indian parents search in both).

## Store listing experiments (free A/B tests)

Play Console → Grow users → Store listing experiments. Run one at a time for 2–3 weeks:
1. Short description A vs B (above)
2. First screenshot: "Learn & play" (01) vs "Your own learning path" (02)
3. Feature graphic: current vs a version with a child-friendly photo / mascot close-up

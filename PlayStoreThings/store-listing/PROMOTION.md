# Promotion plan — Kids Quiz

Four channels, in order of cost: free and fast first. Each one ends with
**the Play Store link with a tracking tag** so you can see in Play Console
which channel brought installs:

```
https://play.google.com/store/apps/details?id=com.mk.kidsquiz&referrer=utm_source%3D<SOURCE>%26utm_campaign%3D<CAMPAIGN>
```
Examples: `utm_source%3Dyoutube%26utm_campaign%3Dshorts_gk`, `utm_source%3Dschool%26utm_campaign%3Dclasscode`.
Play Console → Statistics / Acquisition reports show installs per `utm_source`.

---

## 1. YouTube Shorts + Instagram Reels — "Can your kid answer this?"

**Why it works:** parents watch with their child, try to answer, and forward it
to family WhatsApp groups. One good Short can bring thousands of views for free.

**Format (20–30 seconds, vertical 1080 × 1920):**

| Time | What is on screen |
|---|---|
| 0–2 s | Hook text: **"Can your Class 3 kid answer this? 🤔"** + the owl |
| 2–6 s | The question, big (from the app's question bank) |
| 6–12 s | 4 options appear one by one, 5-second countdown timer + tick sound |
| 12–15 s | Correct answer lights up green 🎉 + a fun fact in one line |
| 15–25 s | Repeat 2 more questions, getting harder ("Only 10% get the last one!") |
| 25–30 s | "Play 1000s more in **Kids Quiz** — free on Google Play" + app icon |

**What to post (pick a series, post daily):**
- Mon: GK quiz (India: national symbols, states, capitals)
- Tue: Maths in 5 seconds (quick sums for Class 1–3)
- Wed: Science / animals / space fact quiz
- Thu: English spelling — "Which is spelt right?"
- Fri: Riddle Friday 🧩 (the app has a riddles bank)
- Sat: Olympiad question of the week (harder, Class 4–5)
- Sun: Hindi quiz — "हिंदी में बताओ"

**How to make them fast:**
- Record the app screen (Android screen recorder) while answering → trim in CapCut / YouTube Create (free) → add countdown + text.
- Or: I can add a "video mode" page to the web app that plays 3 questions full-screen with a timer, made for screen recording. Ask me.
- Batch: make 7 videos in one sitting each Sunday.

**Posting details:**
- Title: `Can your kid answer this? GK Quiz for Class 3 🇮🇳 #shorts`
- Description: first line = the Play link with `utm_source%3Dyoutube`.
- Hashtags: `#gkquiz #kidsquiz #class3 #olympiad #generalknowledge #quiztime #parenting #learningisfun`
- Pin a comment: "Answer in the comments! 👇 Play more: <link>". Comments = reach.
- Instagram: post the same video as a Reel, link in bio (use the `utm_source%3Dinstagram` link). You already have the Instagram account in the app.
- Reply to every comment in the first hour.

**Goal:** 1 Short per day for 30 days. Keep the 3 formats that get the most views and drop the rest.

---

## 2. Web pages that rank on Google — "Class 3 GK questions with answers"

**Why it works:** parents and teachers search these every day, especially before
exams and Olympiads. Your web app already has thousands of questions per class
and subject. Turned into pages, Google can list them, and each page sends people
to the app.

**What to build (one page per class × subject, about 70 pages):**

```
/questions/class-3/gk-quiz-questions-with-answers.html
/questions/class-5/science-quiz-questions-with-answers.html
/questions/lkg/english-quiz-for-kids.html
...
```

Each page has:
1. A real heading: **"Class 3 GK Questions with Answers (50 Questions)"**
2. A short intro for parents (2–3 lines, written for that class).
3. 25–50 questions with the answers shown (or "show answer" buttons). Google
   needs the text **in the page**, not loaded by JavaScript later.
4. A **"Play this as a quiz"** button that opens the quiz in the browser, with stars and a score.
5. A banner: "Get 1000s more questions in the free Kids Quiz app" + Play link (`utm_source%3Dweb`).
6. Links to the next class and other subjects (internal links help ranking).
7. Page title + meta description, e.g.
   `<title>Class 3 GK Questions with Answers – 50 Quiz Questions for Kids</title>`
8. FAQ schema (`FAQPage` JSON-LD) with 5 of the questions, so Google can show them in results.

**Hosting:** a custom domain such as `kidsquiz.in` (about ₹700/year) pointed at
your GitHub Pages ranks much better than `github.io`. Add the domain in
**Google Search Console** and submit a `sitemap.xml` with all question pages.

**I can generate all these pages automatically** from the existing question
banks (`quiz/<subject>/class<N>.js`), with sitemap and schema. Ask me.

**Timeline:** Google takes 4–12 weeks to start ranking new pages. Start early; this is the
channel that keeps bringing installs for free for years.

---

## 3. Schools and tuition teachers — class codes

**Why it works:** one teacher brings a whole class (30–40 kids) and their parents.
The new **class code league** is made for this.

**How it works in the app (already built):**
- Teacher (or any kid) opens **🏆 League → 🔑 Class code → ✨ Make a new code** → gets e.g. `K7M2QP`.
- Every kid in the class enters the same code and sees the class leaderboard each week.
- Kids earn league points by finishing quizzes and games.

**Teacher kit (send it as a PDF / WhatsApp message):**

> Dear Teacher, 🙏
> Kids Quiz is a free learning app for LKG – Class 5: GK, English, Hindi, Maths,
> Science quizzes and Olympiad practice papers.
> 1. Make a class code: open the app → 🏆 League → 🔑 Class code → ✨ Make a new code
> 2. Share the code with parents in your class WhatsApp group
> 3. Every Monday, see who learned the most last week. Give the top 3 a ⭐ in class!
> Children get certificates for badges and Olympiad papers that they can show you.
> Download: <Play link with utm_source%3Dschool>

**Where to reach teachers:**
- Schools near you and your friends' children's schools (principal or class teacher). Offer a free 10-minute demo in the class.
- Tuition centres and Olympiad coaching classes: they love free practice papers.
- Facebook groups: "CBSE teachers", "Primary teachers India", "Olympiad preparation".
- LinkedIn: school coordinators and edtech groups.
- Teacher Approved: in Play Console, keep the app in the Families program and polish the content. Google's teachers review apps for the Kids tab; the badge builds trust with schools.

**Make it worth it for the teacher:** a monthly "Star of the class" certificate
the teacher can print (the app's certificate maker can do a "Class champion"
version; ask me to add it).

---

## 4. Seasonal events — Diwali, Independence Day, exam season

**Why it works:** timely content gets shared, and Play Console can show your event on the store page and in search.

**Calendar (India):**

| When | Event in the app | Promotion |
|---|---|---|
| 26 Jan | Republic Day quiz week 🇮🇳 | Constitution, flag, leaders quiz |
| Feb – Mar | Exam practice month 📚 | "Revise with Kids Quiz", class-wise quizzes |
| Apr – Jun | Summer vacation challenge ☀️ | 30-day streak challenge, big badge |
| 15 Aug | Independence Day quiz 🇮🇳 | Freedom fighters, national symbols |
| 5 Sep | Teachers' Day 🍎 | push the class code league to teachers |
| Sep – Nov | Olympiad season 🏅 | "Free Olympiad practice papers" |
| Oct – Nov | Diwali quiz 🪔 | Festivals of India quiz, Diwali owl hat in the shop |
| 14 Nov | Children's Day 🎈 | double coins weekend, special badge |
| 25 Dec | Christmas & winter fun 🎄 | Santa hat in the owl shop |

**In the app (I can build these):** an "event" switch in the admin console that
shows an event banner on the home page, a special quiz, a limited owl-shop item
(e.g. a Diwali diya hat) and a special badge, plus optional double coins.

**In the Play Store: Promotional content (LiveOps):**
Play Console → **Grow users → Promotional content** (shown if your app is eligible).
- Create an **Event** (or **Offer** for double coins), e.g. "Diwali Quiz Week".
- Image 1920 × 1080 (16:9). I can make these like the screenshots.
- Title ≤ 80 characters, description ≤ 80. Start/end dates.
- Submit **at least 4 days before** the start (review time). Events show on your
  store page, in search results and on the Play home/Events tab for engaged users.

If "Promotional content" isn't in your Play Console yet, it becomes available
as the app grows. Meanwhile, update the **feature graphic and first screenshot** for
the event (e.g. a Diwali version) and post the event on YouTube / Instagram.

---

## Weekly routine (30 minutes a day)

| Day | Task |
|---|---|
| Daily | Post 1 Short / Reel, reply to comments and Play reviews |
| Mon | Check Play Console: installs by source, ratings, crashes |
| Wed | Contact 2 schools / tuition centres with the teacher kit |
| Fri | Plan next week's Shorts and the next seasonal event |
| Monthly | Run 1 store listing experiment and publish 10 new web question pages |

## Paid (optional, later)

When the free channels show which message works, try **Google Ads App campaigns**
with a small budget (₹300–500/day) targeting parents. Kids apps have targeting
limits, so advertise to parents ("learning app for your child"), never to children.

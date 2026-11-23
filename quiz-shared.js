/* ============================================================
   SHARED ACROSS QUIZ PAGES (quiz-home.html, quiz/index.html)
   Categories, palette, local storage, cached-auth, daily
   challenge helpers, and the math question generators.
   Edit here once and every quiz page picks it up.
   ============================================================ */

const CATEGORIES = [
  { id: 'addsub',    icon: '➕', title: 'Add & Subtract' },
  { id: 'multiply',  icon: '✖️', title: 'Multiplication' },
  { id: 'divide',    icon: '➗', title: 'Division' },
  { id: 'mixedmath', icon: '🔢', title: 'Mixed Math' },
  { id: 'hindi',     icon: '🇮🇳', title: 'Hindi' },
  { id: 'english',   icon: '🔤', title: 'English' },
  { id: 'gk',        icon: '🌍', title: 'GK' },
  { id: 'science',   icon: '🔬', title: 'Science' },
  { id: 'history',   icon: '📜', title: 'History' },
  { id: 'geography', icon: '🗺️', title: 'Geography' },
  { id: 'sports',    icon: '⚽', title: 'Sports' },
  { id: 'computers', icon: '💻', title: 'Computers' },
  { id: 'animals',   icon: '🐾', title: 'Animals' },
  { id: 'plants',    icon: '🌱', title: 'Plants' },
  { id: 'humanbody', icon: '👤', title: 'Human Body' },
  { id: 'space',     icon: '🚀', title: 'Space' },
  { id: 'capitals',  icon: '🏛️', title: 'Capitals' },
  { id: 'riddles',   icon: '🧩', title: 'Riddles' },
  { id: 'patterns',  icon: '🔁', title: 'Patterns' },
  { id: 'reasoning', icon: '🧠', title: 'Reasoning' }
];

// Bright, high-contrast, kid-friendly palette reused for quiz categories,
// class-level buttons, and the single/multiplayer mode cards so the whole
// app feels like one consistent, playful design.
const KID_COLORS = [
  {bg:'#FF6B57',shadow:'#D6432F'},
  {bg:'#7C5CFC',shadow:'#5A3FD1'},
  {bg:'#22C55E',shadow:'#158A3E'},
  {bg:'#3B82F6',shadow:'#1D4ED8'},
  {bg:'#FFC93C',shadow:'#E0A800'},
  {bg:'#FF4FA3',shadow:'#D6337F'},
  {bg:'#16C2C2',shadow:'#0E8F8F'},
  {bg:'#F97316',shadow:'#C2410C'},
  {bg:'#A855F7',shadow:'#7E22CE'},
  {bg:'#06B6D4',shadow:'#0891B2'}
];
function kidColor(i) { return KID_COLORS[i % KID_COLORS.length]; }
function styleKidCard(el, color, delayIndex) {
  el.style.background = color.bg;
  el.style.boxShadow = '0 6px 0 ' + color.shadow + ', 0 10px 16px rgba(0,0,0,.18)';
  el.style.animationDelay = (delayIndex * 0.05) + 's';
}
function getCatInfo(id) {
  const c = CATEGORIES.find(c => c.id === id);
  if (c) return c;
  // LKG/UKG interactive categories live in quiz/kids-engine.js
  if (typeof window !== 'undefined' && window.KidsQuiz) return window.KidsQuiz.CATS.find(k => k.id === id);
  return undefined;
}

/* ============================================
   CATEGORIES PER CLASS (Quiz: Class -> Category -> Paper)
   ============================================ */
/** Which classes each Class 1–5 subject is offered for: [from, to]. */
const CAT_CLASS_RANGE = {
  addsub: [1, 5], patterns: [1, 5], multiply: [2, 5], reasoning: [2, 5], divide: [3, 5], mixedmath: [3, 5],
  english: [1, 5], hindi: [1, 5], gk: [1, 5], science: [1, 5], computers: [1, 5], sports: [1, 5],
  humanbody: [1, 5], space: [1, 5], animals: [1, 3], plants: [1, 4], geography: [2, 5], riddles: [2, 5],
  history: [3, 5], capitals: [3, 5]
};
/** Picture-question subjects (existing class0.js / ukg.js pools) also shown for LKG / UKG. */
const PRE_POOL_CATS = { 0: ['hindi', 'gk', 'english'], '-1': ['english', 'hindi', 'gk', 'space', 'science'] };
const MATH_CATS = ['addsub', 'multiply', 'divide', 'mixedmath', 'patterns', 'reasoning'];
/** Categories for a class level, in display order. Each: {id, icon, title, kind}
    kind: 'kids' (interactive LKG/UKG), 'math' (generated), 'pool' (question files). */
function quizCategoriesFor(level) {
  level = parseInt(level, 10);
  const out = [];
  if (isPicoLevel(level)) {
    if (window.KidsQuiz) KidsQuiz.CATS.forEach(c => { if (c.levels.indexOf(level) !== -1) out.push(Object.assign({ kind: 'kids' }, c)); });
    (PRE_POOL_CATS[String(level)] || []).forEach(id => { const c = getCatInfo(id); if (c) out.push(Object.assign({ kind: 'pool' }, c)); });
    return out;
  }
  CATEGORIES.forEach(c => {
    const r = CAT_CLASS_RANGE[c.id];
    if (r && level >= r[0] && level <= r[1]) out.push(Object.assign({ kind: MATH_CATS.indexOf(c.id) !== -1 ? 'math' : 'pool' }, c));
  });
  return out;
}


/* ============================================
   MATH HELPERS (used by the procedural generators)
   ============================================ */
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildNumericOptions(correct, range) {
  const options = new Set();
  options.add(correct);
  let attempts = 0;
  const allowNeg = correct < 0 || range > 20;
  while (options.size < 4 && attempts < 80) {
    let delta = rand(-range, range);
    if (delta === 0) delta = rand(1, Math.max(1, range));
    const distractor = correct + delta;
    if (allowNeg || distractor >= 0) options.add(distractor);
    attempts++;
  }
  let fb = correct + 1;
  while (options.size < 4) { options.add(fb); fb += (fb >= correct ? 1 : -1) || 1; }
  return shuffle(Array.from(options));
}

/* ============================================
   CACHED AUTH (so a returning, already-logged-in user
   skips straight past the loader/sign-in screen)
   ============================================ */
function getCachedAuth() {
  try { return JSON.parse(localStorage.getItem('kq_cached_auth') || 'null'); } catch (e) { return null; }
}
function setCachedAuth(u) {
  try { localStorage.setItem('kq_cached_auth', JSON.stringify({ name: (u && u.name) || 'Player', photo: (u && u.photo) || '' })); } catch (e) {}
}
function clearCachedAuth() {
  try { localStorage.removeItem('kq_cached_auth'); } catch (e) {}
}
function getCachedGuest() {
  try { return localStorage.getItem('kq_guest_session') === '1'; } catch (e) { return false; }
}
function setCachedGuest(on) {
  try {
    if (on) localStorage.setItem('kq_guest_session', '1');
    else localStorage.removeItem('kq_guest_session');
  } catch (e) {}
}

/* ============================================
   NAVIGATION LOOP-BREAKER
   Safety net against any residual quiz2.html <-> quiz-home.html ping-pong.
   Each page calls kqNavHop() right before it navigates to the OTHER page.
   Normal use makes at most one hop; five hops within 6s of each other means
   the two pages are bouncing a user in a loop, so we stop and force the
   sign-in gate to show (a dead-simple screen the user can act on) instead of
   reloading forever.
   ============================================ */
function kqNavHop() {
  try {
    var now = Date.now();
    var last = +(sessionStorage.getItem('kq_hop_ts') || 0);
    var n = (now - last < 6000) ? (+(sessionStorage.getItem('kq_hop_n') || 0) + 1) : 1;
    sessionStorage.setItem('kq_hop_ts', String(now));
    sessionStorage.setItem('kq_hop_n', String(n));
    return n >= 5; // looping
  } catch (e) { return false; }
}
function kqNavReset() {
  // Call once a page has settled successfully (no bounce), to clear the counter.
  try { sessionStorage.removeItem('kq_hop_n'); sessionStorage.removeItem('kq_hop_ts'); } catch (e) {}
}
function kqForceGate(on) {
  try {
    if (on) sessionStorage.setItem('kq_force_gate', '1');
    else sessionStorage.removeItem('kq_force_gate');
  } catch (e) {}
}
function kqGateForced() {
  try { return sessionStorage.getItem('kq_force_gate') === '1'; } catch (e) { return false; }
}

/* ============================================
   LOCAL STORAGE: per-user history & best scores
   ============================================ */
const STORAGE_KEY = 'quizMaster_v1';
let currentUser = null;

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { users: {}, lastUser: null };
    const parsed = JSON.parse(raw);
    if (!parsed.users) parsed.users = {};
    return parsed;
  } catch (e) {
    return { users: {}, lastUser: null };
  }
}

function saveStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save:', e);
  }
}

function getOrCreateUser(name) {
  const data = loadStorage();
  if (!data.users[name]) {
    data.users[name] = { history: [], best: {}, created: Date.now() };
  }
  data.lastUser = name;
  saveStorage(data);
  return data.users[name];
}

function saveScoreToHistory(cat, level, score, correct, wrong) {
  if (!currentUser) return;
  const data = loadStorage();
  if (!data.users[currentUser]) data.users[currentUser] = { history: [], best: {}, created: Date.now() };
  const user = data.users[currentUser];
  user.history.push({ cat: cat, level: level, score: score, correct: correct, wrong: wrong, date: Date.now() });
  if (user.history.length > 50) user.history = user.history.slice(-50);
  const key = cat + '_' + level;
  if (user.best[key] === undefined || score > user.best[key]) user.best[key] = score;
  saveStorage(data);
}

function getBestScore(cat, level) {
  if (!currentUser) return null;
  const data = loadStorage();
  if (!data.users[currentUser]) return null;
  const key = cat + '_' + level;
  const v = data.users[currentUser].best[key];
  return v === undefined ? null : v;
}

function clearUserHistory() {
  if (!currentUser) return;
  const data = loadStorage();
  if (data.users[currentUser]) {
    data.users[currentUser].history = [];
    data.users[currentUser].best = {};
    saveStorage(data);
  }
}

/* ============================================
   DAILY CHALLENGE (same pick for everyone each day)
   ============================================ */
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function dateKeyOffset(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
/** Highest class level offered in the quiz (Class 1 … MAX_CLASS). */
const MAX_CLASS = 10;
/** Lowest class level offered — 0 is LKG (pre-Class-1, pictorial questions). */
const MIN_CLASS = 0;
/** UKG level id. Levels are plain numbers everywhere (URL, history,
    leaderboard keys), and 0 is already LKG, so UKG uses -1 as its ID.
    It is only an id — display order comes from quizLevels(), which puts
    UKG between LKG and Class 1. Questions live in quiz/<subject>/ukg.js. */
const UKG_LEVEL = -1;
/** Highest class currently SHOWN in pickers. Class 6–10 content and code
    are kept; raise this back to MAX_CLASS to show them again. */
const VISIBLE_MAX_CLASS = 5;
/** Display label for a level: 0 -> "LKG", -1 -> "UKG", otherwise "Class N". */
function classLabel(n) {
  n = parseInt(n, 10);
  if (n === 0) return 'LKG';
  if (n === UKG_LEVEL) return 'UKG';
  return 'Class ' + n;
}
/** Subjects with pictorial LKG (level 0) content — everything else only
    goes down to Class 1, since LKG-age content doesn't exist for them yet. */
const LKG_SUBJECTS = ['addsub', 'english', 'hindi', 'gk', 'science', 'animals', 'plants', 'humanbody', 'space', 'geography', 'computers', 'sports'];
function hasLkg(catId) { return LKG_SUBJECTS.indexOf(catId) !== -1; }
/** UKG is offered for the same subjects as LKG. */
const UKG_SUBJECTS = LKG_SUBJECTS;
function hasUkg(catId) { return UKG_SUBJECTS.indexOf(catId) !== -1; }
/** Pre-primary levels (LKG/UKG) use the big picture cards + read-aloud. */
function isPicoLevel(n) { n = parseInt(n, 10); return n === 0 || n === UKG_LEVEL; }
/** Levels to show for a subject, in display order: LKG, UKG, Class 1…5.
    Pass no catId to get every pre-primary level (e.g. leaderboard hub). */
function quizLevels(catId) {
  const out = [];
  if (!catId || hasLkg(catId)) out.push(0);
  if (!catId || hasUkg(catId)) out.push(UKG_LEVEL);
  for (let n = 1; n <= VISIBLE_MAX_CLASS; n++) out.push(n);
  return out;
}
/** Every level that may have saved scores (incl. hidden Class 6–10),
    in display order — used for showing past history. */
function allQuizLevels() {
  const out = [0, UKG_LEVEL];
  for (let n = 1; n <= MAX_CLASS; n++) out.push(n);
  return out;
}

/* ============================================
   READ-ALOUD (LKG) — speaks questions/prompts so pre-readers don't need
   to read. Reuses the same mute flag as kq-fx.js ("kq_muted") so the one
   mute button silences both sound effects and narration together.
   ============================================ */
function isSoundMuted() {
  try { return localStorage.getItem('kq_muted') === '1'; } catch (e) { return false; }
}
/** Strip emoji/pictographs before speaking so TTS doesn't stumble on them. */
function stripEmojiForSpeech(text) {
  return String(text)
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
let __kqVoicesReady = false;
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = function () { __kqVoicesReady = true; };
}
/** Speak `text` aloud (kid-pitched, unhurried). opts.raw skips emoji-stripping. */
function speak(text, opts) {
  try {
    if (isSoundMuted()) return;
    opts = opts || {};
    const clean = opts.raw ? String(text) : stripEmojiForSpeech(text);
    if (!clean) return;
    // Inside the Android app, prefer the phone's own text-to-speech through the
    // app bridge (Android WebViews often have no speechSynthesis at all).
    // App side: @JavascriptInterface fun speak(text: String, lang: String)
    try {
      if (typeof Android !== 'undefined' && Android && typeof Android.speak === 'function') {
        Android.speak(clean, opts.lang || 'en-US');
        return;
      }
    } catch (e) {}
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = opts.rate || 0.88;
    u.pitch = opts.pitch || 1.15;
    if (opts.lang) u.lang = opts.lang;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

function dailyHash(str) {
  let h = 0; for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; } return h;
}
function getDailyChallenge() {
  const seed = dailyHash(todayKey());
  const cat = CATEGORIES[seed % CATEGORIES.length];
  const level = (Math.floor(seed / 7) % VISIBLE_MAX_CLASS) + 1;
  return { catId: cat.id, level: level, title: cat.title, icon: cat.icon };
}
function loadDaily() {
  try { return JSON.parse(localStorage.getItem('kq_daily_' + currentUser) || '{}'); } catch (e) { return {}; }
}
function saveDaily(o) { try { localStorage.setItem('kq_daily_' + currentUser, JSON.stringify(o)); } catch (e) {} }

/* ============================================
   ANDROID-STYLE TOUCH RIPPLE (shared across every page)
   ============================================ */
function attachRipple(selector) {
  document.querySelectorAll(selector).forEach(el => {
    if (el.dataset.rippleBound) return;
    el.dataset.rippleBound = '1';
    el.addEventListener('click', function(e) {
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.4;
      const ripple = document.createElement('span');
      ripple.className = 'android-ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      const x = (e.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
      const y = (e.clientY || rect.top + rect.height / 2) - rect.top - size / 2;
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

/* ============================================
   DECORATIVE FLOATING BACKGROUND (shared across every page)
   ============================================ */
function initBackgroundDecor() {
  const emojis = ['⭐','🎈','🎉','🌟','🎨','🚀','🍎','🦋'];
  const holder = document.getElementById('bgDecor');
  if (!holder) return;
  const count = window.innerWidth < 600 ? 8 : 14;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.textContent = emojis[i % emojis.length];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = (14 + Math.random() * 12) + 's';
    el.style.animationDelay = (Math.random() * 12) + 's';
    el.style.fontSize = (18 + Math.random() * 20) + 'px';
    holder.appendChild(el);
  }
}

/* ============================================
   SHARE & RATE (used on the landing page and the end screen)
   ============================================ */
const KQ_LINKS = {
  play: 'https://play.google.com/store/apps/details?id=com.mk.kidsquiz',
  rate: 'https://play.google.com/store/apps/details?id=com.mk.kidsquiz&showAllReviews=true',
  dev: 'https://play.google.com/store/apps/developer?id=Mayank+Logic',
  insta: 'https://www.instagram.com/kidsgames_quiz?igsh=dHVkdWVtNnFleXV1'
};
/* Open an external link: Android app bridge first, then a new browser tab,
   and if the browser blocks the tab, the same tab. */
function kqOpenExternal(url) {
  try {
    if (typeof Android !== "undefined" && Android.openUrl) { Android.openUrl(url); return; }
  } catch (e) {}
  // Note: window.open(..., 'noopener') ALWAYS returns null, which made this
  // fall through and ALSO load the link in the current page (two Instagrams).
  // Open without the flag, then cut the opener link ourselves.
  var w = null;
  try { w = window.open(url, '_blank'); } catch (e) {}
  if (w) { try { w.opener = null; } catch (e) {} return; }
  window.location.href = url; // pop-up really blocked: use this tab
}

async function shareApp() {
  const playStoreLink = KQ_LINKS.play;
  const shareText = '🧠✨ Turn screen time into fun learning!\n\n' +
    '🎮 Kids Quiz — Play, Learn & Grow\n' +
    'Fun quizzes and mini-games made for curious kids.\n\n' +
    '▶️ Get it on Google Play:\n' + playStoreLink + '\n\n' +
    '📸 Follow us on Instagram for fun updates:\n' + KQ_LINKS.insta;

  if (typeof Android !== "undefined" && Android.shareAppContent) {
    Android.shareAppContent('Kids Quiz', shareText);
    return;
  }
  if (typeof Android !== "undefined" && Android.shareApp) {
    Android.shareApp();
    return;
  }
  // Phones / browsers with a native share sheet.
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Kids Quiz', text: shareText, url: playStoreLink });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return; // user closed the sheet
    }
  }
  // Desktop browsers: our own share panel.
  kqShowSharePanel(shareText, playStoreLink);
}

function kqShowSharePanel(text, link) {
  var old = document.getElementById('kqSharePanel');
  if (old) old.remove();
  var enc = encodeURIComponent;
  var items = [
    { ic: '💬', nm: 'WhatsApp', bg: '#25D366', url: 'https://wa.me/?text=' + enc(text) },
    { ic: '📘', nm: 'Facebook', bg: '#1877F2', url: 'https://www.facebook.com/sharer/sharer.php?u=' + enc(link) },
    { ic: '✖️', nm: 'X', bg: '#111827', url: 'https://twitter.com/intent/tweet?text=' + enc('Kids Quiz — Play, Learn & Grow 🎮🧠') + '&url=' + enc(link) },
    { ic: '✈️', nm: 'Telegram', bg: '#229ED9', url: 'https://t.me/share/url?url=' + enc(link) + '&text=' + enc('Kids Quiz — Play, Learn & Grow 🎮🧠') },
    { ic: '✉️', nm: 'Email', bg: '#F97316', url: 'mailto:?subject=' + enc('Kids Quiz — fun learning for kids') + '&body=' + enc(text) }
  ];
  var wrap = document.createElement('div');
  wrap.id = 'kqSharePanel';
  wrap.setAttribute('role', 'dialog');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(15,10,40,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit';
  wrap.innerHTML =
    '<div style="background:#fff;color:#1e1b4b;border-radius:24px;padding:20px 18px 16px;width:100%;max-width:380px;box-shadow:0 24px 60px rgba(0,0,0,.35);text-align:center;position:relative">' +
      '<button type="button" data-x aria-label="Close" style="position:absolute;top:10px;right:10px;width:32px;height:32px;border:none;border-radius:50%;background:#f1f0fb;font-size:16px;font-weight:900;cursor:pointer">✕</button>' +
      '<div style="font-size:34px">🚀</div>' +
      '<div style="font-size:19px;font-weight:900;margin:4px 0 2px">Share Kids Quiz</div>' +
      '<div style="font-size:13px;color:#6b7280;font-weight:700;margin-bottom:14px">Invite friends to play and learn!</div>' +
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px">' +
        items.map(function (it, i) {
          return '<button type="button" data-i="' + i + '" style="border:none;background:none;cursor:pointer;padding:0;font-family:inherit">' +
            '<span style="display:grid;place-items:center;width:48px;height:48px;margin:0 auto 4px;border-radius:16px;background:' + it.bg + ';font-size:22px;box-shadow:0 4px 0 rgba(0,0,0,.15)">' + it.ic + '</span>' +
            '<span style="font-size:11px;font-weight:800;color:#374151">' + it.nm + '</span></button>';
        }).join('') +
      '</div>' +
      '<div style="display:flex;gap:6px;background:#f5f3ff;border-radius:14px;padding:6px">' +
        '<input readonly value="' + link.replace(/"/g, '&quot;') + '" style="flex:1;min-width:0;border:none;background:transparent;font-size:12.5px;font-weight:700;color:#4c1d95;padding:0 6px;outline:none">' +
        '<button type="button" data-copy style="border:none;border-radius:10px;background:#6d28d9;color:#fff;font-weight:900;font-size:12.5px;padding:9px 14px;cursor:pointer">Copy link</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);
  function close() { wrap.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', function (e) {
    if (e.target === wrap || e.target.closest('[data-x]')) return close();
    var b = e.target.closest('[data-i]');
    if (b) { kqOpenExternal(items[+b.getAttribute('data-i')].url); return close(); }
    var c = e.target.closest('[data-copy]');
    if (c) {
      var done = function () { c.textContent = 'Copied! ✓'; c.style.background = '#16a34a'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { wrap.querySelector('input').select(); document.execCommand('copy'); done(); });
      else { wrap.querySelector('input').select(); try { document.execCommand('copy'); } catch (x) {} done(); }
    }
  });
}

function rateApp() {
  if (typeof Android !== "undefined" && Android.rateApp) {
    Android.rateApp();
    return;
  }
  // Browsers: open the Play Store page where reviews are written.
  kqOpenExternal(KQ_LINKS.rate);
}

function moreGames() { kqOpenExternal(KQ_LINKS.dev); }

function openInstagram() { kqOpenExternal(KQ_LINKS.insta); }

function onRewardEarned(type, amount) { console.log(type, amount); }
function onAdClosed(type) { console.log(type + " closed"); }

/* ============================================
   ANDROID APP DETECTION
   The same pages run inside the Android app's WebView. Google blocks its
   web sign-in there, so Google sign-in is offered on the WEBSITE only.
   We're "in the app" if the app's JS bridge (window.Android) exists or the
   browser reports itself as an Android WebView ("; wv)").
   ============================================ */
function kqIsAndroidApp() {
  try { if (typeof Android !== 'undefined' && Android) return true; } catch (e) {}
  var ua = navigator.userAgent || '';
  return /; wv\)/.test(ua);
}
/* True when the Android app provides native Google Sign-In (Android.googleSignIn).
   Then Google login is offered inside the app too: the app signs in natively and
   hands the ID token back via window.onGoogleIdToken(token). Older app versions
   don't have it, so they keep the guest-only screen. */
function kqHasNativeGoogle() {
  // Needs the new app build (1.0.11+): it exposes isGoogleSignInReady(). Older builds
  // had a googleSignIn bridge without a valid client ID, so we don't offer it there.
  try {
    return typeof Android !== 'undefined' && Android && typeof Android.googleSignIn === 'function' &&
      typeof Android.isGoogleSignInReady === 'function' && !!Android.isGoogleSignInReady();
  } catch (e) { return false; }
}
/* Google sign-in can be offered here: a normal browser, or the app with native sign-in. */
function kqCanGoogleSignIn() { return !kqIsAndroidApp() || kqHasNativeGoogle(); }

/* ============================================
   PLAYER NAME (guests)
   Google users get their Google name automatically (kq-leaderboard.js
   stores it as kq_nick). Guests are asked once; the name is shown on the
   home screen and used for their leaderboard profile.
   ============================================ */
function kqGetNick() {
  try { return (localStorage.getItem('kq_nick') || '').trim(); } catch (e) { return ''; }
}
function kqSetNick(name) {
  name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 20);
  if (!name) return '';
  if (window.KQ && KQ.setNick) KQ.setNick(name);
  else { try { localStorage.setItem('kq_nick', name); } catch (e) {} }
  return name;
}
/** Shows a friendly "What's your name?" box. Resolves with the saved name.
    opts.canCancel: show a Cancel button (resolves with '' if cancelled). */
function kqAskName(opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    var old = document.getElementById('kqNameBox');
    if (old) old.remove();
    var cur = kqGetNick();
    if (cur === 'Guest' || cur === 'Player') cur = '';
    var box = document.createElement('div');
    box.id = 'kqNameBox';
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(15,10,40,.6);display:flex;align-items:center;justify-content:center;padding:16px';
    box.innerHTML =
      '<form style="background:#fff;color:#1e1b4b;border-radius:26px;padding:22px 18px 18px;width:100%;max-width:360px;box-shadow:0 24px 60px rgba(0,0,0,.35);text-align:center;font-family:inherit">' +
        '<div style="font-size:42px;line-height:1">🧒</div>' +
        '<div style="font-size:20px;font-weight:900;margin:8px 0 2px">' + (opts.title || 'What’s your name?') + '</div>' +
        '<div style="font-size:13px;color:#6b7280;font-weight:700;margin-bottom:14px">It will show on the leaderboard 🏆</div>' +
        '<input name="nm" maxlength="20" autocomplete="nickname" placeholder="Type your name" style="width:100%;box-sizing:border-box;border:2px solid #ddd6fe;border-radius:14px;padding:12px 14px;font-size:17px;font-weight:800;color:#1e1b4b;outline:none;text-align:center;font-family:inherit">' +
        '<div data-err style="color:#dc2626;font-size:12px;font-weight:800;min-height:16px;margin-top:6px"></div>' +
        '<div style="display:flex;gap:8px;margin-top:4px">' +
          (opts.canCancel ? '<button type="button" data-cancel style="flex:1;border:none;border-radius:14px;padding:12px;font-size:15px;font-weight:900;background:#f1f0fb;color:#4c1d95;cursor:pointer;font-family:inherit">Cancel</button>' : '') +
          '<button type="submit" style="flex:2;border:none;border-radius:14px;padding:12px;font-size:15px;font-weight:900;color:#fff;background:linear-gradient(135deg,#7c3aed,#4f46e5);box-shadow:0 4px 0 #3730a3;cursor:pointer;font-family:inherit">Let’s go! 🚀</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(box);
    var form = box.querySelector('form'), input = box.querySelector('input'), err = box.querySelector('[data-err]');
    input.value = cur;
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.replace(/\s+/g, ' ').trim();
      if (v.length < 2) { err.textContent = 'Please type at least 2 letters'; input.focus(); return; }
      var saved = kqSetNick(v);
      box.remove();
      resolve(saved);
    });
    var c = box.querySelector('[data-cancel]');
    if (c) c.onclick = function () { box.remove(); resolve(''); };
  });
}

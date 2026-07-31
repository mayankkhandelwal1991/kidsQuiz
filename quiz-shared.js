/* ============================================================
   SHARED ACROSS QUIZ PAGES (quiz-home.html, quiz-index.html)
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
function getCatInfo(id) { return CATEGORIES.find(c => c.id === id); }

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
  while (options.size < 4 && attempts < 60) {
    let delta = rand(-range, range);
    if (delta === 0) delta = rand(1, range);
    const distractor = correct + delta;
    if (distractor >= 0) options.add(distractor);
    attempts++;
  }
  let fb = correct + 1;
  while (options.size < 4) { options.add(fb); fb++; }
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
function dailyHash(str) {
  let h = 0; for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; } return h;
}
function getDailyChallenge() {
  const seed = dailyHash(todayKey());
  const cat = CATEGORIES[seed % CATEGORIES.length];
  const level = (Math.floor(seed / 7) % 5) + 1;
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
async function shareApp() {
  const playStoreLink = 'https://play.google.com/store/apps/details?id=com.mk.kidsquiz';
  const instagramLink = 'https://www.instagram.com/kidsgames_quiz?igsh=dHVkdWVtNnFleXV1';
  const previewUrl = new URL('share-preview.png', window.location.href).href;
  const shareText = '🧠✨ Turn screen time into fun learning!\n\n' +
    '🎮 Kids Quiz — Play, Learn & Grow\n' +
    'Fun quizzes and mini-games made for curious kids.\n\n' +
    '▶️ Get it on Google Play:\n' + playStoreLink + '\n\n' +
    '📸 Follow us on Instagram for fun updates:\n' + instagramLink;

  if (typeof Android !== "undefined" && Android.shareAppContent) {
    Android.shareAppContent('Kids Quiz', shareText + '\n\n🖼️ App preview:\n' + previewUrl);
    return;
  }
  if (typeof Android !== "undefined" && Android.shareApp) {
    Android.shareApp();
    return;
  }
  try {
    const response = await fetch(previewUrl);
    const blob = await response.blob();
    const file = new File([blob], 'kids-quiz-preview.png', { type: blob.type || 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: 'Kids Quiz', text: shareText, url: playStoreLink, files: [file] });
      return;
    }
  } catch (e) {}
  if (navigator.share) {
    navigator.share({ title: 'Kids Quiz', text: shareText + '\n\n🖼️ App preview:\n' + previewUrl, url: playStoreLink }).catch(function(){});
    return;
  }
  alert('Sharing is available inside the Kids Quiz app.');
}

function rateApp() {
  if (typeof Android !== "undefined" && Android.rateApp) {
    Android.rateApp();
    return;
  }
  alert('Rating is available inside the Kids Quiz app.');
}

function moreGames() {
  var url = 'https://play.google.com/store/apps/developer?id=Mayank+Logic';
  try {
    if (typeof Android !== "undefined" && Android.openUrl) { Android.openUrl(url); return; }
  } catch (e) {}
  try { window.open(url, '_blank'); } catch (e) { window.location.href = url; }
}

function openInstagram() {
  var url = 'https://www.instagram.com/kidsgames_quiz?igsh=dHVkdWVtNnFleXV1';
  window.open(url, '_blank');
}

function onRewardEarned(type, amount) { console.log(type, amount); }
function onAdClosed(type) { console.log(type + " closed"); }

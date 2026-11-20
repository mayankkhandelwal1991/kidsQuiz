#!/usr/bin/env node
/* ------------------------------------------------------------------
   Rebuilds the Class 1–5 Olympiad papers for Mathematics, Science,
   English, Computer and General Knowledge from class-checked content:

     Science  = Quiz banks science + humanbody + plants + animals + space
     GK       = Quiz banks gk + geography + history + capitals + sports
     English  = Quiz bank english + generated grammar (plurals, opposites…)
     Computer = Quiz bank computers
     Maths    = generated per NCERT Math-Magic topics for the class

   Only Quiz classes that the app shows for that subject are used, so
   no off-level questions sneak in. Answer positions are shuffled with
   a seeded random, so every paper is the same each run but answers are
   spread evenly over A/B/C/D.

   Paper: 15 questions × 1 mark + 5 Achievers × 2 marks = 25 marks.
   Run from the project root:  node Olympiad/tools/generate-core-subjects-c1-5.js
   ------------------------------------------------------------------ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const DATA = path.join(ROOT, 'Olympiad', 'data');
const QUIZ = require(path.join(ROOT, 'data', 'quizzes.json'));
const CLASSES = [1, 2, 3, 4, 5];
const NORMAL = 15, ACH = 5, MAX_PAPERS = 5, DURATION = 25;
const RANGE = { english: [1, 5], hindi: [1, 5], gk: [1, 5], science: [1, 5], computers: [1, 5], sports: [1, 5], humanbody: [1, 5], space: [1, 5], animals: [1, 3], plants: [1, 4], geography: [2, 5], riddles: [2, 5], history: [3, 5], capitals: [3, 5] };

/* ---------- seeded random ---------- */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function makeRng(seed) { let a = hashStr(seed); return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, a) => a[Math.floor(r() * a.length)];
function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function numWrongs(r, ans, spread, min) {
  min = min == null ? 0 : min;
  const s = new Set(); let g = 0;
  while (s.size < 3 && g++ < 200) { const v = ans + ri(r, -spread, spread); if (v !== ans && v >= min) s.add(v); }
  let k = 1; while (s.size < 3) s.add(ans + spread + k++);
  return [...s].map(String);
}

/* ---------- pools from the Quiz (class-checked) ---------- */
function quizPool(subjects, cls) {
  const out = [];
  subjects.forEach((s) => {
    const r = RANGE[s];
    if (r && (cls < r[0] || cls > r[1])) return;
    ((QUIZ[s] || {})[cls] || []).forEach((q) => {
      if (!q.options || q.options.length !== 4 || q.mode === 'listen') return;
      out.push({ q: q.question, a: String(q.answer), w: q.options.filter((o) => o !== q.answer).map(String) });
    });
  });
  return out;
}

/* ---------- English grammar generator (by class) ---------- */
const PLURAL_REG = [['cat', 'cats'], ['book', 'books'], ['pen', 'pens'], ['tree', 'trees'], ['box', 'boxes'], ['bus', 'buses'], ['dish', 'dishes'], ['brush', 'brushes'], ['baby', 'babies'], ['city', 'cities'], ['lady', 'ladies'], ['bench', 'benches'], ['glass', 'glasses'], ['story', 'stories']];
const PLURAL_IRR = [['child', 'children'], ['man', 'men'], ['woman', 'women'], ['mouse', 'mice'], ['foot', 'feet'], ['tooth', 'teeth'], ['goose', 'geese'], ['sheep', 'sheep'], ['knife', 'knives'], ['leaf', 'leaves'], ['wolf', 'wolves'], ['ox', 'oxen']];
const OPP1 = [['big', 'small'], ['hot', 'cold'], ['up', 'down'], ['day', 'night'], ['happy', 'sad'], ['tall', 'short'], ['fast', 'slow'], ['open', 'close'], ['in', 'out'], ['wet', 'dry'], ['old', 'new'], ['full', 'empty']];
const OPP2 = [['brave', 'cowardly'], ['strong', 'weak'], ['rich', 'poor'], ['early', 'late'], ['heavy', 'light'], ['near', 'far'], ['buy', 'sell'], ['give', 'take'], ['clean', 'dirty'], ['friend', 'enemy'], ['loud', 'quiet'], ['sharp', 'blunt'], ['ancient', 'modern'], ['arrive', 'depart'], ['accept', 'refuse']];
const PAST = [['go', 'went'], ['eat', 'ate'], ['see', 'saw'], ['run', 'ran'], ['sing', 'sang'], ['write', 'wrote'], ['drink', 'drank'], ['take', 'took'], ['bring', 'brought'], ['teach', 'taught'], ['catch', 'caught'], ['fly', 'flew'], ['swim', 'swam'], ['buy', 'bought'], ['think', 'thought'], ['sleep', 'slept']];
const SYN = [['big', 'large'], ['small', 'tiny'], ['happy', 'glad'], ['begin', 'start'], ['quick', 'fast'], ['shut', 'close'], ['gift', 'present'], ['under', 'below'], ['angry', 'cross'], ['sick', 'ill'], ['end', 'finish'], ['shout', 'yell']];
const COMP = [['tall', 'taller', 'tallest'], ['big', 'bigger', 'biggest'], ['happy', 'happier', 'happiest'], ['good', 'better', 'best'], ['bad', 'worse', 'worst'], ['small', 'smaller', 'smallest'], ['fast', 'faster', 'fastest'], ['many', 'more', 'most']];
const VOWEL_WORDS = ['apple', 'egg', 'ink pot', 'owl', 'umbrella', 'elephant', 'orange', 'ice cream', 'ant', 'onion'];
const CONS_WORDS = ['ball', 'cat', 'dog', 'kite', 'pen', 'tree', 'house', 'boy', 'girl', 'mango'];
const MISSING = ['cat', 'dog', 'sun', 'hen', 'pen', 'bus', 'cup', 'bat', 'pig', 'fox', 'net', 'map', 'jug', 'box'];
const RHYME = [['cat', 'hat'], ['sun', 'run'], ['bee', 'tree'], ['cake', 'lake'], ['ball', 'wall'], ['star', 'car'], ['mouse', 'house'], ['boat', 'coat'], ['king', 'ring'], ['bell', 'well']];
function genEnglish(r, cls) {
  const kinds = cls <= 2 ? ['plural', 'opp', 'article', 'rhyme'] : cls === 3 ? ['plural', 'irr', 'opp', 'article', 'past', 'rhyme'] : cls === 4 ? ['irr', 'opp2', 'past', 'syn', 'article'] : ['irr', 'opp2', 'past', 'syn', 'comp'];
  const k = pick(r, kinds);
  if (k === 'plural') { const [s, p] = pick(r, PLURAL_REG); return { q: `Plural of ‘${s}’ is…`, a: p, w: [s + 's' === p ? s + 'es' : s + 's', s + 'ies' === p ? s + 'ss' : s + 'ies', s].filter((x) => x !== p).concat([s + 'en']).slice(0, 3) }; }
  if (k === 'irr') { const [s, p] = pick(r, PLURAL_IRR); return { q: `Plural of ‘${s}’ is…`, a: p, w: [s + 's', s + 'es', p + 's'].filter((x) => x !== p).concat([s + 'ies']).slice(0, 3) }; }
  if (k === 'opp' || k === 'opp2') { const L = k === 'opp' ? OPP1 : OPP2; const [a, b] = pick(r, L); const others = shuffle(r, L.filter((x) => x[0] !== a)).slice(0, 3).map((x) => x[1]); return { q: `Opposite of ‘${a}’ is…`, a: b, w: others }; }
  if (k === 'syn') { const [a, b] = pick(r, SYN); const others = shuffle(r, OPP1.map((x) => x[1]).filter((x) => x !== b)).slice(0, 3); return { q: `Word with the same meaning as ‘${a}’:`, a: b, w: others }; }
  if (k === 'past') { const [v, p] = pick(r, PAST); return { q: `Past tense of ‘${v}’ is…`, a: p, w: [v + 'ed', v + 'ing', v + 's'].filter((x) => x !== p) }; }
  if (k === 'comp') { const [b, c, s] = pick(r, COMP); const sup = r() < 0.5; return { q: `${sup ? 'Superlative' : 'Comparative'} of ‘${b}’ is…`, a: sup ? s : c, w: (sup ? [c, 'most ' + b, b + 'est'] : [s, 'more ' + b, b + 'er']).filter((x) => x !== (sup ? s : c)).concat([b]).slice(0, 3) }; }
  if (k === 'article') { const vow = r() < 0.5; const w = pick(r, vow ? VOWEL_WORDS : CONS_WORDS); return { q: `Fill in: I saw ___ ${w}.`, a: vow ? 'an' : 'a', w: [vow ? 'a' : 'an', 'two', 'many'] }; }
  if (k === 'missing') { const w = pick(r, MISSING); const i = 1; const ans = w[i]; const vowels = ['a', 'e', 'i', 'o', 'u'].filter((x) => x !== ans); return { q: `Fill the missing letter: ${w[0]} _ ${w.slice(2)}`, a: ans, w: shuffle(r, vowels).slice(0, 3) }; }
  const [a, b] = pick(r, RHYME); const others = shuffle(r, RHYME.filter((x) => x[0] !== a)).slice(0, 3).map((x) => x[0]); return { q: `Which word rhymes with ‘${a}’?`, a: b, w: others };
}

/* ---------- Maths generator (NCERT Math-Magic topics by class) ---------- */
const EMO = ['🍎', '⭐', '🎈', '🐟', '🌸', '⚽', '🍌', '🐥'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const NAMES = ['Riya', 'Aman', 'Kabir', 'Meera', 'Anaya', 'Rohan', 'Ishaan', 'Sara', 'Arjun', 'Diya'];
function genMath(r, cls, hard) {
  const L = Math.min(5, cls + (hard ? 1 : 0));
  const n = pick(r, NAMES);
  const T = {
    1: [
      () => { const e = pick(r, EMO), k = ri(r, 3, 9); return { q: `How many? ${e.repeat(k)}`, a: String(k), w: numWrongs(r, k, 2, 1) }; },
      () => { const a = ri(r, 1, 9), b = ri(r, 1, 9); return { q: `${a} + ${b} = ?`, a: String(a + b), w: numWrongs(r, a + b, 3, 0) }; },
      () => { const a = ri(r, 6, 18), b = ri(r, 1, a - 1); return { q: `${a} − ${b} = ?`, a: String(a - b), w: numWrongs(r, a - b, 3, 0) }; },
      () => { const a = ri(r, 10, 98); return { q: `Which number comes just after ${a}?`, a: String(a + 1), w: [String(a - 1), String(a + 2), String(a + 10)] }; },
      () => { const ns = shuffle(r, [ri(r, 10, 30), ri(r, 31, 60), ri(r, 61, 99), ri(r, 1, 9)]); const m = Math.max(...ns); return { q: 'Which is the biggest number?', a: String(m), w: ns.filter((x) => x !== m).map(String) }; },
      () => { const t = ri(r, 1, 9), o = ri(r, 0, 9); return { q: `${t} tens and ${o} ones make…`, a: String(t * 10 + o), w: [String(o * 10 + t === t * 10 + o ? t * 10 + o + 1 : o * 10 + t), String(t + o), String(t * 10 + o + 10)] }; },
      () => { const s = pick(r, [['triangle', 3], ['square', 4], ['rectangle', 4]]); return { q: `How many sides does a ${s[0]} have?`, a: String(s[1]), w: numWrongs(r, s[1], 2, 0) }; },
      () => { const d = ri(r, 0, 6); return { q: `Which day comes after ${DAYS[d]}?`, a: DAYS[(d + 1) % 7], w: shuffle(r, DAYS.filter((x, i) => i !== (d + 1) % 7 && i !== d)).slice(0, 3) }; },
    ],
    2: [
      () => { const a = ri(r, 10, 60), b = ri(r, 10, 39); return { q: `${a} + ${b} = ?`, a: String(a + b), w: numWrongs(r, a + b, 10, 0) }; },
      () => { const a = ri(r, 40, 99), b = ri(r, 10, a - 5); return { q: `${a} − ${b} = ?`, a: String(a - b), w: numWrongs(r, a - b, 10, 0) }; },
      () => { const a = ri(r, 2, 5), b = ri(r, 2, 10); return { q: `${a} × ${b} = ?`, a: String(a * b), w: numWrongs(r, a * b, 5, 1) }; },
      () => { const s = pick(r, [2, 5, 10]), st = s * ri(r, 1, 5); const seq = [st, st + s, st + 2 * s, st + 3 * s]; return { q: `Skip count: ${seq.join(', ')}, ?`, a: String(st + 4 * s), w: numWrongs(r, st + 4 * s, s, 0) }; },
      () => { const c = [ri(r, 1, 3), ri(r, 1, 3), ri(r, 1, 3)]; const t = c[0] * 10 + c[1] * 5 + c[2] * 2; return { q: `${n} has ${c[0]} ten-rupee notes, ${c[1]} five-rupee coins and ${c[2]} two-rupee coins. How much money?`, a: '₹' + t, w: numWrongs(r, t, 8, 1).map((x) => '₹' + x) }; },
      () => { const h = ri(r, 1, 11); return { q: `The short hand of a clock is at ${h} and the long hand is at 12. The time is…`, a: `${h} o’clock`, w: [`12 o’clock`, `${h === 11 ? 1 : h + 1} o’clock`, `half past ${h}`] }; },
      () => { const x = ri(r, 11, 99); const even = x % 2 === 0; return { q: `${x} is an ___ number.`, a: even ? 'even' : 'odd', w: [even ? 'odd' : 'even', 'zero', 'negative'] }; },
      () => { const a = ri(r, 11, 99); return { q: `In ${a}, the digit in the tens place is…`, a: String(Math.floor(a / 10)), w: numWrongs(r, Math.floor(a / 10), 3, 0).map((x) => x === String(a % 10) ? String(Math.floor(a / 10) + 4) : x) }; },
    ],
    3: [
      () => { const a = ri(r, 100, 600), b = ri(r, 100, 399); return { q: `${a} + ${b} = ?`, a: String(a + b), w: numWrongs(r, a + b, 30, 0) }; },
      () => { const a = ri(r, 400, 999), b = ri(r, 100, a - 50); return { q: `${a} − ${b} = ?`, a: String(a - b), w: numWrongs(r, a - b, 30, 0) }; },
      () => { const a = ri(r, 2, 10), b = ri(r, 2, 10); return { q: `${a} × ${b} = ?`, a: String(a * b), w: numWrongs(r, a * b, 6, 1) }; },
      () => { const d = ri(r, 2, 9), q = ri(r, 2, 10); return { q: `${d * q} sweets are shared equally among ${d} children. Each child gets…`, a: String(q), w: numWrongs(r, q, 3, 1) }; },
      () => { const h = ri(r, 1, 9), t = ri(r, 0, 9), o = ri(r, 0, 9); const v = h * 100 + t * 10 + o; return { q: `The place value of ${h} in ${v} is…`, a: String(h * 100), w: [String(h), String(h * 10), String(h * 1000)] }; },
      () => { const x = 2 * ri(r, 3, 25); return { q: `Half of ${x} is…`, a: String(x / 2), w: numWrongs(r, x / 2, 4, 1) }; },
      () => { const m = ri(r, 1, 5); return { q: `${m} metre = ___ centimetres`, a: String(m * 100), w: [String(m * 10), String(m * 1000), String(m)] }; },
      () => { const k = ri(r, 1, 5); return { q: `${k} kilogram = ___ grams`, a: String(k * 1000), w: [String(k * 100), String(k * 10), String(k * 10000)] }; },
      () => { const p = ri(r, 5, 20), q = ri(r, 2, 5); return { q: `A pencil costs ₹${p}. What is the cost of ${q} pencils?`, a: '₹' + p * q, w: numWrongs(r, p * q, 8, 1).map((x) => '₹' + x) }; },
    ],
    4: [
      () => { const a = ri(r, 1000, 5999), b = ri(r, 100, 3999); return { q: `${a} + ${b} = ?`, a: String(a + b), w: numWrongs(r, a + b, 100, 0) }; },
      () => { const a = ri(r, 11, 40), b = ri(r, 11, 20); return { q: `${a} × ${b} = ?`, a: String(a * b), w: numWrongs(r, a * b, 30, 1) }; },
      () => { const d = ri(r, 2, 9), q = ri(r, 11, 60); return { q: `${d * q} ÷ ${d} = ?`, a: String(q), w: numWrongs(r, q, 6, 1) }; },
      () => { const l = ri(r, 3, 12), b = ri(r, 2, 9); return { q: `Perimeter of a rectangle ${l} cm long and ${b} cm wide is…`, a: (2 * (l + b)) + ' cm', w: [(l * b) + ' cm', (l + b) + ' cm', (2 * (l + b) + 2) + ' cm'] }; },
      () => { const s = ri(r, 3, 9); return { q: `A square has sides of ${s} cm. How many 1-cm squares cover it?`, a: String(s * s), w: numWrongs(r, s * s, 6, 1).map((x) => x === String(4 * s) ? String(s * s + 3) : x) }; },
      () => { const x = 4 * ri(r, 3, 20); return { q: `One-fourth (1/4) of ${x} is…`, a: String(x / 4), w: numWrongs(r, x / 4, 4, 1) }; },
      () => { const h = ri(r, 1, 11); return { q: `${h + 12}:00 in the 24-hour clock is the same as…`, a: `${h}:00 p.m.`, w: [`${h}:00 a.m.`, `${h + 2}:00 p.m.`, `${h + 12}:00 a.m.`] }; },
      () => { const d = ri(r, 0, 6), k = ri(r, 8, 20); return { q: `Today is ${DAYS[d]}. What day will it be after ${k} days?`, a: DAYS[(d + k) % 7], w: shuffle(r, DAYS.filter((_, i) => i !== (d + k) % 7)).slice(0, 3) }; },
      () => { const a = ri(r, 2, 9) * 100, b = ri(r, 10, 90); return { q: `${n} had ₹${a}. She spent ₹${b}. How much is left?`, a: '₹' + (a - b), w: numWrongs(r, a - b, 20, 1).map((x) => '₹' + x) }; },
    ],
    5: [
      () => { const a = ri(r, 101, 499), b = ri(r, 11, 30); return { q: `${a} × ${b} = ?`, a: String(a * b), w: numWrongs(r, a * b, 200, 1) }; },
      () => { const d = ri(r, 11, 25), q = ri(r, 5, 40); return { q: `${d * q} ÷ ${d} = ?`, a: String(q), w: numWrongs(r, q, 5, 1) }; },
      () => { const L = ri(r, 1, 9), T = ri(r, 0, 9); const v = L * 100000 + T * 10000 + ri(r, 0, 9999); const digs = [...new Set(String(v).split('').filter((d) => d !== String(L)))]; const extra = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].filter((d) => d !== String(L) && digs.indexOf(d) === -1); return { q: `The digit in the lakhs place of ${v.toLocaleString('en-IN')} is…`, a: String(L), w: shuffle(r, digs).concat(shuffle(r, extra)).slice(0, 3) }; },
      () => { const x = ri(r, 2, 9); return { q: `Which fraction is equal to 1/2?`, a: `${x}/${2 * x}`, w: [`${x}/${x + 2}`, `${2 * x}/${x}`, `1/${x + 2}`] }; },
      () => { const den = pick(r, [5, 7, 9]), a = ri(r, 1, 2), b = ri(r, 1, den - a - 1); return { q: `${a}/${den} + ${b}/${den} = ?`, a: `${a + b}/${den}`, w: [`${a + b}/${den * 2}`, `${a * b}/${den}`, `${a + b + 1}/${den}`] }; },
      () => { const t = ri(r, 1, 9); return { q: `${t}/10 written as a decimal is…`, a: `0.${t}`, w: [`${t}.0`, `0.0${t}`, `${t}0`] }; },
      () => { const l = ri(r, 4, 15), b = ri(r, 3, 10); return { q: `Area of a rectangle ${l} m long and ${b} m wide is…`, a: `${l * b} sq m`, w: [`${2 * (l + b)} sq m`, `${l + b} sq m`, `${l * b + 10} sq m`] }; },
      () => { const x = pick(r, [12, 18, 20, 24, 30, 36]); const fs = []; for (let i = 1; i <= x; i++) if (x % i === 0) fs.push(i); const f = pick(r, fs.filter((v) => v > 1 && v < x)); const nonf = [5, 7, 8, 9, 11, 13].filter((v) => x % v !== 0); return { q: `Which of these is a factor of ${x}?`, a: String(f), w: shuffle(r, nonf).slice(0, 3).map(String) }; },
      () => { const s = ri(r, 2, 4); return { q: `How many 1-cm cubes make a bigger cube with ${s} cm sides?`, a: String(s ** 3), w: [String(s * s), String(s * 3), String(s ** 3 + s)] }; },
      () => { const p = pick(r, [['right angle', '90°'], ['straight angle', '180°']]); return { q: `A ${p[0]} measures…`, a: p[1], w: ['45°', '360°', p[1] === '90°' ? '180°' : '90°'] }; },
    ],
  };
  const idx = Math.floor(r() * T[L].length);
  const q = T[L][idx]();
  q.t = L + ':' + idx; // question type, so a paper doesn't repeat one type too often
  return q;
}

/* ---------- subjects ---------- */
const SUBJECTS = [
  { id: 'mathematics', name: 'Mathematics', section: 'Mathematical Reasoning', gen: genMath },
  { id: 'science', name: 'Science', section: 'Science (EVS)', pool: ['science', 'humanbody', 'plants', 'animals', 'space'] },
  { id: 'english', name: 'English', section: 'Word & Structure Knowledge', pool: ['english'], gen: genEnglish, genShare: 0.4 },
  { id: 'computer', name: 'Computer Science', section: 'Computers', pool: ['computers'] },
  { id: 'gk', name: 'General Knowledge', section: 'General Awareness', pool: ['gk', 'geography', 'history', 'capitals', 'sports'] },
];

function validItem(it) { const o = [it.a].concat(it.w); return it.w.length === 3 && new Set(o).size === 4 && o.every((x) => x !== '' && x != null); }
function writeJson(f, o) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); }

let written = 0; const report = [];
for (const S of SUBJECTS) {
  for (const cls of CLASSES) {
    const pool = S.pool ? quizPool(S.pool, cls).filter(validItem) : [];
    const nextPool = S.pool ? quizPool(S.pool, Math.min(5, cls + 1)).filter(validItem) : [];
    const orderR = makeRng(`${S.id}|${cls}|order`);
    const base = shuffle(orderR, pool);
    // papers: as many as the pool supports without heavy repetition (min 2)
    const genOnly = !S.pool;
    // small English banks lean more on the (reliable) grammar generator
    const share = S.gen ? (pool.length < 60 ? 0.6 : (S.genShare || 0)) : 0;
    const per = NORMAL + ACH;
    const papers = genOnly ? MAX_PAPERS : Math.max(2, Math.min(MAX_PAPERS, Math.floor((pool.length * (share ? 1 / (1 - share) : 1)) / per) + (share ? 2 : 0)));
    let cursor = 0;
    const usedAch = new Set();
    for (let p = 1; p <= papers; p++) {
      const r = makeRng(`${S.id}|${cls}|paper${p}`);
      const seen = new Set(), typeCount = {};
      const take = (n, hard) => {
        const out = []; let g = 0;
        while (out.length < n && g++ < 500) {
          let it;
          const useGen = S.gen && (genOnly || r() < share);
          if (useGen) it = S.gen(r, cls, hard);
          else if (hard && nextPool.length && cls < 5) { it = nextPool[Math.floor(r() * nextPool.length)]; if (usedAch.has(it.q)) continue; }
          else { it = base[cursor % base.length]; cursor++; }
          if (!it || !validItem(it) || seen.has(it.q)) continue;
          if (it.t) { typeCount[it.t] = (typeCount[it.t] || 0) + 1; if (typeCount[it.t] > 2) continue; }
          seen.add(it.q); if (hard) usedAch.add(it.q);
          out.push(it);
        }
        return out;
      };
      const normal = take(NORMAL, false), ach = take(ACH, true);
      const questions = [], answers = {};
      const add = (it, section, marks) => {
        const id = questions.length + 1;
        const options = shuffle(r, [it.a].concat(it.w));
        questions.push({ id, question: it.q, options, section, marks });
        answers[String(id)] = options.indexOf(it.a);
      };
      normal.forEach((it) => add(it, S.section, 1));
      ach.forEach((it) => add(it, 'Achievers Section', 2));
      const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
      const dir = path.join(DATA, 'class' + cls, S.id);
      writeJson(path.join(dir, 'questions', `paper${p}.json`), {
        class: cls, subject: S.name, paper: p, title: `Class ${cls} ${S.name} — Paper ${p}`,
        durationMinutes: DURATION, totalMarks,
        patternNote: `Olympiad-style practice for Class ${cls}, built from NCERT-level content: ${NORMAL} × 1 mark + ${ACH} Achievers × 2 marks. Not an official exam paper.`,
        yearStyle: '2023-2025', questions,
      });
      writeJson(path.join(dir, 'answers', `paper${p}.json`), { class: cls, subject: S.name, paper: p, answers });
      written++;
    }
    // remove old papers beyond the new count
    for (let p = papers + 1; p <= 10; p++) {
      ['questions', 'answers'].forEach((k) => { const f = path.join(DATA, 'class' + cls, S.id, k, `paper${p}.json`); if (fs.existsSync(f)) fs.unlinkSync(f); });
    }
    report.push(`${S.id.padEnd(12)} class ${cls}: pool ${String(pool.length).padStart(3)} → ${papers} papers`);
  }
}
console.log(report.join('\n'));
console.log(`Wrote ${written} papers.`);

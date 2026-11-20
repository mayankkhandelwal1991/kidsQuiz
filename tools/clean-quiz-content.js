#!/usr/bin/env node
/* ------------------------------------------------------------------
   Content clean-up for quiz/<subject>/class1..5.js  (run: node tools/clean-quiz-content.js [--write])

   1. Tidy answers/options: "Comb/Saw" -> "Comb", "Bulb (modified stem)" -> "Bulb".
   2. Drop questions whose wrong options were made "different" with hack
      words (… only / … alone / … fully / … wrong) — the plain version is
      often also correct, so the question is ambiguous.
   3. Drop questions above the NCERT level of the class (keyword list).
   4. The same question (+answer) in two classes is kept only once.
   5. Every question must end with 4 different options containing the answer.
   Without --write it only prints what it would change.
   ------------------------------------------------------------------ */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const LEVELS = [1, 2, 3, 4, 5];
const RANGE = { addsub: [1, 5], patterns: [1, 5], multiply: [2, 5], reasoning: [2, 5], divide: [3, 5], mixedmath: [3, 5], english: [1, 5], hindi: [1, 5], gk: [1, 5], science: [1, 5], computers: [1, 5], sports: [1, 5], humanbody: [1, 5], space: [1, 5], animals: [1, 3], plants: [1, 4], geography: [2, 5], riddles: [2, 5], history: [3, 5], capitals: [3, 5] };

// Terms NCERT does not use before this class (EVS 'Looking Around' 3–5; science starts Class 6).
const ABOVE_LEVEL = [
  [/photosynth|chlorophyll|chloroplast|stomat|xylem|phloem|transpiration|germinat\w* (process)|pollinat/i, 5],
  [/exoskeleton|endoskeleton|invertebrat|vertebrat|carapace|baleen|plankton|swim bladder|arthropod|crustacean|amphibian|marsupial|nocturnal/i, 5],
  [/\bcells?\b|nucleus|molecule|\batoms?\b|bacteri|virus|microorganism|organism/i, 5],
  [/carbohydrate|protein|vitamin|mineral|nutrient|digestive system|respiratory|circulatory|skeletal system|nervous system|excret|kidney|lungs? capacity/i, 4],
  [/ecosystem|food chain|food web|habitat|adaptation|camouflage|hibernat|migrat|species|predator|prey|herbivore|carnivore|omnivore|mammal|reptile/i, 3],
  [/orbit|gravity|galaxy|solar system|light.?year|axis|revolution|rotation|constellation|satellite|asteroid|comet|meteor/i, 3],
  [/latitude|longitude|equator|hemisphere|continent|plateau|peninsula|delta|strait|tributary|monsoon/i, 3],
  [/constitution|parliament|democracy|fundamental|preamble|lok sabha|rajya sabha/i, 5],
  [/\bRAM\b|\bROM\b|\bCPU\b|operating system|software|hardware|internet|browser|e-?mail|byte|binary|algorithm|program(m|me)/i, 3],
];
const HACK = /\b(only|alone|fully|wrong|exactly)\b/i;

function tidy(s) {
  s = String(s).trim();
  const noParen = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (noParen && noParen !== s) s = noParen;
  // "Comb/Saw" -> "Comb"  (keep fractions/dates like 1/2, 15/08)
  if (/\//.test(s) && !/\d/.test(s)) {   // never touch numbers / units like 9.8 m/s², 1/2
    const parts = s.split('/').map((x) => x.trim()).filter(Boolean);
    if (parts.length > 1 && parts.every((p) => /\p{L}/u.test(p))) s = parts[0];
  }
  s = s.replace(/^(.+?)\s+or\s+.+$/i, (m, a) => (a.length >= 2 && !/\b(either|whether)\b/i.test(m) ? a : m));
  return s;
}

const REG = {}; const HEAD = {};
for (const subj of fs.readdirSync(path.join(ROOT, 'quiz'))) {
  const dir = path.join(ROOT, 'quiz', subj);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const L of LEVELS) {
    const f = path.join(dir, 'class' + L + '.js');
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const ctx = { registerQuiz(s, l, q) { REG[s] = REG[s] || {}; REG[s][l] = q; } };
    vm.createContext(ctx); vm.runInContext(src, ctx);
    HEAD[subj + '|' + L] = { file: f, head: src.slice(0, src.indexOf('registerQuiz(')) };
  }
}

const stats = {}; const examples = {};
const bump = (k, ex) => { stats[k] = (stats[k] || 0) + 1; (examples[k] = examples[k] || []).length < 4 && ex && examples[k].push(ex); };
const OUT = {};
for (const s in REG) {
  OUT[s] = {};
  for (const L of LEVELS) {
    const pool = REG[s][L]; if (!pool) continue;
    OUT[s][L] = [];
    for (const q0 of pool) {
      const others = q0.options.filter((o) => o !== q0.answer);
      if (!HACK.test(q0.question) && others.some((o) => HACK.test(o))) { bump('drop: hack distractor', s + L + ' ' + q0.question + ' | ' + q0.options.join(' / ')); continue; }
      const txt = q0.question + ' ' + q0.answer;
      const above = s !== 'computers' || true ? ABOVE_LEVEL.find(([re, minL]) => L < minL && re.test(txt)) : null;
      if (above && !(s === 'computers' && /software|hardware|internet/i.test(txt) && L >= 2)) { bump('drop: above NCERT level', s + L + ' ' + q0.question + ' => ' + q0.answer); continue; }
      const q = Object.assign({}, q0, { answer: tidy(q0.answer), options: q0.options.map(tidy) });
      if (q.answer !== q0.answer) bump('tidy answer', q0.answer + ' -> ' + q.answer);
      if (s === 'hindi' && q.answer !== q0.answer && /[\u0900-\u097F]/.test(q0.answer)) { bump('drop: hindi answer needed tidy', q0.question + ' => ' + q0.answer); continue; }
      if (q.options.length !== 4 || new Set(q.options).size !== 4 || !q.options.includes(q.answer)) { bump('drop: broken after tidy / duplicate options', s + L + ' ' + q0.question + ' | ' + q0.options.join(' / ')); continue; }
      OUT[s][L].push(q);
    }
  }
}
// cross-class duplicates: keep at the lowest class inside the subject's range
for (const s in OUT) {
  const seen = {};
  const r = RANGE[s] || [1, 5];
  const order = LEVELS.filter((L) => L >= r[0] && L <= r[1]).concat(LEVELS.filter((L) => L < r[0] || L > r[1]));
  for (const L of order) {
    if (!OUT[s][L]) continue;
    OUT[s][L] = OUT[s][L].filter((q) => {
      const k = (q.question + '|' + q.answer).toLowerCase().trim();
      if (/^(correct spelling|which is correct|choose the correct)/i.test(q.question)) return true; // same prompt, different words
      if (seen[k] != null) { bump('drop: repeated in class ' + seen[k], s + L + ' ' + q.question); return false; }
      seen[k] = L; return true;
    });
  }
}
console.log(JSON.stringify(stats, null, 1));
for (const k in examples) { console.log('\n# ' + k); examples[k].forEach((e) => console.log('   ' + e)); }
console.log('\nquestions left per subject/class:');
for (const s in OUT) console.log('  ' + s.padEnd(11) + LEVELS.map((L) => (OUT[s][L] ? (REG[s][L].length + '→' + OUT[s][L].length) : '-').padStart(9)).join(''));

if (WRITE) {
  for (const s in OUT) for (const L of LEVELS) {
    const h = HEAD[s + '|' + L]; if (!h || !OUT[s][L]) continue;
    const body = OUT[s][L].map((q) => {
      const o = { question: q.question, answer: q.answer, options: q.options };
      ['mode', 'speak', 'size'].forEach((k) => { if (q[k] != null) o[k] = q[k]; });
      return '  ' + JSON.stringify(o).replace(/"(question|answer|options|mode|speak|size)":/g, '$1: ').replace(/","/g, '", "').replace(/,(question|answer|options|mode|speak|size): /g, ', $1: ').replace(/^\{/, '{ ').replace(/\}$/, ' }') + ',';
    }).join('\n');
    fs.writeFileSync(h.file, h.head + 'registerQuiz(' + JSON.stringify(s) + ', ' + L + ', [\n' + body + '\n]);\n');
  }
  console.log('\nWROTE files. Now run: node tools/build-quizzes.js');
}

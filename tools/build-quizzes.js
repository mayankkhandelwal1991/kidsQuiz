#!/usr/bin/env node
/* ------------------------------------------------------------------
   Regenerate data/quizzes.json from the editable per-subject files
   in quiz/<subject>/class<N>.js.

   You can edit questions EITHER way:
     • directly in data/quizzes.json (fastest), OR
     • in the friendly quiz/<subject>/class<N>.js files, then run:
           node tools/build-quizzes.js
       to compile them back into data/quizzes.json.

   Run this from the project root.
   ------------------------------------------------------------------ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const QUIZ_DIR = path.join(ROOT, 'quiz');
const OUT = path.join(ROOT, 'data', 'quizzes.json');

const REG = {};
const sandbox = {
  registerQuiz(subject, level, questions) {
    REG[subject] = REG[subject] || {};
    REG[subject][String(level)] = questions;
  }
};
vm.createContext(sandbox);

if (!fs.existsSync(QUIZ_DIR)) {
  console.error('No quiz/ folder found — nothing to compile.');
  process.exit(1);
}

let files = 0;
for (const subj of fs.readdirSync(QUIZ_DIR).sort()) {
  const dir = path.join(QUIZ_DIR, subj);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter(f => /^class\d+\.js$/.test(f)).sort()) {
    try {
      vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
      files++;
    } catch (e) {
      console.error('FAILED', subj + '/' + f, '-', e.message);
    }
  }
}

let questions = 0;
for (const s in REG) for (const l in REG[s]) questions += REG[s][l].length;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(REG, null, 0));
console.log(`Wrote ${OUT}`);
console.log(`  ${files} files -> ${Object.keys(REG).length} subjects, ${questions} questions`);

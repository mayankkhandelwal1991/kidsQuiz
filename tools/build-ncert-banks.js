#!/usr/bin/env node
/* ------------------------------------------------------------------
   Turns the NCERT-aligned banks in tools/ncert-banks/<subject>.txt into
   quiz/<subject>/class<N>.js for every class the bank contains
   (replacing that class file). Then run: node tools/build-quizzes.js
     Bank format:   ## class3
                    question | correct | wrong | wrong | wrong
   ------------------------------------------------------------------ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(__dirname, 'ncert-banks');
let total = 0, files = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.txt'))) {
  const subj = f.replace(/\.txt$/, '');
  const lines = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
  const note = (lines.find((l) => /^#\s/.test(l)) || '').replace(/^#\s*/, '');
  const byClass = {}; let cls = null;
  lines.forEach((raw, i) => {
    const l = raw.trim();
    if (!l || (l.startsWith('#') && !l.startsWith('##'))) return;
    const m = l.match(/^##\s*class(\d+)$/); if (m) { cls = +m[1]; byClass[cls] = []; return; }
    const p = l.split('|').map((x) => x.trim());
    if (p.length !== 5) throw new Error(`${f}:${i + 1} needs 5 parts`);
    if (new Set(p.slice(1)).size !== 4) throw new Error(`${f}:${i + 1} duplicate option: ${l}`);
    if (byClass[cls].some((q) => q.question === p[0] && q.answer === p[1])) throw new Error(`${f}:${i + 1} duplicate question`);
    byClass[cls].push({ question: p[0], answer: p[1], options: p.slice(1) });
  });
  for (const c in byClass) {
    const out = path.join(ROOT, 'quiz', subj, 'class' + c + '.js');
    const body = byClass[c].map((q) => '  { question: ' + JSON.stringify(q.question) + ', answer: ' + JSON.stringify(q.answer) + ', options: ' + JSON.stringify(q.options).replace(/","/g, '", "') + ' },').join('\n');
    fs.writeFileSync(out, `/* ============================================================
   ${subj.toUpperCase()} — Class ${c}
   ${note}
   Generated from tools/ncert-banks/${f} — edit the bank, then run:
     node tools/build-ncert-banks.js && node tools/build-quizzes.js
   ============================================================ */
registerQuiz(${JSON.stringify(subj)}, ${c}, [
${body}
]);
`);
    total += byClass[c].length; files++;
  }
}
console.log(`Wrote ${files} class files, ${total} questions.`);

#!/usr/bin/env node
/**
 * Generate ORIGINAL Class 5 Olympiad practice papers aligned to SOF
 * 2023–2025 exam PATTERN and SYLLABUS (not copyrighted SOF questions).
 *
 * Patterns (Classes 5–10):
 *  Mathematics (IMO): LR 15×1 + MR 20×1 + Achievers 5×3 = 40Q, 50 marks
 *  Science (NSO):     LR 10×1 + Science 35×1 + Achievers 5×3 = 50Q, 60 marks
 *  English (IEO):     WSK 45×1 + Reading 10×1 + SWE 5×1 = 60Q, 60 marks
 *  Computer (ICSO):   LR 10×1 + Computers 35×1 + Achievers 5×3 = 50Q, 60 marks
 *  GK (IGKO):         GA 30×1 + CA 10×1 + Life Skills 5×1 + Achievers 5×3 = 50Q, 60 marks
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "data", "class5");
const CLASS = 5;

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function writePaper(folder, paperNo, meta, questions, answers) {
  const qDir = path.join(ROOT, folder, "questions");
  const aDir = path.join(ROOT, folder, "answers");
  ensureDir(qDir);
  ensureDir(aDir);
  const totalMarks =
    meta.totalMarks ||
    questions.reduce((s, q) => s + (Number(q.marks) || 1), 0);
  const qOut = {
    class: CLASS,
    subject: meta.subject,
    paper: paperNo,
    title: `Class ${CLASS} ${meta.subject} — Paper ${paperNo}`,
    durationMinutes: 60,
    totalMarks,
    patternNote:
      "Original practice paper aligned to SOF 2023–2025 Class 5 pattern & syllabus. Not an official SOF paper.",
    yearStyle: "2023-2025",
    questions,
  };
  const aOut = {
    class: CLASS,
    subject: meta.subject,
    paper: paperNo,
    answers,
  };
  fs.writeFileSync(path.join(qDir, `paper${paperNo}.json`), JSON.stringify(qOut, null, 2));
  fs.writeFileSync(path.join(aDir, `paper${paperNo}.json`), JSON.stringify(aOut, null, 2));
}

/** @returns {{q: object, a: number}} */
function Q(id, question, options, answerIndex, section, marks = 1) {
  if (!options || options.length !== 4) {
    throw new Error(`Q${id}: need 4 options`);
  }
  if (answerIndex < 0 || answerIndex > 3) {
    throw new Error(`Q${id}: bad answer index`);
  }
  return {
    q: {
      id,
      question,
      options: options.map(String),
      section,
      marks,
    },
    a: answerIndex,
  };
}

function pack(items) {
  const questions = items.map((x) => x.q);
  const answers = {};
  items.forEach((x) => {
    answers[String(x.q.id)] = x.a;
  });
  // renumber ids 1..n sequentially
  questions.forEach((q, i) => {
    const old = String(q.id);
    const neu = i + 1;
    q.id = neu;
    if (old !== String(neu)) {
      answers[String(neu)] = answers[old];
      delete answers[old];
    }
  });
  // rebuild answers in order
  const ordered = {};
  questions.forEach((q) => {
    ordered[String(q.id)] = answers[String(q.id)];
  });
  return { questions, answers: ordered };
}

function validate(paper, expectCount, expectMarks) {
  const { questions, answers } = paper;
  if (questions.length !== expectCount) {
    throw new Error(`Expected ${expectCount} questions, got ${questions.length}`);
  }
  let marks = 0;
  const ids = new Set();
  questions.forEach((q) => {
    if (ids.has(q.id)) throw new Error(`Duplicate id ${q.id}`);
    ids.add(q.id);
    if (!q.options || q.options.length !== 4) throw new Error(`Q${q.id} options`);
    if (answers[String(q.id)] === undefined) throw new Error(`No answer for ${q.id}`);
    const a = answers[String(q.id)];
    if (a < 0 || a > 3) throw new Error(`Bad answer ${q.id}`);
    const set = new Set(q.options.map(String));
    if (set.size < 4) {
      console.warn(`WARN Q${q.id}: duplicate options: ${JSON.stringify(q.options)}`);
    }
    marks += Number(q.marks) || 1;
  });
  if (marks !== expectMarks) {
    throw new Error(`total marks ${marks} expected ${expectMarks}`);
  }
  return marks;
}

// ─────────────────────────────────────────────────────────────
// Small utils for varied numeric stems
// ─────────────────────────────────────────────────────────────
function shuffleOpts(correct, wrongs) {
  const opts = [correct, ...wrongs].map(String);
  // stable unique
  const uniq = [];
  for (const o of opts) if (!uniq.includes(o)) uniq.push(o);
  while (uniq.length < 4) uniq.push(String(Number(correct) + uniq.length * 3 + 1));
  const four = uniq.slice(0, 4);
  // rotate so correct not always A — place by simple hash
  const idx = Math.abs(String(correct).length * 3 + four[1].length) % 4;
  const out = four.filter((x) => x !== String(correct));
  out.splice(idx, 0, String(correct));
  while (out.length < 4) out.push("None");
  return { options: out.slice(0, 4), ans: out.indexOf(String(correct)) };
}


// ─────────────────────────────────────────────────────────────
// MATHEMATICS — 40Q / 50 marks
// ─────────────────────────────────────────────────────────────
function mathPapers() {
  const papers = [];
  const seeds = [
    { a: 12, b: 8, c: 5, d: 25, e: 36, f: 48, g: 125, h: 7, i: 9, j: 15, k: 3, m: 4, n: 6, p: 240, q: 360, r: 18, s: 45, t: 72 },
    { a: 15, b: 9, c: 6, d: 32, e: 49, f: 54, g: 216, h: 8, i: 11, j: 20, k: 4, m: 5, n: 7, p: 300, q: 420, r: 24, s: 56, t: 81 },
    { a: 18, b: 12, c: 7, d: 28, e: 64, f: 63, g: 343, h: 6, i: 10, j: 16, k: 5, m: 3, n: 8, p: 180, q: 480, r: 27, s: 64, t: 96 },
    { a: 20, b: 16, c: 8, d: 36, e: 81, f: 72, g: 512, h: 9, i: 12, j: 25, k: 2, m: 6, n: 9, p: 360, q: 540, r: 32, s: 75, t: 108 },
    { a: 24, b: 14, c: 9, d: 40, e: 100, f: 84, g: 729, h: 5, i: 13, j: 18, k: 6, m: 4, n: 5, p: 200, q: 600, r: 36, s: 90, t: 120 },
  ];

  for (let pi = 0; pi < 5; pi++) {
    const S = seeds[pi];
    const items = [];
    let id = 1;
    const L = "Logical Reasoning";
    const M = "Mathematical Reasoning";
    const A = "Achievers Section";

    // --- Logical Reasoning 15×1 ---
    // Number series
    const s1 = [S.a, S.a * 2, S.a * 4, S.a * 8];
    items.push(Q(id++, `Find the next term: ${s1.join(", ")}, __.`, [`${S.a * 16}`, `${S.a * 12}`, `${S.a * 10}`, `${S.a * 14}`], 0, L));
    const s2start = S.b;
    const s2 = [s2start, s2start + 3, s2start + 8, s2start + 15]; // +3,+5,+7 → next +9
    items.push(Q(id++, `Find the next number: ${s2.join(", ")}, __.`, [`${s2start + 24}`, `${s2start + 22}`, `${s2start + 20}`, `${s2start + 18}`], 0, L));
    items.push(Q(id++, `Which does not belong: 2, 3, 5, 7, 9, 11?`, ["2", "9", "11", "5"], 1, L));
    items.push(Q(id++, `If TREE is coded as USFF, how is LEAF coded?`, ["MFBG", "MFBG", "KDZE", "MDBG"].filter((v,i,a)=>a.indexOf(v)===i).concat(["KEBG"]).slice(0,4).length===4
      ? ["MFBG", "KDZE", "MEBG", "LFBG"] : ["MFBG", "KDZE", "MEBG", "LFBG"], 0, L));
    // Fix coding Q properly
    items[items.length - 1] = Q(id - 1, `If CAT is coded as DBU, how is DOG coded?`, ["EPH", "CNF", "EPH", "DPH"].filter((v,i,a)=>a.indexOf(v)===i), 0, L);
    // ensure 4 unique
    items[items.length - 1] = Q(id - 1, `If CAT is coded as DBU (each letter +1), how is DOG coded?`, ["EPH", "CNF", "DPH", "EPI"], 0, L);

    items.push(Q(id++, `Odd one out: Square, Rectangle, Triangle, Circle.`, ["Circle", "Square", "Rectangle", "Triangle"], 0, L));
    items.push(Q(id++, `A is taller than B. C is shorter than B. Who is tallest?`, ["A", "B", "C", "Cannot say"], 0, L));
    items.push(Q(id++, `Find the mirror image of the word 'OPEN' if the mirror is placed vertically to the right.`, ["NEPO", "OPEN", "NEPO", "EPON"].filter((v,i,a)=>a.indexOf(v)===i).length === 4 ? ["NEPO","OPEN","EPON","NOPE"] : ["NEPO","OPEN","EPON","NOPE"], 0, L));
    items[items.length - 1] = Q(id - 1, `Which comes next in the pattern: △ ○ △ ○ △ __?`, ["○", "△", "□", "●"], 0, L);
    items.push(Q(id++, `If 1st January is a Monday, what day is 8th January?`, ["Monday", "Sunday", "Tuesday", "Wednesday"], 0, L));
    items.push(Q(id++, `Complete the analogy: Book : Reading :: Fork : __.`, ["Eating", "Drawing", "Sleeping", "Writing"], 0, L));
    items.push(Q(id++, `How many 2-digit numbers can be formed using digits 1, 2, 3 without repetition?`, ["6", "9", "3", "8"], 0, L));
    items.push(Q(id++, `Which is the 4th letter to the left of R in the alphabet?`, ["N", "O", "M", "P"], 0, L));
    // R is 18, 4 left = 14 = N
    items.push(Q(id++, `In a row of 10 children, Ria is 4th from left. Position from right?`, ["7th", "6th", "5th", "8th"], 0, L));
    items.push(Q(id++, `If all vowels are removed from COMPUTER, remaining letters are:`, ["CMPTR", "CMPUTR", "CMTR", "CPTR"], 0, L));
    items.push(Q(id++, `Find the missing number: 4, 9, 16, 25, __.`, ["36", "30", "32", "49"], 0, L));
    items.push(Q(id++, `Which figure has all sides equal and all angles 90°?`, ["Square", "Rhombus", "Rectangle", "Parallelogram"], 0, L));

    // Ensure exactly 15 LR - count and pad if needed
    while (items.filter((x) => x.q.section === L).length < 15) {
      const n = items.filter((x) => x.q.section === L).length;
      items.push(Q(id++, `If Monday is coded as 2, Tuesday as 3, what is Friday coded as?`, ["6", "5", "7", "4"], 0, L));
    }
    // trim excess LR if any
    // We'll rebuild cleanly below instead - abort this messy approach
  }
  // Clear and use clean builder
  return null;
}

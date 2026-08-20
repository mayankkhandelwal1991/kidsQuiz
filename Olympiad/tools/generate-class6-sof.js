#!/usr/bin/env node
/**
 * Generate ORIGINAL Class 6 Olympiad practice papers aligned to SOF
 * 2023–2025 exam PATTERN and SYLLABUS (not copyrighted SOF questions).
 *
 * Mathematics (IMO): LR 15×1 + MR 20×1 + Achievers 5×3 = 40 Q, 50 marks
 * Science (NSO):     LR 10×1 + Science 35×1 + Achievers 5×3 = 50 Q, 60 marks
 * English (IEO):     WSK 45×1 + Reading 10×1 + SWE 5×1 = 60 Q, 60 marks
 * Computer (ICSO):   LR 10×1 + Computers 35×1 + Achievers 5×3 = 50 Q, 60 marks
 * GK (IGKO):         GA 30×1 + CA 10×1 + Life Skills 5×1 + Achievers 5×3 = 50 Q, 60 marks
 *
 * Class 6 NCERT-aligned topics. All questions original practice content.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const CLASS = 6;
const ROOT = path.join(__dirname, "..", "data", "class6");

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function writePaper(folder, paperNo, meta, questions, answers) {
  const qDir = path.join(ROOT, folder, "questions");
  const aDir = path.join(ROOT, folder, "answers");
  ensureDir(qDir);
  ensureDir(aDir);
  const qOut = {
    class: CLASS,
    subject: meta.subject,
    paper: paperNo,
    title: `Class ${CLASS} ${meta.subject} — Paper ${paperNo}`,
    durationMinutes: 60,
    totalMarks: meta.totalMarks,
    patternNote:
      "Original practice paper aligned to SOF 2023–2025 pattern and Class 6 syllabus (not a copyrighted SOF paper).",
    yearStyle: "2023-2025",
    questions,
  };
  const aOut = {
    class: CLASS,
    subject: meta.subject,
    paper: paperNo,
    answers,
  };
  fs.writeFileSync(path.join(qDir, `paper${paperNo}.json`), JSON.stringify(qOut, null, 2) + "\n");
  fs.writeFileSync(path.join(aDir, `paper${paperNo}.json`), JSON.stringify(aOut, null, 2) + "\n");
}

function Q(id, question, options, answerIndex, section, marks = 1) {
  if (!options || options.length !== 4) {
    throw new Error(`Q${id}: need 4 options got ${options && options.length}: ${question}`);
  }
  const opts = options.map(String);
  if (new Set(opts).size !== 4) {
    throw new Error(`Q${id}: duplicate options ${JSON.stringify(opts)} :: ${question}`);
  }
  if (answerIndex < 0 || answerIndex > 3) throw new Error(`Q${id}: bad ans`);
  return { q: { id, question, options: opts, section, marks }, a: answerIndex };
}

function pack(items) {
  const questions = items.map((x) => Object.assign({}, x.q));
  const answers = {};
  questions.forEach((q, i) => {
    q.id = i + 1;
    answers[String(q.id)] = items[i].a;
  });
  return { questions, answers };
}

function validate(paper, expectCount, expectMarks) {
  const { questions, answers } = paper;
  if (questions.length !== expectCount) {
    throw new Error(`Expected ${expectCount} Q, got ${questions.length}`);
  }
  let marks = 0;
  const ids = new Set();
  for (const q of questions) {
    if (ids.has(q.id)) throw new Error(`dup id ${q.id}`);
    ids.add(q.id);
    if (!q.options || q.options.length !== 4) throw new Error(`Q${q.id} opts`);
    if (new Set(q.options.map(String)).size !== 4) {
      throw new Error(`Q${q.id} dup opts ${JSON.stringify(q.options)}`);
    }
    const a = answers[String(q.id)];
    if (a === undefined || a < 0 || a > 3) throw new Error(`bad ans ${q.id}`);
    marks += Number(q.marks) || 1;
  }
  if (marks !== expectMarks) throw new Error(`marks ${marks} != ${expectMarks}`);
  return marks;
}

function mcq(correct, wrongs, preferIdx) {
  const c = String(correct);
  const uniq = [];
  for (const x of wrongs.map(String)) {
    if (x !== c && !uniq.includes(x)) uniq.push(x);
  }
  let k = 1;
  while (uniq.length < 3) {
    const cand = Number.isFinite(Number(c)) ? String(Number(c) + k * 2 + 1) : c + "_" + k;
    if (cand !== c && !uniq.includes(cand)) uniq.push(cand);
    k++;
  }
  const opts = uniq.slice(0, 3);
  const idx = ((preferIdx % 4) + 4) % 4;
  opts.splice(idx, 0, c);
  return { options: opts, ans: opts.indexOf(c) };
}

function numOpts(correct, preferIdx, spreads) {
  const c = Number(correct);
  const wrongs = (spreads || [1, 2, -1, 3, -2, 5, 10, -5])
    .map((d) => c + d)
    .filter((x) => x !== c);
  return mcq(String(c), wrongs, preferIdx);
}

function gcd(u, v) {
  u = Math.abs(u);
  v = Math.abs(v);
  while (v) {
    const t = v;
    v = u % v;
    u = t;
  }
  return u;
}

function pick(arr, paperNo, offset) {
  return arr[(paperNo - 1 + offset) % arr.length];
}

function rotateAns(rows, paperNo) {
  // rows: [q, options[4], ansIndex] — rotate options by paper for variety while keeping correctness
  return rows.map((row, i) => {
    const [q, opts, ans] = row;
    const shift = (paperNo + i) % 4;
    const rotated = [0, 1, 2, 3].map((j) => opts[(j + shift) % 4]);
    const correct = opts[ans];
    const newAns = rotated.indexOf(correct);
    return [q, rotated, newAns];
  });
}

// ═══════════════════════════════════════════════════════════
// MATHEMATICS — 40Q / 50 marks
// ═══════════════════════════════════════════════════════════
function buildMath(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const L = "Logical Reasoning";
  const M = "Mathematical Reasoning";
  const A = "Achievers Section";

  // —— Logical Reasoning 15×1 ——
  {
    const s0 = 2 + p;
    let o = numOpts(s0 + 16, id, [1, -1, 3, 5]);
    items.push(
      Q(
        id++,
        `Find the next term: ${s0}, ${s0 + 4}, ${s0 + 8}, ${s0 + 12}, __.`,
        o.options,
        o.ans,
        L
      )
    );

    o = numOpts((3 + p) * 16, id, [2, 4, -3, 8]);
    const g = 3 + p;
    items.push(
      Q(id++, `Find the next term: ${g}, ${g * 2}, ${g * 4}, ${g * 8}, __.`, o.options, o.ans, L)
    );

    items.push(
      Q(
        id++,
        "Odd one out: Square, Rectangle, Rhombus, Circle",
        ["Circle", "Square", "Rectangle", "Rhombus"],
        0,
        L
      )
    );

    items.push(
      Q(
        id++,
        "If PAPER is coded as QBQFS (each letter +1), then PENCIL is coded as:",
        ["QFODJM", "QDOBJK", "ODMBHK", "QFODJN"],
        0,
        L
      )
    );

    // Directions: start North, 90 CW → East, 180 → West, 90 ACW from West = South
    items.push(
      Q(
        id++,
        "Ravi faces North. He turns 90° right, then 180°, then 90° left. He now faces:",
        ["South", "North", "East", "West"],
        0,
        L
      )
    );

    // 3:27 :: 4:? → cubes 27 and 64
    items.push(
      Q(id++, "Analogy: 3 : 27 :: 4 : ?", ["64", "16", "32", "12"], 0, L)
    );

    items.push(
      Q(
        id++,
        "Odd one out: Addition, Subtraction, Multiplication, Equation",
        ["Equation", "Addition", "Subtraction", "Multiplication"],
        0,
        L
      )
    );

    // Ranking: 30 students, 12th from left → from right = 30-12+1=19
    o = numOpts(19, id, [2, -2, 4, 1]);
    items.push(
      Q(
        id++,
        "In a line of 30 students, Meera is 12th from the left. Her position from the right is:",
        o.options,
        o.ans,
        L
      )
    );

    // Calendar: if 1st is Monday, 15th is Monday+14d = Monday
    items.push(
      Q(
        id++,
        "If the 1st of a month is a Monday, then the 22nd of the same month is a:",
        ["Monday", "Tuesday", "Sunday", "Wednesday"],
        0,
        L
      )
    );

    // Venn-style counting: only cricket = (12+p)-(4+p)=8
    o = numOpts(8, id, [1, -1, 2, 3]);
    items.push(
      Q(
        id++,
        `There are ${20 + p} students; ${12 + p} play cricket and ${10 + p} play football. If ${4 + p} play both, how many play only cricket?`,
        o.options,
        o.ans,
        L
      )
    );

    // Figure pattern of letters
    items.push(
      Q(
        id++,
        "Which letter comes midway between K and Q in the English alphabet?",
        ["N", "M", "O", "L"],
        0,
        L
      )
    );

    // Mirror time conceptually
    items.push(
      Q(
        id++,
        "If ‘+’ means ×, ‘×’ means −, ‘−’ means ÷ and ‘÷’ means +, then 8 + 2 − 4 × 3 = ?",
        ["1", "4", "7", "13"],
        0,
        L
      )
    );
    // 8×2 ÷4 −3 = 16/4 −3 = 4−3=1

    // Blood relation simple
    items.push(
      Q(
        id++,
        "Pointing to a boy, Riya says, “He is the son of my grandfather’s only son.” The boy is Riya’s:",
        ["Brother", "Uncle", "Cousin", "Father"],
        0,
        L
      )
    );

    // Series letters
    items.push(
      Q(
        id++,
        "Find the next letters: AZ, BY, CX, __.",
        ["DW", "DV", "EW", "DU"],
        0,
        L
      )
    );

    // Dice / cube faces abstract
    items.push(
      Q(
        id++,
        "A cube has how many edges?",
        ["12", "6", "8", "10"],
        0,
        L
      )
    );
  }

  if (items.length !== 15) throw new Error("Math LR count " + items.length);

  // —— Mathematical Reasoning 20×1 ——
  {
    // 1 place value
    const n1 = [456789, 352104, 510246, 125670, 905432][p - 1];
    const s = String(n1);
    const pos = s.indexOf("5");
    const pv = 5 * Math.pow(10, s.length - 1 - pos);
    let o = numOpts(pv, id, [pv / 5, pv * 10, 5, 50].map(Number));
    items.push(Q(id++, `The place value of digit 5 in ${n1} is:`, o.options, o.ans, M));

    // 2 integers
    const x = 12 + p;
    const y = 5 + p;
    o = numOpts(x - y, id, [1, -1, 2, x + y]);
    items.push(Q(id++, `Evaluate: (${x}) + (−${y}) = ?`, o.options, o.ans, M));

    // 3 integers product
    o = numOpts((-3 - p) * (4 + p), id, [3, -3, 5, 12]);
    items.push(
      Q(id++, `What is (−${3 + p}) × (${4 + p})?`, o.options, o.ans, M)
    );

    // 4 fractions add
    // 2/3 + 1/6 = 5/6
    items.push(
      Q(id++, `Simplify: \\( \\dfrac{2}{3} + \\dfrac{1}{6} \\)`, ["5/6", "3/9", "1/2", "2/6"], 0, M)
    );

    // 5 ratio
    const r1 = 2 + p;
    const r2 = 3 + p;
    const total = (r1 + r2) * (5 + p);
    const part = (total * r1) / (r1 + r2);
    o = numOpts(part, id, [r1, r2, total, -r1]);
    items.push(
      Q(
        id++,
        `Divide ${total} in the ratio ${r1}:${r2}. The first part is:`,
        o.options,
        o.ans,
        M
      )
    );

    // 6 proportion
    items.push(
      Q(
        id++,
        "If 4 : 5 = 12 : x, then x = ?",
        ["15", "16", "10", "20"],
        0,
        M
      )
    );

    // 7 simple equation
    const k = 5 + p;
    o = numOpts((18 + p - 3) / 1, id, [1, 2, -1, 4]); // wait
    // x + 7 = 20+p → x = 13+p
    o = numOpts(13 + p, id, [2, -2, 5, 7]);
    items.push(Q(id++, `If x + 7 = ${20 + p}, then x = ?`, o.options, o.ans, M));

    // 8 3x = 24+3p
    const rhs = 24 + 3 * p;
    o = numOpts(rhs / 3, id, [1, -1, 2, 4]);
    items.push(Q(id++, `Solve: 3x = ${rhs}`, o.options, o.ans, M));

    // 9 angles on straight line
    const ang = 40 + p * 5;
    o = numOpts(180 - ang, id, [10, -10, 20, ang]);
    items.push(
      Q(
        id++,
        `Two angles form a linear pair. If one is ${ang}°, the other is:`,
        o.options,
        o.ans,
        M
      )
    );

    // 10 triangle angle sum
    const a1 = 50 + p;
    const a2 = 60 + p;
    o = numOpts(180 - a1 - a2, id, [5, -5, 10, 15]);
    items.push(
      Q(
        id++,
        `In a triangle, two angles are ${a1}° and ${a2}°. The third angle is:`,
        o.options,
        o.ans,
        M
      )
    );

    // 11 perimeter rectangle
    const L1 = 12 + p;
    const W1 = 7 + p;
    o = numOpts(2 * (L1 + W1), id, [L1 + W1, L1 * W1, -2, 4]);
    items.push(
      Q(
        id++,
        `Perimeter of a rectangle of length ${L1} cm and breadth ${W1} cm is:`,
        o.options,
        o.ans,
        M
      )
    );

    // 12 area square
    const side = 9 + p;
    o = numOpts(side * side, id, [side * 4, side, -side, 2 * side]);
    items.push(
      Q(id++, `Area of a square of side ${side} cm is:`, o.options, o.ans, M)
    );

    // 13 area triangle
    const base = 10 + 2 * p;
    const ht = 8 + p;
    o = numOpts((base * ht) / 2, id, [base * ht, base + ht, 2, -4]);
    items.push(
      Q(
        id++,
        `Area of a triangle with base ${base} cm and height ${ht} cm is:`,
        o.options,
        o.ans,
        M
      )
    );

    // 14 HCF via gcd
    const u = 36 + 6 * p;
    const v = 24 + 6 * p;
    const g = gcd(u, v);
    o = numOpts(g, id, [2, 3, -1, 12]);
    items.push(Q(id++, `HCF of ${u} and ${v} is:`, o.options, o.ans, M));

    // 15 LCM
    const u2 = 8 + 2 * p;
    const v2 = 12 + 2 * p;
    const l = (u2 * v2) / gcd(u2, v2);
    o = numOpts(l, id, [u2, v2, gcd(u2, v2), -2]);
    items.push(Q(id++, `LCM of ${u2} and ${v2} is:`, o.options, o.ans, M));

    // 16 percentage intro
    const val = 200 + 50 * p;
    o = numOpts((val * 15) / 100, id, [15, val, 10, -5]);
    items.push(Q(id++, `15% of ${val} is:`, o.options, o.ans, M));

    // 17 mean
    const nums = [4 + p, 6 + p, 8 + p, 10 + p];
    const mean = nums.reduce((s, x) => s + x, 0) / nums.length;
    o = numOpts(mean, id, [1, -1, 2, nums[0]]);
    items.push(
      Q(
        id++,
        `The mean of ${nums.join(", ")} is:`,
        o.options,
        o.ans,
        M
      )
    );

    // 18 types of angles
    items.push(
      Q(
        id++,
        "An angle measuring 90° is called a:",
        ["Right angle", "Acute angle", "Obtuse angle", "Reflex angle"],
        0,
        M
      )
    );

    // 19 algebra expression
    items.push(
      Q(
        id++,
        `The algebraic expression for “5 more than twice a number x” is:`,
        ["2x + 5", "5x + 2", "2x − 5", "x + 10"],
        0,
        M
      )
    );

    // 20 decimals multiply
    items.push(
      Q(
        id++,
        `0.${2 + p} × 10 = ?`,
        [String(2 + p), String((2 + p) / 10), String((2 + p) * 10), String((2 + p) / 100)],
        0,
        M
      )
    );
  }
  // ensure exactly 20 MR (ids 16–35)

  if (items.length !== 35) throw new Error("Math before Achievers " + items.length);

  // —— Achievers 5×3 ——
  {
    // HOTS 1: multi-step integers
    let o = numOpts(-18 + p * 0, id, [2, -2, 6, 9]);
    // (−6)×(−3)+(−4)×3 = 18 − 12 = 6 — use p-variant
    const t = (-5 - p) * (3) + (2 + p) * (-4);
    // (-5-p)*3 + (2+p)*(-4) = -15-3p -8 -4p = -23 -7p
    o = numOpts(-23 - 7 * p, id, [5, -5, 10, 7]);
    items.push(
      Q(
        id++,
        `Evaluate: (−${5 + p}) × 3 + (${2 + p}) × (−4)`,
        o.options,
        o.ans,
        A,
        3
      )
    );

    // HOTS 2: fraction of remainder
    // A tank 3/4 full. After using 1/3 of content, fraction full = 3/4 * 2/3 = 1/2
    items.push(
      Q(
        id++,
        "A tank is 3/4 full of water. After using 1/3 of the water in it, the tank is what fraction full?",
        ["1/2", "1/4", "2/3", "1/3"],
        0,
        A,
        3
      )
    );

    // HOTS 3: perimeter & area — choose values so breadth is integer
    // L = B + d, 2(L+B)=P → 2B+d = P/2 → B = (P/2 - d)/2
    const d = 4 + p;
    const B = 8 + p; // integer breadth
    const Len = B + d;
    const Pp = 2 * (Len + B);
    const area = Len * B;
    o = numOpts(area, id, [Pp, Len + B, 10, -10]);
    items.push(
      Q(
        id++,
        `A rectangle has perimeter ${Pp} cm and length is ${d} cm more than breadth. Its area is:`,
        o.options,
        o.ans,
        A,
        3
      )
    );

    // HOTS 4: ratio ages / proportion word
    // 3:5, sum 40+8p → parts
    const sumR = 40 + 8 * p;
    const part3 = (sumR * 3) / 8;
    o = numOpts(part3, id, [5, 3, sumR / 2, -3]);
    items.push(
      Q(
        id++,
        `Two numbers are in ratio 3 : 5 and their sum is ${sumR}. The smaller number is:`,
        o.options,
        o.ans,
        A,
        3
      )
    );

    // HOTS 5: data + algebra
    // mean of 5 numbers is 12+p; if one number 18+p is removed, new mean?
    // sum = 5*(12+p); new sum = 5*(12+p)-(18+p); mean of 4 = that/4
    const mean0 = 12 + p;
    const removed = 18 + p;
    const newMean = (5 * mean0 - removed) / 4;
    o = numOpts(newMean, id, [mean0, removed, 1, -1]);
    items.push(
      Q(
        id++,
        `The mean of 5 numbers is ${mean0}. If the number ${removed} is removed, the mean of the remaining numbers is:`,
        o.options,
        o.ans,
        A,
        3
      )
    );
  }

  if (items.length !== 40) throw new Error("Math total " + items.length);
  return pack(items);
}

// ═══════════════════════════════════════════════════════════
// SCIENCE — 50Q / 60 marks
// ═══════════════════════════════════════════════════════════
function buildScience(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const L = "Logical Reasoning";
  const S = "Science";
  const A = "Achievers Section";

  // LR 10
  {
    items.push(
      Q(id++, `Find the next: 5, 10, 20, 40, __.`, ["80", "60", "50", "70"], 0, L)
    );
    items.push(
      Q(
        id++,
        "Odd one out: Photosynthesis, Respiration, Digestion, Evaporation",
        ["Evaporation", "Photosynthesis", "Respiration", "Digestion"],
        0,
        L
      )
    );
    items.push(
      Q(id++, "Analogy: Leaf : Photosynthesis :: Root : ?", ["Absorption", "Transpiration", "Flowering", "Pollination"], 0, L)
    );
    items.push(
      Q(
        id++,
        "If ‘Plant’ is related to ‘Chlorophyll’, then ‘Blood’ is related to:",
        ["Haemoglobin", "Starch", "Cellulose", "Chloroplast"],
        0,
        L
      )
    );
    items.push(
      Q(
        id++,
        "Which does not belong: Mercury, Venus, Mars, Moon",
        ["Moon", "Mercury", "Venus", "Mars"],
        0,
        L
      )
    );
    items.push(
      Q(id++, "Series: 2, 6, 12, 20, 30, __.", ["42", "36", "40", "32"], 0, L)
    );
    items.push(
      Q(
        id++,
        "A is taller than B but shorter than C. D is shorter than B. Who is tallest?",
        ["C", "A", "B", "D"],
        0,
        L
      )
    );
    items.push(
      Q(
        id++,
        "If all flowers are plants and some plants are green, which is true?",
        ["Some flowers may be green", "No flower is a plant", "All green things are flowers", "All plants are flowers"],
        0,
        L
      )
    );
    items.push(
      Q(
        id++,
        "Mirror image pattern: which letter looks the same in a vertical mirror?",
        ["A", "B", "C", "F"],
        0,
        L
      )
    );
    items.push(
      Q(
        id++,
        `In a certain code, WATER is written as XBUFS. Then LIGHT is written as:`,
        ["MJHIU", "KHGFS", "MHHIU", "MJGIU"],
        0,
        L
      )
    );
  }

  // Science 35 — Class 6 NCERT-aligned banks rotated by paper
  const sciCore = [
    ["The process by which green plants make food is called:", ["Photosynthesis", "Respiration", "Transpiration", "Germination"], 0],
    ["The green pigment in leaves is:", ["Chlorophyll", "Haemoglobin", "Melanin", "Carotene only"], 0],
    ["Which gas is released by plants during photosynthesis?", ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], 0],
    ["Animals that eat only plants are called:", ["Herbivores", "Carnivores", "Omnivores", "Parasites"], 0],
    ["Vitamin C deficiency causes:", ["Scurvy", "Rickets", "Night blindness", "Anaemia only"], 0],
    ["Which nutrient mainly gives us energy?", ["Carbohydrates", "Vitamins", "Water", "Minerals only"], 0],
    ["Roughage in our diet is important because it:", ["Helps in bowel movement", "Builds muscles only", "Is a vitamin", "Replaces water"], 0],
    ["Cotton is obtained from:", ["Cotton plant", "Silkworm", "Sheep", "Jute only as stem fibre for cotton"], 0],
    ["Silk is obtained from:", ["Silkworm", "Cotton plant", "Flax", "Sheep"], 0],
    ["Materials that allow light to pass through them completely are:", ["Transparent", "Opaque", "Translucent", "Lustrous only"], 0],
    ["Which of the following is soluble in water?", ["Salt", "Sand", "Sawdust", "Chalk powder"], 0],
    ["The process of conversion of water vapour into liquid water is:", ["Condensation", "Evaporation", "Sublimation", "Melting"], 0],
    ["Separation of tea leaves from tea using a strainer is:", ["Filtration", "Sedimentation", "Distillation", "Chromatography"], 0],
    ["A change that cannot be easily reversed is:", ["Burning of paper", "Melting of ice", "Stretching a rubber band", "Folding paper"], 0],
    ["Which is a chemical change?", ["Rusting of iron", "Melting of wax", "Tearing of paper", "Dissolving sugar"], 0],
    ["The joint in the skull that does not allow movement is a:", ["Fixed joint", "Ball and socket", "Hinge joint", "Pivot joint"], 0],
    ["The bone that protects the brain is the:", ["Skull", "Rib cage", "Pelvis", "Femur"], 0],
    ["Earthworms move using:", ["Muscles and bristles", "Wings", "Fins only", "Legs with joints like humans"], 0],
    ["The SI unit of length is:", ["Metre", "Centimetre", "Kilometre", "Inch"], 0],
    ["A body is said to be in motion if it:", ["Changes position with time", "Remains at rest", "Has mass only", "Is heavy"], 0],
    ["Shadows are formed because light:", ["Travels in straight lines", "Bends around all objects always", "Has no speed", "Is a form of sound"], 0],
    ["An opaque object forms a:", ["Dark shadow", "No shadow ever", "Transparent image only", "Coloured rainbow always"], 0],
    ["A mirror that can form a real inverted image of the sun (burning paper) is a:", ["Concave mirror", "Plane mirror", "Convex mirror", "Rough metal sheet"], 0],
    ["Electric current is the flow of:", ["Charges", "Only heat", "Only light", "Only sound"], 0],
    ["Which material is a good conductor of electricity?", ["Copper", "Rubber", "Plastic", "Dry wood"], 0],
    ["In an electric circuit, a switch is used to:", ["Open or close the circuit", "Increase mass of wire", "Produce food", "Measure temperature only"], 0],
    ["The layer of air around the Earth is called:", ["Atmosphere", "Hydrosphere", "Lithosphere", "Biosphere only"], 0],
    ["About how much of the Earth’s surface is covered with water?", ["About three-fourths", "About one-fourth", "Exactly half", "Almost none"], 0],
    ["Rainwater harvesting helps in:", ["Recharging groundwater", "Increasing air pollution", "Destroying soil only", "Stopping photosynthesis"], 0],
    ["Biodegradable waste includes:", ["Vegetable peels", "Plastic bottles", "Glass jars", "Metal cans"], 0],
    ["Which of these is a non-biodegradable waste?", ["Plastic bag", "Fruit peels", "Paper (usually)", "Leftover food"], 0],
    ["Stomata in leaves help mainly in:", ["Exchange of gases", "Absorbing minerals from soil", "Transporting food to roots only", "Producing seeds"], 0],
    ["The process of loss of water from aerial parts of a plant is:", ["Transpiration", "Photosynthesis", "Pollination", "Fertilisation"], 0],
    ["Which vitamin is produced in the skin in sunlight?", ["Vitamin D", "Vitamin C", "Vitamin B12 only", "Vitamin K only"], 0],
    ["A balanced diet should contain:", ["Carbohydrates, proteins, fats, vitamins, minerals, water and roughage", "Only carbohydrates", "Only proteins and fats", "Only vitamins"], 0],
    ["Magnetism: the ends of a magnet are called:", ["Poles", "Equators", "Nodes", "Fuses"], 0],
    ["Which planet is known as the Red Planet?", ["Mars", "Venus", "Jupiter", "Saturn"], 0],
    ["The boiling point of pure water at standard pressure is:", ["100°C", "0°C", "50°C", "37°C"], 0],
    ["Oxygen is necessary for:", ["Respiration in most living organisms", "Only photosynthesis", "Only rusting and nothing else", "Making plastic only"], 0],
    ["Which component of food is needed for body building and repair?", ["Proteins", "Fats only", "Sugars only", "Roughage only"], 0],
  ];

  // Take 35 unique by offset per paper
  for (let i = 0; i < 35; i++) {
    const row = sciCore[(i + (p - 1) * 3) % sciCore.length];
    const opts = row[1].slice();
    const ans = row[2];
    // light rotate options
    const shift = (p + i) % 4;
    const rot = [0, 1, 2, 3].map((j) => opts[(j + shift) % 4]);
    const newAns = rot.indexOf(opts[ans]);
    items.push(Q(id++, row[0], rot, newAns, S));
  }

  // Achievers 5×3 HOTS
  const achSci = [
    [
      "A plant is kept in dark for 48 hours, then one leaf is tested for starch. The result is usually negative because:",
      [
        "Photosynthesis did not occur without light, so starch was not made (and stored starch may be used up)",
        "Roots stop absorbing water in dark always",
        "Chlorophyll becomes protein in dark",
        "Plants do not have starch ever",
      ],
      0,
    ],
    [
      "Two identical cups of hot water are left: one covered, one open. The open cup cools faster mainly due to:",
      ["Greater evaporation and heat loss", "Photosynthesis", "Magnetic field of Earth", "Only sound energy"],
      0,
    ],
    [
      "In a simple circuit, bulb does not glow though cells are fresh. A possible reason is:",
      ["The circuit is open or a wire is broken / poor connection", "Air has oxygen", "Bulb glass is transparent", "Copper is a conductor"],
      0,
    ],
    [
      "Why is a diet with only rice for many weeks unhealthy for a growing child?",
      [
        "It lacks adequate proteins, vitamins and minerals needed for growth",
        "Rice has no carbohydrates",
        "Rice is non-biodegradable",
        "Rice blocks sunlight",
      ],
      0,
    ],
    [
      "Separating cream from milk by churning works because of difference in:",
      ["Density of components", "Colour only", "Magnetic properties", "Boiling points only of metals"],
      0,
    ],
  ];
  for (let i = 0; i < 5; i++) {
    const row = achSci[(i + p) % achSci.length];
    const opts = row[1].slice();
    const shift = (p + i * 2) % 4;
    const rot = [0, 1, 2, 3].map((j) => opts[(j + shift) % 4]);
    items.push(Q(id++, row[0], rot, rot.indexOf(opts[row[2]]), A, 3));
  }

  if (items.length !== 50) throw new Error("Science total " + items.length);
  return pack(items);
}

// ═══════════════════════════════════════════════════════════
// ENGLISH — 60Q / 60 marks
// ═══════════════════════════════════════════════════════════
function buildEnglish(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const W = "Word and Structure Knowledge";
  const R = "Reading";
  const S = "Spoken and Written Expression";

  const wsk = [
    ["Choose the correct article: He is ___ honest man.", ["an", "a", "the", "no article"], 0],
    ["Choose the correct article: ___ Amazon is a long river.", ["The", "A", "An", "No article"], 0],
    ["Fill in: She ___ to school every day.", ["goes", "go", "going", "gone"], 0],
    ["Fill in: They ___ playing cricket now.", ["are", "is", "was", "be"], 0],
    ["Past tense of ‘teach’ is:", ["taught", "teached", "teach", "teaching"], 0],
    ["Past participle of ‘begin’ is:", ["begun", "began", "begin", "beginning"], 0],
    ["Choose the correct passive: They built a bridge. → A bridge ___ by them.", ["was built", "built", "is building", "was building"], 0],
    ["Reported speech: He said, “I am tired.” → He said that he ___ tired.", ["was", "is", "were", "am"], 0],
    ["Choose the correct form: If it rains, we ___ indoors.", ["will stay", "stayed", "staying", "stay will"], 0],
    ["Identify the adjective: The brave soldier fought well.", ["brave", "soldier", "fought", "well"], 0],
    ["Identify the adverb: She spoke softly.", ["softly", "She", "spoke", "None"], 0],
    ["Synonym of ‘ancient’ is:", ["old", "new", "tiny", "rapid"], 0],
    ["Antonym of ‘expand’ is:", ["contract", "enlarge", "grow", "widen"], 0],
    ["Choose the correct preposition: The cat is hiding ___ the table.", ["under", "in on", "between of", "since"], 0],
    ["Choose the correct preposition: He has lived here ___ 2018.", ["since", "for", "from at", "on"], 0],
    ["Fill: Neither the teacher ___ the students were late.", ["nor", "or", "and", "but"], 0],
    ["Fill: I prefer tea ___ coffee.", ["to", "than", "from", "by"], 0],
    ["Comparative of ‘beautiful’ is:", ["more beautiful", "beautifuler", "most beautiful", "beautifullest"], 0],
    ["Superlative of ‘good’ is:", ["best", "better", "goodest", "more good"], 0],
    ["Choose correct: One of my friends ___ a doctor.", ["is", "are", "were", "be"], 0],
    ["Choose correct: The news ___ shocking.", ["is", "are", "were", "have"], 0],
    ["Plural of ‘crisis’ is:", ["crises", "crisises", "crisis", "crisi"], 0],
    ["Plural of ‘child’ is:", ["children", "childs", "childes", "childern"], 0],
    ["A person who writes poems is a:", ["poet", "painter", "pilot", "plumber"], 0],
    ["Homophone of ‘allowed’ is:", ["aloud", "along", "alone", "aloudly"], 0],
    ["Choose correctly spelled word:", ["Accommodation", "Acommodation", "Accomodation", "Acomodation"], 0],
    ["Prefix meaning ‘against’ in ‘anti-social’ is:", ["anti-", "un-", "re-", "pre-"], 0],
    ["Suffix in ‘happiness’ is:", ["-ness", "happy", "-ly", "-ful"], 0],
    ["Idiom: ‘Break the ice’ means:", ["Start a conversation", "Break glass", "Feel cold", "Stop talking forever"], 0],
    ["Choose the abstract noun:", ["bravery", "soldier", "sword", "battlefield"], 0],
    ["Choose the collective noun: a ___ of sheep.", ["flock", "herd of lions", "swarm of sheep", "pack only of cards"], 0],
    ["Which is an interrogative sentence?", ["Have you finished your work?", "Finish your work.", "What a finish!", "You finished."], 0],
    ["Which is an imperative sentence?", ["Please close the door.", "The door is closed.", "Is the door closed?", "What a door!"], 0],
    ["Identify the conjunction: She ran fast but missed the bus.", ["but", "She", "fast", "bus"], 0],
    ["Fill: There is hardly ___ milk left.", ["any", "some", "many", "few"], 0],
    ["Fill: How ___ sugar do you need?", ["much", "many", "few", "a few"], 0],
    ["Choose correct question tag: She can swim, ___?", ["can't she", "can she", "isn't she", "doesn't she"], 0],
    ["Choose correct: I look forward to ___ you.", ["meeting", "meet", "met", "meets"], 0],
    ["Voice: Open the window. (passive sense / imperative passive)", ["Let the window be opened.", "The window opened.", "Window is open by.", "Opens the window."], 0],
    ["Clause: I know that he is honest. The underlined type is a:", ["Noun clause", "Only adjective", "Only adverb of time", "Preposition"], 0],
    ["Choose correct tense: By next year, she ___ her course.", ["will have completed", "completed", "completing", "complete"], 0],
    ["Choose the correct word: A ___ of bees.", ["swarm", "herd", "flock of bees wrong", "pack"], 0],
    ["Antonym of ‘scarce’ is:", ["plentiful", "rare", "little", "short"], 0],
    ["Synonym of ‘rapid’ is:", ["quick", "slow", "lazy", "dull"], 0],
    ["Choose correct: Each of the boys ___ given a prize.", ["was", "were", "are", "have"], 0],
    ["Fill: She is good ___ mathematics.", ["at", "in on", "with of", "from"], 0],
    ["Choose the correct order: He / a letter / wrote / yesterday", ["He wrote a letter yesterday.", "Wrote he a letter yesterday.", "He a letter wrote yesterday.", "Yesterday wrote he letter a."], 0],
    ["Phobia of water is called:", ["hydrophobia", "claustrophobia", "acrophobia", "bibliophobia"], 0],
    ["Choose correct: The jury ___ divided in their opinions.", ["were", "was only always", "is been", "be"], 0],
    ["Identify figure: ‘The wind whispered through the trees.’", ["Personification", "Only simile", "Only metaphor of fire", "Hyperbole of numbers"], 0],
  ];

  for (let i = 0; i < 45; i++) {
    const row = wsk[(i + (p - 1) * 2) % wsk.length];
    const opts = row[1].slice();
    const shift = (p + i) % 4;
    const rot = [0, 1, 2, 3].map((j) => opts[(j + shift) % 4]);
    // ensure unique after rotate
    if (new Set(rot).size !== 4) {
      items.push(Q(id++, row[0], opts, row[2], W));
    } else {
      items.push(Q(id++, row[0], rot, rot.indexOf(opts[row[2]]), W));
    }
  }

  // Reading 10 — short passages with questions (paper-varied)
  const passages = [
    {
      intro:
        "Read the passage: Forests are called the lungs of the Earth because trees release oxygen and absorb carbon dioxide. They also prevent soil erosion and provide habitat for wildlife. Cutting forests without planting new trees harms the climate and living beings.",
      qs: [
        ["According to the passage, forests are called the lungs of the Earth because trees:", ["release oxygen and absorb carbon dioxide", "only provide wood", "increase soil erosion", "stop rainfall forever"], 0],
        ["One benefit of forests mentioned is that they:", ["prevent soil erosion", "produce only plastic", "remove all animals", "stop the water cycle completely"], 0],
        ["Cutting forests without replanting can:", ["harm the climate and living beings", "always improve climate", "only help wildlife", "have no effect"], 0],
        ["The main idea of the passage is about:", ["importance of forests", "how to build roads", "types of deserts", "ocean currents only"], 0],
        ["Wildlife depends on forests mainly for:", ["habitat", "airplanes", "computers", "metal tools only"], 0],
      ],
    },
    {
      intro:
        "Read the passage: Ravi wanted to learn swimming. At first he was afraid of water, but his coach encouraged him to practise daily. After a month, he could float and swim short distances. He realised that patience and regular effort lead to success.",
      qs: [
        ["At first, Ravi was:", ["afraid of water", "a swimming champion", "unwilling to try ever", "the coach"], 0],
        ["Who encouraged Ravi?", ["His coach", "A stranger only", "No one", "A fish"], 0],
        ["After a month, Ravi could:", ["float and swim short distances", "only sit on the bank", "stop practising", "teach diving only to sharks"], 0],
        ["The passage teaches that success needs:", ["patience and regular effort", "only luck", "fear only", "giving up quickly"], 0],
        ["The word ‘practise’ in the passage is closest in meaning to:", ["train regularly", "quit", "ignore", "forget"], 0],
      ],
    },
  ];
  const pass = passages[(p - 1) % passages.length];
  // attach intro to first reading Q only for context
  for (let i = 0; i < 5; i++) {
    const row = pass.qs[i];
    const qtext = i === 0 ? `${pass.intro}\n\n${row[0]}` : row[0];
    const opts = row[1].slice();
    items.push(Q(id++, qtext, opts, row[2], R));
  }

  // Second micro-passage for remaining 5 reading Q
  const pass2 = {
    intro:
      p % 2 === 1
        ? "Read: Bees are important pollinators. As they collect nectar, pollen sticks to their bodies and is carried to other flowers. Without pollination, many fruits and seeds would not form."
        : "Read: Libraries are quiet places where people read and borrow books. A library card allows members to take books home for a limited time. Returning books on time helps others enjoy them too.",
    qs:
      p % 2 === 1
        ? [
            ["Bees help plants mainly by:", ["pollination", "cutting leaves only", "blocking sunlight", "eating only roots"], 0],
            ["Pollen is carried when bees:", ["collect nectar", "sleep only", "avoid flowers", "swim"], 0],
            ["Without pollination, many fruits would:", ["not form", "grow faster always", "turn into metal", "need no water ever"], 0],
            ["The passage presents bees as:", ["important pollinators", "harmful to all plants", "only honey thieves", "desert animals only"], 0],
            ["A suitable title could be:", ["Bees and Pollination", "Ocean Waves", "Types of Rocks", "Computer Hardware"], 0],
          ]
        : [
            ["A library is mainly a place to:", ["read and borrow books", "play loud music", "cook food", "park cars only"], 0],
            ["A library card allows members to:", ["borrow books for a limited time", "own the library", "never return books", "print money"], 0],
            ["Returning books on time:", ["helps others enjoy them too", "is unnecessary", "destroys books", "closes the library"], 0],
            ["Libraries are described as:", ["quiet places", "noisy markets", "sports stadiums", "airports"], 0],
            ["The tone of the passage is:", ["informative", "angry only", "purely fictional horror", "advertising junk food"], 0],
          ],
  };
  for (let i = 0; i < 5; i++) {
    const row = pass2.qs[i];
    const qtext = i === 0 ? `${pass2.intro}\n\n${row[0]}` : row[0];
    items.push(Q(id++, qtext, row[1].slice(), row[2], R));
  }

  // SWE 5
  const swe = [
    [
      "Choose the most suitable sentence to complete: “Thank you for your help.” — “___”",
      ["You're welcome.", "I don't know you.", "Close the window.", "What is your age?"],
      0,
    ],
    [
      "Choose the best opening for a formal email to a teacher:",
      ["Respected Sir/Madam,", "Hey buddy!", "Yo!", "What's up?"],
      0,
    ],
    [
      "A notice should mainly be:",
      ["Brief, clear and include key details (what, when, where)", "A long story with no date", "Only personal secrets", "Written without a heading"],
      0,
    ],
    [
      "Choose the polite request:",
      ["Could you please pass the book?", "Give book now!", "You must pass immediately without please.", "Book. Pass."],
      0,
    ],
    [
      "Best closing for a letter to a friend:",
      ["Yours lovingly,", "Yours obediently, only for court", "Respected Sir ending only", "Subject: Bill payment"],
      0,
    ],
  ];
  for (let i = 0; i < 5; i++) {
    const row = swe[(i + p) % swe.length];
    const opts = row[1].slice();
    const shift = (p + i) % 4;
    const rot = [0, 1, 2, 3].map((j) => opts[(j + shift) % 4]);
    if (new Set(rot).size !== 4) items.push(Q(id++, row[0], opts, row[2], S));
    else items.push(Q(id++, row[0], rot, rot.indexOf(opts[row[2]]), S));
  }

  if (items.length !== 60) throw new Error("English total " + items.length);
  return pack(items);
}

// ═══════════════════════════════════════════════════════════
// COMPUTER — 50Q / 60 marks
// ═══════════════════════════════════════════════════════════
function buildComputer(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const L = "Logical Reasoning";
  const C = "Computers and IT";
  const A = "Achievers Section";

  // LR 10
  const lrC = [
    ["Find the next: 1, 2, 4, 8, 16, __.", ["32", "24", "20", "18"], 0],
    ["Odd one out: Keyboard, Mouse, Monitor, Chair", ["Chair", "Keyboard", "Mouse", "Monitor"], 0],
    ["Analogy: Input : Keyboard :: Output : ?", ["Monitor", "CPU only as input", "MIC always input", "Scanner only"], 0],
    ["If CPU = 321 (reverse letter positions loosely), simpler: which comes next AB, BC, CD, __?", ["DE", "EF", "FG", "DD"], 0],
    ["A is used before B, B before C in a queue. Who is processed first?", ["A", "B", "C", "None"], 0],
    ["Number of bits in a byte:", ["8", "2", "16", "4"], 0],
    ["Series: 3, 6, 11, 18, 27, __.", ["38", "36", "30", "32"], 0],
    ["If ‘@’ means addition and ‘#’ means subtraction, 9 @ 4 # 3 = ?", ["10", "16", "1", "7"], 0],
    ["Mirror letter that looks similar: which of these?", ["H", "L", "P", "R"], 0],
    ["Coding: if FILE is GJMF, then CODE is:", ["DPEF", "BNCD", "DPEE", "CPEF"], 0],
  ];
  for (let i = 0; i < 10; i++) {
    const row = lrC[(i + p - 1) % lrC.length];
    const opts = row[1].slice();
    const shift = (p + i) % 4;
    const rot = [0, 1, 2, 3].map((j) => opts[(j + shift) % 4]);
    if (new Set(rot).size !== 4) items.push(Q(id++, row[0], opts, row[2], L));
    else items.push(Q(id++, row[0], rot, rot.indexOf(opts[row[2]]), L));
  }

  const it = [
    ["CPU stands for:", ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Control Process User"], 0],
    ["Which is an input device?", ["Keyboard", "Monitor", "Speaker", "Printer"], 0],
    ["Which is an output device?", ["Printer", "Mouse", "Scanner", "Microphone"], 0],
    ["RAM is a type of:", ["Volatile memory", "Permanent paper storage", "Only output device", "Network cable"], 0],
    ["ROM stands for:", ["Read Only Memory", "Random Open Memory", "Run On Module", "Ready Output Machine"], 0],
    ["The brain of the computer is the:", ["CPU", "Monitor", "Keyboard", "UPS"], 0],
    ["Software that manages hardware and provides user interface is:", ["Operating system", "Compiler only", "Browser only", "Antivirus only"], 0],
    ["MS Word is mainly used for:", ["Word processing", "Only calculations", "Only drawing circuits", "Only playing songs"], 0],
    ["MS Excel is mainly used for:", ["Spreadsheets and calculations", "Only email", "Only video editing", "Only painting"], 0],
    ["A collection of slides is typically created in:", ["PowerPoint", "Notepad only", "Calculator", "Command Prompt only"], 0],
    ["Which key combination commonly copies selected text in Windows?", ["Ctrl + C", "Ctrl + V", "Ctrl + X", "Ctrl + Z"], 0],
    ["Which key combination commonly pastes in Windows?", ["Ctrl + V", "Ctrl + C", "Alt + F4", "Ctrl + S"], 0],
    ["To undo the last action, we often use:", ["Ctrl + Z", "Ctrl + Y only always", "Ctrl + P", "Ctrl + N"], 0],
    ["A URL is used to:", ["Locate a resource on the web", "Print only", "Cool the CPU", "Charge the battery"], 0],
    ["HTTP is a protocol used mainly for:", ["Web communication", "Only printing", "Only sound recording", "Cooling fans"], 0],
    ["An email address must contain:", ["@ symbol", "Only spaces", "Only #", "No letters"], 0],
    ["Which is a strong password practice?", ["Long mix of letters, numbers and symbols", "Your name only", "12345", "password"], 0],
    ["Do not share your passwords because:", ["It risks unauthorised access", "Passwords never matter", "Teachers require public passwords", "Internet has no risks"], 0],
    ["A computer network is:", ["A group of interconnected computers", "A single offline calculator", "Only one printer", "A type of virus"], 0],
    ["LAN usually covers a:", ["Small local area like a building", "The entire planet only", "Only satellites", "Only underwater cables exclusively"], 0],
    ["Which storage is typically largest in capacity among these for home PCs?", ["Hard disk / SSD", "CPU register", "Cache only", "A single floppy historically small"], 0],
    ["A byte is equal to:", ["8 bits", "2 bits", "16 bytes", "1 nibble only as byte"], 0],
    ["Which is application software?", ["Web browser", "Device driver only always", "BIOS only", "Motherboard"], 0],
    ["Scratch is mainly used to learn:", ["Block-based coding / programming basics", "Only cooking", "Only gardening", "Car repair"], 0],
    ["In coding, a loop is used to:", ["Repeat a set of instructions", "Delete the OS", "Only change wallpaper", "Stop electricity"], 0],
    ["An algorithm is:", ["A step-by-step solution method", "A hardware chip only", "A type of mouse", "A virus name only"], 0],
    ["Phishing emails try to:", ["Trick users into revealing personal information", "Cool the laptop", "Increase RAM automatically", "Print documents"], 0],
    ["Firewall in computing helps to:", ["Control network traffic and improve security", "Cook food", "Water plants", "Replace the monitor"], 0],
    ["Which file extension is common for Word documents?", [".docx", ".mp3", ".exe only always", ".jpg only"], 0],
    ["Which is an image file type?", [".png", ".docx", ".xlsx", ".txt only"], 0],
    ["Bluetooth is used for:", ["Short-range wireless communication", "Long-distance fibre only", "Only wired printing", "Cooling CPU"], 0],
    ["Wi-Fi allows devices to:", ["Connect to a network wirelessly", "Replace the battery forever", "Remove viruses by magic", "Increase desk size"], 0],
    ["The full form of IP in IP address is:", ["Internet Protocol", "Internal Program", "Input Process", "Instant Print"], 0],
    ["Backup of data means:", ["Keeping extra copies to prevent loss", "Deleting all files", "Sharing passwords", "Formatting without need"], 0],
    ["Which device is used to digitise paper documents?", ["Scanner", "Speaker", "Projector only", "Joystick only"], 0],
    ["UPS mainly provides:", ["Backup power during outage", "Unlimited internet", "Extra keyboard keys", "Cooling water"], 0],
    ["In Excel, a cell is identified by:", ["Column letter and row number", "Only colour", "Only font", "IP address"], 0],
    ["CC in email stands for:", ["Carbon Copy", "Computer Code", "Central Command", "Copy Cable"], 0],
    ["Which is system software?", ["Operating system", "MS Paint only", "A game only", "A movie file"], 0],
    ["Malware is:", ["Harmful software", "A type of healthy food", "A monitor brand only", "A printer ink"], 0],
  ];

  for (let i = 0; i < 35; i++) {
    const row = it[(i + (p - 1) * 4) % it.length];
    const opts = row[1].slice();
    const shift = (p + i) % 4;
    const rot = [0, 1, 2, 3].map((j) => opts[(j + shift) % 4]);
    if (new Set(rot).size !== 4) items.push(Q(id++, row[0], opts, row[2], C));
    else items.push(Q(id++, row[0], rot, rot.indexOf(opts[row[2]]), C));
  }

  const achC = [
    [
      "A student saves a project only in RAM and switches off the PC without saving to disk. What happens to the project?",
      ["It is lost because RAM is volatile", "It is permanently stored in ROM", "It prints automatically", "It emails itself"],
      0,
    ],
    [
      "Which arrangement is correct from fastest/smallest storage typically toward larger permanent store?",
      ["Cache → RAM → SSD/HDD", "HDD → Cache → RAM only reverse always wrong", "Printer → Scanner → CPU", "Monitor → Keyboard → Mouse"],
      0,
    ],
    [
      "You receive an email asking for your school login password to ‘verify account’. You should:",
      ["Not share the password; verify via official channels", "Reply with the password immediately", "Post password on social media", "Change nothing and ignore security forever"],
      0,
    ],
    [
      "In Scratch, a sprite moves forward 10 steps ten times. This is best done using:",
      ["A loop (repeat block)", "Ten different operating systems", "Only unplugging the mouse", "Deleting the project"],
      0,
    ],
    [
      "Why is a network password on home Wi-Fi important?",
      ["It helps prevent unauthorised users from using the network", "It increases the room temperature", "It replaces antivirus completely always", "It makes cables unnecessary for electricity"],
      0,
    ],
  ];
  for (let i = 0; i < 5; i++) {
    const row = achC[(i + p) % achC.length];
    const opts = row[1].slice();
    const shift = (p + i) % 4;
    const rot = [0, 1, 2, 3].map((j) => opts[(j + shift) % 4]);
    if (new Set(rot).size !== 4) items.push(Q(id++, row[0], opts, row[2], A, 3));
    else items.push(Q(id++, row[0], rot, rot.indexOf(opts[row[2]]), A, 3));
  }

  if (items.length !== 50) throw new Error("Computer total " + items.length);
  return pack(items);
}

// ═══════════════════════════════════════════════════════════
// GK — 50Q / 60 marks
// ═══════════════════════════════════════════════════════════
function buildGK(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const GA = "General Awareness";
  const CA = "Current Affairs";
  const LS = "Life Skills";
  const A = "Achievers Section";

  const ga = [
    ["The capital of India is:", ["New Delhi", "Mumbai", "Kolkata", "Chennai"], 0],
    ["The national animal of India is:", ["Tiger", "Lion", "Elephant", "Peacock"], 0],
    ["The national bird of India is:", ["Peacock", "Sparrow", "Eagle", "Parrot"], 0],
    ["The largest continent is:", ["Asia", "Africa", "Europe", "Australia"], 0],
    ["The longest river in the world is often considered:", ["Nile", "Yamuna", "Thames", "Seine"], 0],
    ["Mount Everest lies in the:", ["Himalayas", "Alps", "Andes only exclusively for Everest", "Rockies"], 0],
    ["The currency of Japan is:", ["Yen", "Dollar", "Euro", "Rupee"], 0],
    ["Who is known as the Father of the Nation in India?", ["Mahatma Gandhi", "Bhagat Singh only", "Ashoka only", "Akbar only"], 0],
    ["The first Prime Minister of independent India was:", ["Jawaharlal Nehru", "Sardar Patel only as PM", "Rajendra Prasad as PM", "Lal Bahadur Shastri first"], 0],
    ["The President of India is elected by an:", ["Electoral college", "Only village panchayat of one village", "Foreign kings", "Single court judge alone always"], 0],
    ["Which is the largest ocean?", ["Pacific Ocean", "Indian Ocean", "Arctic Ocean", "Atlantic is smaller than Pacific"], 0],
    ["The Sahara is a:", ["Desert", "Ocean", "Mountain range in Europe only", "River"], 0],
    ["Taj Mahal is situated in:", ["Agra", "Delhi", "Jaipur", "Mumbai"], 0],
    ["Which planet is closest to the Sun?", ["Mercury", "Earth", "Mars", "Jupiter"], 0],
    ["The gas essential for human respiration is:", ["Oxygen", "Nitrogen only for breathing humans", "Helium", "Neon"], 0],
    ["India’s national sport (commonly associated) / widely popular game historically linked in GK books often:", ["Hockey (traditionally associated)", "Only chess exclusive national", "Only golf", "Only polo of England alone"], 0],
    ["The Olympic Games are held every:", ["4 years", "1 year", "10 years", "20 years"], 0],
    ["Who invented the telephone (credited)?", ["Alexander Graham Bell", "Newton", "Einstein", "Wright brothers only for phone"], 0],
    ["The smallest bone in the human body is in the:", ["Ear", "Leg", "Arm", "Nose only"], 0],
    ["Which festival is known as the festival of lights?", ["Diwali", "Holi only", "Pongal only as lights", "Eid only as lights"], 0],
    ["The Constitution of India came into force on:", ["26 January 1950", "15 August 1947 as constitution day", "2 October 1950", "26 January 1947"], 0],
    ["Which is a classical dance of Tamil Nadu?", ["Bharatanatyam", "Kathak only of TN", "Bihu only", "Garba only"], 0],
    ["The Red Fort is in:", ["Delhi", "Mumbai", "Chennai", "Hyderabad"], 0],
    ["Which river is called the Ganga of the South (often)?", ["Godavari (often referred)", "Thames", "Nile", "Amazon"], 0],
    ["The polar satellite launch vehicle is associated with which Indian organisation?", ["ISRO", "WHO", "FIFA", "UNESCO only"], 0],
    ["Which vitamin is abundant in citrus fruits?", ["Vitamin C", "Vitamin D only", "Vitamin K only from oranges exclusive myth", "Vitamin B12 only in oranges"], 0],
    ["The hard outer covering of insects is called:", ["Exoskeleton", "Endoskeleton only for insects", "Fur", "Feathers"], 0],
    ["Which instrument measures temperature?", ["Thermometer", "Barometer only for temp", "Ammeter for temp", "Lactometer for air temp"], 0],
    ["The study of plants is called:", ["Botany", "Zoology", "Geology", "Astronomy"], 0],
    ["Which is the highest civilian award in India?", ["Bharat Ratna", "Padma Shri only as highest", "Nobel of India exclusive name", "Arjuna only highest civilian"], 0],
    ["The Great Wall is associated with:", ["China", "India", "Egypt", "Brazil"], 0],
    ["Which blood group is called universal donor (red cells, classic GK)?", ["O negative (classic)", "AB positive as universal donor classic", "B only", "A only"], 0],
    ["The author of the national anthem ‘Jana Gana Mana’ is:", ["Rabindranath Tagore", "Bankim Chandra only for anthem", "Sarojini Naidu for Jana Gana Mana", "Premchand"], 0],
    ["Which state is known as the ‘Spice Garden of India’?", ["Kerala", "Rajasthan", "Punjab only", "Sikkim only as spice exclusive always"], 0],
    ["The United Nations headquarters is in:", ["New York", "Geneva only as sole HQ", "Paris only", "New Delhi"], 0],
  ];

  for (let i = 0; i < 30; i++) {
    const row = ga[(i + (p - 1) * 3) % ga.length];
    const opts = row[1].slice();
    const shift = (p + i) % 4;
    const rot = [0, 1, 2, 3].map((j) => opts[(j + shift) % 4]);
    if (new Set(rot).size !== 4) items.push(Q(id++, row[0], opts, row[2], GA));
    else items.push(Q(id++, row[0], rot, rot.indexOf(opts[row[2]]), GA));
  }

  // Current affairs — evergreen / structural (not fleeting headlines)
  const ca = [
    ["India’s Republic Day is celebrated on:", ["26 January", "15 August", "2 October", "14 November"], 0],
    ["Independence Day of India is on:", ["15 August", "26 January", "26 November", "1 May"], 0],
    ["World Environment Day is observed on:", ["5 June", "1 January", "25 December", "14 February"], 0],
    ["International Yoga Day is celebrated on:", ["21 June", "2 October", "15 August", "26 January"], 0],
    ["The headquarters of ISRO is in:", ["Bengaluru", "Mumbai", "Kolkata", "Chennai"], 0],
    ["GST in India is related to:", ["Tax reform on goods and services", "Only sports coaching", "Only space missions", "Only classical music"], 0],
    ["G20 is a group of:", ["Major economies working on global economic issues", "Only 20 cricket teams", "Only 20 film awards", "Only 20 rivers"], 0],
    ["The Indian space mission that reached Mars orbit (classic) is associated with:", ["Mangalyaan / Mars Orbiter Mission", "Only Apollo-11 of India", "Only Voyager Indian exclusive", "Only lunar golf"], 0],
    ["UNESCO is related to:", ["Education, science and culture", "Only football rules", "Only banking interest rates exclusive", "Only local traffic fines"], 0],
    ["WHO mainly deals with:", ["Global public health", "Only space rockets", "Only Olympic medals tally exclusive", "Only film censorship in one city"], 0],
    ["The term ‘sustainable development’ emphasises:", ["Meeting present needs without harming future generations", "Using all resources at once", "Stopping all education", "Ignoring the environment"], 0],
    ["Digital payments in India are promoted to:", ["Make transactions convenient and traceable", "Remove all schools", "Ban books", "Stop electricity use"], 0],
  ];
  for (let i = 0; i < 10; i++) {
    const row = ca[(i + p - 1) % ca.length];
    const opts = row[1].slice();
    const shift = (p + i) % 4;
    const rot = [0, 1, 2, 3].map((j) => opts[(j + shift) % 4]);
    if (new Set(rot).size !== 4) items.push(Q(id++, row[0], opts, row[2], CA));
    else items.push(Q(id++, row[0], rot, rot.indexOf(opts[row[2]]), CA));
  }

  const life = [
    ["If you disagree with a classmate, the best first step is to:", ["Listen calmly and discuss respectfully", "Shout and insult", "Destroy their notebook", "Spread rumours"], 0],
    ["Seeing a classmate being bullied, you should:", ["Support them and inform a trusted adult/teacher", "Join the bullying", "Film and mock them", "Ignore forever if unsafe to help alone without telling anyone"], 0],
    ["A good way to manage exam stress is to:", ["Plan studies and take short breaks", "Skip all sleep for a week", "Never ask for help", "Copy in the exam"], 0],
    ["Keeping your personal information private online is important because:", ["It protects you from misuse and scams", "Friends need your passwords", "Privacy has no value", "Teachers post your OTP"], 0],
    ["When you make a mistake, a positive habit is to:", ["Admit, learn and improve", "Blame everyone else always", "Hide and never correct", "Repeat knowingly"], 0],
    ["Teamwork succeeds when members:", ["Cooperate and respect each other", "Only compete unfairly inside team", "Hide information needed by team", "Insult weaker members"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = life[(i + p - 1) % life.length];
    const opts = row[1].slice();
    const shift = (p + i) % 4;
    const rot = [0, 1, 2, 3].map((j) => opts[(j + shift) % 4]);
    if (new Set(rot).size !== 4) items.push(Q(id++, row[0], opts, row[2], LS));
    else items.push(Q(id++, row[0], rot, rot.indexOf(opts[row[2]]), LS));
  }

  const achG = [
    [
      "Why is separation of powers among legislature, executive and judiciary important in a democracy?",
      [
        "It prevents concentration of power and protects citizens’ rights",
        "It makes elections unnecessary",
        "It removes the need for laws",
        "It replaces the constitution with sports rules",
      ],
      0,
    ],
    [
      "Planting trees helps fight climate change mainly because trees:",
      ["Absorb carbon dioxide and support ecosystems", "Produce plastic", "Increase only noise", "Stop the water cycle completely"],
      0,
    ],
    [
      "A balanced media habit for students includes:",
      ["Checking facts from reliable sources and limiting screen overuse", "Believing every forward instantly", "Sharing unverified panic messages", "Never reading news"],
      0,
    ],
    [
      "Fundamental Duties in the Indian Constitution remind citizens to:",
      ["Uphold the Constitution, protect environment, and promote harmony among other duties", "Only pay foreign taxes", "Avoid education", "Ignore public property"],
      0,
    ],
    [
      "Which combination best supports good health?",
      ["Balanced diet, exercise, hygiene and adequate sleep", "Only junk food and no sleep", "No water and no rest", "Only screens all night"],
      0,
    ],
  ];
  for (let i = 0; i < 5; i++) {
    const row = achG[(i + p) % achG.length];
    const opts = row[1].slice();
    const shift = (p + i * 3) % 4;
    const rot = [0, 1, 2, 3].map((j) => opts[(j + shift) % 4]);
    if (new Set(rot).size !== 4) items.push(Q(id++, row[0], opts, row[2], A, 3));
    else items.push(Q(id++, row[0], rot, rot.indexOf(opts[row[2]]), A, 3));
  }

  if (items.length !== 50) throw new Error("GK total " + items.length);
  return pack(items);
}

function main() {
  ensureDir(ROOT);
  const jobs = [
    {
      folder: "mathematics",
      subject: "Mathematics",
      totalMarks: 50,
      expectQ: 40,
      build: buildMath,
    },
    {
      folder: "science",
      subject: "Science",
      totalMarks: 60,
      expectQ: 50,
      build: buildScience,
    },
    {
      folder: "english",
      subject: "English",
      totalMarks: 60,
      expectQ: 60,
      build: buildEnglish,
    },
    {
      folder: "computer",
      subject: "Computer",
      totalMarks: 60,
      expectQ: 50,
      build: buildComputer,
    },
    {
      folder: "gk",
      subject: "General Knowledge",
      totalMarks: 60,
      expectQ: 50,
      build: buildGK,
    },
  ];

  let written = 0;
  for (const job of jobs) {
    for (let p = 1; p <= 5; p++) {
      const paper = job.build(p);
      validate(paper, job.expectQ, job.totalMarks);
      const counts = {};
      for (const q of paper.questions) {
        counts[q.section] = (counts[q.section] || 0) + 1;
      }
      writePaper(
        job.folder,
        p,
        { subject: job.subject, totalMarks: job.totalMarks },
        paper.questions,
        paper.answers
      );
      written++;
      console.log(
        `OK ${job.folder} paper${p}: ${job.expectQ}Q, ${job.totalMarks} marks`,
        JSON.stringify(counts)
      );
    }
  }
  console.log(`\nWrote ${written} question papers + ${written} answer keys under Olympiad/data/class6/`);
  console.log("All Class 6 papers are original SOF-pattern practice (2023–2025 style).");
}

main();

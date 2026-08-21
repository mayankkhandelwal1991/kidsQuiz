#!/usr/bin/env node
/**
 * Generate ORIGINAL Class 10 Olympiad practice papers aligned to SOF
 * 2023–2025 exam PATTERN and SYLLABUS (not copyrighted SOF questions).
 *
 * Mathematics (IMO): LR 15×1 + Mathematical Reasoning 20×1 + Achievers 5×3 = 40Q / 50 marks
 * Science (NSO):     LR 10×1 + Science 35×1 + Achievers 5×3 = 50Q / 60 marks
 * English (IEO):     WSK 45×1 + Reading 10×1 + SWE 5×1 = 60Q / 60 marks
 * Computer (ICSO):   LR 10×1 + Computers 35×1 + Achievers 5×3 = 50Q / 60 marks
 * GK (IGKO):         GA 30×1 + CA 10×1 + Life Skills 5×1 + Achievers 5×3 = 50Q / 60 marks
 *
 * Class 10 NCERT-level topics. Original practice only.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const CLASS = 10;
const PAPERS = [1, 2, 3, 4, 5];
const ROOT = path.join(__dirname, "..", "data", "class10");

function Q(id, question, options, answer, section, marks) {
  if (!Array.isArray(options) || options.length !== 4) {
    throw new Error(`Q${id}: need 4 options`);
  }
  if (answer < 0 || answer > 3) throw new Error(`Q${id}: bad answer ${answer}`);
  const m =
    marks != null
      ? marks
      : section === "Achievers Section"
        ? 3
        : 1;
  return {
    id,
    section,
    question,
    options: options.map(String),
    marks: m,
  };
}

function shuffleOpts(correct, wrongs, salt) {
  const opts = [String(correct), ...wrongs.map(String)].slice(0, 4);
  while (opts.length < 4) opts.push(`Option ${opts.length}`);
  // deterministic rotate by salt
  const n = ((salt % 4) + 4) % 4;
  const rotated = opts.slice(n).concat(opts.slice(0, n));
  const ans = rotated.indexOf(String(correct));
  return { options: rotated, ans: ans < 0 ? 0 : ans };
}

function numOpts(correct, salt, deltas) {
  const d = deltas || [1, -1, 2, -2, 3, -3, 5, 10];
  const wrongs = [];
  for (const x of d) {
    const w = correct + x;
    if (w !== correct && !wrongs.includes(w)) wrongs.push(w);
    if (wrongs.length >= 3) break;
  }
  while (wrongs.length < 3) wrongs.push(correct + wrongs.length + 11);
  return shuffleOpts(correct, wrongs, salt);
}

function diversify(items, paperNo) {
  const prefixes = [
    "",
    "Choose the correct option: ",
    "Pick the right answer: ",
    "Select carefully: ",
    "Identify the correct choice: ",
  ];
  const pref = prefixes[(paperNo - 1) % prefixes.length];
  return items.map((q, i) => {
    if (!pref || i % 5 === 0) return q;
    // Don't double-prefix reading passages / long stems
    if (q.question.length > 120 || q.question.startsWith("Read ")) return q;
    return { ...q, question: pref + q.question };
  });
}

function sectionMarks(questions) {
  const marks = {};
  for (const q of questions) {
    marks[String(q.id)] = q.marks;
  }
  return marks;
}

function writePair(subject, paperNo, questions, meta) {
  const qDir = path.join(ROOT, subject, "questions");
  const aDir = path.join(ROOT, subject, "answers");
  fs.mkdirSync(qDir, { recursive: true });
  fs.mkdirSync(aDir, { recursive: true });

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const answers = {};
  // answers stored separately — rebuild from builder return
  // meta.answersMap id -> 0-based index
  for (const [id, ans] of Object.entries(meta.answersMap)) {
    answers[String(id)] = ans;
  }

  const qOut = {
    class: CLASS,
    subject: meta.subjectLabel,
    paper: paperNo,
    totalQuestions: questions.length,
    totalMarks,
    yearStyle: "2023-2025",
    patternNote: meta.patternNote,
    sections: meta.sections,
    questions: questions.map(({ id, section, question, options, marks }) => ({
      id,
      section,
      question,
      options,
      marks,
    })),
  };

  const aOut = {
    class: CLASS,
    subject: meta.subjectLabel,
    paper: paperNo,
    answers,
  };

  fs.writeFileSync(
    path.join(qDir, `paper${paperNo}.json`),
    JSON.stringify(qOut, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(aDir, `paper${paperNo}.json`),
    JSON.stringify(aOut, null, 2) + "\n"
  );

  return { totalQ: questions.length, totalMarks, answers: Object.keys(answers).length };
}

function pack(items) {
  // items are Q objects; we need answers from a parallel map built during push
  throw new Error("use pushQ helper");
}

/** Builder helper: tracks answers */
function makeBag() {
  const items = [];
  const answersMap = {};
  function push(id, question, options, answer, section, marks) {
    const q = Q(id, question, options, answer, section, marks);
    items.push(q);
    answersMap[String(id)] = answer;
    return q;
  }
  return { items, answersMap, push };
}

// ───────────────────────── Mathematics ─────────────────────────
function buildMath(paperNo) {
  const p = paperNo;
  const { items, answersMap, push } = makeBag();
  let id = 1;
  const L = "Logical Reasoning";
  const M = "Mathematical Reasoning";
  const A = "Achievers Section";

  // LR 15
  {
    const s0 = 3 + p * 2;
    let o = numOpts(s0 + 20, id + p, [1, -1, 2, 4]);
    push(id++, `Find the next term: ${s0}, ${s0 + 5}, ${s0 + 10}, ${s0 + 15}, __`, o.options, o.ans, L);

    push(id++, "Odd one out: 3, 5, 7, 9, 11 (which is not prime?)", ["9", "3", "5", "7"], 0, L);
    push(id++, "Analogy: 7 : 49 :: 9 : ?", ["81", "72", "18", "27"], 0, L);
    push(id++, "If A=1, B=2, … and CODE means sum of letter positions, CODE = ?", ["27", "30", "24", "33"], 0, L);
    push(id++, "A faces North, turns 90° clockwise, then 180°. Final direction:", ["West", "South", "North", "East"], 0, L);
    push(id++, "In a class of 40, 22 play cricket, 18 football, 8 both. Only cricket = ?", ["14", "22", "10", "8"], 0, L);
    push(id++, "Mirror image of time 3:00 on a clock is closest to:", ["9:00", "3:00", "6:00", "12:00"], 0, L);
    o = numOpts(300, id + p, [20, -30, 50, -15]);
    push(id++, "If 15% of a number is 45, the number is:", o.options, o.ans, L);
    push(id++, "Find the missing number: 2, 6, 12, 20, 30, ?", ["42", "40", "36", "48"], 0, L);
    push(id++, "A is taller than B, B taller than C, D taller than A. Tallest is:", ["D", "A", "B", "C"], 0, L);
    push(id++, "How many 2-digit numbers are divisible by 9?", ["10", "9", "11", "8"], 0, L); // 18..99 → 10 numbers? 9*2=18 to 9*11=99 → 10 numbers
    push(id++, "All squares are rectangles. Figure X is a square. Therefore X is a rectangle.", ["True", "False", "Cannot say", "Only sometimes"], 0, L);
    push(id++, "Complete the series: 5, 10, 20, 40, ?", ["80", "60", "50", "70"], 0, L);
    push(id++, "Angle between clock hands at 3:00 is:", ["90°", "180°", "60°", "120°"], 0, L);
    push(id++, "Dictionary order: second among Mathematics, Measure, Matrix, Medium is:", ["Matrix", "Mathematics", "Measure", "Medium"], 0, L);
  }

  // Mathematical Reasoning 20 — Class 10 NCERT
  const mr = [];

  // Real numbers / Euclid
  mr.push(() => {
    // HCF via Euclid style
    const a = 96 + p;
    const b = 36;
    // gcd
    function gcd(x, y) {
      while (y) [x, y] = [y, x % y];
      return x;
    }
    const g = gcd(a, b);
    const o = numOpts(g, id, [1, -1, 2, 4]);
    push(id++, `Using Euclid’s algorithm, HCF(${a}, ${b}) is:`, o.options, o.ans, M);
  });

  mr.push(() => {
    // fundamental theorem / irrational
    push(
      id++,
      "Which of the following is irrational?",
      ["√2", "0.25", "4/9", "√9"],
      0,
      M
    );
  });

  mr.push(() => {
    // LCM * HCF = product
    const a = 12 + p;
    const b = 18;
    function gcd(x, y) {
      while (y) [x, y] = [y, x % y];
      return x;
    }
    const g = gcd(a, b);
    const l = (a * b) / g;
    const o = numOpts(l, id, [2, -3, 6, 12]);
    push(id++, `LCM of ${a} and ${b} is:`, o.options, o.ans, M);
  });

  // Polynomials
  mr.push(() => {
    // sum of zeroes of x^2 - (p+3)x + 2
    const s = p + 3;
    const o = numOpts(s, id, [1, -1, 2, -2]);
    push(
      id++,
      `For the quadratic polynomial x² − ${s}x + 2, the sum of zeroes is:`,
      o.options,
      o.ans,
      M
    );
  });

  mr.push(() => {
    // product of zeroes
    push(
      id++,
      "If zeroes of x² − 5x + k are equal, then k = ?",
      ["25/4", "5", "10", "0"],
      0,
      M
    );
  });

  // Linear equations
  mr.push(() => {
    // solve 2x+y=7, 3x-y=8 → add 5x=15 x=3 y=1
    push(id++, "Solution of 2x + y = 7 and 3x − y = 8 is:", ["x=3, y=1", "x=1, y=3", "x=2, y=3", "x=4, y=-1"], 0, M);
  });

  mr.push(() => {
    // consistency
    push(
      id++,
      "The pair x + 2y = 3 and 2x + 4y = 6 has:",
      ["Infinitely many solutions", "No solution", "Unique solution (1,1) only forced", "Unique solution (0,0)"],
      0,
      M
    );
  });

  // Quadratic
  mr.push(() => {
    // roots of x^2 - 5x + 6 = 0 → 2,3
    push(id++, "Roots of x² − 5x + 6 = 0 are:", ["2 and 3", "1 and 6", "−2 and −3", "5 and 6"], 0, M);
  });

  mr.push(() => {
    // discriminant
    // x^2 - 4x + 4 = 0 D=0
    push(
      id++,
      "Discriminant of x² − 4x + 4 = 0 is:",
      ["0", "4", "16", "−4"],
      0,
      M
    );
  });

  mr.push(() => {
    // nature of roots D for x^2 + 1 = 0 is -4
    push(
      id++,
      "The quadratic equation x² + 1 = 0 has:",
      ["No real roots", "Two equal real roots", "Two distinct real roots", "One real root"],
      0,
      M
    );
  });

  // AP
  mr.push(() => {
    const a = 3 + p;
    const d = 2;
    const n = 10;
    const an = a + (n - 1) * d;
    const o = numOpts(an, id, [1, -1, 2, d]);
    push(id++, `${n}th term of AP ${a}, ${a + d}, ${a + 2 * d}, … is:`, o.options, o.ans, M);
  });

  mr.push(() => {
    // S_n = n/2 (2a+(n-1)d)
    const a = 2;
    const d = 3;
    const n = 10 + p; // 11..15
    const Sn = (n / 2) * (2 * a + (n - 1) * d);
    const o = numOpts(Sn, id, [3, -3, 10, -6]);
    push(id++, `Sum of first ${n} terms of AP ${a}, ${a + d}, ${a + 2 * d}, … is:`, o.options, o.ans, M);
  });

  // Triangles / similar
  mr.push(() => {
    push(
      id++,
      "If in two similar triangles, corresponding sides are in ratio 2 : 3, ratio of areas is:",
      ["4 : 9", "2 : 3", "3 : 2", "8 : 27"],
      0,
      M
    );
  });

  mr.push(() => {
    // Pythagoras
    push(id++, "In a right triangle, sides 6 and 8 are legs. Hypotenuse is:", ["10", "14", "7", "12"], 0, M);
  });

  // Coordinate
  mr.push(() => {
    // midpoint (2,3) and (4,7) → (3,5)
    push(id++, "Mid-point of A(2, 3) and B(4, 7) is:", ["(3, 5)", "(2, 7)", "(4, 3)", "(3, 4)"], 0, M);
  });

  mr.push(() => {
    // distance (0,0) (3,4)=5
    const x2 = 3 + p; // need integer distance - use 6,8 for p or fixed
    push(id++, "Distance between (0, 0) and (3, 4) is:", ["5", "7", "12", "25"], 0, M);
  });

  // Trigonometry
  mr.push(() => {
    push(id++, "sin 30° + cos 60° = ?", ["1", "0", "1/2", "√3/2"], 0, M); // 1/2+1/2=1
  });

  mr.push(() => {
    push(id++, "sec²θ − tan²θ equals:", ["1", "0", "sinθ", "2"], 0, M);
  });

  mr.push(() => {
    // height: tan30 = 1/√3 = h/30√3 → h=30
    push(
      id++,
      "A tower’s top is observed at 30° from a point 30√3 m away on level ground. Height of tower is:",
      ["30 m", "30√3 m", "60 m", "15 m"],
      0,
      M
    );
  });

  // Circles
  mr.push(() => {
    push(
      id++,
      "A tangent at a point of a circle is perpendicular to the:",
      ["Radius through the point of contact", "Chord only always parallel", "Diameter never radius", "Secant only"],
      0,
      M
    );
  });

  mr.push(() => {
    // area sector
    // area circle r=7 → 154
    push(id++, "Area of a circle with radius 7 cm is (π=22/7):", ["154 cm²", "44 cm²", "49 cm²", "22 cm²"], 0, M);
  });

  // Surface areas volumes
  mr.push(() => {
    // volume cylinder r=7 h=10 → 1540
    push(
      id++,
      "Volume of a cylinder with r = 7 cm and h = 10 cm is (π=22/7):",
      ["1540 cm³", "440 cm³", "770 cm³", "220 cm³"],
      0,
      M
    );
  });

  mr.push(() => {
    // cone volume (1/3)πr^2 h = (1/3)*(22/7)*3*3*7 = 66
    push(
      id++,
      "Volume of a cone with r = 3 cm and h = 7 cm is (π=22/7):",
      ["66 cm³", "198 cm³", "22 cm³", "44 cm³"],
      0,
      M
    );
  });

  // Statistics
  mr.push(() => {
    // mean of 2,4,6,8,10 = 6
    push(id++, "Mean of 2, 4, 6, 8, 10 is:", ["6", "5", "8", "10"], 0, M);
  });

  mr.push(() => {
    // median of 3,5,7,9,11 = 7
    push(id++, "Median of 3, 5, 7, 9, 11 is:", ["7", "5", "9", "6"], 0, M);
  });

  // Probability
  mr.push(() => {
    push(
      id++,
      "Probability of getting a prime when a die is thrown once:",
      ["1/2", "1/6", "1/3", "2/3"],
      0,
      M
    ); // 2,3,5 → 3/6=1/2
  });

  mr.push(() => {
    push(
      id++,
      "A card is drawn from a well-shuffled deck of 52. P(an ace) =",
      ["1/13", "1/52", "4/13", "1/4"],
      0,
      M
    );
  });

  // Invoke all MR generators then keep a balanced 20 (spread across bank by paper)
  for (const fn of mr) fn();

  {
    const mrPositions = [];
    items.forEach((q, i) => {
      if (q.section === M) mrPositions.push(i);
    });
    if (mrPositions.length > 20) {
      // choose 20 indices with stride so papers differ but cover full bank over time
      const total = mrPositions.length;
      const stride = 1; // take contiguous window sliding by paper
      // Better: fixed syllabus core = last topics included: take indices
      // 0..total-1, select using round-robin start
      const start = ((p - 1) * 4) % total;
      const chosen = [];
      for (let k = 0; k < total; k++) chosen.push(mrPositions[(start + k) % total]);
      // Prefer keeping a diverse set: take 20 from chosen order but force include
      // volume/stats/prob if present — identified by text snippets after build
      const keepSet = new Set(chosen.slice(0, 20));
      // Ensure key topic questions retained when bank larger
      const mustInclude = [/cylinder/i, /cone/i, /Mean of/i, /Median of/i, /prime when a die/i, /P\(an ace\)/i, /sin 30/i, /quadratic polynomial/i];
      for (const re of mustInclude) {
        const pos = mrPositions.find((i) => re.test(items[i].text));
        if (pos == null) continue;
        if (!keepSet.has(pos)) {
          // replace first non-must in keepSet
          const arr = [...keepSet];
          for (const cand of arr) {
            const isMust = mustInclude.some((r) => r.test(items[cand].text));
            if (!isMust) {
              keepSet.delete(cand);
              keepSet.add(pos);
              break;
            }
          }
        }
      }
      while (keepSet.size > 20) {
        const arr = [...keepSet];
        keepSet.delete(arr[arr.length - 1]);
      }
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].section === M && !keepSet.has(i)) {
          delete answersMap[String(items[i].id)];
          items.splice(i, 1);
        }
      }
    }
  }
  while (items.filter((q) => q.section === M).length < 20) {
    const k = items.filter((q) => q.section === M).length;
    const corr = (k + 1) * (k + 2);
    const o = numOpts(corr, id + p, [1, -1, 2]);
    push(id++, `The ${k + 1}th triangular number is:`, o.options, o.ans, M);
  }

  // Achievers 5 × 3 marks
  {
    // Quadratic formula application
    // x^2 - 7x + 10 = 0 roots 2,5 product 10 sum 7
    push(
      id++,
      "If the roots of x² − 7x + k = 0 differ by 3, then k equals:",
      ["10", "7", "4", "12"],
      0,
      A,
      3
    ); // roots a, a+3; sum 2a+3=7 → 2a=4 a=2; product 2*5=10

    // AP + application
    const a = 5;
    const d = 3;
    const n = 15;
    const Sn = (n / 2) * (2 * a + (n - 1) * d); // 7.5*(10+42)=7.5*52=390
    let o = numOpts(Sn, id, [10, -15, 30]);
    push(id++, `Sum of first 15 terms of AP 5, 8, 11, … is:`, o.options, o.ans, A, 3);

    // Trigonometry identity multi
    push(
      id++,
      "If tan θ = 3/4 and θ is acute, then sin θ = ?",
      ["3/5", "4/5", "3/4", "5/3"],
      0,
      A,
      3
    );

    // Surface: hemisphere + cylinder combo simple
    // TSA sphere 4πr^2 r=7 → 4*(22/7)*49 = 616
    o = numOpts(616, id, [22, -22, 100]);
    push(id++, "Total surface area of a sphere of radius 7 cm is (π=22/7):", o.options, o.ans, A, 3);

    // Probability combined
    push(
      id++,
      "Two coins are tossed. Probability of getting at least one head is:",
      ["3/4", "1/2", "1/4", "1"],
      0,
      A,
      3
    );
  }

  // Renumber ids sequentially and rebuild answers
  const finalItems = [];
  const finalAns = {};
  items.forEach((q, i) => {
    const newId = i + 1;
    const ans = answersMap[String(q.id)];
    finalItems.push({ ...q, id: newId });
    finalAns[String(newId)] = ans;
  });

  // diversify texts slightly
  const diversified = diversify(finalItems, p);

  // validate counts
  const lrN = diversified.filter((q) => q.section === L).length;
  const mrN = diversified.filter((q) => q.section === M).length;
  const aN = diversified.filter((q) => q.section === A).length;
  if (lrN !== 15 || mrN !== 20 || aN !== 5 || diversified.length !== 40) {
    throw new Error(`Math paper ${p}: bad counts LR${lrN} MR${mrN} A${aN} total${diversified.length}`);
  }

  return {
    questions: diversified,
    answersMap: finalAns,
    subjectLabel: "mathematics",
    patternNote:
      "Original practice paper aligned to SOF 2023–2025 pattern & syllabus. Not an official SOF paper. IMO pattern: Logical Reasoning 15×1 + Mathematical Reasoning 20×1 + Achievers 5×3 = 40 questions / 50 marks",
    sections: [
      { name: L, questions: 15, marksEach: 1 },
      { name: M, questions: 20, marksEach: 1 },
      { name: A, questions: 5, marksEach: 3 },
    ],
  };
}

// ───────────────────────── Science ─────────────────────────
function buildScience(paperNo) {
  const p = paperNo;
  const { items, answersMap, push } = makeBag();
  let id = 1;
  const L = "Logical Reasoning";
  const S = "Science";
  const A = "Achievers Section";

  // LR 10
  {
    const s0 = 4 + p;
    let o = numOpts(s0 + 12, id, [1, -1, 2]);
    push(id++, `Next in series: ${s0}, ${s0 + 4}, ${s0 + 8}, __`, o.options, o.ans, L);
    push(id++, "Odd one out: Photosynthesis, Respiration, Transpiration, Evaporation (of pure water only non-bio process among plant phys?)", ["Evaporation", "Photosynthesis", "Respiration", "Transpiration"], 0, L);
    push(id++, "Analogy: Eye : Sight :: Ear : ?", ["Hearing", "Smell", "Taste", "Touch"], 0, L);
    push(id++, "If all metals conduct and copper is a metal, copper:", ["conducts electricity", "is a non-metal", "is a gas at room temp always", "cannot be solid"], 0, L);
    push(id++, "Mirror: which letter looks same in a plane mirror among A, H, I, Z set — odd written form Z vs:", ["Z is asymmetric vertically more", "A", "H", "I"], 0, L);
    // simpler LR
    items.pop();
    delete answersMap[String(id - 1)];
    id--;
    push(id++, "Which does not belong: Sodium, Potassium, Iron, Chlorine", ["Chlorine", "Sodium", "Potassium", "Iron"], 0, L);
    push(id++, "Series: 1, 2, 4, 8, 16, ?", ["32", "24", "20", "18"], 0, L);
    push(id++, "A is mother of B. B is brother of C. C is sister of D. D is A’s:", ["child", "uncle", "grandfather", "mother"], 0, L);
    push(id++, "Directions: Facing East, turn left twice. Face:", ["West", "East", "North", "South"], 0, L);
    push(id++, "If WATER is coded as XBUFS (+1), then FIRE is:", ["GJSF", "EHQD", "HKT G", "GJSE"], 0, L);
    push(id++, "Find missing: 11, 13, 17, 19, 23, ?", ["29", "27", "25", "31"], 0, L);
  }

  const sciBank = [
    // Chemical reactions
    ["A chemical reaction in which heat is absorbed is called:", ["Endothermic", "Exothermic", "Displacement only", "Neutralisation only"], 0],
    ["Rusting of iron is an example of:", ["Oxidation", "Reduction only without oxygen", "Sublimation", "Neutralisation"], 0],
    ["BaCl₂ + Na₂SO₄ → BaSO₄ + 2NaCl is a:", ["Double displacement reaction", "Combination only", "Decomposition only", "Displacement of single type only wrong"], 0],
    ["The reaction 2H₂ + O₂ → 2H₂O is a:", ["Combination reaction", "Decomposition", "Displacement", "Double displacement"], 0],
    ["Rancidity in foods is related to:", ["Oxidation of oils and fats", "Only hydration of salt", "Photosynthesis", "Neutralisation of acids"], 0],
    // Acids bases salts
    ["pH of a neutral solution at 25°C is:", ["7", "0", "14", "1"], 0],
    ["Which is a strong acid?", ["HCl", "CH₃COOH", "H₂CO₃", "Citric acid"], 0],
    ["Tooth enamel is mainly:", ["Calcium phosphate", "Calcium carbonate only", "Sodium chloride", "Potassium nitrate"], 0],
    ["An acid turns blue litmus:", ["Red", "Blue", "Green", "Colourless always"], 0],
    ["NaOH is a:", ["Strong base", "Strong acid", "Neutral salt", "Weak acid"], 0],
    ["Common salt is chemically:", ["NaCl", "NaOH", "Na₂CO₃", "NaHCO₃"], 0],
    ["Antacids generally contain:", ["Mild base", "Strong acid", "Only sugar", "Pure HCl"], 0],
    // Metals non-metals
    ["Which metal is liquid at room temperature?", ["Mercury", "Iron", "Sodium", "Aluminium"], 0],
    ["The most reactive among Na, Au, Cu, Fe is:", ["Na", "Au", "Cu", "Fe"], 0],
    ["Aluminium is extracted mainly from:", ["Bauxite", "Haematite", "Cinnabar", "Rock salt"], 0],
    ["Which is a non-metal that is a good conductor?", ["Graphite", "Sulphur", "Phosphorus", "Iodine crystal poor"], 0],
    ["Galvanisation is coating iron with:", ["Zinc", "Copper only", "Silver only", "Gold only"], 0],
    ["Aqua regia can dissolve gold and is a mixture of:", ["HCl and HNO₃", "H₂SO₄ and HCl only", "HNO₃ and water only", "NaOH and HCl"], 0],
    // Carbon compounds
    ["General formula of alkanes is:", ["CₙH₂ₙ₊₂", "CₙH₂ₙ", "CₙH₂ₙ₋₂", "CₙHₙ"], 0],
    ["Ethanol on oxidation with alkaline KMnO₄ gives:", ["Ethanoic acid", "Ethene", "Methane", "Propanol"], 0],
    ["The functional group in carboxylic acids is:", ["−COOH", "−CHO", "−OH", "−NH₂"], 0],
    ["Soap molecules have:", ["Hydrophobic and hydrophilic parts", "Only metals", "Only ions of noble gases", "No carbon"], 0],
    ["Covalent compounds generally have:", ["Low melting and boiling points relative to ionic", "Very high electrical conductivity in solid state always", "Only metallic bonding", "Three-dimensional ionic lattice only"], 0],
    // Periodic
    ["Modern periodic law is based on:", ["Atomic number", "Atomic mass only", "Density only", "Valency only without Z"], 0],
    ["Across a period, atomic radius generally:", ["Decreases", "Increases always sharply", "Remains exactly same", "Becomes infinite"], 0],
    ["Elements in the same group have the same:", ["Valence electrons (generally)", "Mass number always", "Number of neutrons always", "Density exactly"], 0],
    // Life processes
    ["The process of breakdown of glucose in cytoplasm without oxygen first step is:", ["Glycolysis", "Transpiration", "Photolysis only", "Translocation only"], 0],
    ["Which organelle is called the powerhouse of the cell?", ["Mitochondria", "Ribosome", "Nucleus", "Golgi apparatus"], 0],
    ["Haemoglobin carries:", ["Oxygen", "Only urea", "Only cellulose", "Only bile salts"], 0],
    ["Nephrons are the structural units of:", ["Kidney", "Liver", "Heart", "Lung"], 0],
    ["In plants, transport of food is mainly through:", ["Phloem", "Xylem only", "Stomata only", "Root hairs only"], 0],
    ["During photosynthesis, oxygen is released from:", ["Water", "Carbon dioxide only", "Chlorophyll only without water", "Nitrogen"], 0],
    ["Bile is produced by:", ["Liver", "Pancreas", "Stomach", "Kidney"], 0],
    // Control coordination
    ["The gap between two neurons is called:", ["Synapse", "Axon", "Dendrite", "Myelin only"], 0],
    ["Insulin is secreted by:", ["Pancreas", "Thyroid", "Adrenal only", "Pituitary only"], 0],
    ["Reflex actions are controlled mainly by the:", ["Spinal cord", "Cerebrum only always", "Liver", "Kidney"], 0],
    ["Plant hormone responsible for cell elongation in shoots is:", ["Auxin", "Abscisic acid", "Cytokinin only as inhibitor", "Ethylene only for elongation always"], 0],
    // Reproduction
    ["Binary fission is common in:", ["Amoeba", "Humans", "Flowering plants only", "Birds"], 0],
    ["Fertilisation in humans normally occurs in the:", ["Oviduct (fallopian tube)", "Uterus lining only always start", "Ovary exterior only", "Vagina only"], 0],
    ["Which is a contraceptive method?", ["Copper-T", "Antibiotics always", "Vaccines only", "ORS"], 0],
    ["Pollination is transfer of pollen from:", ["Anther to stigma", "Stigma to root", "Leaf to stem", "Seed to fruit only"], 0],
    // Heredity
    ["Mendel worked mainly on:", ["Pea plant", "Drosophila only first", "Humans only", "Bacteria only"], 0],
    ["A recessive trait appears in F2 monohybrid ratio approximately:", ["1/4", "3/4", "1/2", "All"], 0],
    ["Sex chromosomes in human males are:", ["XY", "XX", "YY only", "XO only always"], 0],
    // Light
    ["Laws of reflection: angle of incidence equals angle of:", ["Reflection", "Refraction only", "Deviation only", "Dispersion only"], 0],
    ["A convex lens is used to correct:", ["Hypermetropia", "Myopia", "Cataract surgically only without lens", "Colour blindness always"], 0],
    ["Focal length of a concave mirror is 10 cm. Its radius of curvature is:", ["20 cm", "10 cm", "5 cm", "40 cm"], 0],
    ["SI unit of power of a lens is:", ["Dioptre", "Watt", "Joule", "Newton"], 0],
    ["Absolute refractive index of a medium is always:", ["Greater than or equal to 1", "Less than 0", "Exactly 0", "Negative"], 0],
    // Human eye
    ["The light-sensitive screen of the eye is the:", ["Retina", "Cornea only", "Iris only", "Pupil only"], 0],
    ["Myopia is corrected by:", ["Concave lens", "Convex lens", "Cylindrical only always", "Plane mirror"], 0],
    // Electricity
    ["Ohm’s law: V = ?", ["IR", "I/R", "R/I", "I²R only as voltage"], 0],
    ["SI unit of resistance is:", ["Ohm", "Volt", "Ampere", "Coulomb"], 0],
    ["Resistances 2 Ω and 3 Ω in series give equivalent:", ["5 Ω", "1 Ω", "6 Ω", "2/3 Ω"], 0],
    ["Resistances 2 Ω and 2 Ω in parallel give:", ["1 Ω", "4 Ω", "2 Ω", "0.5 Ω"], 0],
    ["Electric power P = ?", ["VI", "V/I", "I/V", "V only"], 0],
    ["1 kWh equals:", ["3.6 × 10⁶ J", "1000 J", "3600 J only", "1 J"], 0],
    // Magnetic
    ["Magnetic field lines outside a magnet go from:", ["North to South", "South to North only", "East to West", "Random always"], 0],
    ["A current-carrying conductor experiences force in a magnetic field (Fleming’s):", ["Left-hand rule for motors", "Right-hand for motors only", "No rule exists", "Only gravitational rule"], 0],
    ["An electric fuse is based on:", ["Heating effect of current", "Only magnetic effect without heat", "Chemical effect only", "Photoelectric effect"], 0],
    // Energy / environment
    ["Which is a renewable source of energy?", ["Solar energy", "Coal", "Petroleum", "Natural gas"], 0],
    ["Ozone layer protects us from excess:", ["UV radiation", "Infrared only useful", "Visible light only", "Radio waves only"], 0],
    ["Biodegradable waste example:", ["Vegetable peels", "Plastic bottle", "Metal can", "Glass"], 0],
    ["Chipko movement is associated with:", ["Forest conservation", "Nuclear energy only", "Space research", "Cricket"], 0],
    ["In a food chain, green plants are:", ["Producers", "Primary consumers", "Decomposers only", "Tertiary consumers"], 0],
  ];

  // pick 35 with stride
  {
    const used = new Set();
    const start = (p - 1) * 5;
    const stride = 3 + (p % 4);
    for (let i = 0; i < 35; i++) {
      let idx = (start + i * stride) % sciBank.length;
      let g = 0;
      while (used.has(idx) && g < sciBank.length) {
        idx = (idx + 1) % sciBank.length;
        g++;
      }
      used.add(idx);
      const row = sciBank[idx];
      // rotate options for variety
      const sh = shuffleOpts(row[1][row[2]], row[1].filter((_, j) => j !== row[2]), id + p);
      push(id++, row[0], sh.options, sh.ans, S);
    }
  }

  // Achievers 5
  {
    push(
      id++,
      "When 2 Ω, 3 Ω and 6 Ω are connected in parallel, equivalent resistance is:",
      ["1 Ω", "11 Ω", "2 Ω", "0.5 Ω"],
      0,
      A,
      3
    ); // 1/R=1/2+1/3+1/6=1
    push(
      id++,
      "A convex lens of focal length 20 cm forms a real image at 40 cm. Object distance u is (sign convention magnitude):",
      ["40 cm", "20 cm", "60 cm", "10 cm"],
      0,
      A,
      3
    ); // 1/v-1/u=1/f → 1/40 - 1/u = 1/20 → -1/u = 1/20 - 1/40 = 1/40 → u=-40
    push(
      id++,
      "pH of a solution is 3. It is:",
      ["Acidic", "Basic", "Neutral", "Saline only"],
      0,
      A,
      3
    );
    push(
      id++,
      "In the reaction MnO₂ + 4HCl → MnCl₂ + 2H₂O + Cl₂, the substance oxidised is:",
      ["HCl", "MnO₂", "MnCl₂", "H₂O"],
      0,
      A,
      3
    );
    push(
      id++,
      "If 5 A current flows for 10 minutes, charge flown is:",
      ["3000 C", "50 C", "0.5 C", "500 C"],
      0,
      A,
      3
    ); // Q=It=5*600=3000
  }

  // renumber
  const finalItems = [];
  const finalAns = {};
  items.forEach((q, i) => {
    const newId = i + 1;
    finalItems.push({ ...q, id: newId });
    finalAns[String(newId)] = answersMap[String(q.id)];
  });
  const diversified = diversify(finalItems, p);
  if (diversified.length !== 50) throw new Error(`Sci p${p} len ${diversified.length}`);
  const marks = diversified.reduce((s, q) => s + q.marks, 0);
  if (marks !== 60) throw new Error(`Sci p${p} marks ${marks}`);

  return {
    questions: diversified,
    answersMap: finalAns,
    subjectLabel: "science",
    patternNote:
      "Original practice paper aligned to SOF 2023–2025 pattern & syllabus. Not an official SOF paper. NSO pattern: Logical Reasoning 10×1 + Science 35×1 + Achievers 5×3 = 50 questions / 60 marks",
    sections: [
      { name: L, questions: 10, marksEach: 1 },
      { name: S, questions: 35, marksEach: 1 },
      { name: A, questions: 5, marksEach: 3 },
    ],
  };
}

// ───────────────────────── English ─────────────────────────
function buildEnglish(paperNo) {
  const p = paperNo;
  const { items, answersMap, push } = makeBag();
  let id = 1;
  const W = "Word and Structure Knowledge";
  const R = "Reading";
  const S = "Spoken and Written Expression";

  const wsk = [];
  // articles determiners
  wsk.push(["She is ___ honest leader.", ["an", "a", "the", "no article"], 0]);
  wsk.push(["___ Amazon is the largest river by discharge.", ["The", "A", "An", "No article"], 0]);
  wsk.push(["I have ___ little money left.", ["a", "an", "the", "many"], 0]);
  wsk.push(["___ of the students were present.", ["All", "Every", "Much", "Little"], 0]);
  wsk.push(["There isn’t ___ water in the bottle.", ["much", "many", "a few", "several"], 0]);

  // tenses
  wsk.push(["By this time tomorrow, we ___ the project.", ["will have finished", "finish", "finished", "are finish"], 0]);
  wsk.push(["She ___ in Delhi since 2018.", ["has lived", "live", "is live", "living"], 0]);
  wsk.push(["If he ___ harder, he would have passed.", ["had studied", "studied", "studies", "will study"], 0]);
  wsk.push(["The train ___ before we reached the station.", ["had left", "has left", "leaves", "left only wrong tense pair"], 0]);
  wsk.push(["She usually ___ to school by bus.", ["goes", "go", "going", "gone"], 0]);
  wsk.push(["Look! The children ___ in the park.", ["are playing", "play", "played", "plays"], 0]);

  // voice
  wsk.push(["Passive of ‘They are repairing the road’:", ["The road is being repaired by them.", "The road repaired them.", "The road was repairing.", "They are repaired the road."], 0]);
  wsk.push(["Active of ‘The letter was written by Anita’:", ["Anita wrote the letter.", "Anita was written the letter.", "The letter wrote Anita.", "Anita is written letter."], 0]);
  wsk.push(["Passive of ‘Open the window’:", ["Let the window be opened.", "The window opened.", "Window is open by you.", "Let the window opened."], 0]);
  wsk.push(["Passive of ‘Who wrote this book?’:", ["By whom was this book written?", "Who was written this book?", "By who this book written?", "Whom wrote this book by?"], 0]);

  // narration
  wsk.push(["He said, “I am tired.” →", ["He said that he was tired.", "He said that I am tired.", "He said that he is tired.", "He told that he tired."], 0]);
  wsk.push(["She said to me, “Where do you live?” →", ["She asked me where I lived.", "She asked me where do you live.", "She told me where I live?", "She said me where I lived."], 0]);
  wsk.push(["Ram said, “I bought a pen yesterday.” →", ["Ram said that he had bought a pen the previous day.", "Ram said that he has bought a pen yesterday.", "Ram said that I bought a pen yesterday.", "Ram said he buy a pen."], 0]);
  wsk.push(["He said, “I will help you.” →", ["He said that he would help me.", "He said that he will help you.", "He said that I will help you.", "He told that he help me."], 0]);

  // clauses
  wsk.push(["Identify the subordinate clause: ‘I know that honesty pays.’", ["that honesty pays", "I know", "honesty", "pays"], 0]);
  wsk.push(["Join: ‘This is the girl. She won the medal.’", ["This is the girl who won the medal.", "This is the girl which won the medal.", "This is the girl whom won.", "This is girl she won medal."], 0]);
  wsk.push(["Choose the correct sentence:", ["If it rains, we will stay indoors.", "If it will rain, we stay.", "If it raining, we will stay.", "If rains it, stay we."], 0]);
  wsk.push(["Noun clause example:", ["What she said surprised everyone.", "Running fast, he won.", "The blue sky", "Very happily"], 0]);

  // modals
  wsk.push(["You ___ wear a seat belt while driving.", ["must", "used", "need not never", "ought not ever only"], 0]);
  wsk.push(["He ___ swim when he was five.", ["could", "can", "may", "must"], 0]);
  wsk.push(["___ I borrow your pen?", ["May", "Should must only", "Ought", "Used"], 0]);
  wsk.push(["You ___ see a doctor; you look ill.", ["ought to", "used to only", "needn’t always", "mustn’t ever care"], 0]);

  // prepositions
  wsk.push(["He is good ___ mathematics.", ["at", "in", "on", "with"], 0]);
  wsk.push(["Beware ___ pickpockets.", ["of", "from", "off", "with"], 0]);
  wsk.push(["She has been ill ___ Monday.", ["since", "for", "from", "on"], 0]);
  wsk.push(["Distribute the sweets ___ the children.", ["among", "between", "in", "into"], 0]);
  wsk.push(["He congratulated me ___ my success.", ["on", "for", "at", "with"], 0]);

  // non-finites
  wsk.push(["He is fond of ___ cricket.", ["playing", "play", "played", "plays"], 0]);
  wsk.push(["I want ___ the truth.", ["to know", "know", "knowing", "known"], 0]);
  wsk.push(["___ is believing.", ["Seeing", "See", "Seen", "Saw"], 0]);

  // subject verb
  wsk.push(["Neither of the boys ___ present.", ["was", "were", "are", "have"], 0]);
  wsk.push(["The news ___ true.", ["is", "are", "were", "have"], 0]);
  wsk.push(["Each of the girls ___ a book.", ["has", "have", "are", "were"], 0]);

  // vocabulary
  wsk.push(["Synonym of ‘brief’:", ["concise", "lengthy", "slow", "noisy"], 0]);
  wsk.push(["Antonym of ‘scarce’:", ["abundant", "rare", "little", "short"], 0]);
  wsk.push(["‘A person who writes books’ is a:", ["author", "doctor", "pilot", "baker"], 0]);
  wsk.push(["Idiom: ‘A blessing in disguise’ means:", ["Something good that seemed bad at first", "A hidden curse always", "A costume party", "A religious ritual only"], 0]);
  wsk.push(["Choose correctly spelt word:", ["Accommodation", "Acommodation", "Accomodation", "Acomodation"], 0]);
  wsk.push(["One-word: ‘A life story of a person written by himself/herself’:", ["Autobiography", "Biography", "Bibliography", "Photography"], 0]);
  wsk.push(["Synonym of ‘diligent’:", ["hardworking", "lazy", "careless", "rude"], 0]);
  wsk.push(["Antonym of ‘optimistic’:", ["pessimistic", "hopeful", "cheerful", "positive"], 0]);
  wsk.push(["The noun form of ‘decide’ is:", ["decision", "decisive", "decidedly", "decidingly wrong"], 0]);
  wsk.push(["Fill: He is senior ___ me.", ["to", "than", "from", "of"], 0]);
  wsk.push(["Error spot idea: ‘He suggested me to go’ correct is:", ["He suggested that I go", "He suggested me go", "He suggested to me going always wrong", "He suggest me to go"], 0]);
  wsk.push(["Conjunction: He is poor ___ honest.", ["but", "so", "or", "if"], 0]);
  wsk.push(["Reported: ‘Do you like tea?’ she said. →", ["She asked if I liked tea.", "She asked do you like tea.", "She told that I like tea?", "She said me if I like tea."], 0]);
  wsk.push(["Choose correct: The committee ___ divided in its opinion.", ["was", "were always only", "are", "have"], 0]);
  wsk.push(["Phrasal: The meeting was ___ due to rain.", ["called off", "called on", "called in only", "called up only"], 0]);
  wsk.push(["Article: He is ___ European citizen.", ["a", "an", "the", "no article"], 0]);

  while (wsk.length < 55) {
    const n = wsk.length + 1;
    wsk.push([
      `Choose the correct option (${n}): She prefers tea ___ coffee.`,
      ["to", "than", "from", "for"],
      0,
    ]);
  }

  {
    const used = new Set();
    const start = (p - 1) * 7;
    const stride = 2 + (p % 3);
    for (let i = 0; i < 45; i++) {
      let idx = (start + i * stride) % wsk.length;
      let g = 0;
      while (used.has(idx) && g < wsk.length) {
        idx = (idx + 1) % wsk.length;
        g++;
      }
      used.add(idx);
      const row = wsk[idx];
      const sh = shuffleOpts(row[1][row[2]], row[1].filter((_, j) => j !== row[2]), id + p * 3);
      push(id++, row[0], sh.options, sh.ans, W);
    }
  }

  // Reading 10 — two passages × 5
  const passages = [
    {
      intro:
        "Read the passage and answer: Digital literacy has become as essential as reading and writing. Students who can evaluate online sources critically are less likely to spread misinformation. Schools that integrate media literacy with regular subjects help learners question headlines, check authors, and compare multiple reports before forming opinions.",
      qs: [
        ["According to the passage, digital literacy is:", ["as essential as reading and writing", "unnecessary for students", "only about typing speed", "limited to video games"], 0],
        ["Critical evaluation of sources helps students:", ["spread less misinformation", "ignore all news", "avoid reading", "delete libraries"], 0],
        ["Media literacy should be:", ["integrated with regular subjects", "banned in schools", "only for teachers", "replaced by memorisation only"], 0],
        ["Learners are encouraged to:", ["compare multiple reports", "believe every headline", "never check authors", "avoid opinions forever"], 0],
        ["The main idea of the passage is about:", ["importance of digital and media literacy", "banning the internet", "only sports education", "handwriting drills only"], 0],
      ],
    },
    {
      intro:
        "Read the passage and answer: Wetlands act as natural sponges that absorb excess rainwater and reduce floods. They also filter pollutants and provide habitat for migratory birds. Unfortunately, urban expansion often fills wetlands for construction, increasing flood risk and biodiversity loss. Conservation of wetlands is therefore both an environmental and economic priority.",
      qs: [
        ["Wetlands help reduce floods by:", ["absorbing excess rainwater", "creating more concrete", "removing all rivers", "increasing deserts"], 0],
        ["Wetlands provide habitat for:", ["migratory birds", "only desert camels", "submarines only", "glaciers"], 0],
        ["Urban expansion often:", ["fills wetlands for construction", "expands wetlands always", "bans all buildings", "plants only coral"], 0],
        ["Loss of wetlands can increase:", ["flood risk and biodiversity loss", "only tourism profits always", "ozone in space", "moonlight"], 0],
        ["Conservation of wetlands is described as:", ["environmental and economic priority", "useless effort", "only a sports goal", "purely decorative"], 0],
      ],
    },
    {
      intro:
        "Read the passage and answer: Team sports teach cooperation, discipline and resilience. When a player misses a goal, supportive teammates help rebuild confidence. Coaches who focus on effort as well as results create healthier competitive environments. Beyond trophies, the habits of fair play and respect last into adult life and workplaces.",
      qs: [
        ["Team sports teach:", ["cooperation, discipline and resilience", "only isolation", "dishonesty", "avoiding effort"], 0],
        ["Supportive teammates help when a player:", ["misses a goal", "wins alone always", "leaves the planet", "ignores rules proudly"], 0],
        ["Healthy competition values:", ["effort as well as results", "results without ethics", "only trophies", "unfair play"], 0],
        ["Habits of fair play:", ["last into adult life and workplaces", "end after one match", "are useless", "apply only to robots"], 0],
        ["The passage suggests sports benefit:", ["character beyond trophies", "only medal counts", "avoiding teamwork", "ignoring coaches"], 0],
      ],
    },
    {
      intro:
        "Read the passage and answer: Public transport reduces traffic congestion and per-passenger emissions compared with many private cars. Reliable buses and trains also expand access to jobs and education for people who cannot afford personal vehicles. Investment in clean, frequent transit is therefore a step toward more equitable and sustainable cities.",
      qs: [
        ["Public transport can reduce:", ["congestion and per-passenger emissions", "all walking forever", "only rainfall", "library hours"], 0],
        ["Reliable transit expands access to:", ["jobs and education", "only private jets", "space travel only", "underwater homes"], 0],
        ["People without personal vehicles benefit from:", ["buses and trains", "more toll booths only", "closed stations", "no schedules"], 0],
        ["Clean frequent transit supports:", ["equitable sustainable cities", "more pollution always", "fewer opportunities", "gridlock only"], 0],
        ["The author’s tone toward public transport is:", ["supportive", "hostile", "indifferent", "mocking"], 0],
      ],
    },
    {
      intro:
        "Read the passage and answer: Sleep is not wasted time; it consolidates memory and restores the body. Teenagers who regularly sleep fewer than seven hours often show reduced attention in class. Limiting late-night screens and keeping a consistent schedule are simple habits that improve both mood and academic performance.",
      qs: [
        ["Sleep helps to:", ["consolidate memory and restore the body", "erase all learning", "replace nutrition entirely", "stop growth always"], 0],
        ["Fewer than seven hours of sleep may reduce:", ["attention in class", "need for friends", "all physical growth instantly forever", "school buildings"], 0],
        ["A helpful habit mentioned is:", ["limiting late-night screens", "never sleeping", "only energy drinks", "skipping schedules"], 0],
        ["Consistent sleep schedules can improve:", ["mood and academic performance", "only traffic", "screen addiction", "noise pollution"], 0],
        ["The passage argues sleep is:", ["important, not wasted time", "useless for teens", "optional always", "harmful"], 0],
      ],
    },
  ];

  const p1 = passages[(p - 1) % passages.length];
  const p2 = passages[p % passages.length];
  for (const pass of [p1, p2]) {
    for (const row of pass.qs) {
      push(id++, `${pass.intro}\n\n${row[0]}`, row[1].slice(), row[2], R);
    }
  }

  // SWE 5
  const swe = [
    ["Choose the most appropriate sentence to complete a formal letter opening:", ["I am writing to bring to your notice the frequent power cuts in our area.", "Hey! Fix the lights dude.", "Your power is bad lol.", "I command you immediately without details."], 0],
    ["Best topic sentence for a paragraph on water conservation:", ["Saving water at home and school is essential for a sustainable future.", "Water is wet sometimes.", "I like blue colours.", "Rivers are long maybe."], 0],
    ["Polite way to disagree in a discussion:", ["I see your point, but I hold a different view because…", "You are completely stupid.", "Shut up.", "I won't listen ever."], 0],
    ["Suitable closing for a job application letter:", ["Yours faithfully,", "See ya,", "Bye bye friend,", "Whatever,"], 0],
    ["Analytical paragraph should mainly:", ["Present data-based interpretation clearly", "Only list random jokes", "Avoid any facts", "Copy without understanding"], 0],
    ["Choose correct notice heading style:", ["NOTICE", "noticE please read haha", "nOtIcE!!!", "nothing"], 0],
    ["In spoken English, a courteous request is:", ["Could you please help me with this sum?", "Do this now slave.", "Help! or else.", "You must obey me silently."], 0],
  ];
  {
    const used = new Set();
    for (let i = 0; i < 5; i++) {
      let idx = (i * 2 + p) % swe.length;
      while (used.has(idx)) idx = (idx + 1) % swe.length;
      used.add(idx);
      const row = swe[idx];
      push(id++, row[0], row[1].slice(), row[2], S);
    }
  }

  const finalItems = [];
  const finalAns = {};
  items.forEach((q, i) => {
    const newId = i + 1;
    finalItems.push({ ...q, id: newId });
    finalAns[String(newId)] = answersMap[String(q.id)];
  });
  if (finalItems.length !== 60) throw new Error(`Eng p${p} ${finalItems.length}`);
  const marks = finalItems.reduce((s, q) => s + q.marks, 0);
  if (marks !== 60) throw new Error(`Eng marks ${marks}`);

  return {
    questions: finalItems,
    answersMap: finalAns,
    subjectLabel: "english",
    patternNote:
      "Original practice paper aligned to SOF 2023–2025 pattern & syllabus. Not an official SOF paper. IEO pattern: Word and Structure Knowledge 45×1 + Reading 10×1 + Spoken and Written Expression 5×1 = 60 questions / 60 marks",
    sections: [
      { name: W, questions: 45, marksEach: 1 },
      { name: R, questions: 10, marksEach: 1 },
      { name: S, questions: 5, marksEach: 1 },
    ],
  };
}

// ───────────────────────── Computer ─────────────────────────
function buildComputer(paperNo) {
  const p = paperNo;
  const { items, answersMap, push } = makeBag();
  let id = 1;
  const L = "Logical Reasoning";
  const C = "Computers and IT";
  const A = "Achievers Section";

  // LR 10
  {
    const s0 = 5 + p;
    let o = numOpts(s0 + 16, id, [1, -1, 2]);
    push(id++, `Next: ${s0}, ${s0 + 4}, ${s0 + 8}, ${s0 + 12}, __`, o.options, o.ans, L);
    push(id++, "Odd one out: Keyboard, Mouse, Monitor, Wheat", ["Wheat", "Keyboard", "Mouse", "Monitor"], 0, L);
    push(id++, "Analogy: CPU : Process :: Monitor : ?", ["Display", "Print only", "Type only", "Store fuel"], 0, L);
    push(id++, "If CAT = 24 (A=1 sum), DOG = ?", ["26", "24", "30", "20"], 0, L);
    push(id++, "Binary next: 1, 10, 11, 100, ?", ["101", "110", "111", "1000"], 0, L);
    push(id++, "Face West, turn left, then left. Face:", ["East", "West", "North", "South"], 0, L);
    push(id++, "Odd one: AND, OR, NOT, CPU", ["CPU", "AND", "OR", "NOT"], 0, L);
    push(id++, "Series: 5, 10, 20, 40, ?", ["80", "60", "50", "70"], 0, L);
    push(id++, "If passwords must be secret and X is a password, X must be:", ["kept secret", "published online", "shared widely always", "written on the door"], 0, L);
    push(id++, "2-letter codes from A,B repetition allowed:", ["4", "2", "3", "1"], 0, L);
  }

  const compBank = [
    ["CPU stands for:", ["Central Processing Unit", "Computer Personal Utility", "Central Print Unit", "Control Program Upload"], 0],
    ["RAM is a type of:", ["Volatile memory", "Permanent paper storage", "Output device only", "Network cable"], 0],
    ["An operating system example is:", ["Linux", "MS Word only", "Google Chrome only as OS", "JPEG"], 0],
    ["Which is an input device?", ["Scanner", "Speaker", "Printer", "Monitor"], 0],
    ["1 byte equals:", ["8 bits", "2 bits", "16 bits", "10 bits"], 0],
    ["HTML is used to:", ["Create web page structure", "Only edit offline videos", "Replace electricity", "Compile only C++"], 0],
    ["Largest HTML heading tag pair:", ["<h1>...</h1>", "<h6> as largest", "<head1>", "<heading>"], 0],
    ["HTTP is a:", ["Protocol for transferring web pages", "Hardware chip", "Type of printer", "Database engine only"], 0],
    ["A LAN typically covers a:", ["Local area such as a building", "The entire planet only", "Only undersea cables", "Outer space only"], 0],
    ["Which device connects different networks?", ["Router", "Mouse", "Joystick", "Microphone"], 0],
    ["Phishing attempts to:", ["Steal sensitive information by deception", "Speed up the CPU", "Clean dust", "Charge a battery"], 0],
    ["A strong password should be:", ["Long mixed letters numbers symbols", "Your name only", "12345", "password"], 0],
    ["In MS Excel, a formula usually begins with:", ["=", "#", "@", "&"], 0],
    ["Ctrl + C commonly:", ["Copies", "Shuts down only", "Formats disk always", "Prints landscape only"], 0],
    ["A database is:", ["An organised collection of data", "A single unformatted paragraph only", "Only a power cable", "A type of virus"], 0],
    ["Primary key should be:", ["Unique for each record", "Always duplicated", "Always blank", "Only images"], 0],
    ["Cloud computing allows:", ["Accessing services over the internet", "Only offline typewriters", "Removing all networks forever", "Burning CDs only"], 0],
    ["AI in simple terms:", ["Machines performing tasks needing human-like intelligence", "Only mechanical gears without data", "Paper filing cabinets", "Analog radio only"], 0],
    ["Which is malware?", ["Ransomware", "Firewall", "Antivirus update", "UPS"], 0],
    ["Firewall is used to:", ["Filter network traffic for security", "Cool the CPU with water always", "Increase font size", "Scan paper only"], 0],
    ["URL stands for:", ["Uniform Resource Locator", "Universal Random List", "User Remote Login only", "United Router Link"], 0],
    ["IP address identifies a:", ["Device on a network", "Only a printer ink type", "Keyboard layout only", "Font style"], 0],
    ["HTTPS compared to HTTP adds:", ["Encryption for secure communication", "Only slower images always without security", "No difference ever", "Removal of all text"], 0],
    ["CSS is mainly used for:", ["Styling web pages", "Only database queries", "CPU manufacturing", "Antivirus definitions"], 0],
    ["JavaScript in browsers is commonly used to:", ["Add interactivity to web pages", "Replace the operating system kernel only", "Manufacture RAM", "Cool GPUs with code"], 0],
    ["In Python, which prints a message?", ["print(\"Hello\")", "echo Hello", "System.out only always", "cout <<"], 0],
    ["A loop that continues while a condition is true is a:", ["while loop", "only a variable", "firewall rule only", "CSS class"], 0],
    ["Which data type stores True/False?", ["Boolean", "Integer only", "String only", "Float only"], 0],
    ["SQL is used to:", ["Query and manage relational databases", "Design only CPU circuits", "Paint images only", "Compose music only"], 0],
    ["SELECT in SQL is used to:", ["Retrieve data", "Delete the operating system", "Format a disk always", "Send phishing mail"], 0],
    ["Two-factor authentication improves security by requiring:", ["Something extra beyond password (e.g. OTP)", "Weaker passwords", "Public password posts", "No login ever"], 0],
    ["IoT refers to:", ["Internet of Things — connected devices", "Ink on Toast", "Only offline typewriters", "A type of virus only"], 0],
    ["Machine learning models improve by:", ["Learning patterns from data", "Ignoring all data", "Only hard-coded single IF forever without data", "Randomly deleting files"], 0],
    ["Backup of important files should be:", ["Regular and preferably offsite/cloud too", "Never done", "Only on the same failing disk", "Shared publicly with passwords"], 0],
    ["Open source software:", ["Provides access to source code under a license", "Can never be used in schools", "Is always malware", "Has no users"], 0],
    ["Bandwidth commonly refers to:", ["Data transfer capacity of a link", "Width of a monitor bezel only", "CPU clock only", "Printer paper size only"], 0],
    ["Which is an email protocol?", ["SMTP", "HTML only", "CSS only", "PNG"], 0],
    ["In networking, a switch typically works at:", ["Connecting devices in a LAN (data link layer device)", "Only generating electricity", "Only cooling servers with air jokes", "Replacing all routers always identically"], 0],
    ["Cookie in a browser is often used to:", ["Store small data for session/preferences", "Infect BIOS always", "Replace the CPU", "Print documents automatically always"], 0],
    ["Which is NOT an output device?", ["Keyboard", "Printer", "Speaker", "Monitor"], 0],
    ["Compiler translates:", ["High-level code to machine code (typically)", "Only images to sound", "HTML to electricity", "Passwords to OTPs only"], 0],
    ["Git is commonly used for:", ["Version control", "Only frying food", "Only antivirus signatures as OS", "Power supply design only"], 0],
    ["In Excel, =SUM(A1:A5) calculates:", ["Sum of A1 through A5", "Product only", "Average of whole sheet always", "Maximum of column Z only"], 0],
    ["Cyberbullying should be:", ["Reported and not ignored", "Encouraged", "Copied widely", "Praised"], 0],
    ["A PDF is primarily a:", ["Document format", "Programming language", "Network topology", "Type of RAM"], 0],
    ["Bluetooth is mainly for:", ["Short-range wireless communication", "Intercontinental fibre only", "Satellite TV only", "Undersea cables only"], 0],
    ["Which layer of a simple web stack serves pages to clients?", ["Web server", "Only mechanical keyboard", "UPS only", "Mouse sensor"], 0],
    ["Encryption transforms data so that:", ["Only authorised parties can read it easily", "Everyone must read it in plain form", "It becomes larger images only", "It deletes itself always"], 0],
    ["An algorithm is:", ["A step-by-step procedure to solve a problem", "A hardware fan", "Only a brand of mouse", "A type of virus"], 0],
    ["In binary, 1010 equals decimal:", ["10", "5", "8", "12"], 0],
    ["DNS translates:", ["Domain names to IP addresses", "Only images to text", "RAM to ROM", "Passwords to usernames"], 0],
  ];

  {
    const used = new Set();
    const start = (p - 1) * 4;
    const stride = 3 + (p % 3);
    for (let i = 0; i < 35; i++) {
      let idx = (start + i * stride) % compBank.length;
      let g = 0;
      while (used.has(idx) && g < compBank.length) {
        idx = (idx + 1) % compBank.length;
        g++;
      }
      used.add(idx);
      const row = compBank[idx];
      const sh = shuffleOpts(row[1][row[2]], row[1].filter((_, j) => j !== row[2]), id + p);
      push(id++, row[0], sh.options, sh.ans, C);
    }
  }

  // Achievers
  {
    push(id++, "In binary, 1101 + 1 = ?", ["1110", "1111", "1100", "1001"], 0, A, 3);
    push(id++, "Which normal form removes partial dependency on a composite key (basic idea)?", ["2NF", "1NF only", "Only physical layer", "CSS NF"], 0, A, 3);
    push(id++, "Time complexity of scanning n elements once is commonly:", ["O(n)", "O(1) always", "O(n²) only", "O(2^n) only"], 0, A, 3);
    push(id++, "Public key cryptography uses:", ["A key pair (public and private)", "Only one shared hidden sticky note always", "No keys", "Only biometric without keys ever"], 0, A, 3);
    push(id++, "Output of Python: print(2 ** 3 + 1)", ["9", "7", "8", "6"], 0, A, 3);
  }

  const finalItems = [];
  const finalAns = {};
  items.forEach((q, i) => {
    const newId = i + 1;
    finalItems.push({ ...q, id: newId });
    finalAns[String(newId)] = answersMap[String(q.id)];
  });
  const diversified = diversify(finalItems, p);
  if (diversified.length !== 50) throw new Error(`Comp p${p} ${diversified.length}`);
  if (diversified.reduce((s, q) => s + q.marks, 0) !== 60) throw new Error("comp marks");

  return {
    questions: diversified,
    answersMap: finalAns,
    subjectLabel: "computer",
    patternNote:
      "Original practice paper aligned to SOF 2023–2025 pattern & syllabus. Not an official SOF paper. ICSO pattern: Logical Reasoning 10×1 + Computers and IT 35×1 + Achievers 5×3 = 50 questions / 60 marks",
    sections: [
      { name: L, questions: 10, marksEach: 1 },
      { name: C, questions: 35, marksEach: 1 },
      { name: A, questions: 5, marksEach: 3 },
    ],
  };
}

// ───────────────────────── GK ─────────────────────────
function buildGK(paperNo) {
  const p = paperNo;
  const { items, answersMap, push } = makeBag();
  let id = 1;
  const GA = "General Awareness";
  const CA = "Current Affairs";
  const LS = "Life Skills";
  const A = "Achievers Section";

  const gaBank = [
    ["The Constitution of India came into force on:", ["26 January 1950", "15 August 1947", "26 November 1949 only as force date", "2 October 1947"], 0],
    ["Who is known as the Father of the Indian Constitution?", ["B. R. Ambedkar", "Jawaharlal Nehru", "Sardar Patel", "Rajendra Prasad only as drafter sole"], 0],
    ["The President of India is elected by:", ["An electoral college", "Direct public vote only always", "Only the Supreme Court", "Only state governors alone"], 0],
    ["Fundamental Rights are in which part of the Constitution?", ["Part III", "Part IV only", "Part I only", "Part XII"], 0],
    ["The longest river in India is:", ["The Ganga", "The Yamuna", "The Godavari as longest always", "The Narmada as longest always"], 0],
    ["The Tropic of Cancer passes through how many Indian states (commonly taught count ~8)?", ["8", "2", "15", "28"], 0],
    ["India’s highest civilian award is:", ["Bharat Ratna", "Padma Shri only highest", "Param Vir Chakra as civilian highest", "Nobel only"], 0],
    ["The national animal of India is:", ["Tiger", "Lion only national", "Elephant only national", "Peacock as animal"], 0],
    ["The national bird of India is:", ["Peacock", "Sparrow", "Eagle", "Parrot"], 0],
    ["Who wrote the national anthem ‘Jana Gana Mana’?", ["Rabindranath Tagore", "Bankim Chandra Chatterjee", "Sarojini Naidu", "Mahatma Gandhi"], 0],
    ["‘Vande Mataram’ was written by:", ["Bankim Chandra Chatterjee", "Tagore only", "Nehru", "Ambedkar"], 0],
    ["The first Prime Minister of India was:", ["Jawaharlal Nehru", "Lal Bahadur Shastri", "Indira Gandhi", "Sardar Patel"], 0],
    ["The Supreme Court of India is located in:", ["New Delhi", "Mumbai", "Kolkata", "Chennai"], 0],
    ["Which planet is known as the Red Planet?", ["Mars", "Venus", "Jupiter", "Mercury"], 0],
    ["The chemical symbol of gold is:", ["Au", "Ag", "Go", "Gd"], 0],
    ["The SI unit of force is:", ["Newton", "Joule", "Pascal", "Watt"], 0],
    ["Who discovered penicillin?", ["Alexander Fleming", "Marie Curie", "Newton", "Einstein"], 0],
    ["The largest ocean on Earth is:", ["Pacific Ocean", "Indian Ocean", "Atlantic Ocean", "Arctic Ocean"], 0],
    ["Mount Everest lies in which mountain range?", ["Himalayas", "Alps", "Andes", "Rockies"], 0],
    ["The currency of Japan is:", ["Yen", "Yuan", "Won", "Dollar"], 0],
    ["SAARC is an organisation of countries in:", ["South Asia", "South America only", "Southern Africa only", "Northern Europe only"], 0],
    ["The headquarters of the United Nations is in:", ["New York", "Geneva only as main HQ", "Paris only", "New Delhi"], 0],
    ["WHO stands for:", ["World Health Organization", "World Human Office", "Water Health Organ", "Wealth Health Org"], 0],
    ["The first battle of Panipat was fought in:", ["1526", "1556", "1761", "1857"], 0],
    ["Who led the Salt March?", ["Mahatma Gandhi", "Bhagat Singh", "Subhas Chandra Bose", "Tilak only"], 0],
    ["The Quit India Movement started in:", ["1942", "1919", "1930", "1947"], 0],
    ["Green Revolution in India is associated mainly with:", ["Food grain production increase", "Only IT boom", "Only space research", "Only cricket"], 0],
    ["RBI is the:", ["Central bank of India", "Stock exchange only", "Supreme Court wing", "Railway board"], 0],
    ["GST in India is a type of:", ["Indirect tax", "Direct income tax only", "Customs only forever without GST idea", "Local octroi only"], 0],
    ["The Indian Space Research Organisation is abbreviated:", ["ISRO", "NASA", "ESA", "DRDO only space"], 0],
    ["Which gas do plants absorb for photosynthesis?", ["Carbon dioxide", "Oxygen only", "Nitrogen only", "Hydrogen only"], 0],
    ["The hardest natural substance is:", ["Diamond", "Gold", "Iron", "Quartz only"], 0],
    ["Olympic Games are held every:", ["4 years", "2 years only summer", "10 years", "1 year"], 0],
    ["FIFA World Cup is associated with:", ["Football (soccer)", "Cricket", "Hockey only", "Tennis only"], 0],
    ["Thomas Cup is related to:", ["Badminton", "Tennis", "Hockey", "Cricket"], 0],
    ["The author of ‘Discovery of India’ is:", ["Jawaharlal Nehru", "Gandhi", "Tagore", "Ambedkar"], 0],
    ["Which is a classical dance of Kerala?", ["Kathakali", "Bharatanatyam only of Kerala", "Kathak of Kerala only", "Manipuri of Kerala only"], 0],
    ["The Thar Desert is mainly in:", ["Rajasthan", "Assam", "Kerala", "Sikkim"], 0],
    ["Sundarbans are famous for:", ["Mangrove forests and tigers", "Only deserts", "Only volcanoes", "Only glaciers"], 0],
    ["The polar satellite launch vehicle of ISRO is known as:", ["PSLV", "Hubble", "Apollo", "Soyuz only Indian"], 0],
    ["Which vitamin is produced in skin on sunlight exposure?", ["Vitamin D", "Vitamin C", "Vitamin K only", "Vitamin B12 only"], 0],
    ["Blood is purified (filtered) mainly by:", ["Kidneys", "Lungs only as filter blood cells remove", "Heart only filters", "Skin only"], 0],
    ["The instrument used to measure atmospheric pressure is:", ["Barometer", "Thermometer", "Hygrometer only pressure", "Ammeter"], 0],
    ["Which Indian city is known as the Silicon Valley of India?", ["Bengaluru", "Jaipur", "Shimla", "Varanasi only"], 0],
    ["The Non-Cooperation Movement was launched in:", ["1920", "1942", "1857", "1935"], 0],
    ["NITI Aayog replaced:", ["Planning Commission", "Supreme Court", "Election Commission", "CAG"], 0],
    ["The border between India and China is called:", ["McMahon Line (eastern sector reference)", "Radcliffe Line only China", "Durand Line India-China", "Maginot Line"], 0],
    ["Which is an SDG focus area?", ["Climate action / quality education (UN SDGs)", "Only building more landfills", "Encouraging pollution", "Banning all schools"], 0],
    ["The Indian Parliament consists of:", ["Lok Sabha and Rajya Sabha (and President)", "Only Lok Sabha", "Only Supreme Court", "Only state assemblies"], 0],
    ["Who is the ex-officio Chairman of the Rajya Sabha?", ["Vice-President of India", "Prime Minister", "Chief Justice", "Speaker of Lok Sabha"], 0],
  ];

  {
    const used = new Set();
    const start = (p - 1) * 6;
    const stride = 2 + (p % 4);
    for (let i = 0; i < 30; i++) {
      let idx = (start + i * stride) % gaBank.length;
      let g = 0;
      while (used.has(idx) && g < gaBank.length) {
        idx = (idx + 1) % gaBank.length;
        g++;
      }
      used.add(idx);
      const row = gaBank[idx];
      const sh = shuffleOpts(row[1][row[2]], row[1].filter((_, j) => j !== row[2]), id + p);
      push(id++, row[0], sh.options, sh.ans, GA);
    }
  }

  const caBank = [
    ["G20 is a forum of major:", ["Economies", "Only football clubs", "Only universities", "Only film studios"], 0],
    ["COP meetings are mainly associated with:", ["Climate change negotiations", "Only cricket rules", "Only space tourism", "Only fashion"], 0],
    ["Digital Public Infrastructure discussions in India often mention:", ["Aadhaar, UPI and data exchange layers", "Only steam engines", "Only typewriters", "Only floppy disks as future"], 0],
    ["Renewable energy expansion worldwide often focuses on:", ["Solar and wind", "Only increasing coal always", "Banning electricity", "Stopping research"], 0],
    ["The International Court of Justice is based in:", ["The Hague", "Mumbai", "Tokyo only", "Cairo only"], 0],
    ["BRICS is a grouping of:", ["Emerging economies", "Only European monarchies", "Only island cricket teams", "Only language clubs"], 0],
    ["Cybersecurity awareness aims to promote:", ["Safer digital practices", "Password sharing publicly", "Virus creation", "Ignoring updates"], 0],
    ["Sustainable Development Goals (SDGs) were adopted by:", ["United Nations", "Only one private company", "Only FIFA", "Only a school board"], 0],
    ["Olympic spirit emphasises:", ["Excellence, respect and friendship", "Only winning by cheating", "Avoiding sports", "Ignoring athletes"], 0],
    ["Financial literacy campaigns encourage:", ["Saving, budgeting and safe digital payments", "Sharing OTPs", "Ignoring bank alerts", "Fraud schemes"], 0],
    ["Space missions headlines often involve:", ["Satellites and scientific exploration", "Only underwater baskets", "Only bakery contests", "Only stamp collecting"], 0],
    ["Global health agencies frequently advise on:", ["Vaccination and hygiene", "Avoiding all medicine forever", "Only astrology", "Ignoring clean water"], 0],
  ];
  for (let i = 0; i < 10; i++) {
    const row = caBank[(i + p - 1) % caBank.length];
    const sh = shuffleOpts(row[1][row[2]], row[1].filter((_, j) => j !== row[2]), id + p);
    push(id++, row[0], sh.options, sh.ans, CA);
  }

  const lsBank = [
    ["If a classmate is bullied, you should:", ["Support them and report to a trusted adult", "Join the bullying", "Film and mock them", "Ignore forever without help"], 0],
    ["A good way to manage exam stress is to:", ["Plan studies and take short breaks", "Skip all sleep for a week", "Never ask doubts", "Panic without a timetable"], 0],
    ["Respecting others' opinions even when you disagree shows:", ["Tolerance and maturity", "Weakness only", "Dishonesty", "Fear of books"], 0],
    ["If you receive a suspicious email asking for OTP, you should:", ["Not share OTP and verify safely", "Send OTP immediately", "Forward to everyone", "Call unknown numbers from the mail"], 0],
    ["Teamwork in a group project mainly requires:", ["Cooperation and clear communication", "Doing nothing", "Blaming only", "Hiding information always"], 0],
    ["Saying please and thank you is part of:", ["Good manners", "Rudeness", "Only exam rules", "Mathematics only"], 0],
    ["Time management for board exams includes:", ["A realistic timetable and revision slots", "Only last-night cramming forever", "Avoiding all practice", "Skipping meals always"], 0],
    ["Empathy means:", ["Understanding others' feelings", "Ignoring everyone", "Mocking weakness", "Never listening"], 0],
  ];
  {
    const used = new Set();
    for (let i = 0; i < 5; i++) {
      let idx = (i + p) % lsBank.length;
      while (used.has(idx)) idx = (idx + 1) % lsBank.length;
      used.add(idx);
      const row = lsBank[idx];
      push(id++, row[0], row[1].slice(), row[2], LS);
    }
  }

  // Achievers
  {
    push(id++, "Which schedule of the Indian Constitution deals with languages (Eighth)?", ["Eighth Schedule", "First Schedule only", "Tenth only always", "Preamble only"], 0, A, 3);
    push(id++, "The Directive Principles of State Policy are in:", ["Part IV", "Part III only", "Part II only", "Part XVIII only"], 0, A, 3);
    push(id++, "Who chairs the GST Council?", ["Union Finance Minister", "Chief Justice of India", "Speaker of Lok Sabha only", "RBI Governor only as chair"], 0, A, 3);
    push(id++, "The Tropic of Cancer does NOT pass through:", ["Kerala", "Gujarat", "Rajasthan", "West Bengal"], 0, A, 3);
    push(id++, "Article 21 of the Indian Constitution primarily protects:", ["Right to life and personal liberty", "Only right to property as absolute", "Only voting age", "Only free air travel"], 0, A, 3);
  }

  const finalItems = [];
  const finalAns = {};
  items.forEach((q, i) => {
    const newId = i + 1;
    finalItems.push({ ...q, id: newId });
    finalAns[String(newId)] = answersMap[String(q.id)];
  });
  const diversified = diversify(finalItems, p);
  if (diversified.length !== 50) throw new Error(`GK p${p} ${diversified.length}`);
  if (diversified.reduce((s, q) => s + q.marks, 0) !== 60) throw new Error("gk marks");

  return {
    questions: diversified,
    answersMap: finalAns,
    subjectLabel: "gk",
    patternNote:
      "Original practice paper aligned to SOF 2023–2025 pattern & syllabus. Not an official SOF paper. IGKO pattern: General Awareness 30×1 + Current Affairs 10×1 + Life Skills 5×1 + Achievers 5×3 = 50 questions / 60 marks",
    sections: [
      { name: GA, questions: 30, marksEach: 1 },
      { name: CA, questions: 10, marksEach: 1 },
      { name: LS, questions: 5, marksEach: 1 },
      { name: A, questions: 5, marksEach: 3 },
    ],
  };
}

function validatePaper(subject, paperNo, built) {
  const { questions, answersMap } = built;
  const n = questions.length;
  if (Object.keys(answersMap).length !== n) {
    throw new Error(`${subject} p${paperNo}: answer count mismatch`);
  }
  let marks = 0;
  for (const q of questions) {
    marks += q.marks;
    const a = answersMap[String(q.id)];
    if (a === undefined || a < 0 || a > 3) throw new Error(`${subject} p${paperNo} Q${q.id} bad ans`);
    if (!q.options || q.options.length !== 4) throw new Error(`${subject} p${paperNo} Q${q.id} opts`);
    // unique options
    const set = new Set(q.options.map(String));
    if (set.size !== 4) {
      console.warn(`WARN ${subject} p${paperNo} Q${q.id} duplicate options: ${q.options.join(" | ")}`);
    }
  }
  const expectMarks = {
    mathematics: 50,
    science: 60,
    english: 60,
    computer: 60,
    gk: 60,
  }[subject];
  const expectQ = {
    mathematics: 40,
    science: 50,
    english: 60,
    computer: 50,
    gk: 50,
  }[subject];
  if (n !== expectQ) throw new Error(`${subject} p${paperNo}: Q ${n} != ${expectQ}`);
  if (marks !== expectMarks) throw new Error(`${subject} p${paperNo}: marks ${marks} != ${expectMarks}`);
  return { n, marks };
}

function main() {
  const builders = {
    mathematics: buildMath,
    science: buildScience,
    english: buildEnglish,
    computer: buildComputer,
    gk: buildGK,
  };

  const summary = [];

  for (const [subject, builder] of Object.entries(builders)) {
    for (const n of PAPERS) {
      const built = builder(n);
      // align subject folder name
      const folder = subject;
      validatePaper(subject, n, built);
      const res = writePair(folder, n, built.questions, {
        subjectLabel: built.subjectLabel,
        patternNote: built.patternNote,
        sections: built.sections,
        answersMap: built.answersMap,
      });
      summary.push({ subject, paper: n, ...res });
      console.log(
        `Wrote class10/${subject} paper${n}: ${res.totalQ}Q, ${res.totalMarks} marks, ${res.answers} answers`
      );
    }
  }

  console.log("\nDone. Original Class 10 SOF-pattern practice (2023–2025 style).");
  console.log(JSON.stringify(summary, null, 2));
}

main();

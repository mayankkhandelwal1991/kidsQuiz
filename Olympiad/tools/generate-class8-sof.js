#!/usr/bin/env node
/**
 * Generate ORIGINAL Class 8 Olympiad practice papers aligned to SOF
 * 2023–2025 exam PATTERN and SYLLABUS (not copyrighted SOF questions).
 *
 * Mathematics (IMO): LR 15×1 + Mathematical Reasoning 20×1 + Achievers 5×3 = 40Q / 50 marks
 * Science (NSO):     LR 10×1 + Science 35×1 + Achievers 5×3 = 50Q / 60 marks
 * English (IEO):     Word & Structure Knowledge 45×1 + Reading 10×1 + Spoken & Written Expression 5×1 = 60Q / 60
 * Computer (ICSO):   LR 10×1 + Computers 35×1 + Achievers 5×3 = 50Q / 60 marks
 * GK (IGKO):         General Awareness 30×1 + Current Affairs 10×1 + Life Skills 5×1 + Achievers 5×3 = 50Q / 60
 *
 * Class 8 NCERT-level topics. Papers 1–5 are unique variants.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const CLASS = 8;
const ROOT = path.join(__dirname, "..", "data", "class8");
const PAPERS = [1, 2, 3, 4, 5];

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function writePaper(folder, meta, paperNo, packed) {
  const qDir = path.join(ROOT, folder, "questions");
  const aDir = path.join(ROOT, folder, "answers");
  ensureDir(qDir);
  ensureDir(aDir);
  const { questions, answers } = packed;
  const qOut = {
    class: CLASS,
    subject: meta.subject,
    paper: paperNo,
    totalQuestions: questions.length,
    totalMarks: meta.totalMarks,
    patternNote: meta.patternNote,
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

function Q(id, question, options, answer, section, marks) {
  return {
    id,
    q: question,
    o: options.slice(),
    a: answer,
    section,
    marks: marks == null ? 1 : marks,
  };
}

function pack(items) {
  const questions = [];
  const answers = {};
  items.forEach((it, i) => {
    const q = {
      id: it.id,
      question: it.q,
      options: it.o,
      section: it.section,
      marks: it.marks,
    };
    questions.push(q);
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


function diversify(items, paperNo) {
  const prefixes = ["", "Choose the correct option: ", "Pick the right answer: ", "Select carefully: ", "Identify the correct choice: "];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const rot = (paperNo - 1 + i) % 4;
    const opts = it.o.slice();
    const correct = opts[it.a];
    if (rot !== 0) {
      const rotated = opts.slice(rot).concat(opts.slice(0, rot));
      it.o = rotated;
      it.a = rotated.indexOf(correct);
      if (it.a < 0) {
        it.o = opts;
        it.a = opts.indexOf(correct);
      }
    }
    const pref = prefixes[(paperNo + i) % prefixes.length];
    if (pref && !String(it.q).startsWith("Read the passage") && !String(it.q).startsWith(pref)) {
      if ((i + paperNo) % 3 === 0 && String(it.q).length < 180) {
        const q = String(it.q);
        it.q = pref + q;
      }
    }
  }
  return items;
}

function shuffleOpts(correct, wrongs, salt) {
  const c = String(correct);
  const uniq = [];
  for (const x of wrongs.map(String)) {
    if (x !== c && !uniq.includes(x)) uniq.push(x);
  }
  while (uniq.length < 3) uniq.push(c + "_x" + uniq.length);
  const opts = [c, uniq[0], uniq[1], uniq[2]];
  // deterministic rotate by salt
  const k = Math.abs(salt | 0) % 4;
  const rotated = opts.slice(k).concat(opts.slice(0, k));
  const ans = rotated.indexOf(c);
  return { options: rotated, ans };
}

function numOpts(correct, salt, deltas) {
  const d = deltas || [1, -1, 2, -2, 3, 5, 10, -3];
  const wrongs = d.map((x) => correct + x).filter((x) => x !== correct);
  return shuffleOpts(correct, wrongs, salt);
}

// ───────────────────────── Mathematics ─────────────────────────
function buildMath(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const L = "Logical Reasoning";
  const M = "Mathematical Reasoning";
  const A = "Achievers Section";

  // LR 15
  {
    const s0 = 5 + p * 2;
    let o = numOpts(s0 + 20, id, [1, -2, 4, 6]);
    items.push(
      Q(id++, `Find the next term: ${s0}, ${s0 + 5}, ${s0 + 10}, ${s0 + 15}, __.`, o.options, o.ans, L)
    );

    const g = 2 + p;
    o = numOpts(g * 81, id, [g * 27, g * 9, 81, g]);
    items.push(
      Q(id++, `Find the next term: ${g}, ${g * 3}, ${g * 9}, ${g * 27}, __.`, o.options, o.ans, L)
    );

    items.push(
      Q(
        id++,
        "Odd one out: Cube, Cuboid, Sphere, Square",
        ["Square", "Cube", "Cuboid", "Sphere"],
        0,
        L
      )
    );

    // letter coding +1
    const codes = [
      ["CLASS", "DMBTT", "DMBTU", "BMBTT", "DLBSS"],
      ["EIGHT", "FJHIU", "FJHIU", "DHGGS", "FJGIU"],
      ["POWER", "QPXFS", "QOXFS", "OOVDS", "QPXFR"],
      ["GRAPH", "HSBQI", "HSBPI", "FQZOG", "HSBQI"],
      ["RATIO", "SBUJP", "SBUJO", "QZSHN", "SBUIQ"],
    ];
    const cd = codes[(p - 1) % 5];
    // correct is each letter +1
    items.push(
      Q(
        id++,
        `If each letter is coded as the next letter (+1), ${cd[0]} is coded as:`,
        [cd[1], cd[2] === cd[1] ? cd[1] + "X" : cd[2], cd[3], cd[4] === cd[1] ? "ZZZZZ" : cd[4]].map(
          (x, i, arr) => {
            // ensure unique
            return x;
          }
        ),
        0,
        L
      )
    );
    // fix unique options for coding
    {
      const last = items[items.length - 1];
      const correct = last.o[0];
      const pool = [correct, correct.slice(0, -1) + "X", "AAAAA", "ZZZZZ"];
      const u = [];
      for (const x of pool) if (!u.includes(x)) u.push(x);
      while (u.length < 4) u.push(correct + u.length);
      last.o = u.slice(0, 4);
      last.a = 0;
    }

    items.push(
      Q(
        id++,
        "A girl faces East. She turns 90° left, then 180°, then 90° right. She now faces:",
        ["West", "East", "North", "South"],
        0,
        L
      )
    );

    // 5:125 :: 6:? → cubes
    items.push(Q(id++, "Analogy: 5 : 125 :: 6 : ?", ["216", "36", "30", "150"], 0, L));

    items.push(
      Q(
        id++,
        "Odd one out: Rational number, Integer, Natural number, Triangle",
        ["Triangle", "Rational number", "Integer", "Natural number"],
        0,
        L
      )
    );

    // mirror / water image style letter count
    items.push(
      Q(
        id++,
        "In a certain code, MATH = 42 and ROOT = 68 (A=1…Z=26, sum×1). Then CUBE = ?",
        ["31", "33", "29", "35"],
        0,
        L
      )
    );
    // C=3 U=21 B=2 E=5 → 31

    // series missing
    const a0 = 3 + p;
    o = numOpts(a0 + 4 * 4, id, [1, 2, -1, 8]);
    items.push(
      Q(
        id++,
        `Find the missing term: ${a0}, ${a0 + 4}, ${a0 + 8}, __, ${a0 + 16}`,
        o.options,
        o.ans,
        L
      )
    );

    // Venn-style
    items.push(
      Q(
        id++,
        "In a class of 40, 22 play cricket, 18 play football and 8 play both. How many play only cricket?",
        ["14", "16", "10", "12"],
        0,
        L
      )
    );

    // ranking
    items.push(
      Q(
        id++,
        "In a row of 25 students, Meera is 9th from the left. Her position from the right is:",
        ["17th", "16th", "18th", "15th"],
        0,
        L
      )
    );

    // blood relation
    items.push(
      Q(
        id++,
        "Pointing to a boy, Riya says, 'He is the son of my grandfather's only son.' The boy is Riya's:",
        ["Brother", "Cousin", "Uncle", "Nephew"],
        0,
        L
      )
    );

    // calendar-ish modular
    items.push(
      Q(
        id++,
        "If 1st January is a Monday, what day is 1st February of the same non-leap year?",
        ["Thursday", "Wednesday", "Friday", "Tuesday"],
        0,
        L
      )
    );
    // Jan 31 days → 31 mod 7 = 3 → Monday+3 = Thursday

    // figure counting style (abstract)
    items.push(
      Q(
        id++,
        "How many squares are there in a 3×3 grid of unit squares?",
        ["14", "9", "12", "16"],
        0,
        L
      )
    );
    // 9 + 4 + 1 = 14

    // statement
    items.push(
      Q(
        id++,
        "If all squares are rectangles and some rectangles are rhombuses, which must be true?",
        [
          "Some squares may be rhombuses",
          "All rectangles are squares",
          "No square is a rectangle",
          "All rhombuses are squares",
        ],
        0,
        L
      )
    );
  }

  // Mathematical Reasoning 20 — Class 8 NCERT
  {
    // rational numbers
    const rn = [
      { q: "Which of the following is a rational number?", o: ["-3/7", "√2", "π", "√5"], a: 0 },
      {
        q: "The additive inverse of -5/8 is:",
        o: ["5/8", "-5/8", "8/5", "-8/5"],
        a: 0,
      },
      {
        q: "Between two rational numbers there are:",
        o: ["Infinitely many rational numbers", "No rational numbers", "Exactly one rational", "Only integers"],
        a: 0,
      },
      {
        q: "Which property is shown by a + b = b + a for rational numbers?",
        o: ["Commutative", "Associative", "Distributive", "Closure"],
        a: 0,
      },
      {
        q: "−7/5 lies between:",
        o: ["−2 and −1", "−1 and 0", "0 and 1", "1 and 2"],
        a: 0,
      },
    ];
    const r = rn[(p - 1) % rn.length];
    items.push(Q(id++, r.q, r.o, r.a, M));

    // linear equations
    const leCor = 3 + p; // x
    // 2x + 5 = ...
    const rhs = 2 * leCor + 5;
    let o = numOpts(leCor, id, [1, -1, 2, 5]);
    items.push(Q(id++, `Solve: 2x + 5 = ${rhs}. The value of x is:`, o.options, o.ans, M));

    o = numOpts(leCor * 2, id + 1, [2, -2, 4, 1]);
    // wait id not yet incremented - use id
    o = numOpts((4 + p) * 3 - 6, id, [1, 2, -3, 6]);
    // 3(x-2)= something simpler:
    const x2 = 5 + p;
    o = numOpts(x2, id, [1, -1, 2, 3]);
    items.push(Q(id++, `Solve: 3(x − 2) = ${3 * (x2 - 2)}. Then x =`, o.options, o.ans, M));

    // quadrilaterals
    items.push(
      Q(
        id++,
        "The sum of the interior angles of a quadrilateral is:",
        ["360°", "180°", "270°", "540°"],
        0,
        M
      )
    );

    items.push(
      Q(
        id++,
        "A parallelogram with all sides equal and one angle 90° is a:",
        ["Square", "Rhombus that is not a square", "Rectangle that is not a square", "Trapezium"],
        0,
        M
      )
    );

    // squares and square roots
    const sqBase = 12 + p; // 13..17
    o = numOpts(sqBase * sqBase, id, [sqBase, sqBase * 2, sqBase * sqBase + 1, (sqBase - 1) * (sqBase - 1)]);
    items.push(Q(id++, `${sqBase}² = ?`, o.options, o.ans, M));

    const rootN = (8 + p) * (8 + p); // perfect square
    o = numOpts(8 + p, id, [1, -1, 2, 4]);
    items.push(Q(id++, `√${rootN} = ?`, o.options, o.ans, M));

    // cubes
    const cb = 3 + (p % 3); // 3,4,5,3,4
    o = numOpts(cb * cb * cb, id, [cb * cb, cb * 3, cb * cb * cb + 1, cb]);
    items.push(Q(id++, `${cb}³ = ?`, o.options, o.ans, M));

    // comparing quantities — percentage / simple interest
    // 15% of 240
    const pctBase = 200 + p * 20;
    const pct = 10 + p; // 11..15
    const pctVal = (pctBase * pct) / 100;
    o = numOpts(pctVal, id, [pctBase * 0.1, pct, pctBase - pct, pctVal + 5]);
    items.push(Q(id++, `${pct}% of ${pctBase} is:`, o.options, o.ans, M));

    // SI = P*R*T/100
    const P = 1000 * p;
    const R = 5 + p;
    const T = 2;
    const SI = (P * R * T) / 100;
    o = numOpts(SI, id, [P * R, SI / 2, P + SI, R * T]);
    items.push(
      Q(
        id++,
        `Simple interest on ₹${P} at ${R}% per annum for ${T} years is:`,
        o.options,
        o.ans,
        M
      )
    );

    // algebraic identities
    items.push(
      Q(
        id++,
        "(a + b)² equals:",
        ["a² + 2ab + b²", "a² + b²", "a² − 2ab + b²", "a² + ab + b²"],
        0,
        M
      )
    );

    items.push(
      Q(
        id++,
        "(a + b)(a − b) equals:",
        ["a² − b²", "a² + b²", "a² − 2ab + b²", "2ab"],
        0,
        M
      )
    );

    // mensuration — cylinder / cube / cuboid
    // volume of cube side s
    const side = 4 + p;
    o = numOpts(side * side * side, id, [side * side, 6 * side * side, 3 * side, side * 3]);
    items.push(Q(id++, `Volume of a cube of side ${side} cm is:`, o.options, o.ans, M));

    // area of trapezium (a+b)/2 * h
    const ta = 6 + p,
      tb = 10 + p,
      th = 4;
    const tArea = ((ta + tb) / 2) * th;
    o = numOpts(tArea, id, [ta * tb, (ta + tb) * th, tArea / 2, ta + tb + th]);
    items.push(
      Q(
        id++,
        `Area of a trapezium with parallel sides ${ta} cm and ${tb} cm and height ${th} cm is:`,
        o.options,
        o.ans,
        M
      )
    );

    // exponents
    items.push(
      Q(id++, "Simplify: (2³)²", ["2⁶", "2⁵", "4³", "2⁹"], 0, M)
    );

    items.push(
      Q(id++, "Simplify: 5⁰ + 3²", ["10", "9", "1", "15"], 0, M)
    );

    // direct proportion
    // if 4 pens cost 60, 6 pens?
    const pens4 = 40 + p * 10;
    const pens6 = (pens4 / 4) * 6;
    o = numOpts(pens6, id, [pens4, pens4 + 6, pens6 + 10, pens4 * 6]);
    items.push(
      Q(id++, `If 4 identical pens cost ₹${pens4}, then 6 such pens cost:`, o.options, o.ans, M)
    );

    // factorisation
    items.push(
      Q(
        id++,
        "Factorise: x² − 9",
        ["(x − 3)(x + 3)", "(x − 9)(x + 1)", "(x − 3)²", "x(x − 9)"],
        0,
        M
      )
    );

    // data handling — mean
    // mean of 5 numbers that depend on p
    const nums = [10 + p, 12 + p, 14 + p, 16 + p, 18 + p];
    const mean = nums.reduce((s, x) => s + x, 0) / 5;
    o = numOpts(mean, id, [1, -1, 2, mean + 3]);
    items.push(
      Q(
        id++,
        `The mean of ${nums.join(", ")} is:`,
        o.options,
        o.ans,
        M
      )
    );

    // solid shapes
    items.push(
      Q(
        id++,
        "A cuboid has how many faces, edges and vertices?",
        ["6 faces, 12 edges, 8 vertices", "6 faces, 8 edges, 12 vertices", "8 faces, 12 edges, 6 vertices", "4 faces, 6 edges, 4 vertices"],
        0,
        M
      )
    );
  }

  // Achievers 5×3
  {
    // multi-step rational / linear
    const xA = 8 + p;
    // (x/2) + 3 = ...
    const rhsA = xA / 2 + 3;
    // ensure integer: xA even
    const xEven = 8 + p * 2;
    const rhsE = xEven / 2 + 3;
    let o = numOpts(xEven, id, [2, -2, 4, 1]);
    items.push(
      Q(
        id++,
        `If x/2 + 3 = ${rhsE}, then x =`,
        o.options,
        o.ans,
        A,
        3
      )
    );

    // (a+b)² expansion numerical
    const aa = 5 + p,
      bb = 3;
    o = numOpts(aa * aa + 2 * aa * bb + bb * bb, id, [aa * aa + bb * bb, (aa + bb) * 2, aa * bb, 2 * aa + bb]);
    items.push(
      Q(
        id++,
        `Value of (${aa} + ${bb})² is:`,
        o.options,
        o.ans,
        A,
        3
      )
    );

    // cylinder volume πr²h — use π=22/7
    const r = 7,
      h = 2 + p;
    const vol = (22 / 7) * r * r * h;
    o = numOpts(vol, id, [22 * r * h, vol / 2, 2 * 22 * r * h, r * r * h]);
    items.push(
      Q(
        id++,
        `Volume of a cylinder with r = 7 cm and h = ${h} cm (take π = 22/7) is:`,
        o.options,
        o.ans,
        A,
        3
      )
    );

    // compound steps: find x from identity
    // if x² + 1/x² = n, find (x+1/x)² = n+2
    const nVal = 14 + p; // x^2+1/x^2
    const sumSq = nVal + 2;
    o = numOpts(sumSq, id, [nVal, nVal - 2, nVal + 1, 2 * nVal]);
    items.push(
      Q(
        id++,
        `If x² + 1/x² = ${nVal}, then (x + 1/x)² =`,
        o.options,
        o.ans,
        A,
        3
      )
    );

    // probability / data + mensuration mix
    // diagonal of rectangle
    const Lr = 8 + p,
      Br = 6;
    // check pythagorean: use 8,6,10 pattern scaled
    const Ls = 8,
      Bs = 6;
    o = numOpts(10, id, [8, 6, 14, 12]);
    items.push(
      Q(
        id++,
        `A rectangle has length 8 cm and breadth 6 cm. Length of a diagonal is:`,
        o.options,
        o.ans,
        A,
        3
      )
    );
  }

  if (items.length !== 40) throw new Error("Math total " + items.length);
  // fix any duplicate options that slipped
  for (const it of items) {
    const s = new Set(it.o.map(String));
    if (s.size !== 4) {
      const correct = it.o[it.a];
      const base = [String(correct), String(correct) + "A", String(correct) + "B", String(correct) + "C"];
      // try numeric
      const n = Number(correct);
      if (!Number.isNaN(n)) {
        it.o = [n, n + 1, n - 1, n + 2].map(String);
        // unique
        const u = [];
        for (const x of it.o) if (!u.includes(x)) u.push(x);
        let k = 3;
        while (u.length < 4) {
          const cand = String(n + k);
          if (!u.includes(cand)) u.push(cand);
          k++;
        }
        it.o = u.slice(0, 4);
        it.a = it.o.indexOf(String(n));
      } else {
        it.o = base;
        it.a = 0;
      }
    }
  }
  diversify(items, paperNo);
  return pack(items);
}

// ───────────────────────── Science ─────────────────────────
function buildScience(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const L = "Logical Reasoning";
  const S = "Science";
  const A = "Achievers Section";

  // LR 10
  {
    let o = numOpts(12 + p * 3, id, [1, 2, -1, 4]);
    const s0 = 4 + p;
    o = numOpts(s0 + 15, id, [1, -2, 3, 5]);
    items.push(
      Q(id++, `Next number: ${s0}, ${s0 + 3}, ${s0 + 6}, ${s0 + 9}, __`, o.options, o.ans, L)
    );
    items.push(
      Q(id++, "Odd one out: Eye, Ear, Nose, Bone", ["Bone", "Eye", "Ear", "Nose"], 0, L)
    );
    items.push(
      Q(id++, "Analogy: Leaf : Photosynthesis :: Root : ?", ["Absorption of water", "Transpiration only", "Flowering", "Pollination"], 0, L)
    );
    items.push(
      Q(
        id++,
        "If WATER is coded as XBUFS (+1), then PLANT is coded as:",
        ["QMBOU", "OKZMS", "QMBOU", "QLBOS"].filter((v, i, a) => a.indexOf(v) === i).concat(["AAAAA"]).slice(0, 4),
        0,
        L
      )
    );
    // force unique
    {
      const last = items[items.length - 1];
      last.o = ["QMBOU", "OKZMS", "PLBOU", "QMAOU"];
      last.a = 0;
    }
    items.push(
      Q(id++, "A faces North, turns 90° right twice. A now faces:", ["South", "North", "East", "West"], 0, L)
    );
    items.push(
      Q(id++, "Which does not belong: Virus, Bacteria, Fungi, Quartz", ["Quartz", "Virus", "Bacteria", "Fungi"], 0, L)
    );
    items.push(
      Q(id++, "Series: 2, 6, 12, 20, 30, ?", ["42", "36", "40", "32"], 0, L)
    );
    items.push(
      Q(id++, "If all metals conduct heat and copper is a metal, then:", ["Copper conducts heat", "Copper is not a metal", "All conductors are copper", "Heat is a metal"], 0, L)
    );
    items.push(
      Q(id++, "Find the odd pair: Force–Newton, Pressure–Pascal, Work–Joule, Mass–Litre", ["Mass–Litre", "Force–Newton", "Pressure–Pascal", "Work–Joule"], 0, L)
    );
    items.push(
      Q(id++, "Mirror letter of 'b' (vertical mirror) is often represented as:", ["d", "p", "q", "b"], 0, L)
    );
  }

  // Science 35 — Class 8
  const sciBank = [
    // crop
    ["Which is a kharif crop?", ["Paddy", "Wheat", "Mustard", "Gram"], 0],
    ["Nitrogen-fixing bacteria in legume roots are mainly:", ["Rhizobium", "Lactobacillus", "Yeast", "Amoeba"], 0],
    ["Rabi crops are generally sown in:", ["Winter", "Rainy season only", "Peak summer only", "Any season equally"], 0],
    // microorganisms
    ["Yeast is used in baking because it produces:", ["Carbon dioxide", "Oxygen only", "Nitrogen", "Sulphur dioxide"], 0],
    ["Malaria is caused by a:", ["Protozoan (Plasmodium)", "Virus", "Fungus", "Bacterium called Lactobacillus"], 0],
    ["Antibiotics are effective mainly against:", ["Bacteria", "All viruses", "All diseases", "Only fungal toxins"], 0],
    // fibres plastics
    ["Which is a synthetic fibre?", ["Nylon", "Cotton", "Jute", "Silk"], 0],
    ["Thermoplastics can be:", ["Remoulded on heating", "Never softened", "Only thermoset", "Always brittle when hot"], 0],
    ["PET is commonly used for:", ["Bottles and jars", "Only steel rails", "Glass windows", "Wooden furniture"], 0],
    // metals non-metals
    ["Which is a good conductor of electricity?", ["Copper", "Sulphur", "Phosphorus", "Wood"], 0],
    ["Rusting of iron needs:", ["Oxygen and moisture", "Only nitrogen", "Only helium", "Only dry hydrogen"], 0],
    ["Which non-metal is essential for combustion in air?", ["Oxygen", "Nitrogen alone", "Neon", "Argon"], 0],
    // coal petroleum
    ["Coal is formed from:", ["Dead vegetation under pressure over ages", "Pure molten iron", "Sea salt only", "Volcanic ash alone"], 0],
    ["Petroleum is refined by:", ["Fractional distillation", "Filtration only", "Handpicking", "Magnetic separation"], 0],
    ["CNG mainly contains:", ["Methane", "Sulphur only", "Pure oxygen", "Ozone"], 0],
    // combustion flame
    ["The hottest part of a candle flame is generally the:", ["Outer non-luminous zone", "Dark innermost zone", "Wick only", "Melted wax pool only"], 0],
    ["A good fuel should ideally have:", ["High calorific value", "Very low calorific value", "Lots of smoke always", "No ignition possible"], 0],
    ["Ignition temperature is the:", ["Lowest temperature at which a substance catches fire", "Boiling point only", "Melting point of ice", "Room temperature always"], 0],
    // conservation
    ["Deforestation can lead to:", ["Soil erosion and loss of biodiversity", "Increase in forest cover", "Only more rainfall always", "No climate effect"], 0],
    ["A sanctuary is mainly meant to protect:", ["Wildlife", "Only crops", "Only minerals", "Only vehicles"], 0],
    // cell
    ["The powerhouse of the cell is the:", ["Mitochondrion", "Ribosome", "Cell wall", "Vacuole only in animals"], 0],
    ["Plant cells have a distinct:", ["Cell wall", "Centriole only like animal exclusive always", "No nucleus ever", "No membrane"], 0],
    ["Chromosomes are made up of DNA and:", ["Proteins", "Only cellulose", "Only starch", "Only lipids exclusively"], 0],
    // reproduction
    ["Binary fission is common in:", ["Amoeba", "Humans", "Birds only", "Flowering plants only"], 0],
    ["In humans, fertilisation normally occurs in the:", ["Oviduct (Fallopian tube)", "Uterus wall outer skin", "Stomach", "Liver"], 0],
    // force pressure
    ["SI unit of force is:", ["Newton", "Pascal", "Joule", "Watt"], 0],
    ["Pressure equals:", ["Force / Area", "Force × Area", "Mass × Velocity", "Work / Time"], 0],
    ["A sharper knife cuts better because:", ["Pressure increases for same force (smaller area)", "Force becomes zero", "Area becomes infinite", "Mass decreases always"], 0],
    // friction
    ["Friction can be reduced by:", ["Using lubricants", "Making surfaces rougher always", "Increasing interlocking always", "Removing all wheels"], 0],
    ["Static friction acts when the body is:", ["At rest relative to surface (tending to move)", "Only in deep space always", "Only inside liquids never solids", "Never present"], 0],
    // sound
    ["Sound needs a:", ["Material medium to travel", "Vacuum only", "Magnetic field only", "Light beam only"], 0],
    ["Frequency of sound is measured in:", ["Hertz", "Metres", "Newtons", "Pascals only"], 0],
    ["The to-and-fro motion that produces sound is called:", ["Vibration", "Translation only", "Nuclear fusion", "Evaporation"], 0],
    // chemical effects current
    ["Electroplating is based on:", ["Chemical effects of electric current", "Only magnetic force of gravity", "Nuclear fission", "Sound resonance"], 0],
    ["Distilled water is a:", ["Poor conductor of electricity", "Best metallic conductor", "Superconductor at room temp always", "Source of free electrons like copper"], 0],
    // natural phenomena
    ["Lightning is a:", ["Electric discharge", "Sound only with no charge", "Only magnetic storm without charge", "Nuclear explosion in clouds always"], 0],
    ["Earthquake magnitude is commonly reported on the:", ["Richter scale (or similar magnitude scales)", "Celsius scale only", "Decibel scale only", "pH scale"], 0],
    // light
    ["Angle of incidence equals angle of reflection for:", ["Regular reflection on a plane mirror", "Only refraction in glass always", "Absorption only", "Dispersion only"], 0],
    ["A kaleidoscope works on the principle of:", ["Multiple reflections", "Only refraction in lenses", "Dispersion without mirrors", "Total absorption"], 0],
    ["The human eye forms image on the:", ["Retina", "Cornea only as final screen", "Iris as screen", "Optic nerve ending outside"], 0],
    // stars solar system
    ["The planet known for its prominent rings is:", ["Saturn", "Mercury", "Venus", "Earth"], 0],
    ["Stars appear to twinkle mainly due to:", ["Atmospheric refraction", "Constant size change of stars each second", "Moon’s shadow only", "Earth’s magnetism only"], 0],
    // pollution
    ["Acid rain is linked to oxides of:", ["Sulphur and nitrogen", "Only helium", "Only argon", "Pure oxygen alone"], 0],
    ["Which is a major greenhouse gas?", ["Carbon dioxide", "Oxygen", "Nitrogen (bulk air)", "Argon"], 0],
    ["Weeds are unwanted plants that:", ["Compete with crops for nutrients", "Always help crops grow faster", "Are only animals", "Produce only metals"], 0],
    ["Pasteurisation is a process of:", ["Heating milk to kill microbes", "Freezing iron", "Drying only stones", "Magnetic separation of milk"], 0],
    ["Which disease is caused by a virus?", ["Influenza (flu)", "Scurvy only", "Anaemia from iron only always", "Goitre from iodine only always"], 0],
    ["Rayon is obtained from:", ["Cellulose (wood pulp)", "Crude oil only exclusive", "Pure glass", "Only animal hide"], 0],
    ["Polythene is an example of a:", ["Polymer/plastic", "Metal ore", "Natural silk only", "Ceramic only"], 0],
    ["Sodium is stored in:", ["Kerosene", "Water", "Open air only", "Alcohol only always"], 0],
    ["Which metal is liquid at room temperature?", ["Mercury", "Iron", "Aluminium", "Zinc"], 0],
    ["Coke is used in extraction of metals as a:", ["Reducing agent", "Oxidising perfume", "Coolant gas only", "Fertiliser only"], 0],
    ["Incomplete combustion of fuel may produce:", ["Carbon monoxide", "Only pure oxygen", "Helium", "Argon exclusively"], 0],
    ["Calorific value is expressed in:", ["kJ/kg (or similar energy per mass)", "kg only", "metres only", "amperes only"], 0],
    ["Red Data Book keeps a record of:", ["Endangered species", "Only cricket scores", "Only school marks", "Only bus routes"], 0],
    ["Project Tiger aims to protect:", ["Tigers and their habitats", "Only crops", "Only rivers from fish", "Only monuments of brick"], 0],
    ["Nucleus of a cell contains:", ["Genetic material (DNA)", "Only food vacuoles exclusive", "Only cell wall cellulose", "Only flagella"], 0],
    ["Chloroplasts are found in:", ["Plant cells (green parts)", "All animal cells only", "Only RBC exclusively", "Viruses only"], 0],
    ["Adolescence is a period of:", ["Rapid growth and change leading to adulthood", "Only old age", "Only infancy exclusive", "Only retirement"], 0],
    ["Endocrine glands release:", ["Hormones", "Only digestive enzymes into gut always exclusive", "Only sweat salts exclusive", "Only urine"], 0],
    ["Atmospheric pressure acts:", ["In all directions", "Only upward", "Only in vacuum", "Only on metals"], 0],
    ["Liquid pressure increases with:", ["Depth", "Colour only", "Only horizontal width exclusive", "Name of liquid brand"], 0],
    ["Friction produces:", ["Heat", "Only light always without heat", "Only magnetism exclusive", "Only sound without energy loss"], 0],
    ["Streamlined body in fish helps to:", ["Reduce friction/drag in water", "Increase weight only", "Stop swimming", "Absorb all light"], 0],
    ["Amplitude of vibration is related to sound's:", ["Loudness", "Only colour", "Only smell", "Only taste"], 0],
    ["Ultrasound has frequency:", ["Above the human audible range", "Only zero always", "Only infra always exclusive", "Exactly 1 Hz always"], 0],
    ["LED in circuits often indicates:", ["Current/path status as a lamp", "Only battery chemistry exclusive without light", "Only sound level", "Only CPU brand"], 0],
    ["Earthing of appliances protects against:", ["Electric shocks", "Only dust", "Only noise", "Only rust colour"], 0],
    ["Tsunami can be triggered by:", ["Undersea earthquakes", "Only gentle breeze", "Only rainbows", "Only low tide exclusive always"], 0],
    ["Seismograph records:", ["Earthquakes", "Only rainfall", "Only wind speed exclusive", "Only humidity"], 0],
    ["Myopia is corrected by:", ["Concave lens", "Convex lens only always", "Plane mirror only", "Prism only always"], 0],
    ["The moon shines because it:", ["Reflects sunlight", "Burns coal", "Has its own nuclear fusion like sun always visible", "Is a star"], 0],
    ["Constellations are:", ["Groups of stars forming patterns", "Planets only", "Only meteors", "Only satellites of Earth exclusive"], 0],
    ["Water pollution can be caused by:", ["Industrial wastes and sewage", "Only pure rain always", "Only oxygen", "Only distilled water"], 0],
    ["CNG is preferred over petrol sometimes because it is:", ["Cleaner burning", "Always more polluting", "A solid fuel", "Not a fuel"], 0],
    ["Lactic acid bacteria help in formation of:", ["Curd from milk", "Only bread yeast exclusive", "Only vinegar from metal", "Only rust"], 0],
    ["Nitrogen cycle is important because:", ["Nitrogen is needed for proteins in living beings", "Nitrogen is unused entirely", "Plants never need N", "Air has no nitrogen"], 0],
    ["Which is biodegradable?", ["Paper waste (generally)", "Many common plastics that persist", "Glass forever exclusive as bio", "Aluminium cans as quick compost always"], 0],
    ["Force can change:", ["State of motion of a body", "Only the name of a body", "Only colour always without motion", "Mass into zero always"], 0],

  ];

  // pick 35 with stride so papers share fewer identical stems
  const start = (p - 1) * 11;
  const stride = 3 + (p % 3);
  const used = new Set();
  for (let i = 0; i < 35; i++) {
    let idx = (start + i * stride) % sciBank.length;
    let guard = 0;
    while (used.has(idx) && guard < sciBank.length) {
      idx = (idx + 1) % sciBank.length;
      guard++;
    }
    used.add(idx);
    const row = sciBank[idx];
    let stem = row[0];
    // paper-specific numerical / wording variants where safe
    if (i % 4 === 0) stem = stem.replace(/\?$/, ` — choose the best answer:`);
    else if (i % 4 === 1) stem = stem.replace(/\?$/, `?`);
    items.push(Q(id++, stem, row[1].slice(), row[2], S));
  }

  // Achievers 5×3
  const achSci = [
    [
      "A force of 50 N acts on 2 m². The pressure is:",
      ["25 Pa", "100 Pa", "50 Pa", "10 Pa"],
      0,
    ],
    [
      "Which sequence correctly orders zones of a candle flame from inside to outside?",
      [
        "Dark zone → Luminous zone → Non-luminous zone",
        "Non-luminous → Dark → Luminous",
        "Luminous → Dark → Non-luminous",
        "Only one uniform zone",
      ],
      0,
    ],
    [
      "During electroplating of copper on an iron object, the iron object is made the:",
      ["Cathode", "Anode only always", "Electrolyte salt bridge", "Battery negative terminal wire insulation"],
      0,
    ],
    [
      "If the area of contact is halved for the same force, pressure becomes:",
      ["Double", "Half", "Same", "Zero"],
      0,
    ],
    [
      "Which pair is mismatched?",
      ["Sound – travels fastest in vacuum", "Force – Newton", "Pressure – Pascal", "Frequency – Hertz"],
      0,
    ],
  ];
  // rotate achievers slightly per paper
  for (let i = 0; i < 5; i++) {
    const row = achSci[(i + p - 1) % achSci.length];
    items.push(Q(id++, row[0], row[1].slice(), row[2], A, 3));
  }

  // paper-specific achiever numerical variants for uniqueness
  items[items.length - 5].q = `A force of ${40 + p * 10} N acts on 2 m². The pressure is:`;
  {
    const F = 40 + p * 10;
    const correct = String(F / 2);
    const last = items[items.length - 5];
    last.o = [correct, String(F), String(F * 2), String(F / 4)];
    last.a = 0;
  }

  if (items.length !== 50) throw new Error("Science total " + items.length);
  diversify(items, paperNo);
  return pack(items);
}

// ───────────────────────── English ─────────────────────────
function buildEnglish(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const W = "Word and Structure Knowledge";
  const R = "Reading";
  const S = "Spoken and Written Expression";

  // WSK 45
  const wsk = [];

  // articles / determiners
  wsk.push(["She is ___ honest officer.", ["an", "a", "the", "no article"], 0]);
  wsk.push(["___ Himalayas are to the north of India.", ["The", "A", "An", "No article"], 0]);
  wsk.push(["I have ___ few friends in this city.", ["a", "an", "the", "much"], 0]);

  // tenses
  wsk.push(["By next year they ___ this bridge.", ["will have completed", "completed", "are complete", "have been complete"], 0]);
  wsk.push(["She ___ since morning.", ["has been studying", "is study", "study", "have study"], 0]);
  wsk.push(["If he ___ harder, he would pass.", ["studied", "studies", "will study", "study"], 0]);

  // voice
  wsk.push(["Change to passive: 'They are painting the wall.'", ["The wall is being painted by them.", "The wall painted them.", "The wall was painting.", "They are painted the wall."], 0]);
  wsk.push(["Change to active: 'The letter was written by Sita.'", ["Sita wrote the letter.", "Sita was written the letter.", "The letter wrote Sita.", "Sita is written letter."], 0]);
  wsk.push(["Choose the correct passive of 'Open the door.'", ["Let the door be opened.", "The door opened.", "Door is open by you always only.", "Let the door opened."], 0]);

  // narration
  wsk.push(["He said, \"I am busy.\" →", ["He said that he was busy.", "He said that I am busy.", "He said that he is busy.", "He told that he busy."], 0]);
  wsk.push(["She said to me, \"Where do you live?\" →", ["She asked me where I lived.", "She asked me where do you live.", "She told me where I live?", "She said me where I lived."], 0]);
  wsk.push(["Ram said, \"I bought a book yesterday.\" →", ["Ram said that he had bought a book the previous day.", "Ram said that he has bought a book yesterday.", "Ram said that I bought a book yesterday.", "Ram said he buy a book."], 0]);

  // clauses
  wsk.push(["Identify the subordinate clause: 'I know that she is right.'", ["that she is right", "I know", "is right", "I know that"], 0]);
  wsk.push(["Join using a relative pronoun: 'This is the boy. He won the prize.'", ["This is the boy who won the prize.", "This is the boy which won the prize.", "This is the boy whom won.", "This is boy he won prize."], 0]);
  wsk.push(["Choose the correct conditional:", ["If it rains, we will cancel the match.", "If it will rain, we cancel.", "If it raining, we will cancel.", "If rains it, cancel we."], 0]);

  // non-finites
  wsk.push(["He is fond of ___ cricket.", ["playing", "play", "played", "plays"], 0]);
  wsk.push(["___ is believing.", ["Seeing", "See", "Seen", "Saw"], 0]);
  wsk.push(["I want ___ the truth.", ["to know", "know", "knowing", "known"], 0]);

  // prepositions
  wsk.push(["He is good ___ mathematics.", ["at", "in", "on", "with"], 0]);
  wsk.push(["Beware ___ pickpockets.", ["of", "from", "off", "with"], 0]);
  wsk.push(["The book is ___ the table.", ["on", "in", "at", "over"], 0]);
  wsk.push(["She has been ill ___ Monday.", ["since", "for", "from", "on"], 0]);

  // conjunctions / modals
  wsk.push(["Work hard ___ you should fail.", ["lest", "otherwise only wrong always", "because", "and"], 0]);
  // better unique options:
  wsk[wsk.length - 1] = ["Work hard ___ you should fail.", ["lest", "because", "and", "so that not"], 0];
  wsk.push(["You ___ wear a helmet while riding.", ["must", "used", "need not always never", "ought not ever"], 0]);
  wsk[wsk.length - 1] = ["You ___ wear a helmet while riding.", ["must", "used", "need", "ought"], 0];
  wsk.push(["He ___ swim when he was five.", ["could", "can", "may", "must"], 0]);

  // vocabulary
  const vocab = [
    ["The synonym of 'brief' is:", ["concise", "lengthy", "slow", "noisy"], 0],
    ["The antonym of 'scarce' is:", ["abundant", "rare", "little", "short"], 0],
    ["'A person who writes books' is a:", ["author", "doctor", "sculptor", "pilot"], 0],
    ["Choose the correctly spelt word:", ["occasion", "ocassion", "occassion", "ocision"], 0],
    ["Idiom: 'A blessing in disguise' means:", ["something good that seemed bad at first", "a hidden curse only", "a party invitation", "a weather report"], 0],
    ["One word: 'A period of ten years' —", ["decade", "century", "millennium", "fortnight"], 0],
    ["Synonym of 'diligent':", ["hardworking", "lazy", "careless", "rude"], 0],
    ["Antonym of 'expand':", ["contract", "enlarge", "increase", "swell"], 0],
    ["'Philanthropist' means a person who:", ["helps others, especially with money", "hates mankind", "collects stamps only", "studies rocks only"], 0],
    ["Choose the correct spelling:", ["environment", "enviroment", "enviornment", "enviromnent"], 0],
  ];
  for (const v of vocab) wsk.push(v);

  // error spotting style / sentence correction
  wsk.push(["Choose the correct sentence:", ["Neither of the boys is absent.", "Neither of the boys are absent.", "Neither of the boy is absent.", "Neither boys is absents."], 0]);
  wsk.push(["Choose the correct sentence:", ["The news is true.", "The news are true.", "The news were true always only.", "News is a plurals."], 0]);
  wsk.push(["Fill in: The jury ___ divided in their opinions.", ["were", "was", "is", "has"], 0]);
  // Note: jury can take plural when divided - were is accepted
  wsk.push(["Subject-verb: Bread and butter ___ his usual breakfast.", ["is", "are", "were", "have"], 0]);
  wsk.push(["Choose correct degree: This is the ___ book I have read.", ["best", "better", "good", "well"], 0]);

  // transformation
  wsk.push(["Change to comparative: 'This is the tallest building.'", ["This is taller than any other building.", "This is tall than building.", "This is more taller.", "This building tallest is."], 0]);
  wsk.push(["Negative of: 'Everyone likes ice cream.'", ["No one likes ice cream.", "Everyone does not likes.", "Someone likes not.", "Anyone not like."], 0]);

  // more grammar
  wsk.push(["The feminine of 'horse' is:", ["mare", "cow", "hen", "duck"], 0]);
  wsk.push(["Plural of 'crisis' is:", ["crises", "crisises", "crisis's", "crisi"], 0]);
  wsk.push(["Adjective form related to 'courage':", ["courageous", "courageously", "courage", "courages"], 0]);
  wsk.push(["Choose correct question tag: 'She is late, ___?'", ["isn't she", "is she", "doesn't she", "wasn't she"], 0]);
  wsk.push(["'Whom' is used for:", ["object (people)", "subject only always", "things only", "places only"], 0]);


  wsk.push(["Choose the correct passive: 'Someone has stolen my bike.'", ["My bike has been stolen.", "My bike has stolen someone.", "My bike was stole.", "Someone is stolen my bike."], 0]);
  wsk.push(["Fill in: He talks as if he ___ everything.", ["knew", "know", "known", "knowing"], 0]);
  wsk.push(["Choose correct: The committee ___ decided the matter (as a single body).", ["has", "have", "are", "were"], 0]);
  wsk.push(["Antonym of 'optimistic':", ["pessimistic", "hopeful", "bright", "cheerful"], 0]);
  wsk.push(["Synonym of 'rapid':", ["quick", "slow", "lazy", "dull"], 0]);
  wsk.push(["One word: 'A life history written by oneself' —", ["autobiography", "biography", "bibliography", "atlas"], 0]);
  wsk.push(["Idiom: 'Break the ice' means:", ["start a conversation in a friendly way", "freeze water only", "destroy a fridge", "stop talking forever"], 0]);
  wsk.push(["Choose correct preposition: She is afraid ___ dogs.", ["of", "from", "with", "off"], 0]);
  wsk.push(["Choose correct: I look forward to ___ you.", ["meeting", "meet", "met", "meets"], 0]);
  wsk.push(["Narration: He said, \"Please help me.\" →", ["He requested me to help him.", "He said please help me to me.", "He ordered that help.", "He asked that I helping."], 0]);
  wsk.push(["Clause: 'When the bell rang, students went out.' — 'When the bell rang' is an:", ["adverb clause of time", "noun clause only", "adjective clause only", "main clause only"], 0]);
  wsk.push(["Non-finite: ___ by the news, she smiled.", ["Excited", "Excite", "Excites", "To excited"], 0]);
  wsk.push(["Modal: We ___ save water.", ["should", "used", "need not never", "must not always"], 0]);
  wsk.push(["Choose correct spelling:", ["maintenance", "maintainance", "maintanance", "mantenance"], 0]);
  wsk.push(["Antonym of 'ancient':", ["modern", "old", "historic", "aged"], 0]);
  wsk.push(["Synonym of 'courage':", ["bravery", "fear", "cowardice", "panic"], 0]);
  wsk.push(["Choose correct: Neither Ravi nor his friends ___ present.", ["are", "is", "was", "has"], 0]);
  wsk.push(["Article: ___ European tourist visited the fort.", ["A", "An", "The only always", "No article mandatory"], 0]);
  wsk.push(["Voice: 'People speak English all over the world.' →", ["English is spoken all over the world.", "English is spoke all over.", "English speaks people.", "English was speak."], 0]);
  wsk.push(["Question tag: 'They won't mind, ___?'", ["will they", "won't they", "do they", "don't they"], 0]);
  wsk.push(["Preposition: Distribute the sweets ___ the children.", ["among", "between only for many always", "in", "into"], 0]);
  wsk.push(["Conjunction: He is poor ___ honest.", ["but", "so", "or", "if"], 0]);
  wsk.push(["Infinitive: She goes to the market ___ vegetables.", ["to buy", "buying", "bought", "buy"], 0]);
  wsk.push(["Gerund as subject: ___ is a good exercise.", ["Swimming", "Swim", "Swam", "Swum"], 0]);
  wsk.push(["Reported: 'Do you like tea?' she said to me. →", ["She asked me if I liked tea.", "She asked me do you like tea.", "She told me that I like tea?", "She said me if I like tea."], 0]);

  // ensure at least 45
  while (wsk.length < 45) {
    const n = wsk.length + p;
    wsk.push([
      `Choose the correct article: He is ___ university student. (${n})`,
      ["a", "an", "the", "no article"],
      0,
    ]);
  }

  // take 45 with stride for paper variety
  {
    const start = (p - 1) * 7;
    const stride = 2 + (p % 3);
    const used = new Set();
    for (let i = 0; i < 45; i++) {
      let idx = (start + i * stride) % wsk.length;
      let guard = 0;
      while (used.has(idx) && guard < wsk.length) {
        idx = (idx + 1) % wsk.length;
        guard++;
      }
      used.add(idx);
      const row = wsk[idx];
      items.push(Q(id++, row[0], row[1].slice(), row[2], W));
    }
  }

  // Reading 10 — two short passages × 5
  const passages = [
    {
      intro:
        "Read the passage and answer: Renewable energy sources such as solar and wind are becoming vital as nations try to reduce carbon emissions. Unlike coal, these sources produce little air pollution during operation. However, energy storage and grid integration remain engineering challenges that researchers continue to address.",
      qs: [
        ["The passage mainly discusses:", ["renewable energy and its challenges", "only coal mining methods", "space travel fuels", "ocean tides alone"], 0],
        ["Solar and wind are important because they help:", ["reduce carbon emissions", "increase coal use", "stop all research", "remove grids forever"], 0],
        ["Compared with coal, these sources during operation produce:", ["little air pollution", "more smoke always", "only nuclear waste", "no electricity"], 0],
        ["A challenge mentioned is:", ["energy storage and grid integration", "planting more coal", "banning sunlight", "closing all schools"], 0],
        ["The word 'vital' in the passage means closest to:", ["very important", "useless", "decorative", "optional always"], 0],
      ],
    },
    {
      intro:
        "Read the passage and answer: Libraries are not merely buildings that store books; they are community spaces where people read, study and share ideas. Digital catalogues have made searching easier, yet the quiet atmosphere of a library still helps many students concentrate better than a noisy café.",
      qs: [
        ["According to the passage, libraries are:", ["community spaces beyond mere storage", "only warehouses of unused paper", "always noisier than cafés", "closed to students"], 0],
        ["Digital catalogues help mainly in:", ["searching", "cooking", "sports training", "farming"], 0],
        ["Many students concentrate better in a library than in a:", ["noisy café", "silent exam hall always only", "desert", "spaceship"], 0],
        ["The passage suggests libraries help people to:", ["read, study and share ideas", "avoid all reading", "ban digital tools", "replace teachers completely"], 0],
        ["The tone of the passage is best described as:", ["informative and positive", "angry and hostile", "purely fictional comedy", "indifferent to reading"], 0],
      ],
    },
    {
      intro:
        "Read the passage and answer: Water conservation is essential in regions facing irregular rainfall. Simple habits—fixing leaking taps, reusing greywater for gardens, and harvesting rainwater—can reduce wastage. Schools that involve students in awareness drives often see lasting behavioural change.",
      qs: [
        ["The central theme is:", ["water conservation", "space exploration", "metal extraction", "classical music"], 0],
        ["Fixing leaking taps helps to:", ["reduce wastage", "increase floods always", "pollute rivers", "stop rainfall"], 0],
        ["Greywater is mentioned as something to:", ["reuse for gardens", "drink untreated always", "export as fuel", "ignore completely"], 0],
        ["Schools can create lasting change by:", ["awareness drives involving students", "banning all water use", "closing gardens", "ignoring leaks"], 0],
        ["'Irregular rainfall' suggests rainfall that is:", ["not consistent", "perfectly timed daily", "only snow", "never occurring on Earth"], 0],
      ],
    },
  ];
  const pass = passages[(p - 1) % passages.length];
  // first 5 from primary passage
  for (let i = 0; i < 5; i++) {
    const row = pass.qs[i];
    items.push(Q(id++, `${pass.intro} — ${row[0]}`, row[1].slice(), row[2], R));
  }
  // second passage
  const pass2 = passages[p % passages.length];
  for (let i = 0; i < 5; i++) {
    const row = pass2.qs[i];
    items.push(Q(id++, `${pass2.intro} — ${row[0]}`, row[1].slice(), row[2], R));
  }

  // SWE 5
  const swe = [
    ["Choose the most suitable sentence to complete: 'The sky is overcast; ___'", ["it may rain soon.", "the sun is brightly dancing indoors.", "we must water the plastic plants with oil.", "exams cancelled for gravity."], 0],
    ["Polite request:", ["Could you please help me with this bag?", "Hey you, bag now!", "You will help, order!", "Bag carrying refuse."], 0],
    ["Best formal email opening:", ["Dear Sir/Madam,", "Yo friend,", "Hey you people,", "Listen up,"], 0],
    ["Notice writing should mainly be:", ["brief, clear and factual", "long personal diary only", "secret codes only", "only poems"], 0],
    ["Choose coherent order: (1) Therefore we stayed indoors. (2) It rained heavily. (3) The match was postponed.", ["2, 3, 1", "1, 2, 3", "3, 1, 2", "1, 3, 2"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = swe[(i + p - 1) % swe.length];
    items.push(Q(id++, row[0], row[1].slice(), row[2], S));
  }

  if (items.length !== 60) throw new Error("English total " + items.length);
  // unique opts check fix
  for (const it of items) {
    if (new Set(it.o.map(String)).size !== 4) {
      const c = it.o[it.a];
      it.o = [c, c + " (alt1)", c + " (alt2)", c + " (alt3)"];
      it.a = 0;
    }
  }
  diversify(items, paperNo);
  return pack(items);
}

// ───────────────────────── Computer ─────────────────────────
function buildComputer(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const L = "Logical Reasoning";
  const C = "Computers";
  const A = "Achievers Section";

  // LR 10
  {
    const s0 = 7 + p;
    let o = numOpts(s0 + 16, id, [1, -1, 2, 4]);
    items.push(Q(id++, `Next: ${s0}, ${s0 + 4}, ${s0 + 8}, ${s0 + 12}, __`, o.options, o.ans, L));
    items.push(Q(id++, "Odd one out: Keyboard, Mouse, Monitor, Wheat", ["Wheat", "Keyboard", "Mouse", "Monitor"], 0, L));
    items.push(Q(id++, "Analogy: CPU : Process :: Monitor : ?", ["Display", "Print only", "Type only", "Store fuel"], 0, L));
    items.push(Q(id++, "If CAT = 24 (C=3… sum), then DOG = ?", ["26", "24", "30", "20"], 0, L)); // 4+15+7=26
    items.push(Q(id++, "Binary pattern next: 1, 10, 11, 100, ?", ["101", "110", "111", "1000"], 0, L));
    items.push(Q(id++, "Directions: Face West, turn left, then left. Face:", ["East", "West", "North", "South"], 0, L));
    items.push(Q(id++, "Odd one: AND, OR, NOT, CPU", ["CPU", "AND", "OR", "NOT"], 0, L));
    items.push(Q(id++, "Series: 5, 10, 20, 40, ?", ["80", "60", "50", "70"], 0, L));
    items.push(Q(id++, "If all passwords must be secret and X is a password, then X must be:", ["kept secret", "published online", "shared widely always", "written on the door"], 0, L));
    items.push(Q(id++, "How many 2-letter codes from A,B if repetition allowed?", ["4", "2", "3", "1"], 0, L)); // AA AB BA BB
  }

  const compBank = [
    ["CPU stands for:", ["Central Processing Unit", "Computer Personal Utility", "Central Print Unit", "Control Program Upload"], 0],
    ["RAM is a type of:", ["Volatile memory", "Permanent paper storage", "Output device only", "Network cable"], 0],
    ["An operating system example is:", ["Linux", "MS Word only", "Google Chrome only as OS", "JPEG"], 0],
    ["Which is an input device?", ["Scanner", "Speaker", "Printer", "Monitor"], 0],
    ["1 byte equals:", ["8 bits", "2 bits", "16 bits", "10 bits"], 0],
    ["HTML is used to:", ["Create web page structure", "Only edit offline videos", "Replace electricity", "Compile only C++"], 0],
    ["The correct pair of HTML tags for the largest heading is:", ["<h1>...</h1>", "<head1>", "<h6> only largest", "<heading>"], 0],
    ["HTTP is a:", ["Protocol for transferring web pages", "Hardware chip", "Type of printer", "Database only"], 0],
    ["A LAN typically covers a:", ["Local area such as a building", "The entire planet only", "Only undersea cables", "Outer space only"], 0],
    ["Which device connects different networks?", ["Router", "Mouse", "Joystick", "Microphone"], 0],
    ["Phishing is mainly an attempt to:", ["Steal sensitive information by deception", "Speed up the CPU", "Clean a virus with water", "Charge a battery"], 0],
    ["A strong password should be:", ["Long and mixed with letters, numbers, symbols", "Your name only", "12345", "password"], 0],
    ["In MS Excel, a formula usually begins with:", ["=", "#", "@", "&"], 0],
    ["Ctrl + C is commonly used to:", ["Copy", "Cut permanently without paste", "Shut down only", "Print landscape"], 0],
    ["A database is best described as:", ["An organised collection of data", "A single unformatted paragraph only", "Only a power cable", "A type of virus"], 0],
    ["Primary key in a table should be:", ["Unique for each record", "Always duplicated", "Always blank", "Only images"], 0],
    ["Cloud computing allows:", ["Accessing services over the internet", "Only offline typewriters", "Removing all networks forever", "Burning CDs only"], 0],
    ["AI in simple terms refers to:", ["Machines performing tasks that need human-like intelligence", "Only mechanical gears without data", "Paper filing cabinets", "Analog radio only"], 0],
    ["Which is malware?", ["Ransomware", "Firewall", "Antivirus definition update", "UPS"], 0],
    ["Firewall is used to:", ["Filter network traffic for security", "Cool the CPU with water always", "Increase font size", "Scan paper documents only"], 0],
    ["URL stands for:", ["Uniform Resource Locator", "Universal Record Link", "User Random Login", "United Router Line"], 0],
    ["In binary, 1011 equals decimal:", ["11", "10", "12", "9"], 0],
    ["Software that translates high-level code to machine code is a:", ["Compiler (or interpreter)", "Monitor", "Plotter", "Switch"], 0],
    ["CSS is mainly used for:", ["Styling web pages", "Only database queries", "CPU cooling", "Soldering circuits"], 0],
    ["An IP address identifies a:", ["Device on a network", "Type of keyboard key only", "Font style", "Printer ink colour only"], 0],
    ["Backup means:", ["Keeping copies of data for recovery", "Deleting all files", "Formatting without need", "Closing the lid"], 0],
    ["In coding logic, a loop is used to:", ["Repeat a set of instructions", "Stop the power supply", "Only declare one variable never again", "Draw hardware circuits"], 0],
    ["Boolean values are typically:", ["True and False", "Only integers from 5 to 9", "Colours", "Fonts"], 0],
    ["Which storage is usually non-volatile?", ["ROM / secondary storage like HDD", "Only CPU registers always volatile exclusive", "Cache only as permanent archive", "RAM only forever non-volatile"], 0],
    ["Spam email is:", ["Unsolicited bulk message", "A system BIOS update", "A type of RAM", "A graphics card"], 0],
    ["To keep personal data safe on public Wi-Fi, one should:", ["Avoid sensitive logins or use VPN/trusted networks", "Share OTP publicly", "Disable all passwords", "Post bank details"], 0],
    ["In PowerPoint, a slide transition is:", ["Animation effect between slides", "A type of CPU register", "A network topology", "An email protocol"], 0],
    ["Which is an open-source OS?", ["Linux", "A brand of mouse pad only", "Only a closed firmware chip name", "A printer paper size"], 0],
    ["Two-factor authentication adds:", ["An extra verification step beyond password", "No security", "Only a longer username", "Automatic malware install"], 0],
    ["In spreadsheets, the intersection of a row and a column is a:", ["Cell", "Workbook only", "Pivot without data", "Macro virus"], 0],
    ["FTP is used for:", ["File transfer", "Only voice calls", "Only printing", "Only cooling fans"], 0],
    ["The brain of the computer is the:", ["CPU", "Monitor", "Speaker", "Cabinet metal only"], 0],
    ["Which unit is largest?", ["1 TB", "1 MB", "1 KB", "1 Byte"], 0],
    ["Cyber ethics include:", ["Respecting privacy and not misusing data", "Hacking friends for fun", "Spreading rumors online", "Using pirated software freely always"], 0],
    ["In HTML, <a> tag is used for:", ["Hyperlinks", "Images only", "Tables only", "Styles only"], 0],
    ["Algorithm is a:", ["Step-by-step solution method", "Hardware fan", "Type of mouse", "Only a finished website"], 0],
    ["SSD compared to HDD generally offers:", ["Faster access without spinning disks", "Always slower access", "Only paper storage", "No electricity use ever"], 0],
    ["BIOS/UEFI is firmware that:", ["Helps start the computer", "Only edits videos", "Only prints photos", "Is a type of mouse"], 0],
    ["In Python-like logic, indentation often indicates:", ["Code blocks", "Only comments colour", "Network speed", "Printer DPI"], 0],
    ["An if-else structure is used for:", ["Decision making in programs", "Only infinite power supply", "Only drawing circles in hardware", "Deleting OS only"], 0],
    ["JPEG is a common format for:", ["Images", "Executable OS kernels only", "Only sound exclusive", "Only spreadsheets exclusive"], 0],
    ["MP3 is commonly associated with:", ["Audio", "Only databases", "Only firewalls", "Only CPUs"], 0],
    ["A pixel is the:", ["Smallest unit of a digital image display", "Largest hard disk", "Type of virus only", "Network cable only"], 0],
    ["Bluetooth is used for:", ["Short-range wireless communication", "Only long undersea cables", "Only satellite deep space exclusive", "Only wired LAN exclusive"], 0],
    ["GPS helps in:", ["Location/navigation", "Only cooling CPU", "Only compiling C", "Only antivirus definitions"], 0],
    ["In databases, SQL is used to:", ["Query and manage data", "Only design chair legs", "Only solder boards", "Only draw freehand"], 0],
    ["CC in email means:", ["Carbon Copy", "Central CPU", "Computer Crash", "Circuit Current only"], 0],
    ["BCC in email means:", ["Blind Carbon Copy", "Binary Cache Control", "Basic Chip Clock", "Boot Code Crash"], 0],
    ["Open source software allows:", ["Access to source code under its license", "No sharing ever", "Only paid binary without license idea", "Hardware melting"], 0],
    ["A QR code can store:", ["Data readable by cameras/scanners", "Only heat", "Only smell", "Only radioactivity"], 0],
    ["IoT refers to:", ["Internet of Things — connected devices", "Only offline books", "Only one printer cable", "Only abacus"], 0],
    ["Machine learning is a subset of:", ["Artificial Intelligence", "Only plumbing", "Only carpentry", "Only metallurgy"], 0],
    ["In Excel, SUM function is used to:", ["Add numbers", "Only sort text colours", "Only draw charts without data", "Only delete sheets always"], 0],
    ["A template in Word helps to:", ["Start documents with preset layout", "Delete the OS", "Format the hard disk", "Change CPU voltage"], 0],
    ["HTTPS indicates:", ["Secure HTTP with encryption", "Only broken links", "Only FTP always", "Only local files exclusive"], 0],
    ["A cookie in browsers may store:", ["Small data for sites (e.g., preferences)", "Only CPU registers", "Only RAM chips physically", "Only BIOS batteries"], 0],
    ["Which is application software?", ["Spreadsheet program", "Only the physical motherboard", "Only the power SMPS", "Only copper traces"], 0],
    ["Cache memory is:", ["Very fast memory close to CPU", "Slowest tape always", "Only cloud rain", "A type of printer ink"], 0],
    ["Booting is the process of:", ["Starting the computer and loading OS", "Only stopping the fan", "Only printing", "Only scanning viruses after power-off exclusive"], 0],
    ["Shortcut Ctrl + V usually:", ["Pastes", "Saves as PDF only", "Force restarts", "Ejects CD only"], 0],
    ["A topology like star network uses a:", ["Central hub/switch", "Only infinite mesh without centre always exclusive", "Only bus of wheat", "Only ring of Saturn"], 0],
    ["Debugging means:", ["Finding and fixing errors in programs", "Adding viruses", "Only painting UI", "Only buying RAM"], 0],
    ["An array in programming stores:", ["Multiple values in a structured way", "Only one bit forever exclusive", "Only heat", "Only network cables"], 0],
    ["Ergonomics in computing concerns:", ["Comfortable and safe use of equipment", "Only overclocking damage", "Only deleting files", "Only spam"], 0],
    ["Digital footprint refers to:", ["Traces of your online activity", "Only shoe size", "Only carbon of printers exclusive", "Only offline handwriting"], 0],

  ];

  const start = (p - 1) * 9;
  const stride = 2 + (p % 4);
  const used = new Set();
  for (let i = 0; i < 35; i++) {
    let idx = (start + i * stride) % compBank.length;
    let guard = 0;
    while (used.has(idx) && guard < compBank.length) {
      idx = (idx + 1) % compBank.length;
      guard++;
    }
    used.add(idx);
    const row = compBank[idx];
    let stem = row[0];
    if (i % 5 === 0) stem = stem.replace(/:$/, ' refers to:');
    items.push(Q(id++, stem, row[1].slice(), row[2], C));
  }

  // Achievers
  const achC = [
    [`Number of bytes in ${p + 1} KB is:`, [String((p + 1) * 1024), String((p + 1) * 1000), String((p + 1) * 512), String(p + 1)], 0],
    ["Which HTML snippet correctly makes a paragraph?", ["<p>Text</p>", "<para>Text</para>", "<paragraph/>Text", "<p Text></pText>"], 0],
    ["If A=1, B=10, C=11 in binary counting style starting at 1,2,... wait — Binary 1101 to decimal is:", ["13", "14", "12", "11"], 0],
    ["Best practice for public computer login:", ["Log out and never save passwords", "Save all passwords in browser always", "Share session with strangers", "Disable lock screen forever"], 0],
    ["In a flowchart, a diamond generally represents a:", ["Decision", "Start only", "Connector only never decision", "Manual input only"], 0],
  ];
  // fix the messy third question
  achC[2] = ["Binary 1101 converted to decimal is:", ["13", "14", "12", "11"], 0];

  for (let i = 0; i < 5; i++) {
    const row = achC[i];
    items.push(Q(id++, row[0], row[1].slice(), row[2], A, 3));
  }

  if (items.length !== 50) throw new Error("Computer total " + items.length);
  for (const it of items) {
    if (new Set(it.o.map(String)).size !== 4) {
      const c = String(it.o[it.a]);
      it.o = [c, c + "1", c + "2", c + "3"];
      it.a = 0;
    }
  }
  diversify(items, paperNo);
  return pack(items);
}

// ───────────────────────── GK ─────────────────────────
function buildGK(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const GA = "General Awareness";
  const CA = "Current Affairs";
  const LS = "Life Skills";
  const A = "Achievers Section";

  const gaBank = [
    ["The capital of India is:", ["New Delhi", "Mumbai", "Kolkata", "Chennai"], 0],
    ["The national animal of India is the:", ["Tiger", "Lion", "Elephant", "Peacock"], 0],
    ["The national bird of India is the:", ["Peacock", "Sparrow", "Eagle", "Parrot"], 0],
    ["Who is known as the Father of the Nation (India)?", ["Mahatma Gandhi", "Jawaharlal Nehru", "Subhas Chandra Bose", "Bhagat Singh"], 0],
    ["The Constitution of India came into force on:", ["26 January 1950", "15 August 1947", "26 November 1949", "2 October 1947"], 0],
    ["Which is the longest river in India by many traditional measures?", ["Ganga", "Yamuna only", "Narmada only as longest always", "Luni"], 0],
    ["The currency of Japan is the:", ["Yen", "Yuan", "Won", "Ringgit"], 0],
    ["Mount Everest lies in the:", ["Himalayas", "Alps", "Andes only", "Rockies"], 0],
    ["The first Prime Minister of India was:", ["Jawaharlal Nehru", "Sardar Patel", "Lal Bahadur Shastri", "Rajendra Prasad"], 0],
    ["Rajya Sabha is the:", ["Upper house of Parliament", "Lower house only", "Supreme Court bench", "State police unit"], 0],
    ["Fundamental Rights are listed in the:", ["Constitution of India", "Only municipal manuals", "Only school diaries", "Only sports rulebooks"], 0],
    ["The Reserve Bank of India is the:", ["Central bank of India", "World Bank branch only", "A private shop", "A sports federation"], 0],
    ["Which gas do plants release during photosynthesis (net useful to animals)?", ["Oxygen", "Nitrogen only", "Carbon monoxide", "Helium"], 0],
    ["The largest planet in our solar system is:", ["Jupiter", "Mars", "Mercury", "Venus"], 0],
    ["Olympic Games are held every:", ["4 years", "1 year", "10 years", "6 months"], 0],
    ["The author of the national anthem 'Jana Gana Mana' is:", ["Rabindranath Tagore", "Bankim Chandra Chatterjee", "Sarojini Naidu", "Premchand"], 0],
    ["Which state is known as the 'Spice Garden of India'?", ["Kerala", "Rajasthan", "Punjab", "Haryana"], 0],
    ["The Sahara is a:", ["Desert", "Ocean", "Mountain range in Europe only", "River in Canada"], 0],
    ["UNESCO is related to:", ["Education, science and culture", "Only military alliances", "Only oil trading", "Only local traffic police"], 0],
    ["The instrument used to measure temperature is a:", ["Thermometer", "Barometer only", "Ammeter only", "Speedometer only"], 0],
    ["Who wrote the Indian National Song 'Vande Mataram'?", ["Bankim Chandra Chatterjee", "Tagore only", "Gandhi", "Nehru"], 0],
    ["The Supreme Court of India is located in:", ["New Delhi", "Mumbai", "Chennai", "Kolkata"], 0],
    ["Which blood group is called a universal donor (red cells, classic teaching)?", ["O negative (commonly taught)", "AB positive only", "B only always", "A only always"], 0],
    ["The Pacific Ocean is the:", ["Largest ocean", "Smallest ocean", "Only freshwater ocean", "A desert"], 0],
    ["Ajanta caves are famous for:", ["Paintings and Buddhist heritage", "Only modern skyscrapers", "Only car factories", "Only beaches"], 0],
    ["The term GDP is related to:", ["Economy / national income measure", "Only weather", "Only cricket scores", "Only planetary orbits"], 0],
    ["Which vitamin is mainly produced in skin on sunlight exposure?", ["Vitamin D", "Vitamin C", "Vitamin K only never D", "Vitamin B12 only from sun"], 0],
    ["The Great Wall is associated with:", ["China", "Brazil", "Egypt only as wall", "Australia"], 0],
    ["ISRO is India's:", ["Space research organisation", "Cricket board", "Film censor only", "Tax office only"], 0],
    ["The border between India and China is often called the:", ["LAC (Line of Actual Control)", "Radcliffe Line only for China", "Durand Line for China", "McMahon only ocean line"], 0],
    ["Which festival is known as the festival of lights?", ["Diwali", "Holi only", "Pongal only as lights", "Onam only as lights always"], 0],
    ["The hardest natural substance is:", ["Diamond", "Gold", "Iron", "Silver"], 0],
    ["Which planet is called the Red Planet?", ["Mars", "Venus", "Mercury", "Neptune"], 0],
    ["Lok Sabha is the:", ["House of the People (lower house)", "Upper house only", "President’s office only", "Election Commission only"], 0],
    ["The chemical symbol of gold is:", ["Au", "Ag", "Fe", "Go"], 0],
    ["The Tropic of Cancer passes through:", ["India (among other countries)", "Only Antarctica exclusive", "Only Iceland exclusive", "Only New Zealand South Island exclusive"], 0],
    ["Which is a classical dance of India?", ["Bharatanatyam", "Hip-hop only as classical Indian", "Only ballet exclusive Indian classical", "Breakdance as Natya Shastra only"], 0],
    ["The Qutub Minar is in:", ["Delhi", "Mumbai", "Kolkata", "Chennai"], 0],
    ["Who found the sea route to India in the European Age of Exploration?", ["Vasco da Gama", "Columbus only to India exclusive", "Magellan only to Delhi", "Marco Polo as navy admiral of Portugal exclusive"], 0],
    ["The currency of the United Kingdom is the:", ["Pound sterling", "Euro only exclusive always", "Dollar only", "Yen"], 0],
    ["Which is a SAARC country?", ["Nepal", "Brazil", "Japan", "Canada"], 0],
    ["The Chipko movement is associated with:", ["Forest conservation", "Only space travel", "Only cricket", "Only fashion"], 0],
    ["Which house of Indian Parliament is not dissolved like Lok Sabha?", ["Rajya Sabha", "Lok Sabha only as permanent exclusive", "Only Gram Sabha as Parliament", "Only Vidhan Sabha as Parliament of India"], 0],
    ["The first President of India was:", ["Dr. Rajendra Prasad", "Dr. Radhakrishnan only as first exclusive", "Nehru", "Patel"], 0],
    ["Green Revolution in India is associated with:", ["Agriculture productivity increase", "Only IT parks", "Only space", "Only cricket stadiums"], 0],
    ["Which metal is used in galvanisation of iron?", ["Zinc", "Gold only", "Silver only", "Platinum only"], 0],
    ["The study of earthquakes is called:", ["Seismology", "Ecology only", "Astrology", "Philately"], 0],
    ["Which instrument measures atmospheric pressure?", ["Barometer", "Lactometer only", "Speedometer only", "Odometer only"], 0],
    ["The largest democracy in the world by population is often referred to as:", ["India", "Vatican City", "Monaco", "Nauru"], 0],
    ["Which day is celebrated as Indian Independence Day?", ["15 August", "26 January", "2 October", "14 November"], 0],
    ["Republic Day in India is on:", ["26 January", "15 August", "26 November only as Republic Day exclusive", "1 May"], 0],
    ["The polar satellite launch vehicle is associated with:", ["ISRO", "Only FIFA", "Only RBI mint", "Only UGC exams exclusive"], 0],
    ["Which is an Indian classical music form?", ["Hindustani / Carnatic traditions", "Only heavy metal as classical Indian exclusive", "Only jazz as Hindustani exclusive", "Only rock as Carnatic exclusive"], 0],
    ["The Thar Desert is largely in:", ["Rajasthan (India)", "Kerala only", "Sikkim only", "Goa only"], 0],
    ["Who is known for the theory of relativity?", ["Albert Einstein", "Newton only as relativity exclusive", "Faraday only", "Edison only"], 0],
    ["The Nobel Prize is awarded in fields including:", ["Peace, literature, sciences, etc.", "Only cooking shows", "Only local school sports exclusive", "Only fashion weeks"], 0],
    ["Which Indian city is known as the Silicon Valley of India?", ["Bengaluru", "Only Shimla exclusive", "Only Jaisalmer exclusive", "Only Shillong exclusive as Silicon"], 0],
    ["The Suez Canal connects:", ["Mediterranean Sea and Red Sea", "Pacific and Arctic only", "Amazon and Nile", "Ganga and Yamuna as seas"], 0],
    ["Which is the smallest continent?", ["Australia", "Asia", "Africa", "Antarctica"], 0],
    ["The Indian space mission that reached Mars orbit includes:", ["Mangalyaan (Mars Orbiter Mission)", "Only Chandrayaan as Mars exclusive", "Only Aryabhata as Mars lander exclusive", "Only INSAT as Mars rover"], 0],

  ];

  const start = (p - 1) * 8;
  const stride = 3 + (p % 2);
  const used = new Set();
  for (let i = 0; i < 30; i++) {
    let idx = (start + i * stride) % gaBank.length;
    let guard = 0;
    while (used.has(idx) && guard < gaBank.length) {
      idx = (idx + 1) % gaBank.length;
      guard++;
    }
    used.add(idx);
    const row = gaBank[idx];
    let stem = row[0];
    if (i % 6 === 0) stem = stem.replace(/:$/, ' is:');
    items.push(Q(id++, stem, row[1].slice(), row[2], GA));
  }

  // Current Affairs — evergreen / structural (not ephemeral gossip)
  const caBank = [
    ["The United Nations headquarters is in:", ["New York", "Geneva only as sole HQ", "Nairobi only", "New Delhi"], 0],
    ["G20 is a forum of major:", ["Economies", "Only film industries", "Only local clubs", "Only schools"], 0],
    ["The Paris Agreement is mainly related to:", ["Climate change", "Only cricket rules", "Only postal stamps", "Only fashion"], 0],
    ["WHO deals with:", ["Global public health", "Only space missions", "Only trade tariffs exclusive", "Only Olympic medals"], 0],
    ["Digital payments in India are supported by systems such as:", ["UPI", "Only barter worldwide exclusive", "Only cheques from 1800s exclusive", "Only gold coins mandatory"], 0],
    ["Chandrayaan missions are associated with India's:", ["Lunar exploration", "Only Antarctic tourism", "Only highway tolls", "Only cricket tours"], 0],
    ["Sustainable Development Goals (SDGs) were adopted by the:", ["United Nations", "Only one private company", "Only a school board", "Only FIFA"], 0],
    ["Aadhaar in India is a:", ["Unique identity number system", "Type of currency note only", "Sports trophy", "Mountain peak"], 0],
    ["Renewable energy targets worldwide often focus on:", ["Solar and wind expansion", "Only increasing coal always", "Banning all electricity", "Stopping research"], 0],
    ["The International Court of Justice is based in:", ["The Hague", "Mumbai", "Tokyo only", "Cairo only"], 0],
    ["BRICS is a grouping of:", ["Emerging economies", "Only European monarchies", "Only island cricket teams", "Only language clubs"], 0],
    ["Cybersecurity awareness days aim to promote:", ["Safer digital practices", "Password sharing", "Virus creation", "Ignoring updates"], 0],
  ];
  for (let i = 0; i < 10; i++) {
    const row = caBank[(i + p - 1) % caBank.length];
    items.push(Q(id++, row[0], row[1].slice(), row[2], CA));
  }

  const lsBank = [
    ["If a classmate is being bullied, you should:", ["Support them and report to a trusted adult", "Join the bullying", "Film and mock them", "Ignore forever without help"], 0],
    ["A good way to manage exam stress is to:", ["Plan studies and take short breaks", "Skip all sleep for a week", "Never ask doubts", "Panic without a timetable"], 0],
    ["Respecting others' opinions even when you disagree shows:", ["Tolerance and maturity", "Weakness only", "Dishonesty", "Fear of books"], 0],
    ["If you receive a suspicious email asking for OTP, you should:", ["Not share OTP and verify safely", "Send OTP immediately", "Forward to everyone", "Call unknown numbers from the mail"], 0],
    ["Teamwork in a group project mainly requires:", ["Cooperation and clear communication", "Doing nothing", "Blaming only", "Hiding information always"], 0],
    ["Saying 'please' and 'thank you' is part of:", ["Good manners", "Rudeness", "Only exam rules", "Mathematics only"], 0],
    ["Time management means:", ["Prioritising tasks effectively", "Wasting time on purpose", "Never using a clock", "Only sleeping all day"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = lsBank[(i + p - 1) % lsBank.length];
    items.push(Q(id++, row[0], row[1].slice(), row[2], LS));
  }

  // Achievers 5×3
  const achG = [
    [
      "Which sequence is correct for Indian governance structure at the centre?",
      [
        "Legislature, Executive, Judiciary as organs of government",
        "Only Judiciary without laws",
        "Only Executive without Constitution",
        "Municipal ward as the only national organ",
      ],
      0,
    ],
    [
      "Match correctly: ISRO – Space; RBI – ?",
      ["Monetary authority / central banking", "Space launch only", "Film certification only", "Cricket selection only"],
      0,
    ],
    [
      "Which statement about Fundamental Duties is true?",
      [
        "They are listed in the Constitution and guide citizens",
        "They replace all Fundamental Rights permanently",
        "They apply only to foreign tourists",
        "They are sports-only rules",
      ],
      0,
    ],
    [
      "A balanced diet and regular exercise primarily support:",
      ["Physical and mental well-being", "Only exam malpractice", "Ignoring hygiene", "Sleep deprivation as a goal"],
      0,
    ],
    [
      "Which is an example of sustainable practice?",
      ["Segregating waste and reducing single-use plastic", "Burning all plastic in open streets always", "Wasting water deliberately", "Dumping e-waste in rivers"],
      0,
    ],
  ];
  for (let i = 0; i < 5; i++) {
    const row = achG[(i + p - 1) % achG.length];
    items.push(Q(id++, row[0], row[1].slice(), row[2], A, 3));
  }

  if (items.length !== 50) throw new Error("GK total " + items.length);
  for (const it of items) {
    if (new Set(it.o.map(String)).size !== 4) {
      const c = String(it.o[it.a]);
      it.o = [c, c + " / alt", "None of named above X", "None of named above Y"];
      it.a = 0;
    }
  }
  diversify(items, paperNo);
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
      patternNote:
        "IMO pattern: Logical Reasoning 15×1 + Mathematical Reasoning 20×1 + Achievers 5×3 = 40 questions / 50 marks (SOF 2023–2025 style, original practice).",
      build: buildMath,
    },
    {
      folder: "science",
      subject: "Science",
      totalMarks: 60,
      expectQ: 50,
      patternNote:
        "NSO pattern: Logical Reasoning 10×1 + Science 35×1 + Achievers 5×3 = 50 questions / 60 marks (SOF 2023–2025 style, original practice).",
      build: buildScience,
    },
    {
      folder: "english",
      subject: "English",
      totalMarks: 60,
      expectQ: 60,
      patternNote:
        "IEO pattern: Word & Structure Knowledge 45×1 + Reading 10×1 + Spoken & Written Expression 5×1 = 60 questions / 60 marks (SOF 2023–2025 style, original practice).",
      build: buildEnglish,
    },
    {
      folder: "computer",
      subject: "Computer",
      totalMarks: 60,
      expectQ: 50,
      patternNote:
        "ICSO pattern: Logical Reasoning 10×1 + Computers 35×1 + Achievers 5×3 = 50 questions / 60 marks (SOF 2023–2025 style, original practice).",
      build: buildComputer,
    },
    {
      folder: "gk",
      subject: "General Knowledge",
      totalMarks: 60,
      expectQ: 50,
      patternNote:
        "IGKO pattern: General Awareness 30×1 + Current Affairs 10×1 + Life Skills 5×1 + Achievers 5×3 = 50 questions / 60 marks (SOF 2023–2025 style, original practice).",
      build: buildGK,
    },
  ];

  for (const job of jobs) {
    for (const n of PAPERS) {
      const packed = job.build(n);
      validate(packed, job.expectQ, job.totalMarks);
      writePaper(
        job.folder,
        {
          subject: job.subject,
          totalMarks: job.totalMarks,
          patternNote: job.patternNote,
        },
        n,
        packed
      );
      console.log(
        `OK class8/${job.folder} paper${n}: ${job.expectQ}Q, ${job.totalMarks} marks`
      );
    }
  }
  console.log("All Class 8 SOF-pattern papers generated (original practice, 2023–2025 style).");
}

main();

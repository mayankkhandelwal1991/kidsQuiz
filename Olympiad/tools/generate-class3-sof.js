#!/usr/bin/env node
/**
 * Generate ORIGINAL Class 3 Olympiad practice papers aligned to SOF
 * 2023–2025 exam PATTERN and SYLLABUS (not copyrighted SOF questions).
 *
 * Patterns (Classes 1–4 / same as Class 4):
 * Mathematics (IMO): LR 10×1 + MR 20×1 + Achievers 5×2 = 35Q, 40 marks
 * Science (NSO):     LR 5×1  + Science 25×1 + Achievers 5×2 = 35Q, 40 marks
 * English (IEO):     WSK 30×1 + Reading 5×1 + SWE 5×1 = 40Q, 40 marks
 * Computer (ICSO):   LR 5×1  + Computers 25×1 + Achievers 5×2 = 35Q, 40 marks
 * GK (IGKO):         GA 20×1 + CA 5×1 + Life Skills 5×1 + Achievers 5×2 = 35Q, 40 marks
 *
 * Class 3 difficulty (~age 8): 4-digit numbers, basic fractions, money/time/measurement,
 * living things, simple body systems, parts of speech/tenses, Word/Paint, India GK basics.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "data", "class3");
const CLASS = 3;

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
    durationMinutes: 30,
    totalMarks,
    patternNote:
      "Original practice paper aligned to SOF 2023–2025 Class 3 pattern & syllabus. Not an official SOF paper.",
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
  const w = wrongs.map(String).filter((x) => x !== c);
  const uniq = [];
  for (const x of w) if (!uniq.includes(x)) uniq.push(x);
  while (uniq.length < 3) uniq.push(`Option-${uniq.length + 1}-${c}`);
  const opts = [c, uniq[0], uniq[1], uniq[2]];
  // rotate so correct is not always A
  const rot = ((preferIdx % 4) + 4) % 4;
  const rotated = opts.slice(rot).concat(opts.slice(0, rot));
  // ensure unique after rotation
  const seen = new Set();
  for (let i = 0; i < 4; i++) {
    let v = rotated[i];
    let k = 0;
    while (seen.has(v)) {
      v = `${rotated[i]}·${++k}`;
    }
    rotated[i] = v;
    seen.add(v);
  }
  const ans = rotated.indexOf(c);
  if (ans < 0) {
    // correct got renamed — put back
    rotated[0] = c;
    return { options: rotated, answerIndex: 0 };
  }
  return { options: rotated, answerIndex: ans };
}

function itemFromRow(id, row, section, marks, rot) {
  // row: [question, options[4], answerIndex] OR [question, correct, wrongs[3]]
  if (Array.isArray(row[1]) && row[1].length === 4 && typeof row[2] === "number") {
    const opts = row[1].slice();
    const ai = row[2];
    const correct = opts[ai];
    const wrongs = opts.filter((_, i) => i !== ai);
    const m = mcq(correct, wrongs, rot);
    return Q(id, row[0], m.options, m.answerIndex, section, marks);
  }
  throw new Error("bad row " + JSON.stringify(row).slice(0, 120));
}

function takeRotated(bank, count, paperNo, salt) {
  const out = [];
  const n = bank.length;
  if (n < count) throw new Error(`bank size ${n} < ${count}`);
  const start = ((paperNo - 1) * 7 + (salt || 0) * 3) % n;
  const used = new Set();
  let i = 0;
  while (out.length < count) {
    const idx = (start + i * 5) % n;
    i++;
    if (used.has(idx)) {
      // linear probe
      let j = 0;
      while (used.has((idx + j) % n) && j < n) j++;
      if (j >= n) break;
      used.add((idx + j) % n);
      out.push(bank[(idx + j) % n]);
    } else {
      used.add(idx);
      out.push(bank[idx]);
    }
  }
  if (out.length < count) throw new Error("takeRotated failed");
  return out;
}

function diversifyStem(stem, paperNo) {
  const prefixes = ["", "Choose the correct option: ", "Select the right answer: ", "Pick the best choice: ", "Which is correct? "];
  // only prefix some conceptual stems; skip pure number questions
  if (/^\d|Find |What is \d|Solve |Calculate |[\d]+\s*[+\-×÷]/.test(stem)) return stem;
  if (paperNo === 1) return stem;
  const p = prefixes[paperNo % prefixes.length];
  if (!p || stem.startsWith(p)) return stem;
  return p + stem.charAt(0).toLowerCase() + stem.slice(1);
}

// ═══════════════════════════════════════════════════════════════
// MATHEMATICS (IMO) — 35Q / 40 marks
// ═══════════════════════════════════════════════════════════════
function buildMath(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const LR = "Logical Reasoning";
  const MR = "Mathematical Reasoning";
  const ACH = "Achievers Section";

  // --- Logical Reasoning 10×1 ---
  const lrBank = [
    ["Find the next number: 2, 4, 6, 8, ?", ["10", "9", "12", "7"], 0],
    ["Find the next number: 5, 10, 15, 20, ?", ["25", "22", "30", "18"], 0],
    ["Find the next number: 3, 6, 9, 12, ?", ["15", "14", "18", "13"], 0],
    ["Find the odd one out: 2, 4, 6, 9, 8", ["9", "2", "4", "6"], 0],
    ["Find the odd one out: Cat, Dog, Cow, Car", ["Car", "Cat", "Dog", "Cow"], 0],
    ["Which comes next in the pattern: △ ○ △ ○ △ ?", ["○", "△", "□", "☆"], 0],
    ["If ★ = 3 and ● = 5, then ★ + ● = ?", ["8", "15", "2", "35"], 0],
    ["Complete: A, C, E, G, ?", ["I", "H", "J", "F"], 0],
    ["Which is different: Square, Circle, Triangle, Apple", ["Apple", "Square", "Circle", "Triangle"], 0],
    ["If Monday is the 1st, what day is the 8th?", ["Monday", "Tuesday", "Sunday", "Friday"], 0],
    ["Find the missing letter: B, D, F, H, ?", ["J", "I", "K", "G"], 0],
    ["Which shape has 3 sides?", ["Triangle", "Square", "Circle", "Rectangle"], 0],
    ["Mirror of letter 'A' looks most like:", ["A", "B", "C", "D"], 0],
    ["If all roses are flowers and this is a rose, then it is a:", ["Flower", "Tree", "Bird", "Fish"], 0],
    ["Series: 10, 20, 30, 40, ?", ["50", "45", "60", "35"], 0],
    ["Odd one: Red, Blue, Green, Chair", ["Chair", "Red", "Blue", "Green"], 0],
    ["How many triangles in a triangle divided into 2 by one line from a vertex to the base?", ["2", "1", "3", "4"], 0],
    ["If ☆ means 2, then ☆☆☆ means:", ["6", "3", "8", "5"], 0],
    ["Arrange smallest to largest: 45, 12, 78, 3 → first is", ["3", "12", "45", "78"], 0],
    ["Next in pattern: 1, 2, 4, 8, ?", ["16", "10", "12", "9"], 0],
  ];
  const lr = takeRotated(lrBank, 10, p, 1);
  lr.forEach((row, i) => {
    const stem = diversifyStem(row[0], p);
    items.push(itemFromRow(id++, [stem, row[1], row[2]], LR, 1, p + i));
  });

  // --- Mathematical Reasoning 20×1 (paper-unique numericals) ---
  const a = 1000 + p * 111;
  const b = 2000 + p * 87;
  const c = 12 + p;
  const d = 5 + p;
  const f = 6 + (p % 3);
  const e = f * (8 + p); // exact division for Class 3
  const g = 100 + p * 25;
  const h = 25 * p;
  const m1 = 234 + p * 10;
  const m2 = 3 + (p % 4);
  const prod = m1 * m2;
  const divN = (12 + p) * (4 + (p % 3));
  const divD = 4 + (p % 3);
  const fracNum = p; // 1..5
  const money = 50 + p * 10;
  const spent = 15 + p * 3;
  const hour = 2 + p;
  const len1 = 10 + p;
  const len2 = 8 + p;
  const periSide = 6 + p;
  const mass = 500 + p * 100;
  const cap = 2 + p;
  const place = 3456 + p;
  const thousands = Math.floor(place / 1000);
  const hundreds = Math.floor((place % 1000) / 100);
  const roundNum = 46 + p; // round to nearest 10
  const rounded = Math.round(roundNum / 10) * 10;
  const evenOdd = 20 + p * 3;
  const isEven = evenOdd % 2 === 0;
  const halfOf = 16 + p * 2;
  const clockH = 3 + (p % 5);
  const clockM = p === 5 ? 30 : p * 10;
  const rectL = 8 + p;
  const rectW = 3 + (p % 3);
  const squareSide = 5 + p;
  const skipCount = 5 * (3 + p); // skip counting

  function posWrongs(correct, candidates) {
    const c = Number(correct);
    const out = [];
    for (const x of candidates) {
      const n = Number(x);
      if (!Number.isFinite(n) || n === c || n < 0) continue;
      if (!out.includes(n)) out.push(n);
    }
    let k = 1;
    while (out.length < 3) {
      const n = Math.abs(c) + k * 10;
      if (n !== c && !out.includes(n)) out.push(n);
      k++;
    }
    return out.slice(0, 3);
  }

  const mrRows = [
    [`What is ${a} + ${b}?`, mcq(a + b, posWrongs(a + b, [a + b + 10, a + b - 20, a + b + 100]), p)],
    [`What is ${b} − ${a}?`, mcq(b - a, posWrongs(b - a, [b + a, b - a + 50, a]), p + 1)],
    [`${c} × ${d} = ?`, mcq(c * d, posWrongs(c * d, [c + d, c * d + 5, c * (d + 1)]), p + 2)],
    [`${e} ÷ ${f} = ?`, mcq(e / f, posWrongs(e / f, [e / f + 1, Math.abs(e - f), f]), p + 3)],
    [`In ${place}, the digit in the thousands place is:`, mcq(thousands, posWrongs(thousands, [hundreds, place % 10, Math.floor((place % 100) / 10)]), p)],
    [`In ${place}, the place value of digit ${thousands} is:`, mcq(thousands * 1000, posWrongs(thousands * 1000, [thousands * 100, thousands, thousands * 10]), p + 1)],
    null, // filled below: largest number
    [`Round ${roundNum} to the nearest 10.`, mcq(rounded, posWrongs(rounded, [rounded + 10, rounded - 10, roundNum]), p)],
    [`${m1} × ${m2} = ?`, mcq(prod, posWrongs(prod, [prod + m1, Math.max(0, prod - m2), m1 + m2]), p + 2)],
    [`${divN} ÷ ${divD} = ?`, mcq(divN / divD, posWrongs(divN / divD, [divN / divD + 1, divD, Math.abs(divN - divD)]), p)],
    [`Which fraction is equal to one-half?`, [["1/2", "1/3", "1/4", "2/3"], 0]],
    [`What fraction of the shape is shaded if 1 of 4 equal parts is shaded?`, [["1/4", "1/2", "3/4", "1/3"], 0]],
    [`Riya has ₹${money}. She spends ₹${spent}. How much is left?`, mcq(money - spent, posWrongs(money - spent, [money + spent, spent, money - spent + 5]), p)],
    [`A chocolate costs ₹${10 + p}. Cost of 3 such chocolates is:`, mcq((10 + p) * 3, posWrongs((10 + p) * 3, [(10 + p) * 2, 10 + p + 3, (10 + p) * 4]), p)],
    [`A film starts at ${hour}:00 and lasts 2 hours. It ends at:`, mcq(`${hour + 2}:00`, [`${hour + 1}:00`, `${hour}:30`, `${hour + 3}:00`], p)],
    [`How many minutes are there in ${2 + (p % 2)} hours?`, mcq((2 + (p % 2)) * 60, posWrongs((2 + (p % 2)) * 60, [100, 90, 45]), p)],
    [`Length of a pencil is ${len1} cm and an eraser is ${len2} cm. Total length is:`, mcq(len1 + len2, posWrongs(len1 + len2, [Math.abs(len1 - len2), len1 * 2, Math.abs(len1 - len2) + 1]), p)],
    [`Perimeter of a square of side ${periSide} cm is:`, mcq(4 * periSide, posWrongs(4 * periSide, [2 * periSide, periSide * periSide, 3 * periSide]), p)],
    [`A bag has mass ${mass} g. How many grams in ${cap} kg? (1 kg = 1000 g)`, mcq(cap * 1000, posWrongs(cap * 1000, [cap * 100, mass, 500]), p)],
    [`${halfOf} ÷ 2 = ?`, mcq(halfOf / 2, posWrongs(halfOf / 2, [halfOf, halfOf - 2, halfOf / 2 + 2]), p)],
  ];

  // Fix row 7 (largest) properly
  const cand = [place, place - 111, place + 22, place - 5];
  const largest = Math.max(...cand);
  const wrongL = cand.filter((x) => x !== largest).slice(0, 3);
  while (wrongL.length < 3) wrongL.push(largest - 50 - wrongL.length);
  mrRows[6] = [`Which is the largest number: ${cand.join(", ")}?`, mcq(largest, wrongL, p)];

  // Convert mixed mrRows to Q items
  // Some entries are [stem, mcqResult] others [stem, [opts], ans]
  const mrBuilt = [];
  for (let i = 0; i < mrRows.length; i++) {
    const row = mrRows[i];
    if (!row) throw new Error("null mr row " + i);
    if (row[1] && row[1].options) {
      mrBuilt.push(Q(id++, row[0], row[1].options, row[1].answerIndex, MR, 1));
    } else if (Array.isArray(row[1]) && typeof row[2] === "number") {
      mrBuilt.push(itemFromRow(id++, row, MR, 1, p + i));
    } else if (Array.isArray(row[1]) && row[1].length === 2 && Array.isArray(row[1][0])) {
      // [["opts"], ans]
      mrBuilt.push(itemFromRow(id++, [row[0], row[1][0], row[1][1]], MR, 1, p + i));
    } else {
      throw new Error("bad mr row " + i + " " + JSON.stringify(row).slice(0, 100));
    }
  }
  // Ensure exactly 20 MR — we built 20
  if (mrBuilt.length !== 20) throw new Error("MR count " + mrBuilt.length);
  items.push(...mrBuilt);

  // Extra geometry/data mixed into achievers / ensure coverage via achievers
  // --- Achievers 5×2 ---
  const achRows = [
    [
      `A rectangular garden is ${rectL} m long and ${rectW} m wide. Its perimeter is:`,
      mcq(2 * (rectL + rectW), [rectL * rectW, rectL + rectW, 2 * rectL + rectW], p),
    ],
    [
      `A square has side ${squareSide} cm. Its perimeter is:`,
      mcq(4 * squareSide, [squareSide * squareSide, 2 * squareSide, 3 * squareSide], p + 1),
    ],
    [
      `Skip count by 5: after ${5 * p}, the next three are:`,
      mcq(
        `${5 * p + 5}, ${5 * p + 10}, ${5 * p + 15}`,
        [`${5 * p + 1}, ${5 * p + 2}, ${5 * p + 3}`, `${5 * p + 10}, ${5 * p + 20}, ${5 * p + 30}`, `${5 * p}, ${5 * p}, ${5 * p}`],
        p
      ),
    ],
    [
      `Ravi reads ${10 + p} pages each day. In 7 days he reads:`,
      mcq((10 + p) * 7, [(10 + p) + 7, (10 + p) * 5, 70], p + 2),
    ],
    [
      `A water bottle holds ${cap} litres. How many 500 ml glasses can fill it? (1000 ml = 1 L)`,
      mcq(cap * 2, [cap, cap * 4, 500], p + 3),
    ],
    [
      `The sum of the place values of 3 in 3,235 is:`,
      // 3000 + 30 = 3030? Wait 3235 has 3 at thousands and tens? 3,235 → 3000+200+30+5 → only one 3 at thousands if 3235. Use 3330
      null,
    ],
  ];

  // Fix last achiever properly with unique per paper
  const achBank = [
    [
      `In the number 3,${p}35, the place value of 3 in the thousands place is:`,
      mcq(3000, [3, 30, 300], p),
    ],
    [
      `A pictograph shows each ☺ = 2 books. If there are ${3 + p} smileys, books =`,
      mcq((3 + p) * 2, [3 + p, (3 + p) * 3, 2], p),
    ],
    [
      `Which is true?`,
      [["A right angle measures 90°", "A right angle measures 180°", "A right angle measures 45°", "A right angle measures 0°"], 0],
    ],
    [
      `${clockH}:${String(clockM).padStart(2, "0")} is the same as:`,
      mcq(
        clockM === 0 ? `${clockH} o'clock` : `${clockM} minutes past ${clockH}`,
        [`${clockH} minutes past ${clockM}`, "Midnight only", "Noon only"],
        p
      ),
    ],
    [
      `Find the missing number: ${20 + p} + ___ = ${50 + p}`,
      mcq(30, [20 + p, 50 + p, 10], p),
    ],
    [
      `A triangle has how many angles?`,
      [["3", "4", "5", "2"], 0],
    ],
    [
      `Even or odd: ${evenOdd} is:`,
      mcq(isEven ? "Even" : "Odd", [isEven ? "Odd" : "Even", "Neither", "Both"], p),
    ],
    [
      `Cost of 1 pen is ₹${8 + p}. Cost of ${4 + (p % 2)} pens is:`,
      mcq((8 + p) * (4 + (p % 2)), [8 + p + 4, (8 + p) * 2, 40], p),
    ],
  ];

  const achPick = takeRotated(achBank, 5, p, 2);
  achPick.forEach((row, i) => {
    if (row[1] && row[1].options) {
      items.push(Q(id++, row[0], row[1].options, row[1].answerIndex, ACH, 2));
    } else if (Array.isArray(row[1]) && row[1].length === 4 && typeof row[2] === "number") {
      // [stem, options[4], answerIndex]
      items.push(itemFromRow(id++, row, ACH, 2, p + i));
    } else if (Array.isArray(row[1]) && row[1].length === 2 && Array.isArray(row[1][0])) {
      // [stem, [options[4], answerIndex]]
      items.push(itemFromRow(id++, [row[0], row[1][0], row[1][1]], ACH, 2, p + i));
    } else {
      throw new Error("bad ach row " + JSON.stringify(row).slice(0, 120));
    }
  });

  const paper = pack(items);
  validate(paper, 35, 40);
  return paper;
}

// ═══════════════════════════════════════════════════════════════
// SCIENCE (NSO) — 35Q / 40 marks
// ═══════════════════════════════════════════════════════════════
function buildScience(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const LR = "Logical Reasoning";
  const SCI = "Science";
  const ACH = "Achievers Section";

  const lrBank = [
    ["Find the odd one out: Rose, Lily, Mango, Jasmine", ["Mango", "Rose", "Lily", "Jasmine"], 0],
    ["Next in pattern: Seed → Plant → Flower → ?", ["Fruit", "Root only", "Soil only", "Sun only"], 0],
    ["Which does not belong: Eye, Ear, Nose, Shoe", ["Shoe", "Eye", "Ear", "Nose"], 0],
    ["If living things need food, water and air, a toy car is:", ["Non-living", "Living", "A plant", "An animal"], 0],
    ["Odd one: Sparrow, Crow, Aeroplane, Pigeon", ["Aeroplane", "Sparrow", "Crow", "Pigeon"], 0],
    ["Complete: Day → Sun :: Night → ?", ["Moon", "Cloud only", "Rainbow only", "Soil"], 0],
    ["Which is different: Milk, Juice, Water, Stone", ["Stone", "Milk", "Juice", "Water"], 0],
    ["Series of seasons if starting Summer, Rainy, then?", ["Winter", "Only Summer again", "Only Spring forever", "None"], 0],
    ["Find odd: Leaf, Stem, Root, Plastic", ["Plastic", "Leaf", "Stem", "Root"], 0],
    ["If fish live in water, which animal is most like that habitat?", ["Whale", "Camel", "Eagle", "Lion"], 0],
  ];
  takeRotated(lrBank, 5, p, 0).forEach((row, i) => {
    items.push(itemFromRow(id++, [diversifyStem(row[0], p), row[1], row[2]], LR, 1, p + i));
  });

  const sciBank = [
    ["Living things can:", ["Grow and reproduce", "Never move or grow", "Only shine like stars", "Stay unchanged forever always"], 0],
    ["Plants make food mainly in their:", ["Leaves", "Flowers only", "Fruits only", "Seeds only"], 0],
    ["The process by which green plants make food using sunlight is called:", ["Photosynthesis", "Digestion", "Evaporation", "Condensation"], 0],
    ["Which part of the plant absorbs water from the soil?", ["Roots", "Flowers", "Fruits", "Petals only"], 0],
    ["Animals that eat only plants are called:", ["Herbivores", "Carnivores", "Omnivores", "Producers"], 0],
    ["A lion is a:", ["Carnivore", "Herbivore", "Producer", "Decomposer only"], 0],
    ["Humans breathe in:", ["Oxygen", "Only nitrogen to live", "Only smoke", "Only carbon dioxide to live"], 0],
    ["The organ that pumps blood is the:", ["Heart", "Stomach", "Skin", "Bone"], 0],
    ["We should brush our teeth:", ["Twice a day", "Once a year", "Never", "Only on birthdays"], 0],
    ["A balanced diet includes:", ["Different types of healthy food", "Only sweets", "Only fried snacks", "Only soft drinks"], 0],
    ["Water changes into water vapour on heating. This is:", ["Evaporation", "Freezing", "Melting of iron", "Condensation only"], 0],
    ["Rain comes from clouds by:", ["Precipitation / rain falling", "Plants walking", "Soil jumping", "Rocks melting only"], 0],
    ["The water cycle mainly involves:", ["Evaporation, condensation and rain", "Only earthquakes", "Only volcanoes", "Only lightning without water"], 0],
    ["Soil helps plants by providing:", ["Water and minerals", "Only plastic", "Only metal", "Only glass"], 0],
    ["We see objects because of:", ["Light", "Only sound", "Only smell", "Only taste"], 0],
    ["Sound is produced by:", ["Vibrations", "Silence only", "Colour only", "Taste only"], 0],
    ["A push or a pull is called a:", ["Force", "Colour", "Shadow only", "Planet"], 0],
    ["The Earth moves around the:", ["Sun", "Moon only", "Mars only", "Polaris only as orbit centre"], 0],
    ["The Moon is a:", ["Natural satellite of Earth", "Star like the Sun", "Planet with rings like Saturn only", "Comet only"], 0],
    ["Which planet is known as the Red Planet?", ["Mars", "Earth", "Venus", "Mercury"], 0],
    ["Birds have:", ["Feathers and wings", "Gills like fish always", "Scales only like snakes always", "No bones ever"], 0],
    ["Insects usually have how many legs?", ["Six", "Two", "Four", "Eight"], 0],
    ["A butterfly is an:", ["Insect", "Bird", "Mammal", "Fish"], 0],
    ["We must not waste water because:", ["Fresh water is precious", "Water has no use", "Oceans are tiny cups", "Rain never falls"], 0],
    ["Air pollution can be reduced by:", ["Planting more trees", "Burning more plastic always", "Cutting all trees", "Using more smoke factories only"], 0],
    ["Safety on the road includes:", ["Using a zebra crossing", "Playing on the highway", "Ignoring traffic lights", "Running between cars"], 0],
    ["The sense organ for smell is the:", ["Nose", "Ear", "Eye", "Tongue"], 0],
    ["Bones and muscles help us to:", ["Move", "Photosynthesise", "Only sleep forever", "Make soil"], 0],
    ["Which is a source of vitamin C?", ["Orange", "Salt only", "Water only", "Oil only"], 0],
    ["Germs can make us:", ["Ill / sick", "Taller instantly always", "A planet", "A cloud"], 0],
    ["Washing hands with soap helps to:", ["Remove germs", "Create germs", "Stop rain", "Change seasons"], 0],
    ["The Sun gives us:", ["Heat and light", "Only darkness", "Only snow always", "Only soil"], 0],
    ["A shadow is formed when light is:", ["Blocked by an opaque object", "Eaten by plants only", "Turned into sound", "Mixed with sugar"], 0],
    ["Fish breathe with:", ["Gills", "Lungs like humans only", "Leaves", "Feathers"], 0],
    ["The hardest part of our body is often the:", ["Tooth enamel", "Eyelash only", "Hair tip only", "Soft tongue only"], 0],
    ["Plants need sunlight, water and:", ["Air (carbon dioxide)", "Only plastic bags", "Only noise", "Only darkness always"], 0],
    ["Which animal lives in water?", ["Fish", "Camel", "Sparrow", "Goat"], 0],
    ["Weather is the day-to-day condition of:", ["The atmosphere", "Only underground rocks", "Only the Moon’s core", "Only deep ocean trenches always"], 0],
    ["Cotton clothes are comfortable in summer because they:", ["Absorb sweat and keep us cool", "Always make us colder than ice", "Are made of metal", "Block all air forever"], 0],
    ["The green colour of leaves is due to:", ["Chlorophyll", "Iron nails", "Plastic", "Salt only"], 0],
  ];
  takeRotated(sciBank, 25, p, 1).forEach((row, i) => {
    items.push(itemFromRow(id++, [diversifyStem(row[0], p), row[1], row[2]], SCI, 1, p + i));
  });

  const achBank = [
    ["Which group has only living things?", ["Tree, dog, human", "Stone, water, air", "Car, book, pen", "Plastic, glass, metal"], 0],
    ["Photosynthesis needs:", ["Sunlight, water and carbon dioxide", "Only darkness and plastic", "Only salt and sand", "Only noise and metal"], 0],
    ["Herbivores eat plants; carnivores eat flesh. A bear that eats both is an:", ["Omnivore", "Producer only", "Mineral", "Insect only always"], 0],
    ["If water is heated, it can become vapour; when vapour cools it can form:", ["Tiny water drops / clouds", "Only rocks", "Only pure gold", "Only wood"], 0],
    ["Which sense organs help you cross a road safely?", ["Eyes and ears", "Only tongue", "Only skin hair", "Only nose tip always"], 0],
    ["Earth is called the blue planet mainly because of:", ["Water on its surface", "Only red dust", "Only pure gold oceans", "No air at all"], 0],
    ["A first-aid step for a small cut is to:", ["Clean and cover it", "Rub soil into it", "Ignore heavy bleeding always", "Use dirty cloth only"], 0],
    ["Which food gives us energy quickly?", ["Carbohydrates like rice/bread", "Only stones", "Only air", "Only plastic"], 0],
    ["Why do we wear cotton in hot weather and woollen in cold weather?", ["Different clothes suit different weather", "Clothes have no purpose", "Wool cools us in summer always", "Cotton heats us in winter always"], 0],
    ["Pollution of water can harm:", ["Fish and people who drink it", "Only stars", "Only the Moon’s craters", "Only distant galaxies"], 0],
  ];
  takeRotated(achBank, 5, p, 3).forEach((row, i) => {
    items.push(itemFromRow(id++, [diversifyStem(row[0], p), row[1], row[2]], ACH, 2, p + i));
  });

  const paper = pack(items);
  validate(paper, 35, 40);
  return paper;
}

// ═══════════════════════════════════════════════════════════════
// ENGLISH (IEO) — 40Q / 40 marks (all ×1)
// ═══════════════════════════════════════════════════════════════
function buildEnglish(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const WSK = "Word and Structure Knowledge";
  const RD = "Reading";
  const SWE = "Spoken and Written Expression";

  const wskBank = [
    ["Choose the noun: The cat sat on the mat.", ["cat", "sat", "on", "the"], 0],
    ["Choose the verb: Birds fly in the sky.", ["fly", "Birds", "in", "sky"], 0],
    ["Choose the adjective: She has a red balloon.", ["red", "She", "has", "balloon"], 0],
    ["A ___ is a naming word.", ["noun", "verb", "adverb", "preposition"], 0],
    ["An ___ describes a noun.", ["adjective", "verb only", "conjunction only", "article only always"], 0],
    ["Find the plural of 'child':", ["children", "childs", "childes", "childies"], 0],
    ["Find the plural of 'box':", ["boxes", "boxs", "boxen", "boxies"], 0],
    ["Find the singular of 'mice':", ["mouse", "mouses", "mices", "meese"], 0],
    ["Article before 'umbrella' (vowel sound):", ["an", "a", "the the", "no"], 0],
    ["Article before 'book':", ["a", "an", "a an", "an a"], 0],
    ["She ___ to school every day.", ["goes", "go", "going", "gone"], 0],
    ["They ___ playing in the park now.", ["are", "is", "am", "be"], 0],
    ["Yesterday I ___ a movie.", ["watched", "watch", "watches", "watching"], 0],
    ["Tomorrow we ___ visit the zoo.", ["will", "was", "were", "did"], 0],
    ["Comparative of 'tall':", ["taller", "tallest", "more tallest", "tallly"], 0],
    ["Superlative of 'small':", ["smallest", "smaller", "more small", "smallerly"], 0],
    ["Comparative of 'good':", ["better", "gooder", "bestest", "more good"], 0],
    ["Fill in: The book is ___ the table.", ["on", "in to", "at of", "by by"], 0],
    ["Fill in: She sat ___ her mother and father.", ["between", "in", "on", "over"], 0],
    ["Conjunction: I like tea ___ coffee.", ["and", "but but", "or or or", "if if"], 0],
    ["Opposite of 'happy':", ["sad", "glad", "joyful", "pleased"], 0],
    ["Opposite of 'hot':", ["cold", "warm", "boiling", "sunny"], 0],
    ["Synonym of 'big':", ["large", "tiny", "small", "thin"], 0],
    ["Synonym of 'begin':", ["start", "end", "finish", "stop"], 0],
    ["Choose correct spelling:", ["because", "becos", "becuase", "becouse"], 0],
    ["Choose correct spelling:", ["friend", "freind", "frend", "friand"], 0],
    ["Pronoun for 'Ravi':", ["He", "She", "It only always", "They only for one boy"], 0],
    ["'I' is a:", ["pronoun", "verb", "adjective", "preposition"], 0],
    ["Which is a complete sentence?", ["The dog barked.", "barked loudly", "the big", "running fast boy"], 0],
    ["Arrange: is / My / red / bag", ["My bag is red.", "bag My is red", "red is My bag", "is bag red My"], 0],
    ["Past tense of 'go':", ["went", "goed", "goes", "going"], 0],
    ["Past tense of 'eat':", ["ate", "eated", "eats", "eating"], 0],
    ["Choose correct: This is ___ apple.", ["an", "a", "the the", "many"], 0],
    ["Adverb example: She runs ___.", ["quickly", "quickest apple", "table", "blue"], 0],
    ["Which word is a preposition?", ["under", "happy", "run", "beautiful"], 0],
    ["Fill: ___ sun rises in the east.", ["The", "A", "An", "Many"], 0],
    ["Gender: The feminine of 'king' is:", ["queen", "prince", "man", "boy"], 0],
    ["Gender: The masculine of 'sister' is:", ["brother", "mother", "girl", "woman"], 0],
    ["Choose the correct question word: ___ is your name?", ["What", "Where when", "How many colours only", "Which planet always"], 0],
    ["'Thank you' is used to show:", ["Gratitude", "Anger only", "Fear only", "Sleep only"], 0],
  ];
  takeRotated(wskBank, 30, p, 0).forEach((row, i) => {
    items.push(itemFromRow(id++, [diversifyStem(row[0], p), row[1], row[2]], WSK, 1, p + i));
  });

  const passages = [
    {
      text:
        "Rani has a small garden. She grows tomatoes, beans and marigolds. Every morning she waters the plants and removes dry leaves. Butterflies visit the bright flowers. Rani shares fresh vegetables with her neighbours.",
      qs: [
        ["What does Rani have?", ["A small garden", "A big factory", "A boat only", "A spaceship"], 0],
        ["Which vegetable is mentioned?", ["Tomatoes", "Ice cream", "Chocolate", "Bread only"], 0],
        ["When does Rani water the plants?", ["Every morning", "Only at midnight always", "Never", "Once in ten years"], 0],
        ["Who visits the flowers?", ["Butterflies", "Sharks", "Camels only", "Penguins only"], 0],
        ["Rani shares vegetables with:", ["Her neighbours", "No one ever", "Only robots", "Only clouds"], 0],
      ],
    },
    {
      text:
        "Amit’s school library is quiet and tidy. Shelves hold storybooks, picture books and simple encyclopaedias. The librarian helps children find books. Amit returns books on time and never tears pages. Reading makes him curious about the world.",
      qs: [
        ["The library is:", ["Quiet and tidy", "Noisy and dirty", "A playground only", "A kitchen"], 0],
        ["Who helps children find books?", ["The librarian", "A pilot only", "A chef only", "A driver only"], 0],
        ["Amit returns books:", ["On time", "Never", "After ten years only", "Torn always"], 0],
        ["Reading makes Amit:", ["Curious about the world", "Afraid of books", "Hate stories", "Avoid learning"], 0],
        ["Shelves hold:", ["Storybooks and picture books", "Only shoes", "Only tools", "Only rocks"], 0],
      ],
    },
    {
      text:
        "On Sunday, Meera visited the city zoo with her parents. She saw peacocks dancing, elephants spraying water and monkeys swinging on ropes. She did not feed the animals because a sign said it was not allowed. She took photos and wrote notes for her school project.",
      qs: [
        ["Where did Meera go?", ["The city zoo", "The moon", "A desert alone", "An airport only"], 0],
        ["Which bird did she see dancing?", ["Peacock", "Penguin only", "Ostrich only mentioned", "Crow only"], 0],
        ["Why did she not feed the animals?", ["A sign said it was not allowed", "She had no hands", "Animals were toys", "Zoo was closed forever"], 0],
        ["She wrote notes for:", ["Her school project", "Cooking only", "Driving lessons", "Bank work"], 0],
        ["Who went with Meera?", ["Her parents", "Only strangers", "Only robots", "Nobody"], 0],
      ],
    },
    {
      text:
        "Our village has a big banyan tree near the well. In the evening, children play hide-and-seek around it. Grandparents sit on cots and tell folk tales. Birds return to the branches to rest. Everyone feels cool under the shade in summer.",
      qs: [
        ["What stands near the well?", ["A big banyan tree", "A skyscraper", "A ship", "A train"], 0],
        ["Children play:", ["Hide-and-seek", "Only chess in silence always", "Only computer games there", "Cricket on the moon"], 0],
        ["Who tells folk tales?", ["Grandparents", "Only birds", "Only the well", "Only strangers online"], 0],
        ["Birds return to:", ["The branches to rest", "The market to shop", "School to teach", "Buses to drive"], 0],
        ["The shade feels cool in:", ["Summer", "Only deep space", "Only underwater always", "Only winter night poles"], 0],
      ],
    },
    {
      text:
        "Kabir learns to ride a bicycle. At first he wobbles and holds his father’s hand. After practice he balances alone and rings the bell. He wears a helmet for safety. His friends clap when he rides around the park path.",
      qs: [
        ["What is Kabir learning?", ["To ride a bicycle", "To fly a jet", "To bake only", "To swim in space"], 0],
        ["At first he holds:", ["His father’s hand", "A tiger’s paw", "Nothing ever", "A kite string only"], 0],
        ["For safety he wears:", ["A helmet", "No protection", "Only slippers on head", "A paper hat only"], 0],
        ["Friends clap when he:", ["Rides around the park path", "Falls always", "Stops learning", "Throws the bicycle"], 0],
        ["After practice he can:", ["Balance alone", "Never balance", "Only sit still", "Only walk the bike forever"], 0],
      ],
    },
  ];
  const pass = passages[(p - 1) % passages.length];
  // Reading section: optional lead-in not as separate Q — 5 Qs
  pass.qs.forEach((row, i) => {
    const stem = i === 0 ? `Read: "${pass.text.slice(0, 70)}..." — ${row[0]}` : row[0];
    items.push(itemFromRow(id++, [stem, row[1], row[2]], RD, 1, p + i));
  });

  const sweBank = [
    ["Choose the best greeting in the morning:", ["Good morning!", "Good night only now", "Go away always", "I won't talk"], 0],
    ["You bump into someone. You say:", ["Sorry!", "It is your fault only always", "No words ever", "Laugh rudely"], 0],
    ["Someone helps you. You say:", ["Thank you!", "I don't care", "Give me more only", "Silence forever"], 0],
    ["Best way to ask for a pencil:", ["Please may I borrow your pencil?", "Give me now!", "I take it without asking", "Throw yours away"], 0],
    ["On the phone, a polite start is:", ["Hello, may I speak to...?", "Who is this? Speak fast!", "No hello ever", "Yell only"], 0],
    ["Choose the best closing for a letter to a friend:", ["Yours lovingly / Your friend", "Hate you bye", "No name ever", "Angry stamp only"], 0],
    ["If you do not hear a question, you should:", ["Politely ask them to repeat", "Shout angrily", "Walk away rudely", "Ignore forever"], 0],
    ["Best sentence to describe your pet:", ["My pet is a friendly brown dog.", "Pet dog brown friendly my is", "Dog.", "The the the"], 0],
    ["Choose correct order for a short paragraph start:", ["First introduce the topic, then details", "End first with no start", "Only random words", "Only exclamation marks"], 0],
    ["When you receive a gift, you should:", ["Say thank you and smile", "Throw it away at once", "Never look at it", "Demand another angrily"], 0],
  ];
  takeRotated(sweBank, 5, p, 4).forEach((row, i) => {
    items.push(itemFromRow(id++, [diversifyStem(row[0], p), row[1], row[2]], SWE, 1, p + i));
  });

  const paper = pack(items);
  validate(paper, 40, 40);
  return paper;
}

// ═══════════════════════════════════════════════════════════════
// COMPUTER (ICSO) — 35Q / 40 marks
// ═══════════════════════════════════════════════════════════════
function buildComputer(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const LR = "Logical Reasoning";
  const IT = "Computers and IT";
  const ACH = "Achievers Section";

  const lrBank = [
    ["Odd one out: Monitor, Keyboard, Mouse, Chair", ["Chair", "Monitor", "Keyboard", "Mouse"], 0],
    ["Next: Click, Double-click, then you often:", ["Open a file/icon", "Cook food", "Swim", "Plant rice only"], 0],
    ["Pattern: A1, B2, C3, D4, ?", ["E5", "E4", "F3", "D5"], 0],
    ["If 1 byte is small storage, a bigger unit is:", ["Kilobyte", "Millimetre", "Litre", "Gram"], 0],
    ["Odd one: MS Word, MS Paint, Notepad, Refrigerator", ["Refrigerator", "MS Word", "MS Paint", "Notepad"], 0],
    ["Which does not belong: Input, Output, Process, Banana", ["Banana", "Input", "Output", "Process"], 0],
    ["Series of steps to start a PC often begins with:", ["Power button", "Watering plants", "Shouting", "Closing eyes only"], 0],
    ["Find odd: Printer, Speaker, Headphones, Keyboard (as output devices — keyboard is input)", ["Keyboard", "Printer", "Speaker", "Headphones"], 0],
    ["Complete: Full form idea — PC stands for:", ["Personal Computer", "Public Cake", "Pencil Case only", "Purple Cloud only"], 0],
    ["If password is secret, you should:", ["Not share it", "Tell everyone", "Post online publicly", "Write on the board"], 0],
  ];
  takeRotated(lrBank, 5, p, 1).forEach((row, i) => {
    items.push(itemFromRow(id++, [diversifyStem(row[0], p), row[1], row[2]], LR, 1, p + i));
  });

  const itBank = [
    ["The brain of the computer is the:", ["CPU", "Monitor", "Mouse", "Speaker"], 0],
    ["A monitor is an:", ["Output device", "Input only device", "Storage only", "Operating system"], 0],
    ["A keyboard is used to:", ["Type letters and numbers", "Print on paper only", "Cool the CPU only", "Supply electricity only"], 0],
    ["A mouse helps us to:", ["Point and click on screen", "Print books only", "Scan photos only", "Store huge videos only"], 0],
    ["Software is:", ["A set of programs/instructions", "Only the plastic box", "Only the wire", "Only the table"], 0],
    ["Hardware is:", ["Physical parts you can touch", "Only a thought", "Only a password", "Only internet speed"], 0],
    ["An example of an operating system is:", ["Windows / an OS", "MS Paint drawing only", "A printer cable", "A plastic chair"], 0],
    ["MS Paint is used for:", ["Drawing and colouring", "Only calculating tax", "Only sending rockets", "Only cooking"], 0],
    ["MS Word is mainly used for:", ["Typing documents", "Only painting", "Only playing CDs", "Only cooling fans"], 0],
    ["To copy text, a common shortcut is:", ["Ctrl + C", "Ctrl + Z only always", "Alt + F4 only", "Shift + Delete only"], 0],
    ["To paste text, a common shortcut is:", ["Ctrl + V", "Ctrl + C only", "Ctrl + S only", "Ctrl + P only"], 0],
    ["To save a file, a common shortcut is:", ["Ctrl + S", "Ctrl + C", "Ctrl + V", "Ctrl + X"], 0],
    ["To undo, a common shortcut is:", ["Ctrl + Z", "Ctrl + Y only always", "Ctrl + B only", "Ctrl + U only"], 0],
    ["The Internet is a:", ["Worldwide network of computers", "Single offline book", "Only a keyboard key", "Only a mouse pad"], 0],
    ["Email is used to:", ["Send electronic messages", "Cook food", "Water plants", "Drive cars"], 0],
    ["A pen drive is used for:", ["Storing and carrying files", "Displaying only", "Typing only", "Printing only"], 0],
    ["RAM is a type of:", ["Memory", "Printer", "Monitor brand only", "Mouse type only"], 0],
    ["A printer is used to:", ["Print on paper", "Type only", "Speak only", "Scan only always"], 0],
    ["Speakers give us:", ["Sound", "Only smell", "Only taste", "Only heat always"], 0],
    ["A scanner is used to:", ["Convert paper images/text into digital form", "Only cool the room", "Only charge phones always", "Only play music always"], 0],
    ["Cyber safety means:", ["Staying safe while using computers/internet", "Sharing all passwords", "Meeting strangers alone from chat", "Downloading anything blindly"], 0],
    ["You should not share online your:", ["Home address and passwords", "Favourite colour only ever", "Favourite cartoon only", "School subject name only"], 0],
    ["A file name helps us to:", ["Identify and find the file", "Delete the OS always", "Break the monitor", "Stop electricity"], 0],
    ["Icons on the desktop are:", ["Small pictures that open programs/files", "Real animals", "Only wall paint", "Only viruses always"], 0],
    ["Shutting down the computer properly helps to:", ["Close programs safely", "Always damage the disk", "Delete all homework always", "Break the mouse"], 0],
    ["A laptop is:", ["A portable computer", "Only a television always", "Only a fridge", "Only a printer"], 0],
    ["Input devices send data:", ["Into the computer", "Only out to paper always", "Only to the Moon", "Nowhere ever"], 0],
    ["Output devices show results:", ["From the computer to us", "Only into CPU forever", "Only as passwords", "Only as viruses"], 0],
    ["A folder is used to:", ["Organise files", "Print only", "Cool CPU only", "Replace mouse only"], 0],
    ["Double-clicking an icon usually:", ["Opens it", "Deletes the OS always", "Prints the room", "Shuts city power"], 0],
    ["The blinking mark where you type is the:", ["Cursor", "Printer", "Speaker", "UPS only"], 0],
    ["UPS helps to:", ["Give backup power for a short time", "Draw pictures only", "Browse only", "Type faster only"], 0],
    ["A website address is also called a:", ["URL", "CPU", "RAM chip only", "Mouse DPI only"], 0],
    ["Searching on the internet is done using a:", ["Search engine / browser tools", "Only a stapler", "Only a ruler", "Only a compass needle"], 0],
    ["Which is good password practice?", ["Keep it private and strong", "Use your name only and share it", "Write it on the screen publicly", "Use 1234 and tell friends"], 0],
  ];
  takeRotated(itBank, 25, p, 2).forEach((row, i) => {
    items.push(itemFromRow(id++, [diversifyStem(row[0], p), row[1], row[2]], IT, 1, p + i));
  });

  const achBank = [
    ["Which set is only input devices?", ["Keyboard, mouse, scanner", "Monitor, printer, speaker", "CPU, RAM, pen drive only as input", "UPS, cabinet, wire only"], 0],
    ["CPU stands for:", ["Central Processing Unit", "Computer Power Umbrella", "Control Paint Utility", "Click Paste Undo"], 0],
    ["To move text you can:", ["Cut (Ctrl+X) then Paste (Ctrl+V)", "Only restart forever", "Only unplug monitor", "Only delete Windows"], 0],
    ["Which is the safest action if a stranger messages you online?", ["Tell a parent/teacher; do not share personal info", "Share your address and photos", "Meet them alone", "Send your school ID photo and password"], 0],
    ["Hardware vs software: MS Paint is:", ["Software", "Hardware keyboard", "A metal screw", "A monitor glass only"], 0],
    ["Which storage is usually portable in your pocket?", ["Pen drive", "Desktop CRT only", "Server room only", "Projector screen only"], 0],
    ["The correct full form of ICT (as often taught) relates to:", ["Information and Communication Technology", "Ice Cream Treat", "Indoor Cricket Team only", "Iron Chair Table"], 0],
    ["When the computer freezes, a first calm step is often to:", ["Wait / ask a teacher; avoid force shutdown first if possible", "Pour water on it", "Hit the screen hard", "Delete all system files"], 0],
    ["A browser is used to:", ["Open websites on the internet", "Only print stickers", "Only draw offline always", "Only scan food"], 0],
    ["Which pair is correct?", ["Monitor → output; Keyboard → input", "Monitor → input only; Keyboard → output only", "Both are OS software only", "Both are viruses"], 0],
  ];
  takeRotated(achBank, 5, p, 5).forEach((row, i) => {
    items.push(itemFromRow(id++, [diversifyStem(row[0], p), row[1], row[2]], ACH, 2, p + i));
  });

  const paper = pack(items);
  validate(paper, 35, 40);
  return paper;
}

// ═══════════════════════════════════════════════════════════════
// GK (IGKO) — 35Q / 40 marks
// ═══════════════════════════════════════════════════════════════
function buildGK(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const GA = "General Awareness";
  const CA = "Current Affairs";
  const LS = "Life Skills";
  const ACH = "Achievers Section";

  const gaBank = [
    ["The capital of India is:", ["New Delhi", "Mumbai", "Kolkata", "Chennai"], 0],
    ["The national animal of India is the:", ["Tiger", "Lion", "Elephant", "Peacock"], 0],
    ["The national bird of India is the:", ["Peacock", "Sparrow", "Crow", "Eagle"], 0],
    ["The national flower of India is the:", ["Lotus", "Rose", "Sunflower", "Lily"], 0],
    ["The national flag of India has how many colours (main bands)?", ["Three", "Two", "Five", "One"], 0],
    ["The Ashoka Chakra in the flag is:", ["Navy blue", "Red", "Green", "Yellow"], 0],
    ["Republic Day is celebrated on:", ["26 January", "15 August", "2 October", "14 November"], 0],
    ["Independence Day of India is on:", ["15 August", "26 January", "1 May", "25 December"], 0],
    ["Gandhi Jayanti is on:", ["2 October", "14 November", "5 September", "26 January"], 0],
    ["Who is known as the Father of the Nation in India?", ["Mahatma Gandhi", "A sports coach only", "A film actor only", "A cricketer only"], 0],
    ["The largest ocean on Earth is the:", ["Pacific Ocean", "Indian Ocean", "Arctic Ocean", "Atlantic is smaller than Pacific — Pacific is largest"], 0],
    ["Mount Everest is the world’s:", ["Highest mountain peak", "Longest river", "Largest desert", "Biggest island"], 0],
    ["The Ganga is a famous:", ["River of India", "Desert only", "Mountain only", "Ocean only"], 0],
    ["The Himalayas are:", ["Mountains", "Oceans", "Deserts only", "Islands only"], 0],
    ["Which is a festival of lights?", ["Diwali", "Only Holi colours always", "Only Christmas trees in one line", "Only Eid without lights ever"], 0],
    ["Holi is known as the festival of:", ["Colours", "Only silence", "Only kites never colours", "Only boats"], 0],
    ["Christmas is celebrated on:", ["25 December", "1 January only always", "15 August", "26 January"], 0],
    ["Eid is a festival celebrated by:", ["Muslims (among communities in India)", "Only one mountain tribe worldwide exclusively", "Only astronauts", "Only fish"], 0],
    ["The currency of India is the:", ["Rupee", "Dollar only", "Yen only", "Pound only"], 0],
    ["The President’s house in New Delhi is called:", ["Rashtrapati Bhavan", "India Gate only", "Red Fort only as residence name", "Gateway of India only"], 0],
    ["Which sport uses a bat, ball and wickets?", ["Cricket", "Football only", "Hockey only", "Tennis only"], 0],
    ["Football is played with a:", ["Round ball kicked mainly by feet", "Only a shuttlecock", "Only a puck always", "Only chess pieces"], 0],
    ["The Taj Mahal is in:", ["Agra", "Jaipur only", "Mumbai only", "Chennai only"], 0],
    ["Which is a union territory (example)?", ["Delhi (NCT) / Ladakh etc.", "Uttar Pradesh only as UT", "Rajasthan as UT", "Bihar as UT"], 0],
    ["Our Earth is shaped most like a:", ["Sphere / nearly round", "Perfect flat square", "Triangle", "Cube only"], 0],
    ["Which planet do we live on?", ["Earth", "Mars", "Jupiter", "Venus"], 0],
    ["The fastest land animal is the:", ["Cheetah", "Turtle", "Snail", "Elephant"], 0],
    ["Which invention helps us call people far away?", ["Telephone / mobile phone", "Only a spoon", "Only a chair", "Only a candle"], 0],
    ["Alexander Fleming is linked with the discovery of:", ["Penicillin", "Only the aeroplane", "Only the telephone wire", "Only the bulb myth alone"], 0],
    ["The Wright brothers are known for:", ["Aeroplane flight", "Only steam engine alone", "Only printing press alone", "Only penicillin"], 0],
    ["Which is the largest continent?", ["Asia", "Europe", "Australia", "Antarctica"], 0],
    ["Japan is known as the land of the:", ["Rising Sun", "Only midnight sun always as name", "Only deserts", "Only ice exclusively"], 0],
    ["The capital of France is:", ["Paris", "London", "Rome", "Berlin"], 0],
    ["Which animal is called the ship of the desert?", ["Camel", "Horse", "Dog", "Cow"], 0],
    ["Traffic lights: red means:", ["Stop", "Go fast", "Speed up only", "Honk only"], 0],
  ];
  // Fix awkward option on Pacific one — rewrite cleanly in bank entry index 10
  gaBank[10] = ["The largest ocean on Earth is the:", ["Pacific Ocean", "Indian Ocean", "Arctic Ocean", "Southern Ocean only as largest"], 0];

  takeRotated(gaBank, 20, p, 0).forEach((row, i) => {
    items.push(itemFromRow(id++, [diversifyStem(row[0], p), row[1], row[2]], GA, 1, p + i));
  });

  // Current Affairs — evergreen kid-safe "recent awareness" style (not ephemeral gossip)
  const caBank = [
    ["India’s Prime Minister (as widely taught in school GK in 2020s) is:", ["Narendra Modi", "A film director only", "A football coach only", "A weather satellite"], 0],
    ["Chandrayaan missions are related to India’s exploration of the:", ["Moon", "Only the ocean floor of Earth exclusively", "Only Antarctica tourism", "Only desert racing"], 0],
    ["International Yoga Day is observed on:", ["21 June", "1 January", "15 August", "25 December"], 0],
    ["Aadhaar in India is a:", ["Unique identity number/system", "Type of fruit", "Mountain pass only", "Dance form only"], 0],
    ["The Olympic Games are a big:", ["International sports event", "Only a school picnic", "Only a cooking show", "Only a spelling bee always"], 0],
    ["Digital payments in India often use apps and:", ["UPI / digital wallets (as commonly known)", "Only coins forever exclusive", "Only barter of shells only", "Only stamps without phones"], 0],
    ["World Environment Day reminds us to:", ["Care for nature", "Cut all trees", "Pollute rivers", "Waste electricity"], 0],
    ["A total solar eclipse happens when the:", ["Moon comes between Sun and Earth", "Earth leaves the solar system", "Sun becomes a planet", "Stars fall as rain"], 0],
    ["ISRO is India’s:", ["Space research organisation", "Only cricket board", "Only film studio", "Only bank for toys"], 0],
    ["Fit India / fitness drives encourage children to:", ["Stay active and healthy", "Only sit all day", "Skip all sports forever", "Eat junk only"], 0],
  ];
  takeRotated(caBank, 5, p, 2).forEach((row, i) => {
    items.push(itemFromRow(id++, [diversifyStem(row[0], p), row[1], row[2]], CA, 1, p + i));
  });

  const lsBank = [
    ["If a stranger offers sweets and asks you to go alone, you should:", ["Refuse and tell a trusted adult", "Go quietly", "Share your address", "Get in a car"], 0],
    ["Saying 'please' and 'thank you' shows:", ["Good manners", "Anger", "Fear only", "Rudeness"], 0],
    ["When you make a mistake in class, you should:", ["Admit and try to improve", "Always blame a friend", "Hide forever", "Tear notebooks"], 0],
    ["Teamwork means:", ["Working together kindly", "Doing nothing", "Fighting teammates", "Hiding tools"], 0],
    ["Washing hands before eating helps to:", ["Keep germs away", "Change hair colour", "Skip homework", "Grow wings"], 0],
    ["If you feel unwell at school, you should:", ["Tell a teacher", "Hide in the toilet all day silently", "Run home on the highway alone", "Ignore high fever always"], 0],
    ["Saving water can be done by:", ["Turning off taps when not needed", "Leaving taps open", "Breaking pipes", "Wasting buckets daily for fun"], 0],
    ["Respecting elders means:", ["Listening politely and helping", "Shouting always", "Ignoring them", "Mocking them"], 0],
    ["On the internet, a smart rule is:", ["Do not share passwords", "Share OTP with strangers", "Meet online friends alone at night", "Post home keys photos"], 0],
    ["If classmates quarrel, a good step is to:", ["Stay calm and seek a teacher’s help if needed", "Join the fight", "Spread rumours", "Laugh at both"], 0],
  ];
  takeRotated(lsBank, 5, p, 3).forEach((row, i) => {
    items.push(itemFromRow(id++, [diversifyStem(row[0], p), row[1], row[2]], LS, 1, p + i));
  });

  const achBank = [
    ["Which statement is true?", ["The Constitution is the supreme law of India", "The Constitution is a comic only", "India has no national symbols", "Republic Day is in August"], 0],
    ["The three colours of the Indian national flag are:", ["Saffron, white and green", "Red, blue and yellow only", "Black and grey only", "Pink and purple only"], 0],
    ["Mahatma Gandhi is remembered for:", ["Non-violence and freedom struggle", "Inventing the aeroplane alone", "Discovering penicillin alone", "Building the Taj Mahal alone"], 0],
    ["Which is a good citizen habit?", ["Follow rules and keep surroundings clean", "Damage public parks", "Waste food and water always", "Ignore traffic lights"], 0],
    ["India’s national anthem is:", ["Jana Gana Mana", "A film remix only", "Only a state song of one city", "A sports cheer only"], 0],
    ["Which river is holy and famous in India?", ["Ganga", "Nile only as Indian river", "Amazon only as Indian river", "Thames only as Indian river"], 0],
    ["The Red Fort is associated with:", ["Delhi / Independence Day address tradition", "Only Antarctica research", "Only cricket stadium in Mumbai exclusively", "Only a beach in Goa exclusively"], 0],
    ["SAARC includes countries mainly from:", ["South Asia", "Only South America", "Only Europe", "Only Antarctica"], 0],
    ["Which is an energy-saving habit?", ["Switch off lights when leaving a room", "Keep all lights on always", "Open fridge all day", "Burn waste plastics indoors"], 0],
    ["First aid for a minor burn (basic school level) includes:", ["Cooling with clean running water and telling an adult", "Rubbing butter and dirt", "Ignoring blisters always", "Popping blisters with dirty pins"], 0],
  ];
  takeRotated(achBank, 5, p, 4).forEach((row, i) => {
    items.push(itemFromRow(id++, [diversifyStem(row[0], p), row[1], row[2]], ACH, 2, p + i));
  });

  const paper = pack(items);
  validate(paper, 35, 40);
  return paper;
}

// ═══════════════════════════════════════════════════════════════
function main() {
  ensureDir(ROOT);

  const subjects = [
    { folder: "mathematics", subject: "Mathematics", build: buildMath, n: 35, marks: 40 },
    { folder: "science", subject: "Science", build: buildScience, n: 35, marks: 40 },
    { folder: "english", subject: "English", build: buildEnglish, n: 40, marks: 40 },
    { folder: "computer", subject: "Computer Science", build: buildComputer, n: 35, marks: 40 },
    { folder: "gk", subject: "General Knowledge", build: buildGK, n: 35, marks: 40 },
  ];

  const summary = [];
  for (const s of subjects) {
    for (let p = 1; p <= 5; p++) {
      const paper = s.build(p);
      validate(paper, s.n, s.marks);
      // section counts
      const sec = {};
      for (const q of paper.questions) {
        sec[q.section] = (sec[q.section] || 0) + 1;
      }
      writePaper(s.folder, p, { subject: s.subject, totalMarks: s.marks }, paper.questions, paper.answers);
      summary.push({
        subject: s.subject,
        paper: p,
        questions: paper.questions.length,
        marks: s.marks,
        sections: sec,
      });
      console.log(
        `OK Class ${CLASS} ${s.subject} Paper ${p}: ${paper.questions.length}Q / ${s.marks} marks`,
        sec
      );
    }
  }

  // Remove stale papers if any beyond 1-5 (none expected)
  console.log("\n=== Summary ===");
  for (const row of summary) {
    console.log(
      `${row.subject} P${row.paper}: ${row.questions}Q, ${row.marks}M`,
      JSON.stringify(row.sections)
    );
  }
  console.log(
    `\nWrote 5 papers × 5 subjects under Olympiad/data/class3/ (original SOF-pattern practice, 2023–2025 style).`
  );
}

main();

#!/usr/bin/env node
/**
 * Generate ORIGINAL Class 2 Olympiad practice papers aligned to SOF
 * 2023–2025 exam PATTERN and SYLLABUS (not copyrighted SOF questions).
 *
 * Patterns (Classes 1–4):
 * Mathematics (IMO): LR 10×1 + MR 20×1 + Achievers 5×2 = 35Q, 40 marks
 * Science (NSO):     LR 5×1  + Science 25×1 + Achievers 5×2 = 35Q, 40 marks
 * English (IEO):     WSK 30×1 + Reading 5×1 + SWE 5×1 = 40Q, 40 marks
 * Computer (ICSO):   LR 5×1  + Computers 25×1 + Achievers 5×2 = 35Q, 40 marks
 * GK (IGKO):         GA 20×1 + CA 5×1 + Life Skills 5×1 + Achievers 5×2 = 35Q, 40 marks
 *
 * Class 2 difficulty (~age 7): numbers to 1000, add/sub 2-digit, tables 2–5,
 * halves/quarters, time, money, shapes; plants/animals/senses/weather;
 * basic grammar & short reading; computer parts/Paint; India symbols/festivals.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "data", "class2");
const CLASS = 2;

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
      "Original practice paper aligned to SOF 2023–2025 Class 2 pattern & syllabus. Not an official SOF paper.",
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
  if (answerIndex < 0 || answerIndex > 3) throw new Error(`Q${id}: bad ans ${answerIndex}`);
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
  const seen = new Set();
  questions.forEach((q, i) => {
    if (q.id !== i + 1) throw new Error(`Bad id at ${i}: ${q.id}`);
    if (!q.section) throw new Error(`Missing section Q${q.id}`);
    if (!q.options || q.options.length !== 4) throw new Error(`Options Q${q.id}`);
    if (new Set(q.options.map(String)).size !== 4) throw new Error(`Dup opts Q${q.id}`);
    marks += Number(q.marks) || 1;
    const key = q.question;
    if (seen.has(key)) throw new Error(`Duplicate stem near Q${q.id}: ${key.slice(0, 100)}`);
    seen.add(key);
    const a = answers[String(q.id)];
    if (a === undefined || a < 0 || a > 3) throw new Error(`Bad answer Q${q.id}`);
  });
  if (marks !== expectMarks) throw new Error(`Expected ${expectMarks} marks, got ${marks}`);
  return true;
}

function shuffleOpts(correct, wrongs, salt) {
  const opts = [String(correct), ...wrongs.map(String)].slice(0, 4);
  while (opts.length < 4) opts.push(`Option ${opts.length}`);
  // rotate by salt for variety while tracking answer index
  const rot = ((salt % 4) + 4) % 4;
  const rotated = opts.slice(rot).concat(opts.slice(0, rot));
  // correct was at 0 before rotate → new index
  const ans = (0 - rot + 4) % 4;
  // ensure unique
  const uniq = [...new Set(rotated)];
  if (uniq.length !== 4) {
    // fallback fixed order
    return { options: [String(correct), String(wrongs[0]), String(wrongs[1]), String(wrongs[2])], ans: 0 };
  }
  return { options: rotated, ans };
}

function diversify(items, paperNo) {
  // light stem prefix + option rotation for paper variety
  const prefixes = ["", "Choose: ", "Find: ", "Pick the correct option. ", "Select: "];
  return items.map((item, idx) => {
    const salt = paperNo * 17 + idx * 3;
    const q = Object.assign({}, item.q);
    const pref = prefixes[(paperNo + idx) % prefixes.length];
    if (pref && !q.question.startsWith("Read the") && paperNo > 1 && idx % 4 === 0) {
      q.question = pref + q.question.charAt(0).toLowerCase() + q.question.slice(1);
    }
    // rotate options
    const rot = (paperNo + idx) % 4;
    if (rot === 0) return { q, a: item.a };
    const opts = q.options.slice();
    const rotated = opts.slice(rot).concat(opts.slice(0, rot));
    const newAns = (item.a - rot + 4) % 4;
    q.options = rotated;
    return { q, a: newAns };
  });
}

/* ===================== MATHEMATICS ===================== */
function mathLR(paperNo) {
  const banks = [
    // patterns
    () => {
      const a = 2 + paperNo;
      const seq = [a, a + 2, a + 4, a + 6];
      const next = a + 8;
      const { options, ans } = shuffleOpts(next, [next + 1, next - 2, next + 3], paperNo);
      return Q(1, `What comes next? ${seq.join(", ")}, __`, options, ans, "Logical Reasoning", 1);
    },
    () => {
      const a = 5 * paperNo;
      const seq = [a, a + 5, a + 10, a + 15];
      const next = a + 20;
      const { options, ans } = shuffleOpts(next, [next + 5, a + 16, next - 10], paperNo + 1);
      return Q(2, `Find the next number: ${seq.join(", ")}, __`, options, ans, "Logical Reasoning", 1);
    },
    () => {
      // odd one out shapes words
      const sets = [
        { opts: ["Circle", "Square", "Triangle", "Apple"], ans: 3 },
        { opts: ["Red", "Blue", "Green", "Book"], ans: 3 },
        { opts: ["Cat", "Dog", "Lion", "Car"], ans: 3 },
        { opts: ["Monday", "Tuesday", "Friday", "Ball"], ans: 3 },
        { opts: ["One", "Two", "Three", "Tree"], ans: 3 },
      ];
      const s = sets[(paperNo - 1) % sets.length];
      return Q(3, "Which is the odd one out?", s.opts, s.ans, "Logical Reasoning", 1);
    },
    () => {
      // ranking / position — fixed unique options per paper
      const total = [5, 6, 7, 8, 9][paperNo - 1];
      const fromLeft = [2, 3, 3, 4, 5][paperNo - 1];
      const right = total - fromLeft; // children to her right
      const wrongs = [right + 1, right - 1 > 0 ? right - 1 : right + 2, total - 1].filter((x, i, a) => x !== right && a.indexOf(x) === i);
      while (wrongs.length < 3) wrongs.push(right + wrongs.length + 2);
      const ord = fromLeft === 1 ? "1st" : fromLeft === 2 ? "2nd" : fromLeft === 3 ? "3rd" : `${fromLeft}th`;
      return Q(
        4,
        `In a line of ${total} children, Riya is ${ord} from the left. How many children are to her right?`,
        [String(right), String(wrongs[0]), String(wrongs[1]), String(wrongs[2])],
        0,
        "Logical Reasoning",
        1
      );
    },
    () => {
      // mirror / direction simple
      const dirs = [
        { q: "If you face the rising sun, which direction is behind you?", opts: ["East", "West", "North", "South"], a: 1 },
        { q: "Which direction does the sun set?", opts: ["East", "West", "North", "South"], a: 1 },
        { q: "Your left hand side, if you face North, is:", opts: ["East", "West", "South", "North"], a: 1 },
        { q: "The opposite of North is:", opts: ["East", "West", "South", "North-East"], a: 2 },
        { q: "If South is in front of you, East is to your:", opts: ["Left", "Right", "Back", "Front"], a: 0 },
      ];
      const d = dirs[(paperNo - 1) % dirs.length];
      return Q(5, d.q, d.opts, d.a, "Logical Reasoning", 1);
    },
    () => {
      // figure counting style worded
      const items = [
        { q: "How many straight lines are needed to draw a triangle?", opts: ["2", "3", "4", "5"], a: 1 },
        { q: "A square has how many corners?", opts: ["2", "3", "4", "5"], a: 2 },
        { q: "How many sides does a rectangle have?", opts: ["3", "4", "5", "6"], a: 1 },
        { q: "A cube has faces that look like:", opts: ["Circles", "Triangles", "Squares", "Ovals"], a: 2 },
        { q: "How many equal parts make a half?", opts: ["1", "2", "3", "4"], a: 1 },
      ];
      const it = items[(paperNo - 1) % items.length];
      return Q(6, it.q, it.opts, it.a, "Logical Reasoning", 1);
    },
    () => {
      // analogy
      const pairs = [
        { q: "Pen : Write :: Knife : ?", opts: ["Cut", "Eat", "Run", "Sleep"], a: 0 },
        { q: "Bird : Fly :: Fish : ?", opts: ["Walk", "Swim", "Jump", "Sing"], a: 1 },
        { q: "Eye : See :: Ear : ?", opts: ["Taste", "Smell", "Hear", "Touch"], a: 2 },
        { q: "Day : Night :: Hot : ?", opts: ["Warm", "Cold", "Sun", "Fire"], a: 1 },
        { q: "Finger : Hand :: Toe : ?", opts: ["Head", "Foot", "Arm", "Ear"], a: 1 },
      ];
      const p = pairs[(paperNo - 1) % pairs.length];
      return Q(7, p.q, p.opts, p.a, "Logical Reasoning", 1);
    },
    () => {
      // series letters
      const series = [
        { q: "What comes next? A, C, E, G, __", opts: ["H", "I", "J", "F"], a: 1 },
        { q: "What comes next? B, D, F, H, __", opts: ["I", "J", "K", "G"], a: 1 },
        { q: "What comes next? Z, Y, X, W, __", opts: ["V", "U", "T", "A"], a: 0 },
        { q: "What comes next? A, B, C, D, __", opts: ["F", "E", "G", "H"], a: 1 },
        { q: "What comes next? M, N, O, P, __", opts: ["Q", "R", "S", "L"], a: 0 },
      ];
      const s = series[(paperNo - 1) % series.length];
      return Q(8, s.q, s.opts, s.a, "Logical Reasoning", 1);
    },
    () => {
      // coding simple / matching
      const codes = [
        { q: "If ☆ means 2 and ○ means 3, then ☆ + ○ = ?", opts: ["4", "5", "6", "3"], a: 1 },
        { q: "If ▲ = 5 and ■ = 1, then ▲ − ■ = ?", opts: ["3", "4", "6", "5"], a: 1 },
        { q: "If CAT is written as 3 letters, how many letters are in BALL?", opts: ["3", "4", "5", "2"], a: 1 },
        { q: "Which shape has no corners?", opts: ["Square", "Triangle", "Circle", "Rectangle"], a: 2 },
        { q: "Find the pair: Cup and __", opts: ["Saucer", "Shoe", "Tree", "Cloud"], a: 0 },
      ];
      const c = codes[(paperNo - 1) % codes.length];
      return Q(9, c.q, c.opts, c.a, "Logical Reasoning", 1);
    },
    () => {
      // calendar / days
      const cal = [
        { q: "How many days are there in a week?", opts: ["5", "6", "7", "8"], a: 2 },
        { q: "Which day comes after Friday?", opts: ["Thursday", "Saturday", "Sunday", "Monday"], a: 1 },
        { q: "How many months have 30 days? (approx common set)", opts: ["2", "4", "6", "7"], a: 1 },
        { q: "The first month of the year is:", opts: ["February", "March", "January", "December"], a: 2 },
        { q: "How many days are in the month of June?", opts: ["28", "29", "30", "31"], a: 2 },
      ];
      // fix "how many months have 30 days" - April June Sept Nov = 4
      const c = cal[(paperNo - 1) % cal.length];
      return Q(10, c.q, c.opts, c.a, "Logical Reasoning", 1);
    },
  ];
  return banks.map((fn) => fn());
}

function mathMR(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 11;

  // place value — numbers with 3 distinct digits; fixed unique option sets
  const nums = [234, 517, 680, 392, 845][p - 1];
  const hundreds = Math.floor(nums / 100);
  const tens = Math.floor((nums % 100) / 10);
  const ones = nums % 10;
  const fillUnique = (correct, pool) => {
    const out = [String(correct)];
    for (const x of pool) {
      const s = String(x);
      if (!out.includes(s)) out.push(s);
      if (out.length === 4) break;
    }
    let n = 1;
    while (out.length < 4) {
      const s = String(n++);
      if (!out.includes(s)) out.push(s);
    }
    return out;
  };
  items.push(
    Q(
      id++,
      `In ${nums}, the digit in the hundreds place is:`,
      fillUnique(hundreds, [tens, ones, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
      0,
      "Mathematical Reasoning",
      1
    )
  );
  const pvCorrect = tens * 10;
  items.push(
    Q(
      id++,
      `What is the place value of ${tens} in ${nums}?`,
      fillUnique(pvCorrect, [tens, tens * 100, ones * 10, ones, hundreds, 1]),
      0,
      "Mathematical Reasoning",
      1
    )
  );

  // expanded form
  items.push(
    Q(
      id++,
      `${nums} in expanded form is:`,
      [
        `${hundreds * 100} + ${tens * 10} + ${ones}`,
        `${hundreds} + ${tens} + ${ones}`,
        `${hundreds * 10} + ${tens} + ${ones}`,
        `${hundreds * 100} + ${tens} + ${ones * 10}`,
      ],
      0,
      "Mathematical Reasoning",
      1
    )
  );

  // comparison — ensure unequal pair
  const pairs = [
    [47, 52],
    [61, 58],
    [73, 79],
    [84, 80],
    [95, 89],
  ][p - 1];
  const a = pairs[0];
  const b = pairs[1];
  items.push(
    Q(id++, `Which is greater, ${a} or ${b}?`, [String(a), String(b), String(a + b), String(Math.abs(a - b))], a > b ? 0 : 1, "Mathematical Reasoning", 1)
  );

  // addition
  const x = 23 + p * 3;
  const y = 14 + p * 2;
  const sum = x + y;
  items.push(
    Q(id++, `${x} + ${y} = ?`, [String(sum), String(sum + 1), String(sum - 2), String(sum + 10)], 0, "Mathematical Reasoning", 1)
  );

  // subtraction
  const m = 80 + p * 5;
  const n = 25 + p * 3;
  const diff = m - n;
  items.push(
    Q(id++, `${m} − ${n} = ?`, [String(diff), String(diff + 2), String(diff - 1), String(m + n)], 0, "Mathematical Reasoning", 1)
  );

  // word problem add
  const apples = 12 + p;
  const more = 8 + p;
  items.push(
    Q(
      id++,
      `Ria has ${apples} pencils. She buys ${more} more. How many pencils does she have now?`,
      [String(apples + more), String(apples - more), String(apples + more + 1), String(more)],
      0,
      "Mathematical Reasoning",
      1
    )
  );

  // word problem sub
  const balloons = 30 + p * 2;
  const burst = 9 + p;
  items.push(
    Q(
      id++,
      `There were ${balloons} balloons. ${burst} burst. How many are left?`,
      [String(balloons - burst), String(balloons + burst), String(burst), String(balloons - burst - 1)],
      0,
      "Mathematical Reasoning",
      1
    )
  );

  // multiplication tables 2-5
  const t = [2, 3, 4, 5, 2][p - 1];
  const k = [6, 7, 8, 9, 5][p - 1];
  items.push(
    Q(id++, `${t} × ${k} = ?`, [String(t * k), String(t * k + t), String(t + k), String(t * k - 1)], 0, "Mathematical Reasoning", 1)
  );
  const t2 = [5, 4, 3, 2, 4][p - 1];
  const k2 = [4, 5, 6, 8, 7][p - 1];
  items.push(
    Q(id++, `${t2} × ${k2} = ?`, [String(t2 * k2 + 2), String(t2 * k2), String(t2 + k2), String(t2 * (k2 - 1))], 1, "Mathematical Reasoning", 1)
  );

  // repeated addition
  items.push(
    Q(
      id++,
      `${t} + ${t} + ${t} is the same as:`,
      [`${t} × 2`, `${t} × 3`, `${t} + 3`, `${t} × 4`],
      1,
      "Mathematical Reasoning",
      1
    )
  );

  // halves quarters
  const halfSets = [
    { q: "Half of 20 is:", opts: ["5", "10", "15", "8"], a: 1 },
    { q: "Half of 16 is:", opts: ["6", "8", "4", "10"], a: 1 },
    { q: "A quarter of 20 is:", opts: ["10", "4", "5", "8"], a: 2 },
    { q: "Half of 50 is:", opts: ["20", "25", "30", "15"], a: 1 },
    { q: "A quarter of 12 is:", opts: ["6", "4", "3", "2"], a: 2 },
  ];
  const h = halfSets[p - 1];
  items.push(Q(id++, h.q, h.opts, h.a, "Mathematical Reasoning", 1));

  // time
  const times = [
    { q: "A clock shows 3:00. The minute hand is on:", opts: ["3", "6", "9", "12"], a: 3 },
    { q: "Half past 4 is written as:", opts: ["4:00", "4:30", "4:15", "5:00"], a: 1 },
    { q: "There are ___ hours in a day.", opts: ["12", "24", "60", "30"], a: 1 },
    { q: "60 minutes make:", opts: ["1 hour", "1 day", "1 week", "Half hour"], a: 0 },
    { q: "The time 2 hours after 5 o'clock is:", opts: ["6 o'clock", "7 o'clock", "8 o'clock", "3 o'clock"], a: 1 },
  ];
  const tm = times[p - 1];
  items.push(Q(id++, tm.q, tm.opts, tm.a, "Mathematical Reasoning", 1));

  // money
  const money = [
    { q: "₹10 + ₹5 = ?", opts: ["₹12", "₹15", "₹20", "₹14"], a: 1 },
    { q: "How many ₹1 coins make ₹10?", opts: ["5", "10", "20", "2"], a: 1 },
    { q: "A pencil costs ₹7. You give ₹10. Change is:", opts: ["₹2", "₹3", "₹4", "₹5"], a: 1 },
    { q: "₹2 + ₹2 + ₹2 = ?", opts: ["₹4", "₹5", "₹6", "₹8"], a: 2 },
    { q: "Which is more money?", opts: ["₹25", "₹20", "₹15", "₹10"], a: 0 },
  ];
  const mo = money[p - 1];
  items.push(Q(id++, mo.q, mo.opts, mo.a, "Mathematical Reasoning", 1));

  // shapes 2D/3D
  const shapes = [
    { q: "A ball looks most like a:", opts: ["Cube", "Sphere", "Cone", "Cuboid"], a: 1 },
    { q: "A dice is shaped like a:", opts: ["Sphere", "Cube", "Cylinder", "Cone"], a: 1 },
    { q: "Which is a 2D shape?", opts: ["Ball", "Box", "Circle", "Can"], a: 2 },
    { q: "An ice-cream cone looks like a:", opts: ["Cube", "Sphere", "Cone", "Cuboid"], a: 2 },
    { q: "A book is most like a:", opts: ["Sphere", "Cone", "Cuboid", "Circle"], a: 2 },
  ];
  const sh = shapes[p - 1];
  items.push(Q(id++, sh.q, sh.opts, sh.a, "Mathematical Reasoning", 1));

  // measurement
  const meas = [
    { q: "Which is longer?", opts: ["1 cm", "1 m", "1 mm", "Both same"], a: 1 },
    { q: "100 cm = ?", opts: ["1 m", "10 m", "1 km", "10 cm"], a: 0 },
    { q: "A ruler is usually used to measure:", opts: ["Weight", "Length", "Time", "Money"], a: 1 },
    { q: "Which unit is best to measure a pencil?", opts: ["km", "cm", "kg", "litre"], a: 1 },
    { q: "2 metres = ? cm", opts: ["20", "200", "2", "2000"], a: 1 },
  ];
  const me = meas[p - 1];
  items.push(Q(id++, me.q, me.opts, me.a, "Mathematical Reasoning", 1));

  // skip counting / before after
  const skip = 100 + p * 11;
  items.push(
    Q(id++, `What comes just after ${skip}?`, [String(skip - 1), String(skip + 1), String(skip + 10), String(skip)], 1, "Mathematical Reasoning", 1)
  );

  // number name
  const nameSets = [
    { q: "The number name of 45 is:", opts: ["Fifty-four", "Forty-five", "Four-five", "Forty-four"], a: 1 },
    { q: "The number name of 70 is:", opts: ["Seventeen", "Seventy", "Seven", "Sixty"], a: 1 },
    { q: "Which numeral is 'ninety-nine'?", opts: ["19", "90", "99", "9"], a: 2 },
    { q: "The number name of 12 is:", opts: ["Twenty-one", "Twelve", "Eleven", "Two"], a: 1 },
    { q: "Which is 'one hundred'?", opts: ["10", "100", "1000", "101"], a: 1 },
  ];
  const nn = nameSets[p - 1];
  items.push(Q(id++, nn.q, nn.opts, nn.a, "Mathematical Reasoning", 1));

  // ordering
  items.push(
    Q(
      id++,
      `Arrange in ascending order: ${30 + p}, ${10 + p}, ${20 + p}`,
      [
        `${10 + p}, ${20 + p}, ${30 + p}`,
        `${30 + p}, ${20 + p}, ${10 + p}`,
        `${20 + p}, ${10 + p}, ${30 + p}`,
        `${10 + p}, ${30 + p}, ${20 + p}`,
      ],
      0,
      "Mathematical Reasoning",
      1
    )
  );

  // even odd simple
  const eo = 10 + p * 2; // even
  items.push(
    Q(id++, `${eo + 1} is an:`, ["Even number", "Odd number", "Both", "None"], 1, "Mathematical Reasoning", 1)
  );

  if (items.length !== 20) throw new Error(`MR expected 20 got ${items.length}`);
  return items;
}

function mathAch(paperNo) {
  const p = paperNo;
  const items = [];
  // multi-step
  const a = 15 + p * 2;
  const b = 10 + p;
  const c = 5 + p;
  items.push(
    Q(
      31,
      `A basket has ${a} mangoes. ${b} are sold and then ${c} more are put in. How many mangoes are in the basket now?`,
      [String(a - b + c), String(a + b + c), String(a - b - c), String(a + b - c)],
      0,
      "Achievers Section",
      2
    )
  );
  const side = 4 + p; // square perimeter
  items.push(
    Q(
      32,
      `A square park has each side ${side} m. What is its perimeter?`,
      [String(side * 4), String(side * 2), String(side * 3), String(side + 4)],
      0,
      "Achievers Section",
      2
    )
  );
  // money multi
  const cost = 6 + p;
  const qty = 3;
  const pay = 50;
  items.push(
    Q(
      33,
      `${qty} erasers cost ₹${cost} each. You pay ₹${pay}. How much change do you get?`,
      [String(pay - cost * qty), String(pay - cost), String(cost * qty), String(pay + cost)],
      0,
      "Achievers Section",
      2
    )
  );
  // fraction of collection
  const total = 24;
  items.push(
    Q(
      34,
      `Half of ${total} children are girls. How many girls are there?`,
      [String(total / 2), String(total / 3), String(total / 4), String(total - 2)],
      0,
      "Achievers Section",
      2
    )
  );
  // pattern + arithmetic
  const start = 2 * p;
  items.push(
    Q(
      35,
      `Look at the pattern: ${start}, ${start + 4}, ${start + 8}, ${start + 12}, __. What is the missing number? Also, the common difference is 4.`,
      [String(start + 16), String(start + 14), String(start + 20), String(start + 10)],
      0,
      "Achievers Section",
      2
    )
  );
  return items;
}

function buildMath(paperNo) {
  const raw = [...mathLR(paperNo), ...mathMR(paperNo), ...mathAch(paperNo)];
  const paper = pack(diversify(raw, paperNo));
  validate(paper, 35, 40);
  return paper;
}

/* ===================== SCIENCE ===================== */
function sciLR(paperNo) {
  const banks = [
    [
      Q(1, "Which comes next in the pattern: Seed → Sapling → ?", ["Rock", "Plant", "Cloud", "Fish"], 1, "Logical Reasoning", 1),
      Q(2, "Odd one out:", ["Eye", "Ear", "Nose", "Shoe"], 3, "Logical Reasoning", 1),
      Q(3, "Ice is to water as water is to:", ["Stone", "Steam / vapour", "Sand", "Wood"], 1, "Logical Reasoning", 1),
      Q(4, "Which pair goes together?", ["Bird – Nest", "Fish – Tree", "Dog – Sky", "Cow – River only"], 0, "Logical Reasoning", 1),
      Q(5, "If day is bright, night is:", ["Bright", "Dark", "Hot", "Blue"], 1, "Logical Reasoning", 1),
    ],
    [
      Q(1, "Find the odd one out:", ["Rose", "Lily", "Mango tree", "Sunflower"], 2, "Logical Reasoning", 1),
      Q(2, "Which comes first?", ["Adult frog", "Egg", "Tadpole", "None"], 1, "Logical Reasoning", 1),
      Q(3, "Cup is to drink as plate is to:", ["Sleep", "Eat", "Run", "Write"], 1, "Logical Reasoning", 1),
      Q(4, "Sun : Day :: Moon : ?", ["Star", "Night", "Rain", "Cloud"], 1, "Logical Reasoning", 1),
      Q(5, "Which does not belong?", ["Walking", "Running", "Jumping", "Sleeping as exercise"], 3, "Logical Reasoning", 1),
    ],
    [
      Q(1, "Pattern: Morning → Afternoon → ?", ["Midnight only", "Evening", "Last year", "Winter"], 1, "Logical Reasoning", 1),
      Q(2, "Odd one out:", ["Milk", "Curd", "Butter", "Stone"], 3, "Logical Reasoning", 1),
      Q(3, "Umbrella is used when it:", ["Snows only", "Rains", "Is night", "Is sunny always"], 1, "Logical Reasoning", 1),
      Q(4, "Leaf : Plant :: Feather : ?", ["Fish", "Bird", "Snake", "Frog"], 1, "Logical Reasoning", 1),
      Q(5, "Which is a living thing?", ["Chair", "Cat", "Rock", "Pencil"], 1, "Logical Reasoning", 1),
    ],
    [
      Q(1, "What comes next? Baby → Child → ?", ["Egg", "Adult", "Seed", "Nest"], 1, "Logical Reasoning", 1),
      Q(2, "Odd one out:", ["Carrot", "Potato", "Tomato", "Plastic"], 3, "Logical Reasoning", 1),
      Q(3, "Wool comes mainly from:", ["Hen", "Sheep", "Fish", "Frog"], 1, "Logical Reasoning", 1),
      Q(4, "Bee : Honey :: Cow : ?", ["Wool", "Milk", "Egg", "Nest"], 1, "Logical Reasoning", 1),
      Q(5, "Which is non-living?", ["Tree", "Dog", "Water bottle", "Bird"], 2, "Logical Reasoning", 1),
    ],
    [
      Q(1, "Season pattern in India often: Summer → Monsoon → ?", ["Spring only", "Winter", "Only rain", "None"], 1, "Logical Reasoning", 1),
      Q(2, "Odd one out:", ["Eyes", "Ears", "Hands", "Windows"], 3, "Logical Reasoning", 1),
      Q(3, "Fish live mainly in:", ["Air", "Water", "Desert sand only", "Fire"], 1, "Logical Reasoning", 1),
      Q(4, "Nest : Bird :: Kennel : ?", ["Cat", "Dog", "Cow", "Hen"], 1, "Logical Reasoning", 1),
      Q(5, "Which helps us to smell?", ["Eye", "Ear", "Nose", "Tongue"], 2, "Logical Reasoning", 1),
    ],
  ];
  return banks[paperNo - 1];
}

function sciMain(paperNo) {
  const banks = [
    // paper 1
    [
      ["Plants make their food mainly in the:", ["Roots", "Leaves", "Flowers", "Fruits"], 1],
      ["Which animal lives in a stable?", ["Dog", "Horse", "Bird", "Fish"], 1],
      ["We see with our:", ["Ears", "Eyes", "Nose", "Tongue"], 1],
      ["Which is a body-building food?", ["Oil", "Sugar", "Dal / pulses", "Candy"], 2],
      ["Water freezes to become:", ["Steam", "Ice", "Salt", "Oil"], 1],
      ["Moving air is called:", ["Rain", "Wind", "Soil", "Rock"], 1],
      ["The Sun rises in the:", ["West", "East", "North", "South"], 1],
      ["We should cross the road at a:", ["Anywhere", "Zebra crossing", "Dark place", "Highway middle only"], 1],
      ["Cotton clothes are good in:", ["Winter only", "Summer", "Only rain", "Snow only"], 1],
      ["The Moon gets its light from the:", ["Earth", "Sun", "Stars only", "Fire"], 1],
      ["A tadpole grows into a:", ["Fish", "Frog", "Bird", "Snake"], 1],
      ["Which sense organ helps us taste?", ["Eye", "Nose", "Tongue", "Ear"], 2],
      ["Bones and muscles help us to:", ["Fly in space", "Move", "Make food like plants", "Breathe water"], 1],
      ["Which is a herb?", ["Mango tree", "Mint plant", "Banyan", "Coconut tree"], 1],
      ["Rainwater can be collected and saved. This is called:", ["Wasting", "Rainwater harvesting idea", "Flooding only", "Cooking"], 1],
      ["A house made of snow is called an:", ["Hut", "Igloo", "Tent", "Bungalow"], 1],
      ["We must not play with:", ["Balls", "Toys", "Fire / matchsticks", "Books"], 2],
      ["Soil helps plants by giving them:", ["Music", "Support and minerals", "Plastic", "Glass"], 1],
      ["Which animal gives us wool?", ["Hen", "Sheep", "Fish", "Frog"], 1],
      ["Day and night are caused mainly because the Earth:", ["Is flat", "Spins / rotates", "Is made of water only", "Has no moon"], 1],
      ["Which is a cereal grain?", ["Apple", "Rice", "Milk", "Egg"], 1],
      ["Air is needed for:", ["Only sleeping", "Breathing", "Only swimming", "Making stones"], 1],
      ["The hottest time of day is often around:", ["Midnight", "Noon", "Early morning only", "Never"], 1],
      ["A butterfly sits mainly on:", ["Stones only", "Flowers", "Ice", "Metal only"], 1],
      ["We wear raincoats when it:", ["Snows in desert", "Rains", "Is always night", "Is sunny and dry"], 1],
    ],
    // paper 2
    [
      ["Roots of a plant mostly grow:", ["Above ground only", "Under the soil", "In the sky", "On leaves"], 1],
      ["A cow mainly eats:", ["Meat", "Grass", "Insects only", "Fish"], 1],
      ["We hear with our:", ["Eyes", "Ears", "Tongue", "Skin only"], 1],
      ["Fruits and vegetables give us mostly:", ["Only fat", "Vitamins and fibre", "Only sugar candy", "Plastic"], 1],
      ["When water is heated a lot, it becomes:", ["Ice", "Water vapour / steam", "Stone", "Oil"], 1],
      ["A cloudy day may bring:", ["Only sunshine always", "Rain", "No weather", "Earthquake only"], 1],
      ["Stars are seen clearly at:", ["Noon", "Night", "Only underwater", "Inside a closed box"], 1],
      ["We should throw waste in a:", ["River", "Dustbin", "Road", "Park grass"], 1],
      ["Woollen clothes keep us:", ["Cool in summer only", "Warm", "Wet", "Hungry"], 1],
      ["The Earth moves around the:", ["Moon", "Sun", "Mars", "A kite"], 1],
      ["Bees live in a:", ["Kennel", "Hive", "Stable", "Nest of crow only"], 1],
      ["Our skin helps us to:", ["See colours far away", "Feel hot and cold", "Hear songs", "Taste sugar only"], 1],
      ["We should wash hands before:", ["Sleeping only", "Eating", "Watching TV only", "Never"], 1],
      ["A shrub is a:", ["Very tall tree only", "Small bushy plant", "Type of rock", "Cloud"], 1],
      ["Drinking clean water keeps us:", ["Sick", "Healthy", "Always sleepy", "Dirty"], 1],
      ["A tent is a type of:", ["Food", "Shelter", "Animal", "Planet"], 1],
      ["Red light at a traffic signal means:", ["Go", "Stop", "Go fast", "Dance"], 1],
      ["Light helps us to:", ["See", "Only hear", "Only taste", "Only sleep"], 0],
      ["Which bird cannot fly well and is farmed for eggs/meat?", ["Eagle", "Hen", "Sparrow hawk", "Pigeon racer only"], 1],
      ["The Sun gives us:", ["Heat and light", "Only darkness", "Only rain", "Snow only"], 0],
      ["Milk is good for our:", ["Only hair colour", "Bones and teeth", "Only shoes", "Only toys"], 1],
      ["Plants need sunlight, water and:", ["Plastic", "Air (carbon dioxide)", "Only stones", "Only noise"], 1],
      ["In winter we often like:", ["Ice cream only", "Warm clothes", "No clothes", "Only raincoats"], 1],
      ["A fish breathes with:", ["Lungs like us exactly", "Gills", "Leaves", "Nose only like dogs"], 1],
      ["Soft soil is good for:", ["Growing plants", "Making computers", "Flying", "Only building rockets"], 0],
    ],
    // paper 3
    [
      ["Flowers often grow into:", ["Stones", "Fruits", "Clouds", "Bones"], 1],
      ["A dog’s home is called a:", ["Stable", "Kennel", "Hive", "Burrow only"], 1],
      ["We smell with our:", ["Eyes", "Ears", "Nose", "Hair"], 2],
      ["Energy-giving foods include:", ["Rice and bread", "Only water", "Only air", "Only stones"], 0],
      ["Ice melts to become:", ["Steam only always", "Water", "Rock", "Sand"], 1],
      ["A rainbow is often seen after:", ["Rain with sunlight", "Only night", "Only underground", "Snow in a room"], 0],
      ["The shape of the full Moon looks like a:", ["Triangle", "Circle / round disc", "Square", "Star only"], 1],
      ["First aid is help given:", ["Next year", "At once after a small injury", "Only in exams", "Never"], 1],
      ["We wear cotton in summer because it is:", ["Heavy and hot", "Light and airy", "Made of metal", "Waterproof always"], 1],
      ["Planets move around the:", ["Moon only", "Sun", "Earth only always", "Kite"], 1],
      ["A rabbit lives in a:", ["Hive", "Burrow", "Stable", "Nest high in sky only"], 1],
      ["Teeth help us to:", ["Hear", "Chew food", "Smell flowers", "See far"], 1],
      ["Junk food should be eaten:", ["All day every hour", "Only sometimes / less", "Instead of water", "Never with family love"], 1],
      ["A climber plant needs:", ["Support to climb", "No water", "Only darkness", "Wings"], 0],
      ["Saving water is important because:", ["Water is unlimited always", "Clean water is precious", "Rivers dislike water", "Plants hate water"], 1],
      ["Houses protect us from:", ["Only toys", "Heat, cold and rain", "Only happiness", "Only friends"], 1],
      ["We should not touch electric wires with:", ["Dry wood stick far away", "Wet hands", "Eyes closed only", "Books"], 1],
      ["Shadows form when light is:", ["Blocked by an object", "Eaten", "Turned into water", "Never present anywhere"], 0],
      ["Silkworms give us:", ["Cotton", "Silk", "Wool", "Plastic"], 1],
      ["The Earth is shaped most like a:", ["Flat plate", "Ball / sphere", "Box", "Triangle"], 1],
      ["Eggs are a source of:", ["Only sugar", "Protein", "Only water", "Only fibre cloth"], 1],
      ["We must cover our mouth when we:", ["Smile only", "Cough or sneeze", "Read", "Draw"], 1],
      ["Soil, water and air are parts of our:", ["Toys only", "Environment", "Only school bag", "Only shoes"], 1],
      ["Cats and dogs are:", ["Birds", "Pets / domestic animals", "Insects", "Fish"], 1],
      ["The coolest part of a sunny day is often:", ["Noon", "Early morning", "Exactly midday heat peak", "Never cool"], 1],
    ],
    // paper 4
    [
      ["Leaves are often green because of:", ["Plastic", "Chlorophyll", "Only mud", "Only water bottles"], 1],
      ["A horse lives in a:", ["Hive", "Stable", "Nest", "Aquarium"], 1],
      ["We feel with our:", ["Only bones inside", "Skin", "Only hair tips always", "Only nails far"], 1],
      ["Water helps our body to:", ["Only jump higher forever", "Stay healthy and work", "Turn into stone", "Stop breathing"], 1],
      ["Clouds are made of tiny:", ["Stones", "Water droplets", "Plastic bits only", "Leaves"], 1],
      ["A windy day is good for flying a:", ["Car", "Kite", "Fish", "House"], 1],
      ["We get light at night from the:", ["Sun only always", "Moon and lamps / stars", "Only soil", "Only roots"], 1],
      ["Look left and right before:", ["Sleeping in bed", "Crossing the road", "Eating an apple only", "Reading a book only"], 1],
      ["In the rainy season we use:", ["Only woollen coat always", "Umbrella / raincoat", "Only goggles for snow", "No care"], 1],
      ["The Sun is a:", ["Planet like Earth exactly", "Star", "Moon", "Rock only"], 1],
      ["Birds build:", ["Kennels", "Nests", "Stables", "Burrows under sea only"], 1],
      ["Our heart is inside the:", ["Foot", "Chest", "Hair", "Ear"], 1],
      ["We should exercise to stay:", ["Weak", "Fit and healthy", "Always ill", "Sleepy forever"], 1],
      ["Trees give us:", ["Only noise", "Oxygen and shade", "Only plastic", "Only darkness"], 1],
      ["Dirty water can make us:", ["Stronger always", "Ill", "Taller overnight", "Faster forever"], 1],
      ["A pucca house is often made of:", ["Only leaves", "Bricks and cement", "Only paper", "Only clouds"], 1],
      ["Sharp things should be used:", ["Carelessly", "Carefully", "While running always", "In the dark only"], 1],
      ["Rocks and stones are:", ["Living things", "Non-living things", "Animals", "Plants"], 1],
      ["Honey is made by:", ["Cows", "Bees", "Hens", "Goats"], 1],
      ["There are about how many days in a year?", ["7", "30", "365", "12"], 2],
      ["Carrots are good for our:", ["Shoes", "Eyes / health", "Only hair dye", "Only toys"], 1],
      ["We must not waste:", ["Only stones", "Food and water", "Only homework", "Only smiles"], 1],
      ["Animals that live with us at home are called:", ["Wild", "Domestic / pets", "Insects only", "Birds only always"], 1],
      ["The air we breathe out has more:", ["Only pure oxygen always", "Carbon dioxide than we took in", "Only gold", "Only milk"], 1],
      ["Plants need water to:", ["Grow", "Watch TV", "Drive cars", "Read books"], 0],
    ],
    // paper 5
    [
      ["The part of plant that makes seeds is often the:", ["Root only", "Flower / fruit", "Only thorn", "Only bark always"], 1],
      ["A lion lives mainly in a:", ["Hive", "Den / forest home", "Kennel at home only", "Fish bowl"], 1],
      ["Five sense organs include eyes, ears, nose, tongue and:", ["Hair only", "Skin", "Only bones", "Only blood"], 1],
      ["Protective foods are rich in:", ["Only oil always", "Vitamins (fruits/veg)", "Only salt packets", "Only stones"], 1],
      ["Steam cools to form:", ["Fire", "Water droplets", "Sand", "Plastic"], 1],
      ["Weather can be:", ["Only one forever", "Sunny, rainy or cloudy etc.", "Only underground", "Never change"], 1],
      ["The Moon appears to change:", ["Colour of blood only", "Shape (phases)", "Into a star forever", "Into the Sun"], 1],
      ["If someone is hurt we should:", ["Laugh", "Call an adult / get help", "Run away always", "Ignore forever"], 1],
      ["Clothes protect our body from:", ["Only happiness", "Heat, cold and dust", "Only friends", "Only books"], 1],
      ["Earth is our:", ["Star", "Planet", "Moon", "Galaxy name only"], 1],
      ["A hen gives us:", ["Wool", "Eggs", "Honey", "Milk mainly"], 1],
      ["Bones give our body:", ["Only colour", "Shape and support", "Only taste", "Only smell"], 1],
      ["Sleep is important because it:", ["Wastes time only", "Helps body rest and grow", "Stops learning forever", "Makes bones vanish"], 1],
      ["A big tall plant with a strong trunk is a:", ["Herb", "Tree", "Climber only", "Grass only"], 1],
      ["Boiling water can kill:", ["Only stones", "Many germs", "Only sunlight", "Only air"], 1],
      ["People in very cold places need:", ["Thin cotton only", "Warm woollen clothes", "No clothes", "Only raincoats always"], 1],
      ["Never take medicines without:", ["Friends only", "An adult / doctor advice", "A toy", "A kite"], 1],
      ["Light travels in:", ["Zigzag only always", "Straight lines (mostly)", "Only circles underground", "Only water pipes"], 1],
      ["Leather is often obtained from:", ["Animal skin (with care/industry)", "Leaves only", "Only water", "Only sand"], 0],
      ["The stars look small because they are:", ["Near our nose", "Very far away", "Inside the Earth", "Made of paper"], 1],
      ["Rotten food should be:", ["Eaten fast", "Thrown away safely", "Given as only water", "Kept forever"], 1],
      ["We should plant more:", ["Plastic bags", "Trees", "Broken glass", "Only stones"], 1],
      ["Wild animals live in the:", ["Classroom only", "Forest / wild", "Only kitchen", "Only cupboard"], 1],
      ["Our lungs help us to:", ["Digest only sweets", "Breathe", "Hear music", "Taste salt"], 1],
      ["Safety rules help us to:", ["Get hurt more", "Stay safe", "Ignore adults", "Play on roads always"], 1],
    ],
  ];
  return banks[paperNo - 1].map((row, i) =>
    Q(6 + i, row[0], row[1], row[2], "Science", 1)
  );
}

function sciAch(paperNo) {
  const banks = [
    [
      Q(31, "A plant kept in a dark cupboard for many days may:", ["Grow greener fast", "Become weak / yellowish", "Turn into an animal", "Make more fruits at once"], 1, "Achievers Section", 2),
      Q(32, "Why do we boil water from an unsafe source before drinking?", ["To make it salty", "To kill germs", "To freeze it", "To add colour"], 1, "Achievers Section", 2),
      Q(33, "If the Earth did not get sunlight, plants would:", ["Grow faster", "Not make food well", "Turn into rocks", "Start walking"], 1, "Achievers Section", 2),
      Q(34, "You touch a hot cup and pull your hand back. Which sense helped first?", ["Taste", "Touch", "Hearing only", "Smell only"], 1, "Achievers Section", 2),
      Q(35, "Cotton clothes in summer help because they:", ["Trap more heat always", "Let air pass and keep us cooler", "Are made of plastic", "Block all sweat forever badly"], 1, "Achievers Section", 2),
    ],
    [
      Q(31, "A fish taken out of water dies mainly because it cannot:", ["See", "Breathe properly", "Hear", "Smell flowers"], 1, "Achievers Section", 2),
      Q(32, "Eating only sweets every day is bad because:", ["Sweets are vegetables", "Body needs balanced food", "Sweets are made of air", "Teeth love only stones"], 1, "Achievers Section", 2),
      Q(33, "We see our shadow longer in the early morning because the Sun is:", ["Overhead", "Lower in the sky", "Not shining", "Inside Earth"], 1, "Achievers Section", 2),
      Q(34, "Saving rainwater helps mainly during:", ["Only parties", "Dry days / water shortage", "Only snow sports", "Only night games"], 1, "Achievers Section", 2),
      Q(35, "Animals that eat only plants are called:", ["Carnivores", "Herbivores", "Machines", "Minerals"], 1, "Achievers Section", 2),
    ],
    [
      Q(31, "Why should we not pluck leaves from plants without need?", ["Leaves help plant make food", "Leaves are made of iron only", "Plants dislike soil", "Leaves are animals"], 0, "Achievers Section", 2),
      Q(32, "Covering food protects it from:", ["Sunlight vitamins only", "Dust and flies / germs", "Becoming tasty", "Cooling forever"], 1, "Achievers Section", 2),
      Q(33, "Day and night happen because Earth:", ["Jumps up and down", "Rotates on its axis", "Is a cube", "Has no Sun"], 1, "Achievers Section", 2),
      Q(34, "A bird’s beak shape often matches:", ["Its favourite TV show", "The food it eats", "Only the colour of sky", "Only its nest paint"], 1, "Achievers Section", 2),
      Q(35, "Wearing clean clothes and bathing helps us stay:", ["Dirty", "Healthy and fresh", "Always sick", "Unable to play"], 1, "Achievers Section", 2),
    ],
    [
      Q(31, "If all bees disappeared, plants that need pollination might:", ["Always grow better", "Produce fewer fruits/seeds", "Turn into animals", "Stop needing water forever"], 1, "Achievers Section", 2),
      Q(32, "We sweat more on a hot day to help the body:", ["Heat up more", "Cool down", "Stop breathing", "Grow gills"], 1, "Achievers Section", 2),
      Q(33, "Sorting waste into wet and dry is useful for:", ["Making more litter on roads", "Recycling and cleanliness", "Attracting only wild lions home", "Stopping rain"], 1, "Achievers Section", 2),
      Q(34, "A desert animal may need less water because it is adapted to:", ["Very wet forests only", "Dry places", "Only cold ice forever", "Living underwater always"], 1, "Achievers Section", 2),
      Q(35, "Brushing teeth removes:", ["Only vitamins", "Food bits and helps prevent cavities", "Only tongue colour", "Only hair"], 1, "Achievers Section", 2),
    ],
    [
      Q(31, "Why do we need different kinds of food?", ["Only one food has everything always", "Different foods give different nutrients", "Food is only for fun colour", "Water is not needed if we eat stones"], 1, "Achievers Section", 2),
      Q(32, "Houses in rainy places often have sloping roofs to:", ["Hold more snow always", "Let rain water flow off", "Stop wind forever", "Grow plants on bed"], 1, "Achievers Section", 2),
      Q(33, "Staying quiet and listening in class helps us:", ["Learn better", "Disturb others more", "Break pencils", "Ignore the teacher always"], 0, "Achievers Section", 2),
      Q(34, "Plants bend towards light because they need light to:", ["Sleep only", "Make food", "Become animals", "Make noise"], 1, "Achievers Section", 2),
      Q(35, "Using a handkerchief when you sneeze shows you care about:", ["Spreading germs more", "Not spreading germs to others", "Only fashion", "Only maths sums"], 1, "Achievers Section", 2),
    ],
  ];
  return banks[paperNo - 1];
}

function buildScience(paperNo) {
  const raw = [...sciLR(paperNo), ...sciMain(paperNo), ...sciAch(paperNo)];
  const paper = pack(diversify(raw, paperNo));
  validate(paper, 35, 40);
  return paper;
}

/* ===================== ENGLISH ===================== */
function engWSK(paperNo) {
  const banks = [
    // 30 each paper
    [
      ["Choose the noun: The dog barked loudly.", ["barked", "dog", "loudly", "the"], 1],
      ["Choose the correct article: ___ apple is red.", ["A", "An", "The only always", "No word"], 1],
      ["Opposite of 'big' is:", ["large", "small", "huge", "tall"], 1],
      ["Fill in: I ___ a student.", ["is", "am", "are", "be"], 1],
      ["Plural of 'cat' is:", ["cat", "cats", "cates", "caties"], 1],
      ["Choose the adjective: She has a red ball.", ["She", "has", "red", "ball"], 2],
      ["Which is a pronoun?", ["Ravi", "He", "Delhi", "School"], 1],
      ["Fill in: They ___ playing.", ["is", "am", "are", "be"], 2],
      ["Synonym of 'happy' is:", ["sad", "glad", "angry", "tired"], 1],
      ["Correct punctuation: what is your name", ["what is your name.", "What is your name?", "What is your name", "what is your name!"], 1],
      ["Opposite of 'hot' is:", ["warm", "cold", "boil", "fire"], 1],
      ["Fill in: She ___ to school.", ["go", "goes", "going", "gone"], 1],
      ["Which is a proper noun?", ["boy", "city", "Ram", "river"], 2],
      ["A ___ names a person, place or thing.", ["verb", "noun", "adjective", "//"], 1],
      ["Fill in: This is ___ orange.", ["a", "an", "the", "some"], 1],
      ["Choose the verb: Birds fly high.", ["Birds", "fly", "high", "the"], 1],
      ["Opposite of 'day' is:", ["sun", "night", "light", "noon"], 1],
      ["Fill in: We ___ friends.", ["is", "am", "are", "be"], 2],
      ["Which word is spelled correctly?", ["Schoole", "School", "Skool", "Schol"], 1],
      ["'I' refers to:", ["someone else", "myself", "a place", "a thing only"], 1],
      ["Plural of 'bus' is:", ["bus", "buss", "buses", "busies"], 2],
      ["Choose the correct sentence:", ["He are happy.", "He is happy.", "He am happy.", "He be happy."], 1],
      ["Opposite of 'up' is:", ["above", "down", "high", "over"], 1],
      ["Fill in: The sun ___ in the east.", ["rise", "rises", "rising", "rose always only"], 1],
      ["Which is an adjective?", ["run", "blue", "quickly", "and"], 1],
      ["A sentence starts with a:", ["small letter", "capital letter", "comma", "question only"], 1],
      ["Fill in: ___ are my books.", ["This", "These", "That", "It"], 1],
      ["Synonym of 'start' is:", ["end", "begin", "stop", "finish"], 1],
      ["Choose the correct article: ___ sun is bright.", ["A", "An", "The", "Some"], 2],
      ["Opposite of 'open' is:", ["start", "closed", "wide", "big"], 1],
    ],
    [
      ["Pick the noun: My mother cooks food.", ["cooks", "mother", "my", "food is verb"], 1],
      ["Fill in: He ___ my brother.", ["am", "is", "are", "be"], 1],
      ["Opposite of 'good' is:", ["nice", "bad", "best", "kind"], 1],
      ["Article: ___ umbrella is useful in rain.", ["A", "An", "The only wrong", "No"], 1],
      ["Plural of 'baby' is:", ["babys", "babies", "babyes", "baby"], 1],
      ["Adjective in: It is a cold day.", ["It", "is", "cold", "day"], 2],
      ["Pronoun for 'Sita' (girl) is:", ["He", "She", "It only always", "They"], 1],
      ["Fill in: You ___ kind.", ["is", "am", "are", "be"], 2],
      ["Synonym of 'little' is:", ["big", "small", "tall", "wide"], 1],
      ["Correct end mark for a question:", [".", "?", "!", ","], 1],
      ["Opposite of 'in' is:", ["on", "out", "at", "by"], 1],
      ["Fill in: Tom ___ football every evening.", ["play", "plays", "playing", "played only"], 1],
      ["Proper noun:", ["school", "India", "boy", "city"], 1],
      ["'And' joins words. It is a:", ["noun", "joining word / conjunction idea", "adjective", "number"], 1],
      ["Article: I saw ___ elephant.", ["a", "an", "the always only", "some"], 1],
      ["Verb in: Children read books.", ["Children", "read", "books", "the"], 1],
      ["Opposite of 'fast' is:", ["quick", "slow", "rapid", "swift"], 1],
      ["Fill in: I ___ reading now.", ["is", "am", "are", "be"], 1],
      ["Correct spelling:", ["Frend", "Friend", "Freind", "Frind"], 1],
      ["'We' means:", ["only me", "I and others", "only you", "a thing"], 1],
      ["Plural of 'box' is:", ["boxs", "boxes", "boxies", "boxen"], 1],
      ["Correct sentence:", ["They is here.", "They are here.", "They am here.", "They be here."], 1],
      ["Opposite of 'yes' is:", ["ok", "no", "maybe", "sure"], 1],
      ["Fill in: A cow ___ milk.", ["give", "gives", "giving", "gave only"], 1],
      ["Which describes a noun?", ["adjective", "only verb", "only comma", "only full stop"], 0],
      ["Names of people start with:", ["small letters", "capital letters", "numbers", "stars"], 1],
      ["Fill in: ___ is my pen. (near)", ["That", "This", "Those", "They"], 1],
      ["Synonym of 'speak' is:", ["listen", "talk", "silent", "quiet"], 1],
      ["Article: ___ moon looks bright.", ["A", "An", "The", "Some"], 2],
      ["Opposite of 'sit' is:", ["rest", "stand", "sleep", "lie"], 1],
    ],
    [
      ["Noun in: The teacher smiled.", ["smiled", "teacher", "the", "softly"], 1],
      ["Fill in: Ravi and I ___ ready.", ["is", "am", "are", "be"], 2],
      ["Opposite of 'long' is:", ["tall", "short", "wide", "high"], 1],
      ["Article: She bought ___ book.", ["a", "an", "the only forced", "some always"], 0],
      ["Plural of 'toy' is:", ["toies", "toys", "toy", "toyes"], 1],
      ["Adjective: a happy child", ["a", "happy", "child", "the"], 1],
      ["Pronoun: The boys are playing. ___ are happy.", ["He", "She", "They", "It"], 2],
      ["Fill in: The cat ___ on the mat.", ["sleep", "sleeps", "sleeping", "slept only always"], 1],
      ["Synonym of 'angry' is:", ["calm", "cross / mad", "glad", "kind"], 1],
      ["A statement ends with a:", ["?", "!", ".", ","], 2],
      ["Opposite of 'near' is:", ["close", "far", "here", "beside"], 1],
      ["Fill in: My name ___ Meena.", ["am", "is", "are", "be"], 1],
      ["Which is a common noun?", ["Monday", "school", "India", "Taj Mahal"], 1],
      ["'On' shows place. Example: book on table. 'On' is a:", ["noun", "preposition idea", "adjective", "verb only"], 1],
      ["Article: ___ honest boy", ["A", "An", "The only", "Some"], 1],
      ["Verb: Please open the door.", ["Please", "open", "the", "door"], 1],
      ["Opposite of 'full' is:", ["fill", "empty", "more", "lot"], 1],
      ["Fill in: It ___ raining.", ["am", "is", "are", "be"], 1],
      ["Correct spelling:", ["Becaus", "Because", "Becouse", "Becuase"], 1],
      ["'You' can mean:", ["only animals", "the person spoken to", "only places", "only numbers"], 1],
      ["Plural of 'leaf' is:", ["leafs", "leaves", "leafes", "leavs"], 1],
      ["Correct: ", ["She don't like milk.", "She doesn't like milk.", "She doesn't likes milk.", "She not like milk."], 1],
      ["Opposite of 'come' is:", ["arrive", "go", "enter", "reach"], 1],
      ["Fill in: Birds ___ in the sky.", ["flies", "fly", "flying", "flew only"], 1],
      ["Which word tells more about a noun?", ["adjective", "only full stop", "only and", "only question mark"], 0],
      ["Days of the week begin with:", ["small letters", "capital letters", "commas", "numbers only"], 1],
      ["Fill in: ___ apples are sweet. (near many)", ["This", "That", "These", "It"], 2],
      ["Synonym of 'quick' is:", ["slow", "fast", "late", "lazy"], 1],
      ["Article: I have ___ idea.", ["a", "an", "the always", "some only"], 1],
      ["Opposite of 'love' is:", ["like", "hate", "care", "help"], 1],
    ],
    [
      ["Choose noun: Stars shine at night.", ["shine", "Stars", "at", "night is only verb"], 1],
      ["Fill in: The children ___ noisy.", ["is", "am", "are", "be"], 2],
      ["Opposite of 'new' is:", ["fresh", "old", "clean", "nice"], 1],
      ["Article: ___ egg is in the nest.", ["A", "An", "Some always", "Many"], 1],
      ["Plural of 'man' is:", ["mans", "men", "manses", "manes"], 1],
      ["Adjective: soft pillow", ["soft", "pillow", "a", "the"], 0],
      ["Pronoun for a thing:", ["he", "she", "it", "they only people"], 2],
      ["Fill in: Mother ___ food.", ["cook", "cooks", "cooking", "cooked only always"], 1],
      ["Synonym of 'beautiful' is:", ["ugly", "pretty", "bad", "dark"], 1],
      ["Use ___ at the end of a strong feeling sentence.", [".", "?", "!", ","], 2],
      ["Opposite of 'wet' is:", ["damp", "dry", "rainy", "soaked"], 1],
      ["Fill in: I ___ seven years old.", ["is", "am", "are", "be"], 1],
      ["Proper noun example:", ["river", "Ganga", "boy", "city"], 1],
      ["Words like 'in', 'on', 'under' show:", ["time only always", "place / position", "colour only", "number only"], 1],
      ["Article: He is ___ best player.", ["a", "an", "the", "some"], 2],
      ["Verb in: Please sit down.", ["Please", "sit", "down", "softly"], 1],
      ["Opposite of 'hard' (not soft) is:", ["tough", "soft", "strong", "firm"], 1],
      ["Fill in: These flowers ___ lovely.", ["is", "am", "are", "be"], 2],
      ["Correct spelling:", ["Wensday", "Wednesday", "Wednesdey", "Wedesday"], 1],
      ["'They' is used for:", ["one person only", "more than one", "only me", "only a place"], 1],
      ["Plural of 'child' is:", ["childs", "children", "childes", "childrens"], 1],
      ["Correct sentence:", ["I goes to school.", "I go to school.", "I going to school.", "I gone to school."], 1],
      ["Opposite of 'push' is:", ["press", "pull", "hit", "drop"], 1],
      ["Fill in: The baby ___ when it is hungry.", ["cry", "cries", "crying", "cried only"], 1],
      ["'Tall' is an:", ["noun", "adjective", "verb only", "comma"], 1],
      ["The word 'I' is always written as:", ["i", "I", "me", "my"], 1],
      ["Fill in: ___ is a bird. (far one)", ["This", "That", "These", "Those many"], 1],
      ["Synonym of 'gift' is:", ["take", "present", "steal", "hide"], 1],
      ["Article: ___ hour has sixty minutes.", ["A", "An", "The only wrong", "Some"], 1],
      ["Opposite of 'laugh' is:", ["smile", "cry", "giggle", "happy"], 1],
    ],
    [
      ["Noun: Water is useful.", ["is", "Water", "useful", "very"], 1],
      ["Fill in: She ___ my sister.", ["am", "is", "are", "be"], 1],
      ["Opposite of 'clean' is:", ["neat", "dirty", "tidy", "fresh"], 1],
      ["Article: I want ___ ice cream.", ["a", "an", "the forced", "many"], 1],
      ["Plural of 'foot' is:", ["foots", "feet", "feets", "footies"], 1],
      ["Adjective in: a brave girl", ["a", "brave", "girl", "the"], 1],
      ["Pronoun: Give the book to ___.", ["I", "me", "my", "mine only always wrong place"], 1],
      ["Fill in: Dogs ___ bark.", ["is", "bark", "barks only one", "barking"], 1],
      ["Synonym of 'begin' is:", ["end", "start", "finish", "stop"], 1],
      ["Choose correct: wow what a nice drawing", ["wow what a nice drawing.", "Wow! What a nice drawing!", "wow what a nice drawing?", "Wow what a nice drawing,"], 1],
      ["Opposite of 'early' is:", ["soon", "late", "quick", "fast"], 1],
      ["Fill in: We ___ in Class 2.", ["is", "am", "are", "be"], 2],
      ["Which is proper noun?", ["festival", "Diwali", "day", "month"], 1],
      ["A naming word is a:", ["verb", "noun", "adjective", "full stop"], 1],
      ["Article: ___ stars twinkle.", ["A", "An", "The", "Some one"], 2],
      ["Verb: Children sing songs.", ["Children", "sing", "songs", "happy"], 1],
      ["Opposite of 'weak' is:", ["soft", "strong", "small", "thin"], 1],
      ["Fill in: There ___ a book on the table.", ["am", "is", "are", "be"], 1],
      ["Correct spelling:", ["Beutiful", "Beautiful", "Beautifull", "Butiful"], 1],
      ["'Our' shows:", ["belonging to us", "only me", "only you singular always", "a verb"], 0],
      ["Plural of 'tooth' is:", ["tooths", "teeth", "toothes", "teeths"], 1],
      ["Correct:", ["He don't know.", "He doesn't know.", "He doesn't knows.", "He not know."], 1],
      ["Opposite of 'buy' is:", ["get", "sell", "take", "keep"], 1],
      ["Fill in: Father ___ a car.", ["drive", "drives", "driving", "drove only"], 1],
      ["Which word is an adjective?", ["slowly", "kind", "and", "under"], 1],
      ["Every sentence should make:", ["no sense", "complete sense", "only one letter", "only noise"], 1],
      ["Fill in: ___ boys are tall. (far many)", ["This", "That", "These", "Those"], 3],
      ["Synonym of 'home' is:", ["road", "house", "school only", "park only"], 1],
      ["Article: She is ___ European. (sounds like 'y')", ["a", "an", "the only", "some"], 0],
      ["Opposite of 'remember' is:", ["recall", "forget", "know", "think"], 1],
    ],
  ];
  // fix paper1 item with "//" 
  const rows = banks[paperNo - 1].map((r) => {
    const opts = r[1].map((o) => (o === "//" ? "adverb" : o));
    return [r[0], opts, r[2]];
  });
  return rows.map((row, i) =>
    Q(1 + i, row[0], row[1], row[2], "Word and Structure Knowledge", 1)
  );
}

function engReading(paperNo) {
  const passages = [
    {
      text: "Rani has a little red hen. Every morning the hen lays an egg. Rani feeds the hen grain and water. The hen lives in a small coop in the garden. Rani loves her hen very much.",
      qs: [
        { q: "What colour is Rani's hen?", opts: ["Blue", "Red", "Green", "Black"], a: 1 },
        { q: "What does the hen lay?", opts: ["Milk", "Eggs", "Wool", "Honey"], a: 1 },
        { q: "Where does the hen live?", opts: ["In a kennel", "In a coop", "In a hive", "In a stable"], a: 1 },
        { q: "What does Rani give the hen?", opts: ["Fish", "Grain and water", "Meat only", "Candy"], a: 1 },
        { q: "How does Rani feel about the hen?", opts: ["She dislikes it", "She loves it", "She fears it", "She ignores it"], a: 1 },
      ],
    },
    {
      text: "Aman went to the park with his father. He saw green trees and yellow flowers. Children were playing on the swings. Aman ate a banana and drank water. They went home before dark.",
      qs: [
        { q: "Who went with Aman?", opts: ["His mother only", "His father", "His teacher", "His pet"], a: 1 },
        { q: "What colour were the flowers?", opts: ["Red", "Yellow", "Blue", "Pink"], a: 1 },
        { q: "What were children doing?", opts: ["Sleeping", "Playing on swings", "Cooking", "Swimming in sea"], a: 1 },
        { q: "What did Aman eat?", opts: ["An apple", "A banana", "Rice", "Cake only"], a: 1 },
        { q: "When did they go home?", opts: ["At midnight only", "Before dark", "Next week", "Never"], a: 1 },
      ],
    },
    {
      text: "Meera's school has a big library. She borrows one storybook every Friday. She reads at home after homework. Her favourite stories are about animals. She returns the book on time.",
      qs: [
        { q: "What does Meera's school have?", opts: ["A zoo only", "A library", "A beach", "A factory"], a: 1 },
        { q: "When does she borrow a book?", opts: ["Every Monday", "Every Friday", "Every hour", "Never"], a: 1 },
        { q: "When does she read at home?", opts: ["Before waking", "After homework", "Only in class", "Never"], a: 1 },
        { q: "Her favourite stories are about:", opts: ["Cars only", "Animals", "Only maths", "Only weather"], a: 1 },
        { q: "She returns the book:", opts: ["Never", "On time", "After a year", "Torn always"], a: 1 },
      ],
    },
    {
      text: "It was raining. Kabir wore a yellow raincoat and boots. He jumped in small puddles and laughed. His mother held an umbrella. They bought warm milk from a shop.",
      qs: [
        { q: "What was the weather like?", opts: ["Sunny", "Raining", "Snowing only", "Windy desert"], a: 1 },
        { q: "What colour was the raincoat?", opts: ["Red", "Yellow", "Blue", "Black"], a: 1 },
        { q: "What did Kabir jump in?", opts: ["Sand", "Puddles", "Leaves only", "Snow only"], a: 1 },
        { q: "Who held an umbrella?", opts: ["Kabir alone", "His mother", "A stranger only", "Nobody"], a: 1 },
        { q: "What did they buy?", opts: ["Ice", "Warm milk", "Only toys", "Only books"], a: 1 },
      ],
    },
    {
      text: "Grandpa told a story about the Moon. Tina listened with wide eyes. She asked if people live on the Moon. Grandpa said the Moon is far and rocky. Tina drew a round Moon in her notebook.",
      qs: [
        { q: "Who told the story?", opts: ["Tina", "Grandpa", "A teacher only", "A neighbour"], a: 1 },
        { q: "What was the story about?", opts: ["The Sun only", "The Moon", "A fish", "A car"], a: 1 },
        { q: "Tina asked if people live:", opts: ["Under the sea only", "On the Moon", "In her pencil", "On a kite"], a: 1 },
        { q: "Grandpa said the Moon is:", opts: ["Near and soft", "Far and rocky", "Made of cheese proven", "A star factory"], a: 1 },
        { q: "What did Tina draw?", opts: ["A square box only", "A round Moon", "A triangle", "A car"], a: 1 },
      ],
    },
  ];
  const p = passages[paperNo - 1];
  return p.qs.map((item, i) =>
    Q(
      31 + i,
      `Read the passage and answer:\n"${p.text}"\n\n${item.q}`,
      item.opts,
      item.a,
      "Reading",
      1
    )
  );
}

function engSWE(paperNo) {
  const banks = [
    [
      Q(36, "Choose the best reply: 'How are you?'", ["I am fine, thank you.", "I am a book.", "Yes, a chair.", "Blue is colour."], 0, "Spoken and Written Expression", 1),
      Q(37, "Best way to greet your teacher in the morning:", ["Hey you!", "Good morning, ma'am/sir.", "Go away.", "What?"], 1, "Spoken and Written Expression", 1),
      Q(38, "Choose the polite request:", ["Give me water!", "Please give me water.", "Water now!", "You must water."], 1, "Spoken and Written Expression", 1),
      Q(39, "A thank-you note should include:", ["Only anger", "Thanks and a kind line", "Only your age", "Only a drawing of fire"], 1, "Spoken and Written Expression", 1),
      Q(40, "When you bump into someone, you say:", ["My fault never.", "Sorry.", "You move!", "Nothing."], 1, "Spoken and Written Expression", 1),
    ],
    [
      Q(36, "Reply to 'What is your name?'", ["I am fine.", "My name is ...", "Yes.", "Good night only."], 1, "Spoken and Written Expression", 1),
      Q(37, "On the phone, a polite start is:", ["Who is this yelling?", "Hello, may I speak to ...?", "Give phone!", "Bye first."], 1, "Spoken and Written Expression", 1),
      Q(38, "Choose the correct order for a short message:", ["Bye. Hello. Thanks.", "Hello. Message. Thanks/Bye.", "Thanks only then hello never.", "Only emojis of anger."], 1, "Spoken and Written Expression", 1),
      Q(39, "If you need help, you can say:", ["Help me, please.", "I never need anyone.", "Go away helper.", "You are slow."], 0, "Spoken and Written Expression", 1),
      Q(40, "When someone says 'Thank you', you may reply:", ["No never.", "You're welcome.", "I don't care.", "Stop talking."], 1, "Spoken and Written Expression", 1),
    ],
    [
      Q(36, "Best sentence to introduce yourself:", ["I name Ria.", "My name is Ria.", "Name Ria is.", "Ria name my."], 1, "Spoken and Written Expression", 1),
      Q(37, "In a group, if you want a turn to speak:", ["Shout louder always.", "Excuse me, may I say something?", "Talk over everyone.", "Leave angrily."], 1, "Spoken and Written Expression", 1),
      Q(38, "A postcard to a friend may start with:", ["Dear friend,", "Go away,", "No name,", "Only numbers,"], 0, "Spoken and Written Expression", 1),
      Q(39, "Choose the clearer sentence:", ["Ball red I have.", "I have a red ball.", "Have ball red I.", "Red ball have."], 1, "Spoken and Written Expression", 1),
      Q(40, "If you do not hear someone, you say:", ["What? Speak!", "Pardon? / Could you repeat, please?", "I won't listen.", "Be quiet forever."], 1, "Spoken and Written Expression", 1),
    ],
    [
      Q(36, "Polite way to refuse food you cannot eat:", ["Yuck!", "No, thank you.", "Take it away bad.", "You cook poorly."], 1, "Spoken and Written Expression", 1),
      Q(37, "When borrowing a pencil, say:", ["Mine now.", "May I borrow your pencil, please?", "Give!", "I took it."], 1, "Spoken and Written Expression", 1),
      Q(38, "A diary entry often starts with:", ["The date", "Only drawings of enemies", "Only maths tables", "No words ever"], 0, "Spoken and Written Expression", 1),
      Q(39, "Choose the friendly closing:", ["I hate you.", "Yours lovingly / Your friend,", "Never write again.", "Bad luck."], 1, "Spoken and Written Expression", 1),
      Q(40, "If you are late, you should:", ["Blame everyone only", "Say sorry and explain politely", "Laugh and run in", "Ignore the teacher"], 1, "Spoken and Written Expression", 1),
    ],
    [
      Q(36, "Best reply to 'Please sit down.':", ["No.", "Thank you.", "You sit.", "Why?"], 1, "Spoken and Written Expression", 1),
      Q(37, "Asking permission to leave class:", ["I go.", "May I go out, please?", "Out now!", "Bye class forever."], 1, "Spoken and Written Expression", 1),
      Q(38, "A notice on the board should be:", ["Unclear and tiny", "Clear and short", "Only angry words", "Without a heading ever"], 1, "Spoken and Written Expression", 1),
      Q(39, "Choose correct spoken offer:", ["Want water force!", "Would you like some water?", "Drink or else.", "Water bad."], 1, "Spoken and Written Expression", 1),
      Q(40, "When you receive a gift, you say:", ["Only this?", "Thank you so much!", "I wanted more.", "Take it back."], 1, "Spoken and Written Expression", 1),
    ],
  ];
  return banks[paperNo - 1];
}

function buildEnglish(paperNo) {
  const raw = [...engWSK(paperNo), ...engReading(paperNo), ...engSWE(paperNo)];
  // Do not diversify reading stems heavily — still ok with diversify on options
  const paper = pack(diversify(raw, paperNo));
  validate(paper, 40, 40);
  return paper;
}

/* ===================== COMPUTER ===================== */
function compLR(paperNo) {
  const banks = [
    [
      Q(1, "Odd one out:", ["Monitor", "Keyboard", "Mouse", "Apple fruit"], 3, "Logical Reasoning", 1),
      Q(2, "Which comes first to start work on a PC?", ["Shut down only", "Switch on / power on", "Break it", "Remove all wires always"], 1, "Logical Reasoning", 1),
      Q(3, "Pen : Paper :: Keyboard : ?", ["Chair", "Computer", "Fan", "Ball"], 1, "Logical Reasoning", 1),
      Q(4, "Find the next: Click, type, save, ?", ["Throw PC", "Print / open later", "Eat mouse", "Water the CPU"], 1, "Logical Reasoning", 1),
      Q(5, "Which does not belong to computer parts?", ["CPU", "Monitor", "Banana", "Mouse"], 2, "Logical Reasoning", 1),
    ],
    [
      Q(1, "Odd one out:", ["Paint", "Notepad idea", "Word idea", "Cricket bat"], 3, "Logical Reasoning", 1),
      Q(2, "Input is to keyboard as output is to:", ["Mouse only", "Monitor", "Wire only", "Table"], 1, "Logical Reasoning", 1),
      Q(3, "Light : Bulb :: Information : ?", ["Computer", "Chair", "Shoe", "Cloud rain only"], 0, "Logical Reasoning", 1),
      Q(4, "Order: Open app → Work → ?", ["Never save", "Save and close", "Break screen", "Pour water"], 1, "Logical Reasoning", 1),
      Q(5, "Which is a pointing device?", ["Monitor", "Mouse", "Speaker only", "UPS only"], 1, "Logical Reasoning", 1),
    ],
    [
      Q(1, "Odd one out:", ["Printer", "Speaker", "Headphones", "Keyboard as output only"], 3, "Logical Reasoning", 1),
      Q(2, "Full form idea: PC means:", ["Public Car", "Personal Computer", "Pencil Case", "Paper Cup"], 1, "Logical Reasoning", 1),
      Q(3, "Book : Read :: Game software : ?", ["Play", "Eat", "Sleep", "Swim"], 0, "Logical Reasoning", 1),
      Q(4, "Pattern of keys: A B C D __", ["F", "E", "G", "Z"], 1, "Logical Reasoning", 1),
      Q(5, "Which stores work to carry easily?", ["Monitor screen only", "Pen drive", "Speaker", "Mouse pad only"], 1, "Logical Reasoning", 1),
    ],
    [
      Q(1, "Odd one out:", ["Passwords", "Careful clicking", "Sharing secrets online", "Asking an adult"], 2, "Logical Reasoning", 1),
      Q(2, "Start button idea is used to:", ["Cook food", "Open programs / start menu", "Wash clothes", "Grow plants"], 1, "Logical Reasoning", 1),
      Q(3, "Ear : Sound :: Monitor : ?", ["Smell", "Pictures / display", "Taste", "Wind"], 1, "Logical Reasoning", 1),
      Q(4, "Steps: Draw in Paint → ?", ["Delete OS always", "Save the drawing", "Throw mouse", "Unplug forever first"], 1, "Logical Reasoning", 1),
      Q(5, "Which is NOT an input device?", ["Keyboard", "Mouse", "Monitor", "Microphone idea"], 2, "Logical Reasoning", 1),
    ],
    [
      Q(1, "Odd one out:", ["Desktop", "Laptop", "Tablet idea", "Refrigerator"], 3, "Logical Reasoning", 1),
      Q(2, "Double-click is often used to:", ["Sleep only", "Open something", "Break glass", "Print food"], 1, "Logical Reasoning", 1),
      Q(3, "Stamp : Letter :: Email idea : ?", ["Message on computer/phone", "Only paper boat", "Only stone", "Only tree"], 0, "Logical Reasoning", 1),
      Q(4, "Safe order online: Think → Ask adult → ?", ["Share password with strangers", "Act carefully", "Click every ad", "Tell home address to all"], 1, "Logical Reasoning", 1),
      Q(5, "CPU is often called the:", ["Heart/brain of computer", "Only screen", "Only speaker", "Only wire"], 0, "Logical Reasoning", 1),
    ],
  ];
  return banks[paperNo - 1];
}

function compMain(paperNo) {
  const banks = [
    [
      ["The full form of CPU is:", ["Central Pen Unit", "Central Processing Unit", "Computer Power Umbrella", "Control Print USB"], 1],
      ["A monitor is used to:", ["Type letters", "Show display / output", "Print on paper only", "Scan food"], 1],
      ["A keyboard is an _____ device.", ["output", "input", "storage only", "cooking"], 1],
      ["The mouse is used to:", ["Move the pointer", "Cool the CPU", "Wash the screen", "Print books only"], 0],
      ["MS Paint is used for:", ["Drawing and colouring", "Only calculating sums", "Only sending rockets", "Only cooking"], 0],
      ["To draw a straight line in Paint, we use the:", ["Eraser only", "Line tool", "Only fill always", "Only text never"], 1],
      ["The Enter key is used to:", ["Delete a letter", "Start a new line / confirm", "Turn off sun", "Open fridge"], 1],
      ["A printer gives:", ["Soft copy only on screen", "Hard copy on paper", "Only sound", "Only heat"], 1],
      ["We should keep liquids _____ the computer.", ["on", "away from", "inside", "under keys always"], 1],
      ["A pen drive is used for:", ["Cooking", "Storing and carrying files", "Only drawing lines on wall", "Only cooling tea"], 1],
      ["Speakers are used for:", ["Showing pictures only", "Hearing sound", "Typing only", "Printing only"], 1],
      ["The spacebar is the _____ key on the keyboard.", ["smallest", "longest", "round only", "hidden"], 1],
      ["Turning off the computer properly is called:", ["Crash", "Shut down", "Delete forever OS", "Paint"], 1],
      ["A laptop is a computer that is:", ["Only as big as a room", "Portable", "Unable to show display", "Only a phone tower"], 1],
      ["Icons on the desktop are:", ["Small pictures to open things", "Only foods", "Only viruses always", "Only books paper"], 0],
      ["The eraser tool in Paint is used to:", ["Add colour always", "Remove parts of drawing", "Save file", "Print"], 1],
      ["QWERTY is a type of:", ["Monitor brand only", "Keyboard layout", "Mouse shape only", "Printer ink only"], 1],
      ["We should not share our _____ with strangers.", ["drawings of trees", "passwords", "favourite colour only", "school bag colour only"], 1],
      ["A scanner is used to:", ["Cook rice", "Copy paper photos/docs into computer", "Cool CPU with water", "Only play music"], 1],
      ["The brain of the computer is the:", ["Monitor", "CPU", "Mouse pad", "Speaker"], 1],
      ["Clicking the left mouse button once is a:", ["Double-click", "Single click", "Drag only", "Scroll only always"], 1],
      ["Files can be stored in a:", ["Folder", "Only river", "Only cloud rain drop", "Only pencil sharpener"], 0],
      ["UPS helps when:", ["There is power cut (backup idea)", "We paint", "We type only letters A", "Mouse is lost forever"], 0],
      ["The delete key is used to:", ["Add space", "Remove characters / items", "Draw circles", "Increase volume only"], 1],
      ["A good computer habit is:", ["Eat on the keyboard", "Sit straight and take breaks", "Hit the screen", "Pull wires hard"], 1],
    ],
    [
      ["Which device shows pictures and text?", ["Keyboard", "Monitor", "Mouse only", "CPU fan only"], 1],
      ["Microphone is used to:", ["Show video only", "Input sound / voice", "Print pages", "Store only photos forever"], 1],
      ["Hardware means:", ["Parts you can touch", "Only games ideas", "Only internet clouds", "Only passwords"], 0],
      ["Software means:", ["Plastic box only", "Programs / instructions", "Only wires", "Only tables"], 1],
      ["In Paint, the brush tool is for:", ["Typing essays only", "Freehand drawing", "Only erasing text files", "Shutting down"], 1],
      ["Fill-with-colour tool is often called:", ["Bucket / fill", "Scissors only", "Zoom only", "Save as only"], 0],
      ["Caps Lock is used for:", ["Only numbers", "Typing capital letters", "Only shutting PC", "Only volume"], 1],
      ["A webcam is used to:", ["Capture video/images of you", "Print books", "Cool tea", "Water plants"], 0],
      ["We should wash hands _____ using a shared computer if dirty.", ["never", "before (good hygiene)", "with oil on keys", "after breaking it"], 1],
      ["CD/DVD idea is a type of:", ["Storage media (older)", "Monitor", "Keyboard key", "Only mouse"], 0],
      ["Headphones help us hear without:", ["Sound ever", "Disturbing others much", "Using electricity ever", "A computer"], 1],
      ["Backspace key removes letters to the:", ["Right only always", "Left of the cursor", "Only whole file forever no undo", "Only desktop wallpaper"], 1],
      ["Restart means:", ["Paint a wall", "Start the computer again", "Delete all schools", "Only sleep forever"], 1],
      ["A tablet is:", ["Only a medicine always", "A touch-screen computing device", "Only a stone", "Only a printer"], 1],
      ["The desktop is the:", ["Main screen area with icons", "Only CPU inside", "Only keyboard tray", "Only mouse tail"], 0],
      ["To select a part of drawing we may use:", ["Selection tool", "Only shut down", "Only speakers", "Only UPS"], 0],
      ["Number keys are used to type:", ["Only letters", "Numbers", "Only smileys forced", "Only spaces"], 1],
      ["If a website asks for home address and you are a child, you should:", ["Tell everyone", "Ask a parent/teacher first", "Post it publicly", "Ignore safety"], 1],
      ["A joystick is often used for:", ["Cooking", "Playing games", "Washing", "Only printing essays"], 1],
      ["Processing means the computer is:", ["Sleeping only", "Working on data", "Only broken", "Only off forever"], 1],
      ["Dragging with mouse means:", ["Throwing the mouse", "Hold button and move", "Only double right forever", "Unplugging"], 1],
      ["A file name helps us to:", ["Forget work", "Find our work later", "Break folders", "Hide from teachers always"], 1],
      ["Do not use computers with:", ["Dry hands and care", "Wet hands near power", "A chair", "Soft light"], 1],
      ["Arrow keys move the:", ["House", "Cursor / pointer position in text", "Sun", "Only printer ink"], 1],
      ["Sitting too close to the screen for long is:", ["Always best", "Not good for eyes", "Required by CPU", "Needed for mouse"], 1],
    ],
    [
      ["CPU is usually kept in the:", ["Only monitor glass", "Cabinet / system box", "Only mouse", "Only keycaps"], 1],
      ["Output devices include:", ["Keyboard and mic only", "Monitor and printer", "Only pen drive as input forced", "Only chair"], 1],
      ["The keys with letters are called:", ["Function only", "Alphabet keys", "Only arrow forever", "Only space"], 1],
      ["Scroll wheel on mouse helps to:", ["Type capital", "Move up/down a page", "Print colours", "Shut OS only"], 1],
      ["MS Paint file drawings are often saved as pictures like:", ["Only .exe virus", "Image files (e.g. PNG/JPEG idea)", "Only folders of sand", "Only CPU chips"], 1],
      ["Text tool in Paint lets you:", ["Only erase", "Write words on drawing", "Only fill red always", "Only zoom out forever"], 1],
      ["Escape (Esc) key is often used to:", ["Save always", "Cancel / close a dialog", "Type space", "Increase bass"], 1],
      ["A projector shows computer screen on a:", ["Small stamp only", "Big wall/screen", "Only mouse pad", "Only pen drive"], 1],
      ["Food crumbs on keyboard can:", ["Help typing", "Damage keys", "Cool CPU", "Increase RAM"], 1],
      ["Cloud storage idea means saving on:", ["Only paper under bed", "Internet storage services", "Only blackboard", "Only stone"], 1],
      ["A touchpad on a laptop works like a:", ["Monitor", "Mouse", "Printer", "Speaker"], 1],
      ["Shift key helps to type:", ["Only spaces", "Capital letters / symbols", "Only delete all", "Only shutdown"], 1],
      ["Sleep mode means the computer:", ["Is thrown away", "Uses less power / rests", "Deletes Paint", "Prints alone"], 1],
      ["Smartphones are:", ["Not computers ever", "Small computing devices", "Only radios without chips", "Only wooden toys"], 1],
      ["Recycle Bin is used for:", ["Growing plants", "Deleted files (can restore idea)", "Only printing", "Only CPU oil"], 1],
      ["Zoom in Paint helps you see:", ["Smaller always only", "Closer / larger view", "Only black screen", "Only shut down"], 1],
      ["Function keys are usually:", ["F1, F2, ... on top", "Only spacebar", "Only mouse left", "Only power brick"], 0],
      ["A strong password should not be:", ["Your pet name only easy guess", "A mix hard for others (with adult help)", "Written on the monitor for all", "Shared in class group publicly"], 0],
      ["Speakers need _____ to play sound.", ["Only paper", "Power / connection", "Only paint brush", "Only eraser"], 1],
      ["Data means:", ["Only furniture", "Information processed/stored", "Only rain", "Only shoes"], 1],
      ["Right-click often opens a:", ["Only Paint colour", "Context menu", "Only fridge", "Only book"], 1],
      ["Folders help us to:", ["Mix all files randomly forever", "Organise files", "Break the HDD always", "Hide the monitor"], 1],
      ["Never put magnets near:", ["Wooden pencils only", "Some storage devices / screens carelessly", "Paper books only", "Cotton clothes only"], 1],
      ["Ctrl key is often used with other keys as a:", ["Only letter Z alone forced", "Shortcut helper", "Only volume rocker", "Only webcam shutter"], 1],
      ["Taking breaks while using computer helps your:", ["Only shoes", "Eyes and body", "Only password strength magically", "Only printer ink dry faster badly"], 1],
    ],
    [
      ["ALU is a part of:", ["Mouse cable", "CPU (processing idea)", "Only monitor stand", "Only keyboard tray"], 1],
      ["Which is an input device?", ["Printer", "Scanner", "Monitor", "Speaker"], 1],
      ["Numeric keypad is used for fast:", ["Drawing only", "Number entry", "Only video chat", "Only painting skies"], 1],
      ["A double-click often:", ["Closes the school", "Opens a file/icon", "Prints automatically always", "Deletes OS without ask"], 1],
      ["The colour box in Paint shows:", ["Only files", "Colours to use", "Only fonts of Word forced", "Only recycle bin"], 1],
      ["Curve tool helps draw:", ["Only squares forced", "Curved lines", "Only text boxes of code", "Only CPU fans"], 1],
      ["Tab key is used to:", ["Jump / indent to next stop", "Only shut down", "Only increase brightness forced", "Only eject CD always"], 0],
      ["Bluetooth idea connects devices:", ["Only with long wet ropes", "Wirelessly (short range idea)", "Only through rivers", "Only via paper mail"], 1],
      ["Keep the screen _____ to reduce eye strain.", ["too bright always max", "at a comfortable level", "covered with cloth while working", "two inches from nose"], 1],
      ["Hard disk stores data:", ["Only for one second always", "For long term on the computer", "Only on paper outside", "Only in the mouse"], 1],
      ["A light pen / stylus idea is used on:", ["Only fridge doors forced", "Some screens to write/draw", "Only keyboards mechanical", "Only UPS batteries"], 1],
      ["Home key often moves cursor to:", ["End of line", "Start of line", "Only desktop recycle", "Only Paint red"], 1],
      ["Log in means:", ["Leaving forever", "Starting a user session with account", "Only painting", "Only unplugging"], 1],
      ["A desktop computer usually needs a:", ["Only battery forever without power", "Power supply from plug / UPS", "Only sunlight solar forced always", "Only water cooling by pouring"], 1],
      ["Taskbar is usually at the _____ of the screen.", ["only middle of sky", "bottom (often)", "inside CPU chip", "inside mouse ball only"], 1],
      ["Undo in Paint helps to:", ["Save forever only", "Reverse last action", "Print two copies forced", "Delete keyboard"], 1],
      ["Arrow keys are also called:", ["Only alphabet", "Cursor control keys", "Only function F12 forced", "Only space twins"], 1],
      ["Cyber safety starts with:", ["Sharing OTP with friends", "Not talking to strangers online", "Posting school gate photo with address", "Clicking all pop-ups"], 1],
      ["A barcode scanner reads:", ["Human minds", "Printed codes on items", "Only weather", "Only music feelings"], 1],
      ["Memory helps the computer to:", ["Only stay off", "Hold data while working", "Only heat room", "Only print colours of rainbow forced"], 1],
      ["Hovering means moving pointer _____ clicking.", ["after deleting OS", "without / before deciding to click", "only while pouring water", "only after unplugging"], 1],
      ["Renaming a file helps us:", ["Lose it forever always", "Give a clearer name", "Break folders", "Hide from recycle only"], 1],
      ["Dusty computers may:", ["Run cooler always", "Overheat or fail more", "Type alone", "Paint better"], 1],
      ["Print Screen key can capture:", ["Only sound", "A screen image idea", "Only passwords safely always public", "Only CPU temperature as music"], 1],
      ["Ask an adult before:", ["Drawing a tree offline", "Installing unknown programs", "Saving a Paint file to folder", "Using headphones at low volume"], 1],
    ],
    [
      ["Which part does the thinking/calculations?", ["Monitor glass", "CPU", "Speaker cone", "Mouse cable"], 1],
      ["Keyboard sends _____ to the computer.", ["only heat", "input signals / data", "only printed paper", "only dust"], 1],
      ["The longest key is usually the:", ["Enter", "Spacebar", "Esc", "F1"], 1],
      ["To drag and drop you need to:", ["Only look", "Hold mouse button while moving", "Only shout", "Only restart twice"], 1],
      ["Shapes tool in Paint can draw:", ["Only photographs of people forced", "Rectangles, ellipses etc.", "Only folders", "Only emails"], 1],
      ["Set as background idea uses an image as:", ["Only recycle content", "Desktop wallpaper", "Only CPU BIOS forced", "Only printer queue"], 1],
      ["Enter key is also called:", ["Return key idea", "Only escape forever", "Only alt paint", "Only mouse middle only"], 0],
      ["Wi-Fi helps devices connect to:", ["Only water taps", "Internet / network without cable idea", "Only school bells", "Only chalkboards"], 1],
      ["Password should be known to:", ["Whole class and bus", "You and trusted adults as needed", "Every website stranger", "Posted on gate"], 1],
      ["RAM is a type of:", ["Only printer", "Memory (working)", "Only monitor stand", "Only plastic art"], 1],
      ["Output of a speaker is:", ["Text on paper", "Sound", "Only smell", "Only light always"], 1],
      ["Delete and Backspace both can:", ["Draw circles", "Remove text", "Only cool CPU", "Only open Paint forced"], 1],
      ["Shut down should be done:", ["By pulling plug roughly always", "Using proper option when possible", "By removing HDD while on", "By pouring water"], 1],
      ["A smartwatch is a:", ["Only wall clock wood", "Wearable computing device idea", "Only desktop tower", "Only pen drive shape forced"], 1],
      ["This PC / My Computer icon helps browse:", ["Only skies", "Drives and files", "Only kitchens", "Only playgrounds without files"], 1],
      ["Crop idea means to:", ["Grow wheat in PC", "Cut image to smaller area", "Only add noise", "Only delete Windows forced"], 1],
      ["Keys on the top row with F are:", ["Alphabet", "Function keys", "Only space clones", "Only arrows"], 1],
      ["If a stranger chats and asks to meet, you should:", ["Go alone", "Tell a parent/teacher and not go alone", "Share address at once", "Send school photos"], 1],
      ["A flash drive connects usually to a:", ["HDMI only forced always", "USB port", "Only headphone jack forever", "Only power brick hole"], 1],
      ["Booting means:", ["Kicking the PC", "Starting up the computer", "Only painting boots", "Only deleting Paint"], 1],
      ["Pointer is the mark on screen controlled by:", ["Only keyboard lights", "Mouse / touchpad", "Only printer", "Only UPS beep"], 1],
      ["Copy and paste help us to:", ["Destroy files only", "Duplicate content easily", "Only format HDD always", "Only unplug safely"], 1],
      ["Keep cables:", ["Tangled under feet always", "Neat and safe", "In water", "Chewed by pets for fun"], 1],
      ["Volume control changes:", ["Screen size only", "Sound level", "Only file names", "Only CPU name"], 1],
      ["Being kind online means:", ["Bullying in chat", "Using polite words", "Sharing others' secrets", "Spamming friends angrily"], 1],
    ],
  ];
  return banks[paperNo - 1].map((row, i) =>
    Q(6 + i, row[0], row[1], row[2], "Computers and IT", 1)
  );
}

function compAch(paperNo) {
  const banks = [
    [
      Q(31, "You typed a story and the power went off without saving. What should you do next time?", ["Never type again", "Save your work often", "Pour water on UPS", "Delete the keyboard"], 1, "Achievers Section", 2),
      Q(32, "Monitor shows output. Keyboard gives input. Which pair is correct?", ["Printer – input only always", "Mouse – input; Speaker – output", "Speaker – input only; Mouse – output only", "CPU – only a cable"], 1, "Achievers Section", 2),
      Q(33, "Why should children ask adults before downloading apps?", ["Apps are always safe forever", "Some apps can be unsafe or paid wrongly", "Adults dislike fun", "Downloads grow plants"], 1, "Achievers Section", 2),
      Q(34, "In Paint, which steps best make a simple house?", ["Only shut down twice", "Draw shapes, colour, then save", "Only smash keys", "Only open Recycle Bin"], 1, "Achievers Section", 2),
      Q(35, "A pen drive is full. A good next step is:", ["Force more files until break", "Delete unneeded files or use another storage", "Put it in water", "Hammer the USB"], 1, "Achievers Section", 2),
    ],
    [
      Q(31, "You receive a message: 'You won a prize, share OTP'. You should:", ["Share OTP at once", "Not share OTP; tell an adult", "Forward to all friends to share too", "Post OTP on board"], 1, "Achievers Section", 2),
      Q(32, "Which sequence is safer for leaving the computer?", ["Pull plug while working", "Save → close apps → shut down", "Delete Windows first", "Remove CPU fan running"], 1, "Achievers Section", 2),
      Q(33, "Double-click opens a folder. Single click usually:", ["Formats disk always", "Selects an item", "Prints ten pages forced", "Calls police"], 1, "Achievers Section", 2),
      Q(34, "Why is a mouse pad useful?", ["It cooks food", "Smoother mouse movement / surface", "It cools tea", "It stores cloud rain"], 1, "Achievers Section", 2),
      Q(35, "Icons are small because they:", ["Hide viruses only", "Represent programs/files quickly", "Replace the CPU", "Are only stickers offline"], 1, "Achievers Section", 2),
    ],
    [
      Q(31, "Input → Process → Output. Typing a name and seeing it on screen is:", ["Only input without output", "Input and then output after processing", "Only hardware breaking", "Only software eating lunch"], 1, "Achievers Section", 2),
      Q(32, "Which is the best place for a school computer?", ["Wet bathroom", "Clean dry table with care", "Open rain balcony", "Kitchen stove top"], 1, "Achievers Section", 2),
      Q(33, "Caps Lock ON means letters will be:", ["Only numbers", "Mostly CAPITALS", "Invisible", "Deleted"], 1, "Achievers Section", 2),
      Q(34, "A folder named 'Class2-Paint' is good because:", ["Names should be random symbols only", "It tells what is inside", "Folders cannot have names", "It deletes files nightly"], 1, "Achievers Section", 2),
      Q(35, "If the pointer moves wrongly, check the:", ["Only ceiling fan speed", "Mouse / touchpad and surface", "Only school bag", "Only water bottle brand"], 1, "Achievers Section", 2),
    ],
    [
      Q(31, "Speaker is silent though video plays. First simple check:", ["Break the monitor", "Volume / mute and connections", "Delete Paint", "Format pen drive always"], 1, "Achievers Section", 2),
      Q(32, "Why not share your photo with house number to unknown people online?", ["It is always required", "It can be unsafe for privacy", "Photos cannot be shared ever offline", "Houses dislike numbers"], 1, "Achievers Section", 2),
      Q(33, "Printer needs _____ to make a hard copy.", ["Only silence", "Paper and ink/toner (and power)", "Only a mouse pad", "Only headphones"], 1, "Achievers Section", 2),
      Q(34, "Which tool removes a small mistake in a drawing without deleting all?", ["Shut down", "Eraser / undo", "Only format C:", "Only unplug UPS"], 1, "Achievers Section", 2),
      Q(35, "CPU fan is there mainly to:", ["Play music louder", "Keep CPU from overheating", "Print colours", "Type faster letters"], 1, "Achievers Section", 2),
    ],
    [
      Q(31, "You want both a drawing and a story file. Best organisation:", ["Put both unnamed on desktop messily forever", "Save in clearly named folders/files", "Delete one always", "Store only in Recycle Bin"], 1, "Achievers Section", 2),
      Q(32, "Keyboard + monitor + CPU together are mainly:", ["Only toys without use", "Hardware parts of a computer system", "Only one software app", "Only internet cables"], 1, "Achievers Section", 2),
      Q(33, "A good posture at the computer includes:", ["Lying on the keyboard", "Straight back and screen at eye level idea", "Screen behind your head", "Standing on the chair always"], 1, "Achievers Section", 2),
      Q(34, "Clicking unknown email links can:", ["Always give free safe gifts", "Be risky (viruses/scams)", "Repair hardware magically", "Water the plants"], 1, "Achievers Section", 2),
      Q(35, "Saving work with a clear name helps you _____ it later.", ["lose", "find", "break", "print only as sound"], 1, "Achievers Section", 2),
    ],
  ];
  return banks[paperNo - 1];
}

function buildComputer(paperNo) {
  const raw = [...compLR(paperNo), ...compMain(paperNo), ...compAch(paperNo)];
  const paper = pack(diversify(raw, paperNo));
  validate(paper, 35, 40);
  return paper;
}

/* ===================== GK ===================== */
function gkGA(paperNo) {
  const banks = [
    [
      ["The capital of India is:", ["Mumbai", "New Delhi", "Kolkata", "Chennai"], 1],
      ["The Taj Mahal is in:", ["Delhi", "Agra", "Jaipur", "Mumbai"], 1],
      ["Our national animal is the:", ["Lion", "Tiger", "Elephant", "Peacock"], 1],
      ["Our national bird is the:", ["Crow", "Peacock", "Sparrow", "Eagle"], 1],
      ["The festival of lights is:", ["Holi", "Diwali", "Eid only", "Christmas only"], 1],
      ["Holi is the festival of:", ["Lights", "Colours", "Only kites forced", "Only snow"], 1],
      ["The Red Fort is in:", ["Mumbai", "Delhi", "Chennai", "Kolkata"], 1],
      ["Which is a national festival?", ["Only birthday at home", "Independence Day", "Only school picnic", "Only market day"], 1],
      ["The farthest planet from the Sun in classic 9 list often taught is:", ["Mercury", "Neptune / Pluto idea (far)", "Earth", "Venus"], 1],
      ["How many colours are in the rainbow commonly taught?", ["5", "7", "9", "3"], 1],
      ["The Prime Minister of India works mainly from:", ["Only Mumbai always", "New Delhi", "Only a village nowhere", "Only foreign land forced"], 1],
      ["Which sport uses a bat and ball and is very popular in India?", ["Ice hockey only", "Cricket", "Only skiing", "Only polo underwater"], 1],
      ["Lotus is our national:", ["Animal", "Flower", "Bird", "Tree only forced"], 1],
      ["The Arabian Sea is to the _____ of India.", ["east", "west", "only north pole", "only space"], 1],
      ["Farmers grow food in:", ["Only airports", "Fields", "Only cinema halls", "Only libraries"], 1],
      ["A doctor helps us when we are:", ["Only happy forever", "Ill / hurt", "Only playing well", "Only sleeping well"], 1],
      ["The largest ocean on Earth is the:", ["Arctic only puddle", "Pacific Ocean", "Only pond near home", "Only well"], 1],
      ["Republic Day is on:", ["15 August", "26 January", "2 October", "14 November"], 1],
      ["The currency of India is the:", ["Dollar", "Rupee", "Yen", "Pound"], 1],
      ["Earth is the _____ planet from the Sun.", ["first", "third", "fifth", "ninth"], 1],
    ],
    [
      ["Mumbai is in the state of:", ["Punjab", "Maharashtra", "Kerala only forced", "Assam only"], 1],
      ["Gateway of India is in:", ["Delhi", "Mumbai", "Jaipur", "Agra"], 1],
      ["Our national tree is the:", ["Rose plant", "Banyan", "Mint", "Grass only"], 1],
      ["National fruit of India is often taught as:", ["Apple", "Mango", "Grapes only", "Orange only"], 1],
      ["Christmas is celebrated on:", ["1 January", "25 December", "15 August", "26 January"], 1],
      ["Eid is an important festival of:", ["Only one street", "Many Muslim families / community", "Only computers", "Only rivers"], 1],
      ["India Gate is in:", ["Chennai", "New Delhi", "Kolkata only", "Goa only"], 1],
      ["Gandhi Jayanti is on:", ["15 August", "2 October", "26 January", "14 November"], 1],
      ["The planet known as the Red Planet is:", ["Venus", "Mars", "Mercury", "Saturn"], 1],
      ["There are _____ days in a leap year.", ["365", "366", "364", "360"], 1],
      ["The President of India is the:", ["Only sports captain", "Head of the Republic (constitutional)", "Only a mayor of one lane", "Only a school principal always"], 1],
      ["Hockey is played with a:", ["Only tennis racket forced", "Stick and ball", "Only swimming float", "Only chess piece"], 1],
      ["Ashoka Chakra is in the _____ of our flag.", ["green strip only", "centre of white stripe", "only saffron border forced", "only pole"], 1],
      ["Bay of Bengal is to the _____ of India.", ["west", "east", "only south pole ice", "only sky"], 1],
      ["A teacher works mainly in a:", ["Hospital only", "School", "Only police jeep", "Only farm tractor forced"], 1],
      ["A police officer helps to keep:", ["Only gardens messy", "Law and order / safety", "Only kites flying", "Only markets closed forever"], 1],
      ["The smallest planet is often:", ["Jupiter", "Mercury", "Earth", "Neptune"], 1],
      ["Independence Day of India is on:", ["26 January", "15 August", "2 October", "1 May"], 1],
      ["How many states does India have? (current taught ~28)", ["10", "28", "50", "100"], 1],
      ["The Sun is a:", ["Planet", "Star", "Moon", "Comet only"], 1],
    ],
    [
      ["Jaipur is known as the _____ city.", ["Blue only always", "Pink", "Green only", "Black"], 1],
      ["Charminar is in:", ["Delhi", "Hyderabad", "Mumbai", "Agra"], 1],
      ["Our national aquatic animal is the:", ["Shark only", "Ganges river dolphin", "Goldfish pet only", "Whale in all rivers"], 1],
      ["Tiranga means our flag has _____ main colours.", ["two", "three", "five", "one"], 1],
      ["Onam is mainly celebrated in:", ["Punjab only", "Kerala", "Only Ladakh forced", "Only Goa beach party always"], 1],
      ["Pongal is a harvest festival of:", ["Only Assam tea", "Tamil Nadu region", "Only Kashmir snow", "Only desert alone"], 1],
      ["Qutub Minar is in:", ["Mumbai", "Delhi", "Chennai", "Kolkata"], 1],
      ["Children's Day in India is on:", ["14 November", "5 September", "15 August", "26 January"], 1],
      ["Saturn is known for its:", ["Rivers", "Rings", "Only deserts", "Only people cities"], 1],
      ["A week has _____ days.", ["5", "7", "10", "12"], 1],
      ["The national song of India is:", ["Only a film hit", "Vande Mataram", "Only a cricket chant", "Only a school bell"], 1],
      ["Football is played mainly with the:", ["Hands only always", "Feet", "Only head forever forced", "Only cricket bat"], 1],
      ["Saffron colour in the flag stands for courage/sacrifice idea. The white stands for:", ["Only soil", "Peace / truth idea", "Only water", "Only night"], 1],
      ["The Himalayas are in the _____ of India.", ["south", "north", "only ocean west", "only centre sea"], 1],
      ["A farmer's main work is:", ["Flying planes only", "Growing crops", "Only coding apps", "Only acting films"], 1],
      ["A firefighter puts out:", ["Only candles gently always", "Fires", "Only lamps of Diwali forced all", "Only stoves forever"], 1],
      ["The Moon is a:", ["Star", "Natural satellite of Earth", "Planet like Jupiter size", "Comet tail only"], 1],
      ["2 October is special for:", ["Only sports day forced", "Mahatma Gandhi's birthday", "Only Diwali always", "Only Holi always"], 1],
      ["India is a part of the continent of:", ["Africa", "Asia", "Europe only", "Australia only"], 1],
      ["We get light in the day mainly from the:", ["Moon only", "Sun", "Only lamps underground", "Only fireflies"], 1],
    ],
    [
      ["Chennai is in:", ["Gujarat", "Tamil Nadu", "Punjab", "Rajasthan"], 1],
      ["Statue ideas: a famous iron pillar/minar heritage includes:", ["Only plastic toys", "Qutub Minar (Delhi)", "Only a school gate forced", "Only a well"], 1],
      ["National river of India is often taught as the:", ["Amazon", "Ganga", "Nile", "Thames"], 1],
      ["Green in our flag reminds us of:", ["Only deserts", "Prosperity / faith idea / land", "Only snow", "Only night sky"], 1],
      ["Gurpurab is associated with:", ["Only Holi colours", "Sikh gurus / community faith days", "Only Christmas trees forced", "Only Onam boats only"], 1],
      ["Dussehra celebrates the victory of good over:", ["Only rain", "Evil", "Only exams", "Only sleep"], 1],
      ["Hawa Mahal is in:", ["Delhi", "Jaipur", "Mumbai", "Kolkata"], 1],
      ["Teacher's Day in India is on:", ["5 September", "14 November", "15 August", "26 January"], 1],
      ["Jupiter is the _____ planet.", ["smallest", "largest", "hottest surface always Venus confuse", "only ringed forced alone"], 1],
      ["There are _____ months in a year.", ["10", "12", "14", "24"], 1],
      ["Jana Gana Mana is our:", ["National animal", "National anthem", "National fruit", "National game only forced"], 1],
      ["Badminton uses a:", ["Football", "Shuttlecock", "Only cricket ball", "Only hockey stick"], 1],
      ["The chakra in the flag has _____ spokes (Ashoka Chakra).", ["12", "24", "48", "7"], 1],
      ["Kanyakumari is near the _____ tip of India.", ["northern", "southern", "only western desert alone", "only eastern island forced"], 1],
      ["Postman delivers:", ["Only pizza always", "Letters and parcels", "Only water tanks", "Only school bags forced"], 1],
      ["A nurse works mainly in a:", ["Only playground", "Hospital / clinic", "Only cinema", "Only airport tower forced alone"], 1],
      ["Stars shine with their own:", ["Water", "Light", "Only borrowed paper", "Only sound"], 1],
      ["26 January we remember:", ["Only Holi", "Republic Day", "Only Eid always", "Only sports week"], 1],
      ["The Indian Ocean is to the _____ of India.", ["north", "south", "only moon side", "only space"], 1],
      ["We should respect the national flag and:", ["Tear it for fun", "National anthem", "Only ignore both", "Use flag as towel"], 1],
    ],
    [
      ["Kolkata is in:", ["Rajasthan", "West Bengal", "Goa", "Punjab"], 1],
      ["Victoria Memorial is in:", ["Delhi", "Kolkata", "Chennai", "Jaipur"], 1],
      ["National heritage animal often taught: the:", ["Cat", "Elephant", "Mouse", "Rabbit"], 1],
      ["Our flag is also called the:", ["Only cloth piece random", "Tiranga", "Only scarf", "Only bedsheet"], 1],
      ["Baisakhi is popular in:", ["Only Kerala boats", "Punjab region", "Only Andaman alone", "Only desert nights forced"], 1],
      ["Raksha Bandhan is about the bond of:", ["Only enemies", "Brothers and sisters (care)", "Only teachers forced alone", "Only sports teams only"], 1],
      ["Golconda Fort is near:", ["Shimla", "Hyderabad", "Amritsar only", "Shillong only"], 1],
      ["Yoga Day is celebrated on:", ["21 June", "15 August", "26 January", "25 December"], 0],
      ["Venus is often called the _____ planet.", ["coldest always", "morning/evening star idea (bright)", "only ring king", "only red dust Mars confuse"], 1],
      ["February usually has _____ days (non-leap).", ["30", "28", "31", "29 always"], 1],
      ["The national emblem has lions from:", ["Only modern art random", "Sarnath Lion Capital of Ashoka", "Only a zoo photo", "Only a cartoon"], 1],
      ["Kabaddi is a traditional game popular in:", ["Only ice lands forced", "India (and nearby)", "Only Antarctica teams", "Only underwater cities"], 1],
      ["Saffron is at the _____ of the Indian flag (hoisted).", ["bottom", "top", "only middle circle forced alone", "only rope"], 1],
      ["Rajasthan is known for the:", ["Only snow peaks always", "Thar Desert region", "Only backwaters only Kerala", "Only tea gardens Assam alone"], 1],
      ["A pilot flies a:", ["Train only", "Aeroplane", "Only bicycle forced", "Only bullock cart"], 1],
      ["A chef's work is related to:", ["Only stitching", "Cooking food", "Only policing", "Only farming tractors alone"], 1],
      ["The galaxy we live in is the:", ["Andromeda only home forced", "Milky Way", "Only solar lamp", "Only local park"], 1],
      ["15 August we celebrate:", ["Republic Day", "Independence Day", "Only Children's Day", "Only Yoga Day"], 1],
      ["India's neighbour to the north includes:", ["Australia", "China / Nepal region neighbours", "Brazil", "Canada only"], 1],
      ["We must keep our monuments:", ["Dirty and scratched", "Clean and respected", "Only painted black always", "Closed forever from learning"], 1],
    ],
  ];
  return banks[paperNo - 1].map((row, i) =>
    Q(1 + i, row[0], row[1], row[2], "General Awareness", 1)
  );
}

function gkCA(paperNo) {
  // evergreen "current" style suitable for young kids 2023-2025
  const banks = [
    [
      Q(21, "International Yoga Day is observed on:", ["21 June", "15 August", "1 January", "25 December"], 0, "Current Affairs", 1),
      Q(22, "World Environment Day reminds us to care for:", ["Only toys", "Nature and Earth", "Only cars", "Only phones"], 1, "Current Affairs", 1),
      Q(23, "Chandrayaan missions are related to India's work on the:", ["Ocean only", "Moon", "Only cricket", "Only trains"], 1, "Current Affairs", 1),
      Q(24, "Aadhaar is a type of:", ["Game only", "Identity number/card idea for residents", "Only school bag brand", "Only festival"], 1, "Current Affairs", 1),
      Q(25, "COVID-19 taught us the importance of:", ["Never washing hands", "Hygiene and vaccines with adult guidance", "Only playing outside sick", "Sharing bottles while ill"], 1, "Current Affairs", 1),
    ],
    [
      Q(21, "Children's Day in India marks the birth anniversary related to:", ["Mahatma Gandhi only", "Jawaharlal Nehru", "Only a film star forced", "Only a cricketer alone"], 1, "Current Affairs", 1),
      Q(22, "Swachh Bharat encourages us to keep India:", ["Dirty", "Clean", "Only noisy", "Only dark"], 1, "Current Affairs", 1),
      Q(23, "ISRO is India's agency for:", ["Only cooking", "Space research", "Only fashion", "Only banking alone"], 1, "Current Affairs", 1),
      Q(24, "UPI is commonly used in India for:", ["Only flying", "Digital payments idea", "Only painting walls", "Only farming tractors alone"], 1, "Current Affairs", 1),
      Q(25, "Wearing a mask when advised helps to:", ["Spread germs more", "Reduce spread of some illnesses", "Stop rain", "Grow taller overnight"], 1, "Current Affairs", 1),
    ],
    [
      Q(21, "National Sports Day in India is linked with hockey legend:", ["Only a footballer forced", "Major Dhyan Chand", "Only a singer", "Only an actor"], 1, "Current Affairs", 1),
      Q(22, "Earth Hour asks people to switch off _____ for a short time.", ["Only taps forever", "Non-essential lights", "Only schools forever", "Only fans forever forced"], 1, "Current Affairs", 1),
      Q(23, "G20 meetings bring countries together to talk about:", ["Only one village game", "World cooperation ideas", "Only one school picnic", "Only one match score forever"], 1, "Current Affairs", 1),
      Q(24, "Har Ghar Tiranga encouraged people to:", ["Hide the flag", "Hoist/display the national flag with respect", "Use flag as mat", "Tear old flags for craft without care"], 1, "Current Affairs", 1),
      Q(25, "Handwashing with soap is important:", ["Only once a year", "Before meals and after washroom", "Only after sleeping well", "Never for children"], 1, "Current Affairs", 1),
    ],
    [
      Q(21, "Paralympics are sports events for:", ["Only robots", "Athletes with disabilities", "Only animals", "Only video game avatars"], 1, "Current Affairs", 1),
      Q(22, "World Water Day reminds us not to:", ["Save water", "Waste water", "Drink clean water", "Plant trees"], 1, "Current Affairs", 1),
      Q(23, "Digital India is about using _____ for services.", ["Only paper boats", "Technology / digital tools", "Only bullock carts forced", "Only oil lamps alone"], 1, "Current Affairs", 1),
      Q(24, "Fit India movement encourages children to:", ["Only sit all day", "Stay active and fit", "Only eat junk always", "Avoid sleep forever"], 1, "Current Affairs", 1),
      Q(25, "When air quality is very poor, adults may advise:", ["More outdoor dust play", "Limit outdoor exposure / care", "Burn more trash", "Open all factory smoke for fun"], 1, "Current Affairs", 1),
    ],
    [
      Q(21, "Olympic Games are a big _____ event.", ["cooking only", "sports", "only spelling bee forced", "only farming"], 1, "Current Affairs", 1),
      Q(22, "Van Mahotsav is related to planting:", ["Plastic", "Trees", "Only stones", "Only flags wrongly"], 1, "Current Affairs", 1),
      Q(23, "E-learning means learning using:", ["Only chalk forever forced", "Computers / digital means", "Only bullock carts", "Only stone tools"], 1, "Current Affairs", 1),
      Q(24, "Road safety campaigns tell us to wear a _____ on two-wheelers.", ["Crown", "Helmet", "Only scarf loose", "Only headphones loud"], 1, "Current Affairs", 1),
      Q(25, "Saying 'no' to single-use plastic helps the:", ["Only factories make more waste always", "Environment", "Only desert grow plastic trees", "Only oceans fill more bottles happily"], 1, "Current Affairs", 1),
    ],
  ];
  return banks[paperNo - 1];
}

function gkLife(paperNo) {
  const banks = [
    [
      Q(26, "If you receive a gift, you should say:", ["Only silence", "Thank you", "I wanted more", "Take it back"], 1, "Life Skills", 1),
      Q(27, "Before eating we should:", ["Never wash", "Wash hands", "Run on road", "Shout"], 1, "Life Skills", 1),
      Q(28, "When someone is speaking, we should:", ["Interrupt loudly", "Listen", "Cover ears rudely", "Walk away always"], 1, "Life Skills", 1),
      Q(29, "If you make a mistake, a good step is to:", ["Blame others only", "Say sorry and try to fix", "Hide forever", "Laugh at others"], 1, "Life Skills", 1),
      Q(30, "Sharing toys with friends shows:", ["Anger only", "Kindness", "Rudeness", "Fear only"], 1, "Life Skills", 1),
    ],
    [
      Q(26, "Crossing the road, we should use:", ["Anywhere mid traffic", "Zebra crossing / with adult", "Closed eyes running", "Between fast cars for fun"], 1, "Life Skills", 1),
      Q(27, "Throwing waste in a dustbin is:", ["Bad habit", "Good habit", "Only for adults", "Useless always"], 1, "Life Skills", 1),
      Q(28, "If a friend is sad, you can:", ["Tease more", "Comfort and help", "Ignore always", "Take their lunch forcibly"], 1, "Life Skills", 1),
      Q(29, "Telling the truth is being:", ["Dishonest", "Honest", "Rude always", "Lazy"], 1, "Life Skills", 1),
      Q(30, "We should respect:", ["Only ourselves never others", "Elders, teachers and friends", "Only toys", "Only screens"], 1, "Life Skills", 1),
    ],
    [
      Q(26, "Saving water means:", ["Tap open always", "Closing tap when not needed", "Playing with hose all day wastefully", "Washing car hourly forever"], 1, "Life Skills", 1),
      Q(27, "If you do not know the way, you should ask:", ["Any stranger alone far", "A trusted adult / known helper", "No one and cry only", "Only a lost dog"], 1, "Life Skills", 1),
      Q(28, "Waiting for your turn in a line shows:", ["Impatience only", "Discipline / manners", "Anger only", "Fear of books"], 1, "Life Skills", 1),
      Q(29, "Helping at home with small tasks is:", ["Only waste of time", "Responsibility", "Only punishment", "Only for robots"], 1, "Life Skills", 1),
      Q(30, "Using polite words like 'please' is:", ["Rude", "Good manners", "Only for kings", "Useless"], 1, "Life Skills", 1),
    ],
    [
      Q(26, "If you feel sick at school, you should:", ["Hide and suffer only", "Tell the teacher", "Run home alone on highway", "Eat more junk"], 1, "Life Skills", 1),
      Q(27, "Keeping your books neat helps you:", ["Lose pages happily", "Find things and learn better", "Only look busy", "Avoid reading forever"], 1, "Life Skills", 1),
      Q(28, "When playing, we should:", ["Always cheat to win", "Follow fair rules", "Hurt others to score", "Break toys angrily if lose"], 1, "Life Skills", 1),
      Q(29, "Brushing teeth is part of:", ["Only fashion", "Personal hygiene", "Only festivals", "Only sports"], 1, "Life Skills", 1),
      Q(30, "Saying 'excuse me' is useful when you:", ["Want to be rude", "Need to pass or interrupt politely", "Want to shout names", "Ignore everyone"], 1, "Life Skills", 1),
    ],
    [
      Q(26, "If you find a wallet, you should:", ["Keep it secretly", "Give it to a trusted adult / authority", "Throw money away", "Hide and not tell"], 1, "Life Skills", 1),
      Q(27, "Eating fruits and vegetables helps you:", ["Only sleep less forever", "Stay healthy", "Only grow weaker", "Avoid water forever"], 1, "Life Skills", 1),
      Q(28, "During a fire drill you should:", ["Panic and hide under smoke only", "Follow teacher instructions calmly", "Run back for toys in fire", "Open all windows to feed fire"], 1, "Life Skills", 1),
      Q(29, "Being on time to school shows:", ["Carelessness", "Punctuality / responsibility", "Only fear", "Only laziness"], 1, "Life Skills", 1),
      Q(30, "Caring for plants and animals shows we are:", ["Cruel", "Responsible and kind", "Only bored", "Only angry"], 1, "Life Skills", 1),
    ],
  ];
  return banks[paperNo - 1];
}

function gkAch(paperNo) {
  const banks = [
    [
      Q(31, "Why is the peacock our national bird?", ["It cannot fly at all ever", "It is beautiful and found in India; a national symbol", "It lives only on Moon", "It is the only bird on Earth"], 1, "Achievers Section", 2),
      Q(32, "Independence Day and Republic Day are both important because they:", ["Are only school holidays without meaning", "Mark freedom and the Constitution coming into force ideas", "Are only about sweets", "Are only sports days"], 1, "Achievers Section", 2),
      Q(33, "If two friends want the same toy, a good solution is to:", ["Fight and snatch", "Share or take turns", "Break the toy", "Never play again forever"], 1, "Achievers Section", 2),
      Q(34, "The Sun is important to life on Earth mainly because it gives:", ["Only darkness", "Heat and light for living things", "Only plastic", "Only noise"], 1, "Achievers Section", 2),
      Q(35, "A doctor and a teacher both:", ["Only play cricket professionally", "Help people in different ways (health / learning)", "Only drive buses", "Only grow wheat forced"], 1, "Achievers Section", 2),
    ],
    [
      Q(31, "The national flag should not be used as:", ["A respected display on occasions", "A tablecloth or costume disrespectfully", "A part of solemn ceremony with care", "A school assembly symbol properly"], 1, "Achievers Section", 2),
      Q(32, "Why do we need traffic lights?", ["For decoration only", "To manage traffic and keep people safe", "To make cars faster always", "To stop walking forever"], 1, "Achievers Section", 2),
      Q(33, "Saving electricity at home can include:", ["Lights on in empty rooms", "Switching off unused lights/fans", "AC open with doors wide always wastefully", "TV on all night with nobody"], 1, "Achievers Section", 2),
      Q(34, "Mumbai and Chennai are both:", ["Villages only", "Important coastal cities of India", "Only deserts", "Only foreign capitals"], 1, "Achievers Section", 2),
      Q(35, "Festivals are special times to:", ["Only fight", "Celebrate together with respect for all", "Only waste food proudly", "Ignore family"], 1, "Achievers Section", 2),
    ],
    [
      Q(31, "Earth Day / Environment care matters because:", ["Earth has unlimited clean everything forever without care", "We must protect nature for our future", "Trees dislike soil", "Oceans want more plastic"], 1, "Achievers Section", 2),
      Q(32, "The Ashoka Chakra’s many spokes can remind us of:", ["Only one idea forever frozen", "Motion / progress / dharma wheel heritage", "Only a bicycle wheel toy", "Only a pizza"], 1, "Achievers Section", 2),
      Q(33, "If you see a younger child fall, you should:", ["Laugh and film only", "Help and call an adult", "Ignore and run away", "Push again"], 1, "Achievers Section", 2),
      Q(34, "Cricket is popular in India, but fitness also needs:", ["Only watching TV sports", "Playing and exercise, not only watching", "Only junk food after matches", "No water while playing ever"], 1, "Achievers Section", 2),
      Q(35, "Maps help us to:", ["Cook rice", "Find places and directions", "Only draw cartoons forced", "Only measure fever"], 1, "Achievers Section", 2),
    ],
    [
      Q(31, "Why are monuments protected?", ["So nobody can learn history", "They are our heritage and teach history", "Only for birds to nest without care vandalism", "They are useless stones"], 1, "Achievers Section", 2),
      Q(32, "A balanced day for a child includes study, play, and:", ["No sleep", "Rest / sleep", "Only screens 10 hours", "Only junk snacks"], 1, "Achievers Section", 2),
      Q(33, "People who help us like cleaners and drivers deserve:", ["Rude words", "Respect and thanks", "Only orders shouted", "Ignore always"], 1, "Achievers Section", 2),
      Q(34, "India has many languages. We should:", ["Mock others' languages", "Respect diversity", "Force only one friend group language rudely always", "Avoid learning any"], 1, "Achievers Section", 2),
      Q(35, "The Moon has no air like Earth, so humans need:", ["Only slippers", "Special suits / support to visit", "Only an umbrella", "Only a bicycle"], 1, "Achievers Section", 2),
    ],
    [
      Q(31, "Yoga helps mainly with:", ["Only anger increase", "Body flexibility, calm and health", "Only winning arguments", "Only eating faster"], 1, "Achievers Section", 2),
      Q(32, "If there is a thunderstorm, a safe idea is:", ["Stand under tall lonely tree outside", "Stay indoors away from open fields as advised", "Swim in open lake with rod", "Fly kite with metal key"], 1, "Achievers Section", 2),
      Q(33, "National symbols help us feel:", ["Only divided always", "Unity and pride in our country", "Only angry at neighbours", "Only bored in assembly"], 1, "Achievers Section", 2),
      Q(34, "Reading storybooks can improve:", ["Only eyesight magically without light", "Language and imagination", "Only hunger", "Only running speed overnight"], 1, "Achievers Section", 2),
      Q(35, "When using public parks we should:", ["Leave litter", "Keep them clean for everyone", "Break swings", "Pluck all flowers roughly"], 1, "Achievers Section", 2),
    ],
  ];
  return banks[paperNo - 1];
}

function buildGK(paperNo) {
  const raw = [...gkGA(paperNo), ...gkCA(paperNo), ...gkLife(paperNo), ...gkAch(paperNo)];
  const paper = pack(diversify(raw, paperNo));
  validate(paper, 35, 40);
  return paper;
}

/* ===================== MAIN ===================== */
function main() {
  const subjects = [
    { folder: "mathematics", subject: "Mathematics", build: buildMath, q: 35, m: 40 },
    { folder: "science", subject: "Science", build: buildScience, q: 35, m: 40 },
    { folder: "english", subject: "English", build: buildEnglish, q: 40, m: 40 },
    { folder: "computer", subject: "Computer", build: buildComputer, q: 35, m: 40 },
    { folder: "gk", subject: "General Knowledge", build: buildGK, q: 35, m: 40 },
  ];

  let totalFiles = 0;
  for (const s of subjects) {
    for (let p = 1; p <= 5; p++) {
      const paper = s.build(p);
      writePaper(s.folder, p, { subject: s.subject, totalMarks: s.m }, paper.questions, paper.answers);
      totalFiles += 2;
      const secs = {};
      paper.questions.forEach((q) => {
        secs[q.section] = (secs[q.section] || 0) + 1;
      });
      console.log(
        `OK Class ${CLASS} ${s.subject} Paper ${p}: ${paper.questions.length}Q / ${s.m} marks`,
        JSON.stringify(secs)
      );
    }
  }
  console.log(`Wrote ${totalFiles} files under ${ROOT}`);
}

main();

#!/usr/bin/env node
/**
 * Generate ORIGINAL Class 5 Olympiad practice papers aligned to SOF
 * 2023–2025 exam PATTERN and SYLLABUS (not copyrighted SOF questions).
 *
 * Mathematics (IMO): LR 15×1 + MR 20×1 + Achievers 5×3 = 40Q, 50 marks
 * Science (NSO):     LR 10×1 + Science 35×1 + Achievers 5×3 = 50Q, 60 marks
 * English (IEO):     WSK 45×1 + Reading 10×1 + SWE 5×1 = 60Q, 60 marks
 * Computer (ICSO):   LR 10×1 + Computers 35×1 + Achievers 5×3 = 50Q, 60 marks
 * GK (IGKO):         GA 30×1 + CA 10×1 + Life Skills 5×1 + Achievers 5×3 = 50Q, 60 marks
 */
"use strict";
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
    durationMinutes: 30,
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

  const a = 5 + p * 2;
  const b = 3 + p;

  // LR 15
  {
    const t0 = a;
    const series = [t0, t0 * 2, t0 * 4, t0 * 8];
    let o = numOpts(t0 * 16, id, [-t0 * 2, t0 * 4, -t0, t0 * 2]);
    items.push(Q(id++, `Find the next term: ${series.join(", ")}, __.`, o.options, o.ans, L));

    const s0 = b + 2;
    const s = [s0, s0 + 3, s0 + 8, s0 + 15];
    o = numOpts(s0 + 24, id, [2, -2, 4, -4]);
    items.push(Q(id++, `Find the next number: ${s.join(", ")}, __.`, o.options, o.ans, L));

    o = numOpts(36, id, [1, -1, 13, 4]);
    items.push(Q(id++, "Complete the series: 4, 9, 16, 25, __.", o.options, o.ans, L));

    items.push(Q(id++, "Which number does not belong: 2, 3, 5, 7, 9, 11?", ["9", "2", "5", "11"], 0, L));
    items.push(Q(id++, "Odd one out: Square, Cube, Rectangle, Triangle.", ["Cube", "Square", "Rectangle", "Triangle"], 0, L));
    items.push(Q(id++, "If CAT → DBU (each letter +1), then SUN → ?", ["TVO", "RTO", "TVM", "TVP"], 0, L));
    items.push(Q(id++, "If APPLE is written as ELPPA, how is MANGO written?", ["OGNAM", "AMGNO", "ONGAM", "MAGNO"], 0, L));
    items.push(Q(id++, "Pen : Write :: Knife : ?", ["Cut", "Eat", "Draw", "Run"], 0, L));
    items.push(Q(id++, "Bird : Nest :: Bee : ?", ["Hive", "Den", "Stable", "Burrow"], 0, L));

    const total = 12 + p;
    const left = 3 + p;
    const right = total - left + 1;
    o = mcq(right + "th", [right - 1 + "th", right + 1 + "th", left + "th"], id);
    items.push(Q(id++, `In a row of ${total} students, Maya is ${left}th from the left. Her position from the right is:`, o.options, o.ans, L));

    items.push(Q(id++, "If 5th of a month is Wednesday, what day is 12th of the same month?", ["Wednesday", "Thursday", "Tuesday", "Friday"], 0, L));
    items.push(Q(id++, "Amit faces North, turns 90° right, then 180° left. He now faces:", ["West", "East", "South", "North"], 0, L));
    items.push(Q(id++, "Find the next letters: A C F J O __", ["U", "T", "S", "V"], 0, L));
    items.push(Q(id++, "All roses are flowers. Some flowers fade quickly. Which is definitely true?",
      ["Some roses may fade quickly", "No rose fades", "All flowers are roses", "Roses are not flowers"], 0, L));

    const sides = 3 + p; // 4..8
    o = numOpts(sides, id, [1, -1, 2, 3]);
    items.push(Q(id++, `A regular polygon has ${sides} sides. How many sides does it have?`, o.options, o.ans, L));
  }

  // MR 20
  {
    const num = 30000 + p * 1000 + 400 + 50 + p;
    const pvDigit = Math.floor(num / 1000) % 10;
    let o = numOpts(pvDigit * 1000, id, [100, 10, 1, 10000]);
    items.push(Q(id++, `In ${num}, the place value of the thousands digit is:`, o.options, o.ans, M));

    const x = 245 + p * 11, y = 378 + p * 7;
    o = numOpts(x + y, id, [10, -10, 20, -1]);
    items.push(Q(id++, `What is ${x} + ${y}?`, o.options, o.ans, M));

    const x2 = 900 + p * 15, y2 = 456 + p * 3;
    o = numOpts(x2 - y2, id, [5, -5, 15, -15]);
    items.push(Q(id++, `What is ${x2} − ${y2}?`, o.options, o.ans, M));

    const m1 = 24 + p, m2 = 15 + p;
    o = numOpts(m1 * m2, id, [m1, -m2, 10, -10]);
    items.push(Q(id++, `${m1} × ${m2} = ?`, o.options, o.ans, M));

    const d2 = 6 + p;
    const d1 = d2 * (12 + p);
    o = numOpts(d1 / d2, id, [1, -1, 2, 3]);
    items.push(Q(id++, `${d1} ÷ ${d2} = ?`, o.options, o.ans, M));

    const f = 12 * p;
    items.push(Q(id++, `Which of the following is a factor of ${f}?`, ["6", "7", "11", "13"], 0, M));

    const mult = 9 + p;
    o = numOpts(mult * 5, id, [mult, -mult, 2, 3]);
    items.push(Q(id++, `The 5th multiple of ${mult} is:`, o.options, o.ans, M));

    const la = 4 + p, lb = 6;
    const lcm = (la * lb) / gcd(la, lb);
    o = numOpts(lcm, id, [la, lb, -2, 2]);
    items.push(Q(id++, `LCM of ${la} and ${lb} is:`, o.options, o.ans, M));

    const ha = 12 * p, hb = 18 * p;
    o = numOpts(gcd(ha, hb), id, [2, -2, 6, 3]);
    items.push(Q(id++, `HCF of ${ha} and ${hb} is:`, o.options, o.ans, M));

    const fracs = [
      ["1/2", "1/4", "3/4", ["1", "1/4", "2/6"]],
      ["1/3", "1/6", "1/2", ["1/3", "2/9", "1/9"]],
      ["2/5", "1/5", "3/5", ["1/5", "2/5", "4/5"]],
      ["3/8", "1/8", "1/2", ["3/8", "1/4", "2/8"]],
      ["1/4", "1/2", "3/4", ["1/4", "1/8", "2/4"]],
    ][p - 1];
    items.push(Q(id++, `${fracs[0]} + ${fracs[1]} = ?`, [fracs[2], fracs[3][0], fracs[3][1], fracs[3][2]], 0, M));

    const dA = (p + 2) / 10, dB = (p + 5) / 10;
    const dSum = Math.round((dA + dB) * 10) / 10;
    o = mcq(String(dSum), [String(dA), String(dB + 1), String(Math.round(dA * 10 + dB) / 100)], id);
    items.push(Q(id++, `${dA} + ${dB} = ?`, o.options, o.ans, M));

    const pct = 10 * p;
    const ofn = 200;
    o = numOpts((pct / 100) * ofn, id, [10, -10, 20, 5]);
    items.push(Q(id++, `${pct}% of ${ofn} is:`, o.options, o.ans, M));

    const Lr = 10 + p * 2, Wr = 6 + p;
    o = numOpts(2 * (Lr + Wr), id, [Lr + Wr, Lr * Wr, -2, 4]);
    items.push(Q(id++, `Perimeter of a rectangle ${Lr} cm by ${Wr} cm is:`, o.options, o.ans, M));

    const side = 8 + p;
    o = numOpts(side * side, id, [side * 4, side, -side, 2 * side]);
    items.push(Q(id++, `Area of a square of side ${side} cm is:`, o.options, o.ans, M));

    const bh = 12 + p, ht = 10;
    o = numOpts((bh * ht) / 2, id, [bh * ht, bh + ht, -5, 5]);
    items.push(Q(id++, `Area of a triangle with base ${bh} cm and height ${ht} cm is:`, o.options, o.ans, M));

    const mins = 90 + p * 15;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    items.push(Q(id++, `${mins} minutes = ?`, [`${hrs} h ${rem} min`, `${mins} h`, `${hrs} h`, `${rem} h ${hrs} min`], 0, M));

    const rs = 25 + p * 5;
    o = numOpts(rs * 100, id, [rs, -100, 50, 10]);
    items.push(Q(id++, `₹${rs} = how many paise?`, o.options, o.ans, M));

    const scores = [10 + p, 12 + p, 14 + p, 16 + p];
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    o = numOpts(avg, id, [1, -1, 2, scores[0]]);
    items.push(Q(id++, `Average of ${scores.join(", ")} is:`, o.options, o.ans, M));

    const cost3 = 45 + p * 6;
    const cost5 = (cost3 / 3) * 5;
    o = numOpts(cost5, id, [cost3 / 3, cost3, -3, 5]);
    items.push(Q(id++, `If 3 pens cost ₹${cost3}, cost of 5 such pens is:`, o.options, o.ans, M));

    const romans = [
      [14, "XIV"],
      [19, "XIX"],
      [27, "XXVII"],
      [44, "XLIV"],
      [39, "XXXIX"],
    ][p - 1];
    items.push(Q(id++, `Roman numeral for ${romans[0]} is:`, [romans[1], "XVI", "XII", "XXI"], 0, M));
  }

  // Achievers 5 × 3
  {
    const a1 = 48 + p * 4;
    let o = numOpts(a1 / 4 + 15, id, [5, -5, 10, a1 / 4]);
    items.push(Q(id++, `A number is divided by 4 and then 15 is added. If the original number is ${a1}, the result is:`, o.options, o.ans, A, 3));

    const whole = 120 + p * 20;
    const fr = [2, 3, 3, 4, 4][p - 1];
    const den = [5, 5, 4, 5, 8][p - 1];
    o = numOpts((whole * fr) / den, id, [whole / den, fr, -10, 10]);
    items.push(Q(id++, `What is ${fr}/${den} of ${whole}?`, o.options, o.ans, A, 3));

    const s = 10 + p;
    o = numOpts(s * s - 4 * s, id, [s * s, 4 * s, s * s + 4 * s, -s]);
    items.push(Q(id++, `A square has side ${s} cm. By how much does its area (cm²) exceed its perimeter (cm) numerically?`, o.options, o.ans, A, 3));

    const dist = 120 * p;
    const speed = 40 + p * 5;
    o = numOpts(dist / speed, id, [1, -1, 2, speed]);
    items.push(Q(id++, `A car covers ${dist} km at ${speed} km/h. Time taken is how many hours?`, o.options, o.ans, A, 3));

    const cp = 200 + p * 50;
    const sp = cp + 40 + p * 10;
    o = numOpts(sp - cp, id, [sp, cp, -10, 10]);
    items.push(Q(id++, `An article bought for ₹${cp} is sold for ₹${sp}. Profit is:`, o.options, o.ans, A, 3));
  }

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

  const lr = [
    ["Find the odd one: Eye, Ear, Nose, Book.", ["Book", "Eye", "Ear", "Nose"], 0],
    ["Leaf : Plant :: Feather : ?", ["Bird", "Fish", "Rock", "Tree"], 0],
    ["Complete: 2, 4, 8, 16, __.", ["32", "24", "20", "18"], 0],
    ["Which is solid at 0°C under normal conditions?", ["Ice", "Steam", "Oxygen gas", "Nitrogen gas"], 0],
    ["Which does not belong: Mercury, Venus, Mars, Moon?", ["Moon", "Mercury", "Venus", "Mars"], 0],
    ["Doctor : Hospital :: Teacher : ?", ["School", "Clinic", "Garage", "Airport"], 0],
    ["Seed → Seedling → Plant → ?", ["Adult plant / tree", "Soil only", "Root only", "Sun only"], 0],
    ["A is father of B. B is sister of C. How is A related to C?", ["Father", "Mother", "Brother", "Uncle"], 0],
    ["Arrange: Adult frog, Egg, Tadpole (life cycle).", ["Egg → Tadpole → Adult frog", "Adult → Egg → Tadpole", "Tadpole → Egg → Adult", "Egg → Adult → Tadpole"], 0],
    ["If all pencils are tools and some tools are red, which may be true?", ["Some pencils may be red", "No pencil is a tool", "All tools are pencils", "Pencils cannot be red ever"], 0],
  ];
  for (let i = 0; i < 10; i++) {
    const row = lr[(i + p) % lr.length];
    items.push(Q(id++, row[0], row[1], row[2], L));
  }

  const sci = [
    ["The process by which green plants make food is called:", ["Photosynthesis", "Respiration", "Transpiration", "Germination"], 0],
    ["Chlorophyll is mainly present in:", ["Leaves", "Roots", "Flowers", "Seeds"], 0],
    ["Which gas do plants release during photosynthesis?", ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], 0],
    ["The tiny pores on leaves are called:", ["Stomata", "Nodes", "Tendrils", "Veins only"], 0],
    ["The organ that pumps blood is the:", ["Heart", "Lungs", "Liver", "Kidney"], 0],
    ["We breathe in oxygen with the help of:", ["Lungs", "Stomach", "Brain", "Skin only"], 0],
    ["Bones are joined to muscles by:", ["Tendons", "Ligaments", "Cartilage only", "Nerves"], 0],
    ["The largest organ of the human body is the:", ["Skin", "Liver", "Heart", "Brain"], 0],
    ["Which vitamin is mainly obtained from sunlight on skin?", ["Vitamin D", "Vitamin C", "Vitamin A", "Vitamin K"], 0],
    ["Water boiling turns into:", ["Steam (water vapour)", "Ice", "Salt", "Oil"], 0],
    ["Ice melting is a change from:", ["Solid to liquid", "Liquid to gas", "Gas to solid", "Solid to gas"], 0],
    ["Which is a solid at room temperature?", ["Iron", "Water", "Oxygen", "Petrol"], 0],
    ["Anything that occupies space and has mass is called:", ["Matter", "Energy", "Force", "Light"], 0],
    ["The Earth revolves around the:", ["Sun", "Moon", "Mars", "Polaris"], 0],
    ["A lunar eclipse occurs when:", ["Earth is between Sun and Moon", "Moon is between Sun and Earth", "Sun is between Earth and Moon", "None of these"], 0],
    ["Which soil holds water best among these?", ["Clayey soil", "Sandy soil", "Gravel", "Pebbles"], 0],
    ["Proteins help mainly in:", ["Body building and repair", "Only giving colour", "Making bones of metal", "Stopping all growth"], 0],
    ["Scurvy is caused by deficiency of:", ["Vitamin C", "Vitamin D", "Iron", "Iodine"], 0],
    ["Which is a roughage-rich food?", ["Salad vegetables", "Butter only", "Sugar", "Ghee"], 0],
    ["A push or pull on an object is called a:", ["Force", "Mass", "Volume", "Density"], 0],
    ["The energy we get from the Sun is called:", ["Solar energy", "Sound energy only", "Magnetic energy", "Chemical ink energy"], 0],
    ["A freely suspended magnet rests roughly in the:", ["North–South direction", "East–West only", "Up–down only", "Random city direction"], 0],
    ["Cutting of forests on a large scale is called:", ["Deforestation", "Afforestation", "Irrigation", "Transplantation"], 0],
    ["Which is a renewable source of energy?", ["Wind", "Coal", "Petrol", "Diesel"], 0],
    ["Air pollution can be reduced by:", ["Planting more trees", "Burning more plastic", "Using more coal only", "Cutting all forests"], 0],
    ["ORS is used mainly for:", ["Dehydration", "Broken bones", "Tooth cavities only", "Poor eyesight"], 0],
    ["We should not touch electrical switches with:", ["Wet hands", "Dry cloth", "Rubber gloves", "Wooden stick"], 0],
    ["Diseases that spread from person to person are called:", ["Communicable diseases", "Deficiency diseases only", "Genetic only", "Lifestyle only"], 0],
    ["Mosquitoes can spread:", ["Malaria", "Scurvy", "Rickets", "Goitre"], 0],
    ["The hardest natural substance among these is:", ["Diamond", "Chalk", "Talcum", "Clay"], 0],
    ["The continuous movement of water on Earth is the:", ["Water cycle", "Rock cycle only", "Food chain", "Carbon only"], 0],
    ["Clouds are formed by:", ["Condensation of water vapour", "Melting of rocks", "Freezing of lava", "Burning of fuels only"], 0],
    ["The sense organ for smell is the:", ["Nose", "Ear", "Tongue", "Eye"], 0],
    ["Camels store fat in their:", ["Humps", "Hooves", "Ears", "Tails only"], 0],
    ["Fish breathe with the help of:", ["Gills", "Lungs only", "Feathers", "Spiracles only"], 0],
    ["The joint in the elbow that allows movement like a door is a:", ["Hinge joint", "Ball and socket", "Pivot only", "Fixed joint"], 0],
    ["Which planet is known as the Red Planet?", ["Mars", "Venus", "Jupiter", "Saturn"], 0],
    ["The boiling point of pure water at sea level is about:", ["100°C", "0°C", "50°C", "37°C"], 0],
  ];
  for (let i = 0; i < 35; i++) {
    const row = sci[(i + (p - 1) * 4) % sci.length];
    let qtext = row[0];
    if (p > 1 && i % 8 === 0) qtext = qtext.replace(/\?$/, " among the following?");
    items.push(Q(id++, qtext, row[1].slice(), row[2], S));
  }

  const ach = [
    ["A plant kept in the dark for long becomes pale mainly due to lack of:", ["Light for chlorophyll/photosynthesis", "Soil pots", "Wind only", "Sand only"], 0],
    ["During melting of ice, heat is used mainly to:", ["Change state (latent heat)", "Increase mass", "Create new elements", "Remove gravity"], 0],
    ["If Earth stopped revolving around the Sun, which would be most affected?", ["The cycle of seasons", "Ocean salt becoming zero", "Mountains vanishing", "Air disappearing"], 0],
    ["A food chain always begins with a:", ["Producer (green plant)", "Carnivore", "Only decomposer", "Only herbivore"], 0],
    ["Anaemia is commonly linked to deficiency of:", ["Iron", "Iodine", "Vitamin D", "Calcium only"], 0],
    ["We see lightning before thunder because:", ["Light travels faster than sound", "Sound is always louder", "Eyes always work first", "Clouds block only sound"], 0],
    ["Which mixture can be separated by filtration?", ["Sand and water", "Salt fully dissolved in water", "Sugar fully dissolved", "Alcohol in water"], 0],
    ["Blood appears red mainly because of:", ["Haemoglobin", "Platelets only", "Plasma sugar", "White cells only"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = ach[(i + p) % ach.length];
    items.push(Q(id++, row[0], row[1].slice(), row[2], A, 3));
  }
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

  // Large WSK bank — rotate by paper
  const wsk = [
    ["Choose the correct article: She bought ___ umbrella.", ["an", "a", "the", "no article"], 0],
    ["Plural of 'child' is:", ["children", "childs", "childes", "childrens"], 0],
    ["Opposite of 'brave' is:", ["cowardly", "strong", "kind", "proud"], 0],
    ["Choose the correct spelling:", ["Beautiful", "Beatiful", "Beautifull", "Buetiful"], 0],
    ["She ___ to school every day.", ["goes", "go", "going", "gone"], 0],
    ["Identify the noun: The cat slept on the mat.", ["cat", "slept", "on", "the"], 0],
    ["Identify the verb: Birds fly in the sky.", ["fly", "Birds", "in", "sky"], 0],
    ["Choose the adjective: It was a cold morning.", ["cold", "was", "It", "morning"], 0],
    ["Past tense of 'write' is:", ["wrote", "written", "writes", "writing"], 0],
    ["Past participle of 'eat' is:", ["eaten", "ate", "eats", "eating"], 0],
    ["Synonym of 'happy' is:", ["joyful", "angry", "tired", "weak"], 0],
    ["Antonym of 'ancient' is:", ["modern", "old", "historic", "aged"], 0],
    ["Choose the correct preposition: The book is ___ the table.", ["on", "in", "at", "over by"], 0],
    ["Choose the correct preposition: He has been ill ___ Monday.", ["since", "for", "from", "on"], 0],
    ["Fill in: Neither Ravi ___ Sita was present.", ["nor", "or", "and", "but"], 0],
    ["Choose the correct pronoun: ___ is my best friend.", ["He", "Him", "His", "Himself"], 0],
    ["Which is an interrogative sentence?", ["Where do you live?", "I live here.", "Close the door.", "What a day!"], 0],
    ["Which is an exclamatory sentence?", ["What a beautiful painting!", "Close the window.", "Where is Ram?", "Ram is here."], 0],
    ["Choose the correct conjunction: I stayed home ___ it was raining.", ["because", "but so", "or", "nor"], 0],
    ["The comparative degree of 'good' is:", ["better", "best", "gooder", "more good"], 0],
    ["The superlative degree of 'tall' is:", ["tallest", "taller", "more tall", "most tallest"], 0],
    ["Choose correctly punctuated sentence:", ["What is your name?", "What is your name", "what is your name?", "What is your Name"], 0],
    ["Identify the adverb: She ran quickly.", ["quickly", "She", "ran", "None"], 0],
    ["Choose the correct form: The news ___ true.", ["is", "are", "were", "be"], 0],
    ["Collective noun for a group of lions:", ["pride", "flock", "herd of cats", "swarm"], 0],
    ["Gender of 'nephew' (feminine):", ["niece", "aunt", "sister", "mother"], 0],
    ["Choose the correct order (adjectives): a ___ ball", ["small red", "red small", "red a small", "small a red"], 0],
    ["Fill: There aren't ___ apples left.", ["many", "much", "a little", "much of"], 0],
    ["Fill: Please give me ___ water.", ["some", "many", "few", "several"], 0],
    ["Choose the correct question tag: You are coming, ___?", ["aren't you", "are you", "isn't you", "don't you"], 0],
    ["Indirect speech: He said, \"I am busy.\" → He said that he ___ busy.", ["was", "is", "were", "am"], 0],
    ["Active to passive: She writes a letter. → A letter ___ by her.", ["is written", "wrote", "is writing", "written"], 0],
    ["Choose the correct word: A person who writes books is an ___ .", ["author", "actor", "artist only", "anchor"], 0],
    ["Homophone of 'pair' is:", ["pear", "peer only", "pore", "par"], 0],
    ["Choose the correct phrasal meaning: 'look after' means:", ["take care of", "search only", "see above", "ignore"], 0],
    ["Which word is a conjunction?", ["and", "quickly", "blue", "table"], 0],
    ["Choose correct tense: They ___ football now.", ["are playing", "play", "played", "plays"], 0],
    ["Choose correct: One of the boys ___ absent.", ["is", "are", "were", "be"], 0],
    ["Prefix that means 'not' among these: ___happy", ["un", "re", "pre", "mis-as"], 0],
    ["Suffix in 'careful' is:", ["-ful", "care", "-ly", "-ness"], 0],
    ["Choose the correctly spelled word:", ["Necessary", "Necesary", "Neccessary", "Neceserry"], 0],
    ["Idiom: 'A piece of cake' means:", ["Something very easy", "A dessert only", "A hard task", "A bakery"], 0],
    ["Choose the abstract noun:", ["honesty", "table", "dog", "city"], 0],
    ["Which is a proper noun?", ["India", "country", "city", "river"], 0],
    ["Fill: She is ___ honest girl.", ["an", "a", "the", "no article"], 0],
    ["Choose correct: The sun rises in the ___ .", ["east", "west", "north", "south"], 0],
    ["Antonym of 'generous' is:", ["selfish", "kind", "noble", "polite"], 0],
    ["Synonym of 'begin' is:", ["start", "end", "finish", "stop"], 0],
    ["Choose: I prefer tea ___ coffee.", ["to", "than", "from", "for"], 0],
    ["Modal verb for ability:", ["can", "must only", "should only", "may only"], 0],
    ["Choose correct article usage: ___ Himalayas are high.", ["The", "A", "An", "No article"], 0],
    ["Which sentence is in future tense?", ["I will call you tomorrow.", "I called you.", "I am calling.", "I call daily."], 0],
    ["Choose the correct preposition: Divide the sweets ___ the two children.", ["between", "among", "in", "into of"], 0],
    ["Fill: He is good ___ mathematics.", ["at", "in on", "over", "from"], 0],
    ["Choose the correct spelling:", ["Accommodation", "Acommodation", "Accomodation", "Acomodation"], 0],
  ];

  for (let i = 0; i < 45; i++) {
    const row = wsk[(i + (p - 1) * 5) % wsk.length];
    let q = row[0];
    if (p > 1 && i % 9 === 0) q = q + " (choose the best option)";
    items.push(Q(id++, q, row[1].slice(), row[2], W));
  }

  // Reading passages — 2 passages × 5 Q
  const passages = [
    {
      text:
        "Rina lived in a small village near a river. Every morning she helped her mother fill water pots and water the kitchen garden. One summer the river became very low. Rina and her friends planted more trees along the bank. Slowly the soil held more water, and birds returned to nest in the new shade.",
      qs: [
        ["Where did Rina live?", ["In a village near a river", "In a desert city", "On a mountain peak", "In a ship"], 0],
        ["What did Rina help with every morning?", ["Filling water pots and watering the garden", "Flying kites only", "Driving a bus", "Building ships"], 0],
        ["What problem came in summer?", ["The river became very low", "Too much snow", "Flood every hour", "No sunlight"], 0],
        ["What did the children do to help?", ["Planted more trees along the bank", "Dammed the ocean", "Burned dry grass", "Removed all birds"], 0],
        ["What returned after trees grew?", ["Birds", "Trains", "Deserts", "Factories"], 0],
      ],
    },
    {
      text:
        "Libraries are quiet places full of books, magazines and sometimes computers. Students visit to read stories, find facts for projects and practise good study habits. A librarian helps readers find the right shelf and teaches them to care for books. Returning books on time helps everyone share the collection fairly.",
      qs: [
        ["Libraries are usually:", ["Quiet places with books", "Noisy markets", "Only playgrounds", "Only kitchens"], 0],
        ["Students visit libraries to:", ["Read and find facts for projects", "Cook meals", "Repair cars", "Grow rice only"], 0],
        ["Who helps readers find books?", ["A librarian", "A pilot", "A chef", "A plumber"], 0],
        ["Why return books on time?", ["So everyone can share fairly", "To hide books", "To break shelves", "To stop reading"], 0],
        ["Besides books, libraries may have:", ["Magazines and computers", "Only stones", "Only shoes", "Only tickets"], 0],
      ],
    },
    {
      text:
        "Arjun joined the school science club. The club met on Fridays to try simple experiments safely. One week they made a small water filter using sand, pebbles and cloth. Arjun learned that clean water is precious and must not be wasted. He began turning off taps tightly at home.",
      qs: [
        ["Which club did Arjun join?", ["Science club", "Dance only club", "Cooking club only", "Chess of kings only"], 0],
        ["When did the club meet?", ["On Fridays", "Only at midnight", "Never", "Only during exams forever"], 0],
        ["What did they make one week?", ["A small water filter", "A rocket to Mars", "A metal bridge", "A cotton shirt factory"], 0],
        ["What material was used in the filter?", ["Sand, pebbles and cloth", "Only plastic smoke", "Only oil", "Only glass sweets"], 0],
        ["What habit did Arjun start at home?", ["Turning off taps tightly", "Leaving taps open", "Wasting bottles", "Blocking drains for fun"], 0],
      ],
    },
    {
      text:
        "Honeybees live in colonies and work together. Worker bees collect nectar from flowers and help plants by pollination. The queen bee lays eggs. Beekeepers carefully collect honey without harming the hive when possible. Bees remind us that teamwork can create something sweet and useful.",
      qs: [
        ["Honeybees live in:", ["Colonies", "Alone always", "Deserts only as snakes", "Under oceans only"], 0],
        ["Worker bees collect:", ["Nectar", "Stones", "Iron", "Plastic"], 0],
        ["Pollination helps:", ["Plants", "Only cars", "Only rocks", "Only metal"], 0],
        ["Who lays eggs in the hive?", ["The queen bee", "The worker only never", "The beekeeper", "The butterfly king"], 0],
        ["The passage says teamwork can create something:", ["Sweet and useful", "Useless always", "Only noisy", "Only dark"], 0],
      ],
    },
    {
      text:
        "Meera wrote a letter to her grandmother using neat handwriting. She described her sports day, a funny race and the healthy snacks sold at the stall. Grandmother replied with a postcard from her town fair. Meera stuck both letters in a scrapbook to remember their chats on paper.",
      qs: [
        ["To whom did Meera write?", ["Her grandmother", "A stranger on Mars", "Only her principal forever", "A bus driver unknown"], 0],
        ["What event did she describe?", ["Sports day", "A space launch", "A silent exam only", "A winter flood only"], 0],
        ["What was sold at the stall?", ["Healthy snacks", "Broken tools", "Only tickets to space", "Wet cement"], 0],
        ["How did grandmother reply?", ["With a postcard", "With a loudspeaker only", "With no message", "With a truck"], 0],
        ["Where did Meera keep the letters?", ["In a scrapbook", "In the river", "In the oven", "On the road"], 0],
      ],
    },
  ];

  const p1 = passages[(p - 1) % passages.length];
  const p2 = passages[p % passages.length];
  for (const block of [p1, p2]) {
    block.qs.forEach((row, idx) => {
      const stem =
        idx === 0
          ? `Read the passage:\n\n"${block.text}"\n\n${row[0]}`
          : row[0];
      items.push(Q(id++, stem, row[1].slice(), row[2], R));
    });
  }

  // Spoken and Written Expression 5
  const swe = [
    ["Choose the best response: Friend: \"Congratulations on your prize!\" You:", ["Thank you so much!", "I don't care.", "Go away.", "What prize?"], 0],
    ["Best way to start a formal email:", ["Dear Sir/Madam,", "Hey!!!", "Yo friend", "Listen up"], 0],
    ["Choose polite request:", ["Could you please help me?", "Give me now!", "You must obey!", "Move it!"], 0],
    ["Correct order to write a story:", ["Beginning–middle–end", "End only then start", "Middle only", "Title without events"], 0],
    ["In a debate you should:", ["Listen and reply respectfully", "Shout only", "Interrupt rudely always", "Ignore facts"], 0],
    ["Choose the best notice heading style:", ["LOST: Blue Water Bottle", "whatever", "stuff", "thingy"], 0],
    ["When telephoning, a clear greeting is:", ["Hello, this is Anu speaking.", "Who are you? Speak fast.", "Nothing.", "Guess my name."], 0],
    ["Choose correct diary opening:", ["Dear Diary, today I...", "To whom it may concern only", "Subject: invoice", "Respected Principal only always"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = swe[(i + p) % swe.length];
    items.push(Q(id++, row[0], row[1].slice(), row[2], S));
  }
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

  const lr = [
    ["Odd one out: Keyboard, Mouse, Monitor, Banana.", ["Banana", "Keyboard", "Mouse", "Monitor"], 0],
    ["Complete: 5, 10, 15, 20, __.", ["25", "22", "30", "18"], 0],
    ["If CPU is brain of computer, which is similar for humans?", ["Brain", "Shoe", "Chair", "Window"], 0],
    ["Pen : Paper :: Keyboard : ?", ["Computer/screen input", "River", "Tree", "Cloud rain"], 0],
    ["Which does not belong: Input, Output, Storage, Cooking.", ["Cooking", "Input", "Output", "Storage"], 0],
    ["Arrange steps: Idea → Program → Output (best order start):", ["Start with clear steps/algorithm", "Delete OS first", "Break monitor", "Ignore problem"], 0],
    ["A is taller than B, B taller than C. Who is shortest?", ["C", "A", "B", "All equal"], 0],
    ["Binary uses digits:", ["0 and 1", "0 to 9 only", "A to Z only", "2 and 3 only"], 0],
    ["Find next: A1, B2, C3, __.", ["D4", "E5", "C4", "D3"], 0],
    ["Mirror of 8:00 on a clock face-like reasoning: opposite hour idea — 8 opposite is near:", ["2", "12", "6", "10"], 0],
  ];
  for (let i = 0; i < 10; i++) {
    const row = lr[(i + p) % lr.length];
    items.push(Q(id++, row[0], row[1].slice(), row[2], L));
  }

  const it = [
    ["The full form of CPU is:", ["Central Processing Unit", "Computer Personal Unit", "Central Print Unit", "Control Power Utility"], 0],
    ["Which is an input device?", ["Keyboard", "Monitor", "Speaker", "Printer"], 0],
    ["Which is an output device?", ["Printer", "Mouse", "Scanner", "Microphone"], 0],
    ["Which stores data permanently among these?", ["Hard disk", "RAM only", "Cache only", "Registers only"], 0],
    ["RAM is a type of:", ["Volatile memory", "Permanent paper", "Output device", "Input only device"], 0],
    ["The brain of the computer is the:", ["CPU", "Monitor", "UPS", "Speaker"], 0],
    ["MS Word is mainly used for:", ["Word processing", "Only calculations", "Only drawing maps", "Only playing CDs"], 0],
    ["MS Excel is mainly used for:", ["Spreadsheets and calculations", "Only painting", "Only email", "Only antivirus"], 0],
    ["MS PowerPoint is used to create:", ["Presentations", "Only databases of banks", "Only music albums", "Only CPU chips"], 0],
    ["A file extension .jpg usually denotes a:", ["Image file", "Sound only file", "Excel sheet", "Python program"], 0],
    ["Which key erases character to the left of the cursor?", ["Backspace", "Enter", "Shift", "Ctrl only"], 0],
    ["Ctrl + C is commonly used to:", ["Copy", "Paste", "Cut only", "Save"], 0],
    ["Ctrl + V is commonly used to:", ["Paste", "Copy", "Undo", "Print"], 0],
    ["Ctrl + S is commonly used to:", ["Save", "Sleep computer only", "Shut down", "Select all fonts"], 0],
    ["The blinking symbol on the screen showing typing position is the:", ["Cursor", "Icon only", "Wallpaper", "Folder"], 0],
    ["An operating system example is:", ["Windows", "MS Word only", "Google Chrome only", "Photoshop only"], 0],
    ["Google Chrome is a:", ["Web browser", "Operating system", "Printer driver", "Antivirus only"], 0],
    ["The Internet is:", ["A global network of networks", "A single computer in a bag", "Only a keyboard", "Only a pen drive"], 0],
    ["Email is used to:", ["Send electronic messages", "Print only books", "Cool the CPU", "Charge batteries"], 0],
    ["A strong password should be:", ["Long and hard to guess", "Your name only", "1234 only", "blank"], 0],
    ["You should not share your passwords with:", ["Strangers", "Your own password manager only", "Your locked offline notebook only", "A saved browser profile only"], 0],
    ["A virus in computers is a type of:", ["Malicious software", "Hardware fan", "Monitor colour", "Keyboard key"], 0],
    ["Software is:", ["Set of programs/instructions", "Only metal box", "Only wires", "Only screen glass"], 0],
    ["Hardware is:", ["Physical parts of a computer", "Only apps", "Only passwords", "Only websites"], 0],
    ["Which is storage device?", ["Pen drive", "Mouse", "Speaker", "Projector"], 0],
    ["In a URL, https suggests:", ["A secure web connection (generally)", "A broken link always", "Offline mode only", "A printer error"], 0],
    ["Icons on the desktop are:", ["Shortcuts/symbols to open items", "Viruses always", "Only photos printed", "Speakers"], 0],
    ["To shut down Windows properly you should use:", ["Start menu shut down option", "Pull plug only always", "Remove RAM", "Break the CD"], 0],
    ["A folder is used to:", ["Organize files", "Cool the CPU", "Replace the mouse", "Print colours only"], 0],
    ["QWERTY refers to:", ["A keyboard layout", "A printer ink", "A monitor size", "A type of virus only"], 0],
    ["The device that produces sound is a:", ["Speaker", "Scanner", "Mouse", "Webcam only"], 0],
    ["Scanner is mainly an:", ["Input device", "Output only", "Storage only", "OS"], 0],
    ["In Excel, a cell is the intersection of a:", ["Row and a column", "File and folder", "CPU and RAM", "Two speakers"], 0],
    ["Bold, italic and underline are:", ["Text formatting options", "Input devices", "Network cables", "Programming languages"], 0],
    ["Which is a search engine?", ["Google", "MS Word", "Windows Paint", "Notepad only"], 0],
    ["Bluetooth is commonly used for:", ["Short-range wireless connection", "Cooking food", "Printing only books always", "Cooling water"], 0],
    ["A byte is made of:", ["8 bits", "2 bits", "100 bits", "1 bit only"], 0],
    ["Which unit is larger?", ["Gigabyte", "Kilobyte", "Byte", "Bit"], 0],
  ];
  for (let i = 0; i < 35; i++) {
    const row = it[(i + (p - 1) * 3) % it.length];
    let q = row[0];
    if (p > 1 && i % 6 === 0) q = q.replace(/\?$/, "? Select the best answer.");
    items.push(Q(id++, q, row[1].slice(), row[2], C));
  }

  const ach = [
    ["Which sequence is correct for turning on and using a PC safely?",
      ["Power on → log in → open needed app → shut down properly", "Pull cables first → smash keys → force restart forever", "Open app before power", "Remove HDD then type"], 0],
    ["If a website asks for your school password by email suddenly, you should:",
      ["Not share it; verify with a trusted adult/teacher", "Send password immediately", "Post it on social media", "Ignore school forever"], 0],
    ["RAM is cleared when power goes off, but documents you need later should be saved to:",
      ["Hard disk/SSD or drive storage", "Only the CPU fan", "Only the screen pixels", "Only the speakers"], 0],
    ["In a spreadsheet, formula to add cells A1 and B1 often starts with:",
      ["=A1+B1", "A1+B1 without =", "Add A1 B1 words only", "#A1B1"], 0],
    ["Phishing is best described as:",
      ["Tricking people to reveal secrets online", "A type of printer ink", "A keyboard brand", "A cooling method"], 0],
    ["Which is the best backup habit?",
      ["Keep copies of important files in another safe place", "Never save anything", "Delete all weekly", "Share passwords as backup"], 0],
    ["IP address basically identifies a:",
      ["Device on a network", "Type of mouse colour", "Font style", "Speaker volume only"], 0],
    ["Cloud storage means roughly:",
      ["Storing data on remote servers accessed via internet", "Storing data only in rain clouds outside", "Deleting data forever", "Printing to paper only"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = ach[(i + p) % ach.length];
    items.push(Q(id++, row[0], row[1].slice(), row[2], A, 3));
  }
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
    ["The national animal of India is the:", ["Tiger", "Lion", "Elephant", "Peacock"], 0],
    ["The national bird of India is the:", ["Peacock", "Sparrow", "Eagle", "Parrot"], 0],
    ["The national flower of India is the:", ["Lotus", "Rose", "Sunflower", "Lily"], 0],
    ["The currency of India is the:", ["Rupee", "Dollar", "Yen", "Euro"], 0],
    ["Which is the largest ocean?", ["Pacific Ocean", "Indian Ocean", "Atlantic Ocean", "Arctic Ocean"], 0],
    ["The tallest mountain peak in the world is:", ["Mount Everest", "K2", "Kanchenjunga", "Nanda Devi"], 0],
    ["The Father of the Nation of India is:", ["Mahatma Gandhi", "Jawaharlal Nehru", "Subhas Chandra Bose", "Bhagat Singh"], 0],
    ["The first Prime Minister of India was:", ["Jawaharlal Nehru", "Lal Bahadur Shastri", "Indira Gandhi", "Rajendra Prasad"], 0],
    ["The first President of India was:", ["Dr. Rajendra Prasad", "Dr. S. Radhakrishnan", "Zakir Husain", "V.V. Giri"], 0],
    ["Which planet is closest to the Sun?", ["Mercury", "Venus", "Earth", "Mars"], 0],
    ["How many continents are there?", ["7", "5", "6", "8"], 0],
    ["The largest desert in the world (hot) commonly cited in school GK is the:", ["Sahara", "Thar", "Gobi", "Kalahari"], 0],
    ["The river Ganga originates from the:", ["Gangotri glacier region", "Bay of Bengal", "Arabian Sea", "Thar Desert"], 0],
    ["Ajanta caves are famous for:", ["Paintings", "Tea gardens only", "Ship building", "Space research"], 0],
    ["The festival of lights in India is:", ["Diwali", "Holi", "Pongal only", "Baisakhi only"], 0],
    ["Holi is known as the festival of:", ["Colours", "Lights only", "Kites only", "Harvest only always"], 0],
    ["The Southernmost point of mainland India is near:", ["Kanyakumari", "Kashmir", "Gujarat only", "Sikkim"], 0],
    ["Which is a classical dance of Tamil Nadu?", ["Bharatanatyam", "Kathak only", "Bihu only", "Garba only"], 0],
    ["The Red Fort is in:", ["Delhi", "Mumbai", "Chennai", "Kolkata"], 0],
    ["The Gateway of India is in:", ["Mumbai", "Delhi", "Jaipur", "Hyderabad"], 0],
    ["Which gas do humans need to breathe?", ["Oxygen", "Nitrogen only", "Carbon monoxide", "Helium only"], 0],
    ["The longest river in India is often taught as the:", ["Ganga", "Yamuna only", "Narmada only", "Mahanadi only"], 0],
    ["Who wrote the national anthem 'Jana Gana Mana'?", ["Rabindranath Tagore", "Bankim Chandra Chatterjee", "Sarojini Naidu", "Premchand"], 0],
    ["Vande Mataram was written by:", ["Bankim Chandra Chatterjee", "Tagore only", "Gandhi", "Nehru"], 0],
    ["The Ashoka Chakra in the flag has how many spokes?", ["24", "12", "36", "48"], 0],
    ["Which sport uses a shuttlecock?", ["Badminton", "Cricket", "Hockey", "Football"], 0],
    ["Hockey is often called India's traditional national sport in many school books; a popular stick-and-ball game is:", ["Hockey", "Chess only", "Carrom only", "Kabaddi only"], 0],
    ["The largest state by area in India (among common GK answers) is:", ["Rajasthan", "Goa", "Sikkim", "Kerala"], 0],
    ["Which is the smallest state by area in India?", ["Goa", "Rajasthan", "Maharashtra", "Uttar Pradesh"], 0],
    ["The Sunderbans are famous for:", ["Mangrove forests and tigers", "Only deserts", "Only volcanoes", "Only glaciers"], 0],
    ["Who is known as Missile Man of India?", ["Dr. A.P.J. Abdul Kalam", "Vikram Sarabhai only as only answer forever", "Homi Bhabha only", "Aryabhata only"], 0],
    ["Earth Day is observed to promote:", ["Environmental protection", "Only sports", "Only exams", "Only shopping"], 0],
    ["Which instrument measures temperature?", ["Thermometer", "Barometer only", "Ammeter only", "Speedometer only"], 0],
    ["The polar bears are naturally found near the:", ["Arctic region", "Sahara", "Amazon only", "Thar"], 0],
  ];
  for (let i = 0; i < 30; i++) {
    const row = ga[(i + (p - 1) * 3) % ga.length];
    let q = row[0];
    if (p > 1 && i % 7 === 0) q = q + " Choose the correct option.";
    items.push(Q(id++, q, row[1].slice(), row[2], GA));
  }

  // Current affairs — evergreen + recent-general (not claiming fake news)
  const ca = [
    ["G20 presidency of India was held in the year:", ["2023", "2010", "1999", "1985"], 0],
    ["Chandrayaan-3 successfully landed near the Moon's:", ["South polar region", "Only far ocean on Earth", "Sun surface", "Mars desert"], 0],
    ["International Yoga Day is celebrated on:", ["21 June", "15 August", "26 January", "2 October"], 0],
    ["World Environment Day is observed on:", ["5 June", "1 January", "14 November", "25 December"], 0],
    ["The headquarters of the United Nations is in:", ["New York", "Mumbai", "Geneva only always", "Paris only always"], 0],
    ["WHO mainly deals with:", ["Global health", "Only space rockets", "Only cricket scores", "Only cinema"], 0],
    ["Aadhaar in India is related to:", ["Unique identity number", "A type of fruit", "A dance form", "A river only"], 0],
    ["UPI in India is commonly used for:", ["Digital payments", "Only school uniforms", "Only weather maps", "Only train engines"], 0],
    ["The Olympic Games are held every:", ["4 years", "1 year", "10 years", "50 years"], 0],
    ["COVID-19 is caused by a:", ["Virus", "Vitamin", "Mineral only", "Type of plastic"], 0],
    ["Paris hosted the Summer Olympics in:", ["2024", "2000", "1992", "1980"], 0],
    ["India's Independence Day is on:", ["15 August", "26 January", "2 October", "14 November"], 0],
    ["Republic Day of India is on:", ["26 January", "15 August", "1 May", "5 September"], 0],
    ["Teachers' Day in India is celebrated on:", ["5 September", "14 November", "2 October", "1 December"], 0],
    ["Children's Day in India is on:", ["14 November", "5 September", "15 August", "26 January"], 0],
  ];
  for (let i = 0; i < 10; i++) {
    const row = ca[(i + p) % ca.length];
    items.push(Q(id++, row[0], row[1].slice(), row[2], CA));
  }

  const ls = [
    ["If you see a classmate being bullied, a good action is to:", ["Tell a trusted teacher/adult and support the classmate", "Join the bullying", "Film and mock online", "Ignore forever always"], 0],
    ["Before crossing the road you should:", ["Look both ways and use a zebra crossing when available", "Run without looking", "Close your eyes", "Play on the road"], 0],
    ["Saying 'please' and 'thank you' shows:", ["Good manners", "Weakness only", "Anger", "Fear of books"], 0],
    ["If a stranger online asks for your address and photos, you should:", ["Not share; tell a parent/teacher", "Send everything", "Meet alone at night", "Share passwords too"], 0],
    ["Washing hands before meals helps to:", ["Prevent germs from spreading", "Change hair colour", "Increase TV time", "Skip homework"], 0],
    ["Teamwork means:", ["Working together respectfully", "Doing nothing", "Blaming only others", "Hiding all tools"], 0],
    ["When you make a mistake, a mature response is to:", ["Admit, learn and improve", "Always blame friends", "Lie forever", "Quit learning"], 0],
    ["Saving water at home can include:", ["Turning off taps when not in use", "Leaving taps open", "Washing car hourly with hose always", "Blocking drains for fun"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = ls[(i + p) % ls.length];
    items.push(Q(id++, row[0], row[1].slice(), row[2], LS));
  }

  const ach = [
    ["Which statement about the Indian Constitution is true at Class 5 level?",
      ["It is the supreme law of India", "It is a storybook only", "It is a sports rulebook only", "It applies only to one city"], 0],
    ["The three colours of the Indian national flag are:",
      ["Saffron, white and green", "Red, blue and yellow only", "Black, white and grey", "Purple, pink and orange"], 0],
    ["Fundamental duties (as taught in EVS/GK) encourage citizens to:",
      ["Respect the Constitution, heritage and environment", "Damage public property", "Skip all laws", "Avoid education"], 0],
    ["Which is a SAARC country?",
      ["Bangladesh", "Brazil", "Japan", "Germany"], 0],
    ["The Tropic of Cancer passes through:",
      ["India", "Only Australia", "Only Antarctica", "Only Greenland"], 0],
    ["Green Revolution in India is associated mainly with increase in:",
      ["Food grain production", "Only space travel", "Only film production", "Only cricket stadiums"], 0],
    ["Which body of water lies to the west of India?",
      ["Arabian Sea", "Bay of Bengal", "Pacific Ocean only", "Arctic Ocean only"], 0],
    ["The term 'democracy' means rule by the:",
      ["People", "Only kings forever", "Only robots", "Only one family always without elections"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = ach[(i + p) % ach.length];
    items.push(Q(id++, row[0], row[1].slice(), row[2], A, 3));
  }
  return pack(items);
}

// ═══════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════
function main() {
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
      // section sanity
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
  console.log(`\nWrote ${written} question papers + ${written} answer keys under Olympiad/data/class5/`);
  console.log("All Class 5 papers are original SOF-pattern practice (2023–2025 style).");
}

main();

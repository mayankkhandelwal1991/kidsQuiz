#!/usr/bin/env node
/**
 * Generate Class 7 SOF-pattern ORIGINAL practice papers (2023-2025 style).
 * NOT copyrighted SOF content — original NCERT Class 7 level questions.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "data", "class7");
const CLASS = 7;
const PAPERS = 5;

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function shuffleOptions(options, answerIndex, salt) {
  const arr = options.map((t, i) => ({ t, correct: i === answerIndex }));
  let s = (salt * 17 + 31) % 97;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 13 + 7) % (i + 1);
    const j = s;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return {
    options: arr.map((x) => x.t),
    answer: arr.findIndex((x) => x.correct),
  };
}

function Q(id, question, options, answer, section, marks = 1) {
  return { id, question, options: options.slice(), answer, section, marks };
}

function numOpts(correct, salt, deltas = [1, -1, 2, -2]) {
  const set = new Set([correct]);
  for (const d of deltas) {
    if (set.size >= 4) break;
    set.add(correct + d);
  }
  let k = 3;
  while (set.size < 4) {
    set.add(correct + k);
    k++;
  }
  const opts = [...set].slice(0, 4).map(String);
  const ai = opts.indexOf(String(correct));
  return shuffleOptions(opts, ai, salt);
}

function writePaper(subject, paperNo, built, totalMarks, patternNote) {
  const qDir = path.join(ROOT, subject, "questions");
  const aDir = path.join(ROOT, subject, "answers");
  ensureDir(qDir);
  ensureDir(aDir);

  const questions = built.map((q, idx) => ({
    id: idx + 1,
    question: q.question,
    options: q.options,
    section: q.section,
    marks: q.marks,
  }));
  const answers = built.map((q) => q.answer);

  const qDoc = {
    class: CLASS,
    subject,
    paper: paperNo,
    totalQuestions: questions.length,
    totalMarks,
    patternNote,
    yearStyle: "2023-2025",
    questions,
  };
  const aDoc = { class: CLASS, subject, paper: paperNo, answers };

  fs.writeFileSync(path.join(qDir, `paper${paperNo}.json`), JSON.stringify(qDoc, null, 2));
  fs.writeFileSync(path.join(aDir, `paper${paperNo}.json`), JSON.stringify(aDoc, null, 2));
}


// ═══════════════════════════════════════════════════════════
// MATHEMATICS — Class 7
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
    const s0 = 3 + p;
    let o = numOpts(s0 + 20, id, [1, -1, 3, 5]);
    items.push(Q(id++, `Find the next term: ${s0}, ${s0 + 5}, ${s0 + 10}, ${s0 + 15}, __.`, o.options, o.answer, L));

    const g = 2 + p;
    o = numOpts(g * 16, id, [2, 4, -3, 8]);
    items.push(Q(id++, `Find the next term: ${g}, ${g * 2}, ${g * 4}, ${g * 8}, __.`, o.options, o.answer, L));

    items.push(Q(id++, "Odd one out: Equilateral triangle, Isosceles triangle, Scalene triangle, Cube", ["Cube", "Equilateral triangle", "Isosceles triangle", "Scalene triangle"], 0, L));
    items.push(Q(id++, "If RATIONAL is coded as SBUJPOBM (each letter +1), then INTEGER is coded as:", ["JOUFHFS", "HMSEDDR", "JOUFHGS", "HMSFDDR"], 0, L));
    items.push(Q(id++, "Priya faces East. She turns 90° left, then 180°, then 90° right. She now faces:", ["West", "East", "North", "South"], 0, L));
    items.push(Q(id++, "Analogy: 5 : 125 :: 6 : ?", ["216", "36", "30", "150"], 0, L));
    items.push(Q(id++, "Odd one out: Profit, Loss, Discount, Perimeter", ["Perimeter", "Profit", "Loss", "Discount"], 0, L));

    o = numOpts(22, id, [2, -2, 4, 1]);
    items.push(Q(id++, "In a row of 35 students, Arjun is 14th from the left. His position from the right is:", o.options, o.answer, L));

    items.push(Q(id++, "If 1 January is a Thursday, then 8 January of the same year is a:", ["Thursday", "Friday", "Wednesday", "Saturday"], 0, L));

    o = numOpts(10, id, [1, -1, 2, 3]);
    items.push(Q(id++, `In a class, ${15 + p} play football, ${12 + p} play cricket and ${5 + p} play both. How many play only football?`, o.options, o.answer, L));

    items.push(Q(id++, "Which figure comes next in the pattern of number of sides: Triangle, Square, Pentagon, __?", ["Hexagon", "Circle", "Line", "Point"], 0, L));
    items.push(Q(id++, "If + means ×, × means −, − means ÷ and ÷ means +, then value of 8 + 3 − 4 × 2 is:", ["4", "8", "2", "16"], 0, L));
    // 8×3 ÷4 −2 = 6−2 = 4

    o = numOpts(64, id, [8, 16, -8, 32]);
    items.push(Q(id++, "Complete the series: 2, 4, 8, 16, 32, __.", o.options, o.answer, L));

    items.push(Q(id++, "A is the brother of B. B is the sister of C. C is the father of D. How is A related to D?", ["Uncle", "Father", "Brother", "Grandfather"], 0, L));
    items.push(Q(id++, "Which does not belong: 2, 3, 5, 9, 11 (primes vs composite)", ["9", "2", "3", "5"], 0, L));
  }

  // —— Mathematical Reasoning 20×1 ——
  {
    let o = numOpts(-12, id, [2, -2, 4, 6]);
    items.push(Q(id++, "Evaluate: (−3) × 7 + 9 = ?", o.options, o.answer, M));

    o = numOpts(15, id, [1, -1, 3, 5]);
    items.push(Q(id++, "Simplify: (−5) × (−4) + (−5) = ?", o.options, o.answer, M));

    o = numOpts(6, id, [1, -1, 2, 3]);
    items.push(Q(id++, "What is 3/4 of 8?", o.options, o.answer, M));

    o = numOpts(25, id, [5, -5, 10, 1]);
    items.push(Q(id++, "Convert 0.25 into a percentage.", o.options, o.answer, M));

    o = numOpts(5, id, [1, -1, 2, 3]);
    items.push(Q(id++, "Solve for x: 3x + 5 = 20", o.options, o.answer, M));

    o = numOpts(8, id, [1, -1, 2, 4]);
    items.push(Q(id++, "Solve for x: 2(x − 3) = 10", o.options, o.answer, M));

    o = numOpts(40, id, [5, -5, 10, 20]);
    items.push(Q(id++, "Two adjacent angles on a straight line are (2x + 10)° and (x + 50)°. Find x.", o.options, o.answer, M));

    items.push(Q(id++, "If two lines intersect and one angle is 70°, the vertically opposite angle is:", ["70°", "110°", "20°", "90°"], 0, M));

    o = numOpts(65, id, [5, -5, 10, 15]);
    items.push(Q(id++, "In △ABC, ∠A = 50° and ∠B = 65°. Find ∠C.", o.options, o.answer, M));

    items.push(Q(id++, "The sum of the exterior angles of any convex polygon, taken one at each vertex, is:", ["360°", "180°", "90°", "270°"], 0, M));
    items.push(Q(id++, "Which congruence criterion uses two sides and the included angle?", ["SAS", "SSS", "AAA", "SSA"], 0, M));

    o = numOpts(30, id, [5, -5, 10, 15]);
    items.push(Q(id++, "What is 15% of 200?", o.options, o.answer, M));

    o = numOpts(15, id, [5, -5, 10, 3]);
    items.push(Q(id++, "An article bought for ₹400 is sold for ₹460. The profit percent is:", o.options, o.answer, M));

    o = numOpts(200, id, [50, -50, 100, 20]);
    items.push(Q(id++, "Find the simple interest on ₹2000 at 5% per annum for 2 years.", o.options, o.answer, M));

    items.push(Q(id++, "Which of the following is a rational number?", ["−3/7", "√2", "π", "√3"], 0, M));

    o = numOpts(60, id, [10, -10, 12, 5]);
    items.push(Q(id++, "Area of a parallelogram with base 12 cm and height 5 cm is:", o.options, o.answer, M));

    o = numOpts(44, id, [7, -7, 14, 22]);
    items.push(Q(id++, "Circumference of a circle of radius 7 cm (use π = 22/7) is:", o.options, o.answer, M));

    items.push(Q(id++, "Simplify: 3x + 5x − 2x", ["6x", "5x", "3x", "10x"], 0, M));

    o = numOpts(81, id, [9, -9, 27, 3]);
    items.push(Q(id++, "Evaluate: 3^4", o.options, o.answer, M));

    o = numOpts(24, id, [4, -4, 8, 12]);
    items.push(Q(id++, "Area of a triangle with base 8 cm and height 6 cm is:", o.options, o.answer, M));
  }

  // —— Achievers 5×3 ——
  {
    const achFixed = [
      ["A shopkeeper buys an article for ₹800 and sells it at a profit of 12.5%. The selling price is:", ["₹900", "₹850", "₹1000", "₹812"], 0],
      ["The simple interest on a sum for 3 years at 8% p.a. is ₹480. The principal is:", ["₹2000", "₹1600", "₹2400", "₹1500"], 0],
      ["In △ABC, AB = AC and ∠A = 80°. Each of the base angles measures:", ["50°", "40°", "80°", "100°"], 0],
      ["If 2^(x+1) = 32, then x equals:", ["4", "5", "3", "16"], 0],
      ["The value of (−2)^3 × (−3)^2 is:", ["−72", "72", "−36", "36"], 0],
      ["A sum becomes ₹2400 in 2 years at 10% p.a. simple interest. The principal was:", ["₹2000", "₹2200", "₹2100", "₹1800"], 0],
      ["The area of a circle is 154 cm² (π = 22/7). Its radius is:", ["7 cm", "14 cm", "11 cm", "22 cm"], 0],
      ["Solve: 5x − 3 = 2x + 9. The value of x is:", ["4", "3", "6", "2"], 0],
    ];
    for (let i = 0; i < 5; i++) {
      const row = achFixed[(i + p) % achFixed.length];
      const sh = shuffleOptions(row[1], row[2], id + p * 10);
      items.push(Q(id++, row[0], sh.options, sh.answer, A, 3));
    }
  }

  return items;
}


// ═══════════════════════════════════════════════════════════
// SCIENCE — Class 7
// ═══════════════════════════════════════════════════════════
function buildScience(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const L = "Logical Reasoning";
  const S = "Science";
  const A = "Achievers Section";

  items.push(Q(id++, "Find the next: 3, 6, 12, 24, __.", ["48", "36", "30", "40"], 0, L));
  items.push(Q(id++, "Odd one out: Photosynthesis, Transpiration, Respiration, Condensation", ["Condensation", "Photosynthesis", "Transpiration", "Respiration"], 0, L));
  items.push(Q(id++, "Analogy: Stomata : Gas exchange :: Xylem : ?", ["Water transport", "Food storage only", "Pollination", "Seed dispersal"], 0, L));
  items.push(Q(id++, "If ‘Acid’ is related to ‘Sour’, then ‘Base’ is related to:", ["Bitter", "Sweet only", "Salty only", "Odourless always"], 0, L));
  items.push(Q(id++, "Which does not belong: Conduction, Convection, Radiation, Digestion", ["Digestion", "Conduction", "Convection", "Radiation"], 0, L));
  items.push(Q(id++, "Series: 1, 4, 9, 16, 25, __.", ["36", "30", "32", "49"], 0, L));
  items.push(Q(id++, "A is faster than B but slower than C. D is slower than B. Who is fastest?", ["C", "A", "B", "D"], 0, L));
  items.push(Q(id++, "Which letter has a vertical line of symmetry?", ["A", "B", "C", "E"], 0, L));
  items.push(Q(id++, "If all roses are flowers and some flowers fade quickly, which must be true?", ["Some roses may fade quickly", "No rose is a flower", "All flowers are roses", "Roses never fade"], 0, L));
  items.push(Q(id++, "Odd one out: Thermometer, Barometer, Speedometer, Chlorophyll", ["Chlorophyll", "Thermometer", "Barometer", "Speedometer"], 0, L));

  const sciBank = [
    ["The process by which green plants make food is called:", ["Photosynthesis", "Respiration", "Transpiration", "Fermentation"], 0],
    ["Stomata in leaves mainly help in:", ["Exchange of gases", "Absorbing minerals from soil", "Producing seeds", "Attracting insects only"], 0],
    ["Amoeba takes in food by:", ["Pseudopodia (phagocytosis)", "Teeth chewing", "Filter feeding only like whales", "Photosynthesis"], 0],
    ["The largest gland in the human body is the:", ["Liver", "Pancreas", "Thyroid", "Salivary gland"], 0],
    ["Bile is stored in the:", ["Gall bladder", "Stomach", "Kidney", "Lungs"], 0],
    ["Cotton fibre is obtained from:", ["Cotton plant seeds/bolls", "Sheep", "Silkworm", "Jute stem only"], 0],
    ["Silk is obtained from:", ["Silkworm cocoons", "Cotton plant", "Flax", "Polyester factory trees"], 0],
    ["Heat flows from a hotter body to a colder body until:", ["Temperatures become equal", "Masses become equal", "Volumes become zero", "Colours match"], 0],
    ["A clinical thermometer is used to measure:", ["Body temperature", "Atmospheric pressure", "Wind speed", "Rainfall"], 0],
    ["Land breeze blows from:", ["Land to sea (usually at night)", "Sea to land always at noon only", "Mountains to space", "Equator to poles only"], 0],
    ["Acids turn blue litmus:", ["Red", "Green", "Blue deeper", "Black"], 0],
    ["Bases turn red litmus:", ["Blue", "Red deeper", "Yellow", "Orange"], 0],
    ["A salt and water are formed in a reaction between:", ["Acid and base (neutralisation)", "Two metals only", "Oxygen and nitrogen only", "Sand and clay"], 0],
    ["Rusting of iron is a:", ["Chemical change", "Physical change only", "Reversible melting only", "Change of state of water"], 0],
    ["Melting of ice is a:", ["Physical change", "Chemical change", "Nuclear change", "Biological evolution"], 0],
    ["Weather describes atmospheric conditions:", ["Over a short period at a place", "Over many decades globally only", "Only inside the Earth", "Only in oceans depths"], 0],
    ["Climate is the:", ["Average weather pattern over a long period", "Weather of one afternoon only", "Temperature of a cup of tea", "Speed of a car"], 0],
    ["High speed winds are accompanied by:", ["Reduced air pressure", "Increased air pressure always only", "No change in pressure ever", "Solid rock formation"], 0],
    ["The uppermost layer of soil is generally rich in:", ["Humus", "Only pure metal", "Plastic", "Glass"], 0],
    ["During inhalation, the diaphragm:", ["Contracts and moves downward", "Relaxes and moves upward only always", "Disappears", "Turns into bone"], 0],
    ["In humans, oxygen is carried mainly by:", ["Haemoglobin in red blood cells", "White blood cells only", "Platelets only", "Plasma proteins that make hair"], 0],
    ["Xylem transports:", ["Water and minerals", "Only food from leaves", "Only oxygen to roots", "Only carbon dioxide to flowers"], 0],
    ["Phloem transports:", ["Food (mainly sugars)", "Only water upward", "Only minerals from air", "Only sunlight"], 0],
    ["The human heart has:", ["Four chambers", "Two chambers", "Three chambers", "Six chambers"], 0],
    ["Seeds may be dispersed by:", ["Wind, water, animals", "Only electricity", "Only magnets", "Only earthquakes"], 0],
    ["Vegetative propagation is reproduction from:", ["Vegetative parts like stem/leaf/root", "Only seeds always", "Only flowers always", "Only fruits always"], 0],
    ["Speed is defined as:", ["Distance travelled per unit time", "Force per unit area", "Mass per volume", "Energy per charge"], 0],
    ["The SI unit of speed is:", ["m/s", "km only", "m only", "s/m"], 0],
    ["A simple pendulum’s time period depends mainly on:", ["Length of the pendulum", "Mass of bob only (ideally independent)", "Colour of bob", "Only room number"], 0],
    ["Electric current is the flow of:", ["Electric charges", "Only heat without charge", "Only sound", "Only light always"], 0],
    ["A good conductor among the following is:", ["Copper", "Rubber", "Plastic", "Dry wood"], 0],
    ["In a closed circuit with a battery and bulb, the bulb glows when:", ["The circuit is complete", "The wire is cut", "There is no cell", "The switch is open and breaks path"], 0],
    ["Light travels in:", ["Straight lines in a uniform medium", "Only circles", "Only zig-zag without reason", "Only through metals"], 0],
    ["A real image formed by a concave mirror can be:", ["Caught on a screen", "Never inverted", "Only virtual always", "Formed only by sound"], 0],
    ["White light can be split into a spectrum using a:", ["Prism", "Plain mirror only", "Wooden block", "Metal spoon only"], 0],
    ["Forests help in:", ["Maintaining water cycle and preventing soil erosion", "Increasing air pollution only", "Destroying biodiversity only", "Stopping rainfall forever"], 0],
    ["Wastewater should be treated before release to:", ["Reduce pollution of water bodies", "Increase toxic chemicals", "Kill all fish intentionally", "Block sunlight in space"], 0],
    ["Neutralisation is used in:", ["Treating acidic soil with base (e.g. lime)", "Only freezing water", "Only cutting wood", "Only measuring length"], 0],
    ["The mode of heat transfer in solids is mainly:", ["Conduction", "Convection only", "Radiation only through vacuum exclusive", "Photosynthesis"], 0],
    ["Sea breeze blows from:", ["Sea to land (usually during day)", "Land to sea always at midnight only", "Space to Earth", "Core to crust"], 0],
  ];

  const start = (p - 1) * 3;
  for (let i = 0; i < 35; i++) {
    const row = sciBank[(start + i) % sciBank.length];
    const sh = shuffleOptions(row[1], row[2], id + p);
    items.push(Q(id++, row[0], sh.options, sh.answer, S, 1));
  }

  const achS = [
    ["A plant kept in dark for long shows yellowing of leaves mainly because:", ["Chlorophyll formation/activity is affected without light", "Roots stop existing", "Soil turns into metal", "Stomata become bones"], 0],
    ["During heavy exercise, muscle cells may respire anaerobically producing:", ["Lactic acid", "Only pure oxygen gas stored", "Chlorophyll", "Urea in leaves"], 0],
    ["If the distance–time graph of a body is a straight line parallel to the time axis, the body is:", ["At rest", "Accelerating uniformly", "In free fall only", "Moving with increasing speed always"], 0],
    ["Two plane mirrors are placed at 90°. The number of images of an object placed between them is generally:", ["3", "1", "5", "Infinite always"], 0],
    ["Why is a fuse used in an electric circuit?", ["It melts and breaks the circuit if current is too high", "It increases voltage without limit", "It stores food", "It produces chlorophyll"], 0],
    ["Which combination correctly matches transport in plants?", ["Xylem – water; Phloem – food", "Xylem – food; Phloem – only oxygen", "Both carry only sunlight", "Neither carries anything"], 0],
    ["An acid is accidentally spilled on the floor. A safe first approach among options is:", ["Inform an adult and neutralise carefully with suitable mild base as guided", "Taste it to check", "Add more strong acid", "Ignore and walk barefoot on it"], 0],
    ["Which statement about thunderstorm safety is correct?", ["Avoid open fields and tall isolated trees during lightning", "Hold metal poles high in open fields", "Swim in open lakes during lightning for safety", "Stand under the tallest single tree"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = achS[(i + p) % achS.length];
    const sh = shuffleOptions(row[1], row[2], id + p * 3);
    items.push(Q(id++, row[0], sh.options, sh.answer, A, 3));
  }
  return items;
}


// ═══════════════════════════════════════════════════════════
// ENGLISH — Class 7
// ═══════════════════════════════════════════════════════════
function buildEnglish(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const W = "Word and Structure Knowledge";
  const R = "Reading";
  const S = "Spoken and Written Expression";

  const wsk = [
    ["She _____ to school every day.", ["goes", "go", "going", "gone"], 0],
    ["They _____ playing cricket when it started raining.", ["were", "was", "are", "is"], 0],
    ["By next year, we _____ this project.", ["will have completed", "complete", "completing", "completed"], 0],
    ["The letter _____ yesterday.", ["was posted", "posted", "was posting", "has post"], 0],
    ["Change to passive: ‘They built a bridge.’ →", ["A bridge was built by them.", "A bridge built them.", "They were built a bridge.", "A bridge is building them."], 0],
    ["He said, “I am busy.” → He said that he _____ busy.", ["was", "is", "am", "were"], 0],
    ["Choose the correct indirect speech: She said, “I will help you.”", ["She said that she would help me.", "She said that she will help you.", "She says she help.", "She said she helping."], 0],
    ["Identify the subordinate clause: ‘I know that he is honest.’", ["that he is honest", "I know", "he", "honest"], 0],
    ["You _____ wear a helmet while riding a bike. (obligation)", ["must", "might", "used to", "needn’t always only"], 0],
    ["_____ I borrow your pen?", ["May", "Ought", "Used", "Needn’t"], 0],
    ["The synonym of ‘brave’ is:", ["courageous", "cowardly", "timid", "fearful"], 0],
    ["The antonym of ‘expand’ is:", ["contract", "enlarge", "increase", "grow"], 0],
    ["Choose the correctly spelled word:", ["Environment", "Enviroment", "Enviornment", "Envirenment"], 0],
    ["A person who writes books is an:", ["author", "anchor", "aviator", "auditor only always"], 0],
    ["‘Break the ice’ means:", ["Start a conversation in a friendly way", "Smash frozen water only literally always", "End a friendship", "Fail an exam"], 0],
    ["Neither Ravi nor his friends _____ present.", ["are", "is", "was", "be"], 0],
    ["The jury _____ divided in their opinions. (emphasising individuals)", ["were", "was", "is", "be"], 0],
    ["Insert article: He is _____ honest man.", ["an", "a", "the", "no article possible"], 0],
    ["Insert article: _____ Himalayas are in the north of India.", ["The", "A", "An", "No article"], 0],
    ["Choose the correct preposition: She is good _____ mathematics.", ["at", "in", "on", "over"], 0],
    ["He congratulated me _____ my success.", ["on", "for", "at", "with"], 0],
    ["Identify the adjective: The beautiful garden attracts visitors.", ["beautiful", "garden", "attracts", "visitors"], 0],
    ["Identify the adverb: She sang melodiously.", ["melodiously", "She", "sang", "none"], 0],
    ["Choose correct conjunction: I stayed at home _____ it was raining.", ["because", "but only wrong", "although always opposite", "or"], 0],
    ["‘Who’ refers to:", ["People (subject)", "Things only", "Places only", "Time only"], 0],
    ["Relative clause: This is the book _____ I bought yesterday.", ["which/that", "who", "whose only person", "whom always"], 0],
    ["Choose the correct form: If it rains, we _____ indoors.", ["will stay", "stayed", "staying", "had stay"], 0],
    ["Past perfect: When we arrived, the train _____.", ["had left", "has left", "leaves", "leaving"], 0],
    ["Gerund: _____ is a good exercise.", ["Swimming", "Swam", "Swum", "Swimmed"], 0],
    ["Infinitive: She wants _____ a doctor.", ["to become", "become", "becoming", "became"], 0],
    ["Choose correct: One of the boys _____ absent today.", ["is", "are", "were", "be"], 0],
    ["The news _____ true.", ["is", "are", "were", "have"], 0],
    ["Plural of ‘crisis’ is:", ["crises", "crisises", "crisis", "crisi"], 0],
    ["Feminine of ‘actor’ is:", ["actress", "actorine", "actora", "act"], 0],
    ["Choose correct question tag: You are coming, _____?", ["aren’t you", "are you not not", "isn’t you", "don’t you are"], 0],
    ["Order of adjectives: She bought a _____ bag.", ["small black leather", "leather black small", "black small leather", "small leather black"], 0],
    ["Choose the correct sentence:", ["He has been living here since 2018.", "He living here since 2018.", "He is live here since 2018.", "He live here since 2018."], 0],
    ["‘Their’ is a:", ["possessive determiner", "verb", "adverb of manner", "conjunction"], 0],
    ["Choose synonym of ‘ancient’:", ["old", "modern", "new", "recent"], 0],
    ["Antonym of ‘generous’:", ["selfish", "kind", "helpful", "noble"], 0],
    ["Idiom: ‘A piece of cake’ means:", ["Something very easy", "A dessert only always", "A difficult task", "An expensive item"], 0],
    ["Choose correct narration: He said to me, “Please wait.”", ["He requested me to wait.", "He said me wait.", "He ordered please.", "He told waiting."], 0],
    ["Voice: ‘Open the door.’ (passive imperative sense)", ["Let the door be opened.", "The door opened him.", "Door is open they.", "Opening door was."], 0],
    ["Modal of possibility: It _____ rain this evening.", ["may", "must to", "ought not never", "used"], 0],
    ["Choose correct: The committee _____ submitted its report.", ["has", "have always only", "are", "were"], 0],
    ["Phrasal verb: ‘Call off’ means:", ["Cancel", "Telephone loudly only", "Visit briefly only", "Shout"], 0],
    ["Choose the correctly punctuated sentence:", ["“What is your name?” she asked.", "What is your name she asked", "“What is your name she asked?”", "What is your name She asked"], 0],
    ["Homophone pair: They went _____ house.", ["to their", "too there", "two they’re", "to there"], 0],
    ["Choose correct comparative:", ["better", "more better", "goodest", "bestter"], 0],
    ["Superlative of ‘little’ (quantity) is often:", ["least", "littlest always only", "lesserest", "most little"], 0],
  ];

  const startW = (p - 1) * 2;
  for (let i = 0; i < 45; i++) {
    const row = wsk[(startW + i) % wsk.length];
    const sh = shuffleOptions(row[1], row[2], id + p * 5);
    items.push(Q(id++, row[0], sh.options, sh.answer, W, 1));
  }

  const passages = [
    {
      intro: "Read the passage:\n\nRivers have shaped human civilisation for thousands of years. Early settlements grew along river banks because water was available for drinking, farming and transport. Today, rivers still support cities, but pollution from factories and untreated sewage threatens fish and human health. Conserving rivers means reducing waste, treating wastewater and planting trees along banks to prevent soil erosion.",
      qs: [
        ["Early settlements often grew along rivers mainly because:", ["water supported drinking, farming and transport", "rivers had no fish", "there was no land elsewhere", "rivers blocked all travel"], 0],
        ["A modern threat to rivers mentioned is:", ["pollution from factories and untreated sewage", "too many trees only", "lack of sunlight in space", "excess gold mining on Moon"], 0],
        ["Conserving rivers includes:", ["treating wastewater and reducing waste", "dumping more plastic", "cutting all bank vegetation", "blocking all rainfall"], 0],
        ["Planting trees along banks helps to:", ["prevent soil erosion", "increase sewage", "stop photosynthesis forever", "remove all water"], 0],
        ["The passage is mainly about:", ["importance and conservation of rivers", "how to build factories only", "space travel", "desert animals only"], 0],
      ],
    },
    {
      intro: "Read the passage:\n\nLibraries are more than rooms full of books. They offer quiet spaces to study, access to digital resources and programmes that encourage reading among children. A library card lets members borrow materials for a limited time. Returning items promptly is a responsibility that keeps the collection available for everyone. In the digital age, libraries also teach information literacy so users can judge reliable sources.",
      qs: [
        ["Besides books, libraries may offer:", ["digital resources and reading programmes", "only loud concerts always", "car repairs", "weather control"], 0],
        ["A library card allows members to:", ["borrow materials for a limited time", "own the entire library", "never return anything", "print currency"], 0],
        ["Returning items on time:", ["keeps the collection available for everyone", "destroys books", "closes the library forever", "is unnecessary"], 0],
        ["Information literacy helps users:", ["judge reliable sources", "avoid all reading", "delete catalogues only", "ignore facts always"], 0],
        ["A suitable title could be:", ["Libraries in the Modern Age", "Ocean Currents", "Types of Rocks", "Cricket Rules Only"], 0],
      ],
    },
    {
      intro: "Read the passage:\n\nBees are vital pollinators. As they collect nectar, pollen sticks to their bodies and moves to other flowers. This process helps many plants form fruits and seeds. Habitat loss and excessive pesticide use endanger bee populations. Planting native flowers and reducing harmful chemicals are simple steps communities can take to protect bees and the food systems that depend on them.",
      qs: [
        ["Bees help plants mainly through:", ["pollination", "cutting all leaves", "blocking rain", "eating only roots"], 0],
        ["Pollen is transferred when bees:", ["collect nectar", "avoid flowers", "hibernate in oceans", "swim in rivers only"], 0],
        ["Threats to bees include:", ["habitat loss and excessive pesticides", "too much clean water only", "reading books", "using library cards"], 0],
        ["Communities can help bees by:", ["planting native flowers and reducing harmful chemicals", "removing all plants", "using more harmful sprays always", "covering soil with plastic only"], 0],
        ["The tone of the passage is:", ["informative and concerned", "purely humorous nonsense", "angry without facts", "advertising junk food"], 0],
      ],
    },
    {
      intro: "Read the passage:\n\nTime management is a skill students can practise daily. Making a short plan for homework, breaks and revision reduces last-minute stress. Prioritising difficult tasks when the mind is fresh often improves quality. Distractions can steal hours; setting a timer for focused work helps. Rest is not wasted time—sleep and exercise support memory and mood, making study more effective.",
      qs: [
        ["A short daily plan helps mainly to:", ["reduce last-minute stress", "avoid all learning", "increase chaos only", "skip sleep forever"], 0],
        ["Difficult tasks are often best done:", ["when the mind is fresh", "only at midnight when exhausted always", "never", "without any plan always"], 0],
        ["Setting a timer can help by:", ["supporting focused work", "deleting homework", "stopping all breaks forever", "replacing sleep"], 0],
        ["According to the passage, rest:", ["supports memory and mood", "is always wasted", "harms learning always", "replaces all study"], 0],
        ["The passage suggests time management is:", ["a skill that can be practised", "impossible for students", "only for athletes", "harmful"], 0],
      ],
    },
    {
      intro: "Read the passage:\n\nThe monsoon is crucial for Indian agriculture. Farmers depend on seasonal rains to grow crops such as rice. Too little rain can cause drought, while excess rain may lead to floods. Weather forecasts help communities prepare. Water harvesting and careful irrigation make farms more resilient when rainfall is uncertain. Understanding climate patterns is part of responsible environmental citizenship.",
      qs: [
        ["Monsoon rains are important in India mainly for:", ["agriculture", "space rockets only", "desert tourism only", "stopping all rivers"], 0],
        ["Too little rain may cause:", ["drought", "instant floods only", "snowfall in all deserts always", "no effect ever"], 0],
        ["Weather forecasts help people:", ["prepare for conditions", "control the Sun", "cancel gravity", "stop time"], 0],
        ["Water harvesting makes farms:", ["more resilient when rainfall is uncertain", "completely independent of soil", "unable to grow rice ever", "polluted always"], 0],
        ["The passage links climate understanding to:", ["responsible environmental citizenship", "ignoring farmers", "avoiding all science", "closing schools"], 0],
      ],
    },
  ];

  const pass = passages[(p - 1) % passages.length];
  for (let i = 0; i < 5; i++) {
    const row = pass.qs[i];
    const qtext = i === 0 ? `${pass.intro}\n\n${row[0]}` : row[0];
    const sh = shuffleOptions(row[1], row[2], id + p);
    items.push(Q(id++, qtext, sh.options, sh.answer, R, 1));
  }
  const pass2 = passages[p % passages.length];
  for (let i = 0; i < 5; i++) {
    const row = pass2.qs[i];
    const qtext = i === 0 ? `${pass2.intro}\n\n${row[0]}` : row[0];
    const sh = shuffleOptions(row[1], row[2], id + p * 2);
    items.push(Q(id++, qtext, sh.options, sh.answer, R, 1));
  }

  const swe = [
    ["Choose the most suitable reply: “Thank you for your help.” — “___”", ["You're welcome.", "I don't know you.", "Close the window.", "What is your age?"], 0],
    ["Best opening for a formal email to a principal:", ["Respected Sir/Madam,", "Hey buddy!", "Yo!", "What's up?"], 0],
    ["A school notice should mainly be:", ["Brief, clear and include key details (what, when, where)", "A long unrelated story only", "Written without date or venue", "Only emojis"], 0],
    ["Choose the polite request:", ["Could you please pass the book?", "Give book now!", "You must throw the book.", "Pass not."], 0],
    ["Suitable closing for a formal letter:", ["Yours faithfully,", "See ya!", "Bye bye friend forever only", "Laterz"], 0],
    ["In a debate, a good practice is to:", ["Listen to the other side and respond with reasons", "Shout without facts", "Interrupt constantly only", "Ignore the topic"], 0],
    ["Choose the best sentence for a diary entry about a science fair:", ["I felt proud when our model worked successfully.", "Science fair gravity delete.", "Diary not write.", "Model was model model."], 0],
    ["When leaving a voicemail for a teacher, you should:", ["State your name, class and purpose clearly", "Only breathe into the phone", "Sing loudly without details", "Hang up immediately always"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = swe[(i + p) % swe.length];
    const sh = shuffleOptions(row[1], row[2], id + p);
    items.push(Q(id++, row[0], sh.options, sh.answer, S, 1));
  }
  return items;
}


// ═══════════════════════════════════════════════════════════
// COMPUTER — Class 7
// ═══════════════════════════════════════════════════════════
function buildComputer(paperNo) {
  const p = paperNo;
  const items = [];
  let id = 1;
  const L = "Logical Reasoning";
  const C = "Computers and Information Technology";
  const A = "Achievers Section";

  items.push(Q(id++, "Find the next: 4, 8, 16, 32, __.", ["64", "48", "40", "36"], 0, L));
  items.push(Q(id++, "Odd one out: Keyboard, Mouse, Monitor, Compiler", ["Compiler", "Keyboard", "Mouse", "Monitor"], 0, L));
  items.push(Q(id++, "Analogy: CPU : Processing :: Monitor : ?", ["Display", "Printing only", "Cooling only", "Storing OS only"], 0, L));
  items.push(Q(id++, "If ‘Input’ is related to ‘Keyboard’, then ‘Output’ is related to:", ["Printer", "Mouse only as input", "Scanner only as input", "Microphone only as input"], 0, L));
  items.push(Q(id++, "Which does not belong: AND, OR, NOT, CPU fan dust", ["CPU fan dust", "AND", "OR", "NOT"], 0, L));
  items.push(Q(id++, "Series: 5, 10, 20, 40, __.", ["80", "60", "50", "45"], 0, L));
  items.push(Q(id++, "A is faster than B. C is slower than B. D is faster than A. Who is fastest?", ["D", "A", "B", "C"], 0, L));
  items.push(Q(id++, "If each letter is coded as its position (A=1,…), and CAT = 3+1+20=24, then BAD = ?", ["7", "6", "9", "8"], 0, L));
  items.push(Q(id++, "Odd one out: HTML, CSS, JavaScript, Wheat", ["Wheat", "HTML", "CSS", "JavaScript"], 0, L));
  items.push(Q(id++, "Mirror pattern: If 1 2 3 appears as 3 2 1 in a mirror line, then 4 5 6 appears as:", ["6 5 4", "4 5 6", "5 6 4", "6 4 5"], 0, L));

  const compBank = [
    ["The binary number system uses digits:", ["0 and 1", "0 to 9", "A to F only", "1 to 7 only"], 0],
    ["Decimal number 5 in binary is:", ["101", "100", "111", "110"], 0],
    ["1 byte equals:", ["8 bits", "2 bits", "16 bits always only", "4 bits"], 0],
    ["The brain of the computer is the:", ["CPU", "Monitor", "Keyboard", "Speaker"], 0],
    ["RAM is a type of:", ["Volatile memory", "Permanent ink", "Output device only", "Network cable"], 0],
    ["ROM typically stores:", ["Firmware/boot instructions", "Only temporary user documents always", "Only videos you edit today", "Only printer paper"], 0],
    ["An operating system is:", ["System software that manages hardware and software", "A hardware chip only", "A printer brand only", "A type of virus"], 0],
    ["Which is an operating system?", ["Linux", "MS Word", "Chrome browser only", "Intel CPU"], 0],
    ["In MS Word, Ctrl + B is commonly used to:", ["Bold text", "Save as PDF only", "Insert a table only", "Turn off the PC"], 0],
    ["In a spreadsheet, the intersection of a row and a column is a:", ["Cell", "Workbench", "Router", "Pixel printer"], 0],
    ["A formula in Excel usually begins with:", ["=", "#", "@", "& only"], 0],
    ["In PowerPoint, slides are used to:", ["Present information visually", "Cool the CPU", "Replace the OS kernel", "Generate electricity"], 0],
    ["The Internet is:", ["A global network of networks", "A single home PC only", "Only a keyboard", "A type of printer"], 0],
    ["A web browser is used to:", ["Access websites", "Print only without computer", "Cook food", "Replace the CPU fan"], 0],
    ["An email address typically contains:", ["@", "# only", "spaces only", "only digits without domain"], 0],
    ["Cyber safety includes:", ["Not sharing passwords and being careful with links", "Sharing OTP with strangers", "Downloading any attachment blindly", "Using the same weak password everywhere"], 0],
    ["A strong password should be:", ["Long and hard to guess, mixing character types", "Your name only", "12345 only", "blank"], 0],
    ["Phishing is an attempt to:", ["Trick users into revealing sensitive information", "Speed up the CPU legally", "Clean the monitor", "Charge the battery faster"], 0],
    ["HTML is mainly used to:", ["Structure content on web pages", "Cool laptops", "Replace electricity", "Grow plants"], 0],
    ["A common HTML tag for a paragraph is:", ["<p>", "<img> only", "<br> only for images", "<table> only for sound"], 0],
    ["In coding logic, a loop is used to:", ["Repeat a set of instructions", "Delete the OS", "Stop all input forever", "Print only once never again"], 0],
    ["An algorithm is:", ["A step-by-step method to solve a problem", "A hardware port", "A virus type only", "A monitor brand"], 0],
    ["Which is an input device?", ["Scanner", "Speaker", "Monitor", "Projector"], 0],
    ["Which is an output device?", ["Printer", "Keyboard", "Mouse", "Microphone"], 0],
    ["SSD compared to traditional HDD often provides:", ["Faster data access", "Only slower access always", "No storage", "Only paper output"], 0],
    ["Cloud storage means:", ["Storing data on remote servers accessed via internet", "Storing data only on paper clouds", "Deleting all backups", "Printing to sky"], 0],
    ["A firewall helps to:", ["Filter network traffic for security", "Increase room temperature", "Replace antivirus always completely alone without need", "Charge phones wirelessly by magic only"], 0],
    ["Software that harms a system intentionally is often called:", ["Malware", "Freeware always safe", "Compiler", "Spreadsheet"], 0],
    ["Backup means:", ["Keeping copies of important data", "Deleting all files", "Formatting without copy", "Unplugging forever"], 0],
    ["In binary, 10 represents decimal:", ["2", "10", "3", "1"], 0],
    ["The full form of IP in networking is commonly:", ["Internet Protocol", "Internal Printer", "Input Password", "Instant Processing only"], 0],
    ["URL stands for:", ["Uniform Resource Locator", "Universal Random List", "User Real Login", "Unique ROM Link"], 0],
    ["A file extension .xlsx is commonly associated with:", ["Excel workbook", "Word only", "PowerPoint only", "Image only"], 0],
    ["Copy and paste shortcuts are commonly:", ["Ctrl+C and Ctrl+V", "Ctrl+Z and Ctrl+Y only", "Alt+F4 only", "Shift+Delete only"], 0],
    ["In presentations, excessive animations can:", ["Distract the audience", "Cool the CPU always", "Replace content quality always positively", "Increase RAM permanently"], 0],
    ["Which device connects a LAN to a wider network often at home?", ["Router", "Monitor", "Joystick only", "Webcam only"], 0],
    ["Two-factor authentication adds security by requiring:", ["An extra verification step beyond password", "No password ever", "Sharing OTP publicly", "Disabling all updates"], 0],
    ["Open-source software typically allows:", ["Access to source code under a license", "No installation ever", "Only offline paper use", "Mandatory payment to one vendor always"], 0],
    ["In Scratch-like block coding, ‘repeat 10’ is an example of:", ["A loop", "A virus", "Hardware failure", "A printer jam"], 0],
    ["Cache memory is:", ["Very fast memory close to the CPU", "Slowest storage always", "Only cloud backup", "A type of printer ink"], 0],
  ];

  const startC = (p - 1) * 3;
  for (let i = 0; i < 35; i++) {
    const row = compBank[(startC + i) % compBank.length];
    const sh = shuffleOptions(row[1], row[2], id + p);
    items.push(Q(id++, row[0], sh.options, sh.answer, C, 1));
  }

  const achC = [
    ["You save a project only in RAM and power off the PC without saving to disk. What happens to the project?", ["It is lost because RAM is volatile", "It is permanently stored in ROM", "It prints automatically", "It emails itself"], 0],
    ["Which arrangement is correct from typically fastest/smallest toward larger permanent store?", ["Cache → RAM → SSD/HDD", "HDD → Cache → RAM only reverse always wrong", "Printer → Scanner → CPU", "Monitor → Keyboard → Mouse"], 0],
    ["You receive an email asking for your school login password to ‘verify account’. You should:", ["Not share the password; verify via official channels", "Reply with the password immediately", "Post password on social media", "Change nothing and ignore security forever"], 0],
    ["Convert decimal 13 to binary:", ["1101", "1011", "1110", "1001"], 0],
    ["In a spreadsheet, cell A1 has 10, B1 has 20. Formula =A1+B1 in C1 shows:", ["30", "1020", "A1B1", "Error always"], 0],
    ["Why is a network password on home Wi-Fi important?", ["It helps prevent unauthorised users from using the network", "It increases the room temperature", "It replaces antivirus completely always", "It makes cables unnecessary for electricity"], 0],
    ["HTML <img> tag is primarily used to:", ["Embed an image in a web page", "Create a spreadsheet formula", "Compile a program", "Format a hard disk"], 0],
    ["An algorithm to find the largest of three numbers must:", ["Compare the numbers using clear steps", "Ignore two numbers always", "Only print the smallest always", "Require no logic"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = achC[(i + p) % achC.length];
    const sh = shuffleOptions(row[1], row[2], id + p * 3);
    items.push(Q(id++, row[0], sh.options, sh.answer, A, 3));
  }
  return items;
}


// ═══════════════════════════════════════════════════════════
// GK — Class 7
// ═══════════════════════════════════════════════════════════
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
    ["The longest river in India is the:", ["Ganga (Ganges)", "Yamuna", "Godavari only shorter discussion", "Narmada only"], 0],
    ["The Himalayas are located in the:", ["North of India", "South of India only", "Centre of Australia", "West of Brazil only"], 0],
    ["The Indian Constitution came into effect on:", ["26 January 1950", "15 August 1947", "2 October 1869", "14 November 1889"], 0],
    ["The President of India is elected by an:", ["Electoral college", "Single village panchayat only", "Foreign parliament only", "Sports committee only"], 0],
    ["The lower house of the Indian Parliament is the:", ["Lok Sabha", "Rajya Sabha", "Supreme Court", "Vidhan Parishad only all states"], 0],
    ["Fundamental Rights in India are guaranteed by the:", ["Constitution", "Only municipal rules", "Only school diaries", "Only company policies"], 0],
    ["Mahatma Gandhi is known as the:", ["Father of the Nation (India)", "First President of USA", "Discoverer of gravity only", "Inventor of the telephone"], 0],
    ["The first Prime Minister of independent India was:", ["Jawaharlal Nehru", "Sardar only as PM", "Dr. APJ Abdul Kalam as PM", "Bhagat Singh as PM"], 0],
    ["The Quit India Movement began in:", ["1942", "1857", "1919 only Jallianwala focus", "2000"], 0],
    ["The largest desert in India is the:", ["Thar Desert", "Sahara", "Gobi", "Atacama"], 0],
    ["Which planet is known as the Red Planet?", ["Mars", "Venus", "Jupiter", "Saturn"], 0],
    ["Among nearby stars, the closest known star system to the Sun includes:", ["Proxima Centauri", "The Moon as a star", "Venus as a star", "Polaris as nearest always"], 0],
    ["The currency of Japan is the:", ["Yen", "Yuan", "Won", "Dollar"], 0],
    ["The United Nations headquarters is in:", ["New York", "Geneva only main HQ wrong", "Paris only", "New Delhi"], 0],
    ["Olympic Games are held every:", ["4 years", "1 year", "10 years", "6 months"], 0],
    ["A marathon race is approximately:", ["42.195 km", "100 m only", "1 km only", "26 m only"], 0],
    ["The inventor associated with the telephone is:", ["Alexander Graham Bell", "Newton only gravity", "Einstein only relativity", "Wright only flight exclusive"], 0],
    ["Photosynthesis mainly occurs in:", ["Leaves (chloroplasts)", "Only bones", "Only metal wires", "Only plastic"], 0],
    ["The hardest natural substance is:", ["Diamond", "Gold", "Silver", "Iron"], 0],
    ["Which gas do plants absorb for photosynthesis?", ["Carbon dioxide", "Nitrogen only exclusive", "Helium", "Neon"], 0],
    ["The largest ocean on Earth is the:", ["Pacific Ocean", "Indian Ocean", "Arctic Ocean", "Atlantic is largest wrong"], 0],
    ["Mount Everest lies in the:", ["Himalayas", "Alps", "Andes only", "Rockies only"], 0],
    ["The Sahara Desert is in:", ["Africa", "Australia only", "Europe only", "Antarctica only"], 0],
    ["Who wrote the national anthem of India?", ["Rabindranath Tagore", "Bankim Chandra only Vande Mataram", "Sarojini Naidu only", "Premchand only"], 0],
    ["The study of coins is called:", ["Numismatics", "Philately", "Ornithology", "Astronomy"], 0],
    ["The instrument used to measure temperature is a:", ["Thermometer", "Barometer", "Ammeter", "Speedometer"], 0],
    ["Which vitamin is mainly produced in skin on sunlight exposure?", ["Vitamin D", "Vitamin C only", "Vitamin K only exclusive", "Vitamin B12 only exclusive"], 0],
    ["The Supreme Court of India is located in:", ["New Delhi", "Mumbai", "Chennai", "Kolkata"], 0],
    ["Which is a classical dance of Tamil Nadu?", ["Bharatanatyam", "Kathak only North", "Manipuri only", "Mohiniyattam only Kerala exclusive"], 0],
    ["The Green Revolution in India is associated mainly with:", ["Agriculture / food grain production", "Only IT software", "Only space missions", "Only cricket"], 0],
    ["Which blood group is called a universal donor (red cells, classic teaching)?", ["O negative (commonly taught)", "AB positive only as donor classic wrong", "AB only", "B only always"], 0],
    ["The polar satellite launch vehicle of ISRO is known as:", ["PSLV", "Metro rail", "Bullet train", "Himalayan pass"], 0],
  ];

  const startG = (p - 1) * 2;
  for (let i = 0; i < 30; i++) {
    const row = gaBank[(startG + i) % gaBank.length];
    const sh = shuffleOptions(row[1], row[2], id + p);
    items.push(Q(id++, row[0], sh.options, sh.answer, GA, 1));
  }

  const caBank = [
    ["India’s Republic Day is celebrated on:", ["26 January", "15 August", "2 October", "14 November"], 0],
    ["World Environment Day is observed on:", ["5 June", "1 January", "25 December", "15 August"], 0],
    ["International Yoga Day is celebrated on:", ["21 June", "1 May", "2 October", "26 January"], 0],
    ["The G20 is a forum of major:", ["Economies", "Only football clubs", "Only film studios", "Only deserts"], 0],
    ["ISRO is the space agency of:", ["India", "USA only", "Russia only", "Japan only"], 0],
    ["The headquarters of the WHO is in:", ["Geneva", "New Delhi only", "Tokyo only", "Cairo only"], 0],
    ["Sustainable Development Goals (SDGs) were adopted by the:", ["United Nations", "Only one school board", "A single company", "A sports club"], 0],
    ["Aadhaar in India is related to:", ["Unique identity number", "A type of crop only", "A dance form only", "A river only"], 0],
    ["The Indian Super League is associated with:", ["Football", "Chess only", "Wrestling only exclusive", "Swimming only exclusive"], 0],
    ["UNESCO is mainly concerned with:", ["Education, science and culture", "Only military tanks", "Only currency printing", "Only cricket umpiring"], 0],
    ["Earth Day is observed on:", ["22 April", "1 April", "31 October", "25 December"], 0],
    ["The Nobel Prizes are associated with contributions in fields such as:", ["Peace, literature, sciences, etc.", "Only local school tests", "Only one sport", "Only cooking shows"], 0],
  ];
  for (let i = 0; i < 10; i++) {
    const row = caBank[(i + p) % caBank.length];
    const sh = shuffleOptions(row[1], row[2], id + p * 2);
    items.push(Q(id++, row[0], sh.options, sh.answer, CA, 1));
  }

  const lsBank = [
    ["If you disagree with a classmate, a good approach is to:", ["Listen and respond respectfully with reasons", "Insult them", "Shout louder only", "Spread rumours"], 0],
    ["When you make a mistake, a healthy habit is to:", ["Accept it and try to improve", "Blame everyone else always", "Hide forever without learning", "Quit all effort"], 0],
    ["Cyberbullying should be handled by:", ["Telling a trusted adult and not retaliating with hate", "Posting insults back only", "Sharing personal data more", "Ignoring safety forever"], 0],
    ["Teamwork is effective when members:", ["Share tasks and communicate clearly", "Hide information always", "Work against each other only", "Avoid all planning"], 0],
    ["Managing exam stress can include:", ["Planning study time and taking short breaks", "Skipping all sleep", "Only cramming without rest", "Avoiding all questions forever"], 0],
    ["Empathy means:", ["Understanding others’ feelings", "Ignoring everyone", "Only thinking of yourself", "Mocking others’ problems"], 0],
    ["A responsible digital citizen should:", ["Respect others online and think before posting", "Forward every rumour", "Use rude language freely", "Share friends’ private info"], 0],
    ["When someone is injured at school, you should:", ["Seek help from a teacher/adult immediately", "Film only for fun", "Leave them alone always", "Give unknown medicines yourself casually"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = lsBank[(i + p) % lsBank.length];
    const sh = shuffleOptions(row[1], row[2], id + p);
    items.push(Q(id++, row[0], sh.options, sh.answer, LS, 1));
  }

  const achG = [
    ["Which sequence correctly orders these Indian national symbols: animal, bird, flower?", ["Tiger, Peacock, Lotus", "Lion, Sparrow, Rose only exclusive set", "Elephant, Crow, Sunflower only", "Tiger, Parrot, Lily only"], 0],
    ["The Directive Principles of State Policy in the Indian Constitution are:", ["Guidelines for the state to promote social and economic welfare", "Enforceable fundamental rights identical in court always the same way", "Rules only for foreign tourists", "Sports regulations only"], 0],
    ["Which statement about the solar system is correct?", ["Planets orbit the Sun", "The Sun orbits the Earth daily as modern science model", "Mars is a star", "The Moon is a galaxy"], 0],
    ["A citizen can contribute to democracy by:", ["Staying informed and participating responsibly (e.g. when eligible, voting)", "Spreading unchecked rumours only", "Avoiding all civic duties always", "Disrespecting laws as a hobby"], 0],
    ["Which is a renewable source of energy?", ["Solar energy", "Coal only", "Petroleum only", "Natural gas only exclusive non-renewable set"], 0],
    ["The Tropic of Cancer passes through:", ["India (among other countries)", "Only Antarctica", "Only Arctic Ocean exclusive", "Only Australia exclusive always"], 0],
    ["Which organ system transports oxygen in the human body?", ["Circulatory system", "Only skeletal system exclusive", "Only digestive system exclusive", "Only integumentary hair only"], 0],
    ["Global cooperation on climate change is important because:", ["Greenhouse gas effects cross national borders", "Weather is only local forever with no shared atmosphere", "Oceans are unrelated to climate", "Energy use has no environmental impact"], 0],
  ];
  for (let i = 0; i < 5; i++) {
    const row = achG[(i + p) % achG.length];
    const sh = shuffleOptions(row[1], row[2], id + p * 4);
    items.push(Q(id++, row[0], sh.options, sh.answer, A, 3));
  }
  return items;
}

function validate(subject, items, expectQ, expectMarks) {
  if (items.length !== expectQ) {
    throw new Error(`${subject}: expected ${expectQ} questions, got ${items.length}`);
  }
  const marks = items.reduce((s, q) => s + q.marks, 0);
  if (marks !== expectMarks) {
    throw new Error(`${subject}: expected ${expectMarks} marks, got ${marks}`);
  }
  for (const q of items) {
    if (!q.options || q.options.length !== 4) {
      throw new Error(`${subject} Q${q.id}: need 4 options`);
    }
    if (q.answer < 0 || q.answer > 3) {
      throw new Error(`${subject} Q${q.id}: bad answer index ${q.answer}`);
    }
    if (new Set(q.options.map(String)).size !== 4) {
      throw new Error(`${subject} Q${q.id}: duplicate options ${JSON.stringify(q.options)}`);
    }
  }
}

function main() {
  const specs = [
    {
      subject: "mathematics",
      build: buildMath,
      totalMarks: 50,
      expectQ: 40,
      patternNote:
        "Original practice paper aligned to SOF 2023–2025 pattern & syllabus. Not an official SOF paper. IMO Class 7 pattern: Logical Reasoning 15×1 + Mathematical Reasoning 20×1 + Achievers 5×3 = 40 Q / 50 marks",
    },
    {
      subject: "science",
      build: buildScience,
      totalMarks: 60,
      expectQ: 50,
      patternNote:
        "Original practice paper aligned to SOF 2023–2025 pattern & syllabus. Not an official SOF paper. NSO Class 7 pattern: Logical Reasoning 10×1 + Science 35×1 + Achievers 5×3 = 50 Q / 60 marks",
    },
    {
      subject: "english",
      build: buildEnglish,
      totalMarks: 60,
      expectQ: 60,
      patternNote:
        "Original practice paper aligned to SOF 2023–2025 pattern & syllabus. Not an official SOF paper. IEO Class 7 pattern: Word & Structure Knowledge 45×1 + Reading 10×1 + Spoken & Written Expression 5×1 = 60 Q / 60 marks",
    },
    {
      subject: "computer",
      build: buildComputer,
      totalMarks: 60,
      expectQ: 50,
      patternNote:
        "Original practice paper aligned to SOF 2023–2025 pattern & syllabus. Not an official SOF paper. ICSO Class 7 pattern: Logical Reasoning 10×1 + Computers 35×1 + Achievers 5×3 = 50 Q / 60 marks",
    },
    {
      subject: "gk",
      build: buildGK,
      totalMarks: 60,
      expectQ: 50,
      patternNote:
        "Original practice paper aligned to SOF 2023–2025 pattern & syllabus. Not an official SOF paper. IGKO Class 7 pattern: General Awareness 30×1 + Current Affairs 10×1 + Life Skills 5×1 + Achievers 5×3 = 50 Q / 60 marks",
    },
  ];

  for (const spec of specs) {
    for (let p = 1; p <= PAPERS; p++) {
      const items = spec.build(p);
      validate(spec.subject, items, spec.expectQ, spec.totalMarks);
      writePaper(spec.subject, p, items, spec.totalMarks, spec.patternNote);
      console.log(
        `OK class7/${spec.subject} paper${p}: ${items.length}Q, ${spec.totalMarks} marks`
      );
    }
  }

  console.log("\nAll Class 7 SOF-pattern papers generated successfully.");
}

main();

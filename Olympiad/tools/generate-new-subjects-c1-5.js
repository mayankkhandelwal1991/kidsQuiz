#!/usr/bin/env node
/* ------------------------------------------------------------------
   Generates Olympiad papers for the three newer subjects, Class 1–5:
     • Social Studies  — from tools/banks/socialstudies.txt
     • Creative Arts   — from tools/banks/creativearts.txt
     • Reasoning       — generated (number/letter series, odd one out,
                         analogies, coding, directions, ranking, …)

   Output (same schema as every other subject):
     data/classN/<subject>/questions/paperP.json
     data/classN/<subject>/answers/paperP.json

   Each paper: 15 questions × 1 mark + 5 "Achievers" × 2 marks
   = 20 questions / 25 marks, 25 minutes.

   Re-run any time (deterministic — same output every run):
     node Olympiad/tools/generate-new-subjects-c1-5.js
   To change questions, edit the bank .txt files and re-run.
   ------------------------------------------------------------------ */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const CLASSES = [1, 2, 3, 4, 5];
const PAPERS = 5;
const NORMAL_Q = 15;
const ACHIEVER_Q = 5;
const DURATION = 25;

/* ---------- seeded random ---------- */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function makeRng(seedStr) {
  let a = hashStr(seedStr);
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function sample(rng, arr, n) { return shuffle(rng, arr).slice(0, n); }

/* ---------- bank parsing ---------- */
function loadBank(file) {
  const out = {};
  let cls = null, sec = "normal";
  for (const raw of fs.readFileSync(path.join(__dirname, "banks", file), "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || (line.startsWith("#") && !line.startsWith("##"))) continue;
    let m;
    if ((m = line.match(/^##\s*class(\d+)$/))) { cls = +m[1]; sec = "normal"; out[cls] = { normal: [], achievers: [] }; continue; }
    if (/^###\s*achievers$/.test(line)) { sec = "achievers"; continue; }
    const parts = line.split("|").map((x) => x.trim());
    if (parts.length !== 5) throw new Error(`${file}: need 5 parts: ${line}`);
    if (new Set(parts.slice(1)).size !== 4) throw new Error(`${file}: duplicate option: ${line}`);
    out[cls][sec].push({ q: parts[0], a: parts[1], w: parts.slice(2) });
  }
  return out;
}

/* Paper p takes a contiguous cyclic window of the class bank, so a
   question never repeats inside one paper and every question is used. */
function windowPick(list, p, count) {
  const step = Math.max(1, Math.floor((list.length - count) / (PAPERS - 1)) || Math.ceil(list.length / PAPERS));
  const out = [];
  for (let j = 0; j < count; j++) out.push(list[(p * step + j) % list.length]);
  return out;
}

/* ================= REASONING GENERATORS =================
   Each returns { q, a, w:[3 wrong] } (strings). L = difficulty 1..6. */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const L = (i) => LETTERS[((i % 26) + 26) % 26];
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");

function numWrongs(rng, ans, spread) {
  const set = new Set();
  let guard = 0;
  while (set.size < 3 && guard++ < 100) {
    const d = ri(rng, 1, spread) * (rng() < 0.5 ? -1 : 1);
    const v = ans + d;
    if (v >= 0 && v !== ans) set.add(v);
  }
  let k = 1;
  while (set.size < 3) { if (ans + spread + k !== ans) set.add(ans + spread + k); k++; }
  return [...set].map(String);
}
function letterWrongs(rng, ansIdx) {
  const set = new Set();
  for (const d of shuffle(rng, [-2, -1, 1, 2, 3, -3])) { if (set.size < 3) set.add(L(ansIdx + d)); }
  return [...set];
}

function genNumberSeries(rng, lvl) {
  let terms = [], next;
  if (lvl <= 1) {
    const s = ri(rng, 1, 15), d = pick(rng, [1, 2]);
    for (let i = 0; i < 4; i++) terms.push(s + i * d); next = s + 4 * d;
  } else if (lvl === 2) {
    const s = ri(rng, 2, 30), d = pick(rng, [2, 3, 5, 10]), up = rng() < 0.7;
    const start = up ? s : s + 5 * d;
    for (let i = 0; i < 4; i++) terms.push(start + (up ? 1 : -1) * i * d); next = start + (up ? 1 : -1) * 4 * d;
  } else if (lvl === 3) {
    if (rng() < 0.5) { const s = ri(rng, 1, 5); for (let i = 0; i < 4; i++) terms.push(s * 2 ** i); next = s * 16; }
    else { const s = ri(rng, 5, 40), d = pick(rng, [4, 6, 7, 9, 11]); for (let i = 0; i < 4; i++) terms.push(s + i * d); next = s + 4 * d; }
  } else if (lvl === 4) {
    const s = ri(rng, 1, 20), d0 = ri(rng, 1, 3); let v = s;
    for (let i = 0; i < 5; i++) { terms.push(v); v += d0 + i; } next = v; terms = terms.slice(0, 5);
  } else {
    const kind = ri(rng, 0, 2);
    if (kind === 0) { const s = ri(rng, 1, 4); for (let i = 0; i < 5; i++) terms.push((s + i) ** 2); next = (s + 5) ** 2; }
    else if (kind === 1) { const s = ri(rng, 1, 3); for (let i = 0; i < 4; i++) terms.push(s * 3 ** i); next = s * 81; }
    else { let v = ri(rng, 2, 6); for (let i = 0; i < 5; i++) { terms.push(v); v = v * 2 + 1; } next = v; }
  }
  return { q: `What comes next? ${terms.join(", ")}, ?`, a: String(next), w: numWrongs(rng, next, Math.max(2, Math.round(next * 0.15))) };
}

function genLetterSeries(rng, lvl) {
  let terms = [], nextIdx, ans;
  if (lvl <= 1) { const s = ri(rng, 0, 20); for (let i = 0; i < 4; i++) terms.push(L(s + i)); nextIdx = s + 4; }
  else if (lvl === 2) { const s = ri(rng, 0, 16), d = 2; for (let i = 0; i < 4; i++) terms.push(L(s + i * d)); nextIdx = s + 4 * d; }
  else if (lvl === 3) {
    if (rng() < 0.5) { const s = ri(rng, 0, 12), d = 3; for (let i = 0; i < 4; i++) terms.push(L(s + i * d)); nextIdx = s + 4 * d; }
    else { const s = ri(rng, 8, 25); for (let i = 0; i < 4; i++) terms.push(L(s - i)); nextIdx = s - 4; }
  } else if (lvl === 4) {
    const s = ri(rng, 0, 14);
    for (let i = 0; i < 4; i++) terms.push(L(s + 2 * i) + L(s + 2 * i + 1));
    ans = L(s + 8) + L(s + 9);
    const w = [L(s + 9) + L(s + 10), L(s + 8) + L(s + 10), L(s + 7) + L(s + 8)];
    return { q: `What comes next? ${terms.join(", ")}, ?`, a: ans, w };
  } else {
    const s = ri(rng, 0, 8);
    for (let i = 0; i < 4; i++) terms.push(L(s + i) + L(25 - s - i));
    ans = L(s + 4) + L(21 - s);
    const w = [L(s + 4) + L(22 - s), L(s + 5) + L(21 - s), L(21 - s) + L(s + 4)];
    return { q: `What comes next? ${terms.join(", ")}, ?`, a: ans, w };
  }
  return { q: `Which letter comes next? ${terms.join(", ")}, ?`, a: L(nextIdx), w: letterWrongs(rng, nextIdx) };
}

const GROUPS = {
  fruits: ["Apple", "Mango", "Banana", "Grapes", "Orange", "Papaya", "Guava", "Pineapple"],
  vegetables: ["Potato", "Carrot", "Onion", "Brinjal", "Cabbage", "Spinach", "Peas", "Radish"],
  animals: ["Lion", "Tiger", "Elephant", "Bear", "Deer", "Zebra", "Giraffe", "Fox"],
  birds: ["Parrot", "Crow", "Sparrow", "Pigeon", "Eagle", "Peacock", "Owl", "Kingfisher"],
  colours: ["Red", "Blue", "Green", "Yellow", "Pink", "Purple", "Orange", "Black"],
  vehicles: ["Car", "Bus", "Truck", "Scooter", "Train", "Bicycle", "Auto-rickshaw", "Tractor"],
  bodyParts: ["Hand", "Leg", "Nose", "Ear", "Eye", "Knee", "Elbow", "Finger"],
  furniture: ["Chair", "Table", "Bed", "Sofa", "Cupboard", "Stool", "Bench", "Desk"],
  instruments: ["Guitar", "Flute", "Drum", "Sitar", "Violin", "Tabla", "Piano", "Harmonium"],
  planets: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"],
  sports: ["Cricket", "Football", "Hockey", "Tennis", "Badminton", "Kabaddi", "Volleyball", "Chess"],
  waterAnimals: ["Fish", "Whale", "Dolphin", "Octopus", "Shark", "Crab", "Starfish", "Jellyfish"],
};
const OOO_PAIRS = [
  ["fruits", "vegetables"], ["animals", "birds"], ["colours", "fruits"], ["vehicles", "furniture"],
  ["bodyParts", "colours"], ["birds", "waterAnimals"], ["instruments", "sports"], ["planets", "colours"],
  ["furniture", "instruments"], ["sports", "vehicles"], ["vegetables", "animals"], ["waterAnimals", "animals"],
];
function genOddOneOut(rng, lvl) {
  if (lvl >= 3 && rng() < 0.4) {
    // numbers
    const kind = lvl >= 5 ? ri(rng, 0, 2) : ri(rng, 0, 1);
    let same, odd;
    if (kind === 0) { // even vs odd
      const evens = sample(rng, [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34], 3);
      odd = String(pick(rng, [15, 17, 19, 21, 23, 25, 27])); same = evens.map(String);
    } else if (kind === 1) { // multiples of 5
      same = sample(rng, [15, 25, 35, 40, 45, 55, 60, 70], 3).map(String);
      odd = String(pick(rng, [22, 33, 38, 41, 47, 52]));
    } else { // primes vs composite
      same = sample(rng, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29], 3).map(String);
      odd = String(pick(rng, [9, 15, 21, 25, 27, 33]));
    }
    return { q: "Find the odd one out:", a: odd, w: same, keepOrder: false };
  }
  const pairs = lvl <= 2 ? OOO_PAIRS.slice(0, 7) : OOO_PAIRS;
  const [g, o] = pick(rng, pairs);
  const same = sample(rng, GROUPS[g], 3);
  const odd = pick(rng, GROUPS[o].filter((x) => !same.includes(x)));
  return { q: "Find the odd one out:", a: odd, w: same };
}

const ANALOGIES = {
  1: [ // animal:baby, opposites, animal:sound
    ["Cow", "Calf", "Dog", "Puppy", ["Kitten", "Cub", "Lamb"]],
    ["Cat", "Kitten", "Hen", "Chick", ["Puppy", "Calf", "Cub"]],
    ["Big", "Small", "Hot", "Cold", ["Warm", "Wet", "Sunny"]],
    ["Up", "Down", "In", "Out", ["On", "Under", "Into"]],
    ["Day", "Night", "Black", "White", ["Grey", "Dark", "Blue"]],
    ["Dog", "Bark", "Cat", "Meow", ["Moo", "Roar", "Hiss"]],
    ["Eye", "See", "Ear", "Hear", ["Smell", "Taste", "Touch"]],
    ["Fish", "Water", "Bird", "Air", ["Land", "Tree", "Nest"]],
  ],
  2: [ // home, worker:place, tool
    ["Bird", "Nest", "Bee", "Hive", ["Den", "Kennel", "Stable"]],
    ["Lion", "Den", "Horse", "Stable", ["Hive", "Nest", "Burrow"]],
    ["Doctor", "Hospital", "Teacher", "School", ["Bank", "Farm", "Court"]],
    ["Farmer", "Field", "Pilot", "Aeroplane", ["Ship", "Train", "Bus"]],
    ["Pen", "Write", "Knife", "Cut", ["Eat", "Draw", "Cook"]],
    ["Tailor", "Needle", "Carpenter", "Saw", ["Scissors", "Brush", "Spade"]],
    ["Shoe", "Foot", "Glove", "Hand", ["Head", "Leg", "Neck"]],
    ["Hungry", "Eat", "Thirsty", "Drink", ["Sleep", "Run", "Cry"]],
  ],
  3: [
    ["India", "New Delhi", "Japan", "Tokyo", ["Beijing", "Seoul", "Bangkok"]],
    ["Ear", "Hear", "Nose", "Smell", ["See", "Taste", "Touch"]],
    ["Petal", "Flower", "Page", "Book", ["Pen", "Paper", "Library"]],
    ["Week", "Days", "Year", "Months", ["Hours", "Weeks", "Minutes"]],
    ["Water", "Thirst", "Food", "Hunger", ["Sleep", "Taste", "Plate"]],
    ["Cricket", "Bat", "Tennis", "Racket", ["Stick", "Club", "Net"]],
    ["Paper", "Tree", "Glass", "Sand", ["Water", "Plastic", "Stone"]],
    ["Painter", "Brush", "Writer", "Pen", ["Book", "Paper", "Ink"]],
  ],
  4: [
    ["Square", "4", "Triangle", "3", ["2", "4", "5"]],
    ["Hexagon", "6", "Pentagon", "5", ["4", "6", "8"]],
    ["Kilogram", "Weight", "Litre", "Volume", ["Length", "Time", "Speed"]],
    ["Thermometer", "Temperature", "Clock", "Time", ["Weight", "Speed", "Length"]],
    ["Pilot", "Cockpit", "Driver", "Driving seat", ["Cabin", "Runway", "Garage"]],
    ["Lion", "Carnivore", "Cow", "Herbivore", ["Omnivore", "Carnivore", "Insectivore"]],
    ["Poet", "Poem", "Sculptor", "Statue", ["Painting", "Song", "Novel"]],
    ["Mumbai", "Maharashtra", "Jaipur", "Rajasthan", ["Gujarat", "Punjab", "Bihar"]],
  ],
  5: [
    ["3", "9", "5", "25", ["15", "20", "10"]],
    ["4", "16", "7", "49", ["14", "42", "21"]],
    ["2", "8", "3", "27", ["9", "18", "24"]],
    ["Ornithology", "Birds", "Botany", "Plants", ["Animals", "Rocks", "Stars"]],
    ["Seismograph", "Earthquakes", "Barometer", "Air pressure", ["Temperature", "Rainfall", "Wind speed"]],
    ["Cobbler", "Shoes", "Blacksmith", "Iron tools", ["Wooden toys", "Clothes", "Pots"]],
    ["Aquatic", "Water", "Terrestrial", "Land", ["Air", "Trees", "Desert"]],
    ["Century", "100", "Decade", "10", ["1000", "12", "5"]],
  ],
};
function genAnalogy(rng, lvl) {
  const pool = [];
  for (let k = 1; k <= Math.min(5, lvl); k++) if (k >= lvl - 1) pool.push(...ANALOGIES[k]);
  const [a, b, c, d, w] = pick(rng, pool);
  return { q: `${a} : ${b} :: ${c} : ?`, a: d, w: w.slice() };
}

function genAlphabetPos(rng, lvl) {
  if (lvl <= 2) {
    const n = ri(rng, 1, 15);
    return { q: `Which is the ${ordinal(n)} letter of the English alphabet?`, a: L(n - 1), w: letterWrongs(rng, n - 1) };
  }
  if (lvl === 3) {
    const n = ri(rng, 2, 9);
    return { q: `Which letter is ${ordinal(n)} from the end (right) of the English alphabet?`, a: L(26 - n), w: letterWrongs(rng, 26 - n) };
  }
  const s = ri(rng, 3, 14), k = ri(rng, 3, 8), right = rng() < 0.6;
  const idx = right ? s + k : s - k;
  if (idx < 0 || idx > 25) return genAlphabetPos(rng, 3);
  return { q: `Which letter is ${ordinal(k)} to the ${right ? "right" : "left"} of ${L(s)} in the English alphabet?`, a: L(idx), w: letterWrongs(rng, idx) };
}

const CODE_WORDS = ["CAT", "DOG", "SUN", "PEN", "BAG", "CUP", "HAT", "BOX", "MAP", "RAT", "BUS", "TOP", "FAN", "JAM", "NET", "LEG", "BED", "COW", "PIG", "INK"];
const CODE_WORDS4 = ["BOOK", "FISH", "TREE", "STAR", "MILK", "FROG", "KITE", "LAMP", "DESK", "SHIP", "BELL", "COIN"];
const enc = (w, k) => w.split("").map((ch) => L(LETTERS.indexOf(ch) + k)).join("");
function genCoding(rng, lvl) {
  const words = lvl >= 5 ? CODE_WORDS4 : CODE_WORDS;
  const [w1, w2] = sample(rng, words, 2);
  const k = lvl <= 3 ? 1 : lvl === 4 ? pick(rng, [1, 2]) : pick(rng, [2, -1]);
  const ans = enc(w2, k);
  const wr = new Set([enc(w2, k + 1), enc(w2, k - 1 === 0 ? -1 : k - 1), w2.split("").reverse().join("") === ans ? enc(w2, k + 2) : w2.split("").reverse().map((c) => L(LETTERS.indexOf(c) + k)).join("")]);
  wr.delete(ans);
  while (wr.size < 3) wr.add(enc(w2, k + 3 + wr.size));
  return { q: `If ${w1} is written as ${enc(w1, k)}, how is ${w2} written in that code?`, a: ans, w: [...wr].slice(0, 3) };
}

const NAMES = ["Riya", "Aman", "Kabir", "Meera", "Anaya", "Rohan", "Ishaan", "Sara", "Arjun", "Diya", "Vihaan", "Zoya"];
const DIRS = ["North", "East", "South", "West"];
function genDirection(rng, lvl) {
  const name = pick(rng, NAMES);
  let face = ri(rng, 0, 3);
  const turns = lvl <= 3 ? 1 : lvl === 4 ? 2 : 3;
  let story = `${name} is facing ${DIRS[face]}.`;
  for (let i = 0; i < turns; i++) {
    const t = pick(rng, ["right", "left", lvl >= 5 ? "around (about-turn)" : "right"]);
    face = (face + (t === "right" ? 1 : t === "left" ? 3 : 2)) % 4;
    story += ` ${i === 0 ? "Then" : "Next"} ${name} turns ${t}.`;
  }
  return { q: `${story} Which direction is ${name} facing now?`, a: DIRS[face], w: DIRS.filter((d) => d !== DIRS[face]) };
}

function genRanking(rng, lvl) {
  const name = pick(rng, NAMES);
  const n = lvl <= 2 ? ri(rng, 6, 12) : lvl <= 4 ? ri(rng, 12, 30) : ri(rng, 25, 45);
  const k = ri(rng, 2, n - 1);
  if (lvl >= 4 && rng() < 0.5) {
    const r = n - k + 1;
    return { q: `In a row, ${name} is ${ordinal(k)} from the left and ${ordinal(r)} from the right. How many children are in the row?`, a: String(n), w: numWrongs(rng, n, 2).map((x) => (x === String(k + r) ? String(n + 2) : x)) };
  }
  const ans = n - k + 1;
  return { q: `In a row of ${n} children, ${name} is ${ordinal(k)} from the left. What is ${name}'s position from the right?`, a: ordinal(ans), w: numWrongs(rng, ans, 2).map((x) => ordinal(Math.max(1, +x))).filter((x) => x !== ordinal(ans)).concat([ordinal(ans + 3)]).slice(0, 3) };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function genCalendar(rng, lvl) {
  const d = ri(rng, 0, 6);
  let k, q;
  if (lvl <= 2) { k = ri(rng, 1, 3); q = `If today is ${DAYS[d]}, what day will it be after ${k} day${k > 1 ? "s" : ""}?`; }
  else if (lvl <= 4) { k = ri(rng, 8, 20); q = `If today is ${DAYS[d]}, what day will it be after ${k} days?`; }
  else { const date = pick(rng, [8, 10, 15, 20, 22, 25, 29]); k = date - 1; q = `If the 1st of a month is a ${DAYS[d]}, what day is the ${ordinal(date)} of that month?`; }
  const ans = DAYS[(d + k) % 7];
  return { q, a: ans, w: sample(rng, DAYS.filter((x) => x !== ans), 3) };
}

const PATTERN_SETS = [["🔴", "🔵"], ["⭐", "🌙"], ["🍎", "🍌"], ["🔺", "🟦"], ["🐶", "🐱"], ["🌸", "🍃"], ["⚽", "🏀"]];
function genPattern(rng, lvl) {
  const [a, b] = pick(rng, PATTERN_SETS);
  const c = pick(rng, ["🟢", "🟡", "🟣", "⬛"]);
  let seq, ans;
  if (lvl <= 1) { seq = [a, b, a, b, a]; ans = b; }
  else { const unit = rng() < 0.5 ? [a, a, b] : [a, b, b]; seq = unit.concat(unit, unit.slice(0, 2)); ans = unit[2]; }
  const opts = [a, b, c].filter((x) => x !== ans);
  return { q: `What comes next in the pattern? ${seq.join(" ")} ?`, a: ans, w: opts.concat([pick(rng, ["🔶", "❤️", "🟤"])]).slice(0, 3) };
}

function genNumberBasics(rng, lvl) {
  const kind = ri(rng, 0, 2);
  if (kind === 0) {
    const n = lvl <= 1 ? ri(rng, 5, 50) : ri(rng, 50, 500);
    return { q: `Which number comes just after ${n}?`, a: String(n + 1), w: [String(n - 1), String(n + 2), String(n + 10)] };
  }
  if (kind === 1) {
    const nums = sample(rng, lvl <= 1 ? [12, 27, 35, 41, 9, 50, 18, 63] : [345, 354, 435, 453, 534, 543, 299, 701], 4);
    const big = Math.max(...nums);
    return { q: "Which number is the biggest?", a: String(big), w: nums.filter((x) => x !== big).map(String) };
  }
  const n = lvl <= 1 ? ri(rng, 5, 60) : ri(rng, 60, 900);
  return { q: `Which number comes between ${n} and ${n + 2}?`, a: String(n + 1), w: [String(n + 3), String(n - 1), String(n + 10)] };
}

const RELATIONS = [
  ["A is the father of B. B is the brother of C. How is A related to C?", "Father", ["Brother", "Uncle", "Grandfather"]],
  ["P is the mother of Q. Q is the sister of R. How is P related to R?", "Mother", ["Sister", "Aunt", "Grandmother"]],
  ["Ravi's father has only one son. Who is Ravi's father's son?", "Ravi", ["Ravi's uncle", "Ravi's brother", "Ravi's cousin"]],
  ["Neha is the daughter of Meena. Meena is the daughter of Kamla. How is Kamla related to Neha?", "Grandmother", ["Mother", "Aunt", "Sister"]],
  ["X is the brother of Y. Y is the son of Z. How is Z related to X?", "Parent", ["Brother", "Son", "Uncle"]],
  ["Ali's mother's brother is Ali's:", "Uncle", ["Cousin", "Grandfather", "Nephew"]],
  ["Sita's father's father is Sita's:", "Grandfather", ["Uncle", "Father", "Brother"]],
  ["Tom's uncle's son is Tom's:", "Cousin", ["Brother", "Nephew", "Uncle"]],
];
function genRelation(rng) { const [q, a, w] = pick(rng, RELATIONS); return { q, a, w: w.slice() }; }

function genMissingOp(rng, lvl) {
  if (lvl <= 4) {
    const a = ri(rng, 2, 9), b = ri(rng, 2, 9);
    return { q: `Find the missing number: ${a} × ? = ${a * b}`, a: String(b), w: numWrongs(rng, b, 3) };
  }
  const a = ri(rng, 3, 9), b = ri(rng, 2, 6), c = ri(rng, 2, 9);
  const r = a * b + c;
  return { q: `If ${a} × ${b} + ? = ${r}, what is the missing number?`, a: String(c), w: numWrongs(rng, c, 3) };
}

function reasoningGenerators(lvl) {
  if (lvl <= 1) return [genNumberSeries, genLetterSeries, genOddOneOut, genAnalogy, genPattern, genNumberBasics];
  if (lvl === 2) return [genNumberSeries, genLetterSeries, genOddOneOut, genAnalogy, genPattern, genAlphabetPos, genRanking, genCalendar, genNumberBasics];
  if (lvl === 3) return [genNumberSeries, genLetterSeries, genOddOneOut, genAnalogy, genAlphabetPos, genCoding, genDirection, genRanking, genCalendar, genMissingOp];
  return [genNumberSeries, genLetterSeries, genOddOneOut, genAnalogy, genAlphabetPos, genCoding, genDirection, genRanking, genCalendar, genMissingOp, genRelation];
}
function makeReasoning(rng, lvl, count, used) {
  const gens = reasoningGenerators(lvl);
  const out = [];
  let guard = 0, gi = 0;
  const order = shuffle(rng, gens);
  while (out.length < count && guard++ < 2000) {
    const g = order[gi++ % order.length];
    const item = g(rng, lvl);
    if (!item || used.has(item.q)) continue;
    const opts = new Set([item.a, ...item.w]);
    if (opts.size !== 4) continue;
    used.add(item.q);
    out.push(item);
  }
  if (out.length < count) throw new Error("Could not generate enough reasoning questions");
  return out;
}

/* ================= WRITE PAPERS ================= */
const SUBJECTS = [
  { id: "socialstudies", name: "Social Studies", bank: "socialstudies.txt", section: "Social Studies" },
  { id: "creativearts", name: "Creative Arts", bank: "creativearts.txt", section: "Art, Music & Craft" },
  { id: "reasoning", name: "Reasoning", section: "Verbal & Non-Verbal Reasoning" },
];

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

let total = 0;
for (const subj of SUBJECTS) {
  const bank = subj.bank ? loadBank(subj.bank) : null;
  for (const cls of CLASSES) {
    const used = new Set(); // reasoning: no repeated question across this class's 5 papers
    if (bank && (!bank[cls] || bank[cls].normal.length < NORMAL_Q || bank[cls].achievers.length < ACHIEVER_Q)) {
      throw new Error(`${subj.bank}: class${cls} needs ≥${NORMAL_Q} normal and ≥${ACHIEVER_Q} achiever questions`);
    }
    // fixed per-class order so window picks spread questions evenly
    const orderRng = makeRng(`${subj.id}-class${cls}-order`);
    const normalList = bank ? shuffle(orderRng, bank[cls].normal) : null;
    const achList = bank ? shuffle(orderRng, bank[cls].achievers) : null;

    for (let p = 1; p <= PAPERS; p++) {
      const rng = makeRng(`${subj.id}-class${cls}-paper${p}`);
      let normal, ach;
      if (bank) {
        normal = shuffle(rng, windowPick(normalList, p - 1, NORMAL_Q));
        ach = shuffle(rng, windowPick(achList, p - 1, ACHIEVER_Q));
      } else {
        normal = makeReasoning(rng, cls, NORMAL_Q, used);
        ach = makeReasoning(rng, cls + 1, ACHIEVER_Q, used);
      }
      const questions = [], answers = {};
      const add = (item, section, marks) => {
        const id = questions.length + 1;
        const options = shuffle(rng, [item.a, ...item.w]);
        questions.push({ id, question: item.q, options, section, marks });
        answers[String(id)] = options.indexOf(item.a);
      };
      normal.forEach((it) => add(it, subj.section, 1));
      ach.forEach((it) => add(it, "Achievers Section", 2));

      const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
      const base = path.join(DATA, `class${cls}`, subj.id);
      writeJson(path.join(base, "questions", `paper${p}.json`), {
        class: cls,
        subject: subj.name,
        paper: p,
        title: `Class ${cls} ${subj.name} — Paper ${p}`,
        durationMinutes: DURATION,
        totalMarks,
        patternNote: `Original Olympiad-style practice paper for Class ${cls}: ${NORMAL_Q} questions × 1 mark + ${ACHIEVER_Q} Achievers × 2 marks. Not an official exam paper.`,
        yearStyle: "2023-2025",
        questions,
      });
      writeJson(path.join(base, "answers", `paper${p}.json`), { class: cls, subject: subj.name, paper: p, answers });
      total++;
    }
  }
}
console.log(`Wrote ${total} papers (${SUBJECTS.length} subjects × ${CLASSES.length} classes × ${PAPERS} papers).`);

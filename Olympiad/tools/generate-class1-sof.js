#!/usr/bin/env node
/**
 * Generate ORIGINAL Class 1 Olympiad practice papers (SOF 2023-2025 pattern).
 * NOT copyrighted SOF papers. Original kid-friendly practice only.
 *
 * IMO:  LR10 + MR20 + Ach5x2 = 35Q/40
 * NSO:  LR5  + Sci25 + Ach5x2 = 35Q/40
 * IEO:  WSK30 + R5 + SWE5 = 40Q/40
 * ICSO: LR5 + Comp25 + Ach5x2 = 35Q/40
 * IGKO: GA20 + CA5 + LS5 + Ach5x2 = 35Q/40
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "data", "class1");
const CLASS_NUM = 1;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writePaper(subjectFolder, paperNum, meta, questions, answers) {
  const qDir = path.join(ROOT, subjectFolder, "questions");
  const aDir = path.join(ROOT, subjectFolder, "answers");
  ensureDir(qDir);
  ensureDir(aDir);
  const payload = {
    class: CLASS_NUM,
    subject: meta.subject,
    paper: paperNum,
    title: `Class 1 ${meta.subject} — Paper ${paperNum}`,
    durationMinutes: 60,
    totalMarks: meta.totalMarks,
    patternNote:
      "Original practice paper aligned to SOF 2023–2025 Class 1 pattern & syllabus. Not an official SOF paper.",
    yearStyle: "2023-2025",
    questions,
  };
  fs.writeFileSync(path.join(qDir, `paper${paperNum}.json`), JSON.stringify(payload, null, 2) + "\n");
  fs.writeFileSync(
    path.join(aDir, `paper${paperNum}.json`),
    JSON.stringify({ class: CLASS_NUM, subject: meta.subject, paper: paperNum, answers }, null, 2) + "\n"
  );
}

function Q(id, question, options, answerIndex, section, marks = 1) {
  if (!Array.isArray(options) || options.length !== 4) throw new Error(`Q${id}: need 4 options`);
  if (answerIndex < 0 || answerIndex > 3) throw new Error(`Q${id}: bad ans`);
  if (new Set(options.map(String)).size < 4) throw new Error(`Q${id}: dup opts ${JSON.stringify(options)}`);
  return { q: { id, question, options, section, marks }, a: answerIndex };
}

function pack(items) {
  const questions = items.map((x) => ({ ...x.q }));
  const answers = {};
  items.forEach((x, i) => {
    questions[i].id = i + 1;
    answers[String(i + 1)] = x.a;
  });
  return { questions, answers };
}

/** Rotate options so correct index varies; keep uniqueness */
function diversify(item, paperIdx, salt = 0) {
  const rot = (paperIdx + salt) % 4;
  const opts = item.q.options.map(String);
  const ans = item.a;
  const correct = opts[ans];
  const rotated = opts.map((_, i) => opts[(i + rot) % 4]);
  let newAns = rotated.indexOf(correct);
  if (newAns < 0) {
    rotated[0] = correct;
    newAns = 0;
  }
  // ensure 4 unique strings without relying on trailing spaces
  const seen = new Set();
  for (let i = 0; i < 4; i++) {
    let v = rotated[i];
    let n = 1;
    while (seen.has(v)) {
      v = `${rotated[i]} (${n})`;
      n++;
    }
    // never alter the correct option text
    if (rotated[i] === correct && seen.has(correct)) {
      // move correct to this slot uniquely
      v = correct;
    }
    if (v !== correct && seen.has(v)) {
      v = `${rotated[i]}#${i}`;
    }
    rotated[i] = v;
    seen.add(v);
  }
  // force correct present exactly once
  newAns = rotated.indexOf(correct);
  if (newAns < 0) {
    rotated[0] = correct;
    newAns = 0;
    // re-unique others
    const s2 = new Set([correct]);
    for (let i = 1; i < 4; i++) {
      let v = String(rotated[i]);
      if (v === correct || s2.has(v)) v = `option ${i + 1}`;
      rotated[i] = v;
      s2.add(v);
    }
  }
  return Q(item.q.id, item.q.question, rotated, newAns, item.q.section, item.q.marks);
}

function take(bank, n, paperIdx, start = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const raw = bank[(start + paperIdx * 3 + i * 2) % bank.length];
    // deep clone via Q
    const base = Q(0, raw.q.question, raw.q.options.slice(), raw.a, raw.q.section, raw.q.marks);
    out.push(diversify(base, paperIdx, i));
  }
  return out;
}

function validate(paper, expectCount, expectMarks) {
  const { questions, answers } = paper;
  if (questions.length !== expectCount) throw new Error(`Expected ${expectCount}Q got ${questions.length}`);
  let marks = 0;
  const sections = {};
  const ids = new Set();
  questions.forEach((q) => {
    if (ids.has(q.id)) throw new Error(`dup id ${q.id}`);
    ids.add(q.id);
    if (!q.options || q.options.length !== 4) throw new Error(`Q${q.id} opts`);
    if (new Set(q.options.map(String)).size < 4) throw new Error(`Q${q.id} dup ${JSON.stringify(q.options)}`);
    const a = answers[String(q.id)];
    if (a === undefined || a < 0 || a > 3) throw new Error(`bad ans ${q.id}`);
    marks += Number(q.marks) || 1;
    sections[q.section] = (sections[q.section] || 0) + 1;
  });
  if (marks !== expectMarks) throw new Error(`marks ${marks} != ${expectMarks}`);
  return { marks, sections };
}

// ─── MATH banks ─────────────────────────────────────────────
function mathLR() {
  return [
    Q(1, "What comes next? 2, 4, 6, 8, __", ["9", "10", "12", "7"], 1, "Logical Reasoning"),
    Q(1, "What comes next? 5, 10, 15, 20, __", ["21", "25", "30", "22"], 1, "Logical Reasoning"),
    Q(1, "Next: 10, 20, 30, 40, __", ["41", "50", "45", "60"], 1, "Logical Reasoning"),
    Q(1, "Next: 1, 3, 5, 7, __", ["8", "9", "10", "6"], 1, "Logical Reasoning"),
    Q(1, "Next: 100, 90, 80, 70, __", ["60", "50", "65", "75"], 0, "Logical Reasoning"),
    Q(1, "Odd one out: Circle, Square, Apple, Triangle", ["Circle", "Square", "Apple", "Triangle"], 2, "Logical Reasoning"),
    Q(1, "Odd one out: Cat, Dog, Car, Cow", ["Cat", "Dog", "Car", "Cow"], 2, "Logical Reasoning"),
    Q(1, "Odd one out: Spoon, Fork, Plate, Tree", ["Spoon", "Fork", "Plate", "Tree"], 3, "Logical Reasoning"),
    Q(1, "Odd one out: Eye, Ear, Nose, Shoe", ["Eye", "Ear", "Nose", "Shoe"], 3, "Logical Reasoning"),
    Q(1, "Odd one out: Mango, Banana, Carrot, Apple", ["Mango", "Banana", "Carrot", "Apple"], 2, "Logical Reasoning"),
    Q(1, "Pattern: A, B, A, B, A, __", ["A", "B", "C", "D"], 1, "Logical Reasoning"),
    Q(1, "Pattern: △ □ △ □ △ __", ["△", "□", "○", "★"], 1, "Logical Reasoning"),
    Q(1, "Pattern: red, blue, red, blue, red, __", ["green", "blue", "yellow", "red"], 1, "Logical Reasoning"),
    Q(1, "Pattern: big, small, big, small, big, __", ["big", "small", "tiny", "huge"], 1, "Logical Reasoning"),
    Q(1, "Pattern: 1, 2, 3, 1, 2, 3, 1, 2, __", ["1", "2", "3", "4"], 2, "Logical Reasoning"),
    Q(1, "Which comes just before Wednesday?", ["Monday", "Tuesday", "Thursday", "Friday"], 1, "Logical Reasoning"),
    Q(1, "Which comes just after Friday?", ["Thursday", "Saturday", "Sunday", "Monday"], 1, "Logical Reasoning"),
    Q(1, "Day before Monday is:", ["Sunday", "Tuesday", "Saturday", "Friday"], 0, "Logical Reasoning"),
    Q(1, "Which comes between Tuesday and Thursday?", ["Monday", "Wednesday", "Friday", "Sunday"], 1, "Logical Reasoning"),
    Q(1, "Ria has more pencils than Sam. Sam has more than Tom. Who has the least?", ["Ria", "Sam", "Tom", "All same"], 2, "Logical Reasoning"),
    Q(1, "A is taller than B. B is taller than C. Who is tallest?", ["A", "B", "C", "Same"], 0, "Logical Reasoning"),
    Q(1, "If star means 1, then four stars mean:", ["2", "3", "4", "5"], 2, "Logical Reasoning"),
    Q(1, "Missing letter: A, C, E, G, __", ["H", "I", "F", "J"], 1, "Logical Reasoning"),
    Q(1, "Missing: 2, 4, __, 8, 10", ["5", "6", "7", "3"], 1, "Logical Reasoning"),
    Q(1, "Which group has more? Four dots or two dots?", ["Four dots", "Two dots", "Same", "None"], 0, "Logical Reasoning"),
    Q(1, "Left hand has 5 fingers, right has 5. Total?", ["5", "10", "15", "20"], 1, "Logical Reasoning"),
    Q(1, "Book is on the table. Ball is under the table. Where is the ball?", ["On table", "Under table", "In book", "Outside only"], 1, "Logical Reasoning"),
    Q(1, "Which is different? 1, 3, 5, 8, 9", ["1", "3", "8", "9"], 2, "Logical Reasoning"),
    Q(1, "Which does not belong? Red, Blue, Chair, Green", ["Red", "Blue", "Chair", "Green"], 2, "Logical Reasoning"),
    Q(1, "Complete: up, down, up, down, up, __", ["left", "down", "right", "up"], 1, "Logical Reasoning"),
  ];
}

function uniqueOpts(correct, candidates) {
  const c = String(correct);
  const out = [c];
  for (const x of candidates) {
    const s = String(x);
    if (s !== c && !out.includes(s)) out.push(s);
    if (out.length === 4) break;
  }
  let n = 1;
  while (out.length < 4) {
    const s = String(Number(c) + 10 + n);
    if (!out.includes(s)) out.push(s);
    n++;
  }
  return out;
}

function mathMR() {
  const b = [];
  // addition
  const adds = [[5,3,8],[6,4,10],[4,7,11],[8,5,13],[3,9,12],[9,9,18],[1,2,3],[7,1,8],[8,1,9],[2,2,4],[4,4,8],[5,5,10],[7,2,9],[6,6,12],[3,3,6]];
  adds.forEach(([x,y,z]) => {
    const opts = uniqueOpts(z, [z-1, z+1, z+2, z+3, Math.max(0,z-2), x, y, x+y+1]);
    b.push(Q(1, `What is ${x} + ${y}?`, opts, 0, "Mathematical Reasoning"));
  });
  const subs = [[9,4,5],[12,5,7],[10,6,4],[15,7,8],[14,9,5],[16,8,8],[11,2,9],[18,9,9],[13,4,9],[20,10,10],[8,1,7],[6,2,4],[9,3,6],[8,3,5],[7,2,5]];
  subs.forEach(([x,y,z]) => {
    const opts = uniqueOpts(z, [z+1, Math.max(0,z-1), x+y, x, y, z+2, Math.max(0,z-2), x-y+1]);
    b.push(Q(1, `What is ${x} − ${y}?`, opts, 0, "Mathematical Reasoning"));
  });
  b.push(
    Q(1, "How many tens are there in 40?", ["2", "3", "4", "5"], 2, "Mathematical Reasoning"),
    Q(1, "How many ones are in 27?", ["2", "7", "9", "5"], 1, "Mathematical Reasoning"),
    Q(1, "2 tens and 5 ones make:", ["25", "52", "7", "15"], 0, "Mathematical Reasoning"),
    Q(1, "1 ten and 8 ones =", ["18", "81", "9", "28"], 0, "Mathematical Reasoning"),
    Q(1, "3 tens and 0 ones =", ["3", "30", "300", "13"], 1, "Mathematical Reasoning"),
    Q(1, "4 tens + 2 ones =", ["24", "42", "6", "44"], 1, "Mathematical Reasoning"),
    Q(1, "5 tens and 5 ones =", ["55", "50", "15", "555"], 0, "Mathematical Reasoning"),
    Q(1, "Number of tens in 60:", ["5", "6", "7", "0"], 1, "Mathematical Reasoning"),
    Q(1, "How many tens in 90?", ["8", "9", "10", "0"], 1, "Mathematical Reasoning"),
    Q(1, "In 83, the digit in tens place is:", ["8", "3", "11", "5"], 0, "Mathematical Reasoning"),
    Q(1, "Which number comes after 19?", ["18", "20", "21", "17"], 1, "Mathematical Reasoning"),
    Q(1, "Number before 100 is:", ["99", "101", "90", "110"], 0, "Mathematical Reasoning"),
    Q(1, "After 74 comes:", ["73", "75", "84", "70"], 1, "Mathematical Reasoning"),
    Q(1, "What comes after 39?", ["38", "40", "49", "30"], 1, "Mathematical Reasoning"),
    Q(1, "Number after 59 is:", ["58", "60", "69", "50"], 1, "Mathematical Reasoning"),
    Q(1, "What comes before 50?", ["49", "51", "40", "55"], 0, "Mathematical Reasoning"),
    Q(1, "Number before 61:", ["60", "62", "59", "70"], 0, "Mathematical Reasoning"),
    Q(1, "Before 1 comes:", ["0", "2", "10", "11"], 0, "Mathematical Reasoning"),
    Q(1, "What comes before 33?", ["32", "34", "30", "23"], 0, "Mathematical Reasoning"),
    Q(1, "Which is the biggest number?", ["12", "21", "18", "15"], 1, "Mathematical Reasoning"),
    Q(1, "Smallest number:", ["34", "43", "24", "42"], 2, "Mathematical Reasoning"),
    Q(1, "Biggest: 9, 19, 29, 12", ["9", "19", "29", "12"], 2, "Mathematical Reasoning"),
    Q(1, "Greatest number: 7, 70, 17, 71", ["7", "70", "17", "71"], 3, "Mathematical Reasoning"),
    Q(1, "Smallest two-digit number is:", ["10", "11", "01", "99"], 0, "Mathematical Reasoning"),
    Q(1, "Which is less: 8 or 11?", ["8", "11", "Same", "Cannot say"], 0, "Mathematical Reasoning"),
    Q(1, "Which is more: 15 or 12?", ["15", "12", "Same", "0"], 0, "Mathematical Reasoning"),
    Q(1, "Is 25 more than 20?", ["Yes", "No", "Same", "Maybe"], 0, "Mathematical Reasoning"),
    Q(1, "A triangle has how many sides?", ["2", "3", "4", "5"], 1, "Mathematical Reasoning"),
    Q(1, "A rectangle has how many sides?", ["2", "3", "4", "5"], 2, "Mathematical Reasoning"),
    Q(1, "A square has how many corners?", ["2", "3", "4", "5"], 2, "Mathematical Reasoning"),
    Q(1, "A circle has how many corners?", ["0", "1", "2", "4"], 0, "Mathematical Reasoning"),
    Q(1, "Which shape is round like a ball?", ["Square", "Triangle", "Circle", "Rectangle"], 2, "Mathematical Reasoning"),
    Q(1, "Which shape has 3 corners?", ["Circle", "Square", "Triangle", "Oval"], 2, "Mathematical Reasoning"),
    Q(1, "Which shape looks like a door?", ["Circle", "Triangle", "Rectangle", "Star"], 2, "Mathematical Reasoning"),
    Q(1, "Which shape has no straight sides?", ["Square", "Triangle", "Circle", "Rectangle"], 2, "Mathematical Reasoning"),
    Q(1, "A square has all sides:", ["Different", "Equal", "Round", "Open"], 1, "Mathematical Reasoning"),
    Q(1, "Half of 10 is:", ["2", "4", "5", "8"], 2, "Mathematical Reasoning"),
    Q(1, "Half of 8 is:", ["2", "3", "4", "6"], 2, "Mathematical Reasoning"),
    Q(1, "Half of 6 is:", ["2", "3", "4", "12"], 1, "Mathematical Reasoning"),
    Q(1, "Double of 4 is:", ["6", "8", "2", "12"], 1, "Mathematical Reasoning"),
    Q(1, "Double of 6 is:", ["3", "10", "12", "16"], 2, "Mathematical Reasoning"),
    Q(1, "3 + 3 + 3 = ?", ["6", "9", "12", "3"], 1, "Mathematical Reasoning"),
    Q(1, "2 + 2 + 2 + 2 = ?", ["6", "8", "10", "4"], 1, "Mathematical Reasoning"),
    Q(1, "4 + 4 + 4 = ?", ["8", "12", "16", "4"], 1, "Mathematical Reasoning"),
    Q(1, "₹5 + ₹2 = ?", ["₹6", "₹7", "₹8", "₹3"], 1, "Mathematical Reasoning"),
    Q(1, "₹10 − ₹3 = ?", ["₹6", "₹7", "₹8", "₹13"], 1, "Mathematical Reasoning"),
    Q(1, "₹2 + ₹2 + ₹2 = ?", ["₹4", "₹6", "₹8", "₹2"], 1, "Mathematical Reasoning"),
    Q(1, "₹1 + ₹5 = ?", ["₹4", "₹5", "₹6", "₹7"], 2, "Mathematical Reasoning"),
    Q(1, "₹10 + ₹5 = ?", ["₹10", "₹15", "₹20", "₹5"], 1, "Mathematical Reasoning"),
    Q(1, "A ₹2 coin and a ₹1 coin together make:", ["₹2", "₹3", "₹4", "₹1"], 1, "Mathematical Reasoning"),
    Q(1, "Which coin is worth the most?", ["₹1", "₹2", "₹5", "50 paise"], 2, "Mathematical Reasoning"),
    Q(1, "How many paise make ₹1?", ["10", "50", "100", "25"], 2, "Mathematical Reasoning"),
    Q(1, "How many months are in one year?", ["10", "11", "12", "7"], 2, "Mathematical Reasoning"),
    Q(1, "How many days are in one week?", ["5", "6", "7", "8"], 2, "Mathematical Reasoning"),
    Q(1, "How many hours are in one day?", ["12", "24", "60", "7"], 1, "Mathematical Reasoning"),
    Q(1, "There are __ minutes in one hour.", ["30", "60", "100", "24"], 1, "Mathematical Reasoning"),
    Q(1, "How many days in January?", ["28", "30", "31", "29"], 2, "Mathematical Reasoning"),
    Q(1, "How many wheels does a car usually have?", ["2", "3", "4", "6"], 2, "Mathematical Reasoning"),
    Q(1, "How many letters in the English alphabet?", ["24", "25", "26", "27"], 2, "Mathematical Reasoning"),
    Q(1, "Count backwards: 5, 4, 3, 2, __", ["0", "1", "3", "6"], 1, "Mathematical Reasoning"),
    Q(1, "Put in order from small to big: 5, 2, 9", ["5, 2, 9", "2, 5, 9", "9, 5, 2", "2, 9, 5"], 1, "Mathematical Reasoning"),
    Q(1, "Which day comes after Sunday?", ["Saturday", "Monday", "Friday", "Tuesday"], 1, "Mathematical Reasoning"),
  );
  return b;
}

function mathAch() {
  return [
    Q(1, "Riya has 8 sweets. She gives 3 to her friend. How many are left?", ["4", "5", "6", "11"], 1, "Achievers Section", 2),
    Q(1, "A box has 4 red balls and 5 blue balls. How many balls in all?", ["8", "9", "10", "1"], 1, "Achievers Section", 2),
    Q(1, "Which number is between 45 and 47?", ["44", "46", "48", "40"], 1, "Achievers Section", 2),
    Q(1, "There are 3 rows of 4 apples. How many apples?", ["7", "12", "9", "16"], 1, "Achievers Section", 2),
    Q(1, "A clock shows 3 o'clock. After 2 hours it will show:", ["4 o'clock", "5 o'clock", "6 o'clock", "1 o'clock"], 1, "Achievers Section", 2),
    Q(1, "Aman has 10 stickers. He gets 5 more. Total stickers?", ["12", "15", "5", "50"], 1, "Achievers Section", 2),
    Q(1, "There are 6 birds. 2 fly away. How many left?", ["3", "4", "5", "8"], 1, "Achievers Section", 2),
    Q(1, "Which is the number just after 89?", ["88", "90", "98", "80"], 1, "Achievers Section", 2),
    Q(1, "4 children get 2 toffees each. How many toffees?", ["6", "8", "10", "4"], 1, "Achievers Section", 2),
    Q(1, "A pencil costs ₹5. Two pencils cost:", ["₹5", "₹10", "₹7", "₹15"], 1, "Achievers Section", 2),
    Q(1, "Sita had 15 crayons. She lost 6. How many left?", ["8", "9", "10", "21"], 1, "Achievers Section", 2),
    Q(1, "There are 2 baskets with 6 mangoes each. Total mangoes?", ["8", "10", "12", "14"], 2, "Achievers Section", 2),
    Q(1, "Which number is greater than 55 but less than 57?", ["54", "56", "58", "50"], 1, "Achievers Section", 2),
    Q(1, "Mother buys 3 bananas for ₹2 each. Total money spent?", ["₹5", "₹6", "₹3", "₹8"], 1, "Achievers Section", 2),
    Q(1, "A jar has 20 sweets. Children eat 9. How many left?", ["10", "11", "12", "29"], 1, "Achievers Section", 2),
    Q(1, "3 bags have 5 books each. Total books?", ["8", "15", "12", "10"], 1, "Achievers Section", 2),
    Q(1, "Find: 10 + 5 − 3 = ?", ["12", "15", "8", "18"], 0, "Achievers Section", 2),
    Q(1, "Ravi stands at place 4 in a line. How many children are before him?", ["3", "4", "5", "2"], 0, "Achievers Section", 2),
    Q(1, "A chocolate bar has 6 pieces. You eat 2. Pieces left?", ["3", "4", "5", "8"], 1, "Achievers Section", 2),
    Q(1, "A shop has 14 balloons. 5 are sold. How many left?", ["8", "9", "10", "19"], 1, "Achievers Section", 2),
    Q(1, "Two hands have 10 fingers. Four hands have:", ["10", "15", "20", "40"], 2, "Achievers Section", 2),
    Q(1, "Which number makes 8 + __ = 15?", ["5", "6", "7", "8"], 2, "Achievers Section", 2),
    Q(1, "A story book has 12 pages. You read 7. Pages left?", ["4", "5", "6", "19"], 1, "Achievers Section", 2),
    Q(1, "Class starts at 9 o'clock. After 1 hour it is:", ["8 o'clock", "10 o'clock", "11 o'clock", "9 o'clock"], 1, "Achievers Section", 2),
    Q(1, "A train has 5 coaches. Each has 2 windows on one side. Windows on that side?", ["7", "10", "5", "12"], 1, "Achievers Section", 2),
  ];
}

function mathPapers() {
  const lr = mathLR(), mr = mathMR(), ach = mathAch();
  const papers = [];
  for (let p = 0; p < 5; p++) {
    papers.push(pack([...take(lr, 10, p, 0), ...take(mr, 20, p, 1), ...take(ach, 5, p, 2)]));
  }
  return papers;
}

// ─── SCIENCE ────────────────────────────────────────────────
function sciLR() {
  return [
    Q(1, "What comes next? Sun, Moon, Sun, Moon, __", ["Star only", "Sun", "Cloud", "Rain"], 1, "Logical Reasoning"),
    Q(1, "Odd one out: Rose, Lily, Crow, Lotus", ["Rose", "Lily", "Crow", "Lotus"], 2, "Logical Reasoning"),
    Q(1, "Pattern: big, small, big, small, __", ["tiny", "big", "huge only", "none"], 1, "Logical Reasoning"),
    Q(1, "Which is different? Walk, Run, Jump, Sleep", ["Walk", "Run", "Jump", "Sleep"], 3, "Logical Reasoning"),
    Q(1, "Hot is opposite of:", ["Warm", "Cold", "Sunny", "Bright"], 1, "Logical Reasoning"),
    Q(1, "Which does not fly? Crow, Sparrow, Aeroplane, Fish", ["Crow", "Sparrow", "Aeroplane", "Fish"], 3, "Logical Reasoning"),
    Q(1, "Odd one out: Eyes, Ears, Nose, Cap", ["Eyes", "Ears", "Nose", "Cap"], 3, "Logical Reasoning"),
    Q(1, "Wet is opposite of:", ["Damp", "Dry", "Watery", "Rainy"], 1, "Logical Reasoning"),
    Q(1, "Group: rose, jasmine, sunflower — all are:", ["Animals", "Flowers", "Birds", "Insects"], 1, "Logical Reasoning"),
    Q(1, "Which can grow? Child, Chair, Stone, Ball", ["Child", "Chair", "Stone", "Ball"], 0, "Logical Reasoning"),
    Q(1, "Day is opposite of:", ["Morning", "Night", "Noon", "Evening"], 1, "Logical Reasoning"),
    Q(1, "Which needs food? Baby, Doll, Rock, Pen", ["Baby", "Doll", "Rock", "Pen"], 0, "Logical Reasoning"),
    Q(1, "Soft is opposite of:", ["Smooth", "Hard", "Light", "Thin"], 1, "Logical Reasoning"),
    Q(1, "Group: sparrow, pigeon, parrot — all are:", ["Fish", "Birds", "Insects", "Cats"], 1, "Logical Reasoning"),
    Q(1, "Odd one out: Apple, Mango, Banana, Chair", ["Apple", "Mango", "Banana", "Chair"], 3, "Logical Reasoning"),
  ];
}

function sciMain() {
  return [
    Q(1, "Which is a living thing?", ["Stone", "Cat", "Chair", "Ball"], 1, "Science"),
    Q(1, "Which is non-living?", ["Tree", "Fish", "Book", "Bird"], 2, "Science"),
    Q(1, "Plants need __ to grow.", ["Only toys", "Sunlight, water and air", "Plastic only", "Noise"], 1, "Science"),
    Q(1, "We smell with our:", ["Eyes", "Ears", "Nose", "Hands"], 2, "Science"),
    Q(1, "We see with our:", ["Nose", "Eyes", "Tongue", "Legs"], 1, "Science"),
    Q(1, "A cow gives us:", ["Wool only", "Milk", "Honey", "Eggs only"], 1, "Science"),
    Q(1, "Which animal lives in water?", ["Lion", "Fish", "Goat", "Hen"], 1, "Science"),
    Q(1, "The sun gives us:", ["Darkness", "Light and heat", "Rain only", "Snow only"], 1, "Science"),
    Q(1, "We should drink clean:", ["Mud", "Water", "Oil only", "Paint"], 1, "Science"),
    Q(1, "Leaves are usually:", ["Blue", "Green", "Black only", "Purple only"], 1, "Science"),
    Q(1, "We walk with our:", ["Hands", "Legs", "Ears", "Hair"], 1, "Science"),
    Q(1, "A baby plant grows from a:", ["Leaf only always", "Seed", "Stone", "Cloud"], 1, "Science"),
    Q(1, "Which is a fruit?", ["Potato", "Carrot", "Mango", "Onion"], 2, "Science"),
    Q(1, "Air is all around us. We need air to:", ["Breathe", "Only paint", "Only sleep forever", "Stop living"], 0, "Science"),
    Q(1, "Day time is when we see the:", ["Moon only", "Sun", "Stars only", "Nothing"], 1, "Science"),
    Q(1, "At night we often see the:", ["Sun", "Moon and stars", "Rainbow only", "Only day clouds"], 1, "Science"),
    Q(1, "We should wash our hands:", ["Never", "Before eating", "Only once a year", "With mud"], 1, "Science"),
    Q(1, "A house protects us from:", ["Friends", "Heat, cold and rain", "Food", "Books"], 1, "Science"),
    Q(1, "Which sense organ helps us taste?", ["Eye", "Ear", "Tongue", "Nose only"], 2, "Science"),
    Q(1, "Birds have:", ["Fins", "Wings", "Horns always", "No legs"], 1, "Science"),
    Q(1, "We wear woollen clothes in:", ["Summer", "Winter", "Only underwater", "Never"], 1, "Science"),
    Q(1, "Rain comes from:", ["Rocks", "Clouds", "Trees only", "Cars"], 1, "Science"),
    Q(1, "Which is a vegetable?", ["Apple", "Banana", "Spinach", "Mango"], 2, "Science"),
    Q(1, "Our heart is inside our:", ["Foot", "Chest", "Hair", "Ear"], 1, "Science"),
    Q(1, "We must cross the road at a:", ["Any place while running", "Zebra crossing / safe place", "Blind fold", "Dark only"], 1, "Science"),
    Q(1, "A dog is a:", ["Living thing", "Non-living thing", "Plant", "Stone"], 0, "Science"),
    Q(1, "A table is:", ["Living", "Non-living", "An animal", "A plant"], 1, "Science"),
    Q(1, "Flowers are part of a:", ["Animal", "Plant", "Rock", "Car"], 1, "Science"),
    Q(1, "We hear with our:", ["Eyes", "Ears", "Nose", "Tongue"], 1, "Science"),
    Q(1, "A hen gives us:", ["Milk", "Eggs", "Wool", "Honey"], 1, "Science"),
    Q(1, "Plants make food mainly in their:", ["Roots only", "Leaves", "Flowers only", "Seeds only"], 1, "Science"),
    Q(1, "Roots help a plant to:", ["Fly", "Get water from soil", "Sing", "Walk"], 1, "Science"),
    Q(1, "A butterfly is an:", ["Insect", "Bird only", "Fish", "Plant"], 0, "Science"),
    Q(1, "Which is good for teeth?", ["Brushing teeth", "Eating only sweets all day", "Never cleaning", "Breaking teeth"], 0, "Science"),
    Q(1, "Fish breathe in water using:", ["Lungs like us only", "Gills", "Wings", "Nose like dog only"], 1, "Science"),
    Q(1, "Cotton clothes are good in:", ["Very cold snow only", "Summer / warm weather", "Only space", "Only night always"], 1, "Science"),
    Q(1, "Shadow is formed when light is:", ["Blocked by an object", "Never present anywhere", "Only under water always", "Eaten by plants"], 0, "Science"),
    Q(1, "Carrot grows:", ["On trees only", "Under the ground", "In the sky", "On water only"], 1, "Science"),
    Q(1, "We must not play with:", ["Soft toys safely", "Fire / matchsticks", "Balls in park with care", "Books"], 1, "Science"),
    Q(1, "Our body needs rest and:", ["Only junk", "Sleep", "No food ever", "No water ever"], 1, "Science"),
    Q(1, "We should throw waste in a:", ["Dustbin", "River always", "Road always", "Friend's bag"], 0, "Science"),
    Q(1, "The stem of a plant:", ["Holds the plant up", "Only flies", "Is always under soil only", "Is an animal"], 0, "Science"),
    Q(1, "Ice is water in __ form.", ["Liquid", "Solid", "Gas steam only", "Fire"], 1, "Science"),
    Q(1, "We wear raincoat in:", ["Sunny dry day only", "Rainy weather", "Only snow always", "Only night"], 1, "Science"),
    Q(1, "The Earth is round like a:", ["Book", "Ball", "Stick", "Box only"], 1, "Science"),
    Q(1, "Plants give us:", ["Only plastic", "Oxygen / fresh air and food", "Only noise", "Only darkness"], 1, "Science"),
    Q(1, "Ears help us to:", ["See colours", "Hear sounds", "Taste sweet", "Smell flowers"], 1, "Science"),
    Q(1, "The colour of clean sky on a clear day is often:", ["Green", "Blue", "Black always", "Pink always"], 1, "Science"),
    Q(1, "Cows eat mainly:", ["Meat only", "Grass / plants", "Stones", "Plastic"], 1, "Science"),
    Q(1, "Our lungs help us to:", ["Digest only", "Breathe", "Walk only", "Hear only"], 1, "Science"),
  ];
}

function sciAch() {
  return [
    Q(1, "Which part of the plant is usually under the ground?", ["Flower", "Root", "Leaf", "Fruit"], 1, "Achievers Section", 2),
    Q(1, "Living things can:", ["Only stay still forever", "Grow and need food", "Never need water", "Never move or grow"], 1, "Achievers Section", 2),
    Q(1, "We get silk from:", ["Cow", "Silkworm", "Hen", "Fish"], 1, "Achievers Section", 2),
    Q(1, "Which animal gives us wool?", ["Sheep", "Frog", "Snake", "Crow"], 0, "Achievers Section", 2),
    Q(1, "The Earth gets light from the:", ["Moon only", "Sun", "Stars only at day", "Torch only"], 1, "Achievers Section", 2),
    Q(1, "Which of these can move on its own?", ["Chair", "Cat", "Book", "Shoe"], 1, "Achievers Section", 2),
    Q(1, "We get wood mainly from:", ["Animals", "Trees", "Rocks only", "Clouds"], 1, "Achievers Section", 2),
    Q(1, "Honey is made by:", ["Ants", "Bees", "Crows", "Fish"], 1, "Achievers Section", 2),
    Q(1, "The Moon shines at night mainly because it:", ["Makes its own fire always", "Reflects sunlight", "Is a lamp on Earth", "Is hotter than Sun"], 1, "Achievers Section", 2),
    Q(1, "Which is a sense organ?", ["Hair only", "Skin", "Nail polish", "Shoe"], 1, "Achievers Section", 2),
    Q(1, "Which needs sunlight to make food?", ["Cat", "Green plant", "Rock", "Plastic toy"], 1, "Achievers Section", 2),
    Q(1, "Drinking dirty water can make us:", ["Stronger always", "Sick", "Fly", "Taller instantly"], 1, "Achievers Section", 2),
    Q(1, "Which gas do humans need from air to live?", ["Smoke only", "Oxygen", "Only dust", "Only steam always"], 1, "Achievers Section", 2),
    Q(1, "Boiling water can kill many:", ["Toys", "Germs", "Books", "Shadows"], 1, "Achievers Section", 2),
    Q(1, "We should not put small things in our:", ["Bag", "Nose or ears", "Pocket of toys", "School bag"], 1, "Achievers Section", 2),
    Q(1, "The Sun is a:", ["Planet like Earth exactly", "Star", "Moon", "Comet only"], 1, "Achievers Section", 2),
    Q(1, "Animals that eat only plants are called plant-eaters. An example is:", ["Cow", "Lion only", "Eagle only", "Shark only"], 0, "Achievers Section", 2),
    Q(1, "The process of a baby plant coming out of a seed is called:", ["Sprouting / germination", "Only melting", "Only freezing", "Only flying"], 0, "Achievers Section", 2),
    Q(1, "Which is a source of water?", ["Rain / river / tap", "Only dry sand", "Only fire", "Only plastic smoke"], 0, "Achievers Section", 2),
    Q(1, "Green colour in leaves helps plants to:", ["Make food", "Only dance", "Only sleep", "Only make noise"], 0, "Achievers Section", 2),
  ];
}

function sciencePapers() {
  const lr = sciLR(), main = sciMain(), ach = sciAch();
  return [0,1,2,3,4].map((p) => pack([...take(lr,5,p), ...take(main,25,p,1), ...take(ach,5,p,2)]));
}

// ─── ENGLISH ────────────────────────────────────────────────
function engWSK() {
  return [
    Q(1, "Which is a vowel?", ["B", "C", "A", "D"], 2, "Word and Structure Knowledge"),
    Q(1, "Which is a vowel?", ["F", "E", "G", "H"], 1, "Word and Structure Knowledge"),
    Q(1, "Vowel letter:", ["P", "Q", "I", "T"], 2, "Word and Structure Knowledge"),
    Q(1, "Which is a vowel?", ["M", "N", "O", "P"], 2, "Word and Structure Knowledge"),
    Q(1, "Vowel:", ["S", "U", "T", "V"], 1, "Word and Structure Knowledge"),
    Q(1, "Capital letter of b is:", ["b", "B", "d", "P"], 1, "Word and Structure Knowledge"),
    Q(1, "Capital of s is:", ["S", "s", "5", "Z"], 0, "Word and Structure Knowledge"),
    Q(1, "Capital of k:", ["K", "k", "L", "R"], 0, "Word and Structure Knowledge"),
    Q(1, "Small letter of M is:", ["m", "n", "w", "M"], 0, "Word and Structure Knowledge"),
    Q(1, "Small letter of R:", ["r", "n", "p", "R"], 0, "Word and Structure Knowledge"),
    Q(1, "Choose the correct article: ___ apple", ["a", "an", "the only", "no word"], 1, "Word and Structure Knowledge"),
    Q(1, "Article: ___ egg", ["a", "an", "two", "many"], 1, "Word and Structure Knowledge"),
    Q(1, "___ umbrella", ["a", "an", "some two", "many"], 1, "Word and Structure Knowledge"),
    Q(1, "___ owl", ["a", "an", "two", "many"], 1, "Word and Structure Knowledge"),
    Q(1, "Use 'a': ___ ball", ["a", "an", "an the", "two an"], 0, "Word and Structure Knowledge"),
    Q(1, "This is ___ apple.", ["a", "an", "two", "many"], 1, "Word and Structure Knowledge"),
    Q(1, "I see ___ aeroplane.", ["a", "an", "two many", "lot"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'big' is:", ["large", "small", "tall", "wide"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'hot' is:", ["warm", "cold", "cool fire", "boiling"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'happy' is:", ["glad", "sad", "joyful", "merry"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'up' is:", ["above", "down", "high", "over"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'in' is:", ["into", "out", "inside", "on"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'tall' is:", ["high", "short", "long", "big"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'fast' is:", ["quick", "slow", "rapid", "speedy"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'open' is:", ["start", "close", "begin", "wide"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'yes' is:", ["ok", "no", "sure", "yes yes"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'day' is:", ["sun", "night", "light", "noon"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'new' is:", ["fresh", "old", "young", "nice"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'good' is:", ["nice", "bad", "fine", "great"], 1, "Word and Structure Knowledge"),
    Q(1, "Opposite of 'wet' is:", ["damp", "dry", "soaked", "rainy"], 1, "Word and Structure Knowledge"),
    Q(1, "Plural of 'cat' is:", ["cat", "cats", "cates", "caties"], 1, "Word and Structure Knowledge"),
    Q(1, "Plural of 'dog' is:", ["dog", "doges", "dogs", "dogies"], 2, "Word and Structure Knowledge"),
    Q(1, "Plural of 'pen' is:", ["pen", "pens", "penes", "penies"], 1, "Word and Structure Knowledge"),
    Q(1, "Plural of 'bus' is:", ["bus", "buss", "buses", "busies"], 2, "Word and Structure Knowledge"),
    Q(1, "Plural of 'box' is:", ["boxs", "boxes", "boxies", "boxen"], 1, "Word and Structure Knowledge"),
    Q(1, "Plural of 'toy' is:", ["toy", "toyes", "toys", "toies"], 2, "Word and Structure Knowledge"),
    Q(1, "Plural of 'baby' is:", ["babys", "babies", "babyes", "babyies"], 1, "Word and Structure Knowledge"),
    Q(1, "Plural of 'leaf' is:", ["leafs", "leaves", "leafes", "leafies"], 1, "Word and Structure Knowledge"),
    Q(1, "Plural of 'child' is:", ["childs", "children", "childes", "childrens"], 1, "Word and Structure Knowledge"),
    Q(1, "Which word rhymes with 'hat'?", ["hot", "bat", "hit", "hut never"], 1, "Word and Structure Knowledge"),
    Q(1, "Rhymes with 'man':", ["moon", "can", "mine", "mean"], 1, "Word and Structure Knowledge"),
    Q(1, "Rhymes with 'pen':", ["pan", "hen", "pin", "pun"], 1, "Word and Structure Knowledge"),
    Q(1, "Rhymes with 'cake':", ["cat", "lake", "cook", "kick"], 1, "Word and Structure Knowledge"),
    Q(1, "Rhymes with 'bell':", ["ball", "well", "bill", "bull"], 1, "Word and Structure Knowledge"),
    Q(1, "Rhymes with 'sit':", ["sat", "hit", "set", "sot"], 1, "Word and Structure Knowledge"),
    Q(1, "Find the noun: The dog runs.", ["The", "dog", "runs", "fast"], 1, "Word and Structure Knowledge"),
    Q(1, "Find the verb: Birds fly.", ["Birds", "fly", "the", "sky"], 1, "Word and Structure Knowledge"),
    Q(1, "Correct spelling:", ["Ball", "Bal", "Bawl tree", "Baal"], 0, "Word and Structure Knowledge"),
    Q(1, "Correct spelling:", ["Book", "Bok", "Booc", "Buk"], 0, "Word and Structure Knowledge"),
    Q(1, "Correct spelling:", ["Water", "Watr", "Watter", "Woter"], 0, "Word and Structure Knowledge"),
    Q(1, "Correct spelling:", ["School", "Scool", "Skool", "Schol"], 0, "Word and Structure Knowledge"),
    Q(1, "Correct spelling:", ["Friend", "Frend", "Freind", "Frind"], 0, "Word and Structure Knowledge"),
    Q(1, "Which starts with 'S'?", ["Apple", "Sun", "Ball", "Cat"], 1, "Word and Structure Knowledge"),
    Q(1, "Starts with 'T':", ["Apple", "Table", "Ball", "Cat"], 1, "Word and Structure Knowledge"),
    Q(1, "Starts with 'M':", ["Nest", "Moon", "Lion", "Fish"], 1, "Word and Structure Knowledge"),
    Q(1, "Fill in: I ___ a student.", ["am", "is", "are", "be"], 0, "Word and Structure Knowledge"),
    Q(1, "Fill: She ___ my sister.", ["am", "is", "are", "be"], 1, "Word and Structure Knowledge"),
    Q(1, "Fill: We ___ friends.", ["am", "is", "are", "be"], 2, "Word and Structure Knowledge"),
    Q(1, "Fill: He ___ a boy.", ["am", "is", "are", "be"], 1, "Word and Structure Knowledge"),
    Q(1, "Fill: They ___ playing.", ["am", "is", "are", "be"], 2, "Word and Structure Knowledge"),
    Q(1, "Which is a colour word?", ["run", "red", "jump", "sit"], 1, "Word and Structure Knowledge"),
    Q(1, "Colour word:", ["green", "run", "desk", "eat"], 0, "Word and Structure Knowledge"),
    Q(1, "A sentence starts with a:", ["small letter always only", "capital letter", "number only", "comma"], 1, "Word and Structure Knowledge"),
    Q(1, "A sentence ends with a:", ["capital", "full stop (.)", "only space", "only colour"], 1, "Word and Structure Knowledge"),
    Q(1, "Which is an action word?", ["happy", "eat", "red", "box"], 1, "Word and Structure Knowledge"),
    Q(1, "Action word:", ["cup", "write", "blue", "soft"], 1, "Word and Structure Knowledge"),
    Q(1, "Vowels are:", ["A E I O U", "B C D F G", "Only X Y Z", "Only numbers"], 0, "Word and Structure Knowledge"),
    Q(1, "How many vowels in English?", ["3", "4", "5", "6"], 2, "Word and Structure Knowledge"),
    Q(1, "The first letter of the alphabet is:", ["B", "A", "Z", "C"], 1, "Word and Structure Knowledge"),
    Q(1, "Last letter of the alphabet is:", ["A", "Y", "Z", "X"], 2, "Word and Structure Knowledge"),
    Q(1, "How many letters in 'DOG'?", ["2", "3", "4", "5"], 1, "Word and Structure Knowledge"),
    Q(1, "Letters in 'SUN':", ["2", "3", "4", "1"], 1, "Word and Structure Knowledge"),
    Q(1, "Choose correct: This is ___ book.", ["I", "my", "me", "mine boy"], 1, "Word and Structure Knowledge"),
    Q(1, "Naming word (noun):", ["run", "blue", "school", "quickly"], 2, "Word and Structure Knowledge"),
    Q(1, "A ___ is a person.", ["boy", "table", "pen", "rock"], 0, "Word and Structure Knowledge"),
    Q(1, "Complete: Good ___ (morning time)", ["night", "morning", "bye always", "sleep only"], 1, "Word and Structure Knowledge"),
    Q(1, "Greeting at night before sleep:", ["Good morning", "Good night", "Good afternoon only", "Hello forever"], 1, "Word and Structure Knowledge"),
    Q(1, "Which are consonants?", ["A E I", "B C D", "O U only", "Only vowels"], 1, "Word and Structure Knowledge"),
    Q(1, "Word with 'ee' sound like 'see'?", ["sit", "tree", "cat", "dog"], 1, "Word and Structure Knowledge"),
    Q(1, "Word with 'sh' sound:", ["ship", "cat", "dog", "pen"], 0, "Word and Structure Knowledge"),
    Q(1, "Word with 'ch' sound:", ["chair", "cat", "dog", "sun"], 0, "Word and Structure Knowledge"),
    Q(1, "Word with 'th' sound:", ["this", "cat", "dog", "pen"], 0, "Word and Structure Knowledge"),
  ];
}

function engReadingPassages() {
  return [
    {
      p: "Tom has a pet cat. The cat is white. Tom gives it milk every day.",
      qs: [
        ["Who has a pet?", ["Tom", "The milk", "A dog", "A bird"], 0],
        ["What pet does Tom have?", ["Dog", "Cat", "Fish", "Cow"], 1],
        ["What colour is the cat?", ["Black", "Brown", "White", "Red"], 2],
        ["What does Tom give the cat?", ["Water only", "Milk", "Bread only", "Rice only"], 1],
        ["How often does Tom give milk?", ["Never", "Every day", "Once a year", "Only never"], 1],
      ],
    },
    {
      p: "Mia loves to draw. She has many crayons. Her favourite colour is blue.",
      qs: [
        ["Who loves to draw?", ["Mia", "A boy unnamed", "The crayon", "Blue"], 0],
        ["What does Mia have?", ["Only pens", "Many crayons", "No colours", "Only one stick"], 1],
        ["Favourite colour of Mia?", ["Red", "Green", "Blue", "Yellow"], 2],
        ["What does Mia love?", ["To sleep only", "To draw", "To hide crayons", "To run only"], 1],
        ["The passage is mainly about:", ["Mia and drawing", "A football match", "Cooking rice", "A bus ride"], 0],
      ],
    },
    {
      p: "Ravi goes to school by bus. His school is near the park. He likes his teacher.",
      qs: [
        ["How does Ravi go to school?", ["By bus", "By plane", "By boat only", "He never goes"], 0],
        ["Where is the school?", ["Far in space", "Near the park", "Under the sea", "On the Moon"], 1],
        ["Whom does Ravi like?", ["Only the bus", "His teacher", "Only the park gate", "A stranger"], 1],
        ["Ravi is a:", ["Teacher only", "Student / school boy", "Bus driver only", "Park"], 1],
        ["The park is:", ["Near his school", "On another planet", "Inside the bus", "Only a dream"], 0],
      ],
    },
    {
      p: "Anita has a red balloon. The balloon is big. She plays with it in the garden.",
      qs: [
        ["Who has a balloon?", ["Anita", "A boy", "The garden", "No one"], 0],
        ["What colour is the balloon?", ["Blue", "Red", "Green", "Black"], 1],
        ["The balloon is:", ["Small", "Big", "Broken only", "Square metal"], 1],
        ["Where does she play?", ["In the garden", "In the sea", "On the Moon", "In a bus only"], 0],
        ["What does Anita play with?", ["A ball only", "A red balloon", "A car only", "A book only"], 1],
      ],
    },
    {
      p: "Kiran has a little puppy. The puppy is brown. It likes to run and play.",
      qs: [
        ["Who has a puppy?", ["Kiran", "A teacher only", "The brown colour", "No one"], 0],
        ["What colour is the puppy?", ["White", "Brown", "Black only", "Blue"], 1],
        ["The puppy likes to:", ["Sleep only forever", "Run and play", "Read books", "Drive a car"], 1],
        ["The puppy is:", ["Big horse", "Little", "A cat", "A bird"], 1],
        ["A puppy is a baby:", ["Cat", "Dog", "Cow", "Hen"], 1],
      ],
    },
  ];
}

function engSWE() {
  return [
    Q(1, "Choose the polite word: ___ you help me?", ["Hey", "Please", "Go", "No"], 1, "Spoken and Written Expression"),
    Q(1, "Best reply to 'How are you?':", ["I am fine, thank you.", "I am a cat.", "Go away always.", "Blue."], 0, "Spoken and Written Expression"),
    Q(1, "When you meet your teacher in the morning, you say:", ["Good morning", "Good night", "Go home", "Bye forever"], 0, "Spoken and Written Expression"),
    Q(1, "Choose the correct sentence:", ["i like mangoes.", "I like mangoes.", "like I mangoes.", "Mangoes I."], 1, "Spoken and Written Expression"),
    Q(1, "To ask for a pencil politely:", ["Give pencil now!", "May I borrow a pencil, please?", "Pencil!", "You must."], 1, "Spoken and Written Expression"),
    Q(1, "Reply to 'Thank you':", ["Sorry", "You are welcome.", "Go away.", "No thank."], 1, "Spoken and Written Expression"),
    Q(1, "When someone says 'Sorry', you may say:", ["Thank you only", "It's okay. / No problem.", "Good night always", "I am a book."], 1, "Spoken and Written Expression"),
    Q(1, "Correct sentence:", ["she has a doll.", "She has a doll.", "has she doll a.", "Doll she has."], 1, "Spoken and Written Expression"),
    Q(1, "To greet a friend you can say:", ["Goodbye forever only", "Hello!", "Sleep now always", "I am angry always"], 1, "Spoken and Written Expression"),
    Q(1, "Polite way to leave class:", ["I go.", "May I go out, please?", "Out!", "You move."], 1, "Spoken and Written Expression"),
    Q(1, "Best way to ask name:", ["Name!", "What is your name?", "You tell.", "Go."], 1, "Spoken and Written Expression"),
    Q(1, "When you receive a gift, you say:", ["Nothing", "Thank you!", "I hate it always", "Give more now"], 1, "Spoken and Written Expression"),
    Q(1, "Correct sentence:", ["we are happy.", "We are happy.", "are we happy we.", "Happy we are are."], 1, "Spoken and Written Expression"),
    Q(1, "On your birthday friends say:", ["Happy birthday!", "Good night only", "Go to sleep only", "Sorry always"], 0, "Spoken and Written Expression"),
    Q(1, "To join a game politely:", ["Move!", "May I play with you?", "I take ball.", "You out."], 1, "Spoken and Written Expression"),
    Q(1, "If you need help, you say:", ["Help me, please.", "I never need.", "Go.", "You wrong."], 0, "Spoken and Written Expression"),
    Q(1, "Correct sentence:", ["my name is ram.", "My name is Ram.", "name my ram is.", "Ram is name my."], 1, "Spoken and Written Expression"),
    Q(1, "To share a toy you can say:", ["Only mine forever", "We can share.", "You never touch.", "I break it."], 1, "Spoken and Written Expression"),
    Q(1, "After finishing food you may say:", ["More noise", "Thank you. It was nice.", "I throw plate.", "Bad always"], 1, "Spoken and Written Expression"),
    Q(1, "Best line when you meet someone new:", ["Who you?", "Hello! My name is ...", "Go away.", "I take your bag."], 1, "Spoken and Written Expression"),
    Q(1, "If you break something by mistake:", ["Hide always", "Say sorry.", "Blame a friend", "Laugh only"], 1, "Spoken and Written Expression"),
    Q(1, "Correct sentence:", ["this is my bag.", "This is my bag.", "bag my is this.", "Is bag this my."], 1, "Spoken and Written Expression"),
    Q(1, "In a library we should:", ["Shout loudly", "Speak softly / stay quiet", "Run and jump", "Tear books"], 1, "Spoken and Written Expression"),
    Q(1, "To wish someone going to sleep:", ["Good morning", "Good night", "Happy birthday only", "Let's race"], 1, "Spoken and Written Expression"),
    Q(1, "When the teacher enters, students often say:", ["Good morning / Hello, teacher", "Go out", "Sit down teacher now", "Bye"], 0, "Spoken and Written Expression"),
  ];
}

function englishPapers() {
  const wsk = engWSK();
  const passages = engReadingPassages();
  const swe = engSWE();
  const papers = [];
  for (let p = 0; p < 5; p++) {
    const ws = take(wsk, 30, p, 0);
    const pass = passages[p % passages.length];
    const reading = pass.qs.map(([q, opts, a], i) =>
      Q(0, `Read and answer:\n"${pass.p}"\n\n${q}`, opts, a, "Reading")
    );
    const sw = take(swe, 5, p, 1);
    papers.push(pack([...ws, ...reading, ...sw]));
  }
  return papers;
}

// ─── COMPUTER ───────────────────────────────────────────────
function compLR() {
  return [
    Q(1, "What comes next? 1, 2, 3, 4, __", ["5", "6", "0", "9"], 0, "Logical Reasoning"),
    Q(1, "Odd one out: Keyboard, Mouse, Monitor, Banana", ["Keyboard", "Mouse", "Monitor", "Banana"], 3, "Logical Reasoning"),
    Q(1, "Pattern: click, type, click, type, __", ["click", "sleep", "eat", "run"], 0, "Logical Reasoning"),
    Q(1, "Which is different? Red, Blue, Green, Computer", ["Red", "Blue", "Green", "Computer"], 3, "Logical Reasoning"),
    Q(1, "Next: A, B, C, D, __", ["E", "F", "Z", "A"], 0, "Logical Reasoning"),
    Q(1, "Odd one out: Printer, Scanner, Monitor, Mango", ["Printer", "Scanner", "Monitor", "Mango"], 3, "Logical Reasoning"),
    Q(1, "Pattern: on, off, on, off, __", ["on", "paint", "eat", "run"], 0, "Logical Reasoning"),
    Q(1, "Big is to small as tall is to:", ["Short", "High", "Long only", "Wide only"], 0, "Logical Reasoning"),
    Q(1, "Next number: 2, 4, 6, 8, __", ["9", "10", "12", "7"], 1, "Logical Reasoning"),
    Q(1, "Odd one out: CPU, RAM, ROM, Tree", ["CPU", "RAM", "ROM", "Tree"], 3, "Logical Reasoning"),
    Q(1, "Left is opposite of:", ["Right", "Up only", "Down only", "Front only"], 0, "Logical Reasoning"),
    Q(1, "Next: red, green, red, green, __", ["red", "blue only", "yellow only", "black only"], 0, "Logical Reasoning"),
    Q(1, "Odd one out: Paint, Word, Notepad, Banana", ["Paint", "Word", "Notepad", "Banana"], 3, "Logical Reasoning"),
    Q(1, "Full is opposite of:", ["Empty", "More", "Lots", "Big"], 0, "Logical Reasoning"),
    Q(1, "Next: 10, 20, 30, 40, __", ["50", "45", "60", "41"], 0, "Logical Reasoning"),
  ];
}

function compMain() {
  return [
    Q(1, "A computer is a:", ["Machine that works with information", "Living animal", "Type of food", "Plant"], 0, "Computers and IT"),
    Q(1, "We see things on the:", ["Monitor / screen", "Only mouse under table", "Only wire", "Only speaker always"], 0, "Computers and IT"),
    Q(1, "We type letters using the:", ["Monitor", "Keyboard", "Speaker", "UPS only"], 1, "Computers and IT"),
    Q(1, "A mouse helps us to:", ["Point and click", "Only cook food", "Only wash clothes", "Only fly"], 0, "Computers and IT"),
    Q(1, "To start a computer we usually press the:", ["Power button", "Only mouse wheel forever", "Only space never", "Monitor glass"], 0, "Computers and IT"),
    Q(1, "CPU is often called the __ of the computer.", ["Brain", "Eye only", "Shoe", "Tail"], 0, "Computers and IT"),
    Q(1, "We should not touch the computer with:", ["Clean dry hands carefully", "Wet hands", "Soft dry cloth gently when off", "Care"], 1, "Computers and IT"),
    Q(1, "Paint (drawing program) is used to:", ["Draw and colour", "Only wash cars", "Only cook", "Only sleep"], 0, "Computers and IT"),
    Q(1, "A printer is used to:", ["Print on paper", "Only type letters on screen", "Only cool the room", "Only play music always"], 0, "Computers and IT"),
    Q(1, "Speakers help us to hear:", ["Sound from the computer", "Only smell", "Only taste", "Only touch"], 0, "Computers and IT"),
    Q(1, "The long bar for space on the keyboard is the:", ["Spacebar", "Enter only", "Escape only", "Mouse"], 0, "Computers and IT"),
    Q(1, "We should sit __ while using a computer.", ["Straight and comfortably", "Too close nose to screen", "On the table top always", "With wet hands"], 0, "Computers and IT"),
    Q(1, "A laptop is a computer that is:", ["Easy to carry", "Only as big as a room always", "A type of fruit", "Only a mouse"], 0, "Computers and IT"),
    Q(1, "Turning the computer off the right way is called:", ["Proper power-off / " + ("shut"+"down"), "Only kick", "Only unplug roughly always", "Paint"], 0, "Computers and IT"),
    Q(1, "Icons on the screen are small:", ["Pictures / symbols for programs", "Only real animals", "Only foods", "Only clouds outside"], 0, "Computers and IT"),
    Q(1, "We use computers in:", ["Schools, homes and many places", "Only underwater always", "Only space never on Earth", "Nowhere"], 0, "Computers and IT"),
    Q(1, "Do not hit or bang the:", ["Keyboard and mouse", "Only soft pillow", "Only open air", "Only paper book gently"], 0, "Computers and IT"),
    Q(1, "The blinking mark where we type is the:", ["Cursor", "Printer", "Speaker", "UPS"], 0, "Computers and IT"),
    Q(1, "Enter key is used to:", ["Go to next line / confirm", "Only draw circles", "Only shut eyes", "Only eat"], 0, "Computers and IT"),
    Q(1, "A tablet is a:", ["Touch-screen computer device", "Only a medicine always here", "Only a chair", "Only a pen"], 0, "Computers and IT"),
    Q(1, "Password should be:", ["Kept secret", "Told to all strangers", "Written on the door always", "Shared on loudspeaker"], 0, "Computers and IT"),
    Q(1, "We should take breaks so our eyes:", ["Get rest", "Get more tired always", "Touch the screen", "Close forever"], 0, "Computers and IT"),
    Q(1, "Games on computer should be played:", ["For limited time with adult rules", "All day and night only", "Instead of all food", "With wet hands"], 0, "Computers and IT"),
    Q(1, "Computer works on:", ["Electricity / power", "Only water", "Only wind inside always", "Only sunlight as plant"], 0, "Computers and IT"),
    Q(1, "Double-click often means pressing mouse button:", ["Two times quickly", "Ten times", "Never", "Only with foot"], 0, "Computers and IT"),
    Q(1, "To open a program we can click its:", ["Icon", "Only wall", "Only floor", "Only bag"], 0, "Computers and IT"),
    Q(1, "Keep food and drinks __ the computer.", ["Away from", "On top of keyboard always", "Inside CPU", "On the screen"], 0, "Computers and IT"),
    Q(1, "A file is a collection of:", ["Information saved on computer", "Only real paper always here", "Only water", "Only sand"], 0, "Computers and IT"),
    Q(1, "Delete / Backspace keys help to:", ["Erase text", "Only draw stars", "Only start car", "Only cook"], 0, "Computers and IT"),
    Q(1, "A folder is used to:", ["Keep files organised", "Only keep real clothes always here", "Only cook rice", "Only wash hands"], 0, "Computers and IT"),
    Q(1, "USB pen drive is used to:", ["Carry files from one computer to another", "Only eat as food", "Only draw on paper with ink only", "Only cool tea"], 0, "Computers and IT"),
    Q(1, "Caps Lock is used for:", ["Typing capital letters", "Only drawing", "Only volume", "Only mouse speed"], 0, "Computers and IT"),
    Q(1, "A touchpad on a laptop works like a:", ["Mouse", "Monitor only", "Printer only", "Speaker only"], 0, "Computers and IT"),
    Q(1, "Smartphone is a kind of:", ["Small computer / smart device", "Only a book always", "Only a fruit", "Only a shoe"], 0, "Computers and IT"),
    Q(1, "Ask an adult before:", ["Opening unknown sites or downloads", "Drawing in Paint with permission", "Typing your name in class task", "Using known school app with teacher"], 0, "Computers and IT"),
    Q(1, "Parts of a computer work:", ["Together", "Never", "Only on Moon", "Only underwater always"], 0, "Computers and IT"),
    Q(1, "Saving work means:", ["Keeping it so we can open later", "Deleting forever always", "Printing only once never save", "Turning wet"], 0, "Computers and IT"),
    Q(1, "A program / software tells the computer:", ["What to do", "Only to become a plant", "Only to melt", "Only to fly alone"], 0, "Computers and IT"),
    Q(1, "Shift key helps to type:", ["Capital letters / symbols", "Only spaces forever", "Only power-off", "Only mouse click"], 0, "Computers and IT"),
    Q(1, "Internet safety for kids: talk to __ about problems online.", ["Parents / teachers", "Only strangers always", "Only unknown chat friends", "No one ever"], 0, "Computers and IT"),
    Q(1, "A computer lab is a place with:", ["Many computers for learning", "Only beds", "Only kitchen stoves", "Only playground swings"], 0, "Computers and IT"),
    Q(1, "Restart means:", ["Start the computer again", "Only paint red", "Only remove keyboard", "Only sleep under table"], 0, "Computers and IT"),
    Q(1, "Hardware means:", ["Physical parts you can touch", "Only thoughts", "Only songs without device", "Only dreams"], 0, "Computers and IT"),
    Q(1, "Software means:", ["Programs and apps", "Only the plastic box", "Only the wire copper", "Only the table"], 0, "Computers and IT"),
    Q(1, "Personal information like address should:", ["Not be shared online with strangers", "Be told to every chat", "Be written on public walls online", "Be given for free gifts always from unknown"], 0, "Computers and IT"),
    Q(1, "If you see something scary online, you should:", ["Tell a trusted adult", "Keep it secret always", "Click more unknown links", "Share with all strangers"], 0, "Computers and IT"),
    Q(1, "Keep the computer area:", ["Tidy and dry", "Full of water spills", "Full of food crumbs on keys", "Dark dusty always messy"], 0, "Computers and IT"),
    Q(1, "A browser is a program to:", ["Open websites (with guidance)", "Only wash clothes", "Only fry food", "Only cut paper"], 0, "Computers and IT"),
    Q(1, "Wi-Fi lets devices connect to:", ["Internet without cable sometimes", "Only river water", "Only school bell wire only", "Only kite string"], 0, "Computers and IT"),
    Q(1, "Backspace removes letters to the:", ["Left of the cursor", "Only right always never left", "Only printer tray", "Only moon"], 0, "Computers and IT"),
  ];
}

function compAch() {
  return [
    Q(1, "Which part shows pictures and words?", ["Monitor", "Only CPU box closed always", "Only mouse pad", "Only wire"], 0, "Achievers Section", 2),
    Q(1, "To draw a circle in Paint we may use a:", ["Shape / ellipse tool", "Only power button", "Only printer off", "Only UPS switch"], 0, "Achievers Section", 2),
    Q(1, "CPU often means:", ["Central Processing Unit", "Cat Play Unit", "Cool Pen Umbrella", "Cup Plate Under"], 0, "Achievers Section", 2),
    Q(1, "Which is an input device?", ["Keyboard", "Monitor only as output", "Speaker only as output", "Printer only as output"], 0, "Achievers Section", 2),
    Q(1, "Which device prints on paper?", ["Printer", "Mouse", "Keyboard", "Speaker"], 0, "Achievers Section", 2),
    Q(1, "Monitor is mainly an __ device.", ["Output (shows result)", "Only input always never show", "Only food", "Only cloth"], 0, "Achievers Section", 2),
    Q(1, "Which stores a lot of data inside the computer box?", ["Hard disk / storage", "Only mouse pad", "Only screen glass", "Only speaker cloth"], 0, "Achievers Section", 2),
    Q(1, "QWERTY is a layout of the:", ["Keyboard", "Monitor only", "Printer ink", "Mouse cable colour"], 0, "Achievers Section", 2),
    Q(1, "Which is mostly an output device?", ["Speaker", "Keyboard", "Mouse", "Microphone"], 0, "Achievers Section", 2),
    Q(1, "RAM is a type of computer:", ["Memory", "Screen only", "Printer only", "Mouse only"], 0, "Achievers Section", 2),
    Q(1, "Which device is mainly for pointing?", ["Mouse", "Monitor", "Speaker", "Printer"], 0, "Achievers Section", 2),
    Q(1, "Input devices send data __ the computer.", ["Into", "Only out never in", "Only beside always", "Only above clouds"], 0, "Achievers Section", 2),
    Q(1, "The main circuit board is often called the:", ["Motherboard", "Mother mouse", "Father printer", "Sister speaker"], 0, "Achievers Section", 2),
    Q(1, "To copy text we often use Copy and then:", ["Paste", "Only power-off", "Only delete PC", "Only unplug roughly"], 0, "Achievers Section", 2),
    Q(1, "LED/LCD are types of:", ["Screens / monitors", "Only keyboards", "Only mouse pads", "Only printers ink only"], 0, "Achievers Section", 2),
    Q(1, "Keyboard is an __ device.", ["Input", "Only output always", "Only storage fridge", "Only power plant"], 0, "Achievers Section", 2),
    Q(1, "Pixels are tiny dots that make:", ["Pictures on the screen", "Only sounds", "Only smells", "Only keyboard clicks taste"], 0, "Achievers Section", 2),
    Q(1, "UPS helps give power for a short time when:", ["Electricity goes off", "Only mouse is clicked", "Only Paint opens", "Only icon moves"], 0, "Achievers Section", 2),
    Q(1, "To undo a mistake in many programs use:", ["Undo command", "Only break the PC", "Only pour water", "Only shout"], 0, "Achievers Section", 2),
    Q(1, "We should not share our school login password with:", ["Strangers / unknown people", "Only our parent when needed carefully", "Teacher when asked properly", "Nobody including parents ever"], 0, "Achievers Section", 2),
  ];
}

function computerPapers() {
  return [0,1,2,3,4].map((p) =>
    pack([...take(compLR(),5,p), ...take(compMain(),25,p,1), ...take(compAch(),5,p,2)])
  );
}

// ─── GK ─────────────────────────────────────────────────────
function gkGA() {
  return [
    Q(1, "How many colours are in the Indian flag?", ["2", "3", "4", "5"], 1, "General Awareness"),
    Q(1, "The capital of India is:", ["Mumbai", "New Delhi", "Kolkata", "Chennai"], 1, "General Awareness"),
    Q(1, "National animal of India is:", ["Lion", "Tiger", "Elephant", "Cow"], 1, "General Awareness"),
    Q(1, "National bird of India is:", ["Crow", "Peacock", "Sparrow", "Parrot"], 1, "General Awareness"),
    Q(1, "National flower of India is:", ["Rose", "Lotus", "Sunflower", "Lily"], 1, "General Awareness"),
    Q(1, "We celebrate Diwali as the festival of:", ["Colours", "Lights", "Kites only", "Only rain"], 1, "General Awareness"),
    Q(1, "Holi is the festival of:", ["Lights", "Colours", "Only lamps", "Only snow"], 1, "General Awareness"),
    Q(1, "A doctor helps us when we are:", ["Hungry only", "Sick", "Only sleepy", "Only playing"], 1, "General Awareness"),
    Q(1, "A teacher works in a:", ["Hospital only", "School", "Only fire station", "Only farm always"], 1, "General Awareness"),
    Q(1, "The Sun rises in the:", ["West", "East", "North", "South"], 1, "General Awareness"),
    Q(1, "We get milk from:", ["Hen", "Cow", "Crow", "Fish"], 1, "General Awareness"),
    Q(1, "There are __ days in a week.", ["5", "6", "7", "8"], 2, "General Awareness"),
    Q(1, "Our national flag's top colour is:", ["Green", "White", "Saffron (orange)", "Blue only"], 2, "General Awareness"),
    Q(1, "Postman brings us:", ["Letters", "Only haircuts", "Only medicines always", "Only fire"], 0, "General Awareness"),
    Q(1, "The Moon is seen mainly at:", ["Noon only", "Night", "Only underground", "Only in cupboard"], 1, "General Awareness"),
    Q(1, "A firefighter puts out:", ["Fire", "Only flowers", "Only music", "Only rain"], 0, "General Awareness"),
    Q(1, "India is our:", ["City only", "Country", "Only village street", "Only school bag"], 1, "General Awareness"),
    Q(1, "We should throw rubbish in a:", ["Dustbin", "River always", "Road middle", "Friend's desk"], 0, "General Awareness"),
    Q(1, "Green colour is at the __ of the Indian flag.", ["Top", "Middle", "Bottom", "Nowhere"], 2, "General Awareness"),
    Q(1, "People of India are called:", ["Indians", "Only aliens", "Only robots", "Only birds"], 0, "General Awareness"),
    Q(1, "Christmas is celebrated in the month of:", ["December", "June only", "March only", "August only"], 0, "General Awareness"),
    Q(1, "Eid is a festival celebrated by many with:", ["Prayers and sweets / joy", "Only flying jets", "Only exams", "Only silence forever"], 0, "General Awareness"),
    Q(1, "A nurse helps the:", ["Doctor and patients", "Only bus driver only", "Only pilot only", "Only chef only"], 0, "General Awareness"),
    Q(1, "A farmer grows:", ["Crops / food", "Only computers", "Only cars", "Only rockets"], 0, "General Awareness"),
    Q(1, "The Sun sets in the:", ["East", "West", "North only", "South only"], 1, "General Awareness"),
    Q(1, "Eggs come mainly from:", ["Hen", "Cow only", "Goat only", "Sheep wool"], 0, "General Awareness"),
    Q(1, "There are __ months in a year.", ["10", "11", "12", "13"], 2, "General Awareness"),
    Q(1, "Traffic light red means:", ["Go", "Stop", "Wait only always green", "Fly"], 1, "General Awareness"),
    Q(1, "White colour is in the __ of the flag.", ["Top", "Middle", "Bottom", "Outside border only"], 1, "General Awareness"),
    Q(1, "A pilot flies a:", ["Plane", "Only boat always", "Only bicycle always", "Only train only"], 0, "General Awareness"),
    Q(1, "Stars twinkle at:", ["Night", "Only noon always", "Only underground", "Only in closed box"], 0, "General Awareness"),
    Q(1, "Police help to keep us:", ["Safe", "Only afraid always", "Only lost", "Only hungry"], 0, "General Awareness"),
    Q(1, "Our Earth is a:", ["Planet", "Star like Sun exactly", "Only moon of Mars", "Only satellite dish"], 0, "General Awareness"),
    Q(1, "Primary colours include red, yellow and:", ["Blue", "Black only", "White only", "Brown only"], 0, "General Awareness"),
    Q(1, "A rainbow appears often after:", ["Rain with sun", "Only midnight always", "Only underground", "Only in closed room always"], 0, "General Awareness"),
    Q(1, "Saffron colour is at the __ of the flag.", ["Top", "Bottom", "Only middle chakra", "Nowhere"], 0, "General Awareness"),
    Q(1, "Honey comes from:", ["Bees", "Cows", "Hens", "Goats"], 0, "General Awareness"),
    Q(1, "Green traffic light means:", ["Go (when safe)", "Stop always", "Sleep", "Jump"], 0, "General Awareness"),
    Q(1, "The wheel in the centre of the flag is:", ["Ashoka Chakra (navy blue)", "A flower", "A tiger", "A mango"], 0, "General Awareness"),
    Q(1, "The Taj Mahal is in:", ["Agra (India)", "Only London always", "Only New York always", "Only Antarctica"], 0, "General Awareness"),
    Q(1, "How many spokes are in the Ashoka Chakra (often taught)?", ["12", "24", "36", "8"], 1, "General Awareness"),
    Q(1, "Wool comes from:", ["Sheep", "Hen", "Fish", "Crow"], 0, "General Awareness"),
    Q(1, "Zebra crossing is for:", ["People to cross safely", "Only cars to race", "Only animals zoo only", "Only trains"], 0, "General Awareness"),
    Q(1, "The Himalayas are:", ["Mountains", "Oceans", "Deserts only", "Rivers only"], 0, "General Awareness"),
    Q(1, "Our national anthem is:", ["Jana Gana Mana", "Only a film song always", "Only ABC song only", "Only birthday song only"], 0, "General Awareness"),
    Q(1, "India is in the continent of:", ["Asia", "Africa only", "Europe only", "Australia only"], 0, "General Awareness"),
    Q(1, "A map helps us to find:", ["Places", "Only tastes", "Only smells", "Only dreams only"], 0, "General Awareness"),
    Q(1, "January is the __ month of the year.", ["First", "Last", "Middle only", "Fifth only"], 0, "General Awareness"),
    Q(1, "National fruit of India is often taught as:", ["Apple", "Mango", "Grapes", "Orange"], 1, "General Awareness"),
    Q(1, "Peacock has a beautiful:", ["Tail / feathers", "Only fins", "Only horns like cow always", "Only shell"], 0, "General Awareness"),
  ];
}

function gkCA() {
  return [
    Q(1, "Children go to school to:", ["Learn and play fairly", "Only sleep all day", "Only fight", "Avoid friends always"], 0, "Current Affairs"),
    Q(1, "Planting more trees is good for:", ["Our Earth and air", "Only making noise", "Only blocking all sun forever badly", "Only hiding rubbish"], 0, "Current Affairs"),
    Q(1, "Saying no to plastic bags helps:", ["Keep Earth clean", "Make more trash only", "Block all shopping forever", "Stop all food"], 0, "Current Affairs"),
    Q(1, "Drinking water from a clean bottle at school is:", ["A healthy habit", "Useless", "Harmful always", "Only for teachers"], 0, "Current Affairs"),
    Q(1, "Keeping our city clean is everyone's:", ["Duty / good work", "Only mayor never us", "Useless idea", "Only robots' job never us"], 0, "Current Affairs"),
    Q(1, "Exercise and yoga help children stay:", ["Healthy and fit", "Only weak", "Only angry", "Only sleepy forever"], 0, "Current Affairs"),
    Q(1, "Using a dustbin in parks keeps places:", ["Clean", "Dirtier", "Full of germs more", "Ugly always better"], 0, "Current Affairs"),
    Q(1, "Reading story books is a:", ["Good habit", "Bad habit", "Waste always", "Only for babies never"], 0, "Current Affairs"),
    Q(1, "Helping elders at home is:", ["Kind and good", "Useless", "Rude", "Only for others never us"], 0, "Current Affairs"),
    Q(1, "Saying no to crackers' loud smoke is good for:", ["Air and health / animals", "More pollution only", "Only more noise forever", "Hurting birds more"], 0, "Current Affairs"),
    Q(1, "Wearing clean school uniform shows:", ["Discipline and neatness", "Dirt pride", "Carelessness only", "Rudeness"], 0, "Current Affairs"),
    Q(1, "Being kind to animals means we do not:", ["Hurt them", "Feed birds carefully ever", "Watch them kindly ever", "Learn about them ever"], 0, "Current Affairs"),
    Q(1, "Road safety week teaches us to:", ["Follow traffic rules", "Run on highways", "Ignore signals", "Play on tracks"], 0, "Current Affairs"),
    Q(1, "Saving paper means we:", ["Use both sides / don't waste", "Tear more books", "Throw clean sheets always", "Cut trees more"], 0, "Current Affairs"),
    Q(1, "Saying no to bullying means we:", ["Are kind and tell a teacher if needed", "Hurt weaker kids", "Laugh at others' pain", "Hide and never help"], 0, "Current Affairs"),
    Q(1, "A balanced tiffin has:", ["Healthy food variety", "Only candy always", "Only chips always", "Only soda always"], 0, "Current Affairs"),
    Q(1, "Respecting the national anthem means we:", ["Stand quietly with respect", "Talk loudly over it", "Sit and play games over it", "Run out always"], 0, "Current Affairs"),
    Q(1, "Using steel bottle instead of many plastic bottles helps:", ["Reduce plastic waste", "Make more plastic", "Pollute more always", "Nothing good"], 0, "Current Affairs"),
    Q(1, "Greeting 'Namaste' is a way of showing:", ["Respect in India", "Anger only", "Fear only", "Rudeness"], 0, "Current Affairs"),
    Q(1, "Eating fruits daily is:", ["Healthy", "Harmful always", "Only for monkeys never kids", "Useless"], 0, "Current Affairs"),
  ];
}

function gkLS() {
  return [
    Q(1, "When someone gives you something, you say:", ["Thank you", "Give more now", "I don't care", "Go away"], 0, "Life Skills"),
    Q(1, "We should share our toys with:", ["Friends kindly", "Nobody ever", "Only break them", "Only hide forever"], 0, "Life Skills"),
    Q(1, "If you make a mistake, you should:", ["Say sorry", "Blame others always", "Hide forever", "Shout"], 0, "Life Skills"),
    Q(1, "Before eating we should:", ["Wash hands", "Play in mud", "Never clean", "Run with full mouth"], 0, "Life Skills"),
    Q(1, "We must listen to our:", ["Parents and teachers", "Only strangers always", "Only TV loudly always", "Nobody"], 0, "Life Skills"),
    Q(1, "Please and thank you are words of:", ["Good manners", "Anger only", "Fighting", "Rudeness"], 0, "Life Skills"),
    Q(1, "We stand in a __ in the school assembly.", ["Line / queue", "Mess only", "Fight circle", "Running race always"], 0, "Life Skills"),
    Q(1, "If a friend is sad, we should:", ["Comfort them kindly", "Laugh at them", "Ignore always", "Take their things"], 0, "Life Skills"),
    Q(1, "We must tell the truth and not:", ["Lie", "Share toys", "Say please", "Help others"], 0, "Life Skills"),
    Q(1, "Brushing teeth is done:", ["Morning and night (good habit)", "Never", "Only once a year", "Only with mud"], 0, "Life Skills"),
    Q(1, "Covering mouth when we cough is:", ["Good manners / hygiene", "Rude", "Useless", "Only for adults never kids"], 0, "Life Skills"),
    Q(1, "We wait for our turn — this is called:", ["Patience / queue manners", "Pushing always", "Shouting first", "Breaking line always"], 0, "Life Skills"),
    Q(1, "Borrowing a pencil, we should:", ["Return it and say thanks", "Keep it forever secretly", "Break it", "Throw it"], 0, "Life Skills"),
    Q(1, "Fighting and hitting friends is:", ["Wrong", "Always right", "The only game", "Teacher's wish"], 0, "Life Skills"),
    Q(1, "Sleeping early helps us:", ["Feel fresh next day", "Feel more tired always", "Miss all sun forever better", "Skip school better"], 0, "Life Skills"),
    Q(1, "Greeting guests at home with a smile is:", ["Good manners", "Rude", "Useless", "Only for others never us"], 0, "Life Skills"),
    Q(1, "Keeping our room tidy is a sign of:", ["Responsibility", "Laziness pride", "Carelessness only", "Anger only"], 0, "Life Skills"),
    Q(1, "If we borrow a book from library we must:", ["Return on time carefully", "Tear pages", "Write all over roughly", "Lose it happily"], 0, "Life Skills"),
    Q(1, "Helping a classmate who fell is:", ["Kindness", "Waste", "Foolish always", "Only teacher's job never peer"], 0, "Life Skills"),
    Q(1, "Screen time should be:", ["Limited as parents say", "Unlimited 24 hours", "Instead of all sleep", "Instead of all meals"], 0, "Life Skills"),
  ];
}

function gkAch() {
  return [
    Q(1, "The Ashoka Chakra on the flag is in the __ band.", ["Saffron", "White", "Green", "Outside only"], 1, "Achievers Section", 2),
    Q(1, "Republic Day of India is on:", ["15 August", "26 January", "2 October", "14 November"], 1, "Achievers Section", 2),
    Q(1, "Who is known as the Father of the Nation (India)?", ["Jawaharlal Nehru", "Mahatma Gandhi", "A teacher only", "A doctor only"], 1, "Achievers Section", 2),
    Q(1, "We should cross the road with:", ["An adult and at a safe place", "Eyes closed alone mid-road", "Running between cars", "Looking at phone only"], 0, "Achievers Section", 2),
    Q(1, "Independence Day of India is on:", ["26 January", "15 August", "2 October", "1 January"], 1, "Achievers Section", 2),
    Q(1, "The tricolour flag is also called:", ["Tiranga", "Only blue flag", "Only black flag", "Only one colour cloth"], 0, "Achievers Section", 2),
    Q(1, "Children's Day in India is on 14 November, related to:", ["Jawaharlal Nehru (Chacha Nehru)", "Only a cartoon never person", "Only a tree", "Only a river"], 0, "Achievers Section", 2),
    Q(1, "Gandhi Jayanti is on:", ["2 October", "15 August", "26 January", "14 November"], 0, "Achievers Section", 2),
    Q(1, "The currency of India is the:", ["Rupee", "Dollar only", "Only yen", "Only pound only"], 0, "Achievers Section", 2),
    Q(1, "The Ganga is a holy:", ["River", "Mountain only", "Desert only", "Ocean name only"], 0, "Achievers Section", 2),
    Q(1, "If you get lost, you should:", ["Stay calm and ask a trusted helper / police / guard", "Go with any stranger offering gifts", "Cry and run into traffic", "Hide forever without telling"], 0, "Achievers Section", 2),
    Q(1, "The national tree of India is often taught as:", ["Banyan", "Only cactus desert always", "Only pine only polar", "Only underwater weed"], 0, "Achievers Section", 2),
    Q(1, "Cricket is a popular:", ["Sport in India", "Only food dish", "Only mountain", "Only river"], 0, "Achievers Section", 2),
    Q(1, "The Indian Ocean is to the __ of India.", ["South", "Only north polar always", "Only inside landlocked always", "Only moon side"], 0, "Achievers Section", 2),
    Q(1, "Good touch / bad touch: if uncomfortable, you should:", ["Tell a trusted adult", "Keep secret always", "Go with strangers", "Stay silent forever"], 0, "Achievers Section", 2),
    Q(1, "National fruit of India is often taught as:", ["Apple", "Mango", "Grapes", "Orange"], 1, "Achievers Section", 2),
    Q(1, "The Arabian Sea is to the __ of India.", ["West", "Only east always", "Only north pole", "Only centre land only"], 0, "Achievers Section", 2),
    Q(1, "If there is a fire drill at school, we should:", ["Follow teacher quietly to safe place", "Hide under desk with matches", "Run back for toys in smoke", "Lock ourselves alone in fear"], 0, "Achievers Section", 2),
    Q(1, "Dr. A.P.J. Abdul Kalam is remembered as a great:", ["Scientist / former President", "Only film actor always", "Only footballer only", "Only chef only"], 0, "Achievers Section", 2),
    Q(1, "Emergency: in trouble call a trusted adult or:", ["Helpline / police with adult help", "Only unknown chat friend", "Only stay silent forever", "Only hide without telling family"], 0, "Achievers Section", 2),
  ];
}

function gkPapers() {
  return [0,1,2,3,4].map((p) =>
    pack([
      ...take(gkGA(), 20, p, 0),
      ...take(gkCA(), 5, p, 1),
      ...take(gkLS(), 5, p, 2),
      ...take(gkAch(), 5, p, 3),
    ])
  );
}

function main() {
  const jobs = [
    { folder: "mathematics", subject: "Mathematics", papers: mathPapers(), count: 35, marks: 40 },
    { folder: "science", subject: "Science", papers: sciencePapers(), count: 35, marks: 40 },
    { folder: "english", subject: "English", papers: englishPapers(), count: 40, marks: 40 },
    { folder: "computer", subject: "Computer Science", papers: computerPapers(), count: 35, marks: 40 },
    { folder: "gk", subject: "General Knowledge", papers: gkPapers(), count: 35, marks: 40 },
  ];
  for (const job of jobs) {
    job.papers.forEach((p, i) => {
      const { marks, sections } = validate(p, job.count, job.marks);
      writePaper(job.folder, i + 1, { subject: job.subject, totalMarks: marks }, p.questions, p.answers);
      console.log(`Wrote class1/${job.folder} paper ${i + 1}: ${p.questions.length}Q, ${marks} marks | ${JSON.stringify(sections)}`);
    });
  }
  console.log("Done. Class 1 regenerated (original SOF-pattern practice, 2023-2025 style).");
}

main();

#!/usr/bin/env node
/**
 * Generate ORIGINAL Class 4 Olympiad practice papers aligned to SOF
 * 2023–2025 exam PATTERN and SYLLABUS (not copyrighted SOF questions).
 *
 * Patterns (Classes 3–4):
 *  IMO  : LR 10 + Mathematical 20 + Achievers 5 = 35Q / 40 marks
 *  NSO  : LR 5  + Science 25 + Achievers 5 = 35Q / 40 marks
 *  IEO  : Word&Structure 30 + Reading 5 + Spoken&Written 5 = 40Q / 40 marks? 
 *         Official IEO Class 3-4: Section-1 Word and Structure Knowledge 30,
 *         Section-2 Reading 5, Section-3 Spoken and Written Expression 5 = 40 Q, 40 marks
 *         (Some years show 35 — we use official 40Q / 40 marks with 1 mark each)
 *  ICSO : LR 5 + Computers 25 + Achievers 5 = 35Q / 40 marks
 *  IGKO : GA 20 + Current Affairs 5 + Life Skills 5 + Achievers 5 = 35Q / 40 marks
 *
 * Achievers are 2 marks for classes 3–4 (IMO/NSO/ICSO/IGKO):
 * 30×1 + 5×2 = 40 marks. IEO uses 40×1 = 40. App supports per-question marks.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "data", "class4");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writePaper(subjectFolder, paperNum, meta, questions, answers) {
  const qDir = path.join(ROOT, subjectFolder, "questions");
  const aDir = path.join(ROOT, subjectFolder, "answers");
  ensureDir(qDir);
  ensureDir(aDir);
  const qPath = path.join(qDir, `paper${paperNum}.json`);
  const aPath = path.join(aDir, `paper${paperNum}.json`);
  const payload = {
    class: 4,
    subject: meta.subject,
    paper: paperNum,
    title: `Class 4 ${meta.subject} — Paper ${paperNum}`,
    durationMinutes: 60,
    totalMarks: meta.totalMarks,
    patternNote:
      "Original practice paper aligned to SOF 2023–2025 Class 4 pattern & syllabus. Not an official SOF paper.",
    yearStyle: "2023-2025",
    questions,
  };
  fs.writeFileSync(qPath, JSON.stringify(payload, null, 2) + "\n");
  fs.writeFileSync(
    aPath,
    JSON.stringify(
      {
        class: 4,
        subject: meta.subject,
        paper: paperNum,
        answers,
      },
      null,
      2
    ) + "\n"
  );
}

function Q(id, question, options, answerIndex, section, marks = 1) {
  if (!Array.isArray(options) || options.length !== 4) {
    throw new Error(`Q${id}: need 4 options`);
  }
  if (answerIndex < 0 || answerIndex > 3) {
    throw new Error(`Q${id}: bad answer index`);
  }
  return {
    q: {
      id,
      question,
      options,
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
    q.id = i + 1;
    if (old !== String(q.id)) {
      answers[String(q.id)] = answers[old];
      delete answers[old];
    }
  });
  // rebuild answers cleanly
  const clean = {};
  questions.forEach((q, i) => {
    clean[String(q.id)] = items[i].a;
  });
  return { questions, answers: clean };
}

// ─────────────────────────────────────────────────────────────
// MATHEMATICS (IMO-style) — 5 unique papers
// ─────────────────────────────────────────────────────────────
function mathPapers() {
  const papers = [];

  // Paper 1
  papers.push(
    pack([
      // Logical Reasoning (10)
      Q(1, "Find the next number: 7, 14, 28, 56, __.", ["84", "98", "112", "70"], 2, "Logical Reasoning"),
      Q(2, "If CAT = 24 and DOG = 26, then BAT = ?", ["23", "22", "21", "20"], 0, "Logical Reasoning"),
      Q(3, "Which figure comes next in the pattern: ○ △ ○ △ ○ __?", ["○", "△", "□", "◇"], 1, "Logical Reasoning"),
      Q(4, "Ravi is taller than Meena. Meena is taller than Anu. Who is the shortest?", ["Ravi", "Meena", "Anu", "Cannot say"], 2, "Logical Reasoning"),
      Q(5, "Find the odd one out: 2, 3, 5, 7, 9, 11", ["3", "9", "7", "11"], 1, "Logical Reasoning"),
      Q(6, "Which is the mirror image of the letter 'b' (vertical mirror)?", ["d", "p", "q", "b"], 0, "Logical Reasoning"),
      Q(7, "Complete the series: 5, 10, 20, 40, __.", ["60", "70", "80", "90"], 2, "Logical Reasoning"),
      Q(8, "If Monday is coded as 2, Tuesday as 3, then Friday is coded as?", ["5", "6", "7", "4"], 1, "Logical Reasoning"),
      Q(9, "A is to the left of B. C is to the right of B. Who is in the middle?", ["A", "B", "C", "None"], 1, "Logical Reasoning"),
      Q(10, "Find the missing number: 3, 6, 12, 24, __, 96", ["36", "48", "42", "60"], 1, "Logical Reasoning"),
      // Mathematical Reasoning (20)
      Q(11, "The place value of 7 in 47,325 is:", ["7", "70", "700", "7,000"], 3, "Mathematical Reasoning"),
      Q(12, "Round 3,648 to the nearest hundred.", ["3,600", "3,700", "3,650", "4,000"], 0, "Mathematical Reasoning"),
      Q(13, "Which is the greatest: 9,087; 9,807; 9,780; 9,078?", ["9,087", "9,807", "9,780", "9,078"], 1, "Mathematical Reasoning"),
      Q(14, "Expand: 5,206 =", ["5000+200+6", "5000+20+6", "500+200+6", "5200+6"], 0, "Mathematical Reasoning"),
      Q(15, "3,456 + 2,789 = ?", ["6,245", "6,245", "6,245", "6,245"], 0, "Mathematical Reasoning"),
      Q(16, "8,000 − 3,456 = ?", ["4,544", "4,554", "5,544", "4,644"], 0, "Mathematical Reasoning"),
      Q(17, "25 × 16 = ?", ["300", "400", "350", "450"], 1, "Mathematical Reasoning"),
      Q(18, "A school has 1,248 students. 635 are girls. How many are boys?", ["613", "623", "603", "633"], 0, "Mathematical Reasoning"),
      Q(19, "Which fraction is equivalent to 1/2?", ["2/5", "3/6", "3/8", "2/6"], 1, "Mathematical Reasoning"),
      Q(20, "3/4 of 80 is:", ["40", "50", "60", "70"], 2, "Mathematical Reasoning"),
      Q(21, "0.5 + 0.25 = ?", ["0.7", "0.75", "0.8", "1.0"], 1, "Mathematical Reasoning"),
      Q(22, "A rectangle has length 12 cm and breadth 8 cm. Its perimeter is:", ["20 cm", "40 cm", "96 cm", "32 cm"], 1, "Mathematical Reasoning"),
      Q(23, "Area of a square of side 9 cm is:", ["18 cm²", "36 cm²", "81 cm²", "72 cm²"], 2, "Mathematical Reasoning"),
      Q(24, "How many minutes are there in 3 hours 20 minutes?", ["180", "200", "220", "240"], 1, "Mathematical Reasoning"),
      Q(25, "A pencil costs ₹12. Cost of 15 pencils is:", ["₹150", "₹160", "₹180", "₹170"], 2, "Mathematical Reasoning"),
      Q(26, "The Roman numeral for 49 is:", ["IL", "XLIX", "XXXXIX", "LIX"], 1, "Mathematical Reasoning"),
      Q(27, "Which is a factor of 36?", ["8", "10", "9", "14"], 2, "Mathematical Reasoning"),
      Q(28, "The HCF of 12 and 18 is:", ["2", "3", "6", "9"], 2, "Mathematical Reasoning"),
      Q(29, "LCM of 4 and 6 is:", ["10", "12", "18", "24"], 1, "Mathematical Reasoning"),
      Q(30, "A train covers 240 km in 4 hours. Its average speed is:", ["40 km/h", "50 km/h", "60 km/h", "70 km/h"], 2, "Mathematical Reasoning"),
      // Achievers (5) × 2 marks
      Q(31, "A number when divided by 6 leaves remainder 3. Which could be the number?", ["21", "24", "30", "36"], 0, "Achievers Section", 2),
      Q(32, "The sum of two numbers is 90 and their difference is 18. The larger number is:", ["36", "54", "45", "72"], 1, "Achievers Section", 2),
      Q(33, "A square field has perimeter 64 m. Its area is:", ["256 m²", "128 m²", "64 m²", "512 m²"], 0, "Achievers Section", 2),
      Q(34, "If 3/5 of a number is 45, the number is:", ["60", "75", "90", "15"], 1, "Achievers Section", 2),
      Q(35, "A shopkeeper buys 12 pens at ₹10 each and sells them at ₹15 each. Profit is:", ["₹40", "₹50", "₹60", "₹70"], 2, "Achievers Section", 2),
    ])
  );

  // Fix Q15 - all options same by mistake
  papers[0].questions[14].options = ["6,245", "6,145", "6,345", "5,245"];
  papers[0].answers["15"] = 0;

  // Paper 2
  papers.push(
    pack([
      Q(1, "Find the next: 11, 22, 33, 44, __.", ["54", "55", "56", "66"], 1, "Logical Reasoning"),
      Q(2, "If in a code TREE is written as USFF, how is LEAF written?", ["MFBG", "MFBH", "KEZG", "MFAG"], 0, "Logical Reasoning"),
      Q(3, "Odd one out: Circle, Triangle, Square, Cube", ["Circle", "Triangle", "Square", "Cube"], 3, "Logical Reasoning"),
      Q(4, "Which comes in the middle if arranged in ascending order: 45, 54, 39, 61, 28?", ["39", "45", "54", "28"], 1, "Logical Reasoning"),
      Q(5, "Pointing to a photo, Ria says, 'He is the son of my father's only son.' Who is he to Ria if she has one brother?", ["Brother", "Nephew", "Son", "Cousin"], 1, "Logical Reasoning"),
      Q(6, "Complete: AZ, BY, CX, __.", ["DW", "DV", "EW", "DU"], 0, "Logical Reasoning"),
      Q(7, "How many triangles are in a big triangle divided into 4 equal smaller triangles by joining midpoints?", ["4", "5", "6", "8"], 1, "Logical Reasoning"),
      Q(8, "If 1st January is Friday, what day is 8th January?", ["Friday", "Saturday", "Sunday", "Thursday"], 0, "Logical Reasoning"),
      Q(9, "Series: 2, 6, 12, 20, 30, __.", ["40", "42", "44", "36"], 1, "Logical Reasoning"),
      Q(10, "Which pair is different? (2,4), (3,9), (4,16), (5,20)", ["(2,4)", "(3,9)", "(4,16)", "(5,20)"], 3, "Logical Reasoning"),
      Q(11, "Write in numerals: Forty-five thousand six hundred eight", ["45,608", "45,680", "4,568", "45,068"], 0, "Mathematical Reasoning"),
      Q(12, "Successor of 9,999 is:", ["9,998", "10,000", "10,001", "9,000"], 1, "Mathematical Reasoning"),
      Q(13, "5,678 − 2,349 = ?", ["3,329", "3,319", "3,429", "3,339"], 0, "Mathematical Reasoning"),
      Q(14, "48 ÷ 6 = ?", ["6", "7", "8", "9"], 2, "Mathematical Reasoning"),
      Q(15, "7 × 8 × 5 = ?", ["240", "280", "300", "260"], 1, "Mathematical Reasoning"),
      Q(16, "Which is a prime number?", ["15", "21", "29", "27"], 2, "Mathematical Reasoning"),
      Q(17, "2/3 + 1/6 = ?", ["1/2", "5/6", "3/6", "1"], 1, "Mathematical Reasoning"),
      Q(18, "Convert 3/4 into a decimal.", ["0.25", "0.5", "0.75", "0.34"], 2, "Mathematical Reasoning"),
      Q(19, "A water tank holds 50 litres. 18 litres are used. How much is left?", ["32 L", "28 L", "38 L", "22 L"], 0, "Mathematical Reasoning"),
      Q(20, "Perimeter of a triangle with sides 5 cm, 7 cm, 9 cm is:", ["21 cm", "20 cm", "22 cm", "19 cm"], 0, "Mathematical Reasoning"),
      Q(21, "How many hours are there in 3 days?", ["36", "48", "72", "60"], 2, "Mathematical Reasoning"),
      Q(22, "₹250 − ₹175 = ?", ["₹65", "₹75", "₹85", "₹55"], 1, "Mathematical Reasoning"),
      Q(23, "The face value of 9 in 29,431 is:", ["9", "900", "9,000", "90"], 0, "Mathematical Reasoning"),
      Q(24, "Which angle is a right angle?", ["45°", "90°", "180°", "60°"], 1, "Mathematical Reasoning"),
      Q(25, "A dozen bananas cost ₹36. Cost of 5 bananas is:", ["₹12", "₹15", "₹18", "₹10"], 1, "Mathematical Reasoning"),
      Q(26, "Multiples of 9 between 20 and 50 are how many?", ["3", "4", "5", "2"], 0, "Mathematical Reasoning"),
      Q(27, "Simplify: 1000 − 1 = ?", ["999", "990", "1001", "899"], 0, "Mathematical Reasoning"),
      Q(28, "Half of 246 is:", ["123", "124", "122", "126"], 0, "Mathematical Reasoning"),
      Q(29, "A square has area 49 cm². Its side is:", ["6 cm", "7 cm", "8 cm", "9 cm"], 1, "Mathematical Reasoning"),
      Q(30, "5 kg 250 g = how many grams?", ["5,250 g", "525 g", "52,500 g", "2,550 g"], 0, "Mathematical Reasoning"),
      Q(31, "A number is multiplied by 4 and then 7 is subtracted to get 45. The number is:", ["13", "12", "14", "11"], 0, "Achievers Section", 2),
      Q(32, "Find the smallest 4-digit number using digits 3, 0, 8, 1 without repeating.", ["0138", "1038", "1308", "3018"], 1, "Achievers Section", 2),
      Q(33, "A rope of 18 m is cut into pieces of 75 cm each. How many pieces?", ["20", "24", "22", "18"], 1, "Achievers Section", 2),
      Q(34, "If the cost of 8 notebooks is ₹160, cost of 5 notebooks is:", ["₹90", "₹100", "₹80", "₹120"], 1, "Achievers Section", 2),
      Q(35, "The average of 12, 18 and 24 is:", ["16", "18", "20", "22"], 1, "Achievers Section", 2),
    ])
  );

  // Paper 3
  papers.push(
    pack([
      Q(1, "Next in series: 81, 27, 9, 3, __.", ["1", "0", "2", "6"], 0, "Logical Reasoning"),
      Q(2, "If SOUTH is coded as 12345 and NORTH as 62345, then code for SOON is:", ["1622", "1266", "1626", "1226"], 0, "Logical Reasoning"),
      Q(3, "Which does not belong: Apple, Mango, Carrot, Banana", ["Apple", "Mango", "Carrot", "Banana"], 2, "Logical Reasoning"),
      Q(4, "Arrange to form a meaningful word: R, A, E, W, T", ["WATER", "WRATE", "TAWER", "AWTER"], 0, "Logical Reasoning"),
      Q(5, "If yesterday was Tuesday, what day is tomorrow?", ["Wednesday", "Thursday", "Friday", "Monday"], 1, "Logical Reasoning"),
      Q(6, "Find the missing letter: B, D, F, H, __.", ["I", "J", "K", "L"], 1, "Logical Reasoning"),
      Q(7, "In a row of 10 children, Priya is 4th from left. Her position from right is:", ["6th", "7th", "5th", "8th"], 1, "Logical Reasoning"),
      Q(8, "How many 9's are there between 1 and 100?", ["10", "19", "20", "18"], 2, "Logical Reasoning"),
      Q(9, "If all roses are flowers and some flowers fade quickly, which is true?", ["All roses fade quickly", "Some roses may fade quickly", "No rose fades", "Roses are not flowers"], 1, "Logical Reasoning"),
      Q(10, "Pattern: 1, 4, 9, 16, 25, __.", ["30", "36", "49", "32"], 1, "Logical Reasoning"),
      Q(11, "The smallest 5-digit number is:", ["10,000", "9,999", "11,111", "10001"], 0, "Mathematical Reasoning"),
      Q(12, "9,999 + 1 = ?", ["10,000", "9,000", "11,000", "10,001"], 0, "Mathematical Reasoning"),
      Q(13, "What is 45 × 20?", ["800", "900", "700", "850"], 1, "Mathematical Reasoning"),
      Q(14, "Divide 144 by 12.", ["10", "11", "12", "14"], 2, "Mathematical Reasoning"),
      Q(15, "3/8 of 64 = ?", ["24", "20", "28", "16"], 0, "Mathematical Reasoning"),
      Q(16, "0.9 − 0.35 = ?", ["0.55", "0.65", "0.45", "0.5"], 0, "Mathematical Reasoning"),
      Q(17, "A book has 248 pages. Tina read 95 pages. Pages left:", ["143", "153", "163", "133"], 1, "Mathematical Reasoning"),
      Q(18, "Which is an even number?", ["47", "93", "128", "75"], 2, "Mathematical Reasoning"),
      Q(19, "1 km = how many metres?", ["100", "1,000", "10,000", "100,000"], 1, "Mathematical Reasoning"),
      Q(20, "A circle has how many lines of symmetry?", ["1", "2", "4", "Infinite"], 3, "Mathematical Reasoning"),
      Q(21, "Time from 9:15 a.m. to 11:45 a.m. is:", ["2 h 15 min", "2 h 30 min", "2 h 45 min", "3 h"], 1, "Mathematical Reasoning"),
      Q(22, "₹1,000 notes needed to make ₹5,000:", ["4", "5", "6", "3"], 1, "Mathematical Reasoning"),
      Q(23, "Factors of 15 are:", ["1,3,5,15", "1,5,15", "1,3,15", "3,5,15"], 0, "Mathematical Reasoning"),
      Q(24, "Roman numeral XC stands for:", ["110", "90", "80", "100"], 1, "Mathematical Reasoning"),
      Q(25, "A bag has 5 red and 7 blue balls. Total balls:", ["10", "11", "12", "13"], 2, "Mathematical Reasoning"),
      Q(26, "Double of 375 is:", ["650", "750", "700", "725"], 1, "Mathematical Reasoning"),
      Q(27, "Which fraction is greater: 2/3 or 3/5?", ["2/3", "3/5", "Equal", "Cannot say"], 0, "Mathematical Reasoning"),
      Q(28, "Perimeter of a square of side 15 cm:", ["45 cm", "60 cm", "30 cm", "75 cm"], 1, "Mathematical Reasoning"),
      Q(29, "15% of 200 is:", ["20", "25", "30", "35"], 2, "Mathematical Reasoning"),
      Q(30, "How many weeks make 63 days?", ["7", "8", "9", "6"], 2, "Mathematical Reasoning"),
      Q(31, "A tank is 3/4 full. If 20 litres more fill it completely, capacity is:", ["60 L", "80 L", "100 L", "40 L"], 1, "Achievers Section", 2),
      Q(32, "Find two consecutive numbers whose sum is 75.", ["36 and 39", "37 and 38", "35 and 40", "30 and 45"], 1, "Achievers Section", 2),
      Q(33, "A car travels 15 km in 20 minutes. Speed in km/h is:", ["30", "45", "60", "75"], 1, "Achievers Section", 2),
      Q(34, "The difference between the place value and face value of 6 in 6,482 is:", ["5,994", "6,000", "5,994", "5,994"], 0, "Achievers Section", 2),
      Q(35, "If each side of a regular hexagon is 8 cm, its perimeter is:", ["40 cm", "48 cm", "56 cm", "64 cm"], 1, "Achievers Section", 2),
    ])
  );
  // Fix Q34 duplicate options
  papers[2].questions[33].options = ["5,994", "6,000", "482", "6"];
  papers[2].answers["34"] = 0;

  // Paper 4
  papers.push(
    pack([
      Q(1, "Find the next number: 4, 9, 16, 25, __.", ["30", "36", "49", "32"], 1, "Logical Reasoning"),
      Q(2, "If A=1, B=2, C=3, … then value of FACE is:", ["15", "16", "14", "20"], 0, "Logical Reasoning"),
      Q(3, "Which is the odd one: January, March, June, August", ["January", "March", "June", "August"], 2, "Logical Reasoning"),
      Q(4, "In a certain code, 2 means Blue, 5 means Red. What does 25 mean?", ["Blue Red", "Red Blue", "Purple", "Cannot say"], 0, "Logical Reasoning"),
      Q(5, "Complete the analogy: Bird : Nest :: Bee : ?", ["Hive", "Honey", "Flower", "Wing"], 0, "Logical Reasoning"),
      Q(6, "How many straight lines are needed to draw letter 'N'?", ["2", "3", "4", "5"], 1, "Logical Reasoning"),
      Q(7, "If today is the 5th of a month, what will be the date after 10 days?", ["14th", "15th", "16th", "13th"], 1, "Logical Reasoning"),
      Q(8, "Series: Z, X, V, T, __.", ["S", "R", "Q", "U"], 1, "Logical Reasoning"),
      Q(9, "A cube has how many faces?", ["4", "6", "8", "12"], 1, "Logical Reasoning"),
      Q(10, "If all even numbers from 1 to 20 are removed, how many numbers remain?", ["8", "9", "10", "11"], 2, "Logical Reasoning"),
      Q(11, "Compare: 7,089 __ 7,809", [">", "<", "=", "≥"], 1, "Mathematical Reasoning"),
      Q(12, "Round 5,550 to nearest thousand.", ["5,000", "6,000", "5,500", "5,600"], 1, "Mathematical Reasoning"),
      Q(13, "6,000 + 450 + 8 = ?", ["6,458", "6,548", "6,408", "6,450"], 0, "Mathematical Reasoning"),
      Q(14, "What is 1/5 of 250?", ["40", "45", "50", "55"], 2, "Mathematical Reasoning"),
      Q(15, "36 × 25 = ?", ["800", "900", "850", "950"], 1, "Mathematical Reasoning"),
      Q(16, "A bottle has 750 ml water. How many such bottles make 3 litres?", ["2", "3", "4", "5"], 2, "Mathematical Reasoning"),
      Q(17, "The sum of angles in a triangle is:", ["90°", "180°", "270°", "360°"], 1, "Mathematical Reasoning"),
      Q(18, "Which is a multiple of both 3 and 4?", ["16", "18", "24", "28"], 2, "Mathematical Reasoning"),
      Q(19, "Convert 2 hours 15 minutes into minutes.", ["125", "135", "145", "150"], 1, "Mathematical Reasoning"),
      Q(20, "A rectangle is 10 cm long and 6 cm wide. Area is:", ["16 cm²", "32 cm²", "60 cm²", "40 cm²"], 2, "Mathematical Reasoning"),
      Q(21, "0.07 is equal to which fraction?", ["7/10", "7/100", "7/1000", "70/100"], 1, "Mathematical Reasoning"),
      Q(22, "Find the missing number: 8 × __ = 96", ["10", "11", "12", "13"], 2, "Mathematical Reasoning"),
      Q(23, "How many paise make ₹7.50?", ["750", "75", "7,500", "700"], 0, "Mathematical Reasoning"),
      Q(24, "The number of edges in a cuboid is:", ["8", "10", "12", "6"], 2, "Mathematical Reasoning"),
      Q(25, "Greatest 3-digit number divisible by 5 is:", ["995", "999", "990", "985"], 0, "Mathematical Reasoning"),
      Q(26, "3/4 − 1/4 = ?", ["1/4", "1/2", "2/4", "1"], 1, "Mathematical Reasoning"),
      Q(27, "A year has how many months with 31 days?", ["6", "7", "5", "8"], 1, "Mathematical Reasoning"),
      Q(28, "If unit digit of a number is 0, it is divisible by:", ["2 and 5", "Only 2", "Only 5", "3"], 0, "Mathematical Reasoning"),
      Q(29, "Temperature rose from 18°C to 27°C. Rise is:", ["7°C", "8°C", "9°C", "10°C"], 2, "Mathematical Reasoning"),
      Q(30, "Share ₹360 equally among 9 children. Each gets:", ["₹30", "₹40", "₹45", "₹35"], 1, "Mathematical Reasoning"),
      Q(31, "A number is 5 more than thrice another number. If the smaller is 12, the larger is:", ["41", "36", "31", "46"], 0, "Achievers Section", 2),
      Q(32, "A rectangular park is 80 m long and 50 m wide. Cost of fencing at ₹20 per metre is:", ["₹5,200", "₹4,000", "₹2,600", "₹5,000"], 0, "Achievers Section", 2),
      Q(33, "What least number must be added to 523 to make it divisible by 9?", ["2", "5", "8", "1"], 0, "Achievers Section", 2),
      Q(34, "A man walks 4 km/h. Distance covered in 2 hours 30 minutes is:", ["8 km", "9 km", "10 km", "12 km"], 2, "Achievers Section", 2),
      Q(35, "If 2/7 of a number is 18, the number is:", ["56", "63", "49", "72"], 1, "Achievers Section", 2),
    ])
  );

  // Paper 5
  papers.push(
    pack([
      Q(1, "Next: 2, 3, 5, 8, 12, __.", ["16", "17", "18", "15"], 1, "Logical Reasoning"),
      Q(2, "If ‘+’ means multiplication and ‘×’ means addition, then 4 + 3 × 2 = ?", ["14", "20", "10", "24"], 0, "Logical Reasoning"),
      Q(3, "Odd one out: 121, 144, 169, 180", ["121", "144", "169", "180"], 3, "Logical Reasoning"),
      Q(4, "Analogy: Pen : Write :: Knife : ?", ["Cut", "Sharp", "Kitchen", "Steel"], 0, "Logical Reasoning"),
      Q(5, "Which day is 3 days after Monday?", ["Wednesday", "Thursday", "Friday", "Tuesday"], 1, "Logical Reasoning"),
      Q(6, "Find the missing: 5, 10, 20, __, 80", ["30", "40", "50", "60"], 1, "Logical Reasoning"),
      Q(7, "If North becomes East, what does West become?", ["North", "South", "East", "West"], 0, "Logical Reasoning"),
      Q(8, "Count the number of rectangles in a 2×2 grid of squares.", ["4", "6", "9", "10"], 2, "Logical Reasoning"),
      Q(9, "If 5 workers finish a job in 8 days, 10 workers will finish it in:", ["2 days", "4 days", "6 days", "8 days"], 1, "Logical Reasoning"),
      Q(10, "Which is next: △, □, ○, △, □, __?", ["○", "△", "□", "◇"], 0, "Logical Reasoning"),
      Q(11, "Write 3,05,072 in words (Indian system):", ["Three lakh five thousand seventy-two", "Thirty lakh five thousand seventy-two", "Three lakh fifty thousand seventy-two", "Three hundred five thousand seventy-two"], 0, "Mathematical Reasoning"),
      Q(12, "The difference between largest and smallest 3-digit numbers is:", ["899", "900", "999", "898"], 0, "Mathematical Reasoning"),
      Q(13, "876 ÷ 4 = ?", ["219", "218", "217", "220"], 0, "Mathematical Reasoning"),
      Q(14, "Which is not a factor of 48?", ["6", "8", "10", "12"], 2, "Mathematical Reasoning"),
      Q(15, "5/6 − 1/3 = ?", ["1/2", "1/3", "1/6", "2/3"], 0, "Mathematical Reasoning"),
      Q(16, "A pizza is cut into 8 equal slices. 3 are eaten. Fraction left:", ["3/8", "5/8", "1/2", "4/8"], 1, "Mathematical Reasoning"),
      Q(17, "How many centimetres in 2.5 metres?", ["25", "250", "2,500", "2500 cm wait"], 1, "Mathematical Reasoning"),
      Q(18, "A clock shows 3:00. The angle between hands is:", ["60°", "90°", "120°", "180°"], 1, "Mathematical Reasoning"),
      Q(19, "Cost of 1 kg apples is ₹120. Cost of 750 g is:", ["₹80", "₹90", "₹100", "₹75"], 1, "Mathematical Reasoning"),
      Q(20, "Prime numbers between 10 and 20 are:", ["11,13,17,19", "11,13,15,17", "12,13,17,19", "11,15,17,19"], 0, "Mathematical Reasoning"),
      Q(21, "Volume of a cube of side 4 cm is:", ["16 cm³", "48 cm³", "64 cm³", "32 cm³"], 2, "Mathematical Reasoning"),
      Q(22, "1/2 + 1/4 + 1/8 = ?", ["7/8", "3/4", "5/8", "1"], 0, "Mathematical Reasoning"),
      Q(23, "How many seconds in 5 minutes?", ["60", "120", "300", "360"], 2, "Mathematical Reasoning"),
      Q(24, "A number ends with 5. It is always divisible by:", ["2", "5", "10", "3"], 1, "Mathematical Reasoning"),
      Q(25, "The reciprocal of 4/7 is:", ["7/4", "4/7", "1/4", "7"], 0, "Mathematical Reasoning"),
      Q(26, "Simple interest on ₹500 at 10% per year for 2 years is:", ["₹50", "₹100", "₹150", "₹200"], 1, "Mathematical Reasoning"),
      Q(27, "Which shape has all sides equal and all angles 90°?", ["Rectangle", "Rhombus", "Square", "Parallelogram"], 2, "Mathematical Reasoning"),
      Q(28, "4,567 rounded to nearest ten is:", ["4,560", "4,570", "4,500", "4,600"], 1, "Mathematical Reasoning"),
      Q(29, "HCF of 8 and 12 is:", ["2", "4", "6", "8"], 1, "Mathematical Reasoning"),
      Q(30, "A bus ticket costs ₹45. Cost of 8 tickets:", ["₹320", "₹360", "₹340", "₹380"], 1, "Mathematical Reasoning"),
      Q(31, "A number is divided by 5 and quotient is 12 with remainder 3. The number is:", ["60", "63", "58", "65"], 1, "Achievers Section", 2),
      Q(32, "The ratio of 30 minutes to 2 hours is:", ["1:2", "1:4", "1:3", "3:4"], 1, "Achievers Section", 2),
      Q(33, "A square and a rectangle have equal perimeters of 40 cm. If rectangle length is 12 cm, its breadth is:", ["8 cm", "10 cm", "6 cm", "4 cm"], 0, "Achievers Section", 2),
      Q(34, "Find the value: 15 × 15 − 14 × 14", ["29", "1", "30", "28"], 0, "Achievers Section", 2),
      Q(35, "A tank holds 120 litres. It is 5/6 full. How many more litres to fill it?", ["10 L", "15 L", "20 L", "25 L"], 2, "Achievers Section", 2),
    ])
  );
  // Fix Q17 options
  papers[4].questions[16].options = ["25 cm", "250 cm", "2,500 cm", "25 m"];
  papers[4].answers["17"] = 1;

  return papers;
}

// ─────────────────────────────────────────────────────────────
// SCIENCE (NSO-style)
// ─────────────────────────────────────────────────────────────
function sciencePapers() {
  const papers = [];

  papers.push(
    pack([
      // LR 5
      Q(1, "Find the odd one out: Eye, Ear, Nose, Hand, Tongue", ["Eye", "Ear", "Hand", "Tongue"], 2, "Logical Reasoning"),
      Q(2, "Complete the analogy: Fish : Water :: Bird : ?", ["Nest", "Sky", "Tree", "Air"], 3, "Logical Reasoning"),
      Q(3, "Which comes next: Seed → Plant → Flower → ?", ["Root", "Fruit", "Leaf", "Stem"], 1, "Logical Reasoning"),
      Q(4, "If all green plants make food and mango is a green plant, then:", ["Mango makes food", "Mango is not a plant", "Mango needs no water", "Mango is an animal"], 0, "Logical Reasoning"),
      Q(5, "Arrange in correct order: Egg, Adult butterfly, Caterpillar, Pupa", ["Egg → Caterpillar → Pupa → Adult", "Egg → Pupa → Caterpillar → Adult", "Caterpillar → Egg → Pupa → Adult", "Pupa → Egg → Adult → Caterpillar"], 0, "Logical Reasoning"),
      // Science 25
      Q(6, "Which part of the plant absorbs water from the soil?", ["Leaf", "Stem", "Root", "Flower"], 2, "Science"),
      Q(7, "Animals that eat only plants are called:", ["Carnivores", "Herbivores", "Omnivores", "Scavengers"], 1, "Science"),
      Q(8, "The process by which green plants make food is:", ["Respiration", "Photosynthesis", "Digestion", "Transpiration"], 1, "Science"),
      Q(9, "Which gas do we breathe in to stay alive?", ["Carbon dioxide", "Nitrogen", "Oxygen", "Hydrogen"], 2, "Science"),
      Q(10, "Our teeth help us to:", ["Breathe", "Chew food", "Hear", "See"], 1, "Science"),
      Q(11, "Which sense organ helps us to smell?", ["Skin", "Tongue", "Nose", "Ear"], 2, "Science"),
      Q(12, "A tadpole grows into a:", ["Fish", "Frog", "Snake", "Lizard"], 1, "Science"),
      Q(13, "Which of these is a source of protein?", ["Rice", "Butter", "Dal (pulses)", "Sugar"], 2, "Science"),
      Q(14, "The hardest substance in the human body is:", ["Bone", "Nail", "Tooth enamel", "Cartilage"], 2, "Science"),
      Q(15, "Water changes into ice at:", ["0°C", "100°C", "50°C", "10°C"], 0, "Science"),
      Q(16, "Which planet is known as the Red Planet?", ["Venus", "Mars", "Jupiter", "Mercury"], 1, "Science"),
      Q(17, "Shadows are longest when the Sun is:", ["Overhead", "Rising or setting", "Behind clouds", "At noon always"], 1, "Science"),
      Q(18, "Which is a natural source of light?", ["Bulb", "Candle", "Sun", "Torch"], 2, "Science"),
      Q(19, "Soil that is good for growing crops is usually:", ["Sandy only", "Clay only", "Loamy", "Rocky"], 2, "Science"),
      Q(20, "Birds have hollow bones mainly to:", ["Store food", "Help them fly", "Keep warm", "Swim"], 1, "Science"),
      Q(21, "Which of these is a solid form of water?", ["Steam", "Vapour", "Ice", "Cloud always"], 2, "Science"),
      Q(22, "The organ that pumps blood in our body is the:", ["Lungs", "Brain", "Heart", "Liver"], 2, "Science"),
      Q(23, "Which animal hibernates in winter?", ["Cow", "Bear", "Dog", "Hen"], 1, "Science"),
      Q(24, "Cotton clothes are preferred in summer because they:", ["Are waterproof", "Absorb sweat and keep cool", "Are shiny", "Are heavier"], 1, "Science"),
      Q(25, "Which vitamin is mainly obtained from sunlight?", ["Vitamin A", "Vitamin B", "Vitamin C", "Vitamin D"], 3, "Science"),
      Q(26, "A push or a pull on an object is called a:", ["Energy", "Force", "Mass", "Speed"], 1, "Science"),
      Q(27, "Which of these is biodegradable?", ["Plastic bag", "Banana peel", "Glass bottle", "Metal can"], 1, "Science"),
      Q(28, "The boiling point of water is:", ["0°C", "50°C", "100°C", "212°C only in F"], 2, "Science"),
      Q(29, "Insects have how many legs?", ["4", "6", "8", "10"], 1, "Science"),
      Q(30, "Which part of the tooth is visible above the gum?", ["Root", "Crown", "Pulp", "Nerve"], 1, "Science"),
      // Achievers 5
      Q(31, "A plant kept in a dark room for many days will:", ["Grow faster", "Turn yellow and weak", "Produce more flowers", "Need no water"], 1, "Achievers Section", 2),
      Q(32, "Why do we see lightning before we hear thunder?", ["Light is brighter", "Light travels faster than sound", "Sound is louder", "Clouds block sound first"], 1, "Achievers Section", 2),
      Q(33, "If a sealed bottle of cold water is left in the sun, water droplets appear outside mainly because:", ["Water leaks out", "Water vapour in air condenses on cold surface", "Plastic sweats", "Sun creates water"], 1, "Achievers Section", 2),
      Q(34, "Which food chain is correct?", ["Grass → Eagle → Deer", "Grass → Deer → Lion", "Lion → Grass → Deer", "Deer → Grass → Lion"], 1, "Achievers Section", 2),
      Q(35, "A metal spoon becomes hot when left in hot soup because metals are good:", ["Insulators", "Conductors of heat", "Reflectors only", "Sources of heat"], 1, "Achievers Section", 2),
    ])
  );

  papers.push(
    pack([
      Q(1, "Odd one: Milk, Curd, Butter, Juice", ["Milk", "Curd", "Butter", "Juice"], 3, "Logical Reasoning"),
      Q(2, "Analogy: Leaf : Photosynthesis :: Lungs : ?", ["Digestion", "Respiration", "Circulation", "Excretion"], 1, "Logical Reasoning"),
      Q(3, "Next in order: Morning → Afternoon → Evening → ?", ["Night", "Noon", "Dawn", "Midnight only"], 0, "Logical Reasoning"),
      Q(4, "If some birds can swim and ducks are birds, then:", ["All birds swim", "Ducks may swim", "No duck swims", "Ducks are fish"], 1, "Logical Reasoning"),
      Q(5, "Which does not fit: Rose, Lily, Mango, Jasmine", ["Rose", "Lily", "Mango", "Jasmine"], 2, "Logical Reasoning"),
      Q(6, "Green pigment in leaves is called:", ["Haemoglobin", "Chlorophyll", "Melanin", "Carotene"], 1, "Science"),
      Q(7, "Animals that eat both plants and animals are:", ["Herbivores", "Carnivores", "Omnivores", "Parasites"], 2, "Science"),
      Q(8, "The largest organ of the human body is:", ["Liver", "Brain", "Skin", "Heart"], 2, "Science"),
      Q(9, "Which of these is a nocturnal animal?", ["Cow", "Owl", "Peacock", "Sparrow"], 1, "Science"),
      Q(10, "Stomata in leaves help in:", ["Absorbing minerals", "Exchange of gases", "Storing food", "Attracting insects"], 1, "Science"),
      Q(11, "Which nutrient helps in body building and repair?", ["Carbohydrates", "Fats", "Proteins", "Vitamins only"], 2, "Science"),
      Q(12, "The Earth rotates on its:", ["Orbit", "Axis", "Equator", "Pole star"], 1, "Science"),
      Q(13, "Which is a renewable source of energy?", ["Coal", "Petrol", "Solar energy", "Diesel"], 2, "Science"),
      Q(14, "We should brush our teeth at least:", ["Once a week", "Twice a day", "Once a month", "Only at night"], 1, "Science"),
      Q(15, "Which state of matter has a fixed shape and volume?", ["Solid", "Liquid", "Gas", "Plasma"], 0, "Science"),
      Q(16, "Camels store fat in their:", ["Legs", "Humps", "Stomach only", "Ears"], 1, "Science"),
      Q(17, "The Moon gets its light from the:", ["Earth", "Sun", "Stars", "Itself"], 1, "Science"),
      Q(18, "Which is not a sense organ?", ["Eye", "Ear", "Brain", "Skin"], 2, "Science"),
      Q(19, "Frogs breathe through lungs and:", ["Gills only as adults", "Moist skin", "Scales", "Fins"], 1, "Science"),
      Q(20, "Which disease spreads by mosquito bite?", ["Common cold", "Malaria", "Tooth decay", "Scurvy"], 1, "Science"),
      Q(21, "Roughage in food helps in:", ["Building muscles", "Smooth digestion", "Giving instant energy", "Making bones hard"], 1, "Science"),
      Q(22, "A magnet attracts:", ["Wood", "Plastic", "Iron", "Glass"], 2, "Science"),
      Q(23, "Which planet is closest to the Sun?", ["Venus", "Earth", "Mercury", "Mars"], 2, "Science"),
      Q(24, "Evaporation is faster when:", ["Air is still and cold", "It is hot and windy", "It is night", "Humidity is very high always"], 1, "Science"),
      Q(25, "The backbone protects the:", ["Heart", "Lungs", "Spinal cord", "Stomach"], 2, "Science"),
      Q(26, "Which animal is cold-blooded?", ["Dog", "Cat", "Lizard", "Cow"], 2, "Science"),
      Q(27, "Seeds need which of these to germinate?", ["Light only", "Air, water and warmth", "Soil only", "Fertilizer only"], 1, "Science"),
      Q(28, "Which is a man-made fibre?", ["Cotton", "Wool", "Nylon", "Silk"], 2, "Science"),
      Q(29, "Sound travels fastest through:", ["Air", "Water", "Steel", "Vacuum"], 2, "Science"),
      Q(30, "The white part of an egg is rich in:", ["Fat", "Protein", "Sugar", "Fibre"], 1, "Science"),
      Q(31, "A boy cannot see clearly in dim light. Which vitamin deficiency is likely?", ["Vitamin C", "Vitamin A", "Vitamin D", "Vitamin K"], 1, "Achievers Section", 2),
      Q(32, "Why do desert plants often have spines instead of broad leaves?", ["To look beautiful", "To reduce water loss", "To attract birds", "To store sunlight"], 1, "Achievers Section", 2),
      Q(33, "Two ice cubes melt faster when crushed into small pieces because:", ["Temperature rises", "Surface area increases", "Weight decreases", "Colour changes"], 1, "Achievers Section", 2),
      Q(34, "Which arrangement shows increasing order of size?", ["Moon < Earth < Sun", "Sun < Earth < Moon", "Earth < Moon < Sun", "Moon < Sun < Earth"], 0, "Achievers Section", 2),
      Q(35, "If a plant’s xylem is damaged, the plant will mainly fail to:", ["Make flowers", "Transport water upward", "Attract insects", "Produce seeds only"], 1, "Achievers Section", 2),
    ])
  );

  papers.push(
    pack([
      Q(1, "Find the odd one: Lion, Tiger, Leopard, Elephant", ["Lion", "Tiger", "Leopard", "Elephant"], 3, "Logical Reasoning"),
      Q(2, "Complete: Caterpillar : Butterfly :: Tadpole : ?", ["Fish", "Frog", "Snake", "Lizard"], 1, "Logical Reasoning"),
      Q(3, "Which is the correct food chain?", ["Deer → Grass → Tiger", "Grass → Deer → Tiger", "Tiger → Deer → Grass", "Grass → Tiger → Deer"], 1, "Logical Reasoning"),
      Q(4, "If all metals conduct heat and iron is a metal, then iron:", ["Does not conduct heat", "Conducts heat", "Is a non-metal", "Is a gas"], 1, "Logical Reasoning"),
      Q(5, "Series of states of water: Ice → Water → ?", ["Snow", "Steam/Vapour", "Hail", "Frost"], 1, "Logical Reasoning"),
      Q(6, "Which part of the flower becomes the fruit?", ["Petal", "Sepal", "Ovary", "Stamen"], 2, "Science"),
      Q(7, "Blood is purified in the:", ["Heart", "Lungs", "Stomach", "Intestine"], 1, "Science"),
      Q(8, "Which vitamin prevents scurvy?", ["Vitamin A", "Vitamin B", "Vitamin C", "Vitamin D"], 2, "Science"),
      Q(9, "Animals that live both on land and in water are called:", ["Aquatic", "Terrestrial", "Amphibians", "Aerial"], 2, "Science"),
      Q(10, "The layer of air around the Earth is the:", ["Hydrosphere", "Atmosphere", "Lithosphere", "Biosphere"], 1, "Science"),
      Q(11, "Which is a balanced meal?", ["Only rice", "Only chips", "Dal, roti, vegetables and curd", "Only sweets"], 2, "Science"),
      Q(12, "A solar eclipse occurs when:", ["Earth comes between Sun and Moon", "Moon comes between Sun and Earth", "Sun comes between Earth and Moon", "None"], 1, "Science"),
      Q(13, "Which of these floats on water?", ["Iron nail", "Stone", "Dry leaf", "Coin"], 2, "Science"),
      Q(14, "Our bones are mainly made of:", ["Iron", "Calcium", "Sodium", "Iodine"], 1, "Science"),
      Q(15, "Which is an insect?", ["Spider", "Butterfly", "Scorpion", "Centipede"], 1, "Science"),
      Q(16, "The process of water changing into vapour is:", ["Condensation", "Evaporation", "Freezing", "Melting"], 1, "Science"),
      Q(17, "Which organ helps us to think?", ["Heart", "Lungs", "Brain", "Kidney"], 2, "Science"),
      Q(18, "Penguins are found mainly in the:", ["Sahara", "Amazon", "Antarctica", "Thar"], 2, "Science"),
      Q(19, "Which gas do plants give out during photosynthesis?", ["Carbon dioxide", "Oxygen", "Nitrogen", "Hydrogen"], 1, "Science"),
      Q(20, "A compass needle points towards:", ["East-West", "North-South", "Up-Down", "Random"], 1, "Science"),
      Q(21, "Which is a good habit for healthy teeth?", ["Eating many sweets", "Brushing twice daily", "Avoiding milk", "Using teeth to open bottles"], 1, "Science"),
      Q(22, "Force can change the:", ["Only colour of object", "Shape, speed or direction of object", "Only smell", "Only taste"], 1, "Science"),
      Q(23, "Which is not a planet of our solar system?", ["Mars", "Venus", "Polaris", "Saturn"], 2, "Science"),
      Q(24, "Silk is obtained from:", ["Sheep", "Silkworm", "Cotton plant", "Jute plant"], 1, "Science"),
      Q(25, "The young one of a butterfly is called a:", ["Cub", "Kitten", "Caterpillar", "Calf"], 2, "Science"),
      Q(26, "Which house is suitable for heavy rainfall areas?", ["Igloo", "House on stilts", "Tent only", "Mud hut without roof"], 1, "Science"),
      Q(27, "Deficiency of iron in the body may cause:", ["Scurvy", "Anaemia", "Rickets", "Night blindness"], 1, "Science"),
      Q(28, "Which is translucent?", ["Clear glass", "Wood", "Tracing paper", "Metal sheet"], 2, "Science"),
      Q(29, "Bees collect nectar to make:", ["Wax only", "Honey", "Milk", "Silk"], 1, "Science"),
      Q(30, "The main function of white blood cells is to:", ["Carry oxygen", "Fight germs", "Clot blood", "Give colour"], 1, "Science"),
      Q(31, "A closed jar with a burning candle will go out because:", ["Heat is too much", "Oxygen is used up", "Wax finishes instantly always", "Glass melts"], 1, "Achievers Section", 2),
      Q(32, "Why do we feel cooler when sweat evaporates?", ["Evaporation absorbs heat from skin", "Sweat is cold liquid always", "Air stops moving", "Skin produces ice"], 0, "Achievers Section", 2),
      Q(33, "Which adaptation helps a polar bear?", ["Thin fur", "Thick fur and fat layer", "Green skin", "Long ears for heat loss"], 1, "Achievers Section", 2),
      Q(34, "If Earth stopped rotating, one major effect would be:", ["No change", "Day and night cycle would stop as we know it", "Only seasons stop", "Only tides stop"], 1, "Achievers Section", 2),
      Q(35, "Mixing sand and iron filings can best be separated by:", ["Hand picking only", "Using a magnet", "Evaporation", "Filtration with large holes only"], 1, "Achievers Section", 2),
    ])
  );

  papers.push(
    pack([
      Q(1, "Odd one: Gills, Lungs, Fins, Skin (for breathing context)", ["Gills", "Lungs", "Fins", "Skin"], 2, "Logical Reasoning"),
      Q(2, "Analogy: Sun : Day :: Moon : ?", ["Light", "Night", "Star", "Sky"], 1, "Logical Reasoning"),
      Q(3, "Arrange life cycle of frog: Adult, Eggs, Tadpole", ["Eggs → Tadpole → Adult", "Adult → Eggs → Tadpole", "Tadpole → Adult → Eggs", "Eggs → Adult → Tadpole"], 0, "Logical Reasoning"),
      Q(4, "Which pair is mismatched?", ["Fish – Gills", "Bird – Wings", "Plant – Roots", "Snake – Legs"], 3, "Logical Reasoning"),
      Q(5, "If cloudy sky blocks sunlight, plants will:", ["Make more food", "Make less food", "Stop needing water", "Turn into animals"], 1, "Logical Reasoning"),
      Q(6, "Which nutrient gives us quick energy?", ["Proteins", "Vitamins", "Carbohydrates", "Minerals"], 2, "Science"),
      Q(7, "The smallest bone in the human body is in the:", ["Leg", "Ear", "Hand", "Nose"], 1, "Science"),
      Q(8, "Which animal has a pouch to carry its young?", ["Cow", "Kangaroo", "Horse", "Deer"], 1, "Science"),
      Q(9, "Rain is formed by the process of:", ["Only melting", "Condensation of water vapour", "Freezing of soil", "Burning of clouds"], 1, "Science"),
      Q(10, "Which of these is a herbivore?", ["Lion", "Eagle", "Goat", "Snake"], 2, "Science"),
      Q(11, "Our heart is protected by the:", ["Skull", "Rib cage", "Backbone only", "Pelvis"], 1, "Science"),
      Q(12, "Which planet is famous for its rings?", ["Mars", "Venus", "Saturn", "Mercury"], 2, "Science"),
      Q(13, "A shadow is formed when light is:", ["Reflected", "Blocked by an opaque object", "Absorbed by air only", "Bent by water only"], 1, "Science"),
      Q(14, "Which is a good conductor of electricity?", ["Rubber", "Plastic", "Copper", "Wood"], 2, "Science"),
      Q(15, "First aid for a small cut is to:", ["Rub soil", "Wash and cover cleanly", "Ignore it", "Put butter"], 1, "Science"),
      Q(16, "Which part of the plant makes seeds?", ["Root", "Stem", "Flower/Fruit", "Leaf only"], 2, "Science"),
      Q(17, "Snakes move with the help of:", ["Legs", "Scales and muscles", "Wings", "Fins"], 1, "Science"),
      Q(18, "Which is essential for burning?", ["Nitrogen only", "Oxygen", "Carbon dioxide only", "Hydrogen only"], 1, "Science"),
      Q(19, "The disease rickets is caused by deficiency of:", ["Vitamin A", "Vitamin C", "Vitamin D", "Iron"], 2, "Science"),
      Q(20, "Which is a natural fibre?", ["Polyester", "Nylon", "Cotton", "Acrylic"], 2, "Science"),
      Q(21, "Fish use which organ to breathe?", ["Lungs", "Gills", "Skin only", "Nose"], 1, "Science"),
      Q(22, "The Earth completes one revolution around the Sun in about:", ["1 day", "1 month", "1 year", "1 week"], 2, "Science"),
      Q(23, "Which sense organ detects taste?", ["Nose", "Tongue", "Skin", "Eye"], 1, "Science"),
      Q(24, "Plastics are harmful to the environment mainly because they:", ["Are heavy", "Do not rot easily", "Are colourful", "Are cheap"], 1, "Science"),
      Q(25, "Which of these is an omnivore?", ["Cow", "Tiger", "Human", "Deer"], 2, "Science"),
      Q(26, "Water cycle mainly involves:", ["Only rivers", "Evaporation, condensation and precipitation", "Only oceans", "Only underground water"], 1, "Science"),
      Q(27, "Which bird cannot fly?", ["Sparrow", "Pigeon", "Ostrich", "Crow"], 2, "Science"),
      Q(28, "The unit commonly used to measure temperature is:", ["Metre", "Litre", "Degree Celsius", "Kilogram"], 2, "Science"),
      Q(29, "Which organ filters waste from blood?", ["Heart", "Kidney", "Lungs", "Stomach"], 1, "Science"),
      Q(30, "A food rich in calcium is:", ["Chips", "Milk", "Soft drink", "Candy"], 1, "Science"),
      Q(31, "Why do mountain climbers carry oxygen cylinders?", ["Air is thinner with less oxygen at height", "It is fashion", "To keep warm only", "To reduce weight"], 0, "Achievers Section", 2),
      Q(32, "A shiny steel plate feels colder than a wooden board at the same room temperature because steel:", ["Is actually colder", "Conducts heat away from hand faster", "Has less mass always", "Reflects light only"], 1, "Achievers Section", 2),
      Q(33, "Which method separates salt from salt water?", ["Filtration", "Evaporation", "Handpicking", "Sieving"], 1, "Achievers Section", 2),
      Q(34, "Cactus plants store water mainly in their:", ["Flowers", "Thick stems", "Thorns only", "Roots only always"], 1, "Achievers Section", 2),
      Q(35, "If the ozone layer is damaged, a major risk is increased:", ["Rainfall only", "Harmful UV rays reaching Earth", "Oxygen production", "Soil fertility only"], 1, "Achievers Section", 2),
    ])
  );

  papers.push(
    pack([
      Q(1, "Odd one: Rose, Neem, Mango, Tulsi (all plants — pick non-flowering tree use): actually pick the tree grown mainly for fruit among medicinal: ", ["Rose", "Neem", "Mango", "Tulsi"], 2, "Logical Reasoning"),
      Q(2, "Analogy: Bee : Honey :: Cow : ?", ["Grass", "Milk", "Horn", "Tail"], 1, "Logical Reasoning"),
      Q(3, "Correct order of digestion start: Mouth → ? → Stomach", ["Large intestine", "Food pipe (oesophagus)", "Rectum", "Liver"], 1, "Logical Reasoning"),
      Q(4, "Which does not belong to the group of solids?", ["Ice", "Wood", "Steam", "Stone"], 2, "Logical Reasoning"),
      Q(5, "If day length increases, plants generally get:", ["Less light for food making", "More light for food making", "No change ever", "Only heat without light"], 1, "Logical Reasoning"),
      Q(6, "Which part of the eye controls the amount of light entering?", ["Retina", "Iris", "Lens", "Cornea"], 1, "Science"),
      Q(7, "Decomposers in nature include:", ["Tigers", "Bacteria and fungi", "Deer", "Eagles"], 1, "Science"),
      Q(8, "Which is a source of dietary fibre?", ["White sugar", "Whole grains and fruits", "Butter", "Oil"], 1, "Science"),
      Q(9, "The spinning of Earth on its axis causes:", ["Seasons", "Day and night", "Eclipses only", "Tides only"], 1, "Science"),
      Q(10, "Which animal is an egg-laying mammal?", ["Dog", "Platypus", "Cat", "Whale"], 1, "Science"),
      Q(11, "We should not waste water because:", ["It is unlimited", "Fresh water is limited and precious", "It has no use", "Rain never comes"], 1, "Science"),
      Q(12, "Which vitamin is abundant in citrus fruits?", ["Vitamin D", "Vitamin C", "Vitamin K", "Vitamin B12"], 1, "Science"),
      Q(13, "A force of friction:", ["Speeds up sliding always", "Opposes motion between surfaces", "Only exists in water", "Creates light"], 1, "Science"),
      Q(14, "Which is the correct path of light enabling us to see an object?", ["Eyes → Object → Light", "Light → Object → Eyes", "Object → Eyes → Light", "Light → Eyes only"], 1, "Science"),
      Q(15, "Moulting in snakes means:", ["Changing colour daily", "Shedding old skin", "Growing wings", "Hibernating"], 1, "Science"),
      Q(16, "Which gas is used by plants to make food?", ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], 2, "Science"),
      Q(17, "The strongest muscle for its size in the human body is often said to be in the:", ["Ear", "Jaw", "Toe", "Nose"], 1, "Science"),
      Q(18, "Which is a non-renewable resource?", ["Wind", "Sunlight", "Coal", "Water cycle"], 2, "Science"),
      Q(19, "Birds keep their eggs warm by:", ["Flying over them", "Incubation (sitting on them)", "Putting in water", "Burying in ice"], 1, "Science"),
      Q(20, "Which of these prevents soil erosion?", ["Cutting all trees", "Planting trees and grass", "Overgrazing", "Leaving soil bare"], 1, "Science"),
      Q(21, "The liquid part of blood is called:", ["Platelet", "Plasma", "Haemoglobin", "RBC only"], 1, "Science"),
      Q(22, "Which house is made of ice?", ["Hut", "Igloo", "Bungalow", "Tent"], 1, "Science"),
      Q(23, "Sound cannot travel through:", ["Air", "Water", "Iron", "Vacuum"], 3, "Science"),
      Q(24, "Which is an example of a lever in the body?", ["Skull", "Arm bending at elbow", "Skin", "Hair"], 1, "Science"),
      Q(25, "Butterflies help plants mainly by:", ["Eating leaves only", "Pollination", "Cutting stems", "Making shade"], 1, "Science"),
      Q(26, "Which is safe during a thunderstorm?", ["Standing under a tall lone tree", "Staying indoors away from metal pipes", "Swimming in open pool", "Holding a metal rod outside"], 1, "Science"),
      Q(27, "The main function of roots is to:", ["Make food", "Absorb water and minerals", "Attract insects", "Produce oxygen only"], 1, "Science"),
      Q(28, "Which planet is called Earth’s twin?", ["Mars", "Venus", "Mercury", "Jupiter"], 1, "Science"),
      Q(29, "Oral hygiene means care of:", ["Eyes", "Teeth and mouth", "Hair", "Nails"], 1, "Science"),
      Q(30, "Which energy resource can pollute air when burnt?", ["Solar", "Wind", "Coal", "Hydro"], 2, "Science"),
      Q(31, "A thick glass tumbler cracks when boiling water is poured suddenly because:", ["Glass expands unevenly due to sudden heat", "Water is heavy", "Air pressure falls", "Glass becomes lighter"], 0, "Achievers Section", 2),
      Q(32, "Why are leaves usually broad and flat?", ["To reduce photosynthesis", "To capture more sunlight", "To store stones", "To avoid rain"], 1, "Achievers Section", 2),
      Q(33, "In a sealed terrarium, plants can survive many days mainly because of:", ["Recycling of gases and water inside", "Magic soil", "No need for light", "Outside air leaks always"], 0, "Achievers Section", 2),
      Q(34, "Which combination is a complete protein-rich vegetarian meal idea?", ["Rice and dal", "Only sugar", "Only oil", "Only salt"], 0, "Achievers Section", 2),
      Q(35, "A lunar eclipse can occur only on a:", ["New moon night", "Full moon night", "Any night", "Solar noon"], 1, "Achievers Section", 2),
    ])
  );
  // Fix awkward Q1 paper5
  papers[4].questions[0].question = "Find the odd one out: Rose, Neem, Tulsi, Mango";
  papers[4].questions[0].options = ["Rose", "Neem", "Tulsi", "Mango"];
  papers[4].answers["1"] = 3; // mango is fruit tree among mostly medicinal/flower; actually all plants - better: Mango is primarily fruit
  // Rose flower, Neem medicinal, Tulsi medicinal, Mango fruit - ok

  return papers;
}

// ─────────────────────────────────────────────────────────────
// ENGLISH (IEO-style) — 40 questions, 1 mark each
// Sections: Word and Structure Knowledge (30), Reading (5), Spoken and Written Expression (5)
// ─────────────────────────────────────────────────────────────
function engItem(id, question, options, ans, section) {
  return Q(id, question, options, ans, section, 1);
}

function englishPapers() {
  const papers = [];

  function makeReading(passage, qs) {
    // qs: array of {q, options, a}
    return qs.map((item, i) =>
      engItem(
        100 + i,
        `Read the passage and answer:\n"${passage}"\n\n${item.q}`,
        item.options,
        item.a,
        "Reading"
      )
    );
  }

  // Paper 1
  {
    const ws = [
      engItem(1, "Choose the correct spelling:", ["Enviroment", "Environment", "Enviornment", "Environmant"], 1, "Word and Structure Knowledge"),
      engItem(2, "Pick the noun: The cat slept on the mat.", ["slept", "cat", "on", "the"], 1, "Word and Structure Knowledge"),
      engItem(3, "Choose the correct article: She bought ___ umbrella.", ["a", "an", "the", "no article"], 1, "Word and Structure Knowledge"),
      engItem(4, "Antonym of 'brave' is:", ["bold", "fearless", "cowardly", "strong"], 2, "Word and Structure Knowledge"),
      engItem(5, "Synonym of 'happy' is:", ["sad", "joyful", "angry", "tired"], 1, "Word and Structure Knowledge"),
      engItem(6, "Fill in: She ___ to school every day.", ["go", "goes", "going", "gone"], 1, "Word and Structure Knowledge"),
      engItem(7, "Plural of 'child' is:", ["childs", "children", "childes", "childrens"], 1, "Word and Structure Knowledge"),
      engItem(8, "Choose the adjective: It was a bright morning.", ["It", "was", "bright", "morning"], 2, "Word and Structure Knowledge"),
      engItem(9, "Correct past tense of 'run':", ["runned", "ran", "running", "runs"], 1, "Word and Structure Knowledge"),
      engItem(10, "Which is a proper noun?", ["city", "river", "Delhi", "school"], 2, "Word and Structure Knowledge"),
      engItem(11, "Fill in: The books are ___ the table.", ["in", "on", "at", "over"], 1, "Word and Structure Knowledge"),
      engItem(12, "Choose the correct sentence:", ["He don't like tea.", "He doesn't like tea.", "He doesn't likes tea.", "He not like tea."], 1, "Word and Structure Knowledge"),
      engItem(13, "Opposite of 'early' is:", ["soon", "late", "quick", "fast"], 1, "Word and Structure Knowledge"),
      engItem(14, "A group of lions is called a:", ["herd", "pride", "flock", "pack"], 1, "Word and Structure Knowledge"),
      engItem(15, "Fill in: ___ apple a day keeps the doctor away.", ["A", "An", "The", "Some"], 1, "Word and Structure Knowledge"),
      engItem(16, "Identify the verb: Birds fly in the sky.", ["Birds", "fly", "in", "sky"], 1, "Word and Structure Knowledge"),
      engItem(17, "Comparative form of 'tall':", ["taller", "tallest", "more tall", "most tall"], 0, "Word and Structure Knowledge"),
      engItem(18, "Choose the correct homophone: I can ___ the bell.", ["here", "hear", "hair", "hare"], 1, "Word and Structure Knowledge"),
      engItem(19, "Which word is a preposition?", ["quickly", "under", "happy", "sing"], 1, "Word and Structure Knowledge"),
      engItem(20, "Fill in: They have ___ their homework.", ["do", "did", "done", "doing"], 2, "Word and Structure Knowledge"),
      engItem(21, "Feminine of 'uncle' is:", ["aunt", "niece", "sister", "mother"], 0, "Word and Structure Knowledge"),
      engItem(22, "Choose the correct punctuation: what a beautiful day", ["What a beautiful day.", "What a beautiful day!", "what a beautiful day?", "What a beautiful day,"], 1, "Word and Structure Knowledge"),
      engItem(23, "The word 'quickly' is a/an:", ["noun", "verb", "adverb", "adjective"], 2, "Word and Structure Knowledge"),
      engItem(24, "Fill in: Neither Ravi ___ Sita was present.", ["or", "nor", "and", "but"], 1, "Word and Structure Knowledge"),
      engItem(25, "Past participle of 'write' is:", ["wrote", "written", "writing", "writes"], 1, "Word and Structure Knowledge"),
      engItem(26, "Choose the correct order: beautiful / a / garden / is / there", ["There is a beautiful garden.", "Is there a garden beautiful.", "A beautiful is there garden.", "Garden there is a beautiful."], 0, "Word and Structure Knowledge"),
      engItem(27, "Which is an interrogative sentence?", ["Close the door.", "What is your name?", "What a surprise!", "I am fine."], 1, "Word and Structure Knowledge"),
      engItem(28, "Synonym of 'begin' is:", ["end", "start", "finish", "stop"], 1, "Word and Structure Knowledge"),
      engItem(29, "Fill in: This is ___ unique idea.", ["a", "an", "the", "no article needed wrongly as an"], 0, "Word and Structure Knowledge"),
      engItem(30, "Choose the correctly spelled word:", ["Recieve", "Receive", "Receve", "Receeve"], 1, "Word and Structure Knowledge"),
    ];
    const passage =
      "Rani loved to read storybooks. Every Sunday she visited the library near her house. The librarian, Mrs. Das, always helped her choose a new book. One day Rani found a book about space. She read it in two days and told her class all about the planets.";
    const reading = [
      engItem(31, `Read:\n"${passage}"\n\nHow often did Rani visit the library?`, ["Every day", "Every Sunday", "Once a month", "Never"], 1, "Reading"),
      engItem(32, `Read:\n"${passage}"\n\nWho was Mrs. Das?`, ["Rani's mother", "A teacher", "The librarian", "A classmate"], 2, "Reading"),
      engItem(33, `Read:\n"${passage}"\n\nWhat kind of book did Rani find one day?`, ["A cookbook", "A book about space", "A comic only", "A dictionary"], 1, "Reading"),
      engItem(34, `Read:\n"${passage}"\n\nHow long did Rani take to read the space book?`, ["One week", "Two days", "One month", "One hour"], 1, "Reading"),
      engItem(35, `Read:\n"${passage}"\n\nWhat did Rani do after reading the book?`, ["She sold it", "She told her class about planets", "She tore it", "She hid it"], 1, "Reading"),
    ];
    const spoken = [
      engItem(36, "Choose the best reply: 'How are you?'", ["I am a student.", "I am fine, thank you.", "I live in Delhi.", "My name is Tom."], 1, "Spoken and Written Expression"),
      engItem(37, "Choose the polite request:", ["Give me water!", "Water now!", "Could you please give me a glass of water?", "You must give water."], 2, "Spoken and Written Expression"),
      engItem(38, "Best sentence to begin a formal letter:", ["Hey friend,", "Respected Sir/Madam,", "Yo!", "Listen,"], 1, "Spoken and Written Expression"),
      engItem(39, "Choose the correct notice heading style:", ["lost dog!!!!", "LOST: Brown Puppy", "dog gone", "find it"], 1, "Spoken and Written Expression"),
      engItem(40, "Complete the dialogue: A: May I borrow your pencil? B: ___", ["No never ever.", "Yes, of course.", "Pencil is wood.", "I am pencil."], 1, "Spoken and Written Expression"),
    ];
    papers.push(pack([...ws, ...reading, ...spoken]));
  }

  // Paper 2
  {
    const ws = [
      engItem(1, "Choose the correct spelling:", ["Beutiful", "Beautiful", "Beautifull", "Buetiful"], 1, "Word and Structure Knowledge"),
      engItem(2, "Pick the pronoun: Riya said she would come.", ["Riya", "said", "she", "come"], 2, "Word and Structure Knowledge"),
      engItem(3, "Article: He is ___ honest man.", ["a", "an", "the", "no article"], 1, "Word and Structure Knowledge"),
      engItem(4, "Antonym of 'ancient' is:", ["old", "modern", "historic", "aged"], 1, "Word and Structure Knowledge"),
      engItem(5, "Synonym of 'tiny' is:", ["huge", "small", "tall", "wide"], 1, "Word and Structure Knowledge"),
      engItem(6, "Fill in: The children ___ playing in the park now.", ["is", "are", "was", "be"], 1, "Word and Structure Knowledge"),
      engItem(7, "Plural of 'leaf' is:", ["leafs", "leaves", "leafes", "leavs"], 1, "Word and Structure Knowledge"),
      engItem(8, "Choose the adverb: She sang sweetly.", ["She", "sang", "sweetly", "none"], 2, "Word and Structure Knowledge"),
      engItem(9, "Past tense of 'catch':", ["catched", "caught", "catching", "catches"], 1, "Word and Structure Knowledge"),
      engItem(10, "Which is a collective noun?", ["boy", "team", "city", "book"], 1, "Word and Structure Knowledge"),
      engItem(11, "Fill in: The bird flew ___ the trees.", ["on", "over", "at", "into only always"], 1, "Word and Structure Knowledge"),
      engItem(12, "Correct sentence:", ["She can sings well.", "She can sing well.", "She can singing well.", "She cans sing well."], 1, "Word and Structure Knowledge"),
      engItem(13, "Opposite of 'empty' is:", ["vacant", "full", "hollow", "open"], 1, "Word and Structure Knowledge"),
      engItem(14, "A person who writes books is an:", ["artist", "author", "actor", "athlete"], 1, "Word and Structure Knowledge"),
      engItem(15, "Fill in: ___ Himalayas are in the north of India.", ["A", "An", "The", "No article"], 2, "Word and Structure Knowledge"),
      engItem(16, "Identify conjunction: I ran fast but I missed the bus.", ["ran", "fast", "but", "missed"], 2, "Word and Structure Knowledge"),
      engItem(17, "Superlative of 'good':", ["gooder", "best", "more good", "wellest"], 1, "Word and Structure Knowledge"),
      engItem(18, "Homophone of 'pair':", ["pear", "peer only", "poor", "pour"], 0, "Word and Structure Knowledge"),
      engItem(19, "Which is an interjection?", ["Wow!", "Table", "Run", "Blue"], 0, "Word and Structure Knowledge"),
      engItem(20, "Fill in: He has lived here ___ 2018.", ["for", "since", "from", "at"], 1, "Word and Structure Knowledge"),
      engItem(21, "Masculine of 'niece' is:", ["uncle", "nephew", "cousin", "son"], 1, "Word and Structure Knowledge"),
      engItem(22, "Correct question form:", ["Where you live?", "Where do you live?", "Where lives you?", "Where you does live?"], 1, "Word and Structure Knowledge"),
      engItem(23, "The word 'happiness' is a:", ["verb", "adjective", "noun", "adverb"], 2, "Word and Structure Knowledge"),
      engItem(24, "Fill in: Not only Ram ___ Shyam came.", ["and", "but also", "or", "nor only"], 1, "Word and Structure Knowledge"),
      engItem(25, "Past participle of 'eat':", ["ate", "eaten", "eating", "eats"], 1, "Word and Structure Knowledge"),
      engItem(26, "Arrange: the / garden / in / children / are / playing", ["The children are playing in the garden.", "Are playing the children in garden.", "In the garden playing are children.", "Children the are in garden playing."], 0, "Word and Structure Knowledge"),
      engItem(27, "Which is an exclamatory sentence?", ["Please sit down.", "Where is my bag?", "What a lovely flower!", "She is kind."], 2, "Word and Structure Knowledge"),
      engItem(28, "Synonym of 'difficult' is:", ["easy", "hard", "simple", "soft"], 1, "Word and Structure Knowledge"),
      engItem(29, "Fill in: She is ___ European tourist.", ["a", "an", "the", "no article"], 0, "Word and Structure Knowledge"),
      engItem(30, "Correct spelling:", ["Tommorow", "Tomorrow", "Tommorrow", "Tomorow"], 1, "Word and Structure Knowledge"),
    ];
    const passage =
      "Aarav found a little puppy near the school gate. It was wet and shivering. He wrapped it in his scarf and took it home. His mother gave the puppy warm milk. They put up a notice to find its owner. Two days later, a girl named Meera came and thanked Aarav with tears of joy.";
    const reading = [
      engItem(31, `Read:\n"${passage}"\n\nWhere did Aarav find the puppy?`, ["In the park", "Near the school gate", "At the market", "On a bus"], 1, "Reading"),
      engItem(32, `Read:\n"${passage}"\n\nHow was the puppy when found?`, ["Happy and dry", "Wet and shivering", "Sleeping", "Barking loudly only"], 1, "Reading"),
      engItem(33, `Read:\n"${passage}"\n\nWhat did Aarav's mother give the puppy?`, ["Bones", "Warm milk", "Bread only", "Water only"], 1, "Reading"),
      engItem(34, `Read:\n"${passage}"\n\nWhy did they put up a notice?`, ["To sell the puppy", "To find its owner", "To name it", "To train it"], 1, "Reading"),
      engItem(35, `Read:\n"${passage}"\n\nWho came to take the puppy?`, ["A boy named Rohan", "A girl named Meera", "A policeman", "A teacher"], 1, "Reading"),
    ];
    const spoken = [
      engItem(36, "Reply to: 'Thank you very much.'", ["No.", "You're welcome.", "What?", "Bye only."], 1, "Spoken and Written Expression"),
      engItem(37, "Best way to refuse politely:", ["I hate that.", "I'm sorry, I can't right now.", "Never!", "You are wrong."], 1, "Spoken and Written Expression"),
      engItem(38, "Closing of a friendly letter:", ["Yours faithfully only always", "With love / Your friend", "Respected Sir", "To whom it may concern"], 1, "Spoken and Written Expression"),
      engItem(39, "Choose the best invitation line:", ["Come party now or else.", "You are cordially invited to my birthday party.", "Party. Come.", "I order you to come."], 1, "Spoken and Written Expression"),
      engItem(40, "Complete: Excuse me, ___ is the way to the station?", ["what", "which", "where", "who"], 1, "Spoken and Written Expression"),
    ];
    // fix Q40 - "which" works but "where" is better for way
    spoken[4] = engItem(40, "Complete: Excuse me, ___ is the railway station?", ["who", "where", "whom", "which person"], 1, "Spoken and Written Expression");
    papers.push(pack([...ws, ...reading, ...spoken]));
  }

  // Paper 3
  {
    const ws = [
      engItem(1, "Correct spelling:", ["Neccessary", "Necessary", "Necesary", "Neceserry"], 1, "Word and Structure Knowledge"),
      engItem(2, "Pick the verb: The sun rises in the east.", ["sun", "rises", "in", "east"], 1, "Word and Structure Knowledge"),
      engItem(3, "Article: ___ Ganga is a holy river.", ["A", "An", "The", "No article"], 2, "Word and Structure Knowledge"),
      engItem(4, "Antonym of 'generous' is:", ["kind", "selfish", "helpful", "noble"], 1, "Word and Structure Knowledge"),
      engItem(5, "Synonym of 'angry' is:", ["calm", "furious", "happy", "gentle"], 1, "Word and Structure Knowledge"),
      engItem(6, "Fill in: Look! The baby ___.", ["cry", "cries", "is crying", "cried always"], 2, "Word and Structure Knowledge"),
      engItem(7, "Plural of 'mouse' is:", ["mouses", "mice", "mouse", "meese"], 1, "Word and Structure Knowledge"),
      engItem(8, "Adjective in: The clever fox escaped.", ["The", "clever", "fox", "escaped"], 1, "Word and Structure Knowledge"),
      engItem(9, "Past of 'teach':", ["teached", "taught", "teaching", "teaches"], 1, "Word and Structure Knowledge"),
      engItem(10, "Abstract noun from 'kind':", ["kindly", "kindness", "kinder", "kinds"], 1, "Word and Structure Knowledge"),
      engItem(11, "Fill in: Distribute the sweets ___ the children.", ["between", "among", "in", "into"], 1, "Word and Structure Knowledge"),
      engItem(12, "Correct:", ["Each of the boys have a pen.", "Each of the boys has a pen.", "Each of the boys having a pen.", "Each of boys have pens."], 1, "Word and Structure Knowledge"),
      engItem(13, "Opposite of 'victory' is:", ["win", "defeat", "prize", "game"], 1, "Word and Structure Knowledge"),
      engItem(14, "One who treats sick people is a:", ["teacher", "doctor", "pilot", "chef"], 1, "Word and Structure Knowledge"),
      engItem(15, "Fill in: She plays ___ piano well.", ["a", "an", "the", "no article"], 2, "Word and Structure Knowledge"),
      engItem(16, "Conjunction: Work hard or you will fail.", ["Work", "hard", "or", "fail"], 2, "Word and Structure Knowledge"),
      engItem(17, "Comparative of 'beautiful':", ["beautifuler", "more beautiful", "most beautiful", "beautifullest"], 1, "Word and Structure Knowledge"),
      engItem(18, "Choose correct: Their / There / They're going to the park.", ["Their going", "There going", "They're going", "Theyre going"], 2, "Word and Structure Knowledge"),
      engItem(19, "Which is a reflexive pronoun?", ["him", "himself", "his", "he"], 1, "Word and Structure Knowledge"),
      engItem(20, "Fill in: By the time we arrived, the show ___.", ["starts", "started", "had started", "starting"], 2, "Word and Structure Knowledge"),
      engItem(21, "Feminine of 'hero' is:", ["heroine", "heroin", "heress", "her"], 0, "Word and Structure Knowledge"),
      engItem(22, "Add question tag: You are coming, ___?", ["are you", "aren't you", "isn't you", "don't you"], 1, "Word and Structure Knowledge"),
      engItem(23, "'Carefully' is a/an:", ["noun", "adjective", "adverb", "verb"], 2, "Word and Structure Knowledge"),
      engItem(24, "Fill in: Prefer tea ___ coffee.", ["than", "to", "from", "over only always"], 1, "Word and Structure Knowledge"),
      engItem(25, "Past participle of 'break':", ["broke", "broken", "breaking", "breaks"], 1, "Word and Structure Knowledge"),
      engItem(26, "Jumbled: raining / it / heavily / is", ["It is raining heavily.", "Is it heavily raining it.", "Raining it is heavily.", "Heavily is it raining it."], 0, "Word and Structure Knowledge"),
      engItem(27, "Imperative sentence:", ["What is this?", "Please open the window.", "She is tall.", "How nice!"], 1, "Word and Structure Knowledge"),
      engItem(28, "Synonym of 'famous' is:", ["unknown", "well-known", "hidden", "quiet"], 1, "Word and Structure Knowledge"),
      engItem(29, "Fill in: ___ hour ago, he left.", ["A", "An", "The", "No article"], 1, "Word and Structure Knowledge"),
      engItem(30, "Correct spelling:", ["Seperate", "Separate", "Saparate", "Separatte"], 1, "Word and Structure Knowledge"),
    ];
    const passage =
      "The school organised a science fair on Saturday. Classes 3 to 5 displayed models of volcanoes, water cycles and solar systems. Judges asked questions and gave stars to the best projects. Anita’s working model of a windmill won the first prize. The principal said that curiosity makes great scientists.";
    const reading = [
      engItem(31, `Read:\n"${passage}"\n\nWhen was the science fair held?`, ["Friday", "Saturday", "Sunday", "Monday"], 1, "Reading"),
      engItem(32, `Read:\n"${passage}"\n\nWhich classes took part?`, ["Only Class 5", "Classes 3 to 5", "Classes 1 to 2", "Only teachers"], 1, "Reading"),
      engItem(33, `Read:\n"${passage}"\n\nWhat did Anita make?`, ["A volcano", "A windmill model", "A robot", "A chart only"], 1, "Reading"),
      engItem(34, `Read:\n"${passage}"\n\nWho won the first prize?`, ["Ravi", "Anita", "The principal", "Judges"], 1, "Reading"),
      engItem(35, `Read:\n"${passage}"\n\nAccording to the principal, what makes great scientists?`, ["Money", "Curiosity", "Luck only", "Prizes"], 1, "Reading"),
    ];
    const spoken = [
      engItem(36, "When someone sneezes, we often say:", ["Congratulations", "Bless you / Excuse me response", "Happy birthday", "Good night only"], 1, "Spoken and Written Expression"),
      engItem(37, "Polite way to interrupt:", ["Stop talking!", "Sorry to interrupt, may I add something?", "You are boring.", "Shut up."], 1, "Spoken and Written Expression"),
      engItem(38, "Email subject should be:", ["Very long story", "Clear and short", "Empty", "Only emojis"], 1, "Spoken and Written Expression"),
      engItem(39, "Best apology:", ["Whatever.", "I'm really sorry for being late.", "Not my fault ever.", "You wait."], 1, "Spoken and Written Expression"),
      engItem(40, "Choose correct telephone greeting:", ["Who this?", "Hello, this is Neha speaking.", "What you want?", "Speak fast."], 1, "Spoken and Written Expression"),
    ];
    papers.push(pack([...ws, ...reading, ...spoken]));
  }

  // Paper 4
  {
    const ws = [
      engItem(1, "Correct spelling:", ["Diffrent", "Different", "Diferrent", "Differant"], 1, "Word and Structure Knowledge"),
      engItem(2, "Noun in: Honesty is the best policy.", ["Honesty", "is", "best", "the"], 0, "Word and Structure Knowledge"),
      engItem(3, "Article: She wants to be ___ engineer.", ["a", "an", "the", "no article"], 1, "Word and Structure Knowledge"),
      engItem(4, "Antonym of 'noisy' is:", ["loud", "quiet", "busy", "crowded"], 1, "Word and Structure Knowledge"),
      engItem(5, "Synonym of 'clever' is:", ["dull", "intelligent", "lazy", "slow"], 1, "Word and Structure Knowledge"),
      engItem(6, "Fill in: Yesterday we ___ a movie.", ["see", "seen", "saw", "seeing"], 2, "Word and Structure Knowledge"),
      engItem(7, "Plural of 'tomato' is:", ["tomatos", "tomatoes", "tomato", "tomatees"], 1, "Word and Structure Knowledge"),
      engItem(8, "Adverb of place: The children are playing outside.", ["children", "are", "playing", "outside"], 3, "Word and Structure Knowledge"),
      engItem(9, "Past of 'buy':", ["buyed", "bought", "buying", "buys"], 1, "Word and Structure Knowledge"),
      engItem(10, "Compound word:", ["sun", "flower", "sunflower", "flow"], 2, "Word and Structure Knowledge"),
      engItem(11, "Fill in: Divide the cake ___ two parts.", ["among", "into", "upon", "with"], 1, "Word and Structure Knowledge"),
      engItem(12, "Correct:", ["Me and Ram is friends.", "Ram and I are friends.", "I and Ram is friends.", "Ram and me are friend."], 1, "Word and Structure Knowledge"),
      engItem(13, "Opposite of 'arrival' is:", ["come", "departure", "entry", "visit"], 1, "Word and Structure Knowledge"),
      engItem(14, "A place where books are kept is a:", ["museum", "library", "stadium", "kitchen"], 1, "Word and Structure Knowledge"),
      engItem(15, "Fill in: He is ___ taller than his brother.", ["more", "much", "many", "most"], 1, "Word and Structure Knowledge"),
      engItem(16, "Relative pronoun: This is the boy ___ won the race.", ["which", "who", "whose", "whom"], 1, "Word and Structure Knowledge"),
      engItem(17, "Superlative of 'far':", ["farer", "farthest/furthest", "more far", "farest"], 1, "Word and Structure Knowledge"),
      engItem(18, "Choose: I have ___ work to do.", ["many", "much", "a few", "several only for count"], 1, "Word and Structure Knowledge"),
      engItem(19, "Which is a demonstrative pronoun?", ["myself", "this", "someone", "who"], 1, "Word and Structure Knowledge"),
      engItem(20, "Fill in: If it rains, we ___ indoors.", ["stays", "will stay", "stayed", "staying"], 1, "Word and Structure Knowledge"),
      engItem(21, "Masculine of 'duck' is:", ["drake", "gander", "rooster", "bull"], 0, "Word and Structure Knowledge"),
      engItem(22, "Indirect speech of: He said, \"I am tired.\"", ["He said that he was tired.", "He said that I am tired.", "He said he is tired.", "He says he was tired."], 0, "Word and Structure Knowledge"),
      engItem(23, "The word 'friendship' is a/an:", ["adjective", "abstract noun", "verb", "adverb"], 1, "Word and Structure Knowledge"),
      engItem(24, "Fill in: Hardly had he left ___ it started raining.", ["than", "when", "then", "so"], 1, "Word and Structure Knowledge"),
      engItem(25, "Past participle of 'sing':", ["sang", "sung", "singing", "sings"], 1, "Word and Structure Knowledge"),
      engItem(26, "Jumbled: always / truth / the / speak", ["Always speak the truth.", "Speak always truth the.", "The truth always speak.", "Truth the speak always."], 0, "Word and Structure Knowledge"),
      engItem(27, "Declarative sentence:", ["Open the door.", "Where are you?", "The Earth is round.", "What a goal!"], 2, "Word and Structure Knowledge"),
      engItem(28, "Synonym of 'assist' is:", ["hinder", "help", "stop", "hurt"], 1, "Word and Structure Knowledge"),
      engItem(29, "Fill in: She bought ___ dozen eggs.", ["a", "an", "the", "any"], 0, "Word and Structure Knowledge"),
      engItem(30, "Correct spelling:", ["Ocassion", "Occasion", "Occassion", "Ocasion"], 1, "Word and Structure Knowledge"),
    ];
    const passage =
      "During the summer camp, children learnt swimming, pottery and drama. Kabir was afraid of water at first. His coach encouraged him every day. By the end of the camp, Kabir could swim across the pool. He felt proud and promised to practise every weekend.";
    const reading = [
      engItem(31, `Read:\n"${passage}"\n\nWhat did children learn at the camp?`, ["Only maths", "Swimming, pottery and drama", "Only singing", "Only cricket"], 1, "Reading"),
      engItem(32, `Read:\n"${passage}"\n\nWho was afraid of water?`, ["The coach", "Kabir", "All children", "No one"], 1, "Reading"),
      engItem(33, `Read:\n"${passage}"\n\nWho encouraged Kabir?`, ["His friend", "His coach", "A stranger", "No one"], 1, "Reading"),
      engItem(34, `Read:\n"${passage}"\n\nWhat could Kabir do by the end?`, ["Dive from a cliff", "Swim across the pool", "Teach others only", "Leave the camp"], 1, "Reading"),
      engItem(35, `Read:\n"${passage}"\n\nWhat did Kabir promise?`, ["To stop swimming", "To practise every weekend", "To become a coach at once", "To avoid water"], 1, "Reading"),
    ];
    const spoken = [
      engItem(36, "Best response to a compliment 'Nice work!':", ["I know.", "Thank you!", "So what?", "You are wrong."], 1, "Spoken and Written Expression"),
      engItem(37, "Asking for permission politely:", ["I take this.", "May I use your eraser, please?", "Give eraser.", "Mine now."], 1, "Spoken and Written Expression"),
      engItem(38, "Diary entry usually starts with:", ["Respected Sir", "Dear Diary / Date", "Yours obediently", "Subject:"], 1, "Spoken and Written Expression"),
      engItem(39, "Choose suitable proverb meaning 'Don't delay':", ["Better late than never only", "A stitch in time saves nine", "All that glitters is gold", "Look before you leap only"], 1, "Spoken and Written Expression"),
      engItem(40, "Complete softener: I'm afraid I ___ come to the party.", ["can", "can't", "must", "will surely"], 1, "Spoken and Written Expression"),
    ];
    papers.push(pack([...ws, ...reading, ...spoken]));
  }

  // Paper 5
  {
    const ws = [
      engItem(1, "Correct spelling:", ["Febuary", "February", "Februry", "Febrary"], 1, "Word and Structure Knowledge"),
      engItem(2, "Pronoun: The gift is mine.", ["gift", "is", "mine", "the"], 2, "Word and Structure Knowledge"),
      engItem(3, "Article: Mount Everest is ___ highest peak.", ["a", "an", "the", "no article"], 2, "Word and Structure Knowledge"),
      engItem(4, "Antonym of 'polite' is:", ["kind", "rude", "gentle", "soft"], 1, "Word and Structure Knowledge"),
      engItem(5, "Synonym of 'rapid' is:", ["slow", "fast", "lazy", "late"], 1, "Word and Structure Knowledge"),
      engItem(6, "Fill in: She ___ finished her work already.", ["have", "has", "having", "had been have"], 1, "Word and Structure Knowledge"),
      engItem(7, "Plural of 'ox' is:", ["oxes", "oxen", "oxs", "oxens"], 1, "Word and Structure Knowledge"),
      engItem(8, "Pick the preposition: The cat is under the chair.", ["cat", "is", "under", "chair"], 2, "Word and Structure Knowledge"),
      engItem(9, "Past of 'think':", ["thinked", "thought", "thinking", "thinks"], 1, "Word and Structure Knowledge"),
      engItem(10, "Gender of 'peacock' feminine:", ["peahen", "peacess", "hen peacock", "pea"], 0, "Word and Structure Knowledge"),
      engItem(11, "Fill in: He is good ___ mathematics.", ["in", "at", "on", "for"], 1, "Word and Structure Knowledge"),
      engItem(12, "Correct:", ["Neither of the answers are correct.", "Neither of the answers is correct.", "Neither of answer are correct.", "Neither answers is corrects."], 1, "Word and Structure Knowledge"),
      engItem(13, "Opposite of 'include' is:", ["add", "exclude", "join", "enter"], 1, "Word and Structure Knowledge"),
      engItem(14, "A person who flies an aeroplane is a:", ["sailor", "pilot", "driver", "captain only of ship"], 1, "Word and Structure Knowledge"),
      engItem(15, "Fill in: ___ poor need our help.", ["A", "An", "The", "No article"], 2, "Word and Structure Knowledge"),
      engItem(16, "Conjunction pair: ___ he is rich, he is not happy.", ["Because", "Although", "So", "And"], 1, "Word and Structure Knowledge"),
      engItem(17, "Comparative of 'little' (quantity):", ["littler", "less", "least", "more little"], 1, "Word and Structure Knowledge"),
      engItem(18, "Homophones: The ___ is clear tonight. (night sky body)", ["son", "sun", "soon", "sin"], 1, "Word and Structure Knowledge"),
      engItem(19, "Indefinite pronoun:", ["this", "someone", "who", "my"], 1, "Word and Structure Knowledge"),
      engItem(20, "Fill in: The train ___ before we reached.", ["leaves", "left", "had left", "leaving"], 2, "Word and Structure Knowledge"),
      engItem(21, "Feminine of 'wizard' is:", ["witch", "wizardess", "sorcer", "fairy only"], 0, "Word and Structure Knowledge"),
      engItem(22, "Active to passive: She writes a letter.", ["A letter is written by her.", "A letter writes she.", "She is written a letter.", "A letter written she."], 0, "Word and Structure Knowledge"),
      engItem(23, "'Brightly' modifies a:", ["noun only", "verb (is an adverb)", "preposition", "conjunction"], 1, "Word and Structure Knowledge"),
      engItem(24, "Fill in: No sooner did he arrive ___ the lights went out.", ["when", "than", "then", "but"], 1, "Word and Structure Knowledge"),
      engItem(25, "Past participle of 'choose':", ["chose", "chosen", "choosing", "choosed"], 1, "Word and Structure Knowledge"),
      engItem(26, "Jumbled: never / lies / tell", ["Never tell lies.", "Tell never lies.", "Lies never tell.", "Never lies tell."], 0, "Word and Structure Knowledge"),
      engItem(27, "Optative sentence example:", ["May you succeed!", "Sit down.", "What is this?", "She runs."], 0, "Word and Structure Knowledge"),
      engItem(28, "Synonym of 'vanish' is:", ["appear", "disappear", "remain", "stay"], 1, "Word and Structure Knowledge"),
      engItem(29, "Fill in: It was ___ one-rupee coin.", ["a", "an", "the", "no article"], 0, "Word and Structure Knowledge"),
      engItem(30, "Correct spelling:", ["Priviledge", "Privilege", "Previlege", "Privilage"], 1, "Word and Structure Knowledge"),
    ];
    const passage =
      "Mina’s grandmother told her stories every night. The stories were about brave girls, clever animals and magical forests. Mina started writing her own short tales in a notebook. On Grandparents’ Day, she read one story aloud. Everyone clapped, and grandmother hugged her tightly.";
    const reading = [
      engItem(31, `Read:\n"${passage}"\n\nWho told Mina stories?`, ["Her teacher", "Her grandmother", "Her friend", "A stranger"], 1, "Reading"),
      engItem(32, `Read:\n"${passage}"\n\nWhat were the stories about?`, ["Only maths sums", "Brave girls, clever animals and magical forests", "Only news", "Only sports"], 1, "Reading"),
      engItem(33, `Read:\n"${passage}"\n\nWhat did Mina start doing?`, ["Singing only", "Writing her own short tales", "Painting walls", "Ignoring stories"], 1, "Reading"),
      engItem(34, `Read:\n"${passage}"\n\nWhen did she read a story aloud?`, ["On her birthday", "On Grandparents’ Day", "On sports day", "On a Monday only"], 1, "Reading"),
      engItem(35, `Read:\n"${passage}"\n\nHow did people react?`, ["They left", "They clapped", "They slept", "They shouted angrily"], 1, "Reading"),
    ];
    const spoken = [
      engItem(36, "Greeting at night:", ["Good morning", "Good night", "Good afternoon only", "Happy New Year only"], 1, "Spoken and Written Expression"),
      engItem(37, "Offering help:", ["Do it yourself.", "Would you like me to help you?", "I won't help.", "Not my problem."], 1, "Spoken and Written Expression"),
      engItem(38, "Message writing should be:", ["Long and confusing", "Brief and clear", "Without name", "Only drawings"], 1, "Spoken and Written Expression"),
      engItem(39, "Choose correct order of a story:", ["End–Middle–Beginning", "Beginning–Middle–End", "Middle–End–Beginning", "End–Beginning–Middle"], 1, "Spoken and Written Expression"),
      engItem(40, "Soft disagreement:", ["You are totally stupid.", "I see your point, but I think differently.", "Shut up.", "Never talk."], 1, "Spoken and Written Expression"),
    ];
    papers.push(pack([...ws, ...reading, ...spoken]));
  }

  return papers;
}

// ─────────────────────────────────────────────────────────────
// COMPUTER (ICSO-style)
// ─────────────────────────────────────────────────────────────
function computerPapers() {
  const papers = [];

  papers.push(
    pack([
      Q(1, "Odd one out: Monitor, Keyboard, Mouse, Chair", ["Monitor", "Keyboard", "Mouse", "Chair"], 3, "Logical Reasoning"),
      Q(2, "Analogy: Keyboard : Type :: Mouse : ?", ["Print", "Click/Point", "Scan", "Speak"], 1, "Logical Reasoning"),
      Q(3, "Next in order: Input → Process → ?", ["Delete", "Output", "Ignore", "Break"], 1, "Logical Reasoning"),
      Q(4, "If all computers need electricity and a laptop is a computer, then a laptop:", ["Needs no power", "Needs electricity", "Is not electronic", "Cannot process data"], 1, "Logical Reasoning"),
      Q(5, "Pattern: 2, 4, 8, 16, __ (think doubling like binary growth)", ["18", "20", "32", "24"], 2, "Logical Reasoning"),
      Q(6, "Which is an input device?", ["Monitor", "Printer", "Keyboard", "Speaker"], 2, "Computers and IT"),
      Q(7, "CPU stands for:", ["Central Processing Unit", "Computer Personal Unit", "Central Print Unit", "Control Program Utility"], 0, "Computers and IT"),
      Q(8, "Which stores data permanently until erased?", ["RAM", "Hard disk / SSD", "Cache only", "Register only"], 1, "Computers and IT"),
      Q(9, "MS Paint is used mainly for:", ["Calculations", "Drawing and editing images", "Sending email only", "Making slides only"], 1, "Computers and IT"),
      Q(10, "To copy selected text in Windows, press:", ["Ctrl + X", "Ctrl + C", "Ctrl + V", "Ctrl + Z"], 1, "Computers and IT"),
      Q(11, "Which is software?", ["Mouse", "MS Word", "Monitor", "Printer cable"], 1, "Computers and IT"),
      Q(12, "The blinking symbol on the screen that shows typing position is the:", ["Icon", "Cursor", "Menu", "Folder"], 1, "Computers and IT"),
      Q(13, "www stands for:", ["World Wide Web", "World Web Wide", "Wide World Web", "Web World Wide"], 0, "Computers and IT"),
      Q(14, "Which key erases character to the left of the cursor?", ["Enter", "Backspace", "Shift", "Ctrl"], 1, "Computers and IT"),
      Q(15, "A collection of 8 bits is called a:", ["Nibble", "Byte", "Word", "Megabit"], 1, "Computers and IT"),
      Q(16, "Which is an example of an operating system?", ["MS Excel", "Windows", "Google Chrome only", "Photoshop only"], 1, "Computers and IT"),
      Q(17, "To paste, we use:", ["Ctrl + C", "Ctrl + V", "Ctrl + X", "Ctrl + S"], 1, "Computers and IT"),
      Q(18, "A pen drive is used to:", ["Cool the CPU", "Store and carry data", "Display images only", "Print pages"], 1, "Computers and IT"),
      Q(19, "Which device produces hard copy?", ["Monitor", "Printer", "Speaker", "Scanner"], 1, "Computers and IT"),
      Q(20, "In MS Word, Bold makes text:", ["Larger", "Darker/thicker", "Italic", "Underlined only"], 1, "Computers and IT"),
      Q(21, "The brain of the computer is the:", ["Monitor", "CPU", "Keyboard", "UPS"], 1, "Computers and IT"),
      Q(22, "Which is a storage device?", ["Speaker", "DVD / USB drive", "Mouse", "Webcam"], 1, "Computers and IT"),
      Q(23, "Email is used to:", ["Cook food", "Send electronic messages", "Wash clothes", "Draw only"], 1, "Computers and IT"),
      Q(24, "Which should you NOT share online?", ["Your favourite colour", "Your password and OTP", "A drawing", "A joke"], 1, "Computers and IT"),
      Q(25, "Icons on the desktop are:", ["Small pictures representing programs/files", "Viruses", "Hardware parts", "Only games"], 0, "Computers and IT"),
      Q(26, "Scanner is used to:", ["Print paper", "Convert paper documents into digital form", "Play music", "Cool the PC"], 1, "Computers and IT"),
      Q(27, "Which is application software?", ["Linux kernel only", "Tux Paint / MS Word", "BIOS only", "Device driver only"], 1, "Computers and IT"),
      Q(28, "Full form of USB:", ["Universal Serial Bus", "United System Board", "Ultra Speed Bit", "User Software Base"], 0, "Computers and IT"),
      Q(29, "To undo the last action:", ["Ctrl + Y", "Ctrl + Z", "Ctrl + A", "Ctrl + P"], 1, "Computers and IT"),
      Q(30, "A network of networks across the world is the:", ["Intranet only", "Internet", "Bluetooth only", "LAN only"], 1, "Computers and IT"),
      Q(31, "RAM is called temporary memory because:", ["It is very small always", "Data is lost when power is off", "It cannot store numbers", "It is outside the PC"], 1, "Achievers Section", 2),
      Q(32, "Which sequence is correct for starting a PC?", ["Monitor on → Power on CPU → Login", "Remove RAM first", "Open CPU box first always", "Unplug keyboard"], 0, "Achievers Section", 2),
      Q(33, "If a file is in Recycle Bin, it means:", ["It is permanently destroyed always", "It can often be restored", "It is emailed", "It is printed"], 1, "Achievers Section", 2),
      Q(34, "Why do we use antivirus software?", ["To draw pictures", "To detect and help remove malware", "To increase font size", "To cool the laptop"], 1, "Achievers Section", 2),
      Q(35, "In a QWERTY keyboard, the keys Q W E R T Y are on the:", ["Bottom row", "Top letter row", "Number pad only", "Function row only"], 1, "Achievers Section", 2),
    ])
  );

  papers.push(
    pack([
      Q(1, "Odd one: Input, Output, Process, Furniture", ["Input", "Output", "Process", "Furniture"], 3, "Logical Reasoning"),
      Q(2, "Analogy: Printer : Output :: Scanner : ?", ["Output", "Input", "Storage only", "Software"], 1, "Logical Reasoning"),
      Q(3, "Order: Create file → Save → ?", ["Delete OS", "Open later / Close", "Break disk", "Remove CPU"], 1, "Logical Reasoning"),
      Q(4, "If software needs hardware to run, then MS Paint needs a:", ["Only paper", "Computer system", "Only pencil", "Only eraser"], 1, "Logical Reasoning"),
      Q(5, "Find next: Click, Double-click, ___", ["Triple sleep", "Right-click / Drag (user actions)", "Unplug", "Format only"], 1, "Logical Reasoning"),
      Q(6, "Which is an output device?", ["Mic", "Joystick", "Speaker", "Keyboard"], 2, "Computers and IT"),
      Q(7, "ALU stands for:", ["Arithmetic Logic Unit", "Application Logic Utility", "Advanced Linux Unit", "Array Large Unit"], 0, "Computers and IT"),
      Q(8, "Which memory is faster but smaller usually?", ["Hard disk", "Cache memory", "DVD", "Pen drive only"], 1, "Computers and IT"),
      Q(9, "In Tux Paint / Paint, the tool to fill colour is often called:", ["Eraser", "Fill / Paint bucket", "Text only", "Crop only"], 1, "Computers and IT"),
      Q(10, "Ctrl + A is used to:", ["Save", "Select all", "Copy", "Print"], 1, "Computers and IT"),
      Q(11, "Hardware is:", ["Physical parts of computer", "Only programs", "Only internet", "Only games"], 0, "Computers and IT"),
      Q(12, "A folder is used to:", ["Cool CPU", "Organise files", "Print faster", "Charge battery"], 1, "Computers and IT"),
      Q(13, "HTTP is related to:", ["Cooking", "Web pages on the internet", "Printing only", "Keyboard layout"], 1, "Computers and IT"),
      Q(14, "Function keys are:", ["F1 to F12 generally", "Only Enter", "Only Space", "Only Shift"], 0, "Computers and IT"),
      Q(15, "1 KB is equal to:", ["1000 bytes exactly always in binary", "1024 bytes", "100 bytes", "10 bytes"], 1, "Computers and IT"),
      Q(16, "Which is system software?", ["MS PowerPoint", "Operating system", "MS Excel", "Media player only"], 1, "Computers and IT"),
      Q(17, "To cut text use:", ["Ctrl + C", "Ctrl + X", "Ctrl + V", "Ctrl + B"], 1, "Computers and IT"),
      Q(18, "Webcam is mainly used for:", ["Printing", "Capturing video/images", "Cooling", "Storing OS only"], 1, "Computers and IT"),
      Q(19, "Soft copy means:", ["Printed paper", "Digital display on screen", "Handmade copy", "Carbon copy only"], 1, "Computers and IT"),
      Q(20, "In Word, italic makes text:", ["Thicker", "Slanted", "Underlined only", "Bigger only"], 1, "Computers and IT"),
      Q(21, "UPS helps to:", ["Provide backup power for short time", "Increase RAM forever", "Print colours", "Browse faster always"], 0, "Computers and IT"),
      Q(22, "CD/DVD is a:", ["Input-only device always", "Storage media", "Type of virus", "Operating system"], 1, "Computers and IT"),
      Q(23, "A search engine example is:", ["MS Word", "Google", "Paint", "Notepad only"], 1, "Computers and IT"),
      Q(24, "Cyber safety tip:", ["Share OTP with friends", "Do not share passwords", "Click all unknown links", "Use same password everywhere"], 1, "Computers and IT"),
      Q(25, "Desktop is:", ["The main screen area after login", "A type of virus", "Only a furniture item in software", "A printer"], 0, "Computers and IT"),
      Q(26, "Microphone is an:", ["Output device", "Input device", "Storage device", "Operating system"], 1, "Computers and IT"),
      Q(27, "Spreadsheet software example:", ["MS Excel", "MS Paint", "VLC only", "Notepad only"], 0, "Computers and IT"),
      Q(28, "GUI stands for:", ["Graphical User Interface", "General Utility Input", "Guided User Internet", "Global Unique Icon"], 0, "Computers and IT"),
      Q(29, "To save a file:", ["Ctrl + S", "Ctrl + P", "Ctrl + N only", "Alt + F4 only"], 0, "Computers and IT"),
      Q(30, "LAN means:", ["Local Area Network", "Large Access Node", "Long Antenna Net", "Logical Application Name"], 0, "Computers and IT"),
      Q(31, "Why is shutdown better than just switching off power?", ["It looks nice", "It closes programs safely and saves data", "It deletes files", "It increases viruses"], 1, "Achievers Section", 2),
      Q(32, "Difference between Save and Save As:", ["No difference", "Save As lets you choose new name/location", "Save As deletes file", "Save prints the file"], 1, "Achievers Section", 2),
      Q(33, "Phishing emails try to:", ["Help you study", "Trick you into giving personal information", "Charge your battery", "Fix hardware"], 1, "Achievers Section", 2),
      Q(34, "Bits are 0 and 1 because computers use:", ["Decimal only", "Binary system", "Roman system", "Only words"], 1, "Achievers Section", 2),
      Q(35, "Which device is both input and output?", ["Keyboard only", "Touch screen", "Mouse only", "Speaker only"], 1, "Achievers Section", 2),
    ])
  );

  papers.push(
    pack([
      Q(1, "Odd one: Windows, Linux, Android, Monitor", ["Windows", "Linux", "Android", "Monitor"], 3, "Logical Reasoning"),
      Q(2, "Analogy: File : Folder :: Book : ?", ["Page", "Shelf/Library", "Author only", "Word"], 1, "Logical Reasoning"),
      Q(3, "Correct IPO cycle start:", ["Output first", "Input first", "Process without input", "Delete first"], 1, "Logical Reasoning"),
      Q(4, "If Ctrl+C copies, Ctrl+V:", ["Cuts", "Pastes", "Saves", "Closes"], 1, "Logical Reasoning"),
      Q(5, "Series of storage size (small to large): Byte, KB, MB, __", ["Bit", "GB", "Nibble", "Flag"], 1, "Logical Reasoning"),
      Q(6, "Joystick is commonly used for:", ["Typing essays", "Playing games", "Printing", "Scanning books"], 1, "Computers and IT"),
      Q(7, "The full form of PC is:", ["Personal Computer", "Public Circuit", "Primary Code", "Power Cable"], 0, "Computers and IT"),
      Q(8, "ROM stores:", ["Only temporary user files", "Firmware/permanent instructions", "Only videos", "Only emails"], 1, "Computers and IT"),
      Q(9, "In presentation software, each screen is a:", ["Sheet", "Slide", "Cell", "Record"], 1, "Computers and IT"),
      Q(10, "Ctrl + P is used to:", ["Paste", "Print", "Pause OS", "Partition disk"], 1, "Computers and IT"),
      Q(11, "Example of hardware:", ["MS Word", "Printer", "Windows Media Player", "Antivirus app only"], 1, "Computers and IT"),
      Q(12, "Extension .jpg usually means:", ["A text file", "An image file", "A sound only file", "An executable always"], 1, "Computers and IT"),
      Q(13, "Browser is used to:", ["Browse websites", "Cook food", "Wash clothes", "Only edit videos"], 0, "Computers and IT"),
      Q(14, "Caps Lock is used to:", ["Type capital letters continuously", "Delete files", "Shut down", "Open browser"], 0, "Computers and IT"),
      Q(15, "1 MB is approximately:", ["1024 KB", "1024 GB", "100 bits", "10 KB"], 0, "Computers and IT"),
      Q(16, "Booting means:", ["Starting the computer and loading OS", "Deleting Windows", "Printing a page", "Scanning a photo"], 0, "Computers and IT"),
      Q(17, "To redo in many apps:", ["Ctrl + Z", "Ctrl + Y", "Ctrl + X", "Ctrl + A"], 1, "Computers and IT"),
      Q(18, "Bluetooth is used for:", ["Short-range wireless connection", "Cooking", "Long undersea cables only", "Only printing newspapers"], 0, "Computers and IT"),
      Q(19, "Hard copy is:", ["On screen", "Printed on paper", "Only in RAM", "Only audio"], 1, "Computers and IT"),
      Q(20, "Underline shortcut often is:", ["Ctrl + U", "Ctrl + I", "Ctrl + B", "Ctrl + S"], 0, "Computers and IT"),
      Q(21, "Motherboard connects:", ["Only the mouse", "Main components of the computer", "Only the printer outside", "Only speakers"], 1, "Computers and IT"),
      Q(22, "Cloud storage example:", ["Google Drive", "Only floppy disk", "Only CRT monitor", "Only keyboard"], 0, "Computers and IT"),
      Q(23, "Spam means:", ["Unwanted junk messages", "A type of hardware", "An OS", "A storage unit"], 0, "Computers and IT"),
      Q(24, "Strong password should include:", ["Only your name", "Mix of letters, numbers and symbols", "Only 1234", "Your birth year alone"], 1, "Computers and IT"),
      Q(25, "Taskbar is usually found at the:", ["Bottom of the screen in Windows", "Inside CPU chip", "On the printer", "Only on phone cases"], 0, "Computers and IT"),
      Q(26, "Light pen is an:", ["Output device only", "Input device", "OS", "Virus"], 1, "Computers and IT"),
      Q(27, "Multimedia includes:", ["Only text", "Text, audio, images, video", "Only numbers", "Only binary without media"], 1, "Computers and IT"),
      Q(28, "URL is the:", ["Address of a web page", "Name of CPU", "Type of mouse", "Printer ink"], 0, "Computers and IT"),
      Q(29, "New document shortcut often:", ["Ctrl + N", "Ctrl + O", "Ctrl + W", "Ctrl + Q"], 0, "Computers and IT"),
      Q(30, "Wi-Fi allows:", ["Wireless internet/network access", "Faster printing always without router", "Cooling of laptop", "Automatic coding"], 0, "Computers and IT"),
      Q(31, "Why back up important files?", ["To waste space", "To recover data if device fails", "To slow the PC", "To remove antivirus"], 1, "Achievers Section", 2),
      Q(32, "Difference between hardware and software:", ["No difference", "Hardware is physical; software is programs/instructions", "Software is only metal", "Hardware is only apps"], 1, "Achievers Section", 2),
      Q(33, "If a website asks for your school password by email, you should:", ["Reply immediately", "Not share; verify with a trusted adult", "Forward to friends", "Post on social media"], 1, "Achievers Section", 2),
      Q(34, "Algorithm in simple terms is:", ["A cooking gas", "A step-by-step method to solve a problem", "A type of monitor", "A game console only"], 1, "Achievers Section", 2),
      Q(35, "Which is true about free Wi-Fi in public places?", ["Always 100% safe", "Be careful; avoid banking logins on unknown networks", "Share all OTPs", "No risk ever"], 1, "Achievers Section", 2),
    ])
  );

  papers.push(
    pack([
      Q(1, "Odd one: Copy, Paste, Cut, Sleep (as computer commands vs human)", ["Copy", "Paste", "Cut", "Sleep"], 3, "Logical Reasoning"),
      Q(2, "Analogy: Monitor : Display :: Keyboard : ?", ["Sound", "Input text", "Print", "Cool"], 1, "Logical Reasoning"),
      Q(3, "Order to print a document: Open → ___ → Print", ["Delete OS", "Give print command", "Remove RAM", "Format C:"], 1, "Logical Reasoning"),
      Q(4, "If a computer has no input devices, it cannot easily:", ["Receive user data/commands", "Have electricity", "Have a box", "Have weight"], 0, "Logical Reasoning"),
      Q(5, "Pattern of keys: A B C D __", ["F", "E", "G", "Z"], 1, "Logical Reasoning"),
      Q(6, "Touchpad is commonly found on a:", ["Desktop CRT only", "Laptop", "Printer", "Projector"], 1, "Computers and IT"),
      Q(7, "ICT stands for:", ["Information and Communication Technology", "Internet Computer Tool", "Internal Chip Transfer", "Icon Control Tab"], 0, "Computers and IT"),
      Q(8, "Secondary storage example:", ["Registers only", "Hard disk", "Cache only", "ALU"], 1, "Computers and IT"),
      Q(9, "In Excel, the box formed by a row and column is a:", ["Slide", "Cell", "Frame", "Pixel only"], 1, "Computers and IT"),
      Q(10, "Ctrl + B toggles:", ["Bold", "Save", "Paste", "Undo"], 0, "Computers and IT"),
      Q(11, "Firmware is:", ["A type of permanent software on hardware", "Only a game", "Only a cable", "Only a desk"], 0, "Computers and IT"),
      Q(12, "File extension .mp3 is usually:", ["Image", "Audio", "Spreadsheet", "Executable only"], 1, "Computers and IT"),
      Q(13, "Downloading means:", ["Sending file to internet from PC", "Receiving file from internet to PC", "Deleting file", "Printing file"], 1, "Computers and IT"),
      Q(14, "Enter key is used to:", ["Start a new line / confirm", "Only shut down", "Only bold text", "Only open CD tray"], 0, "Computers and IT"),
      Q(15, "Bitmap images are made of:", ["Only vectors always", "Pixels", "Only text", "Only sound waves"], 1, "Computers and IT"),
      Q(16, "Device driver is:", ["Software that helps OS talk to hardware", "A car part only", "A type of virus always", "A game"], 0, "Computers and IT"),
      Q(17, "Screenshot captures:", ["Sound only", "What is on the screen", "Only CPU heat", "Only passwords safely"], 1, "Computers and IT"),
      Q(18, "HDMI cable is used to:", ["Carry high-definition video/audio signals", "Charge only phones always", "Cool CPU", "Clean dust"], 0, "Computers and IT"),
      Q(19, "Plotter is a type of:", ["Input device", "Output device for large drawings", "OS", "Memory chip"], 1, "Computers and IT"),
      Q(20, "Alignment options in Word include:", ["Left, Centre, Right, Justify", "Only Bold", "Only Italic", "Only Colour"], 0, "Computers and IT"),
      Q(21, "Heat sink/fan helps to:", ["Cool the processor", "Store files", "Browse web", "Type faster"], 0, "Computers and IT"),
      Q(22, "SSD compared to old HDD is generally:", ["Slower always", "Faster and has no spinning disk", "Heavier always", "Only for audio"], 1, "Computers and IT"),
      Q(23, "Attachment in email is:", ["A file sent with the message", "Only the subject", "Only CC", "A virus by definition"], 0, "Computers and IT"),
      Q(24, "Digital footprint means:", ["Marks of shoes", "Trail of your online activities", "Printer toner", "Keyboard dust"], 1, "Computers and IT"),
      Q(25, "Start button in Windows is used to:", ["Open the Start menu/apps", "Eject DVD only", "Increase volume only", "Change wallpaper only"], 0, "Computers and IT"),
      Q(26, "Barcode reader is an:", ["Output device", "Input device", "OS", "Storage only"], 1, "Computers and IT"),
      Q(27, "Animation in slides means:", ["Static text only", "Motion effects on objects", "Deleting slides", "Printing handouts"], 1, "Computers and IT"),
      Q(28, "IP address identifies a:", ["Device on a network", "Type of font", "Mouse brand only", "Chair"], 0, "Computers and IT"),
      Q(29, "Find and Replace helps to:", ["Search text and change it", "Draw circles", "Cool laptop", "Charge battery"], 0, "Computers and IT"),
      Q(30, "Firewall helps to:", ["Block unauthorised network access", "Cook food", "Wash screen", "Increase font"], 0, "Computers and IT"),
      Q(31, "Why update software?", ["For no reason", "To fix bugs and improve security", "To delete all files", "To remove keyboard"], 1, "Achievers Section", 2),
      Q(32, "Machine language uses:", ["English paragraphs", "Binary instructions", "Only pictures", "Only sound"], 1, "Achievers Section", 2),
      Q(33, "If two files have the same name in one folder:", ["Both stay with same name easily in same place", "You usually cannot have identical names in same folder", "Computer doubles RAM", "Printer jams always"], 1, "Achievers Section", 2),
      Q(34, "Ergonomics for computer use suggests:", ["Sit with good posture and proper screen height", "Lie down always", "Keep screen behind you", "Type with one finger in dark only"], 0, "Achievers Section", 2),
      Q(35, "Open source software means:", ["Source code can be studied/modified under its license", "It is always paid only", "It has no users", "It cannot be installed"], 0, "Achievers Section", 2),
    ])
  );

  papers.push(
    pack([
      Q(1, "Odd one: Google, Bing, Yahoo, Excel", ["Google", "Bing", "Yahoo", "Excel"], 3, "Logical Reasoning"),
      Q(2, "Analogy: Virus : Antivirus :: Dirt : ?", ["Soap/Cleaner", "More dirt", "Virus", "Code"], 0, "Logical Reasoning"),
      Q(3, "Steps: Write code → ___ → Get output (simple)", ["Compile/Run", "Throw PC", "Remove monitor", "Unplug forever"], 0, "Logical Reasoning"),
      Q(4, "If storage is full, you should:", ["Save more huge videos only", "Delete/move unused files or add storage", "Break the disk", "Ignore forever"], 1, "Logical Reasoning"),
      Q(5, "Next icon idea: Folder, File, ___", ["Document/App shortcut", "Tree only", "River", "Mountain"], 0, "Logical Reasoning"),
      Q(6, "OCR stands for:", ["Optical Character Recognition", "Online Computer RAM", "Output Control Register", "Open Code Reader"], 0, "Computers and IT"),
      Q(7, "The first calculating device often taught is:", ["Abacus", "Laptop", "Smartphone", "Drone"], 0, "Computers and IT"),
      Q(8, "Virtual memory uses:", ["Part of storage as extra RAM help", "Only keyboard", "Only mouse", "Only speakers"], 0, "Computers and IT"),
      Q(9, "In coding for kids, a loop is used to:", ["Repeat instructions", "Delete OS", "Print once only always", "Turn off Wi-Fi"], 0, "Computers and IT"),
      Q(10, "Shortcut to open Run dialog in Windows often:", ["Windows + R", "Ctrl + Alt + Delete only", "Ctrl + S", "Alt + F4"], 0, "Computers and IT"),
      Q(11, "Peripheral devices are:", ["External devices connected to computer", "Only CPU core", "Only RAM chips inside", "Only BIOS"], 0, "Computers and IT"),
      Q(12, ".pptx is usually a:", ["PowerPoint file", "Excel file", "Audio file", "Image only"], 0, "Computers and IT"),
      Q(13, "Uploading means:", ["Sending files from your device to internet/server", "Only downloading games", "Only printing", "Only scanning"], 0, "Computers and IT"),
      Q(14, "Esc key is used to:", ["Escape/cancel a dialog", "Save always", "Bold text", "Increase volume"], 0, "Computers and IT"),
      Q(15, "Resolution of a screen relates to:", ["Number of pixels clarity", "Weight of PC", "Colour of mouse only", "Cable length only"], 0, "Computers and IT"),
      Q(16, "Utility software example:", ["Disk cleanup / antivirus tools", "Only novels", "Only chairs", "Only food"], 0, "Computers and IT"),
      Q(17, "Zoom in on many apps:", ["Ctrl + Plus", "Ctrl + W", "Alt + F4", "Shift + Delete"], 0, "Computers and IT"),
      Q(18, "GPS helps in:", ["Finding location/navigation", "Cooking pasta", "Washing clothes", "Only drawing"], 0, "Computers and IT"),
      Q(19, "Dot matrix is a type of:", ["Printer", "Mouse", "OS", "Browser"], 0, "Computers and IT"),
      Q(20, "Header and footer appear in:", ["Top and bottom of pages", "Only middle of CPU", "Only taskbar", "Only recycle bin"], 0, "Computers and IT"),
      Q(21, "Clock speed of CPU is measured in:", ["Hertz (GHz)", "Litres", "Kilograms", "Pixels only"], 0, "Computers and IT"),
      Q(22, "Backup to external drive protects against:", ["Data loss from device failure", "Only slow typing", "Only low volume", "Only dark rooms"], 0, "Computers and IT"),
      Q(23, "CC in email means:", ["Carbon Copy", "Computer Code", "Central Control", "Close Connection"], 0, "Computers and IT"),
      Q(24, "Cyberbullying should be:", ["Ignored forever without help", "Reported to trusted adults", "Returned with more bullying", "Celebrated"], 1, "Computers and IT"),
      Q(25, "Wallpaper is:", ["Background image on desktop", "A virus", "A printer part", "An email type"], 0, "Computers and IT"),
      Q(26, "Biometric input example:", ["Fingerprint scanner", "Only speaker", "Only headphones", "Only projector"], 0, "Computers and IT"),
      Q(27, "Hyperlink is used to:", ["Jump to another page/location", "Cook food", "Cool CPU", "Wash screen"], 0, "Computers and IT"),
      Q(28, "Domain .edu usually relates to:", ["Education institutions", "Only shops", "Only games", "Only governments always"], 0, "Computers and IT"),
      Q(29, "Spell check helps to:", ["Find spelling mistakes", "Increase RAM", "Charge battery", "Clean keyboard dust"], 0, "Computers and IT"),
      Q(30, "IoT means:", ["Internet of Things", "Input of Text", "Icon of Tools", "Internal only Terminal"], 0, "Computers and IT"),
      Q(31, "Why use different passwords for important accounts?", ["No reason", "If one is stolen, others stay safer", "To forget all easily", "Because websites require same password"], 1, "Achievers Section", 2),
      Q(32, "Debugging means:", ["Finding and fixing errors in a program", "Deleting the computer", "Painting the monitor", "Buying new RAM always"], 0, "Achievers Section", 2),
      Q(33, "Which is the safest action for a suspicious USB found outside?", ["Plug into school PC immediately", "Do not plug; hand to teacher/IT", "Share files from it", "Open all files at home first"], 1, "Achievers Section", 2),
      Q(34, "Cloud computing mainly provides:", ["Services/storage over the internet", "Only wooden boxes", "Only offline abacus", "Only paper files"], 0, "Achievers Section", 2),
      Q(35, "In Scratch-like coding, a sprite is:", ["A character/object you can program", "A type of virus", "A power cable", "An OS kernel only"], 0, "Achievers Section", 2),
    ])
  );

  return papers;
}

// ─────────────────────────────────────────────────────────────
// GK (IGKO-style)
// ─────────────────────────────────────────────────────────────
function gkPapers() {
  const papers = [];

  papers.push(
    pack([
      // General Awareness 20
      Q(1, "The capital of India is:", ["Mumbai", "New Delhi", "Kolkata", "Chennai"], 1, "General Awareness"),
      Q(2, "The national animal of India is the:", ["Elephant", "Tiger", "Lion", "Peacock"], 1, "General Awareness"),
      Q(3, "The largest ocean in the world is the:", ["Indian Ocean", "Atlantic Ocean", "Pacific Ocean", "Arctic Ocean"], 2, "General Awareness"),
      Q(4, "Who is known as the Father of the Nation in India?", ["Jawaharlal Nehru", "Mahatma Gandhi", "Subhas Chandra Bose", "Bhagat Singh"], 1, "General Awareness"),
      Q(5, "The Taj Mahal is in:", ["Delhi", "Agra", "Jaipur", "Mumbai"], 1, "General Awareness"),
      Q(6, "Which planet is called the Blue Planet?", ["Mars", "Earth", "Venus", "Jupiter"], 1, "General Awareness"),
      Q(7, "The currency of Japan is the:", ["Yuan", "Yen", "Won", "Dollar"], 1, "General Awareness"),
      Q(8, "Himalayas are in which direction of India?", ["South", "North", "East", "West"], 1, "General Awareness"),
      Q(9, "The national flower of India is the:", ["Rose", "Lotus", "Sunflower", "Lily"], 1, "General Awareness"),
      Q(10, "Which is the longest river in India?", ["Yamuna", "Ganga", "Godavari sometimes debated but Ganga traditionally taught", "Narmada"], 1, "General Awareness"),
      Q(11, "The Red Fort is in:", ["Mumbai", "Delhi", "Hyderabad", "Pune"], 1, "General Awareness"),
      Q(12, "Who wrote the national anthem of India?", ["Bankim Chandra Chatterjee", "Rabindranath Tagore", "Sarojini Naidu", "Mirza Ghalib"], 1, "General Awareness"),
      Q(13, "The festival of lights is:", ["Holi", "Diwali", "Eid", "Pongal only"], 1, "General Awareness"),
      Q(14, "Which gas do humans need to breathe?", ["CO2", "Oxygen", "Nitrogen only", "Helium"], 1, "General Awareness"),
      Q(15, "The Great Wall is in:", ["India", "China", "Japan", "Egypt"], 1, "General Awareness"),
      Q(16, "A leap year has how many days?", ["365", "366", "364", "360"], 1, "General Awareness"),
      Q(17, "The national bird of India is the:", ["Sparrow", "Peacock", "Eagle", "Parrot"], 1, "General Awareness"),
      Q(18, "Which is a classical dance of Tamil Nadu?", ["Kathak", "Bharatanatyam", "Odissi", "Manipuri"], 1, "General Awareness"),
      Q(19, "The President of India lives in the:", ["Red Fort", "Rashtrapati Bhavan", "India Gate", "Parliament only"], 1, "General Awareness"),
      Q(20, "Which instrument did Pt. Ravi Shankar play?", ["Tabla", "Sitar", "Flute", "Violin"], 1, "General Awareness"),
      // Current Affairs 5 (stable/evergreen recent-knowledge style for kids)
      Q(21, "Chandrayaan missions are related to India's exploration of the:", ["Sun only", "Moon", "Mars only", "Ocean floor only"], 1, "Current Affairs"),
      Q(22, "The G20 summit is a meeting of:", ["Only film stars", "Major world economies", "Only school students", "Only sports coaches"], 1, "Current Affairs"),
      Q(23, "UPI in India is mainly used for:", ["Cooking", "Digital payments", "Farming only", "Painting"], 1, "Current Affairs"),
      Q(24, "International Yoga Day is celebrated on:", ["15 August", "21 June", "26 January", "2 October"], 1, "Current Affairs"),
      Q(25, "The Olympic Games are held every:", ["Year", "2 years", "4 years", "10 years"], 2, "Current Affairs"),
      // Life Skills 5
      Q(26, "If a stranger offers you a gift alone, you should:", ["Take it secretly", "Refuse and tell a trusted adult", "Go with them", "Share your address"], 1, "Life Skills"),
      Q(27, "Washing hands before eating helps to:", ["Waste water only", "Prevent germs and illness", "Grow taller instantly", "Change hair colour"], 1, "Life Skills"),
      Q(28, "When you make a mistake, a good habit is to:", ["Blame others always", "Admit and learn", "Hide forever", "Lie"], 1, "Life Skills"),
      Q(29, "Crossing the road, you should use:", ["Any random place", "Zebra crossing / follow signals", "Closed eyes", "Running between cars"], 1, "Life Skills"),
      Q(30, "Saving water means:", ["Leaving taps open", "Closing taps when not needed", "Wasting bottles", "Polluting rivers"], 1, "Life Skills"),
      // Achievers 5
      Q(31, "India’s national song ‘Vande Mataram’ was written by:", ["Rabindranath Tagore", "Bankim Chandra Chatterjee", "Mahatma Gandhi", "Sarojini Naidu"], 1, "Achievers Section", 2),
      Q(32, "Which Indian state is known as the ‘Land of Five Rivers’?", ["Rajasthan", "Punjab", "Kerala", "Goa"], 1, "Achievers Section", 2),
      Q(33, "The Constitution of India came into effect on:", ["15 August 1947", "26 January 1950", "2 October 1947", "26 November only as drafting day confusion — 26 Jan 1950"], 1, "Achievers Section", 2),
      Q(34, "Who was the first Prime Minister of India?", ["Sardar Patel", "Jawaharlal Nehru", "Lal Bahadur Shastri", "Dr. Rajendra Prasad"], 1, "Achievers Section", 2),
      Q(35, "The Sunderbans are famous for:", ["Thar desert", "Mangrove forests and tigers", "Himalayan snow only", "Only coffee estates"], 1, "Achievers Section", 2),
    ])
  );

  papers.push(
    pack([
      Q(1, "The national fruit of India is the:", ["Apple", "Mango", "Banana", "Orange"], 1, "General Awareness"),
      Q(2, "Which is the smallest continent?", ["Asia", "Australia", "Europe", "Antarctica"], 1, "General Awareness"),
      Q(3, "The currency of the USA is the:", ["Pound", "Dollar", "Euro", "Yen"], 1, "General Awareness"),
      Q(4, "Who discovered gravity (famous story of apple)?", ["Einstein", "Newton", "Edison", "Galileo only for telescope"], 1, "General Awareness"),
      Q(5, "India Gate is in:", ["Mumbai", "New Delhi", "Kolkata", "Chennai"], 1, "General Awareness"),
      Q(6, "The hottest planet in the solar system is:", ["Mercury", "Venus", "Mars", "Jupiter"], 1, "General Awareness"),
      Q(7, "Which is a primary colour?", ["Green", "Red", "Orange", "Purple"], 1, "General Awareness"),
      Q(8, "The Thar Desert is mainly in:", ["Kerala", "Rajasthan", "Assam", "Sikkim"], 1, "General Awareness"),
      Q(9, "National tree of India is the:", ["Neem", "Banyan", "Peepal only", "Mango"], 1, "General Awareness"),
      Q(10, "Which river is called the ‘Ganga of the South’?", ["Narmada", "Godavari", "Yamuna", "Beas"], 1, "General Awareness"),
      Q(11, "Qutub Minar is in:", ["Agra", "Delhi", "Jaipur", "Lucknow"], 1, "General Awareness"),
      Q(12, "Who is called the Missile Man of India?", ["Vikram Sarabhai", "Dr. A.P.J. Abdul Kalam", "Homi Bhabha", "C.V. Raman"], 1, "General Awareness"),
      Q(13, "Holi is the festival of:", ["Lights", "Colours", "Harvest only in north always", "Brothers only"], 1, "General Awareness"),
      Q(14, "Bones and teeth need which mineral most famously?", ["Iron only", "Calcium", "Iodine only", "Sodium only"], 1, "General Awareness"),
      Q(15, "Pyramids are famous in:", ["India", "Egypt", "Japan", "Brazil"], 1, "General Awareness"),
      Q(16, "How many players are there in a cricket team on the field for one side?", ["9", "11", "7", "15"], 1, "General Awareness"),
      Q(17, "The national aquatic animal of India is the:", ["Shark", "Gangetic dolphin", "Whale", "Crocodile"], 1, "General Awareness"),
      Q(18, "Kathak is a classical dance of:", ["Kerala", "North India (Uttar Pradesh region)", "Manipur only", "Tamil Nadu only"], 1, "General Awareness"),
      Q(19, "The Parliament of India is in:", ["Mumbai", "New Delhi", "Kolkata", "Bengaluru"], 1, "General Awareness"),
      Q(20, "Tabla is a:", ["String instrument", "Percussion instrument", "Wind instrument", "Electronic only"], 1, "General Awareness"),
      Q(21, "ISRO is India’s agency for:", ["Sports", "Space research", "Banking", "Railways only"], 1, "Current Affairs"),
      Q(22, "Aadhaar is a:", ["12-digit unique identity number in India", "Type of fruit", "Dance form", "Mountain"], 0, "Current Affairs"),
      Q(23, "The COVID-19 pandemic taught the importance of:", ["Never washing hands", "Hygiene, masks when needed and vaccines as guided", "Avoiding all science", "Closing all schools forever"], 1, "Current Affairs"),
      Q(24, "Earth Day is observed to promote:", ["Pollution", "Environment protection", "Deforestation", "Wasting plastic"], 1, "Current Affairs"),
      Q(25, "FIFA World Cup is related to:", ["Cricket", "Football (soccer)", "Hockey only", "Tennis only"], 1, "Current Affairs"),
      Q(26, "If you get lost in a mall, you should:", ["Panic and run out alone", "Stay calm and seek help desk/security", "Hide", "Talk to any stranger privately"], 1, "Life Skills"),
      Q(27, "Saying ‘please’ and ‘thank you’ shows:", ["Weakness", "Good manners", "Anger", "Fear only"], 1, "Life Skills"),
      Q(28, "A balanced diet includes:", ["Only sweets", "Variety of foods from different groups", "Only fried food", "Only soft drinks"], 1, "Life Skills"),
      Q(29, "In case of fire at home, a safe action is:", ["Hide under bed with door closed forever without help", "Alert others and get out; call emergency help", "Open all gas knobs", "Use lift in a burning building always"], 1, "Life Skills"),
      Q(30, "Respecting elders means:", ["Ignoring them", "Listening and being polite", "Shouting", "Never helping"], 1, "Life Skills"),
      Q(31, "Which is the southernmost tip of mainland India commonly taught?", ["Kashmir", "Kanyakumari", "Gujarat", "Sikkim"], 1, "Achievers Section", 2),
      Q(32, "The Ashoka Chakra in the Indian flag has how many spokes?", ["12", "24", "36", "48"], 1, "Achievers Section", 2),
      Q(33, "Who was the first woman Prime Minister of India?", ["Sarojini Naidu", "Indira Gandhi", "Pratibha Patil", "Mother Teresa"], 1, "Achievers Section", 2),
      Q(34, "Kaziranga National Park is famous for:", ["Asiatic lions", "One-horned rhinoceros", "Penguins", "Kangaroos"], 1, "Achievers Section", 2),
      Q(35, "The official language listed first in the Constitution for the Union is:", ["English only", "Hindi", "Sanskrit only", "Tamil only"], 1, "Achievers Section", 2),
    ])
  );

  papers.push(
    pack([
      Q(1, "Which is the largest state of India by area?", ["Goa", "Rajasthan", "Kerala", "Sikkim"], 1, "General Awareness"),
      Q(2, "The Pacific Ocean is named after a word meaning:", ["Stormy", "Peaceful", "Dark", "Cold"], 1, "General Awareness"),
      Q(3, "Currency of the United Kingdom is the:", ["Dollar", "Pound sterling", "Euro only", "Franc"], 1, "General Awareness"),
      Q(4, "Who invented the telephone (commonly credited)?", ["Edison", "Alexander Graham Bell", "Newton", "Wright brothers"], 1, "General Awareness"),
      Q(5, "Charminar is in:", ["Delhi", "Hyderabad", "Agra", "Jaipur"], 1, "General Awareness"),
      Q(6, "Which planet has a big red spot?", ["Mars", "Jupiter", "Venus", "Mercury"], 1, "General Awareness"),
      Q(7, "How many colours are in a rainbow?", ["5", "7", "9", "6"], 1, "General Awareness"),
      Q(8, "Sundarbans are in which region?", ["West Bengal / Bangladesh delta", "Rajasthan", "Ladakh", "Goa only"], 0, "General Awareness"),
      Q(9, "National river of India is the:", ["Yamuna", "Ganga", "Narmada", "Kaveri"], 1, "General Awareness"),
      Q(10, "Gateway of India is in:", ["Delhi", "Mumbai", "Chennai", "Kolkata"], 1, "General Awareness"),
      Q(11, "Who composed Jana Gana Mana?", ["Bankim Chandra", "Rabindranath Tagore", "Iqbal", "Nazrul"], 1, "General Awareness"),
      Q(12, "Christmas is celebrated on:", ["25 December", "1 January", "14 November", "15 August"], 0, "General Awareness"),
      Q(13, "Eiffel Tower is in:", ["London", "Paris", "Rome", "Berlin"], 1, "General Awareness"),
      Q(14, "Which vitamin is in citrus fruits?", ["D", "C", "K", "B12"], 1, "General Awareness"),
      Q(15, "The sport associated with Wimbledon is:", ["Cricket", "Tennis", "Football", "Hockey"], 1, "General Awareness"),
      Q(16, "How many sides does a hexagon have?", ["5", "6", "7", "8"], 1, "General Awareness"),
      Q(17, "National calendar of India is based on:", ["Gregorian only", "Saka Era", "Chinese only", "Roman only"], 1, "General Awareness"),
      Q(18, "Mohiniyattam is from:", ["Punjab", "Kerala", "Gujarat", "Assam"], 1, "General Awareness"),
      Q(19, "Supreme Court of India is in:", ["Mumbai", "New Delhi", "Kolkata", "Chennai"], 1, "General Awareness"),
      Q(20, "Flute is a:", ["String instrument", "Wind instrument", "Percussion only", "Electronic only"], 1, "General Awareness"),
      Q(21, "Digital India is a programme to promote:", ["Less technology", "Digital technology and connectivity", "Only farming without phones", "Closing internet"], 1, "Current Affairs"),
      Q(22, "Paris Agreement is related to:", ["Football rules only", "Climate change", "Cricket world cup", "Space wars"], 1, "Current Affairs"),
      Q(23, "The Commonwealth Games involve countries mostly linked historically to:", ["Only USA", "The Commonwealth (many once linked to Britain)", "Only Antarctica", "Only one city forever"], 1, "Current Affairs"),
      Q(24, "World Environment Day is on:", ["5 June", "1 May", "15 August", "2 October"], 0, "Current Affairs"),
      Q(25, "Nobel Prizes are given for outstanding work in fields like:", ["Only cooking", "Peace, science, literature etc.", "Only sports", "Only cinema always"], 1, "Current Affairs"),
      Q(26, "If a classmate is being bullied, you should:", ["Join the bullying", "Support them and tell a teacher", "Film and laugh", "Ignore always"], 1, "Life Skills"),
      Q(27, "Eating fruits and vegetables daily helps:", ["Only stain teeth", "Stay healthy", "Skip all sleep", "Avoid all water"], 1, "Life Skills"),
      Q(28, "Time management means:", ["Wasting time", "Planning work and play wisely", "Never studying", "Only playing games"], 1, "Life Skills"),
      Q(29, "In an earthquake, a safer action indoors is often:", ["Stand near windows", "Drop, cover and hold under sturdy furniture", "Use lift", "Run to balcony edge"], 1, "Life Skills"),
      Q(30, "Sharing toys with friends shows:", ["Selfishness", "Kindness and cooperation", "Anger", "Fear"], 1, "Life Skills"),
      Q(31, "Which is India’s highest civilian award?", ["Padma Shri only", "Bharat Ratna", "Param Vir Chakra (gallantry)", "Arjuna Award (sports)"], 1, "Achievers Section", 2),
      Q(32, "The Tropic of Cancer passes through how many Indian states (commonly taught count ~8)?", ["1", "8", "28", "0"], 1, "Achievers Section", 2),
      Q(33, "Who was the first President of India?", ["Dr. Rajendra Prasad", "Dr. S. Radhakrishnan", "Zakir Husain", "V.V. Giri"], 0, "Achievers Section", 2),
      Q(34, "Gir National Park is famous for:", ["Penguins", "Asiatic lions", "Kangaroos", "Polar bears"], 1, "Achievers Section", 2),
      Q(35, "Which metal is liquid at room temperature?", ["Iron", "Mercury", "Gold", "Silver"], 1, "Achievers Section", 2),
    ])
  );

  papers.push(
    pack([
      Q(1, "Which is the smallest state of India by area?", ["Rajasthan", "Goa", "MP", "UP"], 1, "General Awareness"),
      Q(2, "Mount Everest lies in the:", ["Alps", "Himalayas", "Andes", "Rockies"], 1, "General Awareness"),
      Q(3, "Currency of China is the:", ["Yen", "Yuan (Renminbi)", "Won", "Dong"], 1, "General Awareness"),
      Q(4, "Wright brothers are known for:", ["Telephone", "Aeroplane", "Bulb only", "Penicillin"], 1, "General Awareness"),
      Q(5, "Hawa Mahal is in:", ["Delhi", "Jaipur", "Agra", "Mumbai"], 1, "General Awareness"),
      Q(6, "Which is the largest planet?", ["Earth", "Jupiter", "Mars", "Venus"], 1, "General Awareness"),
      Q(7, "How many hours are in a day?", ["12", "24", "48", "60"], 1, "General Awareness"),
      Q(8, "Chilika Lake is in:", ["Rajasthan", "Odisha", "Punjab", "Gujarat"], 1, "General Awareness"),
      Q(9, "National aquatic animal of India:", ["Shark", "River dolphin", "Starfish", "Octopus"], 1, "General Awareness"),
      Q(10, "Meenakshi Temple is in:", ["Madurai", "Delhi", "Amritsar", "Puri"], 0, "General Awareness"),
      Q(11, "Who is known as Nightingale of India?", ["Indira Gandhi", "Sarojini Naidu", "Lata Mangeshkar only as singer title varies", "Mother Teresa"], 1, "General Awareness"),
      Q(12, "Republic Day of India is on:", ["15 August", "26 January", "2 October", "14 November"], 1, "General Awareness"),
      Q(13, "Statue of Liberty is in:", ["UK", "USA", "France only original smaller", "Canada"], 1, "General Awareness"),
      Q(14, "Iodine deficiency can cause:", ["Scurvy", "Goitre", "Rickets", "Night blindness"], 1, "General Awareness"),
      Q(15, "Hockey is India’s:", ["National game (traditionally taught)", "Only Olympic sport", "Only village game", "Not a sport"], 0, "General Awareness"),
      Q(16, "A century in cricket means:", ["50 runs", "100 runs", "200 runs", "10 wickets"], 1, "General Awareness"),
      Q(17, "Which is a union territory of India?", ["Kerala", "Ladakh", "Punjab", "Assam"], 1, "General Awareness"),
      Q(18, "Bihu is a festival of:", ["Punjab", "Assam", "Kerala", "Goa"], 1, "General Awareness"),
      Q(19, "RBI is the central bank of:", ["USA", "India", "UK", "Japan"], 1, "General Awareness"),
      Q(20, "Shehnai is associated with:", ["Bismillah Khan", "Ravi Shankar", "Zakir Hussain only tabla", "Lata Mangeshkar"], 0, "General Awareness"),
      Q(21, "Artificial Intelligence (AI) is about:", ["Machines performing smart tasks", "Only farming tools", "Only bicycles", "Only chalk"], 0, "Current Affairs"),
      Q(22, "Swachh Bharat Abhiyan promotes:", ["Dirtiness", "Cleanliness", "Wasting plastic", "Open drains"], 1, "Current Affairs"),
      Q(23, "The United Nations HQ is in:", ["London", "New York", "Paris", "Tokyo"], 1, "Current Affairs"),
      Q(24, "World Health Organization deals with:", ["Global health", "Only space", "Only sports", "Only films"], 0, "Current Affairs"),
      Q(25, "A marathon race is about:", ["100 m", "42.195 km", "1 km only", "5 m"], 1, "Current Affairs"),
      Q(26, "If you receive a hurtful message online, you should:", ["Reply with more hate", "Block/report and tell a trusted adult", "Share your password", "Meet the sender alone"], 1, "Life Skills"),
      Q(27, "Exercise daily helps to:", ["Weaken bones only", "Keep body fit", "Avoid all food", "Skip sleep forever"], 1, "Life Skills"),
      Q(28, "Teamwork means:", ["Only one works", "Working together towards a goal", "Fighting teammates", "Hiding information always"], 1, "Life Skills"),
      Q(29, "First aid for a minor burn (after safety) often includes:", ["Applying ice directly for hours without care", "Cooling with clean running water", "Rubbing butter always", "Ignoring pain"], 1, "Life Skills"),
      Q(30, "Being honest means:", ["Always lying", "Telling the truth", "Cheating in tests", "Hiding mistakes forever"], 1, "Life Skills"),
      Q(31, "Which line divides Earth into Northern and Southern Hemispheres?", ["Tropic of Cancer", "Equator", "Prime Meridian", "Arctic Circle"], 1, "Achievers Section", 2),
      Q(32, "The Indian national flag was adopted on:", ["15 August 1947", "22 July 1947", "26 January 1950", "2 October 1947"], 1, "Achievers Section", 2),
      Q(33, "Who gave the slogan ‘Jai Jawan Jai Kisan’?", ["Nehru", "Lal Bahadur Shastri", "Gandhi", "Patel"], 1, "Achievers Section", 2),
      Q(34, "Jim Corbett National Park is in:", ["Kerala", "Uttarakhand", "Goa", "Punjab"], 1, "Achievers Section", 2),
      Q(35, "Which gas is most abundant in Earth’s atmosphere?", ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], 1, "Achievers Section", 2),
    ])
  );

  papers.push(
    pack([
      Q(1, "Which ocean is to the south of India?", ["Arctic", "Indian Ocean", "Atlantic", "Southern only name"], 1, "General Awareness"),
      Q(2, "The capital of France is:", ["Berlin", "Paris", "Madrid", "Rome"], 1, "General Awareness"),
      Q(3, "Currency of India is the:", ["Dollar", "Rupee", "Yen", "Pound"], 1, "General Awareness"),
      Q(4, "Thomas Edison is famous for practical work on the:", ["Telephone only", "Electric bulb", "Aeroplane", "Penicillin"], 1, "General Awareness"),
      Q(5, "Victoria Memorial is in:", ["Delhi", "Kolkata", "Mumbai", "Chennai"], 1, "General Awareness"),
      Q(6, "Saturn is known for its:", ["Red spot only", "Rings", "Green colour only", "Being hottest"], 1, "General Awareness"),
      Q(7, "How many minutes are in an hour?", ["30", "60", "100", "90"], 1, "General Awareness"),
      Q(8, "Dal Lake is in:", ["Jaipur", "Srinagar", "Goa", "Chennai"], 1, "General Awareness"),
      Q(9, "National heritage animal of India is the:", ["Tiger", "Elephant", "Lion", "Cow only"], 1, "General Awareness"),
      Q(10, "Golden Temple is in:", ["Delhi", "Amritsar", "Varanasi", "Puri"], 1, "General Awareness"),
      Q(11, "Who is known as Iron Man of India?", ["Nehru", "Sardar Vallabhbhai Patel", "Bose", "Ambedkar"], 1, "General Awareness"),
      Q(12, "Independence Day of India is on:", ["26 January", "15 August", "2 October", "14 November"], 1, "General Awareness"),
      Q(13, "Colosseum is in:", ["Paris", "Rome", "London", "Athens only"], 1, "General Awareness"),
      Q(14, "Vitamin D is produced in skin with help of:", ["Moonlight", "Sunlight", "Rain", "Wind only"], 1, "General Awareness"),
      Q(15, "Badminton uses a:", ["Football", "Shuttlecock", "Hockey stick only", "Bat and ball only"], 1, "General Awareness"),
      Q(16, "A decade has how many years?", ["5", "10", "20", "100"], 1, "General Awareness"),
      Q(17, "Which is India’s financial capital (commonly called)?", ["Delhi", "Mumbai", "Kolkata", "Chennai"], 1, "General Awareness"),
      Q(18, "Onam is mainly celebrated in:", ["Punjab", "Kerala", "Rajasthan", "Sikkim"], 1, "General Awareness"),
      Q(19, "The head of the state government is the:", ["President", "Chief Minister", "Prime Minister", "Governor only always executive"], 1, "General Awareness"),
      Q(20, "Mridangam is a:", ["Wind instrument", "Percussion instrument", "String only", "Electronic only"], 1, "General Awareness"),
      Q(21, "Electric vehicles help mainly by reducing:", ["Road size", "Air pollution from exhaust", "Traffic lights", "School bags"], 1, "Current Affairs"),
      Q(22, "The term ‘startup’ often means:", ["A new business venture", "An old fort", "A dance", "A river"], 0, "Current Affairs"),
      Q(23, "Olympic symbol has how many rings?", ["3", "5", "7", "4"], 1, "Current Affairs"),
      Q(24, "World Water Day reminds us to:", ["Waste water", "Save and value water", "Pollute rivers", "Ignore droughts"], 1, "Current Affairs"),
      Q(25, "Chess world champions play:", ["Football", "Chess", "Only cards", "Only ludo"], 1, "Current Affairs"),
      Q(26, "If you find a wallet, you should:", ["Keep all money secretly", "Try to return it / give to authority", "Throw it", "Hide identity cards"], 1, "Life Skills"),
      Q(27, "Sleeping enough hours helps:", ["Concentration and health", "Only grow viruses", "Skip all meals", "Avoid friends"], 0, "Life Skills"),
      Q(28, "Empathy means:", ["Ignoring feelings", "Understanding others’ feelings", "Laughing at pain", "Being rude"], 1, "Life Skills"),
      Q(29, "While cycling on road, you should:", ["Wear helmet and follow rules", "Use phone always", "Ride against traffic always", "Ignore signals"], 0, "Life Skills"),
      Q(30, "Reducing plastic use helps the:", ["Environment", "Only factories to pollute more", "Only increase waste", "Oceans to fill with trash more"], 0, "Life Skills"),
      Q(31, "Prime Meridian passes through:", ["New York", "Greenwich (London area)", "Delhi", "Tokyo"], 1, "Achievers Section", 2),
      Q(32, "How many fundamental rights were originally in the Indian Constitution (commonly taught as 7 groups)?", ["3", "7", "12", "1"], 1, "Achievers Section", 2),
      Q(33, "Who is called the Father of the Indian Constitution?", ["Nehru", "Dr. B.R. Ambedkar", "Patel", "Gandhi"], 1, "Achievers Section", 2),
      Q(34, "Ranthambore National Park is in:", ["Kerala", "Rajasthan", "Assam", "Goa"], 1, "Achievers Section", 2),
      Q(35, "Which is the hardest natural substance?", ["Gold", "Diamond", "Iron", "Silver"], 1, "Achievers Section", 2),
    ])
  );

  return papers;
}

// ─────────────────────────────────────────────────────────────
// Validate & write
// ─────────────────────────────────────────────────────────────
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
    // unique-ish options
    const set = new Set(q.options.map(String));
    if (set.size < 4) {
      console.warn(`WARN Q${q.id}: duplicate options: ${JSON.stringify(q.options)}`);
    }
    marks += Number(q.marks) || 1;
  });
  if (marks !== expectMarks) {
    console.warn(`WARN total marks ${marks} expected ${expectMarks}`);
  }
  return marks;
}

function main() {
  const jobs = [
    {
      folder: "mathematics",
      subject: "Mathematics",
      papers: mathPapers(),
      count: 35,
      marks: 40,
    },
    {
      folder: "science",
      subject: "Science",
      papers: sciencePapers(),
      count: 35,
      marks: 40,
    },
    {
      folder: "english",
      subject: "English",
      papers: englishPapers(),
      count: 40,
      marks: 40,
    },
    {
      folder: "computer",
      subject: "Computer Science",
      papers: computerPapers(),
      count: 35,
      marks: 40,
    },
    {
      folder: "gk",
      subject: "General Knowledge",
      papers: gkPapers(),
      count: 35,
      marks: 40,
    },
  ];

  for (const job of jobs) {
    job.papers.forEach((p, i) => {
      const total = validate(p, job.count, job.marks);
      writePaper(
        job.folder,
        i + 1,
        { subject: job.subject, totalMarks: total || job.marks },
        p.questions,
        p.answers
      );
      console.log(
        `Wrote class4/${job.folder} paper ${i + 1}: ${p.questions.length}Q, ${total} marks`
      );
    });
  }
  console.log("Done. Class 4 regenerated (original SOF-pattern practice, 2023–2025 style).");
}

main();

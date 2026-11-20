/* ============================================================
   MATH GENERATORS — shared by quiz/index.html (Speed Challenge)
   and quiz/play.html (papers). Needs quiz-shared.js first
   (rand, pickRandom, shuffle, buildNumericOptions, UKG_LEVEL).
   Uses Math.random — play.html swaps in a seeded random while it
   builds a paper so every paper is the same each time.
   ============================================================ */
/* ============================================
   MATH GENERATORS - PROCEDURAL (infinite questions)
   ============================================ */
const LKG_COUNT_ICONS = ['🍎','⭐','🎈','🐶','🐱','🧸','🚗','🌸','🍭','⚽','🦋','🐣'];

function genAddSub(level) {
  let a, b, op, answer, qText, size = 'large';
  if (level === 0) {
    // LKG — pure picture counting or tiny picture addition (numbers 1-5),
    // no operators to read, just pictures a pre-reader can count.
    const icon = pickRandom(LKG_COUNT_ICONS);
    if (Math.random() < 0.5) {
      a = rand(1, 5);
      qText = icon.repeat(a) + '  —  Count them!';
      answer = a;
    } else {
      a = rand(1, 3); b = rand(1, 3);
      qText = icon.repeat(a) + ' + ' + icon.repeat(b) + ' = ?';
      answer = a + b;
    }
    return { question: qText, answer: answer, options: buildNumericOptions(answer, 3), size: 'pico' };
  }
  if (level === UKG_LEVEL) {
    // UKG — counting up to 10, picture addition and "take away" up to 10.
    const icon = pickRandom(LKG_COUNT_ICONS);
    const r = Math.random();
    if (r < 0.3) {
      a = rand(4, 10);
      qText = icon.repeat(a) + '  —  How many?';
      answer = a;
    } else if (r < 0.7) {
      a = rand(1, 5); b = rand(1, 5);
      qText = icon.repeat(a) + ' + ' + icon.repeat(b) + ' = ?';
      answer = a + b;
    } else {
      a = rand(3, 6); b = rand(1, a - 1);
      qText = icon.repeat(a) + '  — take away ' + b + ' — how many are left?';
      answer = a - b;
    }
    return { question: qText, answer: answer, options: buildNumericOptions(answer, 3), size: 'pico' };
  }
  // NCERT Math-Magic: Cl.1 within 20 · Cl.2 two-digit (to 99) · Cl.3 three-digit · Cl.4 four-digit · Cl.5 large numbers
  if (level === 1) { a = rand(0, 10); b = rand(0, 9); }
  else if (level === 2) { a = rand(10, 60); b = rand(5, 39); }
  else if (level === 3) { a = rand(100, 600); b = rand(20, 399); size = 'medium'; }
  else if (level === 4) { a = rand(1000, 5999); b = rand(100, 3999); size = 'medium'; }
  else if (level === 5) { a = rand(10000, 89999); b = rand(1000, 49999); size = 'small'; }
  else if (level <= 7) { a = rand(500, 5000); b = rand(200, 2500); size = 'medium'; }
  else if (level <= 9) { a = rand(1000, 25000); b = rand(500, 12000); size = 'small'; }
  else { a = rand(5000, 99999); b = rand(1000, 50000); size = 'small'; }
  op = Math.random() < 0.5 ? '+' : '−';
  if (op === '+') { answer = a + b; qText = a + ' + ' + b; }
  else {
    if (b > a) { const t = a; a = b; b = t; }
    answer = a - b; qText = a + ' − ' + b;
  }
  // Integers for class 8+
  if (level >= 8 && Math.random() < 0.35) {
    a = rand(-50, 80); b = rand(-40, 60);
    if (Math.random() < 0.5) { answer = a + b; qText = '(' + a + ') + (' + b + ')'; }
    else { answer = a - b; qText = '(' + a + ') − (' + b + ')'; }
    size = 'small';
  }
  const range = Math.max(3, Math.floor(Math.abs(answer) * 0.15) + 2);
  return { question: qText, answer: answer, options: buildNumericOptions(answer, range), size: size };
}

function genMultiply(level) {
  let a, b;
  // NCERT Math-Magic: Cl.2 tables 2–5 · Cl.3 tables to 10 (+ 2-digit × 1-digit) · Cl.4 2-digit × 2-digit · Cl.5 3-digit × 2-digit
  if (level === 1) { a = rand(1, 5); b = rand(1, 5); }
  else if (level === 2) { a = rand(2, 5); b = rand(1, 10); }
  else if (level === 3) { if (Math.random() < 0.3) { a = rand(11, 30); b = rand(2, 5); } else { a = rand(2, 10); b = rand(1, 10); } }
  else if (level === 4) { a = rand(11, 40); b = rand(11, 20); }
  else if (level === 5) { a = rand(101, 499); b = rand(11, 30); }
  else if (level <= 7) { a = rand(12, 99); b = rand(3, 25); }
  else if (level <= 9) { a = rand(-20, 40); b = rand(-12, 18); if (a === 0) a = 7; if (b === 0) b = 5; }
  else { a = rand(15, 120); b = rand(11, 35); }
  // Fractions of a number (class 6–8)
  if (level >= 6 && level <= 8 && Math.random() < 0.3) {
    const whole = rand(12, 120);
    const num = pickRandom([1, 1, 2, 3]);
    const den = pickRandom([2, 3, 4, 5]);
    if (whole % den !== 0) {
      const w2 = Math.floor(whole / den) * den || den * rand(3, 20);
      const answer = (w2 / den) * num;
      return {
        question: 'Find ' + num + '/' + den + ' of ' + w2,
        answer: answer,
        options: buildNumericOptions(answer, Math.max(3, Math.floor(answer * 0.25) + 2)),
        size: 'small'
      };
    }
    const answer = (whole / den) * num;
    return {
      question: 'Find ' + num + '/' + den + ' of ' + whole,
      answer: answer,
      options: buildNumericOptions(answer, Math.max(3, Math.floor(answer * 0.25) + 2)),
      size: 'small'
    };
  }
  // Percent (class 7+)
  if (level >= 7 && Math.random() < 0.25) {
    const base = rand(2, 20) * 10;
    const pct = pickRandom([5, 10, 15, 20, 25, 50]);
    const answer = (base * pct) / 100;
    return {
      question: pct + '% of ' + base + ' = ?',
      answer: answer,
      options: buildNumericOptions(answer, Math.max(3, Math.floor(answer * 0.3) + 2)),
      size: 'small'
    };
  }
  const answer = a * b;
  const qText = a + ' × ' + b;
  const range = Math.max(5, Math.floor(Math.abs(answer) * 0.2) + 3);
  return { question: qText, answer: answer, options: buildNumericOptions(answer, range), size: level >= 6 ? 'medium' : 'large' };
}

function genDivide(level) {
  let divisor, quotient;
  if (level === 1) { divisor = rand(1, 5); quotient = rand(1, 5); }
  else if (level === 2) { divisor = rand(2, 5); quotient = rand(2, 10); }
  else if (level === 3) { divisor = rand(2, 9); quotient = rand(2, 10); }
  // NCERT: Cl.3 sharing using tables · Cl.4 by 1-digit numbers · Cl.5 by 2-digit numbers
  else if (level === 4) { divisor = rand(2, 9); quotient = rand(11, 99); }
  else if (level === 5) { divisor = rand(11, 25); quotient = rand(5, 40); }
  else if (level <= 7) { divisor = rand(4, 25); quotient = rand(6, 40); }
  else if (level <= 9) { divisor = rand(5, 30); quotient = rand(8, 50); }
  else { divisor = rand(6, 40); quotient = rand(10, 60); }
  // Simple linear: ax = b (class 8+)
  if (level >= 8 && Math.random() < 0.35) {
    const x = rand(2, 25);
    const coef = rand(2, 12);
    return {
      question: 'Solve: ' + coef + 'x = ' + (coef * x),
      answer: x,
      options: buildNumericOptions(x, Math.max(3, Math.floor(x * 0.3) + 2)),
      size: 'small'
    };
  }
  const dividend = divisor * quotient;
  const qText = dividend + ' ÷ ' + divisor;
  const range = Math.max(3, Math.floor(quotient * 0.3) + 2);
  return { question: qText, answer: quotient, options: buildNumericOptions(quotient, range), size: level >= 6 ? 'medium' : 'large' };
}

function genMixedMath(level) {
  const ops = level <= 2 ? ['+', '−']
    : level <= 3 ? ['+', '−', '×']
    : level <= 5 ? ['+', '−', '×', '÷']
    : ['+', '−', '×', '÷', '×', '÷'];
  const op = pickRandom(ops);
  if (op === '+' || op === '−') return genAddSub(level);
  if (op === '×') return genMultiply(Math.max(1, level - 1));
  return genDivide(Math.max(1, level - 1));
}

function genPatterns(level) {
  let types = ['arith'];
  if (level >= 3) types.push('arith2');
  if (level >= 4) types.push('mult');
  if (level >= 6) types.push('square');
  if (level >= 8) types.push('fib');
  const type = pickRandom(types);
  let seq, next, qText;
  if (type === 'arith') {
    const start = rand(1, level <= 2 ? 10 : level <= 5 ? 30 : 80);
    const step = rand(1, level <= 2 ? 3 : level <= 5 ? 6 : 12);
    seq = [start, start + step, start + 2 * step, start + 3 * step];
    next = start + 4 * step;
  } else if (type === 'arith2') {
    const start = rand(2, 40);
    const step = rand(2, level >= 6 ? 15 : 8);
    seq = [start, start + step, start + 2 * step, start + 3 * step];
    next = start + 4 * step;
  } else if (type === 'mult') {
    const start = rand(2, 5);
    const factor = rand(2, level >= 7 ? 4 : 3);
    seq = [start, start * factor, start * factor * factor];
    next = start * factor * factor * factor;
  } else if (type === 'square') {
    const n = rand(2, level >= 8 ? 12 : 8);
    seq = [n * n, (n + 1) * (n + 1), (n + 2) * (n + 2)];
    next = (n + 3) * (n + 3);
  } else {
    let a = 1, b = 1;
    seq = [a, b];
    for (let i = 0; i < 3; i++) { const c = a + b; a = b; b = c; seq.push(c); }
    next = a + b;
    seq = seq.slice(0, 5);
  }
  qText = 'Next number? ' + seq.join(', ') + ', __';
  const range = Math.max(3, Math.floor(Math.abs(next) * 0.2) + 2);
  return { question: qText, answer: next, options: buildNumericOptions(next, range), size: 'small' };
}

function genReasoning(level) {
  const types = level >= 6 ? ['compare', 'missing', 'word', 'ratio'] : ['compare', 'missing', 'word'];
  const type = pickRandom(types);
  if (type === 'compare') {
    const a = rand(1, level * 25);
    const b = rand(1, level * 25);
    if (a === b) return genReasoning(level);
    const correct = a > b ? 'Greater' : 'Smaller';
    return {
      question: 'Is ' + a + ' greater or smaller than ' + b + '?',
      answer: correct,
      options: shuffle(['Greater', 'Smaller', 'Equal', 'Cannot say']),
      size: 'small'
    };
  } else if (type === 'missing') {
    const a = rand(2, level * 12);
    const b = rand(2, level * 12);
    const sum = a + b;
    return {
      question: a + ' + __ = ' + sum,
      answer: b,
      options: buildNumericOptions(b, Math.max(3, Math.floor(b * 0.3) + 2)),
      size: 'large'
    };
  } else if (type === 'ratio') {
    const a = rand(2, 9);
    const b = rand(2, 9);
    const k = rand(2, 8);
    return {
      question: 'If ratio is ' + a + ':' + b + ', find part when total is ' + ((a + b) * k) + ' for first part',
      answer: a * k,
      options: buildNumericOptions(a * k, Math.max(3, a + 2)),
      size: 'small'
    };
  } else {
    const items = level <= 2 ? rand(2, 8) : level <= 5 ? rand(5, 30) : rand(20, 120);
    const more = level <= 2 ? rand(1, 5) : level <= 5 ? rand(2, 20) : rand(10, 80);
    const total = items + more;
    return {
      question: 'Ravi has ' + items + ' apples. He gets ' + more + ' more. How many now?',
      answer: total,
      options: buildNumericOptions(total, 4),
      size: 'small'
    };
  }
}


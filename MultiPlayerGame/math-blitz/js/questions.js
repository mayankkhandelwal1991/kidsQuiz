/**
 * math-blitz/js/questions.js
 * -----------------------------------------------------------------------
 * Procedurally generates one math question (text + 4 shuffled options +
 * which index is correct) per round. Unlike trivia-battle's shared
 * static question list, the whole generated question object gets stored
 * directly in the room, so both clients always agree on it without
 * needing to keep two random number generators in sync.
 * -----------------------------------------------------------------------
 */

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRaw(difficulty) {
  let a, b, op, answer;
  if (difficulty === 'easy') {
    op = Math.random() < 0.5 ? '+' : '−';
    if (op === '+') { a = randInt(1, 20); b = randInt(1, 20); answer = a + b; }
    else { a = randInt(1, 20); b = randInt(1, a); answer = a - b; }
  } else if (difficulty === 'hard') {
    const ops = ['+', '−', '×', '÷'];
    op = ops[randInt(0, 3)];
    if (op === '+') { a = randInt(10, 100); b = randInt(10, 100); answer = a + b; }
    else if (op === '−') { a = randInt(10, 100); b = randInt(1, a); answer = a - b; }
    else if (op === '×') { a = randInt(2, 12); b = randInt(2, 12); answer = a * b; }
    else { b = randInt(2, 12); answer = randInt(2, 12); a = b * answer; }
  } else { // medium (default)
    const ops = ['+', '−', '×'];
    op = ops[randInt(0, 2)];
    if (op === '+') { a = randInt(1, 50); b = randInt(1, 50); answer = a + b; }
    else if (op === '−') { a = randInt(1, 50); b = randInt(1, a); answer = a - b; }
    else { a = randInt(2, 12); b = randInt(2, 12); answer = a * b; }
  }
  return { text: `${a} ${op} ${b}`, answer };
}

function buildOptions(answer, difficulty) {
  const spread = difficulty === 'easy' ? 5 : (difficulty === 'hard' ? 15 : 10);
  const opts = new Set([answer]);
  let guard = 0;
  while (opts.size < 4 && guard < 60) {
    guard++;
    const delta = randInt(1, spread) * (Math.random() < 0.5 ? -1 : 1);
    let candidate = answer + delta;
    if (candidate < 0) candidate = answer + Math.abs(delta);
    if (candidate !== answer) opts.add(candidate);
  }
  const arr = Array.from(opts);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { options: arr, correctIndex: arr.indexOf(answer) };
}

export function generateQuestion(difficulty) {
  const { text, answer } = generateRaw(difficulty);
  const { options, correctIndex } = buildOptions(answer, difficulty);
  return { text, options, correctIndex };
}

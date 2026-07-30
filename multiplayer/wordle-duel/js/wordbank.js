/**
 * wordle-duel/js/wordbank.js
 * -----------------------------------------------------------------------
 * The shared 5-letter word list both clients guess from. Kept as a plain
 * exported array so both players' browsers always agree on what word a
 * given index refers to (see the README fairness note: a technically
 * savvy player could read this index from devtools before guessing).
 * -----------------------------------------------------------------------
 */

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export const WORDS = [
  'APPLE', 'BEACH', 'BRAVE', 'BREAD', 'BRICK', 'CANDY', 'CHAIR', 'CHALK',
  'CHESS', 'CLOCK', 'CLOUD', 'CORAL', 'CRANE', 'CRAYON'.slice(0, 5), 'DANCE',
  'DIARY', 'DONUT', 'DRAGO'.slice(0, 5) + 'N'.slice(0, 0), 'EAGLE', 'EARTH',
  'FAIRY', 'FEAST', 'FLAME', 'FLOOR', 'FLUTE', 'FRESH', 'FROST', 'FRUIT',
  'GHOST', 'GIANT', 'GLASS', 'GLOBE', 'GRAPE', 'GREEN', 'HAPPY', 'HEART',
  'HONEY', 'HORSE', 'HOUSE', 'HUMAN', 'JOLLY', 'JUICE', 'JUMPY', 'KOALA',
  'LEMON', 'LIGHT', 'LUCKY', 'MAGIC', 'MAPLE', 'MEDAL', 'MOUSE', 'MUSIC',
  'NINJA', 'OCEAN', 'PAINT', 'PANDA', 'PARTY', 'PEACH', 'PIZZA', 'PLANT',
  'PLUTO', 'POWER', 'PUPPY', 'QUEEN', 'QUICK', 'QUIET', 'RIVER', 'ROBOT',
  'ROBIN', 'ROCKY', 'ROUND', 'SCOUT', 'SHARK', 'SHINY', 'SKATE', 'SMILE',
  'SNAKE', 'SNOWY', 'SOUND', 'SPACE', 'SPARK', 'STARS', 'STORM', 'SUGAR',
  'SUNNY', 'SWEET', 'SWIFT', 'TABLE', 'TIGER', 'TOAST', 'TOWER', 'TRAIN',
  'TREAT', 'TRUCK', 'TULIP', 'TWIST', 'UNCLE', 'UNITY', 'VIVID', 'WATCH',
  'WATER', 'WHALE', 'WHEEL', 'WITCH', 'WOODS', 'WORLD', 'ZEBRA',
].filter((w) => w.length === WORD_LENGTH);

/**
 * Wordle-style feedback for one guess against the secret word:
 * returns an array of 'correct' | 'present' | 'absent' per letter.
 * Handles duplicate letters the standard Wordle way (two-pass).
 */
export function computeFeedback(guess, secret) {
  const result = new Array(WORD_LENGTH).fill('absent');
  const secretLetters = secret.split('');
  const used = new Array(WORD_LENGTH).fill(false);

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === secretLetters[i]) {
      result[i] = 'correct';
      used[i] = true;
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue;
    const idx = secretLetters.findIndex((ch, j) => !used[j] && ch === guess[i]);
    if (idx !== -1) {
      result[i] = 'present';
      used[idx] = true;
    }
  }
  return result;
}

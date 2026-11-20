/**
 * word-duel/js/wordbank.js
 * -----------------------------------------------------------------------
 * The shared word list both clients scramble/unscramble from. Kept as a
 * plain exported array so both players' browsers always agree on what
 * word a given index refers to.
 * -----------------------------------------------------------------------
 */

export const WORD_BANK = [
  { word: 'CAT', category: 'Animals' },
  { word: 'DOG', category: 'Animals' },
  { word: 'LION', category: 'Animals' },
  { word: 'TIGER', category: 'Animals' },
  { word: 'ZEBRA', category: 'Animals' },
  { word: 'MONKEY', category: 'Animals' },
  { word: 'RABBIT', category: 'Animals' },
  { word: 'PARROT', category: 'Animals' },
  { word: 'TURTLE', category: 'Animals' },
  { word: 'PENGUIN', category: 'Animals' },
  { word: 'ELEPHANT', category: 'Animals' },
  { word: 'DOLPHIN', category: 'Animals' },
  { word: 'APPLE', category: 'Food' },
  { word: 'MANGO', category: 'Food' },
  { word: 'BANANA', category: 'Food' },
  { word: 'GRAPES', category: 'Food' },
  { word: 'CARROT', category: 'Food' },
  { word: 'PIZZA', category: 'Food' },
  { word: 'COOKIE', category: 'Food' },
  { word: 'SAMOSA', category: 'Food' },
  { word: 'SUN', category: 'Space' },
  { word: 'MOON', category: 'Space' },
  { word: 'STAR', category: 'Space' },
  { word: 'ROCKET', category: 'Space' },
  { word: 'PLANET', category: 'Space' },
  { word: 'TRAIN', category: 'Things that go' },
  { word: 'PLANE', category: 'Things that go' },
  { word: 'TRUCK', category: 'Things that go' },
  { word: 'BICYCLE', category: 'Things that go' },
  { word: 'RAIN', category: 'Nature' },
  { word: 'CLOUD', category: 'Nature' },
  { word: 'FLOWER', category: 'Nature' },
  { word: 'RAINBOW', category: 'Nature' },
  { word: 'RIVER', category: 'Nature' },
  { word: 'FOREST', category: 'Nature' },
  { word: 'BOOK', category: 'School' },
  { word: 'PENCIL', category: 'School' },
  { word: 'TEACHER', category: 'School' },
  { word: 'CRAYON', category: 'School' },
  { word: 'RULER', category: 'School' },
  { word: 'CRICKET', category: 'Sports' },
  { word: 'FOOTBALL', category: 'Sports' },
  { word: 'KITE', category: 'Toys' },
  { word: 'ROBOT', category: 'Toys' },
  { word: 'BALLOON', category: 'Toys' },
  { word: 'PUZZLE', category: 'Toys' },
  { word: 'DIWALI', category: 'Festivals' },
  { word: 'HOLI', category: 'Festivals' },
  { word: 'INDIA', category: 'Countries' },
  { word: 'HOUSE', category: 'Home' },
  { word: 'WINDOW', category: 'Home' },
  { word: 'GARDEN', category: 'Home' },
];

/** Shuffle a word's letters, guaranteed different from the original (retries a few times). */
export function scrambleWord(word) {
  const letters = word.split('');
  let attempts = 0;
  let scrambled = word;
  while (scrambled === word && attempts < 20) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    scrambled = letters.join('');
    attempts++;
  }
  return scrambled;
}

/**
 * word-duel/js/wordbank.js
 * -----------------------------------------------------------------------
 * The shared word list both clients scramble/unscramble from. Kept as a
 * plain exported array so both players' browsers always agree on what
 * word a given index refers to.
 * -----------------------------------------------------------------------
 */

export const WORD_BANK = [
  { word: 'PYTHON', category: 'Programming' },
  { word: 'GALAXY', category: 'Space' },
  { word: 'DOLPHIN', category: 'Animals' },
  { word: 'TORNADO', category: 'Weather' },
  { word: 'GUITAR', category: 'Music' },
  { word: 'VOLCANO', category: 'Geography' },
  { word: 'PENGUIN', category: 'Animals' },
  { word: 'BASKETBALL', category: 'Sports' },
  { word: 'CHOCOLATE', category: 'Food' },
  { word: 'ASTRONAUT', category: 'Space' },
  { word: 'KEYBOARD', category: 'Tech' },
  { word: 'RAINBOW', category: 'Nature' },
  { word: 'DINOSAUR', category: 'Prehistoric' },
  { word: 'PYRAMID', category: 'History' },
  { word: 'HURRICANE', category: 'Weather' },
  { word: 'SANDWICH', category: 'Food' },
  { word: 'TELESCOPE', category: 'Space' },
  { word: 'SKATEBOARD', category: 'Sports' },
  { word: 'BUTTERFLY', category: 'Animals' },
  { word: 'MOUNTAIN', category: 'Geography' },
  { word: 'ROBOT', category: 'Tech' },
  { word: 'JAPAN', category: 'Countries' },
  { word: 'CANADA', category: 'Countries' },
  { word: 'BRAZIL', category: 'Countries' },
  { word: 'PLANET', category: 'Space' },
  { word: 'CAMERA', category: 'Tech' },
  { word: 'MARATHON', category: 'Sports' },
  { word: 'ELEPHANT', category: 'Animals' },
  { word: 'FESTIVAL', category: 'Culture' },
  { word: 'CHEMISTRY', category: 'School' },
  { word: 'HISTORY', category: 'School' },
  { word: 'ALGEBRA', category: 'School' },
  { word: 'INTERNET', category: 'Tech' },
  { word: 'AVOCADO', category: 'Food' },
  { word: 'STADIUM', category: 'Sports' },
  { word: 'GLACIER', category: 'Geography' },
  { word: 'VAMPIRE', category: 'Movies' },
  { word: 'WIZARD', category: 'Fantasy' },
  { word: 'DRAGON', category: 'Fantasy' },
  { word: 'ZOMBIE', category: 'Movies' },
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

/* ============================================================
   🔤  ENGLISH — LKG (Pictorial)
   ------------------------------------------------------------
   Pre-readers can't read long sentences yet, so every question
   here leans on a big picture/emoji and asks something short:
   "what letter does this start with?", "what color is this?".
   Same shape as every other file:
     { question: "...", answer: "...", options: [...] }
   Exactly 4 options; answer must match one option exactly.
   ============================================================ */
registerQuiz("english", 0, [
  { question: "🍎 starts with which letter?", answer: "A", options: ["A", "B", "C", "D"] },
  { question: "🐝 starts with which letter?", answer: "B", options: ["B", "A", "C", "D"] },
  { question: "🐱 starts with which letter?", answer: "C", options: ["C", "A", "B", "D"] },
  { question: "🐶 starts with which letter?", answer: "D", options: ["D", "A", "B", "C"] },
  { question: "🥚 starts with which letter?", answer: "E", options: ["E", "A", "B", "C"] },
  { question: "🐟 starts with which letter?", answer: "F", options: ["F", "B", "C", "D"] },
  { question: "🐐 starts with which letter?", answer: "G", options: ["G", "H", "A", "B"] },
  { question: "🎩 starts with which letter?", answer: "H", options: ["H", "G", "A", "B"] },
  { question: "🍦 starts with which letter?", answer: "I", options: ["I", "J", "A", "B"] },
  { question: "🦒 starts with which letter?", answer: "J", options: ["J", "I", "A", "B"] },
  { question: "🔑 starts with which letter?", answer: "K", options: ["K", "J", "A", "B"] },
  { question: "🦁 starts with which letter?", answer: "L", options: ["L", "K", "A", "B"] },
  { question: "🌙 starts with which letter?", answer: "M", options: ["M", "N", "A", "B"] },
  { question: "🟥 What color is this?", answer: "Red", options: ["Red", "Blue", "Green", "Yellow"] },
  { question: "🟦 What color is this?", answer: "Blue", options: ["Blue", "Red", "Green", "Yellow"] },
  { question: "🟩 What color is this?", answer: "Green", options: ["Green", "Red", "Blue", "Yellow"] },
  { question: "🟨 What color is this?", answer: "Yellow", options: ["Yellow", "Red", "Blue", "Green"] },
  { question: "🔺 What shape is this?", answer: "Triangle", options: ["Triangle", "Circle", "Square", "Star"] },
  { question: "⭕ What shape is this?", answer: "Circle", options: ["Circle", "Triangle", "Square", "Star"] },
  { question: "🟧 What shape is this?", answer: "Square", options: ["Square", "Circle", "Triangle", "Star"] },
  { question: "⭐ What shape is this?", answer: "Star", options: ["Star", "Circle", "Triangle", "Square"] },

  /* LISTEN & TAP — shape name is spoken aloud, child taps the matching shape. */
  { mode: "listen", speak: "Circle", question: "Listen — tap this shape!", answer: "⭕", options: ["⭕", "🔺", "🟧", "⭐"] },
  { mode: "listen", speak: "Triangle", question: "Listen — tap this shape!", answer: "🔺", options: ["🔺", "⭕", "🟧", "⭐"] },
  { mode: "listen", speak: "Square", question: "Listen — tap this shape!", answer: "🟧", options: ["🟧", "⭕", "🔺", "⭐"] },
  { mode: "listen", speak: "Star", question: "Listen — tap this shape!", answer: "⭐", options: ["⭐", "⭕", "🔺", "🟧"] }
]);

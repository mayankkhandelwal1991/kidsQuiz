/* ============================================================
   🐾  ANIMALS — LKG (Pictorial)
   ------------------------------------------------------------
   Animal pictures + the sounds they make — a pre-reader's
   favorite kind of question.
     { question: "...", answer: "...", options: [...] }
   Exactly 4 options; answer must match one option exactly.
   ============================================================ */
registerQuiz("animals", 0, [
  { question: "🐄 What sound does this animal make?", answer: "Moo", options: ["Moo", "Bark", "Meow", "Roar"] },
  { question: "🐶 What sound does this animal make?", answer: "Bark", options: ["Bark", "Moo", "Meow", "Roar"] },
  { question: "🐱 What sound does this animal make?", answer: "Meow", options: ["Meow", "Bark", "Moo", "Roar"] },
  { question: "🦁 What sound does this animal make?", answer: "Roar", options: ["Roar", "Bark", "Meow", "Moo"] },
  { question: "🐍 What sound does this animal make?", answer: "Hiss", options: ["Hiss", "Bark", "Moo", "Roar"] },
  { question: "🐘 What is this animal called?", answer: "Elephant", options: ["Elephant", "Lion", "Tiger", "Bear"] },
  { question: "🦒 What is this animal called?", answer: "Giraffe", options: ["Giraffe", "Zebra", "Horse", "Camel"] },
  { question: "🐒 What is this animal called?", answer: "Monkey", options: ["Monkey", "Bear", "Dog", "Cat"] },
  { question: "🐰 What is this animal called?", answer: "Rabbit", options: ["Rabbit", "Cat", "Mouse", "Squirrel"] },
  { question: "🐻 What is this animal called?", answer: "Bear", options: ["Bear", "Lion", "Tiger", "Wolf"] },
  { question: "Which animal has a very long neck? 🦒", answer: "Giraffe", options: ["Giraffe", "Elephant", "Zebra", "Camel"] },
  { question: "Which animal has stripes? 🦓", answer: "Zebra", options: ["Zebra", "Elephant", "Giraffe", "Cow"] },
  { question: "Which animal lives in water? 🐟", answer: "Fish", options: ["Fish", "Dog", "Cat", "Horse"] },
  { question: "Which animal can fly? 🐦", answer: "Bird", options: ["Bird", "Fish", "Dog", "Cow"] },
  { question: "Which animal hops? 🐇", answer: "Rabbit", options: ["Rabbit", "Fish", "Snake", "Elephant"] },

  /* -------------------------------------------------------------
     LISTEN & TAP — the question is spoken aloud (no words shown),
     and the child taps the matching animal picture. `speak` is what
     gets read out loud; `question`/`answer`/`options` still follow
     the normal shape so scoring works exactly the same way.
     ------------------------------------------------------------- */
  { mode: "listen", speak: "Moo", question: "Listen — which animal says this?", answer: "🐄", options: ["🐄", "🐶", "🐱", "🦁"] },
  { mode: "listen", speak: "Woof Woof", question: "Listen — which animal says this?", answer: "🐶", options: ["🐶", "🐱", "🐰", "🐻"] },
  { mode: "listen", speak: "Meow", question: "Listen — which animal says this?", answer: "🐱", options: ["🐱", "🐶", "🐄", "🐷"] },
  { mode: "listen", speak: "Roar", question: "Listen — which animal says this?", answer: "🦁", options: ["🦁", "🐘", "🐒", "🐻"] },
  { mode: "listen", speak: "Hiss", question: "Listen — which animal says this?", answer: "🐍", options: ["🐍", "🐸", "🐢", "🦎"] },
  { mode: "listen", speak: "Quack Quack", question: "Listen — which animal says this?", answer: "🦆", options: ["🦆", "🐔", "🦢", "🐧"] },
  { mode: "listen", speak: "Baa", question: "Listen — which animal says this?", answer: "🐑", options: ["🐑", "🐐", "🐄", "🐷"] },
  { mode: "listen", speak: "Neigh", question: "Listen — which animal says this?", answer: "🐴", options: ["🐴", "🦓", "🐄", "🐫"] }
]);

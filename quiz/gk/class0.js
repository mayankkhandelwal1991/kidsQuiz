/* ============================================================
   🌍  GK — LKG (Pictorial)
   ------------------------------------------------------------
   Everyday pictures a pre-reader already knows: body parts,
   family, nature, numbers. Keep it short and picture-led.
     { question: "...", answer: "...", options: [...] }
   Exactly 4 options; answer must match one option exactly.
   ============================================================ */
registerQuiz("gk", 0, [
  { question: "👃 What body part is this?", answer: "Nose", options: ["Nose", "Eyes", "Ears", "Mouth"] },
  { question: "👀 What body part is this?", answer: "Eyes", options: ["Eyes", "Nose", "Ears", "Mouth"] },
  { question: "👂 What body part is this?", answer: "Ears", options: ["Ears", "Eyes", "Nose", "Mouth"] },
  { question: "👄 What body part is this?", answer: "Mouth", options: ["Mouth", "Eyes", "Nose", "Ears"] },
  { question: "✋ How many fingers are on one hand?", answer: "5", options: ["5", "3", "4", "10"] },
  { question: "👨‍👩‍👧 What do we call this group?", answer: "Family", options: ["Family", "School", "Team", "Party"] },
  { question: "🌞 What is this?", answer: "Sun", options: ["Sun", "Moon", "Star", "Cloud"] },
  { question: "🌙 What is this?", answer: "Moon", options: ["Moon", "Sun", "Star", "Cloud"] },
  { question: "☁️ What is this?", answer: "Cloud", options: ["Cloud", "Sun", "Moon", "Rain"] },
  { question: "🌧️ What is falling from the sky?", answer: "Rain", options: ["Rain", "Sun", "Snow", "Wind"] },
  { question: "🏠 What is this?", answer: "House", options: ["House", "Car", "Tree", "Boat"] },
  { question: "🚗 What is this?", answer: "Car", options: ["Car", "House", "Tree", "Boat"] },
  { question: "How many days in a week?", answer: "7", options: ["7", "5", "6", "10"] },
  { question: "🎂 We eat this on our?", answer: "Birthday", options: ["Birthday", "Bedtime", "Bath time", "Rainy day"] },
  { question: "🌅 When the sun comes up, it is?", answer: "Morning", options: ["Morning", "Night", "Rainy", "Bedtime"] },
  { question: "🌃 When the moon and stars are out, it is?", answer: "Night", options: ["Night", "Morning", "Lunch time", "Rainy"] },

  /* LISTEN & TAP — color name is spoken aloud, child taps the matching swatch. */
  { mode: "listen", speak: "Red", question: "Listen — tap this color!", answer: "🟥", options: ["🟥", "🟦", "🟩", "🟨"] },
  { mode: "listen", speak: "Blue", question: "Listen — tap this color!", answer: "🟦", options: ["🟦", "🟥", "🟩", "🟨"] },
  { mode: "listen", speak: "Green", question: "Listen — tap this color!", answer: "🟩", options: ["🟩", "🟥", "🟦", "🟨"] },
  { mode: "listen", speak: "Yellow", question: "Listen — tap this color!", answer: "🟨", options: ["🟨", "🟥", "🟦", "🟩"] }
]);

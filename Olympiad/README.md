# Class 1–10 Olympiad Test Portal

A static HTML/JavaScript Olympiad practice portal with:
- Class selection (1–10)
- Subject selection (Mathematics, Science, English, Computer Science, General Knowledge)
- 5 papers per subject per class
- Question and mark totals read from each paper's JSON file
- 30-minute timer (per paper `durationMinutes`)
- Pause / Resume during the test (timer stops; answers kept)
- Automatic checking and score
- Color-coded answer review (all options: green = correct, red = your wrong choice)
- Unlimited retakes
- Attempt history in browser localStorage
- Separate class/subject/question/answer JSON files

## Folder layout

data/classN/SUBJECT/questions/paper1.json
data/classN/SUBJECT/answers/paper1.json

Example:
data/class3/mathematics/questions/paper1.json
data/class3/mathematics/answers/paper1.json

## Run

Use a local web server because browsers normally block fetch() of JSON from file://.

### Python
python3 -m http.server 8000

Open:
http://localhost:8000

### Linux
python3 -m http.server 8000

### Windows
python -m http.server 8000

## Important
The included questions are **original SOF-pattern practice** aligned to the 2023–2025 syllabus for demonstrating the Class 1–10 portal structure. They are **not** official copyrighted SOF papers or copied previous-year questions. Class 4 papers (IMO/NSO/IEO/ICSO/IGKO style) follow the public exam pattern (e.g. Achievers 2 marks for classes 3–4 where applicable).

**Class 1** papers are original SOF-pattern practice (2023–2025 style, age ~6), not copyrighted SOF exam papers: Mathematics 35Q/40 (LR 10×1 + MR 20×1 + Achievers 5×2), Science/Computer 35Q/40 (LR 5 + 25 + Achievers 5×2), English 40Q/40 (WSK 30 + Reading 5 + SWE 5), GK 35Q/40 (GA 20 + CA 5 + Life Skills 5 + Achievers 5×2). Topics: numbers 1–100, counting, before/after, simple add/sub, shapes, days/money; living/non-living, plants/animals, body parts, seasons, good habits/safety; alphabet/vowels, a/an, opposites, plurals, rhyming, very short reading; computer parts (monitor/keyboard/mouse), uses, Paint, do’s & don’ts; India flag/capital/national symbols, festivals, helpers, sun/moon. Generated via `tools/generate-class1-sof.js`.

**Class 2** papers are original SOF-pattern practice (2023–2025 style, age ~7), not copyrighted SOF exam papers: Mathematics 35Q/40 (LR 10×1 + MR 20×1 + Achievers 5×2), Science/Computer 35Q/40 (LR 5 + 25 + Achievers 5×2), English 40Q/40 (WSK 30 + Reading 5 + SWE 5), GK 35Q/40 (GA 20 + CA 5 + Life Skills 5 + Achievers 5×2). Topics: numbers to 1000, add/sub 2-digit, tables 2–5, halves/quarters, time/money/shapes; plants/animals/senses/weather; basic grammar & short reading; computer parts/Paint/good habits; India symbols/festivals/helpers. Generated via `tools/generate-class2-sof.js`.

**Class 3** papers are original SOF-pattern practice (2023–2025 style, Class 3 / age ~8 level): Mathematics 35Q/40 (LR 10×1 + MR 20×1 + Achievers 5×2), Science 35Q/40 (LR 5 + Science 25 + Achievers 5×2), English 40Q/40 (WSK 30 + Reading 5 + SWE 5), Computer 35Q/40 (LR 5 + Computers 25 + Achievers 5×2), GK 35Q/40 (GA 20 + CA 5 + Life Skills 5 + Achievers 5×2). Topics include 4-digit numbers, basic fractions, money/time/measurement, living things, simple body systems, parts of speech/tenses, Word/Paint/cyber safety, India GK. Generated via `tools/generate-class3-sof.js`.

**Class 5** papers are original SOF-pattern practice (2023–2025 style): Mathematics 40Q/50 marks (Achievers ×3), Science/Computer/GK 50Q/60 marks (Achievers ×3), English 60Q/60 marks. Generated via `tools/generate-class5-sof.js`.

**Class 6** papers are original SOF-pattern practice (2023–2025 style, NCERT Class 6 level): Mathematics 40Q/50 marks (LR 15 + MR 20 + Achievers 5×3), Science/Computer 50Q/60 (LR 10 + 35 + Achievers 5×3), English 60Q/60 (WSK 45 + Reading 10 + SWE 5), GK 50Q/60 (GA 30 + CA 10 + Life Skills 5 + Achievers 5×3). Generated via `tools/generate-class6-sof.js`.
**Class 8** papers are original SOF-pattern practice (2023–2025 style): Mathematics 40Q/50 marks (Achievers ×3), Science/Computer/GK 50Q/60 marks (Achievers ×3), English 60Q/60 marks. Generated via `tools/generate-class8-sof.js`.

**Class 7** papers are original SOF-pattern practice (2023–2025 style, NCERT Class 7 level): Mathematics 40Q/50 marks (LR 15 + MR 20 + Achievers 5×3), Science/Computer 50Q/60 (LR 10 + 35 + Achievers 5×3), English 60Q/60 (WSK 45 + Reading 10 + SWE 5), GK 50Q/60 (GA 30 + CA 10 + Life Skills 5 + Achievers 5×3). Generated via `tools/generate-class7-sof.js`.

**Class 9** papers are original SOF-pattern practice (2023–2025 style, NCERT Class 9 level): Mathematics 40Q/50 (LR 15 + MR 20 + Achievers 5×3), Science/Computer 50Q/60 (LR 10 + 35 + Achievers 5×3), English 60Q/60 (WSK 45 + Reading 10 + SWE 5), GK 50Q/60 (GA 30 + CA 10 + Life Skills 5 + Achievers 5×3). Topics include number systems, polynomials, linear equations, geometry, Heron, surface areas & volumes, motion, atoms, tissues, HTML/CSS, cyber safety, Constitution, etc. Generated via `tools/generate-class9-sof.js`.

**Class 10** papers are original SOF-pattern practice (2023–2025 style, NCERT Class 10 level): Mathematics 40Q/50 (LR 15 + MR 20 + Achievers 5×3), Science/Computer 50Q/60 (LR 10 + 35 + Achievers 5×3), English 60Q/60 (WSK 45 + Reading 10 + SWE 5), GK 50Q/60 (GA 30 + CA 10 + Life Skills 5 + Achievers 5×3). Topics include real numbers, polynomials, linear/quadratic equations, AP, triangles, coordinate geometry, trigonometry, circles, surface areas & volumes, statistics, probability; chemical reactions, acids–bases, metals, carbon compounds, life processes, control & coordination, reproduction, heredity, light, electricity, magnetic effects, environment; advanced grammar/reading/writing; networking, HTML/CSS/JS, cybersecurity, AI/ML awareness, DBMS, Python basics; India polity/history/geography, economy, sports, SDGs/life skills. Generated via `tools/generate-class10-sof.js`.


To replace any paper, edit its questions JSON and answer JSON. The HTML/JS does not need to change as long as the JSON schema remains the same.

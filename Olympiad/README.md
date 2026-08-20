# Class 1–10 Olympiad Test Portal

A static HTML/JavaScript Olympiad practice portal with:
- Class selection (1–10)
- Subject selection (Mathematics, Science, English, Computer Science, General Knowledge)
- 5 papers per subject per class
- Question and mark totals read from each paper's JSON file
- 60-minute timer
- Automatic checking and score
- Answer review
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

To replace any paper, edit its questions JSON and answer JSON. The HTML/JS does not need to change as long as the JSON schema remains the same.

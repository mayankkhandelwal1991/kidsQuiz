const DEFAULT_DURATION_MIN = 30;
const DEFAULT_DURATION_SEC = DEFAULT_DURATION_MIN * 60;

const state = {
  classId: null,
  className: null,
  subjectId: null,
  subjectName: null,
  paper: null,
  questions: [],
  answers: {},
  current: 0,
  questionTotal: 0,
  totalMarks: 40,
  usesQuestionMarks: false,
  userAnswers: {},
  remaining: DEFAULT_DURATION_SEC,
  timer: null,
  paused: false,
  lastResult: null,
};

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
}

function history() {
  try {
    return JSON.parse(localStorage.getItem("olympiadHistory") || "[]");
  } catch {
    return [];
  }
}

function saveHistory(h) {
  localStorage.setItem("olympiadHistory", JSON.stringify(h));
}

function attemptsFor(paper) {
  return history().filter(
    (x) =>
      x.classId === state.classId &&
      x.subjectId === state.subjectId &&
      Number(x.paper) === Number(paper)
  );
}

function paperDetails(paper) {
  const questions = paper.questions || [];
  const usesQuestionMarks = questions.some((q) => q.marks != null && Number(q.marks) > 0);
  const totalMarks = usesQuestionMarks
    ? questions.reduce((s, q) => s + Number(q.marks || 1), 0)
    : paper.totalMarks || 40;
  return {
    questionTotal: questions.length,
    totalMarks,
    usesQuestionMarks,
  };
}

/** Normalize question stem — supports legacy "text" field from older generators */
function questionText(q) {
  if (!q || typeof q !== "object") return "";
  const t = q.question != null && String(q.question).trim() !== "" ? q.question : q.text;
  return t == null ? "" : String(t);
}

function normalizeLoadedQuestions(list) {
  return (list || []).map((q, i) => {
    const stem = questionText(q);
    const options = Array.isArray(q.options) ? q.options.map((o) => (o == null ? "" : String(o))) : [];
    return {
      ...q,
      id: q.id != null ? q.id : i + 1,
      question: stem || `Question ${i + 1}`,
      options,
    };
  });
}

function init() {
  fetch("data/config.json")
    .then((r) => r.json())
    .then((cfg) => {
      $("classGrid").innerHTML = cfg.classes
        .map(
          (c) =>
            `<button type="button" class="card selection-card class-card" data-class="${c.id}" data-name="${c.name}"><span class="badge">Class</span><strong>${c.name}</strong></button>`
        )
        .join("");
      $("classGrid").onclick = (e) => {
        const btn = e.target.closest("[data-class]");
        if (!btn) return;
        state.classId = btn.dataset.class;
        state.className = btn.dataset.name;
        $("classTitle").textContent = state.className;
        $("subjectGrid").innerHTML = cfg.subjects
          .map(
            (s) =>
              `<button type="button" class="card selection-card subject-card subject-${s.id}" data-subject="${s.id}" data-name="${s.name}"><strong>${s.name}</strong><span>${s.short || s.name}</span></button>`
          )
          .join("");
        show("screenSubject");
      };
      $("subjectGrid").onclick = (e) => {
        const btn = e.target.closest("[data-subject]");
        if (!btn) return;
        state.subjectId = btn.dataset.subject;
        state.subjectName = btn.dataset.name;
        $("subjectTitle").textContent = `${state.className} • ${state.subjectName}`;
        loadPapers();
        show("screenPaper");
      };
    })
    .catch(() => toast("Could not load config"));

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.back === "screenClass") show("screenClass");
      else if (btn.dataset.back === "screenSubject") show("screenSubject");
      else if (btn.dataset.back === "screenPaper") show("screenPaper");
    });
  });

  $("historyBtn")?.addEventListener("click", () => {
    renderHistory();
    show("screenHistory");
  });
  $("clearHistory")?.addEventListener("click", () => {
    if (confirm("Clear all attempt history on this device?")) {
      localStorage.removeItem("olympiadHistory");
      renderHistory();
      toast("History cleared");
    }
  });
  $("reviewBtn")?.addEventListener("click", () => {
    $("reviewList").classList.toggle("hidden");
    if (!$("reviewList").classList.contains("hidden") && state.lastResult) {
      renderReview(state.lastResult);
    }
  });
  $("retakeBtn")?.addEventListener("click", () => startTest());
  $("paperAgainBtn")?.addEventListener("click", () => {
    loadPapers();
    show("screenPaper");
  });
  $("prevBtn")?.addEventListener("click", prevQ);
  $("nextBtn")?.addEventListener("click", nextQ);
  $("submitBtn")?.addEventListener("click", () => {
    if (confirm("Submit the test now?")) submitTest();
  });
  $("pauseResumeBtn")?.addEventListener("click", togglePause);
  $("resumeTestBtn")?.addEventListener("click", () => {
    $("quitTestModal").classList.add("hidden");
    if (state.paused) resumeTest();
  });
  $("confirmQuitTestBtn")?.addEventListener("click", () => {
    $("quitTestModal").classList.add("hidden");
    forceQuitTest();
  });
}

function loadPapers() {
  $("paperGrid").innerHTML = `<div class="muted">Loading papers…</div>`;
  Promise.all(
    [1, 2, 3, 4, 5].map((p) =>
      fetch(`data/${state.classId}/${state.subjectId}/questions/paper${p}.json`)
        .then((r) => r.json())
        .then((paper) => ({ p, paper }))
        .catch(() => null)
    )
  ).then((rows) => {
    const ok = rows.filter(Boolean);
    if (!ok.length) {
      $("paperGrid").innerHTML = `<div class="card"><h3>Unable to load papers</h3><div class="muted">Please try again.</div></div>`;
      return;
    }
    $("paperGrid").innerHTML = ok
      .map(({ p, paper }) => {
        const details = paperDetails(paper);
        const a = attemptsFor(p);
        const best = a.length ? Math.max(...a.map((x) => x.score)) : null;
        const last = a.length ? a[a.length - 1] : null;
        const mins = paper.durationMinutes || DEFAULT_DURATION_MIN;
        return `<div class="paper" onclick="startSelected(${p})"><h3>Paper ${p}</h3><div class="meta">${details.questionTotal} questions • ${mins} minutes</div>
   <div class="attempt">${
     a.length
       ? `Attempts: <b>${a.length}</b> • Best: <span class="best">${best}/${a[0].totalMarks || details.totalMarks}</span><br>Last: ${last.score}/${last.totalMarks || details.totalMarks}`
       : `<span class="muted">${details.totalMarks} marks</span>`
   }</div></div>`;
      })
      .join("");
  });
}

async function startSelected(p) {
  try {
    const qp = await fetch(`data/${state.classId}/${state.subjectId}/questions/paper${p}.json`).then((r) =>
      r.json()
    );
    const ap = await fetch(`data/${state.classId}/${state.subjectId}/answers/paper${p}.json`).then((r) =>
      r.json()
    );
    const details = paperDetails(qp);
    state.paper = p;
    state.questions = normalizeLoadedQuestions(qp.questions);
    // answers may be object map {"1":0} or array [0,1,...]
    if (Array.isArray(ap.answers)) {
      const map = {};
      ap.answers.forEach((v, i) => {
        map[String(i + 1)] = v;
      });
      state.answers = map;
    } else {
      state.answers = ap.answers || {};
    }
    state.questionTotal = details.questionTotal;
    state.totalMarks = details.totalMarks;
    state.usesQuestionMarks = details.usesQuestionMarks;
    state.userAnswers = {};
    state.current = 0;
    state.remaining = (qp.durationMinutes || DEFAULT_DURATION_MIN) * 60;
    state.paused = false;
    $("testTitle").textContent = `${state.className} • ${state.subjectName} • Paper ${p}`;
    clearInterval(state.timer);
    hidePauseOverlay();
    updatePauseButton();
    state.timer = setInterval(tick, 1000);
    renderQuestion();
    show("screenTest");
  } catch {
    toast("Could not start paper");
  }
}

function startTest() {
  if (state.paper) startSelected(state.paper);
}

function leaveTest() {
  pauseTest(true);
  $("quitTestModal").classList.remove("hidden");
}

function forceQuitTest() {
  clearInterval(state.timer);
  state.timer = null;
  state.paused = false;
  hidePauseOverlay();
  updatePauseButton();
  loadPapers();
  show("screenPaper");
}

function tick() {
  if (state.paused) return;
  state.remaining--;
  updateTimer();
  if (state.remaining <= 0) {
    clearInterval(state.timer);
    state.timer = null;
    state.paused = false;
    hidePauseOverlay();
    toast("Time is up. Submitting…");
    submitTest();
  }
}

function updateTimer() {
  const m = Math.floor(Math.max(0, state.remaining) / 60);
  const s = Math.max(0, state.remaining) % 60;
  $("timer").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  $("timer").classList.toggle("warning", state.remaining <= 300);
  $("timer").classList.toggle("paused", state.paused);
}

function updatePauseButton() {
  const btn = $("pauseResumeBtn");
  if (!btn) return;
  btn.textContent = state.paused ? "▶ Resume" : "⏸ Pause";
  btn.classList.toggle("is-paused", state.paused);
  btn.setAttribute("aria-pressed", state.paused ? "true" : "false");
}

function showPauseOverlay() {
  const el = $("pauseOverlay");
  if (el) el.classList.remove("hidden");
}

function hidePauseOverlay() {
  const el = $("pauseOverlay");
  if (el) el.classList.add("hidden");
}

function pauseTest(fromQuit) {
  if (state.paused) return;
  state.paused = true;
  updateTimer();
  updatePauseButton();
  if (!fromQuit) showPauseOverlay();
}

function resumeTest() {
  if (!state.paused) return;
  state.paused = false;
  hidePauseOverlay();
  updateTimer();
  updatePauseButton();
  if (!state.timer) state.timer = setInterval(tick, 1000);
}

function togglePause() {
  if (state.paused) resumeTest();
  else pauseTest(false);
}

function renderQuestion() {
  const q = state.questions[state.current];
  const chosen = state.userAnswers[q.id];
  $("progress").textContent = `Question ${state.current + 1} of ${state.questions.length}`;
  $("progressFill").style.width = `${((state.current + 1) / state.questions.length) * 100}%`;
  const stem = questionText(q) || "Question text unavailable";
  const opts = Array.isArray(q.options) ? q.options : [];
  $("questionCard").innerHTML =
    `<div class="qno">${q.section || ""}</div><div class="question">${state.current + 1}. ${stem}</div>` +
    opts
      .map(
        (o, i) =>
          `<button type="button" class="option ${chosen === i ? "selected" : ""}" onclick="choose(${q.id},${i})" ${
            state.paused ? "disabled" : ""
          }>${String.fromCharCode(65 + i)}. ${o}</button>`
      )
      .join("");
  $("prevBtn").disabled = state.current === 0 || state.paused;
  $("nextBtn").disabled = state.paused;
  $("submitBtn").disabled = state.paused;
  $("nextBtn").classList.toggle("hidden", state.current === state.questions.length - 1);
  $("submitBtn").classList.toggle("hidden", state.current !== state.questions.length - 1);
  updateTimer();
}

function choose(id, i) {
  if (state.paused) return;
  state.userAnswers[id] = i;
  renderQuestion();
}

function prevQ() {
  if (state.paused) return;
  if (state.current > 0) {
    state.current--;
    renderQuestion();
  }
}

function nextQ() {
  if (state.paused) return;
  if (state.current < state.questions.length - 1) {
    state.current++;
    renderQuestion();
  }
}

function submitTest() {
  clearInterval(state.timer);
  state.timer = null;
  state.paused = false;
  hidePauseOverlay();
  updatePauseButton();

  let correct = 0;
  let earnedMarks = 0;
  state.questions.forEach((q) => {
    if (state.userAnswers[q.id] === state.answers[String(q.id)]) {
      correct++;
      earnedMarks += state.usesQuestionMarks ? Number(q.marks || 1) : 0;
    }
  });
  let score = state.usesQuestionMarks ? earnedMarks : (correct / state.questionTotal) * state.totalMarks;
  score = Math.round(score * 100) / 100;

  const attempt = {
    id: Date.now(),
    date: new Date().toISOString(),
    classId: state.classId,
    className: state.className,
    subjectId: state.subjectId,
    subjectName: state.subjectName,
    paper: state.paper,
    correct,
    score,
    totalMarks: state.totalMarks,
    totalQuestions: state.questionTotal,
    answered: Object.keys(state.userAnswers).length,
    answers: { ...state.userAnswers },
  };
  const h = history();
  h.push(attempt);
  saveHistory(h);
  state.lastResult = attempt;

  $("resultCard").innerHTML = `<div class="muted">${attempt.className} • ${attempt.subjectName} • Paper ${attempt.paper}</div><div class="score">${score}/${attempt.totalMarks}</div><p><b>${correct}</b> of ${attempt.totalQuestions} correct • ${attempt.answered} answered</p><p>Percentage: <b>${Math.round((score / attempt.totalMarks) * 100)}%</b></p>`;
  $("reviewList").classList.add("hidden");
  renderReview(attempt);
  show("screenResult");
  setTimeout(showOlympiadCompletionAd, 1500);
}

function showOlympiadCompletionAd() {
  try {
    if (typeof Android !== "undefined" && Android.showAd) Android.showAd("interstitial");
  } catch (e) {
    console.log("Olympiad ad skipped:", e);
  }
}

function renderReview(a) {
  $("reviewList").innerHTML =
    `<h2>Answer Review</h2>
     <div class="review-legend">
       <span><i class="swatch correct"></i> Correct answer</span>
       <span><i class="swatch wrong"></i> Your wrong choice</span>
       <span><i class="swatch missed"></i> Not selected</span>
     </div>` +
    state.questions
      .map((q, i) => {
        const chosen = a.answers[q.id];
        const correct = state.answers[String(q.id)];
        const isCorrect = chosen === correct;
        const statusClass = chosen == null ? "unanswered" : isCorrect ? "is-correct" : "is-wrong";
        const statusLabel =
          chosen == null ? "Not answered" : isCorrect ? "Correct" : "Incorrect";

        const optionsHtml = (Array.isArray(q.options) ? q.options : [])
          .map((opt, oi) => {
            const letters = String.fromCharCode(65 + oi);
            const classes = ["review-option"];
            let badge = "";

            if (oi === correct) {
              classes.push("opt-correct");
              badge = `<span class="opt-badge">Correct</span>`;
            }
            if (chosen === oi && oi !== correct) {
              classes.push("opt-wrong");
              badge = `<span class="opt-badge">Your answer</span>`;
            } else if (chosen === oi && oi === correct) {
              classes.push("opt-yours-correct");
              badge = `<span class="opt-badge">Your answer · Correct</span>`;
            }
            if (chosen == null && oi === correct) {
              badge = `<span class="opt-badge">Correct</span>`;
            }

            return `<div class="${classes.join(" ")}">
              <span class="opt-letter">${letters}</span>
              <span class="opt-text">${opt}</span>
              ${badge}
            </div>`;
          })
          .join("");

        return `<div class="review-item ${statusClass}">
          <div class="review-item-head">
            <b>${i + 1}. ${questionText(q)}</b>
            <span class="review-status">${statusLabel}</span>
          </div>
          <div class="review-options">${optionsHtml}</div>
        </div>`;
      })
      .join("");
}

function renderHistory() {
  const h = history().slice().reverse();
  $("historyList").innerHTML = h.length
    ? h
        .map((x) => {
          const totalQuestions = x.totalQuestions || 35;
          const totalMarks = x.totalMarks || x.total || 40;
          return `<div class="history-row"><div><b>${x.className} • ${x.subjectName} • Paper ${x.paper}</b><div class="muted">${new Date(x.date).toLocaleString()} • ${x.correct}/${totalQuestions} correct • ${x.answered} answered</div></div><div><b>${x.score}/${totalMarks}</b></div></div>`;
        })
        .join("")
    : `<div class="card"><h3>No attempts yet</h3><div class="muted">Complete a paper and your result will appear here.</div></div>`;
}

// expose for inline onclick handlers
window.startSelected = startSelected;
window.choose = choose;
window.togglePause = togglePause;
window.resumeTest = resumeTest;

init();

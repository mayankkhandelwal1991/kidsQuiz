const state={classId:null,className:null,subjectId:null,subjectName:null,paper:null,questions:[],answers:{},current:0,userAnswers:{},remaining:3600,timer:null,lastResult:null};
const $=id=>document.getElementById(id);
const screens=["screenClass","screenSubject","screenPaper","screenTest","screenResult","screenHistory"];
function show(id){screens.forEach(x=>$(x).classList.toggle("active",x===id));window.scrollTo({top:0,behavior:"smooth"});}
function toast(t){const e=$("toast");e.textContent=t;e.style.display="block";setTimeout(()=>e.style.display="none",1800)}
function history(){return JSON.parse(localStorage.getItem("olympiadHistory")||"[]")}
function saveHistory(h){localStorage.setItem("olympiadHistory",JSON.stringify(h))}
async function loadConfig(){return fetch("data/config.json").then(r=>r.json())}
async function init(){
 const cfg=await loadConfig();
 $("classGrid").innerHTML=cfg.classes.map((c,i)=>`<div class="card selection-card class-card" onclick="selectClass('${c.id}','${c.name}')"><div class="card-icon">${['🌟','🚀','🎨','🧩','🏅'][i%5]}</div><h3>${c.name}</h3><div class="muted">5 subjects</div></div>`).join("");
 const subjectIcons={mathematics:'➗',science:'🧪',english:'📚',computer:'💻',gk:'🧠'};
 $("subjectGrid").innerHTML=cfg.subjects.map(s=>`<div class="card selection-card subject-${s.id}" onclick="selectSubject('${s.id}','${s.name}')"><div class="card-icon">${subjectIcons[s.id]||'📖'}</div><h3>${s.name}</h3><div class="muted">5 papers • 60 min</div></div>`).join("");
 $("historyBtn").onclick=()=>{renderHistory();show("screenHistory")};
 document.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>show(b.dataset.back));
 $("prevBtn").onclick=prevQ;$("nextBtn").onclick=nextQ;$("submitBtn").onclick=submitTest;
 $("reviewBtn").onclick=()=>{$("reviewList").classList.toggle("hidden")};
 $("retakeBtn").onclick=startTest;$("paperAgainBtn").onclick=()=>show("screenPaper");
 $("clearHistory").onclick=()=>{if(confirm("Clear all attempt history?")){localStorage.removeItem("olympiadHistory");renderHistory();}};
 $("resumeTestBtn").onclick=()=>{$("quitTestModal").classList.add("hidden");clearInterval(state.timer);state.timer=setInterval(tick,1000)};
 $("confirmQuitTestBtn").onclick=()=>{clearInterval(state.timer);$("quitTestModal").classList.add("hidden");show("screenPaper")};
}
function selectClass(id,name){state.classId=id;state.className=name;$("classTitle").textContent=name;show("screenSubject")}
function selectSubject(id,name){state.subjectId=id;state.subjectName=name;$("subjectTitle").textContent=`${state.className} — ${name}`;renderPapers();show("screenPaper")}
function attemptsFor(p){return history().filter(x=>x.classId===state.classId&&x.subjectId===state.subjectId&&x.paper===p)}
function renderPapers(){
 let h=history();
 $("paperGrid").innerHTML=Array.from({length:5},(_,i)=>i+1).map(p=>{
   let a=attemptsFor(p),best=a.length?Math.max(...a.map(x=>x.score)):null,last=a.length?a[a.length-1]:null;
   return `<div class="paper" onclick="startSelected(${p})"><h3>Paper ${p}</h3><div class="meta">35 questions • 60 minutes</div>
   <div class="attempt">${a.length?`Attempts: <b>${a.length}</b> • Best: <span class="best">${best}/40</span><br>Last: ${last.score}/40`:`<span class="muted">Not attempted yet</span>`}</div></div>`
 }).join("");
}
async function startSelected(p){
 const qp=await fetch(`data/${state.classId}/${state.subjectId}/questions/paper${p}.json`).then(r=>r.json());
 const ap=await fetch(`data/${state.classId}/${state.subjectId}/answers/paper${p}.json`).then(r=>r.json());
 state.paper=p;state.questions=qp.questions;state.answers=ap.answers;state.userAnswers={};state.current=0;state.remaining=(qp.durationMinutes||60)*60;
 $("testTitle").textContent=`${state.className} • ${state.subjectName} • Paper ${p}`;
 clearInterval(state.timer);state.timer=setInterval(tick,1000);renderQuestion();show("screenTest");
}
function startTest(){if(state.paper)startSelected(state.paper)}
function leaveTest(){clearInterval(state.timer);$("quitTestModal").classList.remove("hidden")}
function tick(){state.remaining--;updateTimer();if(state.remaining<=0){clearInterval(state.timer);toast("Time is up. Submitting…");submitTest()}}
function updateTimer(){let m=Math.floor(state.remaining/60),s=state.remaining%60;$("timer").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;$("timer").classList.toggle("warning",state.remaining<=300)}
function renderQuestion(){
 let q=state.questions[state.current],chosen=state.userAnswers[q.id];
 $("progress").textContent=`Question ${state.current+1} of ${state.questions.length}`;
 $("progressFill").style.width=`${((state.current+1)/state.questions.length)*100}%`;
 $("questionCard").innerHTML=`<div class="qno">${q.section}</div><div class="question">${state.current+1}. ${q.question}</div>`+
 q.options.map((o,i)=>`<button class="option ${chosen===i?'selected':''}" onclick="choose(${q.id},${i})">${String.fromCharCode(65+i)}. ${o}</button>`).join("");
 $("prevBtn").disabled=state.current===0;
 $("nextBtn").classList.toggle("hidden",state.current===state.questions.length-1);
 $("submitBtn").classList.toggle("hidden",state.current!==state.questions.length-1);
 updateTimer();
}
function choose(id,i){state.userAnswers[id]=i;renderQuestion()}
function prevQ(){if(state.current>0){state.current--;renderQuestion()}}
function nextQ(){if(state.current<state.questions.length-1){state.current++;renderQuestion()}}
function submitTest(){
 clearInterval(state.timer);
 let correct=0;
 state.questions.forEach(q=>{if(state.userAnswers[q.id]===state.answers[String(q.id)])correct++});
 let score=Math.round((correct/35)*40*100)/100;
 let attempt={id:Date.now(),date:new Date().toISOString(),classId:state.classId,className:state.className,subjectId:state.subjectId,subjectName:state.subjectName,paper:state.paper,correct,score,total:40,answered:Object.keys(state.userAnswers).length,answers:{...state.userAnswers}};
 let h=history();h.push(attempt);saveHistory(h);state.lastResult=attempt;
 $("resultCard").innerHTML=`<div class="muted">${attempt.className} • ${attempt.subjectName} • Paper ${attempt.paper}</div><div class="score">${score}/40</div><p><b>${correct}</b> of 35 correct • ${attempt.answered} answered</p><p>Percentage: <b>${Math.round(score/40*100)}%</b></p>`;
 $("reviewList").classList.add("hidden");renderReview(attempt);show("screenResult");
 setTimeout(showOlympiadCompletionAd,1500);
}
function showOlympiadCompletionAd(){
 try{if(typeof Android!=="undefined"&&Android.showAd)Android.showAd("interstitial")}catch(e){console.log("Olympiad ad skipped:",e)}
}
function renderReview(a){
 $("reviewList").innerHTML=`<h2>Answer Review</h2>`+state.questions.map((q,i)=>{
   const chosen=a.answers[q.id],correct=state.answers[String(q.id)];
   return `<div class="review-item"><b>${i+1}. ${q.question}</b><p>Your answer: ${chosen==null?"Not answered":q.options[chosen]}</p><p>Correct answer: <b>${q.options[correct]}</b></p></div>`
 }).join("");
}
function renderHistory(){
 let h=history().slice().reverse();
 $("historyList").innerHTML=h.length?h.map(x=>`<div class="history-row"><div><b>${x.className} • ${x.subjectName} • Paper ${x.paper}</b><div class="muted">${new Date(x.date).toLocaleString()} • ${x.correct}/35 correct • ${x.answered} answered</div></div><div><b>${x.score}/40</b></div></div>`).join(""):`<div class="card"><h3>No attempts yet</h3><div class="muted">Complete a paper and your result will appear here.</div></div>`;
}
init();

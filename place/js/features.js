/* My Travel Map · features.js
   Journey replay, year card, backup/restore, trip planner, quiz, pins from photos. */
// =====================================================================
//  NEW FEATURES: journey replay, year card, backup/restore, trip planner,
//  India quiz and pins from photos
// =====================================================================
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function showEverything(){ fStatus="all"; fCat="all"; fYear="all"; fFav=false; }

// A popup with several buttons; gives back the value of the button that was tapped.
function kidChoice(msg,emoji,opts){
  return new Promise(resolve=>{
    const ov=document.createElement("div");
    ov.className="kid-overlay";
    ov.innerHTML='<div class="kid-box" role="dialog" aria-modal="true"><div class="kid-emoji"></div><div class="kid-msg"></div><div class="kid-btns"></div></div>';
    ov.querySelector(".kid-emoji").textContent=emoji;
    ov.querySelector(".kid-msg").textContent=msg;
    opts.forEach(o=>{
      const b=document.createElement("button"); b.className=o[2]; b.textContent=o[1];
      b.onclick=()=>{ ov.remove(); resolve(o[0]); };
      ov.querySelector(".kid-btns").appendChild(b);
    });
    document.body.appendChild(ov);
  });
}

// ---- 1. Journey replay: draws the line from place to place in year order ----
let replayStop=null;
async function playJourney(){
  if(replaying){ if(replayStop) replayStop(); return; }
  const list=journeyPlaces(yearScope());
  if(list.length<2){ kidSay(T("Add at least 2 visited places to play your journey!"),"🎬"); return; }
  fStatus="all"; fCat="all"; fFav=false; render();      // every journey pin must be on the map
  Z=1; centreMap(); applyZoom();
  const btn=document.getElementById("playBtn"), cap=document.getElementById("replayCap");
  const line=document.getElementById("journey"), layer=document.getElementById("markers");
  let stopped=false;
  replaying=true; replayStop=()=>{ stopped=true; };
  mapWrap.classList.add("replaying");
  btn.textContent=T("⏹ Stop"); cap.hidden=false; cap.textContent="";
  markerEls.forEach(el=>{ el.style.display="none"; });
  statePaths.forEach(el=>el.setAttribute("fill",el.dataset.p));
  line.setAttribute("d","");
  const mover=document.createElement("div"); mover.className="mover"; mover.textContent="✈️"; layer.appendChild(mover);
  const pts=list.map(p=>{ const q=project(p.lat,p.lon); return {x:q.x*MAP_W/100,y:q.y*MAP_H/100}; });
  const place=(x,y)=>{ mover.style.left=(x/MAP_W*100)+"%"; mover.style.top=(y/MAP_H*100)+"%"; if(BASE_W>mapWrap.clientWidth+1){ TX=mapWrap.clientWidth/2-x/MAP_W*BASE_W; applyZoom(); } };   // follow the plane
  let d="";
  for(let i=0;i<list.length && !stopped;i++){
    const p=list[i], a=pts[i-1], b=pts[i];
    if(i){
      const dur=Math.min(1700,Math.max(650,haversine(list[i-1],p)*1.3)), t0=performance.now();
      await new Promise(res=>{
        const step=now=>{
          const t=stopped?1:Math.min(1,Math.max(0,(now-t0)/dur)), e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
          const x=a.x+(b.x-a.x)*e, y=a.y+(b.y-a.y)*e;
          line.setAttribute("d",d+"L"+x.toFixed(1)+","+y.toFixed(1));
          place(x,y);
          if(t<1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
    }
    d+=(i?"L":"M")+b.x.toFixed(1)+","+b.y.toFixed(1);
    line.setAttribute("d",d); place(b.x,b.y);
    const el=markerEls.get(p); if(el){ el.style.display=""; el.classList.add("pop"); }
    const s=stateOf(p);
    statePaths.forEach(sp=>{ if(sp.dataset.n===s) sp.setAttribute("fill",sp.dataset.c); });
    cap.textContent=(p.year?p.year+" · ":"")+p.name+(s?", "+stName(s):"")+"  ("+(i+1)+"/"+list.length+")";
    if(!stopped) await sleep(950);
  }
  if(!stopped){
    cap.textContent=T("🎉 {0} places · {1} km!",list.length,getStats(yearScope()).km.toLocaleString("en-IN"));
    await sleep(2000);
  }
  mover.remove(); cap.hidden=true; btn.textContent=T("▶ Play my journey");
  mapWrap.classList.remove("replaying");
  replaying=false; replayStop=null; renderQueued=false;
  render();
}

// ---- 7. Year filter chips and the "2025 in Travel" card ----
function renderYears(){
  const years=[...new Set(places.filter(p=>p.year).map(p=>p.year))].sort((a,b)=>a-b);
  document.getElementById("yearBox").hidden=!years.length;
  const box=document.getElementById("yearChips");
  box.innerHTML="";
  [["all",T("All years")]].concat(years.map(y=>[y,String(y)])).forEach(d=>{
    const b=document.createElement("button");
    b.type="button"; b.className="chip"+(fYear===d[0]?" on":""); b.textContent=d[1];
    b.onclick=()=>{ fYear=d[0]; render(); };
    box.appendChild(b);
  });
  const btn=document.getElementById("yearCardBtn");
  btn.hidden=fYear==="all";
  btn.textContent=T("🎉 Share my “{0} in Travel” card",fYear);
}
async function buildYearCard(){
  const y=fYear, st=getStats(y), map=await buildCanvas(true), BH=340;
  const c=document.createElement("canvas"); c.width=MAP_W; c.height=MAP_H+BH;
  const ctx=c.getContext("2d");
  ctx.drawImage(map,0,0);
  ctx.fillStyle="#0b3b73"; ctx.fillRect(0,MAP_H,MAP_W,BH);
  ctx.textBaseline="alphabetic"; ctx.textAlign="left";
  ctx.fillStyle="#fff"; ctx.font="bold 54px Arial";
  ctx.fillText(fitText(ctx,"🎉 "+titleText(),MAP_W-80),40,MAP_H+76);
  const tiles=[[st.v,T("places")],[st.states+st.uts,T("states & UTs")],[st.km.toLocaleString("en-IN"),T("km travelled")],[st.mem,T("memories")]];
  const tw=(MAP_W-80-60)/4;
  tiles.forEach((t,i)=>{
    const x=40+i*(tw+20), yy=MAP_H+108;
    ctx.fillStyle="rgba(255,255,255,.13)"; roundRect(ctx,x,yy,tw,138,18); ctx.fill();
    ctx.textAlign="center";
    ctx.fillStyle="#ffd86b"; ctx.font="bold 58px Arial"; ctx.fillText(String(t[0]),x+tw/2,yy+70);
    ctx.fillStyle="#fff"; ctx.font="22px Arial"; ctx.fillText(fitText(ctx,t[1],tw-16),x+tw/2,yy+112);
  });
  ctx.textAlign="left"; ctx.fillStyle="#cfe1f7"; ctx.font="bold 26px Arial";
  const best=topFive(y);
  const lineText=best.length ? T("⭐ Top picks: {0}",best.map(p=>p.name).join(" · ")) : "📍 "+st.journey.map(p=>p.name).join(" → ");
  ctx.fillText(fitText(ctx,lineText,MAP_W-80),40,MAP_H+300);
  return c;
}
async function shareYearCard(){
  const y=fYear; if(y==="all") return;
  const canvas=await buildYearCard();
  const blob=await new Promise(res=>canvas.toBlob(res,"image/png"));
  const fname="india-"+y+"-in-travel.png";
  try{
    const file=new File([blob],fname,{type:"image/png"});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:titleText(),text:titleText()+" 🇮🇳"});
      return;
    }
  }catch(e){ if(e.name==="AbortError") return; }
  saveBlob(blob,fname);
  kidSay(T("Your {0} card is saved! Attach it in WhatsApp or Instagram.",y),"🎉");
}

// ---- 2. Backup and restore: everything goes into one file ----
function backupData(){
  if(!ownPlaces().length){ kidSay(T("Add a place first, then make a backup!"),"💾"); return; }
  const data={app:"my-visiting-places-india",version:1,exported:new Date().toISOString(),
    name:nameInput.value.trim(),lang:LANG,journey:journeyToggle.checked,quiz:localStorage.getItem("myIndiaQuizV2")||"",mode:MODE,places:ownPlaces()};
  saveBlob(new Blob([JSON.stringify(data)],{type:"application/json"}),"my-india-places-backup-"+new Date().toISOString().slice(0,10)+".json");
  kidSay(T("Backup saved: {0} places with notes and photos. Send this file to your other phone and tap “Restore from file” there.",ownPlaces().length),"💾");
}
// Keeps only safe, sensible values from a backup file.
function cleanPlace(x){
  if(!x || typeof x.name!=="string" || !x.name.trim()) return null;
  const lat=Number(x.lat), lon=Number(x.lon);
  if(!(inBounds(lat,lon))) return null;
  const p={name:x.name.trim().slice(0,80),lat,lon,status:x.status==="wish"?"wish":"visited",cat:CATS[x.cat]?x.cat:guessCat(x.name)};
  const y=parseInt(x.year,10); if(y>=1950 && y<=new Date().getFullYear()) p.year=y;
  if(typeof x.note==="string" && x.note.trim()) p.note=x.note.trim().slice(0,140);
  if(typeof x.photo==="string" && x.photo.length<600000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(x.photo)) p.photo=x.photo;
  if(x.img==="" || (typeof x.img==="string" && /^https:\/\/[^\s"'<>]+$/.test(x.img))) p.img=x.img;
  const r=parseInt(x.rating,10); if(r>=1 && r<=5) p.rating=r;
  if(x.fav===true) p.fav=true;
  p.added=Number(x.added)>0?Number(x.added):0;
  if(typeof x.country==="string" && x.country) p.country=x.country.slice(0,60);
  if(typeof x.date==="string" && /^\d{4}-\d\d-\d\d$/.test(x.date)) p.date=x.date;
  if(x.plan && typeof x.plan==="object"){
    const pl=x.plan, la=Number(pl.lat), lo=Number(pl.lon), dd=parseInt(pl.days,10);
    p.plan={season:String(pl.season||"").slice(0,80),days:dd>=1&&dd<=30?dd:2,combine:String(pl.combine||"").slice(0,80),why:String(pl.why||"").slice(0,160),ai:pl.ai===true,lang:pl.lang==="hi"?"hi":"en"};
    if(inBounds(la,lo)){ p.plan.lat=la; p.plan.lon=lo; }
  }
  return p;
}
async function restoreFile(file){
  if(!file) return;
  let data=null;
  try{ data=JSON.parse(await file.text()); }catch(e){}
  const raw=Array.isArray(data)?data:(data && data.places);
  const good=(Array.isArray(raw)?raw:[]).map(cleanPlace).filter(Boolean);
  if(!good.length){ kidSay(T("Hmm, that is not a backup file from this map."),"📂"); return; }
  let mode="replace";
  if(places.length){
    mode=await kidChoice(T("This backup has {0} places and you already have {1} here. What should I do?",good.length,places.length),"📂",
      [["merge",T("Add to my map ➕"),"kid-yes"],["replace",T("Replace my map 🔄"),"kid-no"],["",T("Cancel"),"kid-plain"]]);
    if(!mode) return;
  }
  places=ownPlaces();
  if(mode==="replace") places=[];
  good.forEach(p=>{
    const dup=findDuplicate(p.name,p.lat,p.lon);
    if(!dup){ places.push(p); return; }
    ["year","note","photo","rating","fav","plan"].forEach(k=>{ if(dup[k]===undefined && p[k]!==undefined) dup[k]=p[k]; });   // fill gaps only
  });
  if(data && typeof data.name==="string" && data.name.trim() && (mode==="replace" || !nameInput.value.trim())){
    nameInput.value=data.name.trim().slice(0,24);
    localStorage.setItem("myIndiaNameV2",nameInput.value);
  }
  if(data && data.quiz==="perfect") localStorage.setItem("myIndiaQuizV2","perfect");
  linkIndia();
  showEverything();
  earnedBadges=null; quietCelebrate();   // restored badges should not all pop up again
  render();
  kidSay(T("All done! {0} places are on your map now.",ownPlaces().length),"🎉");
}

// ---- 4. Trip planner for the wishlist ----
function nearestKnown(lat,lon,minKm,maxKm,skipName){
  let best=null, bd=maxKm;
  LOCAL_PLACES.forEach(x=>{
    if(x.sub==="State" || x.sub==="Union Territory" || norm(x.main)===norm(skipName||"")) return;
    const dkm=haversine({lat,lon},x);
    if(dkm>=minKm && dkm<bd){ bd=dkm; best=x; }
  });
  return best ? {x:best,km:bd} : null;
}
// Simple plan used when Groq is not set up or does not answer.
function localPlan(p){
  const c=catOf(p), s=stateOf(p);
  const season=isWorld()?"March to May or September to November":s==="Ladakh"?"June to September":c==="hill"?"March to June":c==="beach"?"November to February":c==="wildlife"?"November to April":"October to March";
  const near=nearestKnown(p.lat,p.lon,8,400,p.name);
  const plan={season:T(season),days:{hill:4,beach:3,wildlife:3,temple:2,fort:2,city:2}[c],combine:near?near.x.main:"",why:near?T("Only about {0} km away",Math.round(near.km)):"",ai:false,lang:LANG};
  if(near){ plan.lat=near.x.lat; plan.lon=near.x.lon; }
  return plan;
}
async function groqPlans(list){
  const out=await groqChat([
    {role:"system",content:"You are an expert India trip planner. Return only valid JSON."},
    {role:"user",content:`Plan short trips for these wishlist places in India:
${list.map((p,i)=>(i+1)+". "+p.name+(stateOf(p)?", "+stateOf(p):"")).join("\n")}

For EACH place give: the best season to visit (as months), a sensible number of days, and ONE different nearby place (within about 250 km) that combines well with it in the same trip.${aiLang()}

Return ONLY JSON:
{"plans":[{"n":1,"season":"October to March","days":3,"combine":"nearby place name","combine_lat":0.0000,"combine_lon":0.0000,"why":"one short reason to combine them, max 14 words"}]}`}
  ],Math.min(2400,250+list.length*140));
  const res=[];
  (Array.isArray(out.plans)?out.plans:[]).forEach((x,k)=>{
    const i=(parseInt(x.n,10)||k+1)-1, dd=parseInt(x.days,10), la=Number(x.combine_lat), lo=Number(x.combine_lon);
    if(i<0 || i>=list.length || !x.season) return;
    const plan={season:String(x.season).slice(0,80),days:dd>=1&&dd<=30?dd:2,combine:String(x.combine||"").trim().slice(0,80),why:String(x.why||"").slice(0,160),ai:true,lang:LANG};
    if(inBounds(la,lo)){ plan.lat=la; plan.lon=lo; }
    res[i]=plan;
  });
  return res;
}
async function tripPlanner(force){
  const wish=places.filter(p=>p.status==="wish");
  if(!wish.length){ kidSay(T("Your wishlist is empty! Add a ⭐ Wishlist place first."),"🧳"); return; }
  const card=kidCard('<div class="kid-emoji">🧳</div><h3>'+T("Wishlist trip planner")+'</h3><div class="sub" id="tpSub">'+T("Thinking… 🤔")+'</div><div id="tpList"></div><div><button type="button" class="kid-mini" id="tpAgain" hidden>'+T("🔄 Plan again")+'</button></div>');
  let failed=false;
  if(groqReady()){
    const need=wish.filter(p=>force || !p.plan || !p.plan.ai || p.plan.lang!==LANG).slice(0,15);
    if(need.length){
      try{ const plans=await groqPlans(need); need.forEach((p,i)=>{ if(plans[i]) p.plan=plans[i]; }); }
      catch(e){ console.warn("Groq trip plans failed; using built-in ideas.",e); failed=true; }
    }
  }
  wish.forEach(p=>{ if(!p.plan || p.plan.lang!==LANG || (force && !p.plan.ai)) p.plan=localPlan(p); });
  render();                                        // keeps the plans for next time
  if(!document.body.contains(card.box)) return;
  card.box.querySelector("#tpSub").textContent=wish.every(p=>p.plan.ai) ? T("Planned for you by Groq AI")
    : (groqReady() ? T("Built-in ideas (Groq did not answer).") : T("Built-in ideas. Add your Groq API key for smarter plans."));
  const list=card.box.querySelector("#tpList");
  wish.forEach(p=>{
    const pl=p.plan, row=document.createElement("div");
    row.className="kid-row";
    row.innerHTML='<span class="em">'+catIcon(p)+'</span><div><b></b><small class="a"></small><small class="b"></small><small class="c"></small></div><button class="kid-mini">'+T("⭐ Add")+'</button>';
    row.querySelector("b").textContent=p.name;
    row.querySelector(".a").textContent=T("🌤️ Best time: {0}",pl.season);
    row.querySelector(".b").textContent=T("📅 Days needed: {0}",pl.days);
    row.querySelector(".c").textContent=pl.combine ? T("➕ Combine with: {0}",pl.combine)+(pl.why?" — "+pl.why:"") : "";
    const btn=row.querySelector("button");
    const canAdd=pl.combine && Number.isFinite(pl.lat) && Number.isFinite(pl.lon) && !findDuplicate(pl.combine,pl.lat,pl.lon);
    btn.hidden=!canAdd;
    btn.title=pl.combine||"";
    btn.onclick=()=>{
      if(findDuplicate(pl.combine,pl.lat,pl.lon)) return;
      places.push({name:pl.combine,lat:pl.lat,lon:pl.lon,status:"wish",cat:guessCat(pl.combine)});
      showEverything();
      btn.textContent=T("Added ✓"); btn.disabled=true;
      render();
    };
    list.appendChild(row);
  });
  const again=card.box.querySelector("#tpAgain");
  again.hidden=false;
  again.onclick=()=>{ card.close(); tripPlanner(true); };
  const sh=mkEl("button","kid-mini",T("📤 Share my trip plans")); sh.type="button"; sh.onclick=()=>shareText(plannerText());
  again.parentNode.appendChild(sh);
}

// ---- 5. India quiz about the places you have visited ----
function localQuiz(vis){
  const qs=[], allStates=statePaths.map(e=>e.dataset.n), thisYear=new Date().getFullYear();
  const withState=shuffle(vis.filter(p=>stateOf(p)));
  withState.slice(0,2).forEach(p=>{
    const s=stateOf(p), opts=shuffle([s].concat(shuffle(allStates.filter(x=>x!==s)).slice(0,3)));
    qs.push({q:(isWorld()?T("Which country is {0} in?",p.name):T("Which state or union territory is {0} in?",p.name)),options:opts.map(stName),answer:opts.indexOf(s),explain:T("{0} is in {1}.",p.name,stName(s))});
  });
  withState.slice(2,4).forEach(p=>{
    const s=stateOf(p);
    const others=shuffle(LOCAL_PLACES.filter(x=>x.sub!=="State" && x.sub!=="Union Territory" && x.sub.split(", ").pop()!==s && norm(x.main)!==norm(p.name))).slice(0,3).map(x=>x.main);
    const opts=shuffle([p.name].concat(others));
    qs.push({q:T("Which of these places is in {0}?",stName(s)),options:opts,answer:opts.indexOf(p.name),explain:T("{0} is in {1}.",p.name,stName(s))});
  });
  const pool=shuffle(vis.slice());
  for(let i=0;i+1<pool.length && i<4;i+=2){
    const a=pool[i], b=pool[i+1], km=haversine(a,b);
    if(Math.abs(a.lat-b.lat)>1){
      const n=a.lat>b.lat?a:b, o=n===a?b:a, opts=shuffle([a.name,b.name]);
      qs.push({q:T("Which place is farther north?"),options:opts,answer:opts.indexOf(n.name),explain:T("{0} is farther north than {1}.",n.name,o.name)});
    }else if(km>120){
      const r=v=>Math.max(10,Math.round(v/10)*10), right=r(km);
      const opts=shuffle([...new Set([right,r(km*0.45),r(km*1.7),r(km*2.6)])]);
      if(opts.length===4) qs.push({q:T("About how far is {0} from {1} in a straight line?",a.name,b.name),options:opts.map(v=>T("{0} km",v.toLocaleString("en-IN"))),answer:opts.indexOf(right),explain:T("It is about {0} km.",right.toLocaleString("en-IN"))});
    }
  }
  const dated=shuffle(vis.filter(p=>p.year))[0];
  if(dated){
    const set=new Set([dated.year]);
    for(let k=1;set.size<4 && k<8;k++){ if(dated.year+k<=thisYear) set.add(dated.year+k); if(set.size<4) set.add(dated.year-k); }
    const opts=shuffle([...set]);
    qs.push({q:T("In which year did you visit {0}?",dated.name),options:opts.map(String),answer:opts.indexOf(dated.year),explain:T("You visited {0} in {1}.",dated.name,dated.year)});
  }
  const st=getStats(), setN=new Set([st.states,st.states+1,st.states+2,Math.max(0,st.states-1),st.states+4]);
  const optsN=shuffle([...setN].slice(0,4));
  qs.push({q:isWorld()?T("How many countries have you visited so far?"):T("How many states have you visited so far?"),options:optsN.map(String),answer:optsN.indexOf(st.states),explain:isWorld()?T("You have visited {0} countries.",st.states):T("You have visited {0} states.",st.states)});
  return shuffle(qs).slice(0,5);
}
async function groqQuiz(vis){
  const names=shuffle(vis.slice()).slice(0,8).map(p=>p.name+(stateOf(p)?" ("+stateOf(p)+")":""));
  const out=await groqChat([
    {role:"system",content:"You write short, fun, factually correct quiz questions for children about places in India. Return only valid JSON."},
    {role:"user",content:`I have visited these places in India: ${names.join(", ")}.

Write 5 multiple-choice quiz questions about these places (famous sights, history, rivers, food, festivals, which state they are in). Use well-known true facts only. Each question has exactly 4 short options and exactly one correct option.${aiLang()}

Return ONLY JSON:
{"questions":[{"q":"question","options":["a","b","c","d"],"answer":0,"explain":"one short sentence saying why"}]}
"answer" is the position (0 to 3) of the correct option.`}
  ],1400);
  return (Array.isArray(out.questions)?out.questions:[]).map(x=>{
    const opts=Array.isArray(x.options)?x.options.map(o=>String(o).trim()).filter(Boolean):[], a=Number(x.answer);
    if(!x.q || opts.length!==4 || new Set(opts).size!==4 || !Number.isInteger(a) || a<0 || a>3) return null;
    const right=opts[a], mixed=shuffle(opts.slice());
    return {q:String(x.q),options:mixed,answer:mixed.indexOf(right),explain:String(x.explain||"")};
  }).filter(Boolean).slice(0,5);
}
async function startQuiz(){
  const vis=places.filter(p=>p.status==="visited");
  if(!vis.length){ kidSay(T("Visit a place first! The quiz is about places you have visited."),"🧠"); return; }
  const card=kidCard('<div class="kid-emoji">🧠</div><h3>'+T("Travel quiz")+'</h3><div class="sub" id="qzSub">'+T("Making your questions… 🤔")+'</div><div id="qzBody"></div>');
  let qs=[];
  if(groqReady()){ try{ qs=await groqQuiz(vis); }catch(e){ console.warn("Groq quiz failed; using built-in questions.",e); } }
  if(qs.length<3) qs=localQuiz(vis);
  if(!document.body.contains(card.box)) return;
  const sub=card.box.querySelector("#qzSub"), body=card.box.querySelector("#qzBody");
  let i=0, score=0;
  const finish=()=>{
    const perfect=score===qs.length;
    sub.textContent=T("You scored {0} out of {1}!",score,qs.length);
    body.innerHTML='<div class="qz-score"></div><div class="qz-q"></div><div class="kid-btns"><button class="kid-yes"></button></div>';
    body.querySelector(".qz-score").textContent=perfect?"🏅":"💪";
    body.querySelector(".qz-q").textContent=perfect?T("Perfect score! You win the Quiz Whiz badge!"):T("Good try! Get every answer right to win the Quiz Whiz badge.");
    const again=body.querySelector("button");
    again.textContent=T("Play again 🔁");
    again.onclick=()=>{ card.close(); startQuiz(); };
    if(perfect){ localStorage.setItem("myIndiaQuizV2","perfect"); render(); }
  };
  const show=()=>{
    const q=qs[i];
    sub.textContent=T("Question {0} of {1}",i+1,qs.length);
    body.innerHTML='<div class="qz-q"></div><div class="qz-opts"></div><div class="kid-fact" hidden></div><div class="kid-btns" style="margin-top:12px"><button class="kid-yes" hidden></button></div>';
    body.querySelector(".qz-q").textContent=q.q;
    q.options.forEach((o,k)=>{
      const b=document.createElement("button");
      b.type="button"; b.className="qz-opt"; b.textContent=o;
      b.onclick=()=>{
        body.querySelectorAll(".qz-opt").forEach((x,m)=>{ x.disabled=true; if(m===q.answer) x.classList.add("right"); });
        const ok=k===q.answer;
        if(ok) score++; else b.classList.add("wrong");
        const f=body.querySelector(".kid-fact");
        f.hidden=false; f.textContent=(ok?T("✅ Correct!"):T("❌ Not quite!"))+(q.explain?" "+q.explain:"");
        const nx=body.querySelector(".kid-yes");
        nx.hidden=false; nx.textContent=i+1<qs.length?T("Next ➡️"):T("See my score 🏁");
        nx.onclick=()=>{ i++; if(i<qs.length) show(); else finish(); };
      };
      body.querySelector(".qz-opts").appendChild(b);
    });
  };
  show();
}

// ---- Pins from photos: reads the location and date saved inside each photo ----
function exifInfo(buf){
  const u=new Uint8Array(buf), v=new DataView(buf);
  let s=-1;
  for(let i=0;i<u.length-14;i++){
    if(u[i]===0x45 && u[i+1]===0x78 && u[i+2]===0x69 && u[i+3]===0x66 && u[i+4]===0 && u[i+5]===0){ s=i+6; break; }   // "Exif"
  }
  if(s<0) return null;
  try{
    const mark=v.getUint16(s);
    if(mark!==0x4949 && mark!==0x4D4D) return null;
    const le=mark===0x4949, u16=o=>v.getUint16(s+o,le), u32=o=>v.getUint32(s+o,le);
    const ifd=off=>{
      const m=new Map(), n=u16(off);
      for(let i=0;i<n && i<200;i++){ const e=off+2+i*12; m.set(u16(e),{count:u32(e+4),vo:e+8}); }
      return m;
    };
    const rat=(t,k)=>{ const o=u32(t.vo)+k*8, den=u32(o+4); return den?u32(o)/den:NaN; };
    const str=t=>{ const o=t.count>4?u32(t.vo):t.vo; let r=""; for(let i=0;i<t.count && i<40;i++){ const ch=u[s+o+i]; if(!ch) break; r+=String.fromCharCode(ch); } return r; };
    const i0=ifd(u32(4)), out={};
    let when="";
    if(i0.has(0x8769)){ const ex=ifd(u32(i0.get(0x8769).vo)); if(ex.has(0x9003)) when=str(ex.get(0x9003)); }
    if(!when && i0.has(0x0132)) when=str(i0.get(0x0132));
    const y=parseInt(when,10);
    if(/^\d{4}:\d\d:\d\d/.test(when)) out.date=when.slice(0,10).replace(/:/g,"-");
    if(y>=1950 && y<=new Date().getFullYear()) out.year=y;
    if(i0.has(0x8825)){
      const g=ifd(u32(i0.get(0x8825).vo));
      if(g.has(2) && g.has(4)){
        const dms=t=>rat(t,0)+rat(t,1)/60+rat(t,2)/3600;
        let lat=dms(g.get(2)), lon=dms(g.get(4));
        if(g.has(1) && str(g.get(1))==="S") lat=-lat;
        if(g.has(3) && str(g.get(3))==="W") lon=-lon;
        if(Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon)){ out.lat=lat; out.lon=lon; }
      }
    }
    return out;
  }catch(e){ return null; }          // damaged or cut-off photo data
}
async function reverseName(lat,lon){
  try{
    const r=await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en&lat="+lat.toFixed(5)+"&lon="+lon.toFixed(5),{headers:{"Accept":"application/json"}});
    const d=await r.json(), a=d.address||{};
    return String(a.city||a.town||a.village||a.municipality||a.county||a.state_district||d.name||"").slice(0,60);
  }catch(e){ console.warn("Place name lookup failed.",e); return ""; }
}
async function importPhotos(fileList){
  const files=[...fileList].slice(0,300);
  if(!files.length) return;
  const card=kidCard('<div class="kid-emoji">📷</div><h3>'+T("Pins from my photos")+'</h3><div class="sub" id="phSub"></div><div id="phList"></div>'
    +'<div class="kid-btns" style="margin-top:12px" id="phBtns" hidden><button class="kid-yes" id="phAdd">'+T("Add pins 📍")+'</button><button class="kid-no" id="phCancel">'+T("Cancel")+'</button></div>');
  const sub=card.box.querySelector("#phSub"), open=()=>document.body.contains(card.box);
  let groups=[], noLoc=0, outside=0, n=0, used=0;
  for(const f of files){
    sub.textContent=T("Reading photo {0} of {1}…",++n,files.length);
    let info=null;
    try{ info=exifInfo(await f.slice(0,262144).arrayBuffer()); }catch(e){}
    if(!open()) return;
    if(!info || info.lat===undefined){ noLoc++; continue; }
    if(!inBounds(info.lat,info.lon)){ outside++; continue; }
    used++;
    let g=groups.find(x=>haversine(x,info)<12);              // photos taken close together = one pin
    if(!g){ g={lat:info.lat,lon:info.lon,files:[],years:[]}; groups.push(g); }
    g.files.push(f); if(info.year) g.years.push(info.year); if(info.year && info.date){ g.dates=g.dates||[]; g.dates.push(info.date); }
  }
  // give every group a name
  const named=[]; let asked=0;
  for(const g of groups){
    g.existing=places.find(p=>haversine(p,g)<12) || null;
    if(g.existing) g.name=g.existing.name;
    else{
      const k=nearestKnown(g.lat,g.lon,0,25);
      if(k) g.name=k.x.main;
      else{
        sub.textContent=T("Finding place names…");
        if(asked++) await sleep(1100);                        // be gentle with the free name service
        g.name=await reverseName(g.lat,g.lon) || T("Photo spot {0}",named.length+1);
        if(!open()) return;
      }
      g.existing=places.find(p=>norm(p.name)===norm(g.name)) || null;
    }
    const twin=named.find(o=>o.existing?o.existing===g.existing:(!g.existing && norm(o.name)===norm(g.name)));
    if(twin){ twin.files=twin.files.concat(g.files); twin.years=twin.years.concat(g.years); twin.dates=(twin.dates||[]).concat(g.dates||[]); }
    else named.push(g);
  }
  groups=named;
  for(const g of groups){
    g.year=g.years.length?Math.min.apply(null,g.years):0;
    g.date=(g.dates||[]).sort()[0]||"";
    for(const f of g.files.slice(0,3)){ try{ g.photo=await readPhoto(f); break; }catch(e){} }   // first photo that opens
  }
  if(!open()) return;
  const notes=[];
  if(groups.length) notes.push(T("Found {0} places in {1} photos.",groups.length,used));
  else if(!outside) notes.push(T("None of these photos has a location saved inside it. Tip: choose the original camera photos (photos received on WhatsApp lose their location), and on Android pick them through “Files” or “Browse”."));
  if(noLoc && groups.length) notes.push(T("{0} photos had no location saved and were skipped.",noLoc));
  if(outside) notes.push(T("{0} photos were taken outside India and were skipped.",outside));
  sub.textContent=notes.join(" ");
  if(!groups.length) return;
  const list=card.box.querySelector("#phList");
  groups.forEach(g=>{
    const row=document.createElement("label");
    row.className="kid-row";
    row.innerHTML=(g.photo?'<img class="ph-thumb" alt="">':'<span class="em">📍</span>')+'<div><b></b><small class="a"></small><small class="b"></small></div><input type="checkbox" class="ph-ck" checked>';
    if(g.photo) row.querySelector("img").src=g.photo;
    row.querySelector("b").textContent=g.name;
    row.querySelector(".a").textContent=(g.year?g.year+" · ":"")+T("{0} photos",g.files.length);
    row.querySelector(".b").textContent=g.existing?T("Already on your map: photo will be added"):T("New pin");
    g.box=row.querySelector("input");
    list.appendChild(row);
  });
  card.box.querySelector("#phBtns").hidden=false;
  card.box.querySelector("#phCancel").onclick=card.close;
  card.box.querySelector("#phAdd").onclick=()=>{
    let added=0, updated=0;
    groups.forEach(g=>{
      if(!g.box.checked) return;
      if(g.existing){
        if(!g.existing.photo && g.photo) g.existing.photo=g.photo;
        if(!g.existing.year && g.year){ g.existing.year=g.year; if(g.date) g.existing.date=g.date; }
        updated++; return;
      }
      const p={name:g.name,lat:g.lat,lon:g.lon,status:"visited",cat:guessCat(g.name)};
      if(g.year) p.year=g.year;
      if(g.date) p.date=g.date;
      if(g.photo) p.photo=g.photo;
      places.push(p); added++;
    });
    card.close();
    showEverything();
    render();
    kidSay(T("{0} new pins added and {1} places updated from your photos!",added,updated),"📸");
  };
}
document.getElementById("photoFiles").addEventListener("change",function(){ const f=[...this.files]; this.value=""; importPhotos(f); });
document.getElementById("restoreFile").addEventListener("change",function(){ const f=this.files[0]; this.value=""; restoreFile(f); });

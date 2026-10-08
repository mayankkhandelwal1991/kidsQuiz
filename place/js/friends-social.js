/* My Travel Map · friends-social.js
   Friend activity, shared game scores, group trips and the friend quiz. */
// =====================================================================
//  FRIENDS: activity feed, daily game scores, group trips, friend quiz
//  Everything is kept in my own member entry of each group:
//    travel/groups/<code>/members/<my id>/{act, games, trips, going}
// =====================================================================
let actTimer=null, feedSeenTimer=null;
function eachGroup(fn){
  if(!fbUser || !fbDb || cloudOk===false) return Promise.resolve();
  return Promise.all(myGroups().map(g=>Promise.resolve().then(()=>fn(gref(g.code).child("members/"+fbUser.uid),g)).catch(e=>console.warn("Group update failed.",e))));
}
// Remember something I did so that my friends see it in their activity feed.
function logAct(type,a,b){
  if(!fbUser || !myGroups().length) return;
  const key="myActsV1_"+fbUser.uid, acts=lsGet(key,[]);
  acts.push({t:Date.now(),y:type,a:String(a==null?"":a).slice(0,60),b:String(b==null?"":b).slice(0,60)});
  while(acts.length>12) acts.shift();
  lsSet(key,acts);
  clearTimeout(actTimer);
  actTimer=setTimeout(()=>eachGroup(ref=>ref.child("act").set(acts)),2000);
}
function postGame(kind,score){
  if(!fbUser) return;
  const key="myGamesV1_"+fbUser.uid; let g=lsGet(key,{});
  if(g.d!==todayStr()) g={d:todayStr()};
  g[kind+(isWorld()?"W":"")]=score;
  lsSet(key,g);
  eachGroup(ref=>ref.child("games").set(g));
  if(kind!=="daily") logAct(kind,score);
}
function actText(e,name){
  const a=String(e.a||""), b=String(e.b||"");
  switch(e.y){
    case "place": return T("{0} visited {1}",name,a)+(b?" ("+stName(b)+")":"");
    case "state": return T("{0} coloured in {1}",name,stName(a));
    case "level": return T("{0} is now: {1}",name,T(a));
    case "col": return T("{0} completed the collection {1}",name,T(a));
    case "pin": return T("{0} scored {1} in the pin-drop challenge",name,a);
    case "guess": return T("{0} scored {1} in Guess the place",name,a);
    case "trip": return T("{0} planned a group trip: {1}",name,a);
    case "going": return T("{0} is joining the trip {1}",name,a);
    case "fq": return T("{0} scored {1} in the quiz about {2}",name,a,b);
    default: return "";
  }
}
function agoText(t){
  const m=Math.max(1,Math.round((Date.now()-t)/60000));
  return m<60?T("{0} min ago",m):m<1440?T("{0} h ago",Math.round(m/60)):T("{0} d ago",Math.round(m/1440));
}
function feedFrom(mem){
  const out=[];
  Object.keys(mem||{}).forEach(u=>{
    if(fbUser && u===fbUser.uid) return;
    const m=mem[u]||{}, name=String(m.name||T("Traveller")).slice(0,40), acts=Array.isArray(m.act)?m.act:Object.keys(m.act||{}).map(k=>m.act[k]);
    acts.forEach(e=>{ if(e && Number(e.t)>0 && Number(e.t)<Date.now()+3600000){ const text=actText(e,name); if(text) out.push({t:Number(e.t),text}); } });
  });
  return out.sort((a,b)=>b.t-a.t);
}
function feedSeenKey(){ return "myFeedSeenV1_"+fbUser.uid; }
function boardDot(on){ document.querySelectorAll('[data-go="board"]').forEach(b=>b.classList.toggle("dot",on)); }
// Called a few seconds after opening the app: is there anything new from my friends?
async function checkFeed(){
  if(!fbUser || !fbDb || cloudOk===false) return;
  const groups=myGroups().slice(0,4); if(!groups.length) return;
  try{
    const seen=lsGet(feedSeenKey(),0); let fresh=[];
    for(const g of groups){ const mem=(await gref(g.code).child("members").once("value")).val()||{}; fresh=fresh.concat(feedFrom(mem).filter(e=>e.t>seen)); }
    const uniq=[...new Map(fresh.map(e=>[e.t+e.text,e])).values()].sort((a,b)=>b.t-a.t);
    if(!uniq.length) return;
    boardDot(true);
    toast("🔔 "+uniq[0].text+(uniq.length>1?" · +"+(uniq.length-1):""));
  }catch(e){ console.warn("Friend activity could not be checked.",e); }
}

// ---- extra sections under the friends leaderboard ----
function renderSocial(box,g,mem,rows){
  const mk=(txt,cls,fn)=>{ const b=mkEl("button",cls,txt); b.type="button"; b.onclick=fn; return b; };
  const nameOf=u=>u===fbUser.uid?T("You"):String((rows.find(r=>r.k===u)||{}).name||(mem[u]&&mem[u].name)||T("Traveller")).slice(0,40);
  const myRef=()=>gref(g.code).child("members/"+fbUser.uid);

  // today's games
  const W=isWorld()?"W":"", today=todayStr(), played=Object.keys(mem).map(u=>({u,g:(mem[u]&&mem[u].games)||{}})).filter(x=>x.g.d===today && (x.g["pin"+W]!==undefined || x.g["guess"+W]!==undefined || x.g.daily!==undefined));
  box.appendChild(mkEl("div","share-title","🎮 "+T("Today’s games")));
  if(played.length){
    const tb=mkEl("div","gm-table");
    tb.append(mkEl("span","gm-h",""),mkEl("span","gm-h","📍"),mkEl("span","gm-h","🖼️"),mkEl("span","gm-h","🔥"));
    played.sort((a,b)=>(Number(b.g["pin"+W])||0)-(Number(a.g["pin"+W])||0)).forEach(x=>{
      const num=v=>v===undefined?"–":String(Number(v)||0);
      tb.append(mkEl("span","gm-n"+(x.u===fbUser.uid?" me":""),nameOf(x.u)),mkEl("span","",num(x.g["pin"+W])),mkEl("span","",num(x.g["guess"+W])),mkEl("span","",x.g.daily===undefined?"–":Number(x.g.daily)?"✅":"❌"));
    });
    box.appendChild(tb);
  }else box.appendChild(mkEl("div","small lb-note",T("Nobody has played today. Be the first and your friends will see your score!")));
  const gr=mkEl("div","actions"); gr.style.marginTop="6px";
  gr.append(mk("📍 "+T("Pin-drop challenge"),"gray",startPinDrop),mk("🖼️ "+T("Guess the place"),"gray",startGuessPlace));
  box.appendChild(gr);

  // group trips
  const trips=[];
  Object.keys(mem).forEach(u=>{
    const tr=mem[u] && mem[u].trips;
    if(tr && typeof tr==="object") Object.keys(tr).slice(0,5).forEach(id=>{
      const x=tr[id];
      if(x && typeof x.title==="string" && /^[a-z0-9]{1,16}$/.test(id)) trips.push({id,owner:u,title:x.title.slice(0,50),when:String(x.when||"").slice(0,30),t:Number(x.t)||0,
        places:(Array.isArray(x.places)?x.places:Object.keys(x.places||{}).map(k=>x.places[k])).slice(0,8).map(s=>String(s).slice(0,60))});
    });
  });
  trips.sort((a,b)=>b.t-a.t);
  box.appendChild(mkEl("div","share-title","🧳 "+T("Group trips")));
  if(!trips.length) box.appendChild(mkEl("div","small lb-note",T("No trips yet. Plan one and see who is in!")));
  trips.forEach(tr=>{
    const key=tr.owner+"_"+tr.id, going=Object.keys(mem).filter(u=>u===tr.owner || (mem[u] && mem[u].going && mem[u].going[key])), mine=tr.owner===fbUser.uid, iAmIn=going.includes(fbUser.uid);
    const cardEl=mkEl("div","trip-card");
    cardEl.append(mkEl("b","",tr.title),mkEl("small","",(tr.when?"📅 "+tr.when+" · ":"")+T("planned by {0}",nameOf(tr.owner))));
    if(tr.places.length){ const w=mkEl("div","cmp-chips"); tr.places.forEach(n=>w.append(mkEl("span","cchip a",n))); cardEl.append(w); }
    cardEl.append(mkEl("small","","✋ "+T("Going ({0}): {1}",going.length,going.map(nameOf).join(", "))));
    const act=mkEl("div","trip-act");
    if(mine) act.append(mk(T("Delete"),"gray",async()=>{ if(await kidAsk(T("Delete the trip {0}?",tr.title),{emoji:"🧳"})){ await myRef().child("trips/"+tr.id).remove().catch(e=>console.warn(e)); loadBoard(); } }));
    else act.append(mk(iAmIn?T("I am out"):T("I am in ✋"),iAmIn?"gray":"green",async()=>{
      try{ if(iAmIn) await myRef().child("going/"+key).remove(); else{ await myRef().child("going/"+key).set(true); logAct("going",tr.title); confetti(); } }catch(e){ console.warn(e); }
      loadBoard();
    }));
    if(tr.places.length) act.append(mk(T("⭐ Add to my wishlist"),"gray",()=>wishMany(tr.places)));
    act.append(mk(T("📤 Share"),"gray",()=>shareText("🧳 "+tr.title+(tr.when?" · "+tr.when:"")+"\n"+(tr.places.length?"📍 "+tr.places.join(", ")+"\n":"")+"✋ "+going.map(nameOf).join(", ")+"\n"+T("Join us on My Travel Map with group code {0}",g.code)+" "+pageUrl("?join="+g.code))));
    cardEl.append(act);
    box.appendChild(cardEl);
  });
  box.appendChild(mk(T("➕ Plan a group trip"),"primary full",()=>planGroupTrip(g)));

  // friend activity
  const feed=feedFrom(mem).slice(0,15), seen=lsGet(feedSeenKey(),0);
  box.appendChild(mkEl("div","share-title","🔔 "+T("Friend activity")));
  if(!feed.length) box.appendChild(mkEl("div","small lb-note",T("Nothing yet. When your friends add places or play games, you will see it here.")));
  feed.forEach(e=>{ const row=mkEl("div","feed-row"+(e.t>seen?" new":"")); row.append(mkEl("span","",e.text),mkEl("small","",agoText(e.t))); box.appendChild(row); });
  clearTimeout(feedSeenTimer);
  feedSeenTimer=setTimeout(()=>{ if(fbUser){ lsSet(feedSeenKey(),Date.now()); boardDot(false); } },1500);      // opening the list marks it as read
}
async function shareText(text){
  try{ if(navigator.share){ await navigator.share({text}); return; } }catch(e){ if(e.name==="AbortError") return; }
  let copied=false;
  try{ await navigator.clipboard.writeText(text); copied=true; }catch(e){}
  kidSay(copied?T("Copied! Paste it in WhatsApp or any chat."):text,"📤");
}
// Adds a list of place names to my wishlist (used for a friend's trip).
async function wishMany(names){
  const seg=document.querySelectorAll("#statusSeg button"), was=[...seg].find(b=>b.classList.contains("on"));
  seg.forEach(b=>b.classList.toggle("on",b.dataset.v==="wish"));
  try{ if(!isWide()) showTab("map",true); await addMany(names); }
  finally{ seg.forEach(b=>b.classList.toggle("on",b===was)); }
}
function planGroupTrip(g){
  const wish=places.filter(p=>p.status==="wish").slice(0,20);
  const card=kidCard('<div class="kid-emoji">🧳</div><h3>'+T("Plan a group trip")+'</h3>'
    +'<label for="gtTitle">'+T("Trip name")+'</label><input id="gtTitle" maxlength="50" autocomplete="off">'
    +'<label for="gtWhen">'+T("When (for example December 2026)")+'</label><input id="gtWhen" maxlength="30" autocomplete="off">'
    +'<label>'+T("Places")+'</label><div id="gtWish" class="gt-wish"></div>'
    +'<input id="gtMore" maxlength="200" autocomplete="off" placeholder="'+T("Other places, with commas")+'">'
    +'<div class="kid-btns" style="margin-top:14px"><button class="kid-yes">'+T("Save and tell my friends 📣")+'</button></div>');
  const $=id=>card.box.querySelector("#"+id);
  $("gtTitle").value=T("{0}’s trip",myName().split(" ")[0]);
  wish.forEach(p=>{ const l=mkEl("label","gt-opt"); const c=mkEl("input"); c.type="checkbox"; c.value=p.name; l.append(c,mkEl("span","",catIcon(p)+" "+p.name)); $("gtWish").appendChild(l); });
  if(!wish.length) $("gtWish").appendChild(mkEl("div","small",T("Tip: places on your wishlist appear here to tick.")));
  card.box.querySelector(".kid-yes").onclick=async()=>{
    const title=$("gtTitle").value.trim(), picked=[...card.box.querySelectorAll("#gtWish input:checked")].map(c=>c.value).concat($("gtMore").value.split(",").map(s=>s.trim()).filter(Boolean));
    const list=[...new Set(picked)].slice(0,8).map(s=>s.slice(0,60));
    if(!title){ kidSay(T("Give your trip a name first!"),"🧳"); return; }
    const id="t"+Date.now().toString(36);
    try{
      await gref(g.code).child("members/"+fbUser.uid+"/trips/"+id).set({title:title.slice(0,50),when:$("gtWhen").value.trim().slice(0,30),places:list,t:Date.now()});
      logAct("trip",title); card.close(); confetti(); loadBoard();
    }catch(e){ groupRulesMsg(e); }
  };
}

// ---- "How well do you know <friend>?" quiz made from a friend's map ----
function friendQuiz(r){
  const theirs=theirVisited(r);
  if(theirs.length<2){ kidSay(T("{0} needs at least 2 visited places for a quiz.",r.name),"🧠"); return; }
  const not=shuffle(famousPool().filter(x=>!samePlace({name:x.main,lat:x.lat,lon:x.lon},theirs))), pick=shuffle(theirs.slice()), qs=[];
  pick.slice(0,2).forEach((p,k)=>{ const opts=shuffle([p.name].concat(not.slice(k*3,k*3+3).map(x=>x.main))); if(opts.length===4) qs.push({q:T("Which of these places has {0} visited?",r.name),options:opts,answer:opts.indexOf(p.name)}); });
  [pick[2]||pick[0],not[7]].forEach((p,k)=>{ if(!p) return; const nm=p.name||p.main, yes=k===0, opts=[T("Yes"),T("No")]; qs.push({q:T("Has {0} been to {1}?",r.name,nm),options:opts,answer:yes?0:1}); });
  const n=theirs.length, set=[...new Set([n,n+2,Math.max(1,n-2),n+5])]; if(set.length===4){ const opts=shuffle(set); qs.push({q:T("How many places has {0} visited?",r.name),options:opts.map(String),answer:opts.indexOf(n)}); }
  const states=[...new Set(theirs.map(x=>x.st).filter(Boolean))], other=shuffle(statePaths.map(e=>e.dataset.n).filter(s=>!states.includes(s)));
  if(states.length>=3 && other.length){ const opts=shuffle(shuffle(states).slice(0,3).concat(other[0])); qs.push({q:isWorld()?T("Which of these countries has {0} NOT visited?",r.name):T("Which of these states has {0} NOT visited?",r.name),options:opts.map(stName),answer:opts.indexOf(other[0])}); }
  const list=shuffle(qs).slice(0,5);
  const card=kidCard('<div class="kid-emoji">🧠</div><h3></h3><div class="sub" id="fqSub"></div><div id="fqBody"></div>');
  card.box.querySelector("h3").textContent=T("How well do you know {0}?",r.name);
  const sub=card.box.querySelector("#fqSub"), body=card.box.querySelector("#fqBody");
  let i=0, score=0;
  const finish=()=>{
    sub.textContent=T("You scored {0} out of {1}!",score,list.length);
    body.innerHTML='<div class="qz-score">'+(score===list.length?"🏅":score>=list.length/2?"👍":"😅")+'</div><div class="kid-btns"><button class="kid-yes">'+T("Okie dokie! 👍")+'</button></div>';
    body.querySelector("button").onclick=card.close;
    if(score===list.length) confetti();
    logAct("fq",score+"/"+list.length,r.name);
  };
  const show=()=>{
    const q=list[i];
    sub.textContent=T("Question {0} of {1}",i+1,list.length);
    body.innerHTML='<div class="qz-q"></div><div class="qz-opts"></div><div class="kid-btns" style="margin-top:12px"><button class="kid-yes" hidden></button></div>';
    body.querySelector(".qz-q").textContent=q.q;
    q.options.forEach((o,k)=>{
      const b=mkEl("button","qz-opt",o); b.type="button";
      b.onclick=()=>{
        body.querySelectorAll(".qz-opt").forEach((x,m)=>{ x.disabled=true; if(m===q.answer) x.classList.add("right"); });
        if(k===q.answer) score++; else b.classList.add("wrong");
        const nx=body.querySelector(".kid-yes"); nx.hidden=false; nx.textContent=i+1<list.length?T("Next ➡️"):T("See my score 🏁");
        nx.onclick=()=>{ i++; if(i<list.length) show(); else finish(); };
      };
      body.querySelector(".qz-opts").appendChild(b);
    });
  };
  show();
}
// Trip plans from the wishlist planner as a message to send.
function plannerText(){
  const lines=places.filter(p=>p.status==="wish" && p.plan).map(p=>"🧳 "+p.name+": "+T("best time {0}, {1} days",p.plan.season,p.plan.days)+(p.plan.combine?", "+T("combine with {0}",p.plan.combine):""));
  return T("My travel wishlist plans")+":\n"+lines.join("\n")+(pageUrl()?"\n"+T("Make your own map here: {0}",pageUrl()):"");
}

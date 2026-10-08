/* My Travel Map · games.js
   Pin-drop, guess the place, surprise me, traveller type, numbers, twin, crowns, home lines, scratch card, mystery stamp. */
// =====================================================================
//  GAMES AND FUN: pin-drop, guess the place, surprise me, traveller type,
//  travel in numbers, travel twin, kings and queens, home lines,
//  scratch-to-reveal and the weekly mystery stamp
// =====================================================================
function unproject(xp,yp){
  const lon=GEO.minLon+xp/100*(GEO.maxLon-GEO.minLon), m=mercY(GEO.maxLat)-yp/100*(mercY(GEO.maxLat)-mercY(GEO.minLat));
  return {lat:(2*Math.atan(Math.exp(m))-Math.PI/2)*180/Math.PI,lon};
}
function zoomTo(lat,lon,z){
  const w=mapWrap.clientWidth, h=mapWrap.clientHeight, q=project(lat,lon);
  Z=Math.min(Z_MAX,Math.max(1,z));
  TX=w/2-q.x/100*BASE_W*Z; TY=h/2-q.y/100*BASE_W*Z*MAP_H/MAP_W;
  applyZoom();
}
function famousPool(){ return LOCAL_PLACES.filter(x=>x.sub!=="State" && x.sub!=="Union Territory"); }
// The same "random" picks for everyone on the same day or week.
function seededPick(n,seed,pool){
  const out=[], used=new Set(); let s=seed>>>0, guard=0;
  while(out.length<Math.min(n,pool.length) && guard++<5000){ s=(Math.imul(s,1103515245)+12345)&0x7fffffff; const i=s%pool.length; if(!used.has(i)){ used.add(i); out.push(pool[i]); } }
  return out;
}
function whenClosed(card){ return new Promise(res=>{ const t=setInterval(()=>{ if(!document.body.contains(card.box)){ clearInterval(t); res(); } },200); }); }
function wrapText(x,text,cx,y,maxW,lineH){
  let line=""; String(text).split(" ").forEach(w=>{ const t=line?line+" "+w:w; if(x.measureText(t).width>maxW && line){ x.fillText(line,cx,y); y+=lineH; line=w; } else line=t; });
  if(line) x.fillText(line,cx,y);
  return y+lineH;
}
function myVisited(){ return places.filter(p=>p.status==="visited"); }
function theirVisited(r){
  return (r.prof && Array.isArray(r.prof.places)?r.prof.places:[]).filter(x=>x && typeof x.n==="string" && x.s==="visited" && inBounds(Number(x.lat),Number(x.lon))).slice(0,400)
    .map(x=>({name:x.n.slice(0,80),lat:Number(x.lat),lon:Number(x.lon),st:(isWorld() || HI_STATES[x.st])?String(x.st||"").slice(0,60):""}));
}
function samePlace(a,list){ return list.some(b=>norm(a.name)===norm(b.name) || haversine(a,b)<15); }

// ---- 1. Pin-drop challenge: tap where you think the place is ----
let pinGame=null;
function gameBar(text){
  const bar=document.getElementById("gameBar"), was=bar.hidden;
  bar.hidden=text===null;
  if(text!==null) document.getElementById("gameTxt").textContent=text;
  if(was!==bar.hidden) setTimeout(fitMap,0);
}
function startPinDrop(){
  if(replaying || pinGame) return;
  const list=seededPick(5,dayNum()*31+(isWorld()?7:3),famousPool());
  if(list.length<3) return;
  if(!isWide()) showTab("map",true);
  ghost=null; crowns=null; render();
  pinGame={list,i:0,score:0,busy:false,extra:[]};
  mapWrap.classList.add("gaming");
  Z=1; centreMap(); applyZoom();
  pinAsk();
}
function pinAsk(){
  const g=pinGame;
  g.extra.forEach(e=>e.remove()); g.extra=[]; g.busy=false;
  document.getElementById("journey").setAttribute("d","");
  const hl=mapSvg.querySelector("#homeLines"); if(hl) hl.setAttribute("d","");
  gameBar("📍 "+(g.i+1)+"/"+g.list.length+" · "+T("Where is {0}? Tap the map!",g.list[g.i].main));
}
function pinTap(e){
  const g=pinGame;
  if(!g || g.busy || e.target.closest(".zoom")) return;
  const r=mapInner.getBoundingClientRect(), xp=(e.clientX-r.left)/r.width*100, yp=(e.clientY-r.top)/r.height*100;
  if(xp<0 || xp>100 || yp<0 || yp>100) return;
  const t=g.list[g.i], km=Math.round(haversine(unproject(xp,yp),t)), pts=Math.max(0,Math.round(100-km/(isWorld()?50:8))), q=project(t.lat,t.lon);
  g.busy=true; g.score+=pts;
  const a=mkEl("div","marker gm wish"); a.style.left=xp+"%"; a.style.top=yp+"%"; a.append(mkEl("div","pin"));
  const b=mkEl("div","marker gm visited"); b.style.left=q.x+"%"; b.style.top=q.y+"%"; b.append(mkEl("div","pin"),mkEl("div","marker-label",t.main));
  document.getElementById("markers").append(a,b); g.extra=[a,b];
  document.getElementById("journey").setAttribute("d","M"+(xp*MAP_W/100).toFixed(1)+","+(yp*MAP_H/100).toFixed(1)+"L"+(q.x*MAP_W/100).toFixed(1)+","+(q.y*MAP_H/100).toFixed(1));
  gameBar((pts>=80?"🎯 ":pts>=40?"👍 ":"😅 ")+T("{0} km away · +{1} points",km.toLocaleString("en-IN"),pts));
  setTimeout(()=>{ if(pinGame!==g) return; g.i++; if(g.i<g.list.length) pinAsk(); else endPinDrop(false); },2300);
}
function endPinDrop(quit){
  const g=pinGame; if(!g) return;
  pinGame=null; g.extra.forEach(e=>e.remove());
  mapWrap.classList.remove("gaming"); gameBar(null);
  if(!quit){
    const max=g.list.length*100, rec=lsGet(mk("myPinDropV1"),{}), best=Math.max(rec.best||0,g.score);
    lsSet(mk("myPinDropV1"),{d:todayStr(),score:g.score,best});
    postGame("pin",g.score);
    if(g.score>=max*0.8) confetti();
    kidSay(T("Pin-drop score: {0} out of {1}! Your best: {2}.",g.score,max,best),"📍");
  }
  renderQueued=false; render();
}
mapWrap.addEventListener("click",pinTap);

// ---- 2. Guess the place: the photo starts blurred and slowly gets clear ----
async function startGuessPlace(){
  const card=kidCard('<div class="kid-emoji">🖼️</div><h3>'+T("Guess the place")+'</h3><div class="sub" id="gpSub">'+T("Finding photos… 🤔")+'</div><div id="gpBody"></div>');
  const sub=card.box.querySelector("#gpSub"), body=card.box.querySelector("#gpBody"), open=()=>document.body.contains(card.box);
  const rounds=[];
  for(const c of seededPick(14,dayNum()*17+(isWorld()?5:1),famousPool())){
    if(rounds.length>=5 || !open()) break;
    const url=await thumbFor(c.main);
    if(url) rounds.push({p:c,url});
  }
  if(!open()) return;
  if(rounds.length<3){ sub.textContent=T("I could not load the photos. Check your internet and try again."); return; }
  let i=0, score=0;
  const finish=()=>{
    const max=rounds.length*100, rec=lsGet(mk("myGuessV1"),{}), best=Math.max(rec.best||0,score);
    lsSet(mk("myGuessV1"),{d:todayStr(),score,best});
    postGame("guess",score);
    sub.textContent=T("You scored {0} out of {1}!",score,max);
    body.innerHTML='<div class="qz-score">'+(score>=max*0.7?"🏅":"💪")+'</div><div class="kid-btns"><button class="kid-yes">'+T("Okie dokie! 👍")+'</button></div>';
    body.querySelector("button").onclick=card.close;
    if(score>=max*0.7) confetti();
    render();
  };
  const show=()=>{
    const r=rounds[i], t0=performance.now();
    sub.textContent=T("Photo {0} of {1}",i+1,rounds.length);
    body.innerHTML='<div class="gp-pic"><img alt=""></div><div class="qz-opts"></div><div class="kid-fact" hidden></div><div class="kid-btns" style="margin-top:10px"><button class="kid-yes" hidden></button></div>';
    const im=body.querySelector("img"); im.src=r.url;
    requestAnimationFrame(()=>requestAnimationFrame(()=>im.classList.add("clear")));
    const opts=shuffle([r.p.main].concat(shuffle(famousPool().filter(x=>x.main!==r.p.main)).slice(0,3).map(x=>x.main)));
    opts.forEach(o=>{
      const b=mkEl("button","qz-opt",o); b.type="button";
      b.onclick=()=>{
        body.querySelectorAll(".qz-opt").forEach(x=>{ x.disabled=true; if(x.textContent===r.p.main) x.classList.add("right"); });
        const ok=o===r.p.main, pts=ok?Math.max(20,Math.round(100-(performance.now()-t0)/100)):0;
        if(!ok) b.classList.add("wrong");
        score+=pts; im.classList.add("clear","now");
        const f=body.querySelector(".kid-fact"); f.hidden=false; f.textContent=ok?T("✅ Correct! +{0} points",pts):T("❌ It is {0}.",r.p.main);
        const nx=body.querySelector(".kid-yes"); nx.hidden=false; nx.textContent=i+1<rounds.length?T("Next ➡️"):T("See my score 🏁");
        nx.onclick=()=>{ i++; if(i<rounds.length) show(); else finish(); };
      };
      body.querySelector(".qz-opts").appendChild(b);
    });
  };
  show();
}

// ---- 3. Surprise me: jump to a random place you have not added ----
function surpriseMe(){
  const pool=famousPool().filter(x=>!findDuplicate(x.main,x.lat,x.lon));
  if(!pool.length){ kidSay(T("Wow, you have been everywhere I know!"),"🎲"); return; }
  const x=pool[Math.floor(Math.random()*pool.length)], q=project(x.lat,x.lon);
  if(!isWide()) showTab("map",true);
  zoomTo(x.lat,x.lon,isWorld()?520/(BASE_W*40/360):2.4);
  document.querySelectorAll(".marker.dice").forEach(e=>e.remove());
  const el=mkEl("div","marker gm wish dice"); el.style.left=q.x+"%"; el.style.top=q.y+"%"; el.append(mkEl("div","pin"),mkEl("div","marker-label","🎲 "+x.main));
  document.getElementById("markers").appendChild(el);
  const card=kidCard('<div class="kid-emoji">🎲</div><h3></h3><div class="sub"></div><div class="kid-fact">'+T("Thinking… 🤔")+'</div><div class="kid-btns" style="margin-top:12px"><button class="kid-yes">'+T("⭐ Add to wishlist")+'</button><button class="kid-no">'+T("🎲 Another")+'</button></div>');
  card.box.querySelector("h3").textContent=x.main; card.box.querySelector(".sub").textContent=x.sub;
  funFact({name:x.main,lat:x.lat,lon:x.lon}).then(t=>{ if(document.body.contains(card.box)) card.box.querySelector(".kid-fact").textContent="💡 "+t; });
  card.box.querySelector(".kid-yes").onclick=()=>{
    if(!findDuplicate(x.main,x.lat,x.lon)){ const np={name:x.main,lat:x.lat,lon:x.lon,status:"wish",cat:guessCat(x.main)}; if(isWorld()) np.country=x.sub.split(", ").pop(); places.push(np); }
    card.close(); showEverything(); render(); toast("⭐ "+T("{0} is on your wishlist!",x.main));
  };
  card.box.querySelector(".kid-no").onclick=()=>{ card.close(); surpriseMe(); };
}

// ---- 4. My traveller type ----
const TYPES={
  hill:["🏔️","Mountain Soul","You are happiest where the air is cool and the roads keep climbing."],
  beach:["🏖️","Beach Lover","Sand, waves and sunsets are your idea of a perfect trip."],
  temple:["🛕","Temple Trailblazer","You follow the sound of bells and the stories of old shrines."],
  fort:["🏰","History Hunter","Forts, palaces and old walls pull you in every time."],
  wildlife:["🐯","Jungle Explorer","You would swap any hotel for a safari at sunrise."],
  city:["🏙️","City Wanderer","Busy streets, food lanes and city lights are your playground."],
  all:["🌈","All-Rounder","Mountains, beaches, temples or cities: you say yes to all of it."]};
function myType(){
  const st=getStats(); if(!st.v) return null;
  const arr=Object.keys(CATS).map(c=>[c,st.cat[c]||0]).sort((a,b)=>b[1]-a[1]);
  const key=(arr.filter(a=>a[1]>0).length>=4 && arr[0][1]/st.v<0.36)?"all":arr[0][0];
  return {key,t:TYPES[key],arr,tot:st.v};
}
function personalityCanvas(m){
  const W=1080, H=1350, c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d");
  const g=x.createLinearGradient(0,0,W,H); g.addColorStop(0,"#0b3b73"); g.addColorStop(1,"#7b5cff"); x.fillStyle=g; x.fillRect(0,0,W,H);
  x.textAlign="center"; x.textBaseline="alphabetic";
  x.fillStyle="#dbe8fb"; x.font="bold 40px Arial"; x.fillText(fitText(x,(nameInput.value.trim()?nameInput.value.trim()+" · ":"")+T("My traveller type"),W-120),W/2,120);
  x.font="230px serif"; x.fillText(m.t[0],W/2,400);
  x.fillStyle="#ffd86b"; x.font="bold 92px Arial"; x.fillText(fitText(x,T(m.t[1]),W-100),W/2,540);
  x.fillStyle="#fff"; x.font="38px Arial"; let y=wrapText(x,T(m.t[2]),W/2,620,W-200,52)+40;
  m.arr.forEach(a=>{
    const pct=Math.round(a[1]/m.tot*100);
    x.textAlign="left"; x.fillStyle="#fff"; x.font="34px Arial"; x.fillText(CATS[a[0]][0]+" "+catLabel(a[0]),120,y);
    x.fillStyle="rgba(255,255,255,.2)"; roundRect(x,480,y-28,400,30,15); x.fill();
    if(pct){ x.fillStyle="#ffd86b"; roundRect(x,480,y-28,Math.max(30,400*pct/100),30,15); x.fill(); }
    x.textAlign="right"; x.fillStyle="#fff"; x.font="bold 34px Arial"; x.fillText(pct+"%",W-100,y);
    y+=74;
  });
  x.textAlign="center"; x.fillStyle="#cfe1f7"; x.font="28px Arial"; x.fillText(fitText(x,"My Travel Map"+(pageUrl()?" · "+pageUrl().replace(/^https?:\/\//,""):""),W-100),W/2,H-56);
  return c;
}
function openPersonality(){
  const m=myType();
  if(!m){ kidSay(T("Add a few visited places and I will tell you your traveller type!"),"🧬"); return; }
  const card=kidCard('<div class="type-em">'+m.t[0]+'</div><div class="sub">'+T("My traveller type")+'</div><h3>'+T(m.t[1])+'</h3><div class="type-tag">'+T(m.t[2])+'</div><div class="cat-bars" id="tyBars"></div><div class="kid-btns" style="margin-top:14px"><button class="kid-yes">'+T("📤 Share my type")+'</button></div>');
  m.arr.forEach(a=>{
    const row=mkEl("div","cbar"), bar=mkEl("div","bar"), fill=mkEl("i"); fill.style.width=(a[1]/m.tot*100)+"%"; bar.appendChild(fill);
    row.append(mkEl("span","",CATS[a[0]][0]),mkEl("span","",catLabel(a[0])),bar,mkEl("b","",Math.round(a[1]/m.tot*100)+"%"));
    card.box.querySelector("#tyBars").appendChild(row);
  });
  card.box.querySelector(".kid-yes").onclick=async()=>{ const c=personalityCanvas(m); shareBlob(await new Promise(r=>c.toBlob(r,"image/png")),"my-traveller-type.png",T("I am a {0}! What is your traveller type?",T(m.t[1]))+(pageUrl()?" "+pageUrl():"")); };
}

// ---- 5. My travel in numbers ----
function openNumbers(){
  const st=getStats(), vis=myVisited();
  if(!vis.length){ kidSay(T("Add a few visited places and I will show your travel in numbers!"),"🔢"); return; }
  const lines=[], km=st.km.toLocaleString("en-IN");
  lines.push(isWorld()?["🌍",T("{0} km travelled: that is {1} times around the Earth",km,(st.km/40075).toFixed(2))]:["🛣️",T("{0} km travelled: like crossing India top to bottom {1} times",km,(st.km/3214).toFixed(1))]);
  lines.push(isWorld()?["🗺️",T("You have seen {0}% of the world’s countries",(st.states/195*100).toFixed(1))]:["🗺️",T("You have seen {0}% of India’s states and union territories",Math.round(st.regions.size/36*100))]);
  const n=vis.reduce((a,b)=>b.lat>a.lat?b:a), s=vis.reduce((a,b)=>b.lat<a.lat?b:a);
  if(n!==s) lines.push(["🧭",T("Furthest north: {0} · furthest south: {1}",n.name,s.name)]);
  let hop=null; for(let i=1;i<st.journey.length;i++){ const d=haversine(st.journey[i-1],st.journey[i]); if(!hop || d>hop.d) hop={d,a:st.journey[i-1],b:st.journey[i]}; }
  if(hop) lines.push(["✈️",T("Longest hop: {0} to {1}, {2} km",hop.a.name,hop.b.name,Math.round(hop.d).toLocaleString("en-IN"))]);
  const by={}; vis.forEach(p=>{ if(p.year) by[p.year]=(by[p.year]||0)+1; });
  const top=Object.keys(by).sort((a,b)=>by[b]-by[a])[0];
  if(top) lines.push(["📅",T("Busiest year: {0} with {1} places",top,by[top])]);
  const h=homeNow();
  if(h){ const far=vis.reduce((a,b)=>haversine(h,b)>haversine(h,a)?b:a); lines.push(["🏠",T("Furthest from home: {0}, {1} km away",far.name,Math.round(haversine(h,far)).toLocaleString("en-IN"))]); }
  lines.push(["❤️",T("{0} favourites and {1} places with a memory",places.filter(p=>p.fav).length,st.mem)]);
  const card=kidCard('<div class="kid-emoji">🔢</div><h3>'+T("My travel in numbers")+'</h3><div class="cmp"></div>');
  lines.forEach(l=>{ const row=mkEl("div","kid-row"); row.append(mkEl("span","em",l[0])); const d=mkEl("div"); d.append(mkEl("b","",l[1])); row.append(d); card.box.querySelector(".cmp").appendChild(row); });
}

// ---- 6. Travel twin: the friend whose map looks most like mine ----
function findTwin(){
  if(!fbUser || !lbRows) return;
  const mine=myVisited(); let best=null;
  lbRows.forEach(r=>{
    if(r.k===fbUser.uid) return;
    const theirs=theirVisited(r); if(!theirs.length) return;
    const both=mine.filter(p=>samePlace(p,theirs)).length, union=mine.length+theirs.length-both, pct=union?Math.round(both/union*100):0;
    if(!best || pct>best.pct) best={r,pct,both};
  });
  if(!best){ kidSay(T("Your friends have not added places yet. Invite them to find your travel twin!"),"👯"); return; }
  if(best.pct>=40) confetti();
  kidChoice(T("Your travel twin is {0}! Your maps are {1}% the same, with {2} places in common.",best.r.name,best.pct,best.both),"👯",[["cmp",T("Compare our maps"),"kid-yes"],["",T("Close"),"kid-plain"]])
    .then(v=>{ if(v==="cmp") compareWith(best.r); });
}

// ---- 7. Kings and queens: who in the group has the most places in each state ----
let crowns=null;
function groupRulers(){
  const count={}, add=(st,uid,name)=>{ if(!st) return; const m=count[st]=count[st]||{}; (m[uid]=m[uid]||{name,n:0}).n++; };
  myVisited().forEach(p=>add(stateOf(p),fbUser.uid,T("You")));
  lbRows.forEach(r=>{ if(r.k!==fbUser.uid) theirVisited(r).forEach(x=>add(x.st,r.k,r.name)); });
  return Object.keys(count).sort().map(st=>{
    const arr=Object.keys(count[st]).map(u=>({uid:u,name:count[st][u].name,n:count[st][u].n})).sort((a,b)=>b.n-a.n);
    return arr.length>1 && arr[0].n===arr[1].n ? {st,tie:true,n:arr[0].n,names:arr.filter(a=>a.n===arr[0].n).map(a=>a.name)} : {st,uid:arr[0].uid,name:arr[0].name,n:arr[0].n,me:arr[0].uid===fbUser.uid};
  });
}
function openRulers(){
  if(!fbUser || !lbRows) return;
  const list=groupRulers(), mine=list.filter(x=>x.me).length;
  const card=kidCard('<div class="kid-emoji">👑</div><h3>'+T("Kings and queens")+'</h3><div class="sub">'+(isWorld()?T("You rule {0} of {1} countries",mine,list.length):T("You rule {0} of {1} states",mine,list.length))+'</div><div class="cmp"></div><div class="kid-btns" style="margin-top:12px"><button class="kid-yes"></button></div>');
  list.forEach(x=>{
    const row=mkEl("div","kid-row"+(x.me?" mine":"")); row.append(mkEl("span","em",x.tie?"🤝":"👑"));
    const d=mkEl("div"); d.append(mkEl("b","",stName(x.st)),mkEl("small","",x.tie?T("Tie: {0}",x.names.join(", ")):x.name+" · "+(x.n===1?T("{0} place",1):T("{0} places",x.n)))); row.append(d);
    card.box.querySelector(".cmp").appendChild(row);
  });
  const btn=card.box.querySelector(".kid-yes");
  btn.textContent=crowns?T("🙈 Hide crowns from my map"):T("👑 Show crowns on my map");
  btn.onclick=()=>{ card.close(); if(crowns){ crowns=null; render(); return; } crowns=list; if(!isWide()) showTab("map",true); Z=1; centreMap(); render(); applyZoom(); };
}

// ---- 8. Home town: a line from home to every place ----
function homeNow(){ const h=lsGet("myHomeV1",null); return h && Number.isFinite(h.lat) && Number.isFinite(h.lon) && inBounds(h.lat,h.lon) ? h : null; }
async function setHome(){
  const inp=document.getElementById("homeInput"), name=inp.value.trim();
  if(!name){ localStorage.removeItem("myHomeV1"); render(); toast("🏠 "+T("Home town removed")); return; }
  inp.disabled=true;
  const r=await findPlace(name,false);
  inp.disabled=false;
  if(!r || !inBounds(r.lat,r.lon)){ kidSay(T("Hmm, I could not find that place! Try picking one from the suggestions."),"🔍"); return; }
  lsSet("myHomeV1",{name:String(r.name).slice(0,40),lat:r.lat,lon:r.lon});
  inp.value=r.name; render(); toast("🏠 "+T("Home set: {0}",r.name));
}
// Extra things drawn on the map after the pins: home lines and group crowns.
function drawExtras(layer){
  let hp=mapSvg.querySelector("#homeLines");
  if(!hp){
    hp=document.createElementNS("http://www.w3.org/2000/svg","path"); hp.setAttribute("id","homeLines");
    hp.setAttribute("fill","none"); hp.setAttribute("stroke","#f5a700"); hp.setAttribute("stroke-linecap","round"); hp.setAttribute("opacity",".8");
    const j=mapSvg.querySelector("#journey"); j.parentNode.insertBefore(hp,j);
  }
  hp.setAttribute("stroke-width",isWorld()?"1":"1.8");
  const h=homeNow(), X=p=>{ const q=project(p.lat,p.lon); return (q.x*MAP_W/100).toFixed(1)+","+(q.y*MAP_H/100).toFixed(1); };
  hp.setAttribute("d",h?shownPlaces().filter(p=>p.status==="visited").map(p=>"M"+X(h)+"L"+X(p)).join(""):"");
  if(h){ const q=project(h.lat,h.lon), el=mkEl("div","home-mk","🏠"); el.style.left=q.x+"%"; el.style.top=q.y+"%"; el.title=h.name; layer.appendChild(el); }
  if(crowns){
    if(!ghost) document.getElementById("ghostTxt").textContent=T("👑 Crowns show who leads each place in your group");
    crowns.forEach(x=>{
      const path=statePaths.find(e=>e.dataset.n===x.st); if(!path) return;
      let bb; try{ bb=path.getBBox(); }catch(e){ return; }
      const el=mkEl("div","crown-mk"+(x.me?" me":""),x.tie?"🤝":"👑 "+String(x.name).split(" ")[0].slice(0,10));
      el.style.left=((bb.x+bb.width/2)/MAP_W*100)+"%"; el.style.top=((bb.y+bb.height/2)/MAP_H*100)+"%";
      el.title=stName(x.st);
      layer.appendChild(el);
    });
  }
}

// ---- 9. Scratch to reveal a new state or country ----
function scratchState(name){
  return new Promise(resolve=>{
    const el=statePaths.find(e=>e.dataset.n===name);
    if(!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches){ confetti(); resolve(); return; }
    const card=kidCard('<div class="kid-emoji">🪙</div><h3></h3><div class="sub">'+T("Scratch the silver to reveal your new place!")+'</div><div class="scratch"><canvas class="sc-under" width="300" height="300"></canvas><canvas class="sc-foil" width="300" height="300"></canvas></div><div class="kid-btns" style="margin-top:10px"><button class="kid-yes" hidden>'+T("Woohoo! 🥳")+'</button></div>');
    card.box.querySelector("h3").textContent=stName(name);
    const u=card.box.querySelector(".sc-under").getContext("2d"), foil=card.box.querySelector(".sc-foil"), f=foil.getContext("2d");
    try{
      const bb=el.getBBox(), k=Math.min(250/bb.width,250/bb.height), path=new Path2D(el.getAttribute("d"));
      u.translate(150-(bb.x+bb.width/2)*k,150-(bb.y+bb.height/2)*k); u.scale(k,k);
      u.fillStyle=el.dataset.c; u.fill(path); u.lineWidth=2.5/k; u.strokeStyle="#0b3b73"; u.stroke(path);
    }catch(e){ console.warn(e); }
    const g=f.createLinearGradient(0,0,300,300); g.addColorStop(0,"#cfd5dc"); g.addColorStop(.5,"#9aa3ad"); g.addColorStop(1,"#cfd5dc");
    f.fillStyle=g; f.fillRect(0,0,300,300);
    f.fillStyle="#ffffffcc"; f.font="bold 26px Arial"; f.textAlign="center"; f.fillText("✨ "+T("Scratch here")+" ✨",150,158);
    let down=false, moves=0, done=false;
    const finish=()=>{ if(done) return; done=true; foil.style.opacity="0"; foil.style.pointerEvents="none"; confetti(); const b=card.box.querySelector(".kid-yes"); b.hidden=false; b.onclick=card.close; };
    const rub=e=>{
      if(done) return;
      const r=foil.getBoundingClientRect(), x=(e.clientX-r.left)/r.width*300, y=(e.clientY-r.top)/r.height*300;
      f.globalCompositeOperation="destination-out"; f.beginPath(); f.arc(x,y,26,0,Math.PI*2); f.fill();
      if(++moves%6===0){
        const d=f.getImageData(0,0,300,300).data; let clear=0, n=0;
        for(let i=3;i<d.length;i+=4*37){ n++; if(d[i]<40) clear++; }
        if(clear/n>0.45) finish();
      }
    };
    foil.addEventListener("pointerdown",e=>{ down=true; rub(e); });
    foil.addEventListener("pointermove",e=>{ if(down || e.pointerType==="touch") rub(e); });
    window.addEventListener("pointerup",()=>{ down=false; });
    whenClosed(card).then(resolve);
  });
}

// ---- 10. Mystery stamp of the week ----
function mysteryNow(){
  const pool=famousPool(); if(!pool.length) return null;
  const wk=Math.floor(dayNum()/7), p=seededPick(1,wk*2654435+(isWorld()?11:9),pool)[0];
  return {wk,p,have:places.some(q=>q.status==="visited" && haversine(q,p)<NEAR_KM)};
}
function mysteryAward(){
  const m=mysteryNow(); if(!m || !m.have) return;
  const won=lsGet(mk("myMysteryV1"),[]);
  if(won.includes(m.wk)) return;
  won.push(m.wk); lsSet(mk("myMysteryV1"),won);
  if(!quiet){ confetti(); badgeQueue=badgeQueue.then(()=>kidPopup(T("You won this week’s mystery stamp: {0}! +30 points",m.p.main),{emoji:"🎁",yes:T("Woohoo! 🥳"),no:null})); }
}
function mysteryCardEl(){
  const m=mysteryNow(), box=mkEl("div","mys-card"+(m && m.have?" done":""));
  if(!m){ box.hidden=true; return box; }
  const tx=mkEl("div");
  tx.append(mkEl("b","",T("Mystery stamp of the week")),
    mkEl("small","",m.have?T("You have it: {0}! +30 points",m.p.main):T("Clue: it is in {0}. Been there? Add it to win a rare stamp.",stName(m.p.sub.split(", ").pop()))),
    mkEl("small","",T("Rare stamps won: {0}",lsGet(mk("myMysteryV1"),[]).length)));
  box.append(mkEl("span","ic",m.have?"🎁":"❓"),tx);
  return box;
}
document.getElementById("homeInput").value=(lsGet("myHomeV1",null)||{}).name||"";

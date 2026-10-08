/* My Travel Map · place-card-picture.js
   The place card, fun facts, "where next" and the shareable map picture. */
// ---- Playful card (bigger popup with a form inside) ----
function kidCard(html){
  const ov=document.createElement("div");
  ov.className="kid-overlay";
  ov.innerHTML='<div class="kid-box kid-card" role="dialog" aria-modal="true"><button class="kid-x" aria-label="Close">✕</button>'+html+'</div>';
  const close=()=>ov.remove();
  ov.querySelector(".kid-x").onclick=close;
  ov.addEventListener("mousedown",e=>{ if(e.target===ov) close(); });
  document.body.appendChild(ov);
  return {box:ov.firstChild,close};
}

// Shrinks the user's own photo so it fits in browser storage.
function readPhoto(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file), im=new Image();
    im.onload=()=>{
      const S=240, c=document.createElement("canvas"); c.width=c.height=S;
      const k=Math.max(S/im.naturalWidth,S/im.naturalHeight), w=im.naturalWidth*k, h=im.naturalHeight*k;
      c.getContext("2d").drawImage(im,(S-w)/2,(S-h)/2,w,h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg",0.82));
    };
    im.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("bad image"));};
    im.src=url;
  });
}

// Tap a pin (or a row in the list): trip details, stars, favourite, own photo and a fun fact.
function openPlaceCard(p){
  if(p._in){                                         // linked from the India map: change it there
    kidChoice(T("{0} comes from your India map. Open the India map to change it.",p.name),"🇮🇳",[["go",T("Open India map 🇮🇳"),"kid-yes"],["",T("Close"),"kid-plain"]]).then(v=>{ if(v==="go") setMode("india"); });
    return;
  }
  const draft={status:p.status,cat:catOf(p),photo:p.photo||"",rating:p.rating||0,fav:!!p.fav};
  const thisYear=new Date().getFullYear();
  const card=kidCard(
    '<div class="kid-photo"><span id="pcIcon"></span><img id="pcImg" alt=""></div>'
    +'<h3></h3><div class="sub"></div>'
    +'<div class="seg" id="pcStatus"><button type="button" data-v="visited">'+T("✅ Visited")+'</button><button type="button" data-v="wish">'+T("⭐ Wishlist")+'</button></div>'
    +'<select id="pcCat" aria-label="Category">'+Object.keys(CATS).map(c=>'<option value="'+c+'">'+CATS[c][0]+' '+catLabel(c)+'</option>').join("")+'</select>'
    +'<div class="rate-row" role="group" aria-label="'+T("My stars")+'"><span id="pcStars">'+[1,2,3,4,5].map(n=>'<button type="button" class="star" data-n="'+n+'" aria-label="'+n+' ★">★</button>').join("")+'</span><button type="button" class="fav-btn" id="pcFav" aria-label="'+T("❤️ Favourites")+'"></button></div>'
    +'<label for="pcYear">'+T("Year I visited")+'</label><input id="pcYear" type="number" inputmode="numeric" min="1950" max="'+thisYear+'" placeholder="'+T("e.g. {0}",thisYear)+'">'
    +'<label for="pcDate">'+T("Exact date (optional)")+'</label><input id="pcDate" type="date" min="1950-01-01" max="'+todayStr()+'">'
    +'<label for="pcNote">'+T("My memory")+'</label><textarea id="pcNote" maxlength="140" placeholder="'+T("What was the best part?")+'"></textarea>'
    +'<div><button type="button" class="kid-mini" id="pcPick">'+T("📷 Use my own photo")+'</button><button type="button" class="kid-mini" id="pcUnpick">'+T("↩ Use web photo")+'</button><input id="pcFile" type="file" accept="image/*" hidden></div>'
    +'<div><button type="button" class="kid-mini" id="pcFactBtn">'+T("✨ Tell me a fun fact!")+'</button><button type="button" class="kid-mini" id="pcNearBtn">'+T("🧭 Add nearby places I visited")+'</button></div>'
    +'<div class="kid-fact" id="pcFact" hidden></div>'
    +'<div class="kid-btns" style="margin-top:14px"><button class="kid-yes" id="pcSave">'+T("Save 💾")+'</button><button class="kid-no" id="pcDel">'+T("Remove 🗑️")+'</button></div>');
  const $=id=>card.box.querySelector("#"+id);
  card.box.querySelector("h3").textContent=p.name;
  card.box.querySelector(".sub").textContent=stName(stateOf(p)) || (isWorld()?"🌍":T("India"));
  $("pcYear").value=p.year||""; $("pcDate").value=p.date||""; $("pcNote").value=p.note||""; $("pcCat").value=draft.cat;

  const paint=()=>{
    card.box.querySelectorAll("#pcStatus button").forEach(b=>b.classList.toggle("on",b.dataset.v===draft.status));
    card.box.querySelectorAll("#pcStars .star").forEach(b=>b.classList.toggle("on",Number(b.dataset.n)<=draft.rating));
    $("pcFav").textContent=draft.fav?"❤️":"🤍"; $("pcFav").classList.toggle("on",draft.fav);
    $("pcFav").setAttribute("aria-pressed",draft.fav?"true":"false");
    $("pcIcon").textContent=CATS[draft.cat][0];
    const src=draft.photo || p.img || "", im=$("pcImg");
    im.hidden=!src; if(src) im.src=src;
    $("pcUnpick").hidden=!draft.photo;
  };
  $("pcImg").onerror=function(){this.hidden=true;};
  card.box.querySelectorAll("#pcStatus button").forEach(b=>b.onclick=()=>{draft.status=b.dataset.v;paint();});
  card.box.querySelectorAll("#pcStars .star").forEach(b=>b.onclick=()=>{ const n=Number(b.dataset.n); draft.rating=(draft.rating===n?0:n); paint(); });   // tap the same star again to clear
  $("pcFav").onclick=()=>{draft.fav=!draft.fav;paint();};
  $("pcCat").onchange=()=>{draft.cat=$("pcCat").value;paint();};
  $("pcPick").onclick=()=>$("pcFile").click();
  $("pcUnpick").onclick=()=>{draft.photo="";paint();};
  $("pcFile").onchange=async()=>{
    const f=$("pcFile").files[0]; if(!f) return;
    try{ draft.photo=await readPhoto(f); paint(); }
    catch(e){ kidSay(T("Hmm, I could not open that photo. Try another one!"),"🖼️"); }
  };
  $("pcNearBtn").onclick=()=>{ card.close(); nearbyCard(p,true); };
  $("pcFactBtn").onclick=async()=>{
    const out=$("pcFact"), btn=$("pcFactBtn");
    out.hidden=false; out.textContent=T("Thinking… 🤔"); btn.disabled=true;
    out.textContent="💡 "+await funFact(p);
    btn.disabled=false; btn.textContent=T("✨ Another fact!");
  };
  $("pcSave").onclick=()=>{
    const y=parseInt($("pcYear").value,10);
    if($("pcYear").value && !(y>=1950 && y<=thisYear)){ kidSay(T("That year looks funny! Pick a year from 1950 to {0}.",thisYear),"📅"); return; }
    p.status=draft.status; p.cat=draft.cat;
    if(y) p.year=y; else delete p.year;
    const dt=$("pcDate").value;
    if(/^\d{4}-\d\d-\d\d$/.test(dt) && dt>="1950-01-01" && dt<=todayStr()){ p.date=dt; p.year=Number(dt.slice(0,4)); } else delete p.date;
    const note=$("pcNote").value.trim(); if(note) p.note=note; else delete p.note;
    if(draft.photo) p.photo=draft.photo; else delete p.photo;
    if(draft.rating) p.rating=draft.rating; else delete p.rating;
    if(draft.fav) p.fav=true; else delete p.fav;
    card.close(); render();
  };
  $("pcDel").onclick=async()=>{ if(await removePlace(p)) card.close(); };
  paint();
}

// A short fun fact: from Groq when the key is set, otherwise from Wikipedia.
const factsSeen=new Map();
async function funFact(p){
  const seen=factsSeen.get(p)||[];
  if(groqReady()){
    try{
      const out=await groqChat([
        {role:"system",content:"You tell short, true, kid-friendly travel facts about places in India. Return only valid JSON."},
        {role:"user",content:`Give ONE surprising, true fun fact about ${p.name}${stateOf(p)?", "+stateOf(p):""}, India, in at most 35 simple words.${aiLang()}${seen.length?" Do not repeat these: "+seen.join(" | "):""}

Return ONLY JSON: {"fact":"..."}`}
      ],200);
      if(out.fact){ seen.push(String(out.fact)); factsSeen.set(p,seen); return String(out.fact); }
    }catch(e){ console.warn("Groq fun fact failed; using Wikipedia.",e); }
  }
  try{
    const url="https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&exintro=1&explaintext=1&exsentences=2&generator=search&gsrlimit=1&gsrsearch="+encodeURIComponent(p.name+(isWorld()?"":" India"));
    const d=await (await fetch(url)).json();
    const page=Object.values(d.query?.pages||{})[0];
    if(page && page.extract) return page.extract.trim();
  }catch(e){ console.warn("Wikipedia fact failed.",e); }
  return T("I could not find a fact right now. Check your internet and try again!");
}

// "Where should I go next?" — Groq picks from what you have visited; a built-in picker is the backup.
async function whereNext(){
  const card=kidCard('<div class="kid-emoji">🧭</div><h3>'+T("Where next?")+'</h3><div class="sub" id="wnSub">'+T("Thinking… 🤔")+'</div><div id="wnList"></div>');
  const st=getStats(), have=places.map(p=>p.name);
  let picks=[], byAI=false;
  if(groqReady()){
    try{
      const out=await groqChat([
        {role:"system",content:"You are a fun India travel buddy. Return only valid JSON."},
        {role:"user",content:`I have visited these places in India: ${places.filter(p=>p.status==="visited").map(p=>p.name).join(", ")||"none yet"}.
My wishlist: ${places.filter(p=>p.status==="wish").map(p=>p.name).join(", ")||"empty"}.

Suggest 3 NEW places in India I should visit next (not in either list). Prefer states I have not visited and match the kind of places I seem to like.${aiLang()}

Return ONLY JSON:
{"suggestions":[{"name":"place","state":"state","lat":0.0000,"lon":0.0000,"category":"temple|beach|hill|fort|wildlife|city","why":"one short playful reason, max 15 words"}]}`}
      ],500);
      picks=(Array.isArray(out.suggestions)?out.suggestions:[]).map(x=>({main:String(x.name||"").trim(),sub:String(x.state||"").trim(),lat:Number(x.lat),lon:Number(x.lon),cat:String(x.category||""),why:String(x.why||"")}))
        .filter(x=>x.main && inBounds(x.lat,x.lon) && !findDuplicate(x.main,x.lat,x.lon)).slice(0,3);
      byAI=picks.length>0;
    }catch(e){ console.warn("Groq ideas failed; using built-in ideas.",e); }
  }
  if(!picks.length){
    const pool=LOCAL_PLACES.filter(x=>x.sub!=="State" && x.sub!=="Union Territory" && !findDuplicate(x.main,x.lat,x.lon));
    const score=x=>(st.regions.has(x.sub.split(", ").pop())?0:2)+Math.random();
    picks=pool.map(x=>({x,s:score(x)})).sort((a,b)=>b.s-a.s).slice(0,3).map(o=>{
      const cat=guessCat(o.x.main), fresh=!st.regions.has(o.x.sub.split(", ").pop());
      return Object.assign({},o.x,{cat,why:(fresh?(isWorld()?T("A brand new country to colour in!"):T("A brand new state to colour in!"))+" ":"")+T("Famous spot: {0}.",catLabel(cat))});
    });
  }
  if(!document.body.contains(card.box)) return;
  card.box.querySelector("#wnSub").textContent=picks.length ? (byAI?T("Picked for you by Groq AI"):T("Here are some ideas!")) : T("Wow, you have been everywhere I know!");
  const list=card.box.querySelector("#wnList");
  picks.forEach(x=>{
    const cat=CATS[x.cat]?x.cat:guessCat(x.main);
    const row=document.createElement("div");
    row.className="kid-row";
    row.innerHTML='<span class="em">'+CATS[cat][0]+'</span><div><b></b><small class="st"></small><small class="why"></small></div><button class="kid-mini">'+T("⭐ Add")+'</button>';
    row.querySelector("b").textContent=x.main;
    row.querySelector(".st").textContent=x.sub;
    row.querySelector(".why").textContent=x.why;
    row.querySelector("button").onclick=function(){
      if(findDuplicate(x.main,x.lat,x.lon)) return;
      places.push({name:x.main,lat:x.lat,lon:x.lon,status:"wish",cat});
      if(fStatus==="visited") fStatus="all"; fCat="all"; fYear="all"; fFav=false;
      this.textContent=T("Added ✓"); this.disabled=true;
      render();
    };
    list.appendChild(row);
  });
}

const canvasImages=new Map();           // photos already loaded for the picture, so they are fetched only once
function loadCanvasImage(src){
  if(canvasImages.has(src)) return canvasImages.get(src);
  const job=new Promise(resolve=>{
    const im=new Image();
    im.crossOrigin="anonymous";
    const t=setTimeout(()=>{ canvasImages.delete(src); resolve(null); },2500);     // slow photo: leave it out, try again next time
    im.onload=()=>{clearTimeout(t);resolve(im);};
    im.onerror=()=>{clearTimeout(t);resolve(null);};
    im.src=src;
  });
  canvasImages.set(src,job);
  return job;
}

// The map (with coloured states, journey line and title) as an image for the picture.
function svgImage(forceLine){
  return new Promise((resolve,reject)=>{
    const clone=mapSvg.cloneNode(true);
    if(forceLine){ const trip=journeyPlaces(yearScope()); if(trip.length>1) clone.querySelector("#journey").setAttribute("d",linePath(trip)); }   // journey line even when it is switched off on screen
    clone.setAttribute("width",MAP_W); clone.setAttribute("height",MAP_H);
    const im=new Image();
    im.onload=()=>resolve(im);
    im.onerror=()=>reject(new Error("Map picture could not be made."));
    im.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(new XMLSerializer().serializeToString(clone));
  });
}
function fitText(ctx,text,maxW){
  if(ctx.measureText(text).width<=maxW) return text;
  let t=text;
  while(t.length>1 && ctx.measureText(t+"…").width>maxW) t=t.slice(0,-1);
  return t+"…";
}

async function buildCanvas(mapOnly,forceLine){
  let shown=shownPlaces();
  const st=getStats(yearScope()), linked=isWorld()?shown.filter(p=>p._in):[];
  if(linked.length>3) shown=shown.filter(p=>!p._in).concat([{name:"🇮🇳 "+T("India · {0} places",linked.length),lat:INDIA_MID.lat,lon:INDIA_MID.lon,status:"visited",cat:"city"}]);
  const w=MAP_W, h=MAP_H, PW=(shown.length && !mapOnly)?440:0;        // PW = places-list panel on the right
  const canvas=document.createElement("canvas"); canvas.width=w+PW; canvas.height=h;
  const ctx=canvas.getContext("2d");
  ctx.drawImage(await svgImage(forceLine),0,0,w,h);

  const COL={visited:"#1faa59",wish:"#f5b301"};
  const photos=await Promise.all(shown.map(p=>photoOf(p)?loadCanvasImage(photoOf(p)):null));

  shown.forEach((p,i)=>{
    const q=project(p.lat,p.lon), x=q.x*w/100, y=q.y*h/100, col=COL[p.status];
    // round photo icon
    const cx=x-36, cy=y-24, R=25, ph=photos[i];
    ctx.save();
    ctx.shadowColor="rgba(0,0,0,.35)"; ctx.shadowBlur=6; ctx.shadowOffsetY=2;
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(cx,cy,R+3,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
    if(ph){
      const s=Math.max(2*R/ph.naturalWidth,2*R/ph.naturalHeight), dw=ph.naturalWidth*s, dh=ph.naturalHeight*s;
      ctx.drawImage(ph,cx-dw/2,cy-dh/2,dw,dh);
    }else{
      const g=ctx.createLinearGradient(cx-R,cy-R,cx+R,cy+R); g.addColorStop(0,"#ffd86b"); g.addColorStop(1,"#ff8a5c");
      ctx.fillStyle=g; ctx.fillRect(cx-R,cy-R,2*R,2*R);
      ctx.font="26px serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle="#fff"; ctx.fillText(catIcon(p),cx,cy+2);
    }
    ctx.restore();
    if(ph){   // small category icon on the photo
      ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(cx-R+4,cy+R-6,11,0,Math.PI*2); ctx.fill();
      ctx.font="13px serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle="#000"; ctx.fillText(catIcon(p),cx-R+4,cy+R-5);
    }
    // pin: green = visited, yellow = wishlist
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(x,y,14,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
    // label
    ctx.textAlign="left"; ctx.textBaseline="alphabetic";
    ctx.font="bold 18px Arial";
    const text=p.name+(p.year?" "+p.year:"")+(p.rating?" ★"+p.rating:"");
    const tw=ctx.measureText(text).width;
    const bx=x+17, by=y-29;
    ctx.fillStyle="rgba(255,255,255,.96)"; roundRect(ctx,bx,by,tw+18,27,7); ctx.fill();
    ctx.strokeStyle=col; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle="#172033"; ctx.fillText(text,bx+9,by+19);
  });

  if(PW){
    const X=w, name=(document.getElementById("travellerName").value||"").trim();
    ctx.fillStyle="#ffffff"; ctx.fillRect(X,0,PW,h);
    ctx.fillStyle="#0b3b73"; ctx.fillRect(X,0,PW,118);
    ctx.textAlign="left"; ctx.textBaseline="alphabetic";
    ctx.fillStyle="#fff"; ctx.font="bold 32px Arial"; ctx.fillText(T("📍 Places List"),X+24,58);
    ctx.font="18px Arial"; ctx.fillStyle="#cfe1f7";
    ctx.fillText(fitText(ctx,(name?name+" · ":"")+(fYear!=="all"?fYear+" · ":"")+(shown.length===1?T("{0} place",1):T("{0} places",shown.length)),PW-48),X+24,92);
    // legend
    ctx.font="bold 15px Arial";
    ctx.fillStyle=COL.visited; ctx.beginPath(); ctx.arc(X+32,146,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#475467"; ctx.fillText(T("Visited"),X+46,151);
    const lx=X+46+ctx.measureText(T("Visited")).width+28;
    ctx.fillStyle=COL.wish; ctx.beginPath(); ctx.arc(lx,146,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#475467"; ctx.fillText(T("Wishlist"),lx+14,151);
    // top 5: the places with the most stars
    let top=176;
    const best=isWorld() && shown.length>10 ? [] : topFive(yearScope());
    if(best.length){
      const bh=48+best.length*30;
      ctx.fillStyle="#fff8e1"; roundRect(ctx,X+14,top-6,PW-28,bh,12); ctx.fill();
      ctx.strokeStyle="#ffcf5c"; ctx.lineWidth=2; ctx.stroke();
      ctx.font="bold 20px Arial"; ctx.fillStyle="#6a4a00"; ctx.fillText(T("⭐ My Top {0}",best.length),X+28,top+22);
      best.forEach((p,i)=>{
        const y0=top+54+i*30, stars="★".repeat(p.rating||0)+(p.fav?" ❤️":"");
        ctx.font="bold 17px Arial";
        ctx.textAlign="right"; ctx.fillStyle="#e69500"; ctx.fillText(stars,X+PW-28,y0);
        const sw=ctx.measureText(stars).width;
        ctx.textAlign="left"; ctx.fillStyle="#172033";
        ctx.fillText(fitText(ctx,(i+1)+". "+catIcon(p)+" "+p.name,PW-68-sw),X+28,y0);
      });
      top+=bh+14;
    }
    // numbered list (one column, or two when it is long)
    const bottom=h-190, n=shown.length;
    const cols=isWorld()?Math.min(3,Math.max(1,Math.ceil(n/Math.max(1,Math.floor((bottom-top)/16))))):(n>(best.length?30:38)?2:1), perCol=Math.ceil(n/cols);
    const rowH=Math.max(13,Math.min(30,(bottom-top)/perCol)), fs=Math.max(10,Math.min(19,rowH-7));
    const colW=(PW-40)/cols;
    shown.forEach((p,i)=>{
      const c=Math.floor(i/perCol), r=i%perCol, x0=X+24+c*colW, y0=top+r*rowH+rowH*0.72;
      ctx.fillStyle=COL[p.status]; ctx.beginPath(); ctx.arc(x0+5,y0-fs*0.33,Math.min(5,fs*0.3),0,Math.PI*2); ctx.fill();
      ctx.font=fs+"px Arial"; ctx.fillStyle="#172033";
      ctx.fillText(fitText(ctx,(i+1)+". "+catIcon(p)+" "+p.name+(p.year?" ("+p.year+")":""),colW-26),x0+16,y0);
    });
    // progress
    ctx.strokeStyle="#e3e9f1"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(X+24,h-172); ctx.lineTo(X+PW-24,h-172); ctx.stroke();
    ctx.font="bold 19px Arial"; ctx.fillStyle="#0b3b73";
    ctx.fillText("🗺️ "+regionLine(st),X+24,h-136);
    ctx.fillText("🛣️ "+T("{0} km travelled",st.km.toLocaleString("en-IN")),X+24,h-104);
    const allSt=getStats(), got=BADGES.filter(b=>b.t(allSt));
    if(got.length){
      ctx.font="16px Arial"; ctx.fillStyle="#475467"; ctx.fillText(T("Badges"),X+24,h-68);
      ctx.font="26px serif"; ctx.fillStyle="#000";
      ctx.fillText(got.map(b=>b.e).join(" "),X+24,h-30,PW-48);
    }
  }
  return canvas;
}

const PNG_NAME="my-visiting-places-india.png";
function saveBlob(blob,fileName){
  const a=document.createElement("a"); a.download=fileName||PNG_NAME; a.href=URL.createObjectURL(blob);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
async function mapBlob(){
  const canvas=await buildCanvas();
  return new Promise(res=>canvas.toBlob(res,"image/png"));
}
async function downloadPNG(){
  saveBlob(await mapBlob());
}

// Keep a ready-made picture so the share buttons can act instantly on click.
let mapBlobCache=null, mapBlobTimer=null, shareReady=null;      // shareReady = the journey picture, made in the background after every change
function makeSharePicture(){ return buildCanvas(false,true).then(c=>new Promise(res=>c.toBlob(res,"image/jpeg",0.92))); }
function scheduleMapBlob(){
  mapBlobCache=null; shareReady=null;
  clearTimeout(mapBlobTimer);
  mapBlobTimer=setTimeout(()=>{ const job=makeSharePicture(); job.catch(e=>console.warn(e)); shareReady=job; },500);
}

// Share only to WhatsApp or Instagram: one click saves the picture and opens the app.
async function shareMap(app){
  const isWA=app==="whatsapp", label=isWA?"WhatsApp":"Instagram";
  const ua=navigator.userAgent, android=/Android/i.test(ua), mobile=android||/iPhone|iPad|iPod/i.test(ua);
  const text=encodeURIComponent(isWorld()?T("My world travel map 🌍 — {0} places!",places.length):T("My Visiting Places in India 🇮🇳 — {0} places!",places.length));
  const webUrl=isWA ? (mobile?"https://wa.me/?text="+text:"https://web.whatsapp.com/send?text="+text) : "https://www.instagram.com/";
  const appUrl=isWA ? "whatsapp://send?text="+text
                    : (android ? "intent://instagram.com/#Intent;package=com.instagram.android;scheme=https;end" : "instagram://app");

  // Computers: open the app's page right away (must happen inside the click).
  const tab=mobile ? null : window.open(webUrl,"_blank");

  const blob=mapBlobCache || await mapBlob();
  saveBlob(blob);                                   // picture goes to Downloads / Gallery
  let copied=false;
  if(isWA && navigator.clipboard && window.ClipboardItem){
    try{
      copied=await Promise.race([
        navigator.clipboard.write([new ClipboardItem({"image/png":blob})]).then(()=>true),
        new Promise(res=>setTimeout(()=>res(false),700))
      ]);
    }catch(e){}
  }

  if(mobile){
    setTimeout(()=>{
      location.href=appUrl;                         // opens the installed app directly
      setTimeout(()=>{ if(!document.hidden) location.href=webUrl; },2000);   // app not installed
    },350);
  }else if(!tab){
    location.href=webUrl;
  }
  kidSay(copied?T("Your map picture is saved and copied! Paste or attach it in {0}.",label):T("Your map picture is saved! Attach it in {0}.",label),"🎉");
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}

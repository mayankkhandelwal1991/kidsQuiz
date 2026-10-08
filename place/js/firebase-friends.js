/* My Travel Map · firebase-friends.js
   Google sign-in, cloud save, friends groups, compare and leaderboards. */
// =====================================================================
//  GOOGLE SIGN-IN + LEADERBOARD (Firebase Realtime Database)
//  Data lives at: leaderboards/travel/india-<criterion>/<user id> = {name, score}
// =====================================================================
const BOARDS=[["xp","⭐","Points"],["places","📍","Places"],["states","🗺️","States"],["km","🛣️","Km"],["badges","🏅","Badges"]];
let fbUser=null, fbAuth=null, fbDb=null, lbCrit="xp", lbRows=null, submitTimer=null;

function loadScript(src){
  return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=()=>rej(new Error("Could not load "+src)); document.head.appendChild(s); });
}
// Resolves to true when Firebase is ready, false when it could not be loaded (no internet).
async function loadFirebase(){
  try{
    for(const part of ["app","auth","database"]) await loadScript("https://www.gstatic.com/firebasejs/"+FB_VER+"/firebase-"+part+"-compat.js");
    firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth=firebase.auth(); fbDb=firebase.database();
    fbAuth.onAuthStateChanged(u=>{ fbUser=u||null; onAuthChange(); });
    return true;
  }catch(e){ console.warn("Firebase is not available; leaderboard and sign-in are off.",e); return false; }
}
// Firebase is started only after every script file of the app has loaded.
const fbReady=new Promise(res=>{ const go=()=>res(loadFirebase()); if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",go); else go(); });

function welcome(show){ document.getElementById("welcome").hidden=!show; }
function onAuthChange(){
  if(fbUser){
    localStorage.setItem("myIndiaAuthV2","user");
    welcome(false);
    if(!nameInput.value.trim() && fbUser.displayName){          // first sign-in: use the Google first name on the picture
      nameInput.value=fbUser.displayName.split(" ")[0].slice(0,24);
      localStorage.setItem("myIndiaNameV2",nameInput.value);
      render();
    }
    scheduleSubmit(); cloudStart(); joinFromLink(); setTimeout(checkFeed,5000);
    tourTries=0; setTimeout(maybeTour,1800);
  }else{                                                        // signed out: back to the sign-in screen
    localStorage.removeItem("myIndiaAuthV2");
    welcome(true);
  }
  renderAcct(); renderCloudNote();
  if(curTab==="board") loadBoard();
}
// Browsers built into other apps (WhatsApp, Instagram, Facebook…) cannot do Google sign-in.
function inAppBrowser(){ return /WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|Twitter|LinkedInApp|MicroMessenger|; wv\)/i.test(navigator.userAgent); }
function siteLink(){ return SITE_URL || location.href.split("#")[0]; }
function openOutside(){
  const url=siteLink(), ua=navigator.userAgent;
  if(/iPhone|iPad|iPod/i.test(ua)) location.href="x-safari-"+url;                                   // asks iOS to open Safari
  else if(/Android/i.test(ua)) location.href="intent://"+url.replace(/^https?:\/\//,"")+"#Intent;scheme=https;package=com.android.chrome;end";
  else window.open(url,"_blank");
}
function browserHelp(){
  const card=kidCard('<div class="kid-emoji">🌐</div><h3>'+T("Open in your browser")+'</h3><div class="type-tag">'+T("Google sign-in does not work inside the small browser of WhatsApp, Instagram and similar apps. Open this page in Safari or Chrome and sign in there.")+'</div>'
    +'<div class="kid-fact">'+T("How: tap the ⋯ or share button on this screen and choose “Open in Safari” or “Open in Chrome”.")+'</div>'
    +'<div class="kid-btns" style="margin-top:14px"><button class="kid-yes">'+T("Open in browser 🌐")+'</button><button class="kid-no">'+T("Copy the link 🔗")+'</button></div>');
  card.box.querySelector(".kid-yes").onclick=openOutside;
  card.box.querySelector(".kid-no").onclick=async()=>{
    let ok=false; try{ await navigator.clipboard.writeText(siteLink()); ok=true; }catch(e){}
    card.box.querySelector(".kid-fact").textContent=ok?T("Link copied! Now open Safari or Chrome and paste it in the address bar."):siteLink();
  };
}
async function googleSignIn(){
  if(!fbAuth && !(await fbReady)){ kidSay(T("I could not reach Google. Check your internet and try again."),"📡"); return; }   // when ready, the popup opens straight from the tap
  const provider=new firebase.auth.GoogleAuthProvider();
  try{ await fbAuth.signInWithPopup(provider); }
  catch(e){
    const code=e.code||"";
    if(code==="auth/popup-closed-by-user" || code==="auth/cancelled-popup-request"){ if(inAppBrowser()) browserHelp(); return; }
    console.warn("Google sign-in failed.",e);
    // No redirect fallback: on this site it ends on a "missing initial state" error page.
    if(location.protocol!=="file:" && (code==="auth/popup-blocked" || code==="auth/operation-not-supported-in-this-environment" || code==="auth/web-storage-unsupported" || inAppBrowser())){ browserHelp(); return; }
    kidSay(code==="auth/operation-not-supported-in-this-environment" ? T("Google sign-in works only when this page is opened from a website (https), not from a saved file.")
      : code==="auth/unauthorized-domain" ? T("This website address is not allowed for Google sign-in yet. Add it in Firebase → Authentication → Settings → Authorized domains.")
      : T("Google sign-in did not work: {0}",code||e.message),"🔐");
  }
}
async function acctTap(){
  if(!fbUser){ googleSignIn(); return; }
  const pick=await kidChoice(T("Signed in as {0}",fbUser.displayName||fbUser.email||T("Traveller")),"👤",[["out",T("Sign out"),"kid-no"],["",T("Close"),"kid-plain"]]);
  if(pick==="out"){ try{ await fbAuth.signOut(); }catch(e){ console.warn(e); } }
}
// Photos come from the shared database, so only real Google profile pictures are shown.
function safePhoto(u){ return typeof u==="string" && /^https:\/\/[a-z0-9-]+\.googleusercontent\.com\/[^\s"'<>]*$/i.test(u) ? u : ""; }
function renderAcct(){
  const img=document.getElementById("acctImg"), txt=document.getElementById("acctTxt");
  const ph=fbUser?safePhoto(fbUser.photoURL):"";
  img.hidden=!ph; if(ph) img.src=ph;
  txt.textContent=fbUser ? (fbUser.displayName||T("Traveller")).split(" ")[0] : T("Sign in");
  renderLbMe();
}

function myName(){ return (nameInput.value.trim() || (fbUser && fbUser.displayName) || "Traveller").slice(0,40); }
function myScores(){
  const es=engageState(), st=es.st;
  return {places:st.v, states:st.states+st.uts, km:st.km, badges:es.badges, xp:es.xp};
}
function boardRef(id){ return fbDb.ref("leaderboards/travel/"+MODE+"-"+id); }
function uroot(){ return fbDb.ref("travel/users/"+fbUser.uid); }
function uref(){ return isWorld()?uroot().child("world"):uroot(); }        // the world map is saved beside the India map
function pref(uid){ return fbDb.ref("travel/public/"+uid+"/"+MODE); }
function gref(code){ return fbDb.ref("travel/groups/"+code); }
function scheduleSubmit(){
  clearTimeout(submitTimer);
  if(fbUser) submitTimer=setTimeout(submitScores,1500);
}
// Sends my numbers to the leaderboard, only when something has changed.
async function submitScores(){
  if(!fbUser || !fbDb) return;
  const sc=myScores(), key=mk("myIndiaLbV2")+"_"+fbUser.uid, last=localStorage.getItem(key);
  if(!sc.places && !last) return;                               // nothing to show yet
  const name=myName(), lvl=engageState().lvl, sig=JSON.stringify([sc,name,lastSlim]);
  if(sig===last) return;
  try{
    await Promise.all(BOARDS.map(b=>boardRef(b[0]).child(fbUser.uid).set({name,score:sc[b[0]],lvl,photo:safePhoto(fbUser.photoURL),ts:firebase.database.ServerValue.TIMESTAMP})));
    localStorage.setItem(key,sig);
    publishPublic().catch(cloudFail);
    if(curTab==="board") loadBoard();
  }catch(e){ console.warn("Leaderboard update failed.",e); }
}

// ---- cloud save: the map is stored against the Google account ----
let cloudOk=null, syncReady=false, pushTimer=null;      // cloudOk: null = not known yet, false = database rules do not allow it
function cloudFail(e){
  console.warn("Cloud problem.",e);
  if(/permission/i.test(String((e && (e.code||e.message))||""))) cloudOk=false;
  renderCloudNote();
}
function syncKey(){ return mk("myIndiaSyncV2")+"_"+fbUser.uid; }
function markDirty(){
  if(!fbUser) return;
  const s=lsGet(syncKey(),{}); s.dirty=true; lsSet(syncKey(),s);
  clearTimeout(pushTimer); pushTimer=setTimeout(cloudPush,3000);
  renderCloudNote();
}
function photoSig(){ return ownPlaces().map((p,i)=>p.photo?i+":"+p.photo.length:"").join(","); }
async function cloudPush(){
  if(!fbUser || !fbDb || cloudOk===false || !syncReady) return;
  const s=lsGet(syncKey(),{}), t=Date.now(), sig=photoSig();
  const mine=ownPlaces(), data=JSON.parse(JSON.stringify(mine.map(p=>{ const o=Object.assign({},p); delete o.photo; delete o.state; return o; })));
  const up={data,meta:{updated:t,count:mine.length,name:nameInput.value.trim().slice(0,24)}};
  if(sig!==s.psig){ up.photos={}; mine.forEach((p,i)=>{ if(p.photo) up.photos["p"+i]=p.photo; }); }   // photos only when they changed
  try{ await uref().update(up); cloudOk=true; lsSet(syncKey(),{t,dirty:false,psig:sig}); }
  catch(e){ cloudFail(e); }
  renderCloudNote();
}
async function cloudPull(meta){
  const v=(await uref().once("value")).val()||{}, ph=v.photos||{};
  const raw=Array.isArray(v.data)?v.data:Object.keys(v.data||{}).map(k=>v.data[k]);
  places=raw.map((x,i)=>x?cleanPlace(Object.assign({},x,{photo:ph["p"+i]})):null).filter(Boolean);
  linkIndia();
  if(v.meta && typeof v.meta.name==="string" && v.meta.name && !nameInput.value.trim()){ nameInput.value=v.meta.name.slice(0,24); localStorage.setItem("myIndiaNameV2",nameInput.value); }
  showEverything(); earnedBadges=null; quietCelebrate();
  lastSlim=slimSig();
  lsSet(syncKey(),{t:meta.updated,dirty:false,psig:photoSig()});
  render();
}
async function cloudStart(){
  syncReady=false;
  if(!fbUser || !fbDb) return;
  try{
    const meta=(await uref().child("meta").once("value")).val();
    cloudOk=true;
    const s=lsGet(syncKey(),{});
    if(!meta){ syncReady=true; if(ownPlaces().length) await cloudPush(); }
    else if(!ownPlaces().length) await cloudPull(meta);
    else if(meta.updated===s.t){ syncReady=true; if(s.dirty) await cloudPush(); }
    else if(s.t && !s.dirty) await cloudPull(meta);                      // changed on another phone, nothing new here
    else{
      const pick=await kidChoice(T("Your account has a saved map with {0} places and this phone has {1}. Which one should I keep?",meta.count||0,ownPlaces().length),"☁️",
        [["cloud",T("Use the saved map ☁️"),"kid-yes"],["local",T("Keep this phone’s map 📱"),"kid-no"]]);
      if(pick==="cloud") await cloudPull(meta); else{ syncReady=true; await cloudPush(); }
    }
    const gs=(await uroot().child("groups").once("value")).val()||{};          // my friends groups follow me to a new phone
    const mine=myGroups();
    Object.keys(gs).forEach(code=>{ if(/^[A-Z0-9]{4,8}$/.test(code) && !mine.some(g=>g.code===code)) mine.push({code,name:String(gs[code]).slice(0,40)}); });
    lsSet("myIndiaGroupsV2_"+fbUser.uid,mine);
  }catch(e){ cloudFail(e); }
  syncReady=true;
  renderCloudNote();
}
function renderCloudNote(){
  const n=document.getElementById("cloudNote"); if(!n) return;
  n.hidden=!fbUser;
  if(!fbUser) return;
  n.textContent=cloudOk===false ? T("☁️ Cloud save is off. Publish the new database rules in Firebase to turn it on. Your places are still saved on this phone.")
    : lsGet(syncKey(),{}).dirty ? T("☁️ Saving to your Google account…")
    : T("☁️ Saved to your Google account. Sign in on another phone to get your map there.");
}

// ---- friends groups ----
function myGroups(){ return fbUser?lsGet("myIndiaGroupsV2_"+fbUser.uid,[]):[]; }
// What my friends can see: name, scores and place names (never notes or photos). Only published once I am in a group.
async function publishPublic(){
  if(!fbUser || !fbDb || cloudOk===false || !myGroups().length) return;
  const es=engageState();
  await pref(fbUser.uid).set({name:myName(),photo:safePhoto(fbUser.photoURL),lvl:es.lvl,stats:myScores(),updated:firebase.database.ServerValue.TIMESTAMP,
    places:places.map(p=>({n:p.name,lat:p.lat,lon:p.lon,s:p.status,c:catOf(p),y:p.year||0,st:stateOf(p)||""}))});
}
function groupRulesMsg(e){
  cloudFail(e);
  kidSay(cloudOk===false?T("Friends groups need the new database rules. Publish the rules file that came with this version in Firebase."):T("That did not work: {0}",(e && e.message)||""),"👥");
}
async function createGroup(){
  if(!fbUser) return;
  const nm=await kidPrompt(T("Name your friends group"),"👥",T("{0}’s travel gang",myName().split(" ")[0]));
  if(!nm) return;
  const A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let code="";
  for(let i=0;i<6;i++) code+=A[Math.floor(Math.random()*A.length)];
  try{
    await gref(code).child("name").set(nm.slice(0,40));
    await gref(code).child("owner").set(fbUser.uid);
    await joinGroup(code,true);
  }catch(e){ groupRulesMsg(e); }
}
async function joinGroup(raw,isNew){
  if(!fbUser) return;
  const code=String(raw).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
  if(code.length<4){ kidSay(T("I could not find a group with that code."),"🔍"); return; }
  try{
    const nm=(await gref(code).child("name").once("value")).val();
    if(!nm){ kidSay(T("I could not find a group with that code."),"🔍"); return; }
    await gref(code).child("members/"+fbUser.uid).update({name:myName(),joined:firebase.database.ServerValue.TIMESTAMP});
    await uroot().child("groups/"+code).set(String(nm).slice(0,40));
    const g=myGroups().filter(x=>x.code!==code); g.push({code,name:String(nm).slice(0,40)});
    lsSet("myIndiaGroupsV2_"+fbUser.uid,g);
    lbGroup=code; lbScope="friends";
    await publishPublic();
    renderLbSeg(); showTab("board",true);
    if(isNew) inviteGroup({code,name:String(nm)}); else toast("👥 "+T("You joined {0}!",String(nm).slice(0,40)));
  }catch(e){ groupRulesMsg(e); }
}
async function leaveGroup(g){
  if(!(await kidAsk(T("Leave the group {0}?",g.name),{emoji:"👋"}))) return;
  try{ await gref(g.code).child("members/"+fbUser.uid).remove(); await uroot().child("groups/"+g.code).remove(); }catch(e){ console.warn(e); }
  lsSet("myIndiaGroupsV2_"+fbUser.uid,myGroups().filter(x=>x.code!==g.code));
  lbGroup=""; loadBoard();
}
function pageUrl(extra){ const base=SITE_URL || (/^https?:$/.test(location.protocol)?location.origin+location.pathname:""); return base?base+(extra||""):""; }
async function inviteGroup(g){
  const text=T("Join my travel group “{0}” on My Travel Map! Group code: {1}",g.name,g.code)+" "+pageUrl("?join="+g.code);
  try{ if(navigator.share){ await navigator.share({text}); return; } }catch(e){ if(e.name==="AbortError") return; }
  try{ await navigator.clipboard.writeText(text); }catch(e){}
  kidSay(T("Send this code to your friends: {0} (the invite message is copied).",g.code),"📨");
}
let joinTried=false;
function joinFromLink(){
  const j=new URLSearchParams(location.search).get("join");
  if(j && !joinTried){ joinTried=true; joinGroup(j); }
}
// Side-by-side comparison with a friend, drawn as bars and circles.
function compareWith(r){
  const ok=x=>x && typeof x.n==="string" && inBounds(Number(x.lat),Number(x.lon));
  const theirs=(r.prof && Array.isArray(r.prof.places)?r.prof.places:[]).filter(x=>ok(x) && x.s==="visited").slice(0,400).map(x=>({name:x.n.slice(0,80),lat:Number(x.lat),lon:Number(x.lon),st:String(x.st||"").slice(0,60)}));
  const mine=places.filter(p=>p.status==="visited");
  const has=(a,list)=>list.some(b=>norm(a.name)===norm(b.name) || haversine(a,b)<15);
  const both=mine.filter(p=>has(p,theirs)), onlyMe=mine.filter(p=>!has(p,theirs)), onlyThem=theirs.filter(p=>!has(p,mine));
  const myS=getStats().regions, theirS=new Set(theirs.map(x=>x.st).filter(s=>s && (isWorld() || HI_STATES[s]))), extra=[...theirS].filter(s=>!myS.has(s));
  const sc=myScores(), ts=(r.prof && r.prof.stats)||{}, num=v=>Number(v)>0?Number(v):0;
  const card=kidCard('<div class="vs"><div class="vs-p"><span class="lb-av big me"></span><b class="vs-me"></b></div><span class="vs-x">VS</span><div class="vs-p"><span class="lb-av big them"></span><b class="vs-them"></b></div></div>'
    +'<div class="vs-bars"></div><div class="venn"><div class="vc a"><b></b><small></small></div><div class="vc mid"><b></b><small></small></div><div class="vc b"><b></b><small></small></div></div>'
    +'<div class="cmp"></div><div class="kid-btns" style="margin-top:12px"><button class="kid-yes"></button></div>');
  const $=q=>card.box.querySelector(q);
  $(".vs-me").textContent=T("You"); $(".vs-them").textContent=r.name;
  const fq=mkEl("button","kid-no",T("🧠 Quiz: how well do I know {0}?",r.name)); fq.type="button"; fq.onclick=()=>{ card.close(); friendQuiz(r); };
  $(".kid-btns").appendChild(fq);
  const avatar=(el,photo,name)=>{ if(photo){ const im=mkEl("img"); im.alt=""; im.referrerPolicy="no-referrer"; im.src=photo; im.onerror=()=>{ im.remove(); el.textContent=name.charAt(0).toUpperCase(); }; el.appendChild(im); } else el.textContent=(name||"?").charAt(0).toUpperCase(); };
  avatar($(".lb-av.me"),fbUser?safePhoto(fbUser.photoURL):"",myName()); avatar($(".lb-av.them"),r.photo,r.name);
  [[T("Points"),sc.xp,num(ts.xp)],[T("Places"),mine.length,theirs.length],[isWorld()?T("Countries"):T("States"),myS.size,theirS.size],[T("Km"),sc.km,num(ts.km)]].forEach(m=>{
    const max=Math.max(m[1],m[2],1), row=mkEl("div","vs-row");
    const L=mkEl("div","vs-l"), R=mkEl("div","vs-r"), lb=mkEl("i"), rb=mkEl("i");
    lb.style.width=Math.max(3,m[1]/max*100)+"%"; rb.style.width=Math.max(3,m[2]/max*100)+"%";
    if(m[1]>m[2]) lb.classList.add("win"); else if(m[2]>m[1]) rb.classList.add("win");
    L.append(mkEl("b","",m[1].toLocaleString("en-IN")),lb); R.append(rb,mkEl("b","",m[2].toLocaleString("en-IN")));
    row.append(L,mkEl("span","vs-n",m[0]),R);
    $(".vs-bars").appendChild(row);
  });
  const vc=(q,n,label)=>{ $(q+" b").textContent=n; $(q+" small").textContent=label; };
  vc(".vc.a",onlyMe.length,T("Only you")); vc(".vc.mid",both.length,T("Both")); vc(".vc.b",onlyThem.length,T("Only {0}",r.name));
  const group=(title,list,cls)=>{ if(!list.length) return; const g=mkEl("div","cmp-g"); g.append(mkEl("div","cmp-t",title)); const w=mkEl("div","cmp-chips"); list.slice(0,14).forEach(n=>w.append(mkEl("span","cchip "+cls,n))); if(list.length>14) w.append(mkEl("span","cchip more","+"+(list.length-14))); g.append(w); $(".cmp").appendChild(g); };
  group("🤝 "+T("You both visited"),both.map(p=>p.name),"mid");
  group("✨ "+T("Places only {0} has visited",r.name),onlyThem.map(p=>p.name),"b");
  group("🙋 "+T("Places only you have visited"),onlyMe.map(p=>p.name),"a");
  group("🗺️ "+(isWorld()?T("Countries {0} has and you do not",r.name):T("States {0} has and you do not",r.name)),extra.map(stName),"b");
  const btn=$(".kid-yes"), showing=ghost && ghost.uid===r.k;
  btn.textContent=showing?T("🙈 Hide their places from my map"):T("👀 Show their places on my map");
  btn.hidden=!theirs.length && !showing;
  btn.onclick=()=>{
    card.close();
    if(showing){ clearGhost(); return; }
    ghost={uid:r.k,name:r.name,places:theirs};
    if(!isWide()) showTab("map",true);
    render();
    toast("👀 "+T("Purple pins: {0}’s places",r.name));
  };
}

// ---- leaderboard screen ----
let lbScope="all", lbGroup="";
function renderLbSeg(){
  const sc=document.getElementById("lbScope");
  sc.innerHTML="";
  [["all",T("🌍 Everyone")],["friends",T("👥 Friends")]].forEach(d=>{
    const b=mkEl("button",lbScope===d[0]?"on":"",d[1]); b.type="button";
    b.onclick=()=>{ lbScope=d[0]; renderLbSeg(); loadBoard(); };
    sc.appendChild(b);
  });
  const seg=document.getElementById("lbSeg");
  seg.innerHTML="";
  BOARDS.forEach(b=>{
    const el=mkEl("button","chip"+(lbCrit===b[0]?" on":""),b[1]+" "+T(b[2])); el.type="button";
    el.onclick=()=>{ lbCrit=b[0]; renderLbSeg(); loadBoard(); };
    seg.appendChild(el);
  });
}
function renderLbMe(){
  const box=document.getElementById("lbMe");
  box.innerHTML="";
  const line=mkEl("div"), small=mkEl("div","small");
  if(!fbUser){ line.textContent=T("Sign in with Google to put your name on the leaderboard."); box.append(line); return; }
  const i=lbRows?lbRows.findIndex(r=>r.k===fbUser.uid):-1, es=engageState();
  line.textContent=i>=0 ? T("You are #{0} of {1} travellers",i+1,lbRows.length) : T("Add a visited place to join the leaderboard.");
  small.textContent=LEVELS[es.lvl][1]+" "+T(LEVELS[es.lvl][2])+" · "+T("{0} points",es.xp)+" · "+T("Scores update by themselves when your map changes.");
  box.append(line,small);
}
function lbRowEl(r,i,id){
  const me=fbUser && r.k===fbUser.uid, row=mkEl("div","lb-row"+(me?" me":""));
  row.append(mkEl("span","lb-rank",["🥇","🥈","🥉"][i]||String(i+1)));
  const av=mkEl("span","lb-av"), initial=(r.name||"?").charAt(0).toUpperCase();
  if(r.photo){ const im=mkEl("img"); im.alt=""; im.referrerPolicy="no-referrer"; im.src=r.photo; im.onerror=()=>{ im.remove(); av.textContent=initial; }; av.appendChild(im); }
  else av.textContent=initial;
  const L=LEVELS[Number.isInteger(r.lvl) && r.lvl>=0 && r.lvl<LEVELS.length?r.lvl:0];
  const nm=mkEl("span","lb-name"); nm.append(mkEl("span","",(r.name||T("Traveller"))+(me?" ("+T("You")+")":"")),mkEl("small","",L[1]+" "+T(L[2])));
  row.append(av,nm,mkEl("span","lb-score",r.score.toLocaleString("en-IN")+(id==="km"?" km":"")));
  return row;
}
function lbNote(box,text){ box.innerHTML=""; box.appendChild(mkEl("div","small lb-note",text)); }
async function loadBoard(){
  const box=document.getElementById("lbList"), tools=document.getElementById("lbTools"), id=lbCrit, scope=lbScope;
  const stale=()=>id!==lbCrit || scope!==lbScope;
  tools.innerHTML="";
  lbNote(box,T("Loading…"));
  if(!(await fbReady)){ lbNote(box,T("The leaderboard needs internet. Check your connection and tap Refresh.")); return; }
  if(scope==="friends"){ await loadFriends(box,tools,id,stale); return; }
  try{
    const snap=await boardRef(id).orderByChild("score").limitToLast(100).once("value");
    if(stale()) return;
    const rows=[];
    snap.forEach(c=>{ const v=c.val()||{}; if(typeof v.score==="number" && v.score>0) rows.push({k:c.key,name:String(v.name||"").slice(0,40),score:v.score,photo:safePhoto(v.photo),lvl:v.lvl}); });
    rows.sort((a,b)=>b.score-a.score);
    lbRows=rows;
    box.innerHTML="";
    if(!rows.length) lbNote(box,T("No travellers here yet. Be the first!"));
    rows.forEach((r,i)=>box.appendChild(lbRowEl(r,i,id)));
    renderLbMe();
  }catch(e){ console.warn("Leaderboard could not be loaded.",e); lbNote(box,T("Could not load the leaderboard: {0}",e.message||e.code||"")); }
}
async function loadFriends(box,tools,id,stale){
  const mk=(txt,cls,fn)=>{ const b=mkEl("button",cls,txt); b.type="button"; b.onclick=fn; return b; };
  const starters=()=>[mk(T("➕ Create a friends group"),"primary full",createGroup),
    mk(T("🔑 Join with a code"),"gray full",async()=>{ const c=await kidPrompt(T("Type the group code your friend sent you"),"🔑",""); if(c) joinGroup(c); })];
  if(!fbUser){ lbNote(box,T("Sign in with Google to put your name on the leaderboard.")); return; }
  const groups=myGroups();
  if(!groups.length){
    lbRows=null; renderLbMe();
    lbNote(box,T("Make a private leaderboard for your family and friends. People in a group can see each other’s place names and scores."));
    tools.append.apply(tools,starters());
    return;
  }
  const g=groups.find(x=>x.code===lbGroup)||groups[0]; lbGroup=g.code;
  try{
    const mem=(await gref(g.code).child("members").once("value")).val()||{};
    const uids=Object.keys(mem).slice(0,60);
    const profs=await Promise.all(uids.map(u=>pref(u).once("value").then(s=>s.val(),()=>null)));
    if(stale()) return;
    const rows=uids.map((u,i)=>{ const p=profs[i]||{}; return {k:u,name:String(p.name||(mem[u]&&mem[u].name)||"").slice(0,40),score:Number(p.stats && p.stats[id])||0,photo:safePhoto(p.photo),lvl:p.lvl,prof:p}; }).sort((a,b)=>b.score-a.score);
    lbRows=rows;
    box.innerHTML="";
    if(groups.length>1){
      const pick=mkEl("div","chips slide");
      groups.forEach(x=>{ const c=mk(x.name,"chip"+(x.code===g.code?" on":""),()=>{ lbGroup=x.code; loadBoard(); }); pick.appendChild(c); });
      box.appendChild(pick);
    }
    box.appendChild(mkEl("div","share-title","👥 "+g.name+" · "+g.code));
    rows.forEach((r,i)=>{ const el=lbRowEl(r,i,id); if(r.k!==fbUser.uid){ el.classList.add("tap"); el.title=T("You and {0}",r.name); el.onclick=()=>compareWith(r); } box.appendChild(el); });
    if(rows.length>1) box.appendChild(mkEl("div","small lb-note",T("Tap a friend to compare your maps.")));
    renderLbMe();
    renderSocial(box,g,mem,rows);
    tools.append(mk(T("📨 Invite friends · code {0}",g.code),"green full",()=>inviteGroup(g)));
    tools.append.apply(tools,starters());
    tools.append(mk(T("👯 Find my travel twin"),"gray full",findTwin),mk(T("👑 Kings and queens"),"gray full",openRulers));
    tools.append(mk(T("Leave this group"),"gray full danger",()=>leaveGroup(g)));
  }catch(e){
    cloudFail(e);
    lbNote(box,cloudOk===false?T("Friends groups need the new database rules. Publish the rules file that came with this version in Firebase."):T("Could not load the leaderboard: {0}",e.message||e.code||""));
  }
}

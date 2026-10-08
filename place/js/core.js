/* My Travel Map · core.js
   The two maps, the list of places, stats, badges and drawing the map and list. */
// ---- Two maps: India (states) and World (countries). Each keeps its own list of places. ----
let MODE=(localStorage.getItem("myMapModeV2")==="world" && window.WORLD_SVG)?"world":"india";     // the world map file is loaded only when it is needed (see setMode)
const MODES={
  india:{key:"myIndiaPlacesV2",W:1300,H:1425,total:28,geo:{minLon:66.5,maxLon:98.5,maxLat:37.8,minLat:5.8},box:[5,38,65,100]},
  world:{key:"myWorldPlacesV2",W:1300,H:711,total:195,geo:{minLon:-180,maxLon:180,maxLat:78,minLat:-56},box:[-56,78,-180,180]}
};
function isWorld(){return MODE==="world";}
function mk(k){return isWorld()?k+"_W":k;}                    // separate saved settings for the world map
function inBounds(lat,lon){ const b=MODES[MODE].box; return lat>=b[0] && lat<=b[1] && lon>=b[2] && lon<=b[3]; }
function loadPlaces(){ try{ const v=JSON.parse(localStorage.getItem(MODES[MODE].key)||"null"); return Array.isArray(v)?v:[]; }catch(e){ return []; } }
let places=loadPlaces();
// On the World map the places from the India map are shown too. They are linked copies (marked _in):
// they count in the totals but are never saved in the World list, and are edited only on the India map.
function ownPlaces(){ return places.filter(p=>!p._in); }
function linkIndia(){
  places=places.filter(p=>!p._in);
  if(!isWorld()) return;
  let list=[];
  try{ list=JSON.parse(localStorage.getItem(MODES.india.key)||"[]")||[]; }catch(e){}
  const same=(a,b)=>String(a.name).toLowerCase().replace(/[^a-z0-9]/g,"")===String(b.name).toLowerCase().replace(/[^a-z0-9]/g,"") || (Math.abs(a.lat-b.lat)<0.03 && Math.abs(a.lon-b.lon)<0.03);
  list.forEach(p=>{
    if(!p || typeof p.name!=="string" || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || places.some(q=>same(q,p))) return;
    const c=Object.assign({},p,{_in:true,country:"India"}); delete c.state; delete c.plan;
    places.push(c);
  });
}
linkIndia();
let MAP_W, MAP_H, GEO, mapSvg, statePaths;
const SVGS={india:document.getElementById("mapSvg")};
function attachMap(){
  const M=MODES[MODE]; MAP_W=M.W; MAP_H=M.H; GEO=M.geo;
  if(isWorld() && !SVGS.world) { const t=document.createElement("template"); t.innerHTML=window.WORLD_SVG; SVGS.world=t.content.firstElementChild; }
  const cur=document.getElementById("mapSvg");
  if(cur!==SVGS[MODE]) cur.parentNode.replaceChild(SVGS[MODE],cur);
  mapSvg=SVGS[MODE];
  statePaths=[...mapSvg.querySelectorAll("#statesG path")];
}
attachMap();
// Names the place search uses for countries -> names used on the map.
const COUNTRY_ALIAS={"United States":"United States of America","USA":"United States of America","UK":"United Kingdom","UAE":"United Arab Emirates","Czech Republic":"Czechia","Democratic Republic of the Congo":"Dem. Rep. Congo","Republic of the Congo":"Congo","Dominican Republic":"Dominican Rep.","Bosnia and Herzegovina":"Bosnia and Herz.","North Macedonia":"Macedonia","Ivory Coast":"Côte d'Ivoire","Eswatini":"eSwatini","Türkiye":"Turkey","Russian Federation":"Russia","East Timor":"Timor-Leste","Burma":"Myanmar","The Bahamas":"Bahamas","Central African Republic":"Central African Rep.","South Sudan":"S. Sudan","Equatorial Guinea":"Eq. Guinea","Solomon Islands":"Solomon Is.","Western Sahara":"W. Sahara"};
function contOf(n){ const el=statePaths.find(e=>e.dataset.n===n); return el?(el.dataset.k||""):""; }
function regionLine(st){ return isWorld() ? T("{0} countries visited",st.states) : T("{0} of 28 states visited",st.states); }
const UTS=["Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"];

// Categories (icon + label) and words that help guess the category of a place.
const CATS={temple:["🛕","Temple"],beach:["🏖️","Beach"],hill:["⛰️","Hill station"],fort:["🏰","Fort & monument"],wildlife:["🐯","Wildlife"],city:["🏙️","City & other"]};
const CAT_HINTS={
  wildlife:"kaziranga ranthambore sawaimadhopur bharatpur corbett sasangir girforest sundarban bandhavgarh kanha periyar nationalpark sanctuary tigerreserve safari wildlife",
  beach:"goa puri kovalam gokarna pondicherry puducherry portblair daman mahabalipuram kanyakumari alappuzha alleppey lakshadweep andaman beach island varkala digha",
  hill:"shimla manali darjeeling ooty munnar nainital mussoorie gulmarg pahalgam srinagar kodaikanal mountabu gangtok shillong dalhousie dharamshala kullu auli almora kasauli coorg lonavala mahabaleshwar tawang cherrapunji wayanad kargil sikkim himachal uttarakhand ladakh hillstation valley",
  temple:"varanasi tirupati somnath dwarka kedarnath badrinath amarnath vaishnodevi rameswaram madurai ujjain omkareshwar shirdi mathura vrindavan govardhan ayodhya haridwar rishikesh bodhgaya goldentemple konark kanchipuram thanjavur pushkar prayagraj khajuraho amritsar temple mandir dham jyotirlinga gurudwara dargah",
  fort:"jaipur jodhpur jaisalmer chittorgarh udaipur gwalior agra tajmahal bikaner hampi ajanta ellora jhansi alwar statueofunity fort palace mahal qila caves tomb minar"
};
function guessCat(name){
  const n=norm(name);
  if(n==="leh" || n==="diu" || n==="gaya") return n==="leh"?"hill":n==="diu"?"beach":"temple";
  for(const c in CAT_HINTS){ if(CAT_HINTS[c].split(" ").some(w=>n.includes(w))) return c; }
  return "city";
}
function catOf(p){return CATS[p.cat]?p.cat:"city";}
function catIcon(p){return CATS[catOf(p)][0];}
function normPlaces(){ places.forEach(p=>{ if(p.status!=="wish") p.status="visited"; if(!CATS[p.cat]) p.cat=guessCat(p.name); if(typeof p.added!=="number") p.added=0; }); }
normPlaces();   // added = when it was put on the map (0 = before this version)

let fStatus="all", fCat="all", fYear="all", fFav=false;     // what is shown on the map
function shownPlaces(){return places.filter(p=>(fStatus==="all"||p.status===fStatus)&&(fCat==="all"||catOf(p)===fCat)&&(fYear==="all"||p.year===fYear)&&(!fFav||p.fav));}
function yearScope(){return fYear==="all"?0:fYear;}          // 0 = all years

// Map picture bounds (Mercator) — pins are placed from real latitude/longitude.
function mercY(lat){return Math.log(Math.tan(Math.PI/4 + lat*Math.PI/360));}
function project(lat, lon) {
  const x = (lon-GEO.minLon)/(GEO.maxLon-GEO.minLon)*100;
  const y = (mercY(GEO.maxLat)-mercY(lat))/(mercY(GEO.maxLat)-mercY(GEO.minLat))*100;
  return {x:Math.min(99,Math.max(1,x)), y:Math.min(99,Math.max(1,y))};
}

function isOnPicture(p){return false;}
function norm(t){return String(t).toLowerCase().replace(/[^a-z0-9]/g,"");}
function findDuplicate(name,lat,lon){
  return places.find(p=>norm(p.name)===norm(name) || (Math.abs(p.lat-lat)<0.03 && Math.abs(p.lon-lon)<0.03));
}

function photoOf(p){return p.photo || p.img || "";}

// Which state / union territory a place is in (found from the map shapes).
function stateOf(p){
  if(typeof p.state==="string") return p.state;
  let found="";
  try{
    const q=project(p.lat,p.lon), x=q.x*MAP_W/100, y=q.y*MAP_H/100, pt=mapSvg.createSVGPoint();
    const tries=[[0,0]];
    for(const r of (isWorld()?[1.2,2.5,4]:[6,12,20])) for(let a=0;a<8;a++) tries.push([r*Math.cos(a*Math.PI/4),r*Math.sin(a*Math.PI/4)]);
    for(const t of tries){
      pt.x=x+t[0]; pt.y=y+t[1];
      const hit=statePaths.find(el=>el.isPointInFill(pt));
      if(hit){ found=hit.dataset.n; break; }
    }
  }catch(e){ return ""; }
  if(!found && isWorld() && p.country) found=COUNTRY_ALIAS[p.country]||p.country;      // tiny countries have no shape on the map
  p.state=found;
  return found;
}

function haversine(a,b){
  const R=6371, r=Math.PI/180, dLat=(b.lat-a.lat)*r, dLon=(b.lon-a.lon)*r;
  const h=Math.sin(dLat/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
// Visited places in travel order: by year when given, otherwise in the order they were added.
function journeyPlaces(year){
  return places.filter(p=>p.status==="visited" && (!year || p.year===year)).map((p,i)=>({p,i}))
    .sort((a,b)=>((a.p.year||9999)-(b.p.year||9999)) || (a.i-b.i)).map(x=>x.p);
}
// Stats for everything, or for one year only when a year is given.
function getStats(year){
  const visited=places.filter(p=>p.status==="visited" && (!year || p.year===year));
  const regions=new Set(visited.map(stateOf).filter(Boolean));
  const j=journeyPlaces(year); let km=0;
  for(let i=1;i<j.length;i++) km+=haversine(j[i-1],j[i]);
  const cat={}; visited.forEach(p=>{cat[catOf(p)]=(cat[catOf(p)]||0)+1;});
  return {v:visited.length, w:places.filter(p=>p.status==="wish").length, regions,
    states:[...regions].filter(n=>!UTS.includes(n)).length, uts:[...regions].filter(n=>UTS.includes(n)).length,
    conts:new Set([...regions].map(contOf).filter(Boolean)),
    km:Math.round(km), cat, mem:visited.filter(p=>p.note||p.photo).length, journey:j,
    rated:places.filter(p=>p.rating).length, quiz:localStorage.getItem("myIndiaQuizV2")==="perfect"};
}
// Best places for the shared picture: most stars first, favourites win a tie.
function topFive(year){
  return places.filter(p=>p.status==="visited" && (p.rating||p.fav) && (!year || p.year===year)).map((p,i)=>({p,i}))
    .sort((a,b)=>((b.p.rating||0)-(a.p.rating||0)) || ((b.p.fav?1:0)-(a.p.fav?1:0)) || (a.i-b.i)).slice(0,5).map(x=>x.p);
}

const BADGES=[
  {id:"first",e:"🎒",n:"First Step",need:"Add your first visited place",t:s=>s.v>=1},
  {id:"five",e:"🖐️",n:"High Five",need:"Visit 5 places",t:s=>s.v>=5},
  {id:"ten",e:"🔟",n:"10 Places!",need:"Visit 10 places",t:s=>s.v>=10},
  {id:"champ",e:"🏆",n:"Travel Champ",need:"Visit 25 places",t:s=>s.v>=25},
  {id:"hill",e:"⛰️",n:"Mountain Lover",need:"Visit 3 hill stations",t:s=>(s.cat.hill||0)>=3},
  {id:"beach",e:"🏖️",n:"Beach Explorer",need:"Visit 3 beaches",t:s=>(s.cat.beach||0)>=3},
  {id:"temple",e:"🛕",n:"Temple Trail",need:"Visit 3 temples",t:s=>(s.cat.temple||0)>=3},
  {id:"fort",e:"🏰",n:"Fort Hunter",need:"Visit 3 forts or monuments",t:s=>(s.cat.fort||0)>=3},
  {id:"wild",e:"🐯",n:"Jungle Buddy",need:"Visit 2 wildlife places",t:s=>(s.cat.wildlife||0)>=2},
  {id:"hop",e:"🦘",n:"State Hopper",need:"Visit 5 different states",wn:"Country Hopper",wneed:"Visit 5 different countries",t:s=>s.states>=5},
  {id:"bharat",e:"🇮🇳",n:"Bharat Darshan",need:"Visit 15 different states",wn:"Globe Trotter",wneed:"Visit 15 different countries",t:s=>s.states>=15},
  {id:"road",e:"🛣️",n:"Road Warrior",need:"Travel 5,000 km",t:s=>s.km>=5000},
  {id:"dream",e:"💭",n:"Big Dreamer",need:"Put 3 places on your wishlist",t:s=>s.w>=3},
  {id:"memory",e:"📸",n:"Memory Keeper",need:"Add a note or your own photo to 3 places",t:s=>s.mem>=3},
  {id:"critic",e:"🌟",n:"Star Critic",need:"Give stars to 5 places",t:s=>s.rated>=5},
  {id:"quiz",e:"🧠",n:"Quiz Whiz",need:"Get a perfect score in the quiz",t:s=>s.quiz}
];
let earnedBadges=null;       // null until the first render, so old badges do not pop up again on page load
let badgeQueue=Promise.resolve();
function bName(b){return isWorld() && b.wn ? b.wn : b.n;}
function bNeed(b){return isWorld() && b.wneed ? b.wneed : b.need;}
function updateBadges(st){
  const now=BADGES.filter(b=>b.t(st)).map(b=>b.id);
  if(earnedBadges){
    BADGES.filter(b=>now.includes(b.id) && !earnedBadges.includes(b.id)).forEach(b=>{
      badgeQueue=badgeQueue.then(()=>{ confetti(); return kidPopup(T("You won a new badge: {0}!",T(bName(b))),{emoji:b.e,yes:T("Woohoo! 🥳"),no:null}); });
    });
  }
  earnedBadges=now;
  document.getElementById("badgeCount").textContent=now.length+" / "+BADGES.length;
  document.getElementById("badges").innerHTML=BADGES.map(b=>{
    const got=now.includes(b.id);
    return '<span class="bdg'+(got?'':' locked')+'" title="'+escapeHtml(T(bNeed(b)))+'" onclick="badgeInfo(\''+b.id+'\')">'+'<i>'+(got?b.e:'🔒')+'</i><em>'+escapeHtml(T(bName(b)))+'</em></span>';
  }).join("");
}
function badgeInfo(id){
  const b=BADGES.find(x=>x.id===id), got=earnedBadges && earnedBadges.includes(id);
  kidSay(got?T("{0} — you got it! {1}.",T(bName(b)),T(bNeed(b))):T("{0} — how to win: {1}.",T(bName(b)),T(bNeed(b))),got?b.e:"🔒");
}

function titleText(){
  const n=(document.getElementById("travellerName").value||"").trim();
  if(fYear!=="all") return n ? T("{0}: {1} in Travel",n,fYear) : T("My {0} in Travel",fYear);
  if(isWorld()){
    if(LANG==="hi") return n ? n+" की विश्व यात्राएँ" : "मेरी विश्व यात्राएँ";
    return n ? n+(/s$/i.test(n)?"'":"'s")+" World Travel Map" : "My World Travel Map";
  }
  if(LANG==="hi") return n ? n+" की भारत यात्राएँ" : "मेरी भारत यात्राएँ";
  return n ? n+(/s$/i.test(n)?"'":"'s")+" Visiting Places in India" : "My Visiting Places in India";
}
function linePath(list){
  return list.map((p,i)=>{
    const q=project(p.lat,p.lon); return (i?"L":"M")+(q.x*MAP_W/100).toFixed(1)+","+(q.y*MAP_H/100).toFixed(1);
  }).join("");
}

const INDIA_MID={lat:22.5,lon:79};
let clusterOn=false;
function zoomToIndia(){
  const w=mapWrap.clientWidth, h=mapWrap.clientHeight, q=project(INDIA_MID.lat,INDIA_MID.lon);
  Z=Math.min(Z_MAX,Math.max(1,330/(BASE_W*32/360)));
  TX=w/2-q.x/100*BASE_W*Z; TY=h/2-q.y/100*BASE_W*Z*MAP_H/MAP_W;
  applyZoom();
}
const markerEls=new Map();                 // place -> its pin on the map (used by the journey replay)
let replaying=false, renderQueued=false;
function render() {
  if(replaying || pinGame){ renderQueued=true; return; }                       // do not disturb the travel film
  if(fYear!=="all" && !places.some(p=>p.year===fYear)) fYear="all";  // that year has no trips any more
  const layer = document.getElementById("markers");
  const shown=shownPlaces();
  layer.innerHTML = ""; markerEls.clear();
  shown.forEach(p=>{
    const q=project(p.lat,p.lon), ph=photoOf(p);
    const el=document.createElement("div");
    el.className="marker "+p.status+(p._in?" in":"");
    el.style.left=q.x+"%"; el.style.top=q.y+"%";
    el.title=p.name+(p.note?" — "+p.note:"");
    el.innerHTML='<div class="marker-photo"><span>'+catIcon(p)+'</span>'+(ph?'<img '+(p.photo?'':'crossorigin="anonymous" ')+'alt="" src="'+escapeHtml(ph)+'" onerror="this.remove()">':'')+'</div>'
      +'<div class="marker-cat">'+catIcon(p)+'</div><div class="pin"></div>'
      +'<div class="marker-label">'+escapeHtml(p.name)+(p.year?'<small>'+p.year+'</small>':'')+(p.rating?'<span class="rt">★'+p.rating+'</span>':'')+(p.fav?' ❤️':'')+'</div>';
    el.onclick=()=>openPlaceCard(p);
    layer.appendChild(el);
    markerEls.set(p,el);
  });
  // World map: many Indian pins become one "India" pin until you zoom in
  const linkedShown=shown.filter(p=>p._in).length;
  clusterOn=isWorld() && linkedShown>3;
  if(clusterOn){
    const q=project(INDIA_MID.lat,INDIA_MID.lon), el=document.createElement("div");
    el.className="marker visited cluster";
    el.style.left=q.x+"%"; el.style.top=q.y+"%";
    el.innerHTML='<div class="pin"></div><div class="marker-label">🇮🇳 '+escapeHtml(T("India · {0} places",linkedShown))+'</div>';
    el.onclick=zoomToIndia;
    layer.appendChild(el);
  }
  drawGhost(layer);
  drawExtras(layer);

  const st=getStats(), view=yearScope()?getStats(yearScope()):st;   // view = what the map shows (one year or everything)
  // colour in the states that have a visited place
  statePaths.forEach(el=>el.setAttribute("fill",view.regions.has(el.dataset.n)?el.dataset.c:el.dataset.p));
  // journey line
  const showLine=document.getElementById("journeyToggle").checked && view.journey.length>1;
  document.getElementById("journey").setAttribute("d",showLine ? linePath(view.journey) : "");
  // title with the traveller's name
  const title=document.getElementById("mapTitle"), tt=titleText();
  title.textContent=tt;
  if(tt.length>30){ title.setAttribute("textLength","560"); title.setAttribute("lengthAdjust","spacingAndGlyphs"); }
  else { title.removeAttribute("textLength"); title.removeAttribute("lengthAdjust"); }

  document.getElementById("stateStat").textContent=regionLine(st)+(st.uts?" + "+T("{0} of 8 union territories",st.uts):"");
  document.getElementById("stateBar").style.width=(Math.min(1,st.states/MODES[MODE].total)*100)+"%";
  document.getElementById("kmStat").textContent="🛣️ "+T("{0} km travelled",st.km.toLocaleString("en-IN"));
  updateBadges(st);
  renderFilters();
  renderYears();
  afterRender(st);                                    // points, challenges, celebrations, cloud save
  scheduleSubmit();                                   // keeps my leaderboard numbers fresh

  document.getElementById("count").textContent=shown.length===places.length
    ? (places.length===1?T("{0} place",1):T("{0} places",places.length))+(st.w?" · "+T("{0} visited, {1} wishlist",st.v,st.w):"")
    : T("Showing {0} of {1} places",shown.length,places.length);
  const list=document.getElementById("placeList");
  list.innerHTML="";
  const listed=shown.filter(p=>!p._in);
  listed.forEach((p,i)=>{
    const row=document.createElement("div");
    row.className="place";
    row.innerHTML='<button type="button" class="grip" aria-label="Move" title="Move">⠿</button><span><i class="dot '+p.status+'"></i>'+(i+1)+'. '+catIcon(p)+' '+escapeHtml(p.name)+(p.year?'<small>'+p.year+'</small>':'')+(p.rating?'<span class="rt">★'+p.rating+'</span>':'')+(p.fav?' ❤️':'')+'</span>'+(p.status==="visited"?'<button type="button" class="near" aria-label="'+T("🧭 Add nearby places I visited")+'" title="'+T("🧭 Add nearby places I visited")+'">🧭</button>':'')+'<button class="del" aria-label="Remove">×</button>';
    const nb=row.querySelector(".near"); if(nb) nb.onclick=e=>{ e.stopPropagation(); nearbyCard(p,true); };
    row._p=p;
    row.onclick=()=>openPlaceCard(p);
    row.querySelector(".del").onclick=e=>{e.stopPropagation();removePlace(p);};
    list.appendChild(row);
  });
  enableReorder(list,listed);
  document.getElementById("orderHint").hidden=listed.length<2;
  const lr=document.getElementById("linkedRow");
  lr.hidden=!(shown.length-listed.length);
  lr.textContent="🇮🇳 "+T("From my India map · {0} places",shown.length-listed.length)+"  ›";

  try{ localStorage.setItem(MODES[MODE].key,JSON.stringify(ownPlaces())); }
  catch(e){ console.warn(e); kidSay(T("Uh-oh! Your browser storage is full. Try removing some of your own photos."),"📦"); }
  places.forEach(p=>{ if(p.img===undefined) loadPlaceImage(p); });
  scheduleMapBlob();
}

// Drag the ⠿ handle on a row to change the order of the places.
function enableReorder(list,shown){
  const scroller=document.getElementById("sheetBody");
  list.querySelectorAll(".grip").forEach(grip=>{
    grip.onclick=e=>e.stopPropagation();
    grip.onpointerdown=e=>{
      e.preventDefault(); e.stopPropagation();
      const row=grip.parentNode;
      row.classList.add("dragging");
      const move=ev=>{                                        // listen on the window: the row itself moves around while dragging
        ev.preventDefault();
        const next=[...list.children].filter(r=>r!==row).find(r=>{ const b=r.getBoundingClientRect(); return ev.clientY<b.top+b.height/2; });
        if(next!==row.nextSibling) list.insertBefore(row,next||null);
        const sb=scroller.getBoundingClientRect();           // scroll the list when dragging near its edges
        if(ev.clientY>sb.bottom-44) scroller.scrollTop+=14; else if(ev.clientY<sb.top+44) scroller.scrollTop-=14;
      };
      const done=()=>{
        window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",done); window.removeEventListener("pointercancel",done);
        row.classList.remove("dragging");
        const order=[...list.children].map(r=>r._p);
        if(order.some((p,i)=>p!==shown[i])){
          // only the places in the list move; hidden (filtered-out) places keep their position
          const slots=shown.map(p=>places.indexOf(p)).sort((a,b)=>a-b);
          slots.forEach((slot,i)=>{ places[slot]=order[i]; });
          render();
        }
      };
      window.addEventListener("pointermove",move,{passive:false}); window.addEventListener("pointerup",done); window.addEventListener("pointercancel",done);
    };
  });
}

function renderFilters(){
  const defs=[["s","all",T("All")],["s","visited",T("✅ Visited")],["s","wish",T("⭐ Wishlist")],["f","fav",T("❤️ Favourites")]].concat(Object.keys(CATS).map(c=>["c",c,CATS[c][0]+" "+catLabel(c)]));
  const box=document.getElementById("filters");
  box.innerHTML="";
  defs.forEach(d=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="chip"+((d[0]==="s"?fStatus===d[1]:d[0]==="f"?fFav:fCat===d[1])?" on":"");
    b.textContent=d[2];
    b.onclick=()=>{
      if(d[0]==="s"){ fStatus=d[1]; if(d[1]==="all"){ fCat="all"; fFav=false; } }
      else if(d[0]==="f") fFav=!fFav;
      else fCat=(fCat===d[1]?"all":d[1]);        // tap a category again to switch it off
      render();
    };
    box.appendChild(b);
  });
}

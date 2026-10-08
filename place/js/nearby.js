/* My Travel Map · nearby.js
   "Been near here too?" tick list after adding a place. */
// ---- After adding a place: tick other places nearby that you have also visited ----
// Kinds of sights, used for the filter chips at the top of the list.
const NB_KINDS={temple:["🛕","Temples"],beach:["🏖️","Beaches & sea"],fort:["🏰","Forts & monuments"],nature:["🌳","Lakes & nature"],market:["🛍️","Markets"],museum:["🏛️","Museums"],other:["📍","Landmarks"]};
const NB_CAT={temple:"temple",beach:"beach",fort:"fort"};          // kind -> category of the pin (others are guessed from the name)
function nbKind(text){
  const t=String(text).toLowerCase();
  if(/temple|mandir|dargah|church|basilica|cathedral|mosque|masjid|gurudwara|gurdwara|shrine|\bmath\b|ashram|monastery|synagogue|pagoda|stupa|\bghat\b|imambara/.test(t)) return "temple";
  if(/museum|planetarium|gallery|science cent|science city|aquarium|sangrahalaya/.test(t)) return "museum";
  if(/beach|chowpatty|sea link|sea face|seaface|marine drive|island|coast|promenade|harbour|harbor|\bbay\b|backwater/.test(t)) return "beach";
  if(/market|bazaar|bazar|chowk|causeway|\bmall\b|\bstreet\b|\bhaat\b/.test(t)) return "market";
  if(/lake|sagar|talao|\btal\b|garden|\bpark\b|bagh|falls|waterfall|\bhills?\b|sanctuary|\bzoo\b|reserve|forest|river|\bdam\b|valley|peak|viewpoint|botanical/.test(t)) return "nature";
  if(/fort|palace|mahal|\bgate\b|darwaza|tomb|minar|memorial|monument|caves?\b|haveli|bridge|tower|terminus|stepwell|baoli|mausoleum|ruins|statue|qila|citadel|heritage|\bwada\b/.test(t)) return "fort";
  return "other";
}
// Finds sights for a place: first inside the place itself (famous ones first), then well-known places around it.
async function nearbyFind(p){
  const inside=[], around=[], seen=new Set([norm(p.name)]), IN_KM=30;
  let area=p.name;                                   // a sight inside a big city: the list is headed with the city name
  const junk=/\b(station|railway|metro|monorail|school|college|university|institute|hospital|constituency|neighbou?rhood|suburb|locality|residential|village|census town|taluka?|tehsil|ward|district|division|airport|aerodrome|road|highway|expressway|flyover|company|headquarters?|ltd|limited|bank|election|municipal|corporation|assembly|lok sabha|junction|academy|campus|hostel|office|court|police|prison|jail|depot|colony|nagar|newspaper|studios?|football club|cricket team|organi[sz]ation|consulate|embassy|stock exchange|power station|refinery|factory)\b|^list of|\d{4}/i;
  const take=(list,name,lat,lon,img,kind,star)=>{
    const k=norm(name);
    if(!k || k.length<3 || seen.has(k) || !Number.isFinite(lat) || !Number.isFinite(lon) || !inBounds(lat,lon) || places.some(q=>norm(q.name)===k)) return false;
    seen.add(k); list.push({name:String(name).slice(0,80),lat,lon,img:img||"",kind:NB_KINDS[kind]?kind:nbKind(name),star:!!star,km:haversine(p,{lat,lon})});
    return true;
  };
  const getJson=async(url,opt,ms)=>{ const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),ms); try{ return await (await fetch(url,Object.assign({signal:ctl.signal},opt||{}))).json(); } finally{ clearTimeout(t); } };
  const safe=(job,label)=>job.catch(e=>{ console.warn(label+" failed.",e); return null; });
  const lat4=p.lat.toFixed(4), lon4=p.lon.toFixed(4);

  // 1) hand-picked famous sights for big cities (always there, even with no internet)
  CITY_SIGHTS.forEach(c=>{ if(norm(c.city)===norm(p.name) || haversine(p,c)<=Math.min(c.r,IN_KM) || c.items.some(it=>haversine(p,{lat:it[1],lon:it[2]})<1.5)){ area=c.city; c.items.forEach(it=>{ if(haversine(p,{lat:it[1],lon:it[2]})<=Math.max(c.r,IN_KM)) take(inside,it[0],it[1],it[2],"",it[3],true); }); } });

  // 2) Wikipedia, best-known first: everything within 25 km, once for typical sights and once for anything
  const wikiBase="https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=0&gsrlimit=50&prop=coordinates%7Cpageimages%7Cdescription&piprop=thumbnail&pithumbsize=120&colimit=50&pilimit=50&gsrsearch=";
  const near="nearcoord:25km,"+lat4+","+lon4;
  const wSights=safe(getJson(wikiBase+encodeURIComponent(near+" temple OR beach OR fort OR palace OR museum OR lake OR garden OR market OR monument OR park OR church OR mosque OR caves OR bridge"),null,7000),"Wikipedia sights");
  const wAll=safe(getJson(wikiBase+encodeURIComponent(near),null,7000),"Wikipedia nearby");
  // 3) Wikipedia by distance (10 km) and 4) OpenStreetMap sights (12 km), as back-ups
  const wGeo=safe(getJson("https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord="+lat4+"%7C"+lon4+"&ggsradius=10000&ggslimit=40&prop=coordinates%7Cpageimages%7Cdescription&piprop=thumbnail&pithumbsize=120&colimit=40&pilimit=40",null,6000),"Wikipedia by distance");
  const q='[out:json][timeout:7];(nwr(around:12000,'+lat4+','+lon4+')[tourism~"^(attraction|museum|viewpoint|zoo|theme_park|gallery)$"][name];nwr(around:12000,'+lat4+','+lon4+')[historic~"^(fort|castle|monument|palace|ruins|memorial|archaeological_site|temple|tomb|city_gate)$"][name];nwr(around:12000,'+lat4+','+lon4+')[amenity~"^(place_of_worship|marketplace)$"][name][~"^(wikidata|wikipedia|tourism)$"~"."];nwr(around:12000,'+lat4+','+lon4+')[natural~"^(beach|water)$"][name][~"^(wikidata|wikipedia)$"~"."];nwr(around:12000,'+lat4+','+lon4+')[leisure~"^(park|garden|water_park|nature_reserve)$"][name][~"^(wikidata|wikipedia)$"~"."];);out center 60;';
  const osm=safe(getJson("https://overpass-api.de/api/interpreter",{method:"POST",body:"data="+encodeURIComponent(q),headers:{"Content-Type":"application/x-www-form-urlencoded"}},8000),"OpenStreetMap nearby");
  const [s1,s2,g,o]=await Promise.all([wSights,wAll,wGeo,osm]);
  const addWiki=(d,max)=>{
    if(!d || !d.query || !d.query.pages) return;
    Object.keys(d.query.pages).map(k=>d.query.pages[k]).sort((a,b)=>(a.index||0)-(b.index||0)).forEach(pg=>{
      const c=pg.coordinates && pg.coordinates[0], img=pg.thumbnail && pg.thumbnail.source, desc=String(pg.description||"");
      if(!c || inside.length>=max || junk.test(pg.title) || junk.test(desc) || /\b(film|album|song|novel|tv series|politician|actor|cricketer)\b/i.test(desc)) return;
      if(haversine(p,{lat:Number(c.lat),lon:Number(c.lon)})>IN_KM) return;
      take(inside,pg.title,Number(c.lat),Number(c.lon),/^https:\/\/upload\.wikimedia\.org\//.test(img||"")?img:"",nbKind(pg.title+" "+desc)==="other"?"other":nbKind(pg.title+" "+desc));
    });
  };
  addWiki(s1,38); addWiki(s2,46); addWiki(g,50);
  if(o && Array.isArray(o.elements)) o.elements.map(e=>({e,rank:(e.tags && (e.tags.wikidata||e.tags.wikipedia)?0:1)})).sort((a,b)=>a.rank-b.rank).forEach(x=>{
    const e=x.e, t=e.tags||{}, name=t["name:en"]||t.name||"", lat=Number(e.lat!==undefined?e.lat:e.center && e.center.lat), lon=Number(e.lon!==undefined?e.lon:e.center && e.center.lon);
    const kind=t.natural==="beach"?"beach":t.amenity==="marketplace"?"market":t.tourism==="museum"?"museum":t.amenity==="place_of_worship"?"temple":nbKind(name);
    if(/[A-Za-z]{3}/.test(name) && !junk.test(name) && inside.length<56) take(inside,name,lat,lon,"",kind);
  });
  // 5) the built-in well-known places: close ones belong to the place, the rest are "near"
  const pool=famousPool().map(x=>({x,km:haversine(p,x)})).filter(o=>o.km>0.5).sort((a,b)=>a.km-b.km);
  pool.filter(o=>o.km<=IN_KM).forEach(o=>take(inside,o.x.main,o.x.lat,o.x.lon,"",guessCat(o.x.main)==="city"?"other":nbKind(o.x.main)==="other"?({temple:"temple",beach:"beach",fort:"fort",hill:"nature",wildlife:"nature"})[guessCat(o.x.main)]:nbKind(o.x.main)));
  pool.filter(o=>o.km>IN_KM && o.km<(isWorld()?700:220)).slice(0,10).forEach(o=>take(around,o.x.main,o.x.lat,o.x.lon,"","other"));
  inside.forEach(x=>{ x.grp="in"; }); around.forEach(x=>{ x.grp="near"; });
  const all=inside.concat(around); all.area=area;
  return all;
}
function nearbyCard(p,asked){                          // asked = opened from the place card or the list, so always answer
  return new Promise(async resolve=>{
    if(!places.includes(p)){ resolve(); return; }
    if(asked) toast("🧭 "+T("Looking for places near {0}…",p.name));
    let list=[];
    try{ list=await nearbyFind(p); }catch(e){ console.warn(e); }
    if(!list.length || !places.includes(p)){ if(asked) kidSay(T("I could not find more places near {0}.",p.name),"🧭"); resolve(); return; }
    const card=kidCard('<div class="kid-emoji">🧭</div><h3></h3><div class="sub">'+T("Tick the places you have also visited")+'</div><div class="chips slide nb-chips" id="nbChips"></div><div id="nbList"></div>'
      +'<div class="kid-btns" style="margin-top:12px"><button class="kid-yes" id="nbAdd">'+T("Add ticked places ✅")+'</button><button class="kid-no" id="nbSkip">'+T("Skip")+'</button></div>');
    card.box.querySelector("h3").textContent=T("Been near {0} too?",p.name);
    const box=card.box.querySelector("#nbList"), btn=card.box.querySelector("#nbAdd"), chips=card.box.querySelector("#nbChips");
    const count=()=>{ const n=list.filter(x=>x.box.checked).length; btn.textContent=n?T("Add {0} places ✅",n):T("Add ticked places ✅"); btn.disabled=!n; };
    let grp="";
    list.forEach(x=>{
      if(x.grp!==grp){ grp=x.grp; const hd=mkEl("div","nb-head",grp==="in"?"📍 "+T("In {0}",list.area||p.name):"🧭 "+T("Near {0}",list.area||p.name)); hd.dataset.grp=grp; box.appendChild(hd); }   // first the place itself, then around it
      const row=mkEl("label","kid-row nb-row"), th=mkEl("span","col-th done");
      th.append(mkEl("span","col-em",x.grp==="near"?CATS[guessCat(x.name)][0]:NB_KINDS[x.kind][0]));
      if(x.img){ const im=mkEl("img"); im.alt=""; im.loading="lazy"; im.onerror=()=>im.remove(); im.src=x.img; th.append(im); }
      const mid=mkEl("div"); mid.append(mkEl("b","",(x.star?"⭐ ":"")+x.name),mkEl("small","",(x.grp==="in"?T(NB_KINDS[x.kind][1])+" · ":"")+(x.km<1?T("Less than 1 km away"):T("{0} km away",Math.round(x.km)))));
      const ck=mkEl("input","ph-ck"); ck.type="checkbox"; ck.onchange=count; x.box=ck; x.row=row;
      row.append(th,mid,ck); box.appendChild(row);
    });
    // filter chips: All, then each kind that is in the list
    let show="all";
    const paint=()=>{
      chips.querySelectorAll(".chip").forEach(c=>c.classList.toggle("on",c.dataset.k===show));
      list.forEach(x=>{ x.row.hidden=!(show==="all" || (x.grp==="in" && x.kind===show)); });
      box.querySelectorAll(".nb-head").forEach(hd=>{ hd.hidden=!list.some(x=>x.grp===hd.dataset.grp && !x.row.hidden); });
      box.scrollTop=0;
    };
    const kinds=Object.keys(NB_KINDS).filter(k=>list.some(x=>x.grp==="in" && x.kind===k));
    if(kinds.length>1) [["all",T("All")+" ("+list.length+")"]].concat(kinds.map(k=>[k,NB_KINDS[k][0]+" "+T(NB_KINDS[k][1])+" ("+list.filter(x=>x.grp==="in" && x.kind===k).length+")"])).forEach(d=>{
      const c=mkEl("button","chip",d[1]); c.type="button"; c.dataset.k=d[0]; c.onclick=()=>{ show=d[0]; paint(); }; chips.appendChild(c);
    });
    else chips.hidden=true;
    paint(); count();
    card.box.querySelector("#nbSkip").onclick=card.close;
    btn.onclick=()=>{
      const picked=list.filter(x=>x.box.checked);
      picked.forEach(x=>{
        const np={name:x.name,lat:x.lat,lon:x.lon,status:"visited",cat:(x.grp==="in" && NB_CAT[x.kind]) || guessCat(x.name)};
        if(p.year) np.year=p.year;                              // same trip, same year
        if(isWorld()) np.country=p.country||stateOf(p)||"";
        places.push(np);
      });
      card.close(); showEverything(); render();
      toast("✅ "+(picked.length===1?T("{0} place",1):T("{0} places",picked.length))+" · "+T("Added ✓"));
    };
    whenClosed(card).then(resolve);
  });
}
const nearbyToggle=document.getElementById("nearbyToggle");
nearbyToggle.checked=lsGet("myNearbyOnV1",true)!==false;
nearbyToggle.addEventListener("change",()=>lsSet("myNearbyOnV1",nearbyToggle.checked));

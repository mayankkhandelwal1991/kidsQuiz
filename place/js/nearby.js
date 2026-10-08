/* My Travel Map · nearby.js
   "Been near here too?" tick list after adding a place. */
// ---- After adding a place: tick other places nearby that you have also visited ----
// First the sights inside the place itself (within about 12 km), then well-known places around it.
async function nearbyFind(p){
  const inside=[], around=[], seen=new Set([norm(p.name)]);
  const junk=/\b(station|school|college|university|institute|hospital|constituency|district|division|airport|stadium|metro|road|highway|company|ltd|bank|election|tehsil|taluk|ward|municipal|corporation|assembly|lok sabha|junction|academy|campus|hostel|office|court|police|colony|nagar)\b|^list of|\d{4}/i;
  const take=(list,name,lat,lon,img)=>{
    const k=norm(name);
    if(!k || k.length<3 || seen.has(k) || !Number.isFinite(lat) || !Number.isFinite(lon) || !inBounds(lat,lon) || places.some(q=>norm(q.name)===k)) return;
    seen.add(k); list.push({name:String(name).slice(0,80),lat,lon,img:img||"",km:haversine(p,{lat,lon})});
  };
  const getJson=async(url,opt,ms)=>{ const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),ms); try{ return await (await fetch(url,Object.assign({signal:ctl.signal},opt||{}))).json(); } finally{ clearTimeout(t); } };
  const ll=p.lat.toFixed(4)+","+p.lon.toFixed(4);
  // 1) Wikipedia: articles located within 10 km   2) OpenStreetMap: named sights, forts, museums, famous temples and parks within 9 km
  const wiki=getJson("https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord="+p.lat.toFixed(4)+"%7C"+p.lon.toFixed(4)+"&ggsradius=10000&ggslimit=40&prop=coordinates%7Cpageimages&piprop=thumbnail&pithumbsize=120&colimit=40&pilimit=40",null,6000).catch(e=>{ console.warn("Wikipedia nearby failed.",e); return null; });
  const q='[out:json][timeout:7];(nwr(around:9000,'+ll+')[tourism~"^(attraction|museum|viewpoint|zoo|theme_park|gallery)$"][name];nwr(around:9000,'+ll+')[historic~"^(fort|castle|monument|palace|ruins|memorial|archaeological_site|temple|tomb|city_gate)$"][name];nwr(around:9000,'+ll+')[amenity=place_of_worship][name][~"^(wikidata|wikipedia|tourism)$"~"."];nwr(around:9000,'+ll+')[leisure~"^(park|garden|water_park|nature_reserve)$"][name][~"^(wikidata|wikipedia)$"~"."];);out center 50;';
  const osm=getJson("https://overpass-api.de/api/interpreter",{method:"POST",body:"data="+encodeURIComponent(q),headers:{"Content-Type":"application/x-www-form-urlencoded"}},8000).catch(e=>{ console.warn("OpenStreetMap nearby failed.",e); return null; });
  const [w,o]=await Promise.all([wiki,osm]);
  if(w && w.query && w.query.pages) Object.keys(w.query.pages).map(k=>w.query.pages[k]).sort((a,b)=>(a.index||0)-(b.index||0)).forEach(pg=>{
    const c=pg.coordinates && pg.coordinates[0], img=pg.thumbnail && pg.thumbnail.source;
    if(c && !junk.test(pg.title) && inside.length<10) take(inside,pg.title,Number(c.lat),Number(c.lon),/^https:\/\/upload\.wikimedia\.org\//.test(img||"")?img:"");
  });
  if(o && Array.isArray(o.elements)) o.elements.map(e=>({e,rank:(e.tags && (e.tags.wikidata||e.tags.wikipedia)?0:1)})).sort((a,b)=>a.rank-b.rank).forEach(x=>{
    const e=x.e, t=e.tags||{}, name=t["name:en"]||t.name||"", lat=Number(e.lat!==undefined?e.lat:e.center && e.center.lat), lon=Number(e.lon!==undefined?e.lon:e.center && e.center.lon);
    if(/[A-Za-z]{3}/.test(name) && !junk.test(name) && inside.length<14) take(inside,name,lat,lon,"");
  });
  inside.sort((a,b)=>a.km-b.km).forEach(x=>{ x.grp="in"; });
  famousPool().map(x=>({x,km:haversine(p,x)})).filter(o=>o.km>12 && o.km<(isWorld()?700:220)).sort((a,b)=>a.km-b.km).slice(0,8)      // well-known places in the area
    .forEach(o=>take(around,o.x.main,o.x.lat,o.x.lon,""));
  famousPool().map(x=>({x,km:haversine(p,x)})).filter(o=>o.km>0.5 && o.km<=12).forEach(o=>{ const n=inside.length; take(inside,o.x.main,o.x.lat,o.x.lon,""); if(inside.length>n) inside[inside.length-1].grp="in"; });
  around.forEach(x=>{ x.grp="near"; });
  return inside.concat(around).slice(0,22);
}
function nearbyCard(p,asked){                          // asked = opened from the place card, so always answer
  return new Promise(async resolve=>{
    if(!places.includes(p)){ resolve(); return; }
    if(asked) toast("🧭 "+T("Looking for places near {0}…",p.name));
    let list=[];
    try{ list=await nearbyFind(p); }catch(e){ console.warn(e); }
    if(!list.length || !places.includes(p)){ if(asked) kidSay(T("I could not find more places near {0}.",p.name),"🧭"); resolve(); return; }
    const card=kidCard('<div class="kid-emoji">🧭</div><h3></h3><div class="sub">'+T("Tick the places you have also visited")+'</div><div id="nbList"></div>'
      +'<div class="kid-btns" style="margin-top:12px"><button class="kid-yes" id="nbAdd">'+T("Add ticked places ✅")+'</button><button class="kid-no" id="nbSkip">'+T("Skip")+'</button></div>');
    card.box.querySelector("h3").textContent=T("Been near {0} too?",p.name);
    const box=card.box.querySelector("#nbList"), btn=card.box.querySelector("#nbAdd");
    const count=()=>{ const n=box.querySelectorAll("input:checked").length; btn.textContent=n?T("Add {0} places ✅",n):T("Add ticked places ✅"); btn.disabled=!n; };
    let grp="";
    list.forEach(x=>{
      if(x.grp!==grp){ grp=x.grp; box.appendChild(mkEl("div","nb-head",grp==="in"?"📍 "+T("In {0}",p.name):"🧭 "+T("Near {0}",p.name))); }   // first the place itself, then around it
      const row=mkEl("label","kid-row nb-row"), th=mkEl("span","col-th done");
      th.append(mkEl("span","col-em",CATS[guessCat(x.name)][0]));
      if(x.img){ const im=mkEl("img"); im.alt=""; im.loading="lazy"; im.onerror=()=>im.remove(); im.src=x.img; th.append(im); }
      const mid=mkEl("div"); mid.append(mkEl("b","",x.name),mkEl("small","",x.km<1?T("Less than 1 km away"):T("{0} km away",Math.round(x.km))));
      const ck=mkEl("input","ph-ck"); ck.type="checkbox"; ck.onchange=count; x.box=ck;
      row.append(th,mid,ck); box.appendChild(row);
    });
    count();
    card.box.querySelector("#nbSkip").onclick=card.close;
    btn.onclick=()=>{
      const picked=list.filter(x=>x.box.checked);
      picked.forEach(x=>{
        const np={name:x.name,lat:x.lat,lon:x.lon,status:"visited",cat:guessCat(x.name)};
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

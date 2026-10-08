/* My Travel Map · add-place.js
   Adding one place or several at once. */
// ---- Several places at once, separated by commas ----
const pickedCoords=new Map();          // places chosen from the suggestions while typing a list
async function findPlace(name,politeWait){
  const hit=pickedCoords.get(norm(name)) || LOCAL_PLACES.find(p=>norm(p.main)===norm(name));
  if(hit) return {name:hit.main,lat:Number(hit.lat),lon:Number(hit.lon),cat:hit.cat,country:String(hit.sub||"").split(", ").pop()};
  try{
    if(politeWait) await sleep(1100);                  // the free place search allows one question a second
    const r=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1"+(isWorld()?"":"&countrycodes=in")+"&addressdetails=1&accept-language=en&q="+encodeURIComponent(name),{headers:{"Accept":"application/json"}});
    const d=await r.json();
    if(d.length) return {name:d[0].name||name,lat:Number(d[0].lat),lon:Number(d[0].lon),country:(d[0].address||{}).country};
  }catch(e){ console.warn("Place search failed for "+name,e); }
  if(groqReady()){
    try{
      const g=await groqChat([{role:"system",content:"You are a precise India geography assistant. Return only valid JSON."},
        {role:"user",content:'Give the approximate coordinates of this place in India: '+name+'\nReturn ONLY JSON: {"name":"canonical place name","lat":0.0000,"lon":0.0000}'}],200);
      if(g.name && Number.isFinite(Number(g.lat)) && Number.isFinite(Number(g.lon))) return {name:String(g.name),lat:Number(g.lat),lon:Number(g.lon)};
    }catch(e){ console.warn("Groq could not find "+name,e); }
  }
  return null;
}
async function addMany(parts){
  const seen=new Set(), names=parts.map(t=>t.trim()).filter(t=>t && !seen.has(norm(t)) && seen.add(norm(t))).slice(0,30);
  if(!names.length){ kidSay(T("Oopsie! Type a place name first!"),"✏️"); return; }
  hideSuggestions();
  const input=document.getElementById("placeName"), note=document.getElementById("aiStatus");
  const status=document.querySelector("#statusSeg button.on").dataset.v, picked=document.getElementById("catSel").value;
  const added=[], dups=[], miss=[];
  let online=0;
  input.disabled=true;
  for(let i=0;i<names.length;i++){
    note.textContent=T("Adding {0} of {1}: {2}…",i+1,names.length,names[i]);
    const local=pickedCoords.has(norm(names[i])) || LOCAL_PLACES.some(p=>norm(p.main)===norm(names[i]));
    const r=await findPlace(names[i],!local && online++>0);
    if(!r || !(inBounds(r.lat,r.lon))){ miss.push(names[i]); continue; }
    if(findDuplicate(r.name,r.lat,r.lon)){ dups.push(r.name); continue; }
    const np={name:r.name,lat:r.lat,lon:r.lon,status,cat:picked || (CATS[r.cat]?r.cat:guessCat(r.name))};
    if(isWorld() && r.country) np.country=String(r.country).slice(0,60);
    places.push(np);
    added.push(r.name);
  }
  input.disabled=false; note.textContent="";
  input.value=miss.join(", ");                       // names I could not find stay in the box to fix
  delete input.dataset.lat; delete input.dataset.lon; delete input.dataset.selectedName; delete input.dataset.cat; delete input.dataset.sub;
  document.getElementById("catSel").value="";
  pickedCoords.clear();
  if(added.length) showEverything();
  render();
  const msg=[];
  if(added.length) msg.push(T("Added {0}: {1}.",added.length,added.join(", ")));
  if(dups.length) msg.push(T("Already on your map: {0}.",dups.join(", ")));
  if(miss.length) msg.push(T("Could not find: {0}. Check the spelling and try again.",miss.join(", ")));
  kidSay(msg.join(" "),added.length?"🎉":"🔍");
}

function addResolvedPlace(name,lat,lon,cat,country){
  if(!inBounds(lat,lon)){
    kidSay(isWorld()?T("Uh-oh! That place is off my map!"):T("Uh-oh! That place is not in India!"),"🌏");
    return false;
  }

  const dup=findDuplicate(name,lat,lon);
  if(dup){
    kidSay(T("{0} is already on your map, silly!",dup.name),"🙃");
    return false;
  }

  const status=document.querySelector("#statusSeg button.on").dataset.v;
  const picked=document.getElementById("catSel").value;
  const np={name,lat,lon,status,cat:picked || (CATS[cat]?cat:guessCat(name))};
  if(isWorld() && country) np.country=String(country).slice(0,60);
  places.push(np);
  if(fStatus!=="all" && fStatus!==status) fStatus="all";      // make sure the new pin is visible
  fCat="all"; fYear="all"; fFav=false;

  const input=document.getElementById("placeName");
  input.value="";
  delete input.dataset.lat;
  delete input.dataset.lon;
  delete input.dataset.selectedName;
  delete input.dataset.cat; delete input.dataset.sub;
  document.getElementById("catSel").value="";

  render();
  if(status==="visited" && lsGet("myNearbyOnV1",true)!==false) badgeQueue=badgeQueue.then(()=>nearbyCard(np));   // "been nearby too?" list
  return true;
}

async function addPlaceWithGroq(name){
  if(!GROQ_API_KEY || GROQ_API_KEY==="PASTE_YOUR_GROQ_API_KEY_HERE"){
    kidSay(T("Please add your Groq API key in the GROQ_API_KEY constant in this HTML file."),"🔑");
    return;
  }

  const status=document.getElementById("aiStatus");
  status.textContent="Groq AI is finding the place…";

  const prompt=`Identify this Indian travel place and return its approximate geographic coordinates.

Place: ${name}

Return ONLY JSON:
{"name":"canonical place name","lat":0.0000,"lon":0.0000}

Rules:
- The place must be in India.
- For a city use the city center.
- For a tourist attraction use the attraction's approximate coordinates.
- Latitude must be between 5 and 38.
- Longitude must be between 65 and 100.
- No markdown or explanation.`;

  try{
    const result=await groqChat([
      {role:"system",content:"You are a precise India geography assistant. Return only valid JSON."},
      {role:"user",content:prompt}
    ],250);
    const lat=Number(result.lat), lon=Number(result.lon);

    if(!result.name || !Number.isFinite(lat) || !Number.isFinite(lon)){
      throw new Error("Groq returned invalid location data.");
    }

    status.textContent=addResolvedPlace(result.name,lat,lon) ? "Added: "+result.name : "";
  }catch(e){
    status.textContent="Groq error: "+e.message;
    kidSay(T("Hmm, I could not find that place! Try picking one from the suggestions."),"🔍");
  }
}

async function removePlace(p){
  if(await kidAsk(T("Bye-bye {0}? Really take it off the map?",p.name),{emoji:"🥺",yes:T("Yes, bye-bye! 👋"),no:T("No, keep it! 💖")})){
    const k=places.indexOf(p);
    if(k>-1){places.splice(k,1);render();}
    return true;
  }
  return false;
}
async function resetPlaces(){
  if(!ownPlaces().length){ kidSay(T("Your map is already empty! Add a place first."),"🗺️"); return; }
  if(await kidAsk(T("Whoa! Wipe ALL {0} places off the map and start fresh?",ownPlaces().length),{emoji:"🙈",yes:T("Yes, start over! 🔄"),no:T("Nooo, keep them! 🛑")})){
    places=[]; linkIndia(); fStatus="all"; fCat="all"; fYear="all"; fFav=false;
    const input=document.getElementById("placeName");
    input.value=""; delete input.dataset.lat; delete input.dataset.lon; delete input.dataset.selectedName; delete input.dataset.cat; delete input.dataset.sub;
    hideSuggestions();
    render();
  }
}

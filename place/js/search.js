/* My Travel Map · search.js
   Place search suggestions (built-in list, Groq, online search) and small popups. */
// ---- Photo icon for each added place (from Wikipedia; emoji icon if none) ----
const imgPending=new Set();
async function findPlaceImage(name){
  const url="https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=200&generator=search&gsrlimit=4&gsrsearch="+encodeURIComponent(name+(isWorld()?"":" India"));
  const r=await fetch(url);
  const d=await r.json();
  const pages=Object.values(d.query?.pages||{}).sort((a,b)=>a.index-b.index);
  const hit=pages.find(x=>x.thumbnail && x.thumbnail.source);
  return hit ? hit.thumbnail.source : "";
}
async function loadPlaceImage(p){
  if(imgPending.has(p)) return;
  imgPending.add(p);
  try{
    p.img=await findPlaceImage(p.name);   // "" = no photo exists, keep emoji icon
    if(places.includes(p)) render();
  }catch(e){
    console.warn("Photo lookup failed for "+p.name+"; will retry next time.",e);
  }
}

// ---- Playful popups (used instead of the browser's alert/confirm) ----
function kidPopup(msg,opt){
  opt=opt||{};
  return new Promise(resolve=>{
    const ov=document.createElement("div");
    ov.className="kid-overlay";
    ov.innerHTML='<div class="kid-box" role="dialog" aria-modal="true"><div class="kid-emoji"></div><div class="kid-msg"></div><div class="kid-btns"></div></div>';
    ov.querySelector(".kid-emoji").textContent=opt.emoji||"🤔";
    ov.querySelector(".kid-msg").textContent=msg;
    const btns=ov.querySelector(".kid-btns");
    const done=v=>{document.removeEventListener("keydown",onKey);ov.remove();resolve(v);};
    const onKey=e=>{ if(e.key==="Escape") done(false); };
    const mk=(cls,text,val)=>{const b=document.createElement("button");b.className=cls;b.textContent=text;b.onclick=()=>done(val);btns.appendChild(b);return b;};
    const yes=mk("kid-yes",opt.yes||T("Yes yes! 🎉"),true);
    if(opt.no!==null) mk("kid-no",opt.no||T("Nooo 🙈"),false);
    document.addEventListener("keydown",onKey);
    document.body.appendChild(ov);
    yes.focus();
  });
}
function kidAsk(msg,opt){return kidPopup(msg,opt);}
function kidSay(msg,emoji){return kidPopup(msg,{emoji:emoji||"🙊",yes:T("Okie dokie! 👍"),no:null});}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}


let suggestTimer=null, suggestController=null;

// Well-known India places: these make suggestions appear instantly, even with no internet or API key.

function localSuggest(q){
  const k=norm(q); if(!k) return [];
  const starts=[], has=[];
  for(const p of LOCAL_PLACES){
    const n=norm(p.main);
    if(n.startsWith(k)) starts.push(p); else if(k.length>=3 && (n.includes(k) || norm(p.sub).startsWith(k))) has.push(p);
  }
  return starts.concat(has).slice(0,6);
}
function mergeSuggestions(a,b){
  const seen=new Set(), out=[];
  for(const x of a.concat(b)){ const k=norm(x.main); if(!k || seen.has(k)) continue; seen.add(k); out.push(x); }
  return out.slice(0,8);
}
function showSuggestions(list,loading){
  const box=document.getElementById("suggestions");
  box.innerHTML="";
  list.forEach(x=>{
    const div=document.createElement("div");
    div.className="suggestion";
    div.innerHTML="<b>"+escapeHtml(x.main)+"</b><small>"+escapeHtml(x.sub)+"</small>";
    div.onclick=()=>{
      const input=document.getElementById("placeName");
      if(input.value.includes(",")){                 // several places: finish this name and keep typing
        pickedCoords.set(norm(x.main),x);
        const parts=input.value.split(","); parts.pop();
        input.value=parts.map(t=>t.trim()).filter(Boolean).concat(x.main).join(", ")+", ";
        delete input.dataset.selectedName;
        hideSuggestions(); input.focus();
        return;
      }
      input.value=x.main;
      input.dataset.lat=x.lat;
      input.dataset.lon=x.lon;
      input.dataset.selectedName=x.main;
      input.dataset.cat=x.cat||"";
      input.dataset.sub=x.sub||"";
      hideSuggestions();
    };
    box.appendChild(div);
  });
  if(!list.length){
    box.innerHTML=loading ? '<div class="suggestion"><small>'+T("Searching…")+'</small></div>'
      : '<div class="suggestion"><b>'+(isWorld()?T("No place found"):T("No India place found"))+'</b><small>'+T("Try city, temple, tourist place or state name")+'</small></div>';
  }
  box.hidden=false;
}

function onPlaceInput(){
  const input=document.getElementById("placeName");
  const q=input.value.split(",").pop().trim();     // with commas: suggest for the name being typed now
  clearTimeout(suggestTimer);
  if(suggestController) suggestController.abort();
  if(q.length<2){ hideSuggestions(); return; }
  showSuggestions(mergeSuggestions(localSuggest(q),suggestCache.get(q.toLowerCase())||[]),true);   // instant
  suggestTimer=setTimeout(()=>fetchSuggestions(q),300);                                          // then smarter results
}
document.getElementById("placeName").addEventListener("input", onPlaceInput);
document.getElementById("placeName").addEventListener("focus", onPlaceInput);

document.getElementById("placeName").addEventListener("keydown", function(e){
  if(e.key==="Escape") hideSuggestions();
  if(e.key==="Enter"){
    const first=document.querySelector(".suggestion b");
    if(first && !document.getElementById("suggestions").hidden && first.parentNode.onclick)first.parentNode.click();   // Enter = take the top suggestion
    e.preventDefault(); addPlace();
  }
});

document.addEventListener("click",function(e){
  if(!e.target.closest(".autocomplete")) hideSuggestions();
});

function groqReady(){return !!GROQ_API_KEY && GROQ_API_KEY.indexOf("PASTE_YOUR")!==0;}
const suggestCache=new Map();

// Calls Groq; if the chosen model is not available it automatically tries the next one.
let groqModels=[GROQ_MODEL,"llama-3.3-70b-versatile","llama-3.1-8b-instant"].filter((m,i,a)=>m && a.indexOf(m)===i);
function worldify(t){
  return String(t).replace(/, India,/g,",").replace(/inside India \(lat 5-38, lon 65-100\)/g,"anywhere in the world").replace(/state or union territory/g,"country")
    .replace(/"state":"state"/g,'"state":"country"').replace(/Prefer states I have not visited/g,"Prefer countries I have not visited").replace(/which state they are in/g,"which country they are in")
    .replace(/- Latitude must be between 5 and 38\.\n?/g,"").replace(/- Longitude must be between 65 and 100\.\n?/g,"").replace(/\bIndian\b/g,"world").replace(/\bIndia\b/g,"the world");
}
async function groqChat(messages,maxTokens,signal){
  if(isWorld()) messages=messages.map(m=>({role:m.role,content:worldify(m.content)}));
  let lastErr=null;
  for(const model of groqModels.slice()){
    const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      signal,
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+GROQ_API_KEY},
      body:JSON.stringify({model,messages,temperature:0.1,max_tokens:maxTokens,response_format:{type:"json_object"}})
    });
    const data=await r.json().catch(()=>({}));
    if(r.ok){
      groqModels=[model].concat(groqModels.filter(m=>m!==model));   // remember the model that works
      return JSON.parse(data.choices?.[0]?.message?.content || "{}");
    }
    lastErr=new Error(data.error?.message || ("Groq API request failed ("+r.status+")."));
    if(r.status===401 || r.status===429) break;                     // wrong key / rate limit: other models won't help
  }
  throw lastErr || new Error("Groq API request failed.");
}

// Ask Groq for India place names matching what the user has typed so far.
async function groqSuggest(q,signal){
  const out=await groqChat([
    {role:"system",content:"You are an autocomplete engine for places in India. Return only valid JSON."},
    {role:"user",content:`The user is typing an India place name. Typed so far: "${q}"

Suggest up to 6 real places in India (cities, towns, states, temples, tourist attractions) whose name starts with or closely matches the typed text, most well-known first. Tolerate spelling mistakes.

Return ONLY JSON:
{"suggestions":[{"name":"place name","state":"state or union territory","lat":0.0000,"lon":0.0000,"category":"temple|beach|hill|fort|wildlife|city"}]}

Rules:
- Only places inside India (lat 5-38, lon 65-100).
- No duplicates, no markdown, no explanation.`}
  ],600,signal);
  const list=out.suggestions;
  return (Array.isArray(list)?list:[]).map(x=>({main:String(x.name||"").trim(),sub:String(x.state||"").trim(),lat:Number(x.lat),lon:Number(x.lon),cat:String(x.category||"").trim()}))
    .filter(x=>x.main && inBounds(x.lat,x.lon));
}

// Free place search made for autocomplete (used when Groq is not set up or fails).
async function photonSuggest(q,signal){
  const r=await fetch("https://photon.komoot.io/api/?limit=8&lang=en"+(isWorld()?"":"&bbox=68,6,97.5,37.5")+"&q="+encodeURIComponent(q),{signal});
  const data=await r.json();
  return (data.features||[]).filter(f=>f.properties && (isWorld() || f.properties.countrycode==="IN") && f.properties.name).map(f=>({
    main:f.properties.name,
    sub:[f.properties.county||f.properties.city,f.properties.state,isWorld()?f.properties.country:null].filter((v,i,a)=>v && v!==f.properties.name && a.indexOf(v)===i).join(", "),
    lat:Number(f.geometry.coordinates[1]),lon:Number(f.geometry.coordinates[0])}));
}

async function fetchSuggestions(q){
  const controller=suggestController=new AbortController();
  const key=q.toLowerCase();
  const status=document.getElementById("aiStatus");
  try{
    let remote=suggestCache.get(key);
    if(!remote){
      remote=[];
      if(groqReady()){
        try{ remote=await groqSuggest(q,controller.signal); status.textContent=""; }
        catch(e){
          if(e.name==="AbortError") throw e;
          console.warn("Groq suggestions failed.",e);
          status.textContent="Groq suggestions are off: "+e.message;
        }
      }
      if(!remote.length){
        try{ remote=await photonSuggest(q,controller.signal); }
        catch(e){ if(e.name==="AbortError") throw e; console.warn("Online place search failed.",e); }
      }
      suggestCache.set(key,remote);
    }
    // Ignore answers that arrive after the user has typed something else.
    const input=document.getElementById("placeName");
    if(controller!==suggestController || input.value.split(",").pop().trim()!==q || document.activeElement!==input) return;
    showSuggestions(mergeSuggestions(localSuggest(q),remote),false);
  }catch(e){
    if(e.name!=="AbortError") console.warn("Autocomplete error",e);
  }
}

function hideSuggestions(){
  const box=document.getElementById("suggestions");
  if(box){box.hidden=true;box.innerHTML="";}
}

async function addPlace(){
  const name=document.getElementById("placeName").value.trim();
  if(!name) { kidSay(T("Oopsie! Type a place name first!"),"✏️"); return; }

  hideSuggestions();

  // If the user selected an autocomplete result, coordinates are stored
  // temporarily in data attributes and are never shown in the UI.
  const input=document.getElementById("placeName");
  const selectedLat=Number(input.dataset.lat);
  const selectedLon=Number(input.dataset.lon);
  const selectedName=input.dataset.selectedName;

  if(selectedName===name && Number.isFinite(selectedLat) && Number.isFinite(selectedLon)){
    addResolvedPlace(selectedName,selectedLat,selectedLon,input.dataset.cat,String(input.dataset.sub||"").split(", ").pop());
    return;
  }

  if(name.includes(",")){ await addMany(name.split(",")); return; }      // "Jaipur, Agra, Goa" = add them all in one go

  const known=LOCAL_PLACES.find(p=>norm(p.main)===norm(name));
  if(known){ addResolvedPlace(known.main,known.lat,known.lon,undefined,known.sub.split(", ").pop()); return; }

  // Try normal India geocoding first.
  try{
    input.disabled=true;
    const url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1"+(isWorld()?"":"&countrycodes=in")+"&addressdetails=1&accept-language=en&q="+encodeURIComponent(name);
    const r=await fetch(url,{headers:{"Accept":"application/json"}});
    const data=await r.json();
    if(data.length){
      addResolvedPlace(data[0].name || name,Number(data[0].lat),Number(data[0].lon),undefined,(data[0].address||{}).country);
      return;
    }
  }catch(e){
    console.warn("Geocoding failed; trying Groq.",e);
  }finally{
    input.disabled=false;
  }

  await addPlaceWithGroq(name);
}

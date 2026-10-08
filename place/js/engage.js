/* My Travel Map · engage.js
   Levels, daily question, monthly challenge, collections, passport, progress, facts, India/World switch. */
// =====================================================================
//  ENGAGEMENT: levels, daily question, monthly challenge, memories,
//  collections, passport stamps, celebrations
// =====================================================================
function ymd(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function todayStr(){ return ymd(new Date()); }
function lsGet(k,def){ try{ const v=JSON.parse(localStorage.getItem(k)); return v==null?def:v; }catch(e){ return def; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ console.warn(e); } }
function mkEl(tag,cls,text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!==undefined) e.textContent=text; return e; }

// ---- celebrations ----
function chime(){
  if(lsGet("myIndiaSoundV2",true)===false) return;
  try{
    const A=chime.ctx || (chime.ctx=new (window.AudioContext||window.webkitAudioContext)());
    [523,659,784,1047].forEach((f,i)=>{
      const o=A.createOscillator(), g=A.createGain(), t=A.currentTime+i*0.09;
      o.type="triangle"; o.frequency.value=f;
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.16,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
      o.connect(g); g.connect(A.destination); o.start(t); o.stop(t+0.32);
    });
  }catch(e){}
}
function confetti(){
  chime();
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c=mkEl("canvas","confetti"); c.width=innerWidth; c.height=innerHeight; document.body.appendChild(c);
  const x=c.getContext("2d"), cols=["#ff9933","#138808","#1264d6","#f5b301","#e6492d","#b487de","#ffffff"];
  const P=Array.from({length:120},()=>({x:c.width/2+(Math.random()-.5)*140,y:c.height*.38,vx:(Math.random()-.5)*15,vy:-Math.random()*14-4,s:5+Math.random()*7,c:cols[Math.floor(Math.random()*cols.length)],r:Math.random()*6}));
  const t0=performance.now();
  const frame=t=>{
    const k=(t-t0)/1900;
    x.clearRect(0,0,c.width,c.height);
    P.forEach(p=>{ p.vy+=.38; p.x+=p.vx; p.y+=p.vy; p.r+=.2; x.save(); x.translate(p.x,p.y); x.rotate(p.r); x.globalAlpha=Math.max(0,1-k); x.fillStyle=p.c; x.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6); x.restore(); });
    if(k<1) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}
function toast(msg){
  const t=mkEl("div","toast",msg); document.body.appendChild(t);
  setTimeout(()=>t.remove(),3200);
}
function kidPrompt(msg,emoji,def){
  return new Promise(resolve=>{
    const card=kidCard('<div class="kid-emoji"></div><div class="kid-msg"></div><input id="kpIn" maxlength="40" autocomplete="off"><div class="kid-btns" style="margin-top:12px"><button class="kid-yes">OK 👍</button></div>');
    card.box.querySelector(".kid-emoji").textContent=emoji;
    card.box.querySelector(".kid-msg").textContent=msg;
    const inp=card.box.querySelector("#kpIn"); inp.value=def||"";
    const ok=()=>{ const v=inp.value.trim(); card.close(); resolve(v); };
    card.box.querySelector(".kid-yes").onclick=ok;
    inp.addEventListener("keydown",e=>{ if(e.key==="Enter") ok(); });
    inp.focus();
  });
}

// ---- themed collections ----
const NEAR_KM=35;
const INDIA_COLS=[
  {id:"jyoti",e:"🔱",n:"12 Jyotirlingas",items:[["Somnath",20.888,70.401],["Mallikarjuna (Srisailam)",16.074,78.868],["Mahakaleshwar (Ujjain)",23.183,75.768],["Omkareshwar",22.245,76.151],["Kedarnath",30.735,79.067],["Bhimashankar",19.072,73.536],["Kashi Vishwanath (Varanasi)",25.311,83.011],["Trimbakeshwar (Nashik)",19.932,73.531],["Baidyanath (Deoghar)",24.492,86.700],["Nageshwar (Dwarka)",22.336,69.087],["Rameswaram",9.288,79.317],["Grishneshwar (Ellora)",20.025,75.170]]},
  {id:"dham",e:"🛕",n:"Char Dham",items:[["Badrinath",30.744,79.493],["Dwarka",22.238,68.968],["Puri",19.805,85.818],["Rameswaram",9.288,79.317]]},
  {id:"golden",e:"🔺",n:"Golden Triangle",items:[["Delhi",28.614,77.209],["Agra",27.177,78.008],["Jaipur",26.912,75.787]]},
  {id:"unesco",e:"🏛️",n:"World Heritage Wonders",items:[["Taj Mahal (Agra)",27.175,78.042],["Hampi",15.335,76.460],["Khajuraho",24.852,79.922],["Ajanta Caves",20.552,75.703],["Ellora Caves",20.026,75.179],["Konark Sun Temple",19.887,86.095],["Mahabalipuram",12.617,80.199],["Qutub Minar (Delhi)",28.524,77.185],["Kaziranga",26.578,93.171,60],["Sundarbans",21.95,88.90,70]]},
  {id:"metro",e:"🏙️",n:"Big Six Cities",items:[["Delhi",28.614,77.209],["Mumbai",19.076,72.878],["Kolkata",22.573,88.364],["Chennai",13.083,80.270],["Bengaluru",12.972,77.595],["Hyderabad",17.385,78.487]]},
  {id:"sisters",e:"🌄",n:"Seven Sisters",states:["Arunachal Pradesh","Assam","Meghalaya","Manipur","Mizoram","Nagaland","Tripura"]},
  {id:"coast",e:"🌊",n:"Coastline States",states:["Gujarat","Maharashtra","Goa","Karnataka","Kerala","Tamil Nadu","Andhra Pradesh","Odisha","West Bengal"]},
  {id:"himalaya",e:"🏔️",n:"Himalayan States",states:["Jammu and Kashmir","Ladakh","Himachal Pradesh","Uttarakhand","Sikkim","Arunachal Pradesh"]}
];
const WORLD_COLS=[
  {id:"w_cont",e:"🌍",n:"Six Continents",conts:["Asia","Europe","Africa","North America","South America","Oceania"]},
  {id:"w_wonders",e:"🏛️",n:"New Seven Wonders",items:[["Taj Mahal (India)",27.175,78.042],["Great Wall of China",40.432,116.570,120],["Petra (Jordan)",30.329,35.444],["Colosseum (Rome)",41.890,12.492],["Chichen Itza (Mexico)",20.684,-88.568],["Machu Picchu (Peru)",-13.163,-72.545,80],["Christ the Redeemer (Rio)",-22.952,-43.211]]},
  {id:"w_neigh",e:"🤝",n:"India’s Neighbours",states:["Nepal","Bhutan","Sri Lanka","Bangladesh","Maldives","Myanmar"]},
  {id:"w_sea",e:"🌴",n:"Southeast Asia",states:["Thailand","Singapore","Malaysia","Indonesia","Vietnam","Cambodia"]},
  {id:"w_cities",e:"🌆",n:"Great World Cities",items:[["London",51.507,-0.128],["Paris",48.857,2.352],["New York",40.713,-74.006],["Tokyo",35.676,139.650],["Dubai",25.205,55.271],["Singapore",1.352,103.820],["Sydney",-33.869,151.209],["Rome",41.903,12.496]]}
];
function COLS(){ return isWorld()?WORLD_COLS:INDIA_COLS; }
function collectionProgress(c,st){
  if(c.conts) return c.conts.map(k=>({label:T(k),done:st.conts.has(k)}));
  if(c.states) return c.states.map(s=>({label:stName(s),done:st.regions.has(s)}));
  const vis=places.filter(p=>p.status==="visited");
  return c.items.map(it=>({label:it[0],lat:it[1],lon:it[2],done:vis.some(p=>haversine(p,{lat:it[1],lon:it[2]})<(it[3]||NEAR_KM))}));
}

// ---- points and levels ----
const LEVELS=[[0,"🎒","Tourist"],[150,"🧭","Explorer"],[400,"🚶","Wanderer"],[800,"🛤️","Yatri"],[1500,"🦅","Ghumakkad"],[2500,"🏆","Bharat Yatri"],[4000,"👑","Bharat Champion"]];
function engageState(){
  const st=getStats();
  const cols=COLS().map(c=>{ const pr=collectionProgress(c,st); return {c,pr,done:pr.filter(x=>x.done).length}; });
  const colDone=cols.filter(x=>x.done===x.pr.length).length;
  const daily=lsGet("myIndiaDailyV2",{}), monthly=lsGet("myIndiaMonthlyV2",[]), badges=BADGES.filter(b=>b.t(st)).length;
  const xp=st.v*10+st.states*50+st.uts*30+st.w*2+st.mem*5+st.rated*2+badges*20+colDone*100+monthly.length*50+(daily.best||0)*5
    +lsGet(mk("myMysteryV1"),[]).length*30+Math.floor((lsGet(mk("myPinDropV1"),{}).best||0)/10)+Math.floor((lsGet(mk("myGuessV1"),{}).best||0)/10);
  let lvl=0; LEVELS.forEach((L,i)=>{ if(xp>=L[0]) lvl=i; });
  return {st,cols,colDone,xp,lvl,badges,daily,monthly};
}

// ---- monthly challenge (a new one every month) ----
const MONTHLY=[
  {t:"new",n:2,txt:"Add 2 places you visited"},{t:"cat",cat:"hill",n:1,txt:"Add a hill station you visited"},{t:"wish",n:3,txt:"Put 3 dream places on your wishlist"},
  {t:"cat",cat:"temple",n:1,txt:"Add a temple you visited"},{t:"state",n:1,txt:"Colour in 1 new state"},{t:"cat",cat:"beach",n:1,txt:"Add a beach you visited"},
  {t:"new",n:3,txt:"Add 3 places you visited"},{t:"cat",cat:"fort",n:1,txt:"Add a fort or monument you visited"},{t:"wish",n:2,txt:"Put 2 dream places on your wishlist"},
  {t:"cat",cat:"wildlife",n:1,txt:"Add a wildlife place you visited"},{t:"state",n:1,txt:"Colour in 1 new state"},{t:"new",n:2,txt:"Add 2 places you visited"}];
function monthlyProgress(){
  const d=new Date(), ch=MONTHLY[d.getMonth()], start=new Date(d.getFullYear(),d.getMonth(),1).getTime();
  const fresh=places.filter(p=>p.added>=start), fv=fresh.filter(p=>p.status==="visited");
  let have=0;
  if(ch.t==="new") have=fv.length;
  else if(ch.t==="cat") have=fv.filter(p=>catOf(p)===ch.cat).length;
  else if(ch.t==="wish") have=fresh.filter(p=>p.status==="wish").length;
  else{ const old=new Set(places.filter(p=>p.status==="visited" && !(p.added>=start)).map(stateOf)); have=new Set(fv.map(stateOf).filter(s=>s && !old.has(s))).size; }
  return {key:ymd(d).slice(0,7),ch,have:Math.min(have,ch.n),done:have>=ch.n};
}

// ---- daily question: [English, Hindi, options (first = correct), Hindi options] ----
const DAILY=[
["Which is the largest state of India by area?","क्षेत्रफल में भारत का सबसे बड़ा राज्य कौन-सा है?",["Rajasthan","Madhya Pradesh","Maharashtra","Uttar Pradesh"],["राजस्थान","मध्य प्रदेश","महाराष्ट्र","उत्तर प्रदेश"]],
["Which river is called the Ganga of the South?","किस नदी को दक्षिण की गंगा कहा जाता है?",["Godavari","Krishna","Narmada","Tapi"],["गोदावरी","कृष्णा","नर्मदा","तापी"]],
["In which city is the Gateway of India?","गेटवे ऑफ़ इंडिया किस शहर में है?",["Mumbai","Delhi","Kolkata","Chennai"],["मुंबई","दिल्ली","कोलकाता","चेन्नई"]],
["Which state is known as God's Own Country?","किस राज्य को 'ईश्वर का अपना देश' कहा जाता है?",["Kerala","Goa","Sikkim","Assam"],["केरल","गोवा","सिक्किम","असम"]],
["In which state is the Sun Temple of Konark?","कोणार्क का सूर्य मंदिर किस राज्य में है?",["Odisha","Gujarat","Tamil Nadu","Karnataka"],["ओडिशा","गुजरात","तमिलनाडु","कर्नाटक"]],
["Which is the highest mountain peak in India?","भारत की सबसे ऊँची पर्वत चोटी कौन-सी है?",["Kangchenjunga","Nanda Devi","Kamet","Anamudi"],["कंचनजंगा","नंदा देवी","कामेट","अनामुडी"]],
["Which city is called the Pink City?","किस शहर को गुलाबी नगर कहा जाता है?",["Jaipur","Jodhpur","Udaipur","Bikaner"],["जयपुर","जोधपुर","उदयपुर","बीकानेर"]],
["Which state has the longest coastline?","किस राज्य की तटरेखा सबसे लंबी है?",["Gujarat","Kerala","Tamil Nadu","Odisha"],["गुजरात","केरल","तमिलनाडु","ओडिशा"]],
["Which city is called the City of Lakes?","किस शहर को झीलों का शहर कहा जाता है?",["Udaipur","Jaisalmer","Agra","Indore"],["उदयपुर","जैसलमेर","आगरा","इंदौर"]],
["In which state is Kaziranga National Park?","काज़ीरंगा राष्ट्रीय उद्यान किस राज्य में है?",["Assam","West Bengal","Madhya Pradesh","Uttarakhand"],["असम","पश्चिम बंगाल","मध्य प्रदेश","उत्तराखंड"]],
["Which is the smallest state of India by area?","क्षेत्रफल में भारत का सबसे छोटा राज्य कौन-सा है?",["Goa","Sikkim","Tripura","Kerala"],["गोवा","सिक्किम","त्रिपुरा","केरल"]],
["In which city is the Charminar?","चारमीनार किस शहर में है?",["Hyderabad","Lucknow","Bhopal","Ahmedabad"],["हैदराबाद","लखनऊ","भोपाल","अहमदाबाद"]],
["Which desert lies in Rajasthan?","राजस्थान में कौन-सा रेगिस्तान है?",["Thar","Sahara","Gobi","Kalahari"],["थार","सहारा","गोबी","कालाहारी"]],
["Mawsynram, one of the wettest places on Earth, is in which state?","दुनिया की सबसे ज़्यादा बारिश वाली जगहों में से एक, मौसिनराम, किस राज्य में है?",["Meghalaya","Kerala","Assam","Mizoram"],["मेघालय","केरल","असम","मिज़ोरम"]],
["In which city is the Golden Temple?","स्वर्ण मंदिर किस शहर में है?",["Amritsar","Chandigarh","Ludhiana","Patiala"],["अमृतसर","चंडीगढ़","लुधियाना","पटियाला"]],
["Which river flows past Varanasi?","वाराणसी किस नदी के किनारे बसा है?",["Ganga","Yamuna","Gomti","Son"],["गंगा","यमुना","गोमती","सोन"]],
["What is the southern tip of mainland India called?","भारत की मुख्य भूमि का सबसे दक्षिणी छोर क्या कहलाता है?",["Kanyakumari","Rameswaram","Kovalam","Puri"],["कन्याकुमारी","रामेश्वरम","कोवलम","पुरी"]],
["In which state are the Ajanta caves?","अजंता की गुफाएँ किस राज्य में हैं?",["Maharashtra","Madhya Pradesh","Karnataka","Bihar"],["महाराष्ट्र","मध्य प्रदेश","कर्नाटक","बिहार"]],
["The Asiatic lion lives in which national park?","एशियाई शेर किस राष्ट्रीय उद्यान में पाया जाता है?",["Gir","Kanha","Corbett","Periyar"],["गिर","कान्हा","कॉर्बेट","पेरियार"]],
["Which city is called the Silicon Valley of India?","किस शहर को भारत की सिलिकॉन वैली कहा जाता है?",["Bengaluru","Pune","Hyderabad","Chennai"],["बेंगलुरु","पुणे","हैदराबाद","चेन्नई"]],
["In which city is Dal Lake?","डल झील किस शहर में है?",["Srinagar","Shimla","Nainital","Leh"],["श्रीनगर","शिमला","नैनीताल","लेह"]]
];
const DAILY_W=[
["Which is the largest country in the world by area?","क्षेत्रफल में दुनिया का सबसे बड़ा देश कौन-सा है?",["Russia","Canada","China","Brazil"],["रूस","कनाडा","चीन","ब्राज़ील"]],
["In which country is the Eiffel Tower?","एफ़िल टावर किस देश में है?",["France","Italy","Spain","Germany"],["फ़्रांस","इटली","स्पेन","जर्मनी"]],
["Which is the highest mountain in the world?","दुनिया का सबसे ऊँचा पर्वत कौन-सा है?",["Mount Everest","K2","Kangchenjunga","Kilimanjaro"],["माउंट एवरेस्ट","के2","कंचनजंगा","किलिमंजारो"]],
["In which country are the Pyramids of Giza?","गीज़ा के पिरामिड किस देश में हैं?",["Egypt","Mexico","Sudan","Peru"],["मिस्र","मेक्सिको","सूडान","पेरू"]],
["Which city is the capital of Japan?","जापान की राजधानी कौन-सा शहर है?",["Tokyo","Kyoto","Osaka","Seoul"],["टोक्यो","क्योटो","ओसाका","सियोल"]],
["Which is the largest ocean?","सबसे बड़ा महासागर कौन-सा है?",["Pacific","Atlantic","Indian","Arctic"],["प्रशांत","अटलांटिक","हिंद","आर्कटिक"]],
["In which country is Machu Picchu?","माचू पिच्चू किस देश में है?",["Peru","Chile","Mexico","Brazil"],["पेरू","चिली","मेक्सिको","ब्राज़ील"]],
["Which is the largest hot desert in the world?","दुनिया का सबसे बड़ा गर्म रेगिस्तान कौन-सा है?",["Sahara","Gobi","Kalahari","Thar"],["सहारा","गोबी","कालाहारी","थार"]],
["In which city is the Burj Khalifa?","बुर्ज ख़लीफ़ा किस शहर में है?",["Dubai","Abu Dhabi","Doha","Riyadh"],["दुबई","अबू धाबी","दोहा","रियाद"]],
["Which is the smallest country in the world?","दुनिया का सबसे छोटा देश कौन-सा है?",["Vatican City","Monaco","Malta","Maldives"],["वेटिकन सिटी","मोनाको","माल्टा","मालदीव"]],
["The Great Barrier Reef is off the coast of which country?","ग्रेट बैरियर रीफ़ किस देश के तट के पास है?",["Australia","Indonesia","Fiji","Philippines"],["ऑस्ट्रेलिया","इंडोनेशिया","फ़िजी","फ़िलीपींस"]],
["Which continent has the most countries?","किस महाद्वीप में सबसे ज़्यादा देश हैं?",["Africa","Asia","Europe","South America"],["अफ़्रीका","एशिया","यूरोप","दक्षिणी अमेरिका"]],
["In which country is the Colosseum?","कोलोसियम किस देश में है?",["Italy","Greece","Spain","Turkey"],["इटली","ग्रीस","स्पेन","तुर्की"]],
["Which city is called the Big Apple?","किस शहर को 'बिग ऐपल' कहा जाता है?",["New York","Los Angeles","London","Sydney"],["न्यूयॉर्क","लॉस एंजिलिस","लंदन","सिडनी"]]
];
function dayNum(){ const d=new Date(); return Math.floor((d.getTime()-d.getTimezoneOffset()*60000)/86400000); }
function liveStreak(d){ return (d.last===todayStr() || d.last===ymd(new Date(Date.now()-86400000))) ? (d.streak||0) : 0; }
function openDaily(){
  const d=lsGet("myIndiaDailyV2",{});
  if(d.last===todayStr()){ kidSay(T("You already answered today. Come back tomorrow to keep your streak going!"),"🔥"); return; }
  const bank=isWorld()?DAILY_W:DAILY, q=bank[dayNum()%bank.length], opts=LANG==="hi"?q[3]:q[2], right=opts[0], mixed=shuffle(opts.slice());
  const card=kidCard('<div class="kid-emoji">🔥</div><h3>'+T("Daily question")+'</h3><div class="qz-q"></div><div class="qz-opts"></div><div class="kid-fact" hidden></div>');
  card.box.querySelector(".qz-q").textContent=LANG==="hi"?q[1]:q[0];
  mixed.forEach(o=>{
    const b=mkEl("button","qz-opt",o); b.type="button";
    b.onclick=()=>{
      card.box.querySelectorAll(".qz-opt").forEach(x=>{ x.disabled=true; if(x.textContent===right) x.classList.add("right"); });
      const ok=o===right, streak=ok?liveStreak(d)+1:0;
      if(!ok) b.classList.add("wrong");
      lsSet("myIndiaDailyV2",{last:todayStr(),streak,best:Math.max(d.best||0,streak)});
      postGame("daily",ok?1:0);
      const f=card.box.querySelector(".kid-fact"); f.hidden=false;
      f.textContent=ok?T("✅ Correct! Your streak is now {0}. Come back tomorrow!",streak):T("❌ Not quite! The answer is {0}. Try again tomorrow.",right);
      if(ok) confetti();
      render();
    };
    card.box.querySelector(".qz-opts").appendChild(b);
  });
}

// ---- "On this day" memories (needs the exact date on a place) ----
function memoryNow(){
  const now=new Date(), m=now.getMonth()+1, day=now.getDate();
  const hits=places.filter(p=>p.status==="visited" && /^\d{4}-\d\d-\d\d$/.test(p.date||"") && Number(p.date.slice(5,7))===m && Number(p.date.slice(0,4))<now.getFullYear());
  hits.sort((a,b)=>Math.abs(Number(a.date.slice(8))-day)-Math.abs(Number(b.date.slice(8))-day));
  return hits[0]||null;
}

// ---- state passport ----
const ST_CODES="AN AP AR AS BR CH CG DD DL GA GJ HR HP JK JH KA KL LA LD MP MH MN ML MZ NL OD PY PB RJ SK TN TS TR UP UK WB".split(" ");
function passportLine(got){ return isWorld()?T("{0} country stamps collected",got):T("{0} of 36 stamps collected",got); }
function passportTitle(){ return isWorld()?T("My country passport"):T("My state passport"); }
function passportData(){
  if(isWorld()) return [...getStats().regions].sort().map(n=>{
    const years=places.filter(p=>p.status==="visited" && stateOf(p)===n).map(p=>p.year).filter(Boolean), el=statePaths.find(e=>e.dataset.n===n);
    return {n,code:(n.split(/[\s.-]+/).filter(w=>w && !/^(of|and|the)$/i.test(w)).length>1 ? n.split(/[\s.-]+/).filter(w=>w && !/^(of|and|the)$/i.test(w)).map(w=>w[0]).join("").slice(0,3) : n.replace(/[^A-Za-z]/g,"").slice(0,3)).toUpperCase(),done:true,year:years.length?Math.min.apply(null,years):0,col:el?el.dataset.c:"#f6d743"};
  });
  const names=statePaths.map(e=>e.dataset.n).sort();
  return names.map((n,i)=>{
    const vis=places.filter(p=>p.status==="visited" && stateOf(p)===n), years=vis.map(p=>p.year).filter(Boolean);
    const el=statePaths.find(e=>e.dataset.n===n);
    return {n,code:ST_CODES[i]||n.slice(0,2).toUpperCase(),done:vis.length>0,year:years.length?Math.min.apply(null,years):0,col:el.dataset.c};
  });
}
function openPassport(){
  const data=passportData(), got=data.filter(x=>x.done).length;
  const card=kidCard('<div class="kid-emoji">🛂</div><h3>'+passportTitle()+'</h3><div class="sub">'+passportLine(got)+'</div><div class="stamps"></div><div class="kid-btns" style="margin-top:12px"><button class="kid-yes">'+T("📤 Share my passport")+'</button></div>');
  const grid=card.box.querySelector(".stamps");
  data.forEach(x=>{
    const s=mkEl("div","stamp"+(x.done?" on":"")); s.title=stName(x.n);
    if(x.done) s.style.background=x.col;
    s.append(mkEl("b","",x.code),mkEl("small","",x.done?(x.year||"✓"):"·"));
    grid.appendChild(s);
  });
  card.box.querySelector(".kid-yes").onclick=async()=>{ const c=passportCanvas(); shareBlob(await new Promise(r=>c.toBlob(r,"image/png")),"india-state-passport.png",challengeText()); };
}
function passportCanvas(){
  const data=passportData(), got=data.filter(x=>x.done).length, W=1080, H=1350;
  const c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d");
  x.fillStyle="#0b3b73"; x.fillRect(0,0,W,H);
  x.fillStyle="#fffbe8"; roundRect(x,36,36,W-72,H-72,36); x.fill();
  x.textAlign="center"; x.textBaseline="alphabetic";
  x.fillStyle="#0b3b73"; x.font="bold 56px Arial"; x.fillText(fitText(x,"🛂 "+titleText(),W-140),W/2,130);
  x.fillStyle="#6a4a00"; x.font="bold 34px Arial"; x.fillText(passportLine(got),W/2,186);
  data.slice(0,36).forEach((s,i)=>{
    const cx=150+(i%6)*156, cy=310+Math.floor(i/6)*166, R=64;
    x.beginPath(); x.arc(cx,cy,R,0,Math.PI*2);
    if(s.done){ x.fillStyle=s.col; x.fill(); x.lineWidth=6; x.strokeStyle="#0b3b73"; x.setLineDash([]); x.stroke(); }
    else{ x.lineWidth=4; x.strokeStyle="#c9c2a8"; x.setLineDash([10,9]); x.stroke(); }
    x.setLineDash([]);
    x.fillStyle=s.done?"#172033":"#b9b29a"; x.font="bold 40px Arial"; x.fillText(s.code,cx,cy+(s.done?4:14));
    if(s.done){ x.font="bold 22px Arial"; x.fillText(s.year?String(s.year):"✓",cx,cy+36); }
  });
  x.fillStyle="#475467"; x.font="26px Arial"; x.fillText("My Travel Map",W/2,H-70);
  return c;
}

// ---- Explore tab: level, daily, monthly, memory, collections ----
// Small photo for a collection item, looked up on Wikipedia once and then remembered on this phone.
const thumbJobs=new Map();
function thumbFor(name){
  const key=(isWorld()?"w:":"i:")+name, saved=lsGet("myThumbsV1",{});
  const good=u=>typeof u==="string" && /^https:\/\/upload\.wikimedia\.org\/[^\s"'<>]+$/.test(u);
  if(good(saved[key])) return Promise.resolve(saved[key]);
  if(thumbJobs.has(key)) return thumbJobs.get(key);
  const job=findPlaceImage(name.replace(/[()]/g," ")).then(url=>{
    if(good(url)){ const all=lsGet("myThumbsV1",{}); all[key]=url; lsSet("myThumbsV1",all); return url; }
    return "";
  }).catch(e=>{ console.warn("No photo for "+name,e); thumbJobs.delete(key); return ""; });
  thumbJobs.set(key,job);
  return job;
}
function openCollection(x){
  const card=kidCard('<div class="kid-emoji">'+x.c.e+'</div><h3>'+T(x.c.n)+'</h3><div class="sub">'+T("{0} of {1} done",x.done,x.pr.length)+(x.done===x.pr.length?" 🏆":"")+'</div><div class="col-list"></div>');
  const list=card.box.querySelector(".col-list");
  x.pr.forEach(it=>{
    const row=mkEl("div","kid-row");
    const th=mkEl("span","col-th"+(it.done?" done":"")); th.append(mkEl("span","col-em",x.c.e),mkEl("i","col-tick",it.done?"✓":""));
    row.append(th);
    thumbFor(it.label).then(url=>{ if(!url || !document.body.contains(th)) return; const im=mkEl("img"); im.alt=""; im.loading="lazy"; im.onerror=()=>im.remove(); im.src=url; th.insertBefore(im,th.lastChild); });
    const mid=mkEl("div"); mid.append(mkEl("b","",it.label),mkEl("small","",it.done?T("Visited ✓"):T("Not visited yet"))); row.append(mid);
    if(!it.done && it.lat && !findDuplicate(it.label,it.lat,it.lon)){
      const b=mkEl("button","kid-mini",T("⭐ Add")); b.type="button";
      b.onclick=()=>{ if(findDuplicate(it.label,it.lat,it.lon)) return; places.push({name:it.label,lat:it.lat,lon:it.lon,status:"wish",cat:guessCat(it.label)}); b.textContent=T("Added ✓"); b.disabled=true; showEverything(); render(); };
      row.append(b);
    }
    list.appendChild(row);
  });
}
function renderEngage(es,mp){
  const box=document.getElementById("engage"); if(!box) return;
  box.innerHTML="";
  const L=LEVELS[es.lvl], N=LEVELS[es.lvl+1];
  const lv=mkEl("div","lvl-card");
  lv.innerHTML='<div class="lvl-em">'+L[1]+'</div><div class="lvl-txt"><b>'+T("Level {0}",es.lvl+1)+' · '+T(L[2])+'</b><div class="bar"><i style="width:'+(N?Math.round((es.xp-L[0])/(N[0]-L[0])*100):100)+'%"></i></div><small>'
    +(N?T("{0} points · {1} more to become {2}",es.xp,N[0]-es.xp,T(N[2])):T("{0} points · top level!",es.xp))+'</small></div>';
  box.appendChild(lv);
  if(places.length){ box.appendChild(factCardEl()); paintFact(); const f=factNow(); if((!f || f.d!==todayStr()) && !factTried){ factTried=true; loadFact(); } }

  const row=mkEl("div","eg-row"), d=es.daily, dDone=d.last===todayStr();
  const dc=mkEl("button","eg-card"+(dDone?" done":"")); dc.type="button";
  dc.innerHTML='<span class="ic">🔥</span><b>'+T("Daily question")+'</b><small>'+(dDone?T("Done for today! Streak: {0}",d.streak||0):T("Answer now · streak {0}",liveStreak(d)))+'</small>';
  dc.onclick=openDaily;
  const mc=mkEl("div","eg-card"+(mp.done?" done":""));
  mc.innerHTML='<span class="ic">🎯</span><b>'+T("{0} challenge",new Date().toLocaleString(LANG==="hi"?"hi-IN":"en-IN",{month:"long"}))+'</b><small>'+T(isWorld() && mp.ch.t==="state"?"Colour in 1 new country":mp.ch.txt)+'</small><div class="bar"><i style="width:'+Math.round(mp.have/mp.ch.n*100)+'%"></i></div><small>'+(mp.done?T("Done! +50 points"):mp.have+" / "+mp.ch.n)+'</small>';
  row.append(dc,mc); box.appendChild(row);
  box.appendChild(mysteryCardEl());
  document.querySelectorAll('[data-go="fun"]').forEach(b=>b.classList.toggle("dot",!dDone));

  const mem=memoryNow();
  if(mem){
    const m=mkEl("button","mem-card"); m.type="button";
    const yrs=new Date().getFullYear()-Number(mem.date.slice(0,4));
    if(mem.photo){ const im=mkEl("img"); im.alt=""; im.src=mem.photo; m.append(im); } else m.append(mkEl("span","ic","🕰️"));
    const tx=mkEl("div"); tx.append(mkEl("b","",yrs===1?T("This month, 1 year ago: {0}",mem.name):T("This month, {0} years ago: {1}",yrs,mem.name)),mkEl("small","",mem.note||T("Tap to open this memory")));
    m.append(tx); m.onclick=()=>openPlaceCard(mem);
    box.appendChild(m);
  }

  box.appendChild(mkEl("div","share-title",T("Collections")));
  const sl=mkEl("div","chips slide cols");
  es.cols.forEach(x=>{
    const full=x.done===x.pr.length, b=mkEl("button","col-chip"+(full?" full":"")); b.type="button";
    b.innerHTML='<span class="ic">'+(full?"🏆":x.c.e)+'</span><b>'+T(x.c.n)+'</b><div class="bar"><i style="width:'+Math.round(x.done/x.pr.length*100)+'%"></i></div><small>'+x.done+' / '+x.pr.length+'</small>';
    b.onclick=()=>openCollection(x);
    sl.appendChild(b);
  });
  box.appendChild(sl);
  const pb=mkEl("button","tool wide passport"); pb.type="button";
  pb.innerHTML='<span class="ic">🛂</span><span>'+passportTitle()+' · '+es.st.regions.size+(isWorld()?'':' / 36')+'</span>';
  pb.onclick=openPassport;
  box.appendChild(pb);
}

// ---- runs after every redraw: stamps new places, celebrates, keeps the cloud copy fresh ----
let prevStates=null, quiet=true, lastSlim=null;       // quiet = no celebrations (page load, restore, cloud download)
function quietCelebrate(){ quiet=true; prevStates=null; }
function slimSig(){ return JSON.stringify(ownPlaces().map(p=>[p.name,p.status,p.cat,p.year||0,p.date||"",p.note||"",p.rating||0,p.fav?1:0,p.photo?p.photo.length:0])); }
function afterRender(st){
  const justAdded=places.filter(p=>typeof p.added!=="number" && !p._in && p.status==="visited");
  places.forEach(p=>{ if(typeof p.added!=="number") p.added=Date.now(); });
  if(!quiet) justAdded.slice(0,2).forEach(p=>logAct("place",p.name,stateOf(p)));
  const names=[...st.regions];
  if(prevStates && !quiet){
    const fresh=names.filter(n=>!prevStates.has(n));
    if(fresh.length){ toast("🎉 "+T("New on your map: {0}!",fresh.map(stName).join(", "))); badgeQueue=badgeQueue.then(()=>scratchState(fresh[0])); logAct("state",fresh[0]); }   // scratch card for the new state
  }
  prevStates=new Set(names);
  mysteryAward();
  const mp=monthlyProgress();
  let monthly=lsGet("myIndiaMonthlyV2",[]);
  if(mp.done && !monthly.includes(mp.key)){
    monthly.push(mp.key); lsSet("myIndiaMonthlyV2",monthly);
    if(!quiet){ confetti(); badgeQueue=badgeQueue.then(()=>kidPopup(T("Monthly challenge done! +50 points"),{emoji:"🎯",yes:T("Woohoo! 🥳"),no:null})); }
  }
  const es=engageState();
  const doneIds=es.cols.filter(x=>x.done===x.pr.length).map(x=>x.c.id), had=lsGet(mk("myIndiaColsV2"),null);
  if(had && !quiet) es.cols.filter(x=>doneIds.includes(x.c.id) && !had.includes(x.c.id)).forEach(x=>{
    confetti(); logAct("col",x.c.n); badgeQueue=badgeQueue.then(()=>kidPopup(T("Collection complete: {0}!",T(x.c.n)),{emoji:"🏆",yes:T("Woohoo! 🥳"),no:null}));
  });
  lsSet(mk("myIndiaColsV2"),doneIds);
  const lv=lsGet(mk("myIndiaLevelV2"),null);
  if(lv!==null && es.lvl>lv && !quiet){ confetti(); logAct("level",LEVELS[es.lvl][2]); badgeQueue=badgeQueue.then(()=>kidPopup(T("Level up! You are now: {0}",T(LEVELS[es.lvl][2])),{emoji:LEVELS[es.lvl][1],yes:T("Woohoo! 🥳"),no:null})); }
  lsSet(mk("myIndiaLevelV2"),es.lvl);
  quiet=false;
  renderEngage(es,mp);
  renderProgress(es);
  document.getElementById("statPill").textContent=LEVELS[es.lvl][1]+" "+es.xp+"  ·  📍 "+st.v+"  ·  "+(isWorld()?"🌍 "+st.states:"🗺️ "+st.states+"/28")+"  ·  🛣️ "+st.km.toLocaleString("en-IN")+" km";
  const sj=slimSig();
  if(lastSlim!==null && sj!==lastSlim) markDirty();
  lastSlim=sj;
}

// ---- a friend's places shown on my map (purple pins) ----
let ghost=null;
async function askHideGhost(){
  if(ghost && await kidAsk(T("Hide {0}’s places from your map?",ghost.name),{emoji:"🙈"})) clearGhost();
}
function drawGhost(layer){
  const bar=document.getElementById("ghostBar"), was=bar.hidden;
  bar.hidden=!ghost && !crowns;
  if(ghost){
    document.getElementById("ghostTxt").textContent=T("Purple pins: {0}’s places",ghost.name);
    ghost.places.forEach(g=>{
      const q=project(g.lat,g.lon), el=mkEl("div","marker ghost");
      el.style.left=q.x+"%"; el.style.top=q.y+"%";
      el.append(mkEl("div","pin"),mkEl("div","marker-label",g.name));
      el.onclick=askHideGhost;                       // tap any purple pin to take them off
      layer.appendChild(el);
    });
  }
  if(was!==bar.hidden) setTimeout(fitMap,0);
}
function clearGhost(){ ghost=null; crowns=null; render(); }

// ---- progress panel in the Explore tab ----
function renderProgress(es){
  const st=es.st, total=MODES[MODE].total;
  document.getElementById("progRing").style.setProperty("--p",Math.min(100,st.states/total*100));
  document.getElementById("ringNum").textContent=st.states;
  document.getElementById("ringLbl").textContent=isWorld()?T("countries"):"/ 28 "+T("states");
  const tiles=document.getElementById("progTiles"); tiles.innerHTML="";
  [["📍",st.v,T("places")],["🛣️",st.km.toLocaleString("en-IN"),T("km travelled")],["⭐",st.w,T("Wishlist")],["📸",st.mem,T("memories")]].forEach(t=>{
    const d=mkEl("div","ptile"); d.append(mkEl("b","",t[0]+" "+t[1]),mkEl("small","",t[2])); tiles.appendChild(d);
  });
  const bars=document.getElementById("catBars"); bars.innerHTML="";
  const max=Math.max(1,...Object.keys(CATS).map(c=>st.cat[c]||0));
  Object.keys(CATS).forEach(c=>{
    const n=st.cat[c]||0, row=mkEl("div","cbar"), bar=mkEl("div","bar"), fill=mkEl("i");
    fill.style.width=(n/max*100)+"%"; bar.appendChild(fill);
    row.append(mkEl("span","",CATS[c][0]),mkEl("span","",catLabel(c)),bar,mkEl("b","",String(n)));
    bars.appendChild(row);
  });
}

// ---- "Did you know?" facts about my places (Groq AI when the key is set, otherwise Wikipedia) ----
let factBusy=false, factTried=false;
function factNow(){ const f=lsGet(mk("myFactV2"),null); return f && f.lang===LANG && places.some(p=>p.name===f.name) ? f : null; }
async function loadFact(){
  if(factBusy || !places.length) return;
  factBusy=true; paintFact();
  const pool=places.filter(p=>p.status==="visited"), list=pool.length?pool:places, p=list[Math.floor(Math.random()*list.length)];
  try{
    const text=await funFact(p);
    if(text && text!==T("I could not find a fact right now. Check your internet and try again!")) lsSet(mk("myFactV2"),{d:todayStr(),name:p.name,text:String(text).slice(0,400),lang:LANG});
  }catch(e){ console.warn("Fact lookup failed.",e); }
  factBusy=false; paintFact();
}
function paintFact(){
  document.querySelectorAll(".fact-card").forEach(box=>{
    const f=factNow();
    box.querySelector(".fact-t").textContent=factBusy?T("Finding a fun fact… 🤔"):f?f.text:T("Tap for a fun fact about one of your places.");
    box.querySelector(".fact-p").textContent=f && !factBusy?"📍 "+f.name:"";
  });
}
function factCardEl(){
  const box=mkEl("div","fact-card");
  box.append(mkEl("b","fact-h",T("✨ Did you know?")),mkEl("div","fact-p"),mkEl("div","fact-t"));
  const b=mkEl("button","kid-mini",T("🔄 Another fact")); b.type="button"; b.onclick=loadFact; box.appendChild(b);
  return box;
}
function factPopup(){
  if(!places.length){ kidSay(T("Add a place first and I will tell you fun facts about it!"),"💡"); return; }
  const card=kidCard('<div class="kid-emoji">💡</div>'); card.box.appendChild(factCardEl());
  paintFact();
  if(!factNow()) loadFact();
}

// ---- switch between the India map and the World map ----
function renderModeSeg(){ document.querySelectorAll("#modeSeg button").forEach(b=>b.classList.toggle("on",b.dataset.m===MODE)); }
let worldLoading=false;
function setMode(m){
  if(m===MODE || replaying || !MODES[m]) return;
  if(m==="world" && !window.WORLD_SVG){                 // fetch place/maps/world-map.js first, then come back here
    if(worldLoading) return;
    worldLoading=true; toast("🌍 "+T("Loading the world map…"));
    loadScript(ASSET+"maps/world-map.js?v="+APP_VERSION).then(()=>{ worldLoading=false; setMode("world"); },
      ()=>{ worldLoading=false; kidSay(T("I could not load the world map. Check your internet and try again."),"🌍"); });
    return;
  }
  MODE=m; localStorage.setItem("myMapModeV2",m);
  if(pinGame) endPinDrop(true);
  ghost=null; crowns=null; places=loadPlaces(); linkIndia(); normPlaces();
  LOCAL_PLACES=isWorld()?WORLD_PLACES:INDIA_PLACES;
  showEverything(); Z=1; hideSuggestions();
  attachMap();
  earnedBadges=null; quietCelebrate(); lastSlim=null; lbRows=null; factTried=false;
  applyLang(); renderModeSeg();
  render(); fitMap();
  if(fbUser){ scheduleSubmit(); cloudStart(); }
  if(curTab==="board") loadBoard();
}
document.querySelectorAll("#modeSeg button").forEach(b=>{ b.onclick=()=>setMode(b.dataset.m); });
renderModeSeg();

/* My Travel Map · sharing.js
   Share message, story card, journey video and the share menu. */
// =====================================================================
//  SHARING: map picture, story card, passport, journey video
// =====================================================================
function challengeText(){
  const st=getStats(), url=pageUrl();
  return (isWorld()?T("I have visited {0} countries and {1} places around the world. Can you beat me?",st.states,st.v)+" 🌍":T("I have visited {0} of 28 states and {1} places in India. Can you beat me?",st.states,st.v)+" 🇮🇳")+(url?" "+url:"");
}
async function shareBlob(blob,fileName,text){
  try{
    const file=new File([blob],fileName,{type:blob.type});
    if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:titleText(),text:text||""}); return; }
  }catch(e){ if(e.name==="AbortError") return; console.warn("Share sheet failed; saving the file instead.",e); }
  saveBlob(blob,fileName);
  kidSay(T("Saved! Attach it in WhatsApp or Instagram."),"🎉");
}
// Tall 9:16 card for Instagram stories and WhatsApp status.
async function storyCanvas(){
  const es=engageState(), st=yearScope()?getStats(yearScope()):es.st, map=await buildCanvas(true), W=1080, H=1920;
  const c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d");
  const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#0b3b73"); g.addColorStop(.6,"#12448c"); g.addColorStop(1,"#082a55");
  x.fillStyle=g; x.fillRect(0,0,W,H);
  x.textAlign="center"; x.textBaseline="alphabetic";
  x.fillStyle="#fff"; let fs=60; do{ x.font="bold "+fs+"px Arial"; fs-=4; }while(fs>30 && x.measureText(titleText()).width>W-100);
  x.fillText(fitText(x,titleText(),W-100),W/2,118);
  x.fillStyle="#ffd86b"; x.font="bold 36px Arial"; x.fillText(LEVELS[es.lvl][1]+" "+T(LEVELS[es.lvl][2])+" · "+T("{0} points",es.xp),W/2,178);
  const mw=940, mh=Math.round(mw*MAP_H/MAP_W), mx=(W-mw)/2, my=214;
  x.save(); roundRect(x,mx,my,mw,mh,36); x.clip(); x.drawImage(map,mx,my,mw,mh); x.restore();
  const tiles=[[st.v,T("places")],[st.states+st.uts,T("states & UTs")],[st.km.toLocaleString("en-IN"),T("km travelled")]], ty=my+mh+30, tw=(mw-40)/3;
  tiles.forEach((t,i)=>{
    const tx=mx+i*(tw+20);
    x.fillStyle="rgba(255,255,255,.13)"; roundRect(x,tx,ty,tw,160,22); x.fill();
    x.fillStyle="#ffd86b"; x.font="bold 64px Arial"; x.fillText(String(t[0]),tx+tw/2,ty+82);
    x.fillStyle="#fff"; x.font="24px Arial"; x.fillText(fitText(x,t[1],tw-16),tx+tw/2,ty+128);
  });
  let y=ty+160+62;
  const best=topFive(yearScope());
  if(best.length){ x.fillStyle="#cfe1f7"; x.font="bold 30px Arial"; x.fillText(fitText(x,T("⭐ Top picks: {0}",best.map(p=>p.name).join(" · ")),W-100),W/2,y); y+=84; }
  x.fillStyle="#ffd86b"; x.font="bold 66px Arial"; x.fillText(T("Can you beat me?"),W/2,y+20);
  x.fillStyle="#fff"; x.font="30px Arial"; x.fillText(regionLine(st),W/2,y+78);
  x.fillStyle="#9fbbe0"; x.font="26px Arial"; x.fillText(fitText(x,"My Travel Map"+(pageUrl()?" · "+pageUrl().replace(/^https?:\/\//,""):""),W-100),W/2,H-48);
  return c;
}
// Records the journey replay as a short video.
async function recordJourney(){
  const list=journeyPlaces(yearScope());
  if(list.length<2){ kidSay(T("Add at least 2 visited places to play your journey!"),"🎬"); return; }
  const mime=window.MediaRecorder && HTMLCanvasElement.prototype.captureStream && ["video/mp4;codecs=avc1","video/mp4","video/webm;codecs=vp9","video/webm"].find(m=>MediaRecorder.isTypeSupported(m));
  if(!mime){ kidSay(T("This browser cannot make videos. Try it in Chrome."),"🎬"); return; }
  const card=kidCard('<div class="kid-emoji">🎬</div><h3>'+T("Making your video…")+'</h3><div class="sub">'+T("Keep this screen open for a few seconds.")+'</div>');
  const line=document.getElementById("journey"), keep=line.getAttribute("d");
  line.setAttribute("d",""); const base=await svgImage(); line.setAttribute("d",keep);
  const W=720, H=Math.round(720*MAP_H/MAP_W/2)*2, c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d");
  const pts=list.map(p=>{ const q=project(p.lat,p.lon); return {x:q.x*W/100,y:q.y*H/100}; });
  const draw=(n,head,caption)=>{                      // n = places reached, head = moving point
    x.drawImage(base,0,0,W,H);
    x.strokeStyle="#e6492d"; x.lineWidth=4; x.lineJoin="round"; x.setLineDash([2,9]); x.lineCap="round";
    x.beginPath(); pts.slice(0,n).forEach((p,i)=>i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y)); if(head) x.lineTo(head.x,head.y); x.stroke(); x.setLineDash([]);
    pts.slice(0,n).forEach(p=>{ x.fillStyle="#fff"; x.beginPath(); x.arc(p.x,p.y,9,0,Math.PI*2); x.fill(); x.fillStyle="#1faa59"; x.beginPath(); x.arc(p.x,p.y,6.5,0,Math.PI*2); x.fill(); });
    if(head){ x.font="26px serif"; x.textAlign="center"; x.textBaseline="middle"; x.fillText("✈️",head.x,head.y); }
    x.fillStyle="rgba(11,59,115,.94)"; roundRect(x,30,H-84,W-60,56,28); x.fill();
    x.fillStyle="#fff"; x.font="bold 24px Arial"; x.textAlign="center"; x.textBaseline="middle"; x.fillText(fitText(x,caption,W-110),W/2,H-55);
  };
  const run=(ms,fn)=>new Promise(res=>{ const t0=performance.now(); const f=t=>{ const k=Math.min(1,Math.max(0,(t-t0)/ms)); fn(k); if(k<1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  const cap=i=>(list[i].year?list[i].year+" · ":"")+list[i].name+"  ("+(i+1)+"/"+list.length+")";
  draw(0,null,titleText());
  const chunks=[], rec=new MediaRecorder(c.captureStream(30),{mimeType:mime,videoBitsPerSecond:2500000});
  rec.ondataavailable=e=>{ if(e.data && e.data.size) chunks.push(e.data); };
  const stopped=new Promise(res=>{ rec.onstop=res; });
  rec.start();
  try{
    await run(700,()=>draw(0,null,titleText()));
    for(let i=0;i<list.length;i++){
      if(i) await run(Math.min(1300,Math.max(550,haversine(list[i-1],list[i])*1.1)),k=>{ const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2, a=pts[i-1], b=pts[i]; draw(i,{x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e},cap(i-1)); });
      await run(550,()=>draw(i+1,null,cap(i)));
    }
    await run(1500,()=>draw(list.length,null,T("🎉 {0} places · {1} km!",list.length,getStats(yearScope()).km.toLocaleString("en-IN"))));
  }finally{ rec.stop(); }
  await stopped;
  card.close();
  const blob=new Blob(chunks,{type:mime.split(";")[0]});
  shareBlob(blob,"india-journey."+(mime.includes("mp4")?"mp4":"webm"),challengeText());
}
// The message that goes with the journey picture.
function shareMessage(){
  const es=engageState(), st=es.st, best=topFive(0)[0], next=places.find(p=>p.status==="wish"), url=pageUrl(), L=LEVELS[es.lvl];
  const lines=[isWorld()?T("🌍 My world journey so far: {0} places, {1} countries and {2} km!",st.v,st.states,st.km.toLocaleString("en-IN")):T("🇮🇳 My India journey so far: {0} places, {1} states and {2} km!",st.v,st.states,st.km.toLocaleString("en-IN"))];
  if(best) lines.push(T("⭐ My favourite so far: {0}.",best.name));
  if(next) lines.push(T("✈️ Next on my wishlist: {0}.",next.name));
  lines.push(T("{0} My level on My Travel Map: {1}. Can you beat me?",L[1],T(L[2])));
  if(url) lines.push(T("Make your own map here: {0}",url));
  return lines.join("\n");
}
// Share button on the home screen: sends the journey picture with a message and the site link.
async function shareHome(){
  if(!places.length){ kidSay(T("Add a place first, then share your map!"),"📤"); return; }
  clearTimeout(mapBlobTimer);
  if(!shareReady){ shareReady=makeSharePicture(); toast("📤 "+T("Getting your picture ready…")); }   // normally it is ready before the tap
  let blob;
  try{ blob=await shareReady; }
  catch(e){ console.warn(e); shareReady=null; blob=await makeSharePicture(); }
  const text=shareMessage(), fname=isWorld()?"my-world-journey.jpg":"my-india-journey.jpg";
  try{
    const file=new File([blob],fname,{type:"image/jpeg"});
    if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:titleText(),text}); return; }
  }catch(e){ if(e.name==="AbortError") return; console.warn("Share sheet failed; saving the picture instead.",e); }
  saveBlob(blob,fname);                                            // computers: save the picture and copy the message
  let copied=false;
  try{ await navigator.clipboard.writeText(text); copied=true; }catch(e){}
  kidSay(copied?T("Your journey picture is saved and the message with the link is copied. Paste it in WhatsApp or Instagram and attach the picture."):T("Your journey picture is saved! Attach it in WhatsApp or Instagram."),"🎉");
}
// More ways to share (in the More tab).
function shareHub(){
  if(!places.length){ kidSay(T("Add a place first, then share your map!"),"📤"); return; }
  const card=kidCard('<div class="kid-emoji">📤</div><h3>'+T("Share my map")+'</h3><div class="tool-grid" id="shGrid"></div>');
  const toBlob=c=>new Promise(r=>c.toBlob(r,"image/png"));
  const opts=[
    ["🗺️",T("Map picture"),async()=>shareBlob(mapBlobCache || await mapBlob(),PNG_NAME,challengeText())],
    ["📱",T("Story card (tall)"),async()=>shareBlob(await toBlob(await storyCanvas()),"india-travel-story.png",challengeText())],
    ["🛂",T("Passport stamps"),async()=>shareBlob(await toBlob(passportCanvas()),"india-state-passport.png",challengeText())],
    ["🎬",T("Journey video"),()=>recordJourney()],
    ["🟢","WhatsApp",()=>shareMap("whatsapp")],
    ["📸","Instagram",()=>shareMap("instagram")]];
  opts.forEach(o=>{
    const b=mkEl("button","tool"); b.type="button";
    b.append(mkEl("span","ic",o[0]),mkEl("span","",o[1]));
    b.onclick=()=>{ card.close(); o[2](); };
    card.box.querySelector("#shGrid").appendChild(b);
  });
}

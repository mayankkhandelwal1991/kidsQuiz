/* My Travel Map · map-zoom.js
   Zoom and drag for the map (buttons, pinch, double-tap, mouse wheel). */
// ---- controls ----
document.querySelectorAll("#statusSeg button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("#statusSeg button").forEach(x=>x.classList.toggle("on",x===b));
});
const nameInput=document.getElementById("travellerName"), journeyToggle=document.getElementById("journeyToggle");
nameInput.value=localStorage.getItem("myIndiaNameV2")||"";
journeyToggle.checked=localStorage.getItem("myIndiaJourneyV2")!=="off";
nameInput.addEventListener("input",()=>{ localStorage.setItem("myIndiaNameV2",nameInput.value.trim()); render(); });
journeyToggle.addEventListener("change",()=>{ localStorage.setItem("myIndiaJourneyV2",journeyToggle.checked?"on":"off"); render(); });

// ---- zoom & pan: buttons, pinch, double-tap/double-click, Ctrl + mouse wheel, drag when zoomed ----
const mapWrap=document.getElementById("mapWrap"), mapInner=document.getElementById("mapInner");
let Z=1, TX=0, TY=0, dragMoved=false;
const Z_MAX=6;
let BASE_W=0;                    // width of the whole map at zoom 1 (wider than the frame for the World map on phones)
let ZC=1, gesturing=false, zoomFrame=0, settleTimer=null;     // ZC = zoom the map is drawn at right now
// While fingers are moving, the drawn map is only stretched (fast and smooth).
// When they lift, it is redrawn once at the new size so it is sharp again.
function applyZoom(fast){
  const w=mapWrap.clientWidth, h=mapWrap.clientHeight, base=BASE_W||w, iw=base*Z, ih=iw*MAP_H/MAP_W;
  TX=Math.min(0,Math.max(w-iw,TX));
  TY=Math.min(0,Math.max(h-ih,TY));
  if(fast===true && Math.abs(Z-ZC)>0.001){
    const k=Z/ZC;
    mapInner.style.transform="translate("+TX+"px,"+TY+"px) scale("+k+")";
    mapInner.style.setProperty("--inv",1/k);          // pins keep their size while the map stretches
  }else{
    ZC=Z;
    mapInner.style.width=iw+"px";
    mapInner.style.transform="translate("+TX+"px,"+TY+"px)";
    mapInner.style.setProperty("--inv",1);
  }
  const zoomed=Z>1.01, pan=iw>w+1 || ih>h+1;
  mapWrap.classList.toggle("zoomed",zoomed);
  mapWrap.classList.toggle("pannable",pan);
  mapWrap.classList.toggle("india-far",isWorld() && clusterOn && iw*32/360<200);     // India is still small on screen: show one pin for it
  document.getElementById("zoomOut").disabled=!zoomed;
  document.getElementById("zoomReset").disabled=!zoomed;
  document.getElementById("zoomIn").disabled=Z>=Z_MAX-0.01;
  document.getElementById("zoomHint").textContent=Math.round(Z*100)+"%";
}
function zoomSoon(){ if(!zoomFrame) zoomFrame=requestAnimationFrame(()=>{ zoomFrame=0; applyZoom(true); }); }   // at most one update per screen frame
function zoomSettle(){ clearTimeout(settleTimer); if(zoomFrame){ cancelAnimationFrame(zoomFrame); zoomFrame=0; } applyZoom(); }
function centreMap(){ TX=mapWrap.clientWidth/2-BASE_W*(isWorld()?0.66:0.5); TY=0; }      // World map opens around Asia
function zoomAt(factor,cx,cy,fast){
  const nz=Math.min(Z_MAX,Math.max(1,Z*factor)), k=nz/Z;
  TX=cx-(cx-TX)*k; TY=cy-(cy-TY)*k; Z=nz;
  if(fast) zoomSoon(); else applyZoom();
}
function zoomCentre(factor){ zoomAt(factor,mapWrap.clientWidth/2,mapWrap.clientHeight/2); }
function wrapPoint(e){ const r=mapWrap.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; }
document.getElementById("zoomIn").onclick=()=>zoomCentre(1.6);
document.getElementById("zoomOut").onclick=()=>zoomCentre(1/1.6);
document.getElementById("zoomReset").onclick=()=>{ Z=1; centreMap(); applyZoom(); };
mapWrap.addEventListener("wheel",e=>{
  e.preventDefault();                                 // the page itself never scrolls, so the wheel always zooms the map
  const p=wrapPoint(e); zoomAt(Math.exp(-e.deltaY*(e.ctrlKey?0.01:0.002)),p.x,p.y,true);
  clearTimeout(settleTimer); settleTimer=setTimeout(zoomSettle,180);
},{passive:false});
let lastTouchEnd=0, lastTap=null;
mapWrap.addEventListener("dblclick",e=>{
  if(Date.now()-lastTouchEnd<700 || pinGame || e.target.closest(".marker,.zoom,.play-btn")) return;     // touch double-taps are handled below
  const p=wrapPoint(e); zoomAt(2,p.x,p.y);
});
["gesturestart","gesturechange","gestureend"].forEach(n=>mapWrap.addEventListener(n,e=>e.preventDefault()));   // iPhone: stop the whole page from zooming
const pointers=new Map(); let pinchDist=0, pinchMid=null;
mapWrap.addEventListener("pointerdown",e=>{
  dragMoved=false;
  if(e.target.closest(".zoom,.play-btn")) return;
  if(e.isPrimary) pointers.clear();                   // forget fingers the browser never told us had lifted
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY});
  gesturing=true; pinchDist=0; pinchMid=null;
});
window.addEventListener("pointermove",e=>{
  const prev=pointers.get(e.pointerId); if(!prev) return;
  if(pointers.size===1){
    if(!mapWrap.classList.contains("pannable")) return;
    if(!dragMoved && Math.hypot(e.clientX-prev.x0,e.clientY-prev.y0)<6) return;      // ignore tiny wobbles so taps still work
    if(!dragMoved){ dragMoved=true; mapWrap.classList.add("dragging"); prev.x=e.clientX; prev.y=e.clientY; return; }
    TX+=e.clientX-prev.x; TY+=e.clientY-prev.y;
    prev.x=e.clientX; prev.y=e.clientY;
    zoomSoon();
  }else if(pointers.size===2){
    prev.x=e.clientX; prev.y=e.clientY;
    const a=[...pointers.values()], d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y), r=mapWrap.getBoundingClientRect();
    const mid={x:(a[0].x+a[1].x)/2-r.left,y:(a[0].y+a[1].y)/2-r.top};
    if(pinchDist>0 && pinchMid){
      dragMoved=true;
      TX+=mid.x-pinchMid.x; TY+=mid.y-pinchMid.y;      // two fingers also slide the map
      zoomAt(d/pinchDist,mid.x,mid.y,true);
    }
    pinchDist=d; pinchMid=mid;
  }
},{passive:true});
function endPointer(e){
  const was=pointers.get(e.pointerId);
  if(!was) return;
  pointers.delete(e.pointerId); pinchDist=0; pinchMid=null;
  if(e.pointerType==="touch") lastTouchEnd=Date.now();
  if(pointers.size) return;
  mapWrap.classList.remove("dragging");
  gesturing=false;
  zoomSettle();                                       // redraw sharp at the final size
  // double-tap with a finger zooms in at that spot
  if(e.type==="pointerup" && e.pointerType==="touch" && !dragMoved && !pinGame && !e.target.closest(".marker,.zoom,.play-btn")){
    const now=Date.now();
    if(lastTap && now-lastTap.t<320 && Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<34){ const p=wrapPoint(e); zoomAt(Z>=Z_MAX-0.01?1/Z_MAX:2,p.x,p.y); lastTap=null; }
    else lastTap={t:now,x:e.clientX,y:e.clientY};
  }
}
window.addEventListener("pointerup",endPointer);
window.addEventListener("pointercancel",endPointer);
mapWrap.addEventListener("click",e=>{ if(dragMoved){ e.stopPropagation(); e.preventDefault(); dragMoved=false; } },true);   // a drag is not a tap on a pin
window.addEventListener("resize",()=>fitMap());
applyZoom();

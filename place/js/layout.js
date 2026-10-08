/* My Travel Map · layout.js
   Tabs, the sliding sheet and fitting the map to the screen. */
// =====================================================================
//  SCREEN LAYOUT: tabs, sliding sheet and a map that always fits the screen
// =====================================================================
const appEl=document.getElementById("app"), stageEl=document.getElementById("stage");
let curTab="map";
const TAB_TITLES={places:"📋 My places",board:"🏆 Leaderboard",fun:"🎯 Explore",more:"⚙️ More"};
function isWide(){return window.matchMedia("(min-width:901px)").matches;}
function showTab(t,keep){
  if(!keep && t===curTab && !isWide()) t="map";          // tap the open tab again to slide it away
  if(t==="map" && isWide()) t="places";                  // big screens always show a panel beside the map
  curTab=t;
  appEl.classList.toggle("sheet-open",t!=="map");
  document.querySelectorAll("[data-go]").forEach(b=>b.classList.toggle("on",b.dataset.go===t));
  document.querySelectorAll("#sheetBody section").forEach(s=>{ s.hidden=s.dataset.tab!==t; });
  document.getElementById("sheetTitle").textContent=TAB_TITLES[t]?T(TAB_TITLES[t]):"";
  if(t==="board") loadBoard();
}
function fitMap(){
  if(isWide() && curTab==="map") showTab("places");
  const W=stageEl.clientWidth-12, H=stageEl.clientHeight-12;
  if(W>0 && H>0){
    const containH=W*MAP_H/MAP_W;
    let w=W, h=containH;
    if(containH>H){ w=Math.max(140,H*MAP_W/MAP_H); h=w*MAP_H/MAP_W; BASE_W=w; }
    else if(isWorld() && containH<H*0.62){ h=H; BASE_W=H*MAP_W/MAP_H; }       // wide map on a tall phone: fill the height, slide sideways
    else BASE_W=W;
    mapWrap.style.width=w+"px"; mapWrap.style.height=h+"px";
    if(Z<=1.01) centreMap();
  }
  applyZoom();
}
document.querySelectorAll("[data-go]").forEach(b=>{ b.onclick=()=>showTab(b.dataset.go); });
document.getElementById("scrim").onclick=()=>showTab("map");
(function(){                                              // swipe the sheet down to close it
  const head=document.getElementById("sheetHead"); let y0=null;
  head.addEventListener("pointerdown",e=>{ y0=e.clientY; });
  head.addEventListener("pointerup",e=>{ if(y0!==null && e.clientY-y0>40 && !isWide()) showTab("map"); y0=null; });
  head.addEventListener("pointercancel",()=>{ y0=null; });
})();
function refreshChrome(){ showTab(curTab,true); renderLbSeg(); renderAcct(); renderCloudNote(); }

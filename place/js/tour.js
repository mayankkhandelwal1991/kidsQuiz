/* My Travel Map · tour.js
   The quick guide shown after the first sign-in. */
// ---- Quick guide shown after the first sign-in ----
const TOUR=[
  {sel:".add-row",t:"Add your first place",d:"Type a place name here and tap ＋. To add many at once, separate them with commas, like: Jaipur, Agra, Goa."},
  {sel:".add-row2",t:"Visited or wishlist",d:"Pick Visited for places you have been to, or Wishlist for places you dream of. The category is chosen for you, or pick your own."},
  {sel:"#mapWrap",t:"Your map",d:"Pins appear here and each visited state gets coloured in. Pinch to zoom, drag to move, and tap a pin to add the year, a photo, stars and a memory."},
  {sel:"#modeSeg",t:"India or World",d:"Switch between your India map and your World map. Your India places show on the World map too."},
  {sel:".act-row",t:"Play and share",d:"Watch your journey like a short film, share your map picture with friends, or tap 💡 for a fun fact about your places."},
  {sel:()=>isWide()?".sheet-tabs":"#nav",t:"Everything else is here",d:"Places is your list. Leaders has the leaderboard and friends groups. Explore has games, collections and your progress. More has backup and settings."}
];
function startTour(){
  if(document.getElementById("tourBox")) return;
  if(!isWide()) showTab("map",true);
  let i=0;
  const block=mkEl("div","tour-block"), hole=mkEl("div","tour-hole"), box=mkEl("div","tour-box");
  box.id="tourBox"; box.setAttribute("role","dialog");
  document.body.append(block,hole,box);
  const end=()=>{ block.remove(); hole.remove(); box.remove(); window.removeEventListener("resize",show); lsSet("myTourDoneV1",true); };
  const btn=(text,cls,fn)=>{ const b=mkEl("button",cls,text); b.type="button"; b.onclick=fn; return b; };
  function show(){
    const st=TOUR[i], el=document.querySelector(typeof st.sel==="function"?st.sel():st.sel);
    if(!el){ end(); return; }
    const r=el.getBoundingClientRect(), pad=6;
    hole.style.left=(r.left-pad)+"px"; hole.style.top=(r.top-pad)+"px"; hole.style.width=(r.width+pad*2)+"px"; hole.style.height=(r.height+pad*2)+"px";
    box.innerHTML="";
    const row=mkEl("div","tour-btns");
    row.append(btn(T("Skip"),"tour-skip",end));
    if(i>0) row.append(btn(T("Back"),"gray",()=>{ i--; show(); }));
    row.append(btn(i<TOUR.length-1?T("Next ➡️"):T("Start exploring 🎉"),"primary",()=>{ if(i<TOUR.length-1){ i++; show(); } else end(); }));
    box.append(mkEl("small","",(i+1)+" / "+TOUR.length),mkEl("b","",T(st.t)),mkEl("p","",T(st.d)),row);
    const bw=Math.min(340,innerWidth-24), bh=box.offsetHeight;
    box.style.width=bw+"px";
    box.style.left=Math.max(12,Math.min(innerWidth-bw-12,r.left+r.width/2-bw/2))+"px";
    const below=r.bottom+pad+12, above=r.top-pad-12-box.offsetHeight;
    box.style.top=(below+box.offsetHeight<innerHeight-8 ? below : above>8 ? above : Math.max(8,innerHeight-box.offsetHeight-16))+"px";   // tall targets: sit over the lower part
    box.querySelector(".primary").focus();
  }
  window.addEventListener("resize",show);
  show();
}
let tourTries=0;
function maybeTour(){                                // waits until the sign-in screen and any popups are gone
  if(lsGet("myTourDoneV1",false) || !fbUser || tourTries++>30) return;
  if(!document.getElementById("welcome").hidden || document.querySelector(".kid-overlay") || replaying) setTimeout(maybeTour,1500);
  else startTour();
}

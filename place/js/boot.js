/* My Travel Map · boot.js
   Runs last: starts the app once every other file is loaded. */
document.getElementById("inAppNote").hidden=!inAppBrowser();
document.getElementById("appVer").textContent="My Travel Map · v"+APP_VERSION+" · "+APP_DATE;

// ---- start-up ----
showTab(isWide()?"places":"map",true);
renderLbSeg();
if(localStorage.getItem("myIndiaAuthV2")!=="user") welcome(true);   // nobody gets in without Google sign-in

const soundToggle=document.getElementById("soundToggle");
soundToggle.checked=lsGet("myIndiaSoundV2",true)!==false;
soundToggle.addEventListener("change",()=>{ lsSet("myIndiaSoundV2",soundToggle.checked); if(soundToggle.checked) chime(); });

applyLang();
render();
fitMap();
renderAcct();
if(localStorage.getItem("myMapModeV2")==="world" && MODE!=="world") setMode("world");     // last time the World map was open: load it now

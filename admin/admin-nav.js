/* ============================================================
   Common admin header: one bar on every admin page so you can switch
   between sections in one tap and see your changes.
     users.html#dash|players|coins|app|tools   (Admin console sections)
     growth.html                               (Growth tracker)
     plan.html                                 (Growth plan checklist)
     index.html                                (Instagram Studio)
   Sections of the same page switch without reloading (the page listens
   to the URL hash). Include with <script src="admin-nav.js"></script>.
   ============================================================ */
(function () {
  'use strict';
  var ITEMS = [
    ['users.html#dash', '📊', 'Dashboard'],
    ['users.html#players', '👥', 'Players'],
    ['users.html#coins', '🪙', 'Coins'],
    ['users.html#app', '📱', 'App settings'],
    ['users.html#tools', '🛠', 'Tools'],
    ['growth.html', '📈', 'Growth'],
    ['plan.html', '✅', 'Growth plan'],
    ['index.html', '📸', 'Instagram Studio'],
    ['../quiz-home.html', '🎮', 'Open app']
  ];
  var css = '#kqAdminNav{position:sticky;top:0;z-index:1000;background:#1e1b4b;color:#fff;font:600 14px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.18)}' +
    '#kqAdminNav .in{max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:6px;padding:8px 12px;overflow-x:auto;scrollbar-width:none}' +
    '#kqAdminNav .in::-webkit-scrollbar{display:none}' +
    '#kqAdminNav b{font-size:15px;margin-right:6px;white-space:nowrap}' +
    '#kqAdminNav a{flex:0 0 auto;color:#e0e7ff;text-decoration:none;padding:7px 12px;border-radius:999px;white-space:nowrap;border:1px solid rgba(255,255,255,.15)}' +
    '#kqAdminNav a:hover{background:rgba(255,255,255,.1)}' +
    '#kqAdminNav a.on{background:#fff;color:#1e1b4b;border-color:#fff}' +
    '#kqAdminNav a.ext{margin-left:auto}' +
    'body>header{position:relative!important;top:auto!important}';   // page headers scroll away; this bar stays
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  function isOn(href) {
    var p = href.split('#'), file = p[0].split('/').pop().toLowerCase(), hash = p[1];
    if (file !== page) return false;
    if (!hash) return true;
    var cur = (location.hash || '#dash').slice(1);
    return cur === hash;
  }
  function draw(nav) {
    nav.innerHTML = '<div class="in"><b>⚙️ Kids Quiz Admin</b>' + ITEMS.map(function (it, i) {
      return '<a href="' + it[0] + '"' + (isOn(it[0]) ? ' class="on" aria-current="page"' : '') + (i === ITEMS.length - 1 ? ' class="ext"' : '') + '>' + it[1] + ' ' + it[2] + '</a>';
    }).join('') + '</div>';
    var on = nav.querySelector('a.on'); if (on && on.scrollIntoView) try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
  }
  function mount() {
    if (document.getElementById('kqAdminNav')) return;
    var nav = document.createElement('nav'); nav.id = 'kqAdminNav'; nav.setAttribute('aria-label', 'Admin sections');
    document.body.insertBefore(nav, document.body.firstChild);
    draw(nav);
    window.addEventListener('hashchange', function () { draw(nav); });
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();

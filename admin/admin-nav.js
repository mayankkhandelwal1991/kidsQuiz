/* ============================================================
   Common admin navigation, on every admin page.
     Desktop (900px and wider): a fixed sidebar on the left, sections grouped.
     Mobile: a top bar showing the current section with a ☰ button that opens
             the same menu as a slide-in drawer (tap outside, ✕ or Esc closes it).
   Sections:
     users.html#dash|players|coins|app|tools   (Admin console sections)
     growth.html                               (Growth tracker)
     plan.html                                 (Growth plan checklist)
     index.html                                (Instagram Studio)
   Sections of the same page switch without reloading (the page listens
   to the URL hash). Include with <script src="admin-nav.js"></script>.
   ============================================================ */
(function () {
  'use strict';
  var GROUPS = [
    ['Admin console', [
      ['users.html#dash', '📊', 'Dashboard'],
      ['users.html#players', '👥', 'Players'],
      ['users.html#coins', '🪙', 'Coins'],
      ['users.html#app', '📱', 'App settings'],
      ['users.html#tools', '🛠', 'Tools']
    ]],
    ['Growth', [
      ['growth.html', '📈', 'Growth'],
      ['plan.html', '✅', 'Growth plan']
    ]],
    ['Content', [
      ['index.html', '📸', 'Instagram Studio']
    ]]
  ];
  var APP = ['../quiz-home.html', '🎮', 'Open app'];
  var W = 240;   // sidebar width (px)

  var css =
    // shared
    '#kqNav,#kqTop{font:600 14px/1.25 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e0e7ff}' +
    '#kqNav{position:fixed;top:0;bottom:0;left:0;width:' + W + 'px;background:#1e1b4b;display:flex;flex-direction:column;z-index:15;box-shadow:2px 0 12px rgba(0,0,0,.15)}' +
    '#kqNav .brand{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:16px 16px 10px;font-size:16px;color:#fff;font-weight:800}' +
    '#kqNav .brand a{color:inherit;text-decoration:none}' +
    '#kqNav .scroll{flex:1;overflow-y:auto;padding:4px 10px 12px;scrollbar-width:thin}' +
    '#kqNav .grp{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a5b4fc;opacity:.8;padding:14px 10px 6px}' +
    '#kqNav a.it{display:flex;align-items:center;gap:10px;color:#e0e7ff;text-decoration:none;padding:9px 10px;margin:1px 0;border-radius:10px;min-height:40px;box-sizing:border-box}' +
    '#kqNav a.it .ic{width:22px;text-align:center;font-size:16px;flex:0 0 auto}' +
    '#kqNav a.it:hover{background:rgba(255,255,255,.08)}' +
    '#kqNav a.it.on{background:#fff;color:#1e1b4b}' +
    '#kqNav a.it:focus-visible,#kqTop button:focus-visible,#kqNav button:focus-visible{outline:2px solid #a5b4fc;outline-offset:2px}' +
    '#kqNav .foot{padding:10px;border-top:1px solid rgba(255,255,255,.12)}' +
    '#kqNav .foot a.it{border:1px solid rgba(255,255,255,.2);justify-content:center}' +
    '#kqNav .x{display:none;background:none;border:0;color:#fff;font-size:22px;line-height:1;padding:4px 8px;border-radius:8px;cursor:pointer}' +
    '#kqTop{display:none}' +
    '#kqShade{display:none}' +
    'body>header{position:relative!important;top:auto!important}' +   // page headers scroll away; the nav stays
    // desktop: sidebar always shown, page moved right
    '@media (min-width:900px){body.kq-nav{padding-left:' + W + 'px}}' +
    // mobile: top bar + drawer
    '@media (max-width:899.98px){' +
      '#kqTop{display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:15;background:#1e1b4b;padding:8px 12px;min-height:52px;box-sizing:border-box;box-shadow:0 2px 10px rgba(0,0,0,.18)}' +
      '#kqTop button{background:rgba(255,255,255,.1);border:0;color:#fff;font-size:20px;width:40px;height:40px;border-radius:10px;cursor:pointer;flex:0 0 auto}' +
      '#kqTop .t{display:flex;flex-direction:column;min-width:0}' +
      '#kqTop .t small{font-size:11px;font-weight:600;color:#a5b4fc}' +
      '#kqTop .t span{font-size:16px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#kqTop a.app{margin-left:auto;color:#e0e7ff;text-decoration:none;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:7px 12px;white-space:nowrap;flex:0 0 auto}' +
      '#kqNav{width:min(' + W + 'px,84vw);transform:translateX(-105%);transition:transform .22s ease;z-index:1001;visibility:hidden}' +
      '#kqNav.open{transform:none;visibility:visible}' +
      '#kqNav .x{display:block}' +
      '#kqNav a.it{min-height:44px}' +
      '#kqShade{display:block;position:fixed;inset:0;background:rgba(10,8,30,.5);z-index:1000;opacity:0;pointer-events:none;transition:opacity .22s}' +
      '#kqShade.open{opacity:1;pointer-events:auto}' +
      'body.kq-lock{overflow:hidden}' +
    '}' +
    '@media (prefers-reduced-motion:reduce){#kqNav,#kqShade{transition:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  function isOn(href) {
    var p = href.split('#'), file = p[0].split('/').pop().toLowerCase(), hash = p[1];
    if (file !== page) return false;
    if (!hash) return true;
    return (location.hash || '#dash').slice(1) === hash;
  }
  function current() {
    for (var g = 0; g < GROUPS.length; g++) {
      for (var i = 0; i < GROUPS[g][1].length; i++) {
        if (isOn(GROUPS[g][1][i][0])) return [GROUPS[g][0], GROUPS[g][1][i]];
      }
    }
    return ['Kids Quiz', ['', '⚙️', 'Admin']];
  }
  function link(it, extra) {
    var on = isOn(it[0]);
    return '<a class="it' + (on ? ' on' : '') + '" href="' + it[0] + '"' + (on ? ' aria-current="page"' : '') + (extra || '') + '>' +
      '<span class="ic" aria-hidden="true">' + it[1] + '</span><span>' + it[2] + '</span></a>';
  }

  var nav, top, shade, btn;
  function draw() {
    nav.innerHTML = '<div class="brand"><a href="users.html#dash">⚙️ Kids Quiz Admin</a>' +
      '<button class="x" type="button" aria-label="Close menu">✕</button></div>' +
      '<div class="scroll">' + GROUPS.map(function (g) {
        return '<div class="grp">' + g[0] + '</div>' + g[1].map(function (it) { return link(it); }).join('');
      }).join('') + '</div>' +
      '<div class="foot">' + link(APP) + '</div>';
    var c = current();
    top.innerHTML = '<button type="button" aria-label="Open menu" aria-controls="kqNav" aria-expanded="false">☰</button>' +
      '<div class="t"><small>' + c[0] + '</small><span>' + c[1][1] + ' ' + c[1][2] + '</span></div>' +
      '<a class="app" href="' + APP[0] + '">' + APP[1] + ' App</a>';
    btn = top.querySelector('button');
    btn.addEventListener('click', open);
    nav.querySelector('.x').addEventListener('click', close);
  }
  function isMobile() { return window.matchMedia('(max-width: 899.98px)').matches; }
  function open() {
    nav.classList.add('open'); shade.classList.add('open'); document.body.classList.add('kq-lock');
    btn.setAttribute('aria-expanded', 'true');
    var on = nav.querySelector('a.on') || nav.querySelector('a.it'); if (on) on.focus();
  }
  function close() {
    if (!nav.classList.contains('open')) return;
    nav.classList.remove('open'); shade.classList.remove('open'); document.body.classList.remove('kq-lock');
    if (btn) { btn.setAttribute('aria-expanded', 'false'); if (isMobile()) btn.focus(); }
  }
  function mount() {
    if (document.getElementById('kqNav')) return;
    nav = document.createElement('nav'); nav.id = 'kqNav'; nav.setAttribute('aria-label', 'Admin sections');
    top = document.createElement('div'); top.id = 'kqTop';
    shade = document.createElement('div'); shade.id = 'kqShade';
    document.body.insertBefore(shade, document.body.firstChild);
    document.body.insertBefore(nav, document.body.firstChild);
    document.body.insertBefore(top, document.body.firstChild);
    document.body.classList.add('kq-nav');
    draw();
    shade.addEventListener('click', close);
    // a tap on a link closes the drawer (same-page sections only change the hash)
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    window.addEventListener('hashchange', function () { close(); draw(); });
    window.matchMedia('(max-width: 899.98px)').addEventListener('change', close);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();

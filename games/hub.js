/* ============================================================
   GAME HUB — shared kid-friendly hub for Single-player
   (games/index.html) and Multiplayer (multiplayer/index.html).

   KQHub.render({
     mode: 'single' | 'multi',
     base: '../',                 // path to the app root (for images)
     title, subtitle,
     tabs: [{id, label, icon}],   // filter chips ('all' is added first)
     games: [{id, file, icon, title, how, tab, badge, players}],
     boardCat: 'single' | 'multi'
   })
   Needs: emoji-images.js (pictures), quiz/kids-sound.js (sounds),
          quiz-shared.js is optional (player name, mute).
   ============================================================ */
(function () {
  'use strict';
  const CSS = `
  :root { --ink:#2b1d4f; --muted:#6b6185; --sky1:#e0e7ff; --sky2:#fce7f3; --hill1:#c4b5fd; --hill2:#8b5cf6; }
  body.hub-multi { --sky1:#cffafe; --sky2:#e0f2fe; --hill1:#7dd3fc; --hill2:#0ea5e9; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html, body { margin:0; }
  body.hub { font-family:'Baloo 2','Nunito',system-ui,sans-serif; color:var(--ink); min-height:100dvh; overflow-x:hidden;
    background:linear-gradient(180deg,var(--sky1),var(--sky2) 70%); background-attachment:fixed; display:block !important; padding:0 !important; height:auto !important; animation:none !important; }
  body.hub button { font-family:inherit; cursor:pointer; }
  .hub img.emoji-img { pointer-events:none; user-select:none; -webkit-user-drag:none; vertical-align:middle; }
  .h-scene { position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
  .h-scene .hills { position:absolute; left:0; right:0; bottom:0; width:100%; height:24vh; min-height:130px; }
  .h-scene .sun { position:absolute; top:4vh; right:6vw; width:84px; height:84px; border-radius:50%; background:radial-gradient(circle,#fde047 55%,rgba(253,224,71,0) 72%); }
  .h-cloud { position:absolute; width:120px; height:40px; background:#fff; border-radius:40px; opacity:.85; animation:hdrift 45s linear infinite; }
  .h-cloud::before,.h-cloud::after { content:''; position:absolute; background:#fff; border-radius:50%; }
  .h-cloud::before { width:54px; height:54px; top:-26px; left:18px; } .h-cloud::after { width:40px; height:40px; top:-18px; left:58px; }
  .h-cloud.c1 { top:12vh; left:-140px; } .h-cloud.c2 { top:28vh; left:-140px; animation-duration:60s; animation-delay:-25s; transform:scale(.7); }
  @keyframes hdrift { to { left:110vw; } }
  .h-app { position:relative; z-index:1; max-width:1040px; margin:0 auto; padding:max(12px,env(safe-area-inset-top)) 14px 120px; }
  .h-bar { display:flex; align-items:center; gap:10px; }
  .h-btn { width:46px; height:46px; border-radius:16px; border:none; background:#fff; color:var(--ink); font-size:22px; font-weight:800; box-shadow:0 5px 0 rgba(0,0,0,.12); display:grid; place-items:center; flex:0 0 auto; }
  .h-btn:active { transform:translateY(3px); box-shadow:0 2px 0 rgba(0,0,0,.12); }
  .h-bar h1 { flex:1; margin:0; font-size:26px; line-height:1.1; }
  .h-hello { display:flex; align-items:center; gap:12px; margin:8px 0 12px; }
  .h-hello h2 { margin:0; font-size:24px; line-height:1.1; } .h-hello p { margin:2px 0 0; font-weight:700; color:var(--muted); }
  .h-owl { width:88px; height:88px; flex:0 0 auto; filter:drop-shadow(0 6px 6px rgba(0,0,0,.15)); animation:hbob 3s ease-in-out infinite; }
  @keyframes hbob { 50% { transform:translateY(-6px) rotate(-3deg); } }
  .h-chips { display:flex; gap:8px; overflow-x:auto; padding:4px 2px 10px; scrollbar-width:none; }
  .h-chips::-webkit-scrollbar { display:none; }
  .h-chip { flex:0 0 auto; border:3px solid #fff; background:rgba(255,255,255,.75); border-radius:999px; padding:6px 14px 6px 8px; font-size:14px; font-weight:800; color:var(--ink); display:flex; align-items:center; gap:6px; box-shadow:0 4px 0 rgba(0,0,0,.08); }
  .h-chip.on { background:var(--chip,#6366f1); color:#fff; box-shadow:0 4px 0 rgba(0,0,0,.18); }
  .h-sec { display:flex; align-items:center; gap:8px; margin:12px 2px 8px; font-size:18px; font-weight:800; }
  .h-row { display:flex; gap:12px; overflow-x:auto; padding:4px 2px 12px; scrollbar-width:none; }
  .h-row::-webkit-scrollbar { display:none; }
  .h-row .h-card { flex:0 0 132px; }
  .h-grid { display:grid; gap:14px; grid-template-columns:repeat(2,1fr); }
  .h-card { position:relative; border:none; padding:0; border-radius:24px; background:#fff; box-shadow:0 7px 0 rgba(0,0,0,.1),0 12px 22px rgba(0,0,0,.08); overflow:hidden; text-align:center; color:var(--ink); animation:hpop .4s cubic-bezier(.34,1.56,.64,1) both; }
  .h-card:active { transform:translateY(4px); box-shadow:0 3px 0 rgba(0,0,0,.1); }
  @keyframes hpop { from { transform:scale(.7); opacity:0; } to { transform:none; opacity:1; } }
  .h-card .top { height:98px; display:grid; place-items:center; position:relative; }
  .h-card .top::after { content:''; position:absolute; width:110px; height:110px; right:-40px; top:-50px; border-radius:50%; background:rgba(255,255,255,.2); }
  .h-card .pic { animation:hwig 3.2s ease-in-out infinite; position:relative; z-index:1; filter:drop-shadow(0 4px 2px rgba(0,0,0,.15)); }
  .h-card:nth-child(3n) .pic { animation-delay:.6s; } .h-card:nth-child(3n+1) .pic { animation-delay:1.2s; }
  @keyframes hwig { 0%,80%,100% { transform:rotate(0) scale(1); } 86% { transform:rotate(-10deg) scale(1.08); } 92% { transform:rotate(8deg) scale(1.08); } }
  .h-card .nm { display:block; padding:8px 8px 10px; font-size:15px; font-weight:800; line-height:1.1; }
  .h-card .bdg { position:absolute; top:8px; left:8px; z-index:2; background:#fff; color:#e11d48; font-size:11px; font-weight:800; border-radius:999px; padding:2px 8px; box-shadow:0 2px 0 rgba(0,0,0,.1); }
  .h-card .pl { position:absolute; top:8px; right:8px; z-index:2; background:rgba(0,0,0,.25); color:#fff; font-size:11px; font-weight:800; border-radius:999px; padding:2px 8px; }
  .h-sheet-bg { position:fixed; inset:0; z-index:40; background:rgba(20,10,50,.45); display:none; }
  .h-sheet-bg.on { display:block; }
  .h-sheet { position:fixed; left:50%; bottom:0; z-index:41; width:100%; max-width:520px; transform:translate(-50%,110%); transition:transform .35s cubic-bezier(.34,1.3,.64,1); background:#fff; border-radius:30px 30px 0 0; padding:14px 18px calc(18px + env(safe-area-inset-bottom)); text-align:center; box-shadow:0 -10px 40px rgba(0,0,0,.25); }
  .h-sheet.on { transform:translate(-50%,0); }
  .h-sheet .grab { width:48px; height:6px; border-radius:3px; background:#e5e7eb; margin:0 auto 8px; }
  .h-sheet .big { width:116px; height:116px; margin:4px auto 6px; border-radius:34px; display:grid; place-items:center; box-shadow:inset 0 -8px 0 rgba(0,0,0,.12); }
  .h-sheet h2 { margin:4px 0; font-size:26px; }
  .h-sheet .how { margin:6px 0 14px; color:var(--muted); font-weight:700; line-height:1.4; font-size:15px; }
  .h-sheet .how b { color:var(--ink); }
  .h-play { width:100%; border:none; border-radius:22px; padding:15px; font-size:22px; font-weight:800; color:#fff; background:linear-gradient(135deg,#22c55e,#16a34a); box-shadow:0 6px 0 #15803d; animation:hpulse 1.6s ease-in-out infinite; }
  @keyframes hpulse { 50% { transform:scale(1.03); } }
  .h-row2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
  .h-alt { border:none; border-radius:18px; padding:12px; font-size:16px; font-weight:800; background:#f1f0fb; color:var(--ink); box-shadow:0 4px 0 #ddd6fe; }
  .h-empty { text-align:center; color:var(--muted); font-weight:800; padding:30px; }
  @media (min-width:640px) { .h-grid { grid-template-columns:repeat(3,1fr); } }
  @media (min-width:900px) { .h-grid { grid-template-columns:repeat(5,1fr); } .h-card .top { height:110px; } .h-owl { width:110px; height:110px; } .h-bar h1 { font-size:32px; } }
  @media (prefers-reduced-motion: reduce) { .hub *, .hub *::before, .hub *::after { animation:none !important; transition:none !important; } }
  `;
  const COLORS = [['#fb7185', '#f43f5e'], ['#a78bfa', '#7c3aed'], ['#4ade80', '#16a34a'], ['#60a5fa', '#2563eb'], ['#fbbf24', '#f59e0b'], ['#f472b6', '#db2777'], ['#2dd4bf', '#0d9488'], ['#fb923c', '#ea580c'], ['#c084fc', '#9333ea'], ['#38bdf8', '#0284c7']];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function owl() {
    return '<svg class="h-owl" viewBox="0 0 120 120" aria-hidden="true"><path d="M30 30 L40 12 L50 30Z" fill="#7c3aed"/><path d="M70 30 L80 12 L90 30Z" fill="#7c3aed"/><ellipse cx="60" cy="70" rx="42" ry="44" fill="#8b5cf6"/><ellipse cx="60" cy="82" rx="26" ry="28" fill="#ede9fe"/><path d="M18 66 Q8 86 26 100 Q30 82 24 66Z" fill="#7c3aed"/><path d="M102 66 Q112 86 94 100 Q90 82 96 66Z" fill="#7c3aed"/><circle cx="44" cy="50" r="17" fill="#fff"/><circle cx="76" cy="50" r="17" fill="#fff"/><circle cx="46" cy="51" r="8" fill="#1e1b4b"/><circle cx="74" cy="51" r="8" fill="#1e1b4b"/><circle cx="49" cy="48" r="3" fill="#fff"/><circle cx="77" cy="48" r="3" fill="#fff"/><path d="M54 62 L66 62 L60 72Z" fill="#f59e0b"/><ellipse cx="46" cy="114" rx="8" ry="4" fill="#f59e0b"/><ellipse cx="74" cy="114" rx="8" ry="4" fill="#f59e0b"/><rect x="34" y="88" width="52" height="16" rx="8" fill="#1e1b4b"/><circle cx="44" cy="96" r="3" fill="#f43f5e"/><circle cx="76" cy="96" r="3" fill="#22c55e"/></svg>';
  }

  function render(cfg) {
    const base = cfg.base || '../';
    const img = (t, px) => (typeof emojiImgHtml === 'function' ? emojiImgHtml(t, px, base) : esc(t));
    const snd = window.KidSound || { tap() {}, correct() {}, setTheme() {}, unlock() {} };
    snd.setTheme && snd.setTheme(cfg.mode === 'multi' ? 'jungle' : 'arcade');
    const muted = () => { try { return localStorage.getItem('kq_muted') === '1'; } catch (e) { return false; } };
    const RECENT_KEY = 'kq_recent_games_' + cfg.mode;
    const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; } };
    const name = (() => { try { const a = JSON.parse(localStorage.getItem('kq_cached_auth') || 'null'); return (a && a.name) || localStorage.getItem('kq_nick') || 'Champ'; } catch (e) { return 'Champ'; } })();

    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    document.body.className = 'hub' + (cfg.mode === 'multi' ? ' hub-multi' : '');
    document.body.innerHTML =
      '<div class="h-scene" aria-hidden="true"><div class="sun"></div><div class="h-cloud c1"></div><div class="h-cloud c2"></div>' +
      '<svg class="hills" viewBox="0 0 1200 260" preserveAspectRatio="none"><path d="M0 140 Q 200 40 420 130 T 860 110 T 1200 120 V260 H0Z" fill="var(--hill1)"/><path d="M0 190 Q 260 110 520 185 T 1000 170 T 1200 175 V260 H0Z" fill="var(--hill2)"/></svg></div>' +
      '<div class="h-app" id="hApp"></div><div class="h-sheet-bg" id="hBg"></div><div class="h-sheet" id="hSheet" role="dialog" aria-modal="true"></div>';
    const $app = document.getElementById('hApp');
    let tab = 'all';
    const tabColor = {}; (cfg.tabs || []).forEach((t, i) => { tabColor[t.id] = t.color || COLORS[i % COLORS.length]; });
    const colorOf = (g, i) => (cfg.colorByTab !== false && tabColor[g.tab]) || COLORS[cfg.games.indexOf(g) % COLORS.length];

    function card(g, i) {
      const c = colorOf(g, i);
      return '<button class="h-card" data-id="' + esc(g.id) + '" style="animation-delay:' + Math.min(i, 20) * 30 + 'ms">' +
        (g.badge ? '<span class="bdg">' + esc(g.badge) + '</span>' : '') + (g.players ? '<span class="pl">👥 ' + esc(g.players) + '</span>' : '') +
        '<span class="top" style="background:linear-gradient(135deg,' + c[0] + ',' + c[1] + ')"><span class="pic">' + img(g.icon, 60) + '</span></span>' +
        '<span class="nm">' + esc(g.title) + '</span></button>';
    }
    function draw() {
      const list = cfg.games.filter((g) => tab === 'all' || g.tab === tab);
      const rec = recent().map((id) => cfg.games.find((g) => g.id === id)).filter(Boolean).slice(0, 8);
      const hot = cfg.games.filter((g) => g.badge).slice(0, 10);
      let h = '<div class="h-bar"><button class="h-btn" id="hHome" aria-label="Home">🏠</button><h1>' + esc(cfg.title) + '</h1>' +
        '<button class="h-btn" id="hBoard" aria-label="Leaderboard">🏆</button><button class="h-btn" id="hMute" aria-label="Sound">' + (muted() ? '🔇' : '🔊') + '</button></div>' +
        '<div class="h-hello">' + owl() + '<div><h2>Let’s play, ' + esc(name) + '!</h2><p>' + esc(cfg.subtitle) + '</p></div></div>';
      if (cfg.tabs && cfg.tabs.length) {
        h += '<div class="h-chips"><button class="h-chip' + (tab === 'all' ? ' on' : '') + '" data-tab="all" style="--chip:#6366f1">' + img('🕹️', 26) + 'All</button>' +
          cfg.tabs.map((t) => '<button class="h-chip' + (tab === t.id ? ' on' : '') + '" data-tab="' + esc(t.id) + '" style="--chip:' + tabColor[t.id][1] + '">' + img(t.icon, 26) + esc(t.label) + '</button>').join('') + '</div>';
      }
      if (tab === 'all' && rec.length) h += '<div class="h-sec">' + img('▶️', 24) + ' Play again</div><div class="h-row">' + rec.map(card).join('') + '</div>';
      if (tab === 'all' && hot.length) h += '<div class="h-sec">' + img('🆕', 24) + ' New &amp; popular</div><div class="h-row">' + hot.map(card).join('') + '</div>';
      const tl = tab === 'all' ? 'All games' : (cfg.tabs.find((t) => t.id === tab) || {}).label;
      h += '<div class="h-sec">' + img('🎮', 24) + ' ' + esc(tl) + ' <span style="color:var(--muted);font-size:14px">(' + list.length + ')</span></div>';
      h += list.length ? '<div class="h-grid">' + list.map(card).join('') + '</div>' : '<div class="h-empty">No games here yet.</div>';
      $app.innerHTML = h;
      $app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { snd.unlock(); snd.tap(); tab = b.dataset.tab; draw(); });
      $app.querySelectorAll('.h-card').forEach((b) => b.onclick = () => { snd.unlock(); snd.tap(); open(b.dataset.id); });
      document.getElementById('hHome').onclick = () => { location.href = base + 'quiz-home.html'; };
      document.getElementById('hBoard').onclick = () => { location.href = base + 'leaderboard.html?cat=' + cfg.boardCat; };
      const m = document.getElementById('hMute');
      m.onclick = () => { try { localStorage.setItem('kq_muted', muted() ? '0' : '1'); } catch (e) {} m.textContent = muted() ? '🔇' : '🔊'; if (!muted()) snd.tap(); };
    }
    const sheet = document.getElementById('hSheet'), bg = document.getElementById('hBg');
    function close() { sheet.classList.remove('on'); bg.classList.remove('on'); }
    bg.onclick = close;
    function open(id) {
      const i = cfg.games.findIndex((g) => g.id === id); const g = cfg.games[i]; if (!g) return;
      const c = colorOf(g, i);
      sheet.innerHTML = '<div class="grab"></div><div class="big" style="background:linear-gradient(135deg,' + c[0] + ',' + c[1] + ')">' + img(g.icon, 80) + '</div>' +
        '<h2>' + esc(g.title) + '</h2>' + (g.players ? '<div style="font-weight:800;color:#0284c7">👥 ' + esc(g.players) + ' players • online</div>' : '') +
        '<p class="how"><b>How to play:</b> ' + esc(g.how) + '</p>' +
        '<button class="h-play" id="hPlay">▶ Play!</button>' +
        '<div class="h-row2"><button class="h-alt" id="hLb">🏆 Leaderboard</button><button class="h-alt" id="hClose">✕ Close</button></div>';
      sheet.classList.add('on'); bg.classList.add('on');
      document.getElementById('hClose').onclick = close;
      document.getElementById('hLb').onclick = () => { if (window.KQ && KQ.open) KQ.open(cfg.boardCat, g.boardId || g.id, g.title); else location.href = base + 'leaderboard.html?cat=' + cfg.boardCat; };
      document.getElementById('hPlay').onclick = () => {
        snd.correct();
        try { const r = recent().filter((x) => x !== g.id); r.unshift(g.id); localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 12))); } catch (e) {}
        setTimeout(() => { location.href = g.file; }, 250);
      };
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    draw();
    return { redraw: draw };
  }
  window.KQHub = { render };
})();

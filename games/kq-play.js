/* ============================================================================
   KQPlay — the "Fun zone": things that bring kids back every day
   ----------------------------------------------------------------------------
     🛍️ Owl shop        spend coins on owl hats & glasses, photo frames, home themes
     🎁 Daily gift      7-day calendar (day 7 = big chest), resets if a day is missed
     ❓ Question of the day   one question from the kid's class, bonus coins
     🗺️ My path        a winding map per class, 1–3 stars per subject, unlocks the next
     🏆 Weekly league   points per finished quiz/game, by class or with a class code
     📊 My week         weekly report (+ Sunday notification in the Android app)
     🎓 Certificates    for badges and Olympiad papers, shareable as a picture

   Everything is saved in the player's coin wallet (wallets/<player>) via
   KQCoins, so it follows them to other devices. Leagues live in
   leagues/<week>/<group>/<player> (Firebase rule: admin/README-admin.md).
   Loaded on every page by kq-leaderboard.js, after kq-coins.js.
   Home page: KQPlay.mountHome(element)
   ========================================================================== */
(function () {
  'use strict';
  if (window.KQPlay) return;

  var BASE = (function () { var sc = document.currentScript && document.currentScript.src; return sc ? sc.replace(/[^/]*$/, '') : ''; })();
  var ROOT = BASE + '../';
  function C() { return window.KQCoins || null; }
  function W() { var c = C(); return (c && c.wallet()) || null; }
  function coinsOn() { var c = C(); return !!(c && c.enabled()); }
  function user() { try { return window.KQ && KQ.user ? KQ.user() : null; } catch (e) { return null; } }
  function firstName() { var n = ((user() || {}).name || '').trim().split(/\s+/)[0]; return (n || 'Friend').slice(0, 14); }
  function db() { try { return firebase.database(); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function emo(e, size) {
    var cp = Array.from(String(e)).map(function (c) { return c.codePointAt(0); }).filter(function (c) { return c !== 0xfe0f; }).map(function (c) { return c.toString(16); }).join('-');
    return '<img src="' + ROOT + 'images/emoji/' + cp + '.svg" alt="' + esc(e) + '" width="' + size + '" height="' + size + '" style="width:' + size + 'px;height:' + size + 'px" onerror="this.replaceWith(document.createTextNode(this.alt))">';
  }
  function coin(size) { var c = C(); return c ? c.coinImg(size) : '🪙'; }
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function today() { return dayKey(Date.now()); }
  function weekKey(t) { var d = new Date(t); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d.getTime()); }
  function nextMonday() { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + (8 - (d.getDay() || 7))); return d.getTime(); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function toast(t, big) { var c = C(); if (c && c.toast) c.toast(t, big); }
  function celebrate() { try { if (window.KQFX && KQFX.celebrate) KQFX.celebrate(); } catch (e) {} }
  // Save something in the wallet (delta 0 = no coins, nothing in the coin history)
  function save(delta, label, mutate) { var c = C(); if (c && c.tx) c.tx(delta, label, mutate); }

  /* ---------------------------------------------------------------- classes */
  var LEVELS = [0, -1, 1, 2, 3, 4, 5];
  function classLbl(n) { n = parseInt(n, 10); return n === 0 ? 'LKG' : n === -1 ? 'UKG' : 'Class ' + n; }
  function myClass() {
    var w = W(); if (w && w.cls != null && LEVELS.indexOf(+w.cls) >= 0) return +w.cls;
    var l = null; try { l = localStorage.getItem('kq_last_class'); } catch (e) {}
    l = parseInt(l, 10); return LEVELS.indexOf(l) >= 0 ? l : 1;
  }
  function setClass(n) { save(0, '', function (w) { w.cls = n; }); try { localStorage.setItem('kq_last_class', n); } catch (e) {} }
  function classChips(cur, attr) {
    return '<div class="kqp-chips">' + LEVELS.map(function (n) { return '<button type="button" class="' + (n === cur ? 'on' : '') + '" ' + attr + '="' + n + '">' + classLbl(n) + '</button>'; }).join('') + '</div>';
  }

  /* Subjects with question files for every class (quiz/<id>/class<N>.js). */
  var SUBJ = [
    { id: 'gk', icon: '🌍', t: 'GK' }, { id: 'english', icon: '🔤', t: 'English' }, { id: 'science', icon: '🔬', t: 'Science' },
    { id: 'animals', icon: '🐾', t: 'Animals' }, { id: 'hindi', icon: '📖', t: 'Hindi' }, { id: 'plants', icon: '🌱', t: 'Plants' },
    { id: 'space', icon: '🚀', t: 'Space' }, { id: 'humanbody', icon: '💪', t: 'Human Body' }, { id: 'geography', icon: '🗺️', t: 'Geography' },
    { id: 'computers', icon: '💻', t: 'Computers' }, { id: 'sports', icon: '⚽', t: 'Sports' },
    { id: 'history', icon: '📜', t: 'History', min: 1 }, { id: 'capitals', icon: '🏛️', t: 'Capitals', min: 1 }, { id: 'riddles', icon: '🧩', t: 'Riddles', min: 1 }
  ];
  function subjectsFor(lvl) { return SUBJ.filter(function (s) { return !s.min || lvl >= s.min; }); }
  function bankFile(sub, lvl) { return ROOT + 'quiz/' + sub + '/' + (lvl === -1 ? 'ukg' : 'class' + lvl) + '.js'; }

  /* ------------------------------------------------------------------- CSS */
  function css() {
    if (document.getElementById('kqp-css')) return;
    var st = document.createElement('style'); st.id = 'kqp-css';
    st.textContent = [
      '.kqp-ov{position:fixed;inset:0;z-index:2147483640;background:rgba(15,10,40,.6);display:flex;align-items:center;justify-content:center;padding:14px;animation:kqpIn .2s ease-out}',
      '@keyframes kqpIn{from{opacity:0}to{opacity:1}}@keyframes kqpPop{0%{transform:scale(.6)}100%{transform:scale(1)}}@keyframes kqpBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}',
      '@keyframes kqpPulse{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,.55)}50%{box-shadow:0 0 0 10px rgba(249,115,22,0)}}',
      '.kqp-sheet{position:relative;background:#fffdf7;color:#1e1b4b;border-radius:26px;width:100%;max-width:420px;max-height:92vh;overflow:auto;overflow-x:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:"Baloo 2",system-ui,sans-serif;text-align:center;animation:kqpPop .3s cubic-bezier(.34,1.56,.64,1)}',
      '.kqp-hero{position:relative;padding:18px 16px 16px;color:#fff;border-radius:26px 26px 0 0;background-image:radial-gradient(circle at 12% 25%,rgba(255,255,255,.25) 0 6px,transparent 7px),radial-gradient(circle at 88% 35%,rgba(255,255,255,.2) 0 4px,transparent 5px),radial-gradient(circle at 70% 85%,rgba(255,255,255,.18) 0 5px,transparent 6px)}',
      '.kqp-hero .big{display:grid;place-items:center;width:78px;height:78px;margin:0 auto;border-radius:50%;background:rgba(255,255,255,.95);box-shadow:inset 0 -4px 0 rgba(0,0,0,.08);animation:kqpBob 3s ease-in-out infinite}',
      '.kqp-hero h3{margin:8px 0 0;font-size:23px;color:#fff;line-height:1.15}.kqp-hero p{margin:2px 0 0;color:rgba(255,255,255,.92);font-weight:700;font-size:14px}',
      '.kqp-x{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.25);color:#fff;font:800 16px system-ui;cursor:pointer}',
      '.kqp-body{padding:12px 14px 16px}.kqp-body h4{margin:14px 0 8px;font-size:16px;text-align:left}',
      '.kqp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:16px;padding:11px 18px;font:800 16px "Baloo 2",system-ui,sans-serif;cursor:pointer;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;box-shadow:0 5px 0 #15803d}',
      '.kqp-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #15803d}.kqp-btn[disabled]{background:#cbd5e1;box-shadow:0 5px 0 #94a3b8;cursor:default}',
      '.kqp-btn.alt{background:#eef2ff;color:#4338ca;box-shadow:0 4px 0 #c7d2fe}.kqp-btn.sm{padding:6px 12px;font-size:13px;border-radius:12px;box-shadow:0 3px 0 #15803d}.kqp-btn.sm.alt{box-shadow:0 3px 0 #c7d2fe}',
      '.kqp-chips{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 6px;scrollbar-width:none}.kqp-chips::-webkit-scrollbar{display:none}',
      '.kqp-chips button{flex:0 0 auto;border:0;border-radius:999px;padding:6px 12px;font:800 13px "Baloo 2",system-ui,sans-serif;background:#f1f5f9;color:#475569;cursor:pointer}.kqp-chips button.on{background:#6366f1;color:#fff}',
      '.kqp-tabs{display:flex;gap:6px;justify-content:center;margin:0 0 10px}.kqp-tabs button{border:0;border-radius:999px;padding:7px 14px;font:800 14px "Baloo 2",system-ui,sans-serif;background:#f1f5f9;color:#334155;cursor:pointer}.kqp-tabs button.on{background:#f59e0b;color:#fff}',
      '.kqp-note{color:#6b7280;font-weight:700;font-size:13px;margin:8px 0 0}.kqp-err{color:#dc2626;font-weight:800}',
      /* home tiles */
      '.kqp-home{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:6px 0 14px}',
      '.kqp-tile{position:relative;border:0;border-radius:20px;padding:12px 6px 10px;color:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:"Baloo 2",system-ui,sans-serif;box-shadow:0 5px 0 rgba(0,0,0,.15),0 10px 18px rgba(0,0,0,.1);overflow:hidden;-webkit-tap-highlight-color:transparent}',
      '.kqp-tile:active{transform:translateY(3px)}.kqp-tile .ic{display:grid;place-items:center;width:46px;height:46px;border-radius:16px;background:rgba(255,255,255,.9);margin-bottom:3px}',
      '.kqp-tile b{font-size:14px;line-height:1.1}.kqp-tile small{font-size:11px;font-weight:700;opacity:.92;line-height:1.15}',
      '.kqp-tile .dot{position:absolute;top:8px;right:8px;min-width:12px;height:12px;border-radius:999px;background:#ef4444;border:2px solid #fff;animation:kqpPulse 1.6s infinite}',
      '.kqp-tile::after{content:"";position:absolute;width:70px;height:70px;right:-24px;top:-28px;border-radius:50%;background:rgba(255,255,255,.18)}',
      /* daily gift */
      '.kqp-cal{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}',
      '.kqp-day{position:relative;border-radius:16px;padding:8px 4px;background:#f1f5f9;display:flex;flex-direction:column;align-items:center;gap:2px;font-weight:800;color:#64748b;font-size:12px}',
      '.kqp-day b{font-size:14px;color:#92400e;display:flex;align-items:center;gap:2px}.kqp-day.got{background:#dcfce7;color:#166534}.kqp-day.got img{opacity:.55}',
      '.kqp-day.now{background:linear-gradient(135deg,#fef3c7,#fdba74);color:#7c2d12;animation:kqpPulse 1.6s infinite}.kqp-day.chest{grid-column:span 2;background:linear-gradient(135deg,#ede9fe,#c4b5fd);color:#4c1d95}',
      '.kqp-day .ok{position:absolute;top:4px;right:6px}',
      /* question of the day */
      '.kqp-q{background:#fff;border-radius:18px;padding:14px;box-shadow:0 4px 14px rgba(79,70,229,.12);font-weight:800;font-size:18px;line-height:1.3;margin-bottom:12px}',
      '.kqp-q small{display:block;color:#6366f1;font-size:12px;margin-bottom:4px}',
      '.kqp-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px}.kqp-opt{border:0;border-radius:16px;padding:12px 8px;font:800 15px "Baloo 2",system-ui,sans-serif;background:#eef2ff;color:#312e81;cursor:pointer;box-shadow:0 4px 0 #c7d2fe;min-height:54px}',
      '.kqp-opt.ok{background:#22c55e;color:#fff;box-shadow:0 4px 0 #15803d}.kqp-opt.no{background:#ef4444;color:#fff;box-shadow:0 4px 0 #b91c1c}.kqp-opt[disabled]{cursor:default}',
      /* learning map */
      '.kqp-map{position:relative;margin:6px auto 0;max-width:340px}.kqp-map svg{position:absolute;left:0;top:0;width:100%;overflow:visible;pointer-events:none}',
      '.kqp-node{position:absolute;transform:translateX(-50%);width:86px;border:0;background:none;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;font-family:inherit}',
      '.kqp-node .c{display:grid;place-items:center;width:66px;height:66px;border-radius:50%;background:linear-gradient(135deg,#a5b4fc,#6366f1);box-shadow:0 6px 0 #4338ca,0 10px 16px rgba(67,56,202,.25);position:relative}',
      '.kqp-node .c .in{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#fff}',
      '.kqp-node.done .c{background:linear-gradient(135deg,#fde047,#f59e0b);box-shadow:0 6px 0 #b45309,0 10px 16px rgba(180,83,9,.25)}',
      '.kqp-node.lock .c{background:#e2e8f0;box-shadow:0 6px 0 #cbd5e1}.kqp-node.lock .in img{filter:grayscale(1);opacity:.4}.kqp-node.lock{cursor:default}',
      '.kqp-node.cur .c{animation:kqpBob 1.6s ease-in-out infinite}.kqp-node .go{position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:#f97316;color:#fff;font-size:11px;font-weight:800;border-radius:999px;padding:1px 8px;white-space:nowrap}',
      '.kqp-node .st{display:flex;gap:1px;margin-top:6px;height:16px}.kqp-node .nm{font-size:12px;font-weight:800;color:#1e1b4b;line-height:1.1;margin-top:1px}.kqp-node.lock .nm{color:#94a3b8}',
      '.kqp-node .lk{position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.2)}',
      /* league */
      '.kqp-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:14px;margin:5px 0;background:#f8fafc;text-align:left;font-weight:800}',
      '.kqp-row .r{width:30px;text-align:center;color:#64748b}.kqp-row .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1e1b4b}.kqp-row .p{color:#4338ca}',
      '.kqp-row.me{background:linear-gradient(135deg,#e0e7ff,#c7d2fe);outline:2px solid #6366f1}.kqp-row.top1{background:#fef3c7}.kqp-row.top2{background:#f1f5f9}.kqp-row.top3{background:#ffedd5}',
      '.kqp-code{font:800 30px/1 "Baloo 2",monospace;letter-spacing:4px;color:#4338ca;background:#eef2ff;border-radius:16px;padding:10px;margin:6px 0}',
      '.kqp-in{width:100%;box-sizing:border-box;border:2px solid #c7d2fe;border-radius:14px;padding:10px;font:800 20px "Baloo 2",monospace;letter-spacing:3px;text-align:center;text-transform:uppercase}',
      /* weekly report */
      '.kqp-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.kqp-st{background:#fff;border-radius:16px;padding:10px;box-shadow:0 4px 12px rgba(79,70,229,.1);display:flex;align-items:center;gap:8px;text-align:left}',
      '.kqp-st b{display:block;font-size:20px;line-height:1}.kqp-st small{color:#6b7280;font-weight:700;font-size:12px}',
      '.kqp-bars{display:flex;align-items:flex-end;gap:6px;height:110px;padding:8px 4px 0;border-bottom:2px solid #e2e8f0}.kqp-bars div{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;gap:2px;font-size:11px;font-weight:800;color:#64748b}',
      '.kqp-bars i{display:block;width:100%;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,#818cf8,#6366f1);min-height:3px}.kqp-bars .td i{background:linear-gradient(180deg,#fdba74,#f97316)}.kqp-days{display:flex;gap:6px;padding:4px 4px 0}.kqp-days span{flex:1;font-size:11px;font-weight:800;color:#94a3b8}',
      /* shop */
      '.kqp-stage{position:relative;display:grid;place-items:center;height:150px;border-radius:22px;margin-bottom:10px;overflow:hidden}',
      '.kqp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
      '.kqp-item{position:relative;border:2px solid transparent;border-radius:18px;background:#fff;box-shadow:0 4px 12px rgba(79,70,229,.1);padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;font-family:inherit}',
      '.kqp-item.wear{border-color:#22c55e;background:#f0fdf4}.kqp-item .nm{font-size:12px;font-weight:800;color:#1e1b4b;line-height:1.1}',
      '.kqp-item .pr{display:inline-flex;align-items:center;gap:3px;font-size:12px;font-weight:800;color:#92400e;background:#fff8e1;border:1.5px solid #fcd34d;border-radius:999px;padding:0 7px}',
      '.kqp-item .own{font-size:11px;font-weight:800;color:#16a34a}.kqp-item .sw{width:44px;height:44px;border-radius:50%}',
      /* owl accessories, avatar frames, home themes */
      '.kqp-owlbox{position:relative;display:inline-block}.kqp-owlbox svg{display:block}',
      '.kqp-acc{position:absolute;inset:0;pointer-events:none}.kqp-acc .hat{position:absolute;left:22%;top:-17%;width:56%}.kqp-acc .eyes{position:absolute;left:19%;top:25%;width:62%}',
      '.kqp-acc img{width:100%!important;height:auto!important}.kqp-hatted .owl-cap{display:none}',
      '.kqp-frame-gold{box-shadow:0 0 0 3px #fff,0 0 0 6px #f59e0b,0 0 12px 6px rgba(245,158,11,.5)!important}',
      '.kqp-frame-rainbow{box-shadow:0 0 0 3px #fff,0 0 0 5px #ef4444,0 0 0 7px #f59e0b,0 0 0 9px #22c55e,0 0 0 11px #3b82f6!important}',
      '.kqp-frame-fire{box-shadow:0 0 0 3px #fff,0 0 0 6px #f97316,0 0 14px 7px rgba(239,68,68,.6)!important}',
      '.kqp-frame-ice{box-shadow:0 0 0 3px #fff,0 0 0 6px #38bdf8,0 0 14px 7px rgba(56,189,248,.55)!important}',
      '.kqp-frame-love{box-shadow:0 0 0 3px #fff,0 0 0 6px #ec4899,0 0 14px 7px rgba(236,72,153,.5)!important}',
      'body.kqp-theme-sunset .hm-sky{background:linear-gradient(180deg,#fb7185 0%,#fdba74 55%,#fde68a 100%)!important}',
      'body.kqp-theme-night .hm-sky{background:radial-gradient(circle at 20% 20%,#fff 0 1.5px,transparent 2px),radial-gradient(circle at 70% 35%,#fff 0 1px,transparent 1.5px),radial-gradient(circle at 45% 12%,#fde68a 0 1.5px,transparent 2px),linear-gradient(180deg,#1e1b4b,#4338ca)!important}',
      'body.kqp-theme-night .hm-sky .hm-hi,body.kqp-theme-night .hm-sky .hm-name{color:#fff!important}body.kqp-theme-night .hm-sun{background:#fef9c3!important;box-shadow:0 0 30px #fef9c3!important}',
      'body.kqp-theme-ocean .hm-sky{background:linear-gradient(180deg,#22d3ee 0%,#38bdf8 50%,#a5f3fc 100%)!important}',
      'body.kqp-theme-candy .hm-sky{background:linear-gradient(180deg,#f9a8d4 0%,#c4b5fd 55%,#bae6fd 100%)!important}',
      'body.kqp-theme-forest .hm-sky{background:linear-gradient(180deg,#86efac 0%,#bef264 60%,#fef08a 100%)!important}',
      /* certificate preview + olympiad prompt */
      '.kqp-cert img{width:100%;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.2)}',
      '.kqp-float{position:fixed;left:50%;bottom:86px;transform:translateX(-50%);z-index:2147483639;border:0;border-radius:999px;padding:10px 18px;font:800 15px "Baloo 2",system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#8b5cf6,#6366f1);box-shadow:0 8px 20px rgba(79,70,229,.45);cursor:pointer;animation:kqpPop .4s cubic-bezier(.34,1.56,.64,1)}'
    ].join('');
    document.head.appendChild(st);
  }

  /* A popup with a colorful header. Returns { box, body, close } */
  function sheet(o) {
    css();
    var box = document.createElement('div'); box.className = 'kqp-ov';
    box.innerHTML = '<div class="kqp-sheet"><div class="kqp-hero" style="background-color:' + (o.c1 || '#6366f1') + ';background-image:radial-gradient(circle at 12% 25%,rgba(255,255,255,.25) 0 6px,transparent 7px),radial-gradient(circle at 88% 35%,rgba(255,255,255,.2) 0 4px,transparent 5px),linear-gradient(135deg,' + (o.c1 || '#8b5cf6') + ',' + (o.c2 || '#6366f1') + ')">' +
      '<button class="kqp-x" aria-label="Close">✕</button><div class="big">' + emo(o.icon, 50) + '</div><h3>' + esc(o.title) + '</h3><p>' + (o.sub || '') + '</p></div><div class="kqp-body"></div></div>';
    var close = function () { box.remove(); if (o.onClose) o.onClose(); };
    box.querySelector('.kqp-x').onclick = close;
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.body.appendChild(box);
    return { box: box, body: box.querySelector('.kqp-body'), close: close, sub: box.querySelector('.kqp-hero p') };
  }

  /* ================================================================ OWL SHOP */
  var OWL_SVG = '<svg viewBox="0 0 120 120"><path d="M30 30 L40 12 L50 30Z" fill="#7c3aed"/><path d="M70 30 L80 12 L90 30Z" fill="#7c3aed"/><ellipse cx="60" cy="70" rx="42" ry="44" fill="#8b5cf6"/><ellipse cx="60" cy="82" rx="26" ry="28" fill="#ede9fe"/><path d="M18 66 Q8 86 26 100 Q30 82 24 66Z" fill="#7c3aed"/><path d="M102 66 Q112 86 94 100 Q90 82 96 66Z" fill="#7c3aed"/><circle cx="44" cy="50" r="17" fill="#fff"/><circle cx="76" cy="50" r="17" fill="#fff"/><circle cx="46" cy="51" r="8" fill="#1e1b4b"/><circle cx="74" cy="51" r="8" fill="#1e1b4b"/><circle cx="49" cy="48" r="3" fill="#fff"/><circle cx="77" cy="48" r="3" fill="#fff"/><path d="M54 62 L66 62 L60 72Z" fill="#f59e0b"/><ellipse cx="46" cy="114" rx="8" ry="4" fill="#f59e0b"/><ellipse cx="74" cy="114" rx="8" ry="4" fill="#f59e0b"/><path class="owl-cap" d="M38 24 Q60 0 82 24Z" fill="#facc15"/><circle class="owl-cap" cx="60" cy="8" r="5" fill="#f43f5e"/></svg>';
  var SHOP = [
    { id: 'crown', cat: 'hat', icon: '👑', name: 'Royal crown', price: 150 },
    { id: 'tophat', cat: 'hat', icon: '🎩', name: 'Magic hat', price: 120 },
    { id: 'gradcap', cat: 'hat', icon: '🎓', name: 'Smart cap', price: 100 },
    { id: 'sunhat', cat: 'hat', icon: '👒', name: 'Sun hat', price: 80 },
    { id: 'cap', cat: 'hat', icon: '🧢', name: 'Sports cap', price: 60 },
    { id: 'bow', cat: 'hat', icon: '🎀', name: 'Pink bow', price: 50 },
    { id: 'shades', cat: 'eyes', icon: '🕶️', name: 'Cool shades', price: 80 },
    { id: 'specs', cat: 'eyes', icon: '👓', name: 'Smart glasses', price: 50 },
    { id: 'gold', cat: 'frame', icon: '⭐', name: 'Gold frame', price: 100, sw: 'radial-gradient(circle,#fff 45%,#f59e0b 47%)' },
    { id: 'rainbow', cat: 'frame', icon: '🌈', name: 'Rainbow', price: 150, sw: 'conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)' },
    { id: 'fire', cat: 'frame', icon: '🔥', name: 'Fire', price: 120, sw: 'radial-gradient(circle,#fff 40%,#f97316 45%,#ef4444)' },
    { id: 'ice', cat: 'frame', icon: '❄️', name: 'Ice', price: 80, sw: 'radial-gradient(circle,#fff 40%,#38bdf8 45%,#0ea5e9)' },
    { id: 'love', cat: 'frame', icon: '💖', name: 'Love', price: 80, sw: 'radial-gradient(circle,#fff 40%,#f472b6 45%,#db2777)' },
    { id: 'sunset', cat: 'theme', icon: '🌅', name: 'Sunset', price: 100, sw: 'linear-gradient(180deg,#fb7185,#fde68a)' },
    { id: 'night', cat: 'theme', icon: '🌃', name: 'Starry night', price: 150, sw: 'linear-gradient(180deg,#1e1b4b,#4338ca)' },
    { id: 'ocean', cat: 'theme', icon: '🌊', name: 'Ocean', price: 100, sw: 'linear-gradient(180deg,#22d3ee,#a5f3fc)' },
    { id: 'candy', cat: 'theme', icon: '🍭', name: 'Candy', price: 120, sw: 'linear-gradient(180deg,#f9a8d4,#bae6fd)' },
    { id: 'forest', cat: 'theme', icon: '🌳', name: 'Forest', price: 80, sw: 'linear-gradient(180deg,#86efac,#fef08a)' }
  ];
  var SHOP_CATS = [['hat', '🎩 Hats'], ['eyes', '🕶️ Glasses'], ['frame', '🖼️ Frames'], ['theme', '🎨 Themes']];
  function itemById(id) { for (var i = 0; i < SHOP.length; i++) if (SHOP[i].id === id) return SHOP[i]; return null; }
  function look() { var w = W(); var l = (w && w.look) || {}; l.own = l.own || {}; return l; }

  /* Put the bought hat / glasses on an owl box (.hm-owl on the home page, or the shop preview). */
  function dressOwl(box, lk) {
    if (!box) return;
    var acc = box.querySelector(':scope > .kqp-acc');
    if (!acc) { acc = document.createElement('div'); acc.className = 'kqp-acc'; box.appendChild(acc); if (getComputedStyle(box).position === 'static') box.style.position = 'relative'; }
    var hat = itemById(lk.hat), eyes = itemById(lk.eyes);
    acc.innerHTML = (hat ? '<span class="hat">' + emo(hat.icon, 60) + '</span>' : '') + (eyes ? '<span class="eyes">' + emo(eyes.icon, 60) + '</span>' : '');
    box.classList.toggle('kqp-hatted', !!hat);
  }
  function applyLook() {
    css();
    var lk = look();
    // home owl: the svg sits inside .hm-owl next to the speech bubble -> wrap it
    document.querySelectorAll('.hm-owl > svg').forEach(function (svg) {
      var wrap = document.createElement('span'); wrap.className = 'kqp-owlbox'; svg.parentNode.insertBefore(wrap, svg); wrap.appendChild(svg);
    });
    document.querySelectorAll('.kqp-owlbox').forEach(function (b) { dressOwl(b, lk); });
    var av = document.getElementById('pfAvatar');
    if (av) { av.className = av.className.replace(/\bkqp-frame-\w+/g, '').trim(); if (lk.frame) av.classList.add('kqp-frame-' + lk.frame); }
    if (document.body) { document.body.className = document.body.className.replace(/\bkqp-theme-\w+/g, '').trim(); if (lk.theme) document.body.classList.add('kqp-theme-' + lk.theme); }
  }

  function openShop() {
    var cat = 'hat';
    var s = sheet({ icon: '🛍️', title: 'Owl shop', sub: '', c1: '#ec4899', c2: '#8b5cf6' });
    function render() {
      var w = W(), lk = look(), have = w ? w.coins : 0;
      s.sub.innerHTML = 'You have <b>' + have + '</b> ' + coin(16);
      var preview = '<div class="kqp-stage" style="background:' + (lk.theme ? itemById(lk.theme).sw : 'linear-gradient(180deg,#7dd3fc,#bae6fd)') + '">' +
        '<span class="kqp-owlbox" id="kqpPrevOwl" style="width:110px">' + OWL_SVG.replace('<svg ', '<svg width="110" height="110" ') + '</span></div>';
      var items = SHOP.filter(function (it) { return it.cat === cat; });
      var none = '<button type="button" class="kqp-item' + (!lk[cat] ? ' wear' : '') + '" data-none="1"><span class="sw" style="display:grid;place-items:center;background:#f1f5f9">' + emo('❌', 26) + '</span><span class="nm">None</span><span class="own">' + (!lk[cat] ? 'Wearing' : 'Free') + '</span></button>';
      s.body.innerHTML = preview + '<div class="kqp-tabs" style="flex-wrap:wrap">' + SHOP_CATS.map(function (c) { return '<button type="button" class="' + (c[0] === cat ? 'on' : '') + '" data-cat="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>' +
        '<div class="kqp-grid">' + none + items.map(function (it) {
          var own = !!lk.own[it.id], wear = lk[cat] === it.id;
          var pic = it.sw ? '<span class="sw" style="display:grid;place-items:center;background:' + it.sw + '">' + emo(it.icon, 22) + '</span>' : '<span class="sw" style="display:grid;place-items:center">' + emo(it.icon, 40) + '</span>';
          return '<button type="button" class="kqp-item' + (wear ? ' wear' : '') + '" data-id="' + it.id + '">' + pic + '<span class="nm">' + esc(it.name) + '</span>' +
            (own ? '<span class="own">' + (wear ? '✅ Wearing' : 'Tap to wear') + '</span>' : '<span class="pr">' + coin(13) + it.price + '</span>') + '</button>';
        }).join('') + '</div><p class="kqp-note">Finish quizzes and games to earn more coins!</p>';
      var pv = document.getElementById('kqpPrevOwl'); if (pv) dressOwl(pv, lk);
      if (lk.frame) { var st = s.body.querySelector('.kqp-stage'); st.style.boxShadow = 'inset 0 0 0 6px ' + ({ gold: '#f59e0b', rainbow: '#a855f7', fire: '#f97316', ice: '#38bdf8', love: '#ec4899' }[lk.frame] || '#fff'); }
      s.body.querySelectorAll('[data-cat]').forEach(function (b) { b.onclick = function () { cat = b.getAttribute('data-cat'); render(); }; });
      var nb = s.body.querySelector('[data-none]'); if (nb) nb.onclick = function () { save(0, '', function (w) { w.look = w.look || {}; w.look[cat] = ''; }); setTimeout(function () { applyLook(); render(); }, 30); };
      s.body.querySelectorAll('[data-id]').forEach(function (b) { b.onclick = function () {
        var it = itemById(b.getAttribute('data-id')), lk2 = look(), w2 = W();
        if (lk2.own[it.id]) { save(0, '', function (w) { w.look = w.look || { own: {} }; w.look[it.cat] = it.id; }); }
        else {
          if (!w2 || w2.coins < it.price) { toast('You need ' + it.price + ' 🪙 — play to earn more!', false); return; }
          if (!confirm('Buy ' + it.name + ' for ' + it.price + ' coins?')) return;
          save(-it.price, '🛍️ ' + it.name, function (w) { w.look = w.look || {}; w.look.own = w.look.own || {}; w.look.own[it.id] = Date.now(); w.look[it.cat] = it.id; });
          celebrate(); toast(it.icon + ' ' + it.name + ' is yours!', true);
        }
        setTimeout(function () { applyLook(); render(); }, 30);
      }; });
    }
    render();
  }

  /* ============================================================== DAILY GIFT */
  var GIFTS = [10, 15, 20, 25, 30, 40, 100];
  function giftState() {
    var w = W(), dr = (w && w.dr) || { n: 0, last: '' }, t = today(), y = dayKey(Date.now() - 86400000);
    var claimed = dr.last === t, kept = dr.last === t || dr.last === y;
    var n = kept ? (dr.n || 0) : 0;                    // missed a day -> back to day 1
    var next = claimed ? n : (n % 7) + 1;               // day to open (1..7)
    var doneInCycle = claimed ? n : (n >= 7 ? 0 : n);  // days already ticked on the calendar
    return { claimed: claimed, next: next, done: doneInCycle };
  }
  function openGift() {
    var s = sheet({ icon: '🎁', title: 'Daily gift', sub: 'Come back every day — day 7 is a big chest!', c1: '#f97316', c2: '#ec4899' });
    function render() {
      var g = giftState();
      s.body.innerHTML = '<div class="kqp-cal">' + GIFTS.map(function (c, i) {
        var d = i + 1, got = d <= g.done, now = !g.claimed && d === g.next;
        return '<div class="kqp-day' + (got ? ' got' : '') + (now ? ' now' : '') + (d === 7 ? ' chest' : '') + '">' + (got ? '<span class="ok">✅</span>' : '') +
          'Day ' + d + emo(d === 7 ? '🎁' : '🪙', d === 7 ? 40 : 26) + '<b>+' + c + '</b></div>';
      }).join('') + '</div>' +
        '<div style="margin-top:14px">' + (g.claimed ? '<button class="kqp-btn" disabled>✅ Come back tomorrow!</button><p class="kqp-note">Tomorrow: day ' + ((g.done % 7) + 1) + ' (+' + GIFTS[g.done % 7] + ' coins). Miss a day and you start again at day 1.</p>'
          : '<button class="kqp-btn" id="kqpClaim">' + emo('🎁', 22) + ' Open day ' + g.next + ' gift (+' + GIFTS[g.next - 1] + ')</button>') + '</div>';
      var b = document.getElementById('kqpClaim');
      if (b) b.onclick = function () {
        var g2 = giftState(); if (g2.claimed) return;
        var d = g2.next, amt = GIFTS[d - 1];
        save(amt, (d === 7 ? '🎁 Big chest' : '🎁 Daily gift') + ' · day ' + d, function (w) { w.dr = { n: d, last: today() }; });
        celebrate(); toast('+' + amt + ' 🪙  Day ' + d + ' gift!', true);
        setTimeout(function () { render(); renderHome(); }, 40);
      };
    }
    render();
  }
  function autoGift() {
    if (!coinsOn() || !W()) return;
    var k = 'kqp_gift_shown_' + today(); try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch (e) {}
    if (!giftState().claimed) setTimeout(openGift, 1200);
  }

  /* ======================================================= QUESTION OF THE DAY */
  var bankCache = {};
  function loadBank(sub, lvl) {
    var k = sub + '|' + lvl; if (bankCache[k]) return bankCache[k];
    bankCache[k] = new Promise(function (res, rej) {
      var got = null, prev = window.registerQuiz;
      window.registerQuiz = function (s, l, q) { if (s === sub) got = q; if (prev) try { prev.apply(this, arguments); } catch (e) {} };
      var sc = document.createElement('script'); sc.src = bankFile(sub, lvl);
      sc.onload = function () { window.registerQuiz = prev; if (got && got.length) res(got); else rej(new Error('empty')); };
      sc.onerror = function () { window.registerQuiz = prev; delete bankCache[k]; rej(new Error('load')); };
      document.head.appendChild(sc);
    });
    return bankCache[k];
  }
  function qotdPick(lvl) {
    var subs = subjectsFor(lvl), seed = hash(today() + '|' + lvl);
    return subs[seed % subs.length];
  }
  function openQotd() {
    var lvl = myClass(), sub = qotdPick(lvl), t = today(), reward = coinsOn() ? 20 : 0;
    var s = sheet({ icon: '❓', title: 'Question of the day', sub: classLbl(lvl) + ' · ' + sub.t + (reward ? ' · +' + reward + ' coins' : ''), c1: '#06b6d4', c2: '#6366f1' });
    s.body.innerHTML = '<p class="kqp-note">Loading today’s question…</p>';
    loadBank(sub.id, lvl).then(function (bank) {
      var seed = hash('q|' + t + '|' + lvl), q = bank[seed % bank.length];
      var opts = (q.options || []).slice(); if (opts.indexOf(q.answer) < 0) opts.push(q.answer);
      opts.sort(function (a, b) { return hash(seed + a) - hash(seed + b); });
      var w = W(), done = w && w.qd && w.qd.d === t ? w.qd : null;
      s.body.innerHTML = '<div class="kqp-q"><small>' + emo(sub.icon, 14) + ' ' + esc(sub.t) + '</small>' + esc(q.question) + '</div>' +
        '<div class="kqp-opts">' + opts.map(function (o) { return '<button type="button" class="kqp-opt" data-o="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div><div id="kqpQres" style="margin-top:12px"></div>';
      var btns = s.body.querySelectorAll('.kqp-opt'), res = document.getElementById('kqpQres');
      var finish = function (picked, ok, fresh) {
        btns.forEach(function (b) { var o = b.getAttribute('data-o'); b.disabled = true; if (o === q.answer) b.classList.add('ok'); else if (o === picked) b.classList.add('no'); });
        res.innerHTML = ok ? '<b style="font-size:20px;color:#16a34a">' + emo('🎉', 26) + ' Correct!' + (fresh && reward ? ' +' + reward + ' ' + coin(18) : '') + '</b><p class="kqp-note">New question tomorrow!</p>'
                           : '<b style="font-size:18px;color:#dc2626">Not quite!</b> <span class="kqp-note">The answer is <b>' + esc(q.answer) + '</b>. Try again tomorrow!</span>';
      };
      if (done) { finish(done.a, done.ok, false); return; }
      btns.forEach(function (b) { b.onclick = function () {
        var picked = b.getAttribute('data-o'), ok = picked === q.answer;
        save(ok ? reward : 0, '❓ Question of the day', function (w) { w.qd = { d: t, ok: ok, a: String(picked).slice(0, 60) }; });
        if (ok) celebrate();
        finish(picked, ok, true); setTimeout(renderHome, 50);
      }; });
    }).catch(function () { s.body.innerHTML = '<p class="kqp-err">Could not load the question. Check the internet and try again.</p>'; });
  }

  /* ============================================================ LEARNING MAP */
  var OFF = [0, 24, 32, 24, 0, -24, -32, -24];   // % from the middle: a winding path
  var STEP = 112;
  function starsFor(meta) {
    if (!meta) return 0;
    var c = +meta.correct || 0, t = c + (+meta.wrong || 0); if (!t) return 1;
    var p = c / t; return p >= 0.9 ? 3 : p >= 0.7 ? 2 : 1;
  }
  function openMap() {
    var lvl = myClass();
    var s = sheet({ icon: '🗺️', title: 'My learning path', sub: 'Get stars to unlock the next stop!', c1: '#22c55e', c2: '#0ea5e9' });
    function render(tree) {
      var me = (user() || {}).key, subs = subjectsFor(lvl), q = (tree && tree.quiz) || {};
      var stars = subs.map(function (sb) { var r = q[sb.id + '__' + lvl] && me ? q[sb.id + '__' + lvl][me] : null; return r ? starsFor(r.meta || {}) : 0; });
      var total = stars.reduce(function (a, b) { return a + b; }, 0), cur = stars.indexOf(0);
      var H = subs.length * STEP + 20;
      var pts = subs.map(function (_, i) { return [50 + OFF[i % OFF.length], 40 + i * STEP]; });
      var path = 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L');
      s.sub.innerHTML = classLbl(lvl) + ' · ' + emo('⭐', 16) + ' <b>' + total + '</b> / ' + subs.length * 3 + ' stars';
      s.body.innerHTML = classChips(lvl, 'data-lv') +
        '<div class="kqp-map" style="height:' + H + 'px"><svg viewBox="0 0 100 ' + H + '" preserveAspectRatio="none" style="height:' + H + 'px">' +
        '<path d="' + path + '" fill="none" stroke="#e2e8f0" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
        '<path d="' + path + '" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>' +
        subs.map(function (sb, i) {
          var st = stars[i], open = i === 0 || stars[i - 1] > 0 || st > 0, isCur = i === cur && open;
          return '<button type="button" class="kqp-node' + (st ? ' done' : '') + (open ? '' : ' lock') + (isCur ? ' cur' : '') + '" style="left:' + pts[i][0] + '%;top:' + (pts[i][1] - 33) + 'px" data-sub="' + sb.id + '"' + (open ? '' : ' disabled') + '>' +
            (isCur ? '<span class="go">START</span>' : '') + '<span class="c"><span class="in">' + emo(sb.icon, 32) + '</span>' + (open ? '' : '<span class="lk">' + emo('🔒', 13) + '</span>') + '</span>' +
            '<span class="st">' + [1, 2, 3].map(function (k) { return k <= st ? emo('⭐', 15) : '<span style="opacity:.25;filter:grayscale(1)">' + emo('⭐', 15) + '</span>'; }).join('') + '</span><span class="nm">' + esc(sb.t) + '</span></button>';
        }).join('') + '</div><p class="kqp-note">⭐ finish · ⭐⭐ 70% right · ⭐⭐⭐ 90% right</p>';
      s.body.querySelectorAll('[data-lv]').forEach(function (b) { b.onclick = function () { lvl = +b.getAttribute('data-lv'); setClass(lvl); render(tree); }; });
      s.body.querySelectorAll('.kqp-node:not(.lock)').forEach(function (b) { b.onclick = function () {
        location.href = ROOT + 'quiz/index.html?cat=' + encodeURIComponent(b.getAttribute('data-sub')) + '&level=' + lvl;
      }; });
      var c = s.body.querySelector('.kqp-node.cur'); if (c) setTimeout(function () { try { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }, 250);
    }
    render(null);
    if (window.KQ && KQ.ready && KQ.fetchAll) KQ.ready.then(function () { return KQ.fetchAll(); }).then(function (t) { if (s.box.isConnected) render(t); }).catch(function () {});
  }

  /* =========================================================== WEEKLY LEAGUE */
  var PTS = { quiz: 10, single: 5, multi: 8, olympiad: 20 };
  function grpClass(l) { return 'c' + (l === -1 ? 'u' : l); }
  function flag(cc) {
    if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return '';
    var A = 0x1f1e6, u = cc.toUpperCase();
    return emo(String.fromCodePoint(A + u.charCodeAt(0) - 65, A + u.charCodeAt(1) - 65), 18);
  }
  function nick() { return firstName(); }
  function leagueAdd(sec) {
    var u = user(), d = db(), p = PTS[sec]; if (!u || !u.key || !d || !p) return;
    var wk = weekKey(Date.now()), w = W() || {}, cc = '';
    try { cc = (KQ.country && KQ.country()) || ''; } catch (e) {}
    var groups = [grpClass(myClass())]; if (w.code) groups.push('k_' + w.code);
    groups.forEach(function (g) {
      d.ref('leagues/' + wk + '/' + g + '/' + u.key).transaction(function (cur) {
        cur = cur || { p: 0 }; cur.p = (+cur.p || 0) + p; cur.n = nick(); cur.cc = cc; cur.t = Date.now(); return cur;
      }).catch(function () {});
    });
  }
  function daysLeft() { var d = Math.ceil((nextMonday() - Date.now()) / 86400000); return d <= 1 ? 'Ends today!' : 'Ends in ' + d + ' days'; }
  function openLeague() {
    var tab = 'class', lvl = myClass();
    var s = sheet({ icon: '🏆', title: 'Weekly league', sub: daysLeft() + ' · new league every Monday', c1: '#f59e0b', c2: '#ef4444' });
    function list(group, el) {
      var d = db(), u = user() || {};
      if (!d) { el.innerHTML = '<p class="kqp-note">Connect to the internet to see the league.</p>'; return; }
      el.innerHTML = '<p class="kqp-note">Loading…</p>';
      d.ref('leagues/' + weekKey(Date.now()) + '/' + group).orderByChild('p').limitToLast(50).once('value').then(function (snap) {
        var rows = []; snap.forEach(function (c) { var v = c.val() || {}; rows.push({ k: c.key, n: v.n || 'Player', p: +v.p || 0, cc: v.cc || '' }); });
        rows.sort(function (a, b) { return b.p - a.p; });
        var mine = rows.findIndex(function (r) { return r.k === u.key; });
        el.innerHTML = (rows.length ? rows.map(function (r, i) {
          var medal = i < 3 ? emo(['🥇', '🥈', '🥉'][i], 22) : (i + 1);
          return '<div class="kqp-row' + (r.k === u.key ? ' me' : '') + (i < 3 ? ' top' + (i + 1) : '') + '"><span class="r">' + medal + '</span>' + flag(r.cc) + '<span class="n">' + esc(r.n) + (r.k === u.key ? ' (you)' : '') + '</span><span class="p">' + r.p + ' pts</span></div>';
        }).join('') : '<p class="kqp-note">' + emo('🌱', 40) + '<br>No one has played yet this week — be the first!</p>') +
          (mine < 0 ? '<p class="kqp-note">Finish a quiz or game to join this league.</p>' : '') +
          '<p class="kqp-note">Points: quiz 10 · game 5 · with friends 8 · Olympiad 20</p>';
      }).catch(function (e) {
        el.innerHTML = '<p class="kqp-err">' + (/permission/i.test((e && e.message) || '') ? 'Leagues are not switched on yet.' : 'Could not load the league.') + '</p>';
      });
    }
    function render() {
      var w = W() || {};
      s.body.innerHTML = '<div class="kqp-tabs"><button type="button" data-t="class" class="' + (tab === 'class' ? 'on' : '') + '">🎓 My class</button><button type="button" data-t="code" class="' + (tab === 'code' ? 'on' : '') + '">🔑 Class code</button></div><div id="kqpLg"></div>';
      var el = document.getElementById('kqpLg');
      s.body.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { tab = b.getAttribute('data-t'); render(); }; });
      if (tab === 'class') {
        el.innerHTML = classChips(lvl, 'data-lv') + '<div id="kqpLgList"></div>';
        el.querySelectorAll('[data-lv]').forEach(function (b) { b.onclick = function () { lvl = +b.getAttribute('data-lv'); setClass(lvl); render(); }; });
        list(grpClass(lvl), document.getElementById('kqpLgList'));
      } else if (w.code) {
        el.innerHTML = '<p class="kqp-note" style="margin:0">Your class code — share it with classmates:</p><div class="kqp-code">' + esc(w.code) + '</div>' +
          '<button type="button" class="kqp-btn sm alt" id="kqpShareCode">📤 Share code</button> <button type="button" class="kqp-btn sm alt" id="kqpLeave">Leave</button><div id="kqpLgList" style="margin-top:8px"></div>';
        document.getElementById('kqpShareCode').onclick = function () { var go = function () { shareText('Join my Kids Quiz class league! Code: ' + w.code); }; if (typeof kqParentGate === 'function') kqParentGate(go); else go(); };
        joinClass(w.code);
        document.getElementById('kqpLeave').onclick = function () { if (confirm('Leave class code ' + w.code + '?')) { save(0, '', function (x) { x.code = ''; }); setTimeout(render, 40); } };
        list('k_' + w.code, document.getElementById('kqpLgList'));
      } else {
        el.innerHTML = '<p style="font-weight:700;margin:0 0 8px">Play with your classmates or friends: everyone types the same code.</p>' +
          '<input class="kqp-in" id="kqpCode" maxlength="8" placeholder="CODE" autocomplete="off"><div style="margin-top:10px;display:flex;gap:8px;justify-content:center">' +
          '<button type="button" class="kqp-btn sm" id="kqpJoin">Join</button><button type="button" class="kqp-btn sm alt" id="kqpMake">✨ Make a new code</button></div>' +
          '<p class="kqp-note">Only first names and flags are shown. No chat.</p>';
        var inp = document.getElementById('kqpCode');
        var join = function (c) {
          c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (c.length < 4) { toast('Codes have 4–8 letters or numbers', false); return; }
          save(0, '', function (x) { x.code = c; }); toast('🔑 Joined ' + c, false); joinClass(c); setTimeout(render, 40);
        };
        document.getElementById('kqpJoin').onclick = function () { join(inp.value); };
        document.getElementById('kqpMake').onclick = function () { var ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', c = ''; for (var i = 0; i < 6; i++) c += ch[Math.floor(Math.random() * ch.length)]; join(c); };
      }
    }
    render();
  }

  /* =========================================================== WEEKLY REPORT */
  function weekData() {
    var w = W() || {}, cur = weekKey(Date.now()), z = { quiz: 0, single: 0, multi: 0, olympiad: 0, total: 0, coins: 0, d: [0, 0, 0, 0, 0, 0, 0] };
    var wk = w.wk && w.wk.id === cur ? w.wk : z, last = w.wk && w.wk.id !== cur ? w.wk : (w.lastWk || null);
    return { wk: Object.assign({}, z, wk), last: last };
  }
  function reportText() {
    var r = weekData().wk, n = firstName();
    return n + ' finished ' + r.total + ' quiz' + (r.total === 1 ? '' : 'zes') + ' & games this week' + (r.total ? ' 🎉' : '') +
      ' (' + r.quiz + ' quizzes, ' + r.single + ' games' + (r.olympiad ? ', ' + r.olympiad + ' Olympiad papers' : '') + ').';
  }
  // Android app: the Sunday-evening notification shows this week's numbers.
  function pushWeekly() {
    try { if (window.Android && Android.setWeeklyReport) Android.setWeeklyReport('📊 ' + firstName() + '’s week in Kids Quiz', reportText() + ' Tap to see the report!', String(nextMonday())); } catch (e) {}
  }
  function openReport() {
    var r = weekData(), wk = r.wk, w = W() || {}, s0 = w.stats || {};
    var s = sheet({ icon: '📊', title: firstName() + '’s week', sub: 'Monday to Sunday', c1: '#6366f1', c2: '#06b6d4' });
    var max = Math.max.apply(null, wk.d.concat([1])), td = (new Date().getDay() + 6) % 7;
    var tile = function (icon, v, l) { return '<div class="kqp-st">' + emo(icon, 30) + '<span><b>' + v + '</b><small>' + l + '</small></span></div>'; };
    var cmp = r.last ? (wk.total - (r.last.total || 0)) : null;
    s.body.innerHTML = '<div style="font-size:42px;font-weight:800;line-height:1;color:#4338ca">' + wk.total + '</div><p style="margin:0 0 10px;font-weight:800;color:#6b7280">quizzes &amp; games finished' +
      (cmp != null ? ' · ' + (cmp >= 0 ? '<span style="color:#16a34a">▲ ' + cmp + '</span>' : '<span style="color:#dc2626">▼ ' + (-cmp) + '</span>') + ' vs last week' : '') + '</p>' +
      '<div class="kqp-stats">' + tile('🎯', wk.quiz, 'quizzes') + tile('🎮', wk.single, 'games') + tile('👥', wk.multi, 'with friends') + tile('🏅', wk.olympiad, 'Olympiad') +
      (coinsOn() ? tile('🪙', wk.coins, 'coins earned') : '') + tile('🔥', s0.streak || 0, 'day streak') + '</div>' +
      '<h4>Played each day</h4><div class="kqp-bars">' + wk.d.map(function (v, i) { return '<div class="' + (i === td ? 'td' : '') + '">' + (v || '') + '<i style="height:' + Math.round(v / max * 85) + '%"></i></div>'; }).join('') + '</div>' +
      '<div class="kqp-days">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>' +
      '<div style="margin-top:14px"><button type="button" class="kqp-btn" id="kqpShareWk">📤 Share with family</button></div>' +
      '<p class="kqp-note">In the app, parents get this every Sunday evening.</p>';
    document.getElementById('kqpShareWk').onclick = function () {
      certificate({ icon: '📊', heading: 'Weekly Star Report', title: wk.total + ' quizzes & games', line: wk.quiz + ' quizzes · ' + wk.single + ' games · ' + (s0.streak || 0) + '-day streak', date: Date.now(), text: reportText() });
    };
    pushWeekly();
  }

  /* A teacher's class (classes/<code>/owner exists): list this child by first name so the
     teacher's results sheet can show "not finished yet". Once per code per session. */
  var joinedOnce = {};
  function joinClass(code) {
    if (!code || joinedOnce[code] || !window.KQ || !KQ.ready || !window.firebase) return; joinedOnce[code] = 1;
    KQ.ready.then(function () {
      var db = firebase.database(), u = KQ.user();
      return db.ref('classes/' + code + '/owner').once('value').then(function (s) {
        if (!s.exists()) return;
        return db.ref('classes/' + code + '/members/' + u.key).set({ n: String(u.name || 'Player').split(' ')[0].slice(0, 14), at: Date.now() });
      });
    }).catch(function () {});
  }

  /* ============================================================ CERTIFICATES */
  function shareText(t) {
    try { if (window.Android && Android.shareText) { Android.shareText(t); return; } } catch (e) {}
    if (navigator.share) { navigator.share({ text: t }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(t); toast('Copied!', false); } catch (e) { prompt('Copy this:', t); }
  }
  function loadImg(src) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function emoSrc(e) { return ROOT + 'images/emoji/' + Array.from(String(e)).map(function (c) { return c.codePointAt(0); }).filter(function (c) { return c !== 0xfe0f; }).map(function (c) { return c.toString(16); }).join('-') + '.svg'; }
  function wrapText(ctx, text, x, y, maxW, lh) {
    var words = String(text).split(' '), line = '', lines = [];
    words.forEach(function (wd) { var t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t; });
    if (line) lines.push(line);
    lines.slice(0, 3).forEach(function (l, i) { ctx.fillText(l, x, y + i * lh); });
  }
  /* o = { icon, title, line, date, heading?, text? } -> picture + share */
  function certificate(o) {
    var name = ((user() || {}).name || firstName()).slice(0, 28);
    var s = sheet({ icon: '🎓', title: 'Certificate', sub: 'Share it with family!', c1: '#8b5cf6', c2: '#ec4899' });
    s.body.innerHTML = '<p class="kqp-note">Making your certificate…</p>';
    var W0 = 1200, H0 = 850, cv = document.createElement('canvas'); cv.width = W0; cv.height = H0;
    var ctx = cv.getContext('2d');
    Promise.all([loadImg(emoSrc(o.icon || '🏆')), loadImg(ROOT + 'images/app-logo.png'), loadImg(emoSrc('🌟')), document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()]).then(function (im) {
      var g = ctx.createLinearGradient(0, 0, W0, H0); g.addColorStop(0, '#fff7ed'); g.addColorStop(1, '#fef3c7'); ctx.fillStyle = g; ctx.fillRect(0, 0, W0, H0);
      ctx.lineWidth = 18; ctx.strokeStyle = '#f59e0b'; ctx.strokeRect(24, 24, W0 - 48, H0 - 48);
      ctx.lineWidth = 4; ctx.strokeStyle = '#8b5cf6'; ctx.strokeRect(52, 52, W0 - 104, H0 - 104);
      [[90, 90], [W0 - 150, 90], [90, H0 - 150], [W0 - 150, H0 - 150]].forEach(function (p) { if (im[2]) ctx.drawImage(im[2], p[0], p[1], 60, 60); });
      var F = '"Baloo 2", "Nunito", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.fillStyle = '#7c3aed'; ctx.font = '800 64px ' + F; ctx.fillText(o.heading || 'Certificate of Achievement', W0 / 2, 160);
      ctx.fillStyle = '#6b7280'; ctx.font = '700 30px ' + F; ctx.fillText('This is proudly presented to', W0 / 2, 220);
      ctx.fillStyle = '#1e1b4b'; ctx.font = '800 76px ' + F; ctx.fillText(name, W0 / 2, 310);
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W0 / 2 - 300, 335); ctx.lineTo(W0 / 2 + 300, 335); ctx.stroke();
      if (im[0]) ctx.drawImage(im[0], W0 / 2 - 70, 360, 140, 140);
      ctx.fillStyle = '#db2777'; ctx.font = '800 52px ' + F; ctx.fillText(o.title || '', W0 / 2, 565);
      ctx.fillStyle = '#374151'; ctx.font = '700 30px ' + F; wrapText(ctx, o.line || '', W0 / 2, 615, 900, 40);
      ctx.fillStyle = '#6b7280'; ctx.font = '700 26px ' + F; ctx.fillText(new Date(o.date || Date.now()).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }), W0 / 2, 715);
      if (im[1]) ctx.drawImage(im[1], W0 / 2 - 230, 735, 54, 54);
      ctx.fillStyle = '#4338ca'; ctx.font = '800 34px ' + F; ctx.textAlign = 'left'; ctx.fillText('Kids Quiz', W0 / 2 - 165, 773);
      ctx.fillStyle = '#9ca3af'; ctx.font = '600 16px ' + F; ctx.textAlign = 'right'; ctx.fillText('Emoji graphics by Twemoji, CC-BY 4.0', W0 - 70, H0 - 66);
      var url = cv.toDataURL('image/png');
      var text = o.text || (name + ' earned "' + o.title + '" in Kids Quiz! 🎉');
      s.body.innerHTML = '<div class="kqp-cert"><img src="' + url + '" alt="Certificate"></div><div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
        '<button type="button" class="kqp-btn" id="kqpCertShare">📤 Share</button><a class="kqp-btn alt" id="kqpCertSave" href="' + url + '" download="kids-quiz-certificate.png" style="text-decoration:none">⬇️ Save</a></div>';
      document.getElementById('kqpCertShare').onclick = function () {
        try { if (window.Android && Android.shareImage) { Android.shareImage(url, text); return; } } catch (e) {}
        cv.toBlob(function (b) {
          var f = b && window.File ? new File([b], 'kids-quiz-certificate.png', { type: 'image/png' }) : null;
          if (f && navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], text: text }).catch(function () {});
          else document.getElementById('kqpCertSave').click();
        });
      };
    });
  }
  // After an Olympiad paper: offer its certificate for a few seconds.
  function olympiadPrompt(subject) {
    css();
    var old = document.querySelector('.kqp-float'); if (old) old.remove();
    var b = document.createElement('button'); b.type = 'button'; b.className = 'kqp-float';
    b.innerHTML = emo('🎓', 20) + ' Get your Olympiad certificate';
    var nm = String(subject || '').replace(/[-_]/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); });
    b.onclick = function () { b.remove(); certificate({ icon: '🏅', title: 'Olympiad Practice Champion', line: (nm ? nm + ' ' : '') + 'Olympiad paper completed', date: Date.now() }); };
    document.body.appendChild(b);
    setTimeout(function () { if (b.isConnected) b.remove(); }, 20000);
  }

  /* ============================================================== HOME TILES */
  var homeEl = null;
  function renderHome() {
    if (!homeEl || !homeEl.isConnected) return;
    css();
    var w = W(), on = coinsOn(), g = giftState(), t = today();
    var qd = w && w.qd && w.qd.d === t, wk = weekData().wk;
    var tile = function (id, icon, c1, c2, title, sub, dot) {
      return '<button type="button" class="kqp-tile" data-open="' + id + '" style="background:linear-gradient(135deg,' + c1 + ',' + c2 + ')">' + (dot ? '<span class="dot"></span>' : '') +
        '<span class="ic">' + emo(icon, 32) + '</span><b>' + title + '</b><small>' + sub + '</small></button>';
    };
    homeEl.innerHTML =
      (on ? tile('gift', '🎁', '#fb923c', '#ec4899', 'Daily gift', g.claimed ? 'Back tomorrow ✅' : 'Day ' + g.next + ' · +' + GIFTS[g.next - 1], !g.claimed) : '') +
      tile('qotd', '❓', '#22d3ee', '#6366f1', 'Question', qd ? (w.qd.ok ? 'Correct ✅' : 'Try tomorrow') : 'of the day' + (on ? ' · +20' : ''), !qd) +
      tile('map', '🗺️', '#4ade80', '#0ea5e9', 'My path', classLbl(myClass()), false) +
      tile('league', '🏆', '#fbbf24', '#ef4444', 'League', daysLeft().replace('Ends in ', '').replace('Ends today!', 'Last day!') + (daysLeft().indexOf('days') > 0 ? ' left' : ''), false) +
      (on ? tile('shop', '🛍️', '#f472b6', '#8b5cf6', 'Owl shop', 'Hats & themes', false) : '') +
      tile('report', '📊', '#818cf8', '#06b6d4', 'My week', wk.total + ' played', false);
    homeEl.querySelectorAll('[data-open]').forEach(function (b) {
      b.onclick = function () { ({ gift: openGift, qotd: openQotd, map: openMap, league: openLeague, shop: openShop, report: openReport })[b.getAttribute('data-open')](); };
    });
  }
  function mountHome(el) { homeEl = el; renderHome(); applyLook(); setTimeout(autoGift, 300); }

  /* ==================================================================== INIT */
  var hooked = false;
  (function init(n) {
    var c = C();
    if (!c || !c.onEarn) { if ((n || 0) < 80) setTimeout(function () { init((n || 0) + 1); }, 250); return; }
    if (hooked) return; hooked = true;
    c.onEarn(function (sec, id) {
      leagueAdd(sec);
      setTimeout(pushWeekly, 1500);
      if (sec === 'olympiad') setTimeout(function () { olympiadPrompt(id); }, 2500);
    });
    var first = true;
    c.onChange(function () { renderHome(); applyLook(); if (first && homeEl) { first = false; autoGift(); } });
    if (W()) { renderHome(); applyLook(); }
  })();

  window.KQPlay = {
    mountHome: mountHome, openShop: openShop, openGift: openGift, openQotd: openQotd, openMap: openMap,
    openLeague: openLeague, openReport: openReport, certificate: certificate, applyLook: applyLook, shop: SHOP
  };
})();

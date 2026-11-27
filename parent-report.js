/* ============================================================
   WEEKLY PROGRESS REPORT for parents (opened from For parents, behind the
   grown-up question). For the child playing now, the last 7 days:
     quizzes done, stories read, games played, play time,
     a bar per subject (accuracy + stars), strongest & weakest subject,
     one suggested next step, and "Share on WhatsApp" (plain text, first
     name only, plus the app link).
   Data (all already kept per child):
     quizzes + subjects  localStorage quizMaster_v1 history (quiz-shared.js)
     stories             localStorage kq_story_log [{id, at}] (stories/index.html, from this version)
     games               Firebase attempts/<player> (cat "single" / "multi")
     play time           Firebase playtime/<player>/<YYYYMMDD>, today from kq_today
   A brand-new child gets a friendly "nothing yet" report.
   ============================================================ */
(function () {
  'use strict';
  if (window.KQReport) return;
  var DAY = 86400000;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lsJ(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function firstName() {
    var n = '';
    try { var p = window.KQProfiles && KQProfiles.active(); if (p && p.name) n = p.name; } catch (e) {}
    if (!n) { try { n = localStorage.getItem('kq_nick') || ''; } catch (e) {} }
    n = String(n).trim().split(/\s+/)[0];
    return n && n !== 'Guest' ? n.slice(0, 14) : 'Your child';
  }
  function ymd(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
  function catName(id) { try { var c = typeof getCatInfo === 'function' ? getCatInfo(id) : null; return c ? c.title : null; } catch (e) { return null; } }
  function fmtTime(sec) { var m = Math.round(sec / 60); if (m < 1) return 'under 1 min'; return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }

  /* ---- local part (instant) ---- */
  function local() {
    var since = Date.now() - 7 * DAY, data = lsJ('quizMaster_v1', { users: {} }), hist = [];
    Object.keys(data.users || {}).forEach(function (u) { (data.users[u].history || []).forEach(function (h) { if ((h.date || 0) >= since) hist.push(h); }); });
    var by = {};
    hist.forEach(function (h) {
      var b = by[h.cat] || (by[h.cat] = { id: h.cat, c: 0, w: 0, n: 0, lv: {} });
      b.c += +h.correct || 0; b.w += +h.wrong || 0; b.n++; b.lv[h.level] = (b.lv[h.level] || 0) + 1;
    });
    var subjects = Object.keys(by).map(function (k) {
      var b = by[k], tot = b.c + b.w, lv = Object.keys(b.lv).sort(function (x, y) { return b.lv[y] - b.lv[x]; })[0];
      return { id: k, name: catName(k) || k, acc: tot ? Math.round(b.c / tot * 100) : 0, n: b.n, lv: lv };
    }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; });
    var stories = lsJ('kq_story_log', []).filter(function (x) { return x && x.at >= since; }).length;
    var td = lsJ('kq_today', null), todaySec = td && td.day === new Date().toDateString() ? Math.round(td.ms / 1000) : 0;
    return { quizzes: hist.length, subjects: subjects, stories: stories, games: null, playSec: todaySec, days: null };
  }
  /* ---- online part: games and play time (per child player key) ---- */
  function online(r, done) {
    if (!window.KQ || !KQ.ready || !window.firebase) return done(r);
    var t = setTimeout(function () { done(r); done = function () {}; }, 6000);
    KQ.ready.then(function () {
      var key = KQ.user().key, db = firebase.database(), since = Date.now() - 7 * DAY;
      var days = []; for (var i = 6; i >= 0; i--) days.push(ymd(new Date(Date.now() - i * DAY)));
      return Promise.all([
        db.ref('attempts/' + key).orderByChild('at').startAt(since).once('value').then(function (s) { return s.val() || {}; }, function () { return null; }),
        db.ref('playtime/' + key).orderByKey().startAt(days[0]).once('value').then(function (s) { return s.val() || {}; }, function () { return null; })
      ]).then(function (v) {
        if (v[0]) { var a = v[0]; r.games = Object.keys(a).filter(function (k) { return a[k] && (a[k].cat === 'single' || a[k].cat === 'multi'); }).length; }
        if (v[1]) {
          r.days = days.map(function (d) { return Math.round((+v[1][d] || 0) / 60); });
          var tot = days.reduce(function (s, d) { return s + (+v[1][d] || 0); }, 0);
          r.playSec = Math.max(r.playSec, tot);
        }
        clearTimeout(t); done(r);
      });
    }).catch(function () { clearTimeout(t); done(r); });
  }
  function verdict(r) {
    var ok = r.subjects.filter(function (s) { return s.n >= 1; });
    var strong = ok.slice().sort(function (a, b) { return b.acc - a.acc || b.n - a.n; })[0] || null;
    var weak = ok.length > 1 ? ok.slice().sort(function (a, b) { return a.acc - b.acc || b.n - a.n; })[0] : null;
    if (weak && strong && weak.id === strong.id) weak = null;
    var next;
    if (weak && weak.acc < 80) next = { t: 'Practise ' + weak.name + ' (' + weak.acc + '% right this week)', href: 'quiz/play.html#/c/' + weak.lv + '/' + weak.id };
    else if (!r.stories) next = { t: 'Read a picture story together', href: 'stories/index.html' };
    else if (strong) next = { t: 'Try a harder ' + strong.name + ' quiz or an Olympiad paper', href: 'Olympiad/index.html' };
    else next = { t: 'Start with today’s 3-step plan on the home page', href: null };
    return { strong: strong, weak: weak, next: next };
  }
  function shareText(r, v) {
    var nm = firstName(), parts = [];
    parts.push('📊 ' + nm + '’s week on Kids Quiz');
    parts.push('🎯 ' + r.quizzes + ' quizzes · 📖 ' + r.stories + ' stories' + (r.games != null ? ' · 🎮 ' + r.games + ' games' : '') + (r.playSec >= 60 ? ' · ⏱️ ' + fmtTime(r.playSec) : ''));
    if (v.strong) parts.push('⭐ Best at: ' + v.strong.name);
    if (v.weak) parts.push('💪 Practising: ' + v.weak.name);
    parts.push('Free learning app for LKG to Class 5: ' + (window.KQ_LINKS ? KQ_LINKS.play : 'https://play.google.com/store/apps/details?id=com.mk.kidsquiz'));
    return parts.join('\n');
  }
  /** WhatsApp straight away (app: opens WhatsApp; web: wa.me). Called only inside the parent area. */
  function shareWhatsApp(text) {
    var url = 'https://wa.me/?text=' + encodeURIComponent(text);
    try { if (window.KQEvents) KQEvents.log('share_tapped'); } catch (e) {}
    if (typeof kqOpenExternal === 'function') kqOpenExternal(url); else window.open(url, '_blank', 'noopener');
  }
  function shareOther(text) {
    try { if (window.KQEvents) KQEvents.log('share_tapped'); } catch (e) {}
    try { if (typeof Android !== 'undefined' && Android.shareText) { Android.shareText(text); return; } } catch (e) {}
    if (navigator.share) { navigator.share({ text: text }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(text); alert('Copied! Paste it in any app.'); } catch (e) { alert(text); }
  }

  function css() {
    if (document.getElementById('kqrp-css')) return;
    var st = document.createElement('style'); st.id = 'kqrp-css';
    st.textContent =
      '.kqrp{position:fixed;inset:0;z-index:2147483646;background:rgba(15,10,40,.6);display:flex;align-items:flex-end;justify-content:center;font-family:"Baloo 2",system-ui,sans-serif}' +
      '.kqrp-c{background:#fff;color:#1e1b4b;border-radius:28px 28px 0 0;padding:16px 16px max(18px,env(safe-area-inset-bottom));width:100%;max-width:560px;max-height:94vh;overflow-y:auto}' +
      '.kqrp-h{display:flex;align-items:center;gap:10px}.kqrp-h h2{margin:0;flex:1;font-size:23px;line-height:1.1}.kqrp-h small{display:block;font-size:13px;color:#6b7280;font-weight:700}' +
      '.kqrp-x{width:44px;height:44px;border-radius:50%;border:none;background:#f3f4f6;font-size:20px;cursor:pointer}' +
      '.kqrp-t{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}' +
      '.kqrp-t div{background:#f5f3ff;border-radius:16px;padding:8px 10px;display:flex;align-items:center;gap:8px}.kqrp-t b{display:block;font-size:22px;line-height:1}.kqrp-t small{font-size:12px;font-weight:800;color:#6b7280}' +
      '.kqrp-t img{width:30px;height:30px}' +
      '.kqrp h3{margin:14px 0 6px;font-size:17px}' +
      '.kqrp-s{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,8fr) 84px;gap:6px 8px;align-items:center;font-weight:800;font-size:14px}' +
      '.kqrp-s .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kqrp-s .bar{height:14px;border-radius:7px;background:#ede9fe;overflow:hidden}.kqrp-s .bar i{display:block;height:100%;border-radius:7px}' +
      '.kqrp-s .st{color:#f59e0b;letter-spacing:1px;font-size:13px;text-align:right;white-space:nowrap}' +
      '.kqrp-d{display:flex;align-items:flex-end;gap:6px;height:70px;padding:4px 2px 0}.kqrp-d span{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;font-weight:800;color:#6b7280}' +
      '.kqrp-d i{display:block;width:100%;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#a78bfa,#7c3aed);min-height:3px}' +
      '.kqrp-v{border-radius:16px;padding:8px 12px;margin-top:8px;font-weight:700;font-size:14.5px;line-height:1.35}' +
      '.kqrp-btn{display:block;width:100%;border:none;border-radius:18px;padding:12px;font:800 18px "Baloo 2",sans-serif;color:#fff;cursor:pointer;margin-top:10px}' +
      '.kqrp-wa{background:#25D366;box-shadow:0 4px 0 #128C7E}.kqrp-go{background:linear-gradient(135deg,#7c3aed,#4f46e5);box-shadow:0 4px 0 #3730a3}' +
      '.kqrp-l{display:block;margin:8px auto 0;border:none;background:none;color:#6d28d9;font:800 14px "Baloo 2",sans-serif;cursor:pointer;text-decoration:underline}' +
      '.kqrp-empty{text-align:center;padding:16px 6px;font-weight:700;color:#4b5563}';
    document.head.appendChild(st);
  }
  var ic = function (cp, px) { return '<img src="images/emoji/' + cp + '.svg" alt="" style="width:' + (px || 30) + 'px;height:' + (px || 30) + 'px">'; };
  function render(box, r) {
    var v = verdict(r), nm = firstName(), empty = !r.quizzes && !r.stories && !r.games;
    var tile = function (cp, n, l) { return '<div>' + ic(cp) + '<span><b>' + n + '</b><small>' + l + '</small></span></div>'; };
    var h = '<div class="kqrp-h">' + ic('1f4ca', 40) + '<h2>' + esc(nm) + '’s week<small>Last 7 days</small></h2><button class="kqrp-x" data-a="x" aria-label="Close">✕</button></div>';
    if (empty) {
      h += '<div class="kqrp-empty">' + ic('1f331', 54) + '<p>Nothing yet this week. Every quiz, story and game ' + esc(nm === 'Your child' ? 'your child' : nm) + ' finishes will show here.</p><p>A good start: today’s 3-step plan on the home page.</p></div>' +
        '<button class="kqrp-btn kqrp-go" data-a="x">OK</button>';
      box.innerHTML = '<div class="kqrp-c">' + h + '</div>'; return;
    }
    h += '<div class="kqrp-t">' + tile('1f3af', r.quizzes, 'quizzes') + tile('1f4d6', r.stories, 'stories') + tile('1f3ae', r.games == null ? '…' : r.games, 'games') + tile('23f1', r.playSec ? fmtTime(r.playSec) : '…', 'play time') + '</div>';
    if (r.days) {
      var mx = Math.max.apply(null, r.days.concat([10])), L = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      h += '<h3>⏱️ Minutes each day</h3><div class="kqrp-d">' + r.days.map(function (m, i) {
        var d = new Date(Date.now() - (6 - i) * DAY); return '<span title="' + m + ' min"><i style="height:' + Math.max(3, Math.round(m / mx * 52)) + 'px"></i>' + L[(d.getDay() + 6) % 7] + '</span>';
      }).join('') + '</div>';
    }
    if (r.subjects.length) {
      h += '<h3>🎯 Subjects (right answers)</h3><div class="kqrp-s">' + r.subjects.slice(0, 7).map(function (s) {
        var st = s.acc >= 90 ? 3 : s.acc >= 70 ? 2 : s.acc >= 40 ? 1 : 0, col = s.acc >= 70 ? '#22c55e' : s.acc >= 40 ? '#f59e0b' : '#ef4444';
        return '<span class="nm">' + esc(s.name) + '</span><span class="bar"><i style="width:' + Math.max(4, s.acc) + '%;background:' + col + '"></i></span><span class="st">' + '★★★'.slice(0, st) + '☆☆☆'.slice(0, 3 - st) + ' ' + s.acc + '%</span>';
      }).join('') + '</div>';
    }
    if (v.strong) h += '<div class="kqrp-v" style="background:#dcfce7">⭐ <b>Strongest:</b> ' + esc(v.strong.name) + ' (' + v.strong.acc + '%)</div>';
    if (v.weak) h += '<div class="kqrp-v" style="background:#fef3c7">💪 <b>Needs practice:</b> ' + esc(v.weak.name) + ' (' + v.weak.acc + '%)</div>';
    h += '<div class="kqrp-v" style="background:#e0f2fe">👉 <b>Next step:</b> ' + esc(v.next.t) + '</div>' +
      (v.next.href ? '<button class="kqrp-btn kqrp-go" data-a="next">Do the next step ›</button>' : '') +
      '<button class="kqrp-btn kqrp-wa" data-a="wa">Share on WhatsApp</button><button class="kqrp-l" data-a="other">Share with another app</button>' +
      '<p style="font-size:12px;color:#6b7280;font-weight:700;text-align:center;margin:8px 0 0">Shared reports show only the first name.</p>';
    box.innerHTML = '<div class="kqrp-c">' + h + '</div>';
    box.__share = shareText(r, v); box.__next = v.next.href;
  }
  function open() {
    css();
    var old = document.querySelector('.kqrp'); if (old) old.remove();
    var box = document.createElement('div'); box.className = 'kqrp'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Weekly report');
    document.body.appendChild(box);
    var r = local(); render(box, r);
    online(r, function (r2) { if (document.body.contains(box)) render(box, r2); });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) { if (e.target === box) box.remove(); return; }
      var a = b.getAttribute('data-a');
      if (a === 'x') box.remove();
      else if (a === 'wa') shareWhatsApp(box.__share);
      else if (a === 'other') shareOther(box.__share);
      else if (a === 'next' && box.__next) location.href = box.__next;
    });
  }
  window.KQReport = { open: open, summary: function (cb) { var r = local(); online(r, function (r2) { cb(r2, verdict(r2), shareText(r2, verdict(r2))); }); } };
})();

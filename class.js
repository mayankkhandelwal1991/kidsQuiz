/* ============================================================
   MY CLASS (student side) — joining a teacher's class and doing its tests.
   · Join with the teacher's 6-letter class code, or (no code) find the teacher by
     name and send a request; the teacher accepts it on teacher.html.
     Both are behind the grown-up question.
   · Home shows the class tests: to do / done, a "New test!" banner for tests that
     came since last time, and the ranking when the teacher switched it on for a test.
   · In the Android app the phone also checks for new tests every few hours and shows
     a notification (Android.watchClasses), so no server is needed.
   Per child (localStorage, swapped by profiles.js):
     kq_classes      [{code, tn, cn}]      classes this child is in
     kq_class_reqs   [{code, tn, cn, at}]  requests waiting for the teacher
     kq_class_seen   {code: newest task id seen}
   Firebase: classes/<code>/{owner,name,tn,members/<player>,requests/<player>},
             tasks/<code>/<id>/{type,lv,ref,title,tn,pub,done/<player>{n,s,at}},
             tdir/<code>{k,tn,cn}  (classes a teacher lets students find by name)
   ============================================================ */
(function () {
  'use strict';
  if (window.KQClass) return;
  var BASE = (function () { try { return document.currentScript.src.replace(/class\.js[^/]*$/, ''); } catch (e) { return ''; } })();
  function lsJ(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function setJ(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function db() { return firebase.database(); }
  // kq-leaderboard.js may load after this file: wait for it (up to ~10 s)
  function ready() {
    if (window.KQ && KQ.ready) return KQ.ready;
    return new Promise(function (res, rej) { var n = 0; (function w() { if (window.KQ && KQ.ready) return KQ.ready.then(res, rej); if (n++ > 50) return rej(new Error('offline')); setTimeout(w, 200); })(); });
  }
  function me() { var u = KQ.user(); return { key: u.key, n: String(u.name || 'Player').split(' ')[0].slice(0, 14) }; }
  function gate(fn) { if (typeof kqParentGate === 'function') kqParentGate(fn); else fn(); }
  function toast(t) {
    var d = document.createElement('div'); d.className = 'kqc-toast'; d.textContent = t; document.body.appendChild(d);
    setTimeout(function () { d.classList.add('in'); }, 20); setTimeout(function () { d.remove(); }, 3200);
  }
  var CODE = /^[A-Z0-9]{6}$/;
  function list() { return lsJ('kq_classes', []).filter(function (c) { return c && CODE.test(c.code); }); }
  function reqs() { return lsJ('kq_class_reqs', []).filter(function (c) { return c && CODE.test(c.code); }); }
  function legacy() { try { var w = window.KQCoins && KQCoins.wallet ? KQCoins.wallet() : null; return w && CODE.test(w.code || '') ? w.code : ''; } catch (e) { return ''; } }
  function codes() { var a = list().map(function (c) { return c.code; }), l = legacy(); if (l && a.indexOf(l) < 0) a.push(l); return a; }
  function remember(code, tn, cn) {
    var a = list().filter(function (c) { return c.code !== code; }); a.unshift({ code: code, tn: tn || '', cn: cn || '' }); setJ('kq_classes', a.slice(0, 10));
    setJ('kq_class_reqs', reqs().filter(function (c) { return c.code !== code; }));
    try { if (window.KQPush) KQPush.sync(); } catch (e) {}
  }
  function leave(code) {
    setJ('kq_classes', list().filter(function (c) { return c.code !== code; }));
    ready().then(function () { return db().ref('classes/' + code + '/members/' + me().key).remove(); }).catch(function () {});
  }
  function info(code) { return db().ref('classes/' + code).once('value').then(function (s) { var v = s.val(); return v && v.owner ? { code: code, tn: v.tn || '', cn: v.name || '' } : null; }); }

  function joinByCode(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!CODE.test(code)) return Promise.reject(new Error('Class codes have 6 letters or numbers.'));
    return ready().then(function () { return info(code); }).then(function (c) {
      if (!c) throw new Error('No class has this code. Check it with the teacher.');
      var m = me();
      return db().ref('classes/' + code + '/members/' + m.key).set({ n: m.n, at: Date.now() }).then(function () {
        remember(code, c.tn, c.cn);
        try { if (window.KQEvents) KQEvents.log('class_joined'); } catch (e) {}
        return c;
      });
    });
  }
  /* no code: find the teacher (only classes the teacher made findable) */
  function search(q) {
    q = String(q || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (q.length < 3) return Promise.resolve([]);
    return ready().then(function () { return db().ref('tdir').limitToFirst(500).once('value'); }).then(function (s) {
      var v = s.val() || {};
      return Object.keys(v).filter(function (c) { return CODE.test(c) && v[c] && ((v[c].k || '') + ' ' + String(v[c].cn || '').toLowerCase()).indexOf(q) >= 0; })
        .slice(0, 15).map(function (c) { return { code: c, tn: v[c].tn || '', cn: v[c].cn || '' }; });
    });
  }
  function request(c) {
    return ready().then(function () {
      var m = me(), lv = parseInt(localStorage.getItem('kq_last_class'), 10), r = { n: m.n, at: Date.now() };
      if (!isNaN(lv)) r.c = lv;
      return db().ref('classes/' + c.code + '/requests/' + m.key).set(r).then(function () {
        setJ('kq_class_reqs', reqs().filter(function (x) { return x.code !== c.code; }).concat([{ code: c.code, tn: c.tn, cn: c.cn, at: Date.now() }]).slice(-5));
        try { if (window.KQEvents) KQEvents.log('class_request'); } catch (e) {}
      });
    });
  }
  /* waiting requests: accepted (now a member) or declined (request gone) */
  function checkRequests() {
    var r = reqs(); if (!r.length) return Promise.resolve();
    return ready().then(function () {
      var k = me().key;
      return Promise.all(r.map(function (c) {
        return Promise.all([db().ref('classes/' + c.code + '/members/' + k).once('value'), db().ref('classes/' + c.code + '/requests/' + k).once('value')]).then(function (x) {
          if (x[0].exists()) { remember(c.code, c.tn, c.cn); toast('🎉 ' + (c.tn || 'Your teacher') + ' added you to the class!'); }
          else if (!x[1].exists()) { setJ('kq_class_reqs', reqs().filter(function (y) { return y.code !== c.code; })); }
        });
      }));
    }).catch(function () {});
  }

  /* ---------- scores and the ranking ---------- */
  function scoreVal(s) { s = String(s || ''); var m = s.match(/^(\d+)\s*\/\s*(\d+)/); if (m) return +m[2] ? +m[1] / +m[2] : 0; m = s.match(/^(\d+)/); return m ? +m[1] / 3 : 0; }
  function ranking(t) {
    var d = t.done || {};
    return Object.keys(d).map(function (k) { return { k: k, n: d[k].n || '?', s: d[k].s || '', v: scoreVal(d[k].s), at: d[k].at || 0 }; })
      .sort(function (a, b) { return (b.v - a.v) || (a.at - b.at); });
  }
  function rankSheet(t) {
    css();
    var rows = ranking(t), k = '';
    try { k = KQ.user().key; } catch (e) {}
    var w = document.createElement('div'); w.className = 'kqc-bg';
    var medal = function (i) { return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.'; };
    w.innerHTML = '<div class="kqc-sh"><div class="kqc-hd"><b>🏆 ' + esc(t.title) + '</b><button type="button" class="kqc-x" aria-label="Close">✕</button></div>' +
      '<p class="kqc-note">' + (t.tn ? 'From ' + esc(t.tn) + ' · ' : '') + rows.length + ' finished · the first to get the best score is on top</p>' +
      '<div class="kqc-rk">' + (rows.length ? rows.map(function (r, i) { return '<div class="' + (r.k === k ? 'me' : '') + '"><span>' + medal(i) + '</span><b>' + esc(r.n) + (r.k === k ? ' (you)' : '') + '</b><i>' + esc(r.s) + '</i></div>'; }).join('') : '<p class="kqc-note">Nobody has finished yet. Be the first!</p>') + '</div></div>';
    document.body.appendChild(w);
    w.querySelector('.kqc-x').onclick = function () { w.remove(); };
    w.onclick = function (e) { if (e.target === w) w.remove(); };
  }

  /* ---------- join sheet ---------- */
  function openJoin(onDone) {
    gate(function () {
      css();
      var w = document.createElement('div'); w.className = 'kqc-bg';
      function close() { w.remove(); if (onDone) onDone(); }
      function render() {
        var mine = list(), wait = reqs();
        w.innerHTML = '<div class="kqc-sh"><div class="kqc-hd"><b>🏫 Join my teacher’s class</b><button type="button" class="kqc-x" aria-label="Close">✕</button></div>' +
          (mine.length ? '<h4>My classes</h4>' + mine.map(function (c) { return '<div class="kqc-row"><span>🏫</span><b>' + esc(c.tn || 'Teacher') + (c.cn ? ' · ' + esc(c.cn) : '') + '<small>Code ' + esc(c.code) + '</small></b><button type="button" class="kqc-b l" data-leave="' + esc(c.code) + '">Leave</button></div>'; }).join('') : '') +
          (wait.length ? '<h4>Waiting for the teacher</h4>' + wait.map(function (c) { return '<div class="kqc-row"><span>⏳</span><b>' + esc(c.tn || 'Teacher') + (c.cn ? ' · ' + esc(c.cn) : '') + '<small>Request sent</small></b></div>'; }).join('') : '') +
          '<h4>I have a class code</h4><div class="kqc-in"><input id="kqcCode" maxlength="6" placeholder="ABC123" autocomplete="off" autocapitalize="characters"><button type="button" class="kqc-b" id="kqcJoin">Join</button></div><p class="kqc-note" id="kqcMsg"></p>' +
          '<h4>No code? Find your teacher</h4><div class="kqc-in"><input id="kqcQ" maxlength="30" placeholder="Teacher or school name"><button type="button" class="kqc-b l" id="kqcFind">🔍</button></div><div id="kqcRes"></div>' +
          '<p class="kqc-note">The teacher sees your child’s first name only, and has to accept the request.</p></div>';
        w.querySelector('.kqc-x').onclick = close;
        w.querySelectorAll('[data-leave]').forEach(function (b) { b.onclick = function () { if (confirm('Leave this class?')) { leave(b.getAttribute('data-leave')); render(); } }; });
        var msg = w.querySelector('#kqcMsg'), inp = w.querySelector('#kqcCode');
        inp.oninput = function () { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
        w.querySelector('#kqcJoin').onclick = function () {
          msg.textContent = 'Joining…';
          joinByCode(inp.value).then(function (c) { toast('🎉 Joined ' + (c.tn ? c.tn + '’s' : 'the') + ' class!'); close(); }).catch(function (e) { msg.textContent = /permission/i.test(e.message || '') ? 'Classes are not switched on yet.' : (e.message || 'Could not join. Check the internet.'); });
        };
        var res = w.querySelector('#kqcRes'), q = w.querySelector('#kqcQ');
        var find = function () {
          res.innerHTML = '<p class="kqc-note">Searching…</p>';
          search(q.value).then(function (a) {
            if (String(q.value).trim().length < 3) { res.innerHTML = '<p class="kqc-note">Type at least 3 letters.</p>'; return; }
            var mineC = codes(), waitC = reqs().map(function (c) { return c.code; });
            res.innerHTML = a.length ? a.map(function (c, i) {
              var st = mineC.indexOf(c.code) >= 0 ? '<i>✓ Joined</i>' : waitC.indexOf(c.code) >= 0 ? '<i>⏳ Sent</i>' : '<button type="button" class="kqc-b" data-i="' + i + '">Send request</button>';
              return '<div class="kqc-row"><span>🏫</span><b>' + esc(c.tn || 'Teacher') + '<small>' + esc(c.cn || '') + '</small></b>' + st + '</div>';
            }).join('') : '<p class="kqc-note">No teacher found. Ask the teacher for the class code, or to switch on “Students can find this class”.</p>';
            res.querySelectorAll('[data-i]').forEach(function (b) {
              b.onclick = function () { b.disabled = true; b.textContent = '…'; request(a[+b.getAttribute('data-i')]).then(function () { toast('📨 Request sent! The teacher will accept it.'); render(); }).catch(function () { b.disabled = false; b.textContent = 'Send request'; toast('Could not send. Check the internet.'); }); };
            });
          }).catch(function () { res.innerHTML = '<p class="kqc-note">Could not search. Check the internet.</p>'; });
        };
        w.querySelector('#kqcFind').onclick = find; q.onkeydown = function (e) { if (e.key === 'Enter') find(); };
      }
      render(); document.body.appendChild(w);
    });
  }

  /* every test of every class, grouped by teacher */
  function allSheet(items, names, row) {
    var w = document.createElement('div'); w.className = 'kqc-bg';
    var byC = {}; items.forEach(function (x, i) { (byC[x.code] = byC[x.code] || []).push(i); });
    w.innerHTML = '<div class="kqc-sh"><div class="kqc-hd"><b>📝 All my class tests</b><button type="button" class="kqc-x" aria-label="Close">✕</button></div>' +
      Object.keys(byC).map(function (c) { var n = names[c] || {}; return '<h4>🏫 ' + esc(n.tn || 'Teacher') + (n.cn ? ' · ' + esc(n.cn) : '') + '</h4>' + byC[c].map(function (i) { return row(items[i], i); }).join(''); }).join('') + '</div>';
    document.body.appendChild(w);
    w.querySelector('.kqc-x').onclick = function () { w.remove(); };
    w.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { var x = items[+b.getAttribute('data-go')]; if (x.done && x.t.pub) rankSheet(x.t); else go(x.code, x.id, x.t); }; });
    w.querySelectorAll('[data-rk]').forEach(function (b) { b.onclick = function () { rankSheet(items[+b.getAttribute('data-rk')].t); }; });
  }

  /* ---------- home: class tests ---------- */
  function go(code, id, t) {
    if (typeof kqTaskStart === 'function') kqTaskStart({ code: code, id: id, type: t.type, ref: t.ref, lv: t.lv });
    location.href = BASE + (t.type === 'story' ? 'stories/index.html#/s/' + encodeURIComponent(t.ref) : 'quiz/play.html#/c/' + t.lv + '/' + encodeURIComponent(t.ref));
  }
  function lvLabel(l) { try { return typeof classLabel === 'function' ? classLabel(l) : ''; } catch (e) { return ''; } }
  function renderHome(el) {
    if (!el) return;
    css();
    var cs = codes();
    checkRequests().then(function () {
      cs = codes(); var wait = reqs();
      if (!cs.length) {
        el.innerHTML = wait.length ? '<div class="kqc-card"><div class="kqc-top"><span>⏳</span><b>Waiting for ' + esc(wait[0].tn || 'the teacher') + '<small>Your request to join the class is sent</small></b></div></div>' : '';
        return;
      }
      return ready().then(function () {
        var k = me().key, names = {};
        list().forEach(function (c) { names[c.code] = c; });
        return Promise.all(cs.map(function (code) {
          return Promise.all([db().ref('tasks/' + code).limitToLast(25).once('value'), names[code] && names[code].tn ? null : info(code).catch(function () { return null; })]).then(function (x) {
            if (x[1]) { names[code] = x[1]; if (list().some(function (c) { return c.code === code; })) remember(code, x[1].tn, x[1].cn); }
            var v = x[0].val() || {};
            return Object.keys(v).map(function (id) { return { code: code, id: id, t: v[id], done: !!(v[id].done && v[id].done[k]), my: v[id].done && v[id].done[k] }; });
          }).catch(function () { return []; });
        })).then(function (all) {
          var items = [].concat.apply([], all).sort(function (a, b) { return a.id < b.id ? 1 : -1; });
          var seen = lsJ('kq_class_seen', {}), fresh = items.filter(function (x) { return !x.done && seen[x.code] && x.id > seen[x.code]; });
          // remember the newest test per class (and tell the app, for the notification check)
          var newest = {}; items.forEach(function (x) { if (!newest[x.code] || x.id > newest[x.code]) newest[x.code] = x.id; });
          cs.forEach(function (c) { if (!seen[c] || (newest[c] && newest[c] > seen[c])) seen[c] = newest[c] || '0'; });
          setJ('kq_class_seen', seen);
          try { if (window.Android && Android.watchClasses) Android.watchClasses(JSON.stringify(cs.map(function (c) { return { code: c, tn: (names[c] && names[c].tn) || '', last: seen[c] || '' }; }))); } catch (e) {}
          var multi = cs.length > 1, allTodo = items.filter(function (x) { return !x.done; }), allDone = items.filter(function (x) { return x.done; });
          var todo = allTodo.slice(0, 4), done = allDone.slice(0, 3);
          var tn = (names[cs[0]] && names[cs[0]].tn) || (items[0] && items[0].t.tn) || '';
          var row = function (x, i) {
            var t = x.t, ic = t.type === 'story' ? '📖' : '📝';
            return '<div class="kqc-test' + (x.done ? ' d' : '') + '">' +
              '<button type="button" class="kqc-tb" data-go="' + i + '"><span>' + (x.done ? '✅' : ic) + '</span><b>' + esc(t.title) + '<small>' + (t.type === 'story' ? 'Story' : 'Test') + (multi ? ' · ' + esc(t.tn || (names[x.code] && names[x.code].tn) || 'Class ' + x.code) : (lvLabel(t.lv) && t.type !== 'story' ? ' · ' + esc(lvLabel(t.lv)) : '')) + (x.done ? ' · You got ' + esc(x.my.s || '✓') : '') + '</small></b>' + (x.done ? '' : '<i>' + (fresh.indexOf(x) >= 0 ? 'NEW' : 'Go ›') + '</i>') + '</button>' +
              (t.pub ? '<button type="button" class="kqc-rb" data-rk="' + i + '" aria-label="Ranking">🏆</button>' : '') + '</div>';
          };
          var shown = todo.concat(done);
          el.innerHTML = '<div class="kqc-card">' +
            (fresh.length ? '<div class="kqc-new">🔔 New test from ' + esc(fresh[0].t.tn || tn || 'your teacher') + ': <b>' + esc(fresh[0].t.title) + '</b></div>' : '') +
            '<div class="kqc-top"><span>🏫</span><b>' + (multi ? 'My classes (' + cs.length + ')' : tn ? esc(tn) + '’s class' : 'My class') + '<small>' + (allTodo.length ? allTodo.length + ' to do' : 'All done! 🎉') + (allDone.length ? ' · ' + allDone.length + ' finished' : '') + '</small></b><button type="button" class="kqc-b l" id="kqcMore">＋</button></div>' +
            (shown.length ? shown.map(row).join('') : '<p class="kqc-note">No tests yet. Your teacher will add them here.</p>') +
            (items.length > shown.length ? '<button type="button" class="kqc-b l kqc-all" id="kqcAll">See all ' + items.length + ' tests ›</button>' : '') + '</div>';
          el.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { var x = shown[+b.getAttribute('data-go')]; if (x.done && x.t.pub) rankSheet(x.t); else go(x.code, x.id, x.t); }; });
          el.querySelectorAll('[data-rk]').forEach(function (b) { b.onclick = function () { rankSheet(shown[+b.getAttribute('data-rk')].t); }; });
          var ab = el.querySelector('#kqcAll'); if (ab) ab.onclick = function () { allSheet(items, names, row); };
          var mb = el.querySelector('#kqcMore'); if (mb) mb.onclick = function () { openJoin(function () { renderHome(el); }); };
        });
      });
    }).catch(function () { el.innerHTML = ''; });
  }

  var CSS = '.kqc-toast{position:fixed;left:50%;top:18px;transform:translate(-50%,-30px);opacity:0;transition:.3s;z-index:100001;background:#1e1b4b;color:#fff;font:800 15px "Baloo 2",system-ui,sans-serif;padding:10px 16px;border-radius:16px;max-width:90%;text-align:center}.kqc-toast.in{transform:translate(-50%,0);opacity:1}' +
    '.kqc-bg{position:fixed;inset:0;z-index:99995;background:rgba(30,16,70,.7);display:flex;align-items:flex-end;justify-content:center}' +
    '.kqc-sh{background:#fff;border-radius:26px 26px 0 0;padding:16px 16px max(18px,env(safe-area-inset-bottom));width:100%;max-width:520px;max-height:90vh;overflow:auto;font-family:"Baloo 2",system-ui,sans-serif;color:#1e1b4b}' +
    '.kqc-sh h4{margin:14px 0 4px;font-size:16px;color:#5b21b6}.kqc-hd{display:flex;align-items:center;gap:8px}.kqc-hd b{flex:1;font-size:20px}' +
    '.kqc-x{border:none;background:#f3f4f6;border-radius:12px;width:38px;height:38px;font-size:17px;cursor:pointer}' +
    '.kqc-note{color:#6b7280;font-weight:700;font-size:14px;margin:6px 0}' +
    '.kqc-in{display:flex;gap:8px}.kqc-in input{flex:1;min-width:0;border:2px solid #ddd6fe;border-radius:14px;padding:9px 12px;font:800 17px "Baloo 2",system-ui,sans-serif;color:#1e1b4b}#kqcCode{letter-spacing:.15em;text-transform:uppercase}' +
    '.kqc-b{border:none;border-radius:14px;padding:9px 14px;font:800 15px "Baloo 2",system-ui,sans-serif;background:#7c3aed;color:#fff;cursor:pointer;white-space:nowrap}.kqc-b.l{background:#ede9fe;color:#5b21b6}' +
    '.kqc-row{display:flex;align-items:center;gap:10px;background:#faf5ff;border-radius:14px;padding:8px 10px;margin-top:6px}.kqc-row>span{font-size:24px}.kqc-row b{flex:1;font-size:16px;min-width:0}.kqc-row small{display:block;color:#6b7280;font-size:13px}.kqc-row i{font-style:normal;font-weight:800;color:#16a34a}' +
    '.kqc-rk>div{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;margin-top:6px;background:#f8fafc}.kqc-rk>div.me{background:#fef3c7;outline:2px solid #f59e0b}.kqc-rk span{width:34px;font-size:22px;font-weight:800;text-align:center}.kqc-rk b{flex:1;font-size:17px}.kqc-rk i{font-style:normal;font-weight:800;color:#4338ca;font-size:17px}' +
    '.kqc-card{background:#fff;border-radius:22px;padding:12px;box-shadow:0 6px 18px rgba(30,27,75,.08);font-family:"Baloo 2",system-ui,sans-serif;color:#1e1b4b}' +
    '.kqc-top{display:flex;align-items:center;gap:10px}.kqc-top>span{font-size:30px}.kqc-top b{flex:1;font-size:18px;line-height:1.2}.kqc-top small{display:block;color:#6b7280;font-size:13px}' +
    '.kqc-new{background:linear-gradient(90deg,#f59e0b,#ef4444);color:#fff;border-radius:14px;padding:8px 12px;font-weight:700;margin-bottom:8px;animation:kqcPulse 1.6s ease-in-out infinite}@keyframes kqcPulse{50%{transform:scale(1.02)}}' +
    '.kqc-test{display:flex;gap:6px;margin-top:8px}.kqc-tb{flex:1;min-width:0;display:flex;align-items:center;gap:10px;border:none;border-radius:16px;padding:9px 12px;background:linear-gradient(120deg,#0ea5e9,#6366f1);color:#fff;font-family:inherit;text-align:left;cursor:pointer}' +
    '.kqc-test.d .kqc-tb{background:#f0fdf4;color:#166534}.kqc-tb span{font-size:22px}.kqc-tb b{flex:1;min-width:0;font-size:16px;line-height:1.2}.kqc-tb small{display:block;font-size:13px;opacity:.85}.kqc-tb i{font-style:normal;font-weight:800;background:#fff;color:#4338ca;border-radius:999px;padding:3px 10px;font-size:13px}' +
    '.kqc-all{width:100%;margin-top:10px}.kqc-rb{border:none;border-radius:16px;background:#fef3c7;font-size:22px;width:50px;cursor:pointer}';
  function css() { if (document.getElementById('kqcCss')) return; var s = document.createElement('style'); s.id = 'kqcCss'; s.textContent = CSS; document.head.appendChild(s); }

  window.KQClass = { codes: codes, list: list, remember: remember, joinByCode: joinByCode, openJoin: openJoin, renderHome: renderHome, rankSheet: rankSheet, ranking: ranking, search: search, request: request };
})();

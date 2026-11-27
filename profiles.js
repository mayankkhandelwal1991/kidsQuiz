/* ============================================================
   CHILD PROFILES — brothers and sisters share one phone.
   Each child's progress lives in this device's localStorage (name, class,
   stars, coins, best scores, guest leaderboard id …). Switching saves the
   current child's keys into kq_profile_data_<id> and restores the other
   child's, then reloads. Device settings (sound, ads, sign-in) are shared.
   Guest play: each child gets their own guest id. Google sign-in: the child who
   already used the account keeps its id (the uid), every other child gets
   "<uid>_<sfx>"; the children list is kept in Firebase users/<uid>/kids so every
   phone signed in with that account shows the same children. Nothing is ever
   deleted from Firebase: removing a child only hides it on this phone.
   ============================================================ */
(function () {
  'use strict';
  if (window.KQProfiles) return;
  var LIST = 'kq_profiles', ACTIVE = 'kq_profile_active', DATA = 'kq_profile_data_';
  var MAX = 6;
  var AVATARS = ['🦁', '🐼', '🦄', '🐯', '🐰', '🦊', '🐸', '🐵', '🐨', '🐙'];
  // kept for the whole device (never swapped)
  var DEVICE = /^(kq_muted|kq_adCounter|kq_lastAdTime|kq_guest_session|kq_cached_auth|kq_dev.*|kq_app_config|kq_manifest_.*|kq_rating.*|kq_review_.*|kq_session|kq_profiles|kq_profile_active|kq_profile_data_.*|kq_story_autoplay|kq_lb_range|kq_lb_guests|kq_child_named|kq_profiles_hidden|kq_promise_seen)$/;
  function ownKey(k) { return !DEVICE.test(k) && k.indexOf(':') < 0 && !/^(firebase|goog|_|ga|google|adsby|__)/i.test(k); }
  function get(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function emo(e, px) {
    var cp = Array.from(String(e)).map(function (c) { return c.codePointAt(0); }).filter(function (c) { return c !== 0xfe0f; }).map(function (c) { return c.toString(16); }).join('-');
    return '<img src="' + BASE + 'images/emoji/' + cp + '.svg" alt="" width="' + px + '" height="' + px + '" style="width:' + px + 'px;height:' + px + 'px">';
  }
  var BASE = (function () { var sc = document.currentScript && document.currentScript.src; return sc ? sc.replace(/[^/]*$/, '') : ''; })();
  function clsLbl(n) { n = parseInt(n, 10); return n === 0 ? 'LKG' : n === -1 ? 'UKG' : (n >= 1 ? 'Class ' + n : ''); }
  function isGoogle() { try { var a = JSON.parse(localStorage.getItem('kq_cached_auth') || 'null'); return !!(a && a.name) && localStorage.getItem('kq_guest_session') !== '1'; } catch (e) { return false; } }

  function uid() { try { var a = JSON.parse(localStorage.getItem('kq_cached_auth') || 'null'); return (a && a.uid) || ''; } catch (e) { return ''; } }
  function gName() { try { return ((JSON.parse(localStorage.getItem('kq_cached_auth') || '{}').name) || 'Player').split(' ')[0]; } catch (e) { return 'Player'; } }
  // the account children belong to: a Google uid, 'guest', or null (Google, uid not known yet)
  function acct() { return isGoogle() ? (uid() || null) : 'guest'; }
  function acctOf(p) { return p.acct || 'guest'; }
  function all() { return get(LIST, []); }
  function hidden() { return get('kq_profiles_hidden', []); }
  function list() { var a = acct(); return all().filter(function (p) { return a === null || acctOf(p) === a; }); }
  function activeId() { return raw(ACTIVE); }
  function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4); }
  function snapshot() {
    var data = {}, keys = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && ownKey(k)) keys.push(k); }
    keys.forEach(function (k) { data[k] = localStorage.getItem(k); });
    return { data: data, keys: keys };
  }
  function clearOwn() { snapshot().keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} }); }
  function loadData(id) { var d = get(DATA + id, null); if (!d) return false; clearOwn(); Object.keys(d).forEach(function (k) { try { localStorage.setItem(k, d[k]); } catch (e) {} }); try { localStorage.removeItem(DATA + id); } catch (e) {} return true; }
  function ensure() {
    var A = acct(), every = all(), cur = every.filter(function (p) { return p.id === activeId(); })[0];
    if (A !== null) {
      if (cur && acctOf(cur) !== A) {
        // signed in or out: keep a copy for the other account's child, switch to this account's children
        set(DATA + cur.id, snapshot().data);
        var mine = every.filter(function (p) { return acctOf(p) === A; });
        if (mine.length) { loadData(mine[0].id); try { localStorage.setItem(ACTIVE, mine[0].id); } catch (e) {} }
      }
      if (!every.some(function (p) { return acctOf(p) === A; })) {
        var id = newId();
        every.push({ id: id, acct: A, sfx: '', name: (A === 'guest' ? (raw('kq_nick') || 'Player') : (raw('kq_nick') || gName())).split(' ')[0], av: AVATARS[0], cls: raw('kq_last_class') });
        set(LIST, every); try { localStorage.setItem(ACTIVE, id); } catch (e) {}
      }
    }
    var ps = list();
    if (ps.length && (!activeId() || !ps.some(function (p) { return p.id === activeId(); }))) { try { localStorage.setItem(ACTIVE, ps[0].id); } catch (e) {} }
    // keep the active card's name / class up to date
    var a = activeId(), nick = raw('kq_nick'), cls = raw('kq_last_class'), ev = all(), changed = false;
    ev.forEach(function (p) { if (p.id === a) { if (nick && p.name !== nick.split(' ')[0]) { p.name = nick.split(' ')[0]; p.t = Date.now(); changed = true; } if (cls != null && p.cls !== cls) { p.cls = cls; changed = true; } if (changed && acctOf(p) !== 'guest') cloudPut(p); } });
    if (changed) set(LIST, ev);
    return list();
  }
  function active() { var ps = ensure(), a = activeId(); return ps.filter(function (p) { return p.id === a; })[0] || null; }

  /* ---- Google: children list in Firebase (users/<uid>/kids/<sfx or "main">) ---- */
  function db() { try { return (window.firebase && firebase.database) ? firebase.database() : null; } catch (e) { return null; } }
  function cloudPut(p) {
    var u = acctOf(p); if (u === 'guest' || !window.KQ || !KQ.ready) return Promise.resolve();
    // t = when this phone last changed the child; a newer local change is never undone by an older cloud copy
    return KQ.ready.then(function () { var d = db(); if (d) return d.ref('users/' + u + '/kids/' + (p.sfx || 'main')).set({ n: p.name || 'Player', av: p.av || AVATARS[0], cls: p.cls == null ? '' : String(p.cls), t: p.t || 0, h: !!p.h }); }).catch(function () {});
  }
  function cloudSync(after) {
    var A = acct(); if (!A || A === 'guest' || !window.KQ || !KQ.ready) { if (after) after(); return; }
    KQ.ready.then(function () {
      var d = db(); if (!d) { if (after) after(); return; }
      d.ref('users/' + A + '/kids').once('value').then(function (snap) {
        var kids = snap.val() || {}, ev = all(), hid = hidden(), added = false;
        Object.keys(kids).forEach(function (k) {
          var sfx = k === 'main' ? '' : k, kd = kids[k] || {};
          var have = ev.filter(function (p) { return acctOf(p) === A && (p.sfx || '') === sfx; })[0];
          if (kd.h) {   // removed (on this or another phone); scores stay in Firebase
            if (have && have.id !== activeId()) { ev = ev.filter(function (p) { return p !== have; }); try { localStorage.removeItem(DATA + have.id); } catch (e) {} added = true; }
            return;
          }
          if (have) {
            var ct = +kd.t || 0, lt = +have.t || 0;
            if (ct > lt) {   // changed on another phone after this one
              if (kd.n && kd.n !== have.name) {
                have.name = kd.n; added = true;
                if (have.id === activeId()) { try { localStorage.setItem('kq_nick', kd.n); } catch (e) {} } else patchData(have.id, { kq_nick: kd.n });
              }
              if (kd.av && kd.av !== have.av) { have.av = kd.av; added = true; }
              if (have.id !== activeId() && kd.cls != null && kd.cls !== '') have.cls = kd.cls;
              have.t = ct;
            } else if (lt > ct || kd.n !== have.name || (kd.av && kd.av !== have.av)) cloudPut(have);   // this phone is newer: save it
            return;
          }
          if (hid.indexOf(A + ':' + sfx) >= 0) return;
          ev.push({ id: newId(), acct: A, sfx: sfx, name: kd.n || 'Player', av: kd.av || AVATARS[1], cls: kd.cls, t: +kd.t || 0 }); added = true;
        });
        set(LIST, ev);
        // make sure this phone's children are in the list too
        ev.filter(function (p) { return acctOf(p) === A && !kids[p.sfx || 'main']; }).forEach(cloudPut);
        if (after) after(added);
      }).catch(function () { if (after) after(); });
    });
  }

  function done() {
    try { sessionStorage.setItem('kq_who_asked', '1'); } catch (e) {}
    if (!isGoogle()) { try { localStorage.setItem('kq_guest_session', '1'); } catch (e) {} }
    location.reload();
  }
  function saveCurrentAndClear() {
    var s = snapshot(), a = activeId();
    if (a && !set(DATA + a, s.data)) return false;
    s.keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    return true;
  }
  function switchTo(id) {
    if (id === activeId()) { close(); try { sessionStorage.setItem('kq_who_asked', '1'); } catch (e) {} return; }
    var p = all().filter(function (q) { return q.id === id; })[0]; if (!p) return;
    if (!saveCurrentAndClear()) { alert('Not enough space on this phone to switch.'); return; }
    var had = loadData(id);
    // the list holds the latest name (it may have been changed while this child was saved away)
    try { if (p.name) localStorage.setItem('kq_nick', p.name); if (!had && p.cls != null && p.cls !== '') localStorage.setItem('kq_last_class', String(p.cls)); } catch (e) {}
    try { localStorage.setItem(ACTIVE, id); } catch (e) {}
    done();
  }
  function add(name, av, cls) {
    var A = acct() || 'guest';
    if (list().length >= MAX) return;
    ensure();
    if (!saveCurrentAndClear()) { alert('Not enough space on this phone to add a child.'); return; }
    var p = { id: newId(), acct: A, name: name, av: av, cls: String(cls) };
    if (A !== 'guest') { p.sfx = 'c' + Math.random().toString(36).slice(2, 7); cloudPut(p); }
    set(LIST, all().concat([p]));
    try { localStorage.setItem(ACTIVE, p.id); localStorage.setItem('kq_nick', name); localStorage.setItem('kq_last_class', String(cls)); } catch (e) {}
    setTimeout(done, A !== 'guest' ? 700 : 0);   // give the cloud write a moment
  }
  // change values inside a saved-away child's data
  function patchData(id, kv) { var d = get(DATA + id, null); if (!d) return; Object.keys(kv).forEach(function (k) { d[k] = kv[k]; }); set(DATA + id, d); }
  /** Rename a child (and change picture / class). Scores stay: the player id does not change. */
  function rename(id, name, av, cls) {
    var ev = all(), p = ev.filter(function (q) { return q.id === id; })[0]; if (!p) return;
    p.name = name; if (av) p.av = av; if (cls != null) p.cls = String(cls); p.t = Date.now();
    set(LIST, ev);
    if (id === activeId()) { try { localStorage.setItem('kq_nick', name); if (cls != null) localStorage.setItem('kq_last_class', String(cls)); } catch (e) {} }
    else { var kv = { kq_nick: name }; if (cls != null) kv.kq_last_class = String(cls); patchData(id, kv); }
    return acctOf(p) !== 'guest' ? cloudPut(p) : Promise.resolve();
  }
  function remove(id) {
    if (id === activeId()) return;
    var p = all().filter(function (q) { return q.id === id; })[0];
    if (p && acctOf(p) !== 'guest') {
      set('kq_profiles_hidden', hidden().concat([acctOf(p) + ':' + (p.sfx || '')]));
      p.h = true; p.t = Date.now(); cloudPut(p);   // every phone with this account removes it too
    }
    set(LIST, all().filter(function (q) { return q.id !== id; }));
    try { localStorage.removeItem(DATA + id); } catch (e) {}
  }

  /* ---------- UI ---------- */
  function css() {
    if (document.getElementById('kqprof-css')) return;
    var st = document.createElement('style'); st.id = 'kqprof-css';
    st.textContent =
      '.kqpf{position:fixed;inset:0;z-index:2147483600;background:rgba(30,16,70,.72);display:flex;align-items:center;justify-content:center;padding:16px;font-family:"Baloo 2",system-ui,sans-serif}' +
      '.kqpf-c{background:linear-gradient(180deg,#fff,#f5f3ff);border-radius:28px;width:100%;max-width:440px;max-height:92vh;overflow:auto;padding:18px 16px 16px;text-align:center;color:#1e1b4b;box-shadow:0 24px 60px rgba(0,0,0,.35);position:relative}' +
      '.kqpf h2{margin:2px 0 2px;font-size:24px}.kqpf p{margin:0 0 12px;color:#6b7280;font-weight:700;font-size:14px}' +
      '.kqpf-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px}' +
      '.kqpf-p{position:relative;border:none;background:#fff;border-radius:22px;padding:10px 6px;cursor:pointer;box-shadow:0 5px 0 #ddd6fe;font-family:inherit;color:#1e1b4b;display:flex;flex-direction:column;align-items:center;gap:2px}' +
      '.kqpf-p.on{outline:3px solid #f59e0b}.kqpf-p:active{transform:translateY(3px);box-shadow:0 2px 0 #ddd6fe}' +
      '.kqpf-p b{font-size:16px;line-height:1.1;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kqpf-p small{font-size:12px;color:#6b7280;font-weight:700}' +
      '.kqpf-p .av{width:64px;height:64px;border-radius:50%;background:#ede9fe;display:grid;place-items:center}' +
      '.kqpf-p .x{position:absolute;top:-6px;right:-6px;width:28px;height:28px;border-radius:50%;background:#ef4444;color:#fff;border:none;font-weight:900;cursor:pointer;display:none}' +
      '.kqpf.manage .kqpf-p .x{display:block}.kqpf.manage .kqpf-p.on .x{display:none}' +
      '.kqpf-add{border:3px dashed #c4b5fd;background:#faf5ff;box-shadow:none}' +
      '.kqpf-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:6px 0}' +
      '.kqpf-row button{border:3px solid transparent;background:#fff;border-radius:16px;padding:4px;cursor:pointer;box-shadow:0 3px 0 #ddd6fe}.kqpf-row button.on{border-color:#7c3aed}' +
      '.kqpf-cls button{padding:6px 12px;font:800 14px "Baloo 2",sans-serif;color:#1e1b4b}' +
      '.kqpf input{width:100%;box-sizing:border-box;border:2px solid #ddd6fe;border-radius:14px;padding:11px 12px;font:800 17px "Baloo 2",sans-serif;text-align:center;color:#1e1b4b;outline:none;margin-top:4px}' +
      '.kqpf-go{width:100%;border:none;border-radius:16px;padding:12px;font:800 18px "Baloo 2",sans-serif;color:#fff;background:linear-gradient(135deg,#7c3aed,#4f46e5);box-shadow:0 4px 0 #3730a3;cursor:pointer;margin-top:10px}' +
      '.kqpf-lnk{display:inline-block;margin-top:12px;border:none;background:none;color:#6d28d9;font:800 14px "Baloo 2",sans-serif;cursor:pointer;text-decoration:underline}' +
      '.kqpf-err{color:#dc2626;font-weight:800;font-size:12px;min-height:16px}' +
      '.kqpf-close{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:50%;border:none;background:#ede9fe;color:#4c1d95;font-size:20px;font-weight:900;cursor:pointer}';
    document.head.appendChild(st);
  }
  var box = null;
  function close() { if (box) { box.remove(); box = null; } }
  function shell(inner, canClose) {
    css(); close();
    box = document.createElement('div'); box.className = 'kqpf';
    box.innerHTML = '<div class="kqpf-c">' + (canClose ? '<button class="kqpf-close" aria-label="Close">×</button>' : '') + inner + '</div>';
    document.body.appendChild(box);
    var x = box.querySelector('.kqpf-close'); if (x) x.onclick = function () { close(); try { sessionStorage.setItem('kq_who_asked', '1'); } catch (e) {} };
    return box;
  }
  function open(opts) {
    opts = opts || {};
    if (acct() === null) {   // Google, account id not known yet (first open after the update)
      var b0 = shell('<div style="font-size:40px">⏳</div><h2>One moment…</h2><p>Getting your account ready. Please try again in a few seconds.</p>', true); return;
    }
    var ps = ensure(), a = activeId(), g = isGoogle();
    var b = shell('<div style="font-size:40px">👋</div><h2>Who is playing?</h2><p>Each child has their own stars, coins and leaderboard name' + (g ? ' — on every phone with this Google account' : '') + '</p><div class="kqpf-g">' +
      ps.map(function (p) {
        return '<button type="button" class="kqpf-p' + (p.id === a ? ' on' : '') + '" data-id="' + esc(p.id) + '"><span class="x" data-x="' + esc(p.id) + '" aria-label="Remove">×</span><span class="av">' + emo(p.av || '🦁', 44) + '</span><b>' + esc(p.name || 'Player') + '</b><small>' + esc(clsLbl(p.cls)) + '</small></button>';
      }).join('') +
      (ps.length < MAX ? '<button type="button" class="kqpf-p kqpf-add" id="kqpfAdd"><span class="av" style="background:#fff">' + emo('➕', 36) + '</span><b>Add a child</b><small>New profile</small></button>' : '') +
      '</div><button class="kqpf-lnk" id="kqpfManage">✏️ Grown-ups: change a name' + (ps.length > 1 ? ' or remove' : '') + '</button>', !opts.first);
    b.querySelectorAll('[data-id]').forEach(function (el) {
      el.onclick = function (e) {
        var xid = e.target && e.target.getAttribute && e.target.getAttribute('data-x');
        if (xid && b.classList.contains('manage')) {
          var p = ps.filter(function (q) { return q.id === xid; })[0];
          if (p && confirm('Remove ' + p.name + ' from this phone? Their scores stay saved.')) { remove(xid); open(opts); }
          return;
        }
        if (b.classList.contains('manage')) { childForm(opts, ps.filter(function (q) { return q.id === el.getAttribute('data-id'); })[0]); return; }
        switchTo(el.getAttribute('data-id'));
      };
    });
    var ad = b.querySelector('#kqpfAdd'); if (ad) ad.onclick = function () { childForm(opts); };
    var mg = b.querySelector('#kqpfManage'); if (mg) mg.onclick = function () {
      var go = function () { b.classList.add('manage'); mg.textContent = ps.length > 1 ? 'Tap a child to change the name · × to remove' : 'Tap the child to change the name'; };
      if (typeof window.kqParentGate === 'function') window.kqParentGate(go); else go();
    };
    // Google: bring in brothers/sisters added on another phone
    if (g && !opts.synced) cloudSync(function (added) { if (added && box) open(Object.assign({}, opts, { synced: true })); });
  }
  // add a child, or (with p) change a child's name, picture and class
  function childForm(opts, p) {
    var av = p ? (p.av || AVATARS[0]) : AVATARS[(list().length) % AVATARS.length], cls = p ? (parseInt(p.cls, 10) || 0) : 0;
    var b = shell('<div style="font-size:40px">' + (p ? '✏️' : '🧒') + '</div><h2>' + (opts.ask ? 'What is the child’s name?' : p ? 'Change name' : 'Add a child') + '</h2><p>' + (opts.ask ? 'This Google account shows “' + esc(p.name) + '”. Type the name of the child who plays' : p ? 'Scores, stars and coins stay the same' : 'Just a first name or a nickname') + '</p>' +
      '<input id="kqpfName" maxlength="12" placeholder="Name" autocomplete="off" value="' + esc(p ? p.name || '' : '') + '">' + '<div class="kqpf-err" id="kqpfErr"></div>' +
      '<p style="margin:4px 0 0">Pick a picture</p><div class="kqpf-row" id="kqpfAv">' + AVATARS.map(function (e) { return '<button type="button" data-av="' + e + '"' + (e === av ? ' class="on"' : '') + '>' + emo(e, 34) + '</button>'; }).join('') + '</div>' +
      '<p style="margin:4px 0 0">Class</p><div class="kqpf-row kqpf-cls" id="kqpfCls">' + [0, -1, 1, 2, 3, 4, 5].map(function (c) { return '<button type="button" data-c="' + c + '"' + (c === cls ? ' class="on"' : '') + '>' + clsLbl(c) + '</button>'; }).join('') + '</div>' +
      '<button class="kqpf-go" id="kqpfSave">' + (p ? 'Save ✅' : 'Let’s play! 🚀') + '</button><button class="kqpf-lnk" id="kqpfBack">‹ Back</button>', true);
    b.querySelectorAll('[data-av]').forEach(function (x) { x.onclick = function () { av = x.getAttribute('data-av'); b.querySelectorAll('[data-av]').forEach(function (y) { y.classList.toggle('on', y === x); }); }; });
    b.querySelectorAll('[data-c]').forEach(function (x) { x.onclick = function () { cls = +x.getAttribute('data-c'); b.querySelectorAll('[data-c]').forEach(function (y) { y.classList.toggle('on', y === x); }); }; });
    b.querySelector('#kqpfBack').onclick = function () { open(opts); };
    b.querySelector('#kqpfSave').onclick = function () {
      var v = String(b.querySelector('#kqpfName').value || '').replace(/\s+/g, ' ').trim(), err = b.querySelector('#kqpfErr');
      if (v.length < 2) { err.textContent = 'Please type at least 2 letters'; return; }
      if (/[0-9@\s]/.test(v) || /[^\p{L}\p{M}'-]/u.test(v)) { err.textContent = 'Only a first name or nickname, letters only'; return; }
      if (p) {
        var sv = b.querySelector('#kqpfSave'); sv.disabled = true; sv.textContent = 'Saving…';
        var next = function () { if (next.done) return; next.done = true; if (opts.reload || p.id === activeId()) { close(); location.reload(); } else open(opts); };
        rename(p.id, v.slice(0, 12), av, cls).then(next, next); setTimeout(next, 2500);   // wait for the cloud save (not forever)
        return;
      }
      add(v.slice(0, 12), av, cls);
    };
    setTimeout(function () { try { b.querySelector('#kqpfName').focus(); } catch (e) {} }, 60);
  }
  /** Ask "Who is playing?" once per app session when there is more than one child. */
  function askOnStart() {
    if (acct() === null) return;
    var asked = false; try { asked = sessionStorage.getItem('kq_who_asked') === '1'; } catch (e) {}
    var go = function () { if (!asked && ensure().length > 1) open({ first: true, synced: true }); };
    if (isGoogle()) cloudSync(go); else go();
  }

  /** Open the change-name form for a child (default: the one playing now). */
  function edit(id, ask) { var ps = ensure(), a = id || activeId(), p = ps.filter(function (q) { return q.id === a; })[0]; if (p) childForm({ reload: true, ask: !!ask }, p); else open(); }
  /** Google: the first child is named after the account owner. Ask once for the child's real name. */
  function askChildName() {
    if (!isGoogle() || acct() === null || get('kq_child_named', false)) return false;
    var p = active(); if (!p || p.sfx || String(p.name || '').toLowerCase() !== gName().toLowerCase()) return false;
    set('kq_child_named', true); edit(p.id, true); return true;
  }
  window.KQProfiles = { list: list, active: active, ensure: ensure, switchTo: switchTo, open: open, edit: edit, rename: rename, askChildName: askChildName, askOnStart: askOnStart, isGoogle: isGoogle, sync: cloudSync };
})();

/* ============================================================
   CHILD PROFILES — brothers and sisters share one phone.
   Each child's progress lives in this device's localStorage (name, class,
   stars, coins, best scores, guest leaderboard id …). Switching saves the
   current child's keys into kq_profile_data_<id> and restores the other
   child's, then reloads. Device settings (sound, ads, sign-in) are shared.
   Profiles are for guest play; a Google account is one person.
   ============================================================ */
(function () {
  'use strict';
  if (window.KQProfiles) return;
  var LIST = 'kq_profiles', ACTIVE = 'kq_profile_active', DATA = 'kq_profile_data_';
  var MAX = 6;
  var AVATARS = ['🦁', '🐼', '🦄', '🐯', '🐰', '🦊', '🐸', '🐵', '🐨', '🐙'];
  // kept for the whole device (never swapped)
  var DEVICE = /^(kq_muted|kq_adCounter|kq_lastAdTime|kq_guest_session|kq_cached_auth|kq_dev.*|kq_app_config|kq_manifest_.*|kq_rating.*|kq_review_.*|kq_session|kq_profiles|kq_profile_active|kq_profile_data_.*|kq_story_autoplay|kq_lb_range|kq_lb_guests)$/;
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

  function list() { return get(LIST, []); }
  function activeId() { return raw(ACTIVE); }
  function ensure() {
    var ps = list();
    if (!ps.length) {
      var id = 'p' + Date.now().toString(36);
      ps = [{ id: id, name: (raw('kq_nick') || 'Player').split(' ')[0], av: AVATARS[0], cls: raw('kq_last_class') }];
      set(LIST, ps); try { localStorage.setItem(ACTIVE, id); } catch (e) {}
    } else if (!activeId() || !ps.some(function (p) { return p.id === activeId(); })) {
      try { localStorage.setItem(ACTIVE, ps[0].id); } catch (e) {}
    }
    // keep the active card's name / class up to date
    var a = activeId(), nick = raw('kq_nick'), cls = raw('kq_last_class'), changed = false;
    ps.forEach(function (p) { if (p.id === a) { if (nick && p.name !== nick.split(' ')[0]) { p.name = nick.split(' ')[0]; changed = true; } if (cls != null && p.cls !== cls) { p.cls = cls; changed = true; } } });
    if (changed) set(LIST, ps);
    return ps;
  }
  function active() { var a = activeId(); return ensure().filter(function (p) { return p.id === a; })[0] || null; }

  function snapshot() {
    var data = {}, keys = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && ownKey(k)) keys.push(k); }
    keys.forEach(function (k) { data[k] = localStorage.getItem(k); });
    return { data: data, keys: keys };
  }
  function saveCurrentAndClear() {
    var s = snapshot(), a = activeId();
    if (a && !set(DATA + a, s.data)) return false;
    s.keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    return true;
  }
  function done() {
    try { sessionStorage.setItem('kq_who_asked', '1'); } catch (e) {}
    try { localStorage.setItem('kq_guest_session', '1'); } catch (e) {}
    location.reload();
  }
  function switchTo(id) {
    if (id === activeId()) { close(); try { sessionStorage.setItem('kq_who_asked', '1'); } catch (e) {} return; }
    if (!saveCurrentAndClear()) { alert('Not enough space on this phone to switch.'); return; }
    var d = get(DATA + id, {});
    Object.keys(d).forEach(function (k) { try { localStorage.setItem(k, d[k]); } catch (e) {} });
    try { localStorage.removeItem(DATA + id); localStorage.setItem(ACTIVE, id); } catch (e) {}
    done();
  }
  function add(name, av, cls) {
    var ps = ensure();
    if (ps.length >= MAX) return;
    if (!saveCurrentAndClear()) { alert('Not enough space on this phone to add a child.'); return; }
    var id = 'p' + Date.now().toString(36);
    ps.push({ id: id, name: name, av: av, cls: String(cls) });
    set(LIST, ps);
    try { localStorage.setItem(ACTIVE, id); localStorage.setItem('kq_nick', name); localStorage.setItem('kq_last_class', String(cls)); } catch (e) {}
    done();
  }
  function remove(id) {
    if (id === activeId()) return;
    set(LIST, ensure().filter(function (p) { return p.id !== id; }));
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
    if (isGoogle()) {
      var b0 = shell('<div style="font-size:46px">👪</div><h2>Switch account</h2><p>You are signed in with Google. To let a brother or sister play with their own progress, sign out and choose “Continue as Guest”. Then you can add a profile for each child.</p>' +
        '<button class="kqpf-go" id="kqpfOut">Sign out to switch</button>', true);
      b0.querySelector('#kqpfOut').onclick = function () { close(); if (typeof window.switchUser === 'function') window.switchUser(); };
      return;
    }
    var ps = ensure(), a = activeId();
    var b = shell('<div style="font-size:40px">👋</div><h2>Who is playing?</h2><p>Each child has their own stars, coins and progress</p><div class="kqpf-g">' +
      ps.map(function (p) {
        return '<button type="button" class="kqpf-p' + (p.id === a ? ' on' : '') + '" data-id="' + esc(p.id) + '"><span class="x" data-x="' + esc(p.id) + '" aria-label="Remove">×</span><span class="av">' + emo(p.av || '🦁', 44) + '</span><b>' + esc(p.name || 'Player') + '</b><small>' + esc(clsLbl(p.cls)) + '</small></button>';
      }).join('') +
      (ps.length < MAX ? '<button type="button" class="kqpf-p kqpf-add" id="kqpfAdd"><span class="av" style="background:#fff">' + emo('➕', 36) + '</span><b>Add a child</b><small>New profile</small></button>' : '') +
      '</div>' + (ps.length > 1 ? '<button class="kqpf-lnk" id="kqpfManage">Grown-ups: remove a profile</button>' : ''), !opts.first);
    b.querySelectorAll('[data-id]').forEach(function (el) {
      el.onclick = function (e) {
        var xid = e.target && e.target.getAttribute && e.target.getAttribute('data-x');
        if (xid && b.classList.contains('manage')) {
          var p = ps.filter(function (q) { return q.id === xid; })[0];
          if (p && confirm('Remove ' + p.name + '’s profile and progress from this phone?')) { remove(xid); open(opts); }
          return;
        }
        switchTo(el.getAttribute('data-id'));
      };
    });
    var ad = b.querySelector('#kqpfAdd'); if (ad) ad.onclick = function () { addForm(opts); };
    var mg = b.querySelector('#kqpfManage'); if (mg) mg.onclick = function () {
      var go = function () { b.classList.add('manage'); mg.textContent = 'Tap × to remove. Tap a child to play.'; };
      if (typeof window.kqParentGate === 'function') window.kqParentGate(go); else go();
    };
  }
  function addForm(opts) {
    var av = AVATARS[(list().length) % AVATARS.length], cls = 0;
    var b = shell('<div style="font-size:40px">🧒</div><h2>Add a child</h2><p>Just a first name or a nickname</p>' +
      '<input id="kqpfName" maxlength="12" placeholder="Name" autocomplete="off">' + '<div class="kqpf-err" id="kqpfErr"></div>' +
      '<p style="margin:4px 0 0">Pick a picture</p><div class="kqpf-row" id="kqpfAv">' + AVATARS.map(function (e) { return '<button type="button" data-av="' + e + '"' + (e === av ? ' class="on"' : '') + '>' + emo(e, 34) + '</button>'; }).join('') + '</div>' +
      '<p style="margin:4px 0 0">Class</p><div class="kqpf-row kqpf-cls" id="kqpfCls">' + [0, -1, 1, 2, 3, 4, 5].map(function (c) { return '<button type="button" data-c="' + c + '"' + (c === cls ? ' class="on"' : '') + '>' + clsLbl(c) + '</button>'; }).join('') + '</div>' +
      '<button class="kqpf-go" id="kqpfSave">Let’s play! 🚀</button><button class="kqpf-lnk" id="kqpfBack">‹ Back</button>', true);
    b.querySelectorAll('[data-av]').forEach(function (x) { x.onclick = function () { av = x.getAttribute('data-av'); b.querySelectorAll('[data-av]').forEach(function (y) { y.classList.toggle('on', y === x); }); }; });
    b.querySelectorAll('[data-c]').forEach(function (x) { x.onclick = function () { cls = +x.getAttribute('data-c'); b.querySelectorAll('[data-c]').forEach(function (y) { y.classList.toggle('on', y === x); }); }; });
    b.querySelector('#kqpfBack').onclick = function () { open(opts); };
    b.querySelector('#kqpfSave').onclick = function () {
      var v = String(b.querySelector('#kqpfName').value || '').replace(/\s+/g, ' ').trim(), err = b.querySelector('#kqpfErr');
      if (v.length < 2) { err.textContent = 'Please type at least 2 letters'; return; }
      if (/[0-9@\s]/.test(v) || /[^\p{L}\p{M}'-]/u.test(v)) { err.textContent = 'Only a first name or nickname, letters only'; return; }
      add(v.slice(0, 12), av, cls);
    };
    setTimeout(function () { try { b.querySelector('#kqpfName').focus(); } catch (e) {} }, 60);
  }
  /** Ask "Who is playing?" once per app session when there is more than one child. */
  function askOnStart() {
    if (isGoogle()) return;
    var asked = false; try { asked = sessionStorage.getItem('kq_who_asked') === '1'; } catch (e) {}
    if (!asked && ensure().length > 1) open({ first: true });
  }

  window.KQProfiles = { list: list, active: active, ensure: ensure, switchTo: switchTo, open: open, askOnStart: askOnStart, isGoogle: isGoogle };
})();

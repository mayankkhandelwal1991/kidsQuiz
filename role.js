/* ============================================================
   TEACHER OR STUDENT — which view this phone shows (phone-wide: kq_role).
   · After Google sign-in the app asks once: "Who is using Kids Quiz?" (kq_role_asked).
   · Teacher mode (behind the grown-up question): home becomes teacher.html
     (classes, tests, results). Quiz and story pages become a PREVIEW: nothing is
     scored (no leaderboard, no coins, no homework result) and a bar offers
     "Give to my class".
   · Student mode = the normal children's app. Switching back needs no question.
   KQRole: isTeacher, ask, needAsk, toTeacher, toStudent, toggleHtml, bindToggle
   ============================================================ */
(function () {
  'use strict';
  if (window.KQRole) return;
  var BASE = (function () { try { return document.currentScript.src.replace(/role\.js[^/]*$/, ''); } catch (e) { return ''; } })();
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function isTeacher() { return ls('kq_role') === 'teacher'; }
  function isGoogle() { try { var a = JSON.parse(ls('kq_cached_auth') || 'null'); return !!(a && a.name) && ls('kq_guest_session') !== '1'; } catch (e) { return false; } }
  function setRole(r) {
    set('kq_role', r); set('kq_role_asked', '1');
    try { if (window.KQPush) KQPush.sync(); } catch (e) {}
    try { if (window.KQEvents) KQEvents.log(r === 'teacher' ? 'teacher_mode_on' : 'student_mode_on'); } catch (e) {}
  }
  function gate(fn) { if (typeof kqParentGate === 'function') kqParentGate(fn); else fn(); }
  function toTeacher() { gate(function () { setRole('teacher'); location.href = BASE + 'teacher.html'; }); }
  function toStudent() { setRole('student'); location.href = BASE + 'quiz-home.html'; }

  var CSS = '.kqr-tg{display:flex;gap:4px;background:#ede9fe;border-radius:999px;padding:4px;width:max-content;max-width:100%;margin:10px auto 0}' +
    '.kqr-tg button{border:none;border-radius:999px;padding:7px 14px;font:800 14px "Baloo 2",system-ui,sans-serif;color:#5b21b6;background:transparent;cursor:pointer;white-space:nowrap}' +
    '.kqr-tg button.on{background:#7c3aed;color:#fff;box-shadow:0 2px 0 #5b21b6}' +
    '.kqr-ask{position:fixed;inset:0;z-index:100000;background:rgba(30,16,70,.8);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.kqr-ask .c{background:#fff;border-radius:26px;padding:20px 16px;max-width:420px;width:100%;text-align:center;font-family:"Baloo 2",system-ui,sans-serif;color:#1e1b4b}' +
    '.kqr-ask h2{margin:0 0 4px;font-size:23px}.kqr-ask p{margin:0 0 12px;color:#6b7280;font-weight:700}' +
    '.kqr-ask .o{display:flex;align-items:center;gap:12px;width:100%;border:3px solid #ede9fe;border-radius:20px;background:#faf5ff;padding:12px;margin-top:10px;cursor:pointer;text-align:left;font-family:inherit;color:#1e1b4b}' +
    '.kqr-ask .o img{width:52px;height:52px;flex:0 0 auto}.kqr-ask .o b{display:block;font-size:19px}.kqr-ask .o small{color:#6b7280;font-weight:700;font-size:14px}' +
    '.kqr-pv{position:fixed;left:50%;transform:translateX(-50%);bottom:max(10px,env(safe-area-inset-bottom));z-index:99990;display:flex;gap:6px;align-items:center;background:#1e1b4b;color:#fff;border-radius:999px;padding:6px 6px 6px 14px;font:800 14px "Baloo 2",system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:calc(100% - 20px);white-space:nowrap}' +
    '.kqr-pv button{border:none;border-radius:999px;padding:7px 12px;font:800 14px "Baloo 2",system-ui,sans-serif;cursor:pointer;background:#22c55e;color:#fff}.kqr-pv button.h{background:#4c1d95}';
  function css() { if (document.getElementById('kqrCss')) return; var s = document.createElement('style'); s.id = 'kqrCss'; s.textContent = CSS; document.head.appendChild(s); }

  /* the toggle shown on the home page (students) and the teacher page */
  function toggleHtml() {
    var t = isTeacher();
    return '<div class="kqr-tg" role="group" aria-label="Mode"><button type="button" data-kqr="student" class="' + (t ? '' : 'on') + '">🧒 Student mode</button><button type="button" data-kqr="teacher" class="' + (t ? 'on' : '') + '">🏫 Teacher mode</button></div>';
  }
  function bindToggle(root) {
    css();
    (root || document).querySelectorAll('[data-kqr]').forEach(function (b) {
      b.onclick = function () { var r = b.getAttribute('data-kqr'); if (r === 'teacher' && !isTeacher()) toTeacher(); else if (r === 'student' && isTeacher()) toStudent(); };
    });
  }

  /* asked once, after Google sign-in (guests are children) */
  function needAsk() { return isGoogle() && !ls('kq_role_asked') && !isTeacher(); }
  function ask() {
    return new Promise(function (res) {
      css();
      var w = document.createElement('div'); w.className = 'kqr-ask';
      w.innerHTML = '<div class="c"><h2>Who is using Kids Quiz?</h2><p>You can change this any time on the home screen.</p>' +
        '<button type="button" class="o" data-r="student"><img src="' + BASE + 'images/emoji/1f9d2.svg" alt=""><span><b>A child</b><small>Learn and play: quizzes, stories and games</small></span></button>' +
        '<button type="button" class="o" data-r="teacher"><img src="' + BASE + 'images/emoji/1f3eb.svg" alt=""><span><b>A teacher</b><small>Make a class, give tests, see who finished</small></span></button></div>';
      document.body.appendChild(w);
      w.querySelector('[data-r=student]').onclick = function () { setRole('student'); w.remove(); res('student'); };
      w.querySelector('[data-r=teacher]').onclick = function () { w.remove(); gate(function () { setRole('teacher'); location.href = BASE + 'teacher.html'; }); res('teacher'); };
    });
  }

  /* teacher previewing a quiz or a story */
  function previewItem() {
    var h = location.hash || '', p = location.pathname, m;
    if (/\/quiz\/play\.html$/.test(p) && (m = h.match(/^#\/c\/(-?\d+)\/([A-Za-z0-9_\-]+)/))) return { type: 'quiz', lv: m[1], ref: m[2] };
    if (/\/stories\/(index\.html)?$/.test(p) && (m = h.match(/^#\/s\/([A-Za-z0-9_\-]+)/))) return { type: 'story', lv: '', ref: m[1] };
    return null;
  }
  function previewBar() {
    if (!isTeacher() || !/\/(quiz\/play\.html|stories\/(index\.html)?)$/.test(location.pathname)) return;
    css();
    var b = document.createElement('div'); b.className = 'kqr-pv'; b.id = 'kqrPv';
    b.innerHTML = '<span>👀 Teacher preview</span><button type="button" data-x="give">➕ Give to class</button><button type="button" class="h" data-x="home" aria-label="Teacher home">🏫</button>';
    document.body.appendChild(b);
    var upd = function () { b.querySelector('[data-x=give]').style.display = previewItem() ? '' : 'none'; };
    upd(); window.addEventListener('hashchange', upd);
    b.querySelector('[data-x=home]').onclick = function () { location.href = BASE + 'teacher.html'; };
    b.querySelector('[data-x=give]').onclick = function () { var it = previewItem(); if (it) location.href = BASE + 'teacher.html#give/' + it.type + '/' + it.lv + '/' + it.ref; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', previewBar); else previewBar();

  window.KQRole = { isTeacher: isTeacher, isGoogle: isGoogle, ask: ask, needAsk: needAsk, toTeacher: toTeacher, toStudent: toStudent, toggleHtml: toggleHtml, bindToggle: bindToggle, set: setRole };
})();

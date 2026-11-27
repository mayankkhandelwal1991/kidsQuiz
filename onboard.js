/* ============================================================
   GETTING TO KNOW YOU — 3 friendly questions before the first play, so home
   can be built around the child:
     1. What would you like to learn?   (pick any)
     2. Which class are you in?
     3. Play and learn with friends?
   Saved per child in kq_prefs = { likes: [...], cls, friends, at } (kq_last_class
   too). Each brother/sister answers for themselves (profiles.js swaps it).
   KQOnboard.ask()        -> Promise; asks once when this child has no answers
   KQOnboard.open()       -> change the answers (Today card "✏️ Change")
   KQOnboard.prefs()      -> the answers or null
   KQOnboard.LIKES        -> the interest list (ids used by quiz-home.html)
   ============================================================ */
(function () {
  'use strict';
  if (window.KQOnboard) return;
  var KEY = 'kq_prefs';
  var LIKES = [
    { id: 'abc', ic: '1f524', t: 'ABC & Phonics' },
    { id: 'maths', ic: '1f522', t: 'Numbers & Maths' },
    { id: 'stories', ic: '1f4d6', t: 'Stories & Rhymes' },
    { id: 'science', ic: '1f52c', t: 'Science & Nature' },
    { id: 'english', ic: '1f4da', t: 'English & Words' },
    { id: 'hindi', ic: '1f1ee-1f1f3', t: 'Hindi' },
    { id: 'art', ic: '1f3a8', t: 'Drawing & Music' },
    { id: 'brain', ic: '1f9e9', t: 'Puzzles & Brain games' }
  ];
  var CLASSES = [[0, 'LKG'], [-1, 'UKG'], [1, 'Class 1'], [2, 'Class 2'], [3, 'Class 3'], [4, 'Class 4'], [5, 'Class 5']];
  function get() { try { var v = JSON.parse(localStorage.getItem(KEY)); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  function say(t) { try { if (typeof speak === 'function') speak(t, { raw: true, rate: 0.92, pitch: 1.2 }); } catch (e) {} }
  function name() { try { var n = (localStorage.getItem('kq_nick') || '').trim().split(/\s+/)[0]; return n && n !== 'Guest' ? n : ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function css() {
    if (document.getElementById('kqob-css')) return;
    var st = document.createElement('style'); st.id = 'kqob-css';
    st.textContent =
      '.kqob{position:fixed;inset:0;z-index:2147483500;background:rgba(30,16,70,.78);display:flex;align-items:center;justify-content:center;padding:14px;font-family:"Baloo 2",system-ui,sans-serif}' +
      '.kqob-c{background:linear-gradient(180deg,#fff,#f5f3ff);border-radius:28px;width:100%;max-width:460px;max-height:94vh;overflow:auto;padding:16px 14px 14px;text-align:center;color:#1e1b4b;box-shadow:0 24px 60px rgba(0,0,0,.35);position:relative;animation:kqobIn .4s cubic-bezier(.34,1.56,.64,1)}' +
      '@keyframes kqobIn{from{transform:scale(.85);opacity:0}}' +
      '.kqob-dots{display:flex;gap:6px;justify-content:center;margin-bottom:6px}.kqob-dots i{width:26px;height:8px;border-radius:4px;background:#e9d5ff}.kqob-dots i.on{background:#7c3aed}' +
      '.kqob-owl{width:64px;height:64px;animation:kqobBob 2.4s ease-in-out infinite}@keyframes kqobBob{50%{transform:translateY(-5px) rotate(-3deg)}}' +
      '.kqob h2{margin:2px 0 2px;font-size:23px;line-height:1.15}.kqob p{margin:0 0 10px;color:#6b7280;font-weight:700;font-size:14px}' +
      '.kqob-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}' +
      '.kqob-o{border:3px solid transparent;background:#fff;border-radius:18px;padding:8px 6px;display:flex;align-items:center;gap:8px;font:800 15px "Baloo 2",sans-serif;color:#1e1b4b;cursor:pointer;box-shadow:0 4px 0 #ddd6fe;text-align:left;line-height:1.1;min-height:58px;position:relative}' +
      '.kqob-o img{width:36px;height:36px;flex:0 0 auto}.kqob-o.on{border-color:#7c3aed;background:#f5f3ff}' +
      '.kqob-o.on::after{content:"✓";position:absolute;top:-8px;right:-6px;width:24px;height:24px;border-radius:50%;background:#7c3aed;color:#fff;font-size:14px;display:grid;place-items:center}' +
      '.kqob-cls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.kqob-cls .kqob-o{justify-content:center;font-size:18px;min-height:56px}' +
      '.kqob-yn{display:grid;grid-template-columns:1fr 1fr;gap:10px}.kqob-yn .kqob-o{flex-direction:column;justify-content:center;font-size:17px;min-height:120px;text-align:center}.kqob-yn .kqob-o img{width:56px;height:56px}' +
      '.kqob-go{width:100%;border:none;border-radius:18px;padding:12px;font:800 19px "Baloo 2",sans-serif;color:#fff;background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 5px 0 #15803d;cursor:pointer;margin-top:12px}' +
      '.kqob-go:disabled{opacity:.45}' +
      '.kqob-row{display:flex;justify-content:space-between;align-items:center;margin-top:8px}' +
      '.kqob-l{border:none;background:none;color:#6d28d9;font:800 14px "Baloo 2",sans-serif;cursor:pointer;padding:6px}' +
      '.kqob-hint{font-size:12.5px;color:#7c3aed;font-weight:800;min-height:16px;margin-top:4px}';
    document.head.appendChild(st);
  }
  var OWL = '<svg class="kqob-owl" viewBox="0 0 120 120" aria-hidden="true"><path d="M30 30 L40 12 L50 30Z" fill="#7c3aed"/><path d="M70 30 L80 12 L90 30Z" fill="#7c3aed"/><ellipse cx="60" cy="70" rx="42" ry="44" fill="#8b5cf6"/><ellipse cx="60" cy="82" rx="26" ry="28" fill="#ede9fe"/><circle cx="44" cy="50" r="17" fill="#fff"/><circle cx="76" cy="50" r="17" fill="#fff"/><circle cx="46" cy="51" r="8" fill="#1e1b4b"/><circle cx="74" cy="51" r="8" fill="#1e1b4b"/><circle cx="49" cy="48" r="3" fill="#fff"/><circle cx="77" cy="48" r="3" fill="#fff"/><path d="M54 62 L66 62 L60 72Z" fill="#f59e0b"/><path d="M38 24 Q60 0 82 24Z" fill="#facc15"/><circle cx="60" cy="8" r="5" fill="#f43f5e"/></svg>';
  function img(ic) { return '<img src="images/emoji/' + ic + '.svg" alt="">'; }

  var box = null;
  function close() { if (box) { box.remove(); box = null; } }
  /* the three questions; resolves with the saved answers */
  function open(opts) {
    opts = opts || {};
    css(); close();
    var old = get() || {};
    var ans = { likes: (old.likes || []).slice(), cls: old.cls != null ? old.cls : (function () { var l = parseInt(localStorage.getItem('kq_last_class'), 10); return isNaN(l) ? null : l; })(), friends: old.friends != null ? old.friends : null };
    var step = 0, nm = name();
    return new Promise(function (resolve) {
      box = document.createElement('div'); box.className = 'kqob'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Getting to know you');
      document.body.appendChild(box);
      function finish(skipped) {
        var v = { likes: ans.likes, cls: ans.cls, friends: ans.friends, at: Date.now() };
        if (skipped) v.skipped = true;
        save(v);
        if (ans.cls != null) { try { localStorage.setItem('kq_last_class', String(ans.cls)); } catch (e) {} }
        close(); resolve(v);
      }
      function draw() {
        var dots = '<div class="kqob-dots">' + [0, 1, 2].map(function (i) { return '<i class="' + (i <= step ? 'on' : '') + '"></i>'; }).join('') + '</div>';
        var h = '', q = '';
        if (step === 0) {
          q = (nm ? 'Hi ' + nm + '! ' : 'Hi! ') + 'What would you like to learn?';
          h = '<h2>' + esc(q) + '</h2><p>Pick as many as you like</p><div class="kqob-g">' + LIKES.map(function (x) {
            return '<button type="button" class="kqob-o' + (ans.likes.indexOf(x.id) >= 0 ? ' on' : '') + '" data-like="' + x.id + '">' + img(x.ic) + '<span>' + esc(x.t) + '</span></button>';
          }).join('') + '</div><div class="kqob-hint" id="kqobHint"></div><button class="kqob-go" id="kqobNext"' + (ans.likes.length ? '' : ' disabled') + '>Next ›</button>';
        } else if (step === 1) {
          q = 'Which class are you in?';
          h = '<h2>' + q + '</h2><p>I will pick the right questions for you</p><div class="kqob-cls">' + CLASSES.map(function (c) {
            return '<button type="button" class="kqob-o' + (ans.cls === c[0] ? ' on' : '') + '" data-cls="' + c[0] + '">' + c[1] + '</button>';
          }).join('') + '</div><button class="kqob-go" id="kqobNext"' + (ans.cls == null ? ' disabled' : '') + '>Next ›</button>';
        } else {
          q = 'Would you like to play and learn with your friends?';
          h = '<h2>' + q + '</h2><p>Quiz battles and games with friends</p><div class="kqob-yn">' +
            '<button type="button" class="kqob-o' + (ans.friends === true ? ' on' : '') + '" data-fr="1">' + img('1f465') + 'Yes, with friends!</button>' +
            '<button type="button" class="kqob-o' + (ans.friends === false ? ' on' : '') + '" data-fr="0">' + img('1f9d2') + 'Just me for now</button></div>' +
            '<button class="kqob-go" id="kqobNext"' + (ans.friends == null ? ' disabled' : '') + '>Let’s play! 🚀</button>';
        }
        box.innerHTML = '<div class="kqob-c">' + dots + OWL + h + '<div class="kqob-row">' +
          (step ? '<button class="kqob-l" id="kqobBack">‹ Back</button>' : '<span></span>') +
          (opts.edit ? '<button class="kqob-l" id="kqobX">Close</button>' : '<button class="kqob-l" id="kqobSkip">Skip</button>') + '</div></div>';
        say(q);
        box.querySelectorAll('[data-like]').forEach(function (b) {
          b.onclick = function () {
            var id = b.getAttribute('data-like'), i = ans.likes.indexOf(id);
            if (i >= 0) ans.likes.splice(i, 1); else ans.likes.push(id);
            b.classList.toggle('on', i < 0);
            box.querySelector('#kqobNext').disabled = !ans.likes.length;
            var hint = box.querySelector('#kqobHint'); if (hint) hint.textContent = ans.likes.length ? ans.likes.length + ' picked' : '';
          };
        });
        box.querySelectorAll('[data-cls]').forEach(function (b) {
          b.onclick = function () { ans.cls = +b.getAttribute('data-cls'); box.querySelectorAll('[data-cls]').forEach(function (x) { x.classList.toggle('on', x === b); }); box.querySelector('#kqobNext').disabled = false; };
        });
        box.querySelectorAll('[data-fr]').forEach(function (b) {
          b.onclick = function () { ans.friends = b.getAttribute('data-fr') === '1'; box.querySelectorAll('[data-fr]').forEach(function (x) { x.classList.toggle('on', x === b); }); box.querySelector('#kqobNext').disabled = false; };
        });
        box.querySelector('#kqobNext').onclick = function () { if (step < 2) { step++; draw(); } else finish(false); };
        var bk = box.querySelector('#kqobBack'); if (bk) bk.onclick = function () { step--; draw(); };
        var sk = box.querySelector('#kqobSkip'); if (sk) sk.onclick = function () { finish(true); };
        var x = box.querySelector('#kqobX'); if (x) x.onclick = function () { close(); resolve(get()); };
      }
      draw();
    });
  }
  /** Ask once, when this child has not answered yet. */
  function ask() { return get() ? Promise.resolve(get()) : open(); }

  window.KQOnboard = { ask: ask, open: function () { return open({ edit: true }); }, prefs: get, LIKES: LIKES };
})();

/* ============================================================
   PARENT GATE — kqParentGate(onPass)
   Google Play Families policy: links out of the app, sharing and other
   grown-up actions sit behind a check a young child can't pass: a
   multiplication sum typed on a keypad (no multiple choice to guess).
   Passing it is remembered for 5 minutes (this tab only).
   Used by quiz-shared.js (home, quiz pages) and the games (kq3d.js).
   ============================================================ */
window.kqParentGate = function kqParentGate(onPass) {
  try { if (Date.now() - (+sessionStorage.getItem('kq_parent_ok') || 0) < 300000) { onPass(); return; } } catch (e) {}
  const a = 6 + Math.floor(Math.random() * 4), b = 3 + Math.floor(Math.random() * 7), ans = a * b;
  let typed = '';
  const old = document.getElementById('kqGateBox'); if (old) old.remove();
  const w = document.createElement('div'); w.id = 'kqGateBox'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true');
  w.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(15,10,40,.6);display:flex;align-items:center;justify-content:center;padding:16px;font-family:"Baloo 2",system-ui,sans-serif';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];
  w.innerHTML = '<div style="background:#fff;color:#1e1b4b;border-radius:26px;padding:18px;width:100%;max-width:340px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.35)">' +
    '<div style="font-size:40px;line-height:1">👨‍👩‍👧</div><h3 style="margin:4px 0 0;font-size:22px">For grown-ups</h3>' +
    '<p style="margin:4px 0 10px;color:#6b7280;font-weight:700">Please ask a parent to answer:</p>' +
    '<div style="font-size:34px;font-weight:800">' + a + ' × ' + b + ' = <span id="kqGateIn" style="display:inline-block;min-width:70px;border-bottom:4px solid #7c3aed;color:#7c3aed">&nbsp;</span></div>' +
    '<div id="kqGateMsg" style="min-height:22px;color:#dc2626;font-weight:700;margin:4px 0"></div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + keys.map((k) => '<button type="button" data-k="' + k + '" style="min-height:54px;border:none;border-radius:16px;font-size:22px;font-weight:800;font-family:inherit;cursor:pointer;background:' + (k === 'OK' ? '#22c55e;color:#fff' : k === '⌫' ? '#fee2e2;color:#b91c1c' : '#f5f3ff;color:#1e1b4b') + '">' + k + '</button>').join('') + '</div>' +
    '<button type="button" data-k="x" style="margin-top:10px;border:none;background:none;color:#6b7280;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;padding:8px">Cancel</button></div>';
  document.body.appendChild(w);
  const out = w.querySelector('#kqGateIn'), msg = w.querySelector('#kqGateMsg');
  w.addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]'); if (!k) { if (e.target === w) w.remove(); return; }
    const v = k.dataset.k;
    if (v === 'x') { w.remove(); return; }
    if (v === '⌫') typed = typed.slice(0, -1);
    else if (v === 'OK') {
      if (+typed === ans && typed !== '') { try { sessionStorage.setItem('kq_parent_ok', String(Date.now())); } catch (er) {} w.remove(); onPass(); return; }
      msg.textContent = 'That’s not right. Ask a grown-up! 🙂'; typed = '';
    } else if (typed.length < 3) typed += v;
    out.innerHTML = typed || '&nbsp;';
  });
};

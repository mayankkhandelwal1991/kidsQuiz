/* ============================================================
   INVITE A FAMILY (referral) — parents only (For parents, behind the grown-up question).
   • Each phone gets an invite code (6 letters/numbers, no device identifiers):
     Firebase referrals/<CODE>/owner = the player who made it.
   • The other parent installs the app and types the code in For parents → Invite a family.
     That writes referrals/<CODE>/uses/<their player> = {at} (once), and they get BONUS coins.
   • The inviting family claims BONUS coins per use, capped at CAP uses (kept in their
     wallet: refClaimed), the next time the app opens.
   • A phone can use one code, once (kq_ref_used); never its own.
   Shared text has no names: just the code and the app link.
   ============================================================ */
(function () {
  'use strict';
  if (window.KQRef) return;
  var BONUS = 50, CAP = 5, LINK = 'https://play.google.com/store/apps/details?id=com.mk.kidsquiz';
  var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function db() { try { return firebase.database(); } catch (e) { return null; } }
  function ready() { return (window.KQ && KQ.ready) ? KQ.ready : Promise.reject(new Error('offline')); }
  function ev(n) { try { if (window.KQEvents) KQEvents.log(n); } catch (e) {} }
  function newCode() { var c = ''; for (var i = 0; i < 6; i++) c += A[Math.floor(Math.random() * A.length)]; return c; }
  function wallet() { return window.KQCoins && KQCoins.wallet ? KQCoins.wallet() : null; }

  /** This phone's code (made once, registered in Firebase). */
  function myCode(tries) {
    var c = ls('kq_ref_code'); if (c) return Promise.resolve(c);
    tries = tries || 0; if (tries > 4) return Promise.reject(new Error('busy'));
    return ready().then(function () {
      var code = newCode(), d = db(); if (!d) throw new Error('offline');
      return d.ref('referrals/' + code + '/owner').set(KQ.user().key).then(function () { ls('kq_ref_code', code); return code; }, function () { return myCode(tries + 1); });
    });
  }
  function message(code) { return 'We use Kids Quiz for learning (LKG to Class 5): stories, quizzes and Olympiad practice. Install it free, then in For parents → Invite a family enter my code ' + code + ' and we both get ' + BONUS + ' bonus coins!\n' + LINK; }

  /** Use another family's code (once per phone). Resolves with a message for the parent. */
  function redeem(raw) {
    var code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return Promise.resolve('Codes have 6 letters or numbers.');
    if (ls('kq_ref_used')) return Promise.resolve('This phone has already used an invite code.');
    if (code === ls('kq_ref_code')) return Promise.resolve('That is your own code. Share it with another family!');
    var w = wallet(); if (w && w.refUsed) return Promise.resolve('This child has already used an invite code.');
    return ready().then(function () {
      var d = db(), me = KQ.user().key;
      return d.ref('referrals/' + code + '/owner').once('value').then(function (s) {
        if (!s.exists()) return 'We could not find that code. Please check it.';
        if (s.val() === me) return 'That is your own code.';
        return d.ref('referrals/' + code + '/uses/' + me).set({ at: Date.now() }).then(function () {
          ls('kq_ref_used', code); ev('referral_used');
          if (window.KQCoins && KQCoins.tx) KQCoins.tx(BONUS, '🎁 Invite bonus', function (x) { x.refUsed = code; });
          return '🎉 Done! You got ' + BONUS + ' bonus coins. The family who invited you gets coins too.';
        }, function () { return 'This code was already used here.'; });
      });
    }).catch(function () { return 'Please check the internet and try again.'; });
  }

  /** Inviting family: collect coins for new uses of our code (up to CAP). */
  function claim(n) {
    var code = ls('kq_ref_code'); if (!code) return;
    var w = wallet(); if (!w) { if ((n || 0) < 20) setTimeout(function () { claim((n || 0) + 1); }, 1000); return; }
    ready().then(function () {
      return db().ref('referrals/' + code + '/uses').once('value').then(function (s) {
        var used = Math.min(CAP, s.numChildren()), had = +(wallet().refClaimed || 0), add = used - had;
        if (add > 0 && KQCoins.tx) {
          KQCoins.tx(add * BONUS, '🎁 ' + add + ' famil' + (add === 1 ? 'y' : 'ies') + ' joined with your code', function (x) { x.refClaimed = used; });
          try { if (KQCoins.toast) KQCoins.toast('🎁 +' + add * BONUS + ' coins: a family joined with your invite code!', true); } catch (e) {}
        }
      });
    }).catch(function () {});
  }

  /** The parent sheet: our code + share, and "have a code?" */
  function open() {
    var old = document.getElementById('kqRef'); if (old) old.remove();
    var w = document.createElement('div'); w.id = 'kqRef'; w.setAttribute('role', 'dialog');
    w.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(15,10,40,.6);display:flex;align-items:flex-end;justify-content:center;font-family:"Baloo 2",system-ui,sans-serif';
    w.innerHTML = '<div style="background:#fff;color:#1e1b4b;border-radius:28px 28px 0 0;padding:18px 16px max(18px,env(safe-area-inset-bottom));width:100%;max-width:560px;max-height:92vh;overflow-y:auto;text-align:center">' +
      '<div style="display:flex;align-items:center;gap:10px;text-align:left"><span style="font-size:36px">🎁</span><h2 style="margin:0;flex:1;font-size:23px">Invite a family</h2><button data-a="x" aria-label="Close" style="width:44px;height:44px;border-radius:50%;border:none;background:#f3f4f6;font-size:20px;cursor:pointer">✕</button></div>' +
      '<p style="font-weight:700;color:#4b5563;margin:8px 0">Share your code. When another family uses it, <b>both</b> get ' + BONUS + ' bonus coins (up to ' + CAP + ' families). Coins are only for fun in the app.</p>' +
      '<div id="kqRefCode" style="font-size:34px;font-weight:800;letter-spacing:.14em;color:#4338ca;margin:6px 0">…</div>' +
      '<button data-a="wa" style="width:100%;border:none;border-radius:18px;padding:12px;font:800 18px \'Baloo 2\',sans-serif;color:#fff;background:#25D366;cursor:pointer">Share on WhatsApp</button>' +
      '<button data-a="other" style="display:block;margin:8px auto 0;border:none;background:none;color:#6d28d9;font:800 14px \'Baloo 2\',sans-serif;text-decoration:underline;cursor:pointer">Share with another app</button>' +
      '<hr style="border:none;border-top:2px dashed #ede9fe;margin:14px 0">' +
      '<b style="display:block;text-align:left">Got a code from another family?</b>' +
      '<div style="display:flex;gap:8px;margin-top:6px"><input id="kqRefIn" maxlength="6" placeholder="CODE" autocomplete="off" style="flex:1;min-width:0;border:2px solid #ddd6fe;border-radius:14px;padding:10px;font:800 18px \'Baloo 2\',sans-serif;text-transform:uppercase;letter-spacing:.1em;text-align:center">' +
      '<button data-a="use" style="border:none;border-radius:14px;padding:0 16px;font:800 16px \'Baloo 2\',sans-serif;color:#fff;background:#7c3aed;cursor:pointer">Use</button></div>' +
      '<p id="kqRefMsg" style="min-height:20px;font-weight:800;color:#6d28d9;margin:8px 0 0"></p></div>';
    document.body.appendChild(w);
    var code = null;
    myCode().then(function (c) { code = c; var el = document.getElementById('kqRefCode'); if (el) el.textContent = c; }, function () { var el = document.getElementById('kqRefCode'); if (el) el.textContent = 'Check the internet'; });
    if (ls('kq_ref_used')) { var inp = w.querySelector('#kqRefIn'); inp.disabled = true; inp.placeholder = 'Used ✓'; }
    w.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) { if (e.target === w) w.remove(); return; }
      var a = b.getAttribute('data-a');
      if (a === 'x') w.remove();
      else if ((a === 'wa' || a === 'other') && code) {
        ev('share_tapped');
        var t = message(code);
        if (a === 'wa') { var u = 'https://wa.me/?text=' + encodeURIComponent(t); if (typeof kqOpenExternal === 'function') kqOpenExternal(u); else window.open(u, '_blank'); }
        else { try { if (typeof Android !== 'undefined' && Android.shareText) { Android.shareText(t); return; } } catch (er) {} if (navigator.share) navigator.share({ text: t }).catch(function () {}); else { try { navigator.clipboard.writeText(t); } catch (er) {} alert(t); } }
      } else if (a === 'use') {
        var msg = document.getElementById('kqRefMsg'); msg.textContent = 'Checking…';
        redeem(document.getElementById('kqRefIn').value).then(function (m) { msg.textContent = m; });
      }
    });
  }

  window.KQRef = { open: open, redeem: redeem, claim: claim, BONUS: BONUS, CAP: CAP };
  setTimeout(function () { claim(0); }, 4000);
})();

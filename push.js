/* ============================================================
   PUSH NOTIFICATIONS (app only) — which messages this phone gets.
   Topics, from what the app knows about the child playing now:
     all · class_lkg | class_ukg | class_1..5 · google | guest
     like_<interest> (onboard.js answers) · friends (likes playing with friends)
     teachers (this phone has a teacher-mode class)
   The app subscribes to exactly these (Android.pushRegister) and gives back this
   phone's token (window.onPushToken), saved in Firebase so the admin can also message
   selected players:  push/tokens/<player>/<id> = { t, at, cls, g, tch }
   Parents can switch notifications off in For parents (kq_push_off, for the whole phone).
   Sending: admin console → 🔔 Notifications (admin/users.html#push).
   ============================================================ */
(function () {
  'use strict';
  if (window.KQPush) return;
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsJ(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function off() { return ls('kq_push_off') === '1'; }
  function isGoogle() { var a = lsJ('kq_cached_auth', null); return !!(a && a.name) && ls('kq_guest_session') !== '1'; }
  function cls() { var l = parseInt(ls('kq_last_class'), 10); return isNaN(l) ? null : l; }
  function clsTopic(l) { return l === 0 ? 'lkg' : l === -1 ? 'ukg' : String(l); }
  function topics() {
    if (off()) return [];
    var t = ['all'], l = cls(), p = lsJ('kq_prefs', null) || {};
    if (l !== null && l >= -1 && l <= 12) t.push('class_' + clsTopic(l));
    t.push(isGoogle() ? 'google' : 'guest');
    (p.likes || []).forEach(function (k) { if (/^[a-z]{2,20}$/.test(k)) t.push('like_' + k); });
    if (p.friends === true) t.push('friends');
    if (ls('kq_role') === 'teacher' || (lsJ('kq_teacher_codes', []) || []).length) t.push('teachers');
    return t;
  }
  function inApp() { try { return typeof Android !== 'undefined' && Android && typeof Android.pushRegister === 'function'; } catch (e) { return false; } }
  function sync() { if (!inApp()) return; try { Android.pushRegister(JSON.stringify(topics()), !off()); } catch (e) {} }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  // the app hands us this phone's token: keep it under the child playing now (once a day is enough)
  window.onPushToken = function (tok) {
    if (!/^[A-Za-z0-9:_\-]{20,300}$/.test(String(tok)) || off() || !window.KQ || !KQ.ready) return;
    KQ.ready.then(function () {
      var key = KQ.user().key, mark = key + '|' + hash(tok) + '|' + new Date().toDateString();
      if (ls('kq_push_saved') === mark || !window.firebase) return;
      return firebase.database().ref('push/tokens/' + key + '/' + hash(tok)).set({ t: tok, at: Date.now(), cls: cls() === null ? '' : String(cls()), g: isGoogle() ? 1 : 0, tch: (lsJ('kq_teacher_codes', []) || []).length ? 1 : 0 })
        .then(function () { try { localStorage.setItem('kq_push_saved', mark); } catch (e) {} });
    }).catch(function () {});
  };
  function setOff(v) { try { localStorage.setItem('kq_push_off', v ? '1' : '0'); } catch (e) {} sync(); }
  window.KQPush = { sync: sync, topics: topics, off: off, setOff: setOff, inApp: inApp };
  setTimeout(sync, 2500);
})();

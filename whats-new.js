/* ============================================================
   "WHAT'S NEW" ANNOUNCEMENT POPUP
   ------------------------------------------------------------
   HOW TO RELEASE AN UPDATE ANNOUNCEMENT:
   1. Bump `version` below to any new string (e.g. 'v1.4.0').
   2. Update `title`, `date`, and `items` with what changed.
   3. Make sure `enabled: true`.
   4. Deploy. Every user who hasn't seen this exact `version`
      string gets the popup once, the next time they open the
      home page. After they close it, it won't show again for
      that version (tracked in localStorage on their device).

   To turn announcements off entirely, set `enabled: false`.
   ============================================================ */
const WHATS_NEW = {
  enabled: true,
  version: 'v1.0.0',
  title: "🎉 What's New",
  date: 'July 2026',
  items: [
    "Added a Category picker with a bigger, easier-to-read layout",
    "Faster app opening — no more waiting on the loading screen if you're already signed in",
    "New games added to Game Zone 🎮"
  ],
  ctaText: 'Got it!'
};

(function () {
  const SEEN_KEY = 'kq_whats_new_seen';

  function alreadySeen() {
    try { return localStorage.getItem(SEEN_KEY) === WHATS_NEW.version; } catch (e) { return true; }
  }
  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, WHATS_NEW.version); } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById('whatsNewStyles')) return;
    const style = document.createElement('style');
    style.id = 'whatsNewStyles';
    style.textContent = `
      #whatsNewModal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .2s ease;}
      #whatsNewModal.show{opacity:1;}
      #whatsNewModal .wn-card{background:linear-gradient(180deg,#ffffff,#fef6ff);border:6px solid #fff;border-radius:28px;padding:26px 24px 22px;max-width:380px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,.3);text-align:center;transform:scale(.85);transition:transform .25s cubic-bezier(.34,1.56,.64,1);font-family:'Baloo 2',system-ui,sans-serif;}
      #whatsNewModal.show .wn-card{transform:scale(1);}
      #whatsNewModal .wn-badge{display:inline-block;background:linear-gradient(135deg,#ff7a59,#ff4fa3);color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:20px;margin-bottom:10px;letter-spacing:.4px;}
      #whatsNewModal h2{color:#ff5a8a;font-size:22px;font-weight:800;margin-bottom:2px;}
      #whatsNewModal .wn-date{color:#9a9aa8;font-size:12px;font-weight:600;margin-bottom:16px;}
      #whatsNewModal ul{list-style:none;text-align:left;margin:0 0 20px;padding:0;display:flex;flex-direction:column;gap:10px;}
      #whatsNewModal li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#444;line-height:1.4;font-weight:600;}
      #whatsNewModal li::before{content:'✨';flex:0 0 auto;font-size:15px;}
      #whatsNewModal .wn-btn{background:linear-gradient(135deg,#ff7a59,#ff4fa3);color:#fff;border:none;border-radius:16px;padding:12px 40px;font-family:inherit;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 8px 18px rgba(255,79,163,.35);position:relative;overflow:hidden;-webkit-tap-highlight-color:transparent;}
    `;
    document.head.appendChild(style);
  }

  function buildModal() {
    const wrap = document.createElement('div');
    wrap.id = 'whatsNewModal';
    const itemsHtml = WHATS_NEW.items.map(function (i) { return '<li>' + i + '</li>'; }).join('');
    wrap.innerHTML =
      '<div class="wn-card">' +
        '<div class="wn-badge">NEW</div>' +
        '<h2>' + WHATS_NEW.title + '</h2>' +
        '<div class="wn-date">' + WHATS_NEW.date + '</div>' +
        '<ul>' + itemsHtml + '</ul>' +
        '<button class="wn-btn" id="whatsNewCloseBtn">' + WHATS_NEW.ctaText + '</button>' +
      '</div>';
    document.body.appendChild(wrap);
    requestAnimationFrame(function () { wrap.classList.add('show'); });

    function close() {
      markSeen();
      wrap.classList.remove('show');
      setTimeout(function () { wrap.remove(); }, 200);
    }
    document.getElementById('whatsNewCloseBtn').addEventListener('click', close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });

    // Reuse the app's Android-style ripple on the button if it's loaded on this page.
    try { if (window.attachRipple) attachRipple('#whatsNewCloseBtn'); } catch (e) {}
  }

  function showWhatsNew() {
    if (!WHATS_NEW.enabled) return;
    if (alreadySeen()) return;
    injectStyles();
    buildModal();
  }

  window.showWhatsNew = showWhatsNew;
})();

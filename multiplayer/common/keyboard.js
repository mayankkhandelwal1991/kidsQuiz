/**
 * common/keyboard.js
 * -----------------------------------------------------------------------
 * Keeps a text box visible when the phone keyboard opens (nickname / room
 * code on the landing screen). Inside the Android app the page is often
 * NOT resized for the keyboard, so the keyboard simply covers the box.
 * While a box has focus we:
 *   - add the class `kb-open` to <body>: the landing screen becomes
 *     scrollable, aligned to the top, with extra room at the bottom
 *     (see theme.css), so there is always somewhere to scroll to;
 *   - scroll the box into the upper part of the screen (above the keyboard),
 *     again when the keyboard finishes opening (visualViewport resize).
 * Call keepFieldsVisible() once; it is safe to call again.
 * -----------------------------------------------------------------------
 */
export function keepFieldsVisible() {
  if (window.__kqKeyboard) return;
  window.__kqKeyboard = true;
  const vv = window.visualViewport;
  let field = null;

  function reveal() {
    if (!field || document.activeElement !== field) return;
    try { field.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { field.scrollIntoView(true); }
  }
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (!t || !t.matches || !t.matches('input:not([type=checkbox]):not([type=radio]), textarea')) return;
    field = t;
    document.body.classList.add('kb-open');
    setTimeout(reveal, 120);
    setTimeout(reveal, 450);   // after the keyboard has slid up
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      const a = document.activeElement;
      if (a && a.matches && a.matches('input, textarea')) return;   // moved to another box
      field = null;
      document.body.classList.remove('kb-open');
    }, 150);
  });
  if (vv) vv.addEventListener('resize', () => setTimeout(reveal, 50));
}

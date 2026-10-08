/* ============================================================
   EMOJI_IMG — maps emoji characters used across the app (LKG
   pictorial quiz questions, category icons, home-screen cards)
   to a locally-hosted image file, so pictures render identically
   on every device instead of depending on whatever emoji font
   happens to be installed (small/inconsistent on some Android
   WebViews and desktop browsers).

   Images: Twemoji (https://github.com/jdecked/twemoji), licensed
   CC-BY 4.0 — graphics copyright Twitter, Inc and other
   contributors. Kept locally under images/emoji/ so the app works
   fully offline. See images/emoji/NOTICE.md for attribution.
   ============================================================ */
const EMOJI_IMG = {
  "⌨️": "images/emoji/2328.svg",
  "☀️": "images/emoji/2600.svg",
  "☁️": "images/emoji/2601.svg",
  "⚽": "images/emoji/26bd.svg",
  "✋": "images/emoji/270b.svg",
  "❄️": "images/emoji/2744.svg",
  "❤️": "images/emoji/2764.svg",
  "⭐": "images/emoji/2b50.svg",
  "⭕": "images/emoji/2b55.svg",
  "🌃": "images/emoji/1f303.svg",
  "🌅": "images/emoji/1f305.svg",
  "🌈": "images/emoji/1f308.svg",
  "🌊": "images/emoji/1f30a.svg",
  "🌍": "images/emoji/1f30d.svg",
  "🌙": "images/emoji/1f319.svg",
  "🌞": "images/emoji/1f31e.svg",
  "🌧️": "images/emoji/1f327.svg",
  "🌱": "images/emoji/1f331.svg",
  "🌳": "images/emoji/1f333.svg",
  "🌴": "images/emoji/1f334.svg",
  "🌸": "images/emoji/1f338.svg",
  "🌻": "images/emoji/1f33b.svg",
  "🍃": "images/emoji/1f343.svg",
  "🍅": "images/emoji/1f345.svg",
  "🍇": "images/emoji/1f347.svg",
  "🍋": "images/emoji/1f34b.svg",
  "🍌": "images/emoji/1f34c.svg",
  "🍎": "images/emoji/1f34e.svg",
  "🍦": "images/emoji/1f366.svg",
  "🍯": "images/emoji/1f36f.svg",
  "🎂": "images/emoji/1f382.svg",
  "🎧": "images/emoji/1f3a7.svg",
  "🎩": "images/emoji/1f3a9.svg",
  "🎾": "images/emoji/1f3be.svg",
  "🏀": "images/emoji/1f3c0.svg",
  "🏃": "images/emoji/1f3c3.svg",
  "🏆": "images/emoji/1f3c6.svg",
  "✨": "images/emoji/2728.svg",
  "🎈": "images/emoji/1f388.svg",
  "🌟": "images/emoji/1f31f.svg",
  "🏊": "images/emoji/1f3ca.svg",
  "🏏": "images/emoji/1f3cf.svg",
  "🏓": "images/emoji/1f3d3.svg",
  "🏔️": "images/emoji/1f3d4.svg",
  "🏜️": "images/emoji/1f3dc.svg",
  "🏝️": "images/emoji/1f3dd.svg",
  "🏞️": "images/emoji/1f3de.svg",
  "🏠": "images/emoji/1f3e0.svg",
  "🐄": "images/emoji/1f404.svg",
  "🐇": "images/emoji/1f407.svg",
  "🐈": "images/emoji/1f408.svg",
  "🐍": "images/emoji/1f40d.svg",
  "🐐": "images/emoji/1f410.svg",
  "🐑": "images/emoji/1f411.svg",
  "🐒": "images/emoji/1f412.svg",
  "🐔": "images/emoji/1f414.svg",
  "🐕": "images/emoji/1f415.svg",
  "🐘": "images/emoji/1f418.svg",
  "🐝": "images/emoji/1f41d.svg",
  "🐟": "images/emoji/1f41f.svg",
  "🐢": "images/emoji/1f422.svg",
  "🐦": "images/emoji/1f426.svg",
  "🐧": "images/emoji/1f427.svg",
  "🐫": "images/emoji/1f42b.svg",
  "🐰": "images/emoji/1f430.svg",
  "🐱": "images/emoji/1f431.svg",
  "🐴": "images/emoji/1f434.svg",
  "🐶": "images/emoji/1f436.svg",
  "🐷": "images/emoji/1f437.svg",
  "🐸": "images/emoji/1f438.svg",
  "🐻": "images/emoji/1f43b.svg",
  "👀": "images/emoji/1f440.svg",
  "👁️": "images/emoji/1f441.svg",
  "👂": "images/emoji/1f442.svg",
  "👃": "images/emoji/1f443.svg",
  "👄": "images/emoji/1f444.svg",
  "👅": "images/emoji/1f445.svg",
  "👨‍👩‍👧": "images/emoji/1f468-200d-1f469-200d-1f467.svg",
  "👨‍🚀": "images/emoji/1f468-200d-1f680.svg",
  "💇": "images/emoji/1f487.svg",
  "💡": "images/emoji/1f4a1.svg",
  "💧": "images/emoji/1f4a7.svg",
  "💻": "images/emoji/1f4bb.svg",
  "📱": "images/emoji/1f4f1.svg",
  "📷": "images/emoji/1f4f7.svg",
  "📺": "images/emoji/1f4fa.svg",
  "🔋": "images/emoji/1f50b.svg",
  "🔌": "images/emoji/1f50c.svg",
  "🔑": "images/emoji/1f511.svg",
  "🔥": "images/emoji/1f525.svg",
  "🔺": "images/emoji/1f53a.svg",
  "🖨️": "images/emoji/1f5a8.svg",
  "🖱️": "images/emoji/1f5b1.svg",
  "🗺️": "images/emoji/1f5fa.svg",
  "🚀": "images/emoji/1f680.svg",
  "🚗": "images/emoji/1f697.svg",
  "🚴": "images/emoji/1f6b4.svg",
  "🛸": "images/emoji/1f6f8.svg",
  "🟥": "images/emoji/1f7e5.svg",
  "🟦": "images/emoji/1f7e6.svg",
  "🟧": "images/emoji/1f7e7.svg",
  "🟨": "images/emoji/1f7e8.svg",
  "🟩": "images/emoji/1f7e9.svg",
  "🥅": "images/emoji/1f945.svg",
  "🥔": "images/emoji/1f954.svg",
  "🥕": "images/emoji/1f955.svg",
  "🥚": "images/emoji/1f95a.svg",
  "🥭": "images/emoji/1f96d.svg",
  "🦁": "images/emoji/1f981.svg",
  "🦆": "images/emoji/1f986.svg",
  "🦎": "images/emoji/1f98e.svg",
  "🦒": "images/emoji/1f992.svg",
  "🦓": "images/emoji/1f993.svg",
  "🦢": "images/emoji/1f9a2.svg",
  "🦵": "images/emoji/1f9b5.svg",
  "🦶": "images/emoji/1f9b6.svg",
  "🦷": "images/emoji/1f9b7.svg",
  "🧠": "images/emoji/1f9e0.svg",
  "🪨": "images/emoji/1faa8.svg",
  "➕": "images/emoji/2795.svg",
  "✖️": "images/emoji/2716.svg",
  "➗": "images/emoji/2797.svg",
  "🔢": "images/emoji/1f522.svg",
  "🇮🇳": "images/emoji/1f1ee-1f1f3.svg",
  "🔤": "images/emoji/1f524.svg",
  "🔬": "images/emoji/1f52c.svg",
  "📜": "images/emoji/1f4dc.svg",
  "🐾": "images/emoji/1f43e.svg",
  "👤": "images/emoji/1f464.svg",
  "🏛️": "images/emoji/1f3db.svg",
  "🧩": "images/emoji/1f9e9.svg",
  "🔁": "images/emoji/1f501.svg",
  "🎯": "images/emoji/1f3af.svg",
  "🎮": "images/emoji/1f3ae.svg",
  "🏅": "images/emoji/1f3c5.svg",
  "♟️": "images/emoji/265f.svg",
  "⚡": "images/emoji/26a1.svg",
  "✊": "images/emoji/270a.svg",
  "🃏": "images/emoji/1f0cf.svg",
  "🌀": "images/emoji/1f300.svg",
  "🎨": "images/emoji/1f3a8.svg",
  "🎵": "images/emoji/1f3b5.svg",
  "🎹": "images/emoji/1f3b9.svg",
  "🏁": "images/emoji/1f3c1.svg",
  "🏎️": "images/emoji/1f3ce.svg",
  "🏗️": "images/emoji/1f3d7.svg",
  "🐹": "images/emoji/1f439.svg",
  "💠": "images/emoji/1f4a0.svg",
  "🔍": "images/emoji/1f50d.svg",
  "🔎": "images/emoji/1f50e.svg",
  "🔟": "images/emoji/1f51f.svg",
  "🔠": "images/emoji/1f520.svg",
  "🔮": "images/emoji/1f52e.svg",
  "🔴": "images/emoji/1f534.svg",
  "🕶️": "images/emoji/1f576.svg",
  "🗂️": "images/emoji/1f5c2.svg",
  "🟣": "images/emoji/1f7e3.svg",
  "🤖": "images/emoji/1f916.svg",
  "🤸": "images/emoji/1f938.svg",
  "🧪": "images/emoji/1f9ea.svg",
  "🧱": "images/emoji/1f9f1.svg",
  "🪐": "images/emoji/1fa90.svg",
  "🪜": "images/emoji/1fa9c.svg",
};

/* Several entries (family, astronaut, flags) are multi-codepoint
   sequences, so a naive per-character scan would split them apart
   and miss the lookup. Sort keys longest-first and greedy-match
   substrings instead. */
const __EMOJI_IMG_KEYS = Object.keys(EMOJI_IMG).sort((a, b) => b.length - a.length);

/** Replace each known emoji in `text` with an <img> tag sized by `px`,
    for pictorial rendering. Falls back to the raw emoji character for
    anything not in EMOJI_IMG (e.g. Devanagari). `basePath` lets callers
    in subfolders (e.g. quiz/index.html) point at the right images/ dir. */
function emojiImgHtml(text, px, basePath) {
  basePath = basePath || '';
  text = String(text);
  let out = '';
  let i = 0;
  while (i < text.length) {
    let matched = null;
    for (const key of __EMOJI_IMG_KEYS) {
      if (text.startsWith(key, i)) { matched = key; break; }
    }
    if (matched) {
      out += '<img class="emoji-img" src="' + basePath + EMOJI_IMG[matched] + '" alt="" ' +
        'style="width:' + px + 'px;height:' + px + 'px;">';
      i += matched.length;
    } else {
      const ch = text[i];
      out += ch.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      i += ch.length;
    }
  }
  return out;
}


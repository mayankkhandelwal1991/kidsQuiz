# My Travel Map

Upload `place.html` and the whole `place/` folder to the same folder of the site
(for GitHub Pages: next to each other in the `kidsQuiz` repository).

## Files

| File | What it holds |
|---|---|
| `place.html` | The page layout, the version number and the list of files to load |
| `place/css/style.css` | All styles |
| `place/maps/india-map.js` | The India map (states) |
| `place/maps/world-map.js` | The World map (countries); fetched only when World is opened |
| `place/js/config.js` | Settings you may need to change: Groq key, Firebase project, site address. |
| `place/js/lang.js` | English / Hindi: the Hindi dictionary and the T() translation helper. |
| `place/js/core.js` | The two maps, the list of places, stats, badges and drawing the map and list. |
| `place/js/places-data.js` | Built-in lists of well-known places for suggestions and games. |
| `place/js/search.js` | Place search suggestions (built-in list, Groq, online search) and small popups. |
| `place/js/add-place.js` | Adding one place or several at once. |
| `place/js/place-card-picture.js` | The place card, fun facts, "where next" and the shareable map picture. |
| `place/js/map-zoom.js` | Zoom and drag for the map (buttons, pinch, double-tap, mouse wheel). |
| `place/js/features.js` | Journey replay, year card, backup/restore, trip planner, quiz, pins from photos. |
| `place/js/layout.js` | Tabs, the sliding sheet and fitting the map to the screen. |
| `place/js/firebase-friends.js` | Google sign-in, cloud save, friends groups, compare and leaderboards. |
| `place/js/sharing.js` | Share message, story card, journey video and the share menu. |
| `place/js/engage.js` | Levels, daily question, monthly challenge, collections, passport, progress, facts, India/World switch. |
| `place/js/games.js` | Pin-drop, guess the place, surprise me, traveller type, numbers, twin, crowns, home lines, scratch card, mystery stamp. |
| `place/js/friends-social.js` | Friend activity, shared game scores, group trips and the friend quiz. |
| `place/js/sights-data.js` | Hand-picked famous sights for big Indian cities (add your own city here). |
| `place/js/nearby.js` | "Been near here too?" tick list after adding a place. |
| `place/js/tour.js` | The quick guide shown after the first sign-in. |
| `place/js/boot.js` | Runs last: starts the app once every other file is loaded. |

## Updating

1. Edit the file you need.
2. In `place.html`, raise `APP_VERSION` (and `APP_DATE`). This is what makes phones
   download the new files instead of using their saved copies.
3. Upload the changed files together with `place.html`.

## Settings

All in `place/js/config.js`: the Groq key, the Firebase project and `SITE_URL`
(the address used in share messages and invite links).

The files must load in the order listed in `place.html`; `boot.js` must stay last.

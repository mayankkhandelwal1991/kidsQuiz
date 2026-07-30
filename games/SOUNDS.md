# Sounds & animations (Game/)

Every game in this folder shares one effects engine: `kq-fx.js`, loaded
automatically by `ads.js` (you don't need to add a script tag to any game
file — it's already wired in for all of them).

## What's in `sounds/`

24 short, happy, kid-friendly MP3 clips (chiptune-style, generated for this
project — no scary/harsh noises):

`click` `tap` `pop` `coin` `success` `win` `lose` `draw` `levelup` `wrong`
`error` `join` `leave` `tick` `countdown` `hit` `splash` `flip` `blast`
`whoosh` `boing` `drop` `ding` `chime`

If a file ever fails to load, `kq-fx.js` automatically falls back to a
synthesized Web Audio tone for that same sound — nothing ever stays silent.

## How it's wired in

- `ads.js` dynamically loads both `kq-leaderboard.js` and `kq-fx.js` on
  every game page. Its `onGameComplete()` wrapper already calls
  `KQFX.gameComplete()` for you, so **every game gets a finish sound +
  light confetti automatically**, even ones that were never touched
  individually.
- On top of that, most games now call `KQFX.play('...')` directly at their
  own win/lose/flip/blast/whoosh/boing/drop/ding moments — card flips in
  memory_match, disc drops in connect_four, crashes in the racers, pops in
  bubble_shooter/balloon_pop, whacks in whack_mole, correct/wrong answers
  in the word & quiz games, and so on.
- `KQFX.win()` / `KQFX.lose()` play the win/lose sound and (for wins) a big
  confetti burst. `KQFX.shake(el)` / `KQFX.bounce(el)` / `KQFX.flipEl(el)`
  trigger quick CSS animations on any element.
- A 🔊/🔇 mute button is injected automatically next to the leaderboard
  widget (or floats bottom-left if that widget isn't present) and its
  state is remembered across visits.

## Adding a sound to a new game

```js
if (window.KQFX) KQFX.play('blast');   // or 'ding', 'flip', 'whoosh', 'boing', 'drop', 'win', 'lose'...
```

That's it — no import needed, `KQFX` is already global by the time your
game's own script runs.

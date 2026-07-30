This folder is ready for optional real 3D model upgrades.

I couldn't download pre-made 3D models myself (no internet access in my
environment), so the game currently draws its character, trees, buildings,
crates and coins using textured low-poly shapes built from the PNGs in
../textures/. They already look much better than flat-color boxes, but if
you want true modeled 3D assets, just drop .glb files with these exact
names into this folder:

  character.glb   - the runner
  tree.glb        - roadside tree
  building.glb    - roadside building
  crate.glb       - obstacle crate
  coin.glb        - collectible coin

The game checks for these automatically on load (via THREE.GLTFLoader) and
will use whichever ones it finds, falling back to the built-in textured
shapes for anything missing. No code changes needed.

Good free/CC0 sources for ready-made low-poly kids-game-style .glb models:
  - Kenney.nl (kenney.nl/assets) — huge free low-poly asset packs
  - Poly Pizza (poly.pizza) — free CC0/CC-BY low-poly models
  - Sketchfab (filter by "Downloadable" + CC0 license)

Keep file sizes small (under a few MB each) so the game still loads fast
on mobile.

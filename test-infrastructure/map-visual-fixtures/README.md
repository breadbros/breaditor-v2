# Map visual regression fixtures

Run against the **installed** `crustacean-map-lib` package:

```powershell
$env:ELECTRON_RUN_AS_NODE = ''
node node_modules/electron/cli.js test-infrastructure/map-visual.smoke.js
```

Linux CI can use `xvfb-run -a node node_modules/electron/cli.js test-infrastructure/map-visual.smoke.js --no-sandbox`.
The runner forces SwiftShader, sRGB, pixel ratio 1, integer camera transforms,
nearest sampling, and fixed animation timestamps. Each run retains a unique
temporary user-data/artifact directory; it never deletes files.
Set `MAP_VISUAL_OUTPUT` to retain each unique run directory under a chosen parent,
such as the CI runner's temporary artifact directory.

`map-visual.fixtures.js` contains independent, hand-authored pixel diagrams.
Every RGBA pixel is asserted exactly. These scenes check renderer behavior,
not historical Sully visual parity:

- Bridge: underpass sprite behind deck, entity-pass sprite above deck, rails above both.
- Waterfall: tile and padded-transparent splash animation before/at 100 ms,
  loop at 200 ms, and rewind back to 100 ms.
- Oak: source padding, hitbox origin, pixel-over-tile coordinates, layer offset
  and half-speed parallax, partial-width `Tall_Redraw`, foreground covering the
  trunk and outside canopy edges, redraw at a hidden layer, and a later fence.
  Hidden-layer art/entities must remain hidden.

Failures retain actual/expected PNGs, a JSON report with differing coordinates,
and run results. No renderer capture can replace an expectation. To intentionally
write PNG previews of the hand-authored expectations, use `--write-fixture-pngs`;
the previews are generated from those diagrams with an independent PNG encoder.
Change the diagrams only after reviewing the intended behavior.

`--farmsville` additionally retains three focused Farmsville observations at a
fixed timestamp. They have no golden assertions and require human visual review.

# Legacy layer controls

## Findings

Reference: `D:\dev\breadbros\breaditor`, branch `2023-FEB-HEY-DAN-THIS-WORKS`, commit `403e69097e27890ac3f5594d22d355dff8e66ad8`, `src/js/ui/LayersPalette.js`.

- The old list displays `renderstring` in reverse: foreground at the top. Dragging rewrites render passes, including E (default entities) and R (custom render hook), without rearranging tile arrays.
- Art eyeballs toggle `MAPED_HIDDEN`; separate entity eyeballs toggle `maped_HIDE_ENTS`. Zones, obstructions, and global entity visibility have their own controls.
- The special badge says "Tall entities redraw on this layer" and identifies `tallentitylayer`. The old panel also displays opacity and parallax.
- Breaditor currently lists art layers by storage index. Its Up/Down action reorders storage and remaps numeric render tokens to preserve rendering, so it cannot serve as a draw-order control.

## Implementation

1. Display foreground-first render-pass rows, including E and R; keep zone/obstruction overlays separate. Show omitted art layers without silently inserting render passes.
2. Add drag handles and Up/Down controls which move render passes through an undoable `renderstring` edit. Preserve layer storage, tile bindings, surplus arrays, names, unknown tokens, and tall redraw references.
3. Add row eyeballs for art, per-layer entities, global entities, zones, and obstruction overlays. Retain existing selected-layer property controls. Show the tall-redraw badge and expose its assignment in layer properties, plus compact opacity/parallax values.
4. Add new focused tests without modifying existing tests. Check real Electron rendering, drag/button ordering, visibility, undo/redo, and screenshots.

# HUMAN QUESTIONS

No blocking questions. Match the donor's foreground-first ordering and tall-redraw badge. R remains a nonexecuting marker in Breaditor. Visibility continues using existing map fields and document view settings; hidden obstructions do not change collision data.

## Result

Implemented on `bmcgraw/2026-10-16/map-layer-controls`. Layer rows follow the renderstring in reverse, support native dragging and arrow buttons, and expose art/entity eyes, opacity/parallax, and the tall-redraw badge. Move buttons retain keyboard focus on the moved layer. Layer properties can assign the tall-redraw target. Overlay eyes remain separate. Omitted layers are identified without changing render order. Stale drags after render-order or document changes are rejected.

Validation: 42 suites / 265 tests passed, including 13 new tests; all pre-existing tests are unchanged. TypeScript and the production build passed. The production Electron smoke verified real pixel changes from art/entity/obstruction visibility and draw ordering, exact rendering restoration through undo/redo, trusted Chromium native drag events, and Save As preserving all layer metadata and tile data, including the surplus array. The captured UI was visually inspected. The new smoke command is included in the existing visual CI job.

Retained final Electron evidence: `C:\Users\benmc\AppData\Local\Temp\breaditor-map-layers-53zwUp` (screenshots, saved map/data, and pixel-hash results). CI-style artifact-root validation also passed through `yarn test:map-layers`.

# Crustacean Map integration

Implement the approved plan: working Farmsville demo first, followed by legacy editing parity, a standalone map library, extended obstruction layers, persistence, and source watching.

## Architecture

- Sibling `../crustacean-map-lib`: portable typed parsing, validation, serialization, loading, dependency graph, spatial helpers and animation; separate WebGL 2 adapter; ESM JavaScript and declarations usable in browser, Node and Deno.
- Breaditor: persistent document sessions, React views/panels, reversible editing commands, clipboard, Electron filesystem operations, source watching and conflict handling.
- Reference donor: breaditor `2023-FEB-HEY-DAN-THIS-WORKS`, commit `403e69097e27890ac3f5594d22d355dff8e66ad8`; Sully source commit `3f29df116dcbd8a37eb649ad63922aebcf2bd041`. Reimplement working behavior; no jQuery UI, plugin loader or game-script execution.
- Preserve source JSON/assets. Adapt unversioned sprite timing and zero hitboxes in memory; preserve canopy regions and legacy magenta transparency.

## Delivery and acceptance

1. Bundle Farmsville in `assets/sully` preserving content-root paths, source hashes and provenance. Dependency closure: 107 files, 50 sprite definitions, 52 images, roughly 4 MB. Copy bundle into packaged output. Map A explicitly opens Farmsville; Map D is independently empty. Resolve map-relative tilesets/images, content-root entities and legacy `$$$_MAPED.json`. Retain all unknown data, including the seventh surplus tile array.
2. WebGL 2 map renderer: cached index textures, nearest sampling, renderstring order, E/O passes, nonexecuting R marker, dimensions/offset/parallax/opacity/visibility, tileset/entity animation, hitbox origins, stable depth order, Tall_Redraw split at the configured layer. Pan/zoom/fit/reset, inspection, pause, overlays, docking/tab state, DPI/resize/context restoration and disposal. Exit: visually correct Farmsville and responsive navigation without unchanged full tile uploads.
3. Sessions and persistence: gesture-grouped undo/redo; New/Open/Recent/Save/Save As; dirty close; local multi-file staged writes with expected source hashes, retained backups and recovery journal. Save As rebases references; project export bundles the dependency closure. Demo writes require Save As. Watch all dependencies; image changes refresh pixels, clean JSON reloads preserve view state, dirty changes expose Reload/Save As and retain edits; malformed saves retain the last good map.
4. Legacy parity: Layers/Info/Entities/Zones/Screenview/Tileset panels and tools; brush/stamps, primary/secondary tiles/swap, eyedroppers, flood fill, marquee, cut/copy/paste and multilayer super-cut/paste; layer CRUD/resize/order/tileset/offset/parallax/opacity/tall redraw; entity CRUD/clone/drag/pixel/tile position and properties; zone/obstruction editing; bounds/hitbox/canopy/checker/screenview overlays; PNG export and Sully code/activation-name helpers. Preserve shortcuts with input-focus guards. Broken donor entity super-cut is excluded.

## Extended format

- Explicit `format_version: 2` with map-level `tile_size` and `dimensions` for maps with zero art tilesets.
- Named `vsp` dictionary; each art layer retains its `vsp` binding.
- `obstruction_layers`: stable id, name, vsp, dimensions, pixel offset; each layer uses one tileset.
- Companion `obstruction_data` dictionary keyed by layer id. Overlapping masks combine by union; visibility does not change obstruction semantics.
- Legacy maps import one normalized obstruction layer and save the legacy representation until explicit conversion. Extended saves use a separate destination and are identified as incompatible with the unchanged Sully runtime. No implicit downgrade or flattened export.

## Validation

- Asset hashes and packaged resolution; missing/canceled/malformed loads; sparse zones and surplus-array preservation; multiple tilesets and no-art maps.
- Deterministic render/picking cases for ordering, offsets/parallax, transparency, timing, origins, canopies and obstruction union.
- Editing undo/redo, selection/clipboard bounds, reference updates, cloning, legacy/v2 round trips, rebasing, conflict handling and partial-write recovery.
- Electron checks for demo startup, editing, split documents, docking, source reload, dirty conflicts, context restoration and cleanup. Manually inspect Farmsville landmarks, bridges, waterfalls and tree occlusion.
- Run library unit/browser/package checks, Breaditor tests, TypeScript, build and Electron smoke checks. Record automated evidence separately from visual acceptance.

# HUMAN QUESTIONS

All decisions resolved during planning:

- Full legacy editing parity, Sully clipboard helpers and PNG export are included.
- Standalone sibling library; working Farmsville demo first.
- One obstruction tileset per layer; extend the format; keep Sully unchanged.
- Save As retains references; project export copies dependencies.
- Full source watching with dirty conflict handling.
- Narrow changes to obsolete DocumentView placeholder and directly affected startup/panel integration tests are approved. Other existing-test changes require approval.

## Implementation status

Implemented with three parallel agents. No publishing or source-game modifications performed.

- Farmsville dependency closure is bundled byte-for-byte and verified in production output.
- Standalone library, WebGL preview/navigation, typed map sessions, all six map panels, editing commands, undo/redo, persistence, exports, format extension and source watching are implemented.
- Source references edited in panels refresh dependency loading; missing required definitions remain watched. Image reload bypasses the browser cache and refreshes the palette.
- Saving retains edits made while writes are pending, rebases undo history after Save As, serializes overlapping write sets, and retains recovery artifacts.
- Unsaved sessions guard editor close even when their document view is not mounted.

Validation completed:

- Breaditor: 39 suites / 252 tests passed; TypeScript and esbuild passed; all 107 packaged asset hashes verified.
- Library: 18 portable/package/fixture tests passed, including real Farmsville closure and surplus-array round trip; TypeScript 4.6 consumers verified.
- Library real WebGL smoke: image-cache replacement, transparent picking, visibility-independent obstruction union, context loss/restoration, one-cell GPU upload and unchanged-frame upload checks passed.
- Built Electron UI smoke: Farmsville renders; wheel zoom and tab camera retention; paint/undo/redo; Save As/reopen; clean JSON reload; dirty conflict retention; complete project export (52 definitions); native 2400x4000 PNG export passed.
- The full UI smoke also passed at device scale factor 2; PNG output retained native dimensions. Existing Monaco file/HTTP smoke passed.
- Narrow existing-test edits were limited to the approved map placeholder, startup sample path, map panel routing and added Tileset panel expectation.

Human acceptance remains separate: review Farmsville's bridges, waterfalls, parallax and tree-canopy occlusion against the game/donor. The Oak legacy atlas padding discrepancy is retained and reported as a diagnostic rather than rewriting the asset.

The sibling library is a local dependency and is not published. Retained transaction stages/backups/journals are intentionally not removed automatically.

# Startup
1. install Node 22+ and yarn (the sprite library requires SSH access to its GitHub repository)
2. Keep the sibling `../crustacean-map-lib` checkout beside this project. Run
   `npm install` and `npm run build` there, then `yarn` here. The local map package
   is deliberately not published yet. After rebuilding it, use `yarn install --force`
   here to refresh its installed copy.
3. setup a `.env` file and add `BREADITOR_DEV_MODE=true` maybe. And then the following:
```
MAIN_WINDOW_X=
MAIN_WINDOW_Y=
MAIN_WINDOW_W=
MAIN_WINDOW_H=

INSPECTOR_WINDOW_X=
INSPECTOR_WINDOW_Y=
INSPECTOR_WINDOW_W=
INSPECTOR_WINDOW_H=
```
with the appropriate values so they auto-spawn iun a convenient place.

4. `yarn start` launches the app. For development, `yarn dev` builds, launches
   Electron, and watches for edits.
   Saving files under `src/` (including CSS, HTML, and preload scripts), `.env`,
   `tsconfig.json`, or the esbuild configuration rebuilds and shows a
   "New changes are available" toast. Click **Reload** to apply the changes.
   Renderer and preload edits reload the view in the existing window, keeping
   Electron and DevTools running. Main-process, shared-code, or configuration
   edits offer **Restart app** instead. In-memory renderer state resets on reload.
   Failed builds keep the running app open and retry on the next edit; the action
   is offered only after a successful build. Closing the app or pressing
   Ctrl+C stops the watcher. Use `yarn iterate` to also run React DevTools.

The **Sprite C** document previews the library's bundled Lord Stan sprite using
WebGL 2. Select an animation, pause/resume, restart, or choose an integer zoom.
Sprite documents load Crusty JSON from `filepath` and resolve the atlas relative
to it; `crustacean_json` and `crustacean_image` can override the definition and
atlas. `spriteMaker(title, filepath)` creates a preview for another definition.
Artwork attribution and the library license ship with the sample assets.

## Crustacean maps

**Map A** opens the bundled Farmsville map, including all referenced scenery,
characters, tilesets and images. **Map D** is an independent empty map. Open other
`.map.json` files with File → Open Document; New Map and recent maps are in File.
Farmsville asset provenance and SHA-256 hashes are in `assets/sully`.

Map controls provide pan, cursor-anchored zoom, fit, animation pause, brush/stamps,
fill, selection, eyedroppers, entity dragging, clipboard, undo/redo and export.
The dockable Layers, Tileset, Entities, Zones, Info and Screenview panels edit
map properties and overlays. Drag a rectangle in the tile palette to select a
stamp. Import a tileset definition in Tileset before painting an empty map.
Alt-drag entities to snap to the map grid.

Shortcuts while the viewport is focused: Space/middle button pan, B brush,
G fill, M select, I eyedropper, Shift+I smart eyedropper, V/E entity drag,
Z zones, O obstructions, 1–9 art layer, X swap tiles. Ctrl+Z/Shift+Ctrl+Z undo/redo,
Ctrl+C/X/V clipboard, Shift+Ctrl+X/V multilayer cut/paste, Ctrl+A select all,
Ctrl+0 reset, Escape cancel. Ctrl+N/O/S and Shift+Ctrl+S create/open/save/save as.
Normal text editing shortcuts remain available in fields.

Save writes the map/data pair; the bundled demo first asks for Save As. Save As
rebases dependency references. Export project copies all dependencies into an
adjacent `.assets` directory. Export PNG renders the full map at its native size.
Writes retain `.breaditor-stage-*`, `.breaditor-backup-*` and recovery journals;
failed transactions restore existing files where possible and report recovery
paths. No recovery files are removed automatically.

Local definitions and images are watched. Clean JSON changes reload the map;
image changes refresh pixels; dirty JSON conflicts retain edits and offer Reload
or Save As. Incomplete external saves retain the last good scene. View settings,
camera and document edits survive switching tabs.

Legacy maps retain their existing representation and unknown fields, including
unused tile arrays. Explicit conversion in Layers enables `format_version: 2`,
map grid dimensions/tile size and multiple named obstruction layers. Each layer
binds one tileset; obstruction masks combine independently of overlay visibility.
Extended maps require a new save destination and are not supported by the existing
Sully runtime. Game scripts remain references and do not execute in the editor.

Validate with `yarn test`, `yarn tsc --noEmit`, `yarn test:map`, and the sibling
library's `npm test`. Verify packaged sample hashes with
`node build-infrastructure/sully-assets.js --verify dist/app/assets/sully`.
The implementation roadmap and resolved decisions are in `CRUSTACEAN-MAP-PLAN.md`.



# electron-from-scratch

Screw boilerplates, let's do this piece by piece!

[![Our Tests](https://github.com/mcgrue/electron-from-scratch/actions/workflows/test.yml/badge.svg)](https://github.com/mcgrue/electron-from-scratch/actions/workflows/test.yml)

/dist/ is for US to make artifacts to (via esbuild) /build/ is for
ELECTRONBUILDER to take /dist/ and repackage

## TODO

- esbuild -> (dont minifify, do output sourcemaps: gives you code coverage!)
- nyc (code coverage)
- jest

- implement packaage.json's scripts.build-types

* Currently, src/main/index.ts is the only "hardpoint" for the node server code,
  as defined in build-infrastructre/esbuild.js 's `entryPoints`

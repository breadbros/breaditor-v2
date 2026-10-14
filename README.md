# Startup
1. install Node 22+ and yarn (the sprite library requires SSH access to its GitHub repository)
2. `yarn`
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

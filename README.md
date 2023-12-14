# Startup
1. install yarn
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

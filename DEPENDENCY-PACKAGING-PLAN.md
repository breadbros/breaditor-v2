# Reproducible map dependencies and CI

## Changes

- Match the sprite library's distribution model: commit generated ESM/declarations in the map library and check output freshness in CI. Avoid Git-install build lifecycle hooks.
- Replace every map/sprite sibling dependency with an immutable HTTPS Git commit. Keep one installed sprite implementation through the map library peer dependency.
- Validate frozen Yarn installation, types, build and tests from a retained standalone Breaditor snapshot with no sibling projects.
- Add map-library Linux/Windows CI, installed-package consumer checks and deterministic bridge/waterfall/canopy visual fixtures.
- Publish only the library code needed to make the Git dependency reachable; preserve the user's unrelated committed debugger configuration and local history.

## Validation

- Library: clean npm install, tests, fresh generated output, isolated tarball/Git consumers and CI.
- Breaditor: frozen clean install, types, production asset verification, full tests and software WebGL visual fixtures.
- Keep fixture expectations independent of the renderer output; retain failure captures. Existing tests remain unchanged unless separately approved.

# HUMAN QUESTIONS

No open decisions. Both dependency repositories are public. The new library's initially empty remote required a scoped publication branch for a usable remote commit pin. Publishing unrelated debugger configuration is excluded.

## Status

Library distribution is published on `packaging/reproducible-installs` at `75aab6a197fb2297adf74dd285c6b93677accd4a`, excluding unrelated local debugger configuration. Linux and Windows library CI passed, including build freshness and installed tarball consumers.

Breaditor passed isolated validation on Node 22.23.3 with a fresh dependency cache, no sibling projects, and SSH disabled: frozen install without lockfile changes, types, production build, all 107 asset hashes, and all 252 tests across 39 suites. The same standalone checkout passed eight exact-pixel WebGL frames across three independent bridge/waterfall/canopy fixtures.

Library CI: https://github.com/mcgrue/crustacean-map-lib/actions/runs/38848282878

Retained standalone evidence: `C:\Users\benmc\AppData\Local\Temp\breaditor-clean-install-Yld4wX`; visual evidence: `C:\Users\benmc\AppData\Local\Temp\breaditor-map-visual-stYDe7`. Retained validation directories will not be deleted automatically. Historical Sully visual parity still requires human review; the authored fixtures assert rendering behavior rather than game screenshots.

---
name: capture-running-instance-screenshot
description: Capture and show a screenshot of the currently running Breaditor v2 instance on Windows, using its visible Electron window when available and a safe desktop-capture fallback when it is not.
---

# Capture Breaditor v2 Running Instance Screenshot

Use this skill when the user asks to see, show, or capture the currently running Breaditor v2 app from this repository.

This skill currently supports Windows only. Extend it with platform-specific process discovery and screen-capture workflows for macOS and Linux in the future.

## Workflow

1. Inspect the active UI surfaces with Computer Use. Prefer the existing visible app window; do not launch, close, restart, or modify the app merely to obtain a screenshot.
2. If a native window handle is available, bind to the exact matching window and emit its screenshot.
3. If native UI binding is unavailable, identify the Breaditor v2 instance with read-only process inspection. Prefer a combination of:
   - process type or executable, such as `electron`;
   - exact window title, such as `breaditor`;
   - executable path or working directory under the current Breaditor v2 repository root, resolved from the active workspace rather than a machine-specific absolute path.
4. Capture the primary desktop to a temporary PNG with the platform's available screen-capture mechanism. On Windows, use `System.Windows.Forms.Screen` and `System.Drawing.Graphics.CopyFromScreen`; keep the capture outside the repository.
5. Inspect and emit the image through the image viewer. State clearly whether the result is a window-specific capture or a full-screen fallback.

## Selection Rules

- Match the requested app and project, not merely the first Electron, Node, or browser process.
- When multiple matching instances exist, use the exact title/path and report ambiguity rather than guessing.
- Treat process inspection and screenshot capture as read-only; do not alter app state.
- If no matching running instance can be found, say so and ask whether the user wants the app started.

## Result

Return the screenshot directly with a brief note identifying the captured app and capture scope. Do not include implementation details unless the user asks for the selector or methodology.

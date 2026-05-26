# Stage 19E5 — GitHub project state export + left-panel refresh fix

This stage fixes a GitHub project switching bug where the source editor could show the newly opened GitHub project while the left Source tree/file panel still showed the previously loaded project.

Root cause: `resetProjectClean` and `replaceProjectFromExternalSource` existed inside `js/state.js` but were not exported on `LuminaLatex.State`, so `js/file-tree.js` could fall back to the older `resetProject` path. That path may invoke the full-project guard and re-merge stale cached files from the previous project.

Fixes:

- Exports `resetProjectClean` and `replaceProjectFromExternalSource` from `LuminaLatex.State`.
- Makes Open GitHub require the clean replacement API instead of falling back to stale reset behavior.
- Clears the left file tree DOM before forced repaint.
- Schedules additional repaint passes after GitHub open.
- Updates stage labels/cache-busters to Stage 19E5.

Changed files:

- `index.html`
- `js/state.js`
- `js/file-tree.js`
- `js/main.js`

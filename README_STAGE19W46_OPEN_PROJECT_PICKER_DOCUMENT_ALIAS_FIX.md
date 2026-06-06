# Stage 19W46 — Open Project picker document alias fix

Fixes the Open Project modal crash `Can't find variable: D` by restoring the document alias used by the modal DOM helpers in `js/file-tree.js`.

## Changed
- Defines `const D = document;` in the file-tree module scope.
- Cache-busts `file-tree.js` and `main.js` with the Stage 19W46 version string.

## Verify
```bash
node --check js/file-tree.js
node --check js/main.js
```

After deployment reload with `?v=stage19w46` and click **Open Project**. The modal should open immediately.

# Stage 19W24 — Disable selection action bubble

Expected marker:

```text
latex-stage19w24-disable-selection-action-bubble-20260604-1
```

## What changed

- Removed the old floating black selection action bubble from `index.html`.
- Removed loading of `js/selection-action-bubble.js`.
- Removed loading of the old selection bubble stylesheet.
- Added a defensive CSS guard that hides `#laiSelectionActionBubble` if stale cached markup exists.
- Selected-text AI edit workflows should now go through Paper AI with review/debate rounds `-1` or through explicit editor helpers, not through the floating toolbar.

## Test

1. Hard refresh the app.
2. Select text in the source editor.
3. Confirm the black toolbar with `Rewrite / Improve / Ask rewrite` does not appear.
4. Confirm normal selection still works and editor helper buttons still work.

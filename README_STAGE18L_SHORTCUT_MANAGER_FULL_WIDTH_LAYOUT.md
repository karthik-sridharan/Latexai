# Stage 18L — Shortcut manager full-width layout

Stage: `stage18l-shortcut-manager-full-width-layout-1`

This stage fixes the Settings → Editor shortcut manager layout in the narrow right panel.

## What changed

- The shortcut manager card no longer inherits the generic two-column `.backend-status-card` layout.
- The main shortcut editor now takes the full width of the right panel.
- Custom shortcut rows render as stacked full-width form cards instead of a wide table that gets clipped.
- Template/environment fields expand to the available panel width.
- Save/reset/export/import/copy buttons wrap across the full width of the card.
- The Stage 18H stable textarea editor and Stage 18K live custom shortcut behavior are preserved.

## Test

```bash
node --check js/editor-enhancement-service.js
node --check js/safe-mode-service.js
node tests/stage18l-shortcut-manager-full-width-layout.test.cjs
```

# Stage 19W47 — Hide empty Settings drawers

This frontend cleanup removes the empty Settings drawers that became visible after the backend-compiler-only/project-workspace cleanup.

## Why this was needed

The Settings right-panel organizer still had legacy drawer definitions for:

- Reports / Reviews
- Other settings / advanced

After reports moved to project/workflow surfaces and local compile/WASM/TeXlyre options were removed, these drawers could render with zero cards.

## Changes

- Removed the legacy Settings `Reports / Reviews` drawer.
- Kept the catch-all `Other settings / advanced` drawer for future orphan settings, but hides it automatically when it has no cards.
- Cache-busted `right-panel-organizer-service.js`.
- Updated the app stage marker to Stage 19W47.

## Verification

```bash
node --check js/right-panel-organizer-service.js
node --check js/main.js
```

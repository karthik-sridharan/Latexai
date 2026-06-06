# LatexAI Stage 19W48 — Settings drawer badge cleanup

This stage cleans up Settings drawers after the backend-compiler-only UI simplification.

## Changes

- Removes the numerical badges from Settings drawer headers.
  - The old numbers were implementation counts of moved DOM children.
  - They were not reliable feature counts and could include hidden/debug-only controls.
- Hides empty catch-all drawers based on meaningful user-facing controls, not raw DOM child count.
- Prevents hidden debug-only Settings blocks from making `Other settings / advanced` appear with a misleading count.
- Cache-busts `right-panel-organizer-service.js`.

## Expected behavior

In Settings, the visible drawers should now be only the ones that contain real controls, such as:

- AI / memory backends
- GitHub backend / project sync
- Compile backend / engines
- Diagnostics, if it contains real diagnostic cards
- AI / Model configuration, if it contains real model cards

`Other settings / advanced` should not appear when it has no visible controls.

## Verification

```bash
node --check js/right-panel-organizer-service.js
node --check js/main.js
```

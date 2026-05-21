# Stage 17J10 — Right panel organizer scroll containment

Stage: `stage17j10-right-panel-organizer-scroll-containment-1`

This stage fixes the remaining right-panel organizer bug seen on iPad/Safari after Stage 17J9: Expand/Collapse worked, but expanded Settings/Copilot groups revealed only a small clipped portion and the tab frame did not scroll.

Root cause: the active `.right-tab-panel` was a flex-column scroll container. The organizer groups were flex children with default `flex-shrink: 1`, and each group shell used `overflow: hidden`. On constrained viewports, expanded groups shrank instead of increasing the tab panel's `scrollHeight`, so their bodies were clipped.

Fixes:

- Make the Copilot and Settings active tab panels block scrollports, not flex columns.
- Force `flex: 1 1 0`, `height: 0`, `min-height: 0`, and `overflow-y: auto` for those tab panels.
- Force organizer toolbar/groups to `flex: 0 0 auto` so expanded groups keep natural height.
- Set open group shells and bodies to visible overflow and uncapped height.
- Add JS inline fallbacks for the same rules so the fix survives CSS order/cache issues on iPad Safari.

Verification:

```bash
node --check js/right-panel-organizer-service.js
node tests/stage17j9-right-panel-organizer-visible-catchall.test.cjs
node tests/stage17j10-right-panel-scroll-containment.test.cjs
python3 tests/stage17j10-chromium-scroll-harness.py
```

Expected visual behavior:

- In Settings, expand `Compile / backend settings`.
- The whole section body should remain full height instead of clipping after the first few controls.
- The Settings tab itself should scroll vertically to show all Compile/backend controls and the lower Settings groups.
- The same should hold in Copilot.

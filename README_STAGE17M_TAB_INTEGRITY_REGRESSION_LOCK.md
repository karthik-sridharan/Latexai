# Stage 17M — Tab integrity regression lock

Stage string: `stage17m-tab-integrity-regression-lock-1`

This stage locks right-panel tab ownership so organizer passes cannot silently move cards between Copilot, Settings, and Figures.

## Why

Stage 17L restored the dedicated Figures tab after the organizer had previously moved drawing/TikZ cards into Copilot. Stage 17M adds a regression lock so the same class of bug is reported and blocked in the future.

## Changes

- Adds a known-card ownership map in `js/right-panel-organizer-service.js`.
- Refuses to move cards unless the source panel and destination panel are the same right-panel tab.
- Refuses to group known cards when they are in a tab that does not own them.
- Keeps Figures tools owned by `assetsTab`:
  - Draw figure
  - AI TikZ maker
  - Image → TikZ remaker
  - Image assets
  - Snippet preview
  - Project images
- Adds `tabIntegritySummary()` to the organizer service.
- Extends Copy report with:
  - per-tab card counts,
  - misplaced known-card diagnostics,
  - Figures tab tool health,
  - scroll/hit-test diagnostics for the Figures tab when present.
- Migrates section open/collapsed state from Stage 17L key `latexai:right-panel-sections:v6` to Stage 17M key `latexai:right-panel-sections:v7`.

## Browser verification

The Chromium regression harness verifies:

- Copilot expand/collapse still works.
- Settings expand/collapse still works.
- The Figures tab remains active and visible when selected.
- `figureEditorCard`, `tikzMakerCard`, and `imageToTikzCard` remain in `assetsTab`.
- Copy report says `Tab integrity: ok` and `Figures tab tools: ok`.
- A deliberately misplaced Draw figure card is reported as misplaced and is not moved into Copilot's organizer group.

## Deploy URL

```txt
https://karthik-sridharan.github.io/Latexai/?v=stage17m-tab-integrity-regression-lock-1
```

## Tests

```bash
node --check js/right-panel-organizer-service.js
node --check js/asset-service.js
node --check js/figure-editor-service.js
node tests/stage17m-tab-integrity-regression-lock.test.cjs
python3 tests/stage17m-chromium-tab-integrity-regression-lock.py
```

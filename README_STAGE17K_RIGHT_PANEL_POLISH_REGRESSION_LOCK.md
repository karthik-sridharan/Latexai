# Stage 17K — Right panel polish + regression lock

Stage string:

```text
stage17k-right-panel-polish-regression-lock-1
```

This stage builds on Stage 17J10, where expand/collapse and Settings/Copilot scrolling were finally fixed.

## What changed

- Preserves collapsed/expanded section state across re-organize passes and page reloads.
- Migrates the Stage 17J10 section state key:

```text
latexai:right-panel-sections:v5 -> latexai:right-panel-sections:v6
```

- Adds a storage fallback so the organizer still works when `localStorage` is blocked or unavailable.
- Makes the organizer toolbar more compact:
  - two-column button grid,
  - shorter “Refresh” and “Report” controls,
  - status text on a small line below the buttons.
- Keeps the Stage 17J10 scroll containment fix:
  - Settings/Copilot tabs are block scrollports,
  - expanded groups use natural height,
  - the tab panel scrolls instead of clipping group contents.
- Expands the copied report with diagnostics:
  - active right tab,
  - boot overlay presence/error count,
  - Copilot/Settings scroll height and client height,
  - whether each tab is scrollable,
  - visible ungrouped direct children,
  - toolbar hit-test result.

## Files changed

- `index.html`
- `css/lai-stage17j-right-panel-sections.css`
- `js/right-panel-organizer-service.js`
- `tests/stage17k-right-panel-polish-regression-lock.test.cjs`
- `tests/stage17k-chromium-right-panel-regression-lock.py`

## Verification run

```bash
node --check js/right-panel-organizer-service.js
node tests/stage17k-right-panel-polish-regression-lock.test.cjs
python3 tests/stage17k-chromium-right-panel-regression-lock.py
```

The Chromium regression harness checks:

- Stage 17J10 persisted state is migrated.
- Settings collapse all works.
- Individual Settings section header toggles.
- Expanded Settings section scrolls instead of clipping.
- No boot error overlay is intercepting clicks.
- No visible direct children remain outside organizer groups.
- The copied report includes the new diagnostic lines.

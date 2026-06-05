# Stage 19W29 — Settings GitHub drawers cleanup

Baseline: `latexai-frontend-stage19w28-settings-github-backend-restore-full-source.zip`.

This stage reapplies the Settings drawer cleanup on top of the latest Stage 19W28 frontend, not the old 19U9M baseline.

## What changed

- Restored the Settings drawer UI, but only for the Settings tab.
- Split Settings into clean drawers:
  - **AI / memory backends**
  - **GitHub backend / project sync**
  - **Compile backend / engines**
  - diagnostics/model/advanced catch-all drawers
- Added stable IDs to the Settings notes so the organizer no longer sweeps every `.settings-note` into one broad drawer.
- Moved GitHub backend URL, note, and GitHub backend status card into the dedicated GitHub drawer.
- Kept Copilot/workflow panels unwrapped because those have moved to the newer right-tab/left-panel workflow layout.
- Replaced raw GitHub REST `404` JSON popups with actionable repo/branch/folder/token guidance.
- Added Stage 19W29 regression checks.

## Changed files

- `index.html`
- `css/lai-stage17j-right-panel-sections.css`
- `js/right-panel-organizer-service.js`
- `js/file-tree.js`
- `tests/stage19w29-settings-github-drawers-cleanup.test.cjs`
- `README_STAGE19W29_SETTINGS_GITHUB_DRAWERS_CLEANUP.md`
- `README_CHANGED_FILES.md`

## Verification

Run:

```bash
node --check js/right-panel-organizer-service.js
node --check js/file-tree.js
node --check js/backend-url-settings-service.js
node tests/stage19w29-settings-github-drawers-cleanup.test.cjs
```

Expected result: all checks pass.

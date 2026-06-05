# Stage 19W29 changed files only

Baseline: `latexai-frontend-stage19w28-settings-github-backend-restore-full-source.zip`.

Upload/replace only these files in the frontend repo:

- `index.html`
- `css/lai-stage17j-right-panel-sections.css`
- `js/right-panel-organizer-service.js`
- `js/file-tree.js`
- `tests/stage19w29-settings-github-drawers-cleanup.test.cjs`
- `README_STAGE19W29_SETTINGS_GITHUB_DRAWERS_CLEANUP.md`
- `README_CHANGED_FILES.md`

Do not use the earlier Stage 19U9M patch. This Stage 19W29 patch is based on the latest Stage 19W28 frontend.

## Checks

```bash
node --check js/right-panel-organizer-service.js
node --check js/file-tree.js
node --check js/backend-url-settings-service.js
node tests/stage19w29-settings-github-drawers-cleanup.test.cjs
```

# Latexai clean GitHub integration changed files

Upload/replace only these files in your GitHub repo:

- `index.html`
- `js/project-model.js`
- `js/file-tree.js`

This removes the temporary `lai-*` overlay scripts from `index.html`.
It makes the normal left Source tree the single integrated GitHub-aware tree.

What changed:
- `project-model.js` now supports GitHub backend projects where `files` is an object:
  `{ "main.tex": "...", "sections/intro.tex": "..." }`.
- `file-tree.js` now owns GitHub Check/Load/Commit directly in the normal Source tree.
- GitHub Load calls `State.resetProject(...)`, so the canonical app state has all files.
- The normal editor, import, export, compile, and commit paths all use the same `NS.State.state.project.files`.
- No overlay/watchdog/direct-loader file-tree patches are loaded.

Open after upload:
`https://karthik-sridharan.github.io/Latexai/?v=stage3i-clean-github-filetree-1`

Expected:
- Left Source tree shows `Project files`.
- Tap `Git` to enter backend URL/owner/repo/branch/root path.
- Tap `Load`.
- The same normal tree should list all files returned by the backend.
- `Commit` commits all files in the normal project state.

## Stage 19N1Q3 sticky provider/model route selects

Changed files:
- `index.html`
- `js/model-provider-service.js`
- `js/model-registry-service.js`
- `README_STAGE19N1Q3_STICKY_MODEL_ROUTE_SELECTS.md`

Fixes the Settings → Model/provider routing dropdowns so provider changes persist, model dropdowns switch to the selected provider's models, and model-registry refreshes no longer restore stale OpenAI routes while the user is editing.


## Stage 19N1R3
- index.html
- js/real-agent-branch-workflow-service.js
- README_STAGE19N1R3_EXPLICIT_DEVILS_ACTION_LABELS.md

## Stage 19U9M settings GitHub drawer polish
- `index.html`
- `js/right-panel-organizer-service.js`
- `js/backend-url-settings-service.js`
- `js/file-tree.js`
- `css/lai-stage17j-right-panel-sections.css`
- `tests/stage19u9m-settings-github-drawer-polish.test.cjs`
- `README_STAGE19U9M_SETTINGS_GITHUB_DRAWER_POLISH.md`

Keeps the right-panel drawer UI, splits Settings into cleaner backend-specific drawers, moves GitHub backend configuration into its own drawer with a Test GitHub backend button, and turns raw GitHub 404/ref failures into branch/repo/token/folder-path guidance.

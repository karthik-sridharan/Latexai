# Stage 19U9M — Settings GitHub Drawer Polish

This stage keeps the right-panel drawer/section UI, but cleans up the Settings tab so GitHub backend configuration no longer falls into the generic “Other Settings controls” drawer.

## What changed

- Added a dedicated **GitHub backend / project sync** Settings drawer.
- Moved the GitHub backend URL, its explanatory note, and a new GitHub backend status card into that drawer.
- Split the old broad Settings drawer into:
  - **AI / memory backends**
  - **GitHub backend / project sync**
  - **Compile backend / engines**
- Stopped the organizer from using the broad `#settingsTab > .settings-note` selector, which could make notes land in the wrong drawer.
- Added a **Test GitHub backend** button in Settings that checks `/status` on the configured GitHub sync backend.
- Made raw GitHub 404/ref errors more actionable by pointing users to branch, repo/token visibility, and folder-path checks.
- Added CSS polish for Settings drawer form rows, notes, and status cards so the drawer layout remains clean on iPad-sized screens.

## Changed files

- `index.html`
- `js/right-panel-organizer-service.js`
- `js/backend-url-settings-service.js`
- `js/file-tree.js`
- `css/lai-stage17j-right-panel-sections.css`
- `tests/stage19u9m-settings-github-drawer-polish.test.cjs`

## Verification

Run:

```bash
node --check js/right-panel-organizer-service.js
node --check js/backend-url-settings-service.js
node --check js/file-tree.js
node tests/stage19u9m-settings-github-drawer-polish.test.cjs
```

Expected result: all checks pass.

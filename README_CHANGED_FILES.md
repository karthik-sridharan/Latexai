# Changed files — Stage 19W35

Apply these files on top of Stage 19W34 / latest frontend.

Files:

- `index.html`
- `js/file-tree.js`
- `js/main.js`
- `js/backend-url-settings-service.js`
- `tests/stage19w35-github-new-project-stale-owner-fix.test.cjs`
- `README_STAGE19W35_GITHUB_NEW_PROJECT_STALE_OWNER_FIX.md`
- `README_CHANGED_FILES.md`

Main functional fix:

- `New project` no longer leaks the previously opened/attached GitHub `owner` and `rootPath` into `/create-project-repo`.
- A deliberately blank Open-GitHub branch is preserved so the frontend can try the backend/default branch path.

# Stage 19E2 — Open GitHub Load Apply Fix

This frontend-only hotfix strengthens the existing GitHub project opening workflow.

## Fixes

- Makes the file-tree `Load` button clearer as `Load attached`.
- If no attached owner/repo exists, `Load attached` now opens the same prompt as `Open GitHub` instead of failing silently.
- Adds explicit success/failure alerts for the prompt-based GitHub open workflow, useful on iPad where console/status details are hard to inspect.
- Normalizes several possible GitHub backend load payload shapes before resetting project state.
- Forces the editor, file tree, preview, and local full-project cache to refresh after a GitHub project is opened, preventing old project text/panels from remaining visible after a successful load.

## Changed files

- `index.html`
- `js/file-tree.js`
- `js/main.js`

## Test

Open:

```text
https://karthik-sridharan.github.io/Latexai/?v=19e2
```

Then click `Open GitHub`, enter `owner/repo`, branch `main`, and blank folder path unless the project is inside a subfolder. A successful load should show an alert with repo, file count, and root file, and the source editor/file tree should immediately switch to the GitHub project.

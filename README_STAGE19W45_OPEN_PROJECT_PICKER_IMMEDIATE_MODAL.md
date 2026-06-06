# Stage 19W45 — Open Project picker immediate modal

Fixes the Open Project button appearing to do nothing when the GitHub project list request is slow, blocked, or failing.

## Changes

- `Open Project` now opens the picker modal immediately.
- The modal shows a loading state while repositories are fetched.
- Users can type `owner/repo` and use **Open typed path** without waiting for the project list.
- If listing projects fails, the error is shown inside the modal and typed-path open remains available.
- The Open Project top-action handler now surfaces unexpected exceptions in an alert instead of failing silently.
- Cache-busts `file-tree.js` and `main.js` to ensure Safari/GitHub Pages do not keep the old click behavior.

## Deploy

Replace the changed files in GitHub Pages, then reload with:

```text
https://karthik-sridharan.github.io/Latexai/?v=stage19w45
```


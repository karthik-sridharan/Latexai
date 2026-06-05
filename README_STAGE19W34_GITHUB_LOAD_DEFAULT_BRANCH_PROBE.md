# Stage 19W34 — GitHub load default-branch probe and new-project owner regression fix

Frontend-only patch on top of Stage 19W33.

## Diagnosis from the frontend trace

`Project -> Open GitHub` is reaching the correct GitHub sync backend route:

- `POST /api/lumina/github/load-project`
- payload: `{ owner, repo, branch, rootPath }`

The reported 404 is coming back from the backend after its GitHub REST `git/refs` lookup, not from a missing frontend route.

## Changes

- Keeps the Stage 19W33 frontend GitHub trace.
- Adds load probes so `Open GitHub` tries:
  1. the selected branch,
  2. a request with `branch` omitted so the backend can use the repository/default branch if supported,
  3. common fallbacks: `main`, `master`, `gh-pages`.
- Allows the branch prompt to be left blank instead of forcing blank back to `main`.
- Fixes the Stage 19W33 new-project regression: the normal user-account repo creation path no longer passes `owner`, because the GitHub sync backend historically creates under the authenticated token user when owner is blank. Passing a username can make some backends treat it as an org and return GitHub's plain `Not Found`.
- Cache-busts the updated scripts with the Stage 19W34 version string.

## Verification

```bash
node --check js/file-tree.js
node --check js/main.js
node --check js/backend-url-settings-service.js
```

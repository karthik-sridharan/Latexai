# Stage 19W36 — GitHub backend contract diagnostics

This patch keeps the Stage 19W35 GitHub trace and tightens the browser/backend contract for GitHub project creation.

## What changed

- New Project no longer sends `owner: ""` in the primary `/create-project-repo` request.
  - The primary request omits `owner` entirely so the GitHub sync backend can create under the authenticated token user.
  - A legacy retry with `owner: ""` is retained only if the primary request returns a plain backend `404 Not Found`.
- GitHub create failures now probe `/status` and include backend stage/token information in the trace.
- GitHub load failures now also probe `/status`, so a load error distinguishes:
  - the frontend reached the GitHub backend, from
  - the backend returned a GitHub refs error for the selected repo/branch.
- Error text now explicitly flags the likely case where the Settings GitHub backend URL points at an older status/load-only backend instead of the Stage 19C+ GitHub sync backend with `/create-project-repo`.
- Cache bust updated to `stage19w36-github-backend-contract-diagnostics-20260605-1`.

## Why

The latest trace showed that the frontend correctly reached:

```text
POST <github-backend>/api/lumina/github/create-project-repo
```

but the backend responded with a plain `404 Not Found`. That is different from a GitHub repo/branch refs 404 and usually means the active GitHub backend URL is an older or mismatched Cloud Run service that does not expose the create-project route.

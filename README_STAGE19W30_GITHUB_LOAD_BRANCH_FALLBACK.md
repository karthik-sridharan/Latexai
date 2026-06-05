# Stage 19W30 — GitHub load branch fallback and stale attachment cleanup

This patch is applied on top of Stage 19W29 / the latest Stage 19W28 frontend baseline, not the old 19U9M source.

## Why this stage exists

The Settings → Test GitHub backend button can succeed while Project → Open GitHub / Load attached still fails. The backend test only confirms that the GitHub sync Cloud Run endpoint is reachable and that the backend reports token status. Loading a project also requires the selected `owner/repo`, branch, folder path, and token permissions to match a real repository.

The screenshot showed a load failure for `karthik-sridharan/pred @ main` even though the backend test worked. That is consistent with a repository/branch/folder/token lookup issue, or with a stale GitHub attachment saved in browser local state.

## Changes

- Clarifies Settings GitHub backend text so a successful backend test is not confused with a successful repository import.
- Adds automatic branch fallback for GitHub project load:
  - if `main` 404s, it retries `master` and `gh-pages`;
  - if `master` 404s, it retries `main` and `gh-pages`;
  - otherwise it retries common defaults.
- Adds a Source tree **Detach** button to clear a stale local GitHub attachment without deleting files or any GitHub repository.
- Improves GitHub load error text with tried branches and a reminder that backend health and repo lookup are separate.
- Preserves the cleaned Settings drawer organization from Stage 19W29.

## Verification

```bash
node --check js/file-tree.js
node --check js/backend-url-settings-service.js
node --check js/right-panel-organizer-service.js
node tests/stage19w30-github-load-branch-fallback.test.cjs
```

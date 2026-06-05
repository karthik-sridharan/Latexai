# Changed files — Stage 19W36

Changed relative to Stage 19W35:

- `index.html`
  - cache-busts frontend scripts to Stage 19W36.
- `js/file-tree.js`
  - omits blank `owner` from the primary New Project `/create-project-repo` request;
  - retries once with legacy `owner: ""` if the backend returns plain `404 Not Found`;
  - probes `/status` on GitHub load/create failures and includes backend stage/token status in the trace.
- `tests/stage19w36-github-backend-contract-diagnostics.test.cjs`
  - regression checks for the frontend/backend contract diagnostics.
- `README_STAGE19W36_GITHUB_BACKEND_CONTRACT_DIAGNOSTICS.md`
  - patch notes.

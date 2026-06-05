# Stage 19W33 — GitHub flow trace + New project GitHub diagnostics

Built on Stage 19W31/latest frontend baseline with the old non-fallback GitHub load behavior preserved.

What changed:

- Cache-busts `js/file-tree.js`, `js/backend-url-settings-service.js`, and `js/main.js` in `index.html` so iPad/Safari cannot keep running stale Stage 19W30 GitHub code.
- Adds a frontend GitHub trace at `window.LuminaLatex.__githubOpenTrace`.
- Logs the exact frontend request path, URL, status, and sanitized payload for:
  - `POST /api/lumina/github/load-project`
  - `POST /api/lumina/github/create-project-repo`
  - save/checkpoint GitHub calls
- GitHub load failure alerts now include the exact frontend endpoint and payload.
- New project now prompts for the GitHub owner/org and passes it explicitly into `create-project-repo` rather than relying on hidden/stale Git settings or backend inference.
- New project failure alerts now include the recent frontend GitHub trace.

Important trace path:

`Project -> Open GitHub` -> `NS.FileTree.promptOpenGithubProject()` -> `loadFromGithub({ fromPrompt: true })` -> `gitFetch('/load-project', { owner, repo, branch, rootPath })`.

No GitHub token is sent by the browser. The token remains backend-only.

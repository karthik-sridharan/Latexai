# Stage 19E — Open Existing GitHub Project

Frontend-only stage.

## What changed

- Adds an **Open GitHub** top-bar button.
- Adds an **Open GitHub** action in the project file/Git controls.
- Lets the user enter `owner/repo` or a GitHub URL, branch, and optional folder path.
- Loads the existing repository through the existing GitHub backend `/load-project` endpoint.
- Replaces the active local project with the loaded repo while preserving backend/API settings.
- Clears stale full-project cache through `resetProjectClean` to avoid old files merging into the opened repo.
- Restores GitHub metadata: owner, repo, branch, root path, and head SHA.
- Assigns deterministic GitHub-based `projectId`/`paperId` so memory scopes reconnect across reopen.
- Updates competitive-review and reviewer/rebuttal memory identity to prefer GitHub repo identity over transient local IDs.

## Backend

No backend redeploy is needed if the Stage 19C GitHub backend is already deployed, because it already provides:

- `POST /api/lumina/github/load-project`
- `POST /api/lumina/github/autosave-commit`
- `POST /api/lumina/github/create-project-repo`

## Expected UI

After upload, open:

```text
https://karthik-sridharan.github.io/Latexai/?v=19e
```

You should see:

- Top bar: `New project`, `Open GitHub`, `Save local`, ...
- Project file panel Git controls: `Check`, `Load`, `Open GitHub`, `Save GitHub`, `Checkpoint`


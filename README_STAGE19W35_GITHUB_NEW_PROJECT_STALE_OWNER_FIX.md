# Stage 19W35 — GitHub new-project stale owner fix + trace interpretation

Built on Stage 19W34.

## Fixes

- `New project` no longer inherits the last attached/opened GitHub owner/repo when calling `/create-project-repo`.
- New project now sends `owner: ""` unless an owner/org is explicitly provided by the caller, preserving the Stage 19C backend contract: create under the authenticated token user.
- New project no longer inherits stale `rootPath` from the currently attached repo.
- GitHub branch setting preserves a deliberately blank branch instead of silently persisting `main`.
- Keeps Stage 19W34 GitHub request tracing so failures show the exact frontend request URL and sanitized payload.

## Trace conclusion

The reported `Open GitHub` trace shows the frontend is posting to:

```text
POST <github-backend>/api/lumina/github/load-project
{ owner: "karthik-sridharan", repo: "pred", branch: "main", rootPath: "" }
```

That is the intended frontend endpoint and payload. The `git/refs` 404 is produced by the GitHub sync backend/GitHub API after receiving the request.

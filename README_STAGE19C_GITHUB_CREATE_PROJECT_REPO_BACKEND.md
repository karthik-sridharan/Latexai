# Stage 19C GitHub Backend — Create Project Repository

Adds `POST /api/lumina/github/create-project-repo`.

The endpoint:

1. Uses the server-side `GITHUB_TOKEN`.
2. Creates a private GitHub repository matching the Latexai project/repo name.
3. Auto-initializes the repository.
4. Commits the supplied Latexai project files into the new repo.
5. Returns owner/repo/branch/headSha metadata for the frontend.

Deploy this GitHub sync backend update to the service used by the frontend GitHub backend URL.

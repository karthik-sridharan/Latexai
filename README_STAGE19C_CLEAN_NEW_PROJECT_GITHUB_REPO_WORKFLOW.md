# Stage 19C — Clean New Project + GitHub Repository Workflow

Frontend changes:

- Replaces the old New project action with a clean workflow.
- Prompts for a project name and matching GitHub repository name.
- Preserves backend/API settings by default.
- Clears the stale full-project cache before creating the fresh project, preventing old files from merging into the new project.
- Creates a new GitHub repository through the GitHub sync backend and attaches that repository to the new project.
- The initial project files are committed into the new repository.

GitHub backend requirement:

- Deploy the Stage 19C GitHub sync backend update so `/api/lumina/github/create-project-repo` is available.
- The GitHub backend needs `GITHUB_TOKEN` with permission to create repositories and commit contents.

Upload frontend files preserving paths, then open with `?v=19c`.

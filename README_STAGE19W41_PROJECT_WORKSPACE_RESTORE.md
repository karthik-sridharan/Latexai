# Stage 19W41 — Project workspace identity and memory restore

This stage formalizes the active LatexAI project as a workspace, not just a set of TeX files.

## Frontend changes

- Adds `js/project-workspace-service.js`.
- Adds a visible **Project workspace** card in the left Project panel.
- Computes stable workspace identity:
  - `projectId` for the GitHub repo/root folder workspace.
  - `paperId` for the paper/root file inside that workspace.
- Scans project files for repo-local artifacts:
  - `/reviews/*`
  - `.latexai/*` and `latexai/*`
  - workflow/checkpoint metadata files.
- On GitHub open or GitHub-backed new project creation, calls:
  - `POST /api/lumina/memory/project-restore`
- Stores the restore summary under:
  - `project.meta.projectWorkspace`
- Diagnostics now include the workspace summary.

## Intended behavior

When a different GitHub project is loaded, LatexAI now switches the visible workspace identity and attempts to restore memory/reports/history scoped to that project and paper. GitHub remains the source of truth for files and `/reviews`, while the memory backend remains the source of truth for learned memory and agent trajectories.

Requires backend Stage 19V6 or later for the new `/api/lumina/memory/project-restore` endpoint. If the endpoint is absent, the UI still works and shows files/artifacts, but memory counts show as unavailable.

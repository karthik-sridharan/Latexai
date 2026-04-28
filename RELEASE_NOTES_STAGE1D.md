# Release Notes — Stage 1D Backend Compile Runner

Stage: `latex-stage1d-backend-compile-runner-20260428-1`

## Added

- Real backend TeX Live compile runner.
- Job-based compile pipeline retained from Stage 1C.
- Backend status endpoint and frontend Test Backend UI.
- Dockerfile that installs Node + TeX Live packages.
- Temporary per-compile workspaces with cleanup.
- Configurable compile timeout, project size, file count, PDF size, and log size limits.
- Shell escape blocked by default.
- Asset/base64 project-file path preserved for images/PDF assets.
- Updated architecture contracts for `backendStatus` and SSE compile events.

## Preserved

- Static frontend deployability on GitHub Pages.
- Static fallback to draft validation when no backend is configured.
- Local autosave, file tree, draft preview, compile logs, diagnostics, and provider seams.
- Reserved WebSocket endpoint for future collaboration.

## Not yet included

- Real-time multi-user collaboration.
- Strong per-user sandboxing for public multi-tenant service.
- CodeMirror editor upgrade.
- AI patch preview workflow.

# Stage 19N0b — Main Editor Branch Runner Scroll + Preview Visibility Fix

This frontend-only patch fixes the Stage 19N0 main-editor Devil’s Advocate branch runner on iPad/Safari when the right Copilot panel/card does not scroll far enough to reveal the insertion preview.

## Changed files

- `index.html` — cache-busts the 19N0b CSS/JS assets and updates the displayed stage marker.
- `js/real-agent-branch-workflow-service.js` — adds an always-visible insertion preview dock above the status line and reveals it after preview generation.
- `css/lai-stage19n0-real-agent-branch-workflow.css` — makes the active Copilot tab and branch-runner card explicit touch scrollports and constrains large preview/output blocks.

## Test

1. Deploy these changed files.
2. Open the main app with `?v=19n0b`.
3. Go to `Copilot` → `Devil’s Advocate branch runner`.
4. Keep `dry_run_no_model_calls`.
5. Click `Run full preview`.
6. Confirm that the green status says the insertion preview is prepared and the preview dock appears immediately above the status/output area.
7. Confirm the branch runner card itself can scroll vertically in the right panel.

No backend change is required beyond the already-working 19M3 backend.

# Stage 19N1R2 — readable Devil’s Advocate branch output panel

This frontend hotfix keeps Stage 19N1R / 19N1R1 functionality but fixes the right-panel output formatting.

## Fixes

- Replaces the narrow six-column structured edit schema table with stacked readable cards.
- Prevents schema/table/source previews from wrapping one character per line in iPad/Safari narrow panels.
- Collapses raw targeted insertion source by default so the user first sees the human-readable visual preview.
- Updates cache-busters and the visible frontend badge.

## Changed files

- `index.html`
- `js/real-agent-branch-workflow-service.js`
- `css/lai-stage19n0-real-agent-branch-workflow.css`
- `README_STAGE19N1R2_READABLE_BRANCH_OUTPUT_PANEL.md`

Expected badge:

```text
latex-stage19n1r2-readable-branch-output-panel-20260529-1
```

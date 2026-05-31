# Stage 19T2S — End-to-end regression audit panel

Frontend-only stabilization stage for the Devil's Advocate / rewrite / safe-edit insertion workflow.

Expected badge:

`latex-stage19t2s-end-to-end-regression-audit-panel-20260530-1`

## What changed

- Adds a deterministic **Workflow regression / audit** panel inside the Devil's Advocate card.
- Adds a **Run regression audit** button that checks raw-patch parsing, appendix/section coverage detection, theorem/proof/plain-word coverage, duplicate paragraph detection, and current-source unresolved `\lai` block scanning.
- Adds a **Copy audit snapshot** button for quick debugging.
- Adds a **User-request coverage audit** section to the run dashboard.
- Adds a **Patch-operation summary before apply** section to insertion preview.
- Adds duplicate generated-paragraph warnings to insertion preview.
- Adds a compile-after-edit audit snapshot saved to localStorage under `latexai:stage19t2s:last-compile-regression-snapshot`.
- Extends saved `/reviews` reports with request-coverage and patch-operation summaries.

## Why

Stage 19T2R fixed the missing introduction/appendix coverage failure. 19T2S prevents regressions by making the pipeline visibly auditable:

Focus/query → final raw patch text → safe compiler → targeted/append draft → unresolved `\lai` count → compile snapshot.

## Files changed

- `index.html`
- `js/real-agent-branch-workflow-service.js`
- `css/lai-stage19n0-real-agent-branch-workflow.css`
- `README_STAGE19T2S_END_TO_END_REGRESSION_AUDIT_PANEL.md`

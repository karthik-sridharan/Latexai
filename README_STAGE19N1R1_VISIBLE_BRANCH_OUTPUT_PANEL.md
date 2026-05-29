# Stage 19N1R1 — Visible Branch Workflow Output Panel

This hotfix fixes the Devil's Advocate branch runner UI after Stage 19N1R.

## Problem
The branch runner reported `Real-agent run completed, recorded, and saved locally`, but the detailed output/report was invisible. The output node had the legacy `devils-output` CSS class, which defaults to `display: none` unless the `active` class is present.

## Fix
- `renderSummary(...)` now always adds `active` to `#branchWorkflowOutput`.
- The output panel is visible by default with a placeholder note.
- CSS explicitly forces `#branchWorkflowOutput.branch-workflow-output` to display.
- Cache busters were updated for the service and CSS.

## Expected badge
`latex-stage19n1r1-visible-branch-output-panel-20260529-1`

## Test
1. Open Copilot → Devil's Advocate branch runner.
2. Run `Run selected branch`.
3. After completion, the detailed report should be visible below the green status line:
   - Real-agent branch result
   - Agent outputs
   - Structured editor output schema
   - Visible `\lai` candidates when available
   - Complete saved review artifact/report

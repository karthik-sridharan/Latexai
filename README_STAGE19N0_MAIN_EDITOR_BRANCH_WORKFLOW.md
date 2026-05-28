# Stage 19N0 — Main Editor Real-Agent Branch Workflow

This stage integrates the verified developer-page AlphaGo-style branch workflow into the main Latexai editor UI.

## Changed files

- `index.html`
- `js/real-agent-branch-workflow-service.js`
- `css/lai-stage19n0-real-agent-branch-workflow.css`
- `README_STAGE19N0_MAIN_EDITOR_BRANCH_WORKFLOW.md`

## What it adds

A new card in the Copilot tab:

- `Devil’s Advocate branch runner`
- Plan branch using Stage 19L3–19L6 backend chain
- Run selected branch in dry-run mode or expensive AI proxy mode
- Clean/validate `\lai{...}` results through 19M1
- Preview targeted/append insertion through 19M2
- Apply targeted/append draft to the active editor source
- Record copied/rejected/applied feedback through 19M3

No backend change is required beyond the already deployed Stage 19M3 backend.

## Test

Open `index.html?v=19n0`, go to the Copilot tab, and find **Devil’s Advocate branch runner**.

Recommended first test:

1. Keep `dry_run_no_model_calls` selected.
2. Click `Run full preview`.
3. Verify a selected branch, dry-run result, cleaned `\lai` block, and insertion preview appear.
4. Try `Copy targeted` or `Reject result` to verify feedback recording.

Only switch to `call_ai_proxy_expensive` when ready to spend model calls.

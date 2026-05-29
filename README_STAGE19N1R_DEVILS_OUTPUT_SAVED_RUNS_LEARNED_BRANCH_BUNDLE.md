# Stage 19N1R — Devil's Advocate output, saved runs, and learned branch selection bundle

Frontend stage badge: `latex-stage19n1r-devils-output-saved-runs-learned-branch-bundle-20260529-1`

This bundle combines three skipped/next stages:

1. Actionable final Devil's Advocate output: the branch runner now surfaces a complete run report and keeps the structured editor JSON tied to insertion previews.
2. Save/reload Devil's Advocate runs: runs are saved locally and can also be persisted through the backend `/api/lumina/debate/save-run` endpoint. Saved runs include transcript, model/provider trace, structured edits, insertion drafts, and outcomes.
3. Stage 19O-lite learned selection: saved outcomes are sent to the backend learned selector to re-rank candidate branches with a small bandit-style reward/exploration adjustment.

Changed frontend files:

- `index.html`
- `js/real-agent-branch-workflow-service.js`
- `prompt/devils-advocate-branch-runner/editor.txt`
- `prompt/devils-advocate-branch-runner/synthesizer.txt`

Test flow:

1. Open Copilot → Devil's Advocate branch runner.
2. Run a dry run or real run.
3. Use Preview insertion; verify targeted/append drafts are still available.
4. Click Save current; reload page; click Refresh saved/Load saved.
5. Record accepted/rejected outcome; click Learned select and verify it chooses/reranks a branch using saved outcomes.

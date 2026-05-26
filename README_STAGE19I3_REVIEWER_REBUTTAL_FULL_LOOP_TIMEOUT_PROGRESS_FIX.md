# Stage 19I3 — Reviewer/Rebuttal Full Loop Timeout + Progress Fix

This frontend-only hotfix stabilizes the Reviewer/Rebuttal Simulator full-loop flow.

Changes:
- Adds a workflow-busy guard so repeated taps do not start duplicate loops.
- Uses a single delegated button handler; direct per-card listeners are removed.
- Adds visible elapsed-time progress on iPad while AI calls are running.
- Wraps each reviewer/rebuttal/final-synthesis AI call in a timeout.
- Preserves Stage 19I role-specific context logging and trajectory/reward logging.

No backend redeploy is required if Stage 19I backend is already deployed.

# Stage 19I6 — Reviewer/Rebuttal Explicit Role Context Fix

This frontend-only hotfix makes Reviewer/Rebuttal role-specific context logging explicit.

## Problem
Some context-usage rows for the reviewer/rebuttal workflow were still being logged as `critic`, even for `review_rebuttal` and `final_synthesis`. This could happen because focused retrieval subtasks such as `final_synthesis:reviewer-negative` were being reclassified by label text rather than by the parent agent step.

## Fix
- `loadReviewerMemoryContext(stepName, ..., explicitAgentRole)` now accepts an explicit role.
- Review steps pass `critic`.
- Rebuttal steps pass `defender`.
- Final synthesis steps pass `editor`.
- Focused context queries inherit the parent role instead of being reclassified.
- `index.html` cache-busts the reviewer/rebuttal service as Stage 19I6.

No backend redeploy is required if Stage 19I backend is already deployed.

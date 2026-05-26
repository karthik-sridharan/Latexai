# Stage 19I5 — Reviewer/Rebuttal Role Classification Fix

This frontend-only hotfix fixes reviewer/rebuttal role-specific context logging.

Problem fixed:
- The role classifier matched the generic word `review` before checking `rebuttal` or `final_synthesis`.
- As a result, `review_rebuttal`, `final_synthesis`, and focused contexts such as `final_synthesis:reviewer-negative` could be logged as `critic`.

Expected after this patch:
- `simulated_review_1`, `simulated_review_2`, ... log as `critic`.
- `review_rebuttal` logs as `defender`.
- `final_synthesis` logs as `editor`.
- audit/focused contexts still use `citation_auditor` / `notation_auditor` when appropriate outside canonical main steps.

No backend redeploy is needed.

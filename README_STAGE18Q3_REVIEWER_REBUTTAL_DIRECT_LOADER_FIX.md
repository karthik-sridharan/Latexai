# Stage 18Q3 — Reviewer/Rebuttal Direct Loader Fix

This patch fixes cases where the Reviewer/Rebuttal Simulator JS file exists but the card does not appear because an older cached feature-flag loader skipped the new feature.

Changes:
- cache-busts `feature-flag-service.js`;
- adds a direct fallback loader for `reviewer-rebuttal-simulator-service.js`;
- exposes `window.mountReviewerRebuttalSimulator()` for manual console verification;
- retries mounting after delayed right-panel initialization.

Expected result: the Copilot tab/right panel shows **Reviewer / rebuttal simulator**.

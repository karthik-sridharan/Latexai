# Stage 18Q2 Reviewer/Rebuttal Feature Registry Fix

Fixes the Stage 18Q visibility issue where `reviewer-rebuttal-simulator-service.js` was present but never loaded because `reviewer-rebuttal-simulator` was missing from `feature-flag-service.js` REGISTRY.

Changes:
- Adds `reviewer-rebuttal-simulator` to the feature flag registry.
- Updates cache-busting stage refs.
- Adds a small fallback script in `index.html` that loads the simulator if an older feature loader misses it.
- Keeps the workflow frontend-only and hidden-memory compatible.

Expected visual result: the right panel should show **Reviewer / rebuttal simulator**.

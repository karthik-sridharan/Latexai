# Stage 19W14B — Unified Paper AI static controls visibility fix

Fixes a deployment/browser-cache issue where the Paper AI tab showed only a placeholder such as “Total Paper Remake controls will appear here” instead of the actual unified Paper AI controls.

Changes:
- Renders the unified Paper AI control form directly in `index.html`, so it is visible even before the workflow-tab service moves/initializes cards.
- Updates `stage19w10-workflow-tabs-service.js` so it binds existing static controls instead of returning early.
- Updates stage marker/cache-busting to `latex-stage19w14b-unified-paper-ai-static-controls-fix-20260604-1`.

Backend unchanged.

# Stage 19I9 — Devil's Advocate start-marker diagnostics

Frontend-only hotfix.

Adds an immediate Devil's Advocate memory/context start marker before long AI calls begin. This creates a visible `agent_context_usage_stats` row for `workflow = devils-advocate-paper-debate` even if a later AI call fails or times out.

Also updates the index.html cache-buster for `js/devils-advocate-debate-service.js` so iPad/Safari and GitHub Pages load the new service.

Stage 18Q5 Reviewer/Rebuttal Safe-Mode Mount Fix
================================================

Upload these files preserving paths:

- index.html
- js/reviewer-rebuttal-simulator-service.js
- js/feature-flag-service.js

This patch keeps the Reviewer / rebuttal simulator visible even if an old safe-mode or feature-loader state tries to suppress optional scripts. It also adds a mount watchdog that retries initialization after the right panel is available.

Open with: https://karthik-sridharan.github.io/Latexai/?v=18q5

# Stage 18Q — Reviewer/Rebuttal Simulator Foundation

Adds a new hidden-memory-compatible frontend workflow for simulated paper review and rebuttal.

## New file

- `js/reviewer-rebuttal-simulator-service.js`

## Modified file

- `index.html`

## What users should see

A new **Reviewer / rebuttal simulator** card in the Paper AI / Copilot area.

The workflow supports:

1. choosing 2–4 reviewers;
2. specifying each reviewer’s style/expertise;
3. running separate simulated reviews;
4. adding user rebuttal guidance;
5. generating an AI rebuttal;
6. synthesizing a final revision plan with `latexai_actionable_edits` JSON.

This stage does not overwrite the source and does not add memory UI.

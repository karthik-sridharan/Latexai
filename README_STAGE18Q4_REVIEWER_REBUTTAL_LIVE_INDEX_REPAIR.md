# Stage 18Q4 — Reviewer/Rebuttal live index repair

The live GitHub Pages index was still serving an old static shell and did not contain the feature-script entry or direct fallback loader for `js/reviewer-rebuttal-simulator-service.js`.

Upload these patch files to the GitHub Pages root exactly preserving paths:

- `index.html`
- `js/feature-flag-service.js`
- `js/reviewer-rebuttal-simulator-service.js`

Then open:

`https://karthik-sridharan.github.io/Latexai/?v=18q4`

Expected result: the Copilot/right panel shows the dynamically mounted "Reviewer / rebuttal simulator" card.

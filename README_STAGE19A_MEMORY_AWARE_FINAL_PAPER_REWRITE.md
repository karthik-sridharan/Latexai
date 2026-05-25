# Stage 19A — Memory-aware final paper rewrite

This frontend-only stage builds on Stage 18Z.

## What changed

- Competitive Review insertion buttons now perform a final AI rewrite pass before editing the paper:
  - `AI remake + insert \lai edits` asks the AI to convert the competitive review, source, competitor evidence, edit impact map, and hidden research memory into exact `latexai_actionable_edits` JSON, then inserts visible `\laiold{...}` / `\lai{...}` blocks at exact source matches.
  - `AI remake + append \lai plan` asks the AI to convert the same context into a final append plan, then appends it as a visible end-of-paper `\lai{...}` block.
- The final rewrite pass retrieves and uses memory facts such as notation, citation gaps, recurring reviewer concerns, negative memories, and successful/failed edit patterns.
- Reviewer/Rebuttal final synthesis instructions were strengthened to produce source-aware actionable edits rather than only generic advice.

## Files changed

- `index.html`
- `js/competitive-paper-review-service.js`
- `js/reviewer-rebuttal-simulator-service.js`

## Deployment

Upload the patch files to GitHub preserving paths, then open:

```text
https://karthik-sridharan.github.io/Latexai/?v=19a
```

No backend redeploy is required.

## Expected visual changes

In Competitive Review, the two edit buttons now read:

- `AI remake + insert \lai edits`
- `AI remake + append \lai plan`

When either is clicked, the frontend first asks the AI to generate a memory-aware final rewrite/append plan and then applies the visible Latexai markup.

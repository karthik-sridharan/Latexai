# Stage 18B — Competitive review URL ranking roadmap

Stage string: `stage18b-competitive-review-url-ranking-roadmap-1`

This stage turns Competitive Review into a clearer competitor-driven workflow:

1. Add competitor paper URLs.
2. Fetch/extract competitor paper evidence with a web-search-capable AI backend.
3. Rank the competitor set first.
4. Compare the current draft against that ranked set.
5. Generate an improvement roadmap with predicted rank movement.
6. Insert actionable `\lai` / `\laiold` edits or append a visible `\lai` plan.

The stage keeps the Stage 17O review integration: inserted `\lai` blocks are still scanned by the Paper-level edit review queue.

## Notes

Latexai does not directly download competitor PDFs in this frontend stage. It asks the configured AI backend to use web-search/opening tools. Extracted competitor summaries are cached in `localStorage` under:

```txt
latexai:competitive-url-paper-cache:v1
```

## Main files changed

- `js/competitive-paper-review-service.js`
- `css/lai-stage16b-competitive-review.css`
- `prompt/ai-competitive-paper-review.txt`
- `index.html`
- `tests/stage18b-competitive-review-url-ranking-roadmap.test.cjs`

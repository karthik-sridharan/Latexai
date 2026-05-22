# Stage 18E — Competitive Review evidence UI + cache controls

Stage string:

```txt
stage18e-competitive-review-evidence-ui-cache-controls-1
```

This stage builds on the Stage 18C/18D web-research competitive review flow. Competitor URLs remain web-research seeds, not PDFs to extract.

## Main changes

- Adds visible competitor evidence cards in the Competitive Review panel.
- Shows per-competitor source count, source IDs, evidence coverage, warnings, and cache hit/miss status.
- Adds per-card controls:
  - View sources / Hide sources
  - Rerun research
  - Clear cache
- Adds global controls:
  - Rerun all web research
  - Clear research cache
- Adds a compact ranking preview table after ranking, with paper, rank, strength, evidence IDs, and relevance.
- Migrates older local web-research caches into the new cache key:

```txt
latexai:competitive-web-research-profile-cache:v3
```

Legacy keys are still read for migration:

```txt
latexai:competitive-web-research-profile-cache:v2
latexai:competitive-web-research-profile-cache:v1
```

## Files changed

- `index.html`
- `js/competitive-paper-review-service.js`
- `css/lai-stage16b-competitive-review.css`
- `prompt/ai-competitive-paper-review.txt`
- `tests/stage18e-competitive-review-evidence-ui-cache-controls.test.cjs`

## Tests

```bash
node --check js/competitive-paper-review-service.js
node --check js/model-registry-service.js
node --check js/model-provider-service.js
node --check js/ai-provider.js
node tests/stage18e-competitive-review-evidence-ui-cache-controls.test.cjs
```

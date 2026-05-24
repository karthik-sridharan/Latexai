# Stage 18X2 — Competitive Review Memory Context Scope Fix

Fixes the `Competitive review failed: Can't find variable: urls` error in Run Full Cited Review.

Cause: Stage 18X added a pre-review memory context query using `urls` and `sourceText`, but those variables were not in scope in `runFullReview()`. The fix builds the memory query from the validated payload fields instead:

- `payload.competitorUrls`
- `payload.targetVenue`
- `payload.comparisonModes`
- `payload.draftExcerpt`

Files changed:

- `index.html`
- `js/competitive-paper-review-service.js`

No backend changes required.

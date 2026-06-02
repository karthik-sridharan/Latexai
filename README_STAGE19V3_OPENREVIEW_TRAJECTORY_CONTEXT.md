# Stage 19V3 — OpenReview trajectory-aware review/rebuttal context frontend

This frontend patch updates the Reviewer/Rebuttal Simulator so OpenReview corpus retrieval uses trajectory-aware backend search.

## Changed behavior

When `Use OpenReview review/rebuttal corpus context` is enabled, the simulator now asks `/api/lumina/reviews/search` for compact sibling trajectories from the same OpenReview paper/forum.

A retrieved hit can now include:

```text
Matched excerpt
Sibling review/rebuttal trajectory:
  official review ...
  rebuttal / author response ...
  meta-review ...
  decision ...
```

The simulator prompt instructs the AI to use the trajectory pattern:

```text
reviewer concern -> author response -> meta-review/decision signal
```

rather than treating each retrieved review as an isolated example.

## Changed files

- `index.html`
- `js/reviewer-rebuttal-simulator-service.js`

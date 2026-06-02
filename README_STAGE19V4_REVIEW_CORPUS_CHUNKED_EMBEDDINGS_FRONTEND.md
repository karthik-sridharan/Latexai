# Stage 19V4 — Review corpus chunked embeddings frontend

Stage marker: `latex-stage19v4-review-corpus-chunked-embeddings-20260602-1`

## UI changes in `review.html`

- Text now describes chunked embeddings.
- Search has toggles:
  - `search embedded chunks`
  - `include sibling trajectories`
- Result cards show chunk badges where available.
- Stored records have a `Show full record` button.
- Full record view can show full item text and trajectory chunks.
- Search results can expand sibling review/rebuttal trajectories.

## Reviewer/Rebuttal integration

`reviewer-rebuttal-simulator-service.js` now sends `includeChunks: true` when retrieving review-corpus context. This lets the simulator retrieve matched chunks while still attaching sibling trajectories.

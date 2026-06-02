# Stage 19U9L2 — Review corpus context for reviewer/rebuttal simulator

Frontend-only patch on top of Stage 19U9L1.

## Goal

Use the OpenReview-style review/rebuttal corpus database from `review.html` inside the main LatexAI **Reviewer / rebuttal simulator** card.

## Expected frontend marker

```text
latex-stage19u9l2-review-corpus-context-for-reviewer-rebuttal-20260601-1
```

## Backend requirement

Requires backend Stage 19U9L0 or later, preferably Stage 19U9L1, with:

```text
POST /api/lumina/reviews/search
```

No backend code change is required for this stage.

## Changed files

```text
index.html
js/reviewer-rebuttal-simulator-service.js
README_STAGE19U9L2_REVIEW_CORPUS_CONTEXT_FOR_REVIEWER_REBUTTAL.md
```

## UI changes

The Reviewer / rebuttal simulator card now has an additional optional context block:

```text
[ ] Use OpenReview review/rebuttal corpus context
Review corpus topK: [5]
```

This is independent of the existing literature/knowledge context toggle.

## Behavior

When enabled, the simulator retrieves examples from the ingested OpenReview-style corpus before each phase:

1. `reviews` phase — retrieves review examples to make simulated reviewer criticisms more realistic.
2. `rebuttal` phase — retrieves author-response / rebuttal examples to guide response strategy.
3. `final_synthesis` phase — retrieves review/rebuttal trajectories to guide final revision planning and safe patch proposals.

Retrieved examples are inserted into prompts as:

```text
[R1], [R2], ...
```

The prompt instructs the AI to use them as realistic examples of reviewer concerns, rebuttal strategies, meta-review signals, and paper-edit patterns, but not to copy them verbatim or reveal reviewer identities.

## Implementation details

The reviewer/rebuttal service now calls:

```text
POST {apiBase}/reviews/search
```

where `{apiBase}` is derived from the existing backend/memory API base. It sends:

```json
{
  "query": "target venue + paper goal + phase + reviewer styles + draft excerpt + reviews/rebuttal when available",
  "topK": 5,
  "itemTypes": []
}
```

The returned hits are formatted into compact context snippets with:

```text
title
item type
similarity score
authors
outcome/meta signal when available
excerpt
```

## Testing checklist

1. Deploy backend Stage 19U9L1 or later.
2. Use `review.html` to ingest a small OpenReview venue batch or a specific paper forum.
3. Deploy this frontend patch.
4. Open the main editor and find **Reviewer / rebuttal simulator**.
5. Check **Use OpenReview review/rebuttal corpus context**.
6. Run **Run reviews**.
7. Confirm the status says review/rebuttal corpus examples were retrieved.
8. Generate rebuttal and final synthesis.
9. Confirm outputs are more realistic and mention concerns/strategies consistent with OpenReview-like review examples.

## Notes

- If the review corpus has no records or embeddings, retrieval will return zero examples and the simulator still runs.
- This does not replace the existing literature context. The two can be used together.
- This stage does not modify source automatically; final edits still go through the existing safe edit pipeline.

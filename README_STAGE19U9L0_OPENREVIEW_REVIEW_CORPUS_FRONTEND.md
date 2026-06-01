# Stage 19u9l0 — OpenReview Review/Rebuttal Corpus Frontend

Adds a new sister frontend:

```text
review.html
```

This is intentionally separate from `literature.html`. The literature app remains focused on papers and collections; `review.html` focuses on reviewer/rebuttal trajectories.

## Main panels

```text
Connection
OpenReview presets
Embedding options
OpenReview ingest
Search corpus
Records
Debug
```

## Workflow

1. Open `review.html`.
2. Set backend API base and ingestion token.
3. Enter a venue id such as:

```text
ICLR.cc/2024/Conference
```

or enter a single OpenReview forum id.

4. Click **Preview from OpenReview**.
5. Click **Ingest + embed**.
6. Search the stored review corpus by review issue or rebuttal strategy.

## Search filters

The search UI can search:

```text
whole record
reviews
rebuttals
meta-reviews
decisions
comments
```

Results show embedding similarity score, item type, snippet, and record id.

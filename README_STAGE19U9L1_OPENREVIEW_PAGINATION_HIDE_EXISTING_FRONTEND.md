# Stage 19u9l1 — OpenReview pagination + hide already-ingested previews frontend

Stage marker:

```text
latex-stage19u9l1-openreview-pagination-hide-existing-20260601-1
```

This updates `review.html`.

## Changes

- Raises the max-papers input cap from 50 to 1000 and changes the default to 25.
- Adds a checkbox:

```text
show already ingested papers as well
```

- The checkbox is unchecked by default, so preview/ingest asks the backend to return only not-yet-ingested OpenReview records.
- Adds badges:
  - `new`
  - `already ingested`
- Preview/ingest status now reports:
  - scanned submissions
  - skipped already-ingested records
  - number returned/ingested

## Test

1. Preview a venue with max papers above 50, such as 100.
2. Ingest a few records.
3. Preview again with the checkbox unchecked: those records should be hidden.
4. Check the checkbox and preview again: the already-ingested records should reappear with an `already ingested` badge.

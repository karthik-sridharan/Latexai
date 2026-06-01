# Stage 19U9F — Bulk import hide-existing toggle frontend

This frontend patch adds a checkbox to the Literature Survey Assistant bulk import UI:

- `include already ingested`

The checkbox is unchecked by default, so bulk preview hides papers already present in the research library. When checked, already-ingested candidates are included and retain their `already ingested` badge. The frontend also defensively filters already-ingested candidates if an older backend accidentally returns them while the checkbox is off.

## Expected behavior

1. Open **Bulk import**.
2. Leave **include already ingested** unchecked.
3. Click **Preview candidates**.
4. The results list should contain only new candidates, and the status line should say how many already-ingested candidates were hidden when the backend reports that count.

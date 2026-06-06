# Stage 19W52 — Literature Survey Assistant link label

This small frontend cleanup keeps the standalone literature app branded as **Kalvi**, but changes the link text inside the Chuvadi app back to a descriptive label.

## Changed

- Main top-bar link now says **Literature Survey Assistant** instead of **Kalvi**.
- Citation/literature settings link now says **Open Literature Assistant**.
- Help page top navigation now uses **Literature Survey Assistant** as the link label while the standalone page itself remains Kalvi.
- Internal filenames/routes are unchanged.

## Verification

```bash
node --check js/main.js
```

# Latexai Stage 18X — Memory Project/Paper Identity Scoping

This stage keeps memory hidden from the main UI while making persistent memory safer now that Neon/Postgres storage is available.

## What changed

- Adds stable frontend-derived memory identity fields:
  - `projectId`
  - `paperId`
  - `sectionId`
  - `sessionId`
  - `documentFingerprint`
  - `sourceHash`
  - `titleGuess`
  - `rootPath`
  - `activePath`
- Competitive Review now registers/touches memory scope before context retrieval.
- Reviewer/Rebuttal Simulator now registers/touches memory scope before context retrieval.
- Memory write metadata includes the paper identity details so backend debug endpoints can show which paper/project each memory belongs to.

## UI impact

No memory UI is added. The main editor/review workflow should look the same.

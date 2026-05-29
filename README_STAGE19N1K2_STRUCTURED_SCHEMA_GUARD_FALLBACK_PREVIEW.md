# Stage 19N1K2 — Structured Schema Guard + Failure Preview

Frontend-only temporary stabilization on top of Stage 19N1K.

## Why

Stage 19N1K introduced structured editor JSON, but if the final editor did not return valid JSON edits, the insertion preview could quietly show `blocks=0` with little explanation.

## What changed

- The final editor prompt now makes the JSON markers mandatory and explains that insertion is blocked if JSON is missing/empty.
- The structured parser accepts more common schema variants:
  - `edits`, `sectionEdits`, `equationEdits`, `patches`, `items`, `results`
  - root array of edits
  - common field aliases like `newLatex`, `replacementLatex`, `paperText`, `explanation`, `equationId`
- The insertion preview now shows why `blocks=0` happened:
  - missing JSON
  - invalid JSON
  - JSON present but no usable edits
  - raw JSON/output preview
- Structured edits are used for targeted insertion even in narrow/branch-target modes.
- If no usable structured edits exist, insertion remains blocked instead of guessing from free-form prose.

## Test URL

`/index.html?laiPromptDebug=1&v=19n1k2`

Run Devil's Advocate and inspect the debug tab plus the structured preview.

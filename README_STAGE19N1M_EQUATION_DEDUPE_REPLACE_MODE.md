# Stage 19N1M — Equation Explanation Dedupe + Replace Mode

Frontend-only follow-up to Stage 19N1L.

## Problem
Equation coverage began working, but repeated runs could stack several near-identical explanations under the same equation. Structured editor JSON could also contain multiple variants for the same `eq_###` target.

## Fixes

- In math/equation coverage mode, the structured-edit filter keeps at most one usable explanation per equation id.
- Duplicate equation edit variants are scored and deduplicated before conversion to `\lai{...}` blocks.
- `no_edit` and section-level structured edits are dropped during equation coverage mode.
- Applying a new targeted equation preview first removes previous `Latexai equation explanation suggestion` wrapper regions, so reruns replace old equation explanations instead of stacking more below the same equation.
- The insertion status now sets `safeToInsert=true` when usable blocks exist, while keeping `safeToAutoApply=false` for manual review.
- The editor prompt now explicitly asks for exactly one concise explanation object per equation id.

## Test

Open:

```text
/index.html?laiPromptDebug=1&v=19n1m
```

Use:

```text
Focus/query: Explain all math equation. For every equation i want an edit below it.
Math/equation coverage: force equation-by-equation edits
Insertion mode: targeted section insertion
```

Run preview, then apply targeted. Re-running should replace old equation-explanation wrappers rather than duplicating them.

# Stage 19N1L — Equation Inventory Clean + Equation-Only Schema

Frontend-only patch.

## Why
Stage 19N1K5 successfully parsed structured edits, but equation-focused runs could still be polluted by earlier Latexai equation explanation wrappers. The next prompt's equation inventory could treat previous AI explanations as context/equations, and the final editor could still return broad section edits even when the user asked for one explanation under every equation.

## Changes

- Removes previous `% --- Latexai equation explanation suggestion for: ... ---` wrapper regions from the next visible prompt context.
- Ignores previous equation explanation wrapper regions when detecting document structure and display equations.
- In math/equation coverage mode, only structured edits with `targetType: "equation"` and a detected equation id are insertable.
- Drops section-level structured edits during equation coverage mode and reports how many were dropped.
- The structured preview now reports raw edits vs usable edits.
- Tightens the final editor prompt: if `MATH EQUATION COVERAGE MODE ACTIVE` appears, it must output `editMode: "equation_coverage"` and only equation-targeted edits.

## Test URL

Open:

```text
/index.html?laiPromptDebug=1&v=19n1l
```

Then use:

```text
Focus/query: Explain all math equation. For every equation i want an edit below it.
Math/equation coverage: force equation-by-equation edits
Insertion mode: targeted section insertion
```

In the prompt-debug tab, the equation inventory should no longer include prior `Latexai equation explanation suggestion` wrapper text as preceding/following context. In the structured preview, usable edits should target `eq_001`, `eq_002`, etc., not broad section names.

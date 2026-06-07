# Stage 19N1H — Equation Coverage Edits

Frontend-only patch on top of Stage 19N1G.

## Why

When the user prompt/focus was: "Explain all math equation. For every equation I want an edit below it", the branch runner still produced mostly citation/positioning edits. The model was not receiving an explicit equation inventory, and the insertion step only knew how to target sections, not individual equations.

## What changed

- Adds `Math/equation coverage` control in the Devil's Advocate branch runner:
  - auto-detect from focus/query
  - force equation-by-equation edits
  - off
- Detects display equations in the visible source context:
  - `equation`, `align`, `alignat`, `gather`, `multline`, `eqnarray`
  - `\[ ... \]`
  - `$$ ... $$`
- Adds an equation inventory to the visible prompt when equation coverage is active.
- Overrides the selected branch prompt metadata to a math exposition task when equation coverage is active.
- Requires the final editor to produce one explanatory `\lai{...}` block per detected equation id.
- Adds equation-targeted insertion: blocks with `% Target equation id: eq_###` are inserted immediately below the matched equation block, not at the section header.
- Keeps final-editor-only and patch-style filtering from Stage 19N1G.

## Test

1. Open the app with `?v=19n1h`.
2. Click `Clean previous AI suggestions` if the current source contains older red suggestions.
3. In the Devil's Advocate branch runner set:
   - Focus/query: `Explain all math equation. For every equation i want an edit below it.`
   - Math/equation coverage: `force equation-by-equation edits` or leave as auto.
   - Target mode: `whole paper: every detected unit` or select the technical sections.
   - Visible prompt context: `whole paper truncated + selected focus` or `full paper visible if within budget`.
4. Run full preview.
5. In the final output / insertion preview, look for blocks with:
   - `% Target equation id: eq_001`
   - `% Target equation id: eq_002`
6. Apply targeted. The red `\lai` explanations should appear directly below display equations.

## Changed files

- `js/real-agent-branch-workflow-service.js`
- `prompt/devils-advocate-branch-runner/base-context.txt`
- `prompt/devils-advocate-branch-runner/coverage-branch.txt`
- `prompt/devils-advocate-branch-runner/coverage-multisection.txt`
- `prompt/devils-advocate-branch-runner/editor.txt`

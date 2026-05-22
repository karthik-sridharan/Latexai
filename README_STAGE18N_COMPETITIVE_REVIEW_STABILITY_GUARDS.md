# Stage 18N — Competitive Review stability guards

Stage ID:

```txt
stage18n-competitive-review-stability-guards-1
```

## What changed

This stage stabilizes the Stage 18M Competitive Review ranking-to-`\lai` edit workflow.

### 1. Single-running-step guard

Competitive Review action buttons now run through a busy guard. While one workflow step is running, the other Competitive Review buttons are disabled and the card gets:

```txt
data-competitive-busy="true"
```

This prevents accidental double-clicks from launching overlapping web research, ranking, full review, or insertion actions.

### 2. Guarded exact-match insertion planner

`Insert \lai edits at matches` now builds an insertion plan before changing files. The planner skips unsafe edits instead of applying them blindly:

- missing file,
- missing anchor,
- anchor not found,
- anchor appears multiple times,
- match is in the preamble,
- match is already inside another Latexai actionable edit block,
- generated LaTeX is unsafe inside `\lai`,
- two proposed edits overlap or target the same exact region.

The insertion report now includes planned/applied/skipped counts and diagnostics.

### 3. Edit impact map readiness is stricter

The edit impact map now marks repeated anchors as ambiguous instead of saying they are inline-ready. This avoids giving the user a false sense that an edit can be inserted safely when the exact `oldText` appears more than once.

### 4. Stage 18M behavior preserved

The following Stage 18M pieces are preserved:

- source-cited competitor ranking workflow,
- edit impact map,
- `rankingEffect` prompt contract,
- saved `/reviews` edit impact map section,
- visible `\lai`/`\laiold` insertion flow,
- web-search-required AI request metadata.

## Visual check

Open:

```txt
https://karthik-sridharan.github.io/Latexai/?v=stage18n-competitive-review-stability-guards-1
```

Then go to **Copilot → Competitive paper review**.

You should see the Stage 18N status note. While any long-running Competitive Review action is running, the action buttons should temporarily disable. If the AI returns two edits with the same anchor or an anchor that appears multiple times, the insertion report should skip the unsafe edit and show a diagnostic rather than corrupting the source.

## Tests

```bash
node --check js/competitive-paper-review-service.js
node --check js/model-registry-service.js
node --check js/model-provider-service.js
node --check js/ai-provider.js
node --check js/editor-enhancement-service.js
node tests/stage18n-competitive-review-stability-guards.test.cjs
```

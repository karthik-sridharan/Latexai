# Stage 18M — Competitive Review ranking-to-`\lai` edit impact map

Stage ID:

```txt
stage18m-competitive-review-ranking-to-lai-edit-impact-map-1
```

## What changed

Competitive Review now renders an **Edit impact map** after the roadmap/full review runs. Each actionable edit is connected to:

- the paper/source location it targets,
- the competitor gap it addresses,
- source evidence IDs such as `[S1]`, `[S4]`,
- expected ranking movement, such as `#4 of 6 -> #3 of 6`,
- insertion readiness: inline exact match vs fallback/manual/append.

The AI prompt contract now requests a structured `rankingEffect` object inside each `latexai_actionable_edits` entry:

```json
{
  "rankingEffect": {
    "competitors": ["#1 Paper A"],
    "gap": "which competitor weakness this edit addresses",
    "sourceIds": ["S1"],
    "before": "draft estimated #4 of 5",
    "after": "likely #3 of 5 after this edit",
    "expectedImpact": "one-sentence ranking movement rationale",
    "insertionMode": "inline \\laiold/\\lai or append \\lai plan"
  }
}
```

Saved `/reviews` reports now include an **Edit impact map** section before the full report body.

Inserted `\lai` blocks now add sanitized metadata comments when available:

```latex
% LAI ranking impact: ...
% LAI evidence: S1, S4
```

## Visual check

Open:

```txt
https://karthik-sridharan.github.io/Latexai/?v=stage18m-competitive-review-ranking-to-lai-edit-impact-map-1
```

Then go to **Copilot → Competitive paper review** and run **Generate source-cited roadmap** or **Run full cited review**. You should see a new **Edit impact map** block below the ranking preview.

## Tests

```bash
node --check js/competitive-paper-review-service.js
node --check js/model-registry-service.js
node --check js/model-provider-service.js
node --check js/ai-provider.js
node --check js/editor-enhancement-service.js
node tests/stage18m-competitive-review-ranking-to-lai-edit-impact-map.test.cjs
```

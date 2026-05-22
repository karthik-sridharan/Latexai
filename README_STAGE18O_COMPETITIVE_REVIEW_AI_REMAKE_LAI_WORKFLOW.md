# Stage 18O — Competitive Review AI remake `\lai` workflow

Stage ID:

```txt
stage18o-competitive-review-ai-remake-lai-workflow-1
```

## What changed

This stage changes the weak Competitive Review insert/append behavior into a second AI pass that uses:

- the full cited competitive review report,
- the current LaTeX source,
- competitor URL seeds,
- competitor source ledger / ranking / comparison context when available.

### 1. Inline button now asks AI to remake the source

The old **Insert `\lai` edits at matches** button is now:

```txt
AI remake with \laiold/\lai
```

When clicked after **Run full cited review**, the frontend asks AI to return one full source file in a fenced block labelled:

```txt
latexai_remade_source
```

The returned source must preserve the original file and insert visible Latexai markup:

```tex
\laiold{old text}
\lai{new competitive improvement}
```

The frontend validates the returned source before replacing the file. It refuses to apply the remake if the response is missing `\lai`, missing `\laiold`, missing the original document structure, contains Markdown fences inside the extracted source, has unbalanced braces/environments, or is suspiciously shorter than the original.

### 2. Append button now asks AI for a detailed end-of-paper remake block

The old **Append `\lai` plan** button is now:

```txt
AI append remake
```

When clicked after **Run full cited review**, the frontend asks AI to return one appendable LaTeX body fragment in a fenced block labelled:

```txt
latexai_append_remake_block
```

The returned block is inserted before `\end{document}` and must be visible `\lai{...}` markup. The prompt asks for a detailed remake section with prioritized changes, rewritten text/claims where useful, related-work positioning, source IDs, and expected ranking effect.

### 3. Full review remains source-cited

The original source-cited competitive report remains available and still includes the impact-map guidance. Stage 18O changes how the edit buttons consume that report: they no longer depend on fragile exact-match JSON alone.

### 4. Stage 18N stability preserved

The single-running-step/busy guard is preserved. The exact-match insertion planner remains exported as a utility/fallback, but the visible UI buttons now use the AI-remake workflows.

## Visual check

Open:

```txt
https://karthik-sridharan.github.io/Latexai/?v=stage18o-competitive-review-ai-remake-lai-workflow-1
```

Then go to **Copilot → Competitive paper review**.

After running **Run full cited review**, you should see:

- **AI remake with `\laiold/\lai`**
- **AI append remake**

The inline remake should replace the active/root source with a full AI-remade source containing visible `\laiold`/`\lai` markup. The append remake should insert one detailed visible `\lai` section before `\end{document}`.

## Tests

```bash
node --check js/competitive-paper-review-service.js
node --check js/model-registry-service.js
node --check js/model-provider-service.js
node --check js/ai-provider.js
node --check js/editor-enhancement-service.js
node tests/stage18o-competitive-review-ai-remake-lai-workflow.test.cjs
```

# Stage 13C: presentation export validator + auto-fixer

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/presentation-export-service.js`
- `css/lai-stage13a-presentation-export.css`
- `prompt/ai-paper-to-presentation-export.txt`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage13c-presentation-export-validator-autofix-1`

## What this adds

The Paper → Presentation exporter now has:

- `Validate deck`
- `Auto-fix deck`
- `Validate + save`

## Validator checks

It checks that:

- deck has `deckTitle`;
- slides array exists;
- every slide has a title;
- every non-title slide has visible `leftBlocks` or `rightBlocks`;
- slide type is valid;
- block mode is valid;
- old semantic-only fields like `bullets` / `latex` are not stranded without visible blocks;
- colors and heading levels are reasonable.

## Auto-fix behavior

It repairs common issues:

- old `bullets` → visible `leftBlocks` panel content;
- old `latex` → visible `pseudocode-latex` block;
- missing blocks → visible placeholder block;
- invalid block modes → `plain`;
- missing title/content → safe fallback;
- missing title slide → inserts title-center slide.

## Test

Included:

`tests/stage13c-presentation-export-validator-autofix.test.cjs`

Run:

```bash
node tests/stage13c-presentation-export-validator-autofix.test.cjs
```

# Stage 13A: paper-to-presentation exporter

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/presentation-export-service.js`
- `css/lai-stage13a-presentation-export.css`
- `prompt/ai-paper-to-presentation-export.txt`

Keep existing Stage 12 files if not already present.

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage13a-paper-to-presentation-exporter-1`

## What this adds

A new **Paper → Presentation exporter** card appears in the Copilot panel.

It can:

- collect the current LaTeX paper context;
- ask AI to convert it into Presentation Maker JSON;
- show the JSON;
- save it as `exports/<title>-<timestamp>.presentation.json`;
- copy JSON;
- download JSON.

## Modes

- Research talk
- Lecture
- Short summary
- Detailed walkthrough

You can also set a target slide count and extra instructions.

## Test

Included:

`tests/stage13a-paper-to-presentation-exporter.test.cjs`

Run:

```bash
node tests/stage13a-paper-to-presentation-exporter.test.cjs
```

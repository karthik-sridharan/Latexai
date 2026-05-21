# Stage 15A: UI cleanup and panel stabilization

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/ui-cleanup-service.js`
- `css/lai-stage15a-ui-cleanup.css`

Keep Stage 14B files if not already present.

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage15a-ui-cleanup-panel-stabilization-1`

## What this adds

Stage 15A cleans up and stabilizes the Latexai UI.

It adds:

- right-panel tab stabilization so only one of Preview/Logs/Copilot/Settings is active at once;
- collapsible Copilot tool cards;
- accordion behavior so only one major AI/export card is expanded at a time;
- compact mode toggle for iPad/smaller screens;
- left-panel scroll/layout stabilization;
- right-panel scroll/layout stabilization.

## Why

Latexai now has many tools:

- figure tools
- TikZ tools
- document-level AI
- citation AI
- citation verifier
- presentation/talk exporter
- compile settings

Stage 15A keeps those tools available without making the right panel feel permanently cluttered.

## Test

Included:

`tests/stage15a-ui-cleanup-panel-stabilization.test.cjs`

Run:

```bash
node tests/stage15a-ui-cleanup-panel-stabilization.test.cjs
```

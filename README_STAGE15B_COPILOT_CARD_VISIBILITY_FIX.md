# Stage 15B: Copilot card visibility fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/ui-cleanup-service.js`
- `css/lai-stage15a-ui-cleanup.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage15b-copilot-card-visibility-fix-1`

## What this fixes

Stage 15A made Copilot cards too aggressive: later tools could appear as blank collapsed bars, so only the first Copilot block felt usable.

Stage 15B fixes that by:

- only making known major tool cards collapsible;
- keeping cards expanded by default;
- giving every card header a readable title;
- making “Focus one tool” optional and off by default;
- adding an `Expand tools` button;
- not using `inert` on inactive panels.

The right-panel tab stabilization and compact mode remain.

## Test

Included:

`tests/stage15b-copilot-card-visibility-fix.test.cjs`

Run:

```bash
node tests/stage15b-copilot-card-visibility-fix.test.cjs
```

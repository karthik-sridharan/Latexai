# Stage 15H: in-app regression checklist

Changed files:

- `index.html`
- `js/regression-checklist-service.js`
- `css/lai-stage15h-regression-checklist.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage15h-in-app-regression-checklist-1`

## What this adds

A new **Regression checklist** card in Settings.

It runs local smoke checks for:

- core DOM elements;
- right-panel tab state;
- Copilot controls;
- stale hidden Copilot card bodies;
- loaded services;
- safe mode/recovery hooks;
- backend URL fields.

It does not compile and does not call AI.

Buttons:

- Run checklist
- Copy report
- Download JSON
- Reset UI + safe reload

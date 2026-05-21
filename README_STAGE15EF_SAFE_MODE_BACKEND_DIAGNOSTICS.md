# Stage 15E + 15F: safe mode and backend diagnostics

Changed files:

- `index.html`
- `.nojekyll`
- `js/safe-mode-service.js`
- `js/backend-diagnostics-service.js`
- `js/ui-cleanup-service.js`
- `css/lai-stage15e-safe-mode.css`
- `css/lai-stage15f-backend-diagnostics.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage15ef-safe-mode-backend-diagnostics-1`

Recovery URLs:

```txt
https://karthik-sridharan.github.io/Latexai/?safe=1
https://karthik-sridharan.github.io/Latexai/?resetUi=1
https://karthik-sridharan.github.io/Latexai/?safe=1&resetUi=1
```

## Stage 15E

Adds a safe-mode boot guard:

- `?safe=1`
- `?resetUi=1`
- `?disableExperimentalUi=1`
- `?disableExperimentalUi=0`
- recovery bar
- reset UI state
- copy boot report
- optional UI script gate

`ui-cleanup-service.js` now checks the safe-mode gate and becomes a no-op when safe mode disables optional UI scripts.

## Stage 15F

Adds a backend diagnostics dashboard in Settings:

- local boot checks
- loaded service checks
- compile backend health GET probe
- AI backend status GET probe
- shared backend health GET probe
- copyable report

The diagnostics do not run a compile job and do not call AI generation.

# Stage 15G: model/provider routing cleanup

Changed files:

- `index.html`
- `js/model-provider-service.js`
- `css/lai-stage15g-model-routing.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage15g-model-provider-routing-cleanup-1`

## What this adds

A developer-facing model/provider routing card in Settings.

Routes:

- Default / Copilot
- Paper-level AI
- Citation AI
- Presentation export
- Figure/TikZ generation
- Diagnostics / logs

The service wraps `AIProvider.ask` and temporarily applies the configured route to the existing provider/model controls before each AI call, then restores the controls afterward.

## Safe mode

If `?safe=1` or disabled experimental UI is active, this service becomes a no-op.

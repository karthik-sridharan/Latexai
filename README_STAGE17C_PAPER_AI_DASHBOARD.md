# Stage 17C: Paper AI dashboard

Changed files:

- `index.html`
- `js/feature-flag-service.js`
- `js/paper-ai-dashboard-service.js`
- `css/lai-stage17c-paper-ai-dashboard.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage17c-paper-ai-dashboard-1`

## What this adds

A feature-gated top Copilot card:

```txt
Paper AI dashboard
```

It shows status and quick-launch controls for:

- Paper-level edit review
- Competitive paper review
- Devil's advocate debate
- AI suggestion comments
- AI revision history
- Citation filler
- Citation verifier
- Backend diagnostics
- Regression checklist

Buttons:

- Refresh dashboard
- Copy workflow status
- Open feature flags
- Jump to card
- Run workflow

This service is local-only by itself: no AI calls and no compile jobs. The Run buttons only trigger existing workflow buttons when the user explicitly clicks them.

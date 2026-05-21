# Stage 16E: AI revision history

Changed files:

- `index.html`
- `js/feature-flag-service.js`
- `js/ai-revision-history-service.js`
- `css/lai-stage16e-ai-revision-history.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage16e-ai-revision-history-1`

## What this adds

A feature-gated Settings card:

```txt
AI revision history
```

It supports:

- Create snapshot
- View snapshots
- Compare selected snapshot
- Restore selected snapshot
- Delete snapshot
- Copy revision report
- Add report to `/reviews`

The service also creates snapshots before high-risk AI mutations when those services are loaded:

- Paper-level edit review apply/accept/reject actions
- Competitive review roadmap/report insertion
- Devil’s advocate improvement plan/report insertion

This is local-only: no AI calls and no compile jobs.

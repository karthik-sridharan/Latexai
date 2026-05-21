# Stage 16F: AI suggestion comments

Changed files:

- `index.html`
- `js/feature-flag-service.js`
- `js/ai-suggestion-comments-service.js`
- `css/lai-stage16f-ai-comments.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage16f-ai-suggestion-comments-1`

## What this adds

A feature-gated Copilot card:

```txt
AI suggestion comments
```

It supports:

- comments anchored to active file, selected text, active line, or detected `\lai` / `\laiold` blocks;
- author/type/priority/status fields;
- resolve/reopen/delete comment actions;
- copy comments report;
- add comments report to `/reviews`;
- export/import JSON for coauthor exchange.

This is local-only: no AI calls and no compile jobs.

# Stage 16A: paper-level AI workflow polish

Changed files:

- `index.html`
- `js/feature-flag-service.js`
- `js/paper-ai-polish-service.js`
- `css/lai-stage16a-paper-ai-polish.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage16a-paper-ai-workflow-polish-1`

## What this adds

A new feature-gated Copilot card:

```txt
Paper-level edit review
```

It scans the active source file for:

```tex
\lai{...}
\laiold{...}
\laiold{...}\lai{...}
```

It provides:

- structured edit report;
- changed sections;
- citations affected;
- compile-risk notes;
- preview selected edits;
- apply selected edits;
- reject selected edits;
- accept all new `\lai` content;
- reject all new content and keep `\laiold`;
- optional regression checklist after applying.

It is local-only: no compile jobs and no AI calls.

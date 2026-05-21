# Stage 16D: devil's advocate paper debate

Changed files:

- `index.html`
- `js/feature-flag-service.js`
- `js/devils-advocate-debate-service.js`
- `css/lai-stage16d-devils-debate.css`
- `prompt/ai-devils-advocate-debate.txt`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage16d-devils-advocate-paper-debate-1`

## What this adds

A feature-gated Copilot card:

```txt
Devil’s advocate paper debate
```

The workflow runs:

1. Advocate agent: argues for the current draft.
2. Critic agent: critiques the current draft.
3. Synthesizer agent: produces a balanced improvement plan.

The user can set:

- number of debate rounds;
- target venue;
- target audience;
- debate topic;
- extra instructions;
- provider/model for each of the three agents.

Actions:

- Run debate
- Cancel
- Copy report
- Add report to `/reviews`
- Insert improvement plan

This workflow calls AI but does not compile.

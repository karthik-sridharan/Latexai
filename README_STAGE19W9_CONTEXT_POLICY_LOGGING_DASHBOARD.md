# Stage 19W9 — Context-policy logging dashboard frontend

Marker:

```text
latex-stage19w9-context-policy-logging-dashboard-20260602-1
```

Adds a new **Context-policy logging dashboard** card in the main editor, near the existing project block/MCTS-lite card.

The card can:

- load context-policy status
- show a unified dashboard for block context, OpenReview retrieval, and MCTS-lite events
- filter by source, workflow, phase, outcome, and project id
- show summary counts and reward statistics
- seed a test event
- mark the newest or selected event as accepted, rejected, or copied/useful
- copy the dashboard JSON for debugging

Changed files:

```text
index.html
js/project-block-context-service.js
js/context-policy-dashboard-service.js
README_STAGE19W9_CONTEXT_POLICY_LOGGING_DASHBOARD.md
```

Validation performed:

```text
node --check js/project-block-context-service.js
node --check js/context-policy-dashboard-service.js
static check that index.html loads context-policy-dashboard-service.js
```

# Stage 19L3 — Debate Branch Generator Developer Frontend

Adds:

```text
/developer-debate-branches.html
```

This developer page calls:

```text
POST /api/lumina/debate/branches
```

It lets you configure:

- backend URL / proxy token
- memory bandit policy
- branch count
- context limit
- whether to include ranked memory context
- whether to record context selections
- whether to record generated branches as a debate trajectory
- LaTeX source excerpt
- review/report text
- paper summary

The page does not call any model provider. The backend returns deterministic branch candidates ranked from source/review heuristics and memory-bandit context.

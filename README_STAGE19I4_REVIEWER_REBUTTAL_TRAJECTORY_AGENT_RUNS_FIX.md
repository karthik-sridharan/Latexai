# Stage 19I4 — Reviewer/Rebuttal trajectoryAgentRuns fix

This frontend-only hotfix fixes a runtime error in the reviewer/rebuttal simulator:

```text
Reviewer/rebuttal workflow failed: Can\'t find variable: trajectoryAgentRuns
```

Changes:

- Declares and initializes `trajectoryAgentRuns` in `js/reviewer-rebuttal-simulator-service.js`.
- Keeps the Stage 19I3 busy guard, elapsed progress, and AI-call timeout behavior.
- Updates `index.html` script cache-buster for the reviewer/rebuttal service so browsers fetch the fixed file.

No backend redeploy is required.

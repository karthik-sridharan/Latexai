# Stage 19I8 — Devil's Advocate Memory / Agent Context / Trajectory Wiring

This frontend stage wires the Devil's Advocate paper debate workflow into the Stage 19F–19I learning logs.

## What changed

- `js/devils-advocate-debate-service.js`
  - Requests role-specific memory context before each Devil's Advocate agent call.
  - Logs advocate, critic, and synthesizer agent runs through `/api/lumina/memory/agent-run`.
  - Logs full debate trajectories through `DebateTrajectoryLoggingService`.
  - Injects hidden role-specific memory context into each agent prompt.

- `index.html`
  - Cache-busts the Devil's Advocate feature script so GitHub Pages/iPad Safari loads the new JS.

## Expected Neon rows after running Devil's Advocate debate

- `agent_context_usage_stats`: rows for `advocate`, `critic`, and `synthesizer` under workflow `devils-advocate-paper-debate`.
- `agent_runs`: one row per advocate/critic/synthesizer call.
- `context_bundles`: one context bundle per agent call.
- `agent_outputs`: one output per agent call.
- `debate_trajectories`, `debate_steps`, `debate_outcomes`: one full debate trajectory with linked steps.

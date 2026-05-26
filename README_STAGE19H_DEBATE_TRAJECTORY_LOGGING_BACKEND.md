# Stage 19H — Debate Trajectory Logging Backend

Adds AlphaGo-style rollout trace tables:

- `debate_trajectories`
- `debate_steps`
- `debate_outcomes`

New endpoints:

- `POST /api/lumina/memory/debate-trajectory`
- `GET /api/lumina/memory/debug/debate-trajectories`

These link agent runs, context bundles, memories, edit outcomes, and reward events into full debate/revision trajectories.

# Stage 19H — Debate Trajectory Logging

Frontend changes:

- Adds `js/debate-trajectory-logging-service.js`.
- Logs reviewer/rebuttal simulator trajectories after final synthesis.
- Logs competitive full-cited-review trajectories after review completion.
- Links trajectory steps to agent run IDs/context bundle IDs when available.
- Sends trajectories to `/api/lumina/memory/debate-trajectory`.

No visible UI changes are intended. This is hidden learning-data infrastructure.

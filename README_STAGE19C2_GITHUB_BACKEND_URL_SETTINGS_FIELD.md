# Stage 19C2 — GitHub backend URL in Settings

This frontend-only patch adds a dedicated GitHub backend URL field to the Settings tab and wires it into the GitHub sync/new-project workflow.

The backend services stay separate:

- AI backend proxy URL: AI generation service ending in `/api/lumina/ai`
- Memory backend URL: Neon-backed memory service base URL
- Compile backend URL: compile endpoint ending in `/api/lumina/latex/compile`
- GitHub backend URL: GitHub sync/repo-creation service ending in `/api/lumina/github`

No backend redeploy is required if the GitHub backend has already been deployed.

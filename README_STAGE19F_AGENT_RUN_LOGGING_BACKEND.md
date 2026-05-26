# Stage 19F Backend — Agent Run Logging

This backend stage extends the memory service with structured AI-agent traces.

## New persistent tables

- `agent_runs`: one row per AI agent call.
- `context_bundles`: the memories/context that were fed to the LLM agent.
- `agent_outputs`: compact stored output for the agent call.

## New endpoints

- `POST /api/lumina/memory/agent-run`
- `GET /api/lumina/memory/debug/agent-runs`

## Existing services unchanged

The compile routes remain under `/api/lumina/latex/*`.
The memory routes remain under `/api/lumina/memory/*`.
The GitHub backend remains a separate Cloud Run service.
The AI backend remains the user's old separate AI backend.

## Deploy

Deploy this backend to the existing compile/memory Cloud Run service, preserving Neon env vars:

```bash
gcloud run deploy lumina-latex-backend \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 900 \
  --concurrency 1 \
  --max-instances 3 \
  --env-vars-file neon-env.yaml
```

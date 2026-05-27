# Latexai Stage 19J — Ranked Context Frontend Wiring

This frontend patch switches the generic AI workflow memory wrapper to prefer the new backend learned-ranking endpoint.

## What changed

- `js/ai-workflow-memory-service.js` now calls:
  - first: `POST /api/lumina/memory/ranked-context`
  - fallback: `POST /api/lumina/memory/agent-context`

- The wrapper now extracts memory ids from both old and new response shapes:
  - top-level `items`, `facts`, `selectedMemoryIds`
  - nested `context.items`, `context.facts`

- Agent-run logging now passes the `contextBundleId` created by the Stage 19J backend, so later edit/reward outcomes can connect back to the exact ranked context bundle.

## Backend dependency

Deploy the Stage 19J backend first. If the backend does not have `/ranked-context`, the frontend falls back to the old `/agent-context` endpoint.

## Verification

Open the app, run one generic AI action such as Copilot, Citation AI, Document AI, or TikZ maker, then check Neon:

```sql
select agent_role, task_type, workflow, memory_id, times_selected, updated_at_ms
from agent_context_usage_stats
order by updated_at_ms desc
limit 20;

select id, agent_role, task_type, workflow, memory_count, created_at_ms
from context_bundles
order by created_at_ms desc
limit 20;
```

You should see Stage 19J context bundles and selection stats updating.

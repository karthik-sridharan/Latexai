# Stage 19I — Agent-role-specific context policy

This frontend stage routes hidden memory retrieval through the new backend `/api/lumina/memory/agent-context` endpoint before major AI calls.

## What changed

- Competitive review now requests role-specific context for ranking, comparison, review, and paper-edit agents.
- Reviewer/rebuttal simulator now requests role-specific context for critic/reviewer, defender/rebuttal, and editor/synthesis agents.
- Context bundles logged through Stage 19F now include the selected `agentContextProfile` and `contextPolicy` metadata.
- If the backend has not yet been upgraded, the frontend falls back to the older `/api/lumina/memory/context` endpoint.

## No UI changes

The main UI remains unchanged. This is hidden orchestration infrastructure for the AlphaGo-style debate roadmap.

## Verification

After deploying the backend and uploading the frontend patch, run Full Cited Review or Reviewer/Rebuttal Simulator, then check Neon:

```sql
select agent_role, task_type, workflow, sum(times_selected) as selected
from agent_context_usage_stats
group by agent_role, task_type, workflow
order by selected desc;
```

Also check:

```bash
curl https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/memory/debug/agent-context-profiles
```

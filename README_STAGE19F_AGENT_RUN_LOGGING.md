# Stage 19F — Agent Run Logging

This stage starts the AlphaGo-style debate roadmap by logging major AI-agent calls as structured traces.

## Frontend changes

Changed files:

- `index.html`
- `js/competitive-paper-review-service.js`
- `js/reviewer-rebuttal-simulator-service.js`

The competitive-review workflow and reviewer/rebuttal simulator now log each major AI call to the hidden memory backend. The logging is non-blocking and invisible in the main UI.

Each agent trace records:

- agent role
- task/workflow/step name
- provider/model
- prompt/input/output hashes and compact text snippets
- retrieved memory IDs used as context
- latency estimate
- token estimate
- status: success, empty, or failure
- project/paper/session identity

## Backend changes

Changed file:

- `compile-backend-cloudrun/memory_service.py`

New tables:

- `agent_runs`
- `context_bundles`
- `agent_outputs`

New endpoints:

- `POST /api/lumina/memory/agent-run`
- `GET /api/lumina/memory/debug/agent-runs`

`/api/lumina/memory/health` now reports counts for agent runs, context bundles, and outputs.

## Verification

After deploying backend and frontend, run a competitive review or reviewer/rebuttal simulation, then check:

```bash
curl https://YOUR_MEMORY_BACKEND/api/lumina/memory/health
curl https://YOUR_MEMORY_BACKEND/api/lumina/memory/debug/agent-runs
```

In Neon SQL Editor:

```sql
select agent_role, task_type, status, count(*)
from agent_runs
group by agent_role, task_type, status
order by count(*) desc;

select workflow, step_name, memory_count, count(*)
from context_bundles
group by workflow, step_name, memory_count
order by count(*) desc;
```

This stage is the data foundation for later learned context policies and debate tree search.

# Stage 19K — Memory Feedback Loop Frontend

Stage: `stage19k-memory-feedback-loop-frontend-20260526-1`

This stage wires user outcome events back to the Stage 19J ranked context that was
selected before each AI call.

## Changed files

- `js/reward-logging-service.js`
- `index.html` cache-bust/stage marker

## Behavior

When an AI action is accepted/applied/saved/rejected, `RewardLoggingService` now:

1. logs the edit outcome,
2. logs the scalar reward event, and
3. posts a feedback update to:

```text
/api/lumina/memory/context-feedback
```

The feedback payload includes the latest `agentRunId`, `contextBundleId`, selected
`memoryIds`, workflow, task type, agent role, acceptance signal, and reward value.
If selected memory ids are not directly available, the backend can recover them
from the agent run/context bundle.

This remains hidden from the UI.

## Verification

Use a workflow such as Copilot apply or Citation AI run + apply. Then check Neon:

```sql
select
  agent_role, task_type, workflow, memory_id, times_selected, times_used,
  successful_uses, failed_uses, neutral_uses, total_reward,
  to_timestamp(last_outcome_at_ms / 1000.0) as last_outcome_at
from agent_context_usage_stats
order by updated_at_ms desc
limit 30;
```

`times_used` and one of `successful_uses`, `failed_uses`, or `neutral_uses` should
increase after the user outcome is logged.

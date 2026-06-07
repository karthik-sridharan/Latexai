# Stage 19N1P2 — Resolver Direct Memory Reward Feedback

Frontend-only hotfix for Stage 19N1P.

## Why

Stage 19N1P attempted to record resolver accept/reject feedback through:

```text
/api/lumina/debate/record-branch-outcome
```

That endpoint may record debate outcomes but does not reliably populate the canonical memory-learning tables queried during debugging:

```text
edit_outcomes
reward_events
```

## Change

Resolver actions now post directly to the canonical memory endpoints:

```text
POST /api/lumina/memory/edit-outcome
POST /api/lumina/memory/reward
```

The local resolver still works even if reward logging fails.

## Frontend behavior

When a user resolves a source-scanned edit:

- Keep red/new records an accepted positive outcome.
- Keep blue/old records a rejected negative outcome.
- The payload includes workflow, action type, reward value, accepted flag, path, line, and compact old/new previews.

Workflow written to Neon:

```text
latexai-source-scanned-ai-edit-resolver
```

## Test

Open:

```text
/index.html?v=19n1p2
```

Then:

```text
Copilot → Paper-level AI → Resolve AI edits → Refresh edits
Keep red/new or Keep blue/old
```

Check Neon:

```sql
select
  action_type,
  workflow,
  reward_value,
  accepted,
  metadata_json,
  to_timestamp(created_at_ms / 1000.0) as created_at
from edit_outcomes
where workflow = 'latexai-source-scanned-ai-edit-resolver'
order by created_at_ms desc
limit 20;
```

Reward event check:

```sql
select
  event_type,
  workflow,
  reward_value,
  reward_label,
  to_timestamp(created_at_ms / 1000.0) as created_at
from reward_events
where workflow = 'latexai-source-scanned-ai-edit-resolver'
order by created_at_ms desc
limit 20;
```

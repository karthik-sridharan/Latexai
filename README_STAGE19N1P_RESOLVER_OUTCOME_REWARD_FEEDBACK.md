# Stage 19N1P — Resolver Outcome Reward Feedback

Frontend-only stage built on Stage 19N1N.

## Goal

The Resolve AI edits panel already scans the live `.tex` source for `\lai{...}` and `\laiold{...}`. Stage 19N1P closes the learning loop by recording each resolver accept/reject action as reward feedback.

## What changed

Changed file:

- `js/document-ai-service.js`

## Behavior

When the user resolves an edit:

- **Keep red/new** records a positive accepted outcome.
- **Keep blue/old** records a negative rejected outcome.
- The source edit is still resolved locally even if backend feedback recording fails.
- Batch resolve actions record one feedback event per resolved edit.

The feedback is sent to the existing backend endpoint:

```text
POST /api/lumina/debate/record-branch-outcome
```

with workflow:

```text
latexai-source-scanned-ai-edit-resolver
```

and metadata such as:

```text
editId
editType
path
line
kept
old/new preview
frontendStage
```

## Why this matters

This lets Latexai learn from what users actually accept or reject after any workflow creates visible `\lai` edits, including:

- paper-level AI edits
- Devil's Advocate edits
- competitive review edits
- equation-explanation edits

## Test

Open:

```text
/index.html?v=19n1p
```

Then:

1. Go to Copilot → Paper-level AI → Resolve AI edits.
2. Click **Refresh edits**.
3. Resolve one edit with **Keep red/new** or **Keep blue/old**.
4. Confirm the edit is resolved locally.
5. Confirm the resolver feedback status says the outcome was recorded, if the memory backend URL/token is configured.

Optional Neon check:

```sql
select
  action_type,
  workflow,
  reward_value,
  metadata_json,
  to_timestamp(created_at_ms / 1000.0) as created_at
from edit_outcomes
where workflow = 'latexai-source-scanned-ai-edit-resolver'
order by created_at_ms desc
limit 20;
```

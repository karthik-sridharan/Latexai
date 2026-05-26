# Stage 19G Backend — Edit Outcome and Reward Logging

This backend stage extends the Neon/Postgres-backed memory service with reward/outcome tables and endpoints.

## New tables

- `edit_outcomes`
  - Stores whether an AI edit/action succeeded, failed, was accepted, passed validation, compiled, or committed.

- `reward_events`
  - Stores scalar positive/negative/neutral reward events for future policy/value learning.

## New endpoints

- `POST /api/lumina/memory/edit-outcome`
  - Records an edit or AI action outcome.

- `POST /api/lumina/memory/reward`
  - Records a scalar reward event.

- `GET /api/lumina/memory/debug/rewards`
  - Returns recent reward/outcome records and aggregate counts.

## Deployment target

Deploy this backend to the existing compile/memory Cloud Run service:

```text
lumina-latex-backend
```

Do not deploy this to the GitHub sync backend.

## Verification

After deploy:

```bash
curl https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/memory/health
curl https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/memory/debug/rewards
```

Neon SQL:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('edit_outcomes', 'reward_events')
order by table_name;
```

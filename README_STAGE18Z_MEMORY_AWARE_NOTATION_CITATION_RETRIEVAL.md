# Stage 18Z — Memory-aware notation/citation retrieval

Frontend-only stage. No backend redeploy is required.

## What changed

- Competitive Review now retrieves broader hidden research memory context before AI calls.
- Reviewer/Rebuttal Simulator now retrieves broader hidden research memory context before reviewer, rebuttal, and final synthesis calls.
- Retrieved memories are grouped in the hidden prompt as:
  - known notation / LaTeX structure memory
  - citation / related-work memory
  - recurring reviewer and proof concerns
  - negative memory / directions to avoid
  - prior edit / synthesis memory
- The retrieval query now explicitly asks the memory backend for Stage 18Y fact types, such as `notation_sentence`, `theorem_environment`, `latex_label_inventory`, `citation_gap_or_related_work_memory`, `competitor_reference_seeds`, and `recurring_reviewer_concern`.
- The main UI remains unchanged; memory remains hidden except for Settings diagnostics.

## Upload paths

Upload these files preserving paths:

- `index.html`
- `js/competitive-paper-review-service.js`
- `js/reviewer-rebuttal-simulator-service.js`
- `js/backend-url-settings-service.js`
- `js/research-memory-extraction-service.js`

Then open:

```text
https://karthik-sridharan.github.io/Latexai/?v=18z
```

## Verification

1. Confirm the stage badge says `latex-stage18z-memory-aware-notation-citation-retrieval-20260524-1`.
2. Run Full Cited Review or Reviewer/Rebuttal Simulator.
3. In Neon, check `memory_usage_events` starts increasing because retrieved facts are marked as used.

Suggested SQL:

```sql
select 'memory_facts' as table_name, count(*) from memory_facts
union all
select 'memory_usage_events', count(*) from memory_usage_events
union all
select 'memory_edges', count(*) from memory_edges;
```

To inspect usage by task:

```sql
select task_type, outcome, count(*)
from memory_usage_events
group by task_type, outcome
order by count(*) desc, task_type;
```

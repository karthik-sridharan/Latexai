# Latexai Stage 18Y — Notation and Citation Memory Extraction

Frontend-only stage. No backend redeploy is required if Stage 18X8 memory backend is already deployed and working.

## What changed

Stage 18Y adds a hidden `ResearchMemoryExtractionService` that silently extracts research-specific memories from LaTeX source and AI outputs, then writes them to the configured memory backend.

It extracts:

- citation keys already used in the paper
- bibliography resources
- theorem-like environments
- LaTeX macro / notation definitions
- likely notation convention sentences
- LaTeX label inventory summaries
- reviewer/report concerns
- proof/theorem concerns
- notation/symbol concerns
- citation / related-work gaps
- negative-memory candidates, such as suggestions to avoid or rejected directions
- competitor/reference URL seeds and target venue context

## Where it is connected

- Competitive Review: after full cited reviews, roadmap/reports, and `\lai` edit insertion/append operations.
- Reviewer / Rebuttal Simulator: after simulated reviews, rebuttal generation, and final synthesis.

## Files changed

- `index.html`
- `js/research-memory-extraction-service.js`
- `js/competitive-paper-review-service.js`
- `js/reviewer-rebuttal-simulator-service.js`
- `js/backend-url-settings-service.js`

## How to deploy

Upload the patch files to GitHub preserving paths. Then open:

```text
https://karthik-sridharan.github.io/Latexai/?v=18y
```

In Settings, keep:

```text
Memory backend URL:
https://lumina-latex-backend-zugntkn2la-ue.a.run.app
```

## How to verify

Run a Full Cited Review or Reviewer/Rebuttal workflow, then check Neon SQL Editor:

```sql
select fact_type, count(*)
from memory_facts
group by fact_type
order by count(*) desc, fact_type;
```

You should see new fact types such as:

- `citation_keys_used`
- `notation_macro_definition`
- `theorem_environment`
- `recurring_reviewer_concern`
- `citation_gap_or_related_work_memory`
- `notation_or_symbol_concern`
- `proof_or_theorem_concern`
- `negative_memory_candidate`

Or check backend health/debug:

```bash
curl https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/memory/health
curl https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/memory/debug/scopes
```

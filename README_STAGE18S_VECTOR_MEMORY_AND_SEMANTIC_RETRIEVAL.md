# Stage 18S — Vector Memory and Semantic Retrieval

This stage upgrades the hidden Latexai memory system from usage/recency retrieval to semantic retrieval.

## Backend changes

- Adds `memory_embeddings` SQLite table.
- Creates deterministic local hash embeddings for memory facts, summaries, and events.
- Adds semantic scoring to `/api/lumina/memory/context` via optional `q` / `query` parameter.
- Adds `/api/lumina/memory/search` as an alias for semantic memory retrieval.
- Adds automatic `semantically_related` graph edges between similar memory facts in the same project/paper.
- Keeps the system backend-only; no main UI memory controls are added.

## Frontend changes

- Competitive review sends a semantic query when retrieving hidden memory context.
- Reviewer/rebuttal simulator sends a semantic query for reviewer, rebuttal, and final synthesis calls.
- Memory remains invisible in the UI.

## Backend verification

After deploying the backend, run:

```bash
curl https://YOUR_BACKEND/api/lumina/memory/health
```

You should see an `embeddings` count in addition to events/facts/usageEvents/edges/summaries.

After running review/rebuttal workflows, test semantic retrieval:

```bash
curl "https://YOUR_BACKEND/api/lumina/memory/context?projectId=PROJECT_ID&paperId=PAPER_ID&q=theorem%20assumptions%20proof%20conditions&limit=10"
```

Returned facts include `semanticScore`, `retrievalScore`, and `retrievalMode` should be `semantic+usage+recency`.

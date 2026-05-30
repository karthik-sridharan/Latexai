# Stage 19T — Knowledge-aware review agents frontend

Adds a knowledge retriever toggle/topK control to the Devil's Advocate branch runner. Before branch planning/running, the frontend calls `POST /api/lumina/research/context-for-paper`, displays retrieved papers, and injects the compact literature context into critic/supporter/synthesis prompts.

Expected badge: `latex-stage19t-knowledge-aware-review-agents-20260530-1`.

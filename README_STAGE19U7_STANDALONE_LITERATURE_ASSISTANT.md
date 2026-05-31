# Stage 19U7 — Standalone Literature Survey Assistant

This stage moves the knowledge-retriever population and retrieval/debug UI into a sister app at:

```text
literature.html
```

The main `index.html` LaTeX editor is intentionally kept minimal: it only gets a top-bar link to open the separate Literature Assistant. The existing paper-review knowledge toggles remain available, but new ingestion/enrichment/search controls should live in `literature.html` going forward.

## Sister app capabilities

- Configure Cloud Run `/api/lumina` backend base and ingestion token.
- Check backend status.
- Batch-ingest paper URLs into the research library.
- Run external metadata lookup without mutating the library.
- Enrich all or individual library works using the Stage 19U6 metadata enrichment endpoints.
- Run hybrid/author-graph search through `/api/lumina/research/search`.
- Build paper-context retrieval through `/api/lumina/knowledge/context-for-paper`.
- Show hybrid score, semantic score, score breakdown, why-retrieved reasons, enrichment sources, and canonical author keys.
- Pin/exclude papers using the same localStorage keys consumed by LatexAI knowledge-aware workflows.

## Main app change

Only a minimal topbar link was added:

```html
<a id="literatureAssistantBtn" class="btn ghost" href="literature.html" target="_blank" rel="noopener">Literature Assistant</a>
```

No new large knowledge-management cards were added to `index.html`.

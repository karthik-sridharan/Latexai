# Stage 19U8 — Multi-source bulk literature ingest frontend

Adds a new `Bulk import` tab to `literature.html`.

The tab supports:

- topic/query input;
- optional author and keyword hints;
- OpenAlex / Semantic Scholar / arXiv source toggles;
- max candidates and per-source limits;
- optional year range;
- preview candidates before ingestion;
- select all / clear selection;
- import selected / import top shown;
- enrich existing duplicates.

The main LaTeX editor remains minimal. This is part of the standalone Literature Survey Assistant sister app.

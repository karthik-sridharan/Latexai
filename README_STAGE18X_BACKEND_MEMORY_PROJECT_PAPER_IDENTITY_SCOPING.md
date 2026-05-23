# Latexai Stage 18X — Backend Memory Scope Registry

This backend stage adds project/paper/section/session scope registration to the hidden memory service.

## New storage

Adds table:

- `memory_scopes`

It tracks known memory scopes with:

- project id
- paper id
- section id
- session id
- document fingerprint
- source hash
- title guess
- root path
- active path
- last context/event/fact/summary touch times

## New endpoints

- `POST /api/lumina/memory/scope`
- `GET /api/lumina/memory/debug/scopes`

## Existing behavior preserved

- SQLite fallback still works.
- Neon/Postgres backend still works through `LATEXAI_MEMORY_BACKEND=postgres` and `NEON_DATABASE_URL`.
- No main UI changes.

# Stage 18O — Competitive review memory wiring (backend-only)

This stage connects the existing Competitive Paper Review workflow to the invisible Stage 18N memory backend.

## What changed

- No memory UI was added.
- `js/competitive-paper-review-service.js` now silently retrieves compact memory context from:
  - `GET /api/lumina/memory/context`
- Competitive review steps now silently save memory artifacts to:
  - `POST /api/lumina/memory/event`
  - `POST /api/lumina/memory/fact`
  - `POST /api/lumina/memory/summary`
  - `POST /api/lumina/memory/edge`
  - `POST /api/lumina/memory/use`
- Memory retrieval is best-effort and non-blocking. If the memory backend is unavailable, competitive review continues normally.
- Memory is derived from the configured compile backend URL by replacing `/api/lumina/latex/compile` with `/api/lumina/memory`.
- Set `localStorage['latexai:memory-enabled']='false'` to disable this hidden memory wiring during debugging.

## What gets stored

The workflow stores:

- competitor ranking reports
- draft comparison reports
- final competitive review reports
- saved `/reviews/...` report content
- project/paper summary state
- graph edge from each saved fact to its source event

## What gets injected into AI calls

Before a competitive review/ranking/comparison step, the frontend asks the backend for scoped memory using:

- user id: local-user
- project id: stable hash of current project name/id/root file
- paper id: stable hash of project + root file
- session id: browser session id
- section id: stable hash of active path

The agent receives a compact hidden block labelled:

`Hidden Latexai project memory context`

The prompt tells the agent to use it silently and not mention the memory system in user-facing reports.

## Deployment

Copy these files into the frontend deployment:

- `js/competitive-paper-review-service.js`
- `index.html`

The backend must be Stage 18N or later and expose `/api/lumina/memory/health`.

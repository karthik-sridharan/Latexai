# Stage 19L5 — Shallow Branch Rollout Simulator Frontend

Extends `/developer-debate-branches.html` with shallow rollout controls and output tables.

## New UI actions

- `Rollout current evaluated branches`
- `Generate + evaluate + rollout`
- `Copy rollout curl`

## New controls

- rollout depth
- rollout branch limit
- optional rollout trajectory recording

## Backend required

Requires Stage 19L5 backend with:

- `POST /api/lumina/debate/rollout-branches`
- `GET /api/lumina/debate/debug/rollout-branches`

No LLM call is made by this developer page during rollout.

# Lumina LaTeX Backend — Stage 1C

This backend is optional for the static editor, but required for real PDF compilation and protected AI provider calls.

## Capabilities

- Project save/load memory store.
- AI proxy for OpenAI, Anthropic/Claude, and Gemini.
- Synchronous TeX compile endpoint.
- Job-based TeX compile endpoint with status polling, optional server-sent events, cancellation, logs, and PDF result.
- Path/file validation, byte limits, compile timeouts, and shell-escape policy enforcement.

## Run locally

```bash
npm install
npm start
```

The host must have TeX tools installed if you are not using Docker.

## Docker

```bash
docker build -t lumina-latex-backend-stage1c .
docker run --rm -p 3000:3000 --env-file .env lumina-latex-backend-stage1c
```

## Compile API

```text
POST   /api/lumina/latex/compile/jobs
GET    /api/lumina/latex/compile/jobs/:jobId
GET    /api/lumina/latex/compile/jobs/:jobId/events
DELETE /api/lumina/latex/compile/jobs/:jobId
POST   /api/lumina/latex/compile
```

`POST /jobs` accepts the same `lumina-latex-compile-request-v1` payload as the synchronous endpoint and returns a `jobId`. The frontend polls `GET /jobs/:jobId` until `status` is `succeeded`, `failed`, or `canceled`.

## Security notes

- Keep `ALLOW_SHELL_ESCAPE=false` by default.
- Set `LUMINA_PROXY_TOKEN` for any public deployment.
- Put this backend behind HTTPS and a reverse proxy in production.
- This Stage 1C backend uses temporary per-job workspaces and removes them after compile.
- A production deployment should add OS/container sandboxing, CPU/memory limits, and persistent project storage.

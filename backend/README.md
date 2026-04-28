# Lumina LaTeX Backend — Stage 1E

Stage 1E is the first real PDF compile runner. The static frontend can still live on GitHub Pages, while this backend runs separately and exposes trusted compile + AI proxy endpoints.

## What it provides

- `GET /health`
- `GET /api/lumina/latex/status`
- `POST /api/lumina/latex/compile/jobs`
- `GET /api/lumina/latex/compile/jobs/:jobId`
- `GET /api/lumina/latex/compile/jobs/:jobId/events` for SSE progress
- `DELETE /api/lumina/latex/compile/jobs/:jobId`
- `POST /api/lumina/latex/compile` synchronous fallback
- `POST /api/lumina/ai`
- in-memory project save/load endpoints

## Recommended run mode

Run the backend in the provided Docker image. The image includes Node plus a TeX Live subset large enough for common article/beamer/amsmath/graphicx/bibtex workflows.

```bash
cd backend
cp .env.example .env
npm install
npm start
```

For real TeX compilation without installing TeX on your machine:

```bash
cd backend
docker build -t lumina-latex-backend:stage1e .
docker run --rm -p 3000:3000 \
  --env-file .env \
  lumina-latex-backend:stage1e
```

Then set the frontend compile URL to:

```text
http://localhost:3000/api/lumina/latex/compile
```

For production with GitHub Pages frontend, set it to something like:

```text
https://your-backend.example.com/api/lumina/latex/compile
```

## Security posture in Stage 1E

- Project files are written to a temporary workspace.
- Workspaces are deleted after compile by default.
- Shell escape is blocked unless `ALLOW_SHELL_ESCAPE=true`.
- File extensions are allowlisted.
- Project size, file count, compile timeout, PDF size, and rate limits are configurable.
- API keys live only on the backend.

This is not yet a multi-user isolation system. For a public multi-user service, keep this backend behind auth, use per-user quotas, and run each compile in a stronger container/job sandbox.

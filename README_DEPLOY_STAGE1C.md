# Lumina LaTeX Editor — Stage 1C Compile Pipeline

Stage 1C keeps the Stage 1B provider architecture and adds the first production-shaped compilation pipeline.

## Static app

Deploy these paths as a static sibling app, for example `/lumina-latex-editor/`:

```text
index.html
css/
js/
prompts/
examples/
```

The static app works without a backend for editing, local autosave, draft preview, file tree, diagnostics, and export. Real PDF compilation needs the optional backend.

## Backend

The backend is in `backend/` and provides:

```text
POST   /api/lumina/latex/compile/jobs
GET    /api/lumina/latex/compile/jobs/:jobId
GET    /api/lumina/latex/compile/jobs/:jobId/events
DELETE /api/lumina/latex/compile/jobs/:jobId
POST   /api/lumina/latex/compile
POST   /api/lumina/ai
POST   /api/lumina/projects/:projectId
GET    /api/lumina/projects/:projectId
```

The frontend uses the job endpoint by default. If a backend only supports the older synchronous endpoint, the frontend can fall back to `POST /api/lumina/latex/compile`.

## Local backend run

```bash
cd backend
npm install
npm start
```

For real LaTeX compilation, the host or container needs TeX tools such as `pdflatex`, `xelatex`, `lualatex`, `bibtex`, and/or `latexmk`. The included Dockerfile installs a broad TeX Live set.

## Environment

Copy `backend/.env.example` to `.env` or set equivalent environment variables.

Important compile settings:

```text
COMPILE_TIMEOUT_MS=25000
COMPILE_JOB_TTL_MS=900000
MAX_PROJECT_BYTES=4000000
MAX_COMPILE_LOG_BYTES=160000
ALLOW_SHELL_ESCAPE=false
LUMINA_PROXY_TOKEN=
```

Keep `ALLOW_SHELL_ESCAPE=false` unless you have a hardened sandbox. If `LUMINA_PROXY_TOKEN` is set, the frontend must enter the same token in Settings.

## Diagnostic check

```bash
node check_stage1c.js
```

This validates file presence, JavaScript syntax, DOM contract strings, frontend compile-job hooks, and backend route contracts.

# Deploy Lumina LaTeX Editor Stage 1E

Stage: `latex-stage1e-copilot-workflows-20260428-1`

## Static frontend

Upload the top-level app files to your static host, for example GitHub Pages:

```text
index.html
css/
js/
prompts/
examples/
```

The frontend still works without a backend for editing, file tree, local autosave, draft preview, diagnostics, and export.

## Backend

Deploy only the `backend/` folder to a Docker-capable host such as Google Cloud Run, Railway, Render, or a VM.

Required runtime variables for protected browser access:

```env
ALLOWED_ORIGINS=https://karthik-sridharan.github.io
LUMINA_PROXY_TOKEN=replace-with-a-long-secret
ALLOW_SHELL_ESCAPE=false
COMPILE_TIMEOUT_MS=90000
MAX_PROJECT_BYTES=4000000
MAX_PROJECT_FILES=120
MAX_COMPILE_LOG_BYTES=180000
MAX_PDF_BYTES=16000000
CLEANUP_WORKSPACES=true
```

Optional AI provider variables:

```env
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
```

## Frontend settings

Set:

```text
Compile backend URL:
https://your-backend-domain/api/lumina/latex/compile

Compile backend token:
<same value as LUMINA_PROXY_TOKEN>

AI backend proxy URL:
https://your-backend-domain/api/lumina/ai

AI proxy token:
<same value as LUMINA_PROXY_TOKEN>
```

## New Stage 1E backend endpoints

```text
GET  /api/lumina/ai/status
GET  /api/lumina/ai/workflows
POST /api/lumina/ai
```

The frontend sends structured project context to `POST /api/lumina/ai`. Copilot patch tasks ask the model to return `lumina-latex-ai-patch-v1` JSON, which the browser previews before applying.

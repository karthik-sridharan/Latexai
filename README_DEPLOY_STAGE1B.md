# Lumina LaTeX Editor — Stage 1B Foundation

Stage: `latex-stage1b-foundation-20260427-1`

This stage is a foundation pass before feature expansion. It keeps the Lumina presentation-maker visual language, but reorganizes the LaTeX editor around stable contracts so later TeX sandboxing, WebSocket collaboration, source/PDF sync, provider-based AI, and project storage do not require a migration.

## Static deployment

Deploy the contents of this folder as a sibling app, for example:

```text
/lumina-latex-editor/
  index.html
  css/
  js/
  prompts/
  examples/
```

The static app works without a backend for:

- multi-file project model
- local autosave
- file tree
- LaTeX source editor
- draft preview
- basic diagnostics
- project ZIP export
- Copilot UI and provider selector shell
- compiler provider selector shell

## Backend deployment

The optional backend lives in `backend/` and is still intentionally small. It provides:

- `POST /api/lumina/latex/compile` — synchronous TeX compile route
- `POST /api/lumina/ai` — AI provider proxy route
- `GET /api/lumina/models` — model listing route
- `POST /api/lumina/projects/:projectId` — Stage 1B memory-backed save contract
- `GET /api/lumina/projects/:projectId` — Stage 1B memory-backed load contract
- `POST /api/lumina/latex/compile/jobs` — reserved compile-job contract
- `GET /ws/lumina/projects/:projectId` — reserved WebSocket upgrade path

Install and run:

```bash
cd backend
npm install
cp .env.example .env
npm start
```

For real PDF compilation, the host must have TeX Live tools available, or you can build/run the included Dockerfile.

## Foundation contracts added in Stage 1B

Frontend modules:

```text
js/app-kernel.js          # stage metadata and API contracts
js/project-model.js       # canonical project schema
js/project-store.js       # local persistence and snapshots
js/editor-adapter.js      # textarea now, CodeMirror-ready seam
js/compiler-provider.js   # backend/mock/browser-WASM providers
js/ai-provider.js         # OpenAI/Claude/Gemini via backend proxy
js/sync-provider.js       # local/http/websocket provider seam
js/preview-adapter.js     # draft/PDF preview seam
```

Backend seams:

```text
backend/providers/
backend/security/
```

## Important design choices

- The project schema is now `lumina-latex-project-v1`.
- `rootFile` and `mainFile` are normalized to the same root `.tex` file.
- Files have stable ids, paths, kinds, encodings, timestamps, and versions.
- Compile calls use `lumina-latex-compile-request-v1`.
- AI calls use `lumina-latex-ai-request-v1` and never expose provider keys in browser code.
- WebSocket collaboration is reserved but not required.
- The default sync mode is still `local-only`.

## Recommended next stage

Stage 1C should focus on production compile behavior:

- compile job ids instead of only synchronous compile
- streamed compile progress over SSE or WebSocket
- containerized/sandboxed TeX Live execution
- better log parsing and click-to-line diagnostics
- image and binary asset upload support

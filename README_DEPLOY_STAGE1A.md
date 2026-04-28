# Lumina LaTeX Editor — Stage 1A deploy notes

Stage: `latex-stage1a-20260427-1`

This is the first deployable sibling app based on the Lumina Presenter design language. It is a static browser app with an optional backend for real PDF compilation and AI provider proxying.

## What to deploy on GitHub Pages

Upload this folder contents as a static site:

```text
lumina-latex-editor-stage1a/
  index.html
  css/
  js/
  prompts/
  examples/
```

The app runs without a backend for editing, local autosave, file-tree management, approximate draft preview, diagnostics, and project export.

## Optional backend

The `backend/` folder is a separate Node service. Deploy it somewhere that can run Node and TeX Live, for example a VPS, Render, Railway, Fly.io, or a container service.

Then set in the app UI:

```text
Compile backend URL: https://your-backend.example.com/api/lumina/latex/compile
AI proxy URL:        https://your-backend.example.com/api/lumina/ai
```

## Current capabilities

- Lumina-style three-pane UI: file tree / source editor / preview, logs, Copilot, settings.
- Multi-file project state with `main.tex`, `.bib`, templates, root-file selector, and local autosave.
- Approximate local draft preview for sections, theorem/proof blocks, itemize/enumerate, inline/display math placeholders, bibliography references, and basic figure placeholders.
- Diagnostics for missing DOM/modules, localStorage, project state, backend URLs, and preview presence.
- Export active file and export project zip without external browser dependencies.
- Import `.tex`, `.bib`, `.sty`, `.cls`, `.txt`, `.md`, and project JSON files.
- Optional backend `POST /api/lumina/latex/compile` for real PDF generation.
- Optional backend `POST /api/lumina/ai` for OpenAI / Anthropic / Gemini without exposing keys in browser code.

## Known Stage 1A limits

- Draft preview is not a real TeX engine.
- ZIP import is not implemented yet; import multiple source files or project JSON instead.
- Binary asset handling is placeholder-only in the static app.
- Source/PDF sync, collaboration, and version history are future stages.
- Compile security should be hardened before letting arbitrary public users run TeX.

## Suggested next stage

Stage 1B should add a real code editor component, PDF download controls, better asset import, clickable compile errors, and a tighter backend deployment guide.

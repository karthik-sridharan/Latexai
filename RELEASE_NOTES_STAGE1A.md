# Release notes — Lumina LaTeX Editor Stage 1A

## Added

- New standalone `lumina-latex-editor` app modeled on the Lumina Presenter UI palette and layout.
- Three-pane editor shell with project/file rail, LaTeX source editor, draft/PDF preview panel, logs, Copilot, and settings.
- Local project model with autosave, root file, active file, templates, and JSON/zip export.
- Draft LaTeX preview and lightweight source diagnostics.
- AI provider/model picker and proxy caller for OpenAI, Claude/Anthropic, and Gemini.
- Optional backend with `/api/lumina/ai`, `/api/lumina/models`, `/api/lumina/latex/compile`, and `/health`.
- Backend TeX compile route with request limits, timeout, safe relative paths, and shell-escape disabled by default.

## Not yet included

- Full Overleaf-style collaboration.
- Real-time source/PDF sync.
- Browser WASM TeX engine.
- ZIP import.
- Strong production sandboxing for public TeX compile workloads.

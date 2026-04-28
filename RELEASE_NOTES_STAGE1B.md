# Release notes — Lumina LaTeX Editor Stage 1B

## Added

- Canonical `lumina-latex-project-v1` project model.
- Local project store and snapshot seam.
- Editor adapter seam so CodeMirror can be added later without changing callers.
- Compiler provider seam with `backend-texlive`, `mock-draft`, and `browser-wasm` placeholder providers.
- AI provider seam for OpenAI, Claude/Anthropic, and Gemini through the backend proxy.
- Sync provider seam with local-only, HTTP project, and WebSocket placeholder providers.
- Preview adapter seam for draft HTML and PDF blob previews.
- Backend project save/load contract stubs.
- Reserved compile-job and WebSocket endpoint contracts.
- Backend provider/security directories for future compile and AI provider split.
- Expanded diagnostics to check architecture modules, not just UI modules.

## Preserved

- Lumina-style color scheme and layout.
- Static-first deployability.
- Local autosave and project ZIP export.
- Draft preview and diagnostics.
- Optional backend for compile and AI.

## Not yet implemented

- Real collaborative editing.
- Persistent backend database storage.
- Full CodeMirror 6 integration.
- Compile job streaming.
- Source/PDF sync.

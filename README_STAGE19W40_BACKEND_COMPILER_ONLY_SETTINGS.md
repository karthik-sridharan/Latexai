# Stage 19W40 — Backend compiler-only Settings cleanup

Baseline: `latexai-frontend-stage19w39-compile-jobs-load-fallback-full-source.zip`.

This stage simplifies the Settings → Compile backend / engines drawer so it only exposes Cloud Run TeX Live backend controls.

## UI cleanup

- Removed visible compiler-provider choices other than the backend compiler.
- Removed Browser WASM / SwiftLaTeX settings and status controls from the Settings UI.
- Removed TeXlyre BusyTeX settings and status controls from the Settings UI.
- Removed mock-draft provider choice from the Settings UI.
- Removed the Overleaf button from the compile settings drawer.
- Left a hidden `compilerModeSelect` sentinel set to `backend-texlive` for compatibility with existing scripts and diagnostics.

## Backend compiler behavior

- Compile endpoint default is now the active backend:
  `https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/latex/compile`
- Direct backend compile is now the default.
- Job-based compile is visible as a backend-only checkbox, but old hidden `useCompileJobs:true` localStorage state no longer silently enables it.
- Jobs and status endpoints are derived from the compile endpoint so stale old backend URLs do not linger:
  - `/api/lumina/latex/compile/jobs`
  - `/api/lumina/latex/status`
- If a user pastes a backend base URL, status URL, or jobs URL into the compile endpoint field, the frontend normalizes it back to the direct `/compile` endpoint on that same origin.

## Files changed

- `index.html`
- `js/app-kernel.js`
- `js/backend-diagnostics-service.js`
- `js/compiler-provider.js`
- `js/compiler-provider-preload.js`
- `js/diagnostics.js`
- `js/preview.js`
- `js/project-model.js`
- `js/right-panel-organizer-service.js`
- `tests/stage19w40-backend-compiler-only-settings.test.cjs`

## Verification

```bash
node --check js/preview.js
node --check js/compiler-provider.js
node --check js/compiler-provider-preload.js
node --check js/project-model.js
node --check js/diagnostics.js
node --check js/backend-diagnostics-service.js
node --check js/right-panel-organizer-service.js
node tests/stage19w40-backend-compiler-only-settings.test.cjs
```

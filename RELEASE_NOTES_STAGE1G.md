# Lumina LaTeX Editor Stage 1G Hotfix: TeXlyre Module Readonly

Stage: `latex-stage1g-texlyre-worker-mode-hotfix-20260428-1`

This hotfix addresses Safari/iPad failures where the TeXlyre BusyTeX ES module loaded but the provider attempted to attach cache metadata directly to the read-only module namespace object.

Changes:
- Do not mutate imported ES module namespace objects.
- Cache TeXlyre module URL metadata separately.
- Use TeXlyre's documented `additionalFiles` compile shape.
- Check BusyTeX asset names documented by BusyTeX/TeXlyre: `busytex_worker.js`, `busytex_pipeline.js`, `busytex.js`, `busytex.wasm`, `texlive-basic.js`, and `texlive-basic.data`.
- Improve diagnostics for module-readonly errors.

## Worker-mode hotfix 2026-04-28

- Added a TeXlyre Web Worker mode toggle.
- Default TeXlyre initialization now uses direct mode, which is safer on Safari/iPad when worker errors are reported as `undefined`.
- TeXlyre diagnostics now distinguish direct-mode assets from worker-mode assets.
- Added `texlyreUseWorker` to settings and copied diagnostics.

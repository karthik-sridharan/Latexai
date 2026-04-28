# Lumina LaTeX Editor Stage 1G — TeXlyre Asset Preflight Hotfix

Stage: `latex-stage1g-texlyre-preflight-reporting-hotfix-20260428-1`

This hotfix keeps the TeXlyre BusyTeX provider in Safari/iPad direct mode and adds explicit asset preflight diagnostics before BusyTeX runtime initialization.

## Changes

- Adds asset preflight for BusyTeX runtime files before `BusyTexRunner.initialize()`.
- Reports exact URLs, HTTP status, content type, and content length for required assets.
- Uses an absolute `busytexBasePath` when constructing `BusyTexRunner`.
- Checks common nested folder layouts such as `.../busytex/busytex`.
- Adds `assetPreflight.checkedBases` to diagnostics and TeXlyre status.
- Improves error messages for Safari `[object Event]` initialization failures.

## Required direct-mode assets

- `busytex_pipeline.js`
- `busytex.js`
- `busytex.wasm`

Optional but recommended package assets:

- `texlive-basic.js`
- `texlive-basic.data`

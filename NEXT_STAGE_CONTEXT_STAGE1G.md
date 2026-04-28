# Next Stage Context — Stage 1G Asset Preflight Hotfix

Current stage: `latex-stage1g-texlyre-preflight-first-hotfix-20260428-1`.

The TeXlyre module import now works from jsDelivr. The likely remaining issue is BusyTeX asset layout, MIME type, or large-file serving on GitHub Pages/iPad Safari.

Ask the user for the next diagnostic and inspect:

```json
texlyreBusyTexStatus.assetPreflight.checkedBases
```

The required direct-mode files are `busytex_pipeline.js`, `busytex.js`, and `busytex.wasm`. If these are not all reachable with status 200/206, fix the deployed `vendor/texlyre/core/busytex/` asset folder before changing provider code again.

# Next Stage Context

Current stage: `latex-stage1g-texlyre-cdn-fallback-hotfix-20260428-1`.

The TeXlyre provider now avoids depending solely on esm.sh and falls back to jsDelivr, unpkg, esm.sh, and a local vendored package path. If browser-side TeXlyre still fails on Safari/iPad, inspect `texlyreBusyTexStatus.moduleImportAttempts`, `moduleLoadedFrom`, and `likelyAssets` in diagnostics.

If module import succeeds but BusyTeX initialization fails, the next likely work is an asset-layout preflight checker that lists exact successful/failed URLs for `busytex_pipeline.js`, `busytex.js`, `busytex.wasm`, `texlive-basic.js`, and `texlive-basic.data`.

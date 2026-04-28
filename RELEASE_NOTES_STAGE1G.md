# Release Notes — Stage 1G TeXlyre Direct-Mode Safari Hotfix

Stage: `latex-stage1g-texlyre-direct-mode-safari-hotfix-20260428-1`

This hotfix addresses Safari/iPad TeXlyre initialization reports where diagnostics still showed `texlyreUseWorker: true` after the worker-mode hotfix.

Changes:
- Force-disables TeXlyre Web Worker mode on Safari/iPad so direct mode is tested first.
- Clears stale persisted `texlyreUseWorker: true` settings during state normalization.
- Adds a “Reset TeXlyre to direct mode” button.
- Diagnostics now report `directModeForced` and `directModeReason`.
- The provider now passes `busytexBasePath`, `assetBasePath`, and `basePath` to the BusyTeX runner for compatibility with slightly different module builds.

Expected diagnostic after deploy on Safari/iPad:
- `settings.texlyreUseWorker: false`
- `texlyreBusyTexStatus.useWorker: false`
- `texlyreBusyTexStatus.directModeForced: true`

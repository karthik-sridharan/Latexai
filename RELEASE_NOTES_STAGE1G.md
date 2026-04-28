# Lumina LaTeX Editor Stage 1G CDN Fallback Hotfix

Stage: `latex-stage1g-texlyre-cdn-fallback-hotfix-20260428-1`

This hotfix addresses Safari/iPad failures importing TeXlyre BusyTeX from `esm.sh`.

## Changes

- Default TeXlyre module URL changed to jsDelivr direct ESM:
  `https://cdn.jsdelivr.net/npm/texlyre-busytex@1.1.1/dist/index.js`
- TeXlyre provider now tries module candidates in order:
  1. configured Module URL
  2. jsDelivr direct package ESM
  3. unpkg direct package ESM
  4. esm.sh bundled URL
  5. local vendored path `vendor/texlyre/texlyre-busytex/dist/index.js`
- Diagnostics now include:
  - `moduleLoadedFrom`
  - `moduleFallbacks`
  - `moduleImportAttempts`
- Safari/iPad direct-mode guard remains active.
- No backend files changed.

## Expected next diagnostic

If the module import succeeds, the next status should move past `cachedModuleReady: false`. If it then fails, the likely next blocker will be the BusyTeX asset folder contents rather than the TeXlyre module URL.

# Release Notes — Stage 1F

Stage: `latex-stage1f-easy-compile-modes-20260428-1`

## Added

- `js/browser-wasm-provider.js`
- Browser-WASM experimental compiler provider
- Browser engine status card
- Browser-WASM asset folder setting
- SwiftLaTeX TeXLive-on-demand endpoint setting
- Browser engine reuse setting
- **Test browser engine** button
- **Open root in Overleaf** button
- Diagnostics now include Browser-WASM status

## Preserved

- Stage 1E Copilot workflow and patch-preview system
- Stage 1D/1E backend compile runner contract
- Static GitHub Pages fallback
- Shell-escape safety guard
- Cloud Run npm dependency build fix

## Important limitation

The WASM engine binary assets are not bundled in this package. Add SwiftLaTeX-compatible assets under `vendor/swiftlatex/pdftex/` or host them elsewhere and set the asset folder URL.

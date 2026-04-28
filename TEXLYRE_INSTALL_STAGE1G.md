# Installing TeXlyre BusyTeX assets for Stage 1G

Stage 1G supports TeXlyre BusyTeX as an experimental browser-WASM compiler. It does not bundle the large BusyTeX assets.

## Quick setup

From a computer that has Node/npm:

```bash
cd /path/to/your/Latexai/repo
npm init -y
npm install texlyre-busytex
npx texlyre-busytex download-assets vendor/texlyre/core
```

The download command should create:

```text
vendor/texlyre/core/busytex/
```

Upload/commit that folder to your GitHub Pages project.

## Lumina settings

In the app:

```text
Compiler provider: Browser WASM: TeXlyre BusyTeX experimental
TeXlyre module URL: https://cdn.jsdelivr.net/npm/texlyre-busytex@1.1.1/dist/index.js
TeXlyre BusyTeX asset base: vendor/texlyre/core/busytex
```

Then click `Test TeXlyre`, then `Compile`.

## Local module option

For fully local static hosting, copy a bundled ESM build of `texlyre-busytex` into:

```text
vendor/texlyre/texlyre-busytex.es.js
```

Then set:

```text
TeXlyre module URL: vendor/texlyre/texlyre-busytex.es.js
```

The CDN module URL is easier for initial testing.

## Safari/iPad worker error note

If you see `Failed to initialize BusyTeX: Worker error: undefined`, deploy the worker-mode hotfix and leave **Use TeXlyre Web Worker mode** unchecked. This forces BusyTeX direct mode, which uses `busytex_pipeline.js` instead of `busytex_worker.js`.

In direct mode, verify these URLs first:

- `vendor/texlyre/core/busytex/busytex_pipeline.js`
- `vendor/texlyre/core/busytex/busytex.js`
- `vendor/texlyre/core/busytex/busytex.wasm`

Worker mode additionally needs:

- `vendor/texlyre/core/busytex/busytex_worker.js`

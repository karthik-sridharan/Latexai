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
TeXlyre module URL: https://esm.sh/texlyre-busytex?bundle
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

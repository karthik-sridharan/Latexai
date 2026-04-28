# Browser-WASM Provider Notes — Stage 1F

Stage 1F adds a real Lumina compiler-provider path for browser-side LaTeX compilation.

The provider expects SwiftLaTeX-compatible engine assets. It does not bundle the large engine binaries.

Default asset folder:

```text
vendor/swiftlatex/pdftex/
```

Expected runtime files include at least:

```text
PdfTeXEngine.js
swiftlatexpdftex.js
```

and whichever `.wasm` / `.data` files the worker script expects.

The provider dynamically loads `PdfTeXEngine.js`, patches the worker path to point at the configured asset folder, writes Lumina project files into the engine memory filesystem, runs `compileLaTeX()`, and displays the resulting PDF blob when available.

If assets are missing, it returns a structured Lumina compile response with `mode = browser-wasm-swiftlatex-experimental`, a help log, and draft diagnostics.

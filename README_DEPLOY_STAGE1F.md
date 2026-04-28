# Lumina LaTeX Editor Stage 1F — Easy Compile Modes

Stage 1F keeps the Stage 1E backend and Copilot workflow architecture, and adds easier non-backend testing paths.

## Deploy static app

Upload these files to your GitHub Pages app folder:

```text
index.html
css/
js/
prompts/
examples/
vendor/
```

The app still works without a backend via draft preview.

## New compile options

### 1. Draft preview / mock draft

Works immediately on GitHub Pages.

### 2. Open root in Overleaf

Settings now has **Open root in Overleaf**. This posts the current root `.tex` source to Overleaf in a new tab.

### 3. Browser WASM experimental

Settings now has **Browser WASM experimental**.

This provider is wired into the Lumina compile pipeline, but it requires SwiftLaTeX-compatible browser-engine assets. The default asset folder is:

```text
vendor/swiftlatex/pdftex/
```

Place the engine files there, then click **Test browser engine**.

Required assets typically include:

```text
PdfTeXEngine.js
swiftlatexpdftex.js
*.wasm / *.data files required by the worker
```

If assets are missing, Compile will produce a diagnostic help log instead of failing silently.

## Backend option still preserved

Custom backend URL remains supported:

```text
https://YOUR-BACKEND/api/lumina/latex/compile
```

The Cloud Run build fix from Stage 1E is preserved; backend dependencies do not include `express-rate-limit`.

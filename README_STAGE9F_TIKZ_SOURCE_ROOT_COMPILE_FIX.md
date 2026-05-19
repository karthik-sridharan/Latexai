# Stage 9F: TikZ source/root compile fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/asset-service.js`
- `js/tikz-maker-service.js`
- `js/project-model.js`
- `js/compiler-provider.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage9f-tikz-source-root-compile-fix-1`

This prevents generated TikZ include files from being treated as root documents and prevents LAI/xcolor macros from being inserted into include-only TikZ files.

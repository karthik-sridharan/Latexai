# Latexai Stage 1H frontend Cloud Run TeX Live hotfix

Replace this file in your Latexai GitHub Pages repo:

```txt
js/compiler-provider.js
```

Do not replace `index.html` with a generated file. Keep your current `index.html`.

After replacing the file, commit and push:

```bash
git add js/compiler-provider.js
git commit -m "Fix Latexai frontend Cloud Run TeX Live compiler provider"
git push
```

Then open Latexai with a cache-busting query string, for example:

```txt
https://karthik-sridharan.github.io/Latexai/?v=stage1h-cloudrun-texlive-frontend-1
```

The diagnostic should show:

```txt
compilerMode: backend-texlive
compileUrl: https://lumina-latex-backend-y4piylmfja-ue.a.run.app/api/lumina/latex/compile
compileStatusUrl: https://lumina-latex-backend-y4piylmfja-ue.a.run.app/api/lumina/latex/compile/jobs
backendStatusUrl: https://lumina-latex-backend-y4piylmfja-ue.a.run.app/api/lumina/latex/status
```

This hotfix also rewrites stale relative fetches such as:

```txt
/api/lumina/latex/compile
/api/lumina/latex/compile/jobs
/api/lumina/latex/status
```

to the Cloud Run backend.

It also tries to repair compile payloads so `files["main.tex"]` contains actual LaTeX source instead of metadata-only records.

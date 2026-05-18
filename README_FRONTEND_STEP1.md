# Latexai Step 1 Frontend — CompilerProvider + Cloud Run TeX Live

This zip is the frontend-only package. Put these files into the Latexai GitHub repo.

## Files to add/replace

```txt
js/compiler-provider-preload.js
js/compiler-provider.js
```

Also patch `index.html` so this preload script appears before the main app scripts:

```html
<script src="js/compiler-provider-preload.js?v=stage1i-step1-compilerprovider-bootstrap-1"></script>
```

The included `apply_frontend_step1.sh` does this automatically.

## Apply

From the Latexai repo root, after unzipping this package:

```bash
bash apply_frontend_step1.sh
```

Then commit and push:

```bash
git add index.html js/compiler-provider-preload.js js/compiler-provider.js
git commit -m "Fix CompilerProvider bootstrap for Cloud Run TeX Live backend"
git push
```

Open with a cache buster:

```txt
https://karthik-sridharan.github.io/Latexai/?v=stage1i-step1-compilerprovider-bootstrap-1
```

## Expected diagnostic

```json
{
  "missingModules": [],
  "settings": {
    "compilerMode": "backend-texlive",
    "compileUrl": "https://lumina-latex-backend-y4piylmfja-ue.a.run.app/api/lumina/latex/compile",
    "compileStatusUrl": "https://lumina-latex-backend-y4piylmfja-ue.a.run.app/api/lumina/latex/compile/jobs",
    "backendStatusUrl": "https://lumina-latex-backend-y4piylmfja-ue.a.run.app/api/lumina/latex/status"
  }
}
```

The browser-WASM SwiftLaTeX/TeXlyre warnings can still appear. They are not blockers when `compilerMode` is `backend-texlive`.

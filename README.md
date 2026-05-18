# Latexai Stage 1H2 CompilerProvider preload fix

The previous hotfix changed settings correctly, but the app still reports:

```txt
missingModules: ["CompilerProvider"]
undefined is not an object (evaluating 'NS.CompilerProvider.compile')
```

That means the Stage 1G app's local `NS` object does not have `CompilerProvider` at the time the compile button runs.

This fix adds a tiny preload script that must load before the main app script. It defines:

```js
window.LuminaLatex.CompilerProvider.compile
window.NS.CompilerProvider.compile
window.CompilerProvider.compile
```

and forces compile calls to the working Cloud Run backend:

```txt
https://lumina-latex-backend-y4piylmfja-ue.a.run.app/api/lumina/latex/compile
https://lumina-latex-backend-y4piylmfja-ue.a.run.app/api/lumina/latex/compile/jobs
https://lumina-latex-backend-y4piylmfja-ue.a.run.app/api/lumina/latex/status
```

## Apply

From the Latexai repo root:

```bash
unzip latexai-stage1h2-compilerprovider-preload-fix.zip
./apply_stage1h2_frontend_fix.sh
git add index.html js/compiler-provider-preload.js js/compiler-provider.js
git commit -m "Preload CompilerProvider for Cloud Run TeX Live backend"
git push
```

Then open:

```txt
https://karthik-sridharan.github.io/Latexai/?v=stage1h2-compilerprovider-preload-1
```

## Expected diagnostic change

`missingModules` should no longer include `CompilerProvider`, and compile should call the Cloud Run backend.

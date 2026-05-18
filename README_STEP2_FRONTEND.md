# Latexai Step 2A — Storage foundation and local folder autosave

Stage: `latex-stage2a-storage-foundation-20260518-1`

This package adds a storage abstraction without changing the compiler backend.

It provides:

- `StorageProvider` namespace registration under:
  - `window.LuminaLatex.StorageProvider`
  - `window.NS.StorageProvider`
  - `window.LAI_STORAGE`
- Browser localStorage autosave, always available.
- Native local folder sync when the browser supports `showDirectoryPicker`.
- A small floating storage panel.
- GitHub sync placeholder for Step 3.

## Apply

From the Latexai repository root:

```bash
bash apply_frontend_step2.sh .
git add index.html js/lai-storage-provider-preload.js js/lai-storage-ui.js
git commit -m "Add Latexai storage foundation and local folder autosave"
git push
```

Open with a cache-buster:

```text
https://karthik-sridharan.github.io/Latexai/?v=stage2a-storage-foundation-1
```

## Expected checks

Open the browser console and run:

```js
LAI_STORAGE.diagnostics()
```

You should see:

```js
{
  ok: true,
  stage: "latex-stage2a-storage-foundation-20260518-1",
  status: { mode: "localStorage", autosave: true, ... },
  projectSummary: { rootFile: "main.tex", fileCount: ... }
}
```

The lower-right storage panel should show:

```text
Latexai Storage
mode: localStorage
autosave: on
```

In Chrome/Edge desktop, `Open Local Folder` should be available. In Safari, it will likely report that native folder sync is not available and keep using browser local storage.

## What this step does not do yet

- It does not implement GitHub commits. That is Step 3.
- It does not implement PDF-region Copilot editing. That starts after storage and compiler stability.
- It does not replace the project tree UI. It provides a storage layer and a small visible control panel.

## Manual tests

```js
LAI_STORAGE.getStatus()
await LAI_STORAGE.autosaveNow('manual')
LAI_STORAGE.loadProject()
LAI_STORAGE.diagnostics()
```

# Latexai Step 2A GitHub-ready upload package

This zip contains a complete `index.html` already patched, plus the new JS files.

## Upload/replace these in your GitHub repo

- `index.html`
- `js/lai-storage-provider-preload.js`
- `js/lai-storage-ui.js`

No manual HTML editing is needed.

## Open after GitHub Pages updates

https://karthik-sridharan.github.io/Latexai/?v=stage2a-storage-foundation-2

## What you should see

A small bottom-right panel:

Latexai Storage

with:

- Save Now
- Load Autosave
- Open Local Folder

On iPad/Safari, native folder sync will probably say unavailable. That is expected.
Browser autosave to localStorage should work.

## Console checks

```js
!!window.LAI_STORAGE
```

should be:

```js
true
```

Then:

```js
LAI_STORAGE.diagnostics()
```

should show:

- `ok: true`
- `stage: "latex-stage2a-storage-foundation-20260518-2"`
- `status.mode: "localStorage"`

# Latexai clean GitHub integration changed files

Upload/replace only these files in your GitHub repo:

- `index.html`
- `js/project-model.js`
- `js/file-tree.js`

This removes the temporary `lai-*` overlay scripts from `index.html`.
It makes the normal left Source tree the single integrated GitHub-aware tree.

What changed:
- `project-model.js` now supports GitHub backend projects where `files` is an object:
  `{ "main.tex": "...", "sections/intro.tex": "..." }`.
- `file-tree.js` now owns GitHub Check/Load/Commit directly in the normal Source tree.
- GitHub Load calls `State.resetProject(...)`, so the canonical app state has all files.
- The normal editor, import, export, compile, and commit paths all use the same `NS.State.state.project.files`.
- No overlay/watchdog/direct-loader file-tree patches are loaded.

Open after upload:
`https://karthik-sridharan.github.io/Latexai/?v=stage3i-clean-github-filetree-1`

Expected:
- Left Source tree shows `Project files`.
- Tap `Git` to enter backend URL/owner/repo/branch/root path.
- Tap `Load`.
- The same normal tree should list all files returned by the backend.
- `Commit` commits all files in the normal project state.

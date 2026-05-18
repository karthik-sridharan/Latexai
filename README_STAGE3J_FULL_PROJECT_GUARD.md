# Stage 3J full-project guard

Upload/replace these files:

- `index.html`
- `js/project-model.js`
- `js/project-store.js`
- `js/state.js`
- `js/file-tree.js`
- `js/compiler-provider.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage3j-full-project-guard-1`

Visible confirmation in the left Source tree:

`Project files`
`N files • Stage 3J`

What this fixes:

- GitHub Load can load all files.
- Selecting a file and compiling should no longer let an old one-file local project overwrite the loaded project.
- A full-project cache is stored under `lumina-latex-editor.full-project-cache.v1`.
- `State.save()`, `ProjectStore.saveLocal()`, and `CompilerProvider.compile()` all protect against regression from a multi-file GitHub project back to a stale one-file project.

After upload:

1. Open the cache-busted URL above.
2. Tap Git → Load from GitHub again once.
3. Confirm the tree says `N files • Stage 3J`.
4. Select any file.
5. Compile.
6. The tree should still say `N files • Stage 3J`.

If it still shows one file, clear Safari website data for the site or open with a new cache buster, then Load from GitHub once more.

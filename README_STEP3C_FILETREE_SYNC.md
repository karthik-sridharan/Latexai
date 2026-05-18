# Latexai Step 3C GitHub file-tree sync patch

Upload/replace all files in this zip.

Fix:
- GitHub load says multiple files loaded, but the left file tree only shows one file.

What this adds:
- `js/lai-file-tree-sync-patch.js`
- Patched `index.html` that loads it
- The left `Source tree` shows all loaded/discovered project files
- Clicking a file opens it in the editor
- The active editor file is saved before switching
- A `+ tracked file` button adds a file that will be included in full-project commits

Open:
https://karthik-sridharan.github.io/Latexai/?v=stage3c-github-filetree-sync-1

Expected:
- Load from GitHub says 5 files
- Left Source tree says `Loaded project files (5)`
- You can tap each file and edit it
- Preview commit files should list the same files

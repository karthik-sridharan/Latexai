# Latexai Step 3G Integrated GitHub File Tree

Upload/replace all files in this zip.

This is the clean version requested:
- It does not add a separate floating file list.
- It does not hide the whole Files section.
- It uses the real `#fileTree` in the left Source tree panel.
- GitHub load, local edits, new files, imports, compile payload, and GitHub commit
  all use one shared project state.

Open:
https://karthik-sridharan.github.io/Latexai/?v=stage3g-integrated-github-filetree-1

Usage:
1. In the left Source tree panel, tap `Git` to show setup.
2. Enter backend URL, owner, repo, branch, and optional folder path.
3. Tap `Load`.
4. Click files directly in the Source tree.
5. Use the existing top `+` button or `+ file` to add tracked files.
6. Tap `Commit` to commit all loaded/added/edited files.

Expected:
- The left Source tree itself says `Project files` and shows all files.
- It should not jump to a separate floating panel.
- Selecting a file should keep the file tree stable.

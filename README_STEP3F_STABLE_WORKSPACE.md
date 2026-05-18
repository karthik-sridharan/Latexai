# Latexai Step 3F Stable GitHub Workspace

Upload/replace all files in this zip.

This replaces the previous separate direct-loader/file-list patches with one
stable file tree inside the original left Files panel.

What changes:
- The original app #fileTree is hidden.
- A new `GitHub workspace` panel appears in the Files section.
- It uses file rows styled more like the original tree.
- Selecting a file no longer dispatches normal input/change events, so the app
  should not refresh/collapse the list.
- Setup/Load/Commit live inside the left Files panel.
- Files in subdirectories are grouped by folder.
- `+ file` adds a tracked text file that is committed by `Commit`.

Open:
https://karthik-sridharan.github.io/Latexai/?v=stage3f-stable-github-workspace-1

Use:
1. In the left Files panel, tap `Setup`.
2. Enter backend URL, owner, repo, branch, folder path.
3. Tap `Load`.
4. Use the GitHub workspace list to switch files.
5. Tap `Commit` to commit all loaded files.

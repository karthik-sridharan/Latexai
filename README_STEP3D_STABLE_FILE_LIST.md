# Latexai Step 3D stable GitHub file list

Upload/replace all files in this zip.

This fixes the Step 3C issue where the left file tree kept refreshing/collapsing
back to one file.

What changed:
- Removes the Step 3C script tag.
- Adds `js/lai-stable-github-file-list.js`.
- Does NOT replace the original `#fileTree`.
- Adds a separate stable panel under the original source tree:
  `GitHub loaded files (N)`.
- File buttons stop event propagation, so the original app's delegated handlers
  should not hijack them.
- Only renders a few startup times and on load events; it does not fight the app
  with a repeated interval.

Open:
https://karthik-sridharan.github.io/Latexai/?v=stage3d-stable-github-file-list-1

Expected:
- Load from GitHub says 5 files.
- Under the original Source tree, a second panel says `GitHub loaded files (5)`.
- Use the second panel, not the original one, to switch files.
- It should not constantly refresh/collapse.

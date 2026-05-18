# Latexai Step 3E Direct GitHub Project Loader

Upload/replace all files in this zip.

This fixes the case where GitHub load says multiple files exist, but the app only
shows/keeps one file.

Use the new top-left panel:

Direct GitHub Project Loader

Buttons:
- Check
- Load Exact Project
- Commit All

Important:
- Use `Load Exact Project`, not the older Load button.
- The panel will say `Backend returned N files` and `Direct loaded files (N)`.
- If it says N=1, the backend/rootPath is only returning one file.
- If it says N=5, the direct loader has all 5 files and you can switch among them.

Open:
https://karthik-sridharan.github.io/Latexai/?v=stage3e-direct-github-project-loader-1

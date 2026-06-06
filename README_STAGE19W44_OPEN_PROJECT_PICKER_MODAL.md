# Stage 19W44 — Open Project picker modal

This stage replaces the old prompt-based Open Project flow with a proper modal picker.

## User-facing changes

- Clicking **Open Project** now opens a dialog instead of asking the user to type a list number.
- The top field is **GitHub root/path** and is prefilled from the current/default GitHub owner, e.g. `karthik-sridharan/`.
- The project list below filters live as the user types.
- Supported typed paths include:
  - `owner/`
  - `owner/repo`
  - `owner/repo/subfolder`
  - `https://github.com/owner/repo`
  - `https://github.com/owner/repo/tree/branch/subfolder`
- Clicking a row opens that project and restores project workspace state/memory.
- The **Open typed path** button still allows opening an exact owner/repo path even if the repository list is unavailable.

## Implementation notes

Changed file:

- `js/file-tree.js`
  - Adds a modal picker with path parsing/filtering.
  - Keeps the older manual prompt function as fallback/internal compatibility.
  - Adds root-path-aware selection.
- `index.html`
  - Cache-busts `file-tree.js` and project workspace script for Stage 19W44.

No backend changes are required; this uses the existing Stage 19W42 GitHub backend `/list-projects` and `/load-project` routes.

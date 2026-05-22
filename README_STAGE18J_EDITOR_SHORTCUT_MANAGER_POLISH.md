# Stage 18J — Editor shortcut manager polish

Stage marker: `stage18j-editor-shortcut-manager-polish-1`

This stage keeps the stable Stage 18H direct textarea editor surface and adds a usable shortcut manager without reintroducing the unstable live syntax-color overlay.

## Added

- Settings → Editor shortcut manager table.
- Built-in shortcut reference:
  - Cmd/Ctrl+B wraps a selected environment name in `\begin{...}` / `\end{...}`.
  - Cmd/Ctrl+[ comments selected/current lines.
  - Cmd/Ctrl+] uncomments one level.
- Custom shortcut rows with:
  - enable/disable,
  - shortcut key,
  - action type,
  - label,
  - template/environment text.
- Template placeholders:
  - `{{selection}}`
  - `{{cursor}}`
- Add, save, reset, import, export, and copy-example controls.
- Conflict warnings for risky browser/app shortcuts such as Cmd/Ctrl+S and duplicates.

## Notes

The editor remains a single direct textarea surface. Overleaf-like syntax coloring remains deferred to the future CodeMirror stage.

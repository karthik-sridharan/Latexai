# Stage 18G — Editor stability single-surface lock

Stage string:

```txt
stage18g-editor-stability-single-surface-1
```

This stage fixes the Stage 18F editor instability where the LaTeX syntax color layer could appear to switch back and forth with the older plain textarea while typing or pressing Return.

## Changes

- Keeps `#sourceEditor` as the only editable surface.
- Keeps the syntax highlighter as a passive overlay that never steals focus or replaces the editor.
- Avoids fully transparent textarea text, because Safari can temporarily repaint fully transparent textarea text during input/Return.
- Deduplicates `#latexSyntaxOverlay` if the service is initialized more than once.
- Synchronizes syntax highlighting after direct textarea mutations, input, paste/cut, composition, file changes, and active-file changes.
- Keeps Stage 18F shortcuts:
  - Cmd/Ctrl+B wraps a selected environment name with `\begin{...}` / `\end{...}`.
  - Cmd/Ctrl+[ comments selected/current lines.
  - Cmd/Ctrl+] uncomments selected/current lines one level.
- Keeps the recovery/safe-mode bar token behavior from Stage 18F.

## Tests

```bash
node --check js/editor-enhancement-service.js
node tests/stage18g-editor-stability-single-surface.test.cjs
python3 tests/stage18g-chromium-editor-stability.py
```

# Stage 18F — Editor syntax color, shortcuts, and recovery-token bar

Stage marker:

```text
latex-stage18f-editor-syntax-shortcuts-recovery-token-20260522-1
```

## What changed

- Added a lightweight LaTeX syntax-color overlay for the source editor.
- Added indentation guides and smart Enter indentation after `\\begin{...}` blocks.
- Added built-in editor shortcuts:
  - `Cmd/Ctrl+B`: if `theorem` is selected, replace it with
    ```latex
    \\begin{theorem}
      
    \\end{theorem}
    ```
    and place the cursor on the blank inner line.
  - `Cmd/Ctrl+[`: comment selected/current LaTeX lines one level.
  - `Cmd/Ctrl+]`: uncomment selected/current LaTeX lines one level.
- Added a compact Settings → Editor card for optional custom shortcuts stored in:
  ```text
  latexai:editor-shortcuts:v1
  ```
- Added a syntax-highlighting toggle stored in:
  ```text
  latexai:editor-syntax-highlight:v1
  ```
- Changed the top recovery/safe-mode bar so it is not shown for ordinary `index.html` loads. It appears only when safe/recovery/debug tokens are present, or when safe mode is actually active.

Supported recovery tokens include:

```text
?safe=1
?resetUi=1
?recovery=1
?debug=1
#safe-mode
#recovery
```

## Changed files

```text
index.html
js/editor-enhancement-service.js
css/lai-stage18f-editor-enhancements.css
js/safe-mode-service.js
tests/stage18f-editor-syntax-shortcuts-recovery-token.test.cjs
tests/stage18f-chromium-editor-shortcuts.py
```

## Validation

```bash
node --check js/editor-enhancement-service.js
node --check js/safe-mode-service.js
node tests/stage18f-editor-syntax-shortcuts-recovery-token.test.cjs
python3 tests/stage18f-chromium-editor-shortcuts.py
```

# Latexai Stage 18K — Editor shortcut live template fix

Stage: `stage18k-editor-shortcut-live-template-fix-1`

This stage keeps the stable Stage 18H textarea editor and fixes custom shortcut usability from Stage 18J.

## Fixes

- Custom shortcut rows are active immediately in the current page; users no longer need to click Save before testing a new row.
- The status message now says active in this page and reminds users to Save to persist across reloads.
- Template placeholders are more forgiving: `{{selection}}`, `{selection}`, and `[[selection]]` are accepted.
- Triple-brace templates such as `\mathcal{{{selection}}}` work as intended, producing `\mathcal{X}` for selected text `X`.
- `Cmd/Ctrl+C`, `Cmd/Ctrl+V`, `Cmd/Ctrl+X`, `Cmd/Ctrl+A`, and undo/redo shortcuts are now warned as browser-reserved; use `Cmd/Ctrl+Shift+C` or similar for custom commands.
- The Add shortcut default now demonstrates `Cmd/Ctrl+Shift+C → \mathcal{{{selection}}}`.

## Example

Shortcut: `mod+shift+c`

Action: `Template`

Template:

```latex
\mathcal{{{selection}}}
```

Selecting `F` and pressing the shortcut inserts:

```latex
\mathcal{F}
```

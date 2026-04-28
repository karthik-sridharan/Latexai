# Next Stage Context — Stage 1F

Recommended next stage: CodeMirror editor upgrade.

Goals:

1. Replace the raw textarea with CodeMirror 6 behind the existing editor adapter.
2. Keep the existing `LuminaLatex.Editor` API stable: `getSelection`, `replaceSelection`, `replaceRange`, `insertText`, `goToLine`, `getText`, and `setText`.
3. Add LaTeX syntax highlighting, better line numbers, search, bracket matching, mobile-friendly scrolling, and click-to-diagnostic navigation.
4. Keep patch preview, compile pipeline, and backend contracts unchanged.
5. Preserve fallback textarea mode if CodeMirror assets fail to load.

Do not add collaboration yet. Keep WebSocket/Yjs as reserved Stage 2 architecture.

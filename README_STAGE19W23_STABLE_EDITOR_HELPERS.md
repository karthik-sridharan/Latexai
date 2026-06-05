# LatexAI Stage 19W23 — Stable Lightweight LaTeX Editor Helpers

Marker: `latex-stage19w23-stable-editor-helpers-20260604-1`

## Goal

Add simple, robust editor helpers without reusing the older Stage 18 editor enhancement path that previously caused cursor/overlay instability.

## What changed

- Removed the old `editor-enhancement-service.js` script from `index.html`.
- Replaced the old Stage 18 editor enhancement CSS with a new small CSS file:
  - `css/lai-stage19w23-editor-lite.css`
- Added a new deterministic helper service:
  - `js/stage19w23-editor-lite-service.js`
- Added toolbar controls:
  - Indent
  - Outdent
  - Format selection
  - Format doc
  - Syntax colors toggle
  - Auto-indent toggle
  - Environment match status

## Design constraints

The new helper layer is intentionally conservative:

- No editor engine replacement.
- No hidden source rewriting.
- No aggressive live autoformatting.
- Indent/outdent/format only modify source when the user explicitly clicks a command.
- Auto-indent is opt-in.
- Syntax coloring is visual-only and can be disabled instantly.
- For very large files, syntax coloring pauses instead of attempting expensive full rendering.

## Stable features

### Indent / Outdent

Operates on selected lines or the current line.

### Format selection / Format doc

Applies conservative indentation based on LaTeX environment nesting. It preserves content and only changes whitespace indentation / trailing whitespace.

### Environment matching

Shows the current nearby LaTeX environment in the toolbar, e.g.

```text
Env: theorem L20–L24
```

If syntax colors are enabled, matching begin/end lines are also visually marked.

### Syntax colors

Lightweight opt-in overlay for commands, environments, comments, citations, refs, and math delimiters. This is not the old Stage 18 overlay service.

### Auto-indent

Optional. When enabled, pressing Enter preserves current indentation and adds one extra level after common openers like `\begin{...}` or `{`.

## Validation run

- `node --check js/stage19w23-editor-lite-service.js`
- HTML parser smoke check for `index.html`
- Static checks for marker, new toolbar controls, new CSS/JS loading, and old editor enhancement script removal.

# Stage 19W25 — Disable overlay syntax colors

Marker: `latex-stage19w25-disable-overlay-syntax-colors-20260604-1`

This hotfix disables the textarea overlay syntax coloring introduced in Stage 19W23.
The overlay approach can desynchronize the visible colored text from the actual textarea cursor/selection on Safari/iPad and other browser/font combinations.

What remains:
- Indent selected lines
- Outdent selected lines
- Format selection
- Format document
- Optional auto-indent
- Environment status/matching text

What is disabled:
- Syntax colors toggle
- Hidden `<pre>` overlay coloring
- CSS that makes textarea text transparent

Future native coloring should be implemented with a real editor engine such as CodeMirror 6 or Monaco, where the colored surface is the editable surface itself.

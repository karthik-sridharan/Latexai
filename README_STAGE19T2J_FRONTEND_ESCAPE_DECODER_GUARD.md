# Stage 19T2J — Frontend escape-decoder guard

Expected frontend badge: `latex-stage19t2j-frontend-escape-decoder-guard-20260530-1`.

This hotfix addresses the compile failure where a valid AI revision applied correctly, but the editor source then showed corrupted LaTeX such as:

- `\newcommand` becoming a new line followed by `ewcommand`
- `\nabla` becoming a new line followed by `abla`
- possible `\theta` becoming spacing followed by `heta`

Root cause: the frontend preview/apply path decoded every literal `\n`/`\t` sequence after backend validation. That is unsafe for TeX because many normal commands begin with `\n` or `\t`.

Changes:
- Replaced broad `/\\n/g` and `/\\t/g` frontend decoding with a conservative transport-escape decoder that does not decode when the escape is followed by a TeX command-letter.
- Added an always-on post-normalization guard that blocks source application if definite damaged remnants such as line-start `ewcommand{` or `abla` are detected.
- Kept Stage 19T2I backend-authoritative validation for accepted Safe Edit Compiler output, but prevented frontend normalization from corrupting source after backend acceptance.

Manual recovery for a source already corrupted in the browser:
1. Prefer reloading/reverting from the GitHub checkpoint made before the risky AI apply.
2. If it was not saved to GitHub, use the browser/local previous version if available.
3. As a last resort, repair obvious remnants such as line-start `ewcommand{` -> `\newcommand{` and line-start `abla` -> `\nabla`, then compile again.

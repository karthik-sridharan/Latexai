# Stage 19T2K — Raw Patch Frontend Apply Path

Badge: `latex-stage19t2k-raw-patch-frontend-apply-path-20260530-1`

This frontend hotfix fixes the Devil's Advocate / reviewer-rebuttal apply path when the final synthesis text is already correct RAW LATEX BLOCK PATCH protocol but the browser blocks apply because a backend JSON draft contains backslash/control escape damage.

## What changed

1. The backend Safe Edit Compiler is still required to accept the edit intent (`safeToInsert === true`).
2. When the final synthesis output contains parseable `LATEXAI_BLOCK_PATCH_BEGIN ... END` blocks, the frontend now rebuilds the targeted and append drafts locally from that raw protocol and the current editor source.
3. This avoids applying or validating a JSON-transport draft where LaTeX commands such as `\nabla` or `\tr` may have been converted into control characters.
4. The Stage 19T2J frontend guard no longer rejects ordinary tab indentation in an otherwise valid complete LaTeX draft. It only flags tabs when they look like known TeX-command remnants, for example `\theta -> [tab]heta`.

## Expected behavior

After running the debate/revision loop, the final synthesis text can stay exactly in the raw block patch format. Clicking Preview insertion should show:

- Safe Edit Compiler active.
- Multi-section frontend insertion active.
- A warning mentioning `Stage 19T2K frontend apply path`.

Clicking Apply targeted should insert visible `\lai{...}` blocks near the requested equation anchors without damaging existing commands such as `\newcommand`, `\tr`, or `\nabla`.

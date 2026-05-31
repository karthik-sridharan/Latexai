# Stage 19T3B — Lai macro autoinjection and resolve hardening

Expected frontend badge:

`latex-stage19t3b-lai-macro-autoinjection-resolve-hardening-20260531-1`

This stage guarantees that app-managed visible AI edit markup compiles without requiring the user to manually add `\lai` and `\laiold` definitions.

## Frontend behavior

- `LaiSafeEditPipelineService` now checks every compiler-produced draft before applying it.
- If the root source contains unresolved `\lai{...}` or `\laiold{...}` and is missing macro definitions, it injects a preamble block after `\documentclass` and before `\begin{document}`.
- The insertion point is never before `\documentclass`.
- If `xcolor` or `color` is already loaded, no duplicate color package is added.
- If `\lai` / `\laiold` are already defined, user definitions are respected.
- The compile provider also auto-fixes the root source before sending a compile request, so old unresolved edits from prior stages can compile.
- The Paper-level edit review card has a `Fix \lai macros` button and warns when unresolved edits are present but macros are missing.

## Macro block

```tex
% --- LatexAI visible edit macros ---
\usepackage{xcolor}
\providecommand{\laiold}[1]{{\color{blue}#1}}
\providecommand{\lai}[1]{{\color{red}#1}}
% --- end LatexAI visible edit macros ---
```

The `\usepackage{xcolor}` line is omitted when `xcolor` or `color` is already loaded.

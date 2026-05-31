# Stage 19T2P — Resolver Keep red/new unblocks LAI removal

This stage fixes the remaining source-scanned **Resolve AI edits** blocker where clicking **Keep red/new** on a visible `\lai{...}` block still left the macro in the editor and showed:

> Blocked resolver accept/reject: detected JSON/backslash-damaged LaTeX command remnants...

## Root cause

The resolver was still applying an old JSON/backslash-damage heuristic to the **kept text** itself. That heuristic was appropriate for earlier backend/frontend transport bugs, but it is too aggressive during local resolver acceptance. At resolver time the user can already see the exact `\lai{...}` block and is simply asking the frontend to unwrap it.

The old heuristic falsely rejected legitimate content when the kept text contained command-like words such as `title`, `newtheorem`, or related prose/snippets.

## Fix

- Remove the command-remnant heuristic from resolver acceptance.
- Keep only a minimal unsafe-control-character check for the kept text.
- Preserve the structural-command deletion guard, so a bad parse that would remove `\documentclass`, `\begin{document}`, `\end{document}`, `\title`, `\author`, `\date`, or `\newtheorem` is still blocked.
- Keep the Stage 19T2O direct editor update/unwrapper behavior.

## Expected badge

`latex-stage19t2p-resolver-accept-red-unblocks-lai-20260530-1`

## Test

1. Open a file containing a safe compiled edit:

```tex
% --- Latexai safe compiled edit: Parametric case ---
\lai{%
Some accepted AI explanation.
}
% --- end Latexai safe compiled edit ---
```

2. Click **Refresh edits**.
3. Click **Keep red/new**.

Expected result: the wrapper and `\lai{...}` macro are removed, leaving only normal LaTeX text.

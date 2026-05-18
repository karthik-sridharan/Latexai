# Stage 4A: \lai macro + manual source rewrite MVP

Upload/replace these changed files:

- `js/project-model.js`
- `js/state.js`
- `js/copilot.js`
- `js/patch-manager.js`

Open with:

`https://karthik-sridharan.github.io/Latexai/?v=stage4a-lai-rewrite-1`

## What this adds

- New/default/imported standalone TeX documents get a Latexai macro in the preamble.
- The macro is:

```tex
% Set this to \laishowchangesfalse to hide red AI markup.
\newif\iflaishowchanges
\laishowchangestrue

\long\def\lai#1{%
  \iflaishowchanges
    {\color{red}#1}%
  \else
    #1%
  \fi
}
```

- Copilot `Rewrite selection` sends the full project source to the AI backend.
- Applying a rewrite-selection patch comments out the old selected block and inserts the replacement wrapped in `\lai{...}`.

## Test

1. Load your GitHub project.
2. Select a paragraph/theorem/equation block in the source editor.
3. Open Copilot.
4. Choose `Rewrite selection`.
5. Enter a prompt such as: `Rewrite this more clearly but preserve the math.`
6. Ask Copilot.
7. Preview/apply the patch.
8. Compile.

Expected source patch shape:

```tex
% BEGIN LAI-OLD id=... path=...
% old selected text
% END LAI-OLD id=...

\lai{
new AI-written replacement
}
```

Expected PDF behavior:

- With `\laishowchangestrue`, AI replacement is red.
- With `\laishowchangesfalse`, AI replacement uses normal document color.

## Notes

- The old selected text is kept as LaTeX comments.
- The AI replacement is inserted through `\lai{...}`.
- The root file gets the macro if it does not already have it.
- Full project source is included in the Copilot request for rewrite-selection, so Copilot has cross-file context.

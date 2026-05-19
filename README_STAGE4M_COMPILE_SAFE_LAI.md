# Stage 4M compile-safe LAI macro guard

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/lai-stage4m-compile-safe-lai.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage4m-compile-safe-lai-macro-1`

## What it fixes

If Copilot inserts `\lai{...}` but PDF compile fails, the root file probably does
not define the `\lai` macro.

Stage 4M watches for any project file containing `\lai{...}` and injects the
macro into the root file before preview/compile.

## Expected root preamble insertion

```tex
\usepackage{xcolor}

% --- Latexai AI-change highlighting macro ---
\newif\iflaishowchanges
\laishowchangestrue
\long\def\lai#1{%
  \iflaishowchanges
    {\color{red}#1}%
  \else
    #1%
  \fi
}
% --- end Latexai AI-change highlighting macro ---
```

## Visual check

You should see a top-right badge:

`Stage 4M macro guard active`

If it inserts the macro, it changes to:

`Stage 4M inserted \lai macro`

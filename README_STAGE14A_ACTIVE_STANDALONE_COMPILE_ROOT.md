# Stage 14A: active standalone compile root

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/compile-root-service.js`
- `css/lai-stage14a-compile-root.css`

Keep existing Stage 13G files if they are not already present.

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage14a-active-standalone-compile-root-1`

## What this changes

The existing `Compile PDF` button now automatically chooses the compile root:

- If the file shown in the source panel is a standalone `.tex` file, compile that file.
- Otherwise, compile the normal root file / `main.tex` as before.

A standalone file is detected by the presence of:

```tex
\documentclass{...}
\begin{document}
...
\end{document}
```

This means generated files such as:

```txt
talk/my-talk.beamer.tex
```

can be opened in the source panel and compiled with the normal `Compile PDF` button.

## UI

A new checked setting appears near the root-file selector:

```txt
Compile active standalone .tex file when source panel shows one
```

Turn it off to force the old behavior.

## Test

Included:

`tests/stage14a-active-standalone-compile-root.test.cjs`

Run:

```bash
node tests/stage14a-active-standalone-compile-root.test.cjs
```

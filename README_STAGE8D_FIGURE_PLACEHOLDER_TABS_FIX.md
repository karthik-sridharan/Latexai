# Stage 8D: figure placeholder + right-tab exclusivity fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/asset-service.js`
- `js/compiler-provider.js`
- `js/main.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage8d-figure-placeholder-tabs-fix-1`

## What this fixes

### 1. Figure still not visible in compiled PDF

Stage 8C ensured image assets are sent to the compiler as data URLs. Stage 8D also
makes the inserted LaTeX figure snippet robust by wrapping the image in:

```tex
\IfFileExists{figures/name.png}{%
  \includegraphics[width=.8\linewidth]{figures/name.png}%
}{%
  \fbox{... Missing figure file ...}%
}
```

So if the image is still not reaching the compiler, the PDF should show a visible
placeholder box instead of silently showing nothing.

Stage 8D also fixes the default width input so it is `.8\linewidth`, not a
double-backslash value.

### 2. Preview and Figures tabs both open

The original right-tab code only knew about the original four tabs:

- Preview
- Logs
- Copilot
- Settings

The new Figures tab was added dynamically, so clicking Preview did not always close
Figures. Stage 8D patches `main.js` so right tabs are handled dynamically:

- clicking any right tab closes all `.right-tab-panel`
- only the selected `${id}Tab` remains active

## Test

Included:

`tests/stage8d-figure-placeholder-tabs.test.cjs`

Run:

```bash
node tests/stage8d-figure-placeholder-tabs.test.cjs
```

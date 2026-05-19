# Stage 9C: TikZ prompt + local generator fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/tikz-maker-service.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage9c-tikz-prompt-and-local-generator-fix-1`

## What this fixes

After Stage 9B, raw JSON was no longer saved into the TikZ file. However, if the AI
returned JSON that could not be converted, Latexai produced a placeholder saying:

```tex
AI returned JSON instead of TikZ
```

That is safe but not useful.

Stage 9C makes two changes:

1. The AI call now uses the same payload shape as the working Copilot path:

```js
{
  instructions: system,
  input: user,
  temperature: 0.05,
  maxOutputTokens: 4200
}
```

and sends it under the generic `latex-copilot` task path, with metadata
`workflow: tikz-figure-maker`. This should reduce the chance that the backend uses
a presentation/slide JSON workflow.

2. If the AI still returns unusable JSON, Latexai now generates a useful local TikZ
figure from the user prompt instead of writing an error message into the figure.
For neural-network prompts it creates a small input-hidden-output network diagram.

## Test

Included:

`tests/stage9c-tikz-prompt-local-generator.test.cjs`

Run:

```bash
node tests/stage9c-tikz-prompt-local-generator.test.cjs
```

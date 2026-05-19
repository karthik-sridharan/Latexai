# Stage 6D: optional GitHub commit message box

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/file-tree.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage6d-optional-github-commit-message-1`

## What changed

The file tree GitHub controls now include:

`Commit message (optional)`

If the box is empty, the default message is still used:

`Latexai save: <current ISO timestamp>`

If the user types a message, that exact message is sent to the GitHub sync backend
as the commit message.

## Test

Included:

`tests/stage6d-commit-message.test.cjs`

Run locally:

```bash
node tests/stage6d-commit-message.test.cjs
```

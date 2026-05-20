# Stage 11D: frontend developer-managed paper AI prompts

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/document-ai-service.js`
- `css/lai-stage11a-document-ai.css`
- `prompt/ai-document-common.txt`
- `prompt/ai-review-and-suggestions.txt`
- `prompt/ai-total-remake-plan.txt`
- `prompt/ai-ranking-acceptance-improver.txt`
- `prompt/ai-competitive-agent-improver.txt`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage11d-frontend-developer-prompts-1`

## What this implements

This goes back to the Stage 11A append-only behavior, but moves the workflow prompts out of hardcoded JavaScript and into static frontend files under:

```txt
/prompt/
```

These are developer-edited files in the frontend repo, not user project files.

The app fetches these static files at runtime:

```txt
prompt/ai-document-common.txt
prompt/ai-review-and-suggestions.txt
prompt/ai-total-remake-plan.txt
prompt/ai-ranking-acceptance-improver.txt
prompt/ai-competitive-agent-improver.txt
```

## End-user behavior

End users cannot edit these prompts from the paper project.

The Paper-level AI card only shows:

- workflow selector
- mode selector
- extra one-off instructions
- Run / Append / Run+append / Copy buttons

## Developer workflow

To change paper-level AI behavior, edit the files in `/prompt/` in the frontend repo and commit/deploy GitHub Pages.

## Test

Included:

`tests/stage11d-frontend-developer-prompts.test.cjs`

Run:

```bash
node tests/stage11d-frontend-developer-prompts.test.cjs
```

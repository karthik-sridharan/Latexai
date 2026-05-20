# Stage 13D: Presentation Maker handoff

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/presentation-export-service.js`
- `css/lai-stage13a-presentation-export.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage13d-presentation-maker-handoff-1`

## What this adds

The Paper → Presentation exporter now has:

- `Presentation Maker URL`
- `Prepare handoff`
- `Open maker`
- `Run + open maker`

## How the handoff works

Stage 13D validates and auto-fixes the deck, then stores a handoff payload in browser storage:

```txt
latexai:presentation-maker:latest
latexai:presentation-maker:handoff:<timestamp-random>
latexai:presentation-maker:importDeck
presentation-maker-import-deck
presentationMakerImportDeck
```

It opens the maker URL with query parameters:

```txt
?latexaiImport=localStorage&handoffKey=<key>&schema=latexai-presentation-handoff-v1
```

If the Presentation Maker is on the same origin, it can read the deck from localStorage.

If not, use `Copy JSON` or `Download JSON` and import manually.

## Test

Included:

`tests/stage13d-presentation-maker-handoff.test.cjs`

Run:

```bash
node tests/stage13d-presentation-maker-handoff.test.cjs
```

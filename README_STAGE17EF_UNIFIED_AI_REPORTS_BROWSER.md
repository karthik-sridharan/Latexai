# Stage 17EF: unified AI reports + reviews browser

Changed files:

- `index.html`
- `js/feature-flag-service.js`
- `js/ai-report-service.js`
- `css/lai-stage17ef-ai-reports-browser.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage17ef-unified-ai-reports-browser-1`

## What this adds

A feature-gated Settings card:

```txt
Unified AI reports / reviews browser
```

It saves AI workflow reports under:

```txt
reviews/
```

inside the same Latexai project file tree, so the files are part of the same Git-backed project and can be committed using the existing Git panel.

Actions:

- Save selected workflow report
- Save all available reports
- Copy report metadata
- Refresh reviews
- Open selected review
- Copy selected review
- Delete selected review

It also adds **Save unified report** buttons to loaded workflow cards.

This service is local-only: no AI calls and no compile jobs.

# Stage 19U9H — Collection-aware literature synthesis frontend

Adds a Collection synthesis card to `literature.html`.

## Stage marker

`latex-stage19u9h-collection-aware-literature-synthesis-20260601-1`

## New UI

In the Collections panel:

- Synthesis mode selector
- Focus/instructions text area
- `use backend AI if configured` checkbox
- `include excluded papers` checkbox
- Generate buttons for synthesis, related work, gap analysis, and ranking

## Output actions

Generated reports appear in the main results pane with:

- Copy report
- Copy `\lai` block
- Save `\lai` handoff in localStorage
- Append to open editor when `literature.html` has same-origin access to an opener/parent editor

The frontend sends the live local collection in the request body, so it remains usable even before backend collection synchronization catches up.

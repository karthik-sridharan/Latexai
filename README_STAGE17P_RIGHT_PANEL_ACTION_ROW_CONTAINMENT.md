# Stage 17P — Right-panel action-row containment

Stage string: `stage17p-right-panel-action-row-containment-1`

This stage fixes the post-review/post-debate action buttons in the Copilot right panel. After Devil's Advocate or Competitive Review finishes, the longer action buttons such as `Add report to /reviews` and `Insert \lai edits at matches` could widen the card and move off the visible right edge on iPad/Safari.

## Changes

- Keeps Devil's Advocate and Competitive Review cards constrained to the right-panel width.
- Changes the Devil's Advocate and Competitive Review action rows from flexible intrinsic-width rows to wrapping CSS grids.
- Allows long button labels to wrap inside the visible card instead of expanding the card horizontally.
- Adds containment guards for cards inside organized right-panel groups.
- Keeps `\lai` / `\laiold` insertion and paper-level review integration from Stage 17O intact.

## Files changed

- `index.html`
- `css/lai-stage16b-competitive-review.css`
- `css/lai-stage16d-devils-debate.css`
- `css/lai-stage17j-right-panel-sections.css`
- `js/competitive-paper-review-service.js`
- `js/devils-advocate-debate-service.js`
- `tests/stage17p-action-row-containment.test.cjs`
- `tests/stage17p-chromium-action-row-containment.py`

## Expected behavior

In the Copilot tab, after Devil's Advocate or Competitive Review finishes, all action buttons should remain visible inside the right panel:

- Run debate / Run competitive review
- Cancel
- Copy report
- Add report to `/reviews`
- Insert `\lai` edits at matches
- Append `\lai` plan

The right panel should scroll vertically when needed, but it should not require horizontal scrolling and buttons should not be clipped off to the right.

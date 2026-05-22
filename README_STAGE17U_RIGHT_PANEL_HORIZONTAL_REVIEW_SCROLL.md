# Stage 17U — Right panel horizontal review scroll

This stage fixes the Paper-level AI edit review layout when old/new `\laiold` and `\lai` previews are shown side-by-side in the narrow right panel.

## Problem

The right panel could vertically scroll after Stage 17J10, but Stage 17P also forced horizontal containment with `overflow-x: hidden`. The Paper-level edit review intentionally shows OLD and NEW columns side-by-side; on iPad/Safari the NEW column could be clipped off the right edge.

## Fix

- The active Copilot/Settings/Figures tabs now allow horizontal scrolling when needed.
- Organizer group bodies allow horizontal scrolling for legitimate wide widgets.
- The Paper-level edit review card and each edit row become local horizontal scrollports.
- The OLD/NEW comparison keeps two columns with a minimum width so users can pan left/right instead of losing the NEW column.
- Normal action rows remain contained and wrapping from Stage 17P.

Stage string: `stage17u-right-panel-horizontal-review-scroll-1`.

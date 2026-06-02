# Stage 19W10B — Paper AI Subtabs Visibility Fix

Marker: `latex-stage19w10b-paper-ai-subtabs-visibility-fix-20260602-1`

Fixes an iPad/Safari layout issue where the Paper AI workflow subtabs were partially hidden behind the Total Paper Remake card after cards were moved into one-at-a-time workflow panes.

## Changes

- Makes `#paperAiTab` a block scrollport in active mode.
- Gives the workflow subtab strip a stable z-index and reserved height.
- Adds spacing between the subtab strip and the active workflow card.
- Keeps workflow cards below the tab strip with `clear: both` and explicit stacking.
- Updates cache-busting strings for the Stage 19W10 tab CSS/service.

## Test

1. Open the app normally.
2. Click `Paper AI`.
3. Confirm the subtabs are fully visible:
   - Total Remake
   - Review / Rebuttal
   - Devil’s Advocate
   - Competitive
4. Tap each subtab and confirm only that workflow card is visible.
5. Confirm the Total Paper Remake card no longer overlaps the subtab strip.

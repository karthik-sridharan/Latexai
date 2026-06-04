# Stage 19W14C — Hide legacy Reviewer/Rebuttal panel behind unified Paper AI

Marker: `latex-stage19w14c-hide-legacy-reviewer-rebuttal-panel-20260604-1`

This frontend-only hotfix completes the unified Paper AI cleanup:

- Reviewer/Rebuttal no longer appears as a standalone visible Paper AI card in normal mode.
- Total Remake, Reviewer/Rebuttal, Devil’s Advocate, and Competitive Review remain mounted as internal engine cards so existing JS services still work.
- The unified Paper AI panel is the only normal Paper AI surface.
- The old engine cards are only visible when the advanced checkbox `Show internal legacy engine cards (debug)` is enabled.
- The Paper AI header now says `Goal-driven Paper AI` and explains that the former workflows are controlled by unified settings.

No backend changes.

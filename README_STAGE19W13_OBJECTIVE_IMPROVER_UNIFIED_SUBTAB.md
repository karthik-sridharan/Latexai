# Stage 19W13 — Objective Improver Unified Subtab

Marker: `latex-stage19w13-objective-improver-unified-subtab-20260604-1`

Frontend-only UI consolidation stage.

## Goal

Merge the old separate **Devil’s Advocate** and **Competitive** Paper AI subtabs into one shared subtab:

```text
Goal-driven Improver
```

This reflects the design discussion that Devil’s Advocate, competitive ranking/improvement, and acceptance-rate improvement should share the same eventual AlphaGo/MCTS-style machinery and differ mainly by objective.

## UI changes

Paper AI subtabs are now:

```text
Total Remake
Review / Rebuttal
Goal-driven Improver
```

The former standalone subtabs:

```text
Devil’s Advocate
Competitive
```

are removed from the subtab strip.

Inside **Goal-driven Improver**, a new objective selector appears:

```text
Objective mode:
- Increase acceptance probability / paper quality
- Improve ranking against competitor papers
- Combined: adversarial + competitive

Scope:
- Whole paper
- Selected text / section
- Most salient blocks

Improvement focus:
- Balanced
- Ideas / novelty / positioning
- Writing / organization / clarity
- Math / assumptions / notation / proof clarity
- Citations / related work

Search budget:
- Fast
- Balanced
- Deep
```

## Behavior

The existing cards/services are preserved and moved into the unified pane:

```text
realAgentBranchCard      -> Goal-driven Improver pane
competitiveReviewCard    -> Goal-driven Improver pane
```

The objective selector controls visibility:

```text
Acceptance / quality mode:
  shows Devil’s Advocate branch runner
  hides Competitive Review

Competitive mode:
  shows Competitive Review
  hides Devil’s Advocate branch runner

Combined mode:
  shows both
```

This is intentionally a UI consolidation layer. It does not yet merge the underlying backend services or implement a new full MCTS engine. It prepares the UI for the later objective-driven/MCTS paper improver.

## Compatibility

Old saved workflow values and jump targets are normalized:

```text
devils       -> objective
competitive  -> objective
ranking      -> objective
adversarial  -> objective
```

So old localStorage values or jump-to-card behavior should still land in the new unified subtab.

## Files changed

```text
index.html
js/stage19w10-workflow-tabs-service.js
css/lai-stage19w10-workflow-tabs.css
README_STAGE19W13_OBJECTIVE_IMPROVER_UNIFIED_SUBTAB.md
```

## Tests run

```text
node --check js/stage19w10-workflow-tabs-service.js
python html.parser smoke check for index.html
static grep checks for marker, Goal-driven Improver, and objective pane
```

## Manual test checklist

1. Deploy frontend changed files.
2. Hard refresh browser.
3. Open the main editor.
4. Click **Paper AI**.
5. Confirm the subtabs are:
   - Total Remake
   - Review / Rebuttal
   - Goal-driven Improver
6. Confirm there are no separate **Devil’s Advocate** or **Competitive** subtabs.
7. Click **Goal-driven Improver**.
8. Confirm the objective selector appears.
9. Choose **Increase acceptance probability / paper quality**.
   - Devil’s Advocate branch runner should be visible.
   - Competitive Review should be hidden.
10. Choose **Improve ranking against competitor papers**.
   - Competitive Review should be visible.
   - Devil’s Advocate should be hidden.
11. Choose **Combined**.
   - Both cards should be visible.
12. Reload the page and confirm selected mode is remembered.

## Backend

No backend changes are required for this stage.

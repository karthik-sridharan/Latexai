# Stage 19I12 — High-Value AI Outcome Memory Wiring

This frontend-only stage adds the missing outcome/reward layer on top of Stage 19I11 generic AI-call memory logging.

## Why this stage exists

Stage 19I11 already wraps `LuminaLatex.AIProvider.ask`, so Neon can see that an AI call happened and which role/context bundle was used.  But for Stage 19J learned context scoring, the more important signal is what happened afterward:

- Did the user apply the Copilot output?
- Did a Document AI appendix/in-place edit actually get inserted?
- Did citation repair append BibTeX or replace `\citeai{...}` placeholders?
- Did TikZ/Image-to-TikZ save or insert source into the paper?
- Did Paper AI polish accept/reject/resolve `\lai` edits?
- Did presentation export save generated artifacts back into the project?

Stage 19I12 records those outcomes without adding any visible UI.

## Files changed

- `index.html`
- `js/ai-workflow-memory-service.js`
- `js/high-value-ai-outcome-memory-service.js` **new**

No backend redeploy is required if the Stage 19I10 backend is already deployed, because this stage reuses existing endpoints:

- `POST /api/lumina/memory/edit-outcome`
- `POST /api/lumina/memory/reward`
- `POST /api/lumina/memory/debate-trajectory`

## What is newly logged

The new `HighValueAIOutcomeMemoryService` watches high-value AI application paths and logs:

1. `edit_outcomes` for applied/saved/inserted/resolved AI outputs.
2. `reward_events` through the existing `RewardLoggingService.logEditOutcome` path.
3. Small single-step `debate_trajectories` that link the original AI run/context bundle to the later user-visible outcome.

The service intentionally stays hidden and only activates when memory is enabled.

## Workflows covered

- Copilot insert/replace/apply patch
- Document AI append, run+append, and LAI/LAIOLD resolution
- Citation AI apply/run+apply
- Citation verifier missing-BibTeX repair
- Image-to-TikZ remake+insert and returned-TikZ insert
- TikZ maker save, direct insert, and save+input insert
- Paper AI polish accept/reject/repair flows
- Presentation export save deck and add generated talk exports to project

## How it works

The stage combines three safe hooks:

1. A capturing click listener marks high-value AI action buttons before their existing handlers run.
2. Low-level mutation wrappers on `State.updateFile`, `Editor.insertText`, `PatchService`, and `AssetService` detect actual project/source changes.
3. A small memory bridge in `AIWorkflowMemoryService` remembers the most recent generic AI agent run so the later outcome can reference the original `agentRunId`, `contextBundleId`, and memory IDs.

This makes the logs useful for Stage 19J, where context scoring can reward memories and prompt/context bundles that led to accepted/applied edits.

## Verification checklist

After deploying the frontend:

1. Hard refresh the app.
2. Run one high-value workflow, for example:
   - Copilot rewrite selection and apply patch, or
   - Citation AI `Run + apply`, or
   - TikZ maker `Insert TikZ directly`.
3. Open the backend memory debug endpoints:
   - `/api/lumina/memory/debug/rewards`
   - `/api/lumina/memory/debug/agent-runs`
   - `/api/lumina/memory/debug/debate-trajectories`
4. You should now see a new outcome/reward event whose workflow/action type matches the applied AI action.

Expected examples:

- `copilot_apply_patch`
- `document_ai_run_and_append`
- `citation_ai_run_and_apply_plan`
- `citation_verifier_repair_missing_bibtex`
- `image_to_tikz_remake_and_insert`
- `tikz_maker_direct_insert`
- `paper_ai_accept_all_new`
- `presentation_export_save_deck_json`

## Notes

This stage does not change visible UI behavior.  It is deliberately a data-quality stage before Stage 19J learned context scoring.

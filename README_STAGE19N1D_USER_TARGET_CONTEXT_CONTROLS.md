# Latexai Stage 19N1D — User Target + Context Controls

Frontend-only stage on top of Stage 19N1C.

## Adds

- Parses `\part`, `\chapter`, `\section`, `\subsection`, `\subsubsection`, `\paragraph`, and `\subparagraph` headings as targetable document units.
- Adds a multi-select target picker in the main-editor Devil's Advocate branch runner.
- Adds target modes:
  - selected branch target only
  - user-selected sections/subsections
  - salient sections
  - first 6 detected units
  - whole paper: every detected unit
- Requires the editor agent to return one visible `\lai{...}` block per requested target.
- Requires `\lai{\paragraph{Target section: ...} No edits recommended.}` when no edit is needed.
- Adds visible prompt context mode:
  - outline + selected excerpts
  - selected excerpts only
  - whole paper truncated + selected focus
  - full paper visible if within budget
- Adds AI payload source mode:
  - include full `latexSource` in AI payload
  - include truncated `latexSource`
  - omit `latexSource` from the AI payload

## Test

Open the app with `?v=19n1d`, go to Copilot → Devil's Advocate branch runner.

1. Click **Refresh detected targets**.
2. Set **Target mode** to user-selected or whole paper.
3. Choose **Visible prompt context** and **AI payload full source**.
4. Run full preview in dry-run first.
5. For real mode, check the agent output includes one `\lai` block or no-edit marker per target section.

# Stage 19N1C — Enforced Multi-Section Debate Edits

Frontend-only patch on top of Stage 19N1B.

Fixes the case where the Devil's Advocate branch runner kept placing all final edits in the Introduction.

Changes:
- Defaults Section scope to `salient sections` instead of branch target only.
- Strengthens critic/advocate/synthesizer/editor prompts to require coverage of every requested target section.
- Forces the final editor to place the target-section label *inside* each `\lai{...}` block so the cleaner does not discard it.
- Adds frontend multi-section insertion: when the cleaned blocks contain target-section labels, targeted apply distributes them after the matching section headings; append apply inserts a section-labeled block before `\end{document}`.
- Adds an explicit preview note showing inferred block targets.

Open with `?v=19n1c`.

Recommended test:
1. Section scope = salient sections or first 6 sections.
2. Debate rounds = 2.
3. Run full preview.
4. Confirm the insertion preview says `Multi-section frontend insertion is active`.
5. Confirm block targets are not only Introduction.

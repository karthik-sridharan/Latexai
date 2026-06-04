# Stage 19W21 — Project actions and top sister-app links

Marker: `latex-stage19w21-project-actions-top-sister-app-links-20260604-1`

Frontend-only UI cleanup.

Changes:

- Moved New project, Open GitHub, Save local, Import, and Export zip into the Project tab at the top.
- Kept hidden import file input with the Project controls so existing import wiring still works.
- Top bar now keeps sister app links plus Compile PDF:
  - Literature Assistant
  - Review Corpus
  - Value/Action Lab
  - MCTS Lab button, which jumps to Context / MCTS inside the app
  - Compile PDF
- Backend unchanged.

Test:

1. Hard refresh main editor.
2. Confirm top bar has sister apps + Compile PDF, not project file buttons.
3. Open Project left tab and confirm project actions appear at top.
4. Test New project, Open GitHub, Save local, Import, Export zip.
5. Click MCTS Lab and confirm left panel switches to Context / MCTS.

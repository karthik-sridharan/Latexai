# Stage 19W50 — Chuvadi branding

This frontend-only stage renames the visible app branding from Lumina to Chuvadi.

## Changes

- Main editor title changed to `Chuvadi LaTeX Editor`.
- Main top-left brand label changed from `Lumina LaTeX` to `Chuvadi`.
- Main brand mark changed from `L` to `C`.
- Help page title, hero text, footer, and brand mark updated to Chuvadi.
- Literature Assistant companion page brand changed from `Lumina Research` / `L` to `Chuvadi Research` / `C`.
- Default generated project names changed from `Untitled Lumina LaTeX Project` to `Untitled Chuvadi Project`.
- Default template title changed from `A Lumina LaTeX Project` to `A Chuvadi Project`.
- Export README changed to `README_CHUVADI.txt` with Chuvadi wording.
- Copilot system prompt now identifies itself as Chuvadi Copilot.

## Notes

Internal JavaScript namespaces, localStorage keys, and backend routes still use `LuminaLatex` / `/api/lumina/...` for compatibility. This stage is a user-facing branding change, not an API migration.

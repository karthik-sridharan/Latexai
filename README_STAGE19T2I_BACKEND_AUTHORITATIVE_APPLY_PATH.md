# Stage 19T2I — Backend-authoritative apply path

This frontend stage makes the backend Safe Edit Compiler the authoritative validator for Devil's Advocate localized insertions.

Changes:
- If backend insertion preview returns `safeCompiler: true` and `safeToInsert: true`, the frontend no longer re-runs the old broad JSON/backslash-damage detector over the whole generated document.
- Frontend still checks complete-document shape, package-before-documentclass, prompt-scaffolding, and no-op conditions.
- The old JSON/backslash detector remains active only for legacy non-safe-compiler drafts.
- Copy localized edits follows the same backend-authoritative path.

This fixes valid raw LaTeX patches containing normal math/macros being blocked by stale apply-time guards after the backend already accepted them.

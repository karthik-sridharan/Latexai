# Stage 19T2B — Structured edit proposal repair frontend

This stage keeps Devil's Advocate on the generic Safe Edit Compiler path and adds repair-loop wiring.

## Changes

- Frontend badge/stage updated to `latex-stage19t2b-structured-edit-proposal-repair-20260530-1`.
- Devil's Advocate insertion payload now requests backend safe-edit repair.
- The repair model/provider is inherited from the Devil's Advocate synthesis/editor route in Settings.
- Dry-run editor output now uses the same safe edit intent schema as real runs.
- Structured parser now understands the generic safe-edit fields:
  - `kind`
  - `target_block_id`
  - `target_section`
  - `old_text_exact`
  - `new_text`
- Preview UI shows repair-loop status when a proposal is repaired.

## Design note

The module is deliberately generic so that Rewrite, Improve, Competitive Review, Citation AI, and future MCTS edit agents can later call the same safe edit path.

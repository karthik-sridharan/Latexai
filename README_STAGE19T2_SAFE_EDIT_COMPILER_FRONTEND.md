# Stage 19T2 Frontend — Safe Edit Compiler Integration

Expected badge: `latex-stage19t2-safe-edit-compiler-20260530-1`.

This stage stops the frontend from compiling raw AI output into source on its own when the backend Safe Edit Compiler is available. The Devil's Advocate insertion preview now trusts backend validation and shows rejected unsafe edits. The apply buttons are blocked unless `safeToInsert: true`.

The editor-agent prompt now asks for structured safe edit intent rather than raw `\lai` markup. Visible context includes a Safe Edit target block map and removes earlier excerpt marker strings that models copied into source.

# Release Notes — Stage 1C

## Added

- Job-based PDF compile pipeline.
- Compile progress/status card in the Logs panel.
- Optional compile proxy token field.
- Compile job polling with synchronous fallback.
- Cancel compile button and backend cancel endpoint.
- Backend job endpoints for create/read/events/cancel.
- Server-sent event endpoint for future streamed compile updates.
- Stronger backend validation for paths, extensions, file sizes, shell escape, and timeouts.
- Structured log parser with file/line diagnostics where possible.
- Click-to-line diagnostics in the frontend.
- Stage 1C architecture contract and diagnostic script.

## Preserved

- Static deploy works without backend.
- Local autosave and project schema remain compatible with Stage 1B.
- AI provider proxy architecture remains backend-first.
- WebSocket collaboration seam remains reserved without forcing migration.

## Known limitations

- Browser-WASM compile is still a placeholder.
- Real-time multi-user collaboration is not yet implemented.
- Imported binary assets are still represented through the current text-oriented project format; richer binary asset packaging should be handled in a later import/export stage.
- PDF/source SyncTeX is not yet wired.

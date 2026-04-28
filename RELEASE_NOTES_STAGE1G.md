# Stage 1G PDF/status hotfix

Stage: `latex-stage1g-texlyre-bibtex-auto-hotfix-20260428-1`

Fixes the TeXlyre BusyTeX result/status path now that the browser assets are reachable. This hotfix adds robust PDF byte extraction, records resultSuccess/pdfExtracted/pdfBytesLength, and reports pdfCandidateSummary when TeXlyre compiles but Lumina cannot extract PDF bytes.

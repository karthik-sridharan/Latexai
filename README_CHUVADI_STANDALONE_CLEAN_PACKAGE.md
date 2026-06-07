# Chuvadi standalone clean package — Stage 19W53

This frontend package is the Chuvadi LaTeX editor only. It removes the standalone `literature.html`, `literature_script.js`, and `review.html` pages and removes the visible top-bar links to those companion apps.

The Chuvadi editor still contains paper-AI workflows, reviewer/rebuttal UI, citation tools, and project-memory integration used inside the editor. The companion Kalvi Literature Assistant and Review Corpus apps should be deployed from their own full-stack packages.

Internal JavaScript namespace and API paths may still use `LuminaLatex` and `/api/lumina/...` for compatibility with the existing deployed backend.

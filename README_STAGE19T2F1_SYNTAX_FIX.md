Stage 19T2F1 frontend syntax fix.

Fixes malformed JavaScript string/regex literals in js/real-agent-branch-workflow-service.js that caused:
SyntaxError: Unterminated regular expression literal '/' at real-agent-branch-workflow-service.js:1246.

No backend changes required.

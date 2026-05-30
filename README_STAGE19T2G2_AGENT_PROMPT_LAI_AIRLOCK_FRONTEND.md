# Stage 19T2G2 — Frontend AI-payload internal change-marker airlock

AIProvider.ask now recursively scrubs internal visible-change marker names and macro definitions from every outgoing AI request payload and metadata object. This is a defense-in-depth layer; backend /api/lumina/ai also performs the same airlock.

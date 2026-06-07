# Stage 19T2H — Raw Patch Validator Relaxation + Shadow Compile Authority

Frontend companion for Stage 19T2H. The visible stage badge and script cache key are updated while the raw patch protocol from 19T2E/19T2F/19T2G remains in place.

Backend 19T2H is the important change: it accepts clean raw LaTeX math patches such as `\|a\|`, `\langle a,b\rangle`, `\[` and `\]` instead of treating them as JSON/backslash corruption.

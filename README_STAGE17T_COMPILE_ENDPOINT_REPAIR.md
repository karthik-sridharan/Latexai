# Stage 17T — Compile endpoint repair

Stage string: `stage17t-compile-endpoint-repair-1`

Fixes stale frontend compile settings where `compileUrl` points at the generic Lumina backend while `backendStatusUrl` points at the real LaTeX compiler backend. The compiler provider now repairs those settings, tries paired job/direct endpoint candidates, and stringifies HTTP 400 object details instead of showing `[object Object]`.

This preserves Stage 17S LaTeX-safe `\lai` insertion behavior.

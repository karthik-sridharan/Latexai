# Stage 19U7D — Semantic Scholar author URL parser fix (frontend)

Fixes the standalone `literature.html` author import UI so pasted Semantic Scholar author URLs are parsed before the backend request.

The UI now detects inputs such as:

```text
https://www.semanticscholar.org/author/A.-Rakhlin/1680046
https://www.semanticscholar.org/author/1680046
1680046
Alexander Rakhlin
```

For URL inputs it sends both:

- `authorId`, e.g. `1680046`;
- a name fallback from the slug, e.g. `A Rakhlin`.

It also displays the detected id/name fallback in the status card.

Stage marker:

```text
latex-stage19u7d-semantic-scholar-author-url-parser-fix-20260531-1
```

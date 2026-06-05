/* LatexAI Stage 19W26 — stable editor helpers with always-on auto-indent
 * Robust design: explicit text operations only. Overlay token coloring is disabled
 * because textarea overlays can desync cursor/display on Safari/iPad. Native syntax
 * colors should be implemented later with a real editor engine (CodeMirror/Monaco).
 * Auto-indent is always on; whole-document format is intentionally not exposed.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'latex-stage19w26-editor-helper-simplify-autoindent-20260604-1';
  const SYNTAX_KEY = 'latexai:stage19w25:syntax-colors-disabled:v1';
  const AUTO_INDENT_KEY = 'latexai:stage19w26:auto-indent-always-on:v1';
  const MAX_HIGHLIGHT_CHARS = 260000;

  let editor = null;
  let shell = null;
  let overlay = null;
  let renderTimer = 0;
  let envMatch = null;
  let initialized = false;

  function $(id) { return D.getElementById(id); }
  function toast(msg) { try { NS.Main?.toast?.(msg); } catch (_err) {} }
  function getBool(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v === null || v === undefined) return !!fallback;
      return v === '1' || v === 'true';
    } catch (_err) { return !!fallback; }
  }
  function setBool(key, value) { try { localStorage.setItem(key, value ? '1' : '0'); } catch (_err) {} }
  function isTouchOrSafariLike() {
    const ua = String(navigator.userAgent || '');
    const vendor = String(navigator.vendor || '');
    const safari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg/i.test(ua);
    const touch = (navigator.maxTouchPoints || 0) > 1;
    return safari || touch || /Apple/i.test(vendor);
  }
  function syntaxDefault() { return !isTouchOrSafariLike(); }

  function activeEditor() {
    editor = $('sourceEditor') || editor;
    shell = editor?.closest?.('.source-shell') || shell;
    if (shell) shell.classList.add('lai-lite-source-shell');
    return editor;
  }

  function init() {
    if (initialized) return true;
    if (!activeEditor()) return false;
    initialized = true;

    // Ensure old experimental Stage 18 overlay stays off if it was enabled before.
    try { localStorage.setItem('latexai:editor-syntax-overlay-experimental:v1', '0'); } catch (_err) {}
    cleanupOldOverlays();

    bindButton('liteIndentBtn', indentSelection);
    bindButton('liteOutdentBtn', outdentSelection);
    bindButton('liteFormatSelectionBtn', formatSelection);
    // Format-document is intentionally not exposed in the UI; whole-file whitespace changes are too broad for the stable helper toolbar.

    // Stage 19W25: syntax overlay coloring is intentionally disabled.
    // Textarea overlay highlighting causes cursor/display desync in Safari/iPad.
    // Keep this as a no-op until we move to a native editor engine.
    setBool(SYNTAX_KEY, false);
    const syntaxToggle = $('liteSyntaxToggle');
    if (syntaxToggle) {
      syntaxToggle.checked = false;
      syntaxToggle.disabled = true;
      syntaxToggle.closest?.('.editor-lite-toggle')?.remove?.();
    }
    // Stage 19W26: auto-indent is always on and no longer user-toggled.
    setBool(AUTO_INDENT_KEY, true);
    const autoToggle = $('liteAutoIndentToggle');
    if (autoToggle) autoToggle.closest?.('.editor-lite-toggle')?.remove?.();

    editor.addEventListener('keydown', onKeydown, true);
    editor.addEventListener('input', () => { scheduleRender(); scheduleEnvStatus(); }, true);
    editor.addEventListener('scroll', syncOverlayScroll, { passive: true });
    ['keyup', 'click', 'mouseup', 'touchend', 'select', 'focus'].forEach((name) => editor.addEventListener(name, scheduleEnvStatus, true));

    try {
      NS.State?.subscribe?.((_snapshot, reason) => {
        if (['load', 'reset', 'active-file', 'file-create', 'file-remove', 'file-rename', 'file-import-overwrite', 'file-change'].includes(reason)) {
          setTimeout(() => { activeEditor(); scheduleRender({ force: true }); scheduleEnvStatus(); }, 30);
        }
      });
    } catch (_err) {}

    setSyntaxEnabled(getBool(SYNTAX_KEY, syntaxDefault()));
    scheduleEnvStatus();
    NS.EditorLite = api;
    return true;
  }

  function bindButton(id, fn) {
    const btn = $(id);
    if (!btn) return;
    btn.addEventListener('click', (event) => { event.preventDefault(); fn(); }, true);
  }

  function cleanupOldOverlays() {
    if (!shell) return;
    shell.querySelectorAll('#latexSyntaxOverlay,.latex-syntax-overlay').forEach((node) => node.remove());
    editor?.classList?.remove('latexai-syntax-textarea', 'latexai-syntax-stable-single-surface');
    if (editor) {
      editor.style.removeProperty('-webkit-text-fill-color');
      editor.style.removeProperty('color');
      editor.style.removeProperty('background');
      editor.style.removeProperty('caret-color');
    }
  }

  function setSyntaxEnabled(_enabled) {
    activeEditor();
    cleanupOldOverlays();
    if (overlay) overlay.remove();
    overlay = null;
    if (shell) shell.classList.remove('lai-lite-syntax-enabled');
    setBool(SYNTAX_KEY, false);
  }

  function notifyChanged(selectStart, selectEnd) {
    activeEditor();
    if (!editor) return;
    try { editor.focus(); editor.setSelectionRange(selectStart, selectEnd); } catch (_err) {}
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    scheduleRender({ force: true, immediate: true });
    scheduleEnvStatus();
  }

  function lineRangeForSelection(el) {
    const text = String(el.value || '');
    const start = Number(el.selectionStart || 0);
    const end = Number(el.selectionEnd || start);
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let lineEnd = end > start ? text.indexOf('\n', end) : text.indexOf('\n', start);
    if (lineEnd < 0) lineEnd = text.length;
    return { start: lineStart, end: lineEnd, selectionStart: start, selectionEnd: end };
  }

  function indentSelection() {
    activeEditor();
    if (!editor || editor.readOnly) return;
    const text = String(editor.value || '');
    const range = lineRangeForSelection(editor);
    const chunk = text.slice(range.start, range.end);
    const nextChunk = chunk.split('\n').map((line) => line.length ? '  ' + line : line).join('\n');
    editor.value = text.slice(0, range.start) + nextChunk + text.slice(range.end);
    notifyChanged(range.start, range.start + nextChunk.length);
  }

  function outdentSelection() {
    activeEditor();
    if (!editor || editor.readOnly) return;
    const text = String(editor.value || '');
    const range = lineRangeForSelection(editor);
    const chunk = text.slice(range.start, range.end);
    const nextChunk = chunk.split('\n').map((line) => line.startsWith('  ') ? line.slice(2) : (line.startsWith('\t') ? line.slice(1) : (line.startsWith(' ') ? line.slice(1) : line))).join('\n');
    editor.value = text.slice(0, range.start) + nextChunk + text.slice(range.end);
    notifyChanged(range.start, range.start + nextChunk.length);
  }

  function stripLineComment(line) {
    let escaped = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '\\') { escaped = !escaped; continue; }
      if (ch === '%' && !escaped) return line.slice(0, i);
      escaped = false;
    }
    return line;
  }

  function closeBefore(line) {
    const t = String(line || '').trim();
    if (!t) return false;
    return /^\\end\s*\{/.test(t) || /^\\\]/.test(t) || /^\}/.test(t);
  }

  function lineDepthDelta(line) {
    const code = stripLineComment(String(line || ''));
    const begins = (code.match(/\\begin\s*\{/g) || []).length;
    const ends = (code.match(/\\end\s*\{/g) || []).length;
    let delta = begins - ends;
    if (/\\\[/.test(code) && !/\\\]/.test(code)) delta += 1;
    if (/\\\]/.test(code) && !/\\\[/.test(code)) delta -= 1;
    return delta;
  }

  function formatLatexBlock(text, baseDepth = 0) {
    const hadFinalNewline = /\n$/.test(String(text || ''));
    const lines = String(text || '').split('\n');
    let depth = Math.max(0, Number(baseDepth) || 0);
    const out = [];
    let blankRun = 0;
    for (let raw of lines) {
      let line = String(raw || '').replace(/[ \t]+$/g, '');
      if (!line.trim()) {
        blankRun += 1;
        if (blankRun <= 2) out.push('');
        continue;
      }
      blankRun = 0;
      const trimmed = line.trimStart();
      if (closeBefore(trimmed)) depth = Math.max(0, depth - 1);
      out.push('  '.repeat(Math.min(depth, 12)) + trimmed);
      depth = Math.max(0, depth + lineDepthDelta(trimmed));
    }
    let result = out.join('\n');
    if (hadFinalNewline && !result.endsWith('\n')) result += '\n';
    return result;
  }

  function depthBeforePosition(text, pos) {
    const before = String(text || '').slice(0, Math.max(0, Number(pos) || 0));
    let depth = 0;
    before.split('\n').forEach((line) => { depth = Math.max(0, depth + lineDepthDelta(line)); });
    return depth;
  }

  function formatSelection() {
    activeEditor();
    if (!editor || editor.readOnly) return;
    const text = String(editor.value || '');
    const range = lineRangeForSelection(editor);
    const chunk = text.slice(range.start, range.end);
    const base = depthBeforePosition(text, range.start);
    const nextChunk = formatLatexBlock(chunk, base);
    editor.value = text.slice(0, range.start) + nextChunk + text.slice(range.end);
    notifyChanged(range.start, range.start + nextChunk.length);
    toast('Formatted selected LaTeX lines.');
  }

  function formatDocument() {
    activeEditor();
    if (!editor || editor.readOnly) return;
    const text = String(editor.value || '');
    const next = formatLatexBlock(text, 0);
    editor.value = next;
    notifyChanged(0, Math.min(next.length, 0));
    toast('Formatted document indentation.');
  }

  function onKeydown(event) {
    activeEditor();
    if (!editor || editor.readOnly) return;
    if (event.key === 'Tab') {
      const sel = String(editor.value || '').slice(Number(editor.selectionStart || 0), Number(editor.selectionEnd || 0));
      if (sel.includes('\n')) {
        event.preventDefault();
        if (event.shiftKey) outdentSelection(); else indentSelection();
        return;
      }
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      insertAutoIndentedNewline();
    }
  }

  function insertAutoIndentedNewline() {
    const text = String(editor.value || '');
    const start = Number(editor.selectionStart || 0);
    const end = Number(editor.selectionEnd || start);
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const currentLine = text.slice(lineStart, start);
    const base = currentLine.match(/^\s*/)?.[0] || '';
    const code = stripLineComment(currentLine).trim();
    const extra = (/\\begin\s*\{[^}]+\}\s*$/.test(code) || /\{\s*$/.test(code) || /\\\[\s*$/.test(code)) ? '  ' : '';
    const insert = '\n' + base + extra;
    editor.value = text.slice(0, start) + insert + text.slice(end);
    const cursor = start + insert.length;
    notifyChanged(cursor, cursor);
  }

  function htmlEscape(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function splitComment(line) {
    let escaped = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '\\') { escaped = !escaped; continue; }
      if (ch === '%' && !escaped) return { code: line.slice(0, i), comment: line.slice(i) };
      escaped = false;
    }
    return { code: line, comment: '' };
  }

  function colorCode(code) {
    const token = /(\\(?:begin|end)\s*\{([^}\n]*)\})|(\\(?:cite|citet|citep|citealp|citeauthor|parencite|textcite)\*?\s*\{[^}\n]*\})|(\\(?:ref|eqref|autoref|cref|Cref|label)\*?\s*\{[^}\n]*\})|(\\\[|\\\]|\\\(|\\\))|(\$[^$\n]*\$)|(\\[a-zA-Z@]+\*?|\\.)|([{}\[\]])/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = token.exec(code))) {
      out += htmlEscape(code.slice(last, m.index));
      const t = m[0];
      if (m[1]) {
        const type = /^\\begin/.test(t) ? 'begin' : 'end';
        out += '<span class="lai-lite-env-command">\\' + type + '</span><span class="lai-lite-brace">{</span><span class="lai-lite-env-name">' + htmlEscape(m[2] || '') + '</span><span class="lai-lite-brace">}</span>';
      } else if (m[3]) out += '<span class="lai-lite-cite">' + htmlEscape(t) + '</span>';
      else if (m[4]) out += '<span class="lai-lite-ref">' + htmlEscape(t) + '</span>';
      else if (m[5] || m[6]) out += '<span class="lai-lite-math lai-lite-math-zone">' + htmlEscape(t) + '</span>';
      else if (m[7]) out += '<span class="lai-lite-command">' + htmlEscape(t) + '</span>';
      else out += '<span class="lai-lite-brace">' + htmlEscape(t) + '</span>';
      last = m.index + t.length;
    }
    out += htmlEscape(code.slice(last));
    return out;
  }

  function renderHtml(text) {
    const lines = String(text || '').split('\n');
    const matchLines = new Set();
    if (envMatch && Number.isFinite(envMatch.beginLine)) matchLines.add(envMatch.beginLine);
    if (envMatch && Number.isFinite(envMatch.endLine)) matchLines.add(envMatch.endLine);
    return lines.map((line, idx) => {
      const p = splitComment(line);
      const code = colorCode(p.code);
      const comment = p.comment ? '<span class="lai-lite-comment">' + htmlEscape(p.comment) + '</span>' : '';
      const cls = matchLines.has(idx + 1) ? 'lai-lite-line lai-lite-env-match-line' : 'lai-lite-line';
      return '<span class="' + cls + '">' + (code + comment || '&nbsp;') + '</span>';
    }).join('\n');
  }

  function scheduleRender(_options = {}) {
    // No overlay rendering in Stage 19W25. Native syntax coloring requires a real
    // editor engine, not a hidden textarea overlay.
  }

  function renderOverlay() {
    // Intentionally disabled.
  }

  function syncOverlayScroll() {
    // Intentionally disabled.
  }

  function lineNumberAt(text, pos) {
    return String(text || '').slice(0, Math.max(0, pos)).split('\n').length;
  }

  function envTokens(text) {
    const re = /\\(begin|end)\s*\{([^}\n]+)\}/g;
    const out = [];
    let m;
    while ((m = re.exec(text))) {
      out.push({ kind: m[1], name: m[2], index: m.index, line: lineNumberAt(text, m.index) });
    }
    return out;
  }

  function findEnvMatch(text, cursor) {
    const tokens = envTokens(text);
    if (!tokens.length) return null;
    let active = -1;
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i].index <= cursor) active = i; else break;
    }
    if (active < 0) active = 0;
    const tok = tokens[active];
    if (!tok) return null;
    if (tok.kind === 'begin') {
      let depth = 0;
      for (let i = active; i < tokens.length; i += 1) {
        const t = tokens[i];
        if (t.name !== tok.name) continue;
        if (t.kind === 'begin') depth += 1;
        if (t.kind === 'end') depth -= 1;
        if (depth === 0) return { name: tok.name, beginLine: tok.line, endLine: t.line, direction: 'forward' };
      }
      return { name: tok.name, beginLine: tok.line, endLine: NaN, direction: 'unclosed' };
    }
    if (tok.kind === 'end') {
      let depth = 0;
      for (let i = active; i >= 0; i -= 1) {
        const t = tokens[i];
        if (t.name !== tok.name) continue;
        if (t.kind === 'end') depth += 1;
        if (t.kind === 'begin') depth -= 1;
        if (depth === 0) return { name: tok.name, beginLine: t.line, endLine: tok.line, direction: 'backward' };
      }
      return { name: tok.name, beginLine: NaN, endLine: tok.line, direction: 'unmatched-end' };
    }
    return null;
  }

  function scheduleEnvStatus() {
    setTimeout(updateEnvStatus, 0);
  }

  function updateEnvStatus() {
    activeEditor();
    const status = $('liteEnvStatus');
    if (!editor || !status) return;
    const text = String(editor.value || '');
    const cursor = Number(editor.selectionStart || 0);
    envMatch = findEnvMatch(text, cursor);
    if (!envMatch) status.textContent = 'Env: —';
    else if (Number.isFinite(envMatch.beginLine) && Number.isFinite(envMatch.endLine)) status.textContent = `Env: ${envMatch.name} L${envMatch.beginLine}–L${envMatch.endLine}`;
    else if (Number.isFinite(envMatch.beginLine)) status.textContent = `Env: ${envMatch.name} begins L${envMatch.beginLine}, no matching end`;
    else status.textContent = `Env: ${envMatch.name} ends L${envMatch.endLine}, no matching begin`;
    scheduleRender({ force: true });
  }

  const api = {
    STAGE,
    init,
    indentSelection,
    outdentSelection,
    formatSelection,
    setSyntaxEnabled,
    formatLatexBlock
  };

  function boot() {
    if (init()) return;
    setTimeout(boot, 80);
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

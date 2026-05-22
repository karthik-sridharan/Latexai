/* Latexai Stage 18K EditorEnhancementService
 * Stage: stage18k-editor-shortcut-live-template-fix-1
 *
 * Adds a lightweight Overleaf-like LaTeX source highlighter, smart indentation,
 * built-in LaTeX shortcuts, and an optional compact custom-shortcut editor.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage18k-editor-shortcut-live-template-fix-1';
  const SHORTCUT_KEY = 'latexai:editor-shortcuts:v1';
  const HIGHLIGHT_KEY = 'latexai:editor-syntax-highlight:v1';
  const EXPERIMENTAL_OVERLAY_KEY = 'latexai:editor-syntax-overlay-experimental:v1';

  let editor = null;
  let overlay = null;
  let renderTimer = 0;
  let renderTimerType = '';
  let initialized = false;
  let stateSyncBound = false;
  let lastRenderedValue = null;
  let compositionActive = false;

  const DEFAULT_SHORTCUTS = [
    {
      id: 'wrap-selected-env-name',
      key: 'mod+b',
      label: 'Wrap environment name',
      mode: 'environmentFromSelection',
      description: 'Select theorem, proof, align, etc. and press Cmd/Ctrl+B to insert \\begin{name} ... \\end{name} with the cursor between.'
    },
    {
      id: 'comment-selection',
      key: 'mod+[',
      label: 'Comment selection',
      mode: 'commentSelection',
      description: 'Comment selected/current LaTeX source lines one level.'
    },
    {
      id: 'uncomment-selection',
      key: 'mod+]',
      label: 'Uncomment selection',
      mode: 'uncommentSelection',
      description: 'Remove one leading LaTeX comment marker from selected/current lines.'
    }
  ];

  function lsGet(key, fallback = '') {
    try { return localStorage.getItem(key) ?? fallback; } catch (_err) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_err) {}
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (_err) {}
  }
  function isSafariLike() {
    const ua = String(navigator.userAgent || '');
    const vendor = String(navigator.vendor || '');
    const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return isSafari || isIOS || /Apple/i.test(vendor);
  }

  function isHighlightEnabled() {
    // Stage 18H intentionally disables the live textarea-under-overlay highlighter
    // by default. On Safari/iPad it caused dark-on-dark text, a stale "old editor"
    // overlay when focus moved to the right panel, and cursor/edit-position drift.
    // Keep shortcuts/smart indentation stable on the real textarea. Users can opt
    // into the experimental overlay on non-Safari browsers with the new key below.
    if (isSafariLike()) return false;
    return lsGet(EXPERIMENTAL_OVERLAY_KEY, '0') === '1';
  }

  function enforceDirectEditorSurface() {
    const ed = D.getElementById('sourceEditor');
    if (!ed) return false;
    const shell = ed.closest('.source-shell');
    ed.classList.remove('latexai-syntax-textarea', 'latexai-syntax-stable-single-surface');
    ed.style.removeProperty('-webkit-text-fill-color');
    ed.style.removeProperty('color');
    ed.style.removeProperty('background');
    ed.style.removeProperty('caret-color');
    if (document.activeElement === ed && shell) {
      const selOverlay = shell.querySelector('.lai-source-selection-overlay');
      if (selOverlay) selOverlay.classList.add('hidden');
      shell.classList.remove('lai-source-selection-active');
      ed.classList.remove('lai-source-selection-hidden-text');
    }
    return true;
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isEscapedAt(text, index) {
    let count = 0;
    for (let i = index - 1; i >= 0 && text[i] === '\\'; i -= 1) count += 1;
    return count % 2 === 1;
  }

  function splitComment(line) {
    for (let i = 0; i < line.length; i += 1) {
      if (line[i] === '%' && !isEscapedAt(line, i)) {
        return { code: line.slice(0, i), comment: line.slice(i) };
      }
    }
    return { code: line, comment: '' };
  }

  function envPieces(token) {
    const m = String(token || '').match(/^(\\(?:begin|end))\s*\{([^}]*)\}$/);
    if (!m) return escapeHtml(token);
    return [
      '<span class="latex-token-command">', escapeHtml(m[1]), '</span>',
      '<span class="latex-token-brace">{</span>',
      '<span class="latex-token-env">', escapeHtml(m[2]), '</span>',
      '<span class="latex-token-brace">}</span>'
    ].join('');
  }

  function highlightCode(code) {
    const src = String(code || '');
    const token = /(\\(?:begin|end)\s*\{[^}\n]*\})|(\\\[|\\\]|\\\(|\\\))|(\$[^$\n]*\$)|(\\[a-zA-Z@]+\*?|\\.)|([{}\[\]])/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = token.exec(src))) {
      out += escapeHtml(src.slice(last, m.index));
      const t = m[0];
      if (m[1]) out += envPieces(t);
      else if (m[2]) out += `<span class="latex-token-math-delim">${escapeHtml(t)}</span>`;
      else if (m[3]) out += `<span class="latex-token-math">${escapeHtml(t)}</span>`;
      else if (m[4]) out += `<span class="latex-token-command">${escapeHtml(t)}</span>`;
      else out += `<span class="latex-token-brace">${escapeHtml(t)}</span>`;
      last = m.index + t.length;
    }
    out += escapeHtml(src.slice(last));
    return out;
  }

  function envDelta(line) {
    const begins = (line.match(/\\begin\s*\{/g) || []).length;
    const ends = (line.match(/\\end\s*\{/g) || []).length;
    return begins - ends;
  }

  function renderHighlightedHtml(text) {
    const lines = String(text ?? '').split('\n');
    let depth = 0;
    const out = [];
    for (const line of lines) {
      const trimmed = line.trim();
      const closesFirst = /^\\end\s*\{/.test(trimmed) || /^\}/.test(trimmed);
      const level = Math.max(0, depth - (closesFirst ? 1 : 0));
      const parts = splitComment(line);
      const html = [
        highlightCode(parts.code),
        parts.comment ? `<span class="latex-token-comment">${escapeHtml(parts.comment)}</span>` : ''
      ].join('') || '&nbsp;';
      out.push(`<span class="latex-syntax-line" style="--lai-indent-level:${Math.min(level, 8)}">${html}</span>`);
      depth = Math.max(0, depth + envDelta(parts.code));
    }
    return out.join('\n');
  }

  function removeDuplicateSyntaxOverlays(shell) {
    const overlays = Array.from(shell.querySelectorAll('#latexSyntaxOverlay'));
    overlays.slice(1).forEach((item) => item.remove());
    return overlays[0] || null;
  }

  function getEditorValue() {
    return String(editor?.value ?? '');
  }

  function installHighlighter() {
    editor = D.getElementById('sourceEditor');
    if (!editor) return false;
    const shell = editor.closest('.source-shell');
    if (!shell) return false;

    shell.classList.add('latexai-enhanced-source-shell', 'latexai-direct-editor-surface');
    overlay = removeDuplicateSyntaxOverlays(shell) || overlay;
    if (!overlay || !shell.contains(overlay)) {
      overlay = D.createElement('pre');
      overlay.id = 'latexSyntaxOverlay';
      overlay.className = 'latex-syntax-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      shell.insertBefore(overlay, editor);
      lastRenderedValue = null;
    }

    const enabled = isHighlightEnabled();
    enforceDirectEditorSurface();
    editor.classList.toggle('latexai-syntax-textarea', enabled);
    editor.classList.toggle('latexai-syntax-stable-single-surface', enabled);
    overlay.hidden = !enabled;
    overlay.setAttribute('data-stage18h-enabled', enabled ? '1' : '0');
    if (enabled) {
      renderHighlight({ force: true });
      syncOverlayScroll();
    } else {
      overlay.textContent = '';
      lastRenderedValue = null;
    }
    return true;
  }

  function syncOverlayScroll() {
    if (!editor || !overlay) return;
    overlay.scrollTop = editor.scrollTop;
    overlay.scrollLeft = editor.scrollLeft;
  }

  function cancelPendingRender() {
    if (!renderTimer) return;
    if (renderTimerType === 'raf' && W.cancelAnimationFrame) W.cancelAnimationFrame(renderTimer);
    else clearTimeout(renderTimer);
    renderTimer = 0;
    renderTimerType = '';
  }

  function scheduleHighlight(options = {}) {
    if (!editor || !overlay || !isHighlightEnabled()) return;
    if (options.immediate) {
      cancelPendingRender();
      renderHighlight(options);
      return;
    }
    cancelPendingRender();
    const delay = compositionActive ? 80 : 0;
    if (!delay && W.requestAnimationFrame) {
      renderTimerType = 'raf';
      renderTimer = W.requestAnimationFrame(() => renderHighlight(options));
    } else {
      renderTimerType = 'timeout';
      renderTimer = setTimeout(() => renderHighlight(options), delay || 16);
    }
  }

  function renderHighlight(options = {}) {
    renderTimer = 0;
    renderTimerType = '';
    if (!editor || !overlay || !isHighlightEnabled()) { enforceDirectEditorSurface(); return; }
    const value = getEditorValue();
    if (!options.force && value === lastRenderedValue) {
      syncOverlayScroll();
      return;
    }
    // Keep the old overlay DOM visible until the new highlighted HTML is ready.
    // This prevents the editor from flashing back to a plain textarea while typing.
    const html = renderHighlightedHtml(value || '');
    overlay.innerHTML = html;
    lastRenderedValue = value;
    syncOverlayScroll();
  }

  function scheduleHighlightAfterEditorMutation() {
    scheduleHighlight({ immediate: false });
  }

  function bindStateSync() {
    if (stateSyncBound) return;
    const state = NS.State;
    if (!state || typeof state.subscribe !== 'function') return;
    stateSyncBound = true;
    try {
      state.subscribe((_snapshot, reason) => {
        if (['load', 'reset', 'active-file', 'file-create', 'file-remove', 'file-rename', 'file-import-overwrite', 'file-change'].includes(reason)) {
          setTimeout(() => {
            editor = D.getElementById('sourceEditor') || editor;
            installHighlighter();
            scheduleHighlight({ force: true, immediate: true });
          }, reason === 'file-change' ? 0 : 30);
        }
      });
    } catch (_err) {}
  }

  function normalizeKeyName(key) {
    if (key === ' ') return 'space';
    if (key === 'ArrowLeft') return 'left';
    if (key === 'ArrowRight') return 'right';
    if (key === 'ArrowUp') return 'up';
    if (key === 'ArrowDown') return 'down';
    return String(key || '').toLowerCase();
  }

  function eventToShortcut(event) {
    const parts = [];
    if (event.metaKey || event.ctrlKey) parts.push('mod');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    parts.push(normalizeKeyName(event.key));
    return parts.join('+');
  }

  function normalizeShortcut(key) {
    return String(key || '')
      .trim()
      .toLowerCase()
      .replace(/cmd|command|ctrl|control/g, 'mod')
      .replace(/\s+/g, '')
      .split('+')
      .filter(Boolean)
      .join('+');
  }

  const SHORTCUT_EXAMPLES = [
    {
      id: 'custom-bold-text',
      key: 'mod+shift+t',
      label: 'Bold text',
      mode: 'template',
      template: '\\textbf{ {{selection}} }'
    },
    {
      id: 'custom-emphasis',
      key: 'mod+shift+i',
      label: 'Emphasize text',
      mode: 'template',
      template: '\\emph{ {{selection}} }'
    },
    {
      id: 'custom-inline-math',
      key: 'mod+shift+m',
      label: 'Inline math',
      mode: 'template',
      template: '${{selection}}$'
    },
    {
      id: 'custom-equation',
      key: 'mod+shift+e',
      label: 'Equation block',
      mode: 'template',
      template: '\\begin{equation}\n{{selection}}{{cursor}}\n\\end{equation}'
    }
  ];

  const RISKY_SHORTCUTS = new Set([
    'mod+s', 'mod+r', 'mod+shift+r', 'mod+w', 'mod+q', 'mod+t', 'mod+n', 'mod+l', 'mod+p', 'mod+f', 'mod+g', 'mod+shift+g', 'mod+c', 'mod+x', 'mod+v', 'mod+a', 'mod+z', 'mod+y'
  ]);

  function safeParseShortcuts(raw) {
    const text = String(raw || '').trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.filter((item) => item && item.key && item.mode) : [];
    } catch (_err) {
      return [];
    }
  }

  function loadCustomShortcuts() {
    return safeParseShortcuts(lsGet(SHORTCUT_KEY, '[]'));
  }

  function liveManagerShortcuts() {
    const body = D.getElementById('editorShortcutRows');
    if (!body || !body.querySelector('tr')) return null;
    try {
      return shortcutsFromManagerDom();
    } catch (_err) {
      return null;
    }
  }

  function activeCustomShortcuts() {
    // Stage 18K: rows edited in the shortcut manager should work immediately.
    // Stage 18J only read localStorage, so a row could say "ready" while the
    // key handler was still using the old saved shortcuts until Save was clicked.
    const live = liveManagerShortcuts();
    return Array.isArray(live) ? live : loadCustomShortcuts();
  }

  function allShortcuts() {
    return DEFAULT_SHORTCUTS
      .concat(activeCustomShortcuts().filter((item) => item && item.enabled !== false))
      .map((item) => Object.assign({}, item, { key: normalizeShortcut(item.key) }));
  }

  function shortcutToManagerRow(item) {
    const row = Object.assign({}, item || {});
    row.key = normalizeShortcut(row.key || '');
    row.enabled = row.enabled !== false;
    if (row.mode === 'environment' || row.mode === 'environmentFromSelection') {
      row.action = 'environment';
      row.value = row.environment || '';
    } else if (row.mode === 'insert') {
      row.action = 'insert';
      row.value = row.text || '';
    } else if (row.mode === 'wrap') {
      row.action = 'template';
      row.value = String(row.before ?? '') + '{{selection}}' + String(row.after ?? '');
    } else {
      row.action = 'template';
      row.value = row.template || '{{selection}}';
    }
    row.label = row.label || '';
    return row;
  }

  function managerRowToShortcut(row) {
    const key = normalizeShortcut(row.key || '');
    const action = row.action || 'template';
    const value = String(row.value ?? '');
    const label = String(row.label || '').trim();
    const base = {
      id: row.id || `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      key,
      label: label || (action === 'environment' ? `Environment: ${value || 'theorem'}` : 'Custom shortcut'),
      enabled: row.enabled !== false
    };
    if (!key) return null;
    if (action === 'environment') return Object.assign(base, { mode: 'environment', environment: value.trim() || 'theorem' });
    if (action === 'insert') return Object.assign(base, { mode: 'insert', text: value });
    return Object.assign(base, { mode: 'template', template: value || '{{selection}}' });
  }

  function collectShortcutWarnings(customShortcuts) {
    const warnings = [];
    const seen = new Map();
    const builtIn = new Set(DEFAULT_SHORTCUTS.map((item) => normalizeShortcut(item.key)));
    for (const item of customShortcuts || []) {
      const key = normalizeShortcut(item && item.key);
      if (!key) continue;
      if (RISKY_SHORTCUTS.has(key)) warnings.push(`${key} conflicts with a common browser/app shortcut; prefer mod+shift+${key.split('+').pop()} or mod+alt+${key.split('+').pop()}.`);
      if (builtIn.has(key)) warnings.push(`${key} conflicts with a built-in Latexai editor shortcut.`);
      if (seen.has(key)) warnings.push(`${key} is assigned more than once.`);
      seen.set(key, true);
    }
    return Array.from(new Set(warnings));
  }

  function shortcutDisplay(key) {
    return String(key || '')
      .replace(/^mod\+/, 'Cmd/Ctrl+')
      .replace(/\+shift\+/g, '+Shift+')
      .replace(/\+alt\+/g, '+Alt+')
      .replace(/\[/g, '[')
      .replace(/\]/g, ']');
  }

  function currentLineRange(el) {
    const text = el.value || '';
    const start = Number(el.selectionStart || 0);
    const end = Number(el.selectionEnd || start);
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let lineEnd = text.indexOf('\n', end);
    if (lineEnd < 0) lineEnd = text.length;
    return { start: lineStart, end: lineEnd };
  }

  function selectedLineRange(el) {
    const text = el.value || '';
    const start = Number(el.selectionStart || 0);
    const end = Number(el.selectionEnd || start);
    if (end <= start) return currentLineRange(el);
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let lineEnd = text.indexOf('\n', end);
    if (lineEnd < 0) lineEnd = text.length;
    return { start: lineStart, end: lineEnd };
  }

  function notifyEditorChanged(selectStart, selectEnd) {
    if (!editor) return;
    editor.focus();
    try { editor.setSelectionRange(selectStart, selectEnd); } catch (_err) {}
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    scheduleHighlight({ force: true, immediate: true });
  }

  function envNameFromSelection(sel) {
    const raw = String(sel || '').trim();
    if (/^[A-Za-z][A-Za-z0-9*@:_-]*$/.test(raw)) return raw;
    const cleaned = raw.replace(/[^A-Za-z0-9*@:_-]+/g, '').replace(/^[^A-Za-z]+/, '');
    return cleaned || 'theorem';
  }

  function insertEnvironmentFromSelection(binding = {}) {
    if (!editor || editor.readOnly) return false;
    const text = editor.value || '';
    const start = Number(editor.selectionStart || 0);
    const end = Number(editor.selectionEnd || start);
    const selected = text.slice(start, end);
    const env = binding.environment || envNameFromSelection(selected);
    const indent = text.slice(text.lastIndexOf('\n', Math.max(0, start - 1)) + 1, start).match(/^\s*/)?.[0] || '';
    const innerIndent = indent + '  ';
    const insert = `\\begin{${env}}\n${innerIndent}\n${indent}\\end{${env}}`;
    editor.value = text.slice(0, start) + insert + text.slice(end);
    const cursor = start + `\\begin{${env}}\n${innerIndent}`.length;
    notifyEditorChanged(cursor, cursor);
    return true;
  }

  function commentSelection() {
    if (!editor || editor.readOnly) return false;
    const text = editor.value || '';
    const range = selectedLineRange(editor);
    const chunk = text.slice(range.start, range.end);
    const lines = chunk.split('\n');
    const nextChunk = lines.map((line) => line.length ? `% ${line}` : '%').join('\n');
    editor.value = text.slice(0, range.start) + nextChunk + text.slice(range.end);
    notifyEditorChanged(range.start, range.start + nextChunk.length);
    return true;
  }

  function uncommentSelection() {
    if (!editor || editor.readOnly) return false;
    const text = editor.value || '';
    const range = selectedLineRange(editor);
    const chunk = text.slice(range.start, range.end);
    const lines = chunk.split('\n');
    const nextChunk = lines.map((line) => line.replace(/^(\s*)% ?/, '$1')).join('\n');
    editor.value = text.slice(0, range.start) + nextChunk + text.slice(range.end);
    notifyEditorChanged(range.start, range.start + nextChunk.length);
    return true;
  }

  function applyWrap(binding) {
    if (!editor || editor.readOnly) return false;
    const text = editor.value || '';
    const start = Number(editor.selectionStart || 0);
    const end = Number(editor.selectionEnd || start);
    const selected = text.slice(start, end);
    const before = String(binding.before ?? '');
    const after = String(binding.after ?? '');
    const insert = before + selected + after;
    editor.value = text.slice(0, start) + insert + text.slice(end);
    const cursorStart = selected ? start : start + before.length;
    const cursorEnd = selected ? start + insert.length : cursorStart;
    notifyEditorChanged(cursorStart, cursorEnd);
    return true;
  }

  function normalizeTemplatePlaceholders(template) {
    let out = String(template ?? '{{selection}}');
    // Accept a few natural variants users type in the manager. The canonical
    // placeholders remain {{selection}} and {{cursor}}, but {selection} and
    // [[selection]] should not silently fail. Triple-brace patterns such as
    // \mathcal{{{selection}}} intentionally keep one outer brace pair around
    // the selected text after {{selection}} is replaced.
    out = out.replace(/\[\[\s*selection\s*\]\]/gi, '{{selection}}');
    out = out.replace(/\[\[\s*cursor\s*\]\]/gi, '{{cursor}}');
    out = out.replace(/(?<!\{)\{\s*selection\s*\}(?!\})/gi, '{{selection}}');
    out = out.replace(/(?<!\{)\{\s*cursor\s*\}(?!\})/gi, '{{cursor}}');
    return out;
  }

  function applyTemplate(binding) {
    if (!editor || editor.readOnly) return false;
    const text = editor.value || '';
    const start = Number(editor.selectionStart || 0);
    const end = Number(editor.selectionEnd || start);
    const selected = text.slice(start, end);
    const marker = '\uE000';
    let template = normalizeTemplatePlaceholders(binding.template ?? '{{selection}}');
    let rendered;
    if (!selected && template.includes('{{selection}}')) {
      rendered = template.replace('{{selection}}', marker).replace(/\{\{selection\}\}/g, '');
    } else {
      rendered = template.replace(/\{\{selection\}\}/g, selected);
    }
    rendered = rendered.replace(/\{\{cursor\}\}/g, marker);
    let cursorOffset = rendered.indexOf(marker);
    rendered = rendered.replaceAll(marker, '');
    if (cursorOffset < 0) cursorOffset = rendered.length;
    editor.value = text.slice(0, start) + rendered + text.slice(end);
    if (selected && !template.includes('{{cursor}}')) notifyEditorChanged(start, start + rendered.length);
    else notifyEditorChanged(start + cursorOffset, start + cursorOffset);
    return true;
  }

  function applyInsert(binding) {
    if (!editor || editor.readOnly) return false;
    const text = editor.value || '';
    const start = Number(editor.selectionStart || 0);
    const end = Number(editor.selectionEnd || start);
    const insert = String(binding.text ?? '');
    editor.value = text.slice(0, start) + insert + text.slice(end);
    const cursor = start + insert.length;
    notifyEditorChanged(cursor, cursor);
    return true;
  }

  function applyShortcut(binding) {
    switch (binding.mode) {
      case 'environmentFromSelection': return insertEnvironmentFromSelection(binding);
      case 'environment': return insertEnvironmentFromSelection(binding);
      case 'commentSelection': return commentSelection();
      case 'uncommentSelection': return uncommentSelection();
      case 'wrap': return applyWrap(binding);
      case 'template': return applyTemplate(binding);
      case 'insert': return applyInsert(binding);
      default: return false;
    }
  }

  function currentIndentBeforeCursor(el) {
    const text = el.value || '';
    const pos = Number(el.selectionStart || 0);
    const lineStart = text.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
    return text.slice(lineStart, pos).match(/^\s*/)?.[0] || '';
  }

  function handleSmartEnter(event) {
    if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey || !editor || editor.readOnly) return false;
    const text = editor.value || '';
    const start = Number(editor.selectionStart || 0);
    const end = Number(editor.selectionEnd || start);
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const beforeOnLine = text.slice(lineStart, start);
    const indent = currentIndentBeforeCursor(editor);
    const extra = /\\begin\s*\{[^}]+\}\s*$/.test(beforeOnLine) || /\{\s*$/.test(beforeOnLine) ? '  ' : '';
    const insert = '\n' + indent + extra;
    event.preventDefault();
    editor.value = text.slice(0, start) + insert + text.slice(end);
    const cursor = start + insert.length;
    notifyEditorChanged(cursor, cursor);
    return true;
  }

  function handleKeydown(event) {
    if (event.defaultPrevented || !editor || event.target !== editor) return;
    if (handleSmartEnter(event)) return;
    const shortcut = eventToShortcut(event);
    const match = allShortcuts().find((item) => item.key === shortcut);
    if (!match) return;
    event.preventDefault();
    event.stopPropagation();
    applyShortcut(match);
  }

  function builtInShortcutTableHtml() {
    return DEFAULT_SHORTCUTS.map((item) => [
      '<tr>',
      `  <td><code>${escapeHtml(shortcutDisplay(item.key))}</code></td>`,
      `  <td>${escapeHtml(item.label || item.mode)}</td>`,
      `  <td>${escapeHtml(item.description || '')}</td>`,
      '</tr>'
    ].join('')).join('');
  }

  function shortcutRowHtml(row, index) {
    const checked = row.enabled === false ? '' : 'checked';
    const action = row.action || 'template';
    return [
      `<tr class="editor-shortcut-row" data-shortcut-index="${index}">`,
      `  <td><input class="editor-shortcut-enabled" type="checkbox" ${checked} aria-label="Enable shortcut" /></td>`,
      `  <td><input class="editor-shortcut-key" type="text" value="${escapeHtml(row.key || '')}" placeholder="mod+shift+m" /></td>`,
      '  <td><select class="editor-shortcut-action">',
      `    <option value="template" ${action === 'template' ? 'selected' : ''}>Template</option>`,
      `    <option value="environment" ${action === 'environment' ? 'selected' : ''}>Environment</option>`,
      `    <option value="insert" ${action === 'insert' ? 'selected' : ''}>Insert text</option>`,
      '  </select></td>',
      `  <td><input class="editor-shortcut-label" type="text" value="${escapeHtml(row.label || '')}" placeholder="Label" /></td>`,
      `  <td><textarea class="editor-shortcut-template" spellcheck="false" placeholder="\\textbf{ {{selection}} }">${escapeHtml(row.value || '')}</textarea></td>`,
      '  <td><button class="btn mini editor-shortcut-delete" type="button">Remove</button></td>',
      '</tr>'
    ].join('');
  }

  function getManagerRowsFromDom() {
    return Array.from(D.querySelectorAll('#editorShortcutRows tr')).map((tr) => ({
      id: tr.getAttribute('data-shortcut-id') || '',
      enabled: !!tr.querySelector('.editor-shortcut-enabled')?.checked,
      key: tr.querySelector('.editor-shortcut-key')?.value || '',
      action: tr.querySelector('.editor-shortcut-action')?.value || 'template',
      label: tr.querySelector('.editor-shortcut-label')?.value || '',
      value: tr.querySelector('.editor-shortcut-template')?.value || ''
    }));
  }

  function shortcutsFromManagerDom() {
    return getManagerRowsFromDom().map(managerRowToShortcut).filter(Boolean);
  }

  function renderManagerRows(shortcuts) {
    const body = D.getElementById('editorShortcutRows');
    if (!body) return;
    const rows = (shortcuts || []).map(shortcutToManagerRow);
    body.innerHTML = rows.map(shortcutRowHtml).join('');
    body.querySelectorAll('tr').forEach((tr, index) => {
      const src = shortcuts[index] || {};
      tr.setAttribute('data-shortcut-id', src.id || '');
    });
    updateShortcutWarnings();
  }

  function updateShortcutWarnings() {
    const status = D.getElementById('editorShortcutStatus');
    if (!status) return;
    const shortcuts = shortcutsFromManagerDom();
    const warnings = collectShortcutWarnings(shortcuts);
    status.textContent = warnings.length
      ? `Warning: ${warnings.join(' ')}`
      : `${shortcuts.filter((item) => item.enabled !== false).length} custom shortcut(s) active in this page. Click Save shortcuts to persist across reloads. Built-in shortcuts remain active.`;
    status.classList.toggle('warning', warnings.length > 0);
  }

  function setShortcutStatus(text, isWarning = false) {
    const el = D.getElementById('editorShortcutStatus');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('warning', !!isWarning);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function renderSettingsCard() {
    const settings = D.getElementById('settingsTab');
    if (!settings || D.getElementById('editorShortcutSettingsCard')) return;
    const card = D.createElement('section');
    card.id = 'editorShortcutSettingsCard';
    card.className = 'editor-shortcut-settings-card backend-status-card';
    card.innerHTML = [
      '<div class="editor-shortcut-card-main">',
      '  <div class="smallcaps">Editor</div>',
      '  <strong>Editor shortcut manager</strong>',
      '  <p class="editor-shortcut-help">Stable textarea editor from Stage 18H is preserved. Use this manager to add shortcut templates without editing JSON manually. Template placeholders: <code>{{selection}}</code> and <code>{{cursor}}</code>. Example: <code>\\mathcal{{{selection}}}</code>. Avoid browser-reserved shortcuts like <code>Cmd/Ctrl+C</code>; use <code>Cmd/Ctrl+Shift+C</code> instead.</p>',
      '  <label class="field checkbox-field editor-highlight-toggle"><input id="editorSyntaxHighlightCheck" type="checkbox" /> Experimental source color overlay</label>',
      '  <details class="editor-builtins-details">',
      '    <summary>Built-in shortcuts</summary>',
      '    <table class="editor-shortcut-builtins"><thead><tr><th>Shortcut</th><th>Action</th><th>Description</th></tr></thead><tbody>',
      builtInShortcutTableHtml(),
      '    </tbody></table>',
      '  </details>',
      '  <div class="editor-shortcut-manager" role="region" aria-label="Custom editor shortcuts">',
      '    <div class="editor-shortcut-manager-head"><strong>Custom shortcuts</strong><button id="addEditorShortcutBtn" class="btn mini" type="button">+ Add shortcut</button></div>',
      '    <div class="editor-shortcut-table-scroll"><table class="editor-shortcut-table"><thead><tr><th>On</th><th>Shortcut</th><th>Action</th><th>Label</th><th>Template / environment</th><th></th></tr></thead><tbody id="editorShortcutRows"></tbody></table></div>',
      '  </div>',
      '  <div id="editorShortcutStatus" class="editor-shortcut-status">Built-in shortcuts active.</div>',
      '</div>',
      '<div class="editor-shortcut-actions">',
      '  <button id="saveEditorShortcutsBtn" class="btn mini primary" type="button">Save shortcuts</button>',
      '  <button id="resetEditorShortcutsBtn" class="btn mini" type="button">Reset custom</button>',
      '  <button id="exportEditorShortcutsBtn" class="btn mini" type="button">Export JSON</button>',
      '  <button id="importEditorShortcutsBtn" class="btn mini" type="button">Import JSON</button>',
      '  <button id="copyEditorShortcutHelpBtn" class="btn mini" type="button">Copy examples</button>',
      '</div>'
    ].join('');
    settings.appendChild(card);

    const highlightCheck = D.getElementById('editorSyntaxHighlightCheck');
    if (highlightCheck) {
      highlightCheck.checked = isHighlightEnabled();
      if (isSafariLike()) {
        highlightCheck.disabled = true;
        highlightCheck.title = 'Disabled on Safari/iPad because the textarea overlay caused unreadable text and cursor drift.';
      }
      highlightCheck.addEventListener('change', () => {
        lsSet(EXPERIMENTAL_OVERLAY_KEY, highlightCheck.checked ? '1' : '0');
        lsSet(HIGHLIGHT_KEY, highlightCheck.checked ? '1' : '0');
        installHighlighter();
        enforceDirectEditorSurface();
      });
    }

    renderManagerRows(loadCustomShortcuts());

    D.getElementById('editorShortcutRows')?.addEventListener('input', updateShortcutWarnings, true);
    D.getElementById('editorShortcutRows')?.addEventListener('change', updateShortcutWarnings, true);
    D.getElementById('editorShortcutRows')?.addEventListener('click', (event) => {
      const btn = event.target && event.target.closest && event.target.closest('.editor-shortcut-delete');
      if (!btn) return;
      btn.closest('tr')?.remove();
      updateShortcutWarnings();
    });

    D.getElementById('addEditorShortcutBtn')?.addEventListener('click', () => {
      const current = shortcutsFromManagerDom();
      const next = current.concat([{ key: 'mod+shift+c', mode: 'template', label: 'Mathcal', template: '\\mathcal{{{selection}}}' }]);
      renderManagerRows(next);
      setShortcutStatus('Added a shortcut row. Edit it, then Save shortcuts.');
    });

    D.getElementById('saveEditorShortcutsBtn')?.addEventListener('click', () => {
      const valid = shortcutsFromManagerDom();
      const warnings = collectShortcutWarnings(valid);
      lsSet(SHORTCUT_KEY, JSON.stringify(valid, null, 2));
      setShortcutStatus(
        warnings.length ? `Saved ${valid.length} shortcut(s), with warning: ${warnings.join(' ')}` : `Saved ${valid.length} custom shortcut(s).`,
        warnings.length > 0
      );
    });

    D.getElementById('resetEditorShortcutsBtn')?.addEventListener('click', () => {
      lsRemove(SHORTCUT_KEY);
      renderManagerRows([]);
      setShortcutStatus('Custom shortcuts reset. Built-in shortcuts remain active.');
    });

    D.getElementById('exportEditorShortcutsBtn')?.addEventListener('click', async () => {
      const json = JSON.stringify(shortcutsFromManagerDom(), null, 2);
      if (await copyText(json)) setShortcutStatus('Shortcut JSON copied.');
      else setShortcutStatus(json);
    });

    D.getElementById('importEditorShortcutsBtn')?.addEventListener('click', () => {
      const raw = W.prompt ? W.prompt('Paste Latexai shortcut JSON array:') : '';
      if (raw == null) return;
      const parsed = safeParseShortcuts(raw);
      if (!parsed.length && String(raw || '').trim() && String(raw || '').trim() !== '[]') {
        setShortcutStatus('Could not import shortcuts. Paste a JSON array of shortcut objects.', true);
        return;
      }
      lsSet(SHORTCUT_KEY, JSON.stringify(parsed, null, 2));
      renderManagerRows(parsed);
      setShortcutStatus(`Imported ${parsed.length} shortcut(s).`);
    });

    D.getElementById('copyEditorShortcutHelpBtn')?.addEventListener('click', async () => {
      const examples = JSON.stringify(SHORTCUT_EXAMPLES, null, 2);
      if (await copyText(examples)) setShortcutStatus('Shortcut examples copied.');
      else setShortcutStatus(examples);
    });

    updateShortcutWarnings();
  }

  function init() {
    if (initialized) return true;
    editor = D.getElementById('sourceEditor');
    if (!editor) return false;
    initialized = true;
    installHighlighter();
    editor.addEventListener('pointerdown', () => setTimeout(enforceDirectEditorSurface, 0), true);
    editor.addEventListener('mousedown', () => setTimeout(enforceDirectEditorSurface, 0), true);
    editor.addEventListener('touchstart', () => setTimeout(enforceDirectEditorSurface, 0), true);
    editor.addEventListener('beforeinput', () => { enforceDirectEditorSurface(); scheduleHighlightAfterEditorMutation(); });
    editor.addEventListener('input', () => { enforceDirectEditorSurface(); scheduleHighlightAfterEditorMutation(); });
    editor.addEventListener('paste', scheduleHighlightAfterEditorMutation);
    editor.addEventListener('cut', scheduleHighlightAfterEditorMutation);
    editor.addEventListener('compositionstart', () => { compositionActive = true; });
    editor.addEventListener('compositionend', () => { compositionActive = false; scheduleHighlight({ force: true, immediate: true }); });
    editor.addEventListener('scroll', syncOverlayScroll, { passive: true });
    editor.addEventListener('keydown', handleKeydown, true);
    editor.addEventListener('keyup', scheduleHighlightAfterEditorMutation);
    editor.addEventListener('focus', () => { enforceDirectEditorSurface(); scheduleHighlight({ force: true, immediate: true }); });
    editor.addEventListener('blur', () => { enforceDirectEditorSurface(); scheduleHighlight({ force: true, immediate: true }); });
    D.addEventListener('visibilitychange', () => scheduleHighlight({ force: true, immediate: true }));
    bindStateSync();
    // Some modules update textarea.value directly and then emit input or a state change.
    // A short startup sweep keeps the passive color layer synchronized without remounting the editor.
    [50, 250, 750, 1500].forEach((ms) => setTimeout(() => scheduleHighlight({ force: true, immediate: true }), ms));
    renderSettingsCard();
    try { console.log('[Latexai]', STAGE, 'ready'); } catch (_err) {}
    return true;
  }

  function initWhenReady() {
    if (init()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (init() || tries > 30) clearInterval(timer);
    }, 150);
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', initWhenReady, { once: true });
  else initWhenReady();

  NS.EditorEnhancementService = {
    STAGE,
    init,
    renderHighlightedHtml,
    highlightCode,
    splitComment,
    normalizeShortcut,
    DEFAULT_SHORTCUTS,
    loadCustomShortcuts,
    activeCustomShortcuts,
    applyShortcut,
    applyTemplate,
    normalizeTemplatePlaceholders,
    commentSelection,
    uncommentSelection,
    insertEnvironmentFromSelection,
    installHighlighter,
    enforceDirectEditorSurface,
    isSafariLike,
    scheduleHighlight,
    renderHighlight
  };
})();

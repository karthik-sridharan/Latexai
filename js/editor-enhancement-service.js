/* Latexai Stage 18G EditorEnhancementService
 * Stage: stage18g-editor-stability-single-surface-1
 *
 * Adds a lightweight Overleaf-like LaTeX source highlighter, smart indentation,
 * built-in LaTeX shortcuts, and an optional compact custom-shortcut editor.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage18g-editor-stability-single-surface-1';
  const SHORTCUT_KEY = 'latexai:editor-shortcuts:v1';
  const HIGHLIGHT_KEY = 'latexai:editor-syntax-highlight:v1';

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
  function isHighlightEnabled() {
    return lsGet(HIGHLIGHT_KEY, '1') !== '0';
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

    shell.classList.add('latexai-enhanced-source-shell');
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
    editor.classList.toggle('latexai-syntax-textarea', enabled);
    editor.classList.toggle('latexai-syntax-stable-single-surface', enabled);
    overlay.hidden = !enabled;
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
    if (!editor || !overlay || !isHighlightEnabled()) return;
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

  function allShortcuts() {
    return DEFAULT_SHORTCUTS.concat(loadCustomShortcuts()).map((item) => Object.assign({}, item, { key: normalizeShortcut(item.key) }));
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

  function renderSettingsCard() {
    const settings = D.getElementById('settingsTab');
    if (!settings || D.getElementById('editorShortcutSettingsCard')) return;
    const card = D.createElement('section');
    card.id = 'editorShortcutSettingsCard';
    card.className = 'editor-shortcut-settings-card backend-status-card';
    const custom = lsGet(SHORTCUT_KEY, '[\n  { "key": "mod+shift+e", "mode": "environment", "environment": "equation" },\n  { "key": "mod+shift+i", "mode": "wrap", "before": "\\\\emph{", "after": "}" }\n]');
    card.innerHTML = [
      '<div class="editor-shortcut-card-main">',
      '  <div class="smallcaps">Editor</div>',
      '  <strong>Syntax color + shortcuts</strong>',
      '  <p class="editor-shortcut-help">Built in: Cmd/Ctrl+B creates a <code>\\begin{selected}</code> block, Cmd/Ctrl+[ comments selected lines, Cmd/Ctrl+] uncomments one level.</p>',
      '  <label class="field checkbox-field editor-highlight-toggle"><input id="editorSyntaxHighlightCheck" type="checkbox" /> Colorize LaTeX source</label>',
      '  <label class="field">Custom shortcuts JSON',
      `    <textarea id="editorShortcutJson" spellcheck="false">${escapeHtml(custom)}</textarea>`,
      '  </label>',
      '  <div id="editorShortcutStatus" class="editor-shortcut-status">No custom shortcuts saved yet.</div>',
      '</div>',
      '<div class="editor-shortcut-actions">',
      '  <button id="saveEditorShortcutsBtn" class="btn mini primary" type="button">Save shortcuts</button>',
      '  <button id="resetEditorShortcutsBtn" class="btn mini" type="button">Reset</button>',
      '  <button id="copyEditorShortcutHelpBtn" class="btn mini" type="button">Copy examples</button>',
      '</div>'
    ].join('');
    settings.appendChild(card);

    const highlightCheck = D.getElementById('editorSyntaxHighlightCheck');
    if (highlightCheck) {
      highlightCheck.checked = isHighlightEnabled();
      highlightCheck.addEventListener('change', () => {
        lsSet(HIGHLIGHT_KEY, highlightCheck.checked ? '1' : '0');
        installHighlighter();
      });
    }

    const setStatus = (text) => {
      const el = D.getElementById('editorShortcutStatus');
      if (el) el.textContent = text;
    };

    D.getElementById('saveEditorShortcutsBtn')?.addEventListener('click', () => {
      const raw = D.getElementById('editorShortcutJson')?.value || '';
      try {
        const parsed = JSON.parse(raw || '[]');
        if (!Array.isArray(parsed)) throw new Error('Shortcut JSON must be an array.');
        const valid = parsed.filter((item) => item && item.key && item.mode);
        lsSet(SHORTCUT_KEY, JSON.stringify(valid, null, 2));
        setStatus(`Saved ${valid.length} custom shortcut(s).`);
      } catch (err) {
        setStatus(`Could not save shortcuts: ${err && (err.message || err)}`);
      }
    });

    D.getElementById('resetEditorShortcutsBtn')?.addEventListener('click', () => {
      lsRemove(SHORTCUT_KEY);
      const input = D.getElementById('editorShortcutJson');
      if (input) input.value = '[]';
      setStatus('Custom shortcuts reset. Built-in shortcuts remain active.');
    });

    D.getElementById('copyEditorShortcutHelpBtn')?.addEventListener('click', async () => {
      const examples = JSON.stringify([
        { key: 'mod+shift+t', mode: 'environment', environment: 'theorem' },
        { key: 'mod+shift+p', mode: 'environment', environment: 'proof' },
        { key: 'mod+shift+i', mode: 'wrap', before: '\\emph{', after: '}' },
        { key: 'mod+shift+m', mode: 'wrap', before: '$', after: '$' }
      ], null, 2);
      try {
        await navigator.clipboard.writeText(examples);
        setStatus('Shortcut examples copied.');
      } catch (_err) {
        setStatus(examples);
      }
    });

    const count = loadCustomShortcuts().length;
    setStatus(count ? `${count} custom shortcut(s) loaded.` : 'Built-in shortcuts active. Add custom JSON only if needed.');
  }

  function init() {
    if (initialized) return true;
    editor = D.getElementById('sourceEditor');
    if (!editor) return false;
    initialized = true;
    installHighlighter();
    editor.addEventListener('beforeinput', scheduleHighlightAfterEditorMutation);
    editor.addEventListener('input', scheduleHighlightAfterEditorMutation);
    editor.addEventListener('paste', scheduleHighlightAfterEditorMutation);
    editor.addEventListener('cut', scheduleHighlightAfterEditorMutation);
    editor.addEventListener('compositionstart', () => { compositionActive = true; });
    editor.addEventListener('compositionend', () => { compositionActive = false; scheduleHighlight({ force: true, immediate: true }); });
    editor.addEventListener('scroll', syncOverlayScroll, { passive: true });
    editor.addEventListener('keydown', handleKeydown, true);
    editor.addEventListener('keyup', scheduleHighlightAfterEditorMutation);
    editor.addEventListener('focus', () => scheduleHighlight({ force: true, immediate: true }));
    editor.addEventListener('blur', () => scheduleHighlight({ force: true, immediate: true }));
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
    applyShortcut,
    commentSelection,
    uncommentSelection,
    insertEnvironmentFromSelection,
    installHighlighter,
    scheduleHighlight,
    renderHighlight
  };
})();

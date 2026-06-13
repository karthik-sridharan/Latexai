/* Latexai Diff Viewer Service
 * Stage: stage19w57-diff-viewer-1
 *
 * Adds a right-panel "Edits" tab that lists all \laiold{OLD}\lai{NEW} edit
 * pairs from the active document with per-block Accept / Reject buttons,
 * plus Accept All / Reject All bulk actions.
 *
 * Depends on NS.State (state.js).  No external libraries.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19w57-diff-viewer-1';

  // ── DOM helpers ────────────────────────────────────────────────────────────

  function el(id) { return D.getElementById(id); }

  function State() { return NS.State; }

  // ── Path / file helpers ────────────────────────────────────────────────────

  function normalizePath(path) {
    try { return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
    catch (_err) { return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
  }

  function getActiveFile() {
    const state = State()?.state;
    if (!state) return null;
    const project = state.project || {};
    const files = Array.isArray(project.files) ? project.files : [];

    // Prefer activePath (the file currently open in the editor)
    const activePath = normalizePath(
      project.activePath ||
      project.activeFilePath ||
      project.rootFile ||
      'main.tex'
    );

    let file = files.find((f) => normalizePath(f.path || f.name || '') === activePath);
    if (!file && files.length) file = files[0];
    return file || null;
  }

  function fileText(file) {
    if (!file) return '';
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  // ── LaTeX macro parser ─────────────────────────────────────────────────────
  // Counts brace depth, handles escaped braces, supports nested macros.

  function isMacroBoundary(text, index, macro) {
    if (!text.startsWith(`\\${macro}`, index)) return false;
    const next = text[index + macro.length + 1] || '';
    return !/[A-Za-z@]/.test(next);
  }

  function skipSpaces(text, index) {
    let i = index;
    while (i < text.length && /\s/.test(text[i])) i += 1;
    return i;
  }

  function parseBrace(text, openIndex) {
    if (text[openIndex] !== '{') return null;
    let depth = 0;
    let escaped = false;
    for (let i = openIndex; i < text.length; i += 1) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return { start: openIndex, end: i + 1, content: text.slice(openIndex + 1, i) };
      }
    }
    return null;
  }

  function parseMacroAt(text, index, macro) {
    if (!isMacroBoundary(text, index, macro)) return null;
    const open = skipSpaces(text, index + macro.length + 1);
    const parsed = parseBrace(text, open);
    if (!parsed) return null;
    return { macro, start: index, end: parsed.end, content: parsed.content, raw: text.slice(index, parsed.end) };
  }

  /**
   * Scan text for \laiold{OLD}\lai{NEW}, \lai{NEW} (insertion), or
   * \laiold{OLD} (deletion) blocks.
   *
   * Returns array of edit objects:
   *   { kind: 'replace'|'insert'|'delete', raw, oldText, newText, line }
   */
  function parseEdits(text) {
    const edits = [];
    let i = 0;
    while (i < text.length) {
      // Try \laiold first
      const oldMacro = parseMacroAt(text, i, 'laiold');
      if (oldMacro) {
        const afterOld = skipSpaces(text, oldMacro.end);
        const newMacro = parseMacroAt(text, afterOld, 'lai');
        if (newMacro) {
          // Replace: \laiold{OLD}\lai{NEW}
          edits.push({
            kind: 'replace',
            raw: text.slice(oldMacro.start, newMacro.end),
            oldText: oldMacro.content,
            newText: newMacro.content,
            line: text.slice(0, oldMacro.start).split(/\n/).length
          });
          i = newMacro.end;
          continue;
        }
        // Deletion: \laiold{OLD} with no following \lai
        edits.push({
          kind: 'delete',
          raw: oldMacro.raw,
          oldText: oldMacro.content,
          newText: '',
          line: text.slice(0, oldMacro.start).split(/\n/).length
        });
        i = oldMacro.end;
        continue;
      }

      // Try \lai (insertion — no preceding \laiold)
      const newMacro = parseMacroAt(text, i, 'lai');
      if (newMacro) {
        edits.push({
          kind: 'insert',
          raw: newMacro.raw,
          oldText: '',
          newText: newMacro.content,
          line: text.slice(0, newMacro.start).split(/\n/).length
        });
        i = newMacro.end;
        continue;
      }

      i += 1;
    }
    return edits;
  }

  // ── Apply edit ─────────────────────────────────────────────────────────────

  function applyEdit(edit, keepNew) {
    const file = getActiveFile();
    if (!file) return;
    const text = fileText(file);
    const replacement = keepNew ? edit.newText : edit.oldText;
    const idx = text.indexOf(edit.raw);
    if (idx === -1) { render(); return; } // already gone — just re-render
    const newText = text.slice(0, idx) + replacement + text.slice(idx + edit.raw.length);
    State()?.updateActiveText?.(newText);
    // subscribe callback will trigger re-render
  }

  function applyAll(keepNew) {
    const file = getActiveFile();
    if (!file) return;
    let text = fileText(file);
    // Parse and apply all edits sequentially.
    // We re-parse after each substitution because positions shift.
    let edits = parseEdits(text);
    while (edits.length) {
      const edit = edits[0];
      const replacement = keepNew ? edit.newText : edit.oldText;
      const idx = text.indexOf(edit.raw);
      if (idx === -1) break;
      text = text.slice(0, idx) + replacement + text.slice(idx + edit.raw.length);
      edits = parseEdits(text);
    }
    State()?.updateActiveText?.(text);
  }

  // ── Styles (inline) ────────────────────────────────────────────────────────

  const STYLE_OLD = [
    'background:#fee2e2',
    'color:#991b1b',
    'text-decoration:line-through',
    'padding:4px 6px',
    'border-radius:4px',
    'font-family:monospace',
    'font-size:12px',
    'white-space:pre-wrap',
    'display:block',
    'margin-bottom:4px'
  ].join(';');

  const STYLE_NEW = [
    'background:#dcfce7',
    'color:#166534',
    'padding:4px 6px',
    'border-radius:4px',
    'font-family:monospace',
    'font-size:12px',
    'white-space:pre-wrap',
    'display:block',
    'margin-bottom:4px'
  ].join(';');

  const STYLE_CARD = [
    'border:1px solid #e5e7eb',
    'border-radius:6px',
    'padding:10px 12px',
    'margin-bottom:10px',
    'background:#fff'
  ].join(';');

  const STYLE_HEADER = [
    'font-size:11px',
    'font-weight:600',
    'color:#6b7280',
    'letter-spacing:0.05em',
    'text-transform:uppercase',
    'margin-bottom:8px',
    'display:flex',
    'justify-content:space-between',
    'align-items:center'
  ].join(';');

  const STYLE_BTN_BASE = [
    'border:none',
    'border-radius:4px',
    'padding:4px 10px',
    'font-size:12px',
    'cursor:pointer',
    'font-weight:500'
  ].join(';');

  const STYLE_BTN_ACCEPT = STYLE_BTN_BASE + ';background:#16a34a;color:#fff;margin-right:6px;';
  const STYLE_BTN_REJECT = STYLE_BTN_BASE + ';background:#dc2626;color:#fff;';
  const STYLE_BTN_BULK   = STYLE_BTN_BASE + ';background:#f3f4f6;color:#374151;border:1px solid #d1d5db;margin-right:6px;';

  // ── Render ─────────────────────────────────────────────────────────────────

  function render() {
    const container = el('laiDiffViewerList');
    const badge     = el('editsTabBadge');
    if (!container) return;

    const file  = getActiveFile();
    const text  = fileText(file);
    const edits = parseEdits(text);

    // Update badge
    if (badge) {
      if (edits.length) {
        badge.textContent = String(edits.length);
        badge.style.cssText = [
          'display:inline-block',
          'background:#dc2626',
          'color:#fff',
          'border-radius:9999px',
          'padding:0 6px',
          'font-size:10px',
          'font-weight:700',
          'margin-left:4px',
          'line-height:16px',
          'vertical-align:middle'
        ].join(';');
      } else {
        badge.textContent = '';
        badge.style.cssText = 'display:none';
      }
    }

    // Bulk action bar
    const bulkBar = el('laiDiffViewerBulkBar');
    if (bulkBar) {
      bulkBar.style.display = edits.length ? 'flex' : 'none';
    }

    if (!edits.length) {
      container.innerHTML = '<p style="color:#6b7280;font-size:13px;padding:12px 0;">No AI edits found in this document.</p>';
      return;
    }

    // Build cards
    const frag = D.createDocumentFragment();

    edits.forEach((edit, idx) => {
      const card = D.createElement('div');
      card.style.cssText = STYLE_CARD;

      // Header row
      const header = D.createElement('div');
      header.style.cssText = STYLE_HEADER;

      const title = D.createElement('span');
      const kindLabel = edit.kind === 'replace' ? 'Replace'
        : edit.kind === 'insert' ? 'Insert'
        : 'Delete';
      title.textContent = `Edit ${idx + 1} — ${kindLabel}  (line ${edit.line})`;

      const btnRow = D.createElement('span');

      const acceptBtn = D.createElement('button');
      acceptBtn.type = 'button';
      acceptBtn.textContent = 'Accept ✓';
      acceptBtn.style.cssText = STYLE_BTN_ACCEPT;
      acceptBtn.addEventListener('click', () => applyEdit(edit, true));

      const rejectBtn = D.createElement('button');
      rejectBtn.type = 'button';
      rejectBtn.textContent = 'Reject ✗';
      rejectBtn.style.cssText = STYLE_BTN_REJECT;
      rejectBtn.addEventListener('click', () => applyEdit(edit, false));

      btnRow.appendChild(acceptBtn);
      btnRow.appendChild(rejectBtn);

      header.appendChild(title);
      header.appendChild(btnRow);
      card.appendChild(header);

      // Old text row
      if (edit.kind !== 'insert') {
        const oldEl = D.createElement('span');
        oldEl.style.cssText = STYLE_OLD;
        oldEl.textContent = edit.oldText || '​'; // zero-width space placeholder if empty
        card.appendChild(oldEl);
      }

      // New text row
      if (edit.kind !== 'delete') {
        const newEl = D.createElement('span');
        newEl.style.cssText = STYLE_NEW;
        newEl.textContent = edit.newText || '​';
        card.appendChild(newEl);
      }

      frag.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(frag);
  }

  // ── DOM injection ──────────────────────────────────────────────────────────

  function injectUI() {
    // 1. Tab button
    const tabList = D.querySelector('.right-tabs');
    if (tabList && !el('editsTabBtn')) {
      const btn = D.createElement('button');
      btn.id = 'editsTabBtn';
      btn.className = 'right-tab';
      btn.type = 'button';
      btn.dataset.rightTab = 'edits';

      btn.innerHTML = 'Edits <span id="editsTabBadge" style="display:none"></span>';
      tabList.appendChild(btn);
    }

    // 2. Panel section (sibling of #previewTab / #logsTab)
    if (!el('editsTab')) {
      const section = D.createElement('section');
      section.id = 'editsTab';
      section.className = 'right-tab-panel';
      section.style.cssText = 'overflow-y:auto;padding:12px 14px;box-sizing:border-box;height:100%;';

      // Section head
      const head = D.createElement('div');
      head.style.cssText = 'margin-bottom:12px;';

      const smallcaps = D.createElement('div');
      smallcaps.className = 'smallcaps';
      smallcaps.textContent = 'AI Edits';

      const h2 = D.createElement('h2');
      h2.textContent = 'Review Changes';
      h2.style.cssText = 'margin:2px 0 8px;font-size:15px;';

      head.appendChild(smallcaps);
      head.appendChild(h2);

      // Bulk action bar
      const bulkBar = D.createElement('div');
      bulkBar.id = 'laiDiffViewerBulkBar';
      bulkBar.style.cssText = 'display:none;flex-direction:row;align-items:center;margin-bottom:12px;gap:4px;';

      const acceptAllBtn = D.createElement('button');
      acceptAllBtn.type = 'button';
      acceptAllBtn.textContent = 'Accept All';
      acceptAllBtn.style.cssText = STYLE_BTN_BULK + ';background:#16a34a;color:#fff;border:none;';
      acceptAllBtn.addEventListener('click', () => applyAll(true));

      const rejectAllBtn = D.createElement('button');
      rejectAllBtn.type = 'button';
      rejectAllBtn.textContent = 'Reject All';
      rejectAllBtn.style.cssText = STYLE_BTN_BULK + ';background:#dc2626;color:#fff;border:none;';
      rejectAllBtn.addEventListener('click', () => applyAll(false));

      bulkBar.appendChild(acceptAllBtn);
      bulkBar.appendChild(rejectAllBtn);

      // Edit list container
      const list = D.createElement('div');
      list.id = 'laiDiffViewerList';

      section.appendChild(head);
      section.appendChild(bulkBar);
      section.appendChild(list);

      // Insert alongside existing right-panel sections
      const preview = el('previewTab');
      if (preview && preview.parentNode) {
        preview.parentNode.appendChild(section);
      } else {
        // Fallback: append to .right-panel
        const rightPanel = D.querySelector('.right-panel');
        if (rightPanel) rightPanel.appendChild(section);
      }
    }
  }

  // ── Subscription & init ────────────────────────────────────────────────────

  let _subscribed = false;

  function subscribeToState() {
    if (_subscribed) return;
    const state = State();
    if (!state?.subscribe) return;
    _subscribed = true;
    state.subscribe((_snapshot, reason) => {
      // Re-render on any file content change
      if (!reason || [
        'file-update', 'file-add', 'file-delete', 'load', 'reset',
        'save', 'active-file', 'update-active-text', 'patch-apply'
      ].includes(reason)) {
        render();
      }
    });
  }

  function init() {
    injectUI();
    render();
    subscribeToState();
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already ready — defer slightly so other services that
    // set up NS.State have had a chance to run.
    setTimeout(init, 0);
  }

  // Retry subscription after a short delay in case NS.State was not yet
  // registered when init() ran (deferred script ordering).
  setTimeout(() => {
    if (!_subscribed) {
      subscribeToState();
      render();
    }
  }, 800);

  NS.LaiDiffViewerService = { STAGE, init, render, parseEdits };
})();

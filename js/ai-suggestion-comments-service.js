/* Latexai Stage 16F AiSuggestionCommentsService
 * Stage: stage16f-ai-suggestion-comments-1
 *
 * AI suggestion comments / lightweight collaboration loop.
 *
 * Local-first workflow:
 * - comments can be anchored to the active file, selected text, active line,
 *   or detected \lai / \laiold suggestion blocks;
 * - each comment has author, type, status, priority, and body;
 * - comments can be resolved/reopened/deleted;
 * - comments can be exported/imported as JSON for coauthor exchange;
 * - a Markdown report can be copied or added under /reviews.
 *
 * This service is local-only: no AI calls and no compile jobs.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage16f-ai-suggestion-comments-1';
  const STORAGE_KEY = 'latexai:ai-suggestion-comments:v1';
  const AUTHOR_KEY = 'latexai:ai-suggestion-comments:author';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('ai-suggestion-comments-service')) {
    NS.AiSuggestionCommentsService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false,
      getComments: () => []
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  let lastReport = '';

  function State() { return NS.State; }
  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }

  function normalizePath(path) {
    try { return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
    catch (_err) { return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
  }

  function project() {
    return State()?.state?.project || {};
  }

  function projectFiles() {
    return Array.isArray(project().files) ? project().files : [];
  }

  function fileText(file) {
    if (!file) return '';
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function getFile(path) {
    const normalized = normalizePath(path);
    try {
      const found = State()?.getFile?.(normalized);
      if (found) return found;
    } catch (_err) {}
    return projectFiles().find((file) => normalizePath(file.path) === normalized) || null;
  }

  function activePath() {
    const candidates = [
      State()?.state?.activePath,
      State()?.state?.activeFilePath,
      State()?.state?.currentPath,
      project()?.activePath,
      project()?.activeFilePath,
      project()?.rootFile,
      clean(el('activeFilePill')?.textContent)
    ];
    for (const candidate of candidates) if (candidate) return normalizePath(candidate);
    return 'main.tex';
  }

  function activeSource() {
    const path = activePath();
    const editorText = String(el('sourceEditor')?.value || '');
    const file = getFile(path);
    const text = editorText || fileText(file);
    return { path, file, text };
  }

  function selectionInfo() {
    const editor = el('sourceEditor');
    const active = activeSource();
    if (!editor || typeof editor.selectionStart !== 'number') {
      return { start: null, end: null, selectedText: '', line: 1 };
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.slice(start, end);
    const line = editor.value.slice(0, start).split(/\n/).length;
    return { start, end, selectedText, line };
  }

  function readStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        schema: 'latexai-ai-suggestion-comments-store-v1',
        comments: Array.isArray(parsed.comments) ? parsed.comments : []
      };
    } catch (_err) {
      return { schema: 'latexai-ai-suggestion-comments-store-v1', comments: [] };
    }
  }

  function writeStore(store) {
    const comments = (store.comments || []).slice(0, 500);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: 'latexai-ai-suggestion-comments-store-v1', comments })); } catch (_err) {}
    return { schema: 'latexai-ai-suggestion-comments-store-v1', comments };
  }

  function getComments(filter = {}) {
    let comments = readStore().comments;
    if (filter.path) {
      const path = normalizePath(filter.path);
      comments = comments.filter((comment) => normalizePath(comment.anchor?.path || '') === path);
    }
    if (filter.status && filter.status !== 'all') comments = comments.filter((comment) => comment.status === filter.status);
    if (filter.type && filter.type !== 'all') comments = comments.filter((comment) => comment.type === filter.type);
    return comments;
  }

  function saveAuthor(value) {
    try { localStorage.setItem(AUTHOR_KEY, clean(value)); } catch (_err) {}
  }

  function getAuthor() {
    try { return clean(localStorage.getItem(AUTHOR_KEY)) || 'Developer'; } catch (_err) { return 'Developer'; }
  }

  function linePreview(text, line, radius = 2) {
    const lines = String(text || '').split(/\r?\n/);
    const idx = Math.max(0, Number(line || 1) - 1);
    const start = Math.max(0, idx - radius);
    const end = Math.min(lines.length, idx + radius + 1);
    return lines.slice(start, end).map((value, offset) => `${start + offset + 1}: ${value}`).join('\n');
  }

  function short(value, n = 180) {
    const s = String(value || '').replace(/\s+/g, ' ').trim();
    return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
  }

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
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
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

  function scanSuggestionBlocks(text) {
    const suggestions = [];
    let i = 0;
    while (i < text.length) {
      const oldMacro = parseMacroAt(text, i, 'laiold');
      if (oldMacro) {
        const afterOld = skipSpaces(text, oldMacro.end);
        const newMacro = parseMacroAt(text, afterOld, 'lai');
        if (newMacro) {
          suggestions.push({
            id: `suggestion-${suggestions.length + 1}`,
            kind: 'laiold+lai',
            start: oldMacro.start,
            end: newMacro.end,
            line: text.slice(0, oldMacro.start).split(/\n/).length,
            preview: `OLD: ${short(oldMacro.content, 90)} | NEW: ${short(newMacro.content, 90)}`
          });
          i = newMacro.end;
          continue;
        }
        suggestions.push({
          id: `suggestion-${suggestions.length + 1}`,
          kind: 'laiold',
          start: oldMacro.start,
          end: oldMacro.end,
          line: text.slice(0, oldMacro.start).split(/\n/).length,
          preview: short(oldMacro.content, 180)
        });
        i = oldMacro.end;
        continue;
      }

      const newMacro = parseMacroAt(text, i, 'lai');
      if (newMacro) {
        suggestions.push({
          id: `suggestion-${suggestions.length + 1}`,
          kind: 'lai',
          start: newMacro.start,
          end: newMacro.end,
          line: text.slice(0, newMacro.start).split(/\n/).length,
          preview: short(newMacro.content, 180)
        });
        i = newMacro.end;
        continue;
      }

      i += 1;
    }
    return suggestions;
  }

  function currentAnchor() {
    const active = activeSource();
    const sel = selectionInfo();
    const selectedAnchor = clean(el('aiCommentAnchorSelect')?.value || 'selection-or-line');
    const suggestions = scanSuggestionBlocks(active.text);
    const suggestion = suggestions.find((item) => item.id === selectedAnchor);

    if (suggestion) {
      return {
        kind: 'ai-suggestion-block',
        path: active.path,
        line: suggestion.line,
        start: suggestion.start,
        end: suggestion.end,
        selectedText: suggestion.preview,
        suggestionId: suggestion.id,
        suggestionKind: suggestion.kind,
        context: linePreview(active.text, suggestion.line, 2)
      };
    }

    return {
      kind: sel.selectedText ? 'selection' : 'line',
      path: active.path,
      line: sel.line,
      start: sel.start,
      end: sel.end,
      selectedText: sel.selectedText ? short(sel.selectedText, 500) : '',
      context: linePreview(active.text, sel.line, 2)
    };
  }

  function addComment(data = {}) {
    const author = clean(data.author || el('aiCommentAuthor')?.value || getAuthor() || 'Developer');
    saveAuthor(author);

    const comment = {
      schema: 'latexai-ai-suggestion-comment-v1',
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      stage: STAGE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author,
      type: clean(data.type || el('aiCommentType')?.value || 'note'),
      priority: clean(data.priority || el('aiCommentPriority')?.value || 'normal'),
      status: clean(data.status || 'open'),
      body: clean(data.body || el('aiCommentBody')?.value),
      anchor: data.anchor || currentAnchor()
    };

    if (!comment.body) {
      setStatus('Write a comment before adding it.');
      return null;
    }

    const store = readStore();
    store.comments.unshift(comment);
    writeStore(store);
    if (el('aiCommentBody')) el('aiCommentBody').value = '';
    renderComments();
    setStatus(`Added comment on ${comment.anchor.path}:${comment.anchor.line}.`);
    return comment;
  }

  function updateComment(id, patch = {}) {
    const store = readStore();
    const idx = store.comments.findIndex((comment) => comment.id === id);
    if (idx < 0) return null;
    store.comments[idx] = { ...store.comments[idx], ...patch, updatedAt: new Date().toISOString() };
    writeStore(store);
    renderComments();
    return store.comments[idx];
  }

  function resolveComment(id) {
    const comment = updateComment(id, { status: 'resolved' });
    setStatus(comment ? 'Comment resolved.' : 'Comment not found.');
  }

  function reopenComment(id) {
    const comment = updateComment(id, { status: 'open' });
    setStatus(comment ? 'Comment reopened.' : 'Comment not found.');
  }

  function deleteComment(id) {
    const store = readStore();
    const before = store.comments.length;
    store.comments = store.comments.filter((comment) => comment.id !== id);
    writeStore(store);
    renderComments();
    setStatus(before === store.comments.length ? 'Comment not found.' : 'Comment deleted.');
  }

  function visibleFilter() {
    return {
      path: el('aiCommentOnlyActiveFile')?.checked ? activePath() : '',
      status: clean(el('aiCommentStatusFilter')?.value || 'all'),
      type: clean(el('aiCommentTypeFilter')?.value || 'all')
    };
  }

  function commentReport(comments = getComments(visibleFilter())) {
    const byStatus = comments.reduce((acc, comment) => {
      acc[comment.status] = (acc[comment.status] || 0) + 1;
      return acc;
    }, {});
    const byType = comments.reduce((acc, comment) => {
      acc[comment.type] = (acc[comment.type] || 0) + 1;
      return acc;
    }, {});

    const lines = [
      'Latexai AI suggestion comments',
      '==============================',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Comments shown: ${comments.length}`,
      `Open: ${byStatus.open || 0}`,
      `Resolved: ${byStatus.resolved || 0}`,
      '',
      'By type',
      '-------'
    ];

    Object.keys(byType).sort().forEach((type) => lines.push(`- ${type}: ${byType[type]}`));
    if (!Object.keys(byType).length) lines.push('- none');

    lines.push('', 'Comments', '--------');

    for (const comment of comments) {
      lines.push(`- ${comment.id} · ${comment.status} · ${comment.type} · ${comment.priority}`);
      lines.push(`  Author: ${comment.author}`);
      lines.push(`  Anchor: ${comment.anchor?.path || '(unknown)'}:${comment.anchor?.line || '?'}`);
      if (comment.anchor?.suggestionId) lines.push(`  Suggestion: ${comment.anchor.suggestionId} (${comment.anchor.suggestionKind})`);
      if (comment.anchor?.selectedText) lines.push(`  Selected: ${comment.anchor.selectedText}`);
      lines.push(`  Comment: ${comment.body}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  function copyCommentsReport() {
    const text = commentReport();
    lastReport = text;
    setOutput(text);
    try {
      navigator.clipboard.writeText(text).then(() => setStatus('Comment report copied.')).catch(() => setStatus('Could not copy automatically. Report shown below.'));
    } catch (_err) {
      setStatus('Could not copy automatically. Report shown below.');
    }
  }

  function writeCommentsReportToProject() {
    const text = lastReport || commentReport();
    const date = new Date().toISOString().slice(0, 10);
    const path = normalizePath(`reviews/ai-suggestion-comments-${date}.md`);
    const p = project();
    p.files = p.files || [];
    const existing = p.files.find((file) => normalizePath(file.path) === path);
    if (existing) existing.text = text + '\n';
    else p.files.push({ path, text: text + '\n', kind: 'text' });
    try { State()?.save?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    setStatus(`Added comments report to ${path}.`);
    return path;
  }

  function exportCommentsJson() {
    const data = JSON.stringify(readStore(), null, 2);
    const blob = new Blob([data + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = D.createElement('a');
    a.href = url;
    a.download = `latexai-ai-comments-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    D.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Comments JSON exported.');
  }

  function importCommentsJsonText(text) {
    let parsed;
    try { parsed = JSON.parse(String(text || '{}')); }
    catch (_err) {
      setStatus('Import failed: invalid JSON.');
      return false;
    }

    const incoming = Array.isArray(parsed.comments) ? parsed.comments : [];
    if (!incoming.length) {
      setStatus('Import found no comments.');
      return false;
    }

    const store = readStore();
    const existing = new Set(store.comments.map((comment) => comment.id));
    let added = 0;
    for (const comment of incoming) {
      if (!comment?.id || existing.has(comment.id)) continue;
      store.comments.push(comment);
      existing.add(comment.id);
      added += 1;
    }
    writeStore(store);
    renderComments();
    setStatus(`Imported ${added} new comment(s).`);
    return true;
  }

  function importFromTextarea() {
    const text = el('aiCommentImportBox')?.value || '';
    return importCommentsJsonText(text);
  }

  function refreshSuggestionAnchors() {
    const select = el('aiCommentAnchorSelect');
    if (!select) return;

    const active = activeSource();
    const suggestions = scanSuggestionBlocks(active.text);
    const current = select.value;
    const options = [
      '<option value="selection-or-line">Current selection / active line</option>',
      ...suggestions.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} · line ${item.line} · ${escapeHtml(item.kind)} · ${escapeHtml(item.preview)}</option>`)
    ];
    select.innerHTML = options.join('');
    if (current && Array.from(select.options).some((option) => option.value === current)) select.value = current;

    const note = el('aiCommentSuggestionCount');
    if (note) note.textContent = `${suggestions.length} detected \\lai / \\laiold suggestion block(s) in active file.`;
  }

  function commentsHtml(comments) {
    if (!comments.length) return '<div class="ai-comments-empty">No comments match the current filters.</div>';
    return comments.map((comment) => [
      `<div class="ai-comment-row" data-comment-id="${escapeHtml(comment.id)}">`,
      '  <div class="ai-comment-head">',
      `    <strong>${escapeHtml(comment.type)} · ${escapeHtml(comment.priority)}</strong>`,
      `    <span>${escapeHtml(comment.status)}</span>`,
      '  </div>',
      `  <div class="ai-comment-meta">${escapeHtml(comment.author)} · ${escapeHtml(comment.createdAt)} · ${escapeHtml(comment.anchor?.path || '')}:${escapeHtml(comment.anchor?.line || '?')}</div>`,
      comment.anchor?.selectedText ? `<div class="ai-comment-selected">${escapeHtml(comment.anchor.selectedText)}</div>` : '',
      `<div class="ai-comment-body">${escapeHtml(comment.body)}</div>`,
      '  <div class="ai-comment-actions">',
      `    <button class="btn mini" type="button" data-ai-comment-resolve="${escapeHtml(comment.id)}">Resolve</button>`,
      `    <button class="btn mini" type="button" data-ai-comment-reopen="${escapeHtml(comment.id)}">Reopen</button>`,
      `    <button class="btn mini" type="button" data-ai-comment-delete="${escapeHtml(comment.id)}">Delete</button>`,
      '  </div>',
      '</div>'
    ].join('')).join('');
  }

  function renderComments() {
    refreshSuggestionAnchors();
    const comments = getComments(visibleFilter());
    const list = el('aiCommentsList');
    if (list) list.innerHTML = commentsHtml(comments);

    const count = el('aiCommentsCount');
    if (count) {
      const all = readStore().comments;
      const open = all.filter((comment) => comment.status === 'open').length;
      count.textContent = `${all.length} total comment(s), ${open} open. Showing ${comments.length}.`;
    }

    D.querySelectorAll('[data-ai-comment-resolve]').forEach((btn) => {
      btn.onclick = () => resolveComment(btn.dataset.aiCommentResolve);
    });
    D.querySelectorAll('[data-ai-comment-reopen]').forEach((btn) => {
      btn.onclick = () => reopenComment(btn.dataset.aiCommentReopen);
    });
    D.querySelectorAll('[data-ai-comment-delete]').forEach((btn) => {
      btn.onclick = () => deleteComment(btn.dataset.aiCommentDelete);
    });
  }

  function setStatus(message) {
    const node = el('aiCommentsStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const out = el('aiCommentsOutput');
    if (out) {
      out.classList.add('active');
      out.textContent = String(text || '');
    }
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function createCard() {
    const panel = el('copilotTab') || el('settingsTab') || D.querySelector('.right-panel');
    if (!panel || el('aiCommentsCard')) return false;

    const card = D.createElement('div');
    card.id = 'aiCommentsCard';
    card.className = 'ai-comments-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Comments</div>',
      '    <h2>AI suggestion comments</h2>',
      '  </div>',
      '</div>',
      '<p class="ai-comments-help">Annotate AI suggestions, selected text, or active lines. Export/import JSON to exchange comments with coauthors.</p>',
      '<div class="ai-comments-grid">',
      '  <label class="field">Author',
      `    <input id="aiCommentAuthor" type="text" value="${escapeHtml(getAuthor())}" />`,
      '  </label>',
      '  <label class="field">Anchor',
      '    <select id="aiCommentAnchorSelect"></select>',
      '  </label>',
      '</div>',
      '<div id="aiCommentSuggestionCount" class="ai-comment-suggestion-count">0 detected suggestion blocks.</div>',
      '<div class="ai-comments-grid three">',
      '  <label class="field">Type',
      '    <select id="aiCommentType">',
      '      <option value="note">note</option>',
      '      <option value="question">question</option>',
      '      <option value="approve">approve</option>',
      '      <option value="reject">reject</option>',
      '      <option value="todo">todo</option>',
      '    </select>',
      '  </label>',
      '  <label class="field">Priority',
      '    <select id="aiCommentPriority">',
      '      <option value="normal">normal</option>',
      '      <option value="high">high</option>',
      '      <option value="low">low</option>',
      '    </select>',
      '  </label>',
      '  <label class="field">Status filter',
      '    <select id="aiCommentStatusFilter">',
      '      <option value="all">all</option>',
      '      <option value="open">open</option>',
      '      <option value="resolved">resolved</option>',
      '    </select>',
      '  </label>',
      '</div>',
      '<label class="field">Comment',
      '  <textarea id="aiCommentBody" rows="3" placeholder="Comment on the selected AI suggestion or active line."></textarea>',
      '</label>',
      '<label class="ai-comment-check"><input id="aiCommentOnlyActiveFile" type="checkbox" checked /> Show only active file comments</label>',
      '<div class="ai-comments-actions">',
      '  <button id="addAiCommentBtn" class="btn mini primary" type="button">Add comment</button>',
      '  <button id="refreshAiCommentsBtn" class="btn mini" type="button">Refresh comments</button>',
      '  <button id="copyAiCommentsReportBtn" class="btn mini" type="button">Copy comments report</button>',
      '  <button id="addAiCommentsReportBtn" class="btn mini" type="button">Add report to /reviews</button>',
      '</div>',
      '<div class="ai-comments-actions">',
      '  <button id="exportAiCommentsBtn" class="btn mini" type="button">Export JSON</button>',
      '  <button id="importAiCommentsBtn" class="btn mini" type="button">Import JSON below</button>',
      '</div>',
      '<textarea id="aiCommentImportBox" class="ai-comment-import" rows="3" placeholder="Paste exported comments JSON here, then click Import JSON below."></textarea>',
      '<div id="aiCommentsCount" class="ai-comments-count">0 comment(s).</div>',
      '<div id="aiCommentsStatus" class="settings-note">AI suggestion comments ready.</div>',
      '<div id="aiCommentsList" class="ai-comments-list"></div>',
      '<pre id="aiCommentsOutput" class="ai-comments-output"></pre>'
    ].join('');

    panel.appendChild(card);

    el('addAiCommentBtn')?.addEventListener('click', () => addComment(), true);
    el('refreshAiCommentsBtn')?.addEventListener('click', () => {
      renderComments();
      setStatus('Comments refreshed.');
    }, true);
    el('copyAiCommentsReportBtn')?.addEventListener('click', copyCommentsReport, true);
    el('addAiCommentsReportBtn')?.addEventListener('click', writeCommentsReportToProject, true);
    el('exportAiCommentsBtn')?.addEventListener('click', exportCommentsJson, true);
    el('importAiCommentsBtn')?.addEventListener('click', importFromTextarea, true);
    el('aiCommentStatusFilter')?.addEventListener('change', renderComments, true);
    el('aiCommentTypeFilter')?.addEventListener('change', renderComments, true);
    el('aiCommentOnlyActiveFile')?.addEventListener('change', renderComments, true);
    el('aiCommentAuthor')?.addEventListener('change', () => saveAuthor(el('aiCommentAuthor')?.value), true);

    renderComments();
    return true;
  }

  function init() {
    createCard();
    renderComments();
  }

  NS.AiSuggestionCommentsService = {
    STAGE,
    init,
    addComment,
    updateComment,
    resolveComment,
    reopenComment,
    deleteComment,
    getComments,
    scanSuggestionBlocks,
    commentReport,
    exportStore: readStore,
    importCommentsJsonText,
    getLastReport: () => lastReport
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  setTimeout(init, 1000);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

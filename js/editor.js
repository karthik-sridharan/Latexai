(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;

  const editorApi = {
    editor: null,
    gutter: null,
    suppress: false,
    init,
    render,
    focus,
    getSelection,
    applyLaiRewriteFromSelection,
    replaceSelection,
    replaceRange,
    insertText,
    goToLine,
    softFormat,
    wrapSelection
  };

  let lastNonEmptySelection = { text: '', start: 0, end: 0, path: '', value: '' };

  function activePath() {
    try { return State().state.project.activePath || State().state.project.rootFile || 'main.tex'; }
    catch (_err) { return document.getElementById('activeFilePill')?.textContent?.trim() || 'main.tex'; }
  }

  function rememberSelection() {
    const el = editorApi.editor;
    if (!el) return;
    const start = Number(el.selectionStart || 0);
    const end = Number(el.selectionEnd || 0);
    if (end > start) lastNonEmptySelection = { text: el.value.slice(start, end), start, end, path: activePath(), value: el.value };
  }

  function init() {
    editorApi.editor = document.getElementById('sourceEditor');
    editorApi.gutter = document.getElementById('lineGutter');
    if (!editorApi.editor || !editorApi.gutter) return false;
    editorApi.adapter = NS.EditorAdapter?.createTextAreaAdapter?.(editorApi.editor, { language: 'latex', stage: W.LUMINA_LATEX_STAGE }) || null;

    editorApi.editor.addEventListener('input', () => {
      if (editorApi.suppress) return;
      State().updateActiveText(editorApi.editor.value);
      updateLineGutter();
      updateCursorStatus();
      scheduleAutosave();
      W.LuminaLatex.Preview?.scheduleDraftPreview?.();
    });

    editorApi.editor.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        replaceSelection('  ', false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        State().save();
        W.LuminaLatex.Main?.toast?.('Saved locally.');
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        W.LuminaLatex.Preview?.compile?.();
      }
    });

    editorApi.editor.addEventListener('scroll', () => {
      editorApi.gutter.scrollTop = editorApi.editor.scrollTop;
    });
    editorApi.editor.addEventListener('click', updateCursorStatus);
    editorApi.editor.addEventListener('keyup', updateCursorStatus);
    editorApi.editor.addEventListener('select', updateCursorStatus);
    ['select','keyup','mouseup','touchend','blur'].forEach((name) => editorApi.editor.addEventListener(name, rememberSelection, true));
    document.addEventListener('selectionchange', rememberSelection);

    document.getElementById('formatTexBtn')?.addEventListener('click', softFormat);
    document.getElementById('wrapSelectionBtn')?.addEventListener('click', wrapSelection);

    State().subscribe((snapshot, reason) => {
      if (['load','reset','active-file','file-create','file-remove','file-rename','file-import-overwrite'].includes(reason)) render(snapshot);
      if (reason === 'file-change') updateLineGutter();
      if (reason === 'save') {
        const s = document.getElementById('autosaveStatus');
        if (s && !autosaveTimer) s.textContent = 'Autosaved locally';
      }
      if (reason === 'save-error') {
        const s = document.getElementById('autosaveStatus');
        if (s) s.textContent = 'Save failed — check connection';
      }
      if (['settings','project-rename'].includes(reason)) {
        const s = document.getElementById('autosaveStatus');
        if (s && !autosaveTimer) s.textContent = 'Unsaved changes';
      }
    });

    render();
    return true;
  }

  let autosaveTimer = null;
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    const el = document.getElementById('autosaveStatus');
    if (el) el.textContent = 'Editing…';
    autosaveTimer = setTimeout(() => {
      State().save();
      if (el) el.textContent = 'Autosaved locally';
    }, 900);
  }

  function render(snapshot) {
    const state = snapshot || State().state;
    const file = State().getActiveFile();
    const activePill = document.getElementById('activeFilePill');
    if (activePill) activePill.textContent = file?.path || 'No file';
    editorApi.suppress = true;
    editorApi.editor.value = file && State().textFile(file.path) ? file.text || '' : `% ${file?.path || 'asset'} is not editable as text in Stage 1E.`;
    editorApi.editor.readOnly = !(file && State().textFile(file.path));
    editorApi.suppress = false;
    updateLineGutter();
    updateCursorStatus();
  }

  function updateLineGutter() {
    if (!editorApi.editor || !editorApi.gutter) return;
    const lines = Math.max(1, editorApi.editor.value.split('\n').length);
    let out = '';
    for (let i = 1; i <= lines; i++) out += i + (i === lines ? '' : '\n');
    editorApi.gutter.textContent = out;
  }

  function positionToLineCol(text, pos) {
    const slice = text.slice(0, pos);
    const lines = slice.split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
  }

  function updateCursorStatus() {
    const status = document.getElementById('cursorStatus');
    if (!status || !editorApi.editor) return;
    const pos = positionToLineCol(editorApi.editor.value, editorApi.editor.selectionStart || 0);
    status.textContent = `Ln ${pos.line}, Col ${pos.col}`;
  }

  function getSelection() {
    const el = editorApi.editor;
    if (!el) return { text: '', start: 0, end: 0 };
    const start = Number(el.selectionStart || 0);
    const end = Number(el.selectionEnd || 0);
    if (end > start) {
      const sel = { text: el.value.slice(start, end), start, end, path: activePath(), value: el.value };
      lastNonEmptySelection = sel;
      return sel;
    }
    if (lastNonEmptySelection.text && lastNonEmptySelection.path === activePath()) {
      if (lastNonEmptySelection.value === el.value) return Object.assign({}, lastNonEmptySelection);
      const idx = el.value.indexOf(lastNonEmptySelection.text);
      if (idx >= 0) return { text: lastNonEmptySelection.text, start: idx, end: idx + lastNonEmptySelection.text.length, path: activePath(), value: el.value };
    }
    return { text: '', start, end, path: activePath(), value: el.value };
  }


  function commentOldSource(text) {
    return String(text ?? '').split('\n').map((line) => `% ${line}`).join('\n');
  }

  function stripFence(text) {
    let s = String(text ?? '').trim();
    const fence = s.match(/^```(?:json|latex|tex)?\s*([\s\S]*?)\s*```$/i);
    if (fence) s = fence[1].trim();
    return s;
  }

  function extractRewriteText(text) {
    let s = stripFence(text);
    if (/^\s*\{[\s\S]*\}\s*$/.test(s)) {
      try {
        const obj = JSON.parse(s);
        const patch = obj.patch || (Array.isArray(obj.patches) ? obj.patches[0] : null) || {};
        s = obj.replacementLatex ?? obj.replacement ?? obj.text ?? obj.content ?? patch.replacementLatex ?? patch.replacement ?? patch.text ?? patch.content ?? s;
      } catch (_err) {}
    }
    s = stripFence(s);
    const lai = s.match(/^\\lai\s*\{([\s\S]*)\}\s*$/);
    if (lai) s = lai[1].trim();
    return String(s ?? '').trim();
  }

  function ensureLaiMacroForRoot() {
    try {
      const project = State().state.project;
      const rootPath = project.rootFile || project.activePath || activePath();
      const file = State().getFile(rootPath);
      const ensure = NS.ProjectModel?.ensureLaiMacro;
      if (!file || !State().textFile(file.path) || typeof ensure !== 'function') return;
      const next = ensure(String(file.text || ''));
      if (next !== file.text) State().updateFile(file.path, next);
    } catch (_err) {}
  }

  function laiRewriteBlock(oldText, replacement, path) {
    const id = `lai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const newText = extractRewriteText(replacement);
    return `\n% BEGIN LAI-OLD id=${id} path=${path || activePath()}\n${commentOldSource(oldText)}\n% END LAI-OLD id=${id}\n\n\\lai{\n${newText}\n}\n`;
  }

  function applyLaiRewriteFromSelection(replacement, options = {}) {
    const el = editorApi.editor;
    if (!el || el.readOnly) return { ok: false, message: 'Editor is not editable.' };
    const sel = getSelection();
    let start = Number(sel.start);
    let end = Number(sel.end);
    let oldText = String(sel.text || '');
    let current = String(el.value || '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || !(end > start)) {
      return { ok: false, message: 'No source selection found. Select source text in the editor first.' };
    }
    start = Math.max(0, Math.min(start, current.length));
    end = Math.max(start, Math.min(end, current.length));
    if (oldText && current.slice(start, end) !== oldText) {
      const idx = current.indexOf(oldText);
      if (idx >= 0) { start = idx; end = idx + oldText.length; }
    }
    oldText = current.slice(start, end) || oldText;
    if (!oldText.trim()) return { ok: false, message: 'Selected source block is empty.' };
    const block = laiRewriteBlock(oldText, replacement, activePath());
    if (!/\\lai\s*\{/.test(block)) return { ok: false, message: 'Internal error: the replacement block did not contain \\lai{.' };
    ensureLaiMacroForRoot();
    current = String(el.value || '');
    const next = current.slice(0, start) + block + current.slice(end);
    el.value = next;
    const newEnd = start + block.length;
    el.focus();
    el.setSelectionRange(start, newEnd);
    State().updateActiveText(next);
    lastNonEmptySelection = { text: block, start, end: newEnd, path: activePath(), value: next };
    updateLineGutter();
    updateCursorStatus();
    scheduleAutosave();
    W.LuminaLatex.Preview?.scheduleDraftPreview?.();
    return { ok: true, path: activePath(), start, end: newEnd, block };
  }

  function shouldForceLaiRewrite(start, end, text) {
    if ((document.getElementById('copilotTask')?.value || '') !== 'rewrite-selection-patch') return false;
    if (!(Number(end) > Number(start))) return false;
    const s = String(text ?? '');
    if (!s.trim() || s === '  ') return false;
    if (/\\lai\s*\{/.test(s) || /%\s*BEGIN\s+LAI-OLD/i.test(s)) return false;
    return true;
  }

  function replaceSelection(text, selectInserted = true) {
    const el = editorApi.editor;
    if (!el || el.readOnly) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const insert = shouldForceLaiRewrite(start, end, text) ? laiRewriteBlock(el.value.slice(start, end), text, activePath()) : String(text ?? '');
    if (insert !== String(text ?? '')) ensureLaiMacroForRoot();
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    el.value = before + insert + after;
    const newEnd = start + String(insert).length;
    el.focus();
    el.setSelectionRange(selectInserted ? start : newEnd, newEnd);
    State().updateActiveText(el.value);
    updateLineGutter();
    updateCursorStatus();
    scheduleAutosave();
    W.LuminaLatex.Preview?.scheduleDraftPreview?.();
  }

  function replaceRange(start, end, text, selectInserted = true) {
    const el = editorApi.editor;
    if (!el || el.readOnly) return;
    const safeStart = Math.max(0, Math.min(Number(start) || 0, el.value.length));
    const safeEnd = Math.max(safeStart, Math.min(Number(end) || safeStart, el.value.length));
    const insert = shouldForceLaiRewrite(safeStart, safeEnd, text) ? laiRewriteBlock(el.value.slice(safeStart, safeEnd), text, activePath()) : String(text ?? '');
    if (insert !== String(text ?? '')) ensureLaiMacroForRoot();
    const before = el.value.slice(0, safeStart);
    const after = el.value.slice(safeEnd);
    el.value = before + insert + after;
    const newEnd = safeStart + String(insert).length;
    el.focus();
    el.setSelectionRange(selectInserted ? safeStart : newEnd, newEnd);
    State().updateActiveText(el.value);
    updateLineGutter();
    updateCursorStatus();
    scheduleAutosave();
    W.LuminaLatex.Preview?.scheduleDraftPreview?.();
  }

  function insertText(text) {
    replaceSelection(text, false);
  }

  function focus() { editorApi.editor?.focus(); }

  function goToLine(line) {
    const el = editorApi.editor;
    if (!el) return;
    const n = Math.max(1, Number(line) || 1);
    const lines = el.value.split('\n');
    let pos = 0;
    for (let i = 0; i < Math.min(n - 1, lines.length); i++) pos += lines[i].length + 1;
    el.focus();
    el.setSelectionRange(pos, pos);
    const approxTop = Math.max(0, (n - 3) * 21.7);
    el.scrollTop = approxTop;
    updateCursorStatus();
  }

  function softFormat() {
    const el = editorApi.editor;
    if (!el || el.readOnly) return;
    const original = el.value;
    const formatted = original
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/([^\n])\\section\{/g, '$1\n\n\\section{')
      .replace(/([^\n])\\subsection\{/g, '$1\n\n\\subsection{')
      .replace(/\\begin\{(theorem|lemma|proof|itemize|enumerate|equation|align)\}/g, '\\begin{$1}\n')
      .replace(/\\end\{(theorem|lemma|proof|itemize|enumerate|equation|align)\}/g, '\n\\end{$1}');
    if (formatted !== original) {
      el.value = formatted;
      State().updateActiveText(formatted);
      updateLineGutter();
      scheduleAutosave();
      W.LuminaLatex.Preview?.scheduleDraftPreview?.();
    }
  }

  function wrapSelection() {
    const sel = getSelection();
    const choice = prompt('Wrap selection with: emph, textbf, theorem, equation, itemize, frame', 'emph');
    if (!choice) return;
    const body = sel.text || 'selected text';
    const map = {
      emph: `\\emph{${body}}`,
      textbf: `\\textbf{${body}}`,
      equation: `\\[\n${body}\n\\]`,
      theorem: `\\begin{theorem}\n${body}\n\\end{theorem}`,
      itemize: `\\begin{itemize}\n  \\item ${body}\n\\end{itemize}`,
      frame: `\\begin{frame}{Title}\n${body}\n\\end{frame}`
    };
    replaceSelection(map[choice] || `\\${choice}{${body}}`, true);
  }

  editorApi.STAGE = 'stage4h-simple-hard-lai-rewrite-1';
  editorApi.getText = function () { return editorApi.editor?.value || ''; };
  editorApi.setText = function (text) { if (editorApi.editor) { editorApi.editor.value = String(text ?? ''); State().updateActiveText(editorApi.editor.value); updateLineGutter(); updateCursorStatus(); } };
  NS.Editor = editorApi;
})();

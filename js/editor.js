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
    replaceSelection,
    insertText,
    goToLine,
    softFormat,
    wrapSelection
  };

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

    document.getElementById('formatTexBtn')?.addEventListener('click', softFormat);
    document.getElementById('wrapSelectionBtn')?.addEventListener('click', wrapSelection);

    State().subscribe((snapshot, reason) => {
      if (['load','reset','active-file','file-create','file-remove','file-rename','file-import-overwrite'].includes(reason)) render(snapshot);
      if (reason === 'file-change') updateLineGutter();
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
    editorApi.editor.value = file && State().textFile(file.path) ? file.text || '' : `% ${file?.path || 'asset'} is not editable as text in Stage 1B.`;
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
    return { text: el.value.slice(el.selectionStart, el.selectionEnd), start: el.selectionStart, end: el.selectionEnd };
  }

  function replaceSelection(text, selectInserted = true) {
    const el = editorApi.editor;
    if (!el || el.readOnly) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    el.value = before + text + after;
    const newEnd = start + String(text).length;
    el.focus();
    el.setSelectionRange(selectInserted ? start : newEnd, newEnd);
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

  editorApi.getText = function () { return editorApi.editor?.value || ''; };
  editorApi.setText = function (text) { if (editorApi.editor) { editorApi.editor.value = String(text ?? ''); State().updateActiveText(editorApi.editor.value); updateLineGutter(); updateCursorStatus(); } };
  NS.Editor = editorApi;
})();

(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});

  function createTextAreaAdapter(textarea, options = {}) {
    const listeners = new Set();
    const adapter = {
      type: 'textarea',
      element: textarea,
      options,
      getText() { return textarea?.value || ''; },
      setText(text, suppress = false) {
        if (!textarea) return;
        textarea.value = String(text ?? '');
        if (!suppress) emit('change', { text: textarea.value });
      },
      focus() { textarea?.focus(); },
      isReadOnly() { return !!textarea?.readOnly; },
      setReadOnly(value) { if (textarea) textarea.readOnly = !!value; },
      getSelection() {
        if (!textarea) return { text: '', start: 0, end: 0 };
        return { text: textarea.value.slice(textarea.selectionStart, textarea.selectionEnd), start: textarea.selectionStart, end: textarea.selectionEnd };
      },
      replaceSelection(text, selectInserted = true) {
        if (!textarea || textarea.readOnly) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(end);
        textarea.value = before + String(text ?? '') + after;
        const newEnd = start + String(text ?? '').length;
        textarea.focus();
        textarea.setSelectionRange(selectInserted ? start : newEnd, newEnd);
        emit('change', { text: textarea.value, source: 'replaceSelection' });
      },
      insertText(text) { adapter.replaceSelection(text, false); },
      goToLine(line) {
        if (!textarea) return;
        const n = Math.max(1, Number(line) || 1);
        const lines = textarea.value.split('\n');
        let pos = 0;
        for (let i = 0; i < Math.min(n - 1, lines.length); i++) pos += lines[i].length + 1;
        textarea.focus();
        textarea.setSelectionRange(pos, pos);
        textarea.scrollTop = Math.max(0, (n - 3) * 21.7);
        emit('cursor', adapter.getCursor());
      },
      getCursor() {
        if (!textarea) return { line: 1, col: 1, pos: 0 };
        const pos = textarea.selectionStart || 0;
        const slice = textarea.value.slice(0, pos);
        const lines = slice.split('\n');
        return { line: lines.length, col: lines[lines.length - 1].length + 1, pos };
      },
      on(eventName, fn) {
        listeners.add({ eventName, fn });
        return () => {
          for (const item of Array.from(listeners)) if (item.fn === fn && item.eventName === eventName) listeners.delete(item);
        };
      }
    };

    function emit(eventName, payload) {
      for (const item of Array.from(listeners)) {
        if (item.eventName === eventName) {
          try { item.fn(payload); } catch (err) { console.error(err); }
        }
      }
    }

    if (textarea) {
      textarea.addEventListener('input', () => emit('change', { text: textarea.value, source: 'input' }));
      textarea.addEventListener('click', () => emit('cursor', adapter.getCursor()));
      textarea.addEventListener('keyup', () => emit('cursor', adapter.getCursor()));
      textarea.addEventListener('select', () => emit('selection', adapter.getSelection()));
    }

    return adapter;
  }

  function createCodeMirrorAdapter(_mount, _options = {}) {
    return {
      type: 'codemirror-placeholder',
      ready: false,
      reason: 'Stage 1C keeps the adapter seam. CodeMirror 6 can be mounted here without changing project/editor callers.'
    };
  }

  NS.EditorAdapter = { createTextAreaAdapter, createCodeMirrorAdapter };
})();

/* Latexai Stage 6A-B SelectionService
 * Stage: stage6abc-modular-selection-patchservice-1
 *
 * Owns source/draft/PDF selections.
 * - Captures source selections and freezes them when focus moves to the right panel.
 * - Renders a source overlay so the selected source remains visibly highlighted.
 * - Maps draft/PDF text selections back to source blocks when possible.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;
  const STAGE = 'stage6abc-modular-selection-patchservice-1';

  const TEXT_EXT_RE = /\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst|bbx|cbx|ltx)$/i;

  const service = {
    STAGE,
    init,
    captureSourceSelection,
    freezeSourceSelection,
    clearSourceSelection,
    getSourceSelection,
    restoreSourceSelection,
    setSourceSelection,
    getActiveSelection,
    capturePreviewSelection,
    findSourceForText,
    state: {
      source: null,
      preview: null,
      activeType: null
    }
  };

  let overlay = null;
  let overlayInner = null;
  let booted = false;
  let suppressClearUntil = 0;

  function el(id) { return document.getElementById(id); }

  function editor() { return el('sourceEditor'); }

  function sourceShell() {
    const ed = editor();
    return ed?.closest?.('.source-shell') || null;
  }

  function normalizePath(path) {
    return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  }

  function activePath() {
    return State()?.state?.project?.activePath ||
      el('activeFilePill')?.textContent?.trim() ||
      State()?.state?.project?.rootFile ||
      'main.tex';
  }

  function fileText(file) {
    if (!file) return '';
    if (typeof file === 'string') return file;
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function projectFiles() {
    return State()?.state?.project?.files || [];
  }

  function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function toast(message) {
    try { NS.Main?.toast?.(message); }
    catch (_err) {}
  }

  function now() { return Date.now(); }

  function textVersion(path, text) {
    return `${path}:${String(text || '').length}:${String(text || '').slice(0, 32)}:${String(text || '').slice(-32)}`;
  }

  function makeSelection({ type = 'source', path, start, end, text, value, source = 'unknown', confidence = 1, method = 'direct' }) {
    path = normalizePath(path || activePath());
    start = Number(start || 0);
    end = Number(end || start);
    text = String(text ?? '');
    value = String(value ?? '');
    return {
      schema: 'latexai-selection-v1',
      type,
      path,
      start,
      end,
      text,
      valueHash: textVersion(path, value),
      source,
      confidence,
      method,
      createdAt: new Date().toISOString()
    };
  }

  function installOverlay() {
    const shell = sourceShell();
    if (!shell || overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'lai-source-selection-overlay hidden';
    overlay.setAttribute('aria-hidden', 'true');
    overlayInner = document.createElement('pre');
    overlayInner.className = 'lai-source-selection-overlay-inner';
    overlay.appendChild(overlayInner);
    shell.appendChild(overlay);
  }

  function syncOverlayScroll() {
    const ed = editor();
    if (!ed || !overlayInner) return;
    overlayInner.style.transform = `translate(${-ed.scrollLeft}px, ${-ed.scrollTop}px)`;
  }

  function renderOverlay() {
    installOverlay();
    const ed = editor();
    const shell = sourceShell();
    if (!ed || !overlay || !overlayInner || !shell) return;

    const sel = service.state.source;
    if (!sel || sel.path !== activePath() || !(sel.end > sel.start)) {
      overlay.classList.add('hidden');
      shell.classList.remove('lai-source-selection-active');
      ed.classList.remove('lai-source-selection-hidden-text');
      return;
    }

    const value = String(ed.value || '');
    let start = Math.max(0, Math.min(Number(sel.start || 0), value.length));
    let end = Math.max(start, Math.min(Number(sel.end || start), value.length));

    if (sel.text && value.slice(start, end) !== sel.text) {
      const idx = value.indexOf(sel.text);
      if (idx >= 0) {
        start = idx;
        end = idx + sel.text.length;
        service.state.source = Object.assign({}, sel, { start, end, valueHash: textVersion(sel.path, value) });
      }
    }

    if (!(end > start)) {
      overlay.classList.add('hidden');
      shell.classList.remove('lai-source-selection-active');
      ed.classList.remove('lai-source-selection-hidden-text');
      return;
    }

    const before = value.slice(0, start);
    const marked = value.slice(start, end);
    const after = value.slice(end);
    overlayInner.innerHTML = `${escapeHtml(before)}<span class="lai-source-selection-mark">${escapeHtml(marked)}</span>${escapeHtml(after)}`;

    overlay.classList.remove('hidden');
    shell.classList.add('lai-source-selection-active');
    ed.classList.add('lai-source-selection-hidden-text');
    syncOverlayScroll();
  }

  function hideOverlayIfFocused() {
    const ed = editor();
    if (!ed || !overlay || !sourceShell()) return;
    // While user is actively editing, the native textarea selection is better.
    if (document.activeElement === ed) {
      overlay.classList.add('hidden');
      ed.classList.remove('lai-source-selection-hidden-text');
      sourceShell().classList.remove('lai-source-selection-active');
    }
  }

  function freezeSourceSelection(reason = 'freeze') {
    const current = captureSourceSelection({ source: reason, freeze: false, allowEmpty: false });
    if (current) service.state.source = current;
    if (service.state.source) {
      service.state.activeType = 'source';
      renderOverlay();
      updateCopilotChipsSoon();
      return Object.assign({}, service.state.source);
    }
    return null;
  }

  function captureSourceSelection(options = {}) {
    const ed = editor();
    if (!ed) return null;
    const start = Number(ed.selectionStart || 0);
    const end = Number(ed.selectionEnd || 0);
    if (!(end > start)) {
      if (options.allowEmpty) {
        return makeSelection({ type: 'source', path: activePath(), start, end, text: '', value: ed.value, source: options.source || 'empty' });
      }
      return null;
    }

    const text = ed.value.slice(start, end);
    if (!text.trim() && !options.allowEmpty) return null;

    const sel = makeSelection({
      type: 'source',
      path: activePath(),
      start,
      end,
      text,
      value: ed.value,
      source: options.source || 'source-editor',
      confidence: 1,
      method: 'editor-range'
    });

    service.state.source = sel;
    service.state.activeType = 'source';

    if (options.freeze) renderOverlay();
    else hideOverlayIfFocused();

    updateCopilotChipsSoon();
    return Object.assign({}, sel);
  }

  function getSourceSelection(options = {}) {
    const current = captureSourceSelection({ source: 'get-current', freeze: false, allowEmpty: false });
    if (current) return current;

    const frozen = service.state.source;
    if (!frozen) return { type: 'source', path: activePath(), start: 0, end: 0, text: '' };

    const file = State()?.getFile?.(frozen.path);
    const value = fileText(file);
    if (!value) return Object.assign({}, frozen);

    let start = Number(frozen.start || 0);
    let end = Number(frozen.end || start);
    if (end > start && value.slice(start, end) === frozen.text) return Object.assign({}, frozen);

    if (frozen.text) {
      const idx = value.indexOf(frozen.text);
      if (idx >= 0) {
        const repaired = Object.assign({}, frozen, { start: idx, end: idx + frozen.text.length, valueHash: textVersion(frozen.path, value), method: `${frozen.method}|repaired-by-text` });
        service.state.source = repaired;
        renderOverlay();
        return Object.assign({}, repaired);
      }
    }

    return options.allowStale ? Object.assign({}, frozen, { stale: true }) : { type: 'source', path: activePath(), start: 0, end: 0, text: '' };
  }

  function restoreSourceSelection(options = {}) {
    const sel = getSourceSelection({ allowStale: false });
    if (!sel?.text) return false;
    return setSourceSelection(sel.path, sel.start, sel.end, { freeze: options.freeze !== false, source: options.source || 'restore' });
  }

  function setSourceSelection(path, start, end, options = {}) {
    const ed = editor();
    path = normalizePath(path || activePath());
    start = Number(start || 0);
    end = Number(end || start);

    if (State()?.setActivePath && activePath() !== path) {
      try { State().setActivePath(path); } catch (_err) {}
      try { NS.Editor?.render?.(); } catch (_err) {}
    }

    const apply = () => {
      const target = editor();
      if (!target) return false;
      const value = String(target.value || fileText(State()?.getFile?.(path)) || '');
      const s = Math.max(0, Math.min(start, value.length));
      const e = Math.max(s, Math.min(end, value.length));
      target.focus({ preventScroll: true });
      target.setSelectionRange(s, e);

      const sel = makeSelection({
        type: 'source',
        path,
        start: s,
        end: e,
        text: value.slice(s, e),
        value,
        source: options.source || 'set-source-selection',
        confidence: options.confidence ?? 1,
        method: options.method || 'programmatic'
      });
      service.state.source = sel;
      service.state.activeType = 'source';

      if (options.freeze) {
        suppressClearUntil = now() + 500;
        setTimeout(renderOverlay, 40);
      } else {
        hideOverlayIfFocused();
      }
      updateCopilotChipsSoon();
      return true;
    };

    const ok = apply();
    setTimeout(apply, 60);
    setTimeout(apply, 220);
    return ok;
  }

  function clearSourceSelection(reason = 'clear') {
    if (now() < suppressClearUntil) return;
    service.state.source = null;
    if (service.state.activeType === 'source') service.state.activeType = null;
    renderOverlay();
    updateCopilotChipsSoon();
  }

  function getActiveSelection() {
    if (service.state.activeType === 'source') return getSourceSelection({ allowStale: true });
    if (service.state.activeType === 'preview') return Object.assign({}, service.state.preview);
    return getSourceSelection({ allowStale: true });
  }

  function selectionInside(node) {
    const sel = W.getSelection?.();
    if (!sel || sel.rangeCount === 0 || !node) return '';
    const text = String(sel.toString() || '').trim();
    if (!text) return '';
    const anchor = sel.anchorNode;
    const focus = sel.focusNode;
    const a = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
    const f = focus?.nodeType === Node.ELEMENT_NODE ? focus : focus?.parentElement;
    if ((a && node.contains(a)) || (f && node.contains(f))) return text;
    return '';
  }

  function iframeSelection(frame) {
    try {
      const sel = frame?.contentWindow?.getSelection?.();
      return String(sel?.toString?.() || '').trim();
    } catch (_err) { return ''; }
  }

  function capturePreviewSelection(options = {}) {
    const draft = el('draftPreview');
    const pdf = el('pdfPreview');
    const pdfJsViewer = el('laiPdfViewer') || el('laiPdfPages');

    let text = selectionInside(draft) || selectionInside(pdfJsViewer) || selectionInside(pdf);
    if (!text && pdf && /^(IFRAME|FRAME)$/i.test(pdf.tagName)) text = iframeSelection(pdf);
    text = String(text || '').trim();
    if (!text) return null;

    const sourceType = selectionInside(draft) ? 'draft' : 'pdf';
    const sel = {
      schema: 'latexai-selection-v1',
      type: sourceType,
      text,
      source: options.source || 'preview-selection',
      createdAt: new Date().toISOString()
    };
    service.state.preview = sel;
    service.state.activeType = 'preview';

    if (options.findSource !== false) {
      const match = findSourceForText(text);
      if (match) {
        setSourceSelection(match.path, match.start, match.end, { freeze: true, source: `${sourceType}-mapped`, confidence: match.score, method: match.method });
        toast(`Selected matching source in ${match.path}.`);
      } else {
        toast(`${sourceType === 'pdf' ? 'PDF' : 'Draft'} text selected, but source match was not confident.`);
      }
    }

    return Object.assign({}, sel);
  }

  function tokens(text) {
    return String(text || '')
      .replace(/\\[a-zA-Z]+(\*?)(\[[^\]]*\])?/g, ' ')
      .replace(/[{}_$^\\()[\],.;:!?'"`~|<>+=*/-]+/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3);
  }

  function tokenScore(queryTokens, source) {
    if (!queryTokens.length) return 0;
    const set = new Set(tokens(source));
    let hit = 0;
    for (const t of queryTokens) if (set.has(t)) hit += 1;
    return hit / queryTokens.length;
  }

  function blocks(source) {
    const out = [];
    const text = String(source || '');
    const env = /\\begin\{(?:theorem|lemma|proof|proposition|corollary|definition|equation|align|displaymath)\}[\s\S]*?\\end\{(?:theorem|lemma|proof|proposition|corollary|definition|equation|align|displaymath)\}/g;
    let m;
    while ((m = env.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });

    const parts = text.split(/\n\s*\n+/);
    let cursor = 0;
    for (const part of parts) {
      const start = text.indexOf(part, cursor);
      const end = start + part.length;
      cursor = end;
      if (part.trim().length > 30) out.push({ start, end, text: part });
    }

    const size = 900;
    const step = 350;
    for (let i = 0; i < text.length; i += step) {
      out.push({ start: i, end: Math.min(text.length, i + size), text: text.slice(i, i + size) });
    }
    return out;
  }

  function findSourceForText(query) {
    query = String(query || '').trim();
    if (!query) return null;
    const qLow = query.toLowerCase();
    const qTokens = tokens(query);
    let best = null;

    for (const file of projectFiles()) {
      const path = normalizePath(file.path || '');
      if (!TEXT_EXT_RE.test(path)) continue;
      const source = fileText(file);
      if (!source) continue;

      const exact = source.indexOf(query);
      if (exact >= 0) {
        const cand = { path, start: exact, end: exact + query.length, score: 1, method: 'exact' };
        if (!best || cand.score > best.score) best = cand;
        continue;
      }

      const ci = source.toLowerCase().indexOf(qLow);
      if (ci >= 0) {
        const cand = { path, start: ci, end: ci + query.length, score: 0.98, method: 'case-insensitive' };
        if (!best || cand.score > best.score) best = cand;
        continue;
      }

      for (const b of blocks(source)) {
        const score = tokenScore(qTokens, b.text);
        if (!best || score > best.score) {
          const leading = b.text.match(/^\s*/)?.[0]?.length || 0;
          const trailing = b.text.match(/\s*$/)?.[0]?.length || 0;
          best = {
            path,
            start: b.start + leading,
            end: Math.max(b.start + leading, b.end - trailing),
            score,
            method: 'token-block'
          };
        }
      }
    }

    return best && best.score >= 0.18 ? best : null;
  }

  function updateCopilotChipsSoon() {
    setTimeout(() => {
      try { NS.Copilot?.renderContextChips?.(); } catch (_err) {}
    }, 40);
  }

  function bindSourceEditor() {
    const ed = editor();
    if (!ed || ed.__stage6SelectionServiceBound) return;

    ed.addEventListener('select', () => captureSourceSelection({ source: 'editor-select', freeze: false }), true);
    ed.addEventListener('mouseup', () => setTimeout(() => captureSourceSelection({ source: 'editor-mouseup', freeze: false }), 20), true);
    ed.addEventListener('keyup', () => setTimeout(() => captureSourceSelection({ source: 'editor-keyup', freeze: false }), 20), true);
    ed.addEventListener('touchend', () => setTimeout(() => captureSourceSelection({ source: 'editor-touchend', freeze: false }), 80), true);
    ed.addEventListener('blur', () => {
      if (now() < suppressClearUntil) return;
      freezeSourceSelection('editor-blur');
    }, true);
    ed.addEventListener('focus', hideOverlayIfFocused, true);
    ed.addEventListener('scroll', syncOverlayScroll, { passive: true });
    ed.addEventListener('input', () => {
      if (service.state.source) {
        const current = getSourceSelection({ allowStale: true });
        service.state.source = current?.text ? current : null;
      }
      renderOverlay();
    }, true);

    ed.__stage6SelectionServiceBound = true;
  }

  function bindRightPanel() {
    const right = document.querySelector('.right-panel');
    if (!right || right.__stage6SelectionServiceBound) return;
    ['mousedown', 'touchstart', 'focusin'].forEach((eventName) => {
      right.addEventListener(eventName, () => {
        freezeSourceSelection(`right-panel-${eventName}`);
      }, true);
    });
    right.__stage6SelectionServiceBound = true;
  }

  function bindPreviewSelection() {
    const nodes = [el('draftPreview'), el('pdfPreview'), el('laiPdfViewer'), el('laiPdfPages')].filter(Boolean);
    nodes.forEach((node) => {
      if (node.__stage6PreviewSelectionBound) return;
      node.addEventListener('mouseup', () => setTimeout(() => capturePreviewSelection({ source: 'preview-mouseup' }), 80), true);
      node.addEventListener('touchend', () => setTimeout(() => capturePreviewSelection({ source: 'preview-touchend' }), 250), true);
      node.__stage6PreviewSelectionBound = true;
    });
  }

  function bindDocumentSelection() {
    if (document.__stage6SelectionServiceBound) return;
    document.addEventListener('selectionchange', () => {
      setTimeout(() => {
        if (document.activeElement === editor()) {
          captureSourceSelection({ source: 'document-selectionchange', freeze: false });
          return;
        }
        capturePreviewSelection({ source: 'document-selectionchange' });
      }, 80);
    });
    document.__stage6SelectionServiceBound = true;
  }

  function init() {
    if (booted) return;
    booted = true;
    installOverlay();
    bindSourceEditor();
    bindRightPanel();
    bindPreviewSelection();
    bindDocumentSelection();

    try {
      State()?.subscribe?.((_snapshot, reason) => {
        if (['active-file', 'load', 'reset'].includes(reason)) {
          setTimeout(() => {
            installOverlay();
            bindSourceEditor();
            renderOverlay();
          }, 50);
        }
        if (reason === 'file-change') setTimeout(renderOverlay, 20);
      });
    } catch (_err) {}
  }

  NS.SelectionService = service;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    booted = false;
    init();
    bindPreviewSelection();
    tries += 1;
    if (tries > 20) clearInterval(interval);
  }, 500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

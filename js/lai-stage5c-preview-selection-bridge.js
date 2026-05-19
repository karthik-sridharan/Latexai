/* Latexai Stage 5C unobtrusive preview-text selection bridge
 * Stage: stage5d-fix-lai-old-new-order-1
 *
 * Restores the pre-5A preview layout: no panel is inserted above the PDF/preview.
 *
 * Feature:
 * - If the user selects real text in the draft/preview area, the matching source
 *   block is located and selected in the editor.
 * - Copilot workflow is set to "Rewrite selected LaTeX as patch".
 * - Stage 4N still handles commenting old source, \lai{...}, and macro injection.
 *
 * Note: iPad/Safari native PDF rendering often behaves like an image/canvas and
 * does not expose selectable text to the page. This script works when the preview
 * exposes real text selection, especially in Draft preview.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage5d-fix-lai-old-new-order-1';

  let lastPreviewSelection = '';
  let lastMatch = null;
  let busy = false;

  const TEXT_EXT_RE = /\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst|bbx|cbx|ltx)$/i;

  function el(id) { return document.getElementById(id); }

  function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  }

  function fileText(file) {
    if (!file) return '';
    if (typeof file === 'string') return file;
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function files() {
    return NS.State?.state?.project?.files || {};
  }

  function activePath() {
    return NS.State?.state?.project?.activePath ||
      el('activeFilePill')?.textContent?.trim() ||
      NS.State?.state?.project?.rootFile ||
      'main.tex';
  }

  function toast(message) {
    try {
      NS.Main?.toast?.(message);
      return;
    } catch (_err) {}
    const old = el('laiStage5cToast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.id = 'laiStage5cToast';
    t.textContent = message;
    t.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:18px',
      'transform:translateX(-50%)',
      'z-index:2147483600',
      'padding:8px 12px',
      'border-radius:999px',
      'background:rgba(17,24,39,0.92)',
      'color:white',
      'font:13px system-ui,-apple-system,BlinkMacSystemFont,sans-serif',
      'box-shadow:0 3px 18px rgba(0,0,0,0.25)'
    ].join(';');
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
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
    } catch (_err) {
      return '';
    }
  }

  function currentPreviewSelection() {
    const draft = el('draftPreview');
    const pdf = el('pdfPreview');

    let text = selectionInside(draft) || selectionInside(pdf);
    if (!text && pdf && /^(IFRAME|FRAME)$/i.test(pdf.tagName)) text = iframeSelection(pdf);
    return String(text || '').trim();
  }

  function tokens(text) {
    return String(text || '')
      .replace(/\\[a-zA-Z]+(\*?)(\[[^\]]*\])?/g, ' ')
      .replace(/[{}_$^\\()[\],.;:!?'"`~|<>+=*/-]+/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length >= 3);
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

  function findBest(query) {
    query = String(query || '').trim();
    if (!query) return null;

    const qLow = query.toLowerCase();
    const qTokens = tokens(query);
    let best = null;

    for (const rawPath of Object.keys(files())) {
      const path = normalizePath(rawPath);
      if (!TEXT_EXT_RE.test(path)) continue;

      const source = fileText(files()[rawPath]);
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

    return best;
  }

  function saveActiveEditor() {
    const ed = el('sourceEditor');
    if (!ed) return;
    try { NS.State?.updateActiveText?.(ed.value); } catch (_err) {}
  }

  function setSourceSelection(match) {
    if (!match) return false;
    saveActiveEditor();

    const path = normalizePath(match.path);
    if (NS.State?.setActivePath && activePath() !== path) {
      try { NS.State.setActivePath(path); } catch (_err) {}
      try { NS.Editor?.render?.(); } catch (_err) {}
    }

    const apply = () => {
      const ed = el('sourceEditor');
      if (!ed) return false;
      const source = String(ed.value || fileText(NS.State?.getFile?.(path)) || '');
      const start = Math.max(0, Math.min(Number(match.start || 0), source.length));
      const end = Math.max(start, Math.min(Number(match.end || start), source.length));
      ed.focus({ preventScroll: true });
      ed.setSelectionRange(start, end);
      ed.dispatchEvent(new Event('select', { bubbles: true }));
      ed.dispatchEvent(new Event('keyup', { bubbles: true }));
      return true;
    };

    apply();
    setTimeout(apply, 100);
    setTimeout(apply, 250);
    return true;
  }

  function setCopilotRewriteWorkflow() {
    const select = el('copilotTask');
    if (!select) return;
    select.value = 'rewrite-selection-patch';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function handlePreviewSelection(reason = 'selection') {
    if (busy) return;
    const text = currentPreviewSelection();
    if (!text || text.length < 8 || text === lastPreviewSelection) return;

    busy = true;
    try {
      lastPreviewSelection = text;
      const match = findBest(text);
      if (!match || !Number.isFinite(match.start) || !Number.isFinite(match.end) || (match.score || 0) < 0.18) {
        toast('Preview text selected, but I could not confidently locate the source.');
        return;
      }

      lastMatch = match;
      setSourceSelection(match);
      setCopilotRewriteWorkflow();

      const pct = Math.round((match.score || 0) * 100);
      toast(`Selected matching source in ${match.path} (${pct}%). Copilot rewrite is ready.`);
    } finally {
      setTimeout(() => { busy = false; }, 250);
    }
  }

  function makePreviewSelectable() {
    const styleId = 'laiStage5cPreviewSelectionStyle';
    if (!el(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        #draftPreview, #draftPreview * {
          -webkit-user-select: text !important;
          user-select: text !important;
        }
        #pdfPreview {
          -webkit-user-select: text !important;
          user-select: text !important;
        }
      `;
      document.head.appendChild(style);
    }

    const draft = el('draftPreview');
    const pdf = el('pdfPreview');
    [draft, pdf].forEach(node => {
      if (!node || node.__laiStage5cSelectable) return;
      node.addEventListener('mouseup', () => setTimeout(() => handlePreviewSelection('mouseup'), 80), true);
      node.addEventListener('touchend', () => setTimeout(() => handlePreviewSelection('touchend'), 250), true);
      node.addEventListener('keyup', () => setTimeout(() => handlePreviewSelection('keyup'), 80), true);
      node.__laiStage5cSelectable = true;
    });
  }

  function boot() {
    W.__LATEXAI_STAGE5C_PREVIEW_SELECTION_ACTIVE = true;
    makePreviewSelectable();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  document.addEventListener('selectionchange', () => {
    setTimeout(() => {
      const text = currentPreviewSelection();
      if (text && text.length >= 8) handlePreviewSelection('selectionchange');
    }, 80);
  });

  let count = 0;
  const id = setInterval(() => {
    boot();
    count += 1;
    if (count > 20) clearInterval(id);
  }, 500);

  W.LAI_STAGE5C_PREVIEW_SELECTION = {
    STAGE,
    currentPreviewSelection,
    findBest,
    handlePreviewSelection,
    getState: () => ({ lastPreviewSelection, lastMatch })
  };

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

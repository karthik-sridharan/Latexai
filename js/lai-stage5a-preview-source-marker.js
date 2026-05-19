/* Latexai Stage 5A Preview/PDF-to-source marker
 * Stage: stage5a-preview-source-marker-1
 *
 * Adds a clean UI in the Preview panel:
 * - mark/select text in the preview/draft/PDF area
 * - locate the corresponding source block
 * - select that source block in the editor
 * - send it to Copilot's rewrite-selection workflow
 *
 * This builds on Stage 4N: the rewrite path still comments old source and wraps
 * the AI replacement in \lai{...}; this file only handles locating/selecting
 * the relevant source from preview text.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage5a-preview-source-marker-1';

  const state = {
    markedText: '',
    markedSource: '',
    match: null,
    lastClickedText: '',
    lastStatus: 'Select text in the preview, or tap a preview block, then use Capture.',
  };

  const TEXT_EXT_RE = /\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst|bbx|cbx|ltx)$/i;

  function el(id) { return document.getElementById(id); }

  function textOfFile(file) {
    if (!file) return '';
    if (typeof file === 'string') return file;
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function projectFiles() {
    return NS.State?.state?.project?.files || {};
  }

  function activePath() {
    return NS.State?.state?.project?.activePath ||
      el('activeFilePill')?.textContent?.trim() ||
      NS.State?.state?.project?.rootFile ||
      'main.tex';
  }

  function setStatus(message) {
    state.lastStatus = message;
    const box = el('laiPreviewMarkerStatus');
    if (box) box.textContent = message;
  }

  function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  }

  function tokenSet(text) {
    const cleaned = String(text || '')
      .replace(/\\[a-zA-Z]+(\*?)(\[[^\]]*\])?/g, ' ')
      .replace(/[{}_$^\\()[\],.;:!?'"`~|<>+=*/-]+/g, ' ')
      .toLowerCase();
    return cleaned.split(/\s+/).filter(t => t.length >= 3);
  }

  function scoreTokens(queryTokens, text) {
    if (!queryTokens.length) return 0;
    const s = new Set(tokenSet(text));
    let hit = 0;
    for (const t of queryTokens) if (s.has(t)) hit += 1;
    return hit / Math.max(queryTokens.length, 1);
  }

  function selectedTextInNode(root) {
    const sel = W.getSelection?.();
    if (!sel || sel.rangeCount === 0) return '';
    const text = String(sel.toString() || '').trim();
    if (!text) return '';
    if (!root) return text;
    const node = sel.anchorNode;
    if (!node) return text;
    const anchorEl = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (anchorEl && root.contains(anchorEl)) return text;
    return '';
  }

  function tryIframeSelection(frame) {
    try {
      const doc = frame?.contentDocument || frame?.contentWindow?.document;
      const sel = frame?.contentWindow?.getSelection?.();
      const text = String(sel?.toString?.() || '').trim();
      if (doc && text) return text;
    } catch (_err) {}
    return '';
  }

  function capturePreviewText() {
    const draft = el('draftPreview');
    const pdf = el('pdfPreview');

    let text = selectedTextInNode(draft) || selectedTextInNode(pdf);
    if (!text && pdf && /^(IFRAME|FRAME)$/i.test(pdf.tagName)) text = tryIframeSelection(pdf);
    if (!text) text = state.lastClickedText || '';

    text = String(text || '').trim();
    if (!text) {
      setStatus('No preview text captured. Select text in the preview or tap a preview block first.');
      return '';
    }

    state.markedText = text;
    state.markedSource = 'preview';
    setStatus(`Captured preview text (${text.length} chars). Now tap “Find source”.`);
    renderPanel();
    return text;
  }

  function sourceSelectionText() {
    const ed = el('sourceEditor');
    if (!ed) return '';
    const start = Number(ed.selectionStart || 0);
    const end = Number(ed.selectionEnd || 0);
    if (end > start) return ed.value.slice(start, end).trim();
    return '';
  }

  function captureSourceSelection() {
    const text = sourceSelectionText();
    if (!text) {
      setStatus('No source selection found. Select text in the editor first.');
      return '';
    }
    state.markedText = text;
    state.markedSource = 'source';
    state.match = { path: activePath(), start: el('sourceEditor').selectionStart, end: el('sourceEditor').selectionEnd, score: 1 };
    setStatus(`Captured source selection (${text.length} chars). Ready for Copilot rewrite.`);
    renderPanel();
    return text;
  }

  function findExactInSource(query, source) {
    if (!query || !source) return null;
    const exact = source.indexOf(query);
    if (exact >= 0) return { start: exact, end: exact + query.length, score: 1.0, method: 'exact' };

    const lowSource = source.toLowerCase();
    const lowQuery = query.toLowerCase();
    const ci = lowSource.indexOf(lowQuery);
    if (ci >= 0) return { start: ci, end: ci + query.length, score: 0.98, method: 'case-insensitive' };

    return null;
  }

  function candidateBlocks(source) {
    const blocks = [];
    const text = String(source || '');
    const pattern = /(\n\s*\n+|\\section\*?\{|\\subsection\*?\{|\\begin\{(?:theorem|lemma|proof|proposition|corollary|definition|equation|align|displaymath)\})/g;
    let start = 0;
    let m;
    while ((m = pattern.exec(text))) {
      const end = m.index;
      if (end - start > 30) blocks.push({ start, end, text: text.slice(start, end) });
      start = m.index;
    }
    if (text.length - start > 30) blocks.push({ start, end: text.length, text: text.slice(start) });

    // Add sliding windows for cases where preview text is a sentence inside a long paragraph.
    const size = 900;
    const step = 350;
    for (let i = 0; i < text.length; i += step) {
      blocks.push({ start: i, end: Math.min(text.length, i + size), text: text.slice(i, i + size) });
    }
    return blocks;
  }

  function findBestSource(query) {
    query = String(query || '').trim();
    if (!query) return null;

    const files = projectFiles();
    const queryTokens = tokenSet(query);
    let best = null;

    for (const path of Object.keys(files)) {
      const npath = normalizePath(path);
      if (!TEXT_EXT_RE.test(npath)) continue;
      const source = textOfFile(files[path]);
      if (!source) continue;

      const exact = findExactInSource(query, source);
      if (exact) {
        const candidate = { path: npath, start: exact.start, end: exact.end, score: exact.score, method: exact.method };
        if (!best || candidate.score > best.score) best = candidate;
        continue;
      }

      for (const b of candidateBlocks(source)) {
        const score = scoreTokens(queryTokens, b.text);
        if (!best || score > best.score) {
          // Tighten to non-empty line group around the highest-scoring block.
          const trimmedStart = b.start + (b.text.match(/^\s*/)?.[0]?.length || 0);
          const trimmedEnd = b.end - (b.text.match(/\s*$/)?.[0]?.length || 0);
          best = { path: npath, start: trimmedStart, end: Math.max(trimmedStart, trimmedEnd), score, method: 'token-block' };
        }
      }
    }

    return best;
  }

  function saveActiveEditorToState() {
    const ed = el('sourceEditor');
    if (!ed) return;
    try { NS.State?.updateActiveText?.(ed.value); } catch (_err) {}
  }

  function setEditorSelection(path, start, end) {
    path = normalizePath(path);
    start = Number(start || 0);
    end = Number(end || start);

    saveActiveEditorToState();

    if (NS.State?.setActivePath && activePath() !== path) {
      try { NS.State.setActivePath(path); } catch (_err) {}
      try { NS.Editor?.render?.(); } catch (_err) {}
    }

    const apply = () => {
      const ed = el('sourceEditor');
      if (!ed) return false;
      const text = ed.value || textOfFile(NS.State?.getFile?.(path));
      start = Math.max(0, Math.min(start, text.length));
      end = Math.max(start, Math.min(end, text.length));
      ed.focus();
      ed.setSelectionRange(start, end);
      ed.dispatchEvent(new Event('select', { bubbles: true }));
      ed.dispatchEvent(new Event('keyup', { bubbles: true }));
      const chip = el('copilotContextChips');
      if (chip) {
        // Let the existing Copilot context machinery update on its own; this is just harmless nudging.
        document.dispatchEvent(new CustomEvent('latexai:source-selection-captured', { detail: { path, start, end } }));
      }
      return true;
    };

    apply();
    setTimeout(apply, 80);
    setTimeout(apply, 250);
  }

  function findAndSelectSource() {
    const query = state.markedText || capturePreviewText() || captureSourceSelection();
    if (!query) return null;

    const match = state.markedSource === 'source' && state.match ? state.match : findBestSource(query);
    if (!match || !Number.isFinite(match.start) || !Number.isFinite(match.end)) {
      setStatus('Could not locate matching source. Try selecting a larger preview paragraph or select source directly.');
      return null;
    }

    state.match = match;
    setEditorSelection(match.path, match.start, match.end);

    const pct = Math.round((match.score || 0) * 100);
    setStatus(`Selected source block in ${match.path} (${match.method || 'match'}, score ${pct}%).`);
    renderPanel();
    return match;
  }

  function openCopilot() {
    try { el('copilotTab')?.click(); } catch (_err) {}
  }

  function setRewriteWorkflow() {
    const select = el('copilotTask');
    if (!select) return;
    const wanted = 'rewrite-selection-patch';
    select.value = wanted;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function rewriteMarked() {
    const match = state.match || findAndSelectSource();
    if (!match) return;

    openCopilot();
    setRewriteWorkflow();
    setEditorSelection(match.path, match.start, match.end);

    const prompt = el('copilotPrompt');
    if (prompt && !prompt.value.trim()) {
      prompt.value = 'Rewrite the marked passage clearly and concisely. Preserve mathematical meaning and valid LaTeX.';
      prompt.dispatchEvent(new Event('input', { bubbles: true }));
    }

    setStatus('Source selected and Copilot rewrite workflow is ready. Review/edit the prompt, then tap Ask Copilot.');
  }

  function askRewriteMarked() {
    const match = state.match || findAndSelectSource();
    if (!match) return;

    openCopilot();
    setRewriteWorkflow();
    setEditorSelection(match.path, match.start, match.end);

    const prompt = el('copilotPrompt');
    if (prompt && !prompt.value.trim()) {
      prompt.value = 'Rewrite the marked passage clearly and concisely. Preserve mathematical meaning and valid LaTeX.';
      prompt.dispatchEvent(new Event('input', { bubbles: true }));
    }

    setTimeout(() => {
      el('askCopilotBtn')?.click();
      setStatus('Asked Copilot to rewrite the marked source block.');
    }, 300);
  }

  function makeButton(label, fn, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (title) b.title = title;
    b.style.cssText = [
      'margin:2px',
      'padding:5px 8px',
      'border-radius:9px',
      'border:1px solid rgba(0,0,0,0.16)',
      'background:#fff',
      'color:#111',
      'font:12px system-ui,-apple-system,BlinkMacSystemFont,sans-serif'
    ].join(';');
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      fn();
    }, true);
    return b;
  }

  function renderPanel() {
    let panel = el('laiPreviewMarkerPanel');
    if (!panel) return;

    const captured = state.markedText
      ? (state.markedText.length > 140 ? state.markedText.slice(0, 140) + '…' : state.markedText)
      : 'Nothing captured yet.';

    panel.querySelector('#laiPreviewMarkerStatus').textContent = state.lastStatus;
    panel.querySelector('#laiPreviewMarkerCaptured').textContent = captured;
  }

  function installPanel() {
    if (el('laiPreviewMarkerPanel')) return;

    const target = el('draftPreview')?.parentElement || el('previewTab') || document.body;
    const panel = document.createElement('div');
    panel.id = 'laiPreviewMarkerPanel';
    panel.style.cssText = [
      'margin:8px 0',
      'padding:8px',
      'border:1px solid rgba(0,0,0,0.12)',
      'border-radius:12px',
      'background:rgba(255,255,255,0.72)',
      'font:12px system-ui,-apple-system,BlinkMacSystemFont,sans-serif',
      'color:#111'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Preview/PDF mark → source';
    title.style.cssText = 'font-weight:800;margin-bottom:4px;';
    panel.appendChild(title);

    const status = document.createElement('div');
    status.id = 'laiPreviewMarkerStatus';
    status.textContent = state.lastStatus;
    status.style.cssText = 'white-space:pre-wrap;line-height:1.25;margin-bottom:5px;';
    panel.appendChild(status);

    const captured = document.createElement('div');
    captured.id = 'laiPreviewMarkerCaptured';
    captured.textContent = 'Nothing captured yet.';
    captured.style.cssText = [
      'max-height:54px',
      'overflow:auto',
      'white-space:pre-wrap',
      'background:rgba(255,255,255,0.65)',
      'border-radius:8px',
      'padding:5px',
      'margin-bottom:6px',
      'font:11px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
    ].join(';');
    panel.appendChild(captured);

    const buttons = document.createElement('div');
    buttons.appendChild(makeButton('Capture preview', capturePreviewText, 'Use selected preview/PDF text or last tapped preview block.'));
    buttons.appendChild(makeButton('Capture source', captureSourceSelection, 'Use the current editor selection.'));
    buttons.appendChild(makeButton('Find source', findAndSelectSource, 'Locate and select the matching source.'));
    buttons.appendChild(makeButton('Rewrite marked', rewriteMarked, 'Prepare Copilot rewrite for the located source.'));
    buttons.appendChild(makeButton('Ask rewrite', askRewriteMarked, 'Immediately ask Copilot to rewrite the located source.'));
    panel.appendChild(buttons);

    // Place immediately above the preview content if possible.
    const draft = el('draftPreview');
    if (draft?.parentElement) draft.parentElement.insertBefore(panel, draft);
    else target.prepend(panel);

    renderPanel();
  }

  function captureClickedPreviewBlock(ev) {
    const draft = el('draftPreview');
    const pdf = el('pdfPreview');
    if (!draft && !pdf) return;

    const target = ev.target;
    if (!target || !(draft?.contains(target) || pdf?.contains(target))) return;
    if (target.closest?.('#laiPreviewMarkerPanel')) return;

    const block = target.closest?.('p, li, blockquote, .theorem, .lemma, .definition, .proof, section, article, div') || target;
    const text = String(block?.innerText || block?.textContent || '').trim();
    if (text && text.length >= 12) {
      state.lastClickedText = text;
      state.markedText = text;
      state.markedSource = 'preview-click';
      setStatus(`Captured tapped preview block (${text.length} chars). Tap “Find source”.`);
      renderPanel();
    }
  }

  function boot() {
    window.__LATEXAI_STAGE5A_PREVIEW_MARKER_ACTIVE = true;
    installPanel();

    const draft = el('draftPreview');
    const pdf = el('pdfPreview');
    [draft, pdf].forEach((node) => {
      if (node && !node.__laiStage5aClick) {
        node.addEventListener('click', captureClickedPreviewBlock, true);
        node.addEventListener('mouseup', () => setTimeout(() => {
          const t = selectedTextInNode(node);
          if (t) {
            state.markedText = t;
            state.markedSource = 'preview-selection';
            setStatus(`Captured selected preview text (${t.length} chars). Tap “Find source”.`);
            renderPanel();
          }
        }, 50), true);
        node.__laiStage5aClick = true;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  let tries = 0;
  const id = setInterval(() => {
    boot();
    tries += 1;
    if (tries > 24) clearInterval(id);
  }, 500);

  window.LAI_STAGE5A_PREVIEW_MARKER = {
    STAGE,
    capturePreviewText,
    captureSourceSelection,
    findBestSource,
    findAndSelectSource,
    rewriteMarked,
    askRewriteMarked,
    getState: () => ({ ...state })
  };

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

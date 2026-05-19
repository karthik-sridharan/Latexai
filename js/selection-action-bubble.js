/* Latexai Stage 7A SelectionActionBubble
 * Stage: stage7a-selection-action-bubble-1
 *
 * A small contextual action bubble for source/draft/PDF selections.
 * It does not mutate source directly. It delegates to:
 * - SelectionService for selection capture/freeze/source mapping
 * - Copilot for AI requests
 * - PatchService via Copilot/PatchManager for source edits
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage7a-selection-action-bubble-1';

  let bubble = null;
  let activeSelection = null;
  let hideTimer = null;
  let installed = false;
  let lastPointer = { x: 0, y: 0 };

  function el(id) { return document.getElementById(id); }

  function selectionService() { return NS.SelectionService; }

  function isTextInput(node) {
    if (!node) return false;
    const tag = String(node.tagName || '').toUpperCase();
    return tag === 'TEXTAREA' || tag === 'INPUT' || node.isContentEditable;
  }

  function toast(message) {
    try { NS.Main?.toast?.(message); }
    catch (_err) {}
  }

  function openRightTab(name) {
    const button = document.querySelector(`.right-tab[data-right-tab="${name}"]`);
    if (button) button.click();

    document.querySelectorAll('.right-tab').forEach((b) => b.classList.toggle('active', b.dataset.rightTab === name));
    document.querySelectorAll('.right-tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `${name}Tab`);
    });
  }

  function setCopilotWorkflow(task) {
    const select = el('copilotTask');
    if (!select) return;
    select.value = task;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setCopilotPrompt(text, options = {}) {
    const prompt = el('copilotPrompt');
    if (!prompt) return;
    if (options.overwrite || !prompt.value.trim()) {
      prompt.value = text || '';
      prompt.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function focusCopilotPrompt() {
    const prompt = el('copilotPrompt');
    if (prompt) {
      prompt.focus({ preventScroll: false });
      try { prompt.setSelectionRange(prompt.value.length, prompt.value.length); } catch (_err) {}
    }
  }

  function prepareCopilot({ task = 'rewrite-selection-patch', prompt = '', overwritePrompt = false, ask = false } = {}) {
    const ss = selectionService();
    ss?.freezeSourceSelection?.('selection-action-bubble');
    const sel = ss?.getSourceSelection?.({ allowStale: true });
    if (!sel?.text?.trim()) {
      toast('No source selection is active.');
      return false;
    }

    openRightTab('copilot');
    setCopilotWorkflow(task);
    if (prompt) setCopilotPrompt(prompt, { overwrite: overwritePrompt });
    try { NS.Copilot?.renderContextChips?.(); } catch (_err) {}

    if (ask) {
      setTimeout(() => el('askCopilotBtn')?.click(), 220);
      hide();
    } else {
      setTimeout(focusCopilotPrompt, 80);
    }
    return true;
  }

  function rewrite() {
    prepareCopilot({
      task: 'rewrite-selection-patch',
      prompt: 'Rewrite the selected LaTeX clearly. Preserve mathematical meaning and valid LaTeX.',
      overwritePrompt: false,
      ask: false
    });
  }

  function improve() {
    prepareCopilot({
      task: 'rewrite-selection-patch',
      prompt: 'Improve the selected LaTeX for clarity, flow, precision, and readability. Preserve all mathematical meaning and valid LaTeX.',
      overwritePrompt: true,
      ask: false
    });
  }

  function askRewrite() {
    prepareCopilot({
      task: 'rewrite-selection-patch',
      prompt: 'Rewrite the selected LaTeX clearly. Preserve mathematical meaning and valid LaTeX.',
      overwritePrompt: false,
      ask: true
    });
  }

  function explain() {
    const ss = selectionService();
    ss?.freezeSourceSelection?.('selection-action-bubble-explain');
    const sel = ss?.getSourceSelection?.({ allowStale: true });
    if (!sel?.text?.trim()) {
      toast('No source selection is active.');
      return;
    }
    openRightTab('copilot');
    setCopilotWorkflow('raw-advice');
    setCopilotPrompt('Explain the selected LaTeX/source. Point out any mathematical or writing issues, but do not edit the file yet.', { overwrite: true });
    try { NS.Copilot?.renderContextChips?.(); } catch (_err) {}
    setTimeout(focusCopilotPrompt, 80);
  }

  function findSource() {
    const ss = selectionService();
    const preview = ss?.capturePreviewSelection?.({ source: 'selection-action-bubble-find-source', findSource: true });
    const source = ss?.getSourceSelection?.({ allowStale: true });
    if (source?.text?.trim()) {
      toast(`Source selected in ${source.path || 'current file'}.`);
      showForSelection(source, { force: true });
      return;
    }
    if (!preview?.text) toast('No preview/PDF text selection was found.');
  }

  function close() {
    hide();
  }

  function makeButton(label, className, handler, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `lai-bubble-btn ${className || ''}`.trim();
    b.textContent = label;
    if (title) b.title = title;
    b.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      handler();
    }, true);
    return b;
  }

  function ensureBubble() {
    if (bubble) return bubble;
    bubble = document.createElement('div');
    bubble.id = 'laiSelectionActionBubble';
    bubble.className = 'lai-selection-action-bubble';
    bubble.setAttribute('role', 'toolbar');
    bubble.setAttribute('aria-label', 'Selection actions');

    const label = document.createElement('span');
    label.className = 'lai-bubble-label';
    label.id = 'laiSelectionActionLabel';
    label.textContent = 'Selection';

    bubble.append(
      label,
      makeButton('Rewrite', 'primary', rewrite, 'Prepare Copilot rewrite for this source selection'),
      makeButton('Improve', '', improve, 'Prepare an improvement prompt for this source selection'),
      makeButton('Ask rewrite', '', askRewrite, 'Immediately ask Copilot to rewrite this source selection'),
      makeButton('Explain', '', explain, 'Ask Copilot to explain the selected source'),
      makeButton('Find source', '', findSource, 'For draft/PDF selections, locate corresponding source'),
      (() => {
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'lai-bubble-close';
        x.textContent = '×';
        x.title = 'Hide';
        x.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          close();
        }, true);
        return x;
      })()
    );

    document.body.appendChild(bubble);
    return bubble;
  }

  function selectionRect() {
    const sel = W.getSelection?.();
    if (sel && sel.rangeCount > 0 && String(sel.toString() || '').trim()) {
      try {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect && rect.width && rect.height) return rect;
      } catch (_err) {}
    }

    const ed = el('sourceEditor');
    if (ed) {
      const rect = ed.getBoundingClientRect();
      if (rect.width && rect.height) {
        return {
          left: rect.left + Math.min(rect.width - 80, Math.max(20, lastPointer.x ? lastPointer.x - rect.left : rect.width * .45)),
          right: rect.left + Math.min(rect.width - 20, Math.max(80, lastPointer.x ? lastPointer.x - rect.left + 80 : rect.width * .75)),
          top: rect.top + 12,
          bottom: rect.top + 36,
          width: 160,
          height: 24
        };
      }
    }

    return { left: window.innerWidth / 2 - 80, right: window.innerWidth / 2 + 80, top: 80, bottom: 105, width: 160, height: 25 };
  }

  function positionBubble() {
    if (!bubble || !bubble.classList.contains('active')) return;
    const rect = selectionRect();

    bubble.style.left = '0px';
    bubble.style.top = '0px';
    bubble.style.right = 'auto';
    bubble.style.bottom = 'auto';

    const b = bubble.getBoundingClientRect();
    const margin = 10;
    let left = rect.left + rect.width / 2 - b.width / 2;
    let top = rect.top - b.height - 10;
    if (top < margin) top = rect.bottom + 10;
    left = Math.max(margin, Math.min(left, window.innerWidth - b.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - b.height - margin));

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  }

  function hide() {
    if (!bubble) return;
    bubble.classList.remove('active');
    activeSelection = null;
  }

  function showForSelection(selection, options = {}) {
    const ss = selectionService();
    const sel = selection || ss?.getSourceSelection?.({ allowStale: true });
    if (!sel?.text?.trim() && !options.force) return false;

    activeSelection = sel;
    ensureBubble();

    const label = el('laiSelectionActionLabel');
    if (label) {
      const len = sel?.text?.length || 0;
      const type = sel?.type || 'source';
      label.textContent = `${type === 'source' ? 'Source' : 'Selection'} · ${len} chars`;
    }

    bubble.classList.add('active');
    positionBubble();
    return true;
  }

  function updateFromSelection(reason = 'selection') {
    clearTimeout(hideTimer);
    const target = document.activeElement;

    // Do not pop over normal typing in prompt/settings inputs unless source selection was frozen.
    if (isTextInput(target) && target?.id !== 'sourceEditor') {
      const frozen = selectionService()?.getSourceSelection?.({ allowStale: true });
      if (frozen?.text?.trim()) showForSelection(frozen);
      return;
    }

    const ss = selectionService();
    const source = ss?.captureSourceSelection?.({ source: `bubble-${reason}`, freeze: false, allowEmpty: false }) ||
      ss?.getSourceSelection?.({ allowStale: true });

    if (source?.text?.trim()) {
      showForSelection(source);
      return;
    }

    const preview = ss?.capturePreviewSelection?.({ source: `bubble-${reason}`, findSource: false });
    if (preview?.text?.trim()) {
      activeSelection = preview;
      ensureBubble();
      const label = el('laiSelectionActionLabel');
      if (label) label.textContent = `Preview · ${preview.text.length} chars`;
      bubble.classList.add('active');
      positionBubble();
      return;
    }

    hideTimer = setTimeout(hide, 600);
  }

  function bindEvents() {
    if (installed) return;
    installed = true;

    document.addEventListener('pointerup', (event) => {
      lastPointer = { x: event.clientX || 0, y: event.clientY || 0 };
      setTimeout(() => updateFromSelection('pointerup'), 80);
    }, true);

    document.addEventListener('keyup', () => setTimeout(() => updateFromSelection('keyup'), 80), true);

    document.addEventListener('selectionchange', () => {
      clearTimeout(hideTimer);
      setTimeout(() => updateFromSelection('selectionchange'), 120);
    });

    document.querySelector('.right-panel')?.addEventListener('focusin', () => {
      const sel = selectionService()?.freezeSourceSelection?.('bubble-right-focus');
      if (sel?.text?.trim()) setTimeout(() => showForSelection(sel), 60);
    }, true);

    document.querySelector('.right-panel')?.addEventListener('pointerdown', () => {
      const sel = selectionService()?.freezeSourceSelection?.('bubble-right-pointerdown');
      if (sel?.text?.trim()) setTimeout(() => showForSelection(sel), 60);
    }, true);

    window.addEventListener('resize', positionBubble);
    document.addEventListener('scroll', positionBubble, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hide();
    }, true);
  }

  function init() {
    ensureBubble();
    bindEvents();
  }

  NS.SelectionActionBubble = {
    STAGE,
    init,
    showForSelection,
    hide,
    prepareCopilot,
    rewrite,
    improve,
    askRewrite,
    explain,
    findSource,
    getActiveSelection: () => activeSelection
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

/* Latexai Stage 7D PDFRegionSelectionService
 * Stage: stage7d-pdf-region-selection-1
 *
 * Adds rectangle selection over the PDF.js preview. It does not mutate source.
 * It captures:
 * - page number
 * - rectangle coordinates
 * - cropped PNG data URL
 * - extractable PDF text inside the rectangle, when available
 *
 * Source edits still go through SelectionService + Copilot + PatchService.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage7d-pdf-region-selection-1';

  let enabled = false;
  let drawing = null;
  let currentRegion = null;
  let regionRectEl = null;
  let hud = null;
  let installed = false;

  function el(id) { return document.getElementById(id); }

  function toast(message) {
    try { NS.Main?.toast?.(message); }
    catch (_err) {}
  }

  function viewer() { return el('laiPdfViewer'); }
  function pagesHost() { return el('laiPdfPages'); }

  function openRightTab(name) {
    const button = document.querySelector(`.right-tab[data-right-tab="${name}"]`);
    if (button) button.click();

    document.querySelectorAll('.right-tab').forEach((b) => b.classList.toggle('active', b.dataset.rightTab === name));
    document.querySelectorAll('.right-tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `${name}Tab`);
    });
  }

  function findPageWrap(target) {
    return target?.closest?.('.lai-pdf-page-wrap') || null;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, Number(n) || 0));
  }

  function pointInPage(event, pageWrap) {
    const rect = pageWrap.getBoundingClientRect();
    return {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
      width: rect.width,
      height: rect.height
    };
  }

  function normalizedRect(a, b) {
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const width = Math.abs(a.x - b.x);
    const height = Math.abs(a.y - b.y);
    return { left, top, width, height, right: left + width, bottom: top + height };
  }

  function ensureButton() {
    const toolbarActions = document.querySelector('#laiPdfViewer .lai-pdf-toolbar-actions');
    if (!toolbarActions || el('laiPdfRegionBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'laiPdfRegionBtn';
    btn.className = 'lai-pdf-btn';
    btn.textContent = 'Region';
    btn.title = 'Select a rectangular region on the PDF page';
    btn.addEventListener('click', () => toggle(), true);

    const openBtn = el('laiPdfOpenBtn');
    if (openBtn && openBtn.parentElement === toolbarActions) toolbarActions.insertBefore(btn, openBtn);
    else toolbarActions.appendChild(btn);
  }

  function ensureHud() {
    if (hud) return hud;
    const v = viewer();
    if (!v) return null;

    hud = document.createElement('div');
    hud.id = 'laiPdfRegionHud';
    hud.className = 'lai-pdf-region-hud hidden';
    hud.innerHTML = [
      '<div class="lai-pdf-region-hud-title">',
      '  <span>PDF region</span>',
      '  <button type="button" class="lai-pdf-region-action" id="laiPdfRegionCloseBtn">×</button>',
      '</div>',
      '<div class="lai-pdf-region-hud-status" id="laiPdfRegionStatus">Turn on Region, then drag over a PDF page.</div>',
      '<img id="laiPdfRegionThumb" class="lai-pdf-region-thumb hidden" alt="Selected PDF region crop" />',
      '<div id="laiPdfRegionText" class="lai-pdf-region-text hidden"></div>',
      '<div class="lai-pdf-region-actions">',
      '  <button type="button" class="lai-pdf-region-action primary" id="laiPdfRegionFindSourceBtn">Find source</button>',
      '  <button type="button" class="lai-pdf-region-action" id="laiPdfRegionAskBtn">Ask Copilot</button>',
      '  <button type="button" class="lai-pdf-region-action" id="laiPdfRegionDownloadBtn">Download crop</button>',
      '  <button type="button" class="lai-pdf-region-action" id="laiPdfRegionClearBtn">Clear</button>',
      '</div>'
    ].join('');

    v.appendChild(hud);

    el('laiPdfRegionCloseBtn')?.addEventListener('click', hideHud, true);
    el('laiPdfRegionFindSourceBtn')?.addEventListener('click', findSourceForRegion, true);
    el('laiPdfRegionAskBtn')?.addEventListener('click', askCopilotAboutRegion, true);
    el('laiPdfRegionDownloadBtn')?.addEventListener('click', downloadCrop, true);
    el('laiPdfRegionClearBtn')?.addEventListener('click', clearRegion, true);

    return hud;
  }

  function setStatus(message) {
    ensureHud();
    const status = el('laiPdfRegionStatus');
    if (status) status.textContent = message;
  }

  function showHud() {
    ensureHud();
    hud?.classList.remove('hidden');
  }

  function hideHud() {
    hud?.classList.add('hidden');
  }

  function updateButton() {
    const btn = el('laiPdfRegionBtn');
    if (!btn) return;
    btn.classList.toggle('lai-pdf-region-btn-active', enabled);
    btn.textContent = enabled ? 'Region: on' : 'Region';
  }

  function setEnabled(value) {
    enabled = !!value;
    viewer()?.classList.toggle('lai-region-mode', enabled);
    updateButton();
    ensureHud();
    if (enabled) {
      showHud();
      setStatus('Drag over a PDF page to select a rectangular region.');
    } else if (!currentRegion) {
      hideHud();
    }
  }

  function toggle() {
    setEnabled(!enabled);
  }

  function clearTransientRect() {
    if (regionRectEl) regionRectEl.remove();
    regionRectEl = null;
  }

  function clearRegion() {
    currentRegion = null;
    clearTransientRect();
    const img = el('laiPdfRegionThumb');
    if (img) {
      img.removeAttribute('src');
      img.classList.add('hidden');
    }
    const text = el('laiPdfRegionText');
    if (text) {
      text.textContent = '';
      text.classList.add('hidden');
    }
    setStatus(enabled ? 'Drag over a PDF page to select a rectangular region.' : 'No PDF region selected.');
    if (!enabled) hideHud();
  }

  function makeRectEl(pageWrap) {
    clearTransientRect();
    regionRectEl = document.createElement('div');
    regionRectEl.className = 'lai-pdf-region-rect';
    pageWrap.appendChild(regionRectEl);
    return regionRectEl;
  }

  function renderRect(rect) {
    if (!regionRectEl) return;
    regionRectEl.style.left = `${rect.left}px`;
    regionRectEl.style.top = `${rect.top}px`;
    regionRectEl.style.width = `${rect.width}px`;
    regionRectEl.style.height = `${rect.height}px`;
  }

  function cropCanvas(pageWrap, rect) {
    const canvas = pageWrap.querySelector('canvas.lai-pdf-page');
    if (!canvas || rect.width < 2 || rect.height < 2) return null;

    const cssWidth = Number(canvas.getBoundingClientRect().width || canvas.clientWidth || 1);
    const cssHeight = Number(canvas.getBoundingClientRect().height || canvas.clientHeight || 1);
    const sx = Math.round(rect.left / cssWidth * canvas.width);
    const sy = Math.round(rect.top / cssHeight * canvas.height);
    const sw = Math.max(1, Math.round(rect.width / cssWidth * canvas.width));
    const sh = Math.max(1, Math.round(rect.height / cssHeight * canvas.height));

    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const ctx = out.getContext('2d');
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL('image/png');
  }

  function textInsideRegion(pageWrap, rect) {
    const layer = pageWrap.querySelector('.lai-pdf-text-layer');
    if (!layer) return '';
    const pageBounds = pageWrap.getBoundingClientRect();
    const selected = [];

    const regionBounds = {
      left: pageBounds.left + rect.left,
      top: pageBounds.top + rect.top,
      right: pageBounds.left + rect.right,
      bottom: pageBounds.top + rect.bottom
    };

    layer.querySelectorAll('span').forEach((span) => {
      const text = String(span.textContent || '').trim();
      if (!text) return;
      const b = span.getBoundingClientRect();
      const intersects = !(b.right < regionBounds.left || b.left > regionBounds.right || b.bottom < regionBounds.top || b.top > regionBounds.bottom);
      if (intersects) selected.push(text);
    });

    return selected.join(' ').replace(/\s+/g, ' ').trim();
  }

  function finalizeRegion(event) {
    if (!drawing) return;
    const pageWrap = drawing.pageWrap;
    const end = pointInPage(event, pageWrap);
    const rect = normalizedRect(drawing.start, end);

    if (rect.width < 12 || rect.height < 12) {
      setStatus('Region was too small. Drag a larger rectangle over the PDF page.');
      drawing = null;
      clearTransientRect();
      return;
    }

    renderRect(rect);

    const page = Number(pageWrap.dataset.page || 0);
    const cropDataUrl = cropCanvas(pageWrap, rect);
    const extractedText = textInsideRegion(pageWrap, rect);

    currentRegion = {
      schema: 'latexai-pdf-region-v1',
      stage: STAGE,
      page,
      rect,
      cropDataUrl,
      extractedText,
      createdAt: new Date().toISOString()
    };

    const img = el('laiPdfRegionThumb');
    if (img && cropDataUrl) {
      img.src = cropDataUrl;
      img.classList.remove('hidden');
    }

    const textBox = el('laiPdfRegionText');
    if (textBox) {
      textBox.textContent = extractedText || 'No extractable text found in this region.';
      textBox.classList.remove('hidden');
    }

    setStatus(`Selected page ${page} region: ${Math.round(rect.width)}×${Math.round(rect.height)} px.${extractedText ? '\nExtracted text is available.' : '\nNo text layer content was found inside the region.'}`);
    showHud();
    drawing = null;
  }

  function onPointerDown(event) {
    if (!enabled) return;
    const pageWrap = findPageWrap(event.target);
    if (!pageWrap) return;

    event.preventDefault();
    event.stopPropagation();

    const start = pointInPage(event, pageWrap);
    drawing = { pageWrap, start };
    makeRectEl(pageWrap);
    renderRect({ left: start.x, top: start.y, width: 0, height: 0, right: start.x, bottom: start.y });

    try { pageWrap.setPointerCapture?.(event.pointerId); } catch (_err) {}
  }

  function onPointerMove(event) {
    if (!enabled || !drawing || !regionRectEl) return;
    event.preventDefault();
    event.stopPropagation();
    const current = pointInPage(event, drawing.pageWrap);
    renderRect(normalizedRect(drawing.start, current));
  }

  function onPointerUp(event) {
    if (!enabled || !drawing) return;
    event.preventDefault();
    event.stopPropagation();
    finalizeRegion(event);
  }

  function findSourceForRegion() {
    if (!currentRegion) {
      setStatus('No PDF region selected yet.');
      return false;
    }
    const text = String(currentRegion.extractedText || '').trim();
    if (!text) {
      setStatus('This region has no extractable PDF text. Use Ask Copilot for a visual note, or select nearby draft/PDF text.');
      return false;
    }

    const match = NS.SelectionService?.findSourceForText?.(text);
    if (!match) {
      setStatus('Could not confidently match the region text to source.');
      return false;
    }

    NS.SelectionService?.setSourceSelection?.(match.path, match.start, match.end, {
      freeze: true,
      source: 'pdf-region-selection',
      confidence: match.score,
      method: match.method || 'region-text'
    });

    setStatus(`Matched region text to source in ${match.path}.`);
    toast(`Source selected in ${match.path}.`);
    return true;
  }

  function askCopilotAboutRegion() {
    if (!currentRegion) {
      setStatus('No PDF region selected yet.');
      return;
    }

    const matched = findSourceForRegion();
    openRightTab('copilot');

    const prompt = el('copilotPrompt');
    const task = el('copilotTask');
    if (task) {
      task.value = matched ? 'rewrite-selection-patch' : 'raw-advice';
      task.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const text = String(currentRegion.extractedText || '').trim();
    const message = matched
      ? `I selected a PDF region on page ${currentRegion.page}. The corresponding LaTeX source is selected. Improve or rewrite the selected source so that the PDF region reads better. Preserve mathematical meaning and valid LaTeX. Extracted PDF text from the region:\n\n${text}`
      : `I selected a PDF region on page ${currentRegion.page}, but no source text could be matched automatically. Use this as context for advice. Extracted PDF text, if any:\n\n${text || '[No extractable text in this region. The crop is stored in the browser as PreviewRegionService.getCurrentRegion().cropDataUrl for future multimodal support.]'}`;

    if (prompt) {
      prompt.value = message;
      prompt.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => prompt.focus({ preventScroll: false }), 80);
    }

    try { NS.Copilot?.renderContextChips?.(); } catch (_err) {}
    setStatus(matched ? 'Copilot is ready to rewrite the matched source.' : 'Copilot prompt prepared. No source was matched automatically.');
  }

  function downloadCrop() {
    if (!currentRegion?.cropDataUrl) {
      setStatus('No crop image is available yet.');
      return;
    }
    const a = document.createElement('a');
    a.href = currentRegion.cropDataUrl;
    a.download = `latexai-pdf-region-page-${currentRegion.page || 'unknown'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function installEvents() {
    const host = pagesHost();
    if (!host || host.__stage7dRegionInstalled) return;
    host.addEventListener('pointerdown', onPointerDown, true);
    host.addEventListener('pointermove', onPointerMove, true);
    host.addEventListener('pointerup', onPointerUp, true);
    host.addEventListener('pointercancel', () => { drawing = null; clearTransientRect(); }, true);
    host.__stage7dRegionInstalled = true;
  }

  function init() {
    ensureButton();
    ensureHud();
    installEvents();
  }

  NS.PDFRegionSelectionService = {
    STAGE,
    init,
    toggle,
    setEnabled,
    clearRegion,
    findSourceForRegion,
    askCopilotAboutRegion,
    downloadCrop,
    getCurrentRegion: () => currentRegion
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    init();
    tries += 1;
    if (tries > 30) clearInterval(interval);
  }, 500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

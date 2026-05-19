/* Latexai Stage 5F: multi-page PDF viewer with independent zoom
 * Stage: stage5g-selectable-pdf-text-layer-1
 *
 * Adds right-panel PDF zoom that is independent of browser/page zoom:
 * - toolbar buttons: −, zoom %, +, Fit width, Open PDF
 * - selectable text layer over the rendered PDF pages
 * - pinch inside the PDF pages area adjusts only the PDF preview
 * - Ctrl/trackpad wheel zoom inside PDF pages also adjusts only the PDF preview
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage5g-selectable-pdf-text-layer-1';

  const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  let lastBlobUrl = null;
  let lastBytes = null;
  let renderSerial = 0;
  let loadingPdfJs = null;

  let zoom = 1;
  const MIN_ZOOM = 0.45;
  const MAX_ZOOM = 4.0;
  const ZOOM_STEP = 1.18;

  let pinchStartDistance = null;
  let pinchStartZoom = 1;

  function el(id) { return document.getElementById(id); }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 1));
  }

  function zoomPercent() {
    return `${Math.round(zoom * 100)}%`;
  }

  function updateZoomUi() {
    const label = el('laiPdfZoomLabel');
    if (label) label.textContent = zoomPercent();
    const title = el('laiPdfTitle');
    if (title && title.dataset.pageCount) {
      const n = Number(title.dataset.pageCount || 0);
      title.textContent = `PDF preview · ${n} page${n === 1 ? '' : 's'} · ${zoomPercent()}`;
    }
  }

  function setZoom(nextZoom, options = {}) {
    const pages = el('laiPdfPages');
    const oldZoom = zoom;
    zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    updateZoomUi();

    if (!lastBytes || Math.abs(oldZoom - zoom) < 0.005) return;

    const keep = captureScrollAnchor(pages, options.anchorClientX, options.anchorClientY);
    renderPdfBytes(lastBytes, { reason: options.reason || 'zoom', keep });
  }

  function fitWidth() {
    zoom = 1;
    updateZoomUi();
    if (lastBytes) renderPdfBytes(lastBytes, { reason: 'fit-width' });
  }

  function captureScrollAnchor(container, clientX, clientY) {
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = Number.isFinite(clientX) ? clientX - rect.left : rect.width / 2;
    const y = Number.isFinite(clientY) ? clientY - rect.top : rect.height / 2;
    return {
      ratioX: (container.scrollLeft + x) / Math.max(container.scrollWidth, 1),
      ratioY: (container.scrollTop + y) / Math.max(container.scrollHeight, 1)
    };
  }

  function restoreScrollAnchor(container, keep) {
    if (!container || !keep) return;
    container.scrollLeft = Math.max(0, keep.ratioX * container.scrollWidth - container.clientWidth / 2);
    container.scrollTop = Math.max(0, keep.ratioY * container.scrollHeight - container.clientHeight / 2);
  }

  function ensureViewer() {
    const iframe = el('pdfPreview');
    if (!iframe) return null;

    let viewer = el('laiPdfViewer');
    if (viewer) return viewer;

    viewer = document.createElement('div');
    viewer.id = 'laiPdfViewer';
    viewer.className = 'hidden';
    viewer.innerHTML = [
      '<div class="lai-pdf-toolbar">',
      '  <div class="lai-pdf-toolbar-title" id="laiPdfTitle">PDF preview</div>',
      '  <div class="lai-pdf-toolbar-actions">',
      '    <button type="button" class="lai-pdf-btn" id="laiPdfZoomOutBtn" title="Zoom out PDF only">−</button>',
      '    <span class="lai-pdf-zoom-label" id="laiPdfZoomLabel">100%</span>',
      '    <button type="button" class="lai-pdf-btn" id="laiPdfZoomInBtn" title="Zoom in PDF only">+</button>',
      '    <button type="button" class="lai-pdf-btn" id="laiPdfFitBtn">Fit width</button>',
      '    <button type="button" class="lai-pdf-btn" id="laiPdfOpenBtn">Open PDF</button>',
      '  </div>',
      '</div>',
      '<div class="lai-pdf-pages" id="laiPdfPages"><div class="lai-pdf-status">No PDF loaded.</div></div>'
    ].join('');

    iframe.parentNode.insertBefore(viewer, iframe.nextSibling);
    iframe.classList.add('lai-native-hidden');

    el('laiPdfOpenBtn')?.addEventListener('click', () => {
      if (lastBlobUrl) W.open(lastBlobUrl, '_blank', 'noopener,noreferrer');
    });

    el('laiPdfFitBtn')?.addEventListener('click', fitWidth);
    el('laiPdfZoomOutBtn')?.addEventListener('click', () => setZoom(zoom / ZOOM_STEP, { reason: 'zoom-out-button' }));
    el('laiPdfZoomInBtn')?.addEventListener('click', () => setZoom(zoom * ZOOM_STEP, { reason: 'zoom-in-button' }));

    installIndependentZoomGestures(viewer);
    updateZoomUi();

    return viewer;
  }

  function setStatus(message) {
    ensureViewer();
    const pages = el('laiPdfPages');
    if (pages) pages.innerHTML = `<div class="lai-pdf-status">${escapeHtml(message)}</div>`;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function bytesFromBase64(base64) {
    const binary = atob(String(base64 || ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function ensureBlobUrl(bytes) {
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    lastBlobUrl = URL.createObjectURL(blob);
    return lastBlobUrl;
  }

  function loadPdfJs() {
    if (W.pdfjsLib) return Promise.resolve(W.pdfjsLib);
    if (loadingPdfJs) return loadingPdfJs;

    loadingPdfJs = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PDFJS_URL;
      script.async = true;
      script.onload = () => {
        if (!W.pdfjsLib) {
          reject(new Error('pdfjsLib did not initialize'));
          return;
        }
        W.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        resolve(W.pdfjsLib);
      };
      script.onerror = () => reject(new Error('Could not load PDF.js from CDN'));
      document.head.appendChild(script);
    });

    return loadingPdfJs;
  }

  async function renderSelectableTextLayer(pdfjs, page, viewport, pageWrap) {
    try {
      const textLayer = document.createElement('div');
      textLayer.className = 'lai-pdf-text-layer textLayer';
      textLayer.style.width = `${Math.floor(viewport.width)}px`;
      textLayer.style.height = `${Math.floor(viewport.height)}px`;
      pageWrap.appendChild(textLayer);

      const textContent = await page.getTextContent();

      if (typeof pdfjs.renderTextLayer === 'function') {
        const task = pdfjs.renderTextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport,
          textDivs: []
        });
        if (task?.promise) await task.promise;
        return textLayer;
      }

      // Fallback if pdfjs.renderTextLayer is not exposed by this build.
      for (const item of textContent.items || []) {
        const span = document.createElement('span');
        span.textContent = item.str || '';
        const tx = pdfjs.Util.transform(viewport.transform, item.transform);
        const fontHeight = Math.hypot(tx[2], tx[3]) || Math.abs(tx[3]) || 10;
        span.style.left = `${tx[4]}px`;
        span.style.top = `${tx[5] - fontHeight}px`;
        span.style.fontSize = `${fontHeight}px`;
        span.style.transform = `scaleX(${Math.max(0.2, (item.width || 1) * viewport.scale / Math.max(1, span.textContent.length * fontHeight * 0.45))})`;
        textLayer.appendChild(span);
      }
      return textLayer;
    } catch (err) {
      console.warn('[Latexai Stage 5G] Could not render selectable PDF text layer.', err);
      return null;
    }
  }

  async function renderPdfBytes(bytes, options = {}) {
    const serial = ++renderSerial;
    lastBytes = bytes;

    const viewer = ensureViewer();
    if (!viewer) return null;

    const pagesHost = el('laiPdfPages');
    if (!pagesHost) return null;

    try {
      setStatus('Loading PDF preview...');
      const pdfjs = await loadPdfJs();
      if (serial !== renderSerial) return lastBlobUrl;

      const loadingTask = pdfjs.getDocument({ data: bytes.slice ? bytes.slice(0) : bytes });
      const pdf = await loadingTask.promise;
      if (serial !== renderSerial) return lastBlobUrl;

      const title = el('laiPdfTitle');
      if (title) {
        title.dataset.pageCount = String(pdf.numPages);
        title.textContent = `PDF preview · ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'} · ${zoomPercent()}`;
      }

      pagesHost.innerHTML = '';

      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        if (serial !== renderSerial) return lastBlobUrl;

        const page = await pdf.getPage(pageNo);
        const hostWidth = Math.max(320, pagesHost.clientWidth - 32);
        const viewport1 = page.getViewport({ scale: 1 });
        const fitScale = Math.max(0.35, hostWidth / viewport1.width);
        const scale = Math.max(0.25, Math.min(6.0, fitScale * zoom));
        const viewport = page.getViewport({ scale });

        const pageWrap = document.createElement('div');
        pageWrap.className = 'lai-pdf-page-wrap';
        pageWrap.dataset.page = String(pageNo);
        pageWrap.style.width = `${Math.floor(viewport.width)}px`;
        pageWrap.style.height = `${Math.floor(viewport.height)}px`;

        const canvas = document.createElement('canvas');
        canvas.className = 'lai-pdf-page';
        canvas.dataset.page = String(pageNo);

        const dpr = Math.max(1, Math.min(W.devicePixelRatio || 1, 2));
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        pageWrap.appendChild(canvas);
        pagesHost.appendChild(pageWrap);

        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        await page.render({ canvasContext: ctx, viewport }).promise;
        await renderSelectableTextLayer(pdfjs, page, viewport, pageWrap);
      }

      restoreScrollAnchor(pagesHost, options.keep);
      updateZoomUi();
      return lastBlobUrl;
    } catch (err) {
      // Fallback: native browser PDF iframe with explicit object URL.
      const iframe = el('pdfPreview');
      if (iframe && lastBlobUrl) {
        iframe.classList.remove('lai-native-hidden');
        iframe.src = lastBlobUrl + '#view=FitH&toolbar=1&navpanes=0';
        viewer.classList.add('hidden');
      }
      console.warn('[Latexai Stage 5F] PDF.js render failed; using native iframe fallback.', err);
      return lastBlobUrl;
    }
  }

  function showPdf(base64) {
    const iframe = el('pdfPreview');
    const viewer = ensureViewer();

    if (!base64 || !iframe || !viewer) return null;

    const bytes = bytesFromBase64(base64);
    const url = ensureBlobUrl(bytes);

    iframe.src = url + '#view=FitH&toolbar=1&navpanes=0';
    iframe.classList.add('lai-native-hidden');

    renderPdfBytes(bytes, { reason: 'showPdf' });
    return url;
  }

  function setMode(mode) {
    const draft = el('draftPreview');
    const iframe = el('pdfPreview');
    const viewer = ensureViewer();
    const draftBtn = el('showDraftPreviewBtn');
    const pdfBtn = el('showPdfPreviewBtn');

    const isPdf = mode === 'pdf';

    draft?.classList.toggle('hidden', isPdf);
    iframe?.classList.add('lai-native-hidden');
    viewer?.classList.toggle('hidden', !isPdf);

    draftBtn?.classList.toggle('active', !isPdf);
    pdfBtn?.classList.toggle('active', isPdf);

    try { NS.State?.setSetting?.('previewMode', isPdf ? 'pdf' : 'draft'); } catch (_err) {}
    return isPdf ? 'pdf' : 'draft';
  }

  function patchPreviewAdapter() {
    NS.PreviewAdapter = NS.PreviewAdapter || {};
    NS.PreviewAdapter.showPdf = showPdf;
    NS.PreviewAdapter.setMode = setMode;

    const oldClear = NS.PreviewAdapter.clearPdf?.bind(NS.PreviewAdapter);
    NS.PreviewAdapter.clearPdf = function () {
      if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
      lastBlobUrl = null;
      lastBytes = null;
      renderSerial += 1;
      const pages = el('laiPdfPages');
      if (pages) pages.innerHTML = '<div class="lai-pdf-status">No PDF loaded.</div>';
      const iframe = el('pdfPreview');
      if (iframe) iframe.removeAttribute('src');
      if (oldClear) {
        try { oldClear(); } catch (_err) {}
      }
    };
  }

  function patchPreviewModeButtons() {
    el('showDraftPreviewBtn')?.addEventListener('click', () => setMode('draft'), true);
    el('showPdfPreviewBtn')?.addEventListener('click', () => setMode('pdf'), true);
  }

  function touchDistance(touches) {
    if (!touches || touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function touchCenter(touches) {
    if (!touches || touches.length < 2) return { x: null, y: null };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  function installIndependentZoomGestures(viewer) {
    const pages = viewer.querySelector('#laiPdfPages');
    if (!pages || pages.__stage5fZoomInstalled) return;

    // Ctrl/trackpad pinch wheel on desktop browsers.
    pages.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setZoom(zoom * factor, {
        reason: 'wheel-zoom',
        anchorClientX: event.clientX,
        anchorClientY: event.clientY
      });
    }, { passive: false });

    // iOS/Safari two-finger pinch inside the PDF panel.
    pages.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 2) return;
      pinchStartDistance = touchDistance(event.touches);
      pinchStartZoom = zoom;
    }, { passive: false });

    pages.addEventListener('touchmove', (event) => {
      if (event.touches.length !== 2 || !pinchStartDistance) return;
      event.preventDefault();
      event.stopPropagation();
      const dist = touchDistance(event.touches);
      if (!dist) return;
      const center = touchCenter(event.touches);
      const nextZoom = pinchStartZoom * (dist / pinchStartDistance);
      // Throttle by only re-rendering when zoom changes noticeably.
      if (Math.abs(nextZoom - zoom) / zoom > 0.08) {
        setZoom(nextZoom, {
          reason: 'touch-pinch',
          anchorClientX: center.x,
          anchorClientY: center.y
        });
      }
    }, { passive: false });

    pages.addEventListener('touchend', () => {
      pinchStartDistance = null;
      pinchStartZoom = zoom;
    }, { passive: true });

    // Older Safari gesture events.
    pages.addEventListener('gesturestart', (event) => {
      event.preventDefault();
      pinchStartZoom = zoom;
    }, { passive: false });

    pages.addEventListener('gesturechange', (event) => {
      event.preventDefault();
      const nextZoom = pinchStartZoom * Number(event.scale || 1);
      if (Math.abs(nextZoom - zoom) / zoom > 0.08) {
        setZoom(nextZoom, { reason: 'safari-gesture', anchorClientX: event.clientX, anchorClientY: event.clientY });
      }
    }, { passive: false });

    pages.__stage5fZoomInstalled = true;
  }

  function installResizeRerender() {
    if (W.__stage5fResizeInstalled) return;
    let timer = null;
    W.addEventListener('resize', () => {
      if (!lastBytes || el('laiPdfViewer')?.classList.contains('hidden')) return;
      clearTimeout(timer);
      timer = setTimeout(() => renderPdfBytes(lastBytes, { reason: 'resize' }), 300);
    });
    W.__stage5fResizeInstalled = true;
  }

  function boot() {
    W.__LATEXAI_STAGE5F_PDF_INDEPENDENT_ZOOM_ACTIVE = true;
    ensureViewer();
    patchPreviewAdapter();
    patchPreviewModeButtons();
    installResizeRerender();

    const isPdf = !el('pdfPreview')?.classList.contains('hidden') || !el('laiPdfViewer')?.classList.contains('hidden');
    if (isPdf) setMode('pdf');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  let tries = 0;
  const id = setInterval(() => {
    boot();
    tries += 1;
    if (tries > 20) clearInterval(id);
  }, 500);

  W.LAI_STAGE5F_PDF_VIEWER = {
    STAGE,
    showPdf,
    setMode,
    renderPdfBytes,
    setZoom,
    fitWidth,
    getZoom: () => zoom,
    getLastPdfUrl: () => lastBlobUrl
  };

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

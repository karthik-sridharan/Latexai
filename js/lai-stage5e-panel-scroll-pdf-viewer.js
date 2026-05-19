/* Latexai Stage 5E: multi-page PDF viewer + panel layout helper
 * Stage: stage5e-panel-scroll-pdf-viewer-1
 *
 * Keeps the pre-5A UI shape, but:
 * - each panel is constrained to the visible viewport and scrolls internally
 * - compiled PDFs render as a scrollable multi-page PDF.js viewer instead of
 *   iPad/Safari's first-page-only iframe behavior
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage5e-panel-scroll-pdf-viewer-1';

  const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  let lastBlobUrl = null;
  let lastBytes = null;
  let renderSerial = 0;
  let loadingPdfJs = null;

  function el(id) { return document.getElementById(id); }

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

    el('laiPdfFitBtn')?.addEventListener('click', () => {
      if (lastBytes) renderPdfBytes(lastBytes, { reason: 'fit-button' });
    });

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

  async function renderPdfBytes(bytes, _options = {}) {
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
      if (title) title.textContent = `PDF preview · ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}`;

      pagesHost.innerHTML = '';

      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        if (serial !== renderSerial) return lastBlobUrl;

        const page = await pdf.getPage(pageNo);
        const hostWidth = Math.max(320, pagesHost.clientWidth - 32);
        const viewport1 = page.getViewport({ scale: 1 });
        const scale = Math.max(0.5, Math.min(2.2, hostWidth / viewport1.width));
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.className = 'lai-pdf-page';
        canvas.dataset.page = String(pageNo);

        const dpr = Math.max(1, Math.min(W.devicePixelRatio || 1, 2));
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        pagesHost.appendChild(canvas);

        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }

      return lastBlobUrl;
    } catch (err) {
      // Fallback: native browser PDF iframe with an explicit object URL.
      const iframe = el('pdfPreview');
      if (iframe && lastBlobUrl) {
        iframe.classList.remove('lai-native-hidden');
        iframe.src = lastBlobUrl + '#view=FitH&toolbar=1&navpanes=0';
        viewer.classList.add('hidden');
      }
      console.warn('[Latexai Stage 5E] PDF.js render failed; using native iframe fallback.', err);
      return lastBlobUrl;
    }
  }

  function showPdf(base64) {
    const iframe = el('pdfPreview');
    const viewer = ensureViewer();

    if (!base64 || !iframe || !viewer) return null;

    const bytes = bytesFromBase64(base64);
    const url = ensureBlobUrl(bytes);

    // Keep the native iframe source too, for Open PDF / fallback behavior.
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

  function installResizeRerender() {
    let timer = null;
    W.addEventListener('resize', () => {
      if (!lastBytes || el('laiPdfViewer')?.classList.contains('hidden')) return;
      clearTimeout(timer);
      timer = setTimeout(() => renderPdfBytes(lastBytes, { reason: 'resize' }), 300);
    });
  }

  function boot() {
    W.__LATEXAI_STAGE5E_PANEL_SCROLL_PDF_VIEWER_ACTIVE = true;
    ensureViewer();
    patchPreviewAdapter();
    patchPreviewModeButtons();
    installResizeRerender();

    // Respect current mode on reload.
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

  W.LAI_STAGE5E_PDF_VIEWER = {
    STAGE,
    showPdf,
    setMode,
    renderPdfBytes,
    getLastPdfUrl: () => lastBlobUrl
  };

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

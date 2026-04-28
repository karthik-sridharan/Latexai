(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});

  let lastPdfObjectUrl = null;

  function showPdf(base64, iframe = document.getElementById('pdfPreview')) {
    if (!iframe || !base64) return null;
    if (lastPdfObjectUrl) URL.revokeObjectURL(lastPdfObjectUrl);
    const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    lastPdfObjectUrl = URL.createObjectURL(blob);
    iframe.src = lastPdfObjectUrl;
    return lastPdfObjectUrl;
  }

  function setMode(mode) {
    const draft = document.getElementById('draftPreview');
    const pdf = document.getElementById('pdfPreview');
    const draftBtn = document.getElementById('showDraftPreviewBtn');
    const pdfBtn = document.getElementById('showPdfPreviewBtn');
    const isPdf = mode === 'pdf';
    draft?.classList.toggle('hidden', isPdf);
    pdf?.classList.toggle('hidden', !isPdf);
    draftBtn?.classList.toggle('active', !isPdf);
    pdfBtn?.classList.toggle('active', isPdf);
    return isPdf ? 'pdf' : 'draft';
  }

  function clearPdf() {
    if (lastPdfObjectUrl) URL.revokeObjectURL(lastPdfObjectUrl);
    lastPdfObjectUrl = null;
    const pdf = document.getElementById('pdfPreview');
    if (pdf) pdf.removeAttribute('src');
  }

  NS.PreviewAdapter = { showPdf, setMode, clearPdf };
})();

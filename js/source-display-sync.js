/* Latexai Stage 8B SourceDisplaySync
 * Stage: stage8b-source-display-sync-fix-1
 *
 * Keeps the persistent selection overlay and line gutter visually aligned with
 * the actual textarea editing surface.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage8b-source-display-sync-fix-1';

  function el(id) { return document.getElementById(id); }

  function applySourceMetrics() {
    const editor = el('sourceEditor');
    const gutter = el('lineGutter');
    const overlay = document.querySelector('.lai-source-selection-overlay');
    const inner = document.querySelector('.lai-source-selection-overlay-inner');
    if (!editor) return false;

    const cs = getComputedStyle(editor);
    const metrics = {
      font: cs.font,
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      tabSize: cs.tabSize || cs.getPropertyValue('tab-size') || '2',
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft
    };

    if (gutter) {
      gutter.style.font = metrics.font;
      gutter.style.lineHeight = metrics.lineHeight;
    }

    if (overlay) {
      overlay.style.font = metrics.font;
      overlay.style.fontFamily = metrics.fontFamily;
      overlay.style.fontSize = metrics.fontSize;
      overlay.style.fontWeight = metrics.fontWeight;
      overlay.style.lineHeight = metrics.lineHeight;
      overlay.style.letterSpacing = metrics.letterSpacing;
      overlay.style.tabSize = metrics.tabSize;
      overlay.style.whiteSpace = 'pre';
      overlay.style.overflowWrap = 'normal';
      overlay.style.wordBreak = 'normal';
    }

    if (inner) {
      inner.style.font = 'inherit';
      inner.style.lineHeight = 'inherit';
      inner.style.letterSpacing = 'inherit';
      inner.style.tabSize = 'inherit';
      inner.style.whiteSpace = 'pre';
      inner.style.overflowWrap = 'normal';
      inner.style.wordBreak = 'normal';
      inner.style.paddingTop = metrics.paddingTop;
      inner.style.paddingRight = metrics.paddingRight;
      inner.style.paddingBottom = metrics.paddingBottom;
      inner.style.paddingLeft = metrics.paddingLeft;
      inner.style.minWidth = 'max-content';
    }

    return true;
  }

  function init() {
    applySourceMetrics();

    const editor = el('sourceEditor');
    if (editor && !editor.__stage8bSyncBound) {
      ['input', 'scroll', 'focus', 'blur', 'select', 'keyup', 'mouseup', 'touchend'].forEach((name) => {
        editor.addEventListener(name, () => setTimeout(applySourceMetrics, 0), true);
      });
      editor.__stage8bSyncBound = true;
    }

    try {
      NS.State?.subscribe?.((_snapshot, reason) => {
        if (['load', 'reset', 'active-file', 'file-change', 'file-create', 'file-import-overwrite'].includes(reason)) {
          setTimeout(applySourceMetrics, 30);
        }
      });
    } catch (_err) {}
  }

  W.LAI_STAGE8B_SOURCE_DISPLAY_SYNC = {
    STAGE,
    applySourceMetrics
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let count = 0;
  const interval = setInterval(() => {
    applySourceMetrics();
    count += 1;
    if (count > 20) clearInterval(interval);
  }, 500);

  window.addEventListener('resize', () => setTimeout(applySourceMetrics, 50));

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

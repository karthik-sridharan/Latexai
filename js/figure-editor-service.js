/* Latexai Stage 8F FigureEditorService
 * Stage: stage8f-figure-editor-shapes-cursor-fix-1
 *
 * Native lightweight figure editor integrated with AssetService.
 * - Draw freehand, lines, rectangles, circles, arrows, and text on a canvas
 * - Save canvas as PNG under figures/
 * - Optionally insert a LaTeX figure snippet at the remembered editor cursor
 *
 * Future presentation-maker figure import can replace or extend this service,
 * but should keep the same AssetService handoff.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage8f-figure-editor-shapes-cursor-fix-1';

  const state = {
    tool: 'pen',
    color: '#111111',
    width: 3,
    drawing: false,
    start: null,
    last: null,
    snapshot: null,
    history: [],
    maxHistory: 40,
    textCounter: 1
  };

  let canvas = null;
  let ctx = null;
  let installed = false;

  function el(id) { return document.getElementById(id); }

  function toast(message) {
    try { NS.Main?.toast?.(message); }
    catch (_err) {}
  }

  function setStatus(message) {
    const node = el('figureEditorStatus');
    if (node) node.textContent = message;
  }

  function getAssetService() {
    return NS.AssetService;
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)),
      y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height))
    };
  }

  function setupContext() {
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = state.color;
    ctx.fillStyle = state.color;
    ctx.lineWidth = state.width;
    ctx.font = '24px sans-serif';
  }

  function captureSnapshot() {
    if (!ctx || !canvas) return null;
    try {
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (_err) {
      return null;
    }
  }

  function restoreSnapshot(snapshot) {
    if (!ctx || !canvas || !snapshot) return false;
    try {
      ctx.putImageData(snapshot, 0, 0);
      setupContext();
      return true;
    } catch (_err) {
      return false;
    }
  }

  function blankCanvas() {
    if (!ctx || !canvas) return;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setupContext();
  }

  function pushHistory() {
    if (!canvas) return;
    try {
      state.history.push(canvas.toDataURL('image/png'));
      if (state.history.length > state.maxHistory) state.history.shift();
    } catch (_err) {}
  }

  function restoreDataUrl(dataUrl) {
    if (!ctx || !canvas || !dataUrl) return;
    const img = new Image();
    img.onload = () => {
      blankCanvas();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setupContext();
    };
    img.src = dataUrl;
  }

  function undo() {
    if (state.history.length <= 1) {
      blankCanvas();
      pushHistory();
      setStatus('Canvas cleared to blank.');
      return;
    }
    state.history.pop();
    restoreDataUrl(state.history[state.history.length - 1]);
    setStatus('Undo.');
  }

  function clearCanvas() {
    blankCanvas();
    state.history = [];
    pushHistory();
    setStatus('Canvas cleared.');
  }

  function drawLine(a, b) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function drawRect(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(a.x - b.x);
    const h = Math.abs(a.y - b.y);
    ctx.strokeRect(x, y, w, h);
  }

  function drawCircle(a, b) {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(a.x - b.x) / 2;
    const ry = Math.abs(a.y - b.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawArrow(a, b) {
    drawLine(a, b);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const head = Math.max(10, state.width * 4);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  function drawPreviewShape(current) {
    if (!state.snapshot) return;
    restoreSnapshot(state.snapshot);
    setupContext();
    if (state.tool === 'line') drawLine(state.start, current);
    else if (state.tool === 'rect') drawRect(state.start, current);
    else if (state.tool === 'circle') drawCircle(state.start, current);
    else if (state.tool === 'arrow') drawArrow(state.start, current);
  }

  function beginDraw(event) {
    if (!canvas || !ctx) return;
    event.preventDefault();
    event.stopPropagation();

    canvas.setPointerCapture?.(event.pointerId);
    state.drawing = true;
    state.start = pointFromEvent(event);
    state.last = state.start;
    state.snapshot = captureSnapshot();
    setupContext();

    if (state.tool === 'text') {
      const value = prompt('Text to add to figure:', `Label ${state.textCounter}`);
      if (value) {
        state.textCounter += 1;
        ctx.fillText(value, state.start.x, state.start.y);
        pushHistory();
        setStatus('Text added.');
      }
      state.drawing = false;
    }
  }

  function moveDraw(event) {
    if (!state.drawing || !canvas || !ctx || state.tool === 'text') return;
    event.preventDefault();
    event.stopPropagation();

    const p = pointFromEvent(event);
    setupContext();

    if (state.tool === 'pen' || state.tool === 'eraser') {
      if (state.tool === 'eraser') {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(6, state.width * 3);
        drawLine(state.last, p);
        ctx.restore();
        setupContext();
      } else {
        drawLine(state.last, p);
      }
      state.last = p;
      return;
    }

    drawPreviewShape(p);
  }

  function endDraw(event) {
    if (!state.drawing || !canvas || !ctx) return;
    event.preventDefault();
    event.stopPropagation();

    const p = pointFromEvent(event);
    setupContext();

    // Stage 8F: commit shapes synchronously. The old code restored a PNG
    // snapshot asynchronously, which could repaint over the final line/box/circle
    // after pointerup and make it disappear.
    if (state.tool === 'line') {
      restoreSnapshot(state.snapshot);
      setupContext();
      drawLine(state.start, p);
      pushHistory();
    } else if (state.tool === 'rect') {
      restoreSnapshot(state.snapshot);
      setupContext();
      drawRect(state.start, p);
      pushHistory();
    } else if (state.tool === 'circle') {
      restoreSnapshot(state.snapshot);
      setupContext();
      drawCircle(state.start, p);
      pushHistory();
    } else if (state.tool === 'arrow') {
      restoreSnapshot(state.snapshot);
      setupContext();
      drawArrow(state.start, p);
      pushHistory();
    } else {
      pushHistory();
    }

    state.drawing = false;
    state.start = null;
    state.last = null;
    state.snapshot = null;
  }

  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll('.figure-tool-btn[data-figure-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.figureTool === tool);
    });
    setStatus(`Tool: ${tool}.`);
  }

  function suggestedPath() {
    const input = el('figureEditorPathInput');
    const value = String(input?.value || '').trim();
    if (value) return value;
    return `figures/drawn-figure-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
  }

  function savePng({ insert = false } = {}) {
    const asset = getAssetService();
    if (!asset?.addImageDataUrl) {
      setStatus('AssetService is not loaded yet.');
      return null;
    }
    if (!canvas) return null;

    const path = suggestedPath();
    const caption = el('figureEditorCaptionInput')?.value || '';
    const label = el('figureEditorLabelInput')?.value || '';

    const dataUrl = canvas.toDataURL('image/png');
    const result = asset.addImageDataUrl(dataUrl, {
      path,
      filename: path.split('/').pop(),
      caption,
      label,
      mime: 'image/png'
    });

    if (!result?.ok) {
      setStatus(result?.message || 'Could not save figure.');
      return result;
    }

    if (asset.setSelectedAsset) asset.setSelectedAsset(result.path);

    if (insert && asset.insertFigureSnippet) {
      const inserted = asset.insertFigureSnippet({
        path: result.path,
        caption,
        label,
        width: el('figureEditorWidthInput')?.value || '.8\\linewidth'
      });
      setStatus(inserted?.ok ? `Saved ${result.path} and inserted figure snippet.` : (inserted?.message || `Saved ${result.path}; insert failed.`));
    } else {
      setStatus(`Saved ${result.path}.`);
    }

    toast(insert ? 'Figure saved and inserted.' : 'Figure saved.');
    return result;
  }

  function exportPng() {
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = suggestedPath().split('/').pop() || 'drawn-figure.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function addEditorCard() {
    const assetsTab = document.getElementById('assetsTab');
    const assetPanel = assetsTab?.querySelector?.('.asset-panel');
    if (!assetPanel || document.getElementById('figureEditorCard')) return false;

    const card = document.createElement('div');
    card.className = 'figure-editor-card';
    card.id = 'figureEditorCard';
    card.innerHTML = [
      '<h3>Draw figure</h3>',
      '<div class="figure-editor-toolbar">',
      '  <button type="button" class="figure-tool-btn active" data-figure-tool="pen">Pen</button>',
      '  <button type="button" class="figure-tool-btn" data-figure-tool="line">Line</button>',
      '  <button type="button" class="figure-tool-btn" data-figure-tool="arrow">Arrow</button>',
      '  <button type="button" class="figure-tool-btn" data-figure-tool="rect">Box</button>',
      '  <button type="button" class="figure-tool-btn" data-figure-tool="circle">Circle</button>',
      '  <button type="button" class="figure-tool-btn" data-figure-tool="text">Text</button>',
      '  <button type="button" class="figure-tool-btn" data-figure-tool="eraser">Eraser</button>',
      '  <label>Color <input id="figureEditorColor" type="color" value="#111111" /></label>',
      '  <label>Size <input id="figureEditorWidth" type="range" min="1" max="18" value="3" /></label>',
      '  <button type="button" class="figure-action-btn" id="figureEditorUndoBtn">Undo</button>',
      '  <button type="button" class="figure-action-btn" id="figureEditorClearBtn">Clear</button>',
      '</div>',
      '<div class="figure-editor-canvas-wrap">',
      '  <canvas id="figureEditorCanvas" width="1200" height="760"></canvas>',
      '</div>',
      '<div class="figure-editor-fields">',
      '  <label>Save path <input id="figureEditorPathInput" type="text" placeholder="figures/drawn-figure.png" /></label>',
      '  <label>Caption <input id="figureEditorCaptionInput" type="text" placeholder="Optional caption" /></label>',
      '  <label>Label <input id="figureEditorLabelInput" type="text" placeholder="fig:drawn-figure" /></label>',
      '  <label>Width <input id="figureEditorWidthInput" type="text" value=".8\\linewidth" /></label>',
      '</div>',
      '<div class="figure-editor-toolbar" style="margin-top:.55rem">',
      '  <button type="button" class="figure-action-btn primary" id="figureEditorSaveBtn">Save PNG</button>',
      '  <button type="button" class="figure-action-btn primary" id="figureEditorSaveInsertBtn">Save + insert</button>',
      '  <button type="button" class="figure-action-btn" id="figureEditorExportBtn">Download PNG</button>',
      '</div>',
      '<div class="figure-editor-status" id="figureEditorStatus">Draw a figure, then save it as a PNG asset.</div>',
      '<div class="figure-editor-help">Uses AssetService, so saved figures appear in the project and GitHub commits. On iPad, draw directly on the canvas.</div>'
    ].join('');

    assetPanel.prepend(card);
    bindCanvas();
    bindControls();
    return true;
  }

  function bindCanvas() {
    canvas = el('figureEditorCanvas');
    if (!canvas || canvas.__stage8eBound) return;
    ctx = canvas.getContext('2d');
    blankCanvas();
    pushHistory();

    canvas.addEventListener('pointerdown', beginDraw, true);
    canvas.addEventListener('pointermove', moveDraw, true);
    canvas.addEventListener('pointerup', endDraw, true);
    canvas.addEventListener('pointercancel', endDraw, true);
    canvas.__stage8eBound = true;
  }

  function bindControls() {
    document.querySelectorAll('.figure-tool-btn[data-figure-tool]').forEach((button) => {
      if (button.__stage8eBound) return;
      button.addEventListener('click', () => setTool(button.dataset.figureTool || 'pen'), true);
      button.__stage8eBound = true;
    });

    el('figureEditorColor')?.addEventListener('input', (event) => {
      state.color = event.target.value || '#111111';
      setupContext();
    });
    el('figureEditorWidth')?.addEventListener('input', (event) => {
      state.width = Number(event.target.value || 3);
      setupContext();
    });
    el('figureEditorUndoBtn')?.addEventListener('click', undo, true);
    el('figureEditorClearBtn')?.addEventListener('click', clearCanvas, true);
    el('figureEditorSaveBtn')?.addEventListener('click', () => savePng({ insert: false }), true);
    el('figureEditorSaveInsertBtn')?.addEventListener('click', () => savePng({ insert: true }), true);
    el('figureEditorExportBtn')?.addEventListener('click', exportPng, true);
  }

  function openFiguresTab() {
    const button = document.querySelector('[data-right-tab="assets"]');
    if (button) button.click();
  }

  function init() {
    installed = true;
    addEditorCard();
  }

  NS.FigureEditorService = {
    STAGE,
    init,
    openFiguresTab,
    savePng,
    exportPng,
    clearCanvas,
    undo,
    setTool,
    getCanvas: () => canvas,
    getState: () => ({ ...state })
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    if (addEditorCard()) clearInterval(interval);
    tries += 1;
    if (tries > 40) clearInterval(interval);
  }, 500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

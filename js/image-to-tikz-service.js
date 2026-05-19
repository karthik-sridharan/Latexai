/* Latexai Stage 10A ImageToTikzService
 * Stage: stage10a-image-to-tikz-remaker-1
 *
 * Remakes an existing project image asset as editable TikZ.
 * - Lists image assets from AssetService
 * - Sends selected image data URL + instructions to AIProvider
 * - Sanitizes output through TikzMakerService.extractTikz
 * - Places resulting TikZ in the TikZ maker editor
 * - Can insert directly into source through TikzMakerService / AssetService
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage10a-image-to-tikz-remaker-1';

  let installed = false;
  let selectedPath = '';

  function el(id) { return document.getElementById(id); }

  function toast(message) {
    try { NS.Main?.toast?.(message); }
    catch (_err) {}
  }

  function setStatus(message) {
    const node = el('imageTikzStatus');
    if (node) node.textContent = message;
  }

  function assetService() { return NS.AssetService; }
  function tikzMaker() { return NS.TikzMakerService; }

  function fileText(file) {
    if (!file) return '';
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function normalizePath(path) {
    return NS.State?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
  }

  function imageAssets() {
    return assetService()?.imageAssets?.() || [];
  }

  function assetByPath(path) {
    path = normalizePath(path);
    return imageAssets().find((file) => normalizePath(file.path) === path) || null;
  }

  function assetDataUrl(file) {
    return assetService()?.assetDataUrl?.(file) || '';
  }

  function refreshImageList() {
    const select = el('imageTikzAssetSelect');
    if (!select) return;

    const previous = selectedPath || select.value || '';
    const assets = imageAssets();
    select.innerHTML = '';

    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = assets.length ? 'Choose project image…' : 'No image assets found';
    select.appendChild(blank);

    for (const file of assets) {
      const option = document.createElement('option');
      option.value = file.path;
      option.textContent = file.path;
      select.appendChild(option);
    }

    if (previous && assets.some((file) => normalizePath(file.path) === normalizePath(previous))) {
      select.value = previous;
      selectedPath = previous;
    } else if (!selectedPath && assets.length) {
      select.value = assets[0].path;
      selectedPath = assets[0].path;
    }

    renderSelectedPreview();
  }

  function renderSelectedPreview() {
    const file = assetByPath(selectedPath || el('imageTikzAssetSelect')?.value || '');
    const img = el('imageTikzPreviewImg');
    const path = el('imageTikzPreviewPath');

    if (!file) {
      if (img) img.removeAttribute('src');
      if (path) path.textContent = 'No image selected.';
      return;
    }

    if (img) img.src = assetDataUrl(file);
    if (path) path.textContent = file.path;
  }

  function getPrompt() {
    return String(el('imageTikzPromptInput')?.value || '').trim();
  }

  function defaultCaption() {
    const file = assetByPath(selectedPath);
    const name = String(file?.path || 'Remade figure').split('/').pop().replace(/\.[^.]+$/, '');
    return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function buildImageToTikzPayload(file, dataUrl, prompt) {
    return {
      instructions: [
        'You are a LaTeX TikZ reconstruction engine.',
        'The user selected an image from a LaTeX project and wants an editable TikZ remake.',
        'Return ONLY one valid tikzpicture environment.',
        'Do NOT return JSON, Markdown, SVG, HTML, Mermaid, explanatory prose, or code fences.',
        'Do NOT include documentclass or begin{document}.',
        'Use robust TikZ primitives that compile with \\usepackage{tikz}.',
        'Approximate visual structure is better than copying pixel-perfect details.',
        'Use simple nodes, arrows, lines, boxes, circles, curves, and labels.'
      ].join('\n'),
      input: [
        'Remake this project image as TikZ.',
        '',
        `Image path: ${file.path}`,
        `User instructions: ${prompt || 'Infer the diagram structure and produce clean editable TikZ.'}`,
        '',
        'Return only the tikzpicture environment.'
      ].join('\n'),
      image: {
        path: file.path,
        mime: file.mime || 'image/png',
        dataUrl
      },
      temperature: 0.05,
      maxOutputTokens: 5000
    };
  }

  function localFallbackTikz(file, prompt) {
    const label = String(prompt || file?.path || 'Remade image').replace(/[{}\\]/g, ' ').slice(0, 90);
    const lower = `${file?.path || ''} ${prompt || ''}`.toLowerCase();

    if (/(network|neural|mlp|layer|node)/.test(lower)) {
      return tikzMaker()?.fallbackTikz?.('one hidden layer neural network') || [
        '\\begin{tikzpicture}[>=stealth]',
        '  \\node[draw,circle] (x) at (0,0) {$x$};',
        '  \\node[draw,circle] (h) at (2,0) {$h$};',
        '  \\node[draw,circle] (y) at (4,0) {$y$};',
        '  \\draw[->] (x) -- (h);',
        '  \\draw[->] (h) -- (y);',
        '\\end{tikzpicture}',
        ''
      ].join('\n');
    }

    return [
      '\\begin{tikzpicture}[>=stealth, every node/.style={font=\\small}]',
      '  \\node[draw, rounded corners, thick, minimum width=2.4cm, minimum height=1cm] (a) at (0,0) {Image};',
      '  \\node[draw, rounded corners, thick, minimum width=2.4cm, minimum height=1cm] (b) at (3.4,0) {TikZ remake};',
      '  \\draw[->, thick] (a) -- (b);',
      `  \\node[align=center, font=\\scriptsize] at (1.7,-1.0) {${label}};`,
      '\\end{tikzpicture}',
      ''
    ].join('\n');
  }

  async function remakeSelectedImage() {
    const file = assetByPath(selectedPath || el('imageTikzAssetSelect')?.value || '');
    if (!file) {
      setStatus('Choose an image asset first.');
      return null;
    }

    const dataUrl = assetDataUrl(file);
    if (!dataUrl) {
      setStatus('Selected image has no readable data URL.');
      return null;
    }

    const prompt = getPrompt();
    setStatus('Asking AI to remake the selected image as TikZ...');

    try {
      const payload = buildImageToTikzPayload(file, dataUrl, prompt);
      const response = await NS.AIProvider.ask(payload, {
        task: 'latex-copilot',
        context: {
          workflow: 'image-to-tikz-remaker',
          imagePath: file.path,
          prompt
        }
      });

      const raw = NS.AIProvider.extractText(response);
      const tikz = tikzMaker()?.extractTikz?.(raw, prompt || `Remake ${file.path} as TikZ`) || raw;
      pushToTikzMaker(tikz);
      setStatus('Image remade as TikZ. Review/edit the TikZ source, then insert directly or save.');
      return tikz;
    } catch (err) {
      const fallback = localFallbackTikz(file, prompt);
      pushToTikzMaker(fallback);
      setStatus(`AI image-to-TikZ failed; created an editable local placeholder.\n${err?.message || err}`);
      return fallback;
    }
  }

  function pushToTikzMaker(tikz) {
    const code = el('tikzCodeOutput');
    const prompt = el('tikzPromptInput');
    const caption = el('tikzCaptionInput');
    const label = el('tikzLabelInput');

    if (prompt && !String(prompt.value || '').trim()) {
      prompt.value = getPrompt() || `Remake ${selectedPath || 'selected image'} as TikZ`;
      prompt.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (caption && !String(caption.value || '').trim()) {
      caption.value = defaultCaption();
      caption.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (label && !String(label.value || '').trim()) {
      const stem = String(selectedPath || 'image-tikz').split('/').pop().replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
      label.value = `fig:${stem || 'image-tikz'}`;
      label.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (code) {
      code.value = String(tikz || '').trim() + '\n';
      code.dispatchEvent(new Event('input', { bubbles: true }));
    }

    tikzMaker()?.openFiguresTab?.();
  }

  async function remakeAndInsert() {
    const tikz = await remakeSelectedImage();
    if (!tikz) return null;

    // Use TikzMakerService direct insert path so cursor/package/root behavior stays centralized.
    const result = tikzMaker()?.saveTikz?.({ direct: true });
    if (result?.ok) {
      setStatus('Remade image as TikZ and inserted directly into source.');
      toast('Image remade and inserted as TikZ.');
    }
    return result;
  }

  function createCard() {
    const assetsTab = el('assetsTab');
    const assetPanel = assetsTab?.querySelector?.('.asset-panel');
    if (!assetPanel || el('imageToTikzCard')) return false;

    const card = document.createElement('div');
    card.className = 'image-tikz-card';
    card.id = 'imageToTikzCard';
    card.innerHTML = [
      '<h3>Image → TikZ remaker</h3>',
      '<div class="image-tikz-form">',
      '  <label>Project image <select id="imageTikzAssetSelect"></select></label>',
      '  <div class="image-tikz-preview">',
      '    <img id="imageTikzPreviewImg" alt="Selected project image preview" />',
      '    <div>',
      '      <div class="image-tikz-path" id="imageTikzPreviewPath">No image selected.</div>',
      '      <div class="image-tikz-help">Choose an uploaded/drawn project image and ask AI to remake it as editable TikZ.</div>',
      '    </div>',
      '  </div>',
      '  <label>Instructions <textarea id="imageTikzPromptInput" placeholder="Example: remake this as a clean neural-network diagram with labeled layers and arrows"></textarea></label>',
      '  <div class="image-tikz-actions">',
      '    <button type="button" class="btn mini primary" id="imageTikzRemakeBtn">Remake as TikZ</button>',
      '    <button type="button" class="btn mini primary" id="imageTikzRemakeInsertBtn">Remake + insert</button>',
      '    <button type="button" class="btn mini" id="imageTikzRefreshBtn">Refresh images</button>',
      '  </div>',
      '  <div class="image-tikz-status" id="imageTikzStatus">Image-to-TikZ remaker ready.</div>',
      '</div>'
    ].join('');

    const tikzCard = el('tikzMakerCard');
    if (tikzCard?.nextSibling) assetPanel.insertBefore(card, tikzCard.nextSibling);
    else assetPanel.prepend(card);

    bindControls();
    refreshImageList();
    return true;
  }

  function bindControls() {
    el('imageTikzAssetSelect')?.addEventListener('change', (event) => {
      selectedPath = event.target.value || '';
      renderSelectedPreview();
    }, true);

    el('imageTikzRemakeBtn')?.addEventListener('click', remakeSelectedImage, true);
    el('imageTikzRemakeInsertBtn')?.addEventListener('click', remakeAndInsert, true);
    el('imageTikzRefreshBtn')?.addEventListener('click', () => {
      refreshImageList();
      setStatus('Image list refreshed.');
    }, true);
  }

  function init() {
    installed = true;
    createCard();

    try {
      NS.State?.subscribe?.((_snapshot, reason) => {
        if (['file-create', 'file-import-overwrite', 'file-remove', 'file-rename', 'load', 'reset'].includes(reason)) {
          setTimeout(refreshImageList, 80);
        }
      });
    } catch (_err) {}
  }

  NS.ImageToTikzService = {
    STAGE,
    init,
    refreshImageList,
    remakeSelectedImage,
    remakeAndInsert,
    buildImageToTikzPayload,
    localFallbackTikz,
    pushToTikzMaker,
    getSelectedPath: () => selectedPath,
    setSelectedPath: (path) => {
      selectedPath = normalizePath(path);
      const select = el('imageTikzAssetSelect');
      if (select) select.value = selectedPath;
      renderSelectedPreview();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    if (createCard()) clearInterval(interval);
    tries += 1;
    if (tries > 40) clearInterval(interval);
  }, 500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

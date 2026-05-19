/* Latexai Stage 8A AssetService
 * Stage: stage8a-asset-service-image-figures-1
 *
 * First modular asset foundation for figure workflows.
 * - Adds binary image assets into the current project, usually under figures/
 * - Avoids filename collisions
 * - Inserts LaTeX figure snippets
 * - Ensures \usepackage{graphicx} exists in the root preamble
 *
 * This is intentionally independent from AI. Later figure editor / TikZ / image-to-TikZ
 * stages should use AssetService rather than hand-mutating project files.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;
  const STAGE = 'stage8a-asset-service-image-figures-1';

  let installed = false;
  let selectedAssetPath = '';

  function el(id) { return document.getElementById(id); }

  function normalizePath(path) {
    return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
  }

  function fileText(file) {
    if (!file) return '';
    if (typeof file === 'string') return file;
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function toast(message) {
    try { NS.Main?.toast?.(message); }
    catch (_err) {}
  }

  function setStatus(message) {
    const node = el('assetServiceStatus');
    if (node) node.textContent = message;
  }

  function sanitizeFilename(name, fallback = 'figure.png') {
    let raw = String(name || fallback).split('/').pop().split('\\').pop().trim();
    raw = raw.replace(/\s+/g, '-').replace(/[^A-Za-z0-9._-]+/g, '').replace(/-+/g, '-');
    raw = raw.replace(/^\.+/, '').replace(/\.+$/, '');
    if (!raw || !/\.[A-Za-z0-9]+$/.test(raw)) raw = fallback;
    return raw;
  }

  function slug(text, fallback = 'figure') {
    const s = String(text || '')
      .toLowerCase()
      .replace(/\\[a-zA-Z]+\*?/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    return s || fallback;
  }

  function extensionForMime(mime, fallback = 'png') {
    const m = String(mime || '').toLowerCase();
    if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
    if (m.includes('png')) return 'png';
    if (m.includes('svg')) return 'svg';
    if (m.includes('webp')) return 'webp';
    return fallback.replace(/^\./, '') || 'png';
  }

  function mimeForPath(path) {
    const lower = String(path || '').toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
  }

  function dataUrlParts(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;,]+)?;base64,(.*)$/s);
    return match ? { mime: match[1] || 'application/octet-stream', base64: match[2] || '' } : null;
  }

  function dataUrlFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
      reader.readAsDataURL(file);
    });
  }

  function existingPaths() {
    return new Set((State()?.state?.project?.files || []).map((file) => normalizePath(file.path)));
  }

  function uniquePath(path) {
    path = normalizePath(path || 'figures/figure.png');
    const paths = existingPaths();
    if (!paths.has(path)) return path;

    const slash = path.lastIndexOf('/');
    const dir = slash >= 0 ? path.slice(0, slash + 1) : '';
    const name = slash >= 0 ? path.slice(slash + 1) : path;
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';

    for (let i = 2; i < 10000; i++) {
      const candidate = `${dir}${stem}-${i}${ext}`;
      if (!paths.has(candidate)) return candidate;
    }
    return `${dir}${stem}-${Date.now()}${ext}`;
  }

  function defaultImagePath(filenameOrPath, mime) {
    let p = normalizePath(filenameOrPath || '');
    if (!p || p.endsWith('/')) {
      const ext = extensionForMime(mime, 'png');
      p = `figures/figure.${ext}`;
    }
    if (!p.includes('/')) p = `figures/${p}`;
    const extNeeded = !/\.[A-Za-z0-9]+$/.test(p);
    if (extNeeded) p += `.${extensionForMime(mime, 'png')}`;
    return uniquePath(p);
  }

  function imageAssets() {
    return (State()?.state?.project?.files || []).filter((file) => {
      const lower = String(file.path || '').toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.webp', '.svg'].some((ext) => lower.endsWith(ext));
    });
  }

  function assetDataUrl(file) {
    if (!file) return '';
    if (file.base64) return `data:${file.mime || mimeForPath(file.path)};base64,${file.base64}`;
    const text = fileText(file);
    if (/^data:/i.test(text)) return text;
    if (String(file.path || '').toLowerCase().endsWith('.svg') && text) {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
    }
    return '';
  }

  function addImageDataUrl(dataUrl, options = {}) {
    const parts = dataUrlParts(dataUrl);
    if (!parts?.base64) return { ok: false, message: 'Image data URL was not base64.' };

    const filename = sanitizeFilename(options.filename || `figure.${extensionForMime(parts.mime, 'png')}`);
    const targetPath = uniquePath(normalizePath(options.path || defaultImagePath(filename, parts.mime)));
    const oldActive = State()?.state?.project?.activePath || '';

    const file = State()?.createFile?.(targetPath, '', { base64: parts.base64 });
    if (!file) return { ok: false, message: `Could not create asset: ${targetPath}` };

    file.mime = options.mime || parts.mime || mimeForPath(targetPath);
    file.encoding = 'base64';
    file.text = '';
    file.kind = 'asset';
    file.meta = Object.assign({}, file.meta || {}, {
      assetServiceStage: STAGE,
      caption: options.caption || '',
      label: options.label || '',
      createdBy: 'Latexai AssetService'
    });

    if (oldActive && State()?.getFile?.(oldActive)) {
      try { State().setActivePath(oldActive); } catch (_err) {}
    }

    try { State()?.save?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}

    selectedAssetPath = targetPath;
    renderAssetPanel();
    return { ok: true, file, path: targetPath, mime: file.mime };
  }

  async function addImageFile(file, options = {}) {
    if (!file) return { ok: false, message: 'No image file selected.' };
    if (!/^image\//i.test(file.type || '') && !/\.(png|jpe?g|webp|svg)$/i.test(file.name || '')) {
      return { ok: false, message: 'Selected file is not a supported image.' };
    }
    const dataUrl = await dataUrlFromFile(file);
    return addImageDataUrl(dataUrl, {
      filename: options.filename || file.name || '',
      path: options.path || '',
      caption: options.caption || '',
      label: options.label || '',
      mime: file.type || ''
    });
  }

  function figureSnippet(options = {}) {
    const path = normalizePath(options.path || selectedAssetPath || '');
    if (!path) return '';
    const width = String(options.width || '.8\\linewidth').trim() || '.8\\linewidth';
    const caption = String(options.caption || '').trim();
    const label = String(options.label || '').trim() || `fig:${slug(path.split('/').pop().replace(/\.[^.]+$/, ''))}`;

    const lines = [
      '\\begin{figure}[t]',
      '  \\centering',
      `  \\includegraphics[width=${width}]{${path}}`
    ];
    if (caption) lines.push(`  \\caption{${caption}}`);
    if (label) lines.push(`  \\label{${label}}`);
    lines.push('\\end{figure}');
    return lines.join('\n') + '\n';
  }

  function ensureGraphicsPackage() {
    const project = State()?.state?.project;
    const rootPath = normalizePath(project?.rootFile || project?.activePath || 'main.tex');
    const file = State()?.getFile?.(rootPath);
    if (!file || !State()?.textFile?.(file)) return false;
    let tex = fileText(file);
    if (/\\usepackage(?:\[[^\]]*\])?\{[^}]*\bgraphicx\b[^}]*\}/.test(tex)) return false;

    const dc = tex.match(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}\s*/);
    if (dc) tex = tex.slice(0, dc.index + dc[0].length) + '\\usepackage{graphicx}\n' + tex.slice(dc.index + dc[0].length);
    else tex = '\\usepackage{graphicx}\n' + tex;

    State().updateFile(rootPath, tex);
    return true;
  }

  function insertionTarget() {
    const project = State()?.state?.project || {};
    let path = normalizePath(project.activePath || project.rootFile || 'main.tex');
    let file = State()?.getFile?.(path);
    if (!file || !State()?.textFile?.(file) || !String(path).toLowerCase().endsWith('.tex')) {
      path = normalizePath(project.rootFile || 'main.tex');
      file = State()?.getFile?.(path);
    }
    if (!file) return null;
    const text = fileText(file);
    let start = text.length;
    let end = text.length;

    const editor = el('sourceEditor');
    if (editor && project.activePath === path && document.activeElement === editor) {
      start = Number(editor.selectionEnd || editor.selectionStart || text.length);
      end = start;
    } else {
      const docEnd = text.lastIndexOf('\\end{document}');
      if (docEnd >= 0) start = end = docEnd;
    }

    start = Math.max(0, Math.min(start, text.length));
    end = Math.max(start, Math.min(end, text.length));
    return { path, file, text, start, end };
  }

  function insertFigureSnippet(options = {}) {
    const snippet = options.snippet || figureSnippet(options);
    if (!snippet.trim()) return { ok: false, message: 'No figure snippet to insert.' };

    const target = insertionTarget();
    if (!target) return { ok: false, message: 'No editable LaTeX target file found.' };

    ensureGraphicsPackage();

    // Re-read file after possible package insertion.
    const file = State()?.getFile?.(target.path);
    const text = fileText(file);
    let start = target.start;
    let end = target.end;
    if (target.text !== text) {
      const docEnd = text.lastIndexOf('\\end{document}');
      start = end = docEnd >= 0 ? docEnd : text.length;
    }

    const insertText = `\n${snippet}\n`;
    const next = text.slice(0, start) + insertText + text.slice(end);
    State().updateFile(target.path, next);
    State().setActivePath?.(target.path);
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}

    setTimeout(() => {
      NS.SelectionService?.setSourceSelection?.(target.path, start, start + insertText.length, {
        freeze: true,
        source: 'asset-service-insert-figure',
        method: 'asset-snippet'
      });
    }, 80);

    return { ok: true, path: target.path, start, end: start + insertText.length, snippet: insertText };
  }

  function selectedOptions() {
    return {
      path: selectedAssetPath || el('assetSelectedPath')?.value || '',
      caption: el('assetCaptionInput')?.value || '',
      label: el('assetLabelInput')?.value || '',
      width: el('assetWidthInput')?.value || '.8\\linewidth'
    };
  }

  function setSelectedAsset(path) {
    selectedAssetPath = normalizePath(path || '');
    const input = el('assetSelectedPath');
    if (input) input.value = selectedAssetPath;
    renderSnippetPreview();
    renderAssetList();
  }

  function renderSnippetPreview() {
    const box = el('assetSnippetPreview');
    if (!box) return;
    const opts = selectedOptions();
    box.textContent = opts.path ? figureSnippet(opts) : 'Select or add an image asset to preview the LaTeX figure snippet.';
  }

  function renderAssetList() {
    const list = el('assetList');
    if (!list) return;
    const assets = imageAssets();
    if (!assets.length) {
      list.innerHTML = '<div class="asset-status">No image assets yet. Add a PNG/JPG/WebP/SVG into figures/.</div>';
      return;
    }

    list.innerHTML = '';
    for (const file of assets) {
      const row = document.createElement('div');
      row.className = 'asset-row';
      if (file.path === selectedAssetPath) row.style.outline = '2px solid rgba(37,99,235,.35)';

      const img = document.createElement('img');
      img.className = 'asset-thumb';
      img.alt = file.path;
      img.src = assetDataUrl(file) || '';

      const main = document.createElement('div');
      main.className = 'asset-row-main';

      const path = document.createElement('div');
      path.className = 'asset-path';
      path.textContent = file.path;

      const actions = document.createElement('div');
      actions.className = 'asset-row-actions';

      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'asset-mini-btn';
      select.textContent = 'Select';
      select.addEventListener('click', () => setSelectedAsset(file.path));

      const insert = document.createElement('button');
      insert.type = 'button';
      insert.className = 'asset-mini-btn';
      insert.textContent = 'Insert snippet';
      insert.addEventListener('click', () => {
        setSelectedAsset(file.path);
        const result = insertFigureSnippet(selectedOptions());
        setStatus(result.ok ? `Inserted figure snippet for ${file.path}.` : result.message);
      });

      actions.append(select, insert);
      main.append(path, actions);
      row.append(img, main);
      list.appendChild(row);
    }
  }

  function renderAssetPanel() {
    renderAssetList();
    renderSnippetPreview();
  }

  function createAssetTab() {
    const tabs = document.querySelector('.right-tabs');
    if (!tabs || el('assetsTabButton')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'assetsTabButton';
    button.className = 'right-tab';
    button.dataset.rightTab = 'assets';
    button.textContent = 'Figures';
    tabs.appendChild(button);

    const rightPanel = document.querySelector('.right-panel');
    const panel = document.createElement('section');
    panel.className = 'right-tab-panel';
    panel.id = 'assetsTab';
    panel.innerHTML = [
      '<div class="asset-panel">',
      '  <div class="asset-card">',
      '    <h3>Image assets</h3>',
      '    <div class="asset-form">',
      '      <label>Upload PNG/JPG/WebP/SVG <input id="assetFileInput" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></label>',
      '      <label>Target path <input id="assetPathInput" type="text" placeholder="figures/my-figure.png" /></label>',
      '      <label>Caption <input id="assetCaptionInput" type="text" placeholder="Optional figure caption" /></label>',
      '      <label>Label <input id="assetLabelInput" type="text" placeholder="fig:my-figure" /></label>',
      '      <label>Width <input id="assetWidthInput" type="text" value=".8\\\\linewidth" /></label>',
      '      <input id="assetSelectedPath" type="hidden" />',
      '      <div class="asset-actions">',
      '        <button type="button" class="btn mini primary" id="assetAddBtn">Add image</button>',
      '        <button type="button" class="btn mini" id="assetAddInsertBtn">Add + insert</button>',
      '        <button type="button" class="btn mini" id="assetInsertBtn">Insert selected</button>',
      '        <button type="button" class="btn mini" id="assetRefreshBtn">Refresh</button>',
      '      </div>',
      '      <div class="asset-status" id="assetServiceStatus">Asset service ready.</div>',
      '    </div>',
      '  </div>',
      '  <div class="asset-card">',
      '    <h3>Snippet preview</h3>',
      '    <pre class="asset-preview-code" id="assetSnippetPreview">Select or add an image asset to preview the LaTeX figure snippet.</pre>',
      '  </div>',
      '  <div class="asset-card">',
      '    <h3>Project images</h3>',
      '    <div class="asset-list" id="assetList"></div>',
      '  </div>',
      '</div>'
    ].join('');

    rightPanel?.appendChild(panel);

    button.addEventListener('click', () => {
      document.querySelectorAll('.right-tab').forEach((b) => b.classList.toggle('active', b === button));
      document.querySelectorAll('.right-tab-panel').forEach((p) => p.classList.toggle('active', p === panel));
      renderAssetPanel();
    });

    bindPanelControls();
    renderAssetPanel();
  }

  function bindPanelControls() {
    el('assetAddBtn')?.addEventListener('click', async () => {
      const file = el('assetFileInput')?.files?.[0];
      if (!file) {
        setStatus('Choose an image file first.');
        return;
      }
      setStatus('Adding image asset...');
      const result = await addImageFile(file, {
        path: el('assetPathInput')?.value || '',
        caption: el('assetCaptionInput')?.value || '',
        label: el('assetLabelInput')?.value || ''
      });
      setStatus(result.ok ? `Added ${result.path}.` : result.message);
    });

    el('assetAddInsertBtn')?.addEventListener('click', async () => {
      const file = el('assetFileInput')?.files?.[0];
      if (!file) {
        setStatus('Choose an image file first.');
        return;
      }
      setStatus('Adding image asset...');
      const added = await addImageFile(file, {
        path: el('assetPathInput')?.value || '',
        caption: el('assetCaptionInput')?.value || '',
        label: el('assetLabelInput')?.value || ''
      });
      if (!added.ok) {
        setStatus(added.message);
        return;
      }
      const inserted = insertFigureSnippet(Object.assign(selectedOptions(), { path: added.path }));
      setStatus(inserted.ok ? `Added ${added.path} and inserted a figure snippet.` : inserted.message);
    });

    el('assetInsertBtn')?.addEventListener('click', () => {
      const result = insertFigureSnippet(selectedOptions());
      setStatus(result.ok ? `Inserted figure snippet for ${selectedOptions().path}.` : result.message);
    });

    el('assetRefreshBtn')?.addEventListener('click', () => {
      renderAssetPanel();
      setStatus('Asset list refreshed.');
    });

    ['assetCaptionInput', 'assetLabelInput', 'assetWidthInput'].forEach((id) => {
      el(id)?.addEventListener('input', renderSnippetPreview);
    });
  }

  function init() {
    if (installed) return;
    installed = true;
    createAssetTab();

    try {
      State()?.subscribe?.((_snapshot, reason) => {
        if (['file-create', 'file-import-overwrite', 'file-remove', 'file-rename', 'load', 'reset'].includes(reason)) {
          setTimeout(renderAssetPanel, 60);
        }
      });
    } catch (_err) {}
  }

  NS.AssetService = {
    STAGE,
    sanitizeFilename,
    slug,
    extensionForMime,
    mimeForPath,
    dataUrlParts,
    uniquePath,
    defaultImagePath,
    imageAssets,
    assetDataUrl,
    addImageDataUrl,
    addImageFile,
    figureSnippet,
    ensureGraphicsPackage,
    insertionTarget,
    insertFigureSnippet,
    setSelectedAsset,
    renderAssetPanel
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    createAssetTab();
    tries += 1;
    if (tries > 20 || el('assetsTab')) clearInterval(interval);
  }, 500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

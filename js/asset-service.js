/* Latexai Stage 8A AssetService
 * Stage: stage10i-insert-raw-returned-tikz-figure-1
 *
 * First modular asset foundation for figure workflows.
 * - Adds binary image assets into the current project, usually under figures/
 * - Avoids filename collisions
 * - Inserts LaTeX image figure snippets
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
  const STAGE = 'stage10i-insert-raw-returned-tikz-figure-1';

  let installed = false;
  let selectedAssetPath = '';
  let lastInsertTarget = null;

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

  function isDocumentRootText(text) {
    const s = String(text || '');
    // Stage 9H: match literal LaTeX backslashes. The old regex accidentally
    // failed to reliably detect real root documents.
    return /\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/.test(s) || /\\begin\{document\}/.test(s);
  }

  function isTikzOnlyText(text) {
    const s = String(text || '').trim();
    return /\\begin\{tikzpicture\}/.test(s) && !isDocumentRootText(s);
  }

  function isLatexInsertionText(text) {
    const s = String(text || '');
    return !!s && !isTikzOnlyText(s);
  }

  function findRootDocumentPath() {
    const project = State()?.state?.project || {};
    const files = project.files || [];
    const candidates = [project.rootFile, project.mainFile, 'main.tex', project.activePath]
      .filter(Boolean)
      .map(normalizePath);

    for (const path of candidates) {
      const file = State()?.getFile?.(path);
      if (file && State()?.textFile?.(file) && isDocumentRootText(fileText(file))) return path;
    }
    for (const file of files) {
      if (file && State()?.textFile?.(file) && String(file.path || '').toLowerCase().endsWith('.tex') && isDocumentRootText(fileText(file))) {
        return normalizePath(file.path);
      }
    }
    return normalizePath(project.rootFile || project.mainFile || 'main.tex');
  }

  function documentInsertionTarget(options = {}) {
    const explicit = explicitInsertionTarget(options);
    if (explicit && isLatexInsertionText(explicit.text)) return explicit;

    // Stage 9H: prefer the remembered source cursor in the file the user was
    // editing. This is the intended insertion point; only fall back to the root
    // document end if no usable cursor was ever captured.
    if (lastInsertTarget && Number.isFinite(Number(lastInsertTarget.end))) {
      const path = normalizePath(lastInsertTarget.path);
      const file = State()?.getFile?.(path);
      const text = fileText(file);
      if (file && State()?.textFile?.(file) && isLatexInsertionText(text)) {
        const pos = Math.max(0, Math.min(Number(lastInsertTarget.end), text.length));
        return { path, file, text, start: pos, end: pos, remembered: true };
      }
    }

    const project = State()?.state?.project || {};
    const editor = el('sourceEditor');
    const activePath = normalizePath(project.activePath || project.rootFile || 'main.tex');
    const activeFile = State()?.getFile?.(activePath);
    const editorText = String(editor?.value || fileText(activeFile));
    if (editor && activeFile && State()?.textFile?.(activeFile) && isLatexInsertionText(editorText)) {
      try { State()?.updateActiveText?.(editorText); } catch (_err) {}
      const start = Math.max(0, Math.min(Number(editor.selectionEnd ?? editor.selectionStart ?? 0), editorText.length));
      return { path: activePath, file: State()?.getFile?.(activePath) || activeFile, text: editorText, start, end: start, liveEditor: true };
    }

    const raw = insertionTarget({});
    if (raw && isLatexInsertionText(raw.text)) return raw;

    const path = findRootDocumentPath();
    const file = State()?.getFile?.(path);
    if (!file || !State()?.textFile?.(file)) return raw;
    const text = fileText(file);
    let pos = text.lastIndexOf('\\end{document}');
    if (pos < 0) pos = text.length;
    return { path, file, text, start: pos, end: pos, forcedRoot: true };
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
    file.base64 = parts.base64;
    // Keep a data URL in text/content as a compatibility fallback for older
    // compile/commit code paths that only read textual file values.
    file.text = `data:${file.mime};base64,${parts.base64}`;
    file.content = file.text;
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

    // Stage 8D: use \IfFileExists so a visible placeholder appears in the PDF
    // if the image asset was not included in the compile payload.
    const lines = [
      '\\begin{figure}[t]',
      '  \\centering',
      `  \\IfFileExists{${path}}{%`,
      `    \\includegraphics[width=${width}]{${path}}%`,
      '  }{%',
      `    \\fbox{\\parbox{${width}}{\\centering Missing figure file: \\texttt{\\detokenize{${path}}}}}%`,
      '  }'
    ];
    if (caption) lines.push(`  \\caption{${caption}}`);
    if (label) lines.push(`  \\label{${label}}`);
    lines.push('\\end{figure}');
    return lines.join('\n') + '\n';
  }

  function addTextAsset(path, text, options = {}) {
    path = uniquePath(normalizePath(path || 'figures/generated.tex'));
    const oldActive = State()?.state?.project?.activePath || '';
    const file = State()?.createFile?.(path, String(text || ''), {});
    if (!file) return { ok: false, message: `Could not create text asset: ${path}` };

    file.kind = options.kind || 'tex';
    file.mime = options.mime || 'text/x-tex';
    file.meta = Object.assign({}, file.meta || {}, {
      assetServiceStage: STAGE,
      assetType: options.assetType || 'text',
      createdBy: options.createdBy || 'Latexai AssetService'
    });

    if (oldActive && State()?.getFile?.(oldActive)) {
      try { State().setActivePath(oldActive); } catch (_err) {}
    }

    try { State()?.save?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    return { ok: true, file, path };
  }

  function ensurePackage(packageName, options = {}) {
    packageName = String(packageName || '').trim();
    if (!packageName) return false;
    const rootPath = normalizePath(options.rootPath || findRootDocumentPath());
    const file = State()?.getFile?.(rootPath);
    if (!file || !State()?.textFile?.(file)) return false;
    let tex = fileText(file);

    // Stage 9F: package lines belong in the main document preamble, never in
    // include-only TikZ files such as figures/mlp.tex.
    if (!isDocumentRootText(tex)) return false;

    const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\\\\\usepackage(?:\\[[^\\]]*\\])?\\{[^}]*\\b' + escaped + '\\b[^}]*\\}');
    if (re.test(tex)) return false;

    const line = options.line || `\\usepackage{${packageName}}\n`;
    const dc = tex.match(/\\documentclass(?:\\[[^\\]]*\\])?\\{[^}]+\\}\s*/);
    if (dc) tex = tex.slice(0, dc.index + dc[0].length) + line + tex.slice(dc.index + dc[0].length);
    else {
      const begin = tex.indexOf('\\begin{document}');
      if (begin >= 0) tex = tex.slice(0, begin) + line + tex.slice(begin);
      else return false;
    }

    State().updateFile(rootPath, tex);
    return true;
  }

  function ensureTikzPackage() {
    return ensurePackage('tikz');
  }

  function directTikzFigureSnippet(options = {}) {
    const tikz = String(options.tikz || options.tikzSource || '').trim();
    if (!tikz) return '';
    const caption = String(options.caption || '').trim();
    const label = String(options.label || '').trim() || `fig:${slug(caption || 'tikz-figure')}`;

    const lines = [
      '\\begin{figure}[t]',
      '  \\centering',
      tikz.split('\n').map((line) => `  ${line}`).join('\n')
    ];
    if (caption) lines.push(`  \\caption{${caption}}`);
    if (label) lines.push(`  \\label{${label}}`);
    lines.push('\\end{figure}');
    return lines.join('\n') + '\n';
  }

  function insertDirectTikzFigure(options = {}) {
    const snippet = options.snippet || directTikzFigureSnippet(options);
    if (!snippet.trim()) return { ok: false, message: 'No TikZ image figure snippet to insert.' };

    const target = documentInsertionTarget(options);
    if (!target) return { ok: false, message: 'No editable LaTeX document target found.' };

    const insertText = `\n${snippet}\n`;
    const next = target.text.slice(0, target.start) + insertText + target.text.slice(target.end);
    State().updateFile(target.path, next);
    ensureTikzPackage();

    State().setActivePath?.(target.path);
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}

    setTimeout(() => {
      const file = State()?.getFile?.(target.path);
      const current = fileText(file);
      const idx = current.indexOf(insertText);
      const markStart = idx >= 0 ? idx : target.start;
      NS.SelectionService?.setSourceSelection?.(target.path, markStart, markStart + insertText.length, {
        freeze: true,
        source: 'asset-service-insert-direct-tikz',
        method: 'direct-tikz-figure'
      });
    }, 80);

    return { ok: true, path: target.path, start: target.start, end: target.start + insertText.length, snippet: insertText };
  }

  function inputFigureSnippet(options = {}) {
    const path = normalizePath(options.path || '');
    if (!path) return '';
    const caption = String(options.caption || '').trim();
    const label = String(options.label || '').trim() || `fig:${slug(path.split('/').pop().replace(/\.[^.]+$/, ''))}`;

    const lines = [
      '\\begin{figure}[t]',
      '  \\centering',
      `  \\input{${path}}`
    ];
    if (caption) lines.push(`  \\caption{${caption}}`);
    if (label) lines.push(`  \\label{${label}}`);
    lines.push('\\end{figure}');
    return lines.join('\n') + '\n';
  }

  function insertInputFigureSnippet(options = {}) {
    const snippet = options.snippet || inputFigureSnippet(options);
    if (!snippet.trim()) return { ok: false, message: 'No input image figure snippet to insert.' };

    const target = documentInsertionTarget(options);
    if (!target) return { ok: false, message: 'No editable LaTeX document target found.' };

    const insertText = `\n${snippet}\n`;
    const next = target.text.slice(0, target.start) + insertText + target.text.slice(target.end);
    State().updateFile(target.path, next);
    ensureTikzPackage();

    State().setActivePath?.(target.path);
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}

    setTimeout(() => {
      const file = State()?.getFile?.(target.path);
      const current = fileText(file);
      const idx = current.indexOf(insertText);
      const markStart = idx >= 0 ? idx : target.start;
      NS.SelectionService?.setSourceSelection?.(target.path, markStart, markStart + insertText.length, {
        freeze: true,
        source: 'asset-service-insert-input-figure',
        method: 'input-figure-snippet'
      });
    }, 80);

    return { ok: true, path: target.path, start: target.start, end: target.start + insertText.length, snippet: insertText };
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

  function rememberInsertionPoint(reason = 'manual') {
    const project = State()?.state?.project || {};
    const editor = el('sourceEditor');
    if (!editor) return lastInsertTarget;

    const path = normalizePath(project.activePath || project.rootFile || 'main.tex');
    const file = State()?.getFile?.(path);
    if (!file || !State()?.textFile?.(file) || !String(path).toLowerCase().endsWith('.tex')) {
      return lastInsertTarget;
    }

    const value = String(editor.value || fileText(file));

    // Stage 9H: remember the cursor for the actual source file the user is
    // editing, not only root documents. This lets users insert into main.tex or
    // included section files. Still ignore generated TikZ-only include files.
    if (!isLatexInsertionText(value)) {
      return lastInsertTarget;
    }

    let start = Number(editor.selectionStart || 0);
    let end = Number(editor.selectionEnd || start);
    start = Math.max(0, Math.min(start, value.length));
    end = Math.max(start, Math.min(end, value.length));

    lastInsertTarget = {
      path,
      start,
      end,
      text: value,
      reason,
      capturedAt: new Date().toISOString()
    };
    return lastInsertTarget;
  }

  function explicitInsertionTarget(options = {}) {
    const explicitPath = normalizePath(options.insertPath || options.targetPath || '');
    const explicitPos = options.insertAt ?? options.start;
    if (!explicitPath || !Number.isFinite(Number(explicitPos))) return null;

    const file = State()?.getFile?.(explicitPath);
    if (!file || !State()?.textFile?.(file)) return null;
    const text = fileText(file);
    const start = Math.max(0, Math.min(Number(explicitPos), text.length));
    const end = Math.max(start, Math.min(Number(options.end ?? start), text.length));
    return { path: explicitPath, file, text, start, end, explicit: true };
  }

  function insertionTarget(options = {}) {
    const explicit = explicitInsertionTarget(options);
    if (explicit) return explicit;

    const project = State()?.state?.project || {};
    let path = normalizePath(project.activePath || project.rootFile || 'main.tex');
    let file = State()?.getFile?.(path);
    if (!file || !State()?.textFile?.(file) || !String(path).toLowerCase().endsWith('.tex')) {
      path = normalizePath(project.rootFile || 'main.tex');
      file = State()?.getFile?.(path);
    }
    if (!file) return null;

    // Save current textarea text before computing insertion point.
    const editor = el('sourceEditor');
    if (editor && project.activePath === path) {
      try { State()?.updateActiveText?.(editor.value); } catch (_err) {}
      file = State()?.getFile?.(path) || file;
    }

    const text = fileText(file);
    let start = text.length;
    let end = text.length;

    // Stage 8C: use the current/remembered editor cursor even after focus has
    // moved to the right panel. Do not require document.activeElement === editor.
    const editorSel = NS.Editor?.getSelection?.();
    if (editorSel && normalizePath(editorSel.path || path) === path && Number.isFinite(Number(editorSel.start))) {
      start = Number(editorSel.end ?? editorSel.start);
      end = start;
    } else {
      const serviceSel = NS.SelectionService?.getSourceSelection?.({ allowStale: true });
      if (serviceSel && normalizePath(serviceSel.path || path) === path && Number.isFinite(Number(serviceSel.end))) {
        start = Number(serviceSel.end);
        end = start;
      } else if (lastInsertTarget && normalizePath(lastInsertTarget.path) === path && lastInsertTarget.text === text && Number.isFinite(Number(lastInsertTarget.end))) {
        start = Number(lastInsertTarget.end);
        end = start;
      } else {
        const docEnd = text.lastIndexOf('\\end{document}');
        if (docEnd >= 0) start = end = docEnd;
      }
    }

    start = Math.max(0, Math.min(start, text.length));
    end = Math.max(start, Math.min(end, text.length));
    return { path, file, text, start, end };
  }

  function insertFigureSnippet(options = {}) {
    const snippet = options.snippet || figureSnippet(options);
    if (!snippet.trim()) return { ok: false, message: 'No image figure snippet to insert.' };

    const target = insertionTarget(options);
    if (!target) return { ok: false, message: 'No editable LaTeX target file found.' };

    // Stage 8F: insert at the captured cursor first. The earlier version added
    // \usepackage{graphicx} before insertion; that changed the file text and
    // triggered a fallback near \end{document}, so snippets appeared at the end.
    const insertText = `\n${snippet}\n`;
    let text = target.text;
    let start = target.start;
    let end = target.end;
    const next = text.slice(0, start) + insertText + text.slice(end);
    State().updateFile(target.path, next);

    // Add graphicx after the snippet is placed. This may shift the highlighted
    // range if it inserts above, but it does not change the insertion location.
    ensureGraphicsPackage();

    State().setActivePath?.(target.path);
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}

    setTimeout(() => {
      const file = State()?.getFile?.(target.path);
      const current = fileText(file);
      const idx = current.indexOf(insertText);
      const markStart = idx >= 0 ? idx : start;
      NS.SelectionService?.setSourceSelection?.(target.path, markStart, markStart + insertText.length, {
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
    try { NS.ImageToTikzService?.setSelectedPath?.(selectedAssetPath); } catch (_err) {}
    renderSnippetPreview();
    renderAssetList();
  }

  function renderSnippetPreview() {
    const box = el('assetSnippetPreview');
    if (!box) return;
    const opts = selectedOptions();
    box.textContent = opts.path ? figureSnippet(opts) : 'Select or add an image asset to preview the LaTeX image figure snippet.';
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
      insert.textContent = 'Insert as image';
      insert.title = 'Insert the original PNG/JPG as an \\includegraphics figure.';
      insert.addEventListener('click', () => {
        setSelectedAsset(file.path);
        const result = insertFigureSnippet(selectedOptions());
        setStatus(result.ok ? `Inserted original image figure snippet for ${file.path}.` : result.message);
      });

      const remakeTikz = document.createElement('button');
      remakeTikz.type = 'button';
      remakeTikz.className = 'asset-mini-btn';
      remakeTikz.textContent = 'Remake TikZ';
      remakeTikz.title = 'Convert/remake this image as editable TikZ source.';
      remakeTikz.addEventListener('click', () => {
        setSelectedAsset(file.path);
        if (!NS.ImageToTikzService?.remakeSelectedImage) {
          setStatus('Image-to-TikZ remaker is not loaded yet.');
          return;
        }
        NS.ImageToTikzService.openFiguresTab?.();
        NS.ImageToTikzService.remakeSelectedImage();
      });

      const remakeInsertTikz = document.createElement('button');
      remakeInsertTikz.type = 'button';
      remakeInsertTikz.className = 'asset-mini-btn';
      remakeInsertTikz.textContent = 'Remake+insert TikZ';
      remakeInsertTikz.title = 'Convert/remake this image as TikZ and insert TikZ source directly. If needed, type a short description in Image → TikZ first.';
      remakeInsertTikz.addEventListener('click', () => {
        setSelectedAsset(file.path);
        if (!NS.ImageToTikzService?.remakeAndInsert) {
          setStatus('Image-to-TikZ remaker is not loaded yet.');
          return;
        }
        NS.ImageToTikzService.openFiguresTab?.();
        NS.ImageToTikzService.remakeAndInsert();
      });

      actions.append(select, insert, remakeTikz, remakeInsertTikz);
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
      '      <label>Width <input id="assetWidthInput" type="text" value=".8\\linewidth" /></label>',
      '      <input id="assetSelectedPath" type="hidden" />',
      '      <div class="asset-actions">',
      '        <button type="button" class="btn mini primary" id="assetAddBtn">Add image</button>',
      '        <button type="button" class="btn mini" id="assetAddInsertBtn">Add + insert image</button>',
      '        <button type="button" class="btn mini" id="assetInsertBtn">Insert selected image</button>',
      '        <button type="button" class="btn mini" id="assetRefreshBtn">Refresh</button>',
      '      </div>',
      '      <div class="asset-status" id="assetServiceStatus">Asset service ready.</div>',
      '    </div>',
      '  </div>',
      '  <div class="asset-card">',
      '    <h3>Snippet preview</h3>',
      '    <pre class="asset-preview-code" id="assetSnippetPreview">Select or add an image asset to preview the LaTeX image figure snippet.</pre>',
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
      setStatus(inserted.ok ? `Added ${added.path} and inserted a image figure snippet.` : inserted.message);
    });

    el('assetInsertBtn')?.addEventListener('click', () => {
      const result = insertFigureSnippet(selectedOptions());
      setStatus(result.ok ? `Inserted image figure snippet for ${selectedOptions().path}.` : result.message);
    });

    el('assetRefreshBtn')?.addEventListener('click', () => {
      renderAssetPanel();
      setStatus('Asset list refreshed.');
    });

    ['assetCaptionInput', 'assetLabelInput', 'assetWidthInput'].forEach((id) => {
      el(id)?.addEventListener('input', renderSnippetPreview);
    });
  }

  function bindInsertionPointTracking() {
    const editor = el('sourceEditor');
    if (!editor || editor.__stage9hAssetCursorBound) return;

    const rememberNow = (reason) => rememberInsertionPoint(reason);
    const rememberSoon = (reason) => {
      // Pointer/click/touch events often update textarea selection after event
      // dispatch, especially on iPad. Capture after the browser has moved the caret.
      setTimeout(() => rememberNow(`${reason}|after-0ms`), 0);
      setTimeout(() => rememberNow(`${reason}|after-60ms`), 60);
      setTimeout(() => rememberNow(`${reason}|after-180ms`), 180);
    };

    ['pointerup', 'click', 'keyup', 'select', 'mouseup', 'touchend', 'input', 'blur'].forEach((name) => {
      editor.addEventListener(name, () => rememberSoon(`source-${name}`), false);
    });

    document.addEventListener('selectionchange', () => {
      if (document.activeElement === editor) rememberSoon('document-selectionchange');
    }, false);

    document.querySelector('.right-panel')?.addEventListener('pointerdown', () => {
      rememberNow('right-panel-pointerdown-now');
      rememberSoon('right-panel-pointerdown');
    }, true);

    editor.__stage9hAssetCursorBound = true;
  }

  function init() {
    if (installed) return;
    installed = true;
    createAssetTab();
    bindInsertionPointTracking();
    rememberInsertionPoint('asset-service-init');

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
    rememberInsertionPoint,
    findRootDocumentPath,
    documentInsertionTarget,
    getLastInsertTarget: () => lastInsertTarget,
    insertionTarget,
    insertFigureSnippet,
    addTextAsset,
    ensurePackage,
    ensureTikzPackage,
    directTikzFigureSnippet,
    insertDirectTikzFigure,
    inputFigureSnippet,
    insertInputFigureSnippet,
    setSelectedAsset,
    renderAssetPanel
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    createAssetTab();
    bindInsertionPointTracking();
    tries += 1;
    if (tries > 20 || el('assetsTab')) clearInterval(interval);
  }, 500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

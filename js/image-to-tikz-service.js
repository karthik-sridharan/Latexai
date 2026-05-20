/* Latexai Stage 10H ImageToTikzService
 * Stage: stage10h-accept-real-tikz-and-insert-anyway-1
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
  const STAGE = 'stage10h-accept-real-tikz-and-insert-anyway-1';

  let installed = false;
  let selectedPath = '';
  let latestRawAIText = '';
  let latestReturnedTikz = '';
  let latestDecision = null;
  let latestReturnedFile = null;

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
    const mm = buildMultimodalInput(file, dataUrl, prompt);
    return {
      instructions: [
        'You are a LaTeX TikZ reconstruction engine.',
        'The user selected an image from a LaTeX project and wants an editable TikZ remake.',
        'Inspect the image itself if the backend supports image input.',
        'Return ONLY one valid tikzpicture environment.',
        'Do NOT return JSON, Markdown, SVG, HTML, Mermaid, explanatory prose, or code fences.',
        'Do NOT include documentclass or begin{document}.',
        'Use robust TikZ primitives that compile with \\usepackage{tikz}.',
        'Approximate visual structure is better than copying pixel-perfect details.',
        'Use simple nodes, arrows, lines, boxes, circles, curves, and labels.',
        'If you cannot inspect the image, do not return a generic placeholder; use the user instructions.'
      ].join('\n'),
      input: mm.responsesInput,
      textInput: mm.text,
      messages: mm.chatMessages,
      image: {
        path: file.path,
        mime: file.mime || 'image/png',
        dataUrl
      },
      temperature: 0.05,
      maxOutputTokens: 5000
    };
  }

  function isMeaningfulPrompt(prompt) {
    const p = String(prompt || '').trim().toLowerCase();
    if (!p) return false;
    if (/^remake\s+figures\/.+\s+as\s+tikz$/.test(p)) return false;
    if (/^remake\s+.+\s+as\s+tikz$/.test(p) && !/(car|network|graph|tree|flow|box|circle|arrow|diagram|automaton|plot|chart|table|curve|wheel|node|layer)/.test(p)) return false;
    return p.length >= 4;
  }

  function hasTikzPicture(text) {
    const s = String(text || '');
    return /\\begin\{tikzpicture\}/.test(s) && /\\end\{tikzpicture\}/.test(s);
  }

  function countTikzDrawingCommands(text) {
    const s = String(text || '');
    const matches = s.match(/\\(?:draw|node|path|fill|coordinate|foreach|matrix|graph)\b/g);
    return matches ? matches.length : 0;
  }

  function isKnownBadTikzPlaceholder(tikz, file, prompt) {
    const s = String(tikz || '');
    const path = String(file?.path || selectedPath || '');
    const p = String(prompt || '').trim();

    const genericRectangle =
      /\\draw\[rounded corners,\s*thick\]\s*\(0,0\)\s*rectangle\s*\(5,2\.2\)/.test(s) &&
      /\\node\[align=center\]\s*at\s*\(2\.5,1\.1\)/.test(s);

    const labelLooksBad =
      /AI returned|Generated TikZ figure|Remake selected image as TikZ/i.test(s) ||
      (path && s.includes(`Remake ${path} as TikZ`)) ||
      (p && /^remake\s+/i.test(p) && s.includes(p));

    // Stage 10H: reject only the exact dumb rectangle/label placeholder family.
    // Do not reject real simple TikZ drawings just because they are small.
    return genericRectangle && labelLooksBad;
  }

  function assessTikzCandidate(tikz, file, prompt) {
    const s = String(tikz || '').trim();
    if (!s) return { ok: false, reason: 'empty-output' };
    if (/AI returned JSON instead of TikZ|AI returned a diagram schema/i.test(s)) {
      return { ok: false, reason: 'known-error-text' };
    }
    if (!hasTikzPicture(s)) {
      return { ok: false, reason: 'no-tikzpicture' };
    }
    if (isKnownBadTikzPlaceholder(s, file, prompt)) {
      return { ok: false, reason: 'known-generic-rectangle-placeholder' };
    }

    const commandCount = countTikzDrawingCommands(s);
    if (commandCount >= 2) {
      return { ok: true, reason: `accepted-real-tikz-${commandCount}-commands` };
    }

    // A tiny one-command tikzpicture can still be intentionally valid. Accept it
    // but mark it as low confidence so the user can inspect/override.
    return { ok: true, reason: `accepted-low-command-count-${commandCount}` };
  }

  // Backward-compatible name used by tests/older callers.
  function isGenericTikzPlaceholder(tikz, file, prompt) {
    return isKnownBadTikzPlaceholder(tikz, file, prompt);
  }

  function setReturnedTikz(raw, tikz, decision, file, source = 'remake') {
    latestRawAIText = String(raw || '');
    latestReturnedTikz = String(tikz || '');
    latestDecision = decision || null;
    latestReturnedFile = file || null;
    renderReturnedTikz(source);
  }

  function renderReturnedTikz(source = 'remake') {
    const node = el('imageTikzReturnedReport');
    if (!node) return;
    const decision = latestDecision || { ok: false, reason: 'no-decision' };
    node.classList.add('active');
    node.textContent = [
      'Latest image-to-TikZ returned TikZ',
      '=================================',
      '',
      `Source: ${source}`,
      `Decision: ${decision.ok ? 'accepted' : 'not inserted automatically'}`,
      `Reason: ${decision.reason || '(none)'}`,
      `Selected image: ${latestReturnedFile?.path || selectedPath || '(unknown)'}`,
      '',
      'Returned TikZ:',
      latestReturnedTikz || '(empty)',
      '',
      'Raw AI text:',
      safeSnippet(latestRawAIText, 2200) || '(empty)'
    ].join('\n');
  }

  async function copyReturnedTikz() {
    if (!latestReturnedTikz.trim()) {
      setStatus('No returned TikZ to copy yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(latestReturnedTikz);
      setStatus('Returned TikZ copied.');
    } catch (_err) {
      setStatus('Could not copy automatically. Select the returned TikZ text manually.');
    }
  }

  function openReturnedInTikzEditor() {
    if (!latestReturnedTikz.trim()) {
      setStatus('No returned TikZ to open yet.');
      return null;
    }
    pushToTikzMaker(latestReturnedTikz);
    setStatus('Returned TikZ opened in the AI TikZ maker for review/editing.');
    return latestReturnedTikz;
  }

  function insertReturnedTikzAnyway() {
    if (!latestReturnedTikz.trim()) {
      setStatus('No returned TikZ to insert yet.');
      return null;
    }
    pushToTikzMaker(latestReturnedTikz);
    const result = tikzMaker()?.saveTikz?.({ direct: true });
    setStatus(result?.ok
      ? 'Inserted the latest returned TikZ directly into source.'
      : (result?.message || 'Could not insert latest returned TikZ.'));
    return result;
  }

  function fallbackInstructionText(file) {
    // Stage 10G: no blocking browser popup. Earlier stages used a browser
    // prompt as a fallback when the backend did not see image pixels. The
    // backend is now vision-capable; if a textual hint is needed, the user can
    // type it in the Instructions box.
    const existing = getPrompt();
    return isMeaningfulPrompt(existing) ? existing : '';
  }

  function imageBackendUnsupportedMessage(file) {
    return [
      'The AI backend did not return real image-based TikZ.',
      'Latexai refused only the known bad placeholder/output.',
      '',
      `Selected image: ${file?.path || selectedPath || '(unknown)'}`,
      'Optionally type a short hint in the Instructions box, such as “simple car”, and click Remake+insert TikZ again.'
    ].join('\n');
  }

  function buildMultimodalInput(file, dataUrl, prompt) {
    const text = [
      'Remake this project image as editable LaTeX TikZ.',
      `Image path: ${file.path}`,
      `User instructions: ${prompt || 'Infer the diagram structure from the image.'}`,
      '',
      'Return only one tikzpicture environment. No JSON. No Markdown.'
    ].join('\n');

    return {
      text,
      responsesInput: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text },
            { type: 'input_image', image_url: dataUrl }
          ]
        }
      ],
      chatMessages: [
        {
          role: 'user',
          content: [
            { type: 'text', text },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ]
    };
  }

  function safeSnippet(value, limit = 1400) {
    const s = String(value ?? '');
    return s.length > limit ? `${s.slice(0, limit)}... [truncated ${s.length - limit} chars]` : s;
  }

  function backendConfigSummary() {
    const cfg = NS.AIProvider?.getConfig?.() || {};
    return {
      proxyUrl: cfg.proxyUrl || '(not configured)',
      provider: cfg.provider || '(default)',
      model: cfg.model || '(default)',
      hasProxyToken: !!cfg.proxyToken
    };
  }

  function classifyDiagnostic(raw, file, prompt) {
    const text = String(raw || '');
    const lower = text.toLowerCase();
    const likely = [];
    const path = String(file?.path || '');

    if (!text.trim()) likely.push('AI proxy returned an empty response.');
    if (/cannot (view|see|access|inspect)|unable to (view|see|access|inspect)|i can(?:not|'t) see|no image/i.test(text)) {
      likely.push('Model says it cannot see the image: backend is probably text-only or strips image payloads.');
    }
    if (/\\begin\{tikzpicture\}/.test(text) && isGenericTikzPlaceholder(text, file, prompt)) {
      likely.push('Model/backend returned the generic TikZ placeholder, not an image-based reconstruction.');
    }
    if (path && text.includes(path) && !/(car|wheel|body|vehicle|network|node|arrow|box|circle|layer)/i.test(text)) {
      likely.push('Response appears to use the filename/path rather than image pixels.');
    }
    if (/json|slides|elements|blockdiagram/i.test(text) && !/\\begin\{tikzpicture\}/.test(text)) {
      likely.push('Response looks like a presentation/JSON workflow, not TikZ generation.');
    }
    if (/\\begin\{tikzpicture\}/.test(text) && !likely.length) {
      likely.push('Backend returned TikZ-like output. If it still looks wrong, the model may not have received/understood the image.');
    }
    if (!likely.length) likely.push('Could not classify response; inspect raw response below.');

    return likely;
  }

  function renderDiagnosticReport(report) {
    const node = el('imageTikzDiagnosticReport');
    if (!node) return;
    node.classList.add('active');
    node.textContent = [
      'Image-to-TikZ backend diagnostic',
      '================================',
      '',
      `Time: ${report.time}`,
      `Selected image: ${report.imagePath}`,
      `Image MIME: ${report.mime}`,
      `Image data URL chars: ${report.dataUrlLength}`,
      '',
      'AI config:',
      JSON.stringify(report.config, null, 2),
      '',
      'Request shape:',
      JSON.stringify(report.requestShape, null, 2),
      '',
      'Diagnosis:',
      ...report.diagnosis.map((x) => `- ${x}`),
      '',
      'Raw AI text:',
      report.rawText || '(empty)',
      '',
      'Error:',
      report.error || '(none)'
    ].join('\n');
  }

  async function diagnoseSelectedImageBackend() {
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

    const prompt = getPrompt() || 'Diagnostic: identify the image content and remake as TikZ.';
    const mm = buildMultimodalInput(file, dataUrl, prompt);
    const diagnosticPayload = {
      instructions: [
        'This is a backend diagnostic for image understanding.',
        'Inspect the attached image if available.',
        'Return ONLY plain text with two short lines:',
        'SAW_IMAGE: yes/no/unsure',
        'DESCRIPTION: what the image visibly contains',
        'Do not infer solely from the filename.'
      ].join('\n'),
      input: mm.responsesInput,
      textInput: mm.text,
      messages: mm.chatMessages,
      image: {
        path: file.path,
        mime: file.mime || 'image/png',
        dataUrl
      },
      temperature: 0,
      maxOutputTokens: 900
    };

    const report = {
      time: new Date().toISOString(),
      imagePath: file.path,
      mime: file.mime || 'image/png',
      dataUrlLength: dataUrl.length,
      config: backendConfigSummary(),
      requestShape: {
        task: 'latex-copilot',
        workflow: 'image-to-tikz-diagnostic',
        hasResponsesInputImage: !!diagnosticPayload.input?.[0]?.content?.some?.((c) => c.type === 'input_image'),
        hasChatImageUrl: !!diagnosticPayload.messages?.[0]?.content?.some?.((c) => c.type === 'image_url'),
        hasLegacyImageDataUrl: !!diagnosticPayload.image?.dataUrl,
        textInputChars: diagnosticPayload.textInput.length
      },
      diagnosis: [],
      rawText: '',
      error: ''
    };

    setStatus('Running image AI backend diagnostic...');
    try {
      const response = await NS.AIProvider.ask(diagnosticPayload, {
        task: 'latex-copilot',
        context: {
          workflow: 'image-to-tikz-diagnostic',
          imagePath: file.path,
          prompt
        }
      });
      const raw = NS.AIProvider.extractText(response);
      const diagnosticTikz = tikzMaker()?.extractTikz?.(raw, prompt || `Diagnose ${file.path}`) || raw;
      const diagnosticDecision = assessTikzCandidate(diagnosticTikz, file, prompt);
      setReturnedTikz(raw, diagnosticTikz, diagnosticDecision, file, 'diagnostic');
      report.rawText = safeSnippet(raw, 2200);
      report.diagnosis = classifyDiagnostic(raw, file, prompt);
      renderDiagnosticReport(report);
      setStatus('Diagnostic complete. See the backend diagnostic report and latest returned TikZ below.');
      return report;
    } catch (err) {
      report.error = String(err?.message || err);
      report.diagnosis = [
        'AI proxy request failed. This is a connection/auth/CORS/backend-route problem, not a TikZ generation problem.',
        'Check AI Proxy URL, token, Cloud Run logs, and whether the /api/lumina/ai endpoint is deployed.'
      ];
      renderDiagnosticReport(report);
      setStatus('Diagnostic failed before model response. See report below.');
      return report;
    }
  }

  async function copyDiagnosticReport() {
    const text = el('imageTikzDiagnosticReport')?.textContent || '';
    if (!text.trim()) {
      setStatus('No diagnostic report to copy yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Diagnostic report copied.');
    } catch (_err) {
      setStatus('Could not copy automatically. Select the diagnostic report text manually.');
    }
  }

  function localFallbackTikz(file, prompt) {
    const label = String(prompt || file?.path || 'Remade image').replace(/[{}\\]/g, ' ').slice(0, 90);
    const lower = `${file?.path || ''} ${prompt || ''}`.toLowerCase();

    // Stage 10B: useful local fallback for the common hand-drawn simple-car case.
    // If the AI backend cannot do image input, do not insert the original PNG;
    // create editable TikZ approximating the image category.
    if (/(car|vehicle|auto|automobile|wheel|hand.?drawn)/.test(lower)) {
      return [
        '\\begin{tikzpicture}[scale=1, line cap=round, line join=round]',
        '  % Editable simple car remake',
        '  \\draw[thick, rounded corners=4pt] (0,0.6) -- (0.7,1.35) -- (2.6,1.35) -- (3.35,0.6) -- (4.2,0.6) -- (4.55,0.25) -- (4.35,0) -- (-0.15,0) -- (-0.35,0.25) -- (0,0.6);',
        '  \\draw[thick] (0.95,1.2) -- (1.35,0.65) -- (2.55,0.65) -- (2.25,1.2) -- cycle;',
        '  \\draw[thick] (1.45,0.65) -- (1.55,1.2);',
        '  \\draw[fill=white, thick] (0.85,0) circle (0.38);',
        '  \\draw[fill=white, thick] (3.45,0) circle (0.38);',
        '  \\fill (0.85,0) circle (0.08);',
        '  \\fill (3.45,0) circle (0.08);',
        '  \\draw[thick] (0.15,0.48) -- (0.55,0.48);',
        '  \\draw[thick] (3.8,0.45) -- (4.18,0.45);',
        '\\end{tikzpicture}',
        ''
      ].join('\n');
    }

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
      '  \\node[draw, rounded corners, thick, minimum width=2.4cm, minimum height=1cm] (a) at (0,0) {Original image};',
      '  \\node[draw, rounded corners, thick, minimum width=2.4cm, minimum height=1cm] (b) at (3.4,0) {Editable TikZ};',
      '  \\draw[->, thick] (a) -- (b);',
      `  \\node[align=center, font=\\scriptsize] at (1.7,-1.0) {${label}};`,
      '\\end{tikzpicture}',
      ''
    ].join('\n');
  }

  async function remakeSelectedImage(options = {}) {
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

    let prompt = getPrompt();
    // Stage 10F: now that the backend can forward image pixels, do NOT ask for
    // a manual description before trying the image-capable backend. Only ask for
    // a description if the backend fails or returns the generic placeholder.
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
      let tikz = tikzMaker()?.extractTikz?.(raw, prompt || `Remake ${file.path} as TikZ`) || raw;
      let decision = assessTikzCandidate(tikz, file, prompt);
      setReturnedTikz(raw, tikz, decision, file, 'remake');

      if (!decision.ok) {
        if (isKnownBadTikzPlaceholder(tikz, file, prompt) && isMeaningfulPrompt(prompt)) {
          tikz = localFallbackTikz(file, prompt);
          decision = assessTikzCandidate(tikz, file, prompt);
          setReturnedTikz(raw, tikz, decision, file, 'instruction-fallback');
          pushToTikzMaker(tikz);
          setStatus('AI returned the known generic rectangle placeholder, so Latexai used your Instructions text to create editable TikZ instead.');
          return tikz;
        }
        setStatus(`${imageBackendUnsupportedMessage(file)}\n\nReason: ${decision.reason}. Use “Open returned TikZ” or “Insert returned anyway” if you want to inspect/override.`);
        return null;
      }

      pushToTikzMaker(tikz);
      setStatus(`Image remade as editable TikZ and accepted (${decision.reason}). Review/edit it, then use Insert TikZ directly. This does not insert the original PNG.`);
      return tikz;
    } catch (err) {
      if (!isMeaningfulPrompt(prompt)) {
        setStatus(`${imageBackendUnsupportedMessage(file)}\n\nBackend error: ${err?.message || err}`);
        return null;
      }
      const fallback = localFallbackTikz(file, prompt);
      const decision = assessTikzCandidate(fallback, file, prompt);
      setReturnedTikz(String(err?.message || err), fallback, decision, file, 'local-fallback-after-error');
      pushToTikzMaker(fallback);
      setStatus(`AI image-to-TikZ failed; created editable TikZ from your Instructions text.\n${err?.message || err}`);
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
    const tikz = await remakeSelectedImage({ allowInstructionFallback: true });
    if (!tikz) return null;

    // Use TikzMakerService direct insert path so cursor/package/root behavior stays centralized.
    const result = tikzMaker()?.saveTikz?.({ direct: true });
    if (result?.ok) {
      setStatus('Remade image as editable TikZ and inserted directly into source. No PNG includegraphics snippet was inserted.');
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
      '      <div class="image-tikz-help">Choose a PNG/JPG/WebP/SVG image and remake it as editable TikZ source — not as an image include.</div>',
      '    </div>',
      '  </div>',
      '  <label>Instructions <textarea id="imageTikzPromptInput" placeholder="Example: remake this hand-drawn car as clean editable TikZ with wheels and a body"></textarea></label>',
      '  <div class="image-tikz-actions">',
      '    <button type="button" class="btn mini primary" id="imageTikzRemakeBtn">Remake as TikZ</button>',
      '    <button type="button" class="btn mini primary" id="imageTikzRemakeInsertBtn">Remake + insert TikZ</button>',
      '    <button type="button" class="btn mini" id="imageTikzDiagnoseBtn">Diagnose backend</button>',
      '    <button type="button" class="btn mini" id="imageTikzOpenReturnedBtn">Open returned TikZ</button>',
      '    <button type="button" class="btn mini" id="imageTikzInsertReturnedBtn">Insert returned anyway</button>',
      '    <button type="button" class="btn mini" id="imageTikzCopyReturnedBtn">Copy TikZ</button>',
      '    <button type="button" class="btn mini" id="imageTikzCopyDiagBtn">Copy report</button>',
      '    <button type="button" class="btn mini" id="imageTikzRefreshBtn">Refresh images</button>',
      '  </div>',
      '  <div class="image-tikz-status" id="imageTikzStatus">Image-to-TikZ remaker ready. Stage 10H accepts real TikZ and rejects only known bad placeholders. It never opens a description popup.</div>',
      '  <pre class="image-tikz-returned" id="imageTikzReturnedReport"></pre>',
      '  <pre class="image-tikz-diagnostic" id="imageTikzDiagnosticReport"></pre>',
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
    el('imageTikzDiagnoseBtn')?.addEventListener('click', diagnoseSelectedImageBackend, true);
    el('imageTikzOpenReturnedBtn')?.addEventListener('click', openReturnedInTikzEditor, true);
    el('imageTikzInsertReturnedBtn')?.addEventListener('click', insertReturnedTikzAnyway, true);
    el('imageTikzCopyReturnedBtn')?.addEventListener('click', copyReturnedTikz, true);
    el('imageTikzCopyDiagBtn')?.addEventListener('click', copyDiagnosticReport, true);
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
    diagnoseSelectedImageBackend,
    copyDiagnosticReport,
    copyReturnedTikz,
    openReturnedInTikzEditor,
    insertReturnedTikzAnyway,
    buildImageToTikzPayload,
    classifyDiagnostic,
    assessTikzCandidate,
    isKnownBadTikzPlaceholder,
    isGenericTikzPlaceholder,
    isMeaningfulPrompt,
    localFallbackTikz,
    pushToTikzMaker,
    getLatestReturnedTikz: () => latestReturnedTikz,
    getLatestDecision: () => latestDecision,
    openFiguresTab: () => {
      const button = document.querySelector('[data-right-tab="assets"]');
      if (button) button.click();
    },
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

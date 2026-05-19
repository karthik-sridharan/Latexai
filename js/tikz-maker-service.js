/* Latexai Stage 9A TikzMakerService
 * Stage: stage9a-ai-tikz-maker-1
 *
 * AI prompt -> TikZ source -> saved .tex asset -> \input{...} figure snippet.
 * Uses:
 * - AIProvider for AI generation
 * - AssetService for saving text assets and inserting snippets
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage9a-ai-tikz-maker-1';

  let installed = false;
  let latestTikz = '';

  function el(id) { return document.getElementById(id); }

  function State() { return NS.State; }

  function fileText(file) {
    if (!file) return '';
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function normalizePath(path) {
    return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
  }

  function slug(text, fallback = 'tikz-figure') {
    const s = String(text || '')
      .toLowerCase()
      .replace(/\\[a-zA-Z]+\*?/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    return s || fallback;
  }

  function setStatus(message) {
    const node = el('tikzMakerStatus');
    if (node) node.textContent = message;
  }

  function toast(message) {
    try { NS.Main?.toast?.(message); }
    catch (_err) {}
  }

  function defaultPath() {
    const prompt = el('tikzPromptInput')?.value || 'tikz figure';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `figures/${slug(prompt)}-${stamp}.tex`;
  }

  function getPrompt() {
    return String(el('tikzPromptInput')?.value || '').trim();
  }

  function setCode(text) {
    latestTikz = String(text || '');
    const code = el('tikzCodeOutput');
    if (code) code.value = latestTikz;
  }

  function getCode() {
    const code = el('tikzCodeOutput');
    return String(code?.value || latestTikz || '').trim();
  }

  function projectContext() {
    const project = State()?.state?.project || {};
    const active = State()?.getActiveFile?.();
    const root = State()?.getFile?.(project.rootFile || project.activePath || 'main.tex');
    const files = (project.files || []).map((f) => ({
      path: f.path,
      kind: f.kind,
      bytes: String(f.text || f.base64 || f.content || '').length
    }));

    return {
      schema: 'latexai-tikz-maker-context-v1',
      project: {
        name: project.name || '',
        rootFile: project.rootFile || '',
        activePath: project.activePath || '',
        files
      },
      activeFile: {
        path: active?.path || '',
        text: fileText(active).slice(0, 9000)
      },
      rootFile: {
        path: root?.path || '',
        text: fileText(root).slice(0, 9000)
      }
    };
  }

  function stripFence(text) {
    let s = String(text || '').trim();
    const fence = s.match(/^```(?:tex|latex|tikz)?\s*([\s\S]*?)\s*```$/i);
    if (fence) s = fence[1].trim();
    return s.trim();
  }

  function extractTikz(raw) {
    let s = stripFence(raw);
    if (/^\s*\{[\s\S]*\}\s*$/.test(s)) {
      try {
        const obj = JSON.parse(s);
        s = obj.tikz || obj.tikzSource || obj.source || obj.text || obj.content || s;
      } catch (_err) {}
    }
    s = stripFence(s);

    const begin = s.indexOf('\\begin{tikzpicture}');
    const endToken = '\\end{tikzpicture}';
    const end = s.lastIndexOf(endToken);
    if (begin >= 0 && end >= begin) {
      s = s.slice(begin, end + endToken.length).trim();
    }

    if (!/\\begin\{tikzpicture\}/.test(s)) {
      s = `\\begin{tikzpicture}[scale=1]\n${s}\n\\end{tikzpicture}`;
    }

    // Avoid accidental document-level wrappers.
    s = s.replace(/\\documentclass[\s\S]*?\\begin\{document\}/g, '').replace(/\\end\{document\}/g, '').trim();
    return s + '\n';
  }

  function fallbackTikz(prompt) {
    const label = String(prompt || 'Generated TikZ figure').replace(/[{}\\]/g, '').slice(0, 80);
    return [
      '\\begin{tikzpicture}[scale=1]',
      '  \\draw[rounded corners, thick] (0,0) rectangle (5,2.2);',
      '  \\node[align=center] at (2.5,1.1) {' + label + '};',
      '\\end{tikzpicture}',
      ''
    ].join('\n');
  }

  async function generateTikz() {
    const prompt = getPrompt();
    if (!prompt) {
      setStatus('Enter a prompt for the TikZ figure first.');
      return null;
    }

    setStatus('Generating TikZ with AI...');
    const payload = {
      schema: 'latexai-tikz-maker-request-v1',
      instruction: [
        'Generate valid LaTeX TikZ code for the requested figure.',
        'Return only one tikzpicture environment.',
        'Do not include documentclass, begin{document}, markdown explanation, or prose.',
        'Prefer simple robust TikZ primitives that compile with \\usepackage{tikz}.',
        'Avoid external image files.'
      ].join('\n'),
      prompt,
      context: projectContext()
    };

    try {
      const response = await NS.AIProvider.ask(payload, { task: 'tikz-figure-maker', context: payload.context });
      const text = NS.AIProvider.extractText(response);
      const tikz = extractTikz(text);
      setCode(tikz);
      setStatus('Generated TikZ. Review/edit it, then Save or Save + insert.');
      return tikz;
    } catch (err) {
      const tikz = fallbackTikz(prompt);
      setCode(tikz);
      setStatus(`AI generation failed; inserted a simple editable placeholder TikZ instead.\n${err?.message || err}`);
      return tikz;
    }
  }

  function selectedOptions() {
    const pathInput = String(el('tikzPathInput')?.value || '').trim();
    const prompt = getPrompt();
    return {
      path: normalizePath(pathInput || defaultPath()),
      caption: el('tikzCaptionInput')?.value || '',
      label: el('tikzLabelInput')?.value || `fig:${slug(prompt || pathInput || 'tikz-figure')}`
    };
  }

  function saveTikz({ insert = false } = {}) {
    const asset = NS.AssetService;
    if (!asset?.addTextAsset) {
      setStatus('AssetService.addTextAsset is not available.');
      return null;
    }

    const tikz = extractTikz(getCode());
    if (!tikz.trim()) {
      setStatus('No TikZ source to save. Generate or paste TikZ first.');
      return null;
    }

    const opts = selectedOptions();
    const capturedTarget = insert && asset.insertionTarget ? asset.insertionTarget() : null;
    const saved = asset.addTextAsset(opts.path, tikz, {
      assetType: 'tikz',
      kind: 'tex',
      createdBy: 'Latexai TikzMakerService'
    });

    if (!saved?.ok) {
      setStatus(saved?.message || 'Could not save TikZ asset.');
      return saved;
    }

    asset.ensureTikzPackage?.();

    if (insert) {
      const inserted = asset.insertInputFigureSnippet?.({
        path: saved.path,
        caption: opts.caption,
        label: opts.label,
        insertPath: capturedTarget?.path,
        insertAt: capturedTarget?.start,
        end: capturedTarget?.end
      });
      setStatus(inserted?.ok ? `Saved ${saved.path} and inserted \\input figure snippet.` : (inserted?.message || `Saved ${saved.path}; insert failed.`));
    } else {
      setStatus(`Saved ${saved.path}.`);
    }

    toast(insert ? 'TikZ saved and inserted.' : 'TikZ saved.');
    return saved;
  }

  function createCard() {
    const assetsTab = el('assetsTab');
    const assetPanel = assetsTab?.querySelector?.('.asset-panel');
    if (!assetPanel || el('tikzMakerCard')) return false;

    const card = document.createElement('div');
    card.className = 'tikz-maker-card';
    card.id = 'tikzMakerCard';
    card.innerHTML = [
      '<h3>AI TikZ maker</h3>',
      '<div class="tikz-maker-form">',
      '  <label>Prompt <textarea id="tikzPromptInput" placeholder="Example: draw a three-layer neural network with input, hidden, output nodes and arrows"></textarea></label>',
      '  <label>Save path <input id="tikzPathInput" type="text" placeholder="figures/generated-figure.tex" /></label>',
      '  <label>Caption <input id="tikzCaptionInput" type="text" placeholder="Optional caption" /></label>',
      '  <label>Label <input id="tikzLabelInput" type="text" placeholder="fig:generated-tikz" /></label>',
      '  <div class="tikz-maker-actions">',
      '    <button type="button" class="btn mini primary" id="tikzGenerateBtn">Generate TikZ</button>',
      '    <button type="button" class="btn mini" id="tikzSaveBtn">Save TikZ</button>',
      '    <button type="button" class="btn mini primary" id="tikzSaveInsertBtn">Save + insert</button>',
      '  </div>',
      '  <label>TikZ source <textarea id="tikzCodeOutput" class="tikz-maker-code" spellcheck="false" placeholder="Generated TikZ source appears here. You can edit before saving."></textarea></label>',
      '  <div class="tikz-maker-status" id="tikzMakerStatus">AI TikZ maker ready.</div>',
      '</div>'
    ].join('');

    // Put TikZ maker after native drawing card if present, otherwise at top.
    const figureCard = el('figureEditorCard');
    if (figureCard?.nextSibling) assetPanel.insertBefore(card, figureCard.nextSibling);
    else assetPanel.prepend(card);

    bindControls();
    return true;
  }

  function bindControls() {
    el('tikzGenerateBtn')?.addEventListener('click', generateTikz, true);
    el('tikzSaveBtn')?.addEventListener('click', () => saveTikz({ insert: false }), true);
    el('tikzSaveInsertBtn')?.addEventListener('click', () => saveTikz({ insert: true }), true);
    el('tikzCodeOutput')?.addEventListener('input', () => { latestTikz = getCode(); });
  }

  function openFiguresTab() {
    const button = document.querySelector('[data-right-tab="assets"]');
    if (button) button.click();
  }

  function init() {
    installed = true;
    createCard();
  }

  NS.TikzMakerService = {
    STAGE,
    init,
    openFiguresTab,
    generateTikz,
    saveTikz,
    extractTikz,
    fallbackTikz,
    projectContext,
    getLatestTikz: () => latestTikz
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

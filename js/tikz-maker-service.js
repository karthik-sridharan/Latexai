/* Latexai Stage 9B TikzMakerService
 * Stage: stage9b-tikz-json-sanitizer-fix-1
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
  const STAGE = 'stage9b-tikz-json-sanitizer-fix-1';

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

    // Accept common model fences, including the bad case that caused JSON to be
    // wrapped inside a tikzpicture.
    const fullFence = s.match(/^```(?:tex|latex|tikz|json|javascript|js)?\s*([\s\S]*?)\s*```$/i);
    if (fullFence) return fullFence[1].trim();

    // If the response has prose plus one fenced block, prefer the first block.
    const anyFence = s.match(/```(?:tex|latex|tikz|json|javascript|js)?\s*([\s\S]*?)```/i);
    if (anyFence) return anyFence[1].trim();

    return s.trim();
  }

  function removeLeadingJsonLanguageTag(text) {
    return String(text || '').trim().replace(/^(json|javascript|js)\s*(?=[{\[])/i, '').trim();
  }

  function tryParseJsonish(text) {
    let s = removeLeadingJsonLanguageTag(stripFence(text));
    const candidates = [s];

    const firstBrace = s.indexOf('{');
    const lastBrace = s.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(s.slice(firstBrace, lastBrace + 1));

    const firstBracket = s.indexOf('[');
    const lastBracket = s.lastIndexOf(']');
    if (firstBracket >= 0 && lastBracket > firstBracket) candidates.push(s.slice(firstBracket, lastBracket + 1));

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch (_err) {}
    }
    return null;
  }

  function texEscapeLabel(text) {
    return String(text || '')
      .replace(/[\\{}]/g, ' ')
      .replace(/_/g, '\\_')
      .replace(/\^/g, '')
      .replace(/#/g, '\\#')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
  }

  function collectJsonElements(obj) {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj.flatMap(collectJsonElements);

    const out = [];
    if (obj.type === 'blockDiagram' || obj.blocks || obj.connections) out.push(obj);

    if (Array.isArray(obj.elements)) out.push(...obj.elements.flatMap(collectJsonElements));
    if (Array.isArray(obj.slides)) out.push(...obj.slides.flatMap(collectJsonElements));
    if (Array.isArray(obj.children)) out.push(...obj.children.flatMap(collectJsonElements));
    return out;
  }

  function convertBlockDiagramJsonToTikz(diagram) {
    const blocks = Array.isArray(diagram?.blocks) ? diagram.blocks : [];
    const connections = Array.isArray(diagram?.connections) ? diagram.connections : [];
    if (!blocks.length) return '';

    const nodePositions = new Map();
    const nodeLabels = new Map();
    const lines = [
      '\\begin{tikzpicture}[>=stealth, node distance=1.2cm, every node/.style={font=\\small}]',
      '  \\tikzstyle{unit}=[circle, draw, thick, minimum size=8mm, align=center]',
      '  \\tikzstyle{layerlabel}=[font=\\bfseries\\small]'
    ];

    blocks.forEach((block, bi) => {
      const nodes = Array.isArray(block.nodes) ? block.nodes : [];
      const x = bi * 3.2;
      const count = Math.max(nodes.length, 1);
      const top = (count - 1) * 0.55;

      const blockLabel = texEscapeLabel(block.label || block.title || block.id || `Layer ${bi + 1}`);
      lines.push(`  \\node[layerlabel] at (${x}, ${top + 0.85}) {${blockLabel}};`);

      nodes.forEach((node, ni) => {
        const y = top - ni * 1.1;
        const id = String(node.id || `${block.id || 'block'}_${ni}`).replace(/[^A-Za-z0-9_-]/g, '_');
        const label = texEscapeLabel(node.label || node.id || `n${ni + 1}`);
        const tikzName = `n_${id}`;
        nodePositions.set(node.id || id, tikzName);
        nodeLabels.set(node.id || id, label);
        lines.push(`  \\node[unit] (${tikzName}) at (${x}, ${y}) {${label}};`);
      });
    });

    if (connections.length) {
      connections.forEach((edge) => {
        const from = nodePositions.get(edge.from);
        const to = nodePositions.get(edge.to);
        if (!from || !to) return;
        const label = texEscapeLabel(edge.label || '');
        if (label) lines.push(`  \\draw[->, thick] (${from}) -- node[above, sloped, font=\\scriptsize] {${label}} (${to});`);
        else lines.push(`  \\draw[->, thick] (${from}) -- (${to});`);
      });
    } else {
      // Default dense feed-forward style between adjacent blocks.
      for (let bi = 0; bi + 1 < blocks.length; bi++) {
        const left = Array.isArray(blocks[bi].nodes) ? blocks[bi].nodes : [];
        const right = Array.isArray(blocks[bi + 1].nodes) ? blocks[bi + 1].nodes : [];
        left.forEach((a) => right.forEach((b) => {
          const from = nodePositions.get(a.id);
          const to = nodePositions.get(b.id);
          if (from && to) lines.push(`  \\draw[->, thick] (${from}) -- (${to});`);
        }));
      }
    }

    lines.push('\\end{tikzpicture}', '');
    return lines.join('\n');
  }

  function convertJsonToTikz(obj) {
    if (!obj) return '';
    if (typeof obj.tikz === 'string') return extractTikz(obj.tikz);
    if (typeof obj.tikzSource === 'string') return extractTikz(obj.tikzSource);
    if (typeof obj.source === 'string' && /\\begin\{tikzpicture\}/.test(obj.source)) return extractTikz(obj.source);

    const diagrams = collectJsonElements(obj);
    for (const diagram of diagrams) {
      const tikz = convertBlockDiagramJsonToTikz(diagram);
      if (tikz) return tikz;
    }

    return '';
  }

  function looksLikeJsonNotTikz(text) {
    const s = removeLeadingJsonLanguageTag(stripFence(text));
    return /^[{\[]/.test(s) || /"slides"\s*:|"elements"\s*:|"blocks"\s*:|"connections"\s*:/.test(s);
  }

  function extractTikz(raw) {
    let s = stripFence(raw);

    const parsed = tryParseJsonish(s);
    if (parsed) {
      const converted = convertJsonToTikz(parsed);
      if (converted) return converted;
      return fallbackTikz('AI returned JSON instead of TikZ');
    }

    s = removeLeadingJsonLanguageTag(s);

    const begin = s.indexOf('\\begin{tikzpicture}');
    const endToken = '\\end{tikzpicture}';
    const end = s.lastIndexOf(endToken);
    if (begin >= 0 && end >= begin) {
      s = s.slice(begin, end + endToken.length).trim();

      // Guard against the exact bad output: \begin{tikzpicture} json {...} \end{tikzpicture}
      const inside = s.slice('\\begin{tikzpicture}'.length, s.length - endToken.length);
      if (looksLikeJsonNotTikz(inside)) {
        const insideParsed = tryParseJsonish(inside);
        const converted = convertJsonToTikz(insideParsed);
        return converted || fallbackTikz('AI returned JSON inside a tikzpicture');
      }

      return s + '\n';
    }

    // Never wrap raw JSON/schema text inside tikzpicture. That creates invalid
    // .tex files and was the bug reported in Stage 9A.
    if (looksLikeJsonNotTikz(s)) {
      const converted = convertJsonToTikz(tryParseJsonish(s));
      return converted || fallbackTikz('AI returned a diagram schema instead of TikZ');
    }

    // Only wrap plain TikZ draw/node commands, not arbitrary prose.
    if (/\\(draw|node|path|coordinate|foreach|fill|shade|matrix|graph)\b/.test(s)) {
      return `\\begin{tikzpicture}[scale=1]\n${s}\n\\end{tikzpicture}\n`;
    }

    return fallbackTikz(s || 'Generated TikZ figure');
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
        'Do not return JSON, slide JSON, Mermaid, SVG, HTML, or a diagram schema.',
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

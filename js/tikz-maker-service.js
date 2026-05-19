/* Latexai Stage 9F TikzMakerService
 * Stage: stage9h-tikz-cursor-regex-fix-1
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
  const STAGE = 'stage9h-tikz-cursor-regex-fix-1';

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

  function normalizeTikzAssetPath(path) {
    let p = normalizePath(path || defaultPath());
    if (!p) p = defaultPath();
    if (!p.includes('/')) p = `figures/${p}`;
    // TikZ is LaTeX source, never an image. If the user types mlp.png,
    // save it as mlp.tex rather than putting TikZ code inside a PNG file.
    p = p.replace(/\.(png|jpe?g|webp|svg)$/i, '.tex');
    if (!/\.(tex|tikz)$/i.test(p)) p += '.tex';
    return p;
  }

  function getPrompt() {
    return String(el('tikzPromptInput')?.value || '').trim();
  }

  function normalizeTikzNewlines(text) {
    let s = String(text || '');
    // Stage 9D: if code contains literal backslash-n sequences from a buggy
    // generator or pasted content, convert them to real newlines.
    if (s.includes('\\n')) s = s.replace(/\\n/g, '\n');
    if (s.includes('\\t')) s = s.replace(/\\t/g, '  ');
    return s;
  }

  function setCode(text) {
    latestTikz = normalizeTikzNewlines(String(text || ''));
    const code = el('tikzCodeOutput');
    if (code) code.value = latestTikz;
  }

  function getCode() {
    const code = el('tikzCodeOutput');
    return normalizeTikzNewlines(String(code?.value || latestTikz || '')).trim();
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

  function extractTikz(raw, originalPrompt = '') {
    let s = normalizeTikzNewlines(stripFence(raw));

    const parsed = tryParseJsonish(s);
    if (parsed) {
      const converted = convertJsonToTikz(parsed);
      if (converted) return converted;
      return fallbackTikz(originalPrompt || 'AI returned JSON instead of TikZ');
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
        return converted || fallbackTikz(originalPrompt || 'AI returned JSON inside a tikzpicture');
      }

      return s + '\n';
    }

    // Never wrap raw JSON/schema text inside tikzpicture. That creates invalid
    // .tex files and was the bug reported in Stage 9A.
    if (looksLikeJsonNotTikz(s)) {
      const converted = convertJsonToTikz(tryParseJsonish(s));
      return converted || fallbackTikz(originalPrompt || 'AI returned a diagram schema instead of TikZ');
    }

    // Only wrap plain TikZ draw/node commands, not arbitrary prose.
    if (/\\(draw|node|path|coordinate|foreach|fill|shade|matrix|graph)\b/.test(s)) {
      return `\\begin{tikzpicture}[scale=1]\n${s}\n\\end{tikzpicture}\n`;
    }

    return fallbackTikz(originalPrompt || s || 'Generated TikZ figure');
  }

  function fallbackTikz(prompt) {
    const p = String(prompt || 'Generated TikZ figure').toLowerCase();

    if (/(neural|network|feed.?forward|hidden layer|input layer|output layer)/.test(p)) {
      return [
        '\\begin{tikzpicture}[>=stealth, every node/.style={font=\\small}]',
        '  \\tikzstyle{unit}=[circle, draw, thick, minimum size=8mm, align=center]',
        '  \\node[font=\\bfseries] at (0, 2.1) {Input};',
        '  \\node[font=\\bfseries] at (3, 2.1) {Hidden};',
        '  \\node[font=\\bfseries] at (6, 2.1) {Output};',
        '  \\node[unit] (x1) at (0, 1.0) {$x_1$};',
        '  \\node[unit] (x2) at (0,-1.0) {$x_2$};',
        '  \\node[unit] (h1) at (3, 1.2) {$h_1$};',
        '  \\node[unit] (h2) at (3, 0.0) {$h_2$};',
        '  \\node[unit] (hm) at (3,-1.2) {$h_m$};',
        '  \\node[unit] (y)  at (6, 0.0) {$y$};',
        '  \\foreach \\i in {x1,x2}{',
        '    \\foreach \\j in {h1,h2,hm}{',
        '      \\draw[->, thick] (\\i) -- (\\j);',
        '    }',
        '  }',
        '  \\foreach \\j in {h1,h2,hm}{',
        '    \\draw[->, thick] (\\j) -- (y);',
        '  }',
        '  \\node at (3,-2.05) {$h_j=\\sigma(w_j^\\top x+b_j)$};',
        '\\end{tikzpicture}',
        ''
      ].join('\n');
    }

    if (/(flow|pipeline|block|diagram|process|architecture)/.test(p)) {
      const label = texEscapeLabel(prompt || 'Process');
      return [
        '\\begin{tikzpicture}[>=stealth, node distance=1.5cm, every node/.style={font=\\small}]',
        '  \\tikzstyle{block}=[draw, rounded corners, thick, minimum width=2.2cm, minimum height=9mm, align=center]',
        '  \\node[block] (a) at (0,0) {Input};',
        '  \\node[block] (b) at (3,0) {Model};',
        '  \\node[block] (c) at (6,0) {Output};',
        '  \\draw[->, thick] (a) -- (b);',
        '  \\draw[->, thick] (b) -- (c);',
        `  \\node[align=center, font=\\scriptsize] at (3,-1.0) {${label}};`,
        '\\end{tikzpicture}',
        ''
      ].join('\n');
    }

    const label = texEscapeLabel(prompt || 'Generated TikZ figure');
    return [
      '\\begin{tikzpicture}[scale=1]',
      '  \\draw[rounded corners, thick] (0,0) rectangle (5,2.2);',
      `  \\node[align=center] at (2.5,1.1) {${label}};`,
      '\\end{tikzpicture}',
      ''
    ].join('\n');
  }

  function buildTikzSystemPrompt() {
    return [
      'You are a LaTeX TikZ generator.',
      'Return ONLY valid LaTeX TikZ code.',
      'The output must contain exactly one \\\\begin{tikzpicture} ... \\\\end{tikzpicture} environment.',
      'Do NOT return JSON.',
      'Do NOT return slide JSON, Mermaid, SVG, HTML, XML, Markdown, prose, explanations, or code fences.',
      'Do NOT include \\\\documentclass or \\\\begin{document}.',
      'Use robust TikZ primitives: \\\\node, \\\\draw, \\\\path, \\\\foreach.',
      'Assume only \\\\usepackage{tikz} is available unless you explicitly avoid extra libraries.'
    ].join('\n');
  }

  function buildTikzUserPrompt(prompt) {
    const ctx = projectContext();
    return [
      'Create a TikZ figure for this request:',
      prompt,
      '',
      'Again: return ONLY the tikzpicture environment. No JSON. No Markdown.',
      '',
      'Project context:',
      JSON.stringify({
        rootFile: ctx.project.rootFile,
        activePath: ctx.project.activePath,
        files: ctx.project.files.slice(0, 20)
      }, null, 2)
    ].join('\n');
  }

  async function generateTikz() {
    const prompt = getPrompt();
    if (!prompt) {
      setStatus('Enter a prompt for the TikZ figure first.');
      return null;
    }

    setStatus('Generating TikZ with AI...');
    const system = buildTikzSystemPrompt();
    const user = buildTikzUserPrompt(prompt);

    try {
      // Stage 9C: mirror the working Copilot payload shape. Some AI backends
      // ignored the Stage 9A custom schema and returned presentation/slide JSON.
      const response = await NS.AIProvider.ask(
        {
          instructions: system,
          input: user,
          temperature: 0.05,
          maxOutputTokens: 4200
        },
        {
          task: 'latex-copilot',
          context: {
            workflow: 'tikz-figure-maker',
            prompt,
            project: projectContext().project
          }
        }
      );
      const text = NS.AIProvider.extractText(response);
      const tikz = extractTikz(text, prompt);
      setCode(tikz);

      if (/AI returned|Generated TikZ figure/.test(tikz) && !/\\draw|\\node|\\foreach/.test(text)) {
        setStatus('AI did not return usable TikZ, so Latexai produced a local editable TikZ figure from your prompt.');
      } else {
        setStatus('Generated TikZ. Review/edit it, then Save or Insert TikZ directly.');
      }
      return tikz;
    } catch (err) {
      const tikz = fallbackTikz(prompt);
      setCode(tikz);
      setStatus(`AI generation failed; Latexai produced a local editable TikZ figure from your prompt.\n${err?.message || err}`);
      return tikz;
    }
  }

  function selectedOptions() {
    const pathInput = String(el('tikzPathInput')?.value || '').trim();
    const prompt = getPrompt();
    return {
      path: normalizeTikzAssetPath(pathInput || defaultPath()),
      caption: el('tikzCaptionInput')?.value || '',
      label: el('tikzLabelInput')?.value || `fig:${slug(prompt || pathInput || 'tikz-figure')}`
    };
  }

  function saveTikz({ insert = false, direct = false } = {}) {
    const asset = NS.AssetService;
    if (!asset?.addTextAsset && !direct) {
      setStatus('AssetService.addTextAsset is not available.');
      return null;
    }

    const tikz = extractTikz(getCode(), getPrompt());
    if (!tikz.trim()) {
      setStatus('No TikZ source to save or insert. Generate or paste TikZ first.');
      return null;
    }

    const opts = selectedOptions();
    const capturedTarget = (insert || direct) && asset?.documentInsertionTarget ? asset.documentInsertionTarget() : ((insert || direct) && asset?.insertionTarget ? asset.insertionTarget() : null);

    // Stage 9E default behavior for "Insert TikZ directly":
    // TikZ code is LaTeX source, so put the tikzpicture directly into the paper.
    // Do not save it as .png and do not \input{figures/mlp.png}.
    if (direct) {
      const inserted = asset.insertDirectTikzFigure?.({
        tikz,
        caption: opts.caption,
        label: opts.label,
        insertPath: capturedTarget?.path,
        insertAt: capturedTarget?.start,
        end: capturedTarget?.end
      });
      setStatus(inserted?.ok ? 'Inserted TikZ directly into the main LaTeX document source.' : (inserted?.message || 'Direct TikZ insert failed.'));
      toast(inserted?.ok ? 'TikZ inserted directly.' : 'TikZ insert failed.');
      return inserted;
    }

    // Optional advanced mode: save as a .tex file, never as image.
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

    toast(insert ? 'TikZ .tex saved and inserted.' : 'TikZ .tex saved.');
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
      '  <label>Save path <input id="tikzPathInput" type="text" placeholder="figures/generated-figure.tex (TikZ source, not PNG)" /></label>',
      '  <label>Caption <input id="tikzCaptionInput" type="text" placeholder="Optional caption" /></label>',
      '  <label>Label <input id="tikzLabelInput" type="text" placeholder="fig:generated-tikz" /></label>',
      '  <div class="tikz-maker-actions">',
      '    <button type="button" class="btn mini primary" id="tikzGenerateBtn">Generate TikZ</button>',
      '    <button type="button" class="btn mini" id="tikzSaveBtn">Save .tex file</button>',
      '    <button type="button" class="btn mini primary" id="tikzDirectInsertBtn">Insert TikZ directly</button>',
      '    <button type="button" class="btn mini" id="tikzSaveInsertBtn">Save .tex + \\input</button>',
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
    el('tikzDirectInsertBtn')?.addEventListener('click', () => saveTikz({ direct: true }), true);
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

/* Latexai Stage 13B PresentationExportService
 * Stage: stage13b-presentation-maker-compatible-export-1
 *
 * Fixes Stage 13A export schema so Presentation Maker imports visible content.
 * Presentation Maker expects slides with leftBlocks/rightBlocks, not only
 * semantic fields like bullets/latex. Stage 13B normalizes every exported slide
 * into the Presentation Maker deck schema:
 *
 * deckTitle, summary, slides[].slideType/title/lede/leftBlocks/rightBlocks/etc.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage13b-presentation-maker-compatible-export-1';
  const PROMPT_PATH = 'prompt/ai-paper-to-presentation-export.txt';

  let promptCache = '';
  let lastRaw = '';
  let lastDeck = null;
  let lastSavedPath = '';

  function State() { return NS.State; }
  function el(id) { return document.getElementById(id); }

  function toast(message) {
    try { NS.Main?.toast?.(message); } catch (_err) {}
  }

  function setStatus(message) {
    const node = el('presentationExportStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const node = el('presentationExportOutput');
    if (!node) return;
    node.classList.add('active');
    node.textContent = String(text || '');
  }

  function normalizePath(path) {
    return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
  }

  function fileText(file) {
    if (!file) return '';
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function textFile(file) {
    try { return !!State()?.textFile?.(file); } catch (_err) {}
    return file && !file.base64 && !['asset', 'binary'].includes(file.kind);
  }

  function project() {
    return State()?.state?.project || {};
  }

  function rootPath() {
    const p = project();
    if (p.rootFile) return normalizePath(p.rootFile);
    const files = p.files || [];
    const root = files.find((f) => /\.tex$/i.test(f.path || '') && /\\documentclass/.test(fileText(f)));
    return normalizePath(root?.path || files.find((f) => /\.tex$/i.test(f.path || ''))?.path || 'main.tex');
  }

  function promptUrl() {
    const stage = encodeURIComponent(W.LUMINA_LATEX_STAGE || STAGE);
    return `${PROMPT_PATH}?v=${stage}`;
  }

  async function loadExportPrompt() {
    if (promptCache) return promptCache;
    try {
      const response = await fetch(promptUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      promptCache = text.trim() || 'Return Presentation Maker JSON deck.';
    } catch (_err) {
      promptCache = 'Return JSON only with deckTitle, summary, and slides using slideType/title/leftBlocks/rightBlocks. Every content slide must have leftBlocks with visible content.';
    }
    return promptCache;
  }

  function collectPaperContext(maxChars = 90000) {
    const files = (project().files || [])
      .filter((file) => textFile(file))
      .filter((file) => /\.(tex|bib|bbl|md|txt)$/i.test(file.path || ''))
      .filter((file) => !/^prompt\//i.test(normalizePath(file.path || '')))
      .filter((file) => !/^exports\//i.test(normalizePath(file.path || '')))
      .sort((a, b) => {
        const ar = normalizePath(a.path) === rootPath() ? 0 : 1;
        const br = normalizePath(b.path) === rootPath() ? 0 : 1;
        return ar - br || normalizePath(a.path).localeCompare(normalizePath(b.path));
      });

    const parts = [];
    let used = 0;
    for (const file of files) {
      const path = normalizePath(file.path);
      let text = fileText(file);
      if (!text.trim()) continue;
      const header = `\n\n%%%% FILE: ${path}\n`;
      const remaining = maxChars - used - header.length;
      if (remaining <= 0) break;
      if (text.length > remaining) text = text.slice(0, Math.max(0, remaining)) + '\n% [truncated]\n';
      parts.push(header + text);
      used += header.length + text.length;
    }

    return {
      text: parts.join(''),
      summary: `${files.length} text files considered; ${used} chars included; root: ${rootPath()}`
    };
  }

  function stripJsonFence(raw) {
    let s = String(raw || '').trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) s = s.slice(first, last + 1);
    return s;
  }

  function cleanText(value) {
    return String(value || '').trim();
  }

  function clampColor(value, fallback) {
    const s = cleanText(value);
    return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
  }

  function normalizeBlock(block, fallbackTitle = 'Content') {
    if (typeof block === 'string') {
      return { mode: 'plain', title: fallbackTitle, content: block.trim() };
    }

    return {
      mode: cleanText(block?.mode || 'plain'),
      title: cleanText(block?.title || fallbackTitle),
      content: cleanText(block?.content || '')
    };
  }

  function bulletsToContent(bullets) {
    const items = (Array.isArray(bullets) ? bullets : [])
      .map((b) => cleanText(b))
      .filter(Boolean);
    if (!items.length) return '';
    return ['\\begin{itemize}', ...items.map((b) => `\\item ${b}`), '\\end{itemize}'].join('\n');
  }

  function semanticSlideBlocks(slide) {
    const blocks = [];

    const bulletsContent = bulletsToContent(slide?.bullets);
    if (bulletsContent) {
      blocks.push({
        mode: 'panel',
        title: cleanText(slide?.source || slide?.kind || 'Key points'),
        content: bulletsContent
      });
    }

    const latex = cleanText(slide?.latex);
    if (latex) {
      blocks.push({
        mode: 'pseudocode-latex',
        title: slide?.kind === 'proof-sketch' ? 'Proof sketch' : 'LaTeX / Math',
        content: latex.includes('EQ:') ? latex : `EQ: ${latex}`
      });
    }

    const figurePrompt = cleanText(slide?.figurePrompt);
    if (figurePrompt) {
      blocks.push({
        mode: 'placeholder',
        title: 'Suggested figure',
        content: figurePrompt
      });
    }

    return blocks;
  }

  function normalizeBlocks(blocks, fallbackTitle) {
    return (Array.isArray(blocks) ? blocks : [])
      .map((b) => normalizeBlock(b, fallbackTitle))
      .filter((b) => b.content || b.title);
  }

  function normalizePmSlide(slide, index) {
    const semanticBlocks = semanticSlideBlocks(slide);
    let leftBlocks = normalizeBlocks(slide?.leftBlocks, 'Content');
    let rightBlocks = normalizeBlocks(slide?.rightBlocks, 'Details');

    if (!leftBlocks.length && semanticBlocks.length) leftBlocks = semanticBlocks;
    else if (leftBlocks.length && semanticBlocks.length && !slide?.leftBlocks) leftBlocks.push(...semanticBlocks);

    const kind = cleanText(slide?.kind);
    const requestedType = cleanText(slide?.slideType);
    let slideType = requestedType || (kind === 'title' ? 'title-center' : 'single');
    if (!['title-center', 'single', 'two-col'].includes(slideType)) slideType = 'single';

    if (slideType === 'two-col' && !rightBlocks.length && leftBlocks.length > 1) {
      rightBlocks = leftBlocks.splice(Math.ceil(leftBlocks.length / 2));
    }

    const title = cleanText(slide?.title || `Slide ${index + 1}`);
    const lede = cleanText(slide?.lede || slide?.subtitle || (Array.isArray(slide?.bullets) ? slide.bullets[0] : ''));

    if (slideType !== 'title-center' && !leftBlocks.length && !rightBlocks.length) {
      leftBlocks.push({
        mode: 'plain',
        title: 'Content',
        content: lede || title
      });
    }

    if (slideType === 'title-center') {
      leftBlocks = [];
      rightBlocks = [];
    }

    return {
      slideType,
      headingLevel: cleanText(slide?.headingLevel || (slideType === 'title-center' ? 'h1' : 'h2')),
      bgColor: clampColor(slide?.bgColor, '#ffffff'),
      fontColor: clampColor(slide?.fontColor, '#000000'),
      inheritTheme: slide?.inheritTheme === false ? false : true,
      title,
      kicker: cleanText(slide?.kicker || kind || ''),
      lede,
      leftBlocks,
      rightBlocks,
      notesTitle: cleanText(slide?.notesTitle || (slide?.speakerNotes ? 'Speaker notes' : '')),
      notesBody: cleanText(slide?.notesBody || slide?.speakerNotes || '')
    };
  }

  function ensureTitleSlide(deckTitle, subtitle, slides) {
    const first = slides[0];
    if (first?.slideType === 'title-center') return slides;
    return [{
      slideType: 'title-center',
      headingLevel: 'h1',
      bgColor: '#ffffff',
      fontColor: '#000000',
      inheritTheme: true,
      title: deckTitle,
      kicker: '',
      lede: subtitle || '',
      leftBlocks: [],
      rightBlocks: [],
      notesTitle: '',
      notesBody: ''
    }, ...slides];
  }

  function normalizeDeck(data, options = {}) {
    const rawSlides = Array.isArray(data?.slides) ? data.slides : [];
    let slides = rawSlides.map(normalizePmSlide);

    const deckTitle = cleanText(data?.deckTitle || data?.title || project().name || 'Latexai Presentation');
    const subtitle = cleanText(data?.subtitle || '');
    slides = ensureTitleSlide(deckTitle, subtitle, slides);

    return {
      schema: 'presentation-maker-deck-v1',
      exportSchema: 'latexai-presentation-maker-json-v1',
      stage: STAGE,
      deckTitle,
      summary: cleanText(data?.summary || subtitle || `Presentation exported from ${rootPath()}`),
      slides,
      metadata: {
        style: cleanText(data?.metadata?.style || options.style || 'research-talk'),
        targetSlideCount: Number(data?.metadata?.targetSlideCount || options.targetSlideCount || slides.length || 10),
        rootPath: rootPath(),
        generatedAt: new Date().toISOString(),
        warnings: Array.isArray(data?.metadata?.warnings) ? data.metadata.warnings.map(String) : []
      }
    };
  }

  function parseDeck(raw, options = {}) {
    let data;
    try {
      data = JSON.parse(stripJsonFence(raw));
    } catch (err) {
      return { ok: false, error: `Could not parse presentation JSON: ${err.message}`, deck: null };
    }

    const deck = normalizeDeck(data, options);
    if (!deck.slides.length) return { ok: false, error: 'AI returned JSON but no slides.', deck };

    const contentSlides = deck.slides.filter((s) => s.slideType !== 'title-center');
    const emptyContent = contentSlides.filter((s) => !(s.leftBlocks?.length || s.rightBlocks?.length));
    if (emptyContent.length) {
      return { ok: false, error: `Deck has ${emptyContent.length} content slide(s) without blocks.`, deck };
    }

    return { ok: true, deck };
  }

  function buildPayload(style, targetSlideCount, instructions) {
    return loadExportPrompt().then((prompt) => {
      const context = collectPaperContext();
      const input = [
        prompt,
        '',
        '--- Export settings ---',
        `Style: ${style}`,
        `Target slide count: ${targetSlideCount}`,
        `Extra instructions: ${instructions || '(none)'}`,
        `Context summary: ${context.summary}`,
        '',
        '--- Paper context ---',
        context.text
      ].join('\n');

      return {
        instructions: 'Return Presentation Maker compatible JSON only. No markdown fences. No prose outside JSON. Use slideType/title/leftBlocks/rightBlocks fields.',
        input,
        temperature: 0.12,
        maxOutputTokens: 10000,
        presentationExport: {
          style,
          targetSlideCount,
          rootPath: rootPath(),
          promptFile: PROMPT_PATH,
          schema: 'presentation-maker-deck-v1'
        }
      };
    });
  }

  async function runPresentationExport() {
    if (!NS.AIProvider?.ask) {
      setStatus('AIProvider is not loaded.');
      return null;
    }

    const style = el('presentationExportStyle')?.value || 'research-talk';
    const targetSlideCount = Number(el('presentationExportSlideCount')?.value || 10);
    const instructions = cleanText(el('presentationExportPrompt')?.value || '');

    setStatus(`Exporting paper to Presentation Maker JSON (${targetSlideCount} slides, ${style})...`);

    try {
      const payload = await buildPayload(style, targetSlideCount, instructions);
      const response = await NS.AIProvider.ask(payload, {
        task: 'latex-paper-to-presentation-export',
        context: {
          workflow: 'paper-to-presentation-export',
          rootPath: rootPath(),
          style,
          targetSlideCount,
          promptFile: PROMPT_PATH,
          schema: 'presentation-maker-deck-v1'
        }
      });

      lastRaw = NS.AIProvider.extractText(response);
      const parsed = parseDeck(lastRaw, { style, targetSlideCount });
      if (!parsed.ok) {
        lastDeck = parsed.deck;
        setOutput([
          'Presentation export failed',
          '==========================',
          '',
          parsed.error,
          '',
          'Raw AI output:',
          lastRaw
        ].join('\n'));
        setStatus(parsed.error);
        return parsed;
      }

      lastDeck = parsed.deck;
      setOutput(JSON.stringify(lastDeck, null, 2));
      setStatus(`Generated Presentation Maker JSON with ${lastDeck.slides.length} slide(s) and visible blocks.`);
      return { ok: true, deck: lastDeck };
    } catch (err) {
      setStatus(`Presentation export failed: ${err?.message || err}`);
      return null;
    }
  }

  function slug(value) {
    return cleanText(value || 'presentation')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'presentation';
  }

  function saveDeckToProject(deck = lastDeck) {
    if (!deck?.slides?.length) {
      setStatus('No presentation deck JSON to save yet. Run export first.');
      return { ok: false };
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = normalizePath(`exports/${slug(deck.deckTitle || deck.title)}-${stamp}.presentation.json`);
    const text = JSON.stringify(deck, null, 2) + '\n';

    const existing = State()?.getFile?.(path);
    if (existing) State()?.updateFile?.(path, text);
    else State()?.createFile?.(path, text);

    lastSavedPath = path;

    try { State()?.setActivePath?.(path); } catch (_err) {}
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}

    setStatus(`Saved Presentation Maker JSON to ${path}.`);
    toast('Presentation JSON saved.');
    return { ok: true, path };
  }

  async function runAndSavePresentationExport() {
    const result = await runPresentationExport();
    if (!result?.ok) return result;
    return saveDeckToProject(result.deck);
  }

  async function copyDeckJson() {
    const text = lastDeck ? JSON.stringify(lastDeck, null, 2) : (lastRaw || '');
    if (!cleanText(text)) {
      setStatus('No presentation JSON to copy yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setStatus('Presentation JSON copied.');
    } catch (_err) {
      setStatus('Could not copy automatically. Select the output text manually.');
    }
  }

  function downloadDeckJson(deck = lastDeck) {
    if (!deck?.slides?.length) {
      setStatus('No presentation JSON to download yet.');
      return null;
    }

    const blob = new Blob([JSON.stringify(deck, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(deck.deckTitle || deck.title)}.presentation.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Presentation JSON downloaded.');
    return true;
  }

  function convertCurrentOutputToPresentationMaker() {
    const text = cleanText(el('presentationExportOutput')?.textContent || lastRaw || '');
    if (!text) {
      setStatus('No JSON output to convert.');
      return null;
    }
    const parsed = parseDeck(text, {
      style: el('presentationExportStyle')?.value || 'research-talk',
      targetSlideCount: Number(el('presentationExportSlideCount')?.value || 10)
    });
    if (!parsed.ok) {
      setStatus(parsed.error);
      return parsed;
    }
    lastDeck = parsed.deck;
    setOutput(JSON.stringify(lastDeck, null, 2));
    setStatus('Converted current output to Presentation Maker compatible JSON with visible blocks.');
    return parsed;
  }

  function createCard() {
    const panel = el('copilotTab');
    if (!panel || el('presentationExportCard')) return false;

    const card = document.createElement('div');
    card.className = 'presentation-export-card';
    card.id = 'presentationExportCard';
    card.innerHTML = [
      '<h3>Paper → Presentation exporter</h3>',
      '<div class="presentation-export-grid">',
      '  <div class="presentation-export-help">Stage 13B exports Presentation Maker compatible JSON. Slides now use <code>leftBlocks</code>/<code>rightBlocks</code> so content appears when imported, not only titles.</div>',
      '  <div class="presentation-export-two">',
      '    <label>Style',
      '      <select id="presentationExportStyle">',
      '        <option value="research-talk">Research talk</option>',
      '        <option value="lecture">Lecture</option>',
      '        <option value="short-summary">Short summary</option>',
      '        <option value="detailed-walkthrough">Detailed walkthrough</option>',
      '      </select>',
      '    </label>',
      '    <label>Target slide count',
      '      <input id="presentationExportSlideCount" type="number" min="3" max="80" step="1" value="10" />',
      '    </label>',
      '  </div>',
      '  <label>Extra instructions',
      '    <textarea id="presentationExportPrompt" placeholder="Example: make this a 15-minute theory talk and include one slide for intuition before each theorem."></textarea>',
      '  </label>',
      '  <div class="presentation-export-actions">',
      '    <button id="runPresentationExportBtn" class="btn mini primary" type="button">Run exporter</button>',
      '    <button id="convertPresentationExportBtn" class="btn mini" type="button">Convert current JSON</button>',
      '    <button id="savePresentationExportBtn" class="btn mini" type="button">Save JSON</button>',
      '    <button id="runSavePresentationExportBtn" class="btn mini primary" type="button">Run + save</button>',
      '    <button id="copyPresentationExportBtn" class="btn mini" type="button">Copy JSON</button>',
      '    <button id="downloadPresentationExportBtn" class="btn mini" type="button">Download JSON</button>',
      '  </div>',
      '  <div id="presentationExportStatus" class="presentation-export-status">Presentation exporter ready.</div>',
      '  <pre id="presentationExportOutput" class="presentation-export-output"></pre>',
      '</div>'
    ].join('');

    const verifierCard = el('citationVerifierCard');
    const citationCard = el('citationAiCard');
    const docCard = el('documentAiCard');
    const anchor = verifierCard || citationCard || docCard;
    if (anchor?.nextSibling) panel.insertBefore(card, anchor.nextSibling);
    else panel.appendChild(card);

    bindControls();
    return true;
  }

  function bindControls() {
    el('runPresentationExportBtn')?.addEventListener('click', runPresentationExport, true);
    el('convertPresentationExportBtn')?.addEventListener('click', convertCurrentOutputToPresentationMaker, true);
    el('savePresentationExportBtn')?.addEventListener('click', () => saveDeckToProject(lastDeck), true);
    el('runSavePresentationExportBtn')?.addEventListener('click', runAndSavePresentationExport, true);
    el('copyPresentationExportBtn')?.addEventListener('click', copyDeckJson, true);
    el('downloadPresentationExportBtn')?.addEventListener('click', () => downloadDeckJson(lastDeck), true);
  }

  function init() { createCard(); }

  NS.PresentationExportService = {
    STAGE,
    PROMPT_PATH,
    init,
    loadExportPrompt,
    collectPaperContext,
    stripJsonFence,
    bulletsToContent,
    semanticSlideBlocks,
    normalizeBlock,
    normalizePmSlide,
    normalizeDeck,
    parseDeck,
    buildPayload,
    runPresentationExport,
    saveDeckToProject,
    runAndSavePresentationExport,
    convertCurrentOutputToPresentationMaker,
    copyDeckJson,
    downloadDeckJson,
    getLastDeck: () => lastDeck,
    getLastRaw: () => lastRaw,
    getLastSavedPath: () => lastSavedPath
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

/* Latexai Stage 13C PresentationExportService
 * Stage: stage13c-presentation-export-validator-autofix-1
 *
 * Fixes Stage 13A export schema so Presentation Maker imports visible content.
 * Presentation Maker expects slides with leftBlocks/rightBlocks, not only
 * semantic fields like bullets/latex. Stage 13C normalizes every exported slide
 * into the Presentation Maker deck schema:
 *
 * deckTitle, summary, slides[].slideType/title/lede/leftBlocks/rightBlocks/etc.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage13c-presentation-export-validator-autofix-1';
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

  const VALID_SLIDE_TYPES = new Set(['title-center', 'single', 'two-col']);
  const VALID_HEADING_LEVELS = new Set(['h1', 'h2']);
  const VALID_BLOCK_MODES = new Set(['panel', 'plain', 'placeholder', 'pseudocode', 'pseudocode-latex', 'custom']);

  function parseJsonText(text) {
    try {
      return { ok: true, data: JSON.parse(stripJsonFence(text)) };
    } catch (err) {
      return { ok: false, error: `Could not parse JSON: ${err.message}` };
    }
  }

  function slideHasVisibleBlocks(slide) {
    const blocks = [...(slide?.leftBlocks || []), ...(slide?.rightBlocks || [])];
    return blocks.some((b) => cleanText(b?.content || b?.title));
  }

  function hasLegacyStrandedContent(rawSlide) {
    if (!rawSlide || typeof rawSlide !== 'object') return false;
    const hasBlocks = Array.isArray(rawSlide.leftBlocks) || Array.isArray(rawSlide.rightBlocks);
    const hasLegacy = (Array.isArray(rawSlide.bullets) && rawSlide.bullets.length) || cleanText(rawSlide.latex) || cleanText(rawSlide.speakerNotes);
    return hasLegacy && !hasBlocks;
  }

  function validatePresentationDeck(deck, rawData = null) {
    const errors = [];
    const warnings = [];
    const fixes = [];

    if (!deck || typeof deck !== 'object') errors.push('Deck is not an object.');
    if (!cleanText(deck?.deckTitle)) errors.push('Missing deckTitle.');
    if (!Array.isArray(deck?.slides)) errors.push('slides must be an array.');
    if (Array.isArray(deck?.slides) && !deck.slides.length) errors.push('Deck has no slides.');

    const rawSlides = Array.isArray(rawData?.slides) ? rawData.slides : [];

    (deck?.slides || []).forEach((slide, index) => {
      const label = `slide ${index + 1}${slide?.title ? ` (${slide.title})` : ''}`;
      if (!cleanText(slide?.title)) errors.push(`${label}: missing title.`);
      if (!VALID_SLIDE_TYPES.has(slide?.slideType)) errors.push(`${label}: invalid slideType ${slide?.slideType || '(missing)'}.`);
      if (!VALID_HEADING_LEVELS.has(slide?.headingLevel)) warnings.push(`${label}: headingLevel should be h1 or h2.`);
      if (!/^#[0-9a-f]{6}$/i.test(slide?.bgColor || '')) warnings.push(`${label}: bgColor should be a #RRGGBB color.`);
      if (!/^#[0-9a-f]{6}$/i.test(slide?.fontColor || '')) warnings.push(`${label}: fontColor should be a #RRGGBB color.`);

      const blocks = [...(slide?.leftBlocks || []), ...(slide?.rightBlocks || [])];
      if (slide?.slideType !== 'title-center' && !slideHasVisibleBlocks(slide)) {
        errors.push(`${label}: non-title slide has no visible leftBlocks/rightBlocks content.`);
        fixes.push(`${label}: add a visible placeholder/content block.`);
      }

      blocks.forEach((block, bIndex) => {
        const bLabel = `${label} block ${bIndex + 1}`;
        if (!VALID_BLOCK_MODES.has(block?.mode)) {
          warnings.push(`${bLabel}: invalid mode ${block?.mode || '(missing)'}.`);
          fixes.push(`${bLabel}: change mode to plain.`);
        }
        if (!cleanText(block?.content) && !cleanText(block?.title)) {
          warnings.push(`${bLabel}: block has no title or content.`);
        }
      });

      const rawSlide = rawSlides[index];
      if (hasLegacyStrandedContent(rawSlide)) {
        warnings.push(`${label}: raw slide has old semantic bullets/latex without visible blocks.`);
        fixes.push(`${label}: convert bullets to panel block and latex to pseudocode-latex block.`);
      }
    });

    const contentSlides = (deck?.slides || []).filter((slide) => slide.slideType !== 'title-center');
    if (!contentSlides.length && (deck?.slides || []).length > 1) {
      warnings.push('Deck has multiple slides but no non-title content slides.');
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      fixes,
      summary: {
        slideCount: deck?.slides?.length || 0,
        errorCount: errors.length,
        warningCount: warnings.length,
        fixCount: fixes.length
      }
    };
  }

  function formatValidationReport(report) {
    if (!report) return 'No validation report yet.';
    const lines = [
      'Presentation export validation report',
      '=====================================',
      '',
      `Slides: ${report.summary.slideCount}`,
      `Errors: ${report.summary.errorCount}`,
      `Warnings: ${report.summary.warningCount}`,
      `Suggested fixes: ${report.summary.fixCount}`,
      ''
    ];

    if (report.errors.length) {
      lines.push('Errors', '------');
      report.errors.forEach((item) => lines.push(`- ${item}`));
      lines.push('');
    }

    if (report.warnings.length) {
      lines.push('Warnings', '--------');
      report.warnings.forEach((item) => lines.push(`- ${item}`));
      lines.push('');
    }

    if (report.fixes.length) {
      lines.push('Suggested fixes', '---------------');
      report.fixes.forEach((item) => lines.push(`- ${item}`));
      lines.push('');
    }

    if (report.ok) lines.push('Deck passed required Presentation Maker compatibility checks.');
    else lines.push('Deck has required compatibility errors. Click Auto-fix deck or fix manually.');

    return lines.join('\n');
  }

  function autoFixBlock(block, fallbackTitle = 'Content') {
    const fixed = normalizeBlock(block, fallbackTitle);
    if (!VALID_BLOCK_MODES.has(fixed.mode)) fixed.mode = 'plain';
    if (!cleanText(fixed.title)) fixed.title = fallbackTitle;
    if (!cleanText(fixed.content)) fixed.content = fixed.title;
    return fixed;
  }

  function autoFixDeck(input, options = {}) {
    const deck = normalizeDeck(input || {}, options);
    if (!cleanText(deck.deckTitle)) deck.deckTitle = 'Latexai Presentation';
    if (!cleanText(deck.summary)) deck.summary = `Presentation exported from ${rootPath()}`;

    deck.slides = (deck.slides || []).map((slide, index) => {
      const fixed = normalizePmSlide(slide, index);
      if (!VALID_SLIDE_TYPES.has(fixed.slideType)) fixed.slideType = index === 0 ? 'title-center' : 'single';
      if (!VALID_HEADING_LEVELS.has(fixed.headingLevel)) fixed.headingLevel = fixed.slideType === 'title-center' ? 'h1' : 'h2';
      fixed.bgColor = clampColor(fixed.bgColor, '#ffffff');
      fixed.fontColor = clampColor(fixed.fontColor, '#000000');
      fixed.leftBlocks = (fixed.leftBlocks || []).map((b) => autoFixBlock(b, 'Content'));
      fixed.rightBlocks = (fixed.rightBlocks || []).map((b) => autoFixBlock(b, 'Details'));

      if (fixed.slideType !== 'title-center' && !slideHasVisibleBlocks(fixed)) {
        fixed.leftBlocks = [{
          mode: 'placeholder',
          title: 'Content needed',
          content: fixed.lede || fixed.title || `Slide ${index + 1}`
        }];
      }

      if (fixed.slideType === 'title-center') {
        fixed.leftBlocks = [];
        fixed.rightBlocks = [];
      }

      return fixed;
    });

    deck.slides = ensureTitleSlide(deck.deckTitle, deck.summary, deck.slides);
    deck.schema = 'presentation-maker-deck-v1';
    deck.exportSchema = 'latexai-presentation-maker-json-v1';
    deck.stage = STAGE;
    deck.metadata = deck.metadata || {};
    deck.metadata.validatedAt = new Date().toISOString();
    return deck;
  }

  function parseCurrentOutputData() {
    const text = cleanText(el('presentationExportOutput')?.textContent || (lastDeck ? JSON.stringify(lastDeck) : lastRaw || ''));
    if (!text) return { ok: false, error: 'No presentation JSON output to validate.' };
    return parseJsonText(text);
  }

  function validateCurrentDeck() {
    const parsed = parseCurrentOutputData();
    if (!parsed.ok) {
      setOutput(parsed.error);
      setStatus(parsed.error);
      return { ok: false, error: parsed.error };
    }

    const deck = normalizeDeck(parsed.data, {
      style: el('presentationExportStyle')?.value || 'research-talk',
      targetSlideCount: Number(el('presentationExportSlideCount')?.value || 10)
    });
    const report = validatePresentationDeck(deck, parsed.data);
    setOutput(formatValidationReport(report));
    setStatus(report.ok
      ? 'Presentation deck passed required validation.'
      : `Presentation deck has ${report.errors.length} error(s) and ${report.warnings.length} warning(s).`);
    return { ok: report.ok, deck, report };
  }

  function autoFixCurrentDeck() {
    const parsed = parseCurrentOutputData();
    if (!parsed.ok) {
      setOutput(parsed.error);
      setStatus(parsed.error);
      return { ok: false, error: parsed.error };
    }

    const deck = autoFixDeck(parsed.data, {
      style: el('presentationExportStyle')?.value || 'research-talk',
      targetSlideCount: Number(el('presentationExportSlideCount')?.value || 10)
    });
    const report = validatePresentationDeck(deck, deck);
    lastDeck = deck;
    setOutput(JSON.stringify(deck, null, 2));
    setStatus(report.ok
      ? 'Auto-fixed deck and passed required validation.'
      : `Auto-fixed deck, but ${report.errors.length} validation error(s) remain.`);
    return { ok: report.ok, deck, report };
  }

  function validateAndSaveDeck() {
    let deck = lastDeck;
    if (!deck) {
      const parsed = parseCurrentOutputData();
      if (!parsed.ok) {
        setStatus(parsed.error);
        setOutput(parsed.error);
        return { ok: false, error: parsed.error };
      }
      deck = autoFixDeck(parsed.data, {
        style: el('presentationExportStyle')?.value || 'research-talk',
        targetSlideCount: Number(el('presentationExportSlideCount')?.value || 10)
      });
    }

    deck = autoFixDeck(deck, {
      style: el('presentationExportStyle')?.value || 'research-talk',
      targetSlideCount: Number(el('presentationExportSlideCount')?.value || 10)
    });
    const report = validatePresentationDeck(deck, deck);
    if (!report.ok) {
      lastDeck = deck;
      setOutput(formatValidationReport(report));
      setStatus('Deck still has validation errors; not saved.');
      return { ok: false, deck, report };
    }

    lastDeck = deck;
    setOutput(JSON.stringify(deck, null, 2));
    return saveDeckToProject(deck);
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

    deck = autoFixDeck(deck, {
      style: el('presentationExportStyle')?.value || deck?.metadata?.style || 'research-talk',
      targetSlideCount: Number(el('presentationExportSlideCount')?.value || deck?.metadata?.targetSlideCount || deck?.slides?.length || 10)
    });
    const validation = validatePresentationDeck(deck, deck);
    if (!validation.ok) {
      lastDeck = deck;
      setOutput(formatValidationReport(validation));
      setStatus('Deck has validation errors; not saved. Click Auto-fix deck or inspect report.');
      return { ok: false, deck, report: validation };
    }
    lastDeck = deck;

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
      '  <div class="presentation-export-help">Stage 13C exports Presentation Maker compatible JSON. Slides now use <code>leftBlocks</code>/<code>rightBlocks</code> so content appears when imported, not only titles.</div>',
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
      '    <button id="validatePresentationExportBtn" class="btn mini" type="button">Validate deck</button>',
      '    <button id="autoFixPresentationExportBtn" class="btn mini" type="button">Auto-fix deck</button>',
      '    <button id="validateSavePresentationExportBtn" class="btn mini primary" type="button">Validate + save</button>',
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
    el('validatePresentationExportBtn')?.addEventListener('click', validateCurrentDeck, true);
    el('autoFixPresentationExportBtn')?.addEventListener('click', autoFixCurrentDeck, true);
    el('validateSavePresentationExportBtn')?.addEventListener('click', validateAndSaveDeck, true);
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
    validatePresentationDeck,
    formatValidationReport,
    autoFixDeck,
    validateCurrentDeck,
    autoFixCurrentDeck,
    validateAndSaveDeck,
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

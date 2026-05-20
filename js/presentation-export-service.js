/* Latexai Stage 13F PresentationExportService
 * Stage: stage13f-ai-figure-assets-for-talk-export-1
 *
 * Fixes Stage 13A export schema so Presentation Maker imports visible content.
 * Presentation Maker expects slides with leftBlocks/rightBlocks, not only
 * semantic fields like bullets/latex. Stage 13F normalizes every exported slide
 * into the Presentation Maker deck schema:
 *
 * deckTitle, summary, slides[].slideType/title/lede/leftBlocks/rightBlocks/etc.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage13f-ai-figure-assets-for-talk-export-1';
  const PROMPT_PATH = 'prompt/ai-paper-to-presentation-export.txt';
  const FIGURE_PROMPT_PATH = 'prompt/ai-presentation-figure-asset.txt';

  let promptCache = '';
  let figurePromptCache = '';
  let lastRaw = '';
  let lastDeck = null;
  let lastSavedPath = '';
  let lastHandoff = null;

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

  function defaultPresentationMakerUrl() {
    try {
      return localStorage.getItem('latexai:presentationMakerUrl') || 'presentation-maker.html';
    } catch (_err) {
      return 'presentation-maker.html';
    }
  }

  function presentationMakerUrl() {
    return cleanText(el('presentationMakerUrl')?.value || defaultPresentationMakerUrl() || 'presentation-maker.html');
  }

  function persistPresentationMakerUrl() {
    const url = presentationMakerUrl();
    try { localStorage.setItem('latexai:presentationMakerUrl', url); } catch (_err) {}
    return url;
  }

  function handoffKey() {
    return `latexai:presentation-maker:handoff:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function buildHandoffPayload(deck) {
    return {
      schema: 'latexai-presentation-handoff-v1',
      stage: STAGE,
      createdAt: new Date().toISOString(),
      source: {
        app: 'Latexai',
        rootPath: rootPath(),
        savedPath: lastSavedPath || ''
      },
      deck
    };
  }

  function handoffUrl(baseUrl, key) {
    const raw = cleanText(baseUrl || 'presentation-maker.html');
    try {
      const url = new URL(raw, window.location.href);
      url.searchParams.set('latexaiImport', 'localStorage');
      url.searchParams.set('handoffKey', key);
      url.searchParams.set('schema', 'latexai-presentation-handoff-v1');
      return url.href;
    } catch (_err) {
      const sep = raw.includes('?') ? '&' : '?';
      return `${raw}${sep}latexaiImport=localStorage&handoffKey=${encodeURIComponent(key)}&schema=latexai-presentation-handoff-v1`;
    }
  }

  function currentDeckOrParsed() {
    if (lastDeck?.slides?.length) return { ok: true, deck: lastDeck };
    const parsed = parseCurrentOutputData();
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      deck: autoFixDeck(parsed.data, {
        style: el('presentationExportStyle')?.value || 'research-talk',
        targetSlideCount: Number(el('presentationExportSlideCount')?.value || 10)
      })
    };
  }

  function preparePresentationHandoff() {
    const current = currentDeckOrParsed();
    if (!current.ok) {
      setStatus(current.error || 'No valid deck available for handoff.');
      if (current.error) setOutput(current.error);
      return { ok: false, error: current.error || 'missing deck' };
    }

    const deck = autoFixDeck(current.deck, {
      style: el('presentationExportStyle')?.value || current.deck?.metadata?.style || 'research-talk',
      targetSlideCount: Number(el('presentationExportSlideCount')?.value || current.deck?.metadata?.targetSlideCount || current.deck?.slides?.length || 10)
    });
    const report = validatePresentationDeck(deck, deck);
    if (!report.ok) {
      lastDeck = deck;
      setOutput(formatValidationReport(report));
      setStatus('Deck still has validation errors; handoff not prepared.');
      return { ok: false, deck, report };
    }

    lastDeck = deck;
    persistPresentationMakerUrl();

    const key = handoffKey();
    const payload = buildHandoffPayload(deck);
    const payloadText = JSON.stringify(payload);
    const deckText = JSON.stringify(deck, null, 2);
    const url = handoffUrl(presentationMakerUrl(), key);

    try {
      localStorage.setItem(key, payloadText);
      localStorage.setItem('latexai:presentation-maker:latest', key);
      localStorage.setItem('latexai:presentation-maker:importDeck', deckText);
      localStorage.setItem('presentation-maker-import-deck', deckText);
      localStorage.setItem('presentationMakerImportDeck', deckText);
      sessionStorage.setItem(key, payloadText);
    } catch (err) {
      setStatus(`Could not write handoff to browser storage: ${err?.message || err}. Use Copy JSON or Download JSON.`);
      return { ok: false, error: err?.message || String(err), deck, report };
    }

    lastHandoff = { key, url, payload, deck, report };

    setOutput([
      'Presentation Maker handoff prepared',
      '====================================',
      '',
      `Deck: ${deck.deckTitle}`,
      `Slides: ${deck.slides.length}`,
      `Storage key: ${key}`,
      `Open URL: ${url}`,
      '',
      'Stored keys:',
      '- latexai:presentation-maker:latest',
      '- latexai:presentation-maker:importDeck',
      '- presentation-maker-import-deck',
      '- presentationMakerImportDeck',
      '',
      'If the Presentation Maker is on the same origin, it can read the handoff from localStorage.',
      'If not, use Copy JSON or Download JSON and import manually.'
    ].join('\n'));

    setStatus('Presentation handoff prepared. Click Open maker or use Copy/Download JSON as fallback.');
    toast('Presentation handoff prepared.');
    return { ok: true, key, url, deck, payload, report };
  }

  function openPresentationMaker() {
    const handoff = lastHandoff?.url ? lastHandoff : preparePresentationHandoff();
    if (!handoff?.ok && !handoff?.url) return handoff;

    const url = handoff.url || lastHandoff?.url;
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = url;
    } catch (_err) {
      window.location.href = url;
    }
    setStatus('Opened Presentation Maker handoff URL.');
    return handoff;
  }

  async function runAndOpenPresentationMaker() {
    const result = await runPresentationExport();
    if (!result?.ok) return result;
    const handoff = preparePresentationHandoff();
    if (!handoff?.ok) return handoff;
    return openPresentationMaker();
  }

  function selectedFigureMode() {
    if (el('presentationFigureModeAi')?.checked) return 'ai';
    return 'placeholder';
  }

  function figureAssetFormats() {
    const formats = [];
    if (el('presentationFigureAssetSvg')?.checked) formats.push('svg');
    if (el('presentationFigureAssetTikz')?.checked) formats.push('tikz');
    return formats.length ? formats : ['svg', 'tikz'];
  }

  function figurePromptUrl() {
    const stage = encodeURIComponent(W.LUMINA_LATEX_STAGE || STAGE);
    return `${FIGURE_PROMPT_PATH}?v=${stage}`;
  }

  async function loadFigurePrompt() {
    if (figurePromptCache) return figurePromptCache;
    try {
      const response = await fetch(figurePromptUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      figurePromptCache = text.trim() || 'Return JSON with svg and tikz for the requested figure.';
    } catch (_err) {
      figurePromptCache = 'Return JSON only with {"title":"...","svg":"<svg ...>...</svg>","tikz":"\\\\begin{tikzpicture}...\\\\end{tikzpicture}","notes":"..."}';
    }
    return figurePromptCache;
  }

  function stripJsonFenceForFigure(raw) {
    let s = String(raw || '').trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) s = s.slice(first, last + 1);
    return s;
  }

  function safeSvg(svg, fallbackSvg) {
    const s = String(svg || '').trim();
    if (/^<svg[\s\S]*<\/svg>\s*$/i.test(s) && !/<script\b/i.test(s) && !/\bon\w+\s*=/i.test(s) && !/<foreignObject\b/i.test(s)) {
      return s;
    }
    return fallbackSvg;
  }

  function safeTikz(tikz, fallbackTikz) {
    let s = String(tikz || '').trim();
    s = s.replace(/^```(?:tex|latex)?\s*/i, '').replace(/```$/i, '').trim();
    if (/\\begin\{tikzpicture\}[\s\S]*\\end\{tikzpicture\}/.test(s) && !/\\(write18|input|include|openout|read|catcode)\b/.test(s)) {
      return s;
    }
    return fallbackTikz;
  }

  function placeholderTikzForFigure(fig) {
    const title = escapeTex(fig.title || `Figure ${fig.slideIndex + 1}`);
    const text = escapeTex((fig.content || fig.slide?.title || 'Suggested figure').slice(0, 160));
    return [
      '\\begin{tikzpicture}[scale=1]',
      '  \\draw[rounded corners, thick, dashed] (0,0) rectangle (10,5.6);',
      `  \\node[font=\\bfseries, align=center] at (5,4.25) {${title}};`,
      `  \\node[align=center, text width=8.5cm] at (5,2.5) {${text}};`,
      '\\end{tikzpicture}'
    ].join('\n');
  }

  async function generateAiFigureAsset(fig, base, index) {
    const formats = figureAssetFormats();
    const svgName = `${base}-fig-${String(index + 1).padStart(2, '0')}.svg`;
    const tikzName = `${base}-fig-${String(index + 1).padStart(2, '0')}.tikz.tex`;
    const fallbackSvg = svgFigureForBlock(fig, svgName);
    const fallbackTikz = placeholderTikzForFigure(fig);

    if (selectedFigureMode() !== 'ai') {
      return {
        ...fig,
        filename: svgName,
        tikzFilename: tikzName,
        path: normalizePath(`figures/${svgName}`),
        tikzPath: normalizePath(`figures/${tikzName}`),
        relFromTalk: `../figures/${svgName}`,
        tikzRelFromTalk: `../figures/${tikzName}`,
        svg: fallbackSvg,
        tikz: fallbackTikz,
        aiGenerated: false,
        notes: 'Placeholder figure asset.'
      };
    }

    if (!NS.AIProvider?.ask) {
      return {
        ...fig,
        filename: svgName,
        tikzFilename: tikzName,
        path: normalizePath(`figures/${svgName}`),
        tikzPath: normalizePath(`figures/${tikzName}`),
        relFromTalk: `../figures/${svgName}`,
        tikzRelFromTalk: `../figures/${tikzName}`,
        svg: fallbackSvg,
        tikz: fallbackTikz,
        aiGenerated: false,
        notes: 'AIProvider unavailable; used placeholder figure.'
      };
    }

    try {
      const prompt = await loadFigurePrompt();
      const input = [
        prompt,
        '',
        '--- Requested figure asset ---',
        JSON.stringify({
          deckTitle: lastDeck?.deckTitle || '',
          slideTitle: fig.slide?.title || '',
          slideIndex: fig.slideIndex + 1,
          blockTitle: fig.title || '',
          blockContent: fig.content || '',
          desiredFormats: formats,
          svgFilename: svgName,
          tikzFilename: tikzName
        }, null, 2),
        '',
        '--- Output requirements ---',
        'Return JSON only with fields: title, svg, tikz, notes.',
        'SVG must be standalone <svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>.',
        'TikZ must be only a \\begin{tikzpicture}...\\end{tikzpicture} block.'
      ].join('\n');

      const response = await NS.AIProvider.ask({
        instructions: 'Return JSON only. No markdown fences. No prose outside JSON.',
        input,
        temperature: 0.15,
        maxOutputTokens: 6000,
        presentationFigureAsset: {
          promptFile: FIGURE_PROMPT_PATH,
          desiredFormats: formats,
          slideTitle: fig.slide?.title || '',
          blockTitle: fig.title || ''
        }
      }, {
        task: 'latex-presentation-figure-asset',
        context: {
          workflow: 'presentation-figure-asset',
          promptFile: FIGURE_PROMPT_PATH,
          slideTitle: fig.slide?.title || '',
          blockTitle: fig.title || ''
        }
      });

      const raw = NS.AIProvider.extractText(response);
      let data = {};
      try { data = JSON.parse(stripJsonFenceForFigure(raw)); } catch (_err) { data = {}; }

      return {
        ...fig,
        filename: svgName,
        tikzFilename: tikzName,
        path: normalizePath(`figures/${svgName}`),
        tikzPath: normalizePath(`figures/${tikzName}`),
        relFromTalk: `../figures/${svgName}`,
        tikzRelFromTalk: `../figures/${tikzName}`,
        svg: safeSvg(data.svg, fallbackSvg),
        tikz: safeTikz(data.tikz, fallbackTikz),
        aiGenerated: Boolean(data.svg || data.tikz),
        notes: cleanText(data.notes || (data.svg || data.tikz ? 'AI-generated figure asset.' : 'AI returned no usable asset; used placeholder.')),
        rawAi: raw
      };
    } catch (err) {
      return {
        ...fig,
        filename: svgName,
        tikzFilename: tikzName,
        path: normalizePath(`figures/${svgName}`),
        tikzPath: normalizePath(`figures/${tikzName}`),
        relFromTalk: `../figures/${svgName}`,
        tikzRelFromTalk: `../figures/${tikzName}`,
        svg: fallbackSvg,
        tikz: fallbackTikz,
        aiGenerated: false,
        notes: `AI figure generation failed: ${err?.message || err}`
      };
    }
  }

  async function generateFigureAssetsForDeck(deck = lastDeck) {
    if (!deck?.slides?.length) return { ok: false, error: 'No deck available. Run exporter first.', figureAssets: [] };
    const base = slug(deck.deckTitle || 'talk');
    const figs = figureBlocks(deck);
    const figureAssets = [];
    for (let i = 0; i < figs.length; i += 1) {
      setStatus(`Generating figure asset ${i + 1} of ${figs.length}...`);
      // Sequential calls avoid overloading the AI backend and keep status meaningful.
      const asset = await generateAiFigureAsset(figs[i], base, i);
      figureAssets.push(asset);
    }
    setStatus(`Prepared ${figureAssets.length} figure asset(s).`);
    return { ok: true, figureAssets };
  }

  function selectedExportFormats() {
    const formats = [];
    if (el('presentationExportFormatJson')?.checked) formats.push('json');
    if (el('presentationExportFormatHtml')?.checked) formats.push('html');
    if (el('presentationExportFormatBeamer')?.checked) formats.push('beamer');
    return formats.length ? formats : ['json'];
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function escapeTex(value) {
    return String(value || '')
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([#$%&_{}])/g, '\\$1')
      .replace(/\^/g, '\\textasciicircum{}')
      .replace(/~/g, '\\textasciitilde{}');
  }

  function stripLatexItemize(value) {
    return String(value || '')
      .replace(/\\begin\{itemize\}/g, '')
      .replace(/\\end\{itemize\}/g, '')
      .split(/\n+/)
      .map((line) => line.replace(/^\s*\\item\s*/, '').trim())
      .filter(Boolean);
  }

  function isLatexish(content) {
    const s = String(content || '');
    return /\\\[|\\\]|\\\(|\\\)|\\begin\{|\\end\{|\\frac|\\sum|\\int|\\mathbb|\\mathbf|EQ:/.test(s);
  }

  function cleanEqPrefix(content) {
    return String(content || '').replace(/^\s*EQ:\s*/i, '').trim();
  }

  function slideBlocks(slide) {
    return [...(slide?.leftBlocks || []), ...(slide?.rightBlocks || [])];
  }

  function figureBlocks(deck) {
    const figs = [];
    (deck?.slides || []).forEach((slide, slideIndex) => {
      slideBlocks(slide).forEach((block, blockIndex) => {
        const mode = cleanText(block?.mode).toLowerCase();
        const title = cleanText(block?.title);
        const content = cleanText(block?.content);
        if (mode === 'placeholder' || /figure|diagram|plot|image/i.test(`${title} ${content}`)) {
          figs.push({ slide, slideIndex, block, blockIndex, title, content });
        }
      });
    });
    return figs;
  }

  function svgFigureForBlock(fig, filename) {
    const title = fig.title || `Figure ${fig.slideIndex + 1}`;
    const content = fig.content || fig.slide?.title || 'Suggested figure';
    const lines = [title, ...content.split(/\s+/).reduce((acc, word) => {
      const last = acc[acc.length - 1] || '';
      if ((last + ' ' + word).trim().length > 54) acc.push(word);
      else acc[acc.length - 1] = (last + ' ' + word).trim();
      return acc;
    }, ['']).filter(Boolean).slice(0, 5)];
    const text = lines.map((line, i) => `<text x="400" y="${155 + i * 38}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${i === 0 ? 28 : 20}" fill="#0f172a">${escapeHtml(line)}</text>`).join('\n  ');
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">',
      '  <rect width="800" height="450" fill="#f8fafc"/>',
      '  <rect x="45" y="45" width="710" height="360" rx="24" fill="#ffffff" stroke="#94a3b8" stroke-width="4" stroke-dasharray="14 12"/>',
      `  <text x="400" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#64748b">${escapeHtml(filename)}</text>`,
      `  ${text}`,
      '</svg>'
    ].join('\n');
  }

  async function buildTalkPackage(deck = lastDeck) {
    if (!deck?.slides?.length) return { ok: false, error: 'No deck available. Run exporter first.' };

    const fixedDeck = autoFixDeck(deck, {
      style: el('presentationExportStyle')?.value || deck?.metadata?.style || 'research-talk',
      targetSlideCount: Number(el('presentationExportSlideCount')?.value || deck?.metadata?.targetSlideCount || deck?.slides?.length || 10)
    });
    const validation = validatePresentationDeck(fixedDeck, fixedDeck);
    if (!validation.ok) return { ok: false, error: 'Deck has validation errors.', deck: fixedDeck, report: validation };

    const base = slug(fixedDeck.deckTitle || 'talk');
    const generated = await generateFigureAssetsForDeck(fixedDeck);
    const figureAssets = generated.figureAssets || [];

    const json = JSON.stringify(fixedDeck, null, 2) + '\n';
    const html = renderDeckHtml(fixedDeck, figureAssets);
    const beamer = renderDeckBeamer(fixedDeck, figureAssets);

    return {
      ok: true,
      base,
      deck: fixedDeck,
      validation,
      figureAssets,
      files: {
        json: { path: normalizePath(`talk/${base}.presentation.json`), content: json, mime: 'application/json' },
        html: { path: normalizePath(`talk/${base}.html`), content: html, mime: 'text/html' },
        beamer: { path: normalizePath(`talk/${base}.beamer.tex`), content: beamer, mime: 'application/x-tex' }
      }
    };
  }

  function findFigureAsset(figureAssets, slideIndex, blockIndex) {
    return (figureAssets || []).find((a) => a.slideIndex === slideIndex && a.blockIndex === blockIndex);
  }

  function renderBlockHtml(block, slideIndex, blockIndex, figureAssets) {
    const asset = findFigureAsset(figureAssets, slideIndex, blockIndex);
    const title = cleanText(block?.title);
    const content = cleanText(block?.content);
    const mode = cleanText(block?.mode || 'plain');

    if (asset) {
      return `<section class="block figure-block"><h3>${escapeHtml(title || 'Figure')}</h3><img src="${escapeHtml(asset.relFromTalk)}" alt="${escapeHtml(title || 'figure')}" /><p>${escapeHtml(content)}</p></section>`;
    }

    if (mode === 'pseudocode-latex' || isLatexish(content)) {
      return `<section class="block math-block"><h3>${escapeHtml(title || 'Math')}</h3><pre>${escapeHtml(cleanEqPrefix(content))}</pre></section>`;
    }

    const items = stripLatexItemize(content);
    if (items.length > 1 || /\\item/.test(content)) {
      return `<section class="block"><h3>${escapeHtml(title || 'Key points')}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`;
    }

    return `<section class="block"><h3>${escapeHtml(title || 'Content')}</h3><p>${escapeHtml(content)}</p></section>`;
  }

  function renderDeckHtml(deck, figureAssets = []) {
    const slides = (deck.slides || []).map((slide, slideIndex) => {
      const blocks = slideBlocks(slide).map((block, blockIndex) => renderBlockHtml(block, slideIndex, blockIndex, figureAssets)).join('\n');
      const title = escapeHtml(slide.title || `Slide ${slideIndex + 1}`);
      const lede = slide.lede ? `<p class="lede">${escapeHtml(slide.lede)}</p>` : '';
      const notes = slide.notesBody ? `<aside class="notes"><strong>${escapeHtml(slide.notesTitle || 'Notes')}</strong><p>${escapeHtml(slide.notesBody)}</p></aside>` : '';
      return `<article class="slide ${escapeHtml(slide.slideType || 'single')}">\n<h2>${title}</h2>\n${lede}\n<div class="blocks">${blocks}</div>\n${notes}\n</article>`;
    }).join('\n');

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(deck.deckTitle || 'Presentation')}</title>
<style>
body{margin:0;background:#e2e8f0;color:#0f172a;font-family:Arial,Helvetica,sans-serif}
.deck{max-width:1100px;margin:0 auto;padding:32px}
.slide{background:#fff;min-height:620px;margin:0 0 32px;padding:48px;border-radius:24px;box-shadow:0 18px 50px rgba(15,23,42,.16);page-break-after:always}
.slide h2{font-size:42px;margin:0 0 18px}
.title-center{display:flex;flex-direction:column;justify-content:center;text-align:center}
.title-center h2{font-size:56px}
.lede{font-size:24px;color:#475569}
.blocks{display:grid;gap:18px}
.two-col .blocks{grid-template-columns:1fr 1fr}
.block{border:1px solid #cbd5e1;border-radius:18px;padding:18px;background:#f8fafc}
.block h3{margin:0 0 10px;font-size:22px}
.block p,.block li{font-size:21px;line-height:1.38}
.math-block pre{white-space:pre-wrap;font-size:19px;line-height:1.35;background:#0f172a;color:#e5e7eb;padding:16px;border-radius:12px}
.figure-block img{max-width:100%;border-radius:14px;border:1px solid #cbd5e1;background:white}
.notes{margin-top:18px;color:#64748b;font-size:14px}
@media print{body{background:#fff}.deck{padding:0}.slide{box-shadow:none;border-radius:0;margin:0;min-height:90vh}}
</style>
</head>
<body>
<main class="deck">
${slides}
</main>
</body>
</html>
`;
  }

  function renderBlockBeamer(block, slideIndex, blockIndex, figureAssets) {
    const asset = findFigureAsset(figureAssets, slideIndex, blockIndex);
    const title = cleanText(block?.title || 'Content');
    const content = cleanText(block?.content || '');
    const mode = cleanText(block?.mode || 'plain');

    if (asset) {
      const useTikz = figureAssetFormats().includes('tikz') && asset.tikzRelFromTalk;
      return [
        `\\begin{block}{${escapeTex(title || 'Figure')}}`,
        useTikz
          ? `\\centering\\resizebox{.82\\linewidth}{!}{\\input{${escapeTex(asset.tikzRelFromTalk)}}}`
          : `\\centering\\includegraphics[width=.82\\linewidth]{${escapeTex(asset.relFromTalk)}}`,
        '',
        escapeTex(content),
        '\\end{block}'
      ].join('\n');
    }

    if (mode === 'pseudocode-latex' || isLatexish(content)) {
      return [
        `\\begin{block}{${escapeTex(title || 'Math')}}`,
        cleanEqPrefix(content),
        '\\end{block}'
      ].join('\n');
    }

    const items = stripLatexItemize(content);
    if (items.length > 1 || /\\item/.test(content)) {
      return [
        `\\begin{block}{${escapeTex(title || 'Key points')}}`,
        '\\begin{itemize}',
        ...items.map((item) => `\\item ${escapeTex(item)}`),
        '\\end{itemize}',
        '\\end{block}'
      ].join('\n');
    }

    return [
      `\\begin{block}{${escapeTex(title)}}`,
      escapeTex(content),
      '\\end{block}'
    ].join('\n');
  }

  function renderDeckBeamer(deck, figureAssets = []) {
    const frames = (deck.slides || []).map((slide, slideIndex) => {
      if (slide.slideType === 'title-center') {
        return [
          `\\title{${escapeTex(deck.deckTitle || slide.title || 'Presentation')}}`,
          deck.summary ? `\\subtitle{${escapeTex(deck.summary)}}` : '',
          '\\frame{\\titlepage}'
        ].filter(Boolean).join('\n');
      }

      const blocks = slideBlocks(slide).map((block, blockIndex) => renderBlockBeamer(block, slideIndex, blockIndex, figureAssets)).join('\n\n');
      return [
        `\\begin{frame}{${escapeTex(slide.title || `Slide ${slideIndex + 1}`)}}`,
        slide.lede ? escapeTex(slide.lede) + '\n' : '',
        blocks,
        '\\end{frame}'
      ].join('\n');
    }).join('\n\n');

    return [
      '\\documentclass{beamer}',
      '\\usepackage[utf8]{inputenc}',
      '\\usepackage{amsmath,amssymb}',
      '\\usepackage{graphicx}',
      '\\usepackage{tikz}',
      '\\usetheme{Madrid}',
      `\\title{${escapeTex(deck.deckTitle || 'Presentation')}}`,
      deck.summary ? `\\subtitle{${escapeTex(deck.summary)}}` : '',
      '\\begin{document}',
      frames,
      '\\end{document}',
      ''
    ].filter((line) => line !== '').join('\n');
  }

  function writeProjectFile(path, content) {
    const normalized = normalizePath(path);
    const existing = State()?.getFile?.(normalized);
    if (existing) State()?.updateFile?.(normalized, content);
    else State()?.createFile?.(normalized, content);
    return normalized;
  }

  async function addSelectedExportsToGit() {
    const pkg = await buildTalkPackage(lastDeck);
    if (!pkg.ok) {
      setStatus(pkg.error || 'Could not build talk export package.');
      if (pkg.report) setOutput(formatValidationReport(pkg.report));
      return pkg;
    }

    const formats = selectedExportFormats();
    const written = [];
    for (const format of formats) {
      const file = pkg.files[format];
      if (!file) continue;
      written.push(writeProjectFile(file.path, file.content));
    }

    const assetFormats = figureAssetFormats();
    for (const asset of pkg.figureAssets) {
      if (assetFormats.includes('svg')) written.push(writeProjectFile(asset.path, asset.svg));
      if (assetFormats.includes('tikz')) written.push(writeProjectFile(asset.tikzPath, asset.tikz));
    }

    lastDeck = pkg.deck;
    try { State()?.setActivePath?.(written[0] || 'talk'); } catch (_err) {}
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}

    setOutput([
      'Talk export files added to project',
      '==================================',
      '',
      ...written.map((p) => `- ${p}`)
    ].join('\n'));
    setStatus(`Added ${written.length} talk export file(s) to project.`);
    toast('Talk export files added.');
    return { ok: true, written, package: pkg };
  }

  function downloadBlob(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.split('/').pop();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadSelectedExports() {
    const pkg = await buildTalkPackage(lastDeck);
    if (!pkg.ok) {
      setStatus(pkg.error || 'Could not build talk export package.');
      if (pkg.report) setOutput(formatValidationReport(pkg.report));
      return pkg;
    }

    const formats = selectedExportFormats();
    let count = 0;
    for (const format of formats) {
      const file = pkg.files[format];
      if (!file) continue;
      downloadBlob(file.path, file.content, file.mime);
      count += 1;
    }
    const assetFormats = figureAssetFormats();
    for (const asset of pkg.figureAssets) {
      if (assetFormats.includes('svg')) {
        downloadBlob(asset.path, asset.svg, 'image/svg+xml');
        count += 1;
      }
      if (assetFormats.includes('tikz')) {
        downloadBlob(asset.tikzPath, asset.tikz, 'application/x-tex');
        count += 1;
      }
    }

    setStatus(`Downloaded ${count} selected export/figure file(s).`);
    return { ok: true, downloaded: count, package: pkg };
  }

  async function generateAndAddFigureAssets() {
    const current = currentDeckOrParsed();
    if (!current.ok) {
      setStatus(current.error || 'No valid deck available for figure generation.');
      return current;
    }
    const deck = autoFixDeck(current.deck, {
      style: el('presentationExportStyle')?.value || current.deck?.metadata?.style || 'research-talk',
      targetSlideCount: Number(el('presentationExportSlideCount')?.value || current.deck?.metadata?.targetSlideCount || current.deck?.slides?.length || 10)
    });
    lastDeck = deck;
    const generated = await generateFigureAssetsForDeck(deck);
    const formats = figureAssetFormats();
    const written = [];
    for (const asset of generated.figureAssets || []) {
      if (formats.includes('svg')) written.push(writeProjectFile(asset.path, asset.svg));
      if (formats.includes('tikz')) written.push(writeProjectFile(asset.tikzPath, asset.tikz));
    }
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    setOutput([
      'Figure assets generated',
      '=======================',
      '',
      ...written.map((p) => `- ${p}`)
    ].join('\n'));
    setStatus(`Generated ${written.length} figure asset file(s) under /figures.`);
    return { ok: true, written, figureAssets: generated.figureAssets || [] };
  }

  async function runAndAddSelectedExportsToGit() {
    const result = await runPresentationExport();
    if (!result?.ok) return result;
    return addSelectedExportsToGit();
  }

  async function runAndDownloadSelectedExports() {
    const result = await runPresentationExport();
    if (!result?.ok) return result;
    return downloadSelectedExports();
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
      '  <div class="presentation-export-help">Stage 13F exports Presentation Maker compatible JSON. Slides now use <code>leftBlocks</code>/<code>rightBlocks</code> so content appears when imported, not only titles.</div>',
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
      '  <label>Presentation Maker URL',
      `    <input id="presentationMakerUrl" type="text" value="${defaultPresentationMakerUrl()}" placeholder="presentation-maker.html or full URL" />`,
      '  </label>',
      '  <div class="presentation-export-format-panel">',
      '    <div class="presentation-export-help"><strong>Export formats</strong></div>',
      '    <label class="presentation-export-check"><input id="presentationExportFormatJson" type="checkbox" checked /> JSON</label>',
      '    <label class="presentation-export-check"><input id="presentationExportFormatHtml" type="checkbox" /> HTML</label>',
      '    <label class="presentation-export-check"><input id="presentationExportFormatBeamer" type="checkbox" /> Beamer TeX</label>',
      '  </div>',
      '  <div class="presentation-export-format-panel">',
      '    <div class="presentation-export-help"><strong>Figure assets</strong></div>',
      '    <label class="presentation-export-check"><input id="presentationFigureModePlaceholder" name="presentationFigureMode" type="radio" checked /> Placeholder</label>',
      '    <label class="presentation-export-check"><input id="presentationFigureModeAi" name="presentationFigureMode" type="radio" /> AI SVG/TikZ</label>',
      '    <label class="presentation-export-check"><input id="presentationFigureAssetSvg" type="checkbox" checked /> Save SVG</label>',
      '    <label class="presentation-export-check"><input id="presentationFigureAssetTikz" type="checkbox" checked /> Save TikZ</label>',
      '  </div>',
      '  <div class="presentation-export-actions">',
      '    <button id="runPresentationExportBtn" class="btn mini primary" type="button">Run exporter</button>',
      '    <button id="convertPresentationExportBtn" class="btn mini" type="button">Convert current JSON</button>',
      '    <button id="validatePresentationExportBtn" class="btn mini" type="button">Validate deck</button>',
      '    <button id="autoFixPresentationExportBtn" class="btn mini" type="button">Auto-fix deck</button>',
      '    <button id="validateSavePresentationExportBtn" class="btn mini primary" type="button">Validate + save</button>',
      '    <button id="savePresentationExportBtn" class="btn mini" type="button">Save JSON</button>',
      '    <button id="runSavePresentationExportBtn" class="btn mini primary" type="button">Run + save</button>',
      '    <button id="preparePresentationHandoffBtn" class="btn mini" type="button">Prepare handoff</button>',
      '    <button id="openPresentationMakerBtn" class="btn mini primary" type="button">Open maker</button>',
      '    <button id="runOpenPresentationMakerBtn" class="btn mini primary" type="button">Run + open maker</button>',
      '    <button id="generatePresentationFiguresBtn" class="btn mini" type="button">Generate figures</button>',
      '    <button id="addTalkExportsBtn" class="btn mini primary" type="button">Add selected to /talk</button>',
      '    <button id="downloadTalkExportsBtn" class="btn mini" type="button">Download selected</button>',
      '    <button id="runAddTalkExportsBtn" class="btn mini primary" type="button">Run + add to /talk</button>',
      '    <button id="runDownloadTalkExportsBtn" class="btn mini" type="button">Run + download selected</button>',
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
    el('preparePresentationHandoffBtn')?.addEventListener('click', preparePresentationHandoff, true);
    el('openPresentationMakerBtn')?.addEventListener('click', openPresentationMaker, true);
    el('runOpenPresentationMakerBtn')?.addEventListener('click', runAndOpenPresentationMaker, true);
    el('presentationMakerUrl')?.addEventListener('change', persistPresentationMakerUrl, true);
    el('generatePresentationFiguresBtn')?.addEventListener('click', generateAndAddFigureAssets, true);
    el('addTalkExportsBtn')?.addEventListener('click', addSelectedExportsToGit, true);
    el('downloadTalkExportsBtn')?.addEventListener('click', downloadSelectedExports, true);
    el('runAddTalkExportsBtn')?.addEventListener('click', runAndAddSelectedExportsToGit, true);
    el('runDownloadTalkExportsBtn')?.addEventListener('click', runAndDownloadSelectedExports, true);
    el('copyPresentationExportBtn')?.addEventListener('click', copyDeckJson, true);
    el('downloadPresentationExportBtn')?.addEventListener('click', () => downloadDeckJson(lastDeck), true);
  }

  function init() { createCard(); }

  NS.PresentationExportService = {
    STAGE,
    PROMPT_PATH,
    FIGURE_PROMPT_PATH,
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
    defaultPresentationMakerUrl,
    presentationMakerUrl,
    preparePresentationHandoff,
    openPresentationMaker,
    runAndOpenPresentationMaker,
    handoffUrl,
    buildHandoffPayload,
    selectedExportFormats,
    selectedFigureMode,
    figureAssetFormats,
    loadFigurePrompt,
    generateAiFigureAsset,
    generateFigureAssetsForDeck,
    generateAndAddFigureAssets,
    buildTalkPackage,
    renderDeckHtml,
    renderDeckBeamer,
    addSelectedExportsToGit,
    downloadSelectedExports,
    runAndAddSelectedExportsToGit,
    runAndDownloadSelectedExports,
    buildPayload,
    runPresentationExport,
    saveDeckToProject,
    runAndSavePresentationExport,
    convertCurrentOutputToPresentationMaker,
    copyDeckJson,
    downloadDeckJson,
    getLastDeck: () => lastDeck,
    getLastRaw: () => lastRaw,
    getLastSavedPath: () => lastSavedPath,
    getLastHandoff: () => lastHandoff
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

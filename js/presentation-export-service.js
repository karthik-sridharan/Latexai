/* Latexai Stage 13A PresentationExportService
 * Stage: stage13a-paper-to-presentation-exporter-1
 *
 * First bridge from Latexai paper editor to Presentation Maker:
 * - collects current paper context
 * - asks AI for a clean JSON slide deck
 * - validates/normalizes JSON
 * - saves deck JSON under exports/
 * - copy/download helpers for moving to Presentation Maker
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage13a-paper-to-presentation-exporter-1';
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
      promptCache = text.trim() || 'Return JSON slide deck.';
    } catch (_err) {
      promptCache = 'Return JSON only with {title, subtitle, slides:[{title, kind, bullets, speakerNotes, latex, figurePrompt, source}], metadata}.';
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

  function normalizeSlide(slide, index) {
    const bullets = Array.isArray(slide?.bullets)
      ? slide.bullets.map((b) => String(b || '').trim()).filter(Boolean).slice(0, 8)
      : [];

    return {
      title: String(slide?.title || `Slide ${index + 1}`).trim(),
      kind: String(slide?.kind || 'content').trim(),
      bullets,
      speakerNotes: String(slide?.speakerNotes || '').trim(),
      latex: String(slide?.latex || '').trim(),
      figurePrompt: String(slide?.figurePrompt || '').trim(),
      source: String(slide?.source || '').trim()
    };
  }

  function normalizeDeck(data, options = {}) {
    const slides = Array.isArray(data?.slides) ? data.slides.map(normalizeSlide) : [];
    return {
      schema: 'latexai-presentation-json-v1',
      stage: STAGE,
      title: String(data?.title || project().name || 'Latexai Presentation').trim(),
      subtitle: String(data?.subtitle || '').trim(),
      slides,
      metadata: {
        style: String(data?.metadata?.style || options.style || 'research-talk'),
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
    if (!deck.slides.length) {
      return { ok: false, error: 'AI returned JSON but no slides.', deck };
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
        instructions: 'Return JSON only. No markdown fences. No prose outside JSON.',
        input,
        temperature: 0.15,
        maxOutputTokens: 9000,
        presentationExport: {
          style,
          targetSlideCount,
          rootPath: rootPath(),
          promptFile: PROMPT_PATH
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
    const instructions = String(el('presentationExportPrompt')?.value || '').trim();

    setStatus(`Exporting paper to presentation JSON (${targetSlideCount} slides, ${style})...`);

    try {
      const payload = await buildPayload(style, targetSlideCount, instructions);
      const response = await NS.AIProvider.ask(payload, {
        task: 'latex-paper-to-presentation-export',
        context: {
          workflow: 'paper-to-presentation-export',
          rootPath: rootPath(),
          style,
          targetSlideCount,
          promptFile: PROMPT_PATH
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
      setStatus(`Generated presentation JSON with ${lastDeck.slides.length} slide(s).`);
      return { ok: true, deck: lastDeck };
    } catch (err) {
      setStatus(`Presentation export failed: ${err?.message || err}`);
      return null;
    }
  }

  function slug(value) {
    return String(value || 'presentation')
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
    const path = normalizePath(`exports/${slug(deck.title)}-${stamp}.presentation.json`);
    const text = JSON.stringify(deck, null, 2) + '\n';

    const existing = State()?.getFile?.(path);
    if (existing) State()?.updateFile?.(path, text);
    else State()?.createFile?.(path, text);

    lastSavedPath = path;

    try { State()?.setActivePath?.(path); } catch (_err) {}
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}

    setStatus(`Saved presentation JSON to ${path}.`);
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
    if (!String(text).trim()) {
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
    a.download = `${slug(deck.title)}.presentation.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Presentation JSON downloaded.');
    return true;
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
      '  <div class="presentation-export-help">Stage 13A exports the current LaTeX paper into Presentation Maker JSON. It saves a <code>.presentation.json</code> file under <code>exports/</code>, which can be copied/downloaded/imported into the presentation maker.</div>',
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
    normalizeDeck,
    parseDeck,
    buildPayload,
    runPresentationExport,
    saveDeckToProject,
    runAndSavePresentationExport,
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

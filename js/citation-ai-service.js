/* Latexai Stage 12C CitationAIService
 * Stage: stage12c-missing-bibtex-repair-1
 *
 * Adds AI citation filler for \citeai{...}. This first stage is intentionally
 * review/apply based:
 * - scan paper for \citeai placeholders
 * - ask AI for JSON citation suggestions
 * - apply exact placeholder replacements
 * - append BibTeX entries to a .bib file
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage12c-missing-bibtex-repair-1';
  const PROMPT_PATH = 'prompt/ai-citation-filler.txt';

  const FALLBACK_PROMPT = [
    'You are Latexai Citation Filler.',
    'Return JSON only for LaTeX \\citeai{...} placeholders.',
    'For each placeholder, provide replacement, citationKey, bibtex, confidence, and note.'
  ].join('\n');

  let promptCache = '';
  let lastRaw = '';
  let lastPlan = null;
  let lastPlaceholders = [];

  function State() { return NS.State; }
  function el(id) { return document.getElementById(id); }

  function toast(message) {
    try { NS.Main?.toast?.(message); } catch (_err) {}
  }

  function setStatus(message) {
    const node = el('citationAiStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const node = el('citationAiOutput');
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

  function rootFile() {
    return State()?.getFile?.(rootPath());
  }

  function promptUrl() {
    const stage = encodeURIComponent(W.LUMINA_LATEX_STAGE || STAGE);
    return `${PROMPT_PATH}?v=${stage}`;
  }

  async function loadCitationPrompt() {
    if (promptCache) return promptCache;
    try {
      const response = await fetch(promptUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      promptCache = text.trim() || FALLBACK_PROMPT;
    } catch (_err) {
      promptCache = FALLBACK_PROMPT;
    }
    return promptCache;
  }

  function extractBraceCommand(text, command, startAt) {
    const s = String(text || '');
    const needle = `\\${command}`;
    const cmdAt = s.indexOf(needle, startAt);
    if (cmdAt < 0) return null;
    const openAt = s.indexOf('{', cmdAt + needle.length);
    if (openAt < 0) return null;

    let depth = 0;
    for (let i = openAt; i < s.length; i += 1) {
      const ch = s[i];
      const prev = i > 0 ? s[i - 1] : '';
      if (ch === '{' && prev !== '\\') depth += 1;
      else if (ch === '}' && prev !== '\\') {
        depth -= 1;
        if (depth === 0) {
          return {
            start: cmdAt,
            end: i + 1,
            raw: s.slice(cmdAt, i + 1),
            prompt: s.slice(openAt + 1, i)
          };
        }
      }
    }
    return null;
  }

  function findCiteAiInFile(file) {
    const path = normalizePath(file.path);
    const text = fileText(file);
    const found = [];
    let pos = 0;
    while (pos < text.length) {
      const item = extractBraceCommand(text, 'citeai', pos);
      if (!item) break;
      found.push({ path, ...item });
      pos = item.end;
    }
    return found;
  }

  function scanCiteAiPlaceholders() {
    const files = (project().files || [])
      .filter((file) => textFile(file))
      .filter((file) => /\.tex$/i.test(file.path || ''));

    const placeholders = [];
    for (const file of files) placeholders.push(...findCiteAiInFile(file));

    lastPlaceholders = placeholders;
    renderPlaceholderList(placeholders);
    setStatus(placeholders.length
      ? `Found ${placeholders.length} \\citeai{...} placeholder(s).`
      : 'No \\citeai{...} placeholders found.');
    return placeholders;
  }

  function renderPlaceholderList(placeholders = lastPlaceholders) {
    const node = el('citationAiList');
    if (!node) return;
    node.innerHTML = '';
    if (!placeholders.length) {
      const div = document.createElement('div');
      div.className = 'citation-ai-row';
      div.textContent = 'No citation placeholders found yet.';
      node.appendChild(div);
      return;
    }

    placeholders.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'citation-ai-row';
      div.innerHTML = [
        `<strong>${index + 1}. ${escapeHtml(item.path)}</strong>`,
        `<div><code>${escapeHtml(item.raw)}</code></div>`,
        `<div>${escapeHtml(item.prompt.slice(0, 220))}</div>`
      ].join('');
      node.appendChild(div);
    });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function collectCitationContext(maxChars = 80000) {
    const files = (project().files || [])
      .filter((file) => textFile(file))
      .filter((file) => /\.(tex|bib|bbl|md|txt)$/i.test(file.path || ''))
      .filter((file) => !/^prompt\//i.test(normalizePath(file.path || '')))
      .sort((a, b) => {
        const ar = normalizePath(a.path) === rootPath() ? 0 : 1;
        const br = normalizePath(b.path) === rootPath() ? 0 : 1;
        return ar - br || normalizePath(a.path).localeCompare(normalizePath(b.path));
      });

    let used = 0;
    const parts = [];
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
    return parts.join('');
  }

  function buildCitationPayload(placeholders) {
    return loadCitationPrompt().then((basePrompt) => {
      const list = placeholders.map((item, index) => ({
        index,
        path: item.path,
        placeholder: item.raw,
        prompt: item.prompt
      }));

      const input = [
        basePrompt,
        '',
        '--- Citation placeholders to fill ---',
        JSON.stringify(list, null, 2),
        '',
        '--- Paper/project context ---',
        collectCitationContext()
      ].join('\n');

      return {
        instructions: 'Return JSON only. No markdown fences. No prose outside JSON.',
        input,
        temperature: 0.05,
        maxOutputTokens: 7000,
        citationAi: {
          placeholders: list,
          promptFile: PROMPT_PATH,
          rootPath: rootPath()
        }
      };
    });
  }

  function stripJsonFence(raw) {
    let s = String(raw || '').trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) s = s.slice(first, last + 1);
    return s;
  }


  function findMatchingBraceInString(text, openAt) {
    const s = String(text || '');
    let depth = 0;
    for (let i = openAt; i < s.length; i += 1) {
      const ch = s[i];
      const prev = i > 0 ? s[i - 1] : '';
      if (ch === '{' && prev !== '\\') depth += 1;
      else if (ch === '}' && prev !== '\\') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function extractRawBibtexEntries(text) {
    const s = String(text || '');
    const entries = [];
    const entryRe = /@([A-Za-z]+)\s*\{\s*([^,\s]+)\s*,/g;
    let match;
    while ((match = entryRe.exec(s))) {
      const openAt = s.indexOf('{', match.index);
      const closeAt = findMatchingBraceInString(s, openAt);
      if (closeAt < 0) break;
      const raw = s.slice(match.index, closeAt + 1).trim();
      const key = sanitizeCitationKey(match[2] || '');
      if (key && raw) entries.push({ citationKey: key, bibtex: raw, source: 'raw-ai-text' });
      entryRe.lastIndex = closeAt + 1;
    }
    return entries;
  }

  function parseCitationPlan(raw) {
    let data;
    try {
      data = JSON.parse(stripJsonFence(raw));
    } catch (err) {
      return { ok: false, error: `Could not parse citation JSON: ${err.message}`, items: [], summary: '' };
    }

    const items = (Array.isArray(data.items) ? data.items : []).map((item) => ({
      placeholder: String(item.placeholder || ''),
      prompt: String(item.prompt || ''),
      replacement: String(item.replacement || ''),
      citationKey: sanitizeCitationKey(item.citationKey || ''),
      bibtex: String(item.bibtex || ''),
      confidence: String(item.confidence || ''),
      note: String(item.note || '')
    })).filter((item) => item.placeholder && item.replacement && item.citationKey && item.bibtex);

    return {
      ok: true,
      items,
      rawBibEntries: extractRawBibtexEntries(raw),
      summary: String(data.summary || ''),
      raw: data
    };
  }

  function sanitizeCitationKey(key) {
    return String(key || '').trim().replace(/[^A-Za-z0-9:_-]+/g, '');
  }

  function bibEntryKey(bibtex) {
    const m = String(bibtex || '').match(/@\w+\s*\{\s*([^,\s]+)\s*,/);
    return sanitizeCitationKey(m?.[1] || '');
  }

  function ensureBibKeyMatches(item) {
    const key = sanitizeCitationKey(item.citationKey);
    let bib = String(item.bibtex || '').trim();
    const existing = bibEntryKey(bib);
    if (key && existing && key !== existing) {
      bib = bib.replace(/(@\w+\s*\{\s*)[^,\s]+(\s*,)/, `$1${key}$2`);
    }
    return { ...item, citationKey: key || existing, bibtex: bib };
  }

  function bibPath() {
    const files = project().files || [];
    const existing = files.find((file) => /\.bib$/i.test(file.path || ''));
    return normalizePath(existing?.path || 'references.bib');
  }

  function getOrCreateBibFile(path) {
    const normalized = normalizePath(path || bibPath());
    let file = State()?.getFile?.(normalized);
    if (!file) {
      State()?.createFile?.(normalized, '');
      file = State()?.getFile?.(normalized);
    }
    return file;
  }

  function replacementForItem(item) {
    const key = sanitizeCitationKey(item.citationKey) || bibEntryKey(item.bibtex);
    const repl = String(item.replacement || '').trim();
    if (/\\cite\w*\s*\{[^}]+\}/.test(repl)) return repl;
    return `\\cite{${key}}`;
  }

  async function runCitationAi() {
    const placeholders = scanCiteAiPlaceholders();
    if (!placeholders.length) return null;
    if (!NS.AIProvider?.ask) {
      setStatus('AIProvider is not loaded.');
      return null;
    }

    setStatus('Asking AI to fill citation placeholders...');
    try {
      const payload = await buildCitationPayload(placeholders);
      const response = await NS.AIProvider.ask(payload, {
        task: 'latex-citation-filler',
        context: {
          workflow: 'citation-ai-fill',
          rootPath: rootPath(),
          promptFile: PROMPT_PATH,
          placeholderCount: placeholders.length
        }
      });

      lastRaw = NS.AIProvider.extractText(response);
      lastPlan = parseCitationPlan(lastRaw);
      renderCitationPlan(lastPlan);
      setStatus(lastPlan.ok
        ? `Citation AI returned ${lastPlan.items.length} citation suggestion(s). Review, then apply.`
        : `Citation AI failed to return parseable JSON. ${lastPlan.error}`);
      return lastPlan;
    } catch (err) {
      setStatus(`Citation AI failed: ${err?.message || err}`);
      return null;
    }
  }

  function renderCitationPlan(plan = lastPlan) {
    const lines = [
      'Citation AI plan',
      '================',
      '',
      plan?.ok ? `Suggestions: ${plan.items.length}` : (plan?.error || 'No plan yet.'),
      plan?.rawBibEntries?.length ? `Raw BibTeX entries found in AI output: ${plan.rawBibEntries.length}` : '',
      plan?.summary ? `Summary: ${plan.summary}` : ''
    ];

    if (plan?.items?.length) {
      plan.items.forEach((rawItem, index) => {
        const item = ensureBibKeyMatches(rawItem);
        lines.push(
          '',
          `${index + 1}. ${item.placeholder}`,
          `Replacement: ${replacementForItem(item)}`,
          `Key: ${item.citationKey}`,
          `Confidence: ${item.confidence || '(unspecified)'}`,
          `Note: ${item.note || '(none)'}`,
          'BibTeX:',
          item.bibtex
        );
      });
    }

    setOutput(lines.join('\n'));
  }

  function applyCitationPlan(plan = lastPlan) {
    if (!plan?.ok || !Array.isArray(plan.items) || !plan.items.length) {
      setStatus('No citation plan to apply. Run citation AI first.');
      return { ok: false, replaced: 0, bibAdded: 0 };
    }

    const items = plan.items.map(ensureBibKeyMatches);
    let replaced = 0;
    const messages = [];

    // Replace exact placeholders in tex files.
    for (const file of (project().files || [])) {
      if (!textFile(file) || !/\.tex$/i.test(file.path || '')) continue;
      const path = normalizePath(file.path);
      let text = fileText(file);
      let changed = false;

      for (const item of items) {
        const placeholder = item.placeholder;
        if (!placeholder || !text.includes(placeholder)) continue;
        const replacement = replacementForItem(item);
        text = text.split(placeholder).join(replacement);
        changed = true;
        replaced += 1;
        messages.push(`Replaced ${placeholder} with ${replacement} in ${path}`);
      }

      if (changed) State()?.updateFile?.(path, text);
    }

    // Add BibTeX entries if the keys are not already present.
    // Stage 12C: be more robust. In addition to parsed JSON items, also scan
    // the raw AI text for @article/@book/etc blocks. This fixes cases where AI
    // produced usable BibTeX but slightly outside the expected JSON fields.
    const bib = getOrCreateBibFile(bibPath());
    const bpath = normalizePath(bib?.path || bibPath());
    let bibText = fileText(bib);
    let bibAdded = 0;

    const bibCandidates = [];
    for (const item of items) {
      const key = sanitizeCitationKey(item.citationKey) || bibEntryKey(item.bibtex);
      const bibtex = String(item.bibtex || '').trim();
      if (key && bibtex) bibCandidates.push({ citationKey: key, bibtex, source: 'json-item' });
    }
    for (const rawEntry of (plan.rawBibEntries || [])) {
      const key = sanitizeCitationKey(rawEntry.citationKey) || bibEntryKey(rawEntry.bibtex);
      if (key && rawEntry.bibtex) bibCandidates.push({ citationKey: key, bibtex: rawEntry.bibtex, source: 'raw-ai-text' });
    }

    const seenCandidate = new Set();
    for (const item of bibCandidates) {
      const key = sanitizeCitationKey(item.citationKey) || bibEntryKey(item.bibtex);
      const bibtex = String(item.bibtex || '').trim();
      if (!key || !bibtex || seenCandidate.has(key)) continue;
      seenCandidate.add(key);
      const keyRe = new RegExp(`@\\w+\\s*\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,`, 'i');
      if (keyRe.test(bibText)) continue;
      bibText = `${bibText.trimEnd()}\n\n${bibtex}\n`;
      bibAdded += 1;
      messages.push(`Added BibTeX entry ${key} to ${bpath} (${item.source})`);
    }
    State()?.updateFile?.(bpath, bibText);

    try { State()?.setActivePath?.(rootPath()); } catch (_err) {}
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}

    setOutput([
      'Citation apply report',
      '=====================',
      '',
      `Placeholders replaced: ${replaced}`,
      `BibTeX entries added: ${bibAdded}`,
      '',
      ...messages
    ].join('\n'));

    setStatus(`Applied citation plan: replaced ${replaced}, added ${bibAdded} BibTeX entries.`);
    if (replaced || bibAdded) toast('Citation AI plan applied.');
    scanCiteAiPlaceholders();
    return { ok: true, replaced, bibAdded, messages };
  }

  async function runAndApplyCitationAi() {
    const plan = await runCitationAi();
    if (!plan?.ok) return plan;
    return applyCitationPlan(plan);
  }

  async function copyCitationOutput() {
    const text = lastPlan ? JSON.stringify(lastPlan.raw || lastPlan, null, 2) : (lastRaw || el('citationAiOutput')?.textContent || '');
    if (!String(text).trim()) {
      setStatus('No citation AI output to copy yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Citation AI output copied.');
    } catch (_err) {
      setStatus('Could not copy automatically. Select the output text manually.');
    }
  }

  function createCard() {
    const panel = el('copilotTab');
    if (!panel || el('citationAiCard')) return false;

    const card = document.createElement('div');
    card.className = 'citation-ai-card';
    card.id = 'citationAiCard';
    card.innerHTML = [
      '<h3>AI citation filler</h3>',
      '<div class="citation-ai-grid">',
      '  <div class="citation-ai-help">Write placeholders like <code>\\citeai{paper about online learning regret bounds}</code>. Stage 12A asks AI for citation suggestions, replaces exact placeholders with <code>\\cite{...}</code>, and appends BibTeX entries to a .bib file. Verify citations before relying on them.</div>',
      '  <div class="citation-ai-actions">',
      '    <button id="scanCitationAiBtn" class="btn mini" type="button">Scan \\citeai</button>',
      '    <button id="runCitationAiBtn" class="btn mini primary" type="button">Run citation AI</button>',
      '    <button id="applyCitationAiBtn" class="btn mini" type="button">Apply citation plan</button>',
      '    <button id="runApplyCitationAiBtn" class="btn mini primary" type="button">Run + apply</button>',
      '    <button id="copyCitationAiBtn" class="btn mini" type="button">Copy output</button>',
      '  </div>',
      '  <div id="citationAiStatus" class="citation-ai-status">Citation AI ready.</div>',
      '  <div id="citationAiList" class="citation-ai-table"></div>',
      '  <pre id="citationAiOutput" class="citation-ai-output"></pre>',
      '</div>'
    ].join('');

    const docAiCard = el('documentAiCard');
    if (docAiCard?.nextSibling) panel.insertBefore(card, docAiCard.nextSibling);
    else panel.appendChild(card);

    bindControls();
    scanCiteAiPlaceholders();
    return true;
  }

  function bindControls() {
    el('scanCitationAiBtn')?.addEventListener('click', scanCiteAiPlaceholders, true);
    el('runCitationAiBtn')?.addEventListener('click', runCitationAi, true);
    el('applyCitationAiBtn')?.addEventListener('click', () => applyCitationPlan(lastPlan), true);
    el('runApplyCitationAiBtn')?.addEventListener('click', runAndApplyCitationAi, true);
    el('copyCitationAiBtn')?.addEventListener('click', copyCitationOutput, true);
  }

  function init() {
    createCard();
  }

  NS.CitationAIService = {
    STAGE,
    PROMPT_PATH,
    init,
    extractBraceCommand,
    findCiteAiInFile,
    scanCiteAiPlaceholders,
    buildCitationPayload,
    parseCitationPlan,
    extractRawBibtexEntries,
    applyCitationPlan,
    runCitationAi,
    runAndApplyCitationAi,
    copyCitationOutput,
    sanitizeCitationKey,
    bibEntryKey,
    getLastPlan: () => lastPlan,
    getLastRaw: () => lastRaw
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

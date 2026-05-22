/* Latexai Stage 18C CompetitivePaperReviewService
 * Stage: stage18c-competitive-review-web-research-agent-1
 *
 * Competitive paper comparison workflow.
 *
 * Web-research-agent version:
 * - competitor URLs are treated as web-research seeds, not PDFs to download/extract;
 * - the selected AI backend must expose a web_search/open capability;
 * - Latexai caches structured research profiles only, never raw PDF text.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage18c-competitive-review-web-research-agent-1';
  const PROMPT_PATH = 'prompt/ai-competitive-paper-review.txt';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('competitive-paper-review-service')) {
    NS.CompetitivePaperReviewService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  let promptCache = '';
  let lastReport = '';
  let lastPayload = null;
  let lastCompetitorSummaries = [];
  let lastRankingReport = '';
  let lastComparisonReport = '';
  let lastRoadmapReport = '';
  const URL_CACHE_KEY = 'latexai:competitive-web-research-profile-cache:v1';

  function State() { return NS.State; }
  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }

  function normalizePath(path) {
    try { return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
    catch (_err) { return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
  }

  function project() {
    return State()?.state?.project || {};
  }

  function files() {
    return project().files || [];
  }

  function fileText(file) {
    if (!file) return '';
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function getFile(path) {
    const normalized = normalizePath(path);
    try {
      const found = State()?.getFile?.(normalized);
      if (found) return found;
    } catch (_err) {}
    return files().find((file) => normalizePath(file.path) === normalized) || null;
  }

  function rootPath() {
    const p = project();
    return normalizePath(p.rootFile || files().find((file) => /main\.tex$/i.test(file.path || ''))?.path || 'main.tex');
  }

  function activePath() {
    const candidates = [
      State()?.state?.activePath,
      State()?.state?.activeFilePath,
      State()?.state?.currentPath,
      project()?.activePath,
      project()?.activeFilePath,
      rootPath()
    ];
    for (const candidate of candidates) {
      if (candidate && getFile(candidate)) return normalizePath(candidate);
    }
    const pill = clean(el('activeFilePill')?.textContent);
    return normalizePath(pill || rootPath());
  }

  function activeSource() {
    const path = activePath();
    const editorText = String(el('sourceEditor')?.value || '');
    const file = getFile(path);
    const text = editorText || fileText(file);
    return { path, file, text };
  }

  function writeProjectFile(path, content) {
    const normalized = normalizePath(path);
    try {
      if (State()?.upsertFile) State().upsertFile(normalized, content);
      else if (State()?.updateFile && getFile(normalized)) State().updateFile(normalized, content);
      else {
        const p = project();
        p.files = p.files || [];
        const existing = p.files.find((file) => normalizePath(file.path) === normalized);
        if (existing) existing.text = content;
        else p.files.push({ path: normalized, text: content, kind: 'text' });
      }
    } catch (_err) {
      const p = project();
      p.files = p.files || [];
      const existing = p.files.find((file) => normalizePath(file.path) === normalized);
      if (existing) existing.text = content;
      else p.files.push({ path: normalized, text: content, kind: 'text' });
    }

    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    return normalized;
  }

  function readLines(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function uniqueLines(lines) {
    const seen = new Set();
    const out = [];
    for (const line of lines || []) {
      const value = clean(line);
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
    return out;
  }

  function normalizeUrlForCache(url) {
    const raw = clean(url);
    if (!raw) return '';
    try {
      const u = new URL(raw, W.location.href);
      u.hash = '';
      return u.href.replace(/\/$/, '');
    } catch (_err) {
      return raw.replace(/\s+/g, '').replace(/\/$/, '');
    }
  }

  function readUrlCache() {
    try {
      const raw = W.localStorage?.getItem?.(URL_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function writeUrlCache(cache) {
    try { W.localStorage?.setItem?.(URL_CACHE_KEY, JSON.stringify(cache || {})); return true; }
    catch (_err) { return false; }
  }

  function cachedPaperForUrl(url) {
    const key = normalizeUrlForCache(url);
    const entry = readUrlCache()[key];
    return entry && typeof entry === 'object' ? { ...entry, url: entry.url || url, cacheKey: key, cached: true } : null;
  }

  function savePaperSummariesToCache(papers) {
    const cache = readUrlCache();
    for (const paper of papers || []) {
      const key = normalizeUrlForCache(paper?.url || paper?.sourceUrl || '');
      if (!key) continue;
      cache[key] = {
        ...paper,
        url: paper.url || key,
        cachedAt: new Date().toISOString(),
        stage: STAGE
      };
    }
    writeUrlCache(cache);
    return cache;
  }

  function appendCompetitorUrlFromInput() {
    const input = el('competitiveAddUrlInput');
    const area = el('competitivePaperUrls');
    if (!input || !area) return false;
    const value = clean(input.value);
    if (!value) { setStatus('Enter a competitor URL first.'); return false; }
    const lines = uniqueLines([...readLines(area.value), value]);
    area.value = lines.join('\n');
    input.value = '';
    try { area.dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    updateWorkflowStatus('urls', `Added ${lines.length} competitor URL(s).`);
    setStatus(`Added competitor URL. Total URLs: ${lines.length}.`);
    return true;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>\"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function updateWorkflowStatus(step, message) {
    const node = el('competitiveWorkflowStatus');
    if (!node) return;
    const labels = {
      urls: '1. URLs',
      fetch: '2. Web research',
      rank: '3. Rank competitors',
      compare: '4. Compare draft',
      roadmap: '5. Improvement roadmap',
      insert: '6. Insert edits'
    };
    const rows = Array.from(node.querySelectorAll('[data-competitive-step]'));
    if (!rows.length) {
      node.innerHTML = Object.keys(labels).map((key) => [
        `<div class="competitive-step-row${key === step ? ' active' : ''}" data-competitive-step="${key}">`,
        `<span class="competitive-step-label">${labels[key]}</span>`,
        `<span class="competitive-step-message">${key === step ? escapeHtml(message || 'ready') : 'pending'}</span>`,
        '</div>'
      ].join('')).join('');
      return;
    }
    for (const row of rows) {
      const key = row.dataset.competitiveStep;
      if (key === step) {
        row.classList.add('active');
        const msg = row.querySelector('.competitive-step-message');
        if (msg) msg.textContent = message || 'done';
      }
    }
  }

  function parseCompetitorInputs() {
    const urls = uniqueLines(readLines(el('competitivePaperUrls')?.value));
    const notesRaw = String(el('competitivePaperNotes')?.value || '');
    const notes = notesRaw.trim();
    return { urls, notes };
  }

  function targetModes() {
    return Array.from(D.querySelectorAll('[data-competitive-mode]:checked')).map((box) => box.dataset.competitiveMode);
  }

  function draftExcerpt(text, maxChars = 45000) {
    const s = String(text || '');
    if (s.length <= maxChars) return s;
    const head = s.slice(0, Math.floor(maxChars * 0.65));
    const tail = s.slice(-Math.floor(maxChars * 0.35));
    return `${head}\n\n% ... [middle omitted for competitive review prompt] ...\n\n${tail}`;
  }

  function promptUrl() {
    const stage = encodeURIComponent(W.LUMINA_LATEX_STAGE || STAGE);
    return `${PROMPT_PATH}?v=${stage}`;
  }

  async function loadPrompt() {
    if (promptCache) return promptCache;
    try {
      const response = await fetch(promptUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      promptCache = text.trim() || fallbackPrompt();
    } catch (_err) {
      promptCache = fallbackPrompt();
    }
    return promptCache;
  }

  function fallbackPrompt() {
    return [
      'You are Latexai Competitive Paper Reviewer.',
      'Rank competitor papers from the supplied URLs/notes, compare the current draft, and produce a concrete improvement roadmap.',
      'Do not claim to have read URLs unless their content is provided in notes.',
      'Return Markdown with: ranked competitors, current draft position, weaknesses, concrete edits, predicted rank shift, and suggested lai/laiold edits.',
      'Also include a fenced latexai_actionable_edits JSON block with exact oldText/newText edits that can be inserted using \\laiold and \\lai.'
    ].join('\n');
  }

  function aiStatusUrl() {
    const raw = clean(el('aiProxyUrl')?.value) || '/api/lumina/ai';
    try {
      const url = new URL(raw, W.location.href);
      if (/\/api\/lumina\/ai\/?$/i.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/?$/, '/status');
        url.search = '';
        return url.href;
      }
      if (/\/api\/lumina\/ai\/status\/?$/i.test(url.pathname)) return url.href;
    } catch (_err) {}
    return raw.replace(/\/api\/lumina\/ai\/?$/i, '/api/lumina/ai/status');
  }

  function currentAiProvider() {
    return clean(el('aiProvider')?.value || 'openai');
  }

  function currentAiModel() {
    return clean(el('aiModel')?.value || '');
  }

  function requireWebSearch() {
    // Stage 16C policy: competitive review must use web-search-capable AI.
    return true;
  }

  function webSearchAvailableFromStatus(status) {
    const provider = currentAiProvider();
    const web = status?.webSearch || status?.capabilities?.webSearch || {};
    if (web.available === true || web.supported === true && web.enabled !== false) {
      if (!web.providers) return true;
    }
    const providerInfo = web.providers?.[provider] || status?.providers?.[provider]?.webSearch || {};
    if (providerInfo === true) return true;
    if (providerInfo?.available === true) return true;
    if (providerInfo?.supported === true && providerInfo?.enabled !== false && providerInfo?.configured !== false) return true;
    return false;
  }

  async function checkWebSearchCapability() {
    const statusNode = el('competitiveWebSearchStatus');
    if (statusNode) statusNode.textContent = 'Checking AI backend web-search capability...';

    try {
      let status;
      if (NS.AIProvider?.getStatus) status = await NS.AIProvider.getStatus();
      else {
        const headers = {};
        const token = clean(el('aiProxyToken')?.value);
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(aiStatusUrl(), { headers, cache: 'no-store' });
        status = await response.json().catch(() => ({}));
        if (!response.ok || status.ok === false) throw new Error(status?.error?.message || `AI status HTTP ${response.status}`);
      }

      const available = webSearchAvailableFromStatus(status);
      const provider = currentAiProvider();
      const model = currentAiModel();
      const message = available
        ? `Web search available for ${provider}${model ? ` / ${model}` : ''}.`
        : `Web search unavailable for ${provider}${model ? ` / ${model}` : ''}. Choose a web-search-capable backend/model.`;

      if (statusNode) {
        statusNode.textContent = message;
        statusNode.classList.toggle('ok', available);
        statusNode.classList.toggle('bad', !available);
      }

      return { ok: available, status, message };
    } catch (err) {
      const message = `Could not verify web search: ${err?.message || err}`;
      if (statusNode) {
        statusNode.textContent = message;
        statusNode.classList.remove('ok');
        statusNode.classList.add('bad');
      }
      return { ok: false, error: message };
    }
  }

  function buildPayload() {
    const active = activeSource();
    const competitors = parseCompetitorInputs();
    const modes = targetModes();
    const venue = clean(el('competitiveTargetVenue')?.value);
    const audience = clean(el('competitiveTargetAudience')?.value);
    const instructions = clean(el('competitiveExtraInstructions')?.value);

    return {
      schema: 'latexai-competitive-web-research-review-request-v1',
      workflow: 'competitive-web-review',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      activePath: active.path,
      rootPath: rootPath(),
      targetVenue: venue,
      targetAudience: audience,
      comparisonModes: modes.length ? modes : ['overall competitiveness'],
      competitorUrls: competitors.urls,
      competitorNotes: competitors.notes,
      competitorSummaries: lastCompetitorSummaries,
      competitorRankingReport: lastRankingReport,
      draftComparisonReport: lastComparisonReport,
      competitiveRoadmapReport: lastRoadmapReport,
      extraInstructions: instructions,
      requireWebSearch: requireWebSearch(),
      researchMode: 'web-search-agent-no-pdf-extraction',
      webSearchPolicy: {
        required: true,
        provider: currentAiProvider(),
        model: currentAiModel(),
        expectation: 'AI backend must use web search/open tools to research competitor URLs as source-discovery seeds; do not require PDF web research.'
      },
      draftExcerpt: draftExcerpt(active.text)
    };
  }

  function validatePayload(payload) {
    const errors = [];
    if (!payload.draftExcerpt.trim()) errors.push('Active source file is empty.');
    if (!payload.competitorUrls.length && !payload.competitorNotes.trim()) {
      errors.push('Add at least one competitor URL or competitor note/abstract.');
    }
    return errors;
  }

  function normalizePaperSummary(paper, fallbackUrl = '') {
    const url = clean(paper?.url || paper?.sourceUrl || paper?.link || fallbackUrl);
    if (!url) return null;
    return {
      url,
      title: clean(paper?.title || paper?.name || ''),
      authors: Array.isArray(paper?.authors) ? paper.authors.map(clean).filter(Boolean) : clean(paper?.authors || ''),
      year: clean(paper?.year || paper?.date || ''),
      venue: clean(paper?.venue || paper?.conference || ''),
      abstract: clean(paper?.abstract || paper?.summary || ''),
      mainClaims: Array.isArray(paper?.mainClaims) ? paper.mainClaims.map(clean).filter(Boolean) : readLines(paper?.mainClaims || paper?.claims || ''),
      strengths: Array.isArray(paper?.strengths) ? paper.strengths.map(clean).filter(Boolean) : readLines(paper?.strengths || ''),
      limitations: Array.isArray(paper?.limitations) ? paper.limitations.map(clean).filter(Boolean) : readLines(paper?.limitations || paper?.weaknesses || ''),
      evidence: clean(paper?.evidence || paper?.webSearchEvidence || paper?.sourceEvidence || ''),
      sourcesConsulted: Array.isArray(paper?.sourcesConsulted) ? paper.sourcesConsulted.map(clean).filter(Boolean) : readLines(paper?.sourcesConsulted || paper?.sourceUrls || paper?.sources || ''),
      accessed: paper?.accessed === true || paper?.webSearchAccessed === true || paper?.accessStatus === 'accessed',
      cached: Boolean(paper?.cached),
      cachedAt: paper?.cachedAt || ''
    };
  }

  function parsePaperSummariesFromAi(text, urls) {
    const wanted = uniqueLines(urls || []);
    for (const candidate of parseJsonCandidates(text)) {
      try {
        const data = JSON.parse(candidate);
        const list = Array.isArray(data) ? data
          : Array.isArray(data?.papers) ? data.papers
          : Array.isArray(data?.competitorPapers) ? data.competitorPapers
          : Array.isArray(data?.competitors) ? data.competitors
          : [];
        const papers = list.map((paper, i) => normalizePaperSummary(paper, wanted[i] || '')).filter(Boolean);
        if (papers.length) return papers;
      } catch (_err) {}
    }
    return wanted.map((url) => normalizePaperSummary({ url, evidence: 'No structured web-research JSON was returned; use the prose evidence in the report output.', accessed: false }, url)).filter(Boolean);
  }

  function summariesMarkdown(papers) {
    const list = papers && papers.length ? papers : lastCompetitorSummaries;
    if (!list?.length) return '(no competitor summaries available yet)';
    return list.map((paper, index) => {
      const claims = Array.isArray(paper.mainClaims) ? paper.mainClaims : readLines(paper.mainClaims || '');
      const strengths = Array.isArray(paper.strengths) ? paper.strengths : readLines(paper.strengths || '');
      return [
        `### Competitor ${index + 1}: ${paper.title || paper.url}`,
        `URL: ${paper.url}`,
        paper.authors ? `Authors: ${Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors}` : '',
        paper.venue || paper.year ? `Venue/year: ${[paper.venue, paper.year].filter(Boolean).join(', ')}` : '',
        paper.abstract ? `Abstract/summary: ${paper.abstract}` : '',
        claims.length ? `Main claims: ${claims.map((x) => `- ${x}`).join(' ')}` : '',
        strengths.length ? `Strengths: ${strengths.map((x) => `- ${x}`).join(' ')}` : '',
        paper.evidence ? `Evidence: ${paper.evidence}` : '',
        paper.sourcesConsulted?.length ? `Sources consulted: ${paper.sourcesConsulted.map((x) => `- ${x}`).join(' ')}` : '',
        paper.cached ? `Cache: reused from ${paper.cachedAt || 'local cache'}` : ''
      ].filter(Boolean).join('\n');
    }).join('\n\n');
  }

  function mergedSummariesFromCache(urls) {
    const out = [];
    const missing = [];
    for (const url of urls || []) {
      const cached = cachedPaperForUrl(url);
      if (cached) out.push(normalizePaperSummary(cached, url));
      else missing.push(url);
    }
    return { cached: out.filter(Boolean), missing };
  }

  async function askCompetitiveStep(stepName, instructions, input, routeKey = 'competitive-improvement', maxOutputTokens = 6000) {
    if (!NS.AIProvider?.ask) throw new Error('AIProvider missing');
    const provider = currentAiProvider();
    const model = currentAiModel();
    const modelDecision = NS.AIProvider?.validateRequestModel?.(
      provider,
      model,
      { workflow: stepName },
      { task: 'latex-competitive-paper-review', routeKey, context: { workflow: stepName } }
    );
    if (modelDecision?.repaired) setStatus(`Competitive review model repaired: ${modelDecision.reason}`);
    const response = await NS.AIProvider.ask({
      workflow: stepName,
      instructions,
      input,
      temperature: 0.2,
      maxOutputTokens,
      webSearchRequired: true,
      requireWebSearch: true,
      requiredTools: ['web_search'],
      competitiveReview: {
        step: stepName,
        requireWebSearch: true,
        webSearchEvidenceRequired: true
      }
    }, {
      task: 'latex-competitive-paper-review',
      routeKey,
      context: { workflow: stepName, requireWebSearch: true }
    });
    return NS.AIProvider.extractText ? NS.AIProvider.extractText(response) : String(response || '');
  }

  async function ensureWebSearchReadyForWorkflow() {
    if (!requireWebSearch()) return { ok: true };
    const capability = await checkWebSearchCapability();
    if (!capability.ok) {
      const message = capability.message || capability.error || 'Choose a web-search-capable AI backend/model.';
      setStatus(message);
      setOutput([
        'Competitive review requires web search.',
        '',
        message,
        '',
        'Use an AI backend that reports webSearch.available=true from /api/lumina/ai/status.'
      ].join('\n'));
      return { ok: false, message, capability };
    }
    return { ok: true, capability };
  }

  async function researchCompetitorPapers() {
    const payload = buildPayload();
    const errors = [];
    if (!payload.competitorUrls.length) errors.push('Add at least one competitor URL to research.');
    if (errors.length) { setStatus(errors.join(' ')); setOutput(errors.join('\n')); return { ok: false, errors }; }
    const ready = await ensureWebSearchReadyForWorkflow();
    if (!ready.ok) return ready;

    updateWorkflowStatus('fetch', 'researching competitor papers with web search...');
    setStatus('Researching competitor papers with the AI web-search agent...');

    const { cached, missing } = mergedSummariesFromCache(payload.competitorUrls);
    if (!missing.length) {
      lastCompetitorSummaries = cached;
      const report = ['# Competitor web research', '', 'All competitor research profiles were loaded from local cache.', '', summariesMarkdown(cached)].join('\n');
      setOutput(report);
      setStatus(`Loaded ${cached.length} competitor research profile(s) from cache.`);
      updateWorkflowStatus('fetch', `${cached.length} cached research profile(s) ready.`);
      return { ok: true, papers: cached, cached: true, report };
    }

    const instructions = [
      'Use web search/open tools to research each competitor URL as a seed and build concise paper metadata/profiles.',
      'Return a short Markdown web-research evidence report with sources consulted.',
      'Also include exactly one fenced code block labelled latexai_competitor_research_profiles containing JSON:',
      '{"papers":[{"url":"...","title":"...","authors":["..."],"year":"...","venue":"...","abstract":"...","mainClaims":["..."],"strengths":["..."],"limitations":["..."],"sourcesConsulted":["source URL/title consulted"],"evidence":"what web source/snippet supported this","accessed":true}]}',
      'If a URL or its related public sources cannot be accessed, include it with accessed=false and explain what evidence is missing.'
    ].join('\n');
    const input = [
      '--- Competitor URL seeds to research ---',
      missing.map((url, i) => `${i + 1}. ${url}`).join('\n'),
      '',
      payload.competitorNotes ? `--- User-provided notes/abstracts ---\n${payload.competitorNotes}` : '',
      '',
      'Use web search/opening tools where available. Treat URLs as seeds for source discovery; do not claim PDF/full-paper access unless the web evidence supports it.'
    ].filter(Boolean).join('\n');

    try {
      const raw = (await askCompetitiveStep('competitive-web-research', instructions, input, 'competitive-ranking', 5000)).trim();
      const researched = parsePaperSummariesFromAi(raw, missing);
      const merged = [...cached, ...researched];
      lastCompetitorSummaries = merged;
      savePaperSummariesToCache(researched);
      const report = [raw || '# Competitor web research', '', '--- Latexai parsed competitor research profiles ---', summariesMarkdown(merged)].join('\n');
      setOutput(report);
      setStatus(`Researched ${researched.length} competitor research profile(s); ${cached.length} reused from cache.`);
      updateWorkflowStatus('fetch', `${merged.length} competitor research profile(s) ready.`);
      return { ok: true, papers: merged, report, cached: false };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Competitor web research failed: ${message}`);
      setOutput(`Competitor web research failed:\n\n${message}`);
      return { ok: false, error: message };
    }
  }

  async function rankCompetitorPapers() {
    const payload = buildPayload();
    if (!lastCompetitorSummaries.length) {
      const fetched = await researchCompetitorPapers();
      if (!fetched.ok) return fetched;
    }
    updateWorkflowStatus('rank', 'ranking competitor set...');
    setStatus('Ranking competitor paper set...');
    const instructions = [
      'Rank the competitor papers against each other before considering the user draft.',
      'Use the web-researched evidence, target venue, target audience, and comparison modes.',
      'Return a Markdown ranking table with #, title, URL, main strength, weakness/risk, and why it is above/below the next paper.',
      'End with a concise JSON block labelled latexai_competitor_ranking with {"ranking":[{"rank":1,"url":"...","title":"...","rationale":"..."}]}.'
    ].join('\n');
    const input = [
      '--- Target venue/audience ---',
      `Venue: ${payload.targetVenue || '(not specified)'}`,
      `Audience: ${payload.targetAudience || '(not specified)'}`,
      `Modes: ${payload.comparisonModes.join(', ')}`,
      '',
      '--- Competitor paper summaries ---',
      summariesMarkdown(lastCompetitorSummaries),
      '',
      payload.competitorNotes ? `--- User notes ---\n${payload.competitorNotes}` : ''
    ].filter(Boolean).join('\n');
    try {
      lastRankingReport = (await askCompetitiveStep('competitive-competitor-ranking', instructions, input, 'competitive-ranking', 5000)).trim();
      lastReport = lastRankingReport;
      setOutput(lastRankingReport || '(AI returned empty competitor ranking.)');
      setStatus(lastRankingReport ? 'Competitor ranking complete.' : 'Competitor ranking returned an empty report.');
      updateWorkflowStatus('rank', lastRankingReport ? 'ranking ready.' : 'ranking empty.');
      return { ok: Boolean(lastRankingReport), report: lastRankingReport, papers: lastCompetitorSummaries };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Competitor ranking failed: ${message}`);
      setOutput(`Competitor ranking failed:\n\n${message}`);
      return { ok: false, error: message };
    }
  }

  async function compareDraftAgainstRankedSet() {
    const payload = buildPayload();
    const errors = validatePayload(payload);
    if (errors.length) { setStatus(errors.join(' ')); setOutput(errors.join('\n')); return { ok: false, errors }; }
    if (!lastRankingReport) {
      const ranked = await rankCompetitorPapers();
      if (!ranked.ok) return ranked;
    }
    updateWorkflowStatus('compare', 'comparing draft against ranked set...');
    setStatus('Comparing current draft against ranked competitor set...');
    const instructions = [
      'Compare the current draft against the already-ranked competitor set.',
      'Estimate the current draft position relative to the competitor papers.',
      'For each competitor, list exactly what the current draft does worse, what it does better, and what must change to move up.',
      'Return Markdown only; do not produce actionable edit JSON in this step.'
    ].join('\n');
    const input = [
      '--- Competitor ranking report ---',
      lastRankingReport,
      '',
      '--- Competitor summaries ---',
      summariesMarkdown(lastCompetitorSummaries),
      '',
      '--- Current draft excerpt ---',
      payload.draftExcerpt,
      '',
      payload.extraInstructions ? `--- User extra instructions ---\n${payload.extraInstructions}` : ''
    ].filter(Boolean).join('\n');
    try {
      lastComparisonReport = (await askCompetitiveStep('competitive-draft-comparison', instructions, input, 'competitive-improvement', 6000)).trim();
      lastReport = lastComparisonReport;
      setOutput(lastComparisonReport || '(AI returned empty draft comparison.)');
      setStatus(lastComparisonReport ? 'Draft comparison complete.' : 'Draft comparison returned an empty report.');
      updateWorkflowStatus('compare', lastComparisonReport ? 'comparison ready.' : 'comparison empty.');
      return { ok: Boolean(lastComparisonReport), report: lastComparisonReport };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Draft comparison failed: ${message}`);
      setOutput(`Draft comparison failed:\n\n${message}`);
      return { ok: false, error: message };
    }
  }

  async function generateImprovementRoadmap() {
    updateWorkflowStatus('roadmap', 'generating improvement roadmap and actionable edits...');
    const result = await runCompetitiveReview({ useExistingRoadmapContext: true });
    if (result?.ok) {
      lastRoadmapReport = result.report || lastReport;
      updateWorkflowStatus('roadmap', 'roadmap ready; insert or save report next.');
    }
    return result;
  }

  async function runCompetitiveReview(options = {}) {
    if (!NS.AIProvider?.ask) {
      setStatus('AIProvider is not loaded. Check feature flags and safe mode.');
      return { ok: false, error: 'AIProvider missing' };
    }

    const payload = buildPayload();
    const errors = validatePayload(payload);
    if (errors.length) {
      setStatus(errors.join(' '));
      setOutput(`Cannot run competitive review:\n\n${errors.map((e) => `- ${e}`).join('\n')}`);
      return { ok: false, errors };
    }

    if (requireWebSearch()) {
      const capability = await checkWebSearchCapability();
      if (!capability.ok) {
        const message = capability.message || capability.error || 'Choose a web-search-capable AI backend/model.';
        setStatus(message);
        setOutput([
          'Competitive review requires web search.',
          '',
          message,
          '',
          'Use an AI backend that reports webSearch.available=true from /api/lumina/ai/status.'
        ].join('\n'));
        return { ok: false, error: message, capability, payload };
      }
    }

    lastPayload = payload;
    setStatus('Running competitive paper review...');

    const prompt = await loadPrompt();
    const input = [
      prompt,
      '',
      '--- Request JSON ---',
      JSON.stringify(payload, null, 2),
      '',
      '--- Important limitation ---',
      'Use web search/open tools for competitor URLs whenever available. Treat URLs as source-discovery seeds. Do not use or request Latexai PDF extraction, and do not claim full-paper/PDF access unless the searched evidence supports it.'
    ].join('\n');

    try {
      const modelDecision = NS.AIProvider?.validateRequestModel?.(
        currentAiProvider(),
        currentAiModel(),
        { workflow: 'competitive-web-review-improvement' },
        { task: 'latex-competitive-paper-review', routeKey: 'competitive-improvement', context: { workflow: 'competitive-web-review', requireWebSearch: true } }
      );
      if (modelDecision?.repaired) setStatus(`Competitive review model repaired: ${modelDecision.reason}`);

      const response = await NS.AIProvider.ask({
        workflow: 'competitive-web-review-improvement',
        instructions: [
          'Return a structured Markdown competitive review report. Be critical, concrete, and action-oriented.',
          'In addition to the prose report, include one fenced code block labelled latexai_actionable_edits.',
          'That block must be JSON with schema {\"actionableEdits\":[{\"mode\":\"replace|insert_after|insert_before\",\"path\":\"optional tex path\",\"targetHint\":\"section or paragraph hint\",\"oldText\":\"exact source substring for replace/anchor\",\"newText\":\"LaTeX replacement or insertion\",\"confidence\":0.0}],\"appendPlan\":\"optional high-level LaTeX plan\"}.',
          'For every edit, include a rankingEffect explaining which competitor gap the edit addresses. For replace edits, oldText must be copied exactly from the draft excerpt when possible so Latexai can insert \\laiold{oldText} and \\lai{newText} at the right location.',
          'newText must be a compile-safe LaTeX body fragment: no Markdown fences, no preamble commands, no \\begin{document}/\\end{document}, balanced braces/environments, and text-mode special characters escaped.',
          'Do not target the document preamble; if a suggestion cannot be localized in the document body safely, put it in appendPlan rather than inventing an oldText.'
        ].join('\n'),
        input,
        temperature: 0.2,
        maxOutputTokens: 7000,
        webSearchRequired: true,
        requireWebSearch: true,
        requiredTools: ['web_search'],
        competitiveReview: {
          targetVenue: payload.targetVenue,
          comparisonModes: payload.comparisonModes,
          competitorUrlCount: payload.competitorUrls.length,
          requireWebSearch: true,
          webSearchEvidenceRequired: true
        }
      }, {
        task: 'latex-competitive-paper-review',
        routeKey: 'competitive-improvement',
        context: {
          workflow: 'competitive-web-review',
          requireWebSearch: true,
          promptFile: PROMPT_PATH,
          targetVenue: payload.targetVenue,
          comparisonModes: payload.comparisonModes,
          requireWebSearch: true
        }
      });

      const raw = NS.AIProvider.extractText ? NS.AIProvider.extractText(response) : String(response || '');
      lastReport = raw.trim();
      setOutput(lastReport || '(AI returned empty report.)');
      setStatus(lastReport ? 'Competitive review complete.' : 'Competitive review returned an empty report.');
      return { ok: Boolean(lastReport), report: lastReport, payload };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Competitive review failed: ${message}`);
      setOutput(`Competitive review failed:\n\n${message}`);
      return { ok: false, error: message, payload };
    }
  }

  function reportFilename() {
    const date = new Date().toISOString().slice(0, 10);
    const venue = clean(el('competitiveTargetVenue')?.value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const suffix = venue ? `-${venue}` : '';
    return normalizePath(`reviews/competitive-review-${date}${suffix}.md`);
  }

  function addReportToProject() {
    if (!lastReport) {
      setStatus('Run competitive review first.');
      return { ok: false, error: 'No report' };
    }

    const payload = lastPayload || buildPayload();
    const content = [
      '# Competitive paper review',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Stage: ${STAGE}`,
      `Target venue: ${payload.targetVenue || '(not specified)'}`,
      `Target audience: ${payload.targetAudience || '(not specified)'}`,
      `Comparison modes: ${payload.comparisonModes.join(', ')}`,
      '',
      '## Competitor URLs',
      '',
      ...(payload.competitorUrls.length ? payload.competitorUrls.map((url) => `- ${url}`) : ['- (none provided)']),
      '',
      '## Competitor web research profiles',
      '',
      summariesMarkdown(payload.competitorSummaries || lastCompetitorSummaries),
      '',
      '## Competitor ranking prepass',
      '',
      payload.competitorRankingReport || lastRankingReport || '(not run separately)',
      '',
      '## Draft comparison prepass',
      '',
      payload.draftComparisonReport || lastComparisonReport || '(not run separately)',
      '',
      '## Report',
      '',
      lastReport,
      ''
    ].join('\n');

    const path = writeProjectFile(reportFilename(), content);
    setStatus(`Added competitive review to ${path}.`);
    return { ok: true, path };
  }

  function updateProjectSource(path, text) {
    const normalized = normalizePath(path);
    try {
      if (State()?.updateFile) State().updateFile(normalized, text);
      else {
        const file = getFile(normalized);
        if (file) file.text = text;
        else writeProjectFile(normalized, text);
      }
    } catch (_err) {
      const file = getFile(normalized);
      if (file) file.text = text;
      else writeProjectFile(normalized, text);
    }

    if (normalizePath(activePath()) === normalized && el('sourceEditor')) {
      el('sourceEditor').value = text;
      try { el('sourceEditor').dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    }

    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}
  }

  function ensurePackageInPreamble(tex, packageName) {
    const s = String(tex || '');
    const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pkgRe = new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{[^}]*\\b${escaped}\\b[^}]*\\}`);
    if (pkgRe.test(s)) return s;
    const line = `\\usepackage{${packageName}}\n`;
    const docIdx = s.indexOf('\\begin{document}');
    if (docIdx >= 0) return s.slice(0, docIdx) + line + s.slice(docIdx);
    const classMatch = s.match(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}\s*/);
    if (classMatch?.index !== undefined) {
      const at = classMatch.index + classMatch[0].length;
      return s.slice(0, at) + '\n' + line + s.slice(at);
    }
    return line + s;
  }

  function hasLaiMacro(tex) {
    const s = String(tex || '');
    return /\\newif\\iflaishowchanges/.test(s) && /\\(?:long\\def|def|newcommand)\s*\\lai\b/.test(s);
  }

  function ensureLaiMacroLocal(rootText) {
    let s = String(rootText || '');
    if (hasLaiMacro(s)) return s;
    s = ensurePackageInPreamble(s, 'xcolor');
    const macro = [
      '% --- Latexai AI-change highlighting macro ---',
      '% Set this to \\laishowchangesfalse to hide red AI markup.',
      '\\newif\\iflaishowchanges',
      '\\laishowchangestrue',
      '\\long\\def\\lai#1{%',
      '  \\iflaishowchanges',
      '    {\\color{red}#1}%',
      '  \\else',
      '    #1%',
      '  \\fi',
      '}',
      '% --- end Latexai AI-change highlighting macro ---',
      ''
    ].join('\n');
    const docIdx = s.indexOf('\\begin{document}');
    if (docIdx >= 0) return s.slice(0, docIdx) + macro + '\n' + s.slice(docIdx);
    return macro + '\n' + s;
  }

  function ensureLaiOldMacro(rootText) {
    let s = String(rootText || '');
    s = ensurePackageInPreamble(s, 'xcolor');
    if (/\\(?:long\s*)?\\?def\s*\\laiold\b|\\newcommand\s*\{\\laiold\}|\\providecommand\s*\{\\laiold\}/.test(s)) return s;
    const macro = [
      '',
      '% --- Latexai old-content highlighting macro ---',
      '% Old source preserved by actionable AI edits.',
      '\\long\\def\\laiold#1{{\\color{blue}#1}}',
      '% --- end Latexai old-content highlighting macro ---',
      ''
    ].join('\n');
    const laiIdx = s.search(/% --- Latexai AI-change highlighting macro ---|\\long\\def\\lai#1|\\newcommand\s*\{\\lai\}/);
    if (laiIdx >= 0) return s.slice(0, laiIdx) + macro + s.slice(laiIdx);
    const docIdx = s.indexOf('\\begin{document}');
    if (docIdx >= 0) return s.slice(0, docIdx) + macro + s.slice(docIdx);
    return macro + s;
  }

  function ensureRootLaiMacros() {
    const root = getFile(rootPath());
    if (!root) return false;
    let text = fileText(root);
    let next = NS.ProjectModel?.ensureLaiMacro ? NS.ProjectModel.ensureLaiMacro(text) : text;
    next = ensureLaiMacroLocal(next);
    next = ensureLaiOldMacro(next);
    if (next !== text) updateProjectSource(rootPath(), next);
    return true;
  }

  function insertBeforeEndDocument(tex, insertion) {
    const s = String(tex || '');
    const marker = '\\end{document}';
    const at = s.lastIndexOf(marker);
    const block = `\n\n${String(insertion || '').trim()}\n\n`;
    if (at >= 0) return s.slice(0, at).replace(/\s*$/, '') + block + s.slice(at);
    return s.replace(/\s*$/, '') + block;
  }


  function refreshPaperAiReview(paths, source = 'Competitive Review') {
    const normalized = [...new Set((paths || []).map(normalizePath).filter(Boolean))];
    try {
      if (NS.PaperAiPolishService?.scanProject) {
        return NS.PaperAiPolishService.scanProject({ paths: normalized });
      }
      if (normalized[0] && NS.PaperAiPolishService?.scanPath) {
        return NS.PaperAiPolishService.scanPath(normalized[0], { open: false });
      }
      if (NS.PaperAiPolishService?.scan) return NS.PaperAiPolishService.scan();
    } catch (err) {
      try { console.warn('[Latexai] could not refresh paper AI review after competitive insertion', err); } catch (_err) {}
    }
    return null;
  }

  function workflowBlockHeader(id, path, extra = '') {
    return `% BEGIN LAI-ACTIONABLE-EDIT id=${safeMetaValue(id)} workflow=competitive-review path=${safeMetaValue(path)}${extra ? ` ${latexCommentText(extra, 120)}` : ''}`;
  }

  function workflowBlockFooter(id) {
    return `% END LAI-ACTIONABLE-EDIT id=${id}`;
  }

  function wrapLaiPlanBlock(laiBlock, path) {
    const id = `lai-competitive-plan-${Date.now().toString(36)}`;
    return [workflowBlockHeader(id, normalizePath(path), 'mode=append-plan'), '% LAI target: end-of-paper competitive improvement plan', String(laiBlock || '').trim(), workflowBlockFooter(id)].join('\n');
  }

  function escapeLatexText(value) {
    return String(value || '')
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([#$%&_{}])/g, '\\$1')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }

  function markdownToLaiPlan(markdown, title, maxLines = 140) {
    const lines = String(markdown || '').split(/\r?\n/).slice(0, maxLines);
    const out = ['\\lai{', `\\section*{${escapeLatexText(title)}}`];
    let inItems = false;
    const closeItems = () => { if (inItems) { out.push('\\end{itemize}'); inItems = false; } };
    for (const raw of lines) {
      const line = String(raw || '').trim();
      if (!line) { closeItems(); out.push(''); continue; }
      const heading = line.match(/^#{1,4}\s+(.+)$/);
      if (heading) { closeItems(); out.push(`\\paragraph{${escapeLatexText(heading[1]).replace(/\.$/, '')}.}`); continue; }
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        if (!inItems) { out.push('\\begin{itemize}'); inItems = true; }
        out.push(`\\item ${escapeLatexText(bullet[1])}`);
        continue;
      }
      closeItems();
      out.push(`${escapeLatexText(line)}\\par`);
    }
    closeItems();
    out.push('}');
    return out.join('\n');
  }


  function isEscapedAt(text, index) {
    let n = 0;
    for (let i = index - 1; i >= 0 && text[i] === '\\'; i -= 1) n += 1;
    return n % 2 === 1;
  }

  function stripLatexCommentsForBalance(value) {
    return String(value || '').split(/\r?\n/).map((line) => {
      for (let i = 0; i < line.length; i += 1) {
        if (line[i] === '%' && !isEscapedAt(line, i)) return line.slice(0, i);
      }
      return line;
    }).join('\n');
  }

  function latexCommentText(value, max = 220) {
    return String(value || '')
      .replace(/\r?\n+/g, ' ')
      .replace(/%/g, ' percent ')
      .replace(/[{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  function safeMetaValue(value) {
    return encodeURIComponent(String(value || '').replace(/\s+/g, '_')).slice(0, 220);
  }

  function bracesAreBalanced(value) {
    const s = stripLatexCommentsForBalance(value);
    let depth = 0;
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      if ((ch === '{' || ch === '}') && isEscapedAt(s, i)) continue;
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth < 0) return false;
      }
    }
    return depth === 0;
  }

  function environmentBalanceIssue(value) {
    const s = stripLatexCommentsForBalance(value);
    const stack = [];
    const re = /\\(begin|end)\s*\{([^}]+)\}/g;
    let match;
    while ((match = re.exec(s))) {
      const kind = match[1];
      const env = String(match[2] || '').trim();
      if (!env || env === 'document') continue;
      if (kind === 'begin') stack.push(env);
      else {
        const top = stack.pop();
        if (top !== env) return `environment mismatch: expected ${top || 'none'}, saw ${env}`;
      }
    }
    if (stack.length) return `unclosed environment: ${stack[stack.length - 1]}`;
    return '';
  }

  function unwrapSingleMacroArgument(text, macroName) {
    const s = String(text || '').trim();
    const prefix = `\\${macroName}`;
    if (!s.startsWith(prefix)) return null;
    let i = prefix.length;
    while (/\s/.test(s[i] || '')) i += 1;
    if (s[i] !== '{') return null;
    let depth = 0;
    for (let j = i; j < s.length; j += 1) {
      const ch = s[j];
      if ((ch === '{' || ch === '}') && isEscapedAt(s, j)) continue;
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const tail = s.slice(j + 1).trim();
          if (!tail) return s.slice(i + 1, j);
          return null;
        }
      }
    }
    return null;
  }

  function stripActionableWrappers(value) {
    let s = String(value || '').trim();
    const fence = s.match(/^```(?:latex|tex|latexai_actionable_edits)?\s*([\s\S]*?)\s*```$/i);
    if (fence) s = fence[1].trim();
    const asLai = unwrapSingleMacroArgument(s, 'lai');
    if (asLai !== null) s = asLai.trim();
    return s;
  }

  function escapeRiskyTextModeSpecials(value) {
    const s = String(value || '');
    const hasAlignmentEnv = /\\begin\s*\{(?:tabular\*?|array|align\*?|aligned|cases|matrix|pmatrix|bmatrix|smallmatrix)\}/.test(s);
    let out = '';
    let math = false;
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      const next = s[i + 1] || '';
      if (ch === '\\' && (next === '(' || next === '[')) { math = true; out += ch + next; i += 1; continue; }
      if (ch === '\\' && (next === ')' || next === ']')) { math = false; out += ch + next; i += 1; continue; }
      if (ch === '$' && !isEscapedAt(s, i)) { math = !math; out += ch; continue; }
      if (!math && !isEscapedAt(s, i)) {
        if (ch === '%') { out += '\\%'; continue; }
        if (ch === '_') { out += '\\_'; continue; }
        if (ch === '#') { out += '\\#'; continue; }
        if (ch === '&' && !hasAlignmentEnv) { out += '\\&'; continue; }
        if (ch === '^') { out += '\\textasciicircum{}'; continue; }
      }
      out += ch;
    }
    return out;
  }

  function validateMacroArgument(value, label) {
    const s = String(value || '');
    if (/\\verb\b|\\begin\s*\{verbatim\}|\\end\s*\{verbatim\}/.test(s)) {
      return `${label} contains verbatim/\\verb, which is unsafe inside \\lai`;
    }
    if (!bracesAreBalanced(s)) return `${label} has unbalanced braces`;
    const envIssue = environmentBalanceIssue(s);
    if (envIssue) return `${label} has ${envIssue}`;
    return '';
  }

  function prepareActionableNewLatex(value) {
    let s = stripActionableWrappers(value);
    s = s.replace(/\r\n?/g, '\n').trim();
    if (!s) return { ok: false, reason: 'empty newText', text: '' };
    if (/```/.test(s)) return { ok: false, reason: 'newText still contains Markdown code fences', text: '' };
    if (/\\(?:documentclass|usepackage)\b|\\begin\s*\{document\}|\\end\s*\{document\}/.test(s)) {
      return { ok: false, reason: 'newText contains document-level LaTeX commands', text: '' };
    }
    s = escapeRiskyTextModeSpecials(s);
    const issue = validateMacroArgument(s, 'newText');
    if (issue) return { ok: false, reason: issue, text: '' };
    return { ok: true, reason: '', text: s };
  }

  function unsafeInsertionLocationReason(sourceText, at) {
    const s = String(sourceText || '');
    const beginDoc = s.indexOf('\\begin{document}');
    if (beginDoc >= 0 && at >= 0 && at < beginDoc) return 'match is in the preamble; visible \\lai edits are only inserted in document body';
    const begin = s.lastIndexOf('% BEGIN LAI-ACTIONABLE-EDIT', at);
    const end = s.lastIndexOf('% END LAI-ACTIONABLE-EDIT', at);
    if (begin > end) return 'match is already inside an existing Latexai actionable edit block';
    return '';
  }

  function parseJsonCandidates(text) {
    const s = String(text || '');
    const candidates = [];
    const fenceRe = /```(?:json|latexai_actionable_edits|latexai_competitor_research_profiles|latexai_competitor_ranking)?\s*([\s\S]*?)```/gi;
    let match;
    while ((match = fenceRe.exec(s))) candidates.push(match[1].trim());
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) candidates.push(s.slice(first, last + 1));
    return candidates;
  }

  function normalizeActionableEdit(edit, index) {
    const modeRaw = clean(edit?.mode || edit?.operation || edit?.type || (edit?.oldText ? 'replace' : 'insert_after')).toLowerCase();
    const mode = /insert[_ -]?before/.test(modeRaw) ? 'insert_before' : /insert[_ -]?after|append/.test(modeRaw) ? 'insert_after' : 'replace';
    const oldText = String(edit?.oldText ?? edit?.old ?? edit?.before ?? edit?.sourceText ?? edit?.anchorText ?? edit?.insertAfter ?? '');
    const newText = String(edit?.newText ?? edit?.new ?? edit?.after ?? edit?.replacement ?? edit?.text ?? edit?.lai ?? '');
    const path = normalizePath(edit?.path || edit?.file || edit?.texPath || activePath());
    const targetHint = String(edit?.targetHint || edit?.location || edit?.section || edit?.reason || `actionable edit ${index + 1}`);
    const confidence = Number(edit?.confidence);
    if (!newText.trim()) return null;
    if (mode === 'replace' && !oldText.trim()) return null;
    if (mode !== 'replace' && !oldText.trim()) return null;
    return { mode, path, oldText, newText, targetHint, confidence: Number.isFinite(confidence) ? confidence : null };
  }

  function extractActionableEdits(text) {
    for (const candidate of parseJsonCandidates(text)) {
      try {
        const data = JSON.parse(candidate);
        const list = Array.isArray(data) ? data : Array.isArray(data?.actionableEdits) ? data.actionableEdits : Array.isArray(data?.edits) ? data.edits : [];
        const edits = list.map(normalizeActionableEdit).filter(Boolean);
        if (edits.length) return { source: 'latexai_actionable_edits_json', edits, appendPlan: String(data?.appendPlan || '') };
      } catch (_err) {}
    }

    const pairs = [];
    const re = /\\laiold\s*\{([\s\S]*?)\}\s*\\lai\s*\{([\s\S]*?)\}/g;
    let match;
    while ((match = re.exec(String(text || '')))) {
      const edit = normalizeActionableEdit({ mode: 'replace', oldText: match[1], newText: match[2], targetHint: 'AI-provided \\laiold/\\lai pair' }, pairs.length);
      if (edit) pairs.push(edit);
    }
    return { source: pairs.length ? 'laiold_lai_pairs' : 'none', edits: pairs, appendPlan: '' };
  }

  function wrapActionableReplacement(edit, index) {
    const id = `lai-competitive-${Date.now().toString(36)}-${index}`;
    const oldText = String(edit.oldText || '').trim();
    const oldIssue = edit.mode === 'replace' ? validateMacroArgument(oldText, 'oldText') : '';
    if (oldIssue) return { ok: false, reason: oldIssue, text: '' };
    const prepared = prepareActionableNewLatex(edit.newText || '');
    if (!prepared.ok) return prepared;
    const header = workflowBlockHeader(id, edit.path, `mode=${edit.mode}`);
    const hint = edit.targetHint ? `% LAI target: ${latexCommentText(edit.targetHint)}` : '';
    const footer = workflowBlockFooter(id);
    if (edit.mode === 'replace') {
      return { ok: true, reason: '', text: [header, hint, '\\laiold{', oldText, '}', '\\lai{', prepared.text, '}', footer].filter(Boolean).join('\n') };
    }
    return { ok: true, reason: '', text: [header, hint, '\\lai{', prepared.text, '}', footer].filter(Boolean).join('\n') };
  }

  function insertActionableEditsAtMatches() {
    if (!lastReport) {
      setStatus('Run competitive review first.');
      return { ok: false, error: 'No report' };
    }

    ensureRootLaiMacros();
    const parsed = extractActionableEdits(lastReport);
    if (!parsed.edits.length) {
      setStatus('No exact actionable edit JSON or \\laiold/\\lai pairs found. Use Append \\lai plan instead.');
      return { ok: false, applied: 0, skipped: 0, source: parsed.source };
    }

    const queued = new Map();
    const messages = [];
    let skipped = 0;

    parsed.edits.forEach((edit, index) => {
      const path = normalizePath(edit.path || activePath());
      const file = getFile(path);
      if (!file) { skipped += 1; messages.push(`SKIP ${path}: file not found for ${edit.targetHint}.`); return; }
      const text = fileText(file);
      const anchor = String(edit.oldText || '');
      const at = text.indexOf(anchor);
      if (at < 0) { skipped += 1; messages.push(`SKIP ${path}: exact oldText/anchor not found for ${edit.targetHint}.`); return; }
      const locationIssue = unsafeInsertionLocationReason(text, at);
      if (locationIssue) { skipped += 1; messages.push(`SKIP ${path}: ${locationIssue} for ${edit.targetHint}.`); return; }
      const wrapped = wrapActionableReplacement({ ...edit, path }, index);
      if (!wrapped.ok) { skipped += 1; messages.push(`SKIP ${path}: unsafe LaTeX for ${edit.targetHint}: ${wrapped.reason}.`); return; }
      const replacement = wrapped.text;
      const start = edit.mode === 'insert_before' ? at : at;
      const end = edit.mode === 'replace' ? at + anchor.length : edit.mode === 'insert_after' ? at + anchor.length : at;
      const insert = edit.mode === 'replace' ? replacement : edit.mode === 'insert_after' ? `${anchor}\n\n${replacement}` : `${replacement}\n\n${anchor}`;
      if (!queued.has(path)) queued.set(path, []);
      queued.get(path).push({ start, end, insert, targetHint: edit.targetHint });
    });

    let applied = 0;
    for (const [path, ops] of queued.entries()) {
      const file = getFile(path);
      let text = fileText(file);
      ops.sort((a, b) => b.start - a.start);
      for (const op of ops) {
        text = text.slice(0, op.start) + op.insert + text.slice(op.end);
        applied += 1;
        messages.push(`APPLY ${path}: ${op.targetHint}`);
      }
      updateProjectSource(path, text);
    }

    const modifiedPaths = [...queued.keys()];
    refreshPaperAiReview(modifiedPaths, 'Competitive Review');
    setStatus(`Inserted ${applied} competitive \\lai edit(s) at exact matches; skipped ${skipped}. Paper-level edit review refreshed.`);
    setOutput([lastReport, '', '--- Latexai actionable edit insertion report ---', `Source: ${parsed.source}`, `Applied: ${applied}`, `Skipped: ${skipped}`, ...messages].join('\n'));
    return { ok: applied > 0, applied, skipped, messages, source: parsed.source, paths: [...queued.keys()] };
  }

  function appendLaiImprovementPlan() {
    if (!lastReport) {
      setStatus('Run competitive review first.');
      return { ok: false, error: 'No report' };
    }

    ensureRootLaiMacros();
    const root = getFile(rootPath());
    const active = root ? { path: rootPath(), file: root, text: fileText(root) } : activeSource();
    const parsed = extractActionableEdits(lastReport);
    const planText = parsed.appendPlan && parsed.appendPlan.trim() ? parsed.appendPlan : lastReport;
    const insertion = wrapLaiPlanBlock(markdownToLaiPlan(planText, 'Latexai Competitive Review Improvement Plan'), active.path);
    const next = insertBeforeEndDocument(active.text, insertion);
    updateProjectSource(active.path, next);
    refreshPaperAiReview([active.path], 'Competitive Review');
    setStatus(`Appended competitive improvement plan as visible \\lai markup to ${active.path}. Paper-level edit review refreshed.`);
    return { ok: true, path: active.path, mode: 'append-lai-plan' };
  }

  function insertRoadmapComment() {
    return appendLaiImprovementPlan();
  }

  async function copyReport() {
    const text = lastReport || el('competitiveReviewOutput')?.textContent || '';
    if (!text.trim()) {
      setStatus('No competitive review report to copy.');
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Competitive review copied.');
      return true;
    } catch (_err) {
      setStatus('Could not copy automatically. Select the report text manually.');
      return false;
    }
  }

  function setStatus(message) {
    const node = el('competitiveReviewStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const out = el('competitiveReviewOutput');
    if (out) {
      out.classList.add('active');
      out.textContent = String(text || '');
    }
  }

  function createCard() {
    const panel = el('copilotTab') || el('settingsTab') || D.querySelector('.right-panel');
    if (!panel || el('competitiveReviewCard')) return false;

    const card = D.createElement('div');
    card.id = 'competitiveReviewCard';
    card.className = 'competitive-review-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Paper AI</div>',
      '    <h2>Competitive paper review</h2>',
      '  </div>',
      '</div>',
      '<p class="competitive-review-help">Competitor-driven review workflow: add URLs, research competitor papers with a web-search-capable AI backend, rank competitors, compare the draft, then generate a roadmap with actionable <code>\lai</code> edits.</p>',
      '<label class="competitive-web-required"><input id="competitiveRequireWebSearch" type="checkbox" checked disabled /> Require web-search-capable AI for this workflow</label>',
      '<div id="competitiveWebSearchStatus" class="competitive-web-status">Web search not checked yet.</div>',
      '<div id="competitiveWorkflowStatus" class="competitive-workflow-status">',
      '  <div class="competitive-step-row active" data-competitive-step="urls"><span class="competitive-step-label">1. URLs</span><span class="competitive-step-message">Add competitor papers</span></div>',
      '  <div class="competitive-step-row" data-competitive-step="fetch"><span class="competitive-step-label">2. Web research</span><span class="competitive-step-message">pending</span></div>',
      '  <div class="competitive-step-row" data-competitive-step="rank"><span class="competitive-step-label">3. Rank competitors</span><span class="competitive-step-message">pending</span></div>',
      '  <div class="competitive-step-row" data-competitive-step="compare"><span class="competitive-step-label">4. Compare draft</span><span class="competitive-step-message">pending</span></div>',
      '  <div class="competitive-step-row" data-competitive-step="roadmap"><span class="competitive-step-label">5. Roadmap</span><span class="competitive-step-message">pending</span></div>',
      '  <div class="competitive-step-row" data-competitive-step="insert"><span class="competitive-step-label">6. Insert edits</span><span class="competitive-step-message">pending</span></div>',
      '</div>',
      '<div class="competitive-url-add-row">',
      '  <input id="competitiveAddUrlInput" type="url" placeholder="Paste competitor paper URL" />',
      '  <button id="addCompetitiveUrlBtn" class="btn mini" type="button">+ Add URL</button>',
      '</div>',
      '<label class="field">Competitor paper URLs',
      '  <textarea id="competitivePaperUrls" rows="4" placeholder="One URL per line. The AI backend will use web-search/open tools to build cached competitor research profiles; Latexai will not extract PDFs itself."></textarea>',
      '</label>',
      '<label class="field">Competitor notes / abstracts / titles',
      '  <textarea id="competitivePaperNotes" rows="5" placeholder="Optional but useful: paste titles, abstracts, claims, strengths, or notes for the competitor papers."></textarea>',
      '</label>',
      '<div class="field-grid two">',
      '  <label class="field">Target venue',
      '    <input id="competitiveTargetVenue" type="text" placeholder="e.g. COLT, NeurIPS, ICML, STOC" />',
      '  </label>',
      '  <label class="field">Target audience',
      '    <input id="competitiveTargetAudience" type="text" placeholder="e.g. ML theory, optimization, algorithms" />',
      '  </label>',
      '</div>',
      '<div class="competitive-mode-box">',
      '  <div class="competitive-mode-title">Comparison mode</div>',
      '  <label><input data-competitive-mode="novelty" type="checkbox" checked /> novelty</label>',
      '  <label><input data-competitive-mode="clarity" type="checkbox" checked /> clarity</label>',
      '  <label><input data-competitive-mode="technical depth" type="checkbox" checked /> technical depth</label>',
      '  <label><input data-competitive-mode="positioning" type="checkbox" checked /> positioning</label>',
      '  <label><input data-competitive-mode="related work" type="checkbox" checked /> related work</label>',
      '  <label><input data-competitive-mode="overall competitiveness" type="checkbox" checked /> overall competitiveness</label>',
      '</div>',
      '<label class="field">Extra instructions',
      '  <textarea id="competitiveExtraInstructions" rows="3" placeholder="Optional: be extremely critical, focus on theorem statement, improve intro, etc."></textarea>',
      '</label>',
      '<div class="competitive-review-actions competitive-step-actions">',
      '  <button id="checkCompetitiveWebSearchBtn" class="btn mini" type="button">Check web search</button>',
      '  <button id="fetchCompetitivePapersBtn" class="btn mini" type="button">Research competitor papers</button>',
      '  <button id="rankCompetitivePapersBtn" class="btn mini" type="button">Rank competitors</button>',
      '  <button id="compareCompetitiveDraftBtn" class="btn mini" type="button">Compare my draft</button>',
      '  <button id="generateCompetitiveRoadmapBtn" class="btn mini primary" type="button">Generate roadmap</button>',
      '  <button id="runCompetitiveReviewBtn" class="btn mini" type="button">Run full review</button>',
      '  <button id="copyCompetitiveReviewBtn" class="btn mini" type="button">Copy report</button>',
      '  <button id="addCompetitiveReviewBtn" class="btn mini" type="button">Add report to /reviews</button>',
      '  <button id="insertCompetitiveInlineLaiBtn" class="btn mini" type="button">Insert \lai edits at matches</button>',
      '  <button id="insertCompetitiveRoadmapBtn" class="btn mini" type="button">Append \lai plan</button>',
      '</div>',
      '<div class="settings-note">Stage 18C uses an AI web-research agent: URLs are research seeds, not PDFs to extract. The workflow builds competitor profiles, ranks competitors, compares the draft, and generates a roadmap. Reports stay in <code>/reviews</code>; actionable edits still use the Paper-level <code>\lai</code>/<code>\laiold</code> review queue.</div>',
      '<div id="competitiveReviewStatus" class="settings-note">Competitive review ready.</div>',
      '<pre id="competitiveReviewOutput" class="competitive-review-output"></pre>'
    ].join('');

    panel.appendChild(card);

    el('addCompetitiveUrlBtn')?.addEventListener('click', appendCompetitorUrlFromInput, true);
    el('competitiveAddUrlInput')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); appendCompetitorUrlFromInput(); } }, true);
    el('checkCompetitiveWebSearchBtn')?.addEventListener('click', checkWebSearchCapability, true);
    el('fetchCompetitivePapersBtn')?.addEventListener('click', researchCompetitorPapers, true);
    el('rankCompetitivePapersBtn')?.addEventListener('click', rankCompetitorPapers, true);
    el('compareCompetitiveDraftBtn')?.addEventListener('click', compareDraftAgainstRankedSet, true);
    el('generateCompetitiveRoadmapBtn')?.addEventListener('click', generateImprovementRoadmap, true);
    el('runCompetitiveReviewBtn')?.addEventListener('click', runCompetitiveReview, true);
    el('copyCompetitiveReviewBtn')?.addEventListener('click', copyReport, true);
    el('addCompetitiveReviewBtn')?.addEventListener('click', addReportToProject, true);
    el('insertCompetitiveInlineLaiBtn')?.addEventListener('click', insertActionableEditsAtMatches, true);
    el('insertCompetitiveRoadmapBtn')?.addEventListener('click', appendLaiImprovementPlan, true);

    return true;
  }

  function init() {
    createCard();
  }

  NS.CompetitivePaperReviewService = {
    STAGE,
    init,
    buildPayload,
    validatePayload,
    checkWebSearchCapability,
    requireWebSearch,
    researchCompetitorPapers,
    rankCompetitorPapers,
    compareDraftAgainstRankedSet,
    generateImprovementRoadmap,
    runCompetitiveReview,
    addReportToProject,
    insertRoadmapComment,
    appendLaiImprovementPlan,
    insertActionableEditsAtMatches,
    extractActionableEdits,
    getLastReport: () => lastReport,
    getLastPayload: () => lastPayload,
    getLastCompetitorSummaries: () => lastCompetitorSummaries,
    getLastRankingReport: () => lastRankingReport,
    getLastComparisonReport: () => lastComparisonReport
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  setTimeout(createCard, 900);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

/* Latexai Stage 18X6 ReviewerRebuttalSimulatorService
 * Stage: stage18x6-memory-cors-ipad-fetch-fix-20260524-1
 *
 * Foundation workflow:
 * - user chooses 2-4 configurable reviewers;
 * - each reviewer reviews all major aspects through their chosen style/expertise;
 * - user adds rebuttal guidance;
 * - AI generates a rebuttal;
 * - AI synthesizes a final revision plan / final paper rewrite proposal.
 *
 * No memory UI. No automatic source overwrite.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage18x6-memory-cors-ipad-fetch-fix-20260524-1';

  // Stage 18Q5: this feature is intentionally loaded as a core visible card.
  // Do not allow stale optional-script safe-mode flags to suppress it silently.
  try {
    if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('reviewer-rebuttal-simulator-service')) {
      (W.LUMINA_LATEX_BOOT_WARNINGS = W.LUMINA_LATEX_BOOT_WARNINGS || []).push('Safe-mode wanted to disable reviewer/rebuttal simulator, but Stage 18Q5 keeps it visible.');
    }
  } catch (_ignoredSafeMode) {}

  let lastPayload = null;
  let lastReviews = [];
  let lastRebuttal = '';
  let lastSynthesis = '';
  let cancelled = false;

  function State() { return NS.State; }
  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function normalizePath(path) {
    try { return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
    catch (_err) { return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
  }

  function project() { return State()?.state?.project || {}; }
  function files() { return project().files || []; }
  function fileText(file) { return String(file?.text ?? file?.content ?? file?.source ?? file?.value ?? ''); }
  function getFile(path) {
    const normalized = normalizePath(path);
    try { const found = State()?.getFile?.(normalized); if (found) return found; } catch (_err) {}
    return files().find((file) => normalizePath(file.path) === normalized) || null;
  }
  function rootPath() {
    const p = project();
    return normalizePath(p.rootFile || files().find((file) => /main\.tex$/i.test(file.path || ''))?.path || 'main.tex');
  }
  function activePath() {
    const candidates = [State()?.state?.activePath, State()?.state?.activeFilePath, State()?.state?.currentPath, project()?.activePath, project()?.activeFilePath, rootPath()];
    return normalizePath(candidates.find(Boolean) || 'main.tex');
  }
  function activeSource() {
    let path = activePath();
    let file = getFile(path);
    if (!file) { path = rootPath(); file = getFile(path); }
    return { path, text: fileText(file) };
  }
  function draftExcerpt(text, maxChars = 55000) {
    const s = String(text || '');
    if (s.length <= maxChars) return s;
    const head = s.slice(0, Math.floor(maxChars * 0.68));
    const tail = s.slice(-Math.floor(maxChars * 0.32));
    return `${head}\n\n% ... [middle omitted for reviewer/rebuttal simulator prompt] ...\n\n${tail}`;
  }

  function currentProviderModel() {
    return { provider: clean(el('aiProvider')?.value || 'openai'), model: clean(el('aiModel')?.value || 'gpt-4.1-mini') };
  }


  const MEMORY_ENABLED_KEY = 'latexai:memory-enabled';
  let lastMemoryContextByStep = {};

  function memoryEnabled() {
    try { return String(W.localStorage?.getItem?.(MEMORY_ENABLED_KEY) || 'true') !== 'false'; }
    catch (_err) { return true; }
  }

  function stableHash(value) {
    const str = String(value || '');
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  function stripLatexForIdentity(value) {
    return String(value || '')
      .replace(/%.*$/gm, ' ')
      .replace(/\\(texorpdfstring|textbf|textit|emph|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g, '$2')
      .replace(/\\[a-zA-Z@]+\*?(?:\[[^\]]*\])?/g, ' ')
      .replace(/[{}$]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractLatexTitle(text) {
    const s = String(text || '');
    const match = s.match(/\\title\s*(?:\[[^\]]*\])?\s*\{([\s\S]{0,500}?)\}/);
    return stripLatexForIdentity(match ? match[1] : '').slice(0, 180);
  }

  function projectSourceSnapshot() {
    const p = project() || {};
    const texFiles = (files() || [])
      .filter((file) => /\.tex$/i.test(String(file?.path || '')))
      .sort((a, b) => String(a.path || '').localeCompare(String(b.path || '')));
    const active = activeSource();
    const root = rootPath();
    const rootFile = getFile(root);
    const rootText = normalizePath(active?.path) === normalizePath(root) && active?.text ? active.text : fileText(rootFile);
    const titleGuess = extractLatexTitle(rootText) || extractLatexTitle(active?.text || '');
    const pieces = texFiles.map((file) => `${normalizePath(file.path)}\n${fileText(file)}`).join('\n\n---LATEXAI-FILE---\n\n');
    const sourceCorpus = pieces || String(active?.text || rootText || '');
    const projectLabel = clean(p.id || p.projectId || p.name || p.title || root || W.location?.pathname || 'local-latexai-project');
    const sourceHash = stableHash(sourceCorpus);
    const fallbackClue = stableHash(String(rootText || sourceCorpus).slice(0, 12000));
    const documentFingerprint = stableHash([projectLabel, root, titleGuess || fallbackClue].join('\n'));
    return {
      projectLabel,
      rootPath: root,
      activePath: active?.path || activePath(),
      titleGuess: titleGuess || '',
      documentFingerprint,
      sourceHash,
      texFileCount: texFiles.length,
      sourceBytes: sourceCorpus.length
    };
  }

  function storedScopedId(kind, deterministicKey) {
    const key = `latexai:memory:${kind}:id:${stableHash(deterministicKey)}`;
    try {
      const existing = W.localStorage?.getItem?.(key);
      if (existing) return existing;
      const id = `${kind}-${stableHash(deterministicKey)}`;
      W.localStorage?.setItem?.(key, id);
      return id;
    } catch (_err) {
      return `${kind}-${stableHash(deterministicKey)}`;
    }
  }

  function toMemoryUrl(raw) {
    if (NS.BackendUrlSettings?.normalizeMemoryApiBase) return NS.BackendUrlSettings.normalizeMemoryApiBase(raw);
    try {
      const url = new URL(raw || 'https://lumina-latex-backend-zugntkn2la-ue.a.run.app', W.location.href);
      url.search = '';
      url.hash = '';
      url.pathname = url.pathname
        .replace(/\/api\/lumina\/latex\/compile(?:\/jobs)?\/?$/i, '/api/lumina/memory')
        .replace(/\/api\/lumina\/ai(?:\/status|\/workflows|\/models)?\/?$/i, '/api/lumina/memory')
        .replace(/\/api\/lumina\/models\/?$/i, '/api/lumina/memory')
        .replace(/\/api\/lumina\/memory(?:\/.+)?$/i, '/api/lumina/memory');
      if (!/\/api\/lumina\/memory\/?$/i.test(url.pathname)) url.pathname = url.pathname.replace(/\/+$/, '') + '/api/lumina/memory';
      return url.href.replace(/\/$/, '');
    } catch (_err) {
      return 'https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/memory';
    }
  }

  function memoryBaseUrl() {
    if (NS.BackendUrlSettings?.getMemoryApiBaseUrl) return NS.BackendUrlSettings.getMemoryApiBaseUrl();
    const stored = (() => { try { return clean(W.localStorage?.getItem?.('lumina-latex.memory.backendUrl')); } catch (_err) { return ''; } })();
    const raw = clean(el('memoryBackendUrl')?.value) || stored || 'https://lumina-latex-backend-zugntkn2la-ue.a.run.app';
    return toMemoryUrl(raw);
  }

  function memoryHeaders(options = {}) {
    const headers = {};
    const token = NS.BackendUrlSettings?.getMemoryProxyToken?.() || clean(el('memoryProxyToken')?.value);
    if (token) headers.Authorization = `Bearer ${token}`;
    const method = clean(options.method || 'GET').toUpperCase();
    const hasBody = options.body !== undefined && options.body !== null;
    if (hasBody || method !== 'GET') headers['Content-Type'] = 'application/json';
    return headers;
  }

  function projectIdentity() {
    const snapshot = projectSourceSnapshot();
    const projectKey = snapshot.projectLabel || snapshot.rootPath || 'local-latexai-project';
    const paperKey = [projectKey, snapshot.rootPath, snapshot.documentFingerprint].join('\n');
    let sessionId = '';
    try {
      sessionId = W.sessionStorage?.getItem?.('latexai:memory-session-id') || '';
      if (!sessionId) {
        sessionId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        W.sessionStorage?.setItem?.('latexai:memory-session-id', sessionId);
      }
    } catch (_err) { sessionId = `sess-${stableHash(String(Date.now()))}`; }
    const projectId = storedScopedId('project', projectKey);
    const paperId = storedScopedId('paper', paperKey);
    const sectionId = snapshot.activePath ? `section-${stableHash([paperId, snapshot.activePath].join(':'))}` : undefined;
    return {
      userId: 'local-user',
      projectId,
      paperId,
      sectionId,
      sessionId,
      rootPath: snapshot.rootPath,
      activePath: snapshot.activePath,
      titleGuess: snapshot.titleGuess,
      documentFingerprint: snapshot.documentFingerprint,
      sourceHash: snapshot.sourceHash,
      identityMetadata: {
        identityStage: 'stage18x6-memory-cors-ipad-fetch-fix',
        projectLabel: snapshot.projectLabel,
        titleGuess: snapshot.titleGuess,
        documentFingerprint: snapshot.documentFingerprint,
        sourceHash: snapshot.sourceHash,
        rootPath: snapshot.rootPath,
        activePath: snapshot.activePath,
        texFileCount: snapshot.texFileCount,
        sourceBytes: snapshot.sourceBytes
      }
    };
  }

  async function registerMemoryScope(ids, reason = 'context', stepName = '') {
    if (!ids) return null;
    return memoryPost('/scope', {
      userId: ids.userId,
      projectId: ids.projectId,
      paperId: ids.paperId,
      sectionId: ids.sectionId,
      sessionId: ids.sessionId,
      scope: ids.sectionId ? 'section' : 'paper',
      documentFingerprint: ids.documentFingerprint,
      sourceHash: ids.sourceHash,
      titleGuess: ids.titleGuess,
      rootPath: ids.rootPath,
      activePath: ids.activePath,
      metadata: { stage: STAGE, reason, stepName, ...(ids.identityMetadata || {}) }
    });
  }


  async function memoryFetch(path, options = {}) {
    if (!memoryEnabled()) return null;
    try {
      const response = await fetch(`${memoryBaseUrl()}${path}`, { ...options, headers: { ...memoryHeaders(options), ...(options.headers || {}) } });
      const text = await response.text().catch(() => '');
      let json = {};
      try { json = text ? JSON.parse(text) : {}; } catch (_err) { json = { raw: text }; }
      if (!response.ok || json.ok === false) throw new Error(json?.detail || json?.error?.message || `HTTP ${response.status}`);
      return json;
    } catch (err) {
      try { console.warn('[Latexai reviewer memory] non-blocking request failed', path, err); } catch (_ignored) {}
      return null;
    }
  }

  function memoryPost(path, payload) {
    return memoryFetch(path, { method: 'POST', body: JSON.stringify(payload || {}) });
  }

  function memorySemanticQuery(stepName, extraText = '') {
    const src = activeSource();
    const excerpt = String(src?.text || src?.content || '').slice(0, 8000);
    return [stepName, activePath(), extraText, excerpt].filter(Boolean).join('\n');
  }

  async function loadReviewerMemoryContext(stepName, limit = 10, queryText = '') {
    const ids = projectIdentity();
    await registerMemoryScope(ids, 'context', stepName);
    const qs = new URLSearchParams({ userId: ids.userId, projectId: ids.projectId, paperId: ids.paperId, sessionId: ids.sessionId, task: stepName, limit: String(limit) });
    const q = memorySemanticQuery(stepName, queryText);
    if (q) qs.set('q', q.slice(0, 12000));
    if (ids.sectionId) qs.set('sectionId', ids.sectionId);
    const json = await memoryFetch(`/context?${qs.toString()}`);
    const ctx = json?.context || { facts: [], summaries: [], graphEdges: [] };
    lastMemoryContextByStep[stepName] = ctx;
    return ctx;
  }

  function memoryContextMarkdown(ctx) {
    const facts = Array.isArray(ctx?.facts) ? ctx.facts.slice(0, 10) : [];
    const summaries = Array.isArray(ctx?.summaries) ? ctx.summaries.slice(0, 3) : [];
    const graphEdges = Array.isArray(ctx?.graphEdges) ? ctx.graphEdges.slice(0, 8) : [];
    if (!facts.length && !summaries.length && !graphEdges.length) return '';
    const lines = [
      '--- Hidden Latexai project memory context ---',
      'Use these backend memories silently to improve this reviewer/rebuttal simulation. Treat them as project context, not as user-facing content. Do not mention the memory system unless explicitly asked.',
      'Respect stable notation/preferences, use prior reviewer concerns when relevant, and avoid directions previously rejected by the user.'
    ];
    summaries.forEach((sum) => {
      const content = String(sum.content || '').replace(/\s+/g, ' ').trim();
      if (content) lines.push(`Project ${sum.summary_type || sum.summaryType || 'summary'}: ${content.slice(0, 1200)}`);
    });
    facts.forEach((fact, i) => {
      const kind = fact.fact_type || fact.factType || fact.key || 'memory';
      const value = String(fact.value || fact.content || '').replace(/\s+/g, ' ').trim();
      const score = fact.retrievalScore != null ? `; score=${Number(fact.retrievalScore).toFixed(3)}` : '';
      const uses = fact.use_count || fact.useCount || 0;
      const success = fact.successful_use_count || fact.successfulUseCount || 0;
      if (value) lines.push(`M${i + 1} [${kind}; uses=${uses}; success=${success}${score}]: ${value.slice(0, 700)}`);
    });
    if (graphEdges.length) {
      lines.push('Related memory graph edges:');
      graphEdges.forEach((edge, i) => {
        const rel = edge.relation || 'related_to';
        const weight = edge.weight != null ? Number(edge.weight).toFixed(2) : '0.50';
        const evidence = String(edge.evidence || '').replace(/\s+/g, ' ').trim();
        lines.push(`G${i + 1} [${rel}; weight=${weight}]: ${edge.from_memory_id || edge.fromMemoryId || '?'} -> ${edge.to_memory_id || edge.toMemoryId || '?'}${evidence ? `; ${evidence.slice(0, 220)}` : ''}`);
      });
    }
    return lines.join('\n');
  }

  async function markMemoryUse(stepName, outcome, note = '') {
    const facts = Array.isArray(lastMemoryContextByStep[stepName]?.facts) ? lastMemoryContextByStep[stepName].facts : [];
    await Promise.all(facts.slice(0, 8).map((fact) => memoryPost('/use', {
      memoryId: fact.id,
      taskType: stepName,
      agentId: 'reviewer-rebuttal-simulator',
      outcome: outcome || 'used',
      note,
      metadata: { stage: STAGE }
    })));
  }

  function summarizeMemoryText(text, max = 1400) {
    return String(text || '').replace(/```[\s\S]*?```/g, '[structured block omitted]').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  async function saveReviewerMemory(stepName, content, payload = null, extra = {}) {
    if (!memoryEnabled() || !String(content || '').trim()) return null;
    const ids = projectIdentity();
    const base = {
      userId: ids.userId,
      projectId: ids.projectId,
      paperId: ids.paperId,
      sessionId: ids.sessionId,
      source: 'reviewer-rebuttal-simulator-service',
      metadata: {
        stage: STAGE,
        stepName,
        ...(ids.identityMetadata || {}),
        targetVenue: payload?.targetVenue || clean(el('reviewerSimVenue')?.value),
        paperGoal: payload?.paperGoal || clean(el('reviewerSimGoal')?.value),
        reviewerCount: payload?.reviewers?.length || selectedReviewers().length,
        ...extra
      }
    };
    const event = await memoryPost('/event', { ...base, eventType: `reviewer_rebuttal_${stepName}`, content: summarizeMemoryText(content, 3000) });
    const fact = await memoryPost('/fact', {
      ...base,
      scope: 'paper',
      factType: `reviewer_rebuttal_${stepName}`,
      key: `reviewer-rebuttal:${stepName}:${stableHash(content)}`,
      value: summarizeMemoryText(content, 1800),
      confidence: 0.78,
      importance: stepName === 'final_synthesis' ? 0.9 : 0.78,
      status: 'active'
    });
    await memoryPost('/summary', {
      ...base,
      scope: 'paper',
      summaryType: 'reviewer_rebuttal_state',
      content: [`Latest reviewer/rebuttal step: ${stepName}.`, payload?.targetVenue ? `Target venue: ${payload.targetVenue}.` : '', payload?.paperGoal ? `Paper goal: ${payload.paperGoal}.` : '', summarizeMemoryText(content, 1600)].filter(Boolean).join('\n')
    });
    if (event?.id && fact?.id) await memoryPost('/edge', { fromMemoryId: fact.id, toMemoryId: event.id, relation: 'derived_from_event', weight: 0.9, evidence: `Reviewer/rebuttal simulator ${stepName}`, metadata: { stage: STAGE } });
    let workingFact = null;
    if (stepName === 'final_synthesis') {
      workingFact = await memoryPost('/fact', {
        ...base,
        scope: 'working',
        factType: 'reviewer_rebuttal_working_memory',
        key: `working:reviewer-rebuttal:${stableHash(content)}`,
        value: summarizeMemoryText(content, 1200),
        confidence: 0.74,
        importance: 0.92,
        status: 'active'
      });
      if (workingFact?.id && fact?.id) await memoryPost('/edge', { fromMemoryId: workingFact.id, toMemoryId: fact.id, relation: 'working_cache_of', weight: 0.84, evidence: 'Promoted final reviewer/rebuttal synthesis into active working memory for later agent calls.', metadata: { stage: STAGE } });
    }
    return { event, fact, workingFact };
  }

  function setStatus(message) { const node = el('reviewerRebuttalStatus'); if (node) node.textContent = message; }
  function setOutput(text) { const node = el('reviewerRebuttalOutput'); if (node) node.textContent = text || ''; }

  async function askAI(instructions, input, maxOutputTokens = 5000, temperature = 0.25, task = 'latexai-reviewer-rebuttal-simulator') {
    if (!NS.AIProvider?.ask) throw new Error('AIProvider is not loaded. Check feature flags and safe mode.');
    const pm = currentProviderModel();
    const response = await NS.AIProvider.ask({
      instructions,
      input,
      provider: pm.provider,
      model: pm.model,
      maxOutputTokens,
      temperature,
      stage: STAGE
    }, {
      task,
      routeKey: 'paper-review-rebuttal',
      provider: pm.provider,
      model: pm.model,
      context: { workflow: 'reviewer-rebuttal-simulator', stage: STAGE }
    });
    return NS.AIProvider.extractText ? NS.AIProvider.extractText(response) : String(response || '');
  }

  function reviewerDefaults() {
    return [
      { name: 'Reviewer 1', style: 'Very critical mathematical/theoretical reviewer; checks correctness, assumptions, theorem statements, proof gaps, and novelty.' },
      { name: 'Reviewer 2', style: 'Broad ML/AI reviewer; checks novelty, positioning, clarity, related work, and significance.' },
      { name: 'Reviewer 3', style: 'Empirical/reproducibility reviewer; checks experiments, baselines, evaluation claims, and missing ablations.' },
      { name: 'Reviewer 4', style: 'Writing and venue-fit reviewer; checks narrative, readability, contribution framing, and acceptance risks.' }
    ];
  }

  function syncReviewerRows() {
    const count = Math.max(2, Math.min(4, Number(el('reviewerSimCount')?.value || 3)));
    const holder = el('reviewerSimRows');
    if (!holder) return;
    const defaults = reviewerDefaults();
    const existing = [];
    for (let i = 0; i < 4; i += 1) {
      existing.push({ name: clean(el(`reviewerSimName${i}`)?.value), style: clean(el(`reviewerSimStyle${i}`)?.value) });
    }
    holder.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
      const row = D.createElement('div');
      row.className = 'devils-agent-row reviewer-sim-row';
      row.innerHTML = [
        `<div class="devils-agent-title">Reviewer ${i + 1}</div>`,
        `<label>Name <input id="reviewerSimName${i}" type="text" value="${escapeHtml(existing[i]?.name || defaults[i].name)}" /></label>`,
        `<label>Reviewer style / expertise <textarea id="reviewerSimStyle${i}" rows="3">${escapeHtml(existing[i]?.style || defaults[i].style)}</textarea></label>`
      ].join('');
      holder.appendChild(row);
    }
  }

  function selectedReviewers() {
    const count = Math.max(2, Math.min(4, Number(el('reviewerSimCount')?.value || 3)));
    const defaults = reviewerDefaults();
    return Array.from({ length: count }, (_, i) => ({
      index: i + 1,
      name: clean(el(`reviewerSimName${i}`)?.value) || defaults[i].name,
      style: clean(el(`reviewerSimStyle${i}`)?.value) || defaults[i].style
    }));
  }

  function buildPayload() {
    const active = activeSource();
    return {
      schema: 'latexai-reviewer-rebuttal-simulator-request-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      activePath: active.path,
      rootPath: rootPath(),
      targetVenue: clean(el('reviewerSimVenue')?.value),
      paperGoal: clean(el('reviewerSimGoal')?.value),
      globalInstructions: clean(el('reviewerSimInstructions')?.value),
      rebuttalGuidance: clean(el('reviewerSimRebuttalGuidance')?.value),
      reviewers: selectedReviewers(),
      draftExcerpt: draftExcerpt(active.text)
    };
  }

  function validatePayload(payload) {
    const errors = [];
    if (!payload.draftExcerpt.trim()) errors.push('Active source file is empty.');
    if (payload.reviewers.length < 2 || payload.reviewers.length > 4) errors.push('Choose between 2 and 4 reviewers.');
    return errors;
  }

  function reviewsMarkdown() {
    const lines = [];
    for (const item of lastReviews || []) {
      lines.push(`## ${item.name}`);
      lines.push('');
      lines.push(item.text || '');
      lines.push('');
    }
    return lines.join('\n');
  }

  function fullReport() {
    const payload = lastPayload || buildPayload();
    return [
      '# Reviewer / rebuttal simulator',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Stage: ${STAGE}`,
      `Active file: ${payload.activePath}`,
      `Target venue: ${payload.targetVenue || '(not specified)'}`,
      `Paper goal: ${payload.paperGoal || '(not specified)'}`,
      '',
      '## Reviewers',
      '',
      ...(payload.reviewers || []).map((r) => `- ${r.name}: ${r.style}`),
      '',
      '## Reviews',
      '',
      reviewsMarkdown() || '(not generated yet)',
      '',
      '## User rebuttal guidance',
      '',
      clean(el('reviewerSimRebuttalGuidance')?.value) || payload.rebuttalGuidance || '(none)',
      '',
      '## AI rebuttal',
      '',
      lastRebuttal || '(not generated yet)',
      '',
      '## Final synthesis / revision proposal',
      '',
      lastSynthesis || '(not generated yet)'
    ].join('\n');
  }

  async function runReviews() {
    cancelled = false;
    lastReviews = [];
    lastRebuttal = '';
    lastSynthesis = '';
    const payload = buildPayload();
    const errors = validatePayload(payload);
    if (errors.length) { setStatus(errors.join(' ')); setOutput(`Cannot run reviews:\n\n${errors.map((e) => `- ${e}`).join('\n')}`); return { ok: false, errors }; }
    lastPayload = payload;
    setOutput(fullReport());

    try {
      for (const reviewer of payload.reviewers) {
        if (cancelled) throw new Error('Review simulation cancelled.');
        setStatus(`${reviewer.name} is reviewing the paper...`);
        const instructions = [
          'You are an AI reviewer in a simulated academic review panel for a LaTeX research paper.',
          'You must review all key dimensions: correctness, clarity, novelty, significance, related work, assumptions, experiments/evidence, presentation, and venue fit.',
          `Reviewer identity/style: ${reviewer.name}: ${reviewer.style}`,
          'Be specific and actionable. Refer to sections/theorems/equations when possible.',
          'Use a realistic academic-review structure: summary, strengths, weaknesses, questions for authors, required changes, minor issues, score/confidence.',
          'Do not produce a rebuttal. Do not rewrite the paper yet.',
          payload.globalInstructions ? `Extra global instructions: ${payload.globalInstructions}` : ''
        ].filter(Boolean).join('\n');
        const input = [
          '--- Paper metadata ---',
          JSON.stringify({ targetVenue: payload.targetVenue, paperGoal: payload.paperGoal, activePath: payload.activePath }, null, 2),
          '',
          '--- Draft excerpt ---',
          payload.draftExcerpt
        ].join('\n');
        const stepName = `simulated_review_${reviewer.index}`;
        const memoryContext = await loadReviewerMemoryContext(stepName, 10, `${reviewer.name} ${reviewer.style}\n${instructions}\n${input}`);
        const memoryBlock = memoryContextMarkdown(memoryContext);
        const text = await askAI(
          memoryBlock ? `${instructions}

${memoryBlock}` : instructions,
          memoryBlock ? `${memoryBlock}

${input}` : input,
          4500,
          0.3,
          'latexai-simulated-reviewer'
        );
        lastReviews.push({ ...reviewer, text: text.trim() });
        await markMemoryUse(stepName, text && text.trim() ? 'success' : 'used', text && text.trim() ? `${reviewer.name} completed review with memory context.` : `${reviewer.name} returned empty review.`);
        await saveReviewerMemory('simulated_review', text, payload, { reviewerName: reviewer.name, reviewerStyle: reviewer.style, reviewerIndex: reviewer.index });
        setOutput(fullReport());
      }
      setStatus('Reviewer simulation complete. Add rebuttal guidance, then generate rebuttal.');
      return { ok: true, reviews: lastReviews, payload };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Reviewer simulation stopped: ${message}`);
      setOutput(fullReport());
      return { ok: false, error: message, reviews: lastReviews, payload };
    }
  }

  async function generateRebuttal() {
    const payload = lastPayload || buildPayload();
    if (!lastReviews.length) await runReviews();
    if (!lastReviews.length) return { ok: false, error: 'No reviews available.' };
    payload.rebuttalGuidance = clean(el('reviewerSimRebuttalGuidance')?.value);
    lastPayload = payload;
    setStatus('Generating AI rebuttal to simulated reviews...');
    const instructions = [
      'You are generating an author rebuttal to a set of simulated paper reviews.',
      'Be respectful, precise, and strategic. Defend the paper where appropriate, concede real weaknesses, and propose concrete revisions.',
      'Use the user rebuttal guidance when present, but do not make unsupported claims.',
      'Structure the rebuttal by major concern and by reviewer when useful.',
      'Include explicit commitments for paper revisions.'
    ].join('\n');
    const input = [
      '--- Paper metadata ---', JSON.stringify({ targetVenue: payload.targetVenue, paperGoal: payload.paperGoal }, null, 2), '',
      '--- User rebuttal guidance ---', payload.rebuttalGuidance || '(none)', '',
      '--- Reviews ---', reviewsMarkdown(), '',
      '--- Draft excerpt ---', payload.draftExcerpt
    ].join('\n');
    try {
      const stepName = 'review_rebuttal';
      const memoryContext = await loadReviewerMemoryContext(stepName, 12, `${instructions}\n${input}`);
      const memoryBlock = memoryContextMarkdown(memoryContext);
      lastRebuttal = (await askAI(
        memoryBlock ? `${instructions}

${memoryBlock}` : instructions,
        memoryBlock ? `${memoryBlock}

${input}` : input,
        5000,
        0.2,
        'latexai-review-rebuttal'
      )).trim();
      await markMemoryUse(stepName, lastRebuttal ? 'success' : 'used', lastRebuttal ? 'Rebuttal completed with memory context.' : 'Rebuttal returned empty text.');
      await saveReviewerMemory('rebuttal', lastRebuttal, payload);
      setOutput(fullReport());
      setStatus('AI rebuttal complete.');
      return { ok: true, rebuttal: lastRebuttal };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Rebuttal failed: ${message}`);
      setOutput(fullReport());
      return { ok: false, error: message };
    }
  }

  async function synthesizeFinalRevision() {
    const payload = lastPayload || buildPayload();
    if (!lastReviews.length) await runReviews();
    if (!lastRebuttal) await generateRebuttal();
    setStatus('Synthesizing final revision plan and paper rewrite proposal...');
    const instructions = [
      'You are the final synthesis agent for a paper revision workflow.',
      'Use the simulated reviews, user guidance, and AI rebuttal to propose the strongest final revision.',
      'Return Markdown with: executive summary, accepted reviewer points, rejected/defended points, prioritized revision plan, and final revised-paper strategy.',
      'Also include a fenced code block labelled latexai_actionable_edits containing JSON:',
      '{"actionableEdits":[{"mode":"replace|insert_after|insert_before","path":"optional tex path","targetHint":"section/paragraph hint","oldText":"exact source substring or anchor","newText":"LaTeX replacement or insertion","confidence":0.0}],"appendPlan":"optional LaTeX plan"}.',
      'Use visible Latexai edit semantics: newText should be compatible with later \laiold/\lai insertion. Do not overwrite the entire source unless explicitly necessary.',
      'When hidden memory mentions successful paper edit patterns, notation preferences, rejected rewrite styles, or previously failed insertion anchors, use that information to choose more exact oldText anchors and avoid repeating failed edits.',
      'If a suggestion cannot be localized exactly, put it in appendPlan rather than fabricating oldText.',
      'Avoid preamble edits, Markdown inside LaTeX, and invented exact oldText strings.'
    ].join('\n');
    const input = [
      '--- Paper metadata ---', JSON.stringify({ targetVenue: payload.targetVenue, paperGoal: payload.paperGoal, activePath: payload.activePath }, null, 2), '',
      '--- Reviews ---', reviewsMarkdown(), '',
      '--- User rebuttal guidance ---', clean(el('reviewerSimRebuttalGuidance')?.value) || '(none)', '',
      '--- AI rebuttal ---', lastRebuttal || '(none)', '',
      '--- Draft excerpt ---', payload.draftExcerpt
    ].join('\n');
    try {
      const stepName = 'final_synthesis';
      const memoryContext = await loadReviewerMemoryContext(stepName, 14, `${instructions}\n${input}`);
      const memoryBlock = memoryContextMarkdown(memoryContext);
      lastSynthesis = (await askAI(
        memoryBlock ? `${instructions}

${memoryBlock}` : instructions,
        memoryBlock ? `${memoryBlock}

${input}` : input,
        6500,
        0.2,
        'latexai-final-review-synthesis'
      )).trim();
      await markMemoryUse(stepName, lastSynthesis ? 'success' : 'used', lastSynthesis ? 'Final synthesis completed with memory context.' : 'Final synthesis returned empty text.');
      await saveReviewerMemory('final_synthesis', lastSynthesis, payload);
      setOutput(fullReport());
      setStatus('Final synthesis complete.');
      return { ok: true, synthesis: lastSynthesis };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Final synthesis failed: ${message}`);
      setOutput(fullReport());
      return { ok: false, error: message };
    }
  }

  async function runFullLoop() {
    await runReviews();
    if (cancelled) return;
    await generateRebuttal();
    if (cancelled) return;
    await synthesizeFinalRevision();
  }

  function cancelLoop() { cancelled = true; setStatus('Cancel requested. Current AI call may finish before stopping.'); }

  async function copyReport() {
    const text = fullReport();
    try { await navigator.clipboard.writeText(text); setStatus('Reviewer/rebuttal report copied.'); }
    catch (_err) { setOutput(text); setStatus('Could not copy automatically; report is shown below.'); }
  }

  function bindCardEvents() {
    syncReviewerRows();
    el('reviewerSimCount')?.addEventListener('change', syncReviewerRows, true);
    el('runReviewerSimBtn')?.addEventListener('click', runReviews, true);
    el('generateReviewerRebuttalBtn')?.addEventListener('click', generateRebuttal, true);
    el('synthesizeReviewerFinalBtn')?.addEventListener('click', synthesizeFinalRevision, true);
    el('runReviewerFullLoopBtn')?.addEventListener('click', runFullLoop, true);
    el('cancelReviewerSimBtn')?.addEventListener('click', cancelLoop, true);
    el('copyReviewerSimBtn')?.addEventListener('click', copyReport, true);
    setStatus('Reviewer/rebuttal simulator ready.');
    return true;
  }

  function createCard() {
    const existing = el('reviewerRebuttalCard');
    if (existing) return bindCardEvents();
    const panel = el('copilotTab') || el('settingsTab') || D.querySelector('.right-panel');
    if (!panel) return false;
    const card = D.createElement('div');
    card.id = 'reviewerRebuttalCard';
    card.className = 'devils-debate-card reviewer-rebuttal-card';
    card.innerHTML = [
      '<div class="section-head compact"><div><div class="smallcaps">Paper AI</div><h2>Reviewer / rebuttal simulator</h2></div></div>',
      '<p class="devils-help">Simulate 2–4 configurable reviewers, write a rebuttal with your guidance, then synthesize a final revision plan.</p>',
      '<div class="field-grid two">',
      '  <label class="field">Reviewer count <select id="reviewerSimCount"><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option></select></label>',
      '  <label class="field">Target venue <input id="reviewerSimVenue" type="text" placeholder="e.g. NeurIPS, COLT, JMLR" /></label>',
      '</div>',
      '<label class="field">Paper goal / intended contribution <input id="reviewerSimGoal" type="text" placeholder="Optional: what the paper is trying to establish" /></label>',
      '<label class="field">Global review instructions <textarea id="reviewerSimInstructions" rows="2" placeholder="Optional: ask reviewers to be very critical, focus on theory, compare to a venue, etc."></textarea></label>',
      '<div id="reviewerSimRows" class="devils-agent-grid"></div>',
      '<label class="field">Your rebuttal guidance after reading reviews <textarea id="reviewerSimRebuttalGuidance" rows="3" placeholder="Optional: tell the rebuttal agent what to concede, defend, emphasize, or promise to revise."></textarea></label>',
      '<div class="devils-actions">',
      '  <button id="runReviewerSimBtn" class="btn mini primary" type="button">Run reviews</button>',
      '  <button id="generateReviewerRebuttalBtn" class="btn mini" type="button">Generate rebuttal</button>',
      '  <button id="synthesizeReviewerFinalBtn" class="btn mini" type="button">Synthesize final revision</button>',
      '  <button id="runReviewerFullLoopBtn" class="btn mini" type="button">Run full loop</button>',
      '  <button id="cancelReviewerSimBtn" class="btn mini" type="button">Cancel</button>',
      '  <button id="copyReviewerSimBtn" class="btn mini" type="button">Copy report</button>',
      '</div>',
      '<div class="settings-note">Stage 18X keeps reviewer/rebuttal memories scoped by stable project and paper identity. It produces reviews, rebuttal, and a final revision proposal; it does not overwrite source.</div>',
      '<div id="reviewerRebuttalStatus" class="settings-note">Reviewer/rebuttal simulator ready.</div>',
      '<pre id="reviewerRebuttalOutput" class="devils-output"></pre>'
    ].join('');
    panel.appendChild(card);
    return bindCardEvents();
  }

  function init() {
    if (createCard()) return true;
    try {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (createCard() || attempts >= 20) clearInterval(timer);
      }, 250);
    } catch (_err) {}
    return !!el('reviewerRebuttalCard');
  }

  NS.ReviewerRebuttalSimulatorService = {
    STAGE,
    init,
    runReviews,
    generateRebuttal,
    synthesizeFinalRevision,
    runFullLoop,
    cancelLoop,
    buildPayload,
    getLastReviews: () => lastReviews,
    getLastRebuttal: () => lastRebuttal,
    getLastSynthesis: () => lastSynthesis,
    getLastPayload: () => lastPayload
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  W.mountReviewerRebuttalSimulator = init;
  setTimeout(createCard, 300);
  setTimeout(createCard, 1200);
  setTimeout(createCard, 3000);
  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

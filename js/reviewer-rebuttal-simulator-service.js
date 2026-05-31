/* Latexai Stage 19T2X ReviewerRebuttalSimulatorService
 * Stage: stage19i6-reviewer-rebuttal-explicit-role-context-fix-20260526-1
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
  const STAGE = 'stage19t3a-unified-safe-edit-protocol-hardening-20260531-1';

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
  let reviewerDelegatedEventsBound = false;
  let reviewerWorkflowBusy = false;
  let reviewerStatusTimer = null;
  let trajectoryAgentRuns = [];
  let lastCompiledSynthesis = null;
  const AI_CALL_TIMEOUT_MS = 180000;

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


  function rawPatchPipeline() {
    return NS.LaiSafeEditPipelineService || null;
  }

  function rawPatchProtocolInstructions(goal) {
    return rawPatchPipeline()?.rawPatchProtocolInstructions?.({
      goal: goal || 'reviewer/rebuttal final paper edits',
      extra: 'Reviewer/rebuttal synthesis may include a Markdown explanation, but source edits must be LATEXAI_BLOCK_PATCH blocks. Do not output JSON edit schemas or Latexai internal change markers.'
    }) || 'Return source edits as LATEXAI_BLOCK_PATCH blocks, not JSON and not \\lai markup.';
  }

  async function compileReviewerSynthesis(rawText) {
    const pipe = rawPatchPipeline();
    if (!pipe?.compileRawPatch) return { ok: false, safeToInsert: false, error: 'LaiSafeEditPipelineService is not loaded.' };
    return await pipe.compileRawPatch({
      finalOutput: rawText,
      workflow: 'reviewer-rebuttal-final-synthesis',
      insertionMode: 'targeted',
      allowAiRepair: true,
      metadata: { reviewerRebuttalStage: STAGE, activePath: activePath() }
    });
  }

  async function applyReviewerCompiledSynthesis() {
    const pipe = rawPatchPipeline();
    if (!pipe?.applyCompiledDraft) return { ok: false, error: 'LaiSafeEditPipelineService is not loaded.' };
    if (!lastCompiledSynthesis) lastCompiledSynthesis = await compileReviewerSynthesis(lastSynthesis || fullReport());
    return pipe.applyCompiledDraft(lastCompiledSynthesis, { kind: 'targeted', preferRoot: true });
  }

  function reviewerCompilerReport(compiled) {
    return JSON.stringify({
      safeToInsert: compiled?.safeToInsert,
      blockCount: compiled?.blockCount || compiled?.compiledEditCount || 0,
      repairAttempted: compiled?.repairAttempted,
      repairStatus: compiled?.repairStatus,
      warnings: compiled?.warnings || [],
      validationErrors: compiled?.validationErrors || [],
      rejectedEdits: compiled?.rejectedEdits || []
    }, null, 2);
  }
  function draftExcerpt(text, maxChars = 55000) {
    const s = String(text || '');
    if (s.length <= maxChars) return s;
    const head = s.slice(0, Math.floor(maxChars * 0.68));
    const tail = s.slice(-Math.floor(maxChars * 0.32));
    return `${head}\n\n% ... [middle omitted for reviewer/rebuttal simulator prompt] ...\n\n${tail}`;
  }

  function currentProviderModel() {
    return { provider: clean(el('aiProvider')?.value || 'openai'), model: clean(el('aiModel')?.value || 'gpt-5.4-mini') };
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
    const gh = p.github || p.meta?.github || {};
    const githubLabel = gh?.owner && gh?.repo ? `github:${gh.owner}/${gh.repo}:${gh.branch || 'main'}:${gh.rootPath || ''}` : '';
    const projectLabel = clean(githubLabel || p.id || p.projectId || p.name || p.title || root || W.location?.pathname || 'local-latexai-project');
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
        identityStage: 'stage19i2-reviewer-rebuttal-role-context-fix',
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

  const RESEARCH_MEMORY_FOCUS_QUERIES = [
    {
      name: 'notation-citation',
      text: 'notation_sentence notation_macro_definition theorem_environment latex_label_inventory symbol meaning notation conflict theorem lemma equation label citation_keys_used citation_gap_or_related_work_memory competitor_reference_seeds bibliography related work'
    },
    {
      name: 'reviewer-negative',
      text: 'recurring_reviewer_concern proof_or_theorem_concern notation_or_symbol_concern negative_memory_candidate rejected idea failed rewrite previous reviewer criticism rebuttal concern synthesis edit pattern'
    }
  ];

  function memorySemanticQuery(stepName, extraText = '', focusText = '') {
    const src = activeSource();
    const excerpt = String(src?.text || src?.content || '').slice(0, 8000);
    const researchCues = [
      'Latexai research memory retrieval priority:',
      'notation_sentence notation_macro_definition theorem_environment latex_label_inventory',
      'citation_keys_used citation_gap_or_related_work_memory competitor_reference_seeds recurring_reviewer_concern negative_memory_candidate proof_or_theorem_concern',
      focusText
    ].filter(Boolean).join(' ');
    return [stepName, activePath(), researchCues, extraText, excerpt].filter(Boolean).join('\n');
  }

  function mergeMemoryContexts(contexts, limit = 24) {
    const merged = { facts: [], summaries: [], graphEdges: [] };
    const factIds = new Set();
    const summaryIds = new Set();
    const edgeIds = new Set();
    (contexts || []).filter(Boolean).forEach((ctx) => {
      (Array.isArray(ctx.facts) ? ctx.facts : []).forEach((fact) => {
        const key = fact.id || fact.key || `${fact.fact_type || fact.factType || ''}:${fact.value || fact.content || ''}`.slice(0, 240);
        if (!key || factIds.has(key)) return;
        factIds.add(key);
        merged.facts.push(fact);
      });
      (Array.isArray(ctx.summaries) ? ctx.summaries : []).forEach((sum) => {
        const key = sum.id || `${sum.summary_type || sum.summaryType || ''}:${sum.content || ''}`.slice(0, 240);
        if (!key || summaryIds.has(key)) return;
        summaryIds.add(key);
        merged.summaries.push(sum);
      });
      (Array.isArray(ctx.graphEdges) ? ctx.graphEdges : []).forEach((edge) => {
        const key = edge.id || `${edge.from_memory_id || edge.fromMemoryId || ''}:${edge.to_memory_id || edge.toMemoryId || ''}:${edge.relation || ''}`;
        if (!key || edgeIds.has(key)) return;
        edgeIds.add(key);
        merged.graphEdges.push(edge);
      });
    });
    const score = (fact) => Number(fact.retrievalScore || fact.quality?.overall || fact.quality_score || fact.qualityScore || fact.importance || 0);
    merged.facts.sort((a, b) => score(b) - score(a));
    merged.facts = merged.facts.slice(0, Math.max(12, limit));
    merged.summaries = merged.summaries.slice(0, 5);
    merged.graphEdges = merged.graphEdges.slice(0, 12);
    return merged;
  }

  async function fetchReviewerMemoryContext(ids, stepName, limit, queryText, focusText = '', explicitAgentRole = '') {
    const q = memorySemanticQuery(stepName, queryText, focusText);
    const agentRole = explicitAgentRole || agentRoleForReviewerStep(stepName, stepName);
    const payload = {
      userId: ids.userId,
      projectId: ids.projectId,
      paperId: ids.paperId,
      sectionId: ids.sectionId,
      sessionId: ids.sessionId,
      agentRole,
      taskType: stepName,
      workflow: 'reviewer-rebuttal-simulator',
      query: q.slice(0, 12000),
      limit: Math.max(1, Number(limit) || 12),
      metadata: { stage: STAGE, focusText: focusText.slice(0, 1200), contextPolicy: 'stage19i2-agent-role-specific' }
    };
    const json = await memoryPost('/agent-context', payload);
    if (json?.context) return json.context;
    // Backward-compatible fallback for older memory backends.
    const qs = new URLSearchParams({ userId: ids.userId, projectId: ids.projectId, paperId: ids.paperId, sessionId: ids.sessionId, task: stepName, limit: String(limit) });
    if (q) qs.set('q', q.slice(0, 12000));
    if (ids.sectionId) qs.set('sectionId', ids.sectionId);
    const fallback = await memoryFetch(`/context?${qs.toString()}`);
    const ctx = fallback?.context || { facts: [], summaries: [], graphEdges: [] };
    ctx.agentContextProfile = { requestedRole: agentRole, fallback: true, profileVersion: 'stage19i2-fallback' };
    return ctx;
  }

  async function loadReviewerMemoryContext(stepName, limit = 10, queryText = '', explicitAgentRole = '') {
    const ids = projectIdentity();
    await registerMemoryScope(ids, 'context', stepName);
    const canonicalAgentRole = explicitAgentRole || agentRoleForReviewerStep(stepName, stepName);
    const primary = await fetchReviewerMemoryContext(ids, stepName, Math.max(limit, 18), queryText, 'reviewer rebuttal final synthesis project paper active section', canonicalAgentRole);
    const extraContexts = [];
    for (const focus of RESEARCH_MEMORY_FOCUS_QUERIES) {
      // Stage 19I6: focused retrieval queries are still part of the same
      // agent step. Keep them under the canonical agent role instead of
      // reclassifying a synthesis/rebuttal focus query as a critic/reviewer
      // context just because its focus label contains "reviewer-negative".
      const focused = await fetchReviewerMemoryContext(ids, `${stepName}:${focus.name}`, 8, queryText, focus.text, canonicalAgentRole);
      extraContexts.push(focused);
    }
    const ctx = mergeMemoryContexts([primary, ...extraContexts], Math.max(limit, 24));
    lastMemoryContextByStep[stepName] = ctx;
    return ctx;
  }

  function factKind(fact) {
    return String(fact?.fact_type || fact?.factType || fact?.key || 'memory').toLowerCase();
  }

  function groupedResearchFacts(facts) {
    const groups = { notation: [], citation: [], reviewer: [], negative: [], edit: [], other: [] };
    (facts || []).forEach((fact) => {
      const kind = factKind(fact);
      if (/notation|symbol|theorem_environment|latex_label|macro|label_inventory/.test(kind)) groups.notation.push(fact);
      else if (/citation|related_work|competitor_reference|bibliograph|reference_seed/.test(kind)) groups.citation.push(fact);
      else if (/reviewer|proof_or_theorem|concern|weakness/.test(kind)) groups.reviewer.push(fact);
      else if (/negative|rejected|failed|avoid/.test(kind)) groups.negative.push(fact);
      else if (/edit|working_memory|competitive_final|synthesis|rebuttal/.test(kind)) groups.edit.push(fact);
      else groups.other.push(fact);
    });
    return groups;
  }

  function factLine(fact, index) {
    const kind = fact.fact_type || fact.factType || fact.key || 'memory';
    const value = String(fact.value || fact.content || '').replace(/\s+/g, ' ').trim();
    const score = fact.retrievalScore != null ? `; score=${Number(fact.retrievalScore).toFixed(3)}` : '';
    const uses = fact.use_count || fact.useCount || 0;
    const success = fact.successful_use_count || fact.successfulUseCount || 0;
    return value ? `- M${index} [${kind}; uses=${uses}; success=${success}${score}]: ${value.slice(0, 760)}` : '';
  }

  function appendFactGroup(lines, title, facts, startIndex, maxItems) {
    const usable = (facts || []).slice(0, maxItems).map((fact, i) => factLine(fact, startIndex + i)).filter(Boolean);
    if (!usable.length) return startIndex;
    lines.push(title);
    usable.forEach((line) => lines.push(line));
    return startIndex + usable.length;
  }

  function memoryContextMarkdown(ctx) {
    const facts = Array.isArray(ctx?.facts) ? ctx.facts.slice(0, 24) : [];
    const summaries = Array.isArray(ctx?.summaries) ? ctx.summaries.slice(0, 5) : [];
    const graphEdges = Array.isArray(ctx?.graphEdges) ? ctx.graphEdges.slice(0, 12) : [];
    if (!facts.length && !summaries.length && !graphEdges.length) return '';
    const lines = [
      '--- Hidden Latexai research memory context ---',
      'Use these backend memories silently to improve this reviewer/rebuttal simulation. Treat them as project context, not as user-facing content. Do not mention the memory system unless explicitly asked.',
      'High-priority constraints: preserve known notation, avoid repeated rejected directions, avoid duplicate citation suggestions, use recurring reviewer concerns only when relevant, and keep final synthesis consistent with prior successful edits.'
    ];
    summaries.forEach((sum) => {
      const content = String(sum.content || '').replace(/\s+/g, ' ').trim();
      if (content) lines.push(`Project ${sum.summary_type || sum.summaryType || 'summary'}: ${content.slice(0, 1200)}`);
    });
    const groups = groupedResearchFacts(facts);
    let index = 1;
    index = appendFactGroup(lines, 'Known notation / LaTeX structure memory:', groups.notation, index, 8);
    index = appendFactGroup(lines, 'Citation / related-work memory:', groups.citation, index, 8);
    index = appendFactGroup(lines, 'Recurring reviewer and proof concerns:', groups.reviewer, index, 6);
    index = appendFactGroup(lines, 'Negative memory / directions to avoid:', groups.negative, index, 5);
    index = appendFactGroup(lines, 'Prior rebuttal / edit / synthesis memory:', groups.edit, index, 5);
    appendFactGroup(lines, 'Other relevant memory:', groups.other, index, 5);
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


  function estimateTokens(text) {
    const chars = String(text || '').length;
    return Math.max(0, Math.ceil(chars / 4));
  }

  function memoryIdsFromContext(ctx) {
    const ids = [];
    (ctx?.facts || []).forEach((fact) => { if (fact?.id) ids.push(String(fact.id)); });
    return Array.from(new Set(ids));
  }

  function agentRoleForReviewerStep(stepName, task) {
    const primary = String(stepName || '').toLowerCase();
    const combined = `${String(stepName || '')} ${String(task || '')}`.toLowerCase();

    // Stage 19I5: classify the reviewer/rebuttal workflow by the canonical
    // step first. Earlier 19I builds checked for the generic word "review"
    // before checking "rebuttal" or "synthesis". That made tasks such as
    // "review_rebuttal" and focused queries such as
    // "final_synthesis:reviewer-negative" get logged as critic.
    // Exact workflow stages must win over focus labels.
    if (/^simulated_review_?\d*$/.test(primary) || /^reviewer_?\d*$/.test(primary)) return 'critic';
    if (/^review_rebuttal$/.test(primary) || /^rebuttal$/.test(primary) || /^author_response$/.test(primary)) return 'defender';
    if (/^final_synthesis$/.test(primary) || /^synthesize/.test(primary) || /^revision_synthesis$/.test(primary)) return 'editor';

    // Focus/audit contexts only win when the primary step was not one of the
    // main critic/defender/editor stages above.
    if (/notation/.test(combined)) return 'notation_auditor';
    if (/citation|related/.test(combined)) return 'citation_auditor';
    if (/rebuttal|defend|author_response/.test(combined)) return 'defender';
    if (/synthesis|final|rewrite|revision|edit/.test(combined)) return 'editor';
    if (/evaluate|score|outcome/.test(combined)) return 'evaluator';
    if (/simulated_review|reviewer|review|critique|critic/.test(combined)) return 'critic';
    return 'critic';
  }

  async function logReviewerAgentRun(details) {
    if (!memoryEnabled()) return null;
    try {
      const ids = projectIdentity();
      const ctx = details.memoryContext || lastMemoryContextByStep[details.stepName] || {};
      const pm = currentProviderModel();
      const memoryIds = memoryIdsFromContext(ctx);
      return await memoryPost('/agent-run', {
        scope: 'agent',
        userId: ids.userId,
        projectId: ids.projectId,
        paperId: ids.paperId,
        sectionId: ids.sectionId,
        sessionId: ids.sessionId,
        agentRole: details.agentRole || agentRoleForReviewerStep(details.stepName, details.taskType),
        agentId: details.agentId || 'reviewer-rebuttal-simulator-service',
        taskType: details.taskType || 'latexai-reviewer-rebuttal-simulator',
        workflow: 'reviewer-rebuttal-simulator',
        stepName: details.stepName || details.taskType || '',
        provider: details.provider || pm.provider,
        model: details.model || pm.model,
        promptTemplateId: details.promptTemplateId || `reviewer-rebuttal:${details.stepName || details.taskType || 'unknown'}:stage19i2`,
        promptText: details.instructions || '',
        inputText: details.input || '',
        outputText: details.output || '',
        status: details.status || 'unknown',
        latencyMs: details.latencyMs || 0,
        tokenEstimate: estimateTokens(`${details.instructions || ''}\n${details.input || ''}\n${details.output || ''}`),
        contextBundle: {
          memoryIds,
          contextText: details.memoryBlock || memoryContextMarkdown(ctx),
          metadata: {
            memoryFacts: Array.isArray(ctx?.facts) ? ctx.facts.length : 0,
            memorySummaries: Array.isArray(ctx?.summaries) ? ctx.summaries.length : 0,
            graphEdges: Array.isArray(ctx?.graphEdges) ? ctx.graphEdges.length : 0,
            agentContextProfile: ctx?.agentContextProfile || null,
            contextPolicy: 'stage19i2-agent-role-specific'
          }
        },
        output: {
          text: details.output || '',
          summary: String(details.output || '').replace(/```[\s\S]*?```/g, '[structured block omitted]').replace(/\s+/g, ' ').trim().slice(0, 1200)
        },
        error: details.error || '',
        metadata: {
          stage: STAGE,
          reviewerName: details.reviewerName || '',
          reviewerStyle: details.reviewerStyle || '',
          ...(ids.identityMetadata || {})
        }
      });
    } catch (err) {
      try { console.warn('[Latexai agent-run logging] reviewer/rebuttal log failed', err); } catch (_ignored) {}
      return null;
    }
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


  async function logReviewerRewardEvent(eventType, rewardValue, options = {}) {
    try {
      return await NS.RewardLoggingService?.logReward?.(eventType, rewardValue, {
        workflow: options.workflow || 'reviewer-rebuttal-simulator',
        stepName: options.stepName || eventType,
        memoryContext: options.memoryContext || lastMemoryContextByStep[options.stepName || eventType] || {},
        relatedActionId: options.relatedActionId || '',
        relatedAgentRunId: options.relatedAgentRunId || '',
        note: options.note || '',
        metadata: { stage: STAGE, ...(options.metadata || {}) }
      });
    } catch (_err) { return null; }
  }

  async function logReviewerEditOutcome(actionType, result = {}, options = {}) {
    try {
      return await NS.RewardLoggingService?.logEditOutcome?.(actionType, {
        ...result,
        workflow: options.workflow || 'reviewer-rebuttal-simulator',
        stepName: options.stepName || actionType,
        source: 'reviewer-rebuttal-simulator-service',
        memoryContext: options.memoryContext || lastMemoryContextByStep[options.stepName || actionType] || {},
        note: options.note || '',
        metadata: { stage: STAGE, ...(options.metadata || {}) }
      });
    } catch (_err) { return null; }
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
    const researchFacts = await saveResearchSpecificMemories(stepName, content, payload, { parentFactId: fact?.id || '', parentEventId: event?.id || '', reviewerName: extra?.reviewerName || '', reviewerStyle: extra?.reviewerStyle || '' });
    return { event, fact, workingFact, researchFacts };
  }


  async function saveResearchSpecificMemories(stepName, reportText, payload = null, extra = {}) {
    const svc = NS.ResearchMemoryExtractionService;
    if (!svc?.saveResearchMemories || !memoryEnabled()) return null;
    try {
      const ids = projectIdentity();
      const src = activeSource();
      return await svc.saveResearchMemories({
        memoryPost,
        ids,
        stableHash,
        sourceText: String(src?.text || payload?.draftExcerpt || ''),
        reportText,
        payload: payload || {},
        source: 'reviewer-rebuttal-simulator-service',
        stepName,
        stage: STAGE,
        parentFactId: extra?.parentFactId || '',
        parentEventId: extra?.parentEventId || '',
        metadata: {
          ...(ids.identityMetadata || {}),
          targetVenue: payload?.targetVenue || clean(el('reviewerSimVenue')?.value),
          paperGoal: payload?.paperGoal || clean(el('reviewerSimGoal')?.value),
          reviewerCount: payload?.reviewers?.length || selectedReviewers().length,
          ...extra
        }
      });
    } catch (err) {
      try { console.warn('[Latexai research memory] reviewer/rebuttal extraction failed', err); } catch (_ignored) {}
      return null;
    }
  }

  function setStatus(message) { const node = el('reviewerRebuttalStatus'); if (node) node.textContent = message; }
  function setOutput(text) { const node = el('reviewerRebuttalOutput'); if (node) node.textContent = text || ''; }

  function setReviewerButtonsBusy(isBusy) {
    ['runReviewerSimBtn', 'generateReviewerRebuttalBtn', 'synthesizeReviewerFinalBtn', 'runReviewerFullLoopBtn'].forEach((id) => {
      const node = el(id);
      if (node) node.disabled = Boolean(isBusy);
    });
    const cancel = el('cancelReviewerSimBtn');
    if (cancel) cancel.disabled = false;
  }

  function stopReviewerStatusTicker() {
    if (reviewerStatusTimer) {
      try { clearInterval(reviewerStatusTimer); } catch (_err) {}
      reviewerStatusTimer = null;
    }
  }

  function startReviewerStatusTicker(label) {
    stopReviewerStatusTicker();
    const started = Date.now();
    reviewerStatusTimer = setInterval(() => {
      if (!reviewerWorkflowBusy && !label) return;
      const elapsed = Math.max(1, Math.round((Date.now() - started) / 1000));
      setStatus(`${label || 'Reviewer/rebuttal workflow still running'}... ${elapsed}s elapsed`);
    }, 10000);
  }

  function withTimeout(promise, timeoutMs, label) {
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label || 'AI call'} timed out after ${Math.round(timeoutMs / 1000)}s. Check AI backend URL/model, then retry.`)), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => { if (timer) clearTimeout(timer); });
  }

  async function runWorkflowWithBusy(label, fn) {
    if (reviewerWorkflowBusy) {
      setStatus('Reviewer/rebuttal workflow is already running. Use Cancel or wait for the current AI call to finish.');
      return { ok: false, error: 'workflow_already_running' };
    }
    reviewerWorkflowBusy = true;
    cancelled = false;
    setReviewerButtonsBusy(true);
    setStatus(label);
    startReviewerStatusTicker(label);
    try {
      return await fn();
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Reviewer/rebuttal workflow failed: ${message}`);
      try { console.warn('[Latexai reviewer/rebuttal] workflow failed', err); } catch (_ignored) {}
      return { ok: false, error: message };
    } finally {
      reviewerWorkflowBusy = false;
      setReviewerButtonsBusy(false);
      stopReviewerStatusTicker();
    }
  }

  async function askAI(instructions, input, maxOutputTokens = 5000, temperature = 0.25, task = 'latexai-reviewer-rebuttal-simulator', logDetails = {}) {
    if (!NS.AIProvider?.ask) throw new Error('AIProvider is not loaded. Check feature flags and safe mode.');
    const pm = currentProviderModel();
    const startedAt = Date.now();
    let text = '';
    try {
      const timeoutMs = Math.max(60000, Number(W.localStorage?.getItem?.('latexai:reviewer-rebuttal-ai-timeout-ms') || AI_CALL_TIMEOUT_MS));
      const response = await withTimeout(NS.AIProvider.ask({
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
      }), timeoutMs, `${logDetails.stepName || task} AI call`);
      text = NS.AIProvider.extractText ? NS.AIProvider.extractText(response) : String(response || '');
      const loggedRun = await logReviewerAgentRun({
        ...logDetails,
        taskType: task,
        provider: pm.provider,
        model: pm.model,
        instructions,
        input,
        output: text,
        status: text && text.trim() ? 'success' : 'empty',
        latencyMs: Date.now() - startedAt
      });
      if (loggedRun?.runId || loggedRun?.id) {
        trajectoryAgentRuns.push({
          runId: loggedRun.runId || loggedRun.id,
          contextBundleId: loggedRun.contextBundleId || '',
          outputId: loggedRun.outputId || '',
          stepName: logDetails.stepName || task,
          agentRole: logDetails.agentRole || agentRoleForReviewerStep(logDetails.stepName, task),
          taskType: task,
          status: text && text.trim() ? 'success' : 'empty'
        });
      }
      return text;
    } catch (err) {
      const loggedRun = await logReviewerAgentRun({
        ...logDetails,
        taskType: task,
        provider: pm.provider,
        model: pm.model,
        instructions,
        input,
        output: text,
        status: 'failure',
        latencyMs: Date.now() - startedAt,
        error: err?.message || String(err)
      });
      if (loggedRun?.runId || loggedRun?.id) {
        trajectoryAgentRuns.push({
          runId: loggedRun.runId || loggedRun.id,
          contextBundleId: loggedRun.contextBundleId || '',
          outputId: loggedRun.outputId || '',
          stepName: logDetails.stepName || task,
          agentRole: logDetails.agentRole || agentRoleForReviewerStep(logDetails.stepName, task),
          taskType: task,
          status: 'failure'
        });
      }
      throw err;
    }
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
    trajectoryAgentRuns = [];
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
        const memoryContext = await loadReviewerMemoryContext(stepName, 10, `${reviewer.name} ${reviewer.style}\n${instructions}\n${input}`, 'critic');
        const memoryBlock = memoryContextMarkdown(memoryContext);
        const text = await askAI(
          memoryBlock ? `${instructions}

${memoryBlock}` : instructions,
          memoryBlock ? `${memoryBlock}

${input}` : input,
          4500,
          0.3,
          'latexai-simulated-reviewer',
          { stepName, memoryContext, memoryBlock, reviewerName: reviewer.name, reviewerStyle: reviewer.style, agentRole: 'critic' }
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
      const memoryContext = await loadReviewerMemoryContext(stepName, 12, `${instructions}\n${input}`, 'defender');
      const memoryBlock = memoryContextMarkdown(memoryContext);
      lastRebuttal = (await askAI(
        memoryBlock ? `${instructions}

${memoryBlock}` : instructions,
        memoryBlock ? `${memoryBlock}

${input}` : input,
        5000,
        0.2,
        'latexai-review-rebuttal',
        { stepName, memoryContext, memoryBlock, agentRole: 'defender' }
      )).trim();
      await markMemoryUse(stepName, lastRebuttal ? 'success' : 'used', lastRebuttal ? 'Rebuttal completed with memory context.' : 'Rebuttal returned empty text.');
      await saveReviewerMemory('rebuttal', lastRebuttal, payload);
      await logReviewerRewardEvent('reviewer_rebuttal_completed', lastRebuttal ? 0.3 : -0.2, { stepName, memoryContext, note: lastRebuttal ? 'AI rebuttal completed.' : 'AI rebuttal returned empty text.' });
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

  async function checkpointBeforeFinalSynthesis() {
    try {
      if (!NS.FileTree?.autoCheckpointBeforeRiskyAction) return true;
      const checkpoint = await NS.FileTree.autoCheckpointBeforeRiskyAction('reviewer/rebuttal final synthesis', { updateStatus: true });
      if (checkpoint?.ok || checkpoint?.skipped) return true;
      const message = checkpoint?.error || checkpoint?.reason || 'Unknown checkpoint failure.';
      return confirm(`Auto-checkpoint before reviewer/rebuttal final synthesis failed:\n${message}\n\nProceed without a GitHub checkpoint?`);
    } catch (err) {
      return confirm(`Auto-checkpoint before reviewer/rebuttal final synthesis failed:\n${err?.message || err}\n\nProceed without a GitHub checkpoint?`);
    }
  }


  async function logReviewerTrajectory(status, payload, extra = {}) {
    try {
      const contexts = Object.values(lastMemoryContextByStep || {});
      const steps = [];
      (lastReviews || []).forEach((review, i) => {
        const run = trajectoryAgentRuns.find((r) => r.stepName === `simulated_review_${i + 1}`) || {};
        steps.push({
          stepIndex: i,
          stepName: `simulated_review_${i + 1}`,
          agentRole: 'critic',
          actionType: 'simulate_review',
          agentRunId: run.runId || '',
          contextBundleId: run.contextBundleId || '',
          status: review?.text ? 'success' : 'empty',
          summary: `${review?.name || `Reviewer ${i + 1}`}: ${summarizeMemoryText(review?.text || '', 1000)}`,
          memoryIds: memoryIdsFromContext(lastMemoryContextByStep[`simulated_review_${i + 1}`] || {})
        });
      });
      const rebuttalRun = trajectoryAgentRuns.find((r) => r.stepName === 'review_rebuttal' || r.stepName === 'rebuttal') || {};
      if (lastRebuttal || rebuttalRun.runId) {
        steps.push({
          stepIndex: steps.length,
          stepName: 'rebuttal',
          agentRole: 'defender',
          actionType: 'generate_rebuttal',
          agentRunId: rebuttalRun.runId || '',
          contextBundleId: rebuttalRun.contextBundleId || '',
          status: lastRebuttal ? 'success' : 'empty',
          summary: summarizeMemoryText(lastRebuttal || '', 1200),
          memoryIds: memoryIdsFromContext(lastMemoryContextByStep.review_rebuttal || lastMemoryContextByStep.rebuttal || {})
        });
      }
      const synthesisRun = trajectoryAgentRuns.find((r) => r.stepName === 'final_synthesis') || {};
      if (lastSynthesis || synthesisRun.runId || extra.includeFailedSynthesis) {
        steps.push({
          stepIndex: steps.length,
          stepName: 'final_synthesis',
          agentRole: 'editor',
          actionType: 'synthesize_revision_plan',
          agentRunId: synthesisRun.runId || '',
          contextBundleId: synthesisRun.contextBundleId || '',
          status: lastSynthesis ? 'success' : status || 'unknown',
          summary: summarizeMemoryText(lastSynthesis || extra.error || '', 1400),
          memoryIds: memoryIdsFromContext(lastMemoryContextByStep.final_synthesis || {})
        });
      }
      const agentRunIds = trajectoryAgentRuns.map((r) => r.runId).filter(Boolean);
      const contextBundleIds = trajectoryAgentRuns.map((r) => r.contextBundleId).filter(Boolean);
      return await NS.DebateTrajectoryLoggingService?.logTrajectory?.({
        workflow: 'reviewer-rebuttal-simulator',
        trajectoryType: 'reviewer_rebuttal_final_synthesis',
        title: `Reviewer/rebuttal trajectory: ${payload?.targetVenue || payload?.paperGoal || 'paper revision'}`,
        status: status || (lastSynthesis ? 'success' : 'unknown'),
        branchLabel: `${(payload?.reviewers || []).length || (lastReviews || []).length} reviewers -> rebuttal -> synthesis`,
        rootStateText: payload?.draftExcerpt || '',
        finalScore: lastSynthesis ? 0.75 : -0.35,
        agentRunIds,
        contextBundleIds,
        memoryContexts: contexts,
        steps,
        outcomes: [{
          outcomeType: 'reviewer_rebuttal_final_synthesis',
          status: lastSynthesis ? 'success' : 'failure',
          score: lastSynthesis ? 0.75 : -0.35,
          rewardValue: lastSynthesis ? 0.75 : -0.9,
          rewardLabel: lastSynthesis ? 'positive' : 'negative',
          summary: lastSynthesis ? 'Final synthesis completed.' : `Final synthesis failed or returned empty output.${extra.error ? ` ${extra.error}` : ''}`
        }],
        metadata: { stage: STAGE, reviewerCount: (payload?.reviewers || []).length || (lastReviews || []).length, hasRebuttal: Boolean(lastRebuttal), hasSynthesis: Boolean(lastSynthesis), ...(extra.metadata || {}) }
      });
    } catch (err) {
      try { console.warn('[Latexai debate trajectory logging] reviewer/rebuttal trajectory failed', err); } catch (_ignored) {}
      return null;
    }
  }

  async function synthesizeFinalRevision() {
    const payload = lastPayload || buildPayload();
    if (!lastReviews.length) await runReviews();
    if (!lastRebuttal) await generateRebuttal();
    if (!(await checkpointBeforeFinalSynthesis())) {
      setStatus('Final synthesis cancelled because GitHub checkpoint did not complete.');
      return { ok: false, error: 'GitHub checkpoint failed or cancelled' };
    }
    setStatus('Synthesizing final revision plan and paper rewrite proposal...');
    const instructions = [
      'You are the final synthesis agent for a paper revision workflow.',
      'Use the simulated reviews, user guidance, and AI rebuttal to propose the strongest final revision.',
      'Return Markdown with: executive summary, accepted reviewer points, rejected/defended points, prioritized revision plan, and final revised-paper strategy. Make the final strategy paper-editable rather than generic advice.',
      rawPatchProtocolInstructions('reviewer/rebuttal final revision source edits'),
      'For every concrete source edit, include a LATEXAI_BLOCK_PATCH block. Use append_before_end_document for a final revision plan if exact localization is unsafe.',
      'Do not emit JSON edit schemas, \\lai, \\laiold, or internal editor change-tracking wrappers. The app/backend adds visible old/new markup after safe validation.',
      'When hidden memory mentions successful paper edit patterns, notation preferences, rejected rewrite styles, or previously failed insertion anchors, use that information to choose safer patch targets and avoid repeating failed edits.',
      'Avoid preamble edits, Markdown fences inside BEGIN_NEW_LATEX, full-document rewrites, and invented exact oldText strings.'
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
      const memoryContext = await loadReviewerMemoryContext(stepName, 14, `${instructions}\n${input}`, 'editor');
      const memoryBlock = memoryContextMarkdown(memoryContext);
      lastSynthesis = (await askAI(
        memoryBlock ? `${instructions}

${memoryBlock}` : instructions,
        memoryBlock ? `${memoryBlock}

${input}` : input,
        6500,
        0.2,
        'latexai-final-review-synthesis',
        { stepName, memoryContext, memoryBlock, agentRole: 'editor' }
      )).trim();
      lastCompiledSynthesis = lastSynthesis ? await compileReviewerSynthesis(lastSynthesis) : null;
      await markMemoryUse(stepName, lastSynthesis ? 'success' : 'used', lastSynthesis ? 'Final synthesis completed with memory context.' : 'Final synthesis returned empty text.');
      await saveReviewerMemory('final_synthesis', lastSynthesis, payload);
      const synthesisResult = { ok: Boolean(lastSynthesis), accepted: Boolean(lastSynthesis), mode: 'reviewer-final-synthesis', rewardValue: lastSynthesis ? 0.75 : -0.35, rewardLabel: lastSynthesis ? 'positive' : 'negative', note: lastSynthesis ? 'Reviewer/rebuttal final synthesis completed.' : 'Reviewer/rebuttal final synthesis returned empty text.' };
      await logReviewerEditOutcome('reviewer_rebuttal_final_synthesis', synthesisResult, { stepName, memoryContext, metadata: { hasActionableEdits: /latexai_actionable_edits/i.test(lastSynthesis || ''), synthesisChars: String(lastSynthesis || '').length } });
      await logReviewerTrajectory(lastSynthesis ? 'success' : 'empty', payload, { metadata: { hasActionableEdits: /latexai_actionable_edits/i.test(lastSynthesis || ''), synthesisChars: String(lastSynthesis || '').length } });
      setOutput(fullReport());
      setStatus('Final synthesis complete.');
      return { ok: true, synthesis: lastSynthesis };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Final synthesis failed: ${message}`);
      try { await logReviewerEditOutcome('reviewer_rebuttal_final_synthesis', { ok: false, accepted: false, rewardValue: -0.9, rewardLabel: 'negative', note: `Final synthesis failed: ${message}`, metadata: { error: message } }, { stepName: 'final_synthesis' }); } catch (_ignored) {}
      try { await logReviewerTrajectory('failure', lastPayload || payload, { includeFailedSynthesis: true, error: message, metadata: { error: message } }); } catch (_ignored) {}
      setOutput(fullReport());
      return { ok: false, error: message };
    }
  }

  async function runFullLoop() {
    setStatus('Full loop: starting reviewer simulation...');
    const reviewResult = await runReviews();
    if (cancelled) return { ok: false, cancelled: true };
    if (!reviewResult?.ok) return reviewResult;
    setStatus('Full loop: reviews complete; generating rebuttal...');
    const rebuttalResult = await generateRebuttal();
    if (cancelled) return { ok: false, cancelled: true };
    if (!rebuttalResult?.ok) return rebuttalResult;
    setStatus('Full loop: rebuttal complete; synthesizing final revision...');
    return await synthesizeFinalRevision();
  }

  function cancelLoop() { cancelled = true; setStatus('Cancel requested. Current AI call may finish before stopping; no new reviewer/rebuttal steps will start.'); }

  async function copyReport() {
    const text = fullReport();
    try { await navigator.clipboard.writeText(text); setStatus('Reviewer/rebuttal report copied.'); }
    catch (_err) { setOutput(text); setStatus('Could not copy automatically; report is shown below.'); }
  }


  async function prepareReviewerFinalInsertion() {
    if (!lastSynthesis) {
      setStatus('Run final synthesis first.');
      return { ok: false, error: 'No final synthesis' };
    }
    setStatus('Preparing reviewer/rebuttal final synthesis through Safe Edit Compiler...');
    lastCompiledSynthesis = await compileReviewerSynthesis(lastSynthesis);
    setOutput([fullReport(), '', '--- Stage 19T2X reviewer/rebuttal safe compiler preview ---', reviewerCompilerReport(lastCompiledSynthesis)].join('\n'));
    setStatus(lastCompiledSynthesis.safeToInsert
      ? `Prepared ${lastCompiledSynthesis.blockCount || lastCompiledSynthesis.compiledEditCount || 0} safe reviewer/rebuttal edit block(s). Click Apply final edits.`
      : 'Safe Edit Compiler blocked reviewer/rebuttal final edits. No source changes made.');
    return lastCompiledSynthesis;
  }

  async function applyReviewerFinalInsertion() {
    if (!lastSynthesis) {
      setStatus('Run final synthesis first.');
      return { ok: false, error: 'No final synthesis' };
    }
    if (!lastCompiledSynthesis || lastCompiledSynthesis.safeToInsert !== true) {
      lastCompiledSynthesis = await compileReviewerSynthesis(lastSynthesis);
    }
    const applied = await applyReviewerCompiledSynthesis();
    if (!applied.ok) {
      setOutput([fullReport(), '', '--- Stage 19T2X reviewer/rebuttal apply blocked ---', applied.error || 'blocked', '', reviewerCompilerReport(lastCompiledSynthesis)].join('\n'));
      setStatus('Safe Edit Compiler blocked reviewer/rebuttal apply. No source changes made.');
      return applied;
    }
    setOutput([fullReport(), '', '--- Stage 19T2X reviewer/rebuttal safe insertion applied ---', reviewerCompilerReport(lastCompiledSynthesis)].join('\n'));
    setStatus(`Inserted ${applied.blockCount || 0} reviewer/rebuttal final edit block(s). Use Resolve AI edits to accept/reject.`);
    return applied;
  }

  function bindReviewerDelegatedEvents() {
    if (reviewerDelegatedEventsBound) return;
    reviewerDelegatedEventsBound = true;
    D.addEventListener('click', (event) => {
      const target = event.target?.closest?.('#runReviewerSimBtn,#generateReviewerRebuttalBtn,#synthesizeReviewerFinalBtn,#prepareReviewerFinalInsertBtn,#applyReviewerFinalInsertBtn,#runReviewerFullLoopBtn,#cancelReviewerSimBtn,#copyReviewerSimBtn');
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      if (target.disabled) return;
      const id = target.id;
      try {
        if (id === 'cancelReviewerSimBtn') { cancelLoop(); return; }
        if (id === 'copyReviewerSimBtn') { void copyReport(); return; }
        if (reviewerWorkflowBusy) { setStatus('Reviewer/rebuttal workflow is already running. Use Cancel or wait for the current AI call to finish.'); return; }
        if (id === 'runReviewerSimBtn') { void runWorkflowWithBusy('Starting reviewer simulation', runReviews); return; }
        if (id === 'generateReviewerRebuttalBtn') { void runWorkflowWithBusy('Starting rebuttal generation', generateRebuttal); return; }
        if (id === 'synthesizeReviewerFinalBtn') { void runWorkflowWithBusy('Starting final synthesis', synthesizeFinalRevision); return; }
        if (id === 'prepareReviewerFinalInsertBtn') { void runWorkflowWithBusy('Preparing final insertion', prepareReviewerFinalInsertion); return; }
        if (id === 'applyReviewerFinalInsertBtn') { void runWorkflowWithBusy('Applying final insertion', applyReviewerFinalInsertion); return; }
        if (id === 'runReviewerFullLoopBtn') { void runWorkflowWithBusy('Starting full reviewer/rebuttal loop', runFullLoop); return; }
      } catch (err) {
        const message = err?.message || String(err);
        setStatus(`Reviewer/rebuttal button failed: ${message}`);
        try { console.warn('[Latexai reviewer/rebuttal] delegated button handler failed', err); } catch (_ignored) {}
      }
    }, true);
  }

  function bindCardEvents() {
    bindReviewerDelegatedEvents();
    syncReviewerRows();
    el('reviewerSimCount')?.addEventListener('change', syncReviewerRows, true);
    // Stage 19I3: buttons are handled by the delegated document listener above.
    // Avoid direct per-card listeners because this card is frequently remounted
    // by the right-panel organizer; duplicate direct listeners caused long/stale
    // full-loop runs on iPad.
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
      '  <button id="prepareReviewerFinalInsertBtn" class="btn mini" type="button">Preview final edits</button>',
      '  <button id="applyReviewerFinalInsertBtn" class="btn mini" type="button">Apply final edits</button>',
      '  <button id="runReviewerFullLoopBtn" class="btn mini" type="button">Run full loop</button>',
      '  <button id="cancelReviewerSimBtn" class="btn mini" type="button">Cancel</button>',
      '  <button id="copyReviewerSimBtn" class="btn mini" type="button">Copy report</button>',
      '</div>',
      '<div class="settings-note">Stage 19I6 keeps reviewer/rebuttal memories scoped by stable project and paper identity and logs role-specific context usage. The final synthesis is memory-aware and should produce source-aware <code>\\laiold</code>/<code>\\lai</code> actionable edits where possible; it still does not overwrite source automatically.</div>',
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
    prepareReviewerFinalInsertion,
    applyReviewerFinalInsertion,
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

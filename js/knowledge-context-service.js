/* Latexai Stage 19U6 KnowledgeContextService
 * Shared literature/knowledge retrieval bridge for AI review/edit workflows.
 * Adds retrieved-context preview, pin/exclude controls, retrieval modes,
 * and evidence-audit prompt text while keeping source edits on the safe protocol.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19u6-external-literature-metadata-enrichment-20260531-1';
  const DEFAULT_TOP_K = 5;

  let lastByFeature = {};
  let previewEventsBound = false;

  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }
  function getStored(key, fallback = '') {
    try { const v = W.localStorage?.getItem?.(key); return v == null || v === '' ? fallback : v; } catch (_err) { return fallback; }
  }
  function setStored(key, value) { try { W.localStorage?.setItem?.(key, String(value)); } catch (_err) {} }
  function jsonStored(key, fallback) {
    try {
      const raw = W.localStorage?.getItem?.(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_err) { return fallback; }
  }
  function setJsonStored(key, value) {
    try { W.localStorage?.setItem?.(key, JSON.stringify(value)); } catch (_err) {}
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function compactText(value, max = 420) {
    const s = String(value || '').replace(/\s+/g, ' ').trim();
    return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
  }
  function resultKey(result) {
    const r = result || {};
    return clean(r.paper_id || r.paperId || r.id || r.url || r.source_url || r.arxiv_id || r.doi || r.title || '').toLowerCase().slice(0, 500);
  }
  function normalizeResult(result) {
    const r = result || {};
    const chunk = r.bestChunk && typeof r.bestChunk === 'object' ? r.bestChunk : {};
    return {
      key: resultKey(r),
      title: clean(r.title || r.name || 'Untitled paper'),
      authors: Array.isArray(r.authors) ? r.authors.slice(0, 12).map(String) : [],
      year: clean(r.year || r.published || ''),
      url: clean(r.url || r.source_url || r.sourceUrl || ''),
      score: r.score,
      arxiv_id: clean(r.arxiv_id || r.arxivId || ''),
      snippet: clean(chunk.snippet || r.snippet || r.abstract || r.summary || ''),
      semanticScore: r.semanticScore ?? chunk.semanticScore ?? null,
      hybridScore: r.hybridScore ?? r.score ?? null,
      scoreBreakdown: (r.scoreBreakdown && typeof r.scoreBreakdown === 'object') ? r.scoreBreakdown : ((chunk.scoreBreakdown && typeof chunk.scoreBreakdown === 'object') ? chunk.scoreBreakdown : null),
      retrievalReasons: Array.isArray(r.retrievalReasons) ? r.retrievalReasons.slice(0, 10).map(String) : [],
      searchSchema: clean(r.searchSchema || ''),
      metadata: (r.metadata && typeof r.metadata === 'object') ? r.metadata : {},
      doi: clean(r.doi || (r.metadata && r.metadata.externalIds && (r.metadata.externalIds.DOI || r.metadata.externalIds.doi)) || ''),
      semanticScholarId: clean((r.metadata && r.metadata.semanticScholar && r.metadata.semanticScholar.paperId) || (r.metadata && r.metadata.externalIds && (r.metadata.externalIds.SemanticScholar || r.metadata.externalIds.S2)) || ''),
      dblpKey: clean((r.metadata && r.metadata.dblp && r.metadata.dblp.key) || (r.metadata && r.metadata.externalIds && r.metadata.externalIds.DBLP) || ''),
      canonicalAuthorKeys: Array.isArray(r.metadata?.canonicalAuthorKeys) ? r.metadata.canonicalAuthorKeys.slice(0, 12).map(String) : [],
      enrichment: (r.metadata && r.metadata.metadataEnrichment && typeof r.metadata.metadataEnrichment === 'object') ? r.metadata.metadataEnrichment : null,
      raw: r
    };
  }
  function pinnedKey(feature) { return 'latexai:knowledge-pinned:' + String(feature || 'knowledge'); }
  function excludedKey(feature) { return 'latexai:knowledge-excluded:' + String(feature || 'knowledge'); }
  function modeKey(feature) { return 'latexai:knowledge-mode:' + String(feature || 'knowledge'); }
  function pinnedResults(feature) {
    const arr = jsonStored(pinnedKey(feature), []);
    return Array.isArray(arr) ? arr.filter((r) => r && r.key) : [];
  }
  function excludedKeys(feature) {
    const arr = jsonStored(excludedKey(feature), []);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  }
  function retrievalMode(feature, fallback = 'automatic_pinned') {
    const node = el(String(feature || 'knowledge') + 'KnowledgeMode');
    const raw = clean(node?.value || getStored(modeKey(feature), fallback));
    return ['automatic', 'pinned_only', 'automatic_pinned'].includes(raw) ? raw : fallback;
  }
  function storeRetrievalMode(feature) {
    const node = el(String(feature || 'knowledge') + 'KnowledgeMode');
    if (node) setStored(modeKey(feature), retrievalMode(feature));
  }
  function pinResult(feature, result) {
    const nr = normalizeResult(result);
    if (!nr.key) return false;
    const list = pinnedResults(feature).filter((r) => r.key !== nr.key);
    list.unshift(nr);
    setJsonStored(pinnedKey(feature), list.slice(0, 20));
    return true;
  }
  function unpinResult(feature, key) {
    const k = String(key || '');
    setJsonStored(pinnedKey(feature), pinnedResults(feature).filter((r) => r.key !== k));
  }
  function excludeResult(feature, resultOrKey) {
    const key = typeof resultOrKey === 'string' ? resultOrKey : normalizeResult(resultOrKey).key;
    if (!key) return false;
    const set = excludedKeys(feature);
    set.add(key);
    setJsonStored(excludedKey(feature), Array.from(set).slice(-80));
    return true;
  }
  function includeResult(feature, key) {
    const set = excludedKeys(feature);
    set.delete(String(key || ''));
    setJsonStored(excludedKey(feature), Array.from(set));
  }
  function buildFilteredData(feature, data) {
    const mode = retrievalMode(feature);
    const pinned = pinnedResults(feature);
    const excluded = excludedKeys(feature);
    const autoRaw = Array.isArray(data?.results) ? data.results.map(normalizeResult).filter((r) => r.key) : [];
    let merged = [];
    if (mode === 'pinned_only') merged = pinned.slice();
    else if (mode === 'automatic_pinned') merged = pinned.concat(autoRaw.filter((r) => !pinned.some((p) => p.key === r.key)));
    else merged = autoRaw;
    merged = merged.map((r) => {
      if (!pinned.some((p) => p.key === r.key)) return r;
      const raw = Object.assign({}, r.raw || r);
      const existing = raw.scoreBreakdown && typeof raw.scoreBreakdown === 'object' ? raw.scoreBreakdown : {};
      raw.scoreBreakdown = Object.assign({}, existing, { pinnedBoost: existing.pinnedBoost || 1.0 });
      raw.hybridScore = Number(raw.hybridScore ?? raw.score ?? 0) + 1.0;
      raw.score = raw.hybridScore;
      raw.retrievalReasons = Array.from(new Set([...(Array.isArray(raw.retrievalReasons) ? raw.retrievalReasons : []), 'pinned by user']));
      return normalizeResult(raw);
    });
    merged = merged.filter((r) => !excluded.has(r.key));
    const out = Object.assign({}, data || { ok: true }, {
      results: merged.map((r) => r.raw || r),
      normalizedResults: merged,
      resultCount: merged.length,
      retrievalMode: mode,
      pinnedCount: pinned.length,
      excludedCount: excluded.size,
      authorGraphRanking: !!data?.authorGraphRanking,
      searchSchema: data?.searchSchema || '',
    });
    out.promptContext = formatPromptContextFromResults(out);
    return out;
  }
  function State() { return NS.State; }
  function project() { return State()?.state?.project || {}; }
  function normalizePath(path) {
    try { return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
    catch (_err) { return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
  }
  function files() { return project().files || []; }
  function fileText(file) { return String(file?.text ?? file?.content ?? file?.source ?? file?.value ?? ''); }
  function textFile(file) { try { return !!State()?.textFile?.(file); } catch (_err) { return file && !file.base64 && !['asset', 'binary'].includes(file.kind); } }
  function rootPath() {
    const p = project();
    if (p.rootFile) return normalizePath(p.rootFile);
    const root = (files() || []).find((f) => /\.tex$/i.test(f.path || '') && /\\documentclass/.test(fileText(f)));
    return normalizePath(root?.path || (files() || []).find((f) => /\.tex$/i.test(f.path || ''))?.path || 'main.tex');
  }
  function activePath() {
    const candidates = [State()?.state?.activePath, State()?.state?.activeFilePath, State()?.state?.currentPath, project()?.activePath, project()?.activeFilePath, rootPath()];
    return normalizePath(candidates.find(Boolean) || 'main.tex');
  }
  function getFile(path) {
    const normalized = normalizePath(path);
    try { const found = State()?.getFile?.(normalized); if (found) return found; } catch (_err) {}
    return (files() || []).find((f) => normalizePath(f.path) === normalized) || null;
  }
  function activeSource(preferRoot = true) {
    let path = preferRoot ? rootPath() : activePath();
    let file = getFile(path);
    if (!file || !textFile(file)) { path = rootPath(); file = getFile(path); }
    return { path, text: fileText(file) };
  }
  function truncateMiddle(text, maxChars = 60000, marker = '\n% ... [middle omitted for knowledge retrieval] ...\n') {
    const s = String(text || '');
    if (s.length <= maxChars) return s;
    const head = s.slice(0, Math.floor(maxChars * 0.68));
    const tail = s.slice(-Math.floor(maxChars * 0.30));
    return head + marker + tail;
  }
  function backendRoot() {
    const fromSettings = clean(NS.BackendUrlSettingsService?.getMemoryApiBaseUrl?.() || NS.BackendUrlSettings?.getMemoryApiBaseUrl?.() || '');
    const raw = clean(el('branchWorkflowBackendUrl')?.value) || clean(el('memoryBackendUrl')?.value) || fromSettings || clean(getStored('latexai:memory-backend-url', '')) || clean(getStored('lumina-latex.memory.backendUrl', ''));
    const base = raw.replace(/\/+$/, '');
    if (!base) return '';
    if (/\/api\/lumina\/memory$/i.test(base)) return base.replace(/\/api\/lumina\/memory$/i, '/api/lumina');
    if (/\/api\/lumina$/i.test(base)) return base;
    if (/\/api\/lumina\/latex\/compile(?:\/jobs)?$/i.test(base)) return base.replace(/\/api\/lumina\/latex\/compile(?:\/jobs)?$/i, '/api/lumina');
    if (/\/api\/lumina\/ai(?:\/status|\/models|\/workflows)?$/i.test(base)) return base.replace(/\/api\/lumina\/ai(?:\/status|\/models|\/workflows)?$/i, '/api/lumina');
    return base + '/api/lumina';
  }
  function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const token = clean(NS.BackendUrlSettingsService?.getMemoryProxyToken?.() || NS.BackendUrlSettings?.getMemoryProxyToken?.() || '') || clean(el('memoryProxyToken')?.value) || clean(getStored('latexai:memory-proxy-token', '')) || clean(getStored('lumina-latex.memory.proxyToken', ''));
    if (token) { h.Authorization = 'Bearer ' + token; h['X-Lumina-Token'] = token; h['X-Lumina-Ingest-Token'] = token; }
    return h;
  }
  async function postBackend(path, body, options = {}) {
    const root = backendRoot();
    if (!root) throw new Error('Missing knowledge/memory backend URL. Set the Cloud Run backend URL in Settings.');
    const res = await fetch(root + path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body || {}) });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : {}; } catch (_err) { data = { raw: text }; }
    if (!res.ok || (data?.ok === false && !options.allowOkFalse)) {
      throw new Error(data?.detail || data?.error?.message || data?.message || ('HTTP ' + res.status + ': ' + text));
    }
    if (data && typeof data === 'object') data.httpStatus = res.status;
    return data;
  }

  function checkboxId(feature) { return String(feature || 'knowledge') + 'UseKnowledge'; }
  function topKId(feature) { return String(feature || 'knowledge') + 'KnowledgeTopK'; }
  function statusId(feature) { return String(feature || 'knowledge') + 'KnowledgeStatus'; }
  function enabled(feature, defaultValue = false) {
    const id = checkboxId(feature);
    const node = el(id) || el(String(feature || '') + 'UseKnowledgeContext');
    if (node) return !!node.checked;
    return getStored('latexai:knowledge-enabled:' + feature, defaultValue ? 'true' : 'false') === 'true';
  }
  function topK(feature, defaultValue = DEFAULT_TOP_K) {
    const node = el(topKId(feature));
    const value = Number(node?.value || getStored('latexai:knowledge-topk:' + feature, defaultValue));
    return Math.max(1, Math.min(12, Number.isFinite(value) ? value : defaultValue));
  }
  function rememberUi(feature) {
    bindPreviewEvents();
    const cb = el(checkboxId(feature));
    const tk = el(topKId(feature));
    const mode = el(String(feature || 'knowledge') + 'KnowledgeMode');
    if (cb) setStored('latexai:knowledge-enabled:' + feature, cb.checked ? 'true' : 'false');
    if (tk) setStored('latexai:knowledge-topk:' + feature, topK(feature));
  }
  function setStatus(feature, message, kind = '') {
    const node = el(statusId(feature));
    if (!node) return;
    node.textContent = String(message || '');
    node.dataset.kind = kind || '';
  }
  function resultAuthors(result) {
    const authors = Array.isArray(result?.authors) ? result.authors : [];
    const text = authors.slice(0, 6).join(', ');
    return authors.length > 6 ? text + ', et al.' : text;
  }
  function scoreText(score) {
    try { return Number.isFinite(Number(score)) ? Number(score).toFixed(3) : clean(score); } catch (_err) { return clean(score); }
  }
  function formatPromptContextFromResults(data) {
    const results = (data?.normalizedResults || (Array.isArray(data?.results) ? data.results.map(normalizeResult) : [])).filter((r) => r && r.key);
    if (!results.length) return data?.ok === false ? ('Knowledge/literature retrieval failed: ' + (data.error || data.detail || 'unknown error')) : 'No relevant ingested-library papers were retrieved.';
    const lines = [
      '=== RETRIEVED LITERATURE / KNOWLEDGE CONTEXT ===',
      `Retrieval mode: ${data?.retrievalMode || 'automatic'}; papers provided: ${results.length}.`,
      'Use these retrieved works as evidence for novelty, related-work, assumptions, and positioning. Do not invent claims beyond the snippets.',
      'When writing a review/report, include a short "Literature context used" audit naming which retrieved papers influenced the analysis. When writing source edits, use the evidence but still return only LATEXAI_BLOCK_PATCH source edits.'
    ];
    results.forEach((r, idx) => {
      lines.push(`\n[${idx + 1}] ${r.title || 'Untitled paper'}${r.year ? ' (' + r.year + ')' : ''}`);
      lines.push('Authors: ' + (resultAuthors(r) || 'unknown'));
      if (r.url) lines.push('URL: ' + r.url);
      if (r.arxiv_id) lines.push('arXiv: ' + r.arxiv_id);
      if (r.doi) lines.push('DOI: ' + r.doi);
      if (r.semanticScholarId) lines.push('Semantic Scholar paper id: ' + r.semanticScholarId);
      if (r.dblpKey) lines.push('DBLP key: ' + r.dblpKey);
      if (r.canonicalAuthorKeys && r.canonicalAuthorKeys.length) lines.push('Canonical author keys: ' + r.canonicalAuthorKeys.join(', '));
      if (r.score != null && r.score !== '') lines.push('Hybrid retrieval score: ' + scoreText(r.score));
      if (r.semanticScore != null && r.semanticScore !== '') lines.push('Semantic score: ' + scoreText(r.semanticScore));
      if (r.retrievalReasons && r.retrievalReasons.length) lines.push('Why retrieved: ' + r.retrievalReasons.join('; '));
      if (r.scoreBreakdown) lines.push('Score breakdown: ' + scoreBreakdownText(r));
      lines.push('Evidence snippet: ' + (compactText(r.snippet, 900) || '(no snippet available)'));
    });
    lines.push('\nEvidence-audit instruction: explicitly say which retrieved paper numbers [1], [2], ... were used, and say if none were useful. Never paste this context block directly into the LaTeX source.');
    return lines.join('\n');
  }
  function resultsSummary(data) {
    if (!data) return 'Knowledge context disabled.';
    if (data.ok === false) return 'Knowledge retriever failed: ' + (data.error || data.detail || 'unknown error');
    const mode = data.retrievalMode ? ` · mode=${data.retrievalMode.replace(/_/g, '+')}` : '';
    const pins = data.pinnedCount ? ` · pinned=${data.pinnedCount}` : '';
    const hybrid = data.hybridRanking || /hybrid/i.test(String(data.searchSchema || '')) ? ' · hybrid ranking' : '';
    return `Knowledge retriever: ${data.resultCount || 0} paper(s) provided` + (data.searchSchema ? ` · ${data.searchSchema}` : '') + hybrid + (data.topK ? ` · topK=${data.topK}` : '') + mode + pins;
  }
  function promptBlock(data) {
    if (!data) return 'Knowledge/literature context is disabled for this run.';
    if (data.ok === false) return 'Knowledge/literature retrieval failed: ' + (data.error || data.detail || 'unknown error');
    const ctx = clean(data.promptContext || formatPromptContextFromResults(data));
    return ctx || 'No relevant ingested-library papers were retrieved.';
  }
  function previewId(feature) { return String(feature || 'knowledge') + 'KnowledgePreview'; }
  function scoreBreakdownText(r) {
    const b = r && r.scoreBreakdown && typeof r.scoreBreakdown === 'object' ? r.scoreBreakdown : null;
    if (!b) return '';
    const parts = [];
    ['semantic', 'titleKeywordBoost', 'titlePhraseBoost', 'authorKeywordBoost', 'authorExactBoost', 'authorPartialBoost', 'snippetKeywordBoost', 'metadataKeywordBoost', 'arxivBoost', 'doiBoost', 'semanticScholarBoost', 'urlBoost', 'citationKeyBoost', 'authorGraphQueryBoost', 'authorGraphPinnedBoost', 'coauthorNeighborhoodBoost', 'pinnedBoost', 'final'].forEach((k) => {
      if (b[k] != null && b[k] !== '' && Number(b[k]) !== 0) parts.push(k.replace(/Boost$/, '') + '=' + scoreText(b[k]));
    });
    return parts.join(' · ');
  }
  function resultCardHtml(feature, result, idx, pinnedSet, excludedSet) {
    const r = normalizeResult(result);
    const isPinned = pinnedSet.has(r.key);
    const isExcluded = excludedSet.has(r.key);
    const authors = resultAuthors(r);
    const reasons = Array.isArray(r.retrievalReasons) && r.retrievalReasons.length ? r.retrievalReasons.join('; ') : '';
    const breakdown = scoreBreakdownText(r);
    return [
      '<div class="knowledge-result-card" data-knowledge-key="' + escapeHtml(r.key) + '">',
      '  <div><strong>' + escapeHtml(String(idx + 1) + '. ' + (r.title || 'Untitled paper')) + '</strong>' + (r.year ? ' <span class="muted">(' + escapeHtml(r.year) + ')</span>' : '') + '</div>',
      authors ? '  <div class="muted">Authors: ' + escapeHtml(authors) + '</div>' : '',
      (r.arxiv_id || r.doi || r.semanticScholarId || r.dblpKey || (r.canonicalAuthorKeys && r.canonicalAuthorKeys.length)) ? '  <div class="muted">Metadata: ' + escapeHtml([r.arxiv_id ? 'arXiv ' + r.arxiv_id : '', r.doi ? 'DOI ' + r.doi : '', r.semanticScholarId ? 'S2 ' + r.semanticScholarId : '', r.dblpKey ? 'DBLP ' + r.dblpKey : '', (r.canonicalAuthorKeys && r.canonicalAuthorKeys.length) ? 'author keys ' + r.canonicalAuthorKeys.slice(0,4).join(', ') : ''].filter(Boolean).join(' · ')) + '</div>' : '',
      (r.enrichment && Array.isArray(r.enrichment.matched) && r.enrichment.matched.length) ? '  <div class="muted">Enriched via: ' + escapeHtml(r.enrichment.matched.join(', ')) + '</div>' : '',
      r.score != null && r.score !== '' ? '  <div class="muted">Hybrid score: ' + escapeHtml(scoreText(r.score)) + (r.semanticScore != null ? ' · semantic=' + escapeHtml(scoreText(r.semanticScore)) : '') + '</div>' : '',
      breakdown ? '  <details class="knowledge-score-breakdown"><summary>Score breakdown / why retrieved</summary><div class="muted">' + escapeHtml(breakdown) + '</div>' + (reasons ? '<div class="muted">Reasons: ' + escapeHtml(reasons) + '</div>' : '') + '</details>' : (reasons ? '  <div class="muted">Why retrieved: ' + escapeHtml(reasons) + '</div>' : ''),
      r.snippet ? '  <div class="knowledge-snippet">' + escapeHtml(compactText(r.snippet, 500)) + '</div>' : '  <div class="knowledge-snippet muted">No snippet available.</div>',
      '  <div class="knowledge-result-actions">',
      isPinned ? '    <button class="btn mini" type="button" data-knowledge-action="unpin" data-knowledge-feature="' + escapeHtml(feature) + '" data-knowledge-key="' + escapeHtml(r.key) + '">Unpin</button>' : '    <button class="btn mini" type="button" data-knowledge-action="pin" data-knowledge-feature="' + escapeHtml(feature) + '" data-knowledge-key="' + escapeHtml(r.key) + '">Pin to next review</button>',
      isExcluded ? '    <button class="btn mini" type="button" data-knowledge-action="include" data-knowledge-feature="' + escapeHtml(feature) + '" data-knowledge-key="' + escapeHtml(r.key) + '">Include again</button>' : '    <button class="btn mini" type="button" data-knowledge-action="exclude" data-knowledge-feature="' + escapeHtml(feature) + '" data-knowledge-key="' + escapeHtml(r.key) + '">Exclude from this run</button>',
      r.url ? '    <a class="btn mini" target="_blank" rel="noopener" href="' + escapeHtml(r.url) + '">Open</a>' : '',
      '  </div>',
      '</div>'
    ].filter(Boolean).join('');
  }
  function renderPreview(feature, data) {
    const node = el(previewId(feature));
    if (!node) return;
    const pinned = pinnedResults(feature);
    const pinnedSet = new Set(pinned.map((r) => r.key));
    const excluded = excludedKeys(feature);
    const norm = (data?.normalizedResults || (Array.isArray(data?.results) ? data.results.map(normalizeResult) : [])).filter((r) => r && r.key);
    const mode = retrievalMode(feature);
    if (!data && !pinned.length) {
      node.innerHTML = '<div class="settings-note compact">Retrieved context preview will appear here. Pin papers to force them into later reviews.</div>';
      return;
    }
    const graphFlag = data?.authorGraphRanking ? ' · author graph on' : '';
    const enrichedFlag = /enriched|metadata/i.test(String(data?.searchSchema || data?.storage?.metadataEnrichment || '')) ? ' · metadata enriched' : '';
    const schemaText = data?.searchSchema ? ' · ' + escapeHtml(String(data.searchSchema).replace(/^lumina-research-/, '').replace(/-search-v1$/, '')) : '';
    const header = `<div class="knowledge-preview-head"><strong>Retrieved literature context</strong><br><span class="muted">${norm.length} paper(s) provided · mode=${escapeHtml(mode.replace(/_/g, '+'))} · pinned=${pinned.length}${graphFlag}${enrichedFlag}${schemaText}</span></div>`;
    const cards = norm.length ? norm.map((r, i) => resultCardHtml(feature, r, i, pinnedSet, excluded)).join('') : '<div class="settings-note compact">No papers selected for this run. Try automatic mode, raise topK, or pin a known relevant paper.</div>';
    node.innerHTML = header + cards;
  }
  function refreshFeaturePreview(feature) {
    renderPreview(feature, lastByFeature[feature] || buildFilteredData(feature, { ok: true, results: [], topK: topK(feature), searchSchema: 'local-pins' }));
  }
  function bindPreviewEvents() {
    if (previewEventsBound) return;
    previewEventsBound = true;
    D.addEventListener('click', (event) => {
      const btn = event.target?.closest?.('[data-knowledge-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-knowledge-action');
      const feature = btn.getAttribute('data-knowledge-feature') || 'knowledge';
      const key = btn.getAttribute('data-knowledge-key') || '';
      const data = lastByFeature[feature];
      const all = [];
      if (Array.isArray(data?.normalizedResults)) all.push(...data.normalizedResults);
      if (Array.isArray(data?.results)) all.push(...data.results.map(normalizeResult));
      all.push(...pinnedResults(feature));
      const result = all.find((r) => r.key === key);
      if (action === 'pin' && result) pinResult(feature, result);
      if (action === 'unpin') unpinResult(feature, key);
      if (action === 'exclude') excludeResult(feature, key);
      if (action === 'include') includeResult(feature, key);
      if (data) lastByFeature[feature] = buildFilteredData(feature, data.rawData || data);
      refreshFeaturePreview(feature);
      setStatus(feature, resultsSummary(lastByFeature[feature] || null), 'good');
    }, true);
    D.addEventListener('click', async (event) => {
      const btn = event.target?.closest?.('[data-knowledge-preview-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-knowledge-preview-action');
      const feature = btn.getAttribute('data-knowledge-feature') || 'knowledge';
      if (action === 'clear-pins') { setJsonStored(pinnedKey(feature), []); refreshFeaturePreview(feature); setStatus(feature, 'Cleared pinned literature context.', 'muted'); }
      if (action === 'clear-excluded') { setJsonStored(excludedKey(feature), []); if (lastByFeature[feature]) lastByFeature[feature] = buildFilteredData(feature, lastByFeature[feature].rawData || lastByFeature[feature]); refreshFeaturePreview(feature); setStatus(feature, 'Cleared excluded literature context.', 'muted'); }
      if (action === 'preview') {
        const q = clean(el(feature + 'KnowledgeManualQuery')?.value || el(feature + 'KnowledgeManualSearch')?.value || '');
        await retrieve({ feature, query: q, focus: q, workflow: feature + '-manual-preview', defaultEnabled: true, forceEnabled: true, topK: topK(feature) });
      }
    }, true);
  }
  function sourceForRetrieval(options = {}) {
    const explicit = clean(options.latexSource || options.source || '');
    if (explicit) return truncateMiddle(explicit, options.maxSourceChars || 60000);
    const active = activeSource(true);
    return truncateMiddle(active.text, options.maxSourceChars || 60000);
  }
  async function retrieve(options = {}) {
    const feature = clean(options.feature || 'knowledge');
    if (!options.forceEnabled && !enabled(feature, !!options.defaultEnabled)) {
      lastByFeature[feature] = null;
      setStatus(feature, 'Knowledge/literature context disabled for this run.', 'muted');
      return null;
    }
    rememberUi(feature);
    const k = Math.max(1, Math.min(12, Number(options.topK || topK(feature, DEFAULT_TOP_K)) || DEFAULT_TOP_K));
    const query = clean(options.query || options.focus || options.userInstructions || options.paperSummary || '');
    const payload = {
      topK: k,
      query,
      focus: clean(options.focus || options.userInstructions || ''),
      paperTitle: clean(options.paperTitle || ''),
      paperSummary: clean(options.paperSummary || ''),
      abstract: clean(options.abstract || ''),
      reviewText: clean(options.reviewText || ''),
      pinnedPapers: pinnedResults(feature).slice(0, 20).map((r) => ({
        key: r.key, title: r.title, authors: r.authors, year: r.year, url: r.url, arxiv_id: r.arxiv_id
      })),
      retrievalMode: retrievalMode(feature),
      latexSource: sourceForRetrieval(options),
      workflow: clean(options.workflow || feature),
      metadata: { frontendStage: STAGE, feature, activePath: activePath(), ...(options.metadata || {}) }
    };
    setStatus(feature, `Retrieving literature context from knowledge database (topK=${k})...`, 'warn');
    try {
      const rawData = await postBackend('/knowledge/context-for-paper', payload, { allowOkFalse: true });
      const data = buildFilteredData(feature, rawData);
      data.rawData = rawData;
      lastByFeature[feature] = data;
      setStatus(feature, resultsSummary(data), data?.ok === false ? 'bad' : 'good');
      renderPreview(feature, data);
      return data;
    } catch (err) {
      const data = { ok: false, error: err?.message || String(err), promptContext: 'Knowledge retriever failed: ' + (err?.message || String(err)) };
      lastByFeature[feature] = data;
      setStatus(feature, resultsSummary(data), 'bad');
      renderPreview(feature, data);
      return data;
    }
  }
  function installUiPersistence(feature) {
    bindPreviewEvents();
    const cb = el(checkboxId(feature));
    const tk = el(topKId(feature));
    const mode = el(String(feature || 'knowledge') + 'KnowledgeMode');
    if (cb) {
      const stored = getStored('latexai:knowledge-enabled:' + feature, '');
      if (stored) cb.checked = stored === 'true';
      cb.addEventListener('change', () => rememberUi(feature));
    }
    if (tk) {
      const stored = getStored('latexai:knowledge-topk:' + feature, '');
      if (stored) tk.value = stored;
      tk.addEventListener('change', () => rememberUi(feature));
    }
    if (mode) {
      const storedMode = getStored(modeKey(feature), 'automatic_pinned');
      mode.value = retrievalMode(feature, storedMode);
      mode.addEventListener('change', () => { storeRetrievalMode(feature); if (lastByFeature[feature]) lastByFeature[feature] = buildFilteredData(feature, lastByFeature[feature].rawData || lastByFeature[feature]); refreshFeaturePreview(feature); });
    }
    refreshFeaturePreview(feature);
  }
  function controlHtml(feature, label = 'Use knowledge/literature context', defaultTopK = DEFAULT_TOP_K) {
    const f = String(feature || 'knowledge');
    return [
      '<div class="settings-card-subtle knowledge-context-controls" data-knowledge-feature="' + f + '">',
      '  <div class="field-grid two">',
      '    <label class="field checkbox-field"><input id="' + f + 'UseKnowledge" type="checkbox" /> ' + label + '</label>',
      '    <label class="field">Knowledge topK <input id="' + f + 'KnowledgeTopK" type="number" min="1" max="12" step="1" value="' + defaultTopK + '" /></label>',
      '  </div>',
      '  <div class="field-grid two">',
      '    <label class="field">Retrieval mode <select id="' + f + 'KnowledgeMode">',
      '      <option value="automatic_pinned">automatic + pinned</option>',
      '      <option value="automatic">automatic only</option>',
      '      <option value="pinned_only">pinned only</option>',
      '    </select></label>',
      '    <label class="field">Manual preview query <input id="' + f + 'KnowledgeManualQuery" type="text" placeholder="optional search/preview query" /></label>',
      '  </div>',
      '  <div class="document-ai-actions knowledge-preview-actions">',
      '    <button class="btn mini" type="button" data-knowledge-preview-action="preview" data-knowledge-feature="' + f + '">Preview retrieved context</button>',
      '    <button class="btn mini" type="button" data-knowledge-preview-action="clear-pins" data-knowledge-feature="' + f + '">Clear pins</button>',
      '    <button class="btn mini" type="button" data-knowledge-preview-action="clear-excluded" data-knowledge-feature="' + f + '">Clear exclusions</button>',
      '  </div>',
      '  <div id="' + f + 'KnowledgeStatus" class="settings-note compact">Knowledge/literature context is off. Enable it to retrieve relevant ingested-library papers before the AI run.</div>',
      '  <div id="' + f + 'KnowledgePreview" class="knowledge-context-preview"><div class="settings-note compact">Retrieved context preview will appear here. Pin papers to force them into later reviews.</div></div>',
      '</div>'
    ].join('');
  }


  function cloneControlNode(feature, label, defaultTopK) {
    const holder = D.createElement('div');
    holder.innerHTML = controlHtml(feature, label, defaultTopK);
    return holder.firstElementChild;
  }

  function replaceOrInsertControl(feature, label, defaultTopK, options = {}) {
    const f = String(feature || 'knowledge');
    let existing = D.querySelector('.knowledge-context-controls[data-knowledge-feature="' + f + '"]');
    const oldChecked = !!el(f + 'UseKnowledge')?.checked;
    const oldTopK = el(f + 'KnowledgeTopK')?.value || '';
    const oldMode = el(f + 'KnowledgeMode')?.value || '';
    const needsFullPreview = !existing || !existing.querySelector('[data-knowledge-preview-action="preview"]') || !existing.querySelector('#' + f + 'KnowledgeMode') || !existing.querySelector('#' + f + 'KnowledgePreview');
    if (existing && needsFullPreview) {
      const fresh = cloneControlNode(f, label, defaultTopK);
      existing.replaceWith(fresh);
      existing = fresh;
    }
    if (!existing) {
      const fresh = cloneControlNode(f, label, defaultTopK);
      const before = options.before ? D.querySelector(options.before) : null;
      const after = options.after ? D.querySelector(options.after) : null;
      const container = options.container ? D.querySelector(options.container) : null;
      if (before && before.parentNode) before.parentNode.insertBefore(fresh, before);
      else if (after && after.parentNode) after.parentNode.insertBefore(fresh, after.nextSibling);
      else if (container) container.appendChild(fresh);
      else return false;
      existing = fresh;
    }
    if (oldChecked && el(f + 'UseKnowledge')) el(f + 'UseKnowledge').checked = true;
    if (oldTopK && el(f + 'KnowledgeTopK')) el(f + 'KnowledgeTopK').value = oldTopK;
    if (oldMode && el(f + 'KnowledgeMode')) el(f + 'KnowledgeMode').value = oldMode;
    try { installUiPersistence(f); } catch (_err) {}
    return true;
  }

  function ensureGlobalKnowledgeControlSurfaces() {
    // Stage 19U3: make the full preview/pin/exclude control surface appear for all
    // knowledge-aware workflows, including older static cards that were mounted before
    // this service was available. This avoids the feature-specific situation where only
    // Competitive Review showed retrieval preview controls.
    replaceOrInsertControl('documentAi', 'Use knowledge/literature context for Paper-level AI', 5, {
      before: '#documentAiPrompt',
      container: '#documentAiCard'
    });
    replaceOrInsertControl('reviewerSim', 'Use knowledge/literature context for Reviewer/Rebuttal simulator', 5, {
      after: '#reviewerSimInstructions',
      container: '#reviewerRebuttalCard'
    });
    replaceOrInsertControl('competitive', 'Use knowledge/literature context for competitive review/improver', 5, {
      before: '#competitiveExtraInstructions',
      container: '#competitiveReviewCard'
    });
    // Devil's Advocate branch runner still has its own retrieval call path, but it also
    // benefits from the same preview/pinning UI if the card is present.
    replaceOrInsertControl('branchWorkflow', 'Use knowledge/literature context for Devil\'s Advocate branch runner', 5, {
      after: '#branchWorkflowQuery',
      container: '#realAgentBranchWorkflowCard'
    });
  }

  function installGlobalKnowledgeControlWatchdog() {
    let ticks = 0;
    const run = () => {
      ticks += 1;
      try { ensureGlobalKnowledgeControlSurfaces(); } catch (_err) {}
      if (ticks > 40) return;
      setTimeout(run, ticks < 8 ? 350 : 1200);
    };
    if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  }

  NS.KnowledgeContextService = {
    STAGE,
    enabled,
    topK,
    retrieve,
    promptBlock,
    resultsSummary,
    controlHtml,
    renderPreview,
    refreshFeaturePreview,
    pinResult,
    unpinResult,
    excludeResult,
    includeResult,
    pinnedResults,
    retrievalMode,
    installUiPersistence,
    ensureGlobalKnowledgeControlSurfaces,
    getLast: (feature) => lastByFeature[feature] || null,
    backendRoot,
    activeSource,
  };
  installGlobalKnowledgeControlWatchdog();
  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

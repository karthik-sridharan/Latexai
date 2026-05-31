/* Latexai Stage 19U KnowledgeContextService
 * Shared literature/knowledge retrieval bridge for AI review/edit workflows.
 * Uses the existing backend /api/lumina/research/context-for-paper route and
 * returns a compact promptContext packet that agents can consume.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19u-knowledge-aware-review-agents-foundation-20260531-1';
  const DEFAULT_TOP_K = 5;

  let lastByFeature = {};

  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }
  function getStored(key, fallback = '') {
    try { const v = W.localStorage?.getItem?.(key); return v == null || v === '' ? fallback : v; } catch (_err) { return fallback; }
  }
  function setStored(key, value) { try { W.localStorage?.setItem?.(key, String(value)); } catch (_err) {} }
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
    const cb = el(checkboxId(feature));
    const tk = el(topKId(feature));
    if (cb) setStored('latexai:knowledge-enabled:' + feature, cb.checked ? 'true' : 'false');
    if (tk) setStored('latexai:knowledge-topk:' + feature, topK(feature));
  }
  function setStatus(feature, message, kind = '') {
    const node = el(statusId(feature));
    if (!node) return;
    node.textContent = String(message || '');
    node.dataset.kind = kind || '';
  }
  function resultsSummary(data) {
    if (!data) return 'Knowledge context disabled.';
    if (data.ok === false) return 'Knowledge retriever failed: ' + (data.error || data.detail || 'unknown error');
    return `Knowledge retriever: ${data.resultCount || 0} paper(s) retrieved` + (data.searchSchema ? ` · ${data.searchSchema}` : '') + (data.topK ? ` · topK=${data.topK}` : '');
  }
  function promptBlock(data) {
    if (!data) return 'Knowledge/literature context is disabled for this run.';
    if (data.ok === false) return 'Knowledge/literature retrieval failed: ' + (data.error || data.detail || 'unknown error');
    const ctx = clean(data.promptContext || '');
    return ctx || 'No relevant ingested-library papers were retrieved.';
  }
  function sourceForRetrieval(options = {}) {
    const explicit = clean(options.latexSource || options.source || '');
    if (explicit) return truncateMiddle(explicit, options.maxSourceChars || 60000);
    const active = activeSource(true);
    return truncateMiddle(active.text, options.maxSourceChars || 60000);
  }
  async function retrieve(options = {}) {
    const feature = clean(options.feature || 'knowledge');
    if (!enabled(feature, !!options.defaultEnabled)) {
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
      latexSource: sourceForRetrieval(options),
      workflow: clean(options.workflow || feature),
      metadata: { frontendStage: STAGE, feature, activePath: activePath(), ...(options.metadata || {}) }
    };
    setStatus(feature, `Retrieving literature context from knowledge database (topK=${k})...`, 'warn');
    try {
      const data = await postBackend('/research/context-for-paper', payload, { allowOkFalse: true });
      lastByFeature[feature] = data;
      setStatus(feature, resultsSummary(data), data?.ok === false ? 'bad' : 'good');
      return data;
    } catch (err) {
      const data = { ok: false, error: err?.message || String(err), promptContext: 'Knowledge retriever failed: ' + (err?.message || String(err)) };
      lastByFeature[feature] = data;
      setStatus(feature, resultsSummary(data), 'bad');
      return data;
    }
  }
  function installUiPersistence(feature) {
    const cb = el(checkboxId(feature));
    const tk = el(topKId(feature));
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
  }
  function controlHtml(feature, label = 'Use knowledge/literature context', defaultTopK = DEFAULT_TOP_K) {
    const f = String(feature || 'knowledge');
    return [
      '<div class="settings-card-subtle knowledge-context-controls" data-knowledge-feature="' + f + '">',
      '  <div class="field-grid two">',
      '    <label class="field checkbox-field"><input id="' + f + 'UseKnowledge" type="checkbox" /> ' + label + '</label>',
      '    <label class="field">Knowledge topK <input id="' + f + 'KnowledgeTopK" type="number" min="1" max="12" step="1" value="' + defaultTopK + '" /></label>',
      '  </div>',
      '  <div id="' + f + 'KnowledgeStatus" class="settings-note compact">Knowledge/literature context is off. Enable it to retrieve relevant ingested-library papers before the AI run.</div>',
      '</div>'
    ].join('');
  }

  NS.KnowledgeContextService = {
    STAGE,
    enabled,
    topK,
    retrieve,
    promptBlock,
    resultsSummary,
    controlHtml,
    installUiPersistence,
    getLast: (feature) => lastByFeature[feature] || null,
    backendRoot,
    activeSource,
  };
  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

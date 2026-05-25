/* Latexai Stage 18Y BackendUrlSettingsService
 * Stage: stage18z-memory-aware-notation-citation-retrieval-20260524-1
 *
 * Keeps backend endpoint configuration in the Settings tab:
 * - AI backend proxy URL remains the existing AI proxy route.
 * - Compile backend URL remains the existing compiler route.
 * - Memory backend URL is separate and points to the Neon-backed memory service.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage18z-memory-aware-notation-citation-retrieval-20260524-1';

  const LS_AI_PROXY_URL = 'lumina-latex.ai.proxyUrl';
  const LS_AI_PROXY_TOKEN = 'lumina-latex.ai.proxyToken';
  const LS_MEMORY_BACKEND_URL = 'lumina-latex.memory.backendUrl';
  const LS_MEMORY_PROXY_TOKEN = 'lumina-latex.memory.proxyToken';

  const DEFAULT_AI_PROXY_URL = '/api/lumina/ai';
  const DEFAULT_MEMORY_BACKEND_URL = 'https://lumina-latex-backend-zugntkn2la-ue.a.run.app';

  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }

  function safeGet(key, fallback = '') {
    try { return clean(W.localStorage?.getItem?.(key)) || fallback; } catch (_err) { return fallback; }
  }

  function safeSet(key, value) {
    try { W.localStorage?.setItem?.(key, clean(value)); } catch (_err) {}
  }

  function normalizeMemoryApiBase(raw) {
    const value = clean(raw) || DEFAULT_MEMORY_BACKEND_URL;
    try {
      const url = new URL(value, W.location?.href || DEFAULT_MEMORY_BACKEND_URL + '/');
      url.search = '';
      url.hash = '';
      url.pathname = url.pathname
        .replace(/\/api\/lumina\/latex\/compile(?:\/jobs)?\/?$/i, '/api/lumina/memory')
        .replace(/\/api\/lumina\/ai(?:\/status|\/workflows|\/models)?\/?$/i, '/api/lumina/memory')
        .replace(/\/api\/lumina\/models\/?$/i, '/api/lumina/memory')
        .replace(/\/api\/lumina\/memory(?:\/.+)?$/i, '/api/lumina/memory');
      if (!/\/api\/lumina\/memory\/?$/i.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/+$/, '') + '/api/lumina/memory';
      }
      return url.href.replace(/\/$/, '');
    } catch (_err) {
      return value
        .replace(/\/api\/lumina\/latex\/compile(?:\/jobs)?\/?$/i, '/api/lumina/memory')
        .replace(/\/api\/lumina\/ai(?:\/status|\/workflows|\/models)?\/?$/i, '/api/lumina/memory')
        .replace(/\/api\/lumina\/models\/?$/i, '/api/lumina/memory')
        .replace(/\/api\/lumina\/memory(?:\/.+)?$/i, '/api/lumina/memory')
        .replace(/\/$/, '') || DEFAULT_MEMORY_BACKEND_URL + '/api/lumina/memory';
    }
  }

  function getAiProxyUrl() {
    return clean(el('aiProxyUrl')?.value) || safeGet(LS_AI_PROXY_URL, DEFAULT_AI_PROXY_URL);
  }

  function getAiProxyToken() {
    return clean(el('aiProxyToken')?.value) || safeGet(LS_AI_PROXY_TOKEN, '');
  }

  function getMemoryBackendUrl() {
    return clean(el('memoryBackendUrl')?.value) || safeGet(LS_MEMORY_BACKEND_URL, DEFAULT_MEMORY_BACKEND_URL);
  }

  function getMemoryApiBaseUrl() {
    return normalizeMemoryApiBase(getMemoryBackendUrl());
  }

  function getMemoryProxyToken() {
    // Stage 18Y: keep memory auth independent from AI/compile auth.
    // Reusing an AI proxy token against the memory service can make writes fail silently.
    return clean(el('memoryProxyToken')?.value) || safeGet(LS_MEMORY_PROXY_TOKEN, '');
  }


  function memoryHeaders(options = {}) {
    const headers = {};
    const token = getMemoryProxyToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const method = clean(options.method || 'GET').toUpperCase();
    const hasBody = options.body !== undefined && options.body !== null;
    // Stage 18Y: do not attach Content-Type to simple GET checks.
    // On iPad/Safari/Brave, Content-Type + cache:no-store can trigger a
    // preflight with cache-control/pragma headers that Cloud Run/CORS may reject
    // as a generic "Load failed". POST requests still send JSON.
    if (hasBody || method !== 'GET') headers['Content-Type'] = 'application/json';
    return headers;
  }

  function setMemoryStatus(text, detail, ok = null) {
    const title = el('memoryBackendStatusText');
    const body = el('memoryBackendStatusDetail');
    const card = el('memoryBackendStatusCard');
    if (title) title.textContent = text || 'Not checked';
    if (body) body.textContent = detail || '';
    if (card) {
      card.classList.toggle('ok', ok === true);
      card.classList.toggle('bad', ok === false);
    }
  }

  async function memoryRequest(path, options = {}) {
    const base = getMemoryApiBaseUrl();
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers: { ...memoryHeaders(options), ...(options.headers || {}) }
    });
    const text = await response.text().catch(() => '');
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_err) { json = { raw: text }; }
    if (!response.ok || json.ok === false) {
      throw new Error(json?.detail || json?.error?.message || `HTTP ${response.status}`);
    }
    return json;
  }

  async function testMemoryBackend() {
    const base = getMemoryApiBaseUrl();
    safeSet(LS_MEMORY_BACKEND_URL, getMemoryBackendUrl());
    safeSet(LS_MEMORY_PROXY_TOKEN, getMemoryProxyToken());
    safeSet('latexai:memory-enabled', 'true');
    setMemoryStatus('Testing memory backend...', `Checking ${base}`, null);
    try {
      const health = await memoryRequest('/health');
      const stamp = Date.now().toString(36);
      const scope = await memoryRequest('/scope', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'local-user',
          projectId: 'settings-memory-test-project',
          paperId: `settings-memory-test-paper-${stamp}`,
          sessionId: `settings-memory-test-session-${stamp}`,
          scope: 'paper',
          titleGuess: 'Settings memory backend browser test',
          documentFingerprint: `settings-memory-test-${stamp}`,
          sourceHash: stamp,
          metadata: { stage: STAGE, reason: 'ipad-settings-memory-backend-test' }
        })
      });
      const counts = health?.counts || {};
      setMemoryStatus(
        'Memory backend OK',
        `Connected to ${base}. Browser write succeeded: ${scope?.ok ? 'yes' : 'unknown'}. Storage: ${health?.storage?.backend || 'unknown'}; events=${counts.events ?? '?'} facts=${counts.facts ?? '?'} scopes=${counts.scopes ?? '?'}.`,
        true
      );
      return { ok: true, base, health, scope, stage: STAGE };
    } catch (err) {
      setMemoryStatus('Memory backend failed', `${base}: ${err?.message || err}. If this says Load failed, verify the backend CORS env includes https://karthik-sridharan.github.io and that the memory backend URL has no /api/lumina/memory suffix.`, false);
      return { ok: false, base, error: err?.message || String(err), stage: STAGE };
    }
  }

  function syncInput(id, storageKey, fallback) {
    const node = el(id);
    if (!node) return false;
    const saved = safeGet(storageKey, '');
    if (saved) node.value = saved;
    else if (!clean(node.value) && fallback) node.value = fallback;
    const persist = () => safeSet(storageKey, node.value || fallback || '');
    node.addEventListener('change', persist);
    node.addEventListener('blur', persist);
    return true;
  }

  function init() {
    syncInput('aiProxyUrl', LS_AI_PROXY_URL, DEFAULT_AI_PROXY_URL);
    syncInput('aiProxyToken', LS_AI_PROXY_TOKEN, '');
    syncInput('memoryBackendUrl', LS_MEMORY_BACKEND_URL, DEFAULT_MEMORY_BACKEND_URL);
    syncInput('memoryProxyToken', LS_MEMORY_PROXY_TOKEN, '');
    if (!safeGet('latexai:memory-enabled', '')) safeSet('latexai:memory-enabled', 'true');
    const testBtn = el('testMemoryBackendBtn');
    if (testBtn && !testBtn.dataset.boundStage18x6) {
      testBtn.dataset.boundStage18x6 = 'true';
      testBtn.addEventListener('click', () => { testMemoryBackend(); });
    }
    return true;
  }

  NS.BackendUrlSettingsService = {
    STAGE,
    init,
    normalizeMemoryApiBase,
    getAiProxyUrl,
    getAiProxyToken,
    getMemoryBackendUrl,
    getMemoryApiBaseUrl,
    getMemoryProxyToken,
    testMemoryBackend
  };
  NS.BackendUrlSettings = NS.BackendUrlSettingsService;

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else setTimeout(init, 0);
})();

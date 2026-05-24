/* Latexai Stage 18X4 BackendUrlSettingsService
 * Stage: stage18x4-separate-memory-backend-settings-20260524-1
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
  const STAGE = 'stage18x4-separate-memory-backend-settings-20260524-1';

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
    return clean(el('memoryProxyToken')?.value) || safeGet(LS_MEMORY_PROXY_TOKEN, '') || getAiProxyToken() || clean(el('compileProxyToken')?.value);
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
    getMemoryProxyToken
  };
  NS.BackendUrlSettings = NS.BackendUrlSettingsService;

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else setTimeout(init, 0);
})();

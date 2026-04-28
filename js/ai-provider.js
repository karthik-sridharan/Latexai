(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});

  const FALLBACK_MODELS = {
    openai: [
      { value: 'gpt-4.1-mini', label: 'OpenAI · gpt-4.1-mini' },
      { value: 'gpt-4.1', label: 'OpenAI · gpt-4.1' }
    ],
    anthropic: [
      { value: 'claude-sonnet-4-5', label: 'Claude · claude-sonnet-4-5' },
      { value: 'claude-haiku-4-5', label: 'Claude · claude-haiku-4-5' }
    ],
    gemini: [
      { value: 'gemini-2.5-flash', label: 'Gemini · gemini-2.5-flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini · gemini-2.5-pro' }
    ]
  };

  const LS_PROVIDER = 'lumina-latex.ai.provider';
  const LS_MODEL_PREFIX = 'lumina-latex.ai.model.';
  const LS_PROXY_URL = 'lumina-latex.ai.proxyUrl';
  const LS_PROXY_TOKEN = 'lumina-latex.ai.proxyToken';
  let remoteModels = null;

  function getProxyUrl() {
    return document.getElementById('aiProxyUrl')?.value?.trim() || localStorage.getItem(LS_PROXY_URL) || '/api/lumina/ai';
  }

  function getConfig() {
    const provider = document.getElementById('aiProvider')?.value || localStorage.getItem(LS_PROVIDER) || 'openai';
    const model = document.getElementById('aiModel')?.value || localStorage.getItem(`${LS_MODEL_PREFIX}${provider}`) || '';
    return {
      provider,
      model,
      proxyUrl: getProxyUrl(),
      proxyToken: document.getElementById('aiProxyToken')?.value?.trim() || localStorage.getItem(LS_PROXY_TOKEN) || ''
    };
  }

  function persistConfig() {
    const config = getConfig();
    localStorage.setItem(LS_PROVIDER, config.provider);
    localStorage.setItem(`${LS_MODEL_PREFIX}${config.provider}`, config.model || '');
    localStorage.setItem(LS_PROXY_URL, config.proxyUrl || '/api/lumina/ai');
    localStorage.setItem(LS_PROXY_TOKEN, config.proxyToken || '');
    return config;
  }

  function modelsFor(provider) {
    return (remoteModels && remoteModels[provider]) || FALLBACK_MODELS[provider] || [];
  }

  async function loadModelsFromProxy() {
    const proxyUrl = getProxyUrl();
    const modelsUrl = proxyUrl.replace(/\/api\/lumina\/ai\/?$/, '/api/lumina/models');
    try {
      const response = await fetch(modelsUrl);
      const data = await response.json();
      if (!response.ok || !data?.ok || !data?.providers) return false;
      const mapped = {};
      for (const [provider, list] of Object.entries(data.providers)) {
        mapped[provider] = (list || []).map((item) => ({ value: item.model, label: `${provider} · ${item.model}` }));
      }
      remoteModels = mapped;
      return true;
    } catch (_err) {
      return false;
    }
  }

  async function ask(payload, meta = {}) {
    const config = persistConfig();
    const headers = { 'Content-Type': 'application/json' };
    if (config.proxyToken) headers.Authorization = `Bearer ${config.proxyToken}`;
    const body = {
      schema: 'lumina-latex-ai-request-v1',
      provider: config.provider,
      model: config.model,
      task: meta.task || 'latex-copilot',
      payload,
      context: meta.context || {},
      client: { app: 'lumina-latex-editor', stage: W.LUMINA_LATEX_STAGE || 'stage1b', sentAt: new Date().toISOString() }
    };
    const response = await fetch(config.proxyUrl, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data?.error?.message || data?.message || `AI proxy failed with HTTP ${response.status}.`);
    return data;
  }

  function extractText(data) {
    if (typeof data?.text === 'string') return data.text;
    if (typeof data?.output_text === 'string') return data.output_text;
    if (Array.isArray(data?.output)) return data.output.flatMap((item) => item.content || []).map((c) => c.text || '').join('\n').trim();
    return JSON.stringify(data, null, 2);
  }

  NS.AIProvider = {
    FALLBACK_MODELS,
    LS_PROVIDER,
    LS_MODEL_PREFIX,
    LS_PROXY_URL,
    LS_PROXY_TOKEN,
    getConfig,
    persistConfig,
    modelsFor,
    loadModelsFromProxy,
    ask,
    extractText
  };
})();

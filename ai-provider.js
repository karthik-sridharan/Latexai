(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});

  const FALLBACK_MODELS = {
    openai: [
      { value: 'gpt-4.1-mini', label: 'OpenAI · gpt-4.1-mini' },
      { value: 'gpt-4.1', label: 'OpenAI · gpt-4.1' },
      { value: 'gpt-4o-mini', label: 'OpenAI · gpt-4o-mini' },
      { value: 'gpt-4o', label: 'OpenAI · gpt-4o' },
      { value: 'gpt-5-mini', label: 'OpenAI · gpt-5-mini' },
      { value: 'gpt-5', label: 'OpenAI · gpt-5' },
      { value: 'gpt-5.1-mini', label: 'OpenAI · gpt-5.1-mini' },
      { value: 'gpt-5.1', label: 'OpenAI · gpt-5.1' },
      { value: 'gpt-5.4', label: 'OpenAI · gpt-5.4' }
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
  const LS_CUSTOM_MODEL_PREFIX = 'lumina-latex.ai.customModel.';
  const LS_PROXY_URL = 'lumina-latex.ai.proxyUrl';
  const LS_PROXY_TOKEN = 'lumina-latex.ai.proxyToken';
  let remoteModels = null;

  function getProxyUrl() {
    return NS.BackendUrlSettings?.getAiProxyUrl?.() || document.getElementById('aiProxyUrl')?.value?.trim() || localStorage.getItem(LS_PROXY_URL) || '/api/lumina/ai';
  }

  function getConfig() {
    const provider = document.getElementById('aiProvider')?.value || localStorage.getItem(LS_PROVIDER) || 'openai';
    const selectedModel = document.getElementById('aiModel')?.value || localStorage.getItem(`${LS_MODEL_PREFIX}${provider}`) || '';
    const customModel = document.getElementById('aiCustomModel')?.value?.trim() || localStorage.getItem(`${LS_CUSTOM_MODEL_PREFIX}${provider}`) || '';
    const model = customModel || selectedModel;
    return {
      provider,
      model,
      selectedModel,
      customModel,
      proxyUrl: getProxyUrl(),
      proxyToken: document.getElementById('aiProxyToken')?.value?.trim() || localStorage.getItem(LS_PROXY_TOKEN) || ''
    };
  }

  function persistConfig() {
    const config = getConfig();
    localStorage.setItem(LS_PROVIDER, config.provider);
    localStorage.setItem(`${LS_MODEL_PREFIX}${config.provider}`, config.selectedModel || config.model || '');
    localStorage.setItem(`${LS_CUSTOM_MODEL_PREFIX}${config.provider}`, config.customModel || '');
    localStorage.setItem(LS_PROXY_URL, config.proxyUrl || '/api/lumina/ai');
    localStorage.setItem(LS_PROXY_TOKEN, config.proxyToken || '');
    return config;
  }

  function modelsFor(provider) {
    const fromRegistry = NS.ModelRegistryService?.modelsFor?.(provider);
    if (Array.isArray(fromRegistry) && fromRegistry.length) {
      return fromRegistry.map((item) => ({ value: item.value, label: item.label || `${provider} · ${item.value}` }));
    }
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
      try { NS.ModelRegistryService?.refreshFromBackend?.(); } catch (_err) {}
      return true;
    } catch (_err) {
      return false;
    }
  }


  async function getStatus() {
    const config = getConfig();
    const statusUrl = config.proxyUrl.replace(/\/api\/lumina\/ai\/?$/, '/api/lumina/ai/status');
    const headers = {};
    if (config.proxyToken) headers.Authorization = `Bearer ${config.proxyToken}`;
    const response = await fetch(statusUrl, { headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data?.error?.message || `AI status failed with HTTP ${response.status}.`);
    return data;
  }

  async function getWorkflows() {
    const config = getConfig();
    const url = config.proxyUrl.replace(/\/api\/lumina\/ai\/?$/, '/api/lumina/ai/workflows');
    const headers = {};
    if (config.proxyToken) headers.Authorization = `Bearer ${config.proxyToken}`;
    const response = await fetch(url, { headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data?.error?.message || `AI workflows failed with HTTP ${response.status}.`);
    return data;
  }

  function routeKeyForAsk(payload = {}, meta = {}) {
    const haystack = [
      meta.routeKey,
      meta.task,
      meta.context?.workflow,
      meta.context?.agentRole,
      payload?.workflow,
      payload?.task,
      payload?.citationWorkflow,
      payload?.documentWorkflow
    ].map((v) => String(v || '').toLowerCase()).join(' ');
    if (/synthesizer|synthesis/.test(haystack)) return 'debate-synthesizer';
    if (/critic/.test(haystack)) return 'debate-critic';
    if (/advocate|supporter|defender/.test(haystack)) return 'debate-advocate';
    if (/competitive.*rank|ranking.*competitive/.test(haystack)) return 'competitive-ranking';
    if (/competitive|competitor/.test(haystack)) return 'competitive-improvement';
    if (/slide-repair|slide repair|math repair/.test(haystack)) return 'slide-repair';
    if (/citation|bibtex|cite/.test(haystack)) return 'citation';
    if (/presentation|beamer|talk/.test(haystack)) return 'presentation';
    if (/tikz|figure|image/.test(haystack)) return 'figure';
    if (/diagnostic|compile-log|backend|fix-error/.test(haystack)) return 'diagnostic';
    if (/paper|document|review|rewrite|debate/.test(haystack)) return 'paper';
    return 'default';
  }

  function validateRequestModel(provider, model, payload = {}, meta = {}) {
    const routeKey = routeKeyForAsk(payload, meta);
    const explicitProvider = meta.provider || payload?.provider || provider;
    const explicitModel = meta.model || payload?.model || model;
    const validation = NS.ModelRegistryService?.validateProviderModel?.(explicitProvider, explicitModel, { routeKey }) || { ok: true, provider: explicitProvider, model: explicitModel, repaired: false, reason: '' };
    return { ...validation, routeKey, requestedProvider: explicitProvider, requestedModel: explicitModel };
  }

  async function ask(payload, meta = {}) {
    if (NS.ModelRegistryService?.syncVisibleProviderModel && !meta.modelRoutingBypass && !payload?.modelRoutingBypass) {
      try { NS.ModelRegistryService.syncVisibleProviderModel({ repair: true }); } catch (_err) {}
    }
    const config = persistConfig();
    const modelDecision = validateRequestModel(config.provider, config.model, payload || {}, meta || {});
    const headers = { 'Content-Type': 'application/json' };
    if (config.proxyToken) headers.Authorization = `Bearer ${config.proxyToken}`;
    const body = {
      schema: 'lumina-latex-ai-request-v1',
      provider: modelDecision.provider || config.provider,
      model: modelDecision.model || config.model,
      task: meta.task || 'latex-copilot',
      payload,
      context: {
        ...(meta.context || {}),
        modelRoutingAudit: {
          stage: 'stage18a-model-routing-audit-validation-lock-1',
          routeKey: modelDecision.routeKey,
          requestedProvider: modelDecision.requestedProvider,
          requestedModel: modelDecision.requestedModel,
          provider: modelDecision.provider || config.provider,
          model: modelDecision.model || config.model,
          repaired: Boolean(modelDecision.repaired),
          reason: modelDecision.reason || ''
        }
      },
      client: { app: 'lumina-latex-editor', stage: W.LUMINA_LATEX_STAGE || 'stage1e', sentAt: new Date().toISOString() }
    };
    const response = await fetch(config.proxyUrl, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data?.error?.message || data?.message || `AI proxy failed with HTTP ${response.status}.`);
    if (modelDecision.repaired) data.modelRoutingAudit = body.context.modelRoutingAudit;
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
    LS_CUSTOM_MODEL_PREFIX,
    LS_PROXY_URL,
    LS_PROXY_TOKEN,
    getConfig,
    persistConfig,
    modelsFor,
    loadModelsFromProxy,
    getStatus,
    getWorkflows,
    validateRequestModel,
    ask,
    extractText
  };
})();

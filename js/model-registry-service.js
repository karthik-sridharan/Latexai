/* Latexai Stage 18A ModelRegistryService
 * Stage: stage18a-model-routing-audit-validation-lock-1
 *
 * Central model/provider registry used by Copilot, workflow routing, and future
 * multi-agent features. The registry prefers backend-reported allowed models,
 * falls back to conservative local defaults, and exposes a single validation API
 * so frontend routes do not silently select backend-unsupported models.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19n1q10-live-provider-model-discovery-1';
  const STORAGE_KEY = 'latexai:model-registry:v1';
  const LAST_STATUS_KEY = 'latexai:model-registry:last-status:v1';
  const LS_PROVIDER = 'lumina-latex.ai.provider';
  const LS_MODEL_PREFIX = 'lumina-latex.ai.model.';
  const LS_CUSTOM_MODEL_PREFIX = 'lumina-latex.ai.customModel.';
  const LS_PROXY_URL = 'lumina-latex.ai.proxyUrl';
  const LS_PROXY_TOKEN = 'lumina-latex.ai.proxyToken';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('model-registry-service')) {
    NS.ModelRegistryService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false,
      modelsFor: () => [],
      validateProviderModel: (_provider, _model) => ({ ok: true, repaired: false })
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  const ROUTES = [
    { key: 'default', title: 'Default / Copilot', hint: 'General Copilot, rewriting, advice', preferredTier: 'fast' },
    { key: 'paper', title: 'Total Paper Remake', hint: 'Review, remake, ranking, acceptance improvement', preferredTier: 'fast' },
    { key: 'citation', title: 'Citation AI', hint: 'Citation filler, missing BibTeX, citation audit', preferredTier: 'fast' },
    { key: 'presentation', title: 'Presentation export', hint: 'Paper → presentation JSON/HTML/Beamer', preferredTier: 'fast' },
    { key: 'figure', title: 'Figure/TikZ generation', hint: 'Image/TikZ and presentation figure assets', preferredTier: 'fast' },
    { key: 'slide-repair', title: 'Slide repair', hint: 'Imported slide math/text cleanup', preferredTier: 'fast' },
    { key: 'diagnostic', title: 'Diagnostics / logs', hint: 'Compile-log explanations and lightweight checks', preferredTier: 'fast' },
    { key: 'competitive-ranking', title: 'Competitive review · ranking', hint: 'Ranks competitor papers and estimates draft position', preferredTier: 'fast' },
    { key: 'competitive-improvement', title: 'Competitive review · improvement', hint: 'Produces ranking-aware improvement edits', preferredTier: 'fast' },
    { key: 'debate-advocate', title: 'Devil’s advocate · supporter', hint: 'Argues for the current draft', preferredTier: 'fast' },
    { key: 'debate-critic', title: 'Devil’s advocate · critic', hint: 'Attacks weaknesses in the draft', preferredTier: 'fast' },
    { key: 'debate-synthesizer', title: 'Devil’s advocate · synthesis', hint: 'Produces the balanced improvement plan', preferredTier: 'fast' }
  ];

  const PROVIDERS = {
    openai: {
      key: 'openai',
      title: 'OpenAI',
      defaultModel: 'gpt-5.4-mini',
      configured: null,
      allowCustomModels: false,
      allowAnyGptModel: false,
      customModelPattern: '',
      models: [
        { value: 'gpt-5.5', label: 'OpenAI · gpt-5.5', tier: 'strong', structuredJson: true, longContext: true, recommendedFor: ['paper', 'competitive-ranking', 'competitive-improvement', 'debate-critic', 'debate-synthesizer'] },
        { value: 'gpt-5.4', label: 'OpenAI · gpt-5.4', tier: 'strong', structuredJson: true, longContext: true, recommendedFor: ['paper', 'competitive-ranking', 'competitive-improvement', 'debate-critic', 'debate-synthesizer'] },
        { value: 'gpt-5.4-mini', label: 'OpenAI · gpt-5.4-mini', tier: 'fast', structuredJson: true, longContext: true, recommendedFor: ['default', 'paper', 'citation', 'presentation', 'figure', 'slide-repair', 'diagnostic', 'competitive-ranking', 'competitive-improvement', 'debate-advocate', 'debate-critic', 'debate-synthesizer'] },
        { value: 'gpt-5.4-nano', label: 'OpenAI · gpt-5.4-nano', tier: 'fast', structuredJson: true, longContext: true, recommendedFor: ['default', 'citation', 'diagnostic'] }
      ]
    },
    anthropic: {
      key: 'anthropic',
      title: 'Claude / Anthropic',
      defaultModel: 'claude-sonnet-4-5',
      configured: null,
      models: [
        { value: 'claude-sonnet-4-5', label: 'Claude · claude-sonnet-4-5', tier: 'strong', structuredJson: true, longContext: true, recommendedFor: ['paper', 'competitive-ranking', 'competitive-improvement', 'debate-critic', 'debate-synthesizer'] },
        { value: 'claude-haiku-4-5', label: 'Claude · claude-haiku-4-5', tier: 'fast', structuredJson: true, longContext: true, recommendedFor: ['default', 'citation', 'diagnostic', 'debate-advocate', 'slide-repair'] }
      ]
    },
    gemini: {
      key: 'gemini',
      title: 'Gemini / Google',
      defaultModel: 'gemini-3.5-flash',
      configured: null,
      allowCustomModels: false,
      customModelPattern: '',
      models: [
        { value: 'gemini-3.5-flash', label: 'Gemini · gemini-3.5-flash', tier: 'strong', structuredJson: true, longContext: true, recommendedFor: ['default', 'paper', 'competitive-ranking', 'competitive-improvement', 'debate-critic', 'debate-synthesizer'] },
        { value: 'gemini-3.1-pro-preview', label: 'Gemini · gemini-3.1-pro-preview', tier: 'strong', structuredJson: true, longContext: true, recommendedFor: ['paper', 'competitive-ranking', 'competitive-improvement', 'debate-critic', 'debate-synthesizer'] },
        { value: 'gemini-3-flash-preview', label: 'Gemini · gemini-3-flash-preview', tier: 'strong', structuredJson: true, longContext: true, recommendedFor: ['paper', 'competitive-ranking', 'competitive-improvement', 'debate-critic', 'debate-synthesizer'] },
        { value: 'gemini-3.1-flash-lite', label: 'Gemini · gemini-3.1-flash-lite', tier: 'fast', structuredJson: true, longContext: true, recommendedFor: ['default', 'citation', 'diagnostic', 'slide-repair', 'debate-advocate'] },
        { value: 'gemini-2.5-flash', label: 'Gemini · gemini-2.5-flash', tier: 'fast', structuredJson: true, longContext: true, recommendedFor: ['default', 'citation', 'presentation', 'figure', 'slide-repair', 'diagnostic', 'debate-advocate'] },
        { value: 'gemini-2.5-flash-lite', label: 'Gemini · gemini-2.5-flash-lite', tier: 'fast', structuredJson: true, longContext: true, recommendedFor: ['default', 'citation', 'diagnostic'] },
        { value: 'gemini-2.5-pro', label: 'Gemini · gemini-2.5-pro', tier: 'strong', structuredJson: true, longContext: true, recommendedFor: ['paper', 'competitive-ranking', 'competitive-improvement', 'debate-critic', 'debate-synthesizer'] }
      ]
    }
  };

  let registry = cloneRegistry(PROVIDERS);
  let lastBackendStatus = readCachedStatus();
  let lastRefreshError = '';

  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function cloneRegistry(obj) { return clone(obj); }
  function nowIso() { return new Date().toISOString(); }
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function safeLocalGet(key, fallback = '') {
    try { return localStorage.getItem(key) || fallback; } catch (_err) { return fallback; }
  }

  function safeLocalSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_err) {}
  }


  const DEPRECATED_MODEL_ALIASES = {
    openai: {
      'gpt-5.1-mini': 'gpt-5.4-mini',
      'gpt 5.1 mini': 'gpt-5.4-mini',
      'gpt-5.1': 'gpt-5.4',
      'gpt 5.1': 'gpt-5.4'
    }
  };

  function normalizeDeprecatedModel(provider, model) {
    const p = clean(provider || 'openai').toLowerCase();
    const m = clean(model || '');
    if (!m) return m;
    return DEPRECATED_MODEL_ALIASES[p]?.[m.toLowerCase()] || m;
  }

  function isDeprecatedModel(provider, model) {
    const p = clean(provider || 'openai').toLowerCase();
    const m = clean(model || '').toLowerCase();
    return Boolean(DEPRECATED_MODEL_ALIASES[p]?.[m]);
  }

  function readCachedStatus() {
    try { return JSON.parse(localStorage.getItem(LAST_STATUS_KEY) || 'null'); } catch (_err) { return null; }
  }

  function proxyUrl() {
    return clean(el('aiProxyUrl')?.value) || safeLocalGet(LS_PROXY_URL, '/api/lumina/ai') || '/api/lumina/ai';
  }

  function proxyToken() {
    return clean(el('aiProxyToken')?.value) || safeLocalGet(LS_PROXY_TOKEN, '');
  }

  function replaceAiPath(raw, nextPath) {
    try {
      const u = new URL(raw || '/api/lumina/ai', W.location.href);
      u.pathname = u.pathname.replace(/\/api\/lumina\/ai\/?$/i, nextPath);
      u.search = '';
      return u.href;
    } catch (_err) {
      return String(raw || '/api/lumina/ai').replace(/\/api\/lumina\/ai\/?$/i, nextPath);
    }
  }

  function statusUrl() { return replaceAiPath(proxyUrl(), '/api/lumina/ai/status'); }
  function modelsUrl() { return replaceAiPath(proxyUrl(), '/api/lumina/models'); }

  function providerTitle(provider) {
    return registry[provider]?.title || PROVIDERS[provider]?.title || provider;
  }

  function fallbackModelMeta(provider, model) {
    const known = (PROVIDERS[provider]?.models || []).find((m) => m.value === model);
    if (known) return clone(known);
    const title = providerTitle(provider);
    return {
      value: model,
      label: `${title} · ${model}`,
      tier: modelTierGuess(model),
      structuredJson: true,
      longContext: null,
      recommendedFor: []
    };
  }

  function modelTierGuess(model) {
    const value = clean(model).toLowerCase();
    if (/mini|flash|haiku|small|lite|nano/.test(value)) return 'fast';
    if (/pro|sonnet|opus|4\.1$|5\.4$|5\.5$|strong/.test(value)) return 'strong';
    return 'standard';
  }

  function shouldKeepLocalModelList(provider) {
    // Stage 19N1Q10: when the backend returns account/provider-discovered models,
    // use exactly that list for the dropdown. This prevents stale model IDs such as
    // gpt-5.1-mini or deprecated Gemini models from remaining selectable.
    return false;
  }

  function mergeModelLists(provider, baseModels, allowedModels) {
    const byValue = new Map();
    const add = (model, backendAllowed = false) => {
      const value = clean(model?.value || model?.model || model);
      if (!value) return;
      const previous = byValue.get(value) || {};
      const meta = typeof model === 'object' ? model : fallbackModelMeta(provider, value);
      byValue.set(value, {
        ...fallbackModelMeta(provider, value),
        ...previous,
        ...meta,
        value,
        backendAllowed: Boolean(previous.backendAllowed || backendAllowed)
      });
    };
    (baseModels || []).forEach((model) => add(model, false));
    (allowedModels || []).forEach((model) => add(model, true));
    return Array.from(byValue.values());
  }

  function normalizeProviderInfo(provider, info) {
    const base = registry[provider] || PROVIDERS[provider] || { key: provider, title: provider, defaultModel: '', models: [] };
    if (typeof info === 'boolean') return { ...base, configured: info };
    if (!info || typeof info !== 'object') return base;
    return {
      ...base,
      configured: typeof info.configured === 'boolean' ? info.configured : base.configured,
      defaultModel: clean(info.defaultModel || base.defaultModel),
      allowedModels: Array.isArray(info.allowedModels) ? info.allowedModels.map(clean).filter(Boolean) : base.allowedModels,
      webSearch: info.webSearch || base.webSearch || null,
      capabilities: info.capabilities || base.capabilities || null,
      allowCustomModels: typeof info.allowCustomModels === 'boolean' ? info.allowCustomModels : Boolean(base.allowCustomModels),
      allowAnyGptModel: typeof info.allowAnyGptModel === 'boolean' ? info.allowAnyGptModel : Boolean(base.allowAnyGptModel),
      customModelPattern: clean(info.customModelPattern || base.customModelPattern || '')
    };
  }

  function applyBackendModels(status, modelListing) {
    const next = cloneRegistry(PROVIDERS);
    const statusProviders = status?.modelRegistry?.providers || status?.providers || {};
    const listingProviders = modelListing?.providers || {};
    const providerKeys = new Set([...Object.keys(next), ...Object.keys(statusProviders), ...Object.keys(listingProviders)]);

    providerKeys.forEach((provider) => {
      const fromStatus = normalizeProviderInfo(provider, statusProviders[provider]);
      const fromListing = listingProviders[provider];
      const statusAllowed = Array.isArray(fromStatus.allowedModels) ? fromStatus.allowedModels : [];
      const listingAllowed = Array.isArray(fromListing) ? fromListing.map((item) => clean(item?.model || item?.value || item)).filter(Boolean) : [];
      const allowed = [...new Set([...statusAllowed, ...listingAllowed])].filter(Boolean).filter((model) => !isDeprecatedModel(provider, model));
      const baseModels = next[provider]?.models || PROVIDERS[provider]?.models || [];
      const models = shouldKeepLocalModelList(provider)
        ? mergeModelLists(provider, baseModels, allowed)
        : (allowed.length
          ? allowed.map((model) => ({ ...fallbackModelMeta(provider, model), backendAllowed: true }))
          : baseModels.map((model) => ({ ...model, backendAllowed: false })));
      const defaultModel = clean(fromStatus.defaultModel || next[provider]?.defaultModel || models[0]?.value || '');
      if (defaultModel && !models.some((m) => m.value === defaultModel)) models.unshift({ ...fallbackModelMeta(provider, defaultModel), backendAllowed: true });
      next[provider] = {
        ...(next[provider] || { key: provider, title: provider }),
        ...fromStatus,
        key: provider,
        title: fromStatus.title || next[provider]?.title || provider,
        defaultModel,
        models,
        backendChecked: Boolean(status || modelListing),
        allowedModels: models.map((m) => m.value),
        lastUpdated: nowIso()
      };
    });

    registry = next;
    lastBackendStatus = status || lastBackendStatus || null;
    safeLocalSet(LAST_STATUS_KEY, JSON.stringify({ status, modelListing, savedAt: nowIso() }));
    safeLocalSet(STORAGE_KEY, JSON.stringify({ schema: 'latexai-model-registry-cache-v1', stage: STAGE, registry, savedAt: nowIso() }));
    return registry;
  }

  async function fetchJson(url, token) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, { headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data?.error?.message || data?.message || `HTTP ${response.status}`);
    return data;
  }

  async function refreshFromBackend() {
    const token = proxyToken();
    lastRefreshError = '';
    let status = null;
    let modelListing = null;
    try { status = await fetchJson(statusUrl(), token); }
    catch (err) { lastRefreshError = `status: ${err.message || err}`; }
    try { modelListing = await fetchJson(modelsUrl(), token); }
    catch (err) { lastRefreshError = [lastRefreshError, `models: ${err.message || err}`].filter(Boolean).join('; '); }

    if (!status && !modelListing) throw new Error(lastRefreshError || 'Backend model registry refresh failed.');
    applyBackendModels(status, modelListing);
    syncVisibleProviderModel({ repair: true });
    updateRouteModelSelects({ repair: true });
    renderCard();
    emitUpdated();
    return registry;
  }

  function providerOptions(selected) {
    const keys = Object.keys(registry);
    return keys.map((key) => `<option value="${escapeHtml(key)}"${key === selected ? ' selected' : ''}>${escapeHtml(providerTitle(key))}</option>`).join('');
  }

  function modelsFor(provider, options = {}) {
    const p = clean(provider || 'openai');
    const models = registry[p]?.models || PROVIDERS[p]?.models || [];
    if (!options.routeKey) return models.slice();
    return models.slice().sort((a, b) => routeScore(options.routeKey, b) - routeScore(options.routeKey, a));
  }

  function routeScore(routeKey, model) {
    const route = ROUTES.find((item) => item.key === routeKey);
    let score = 0;
    if (Array.isArray(model.recommendedFor) && model.recommendedFor.includes(routeKey)) score += 20;
    if (route?.preferredTier && model.tier === route.preferredTier) score += 8;
    if (model.backendAllowed) score += 4;
    if (model.value === registry.openai?.defaultModel || model.value === registry[model.provider]?.defaultModel) score += 1;
    return score;
  }

  function modelOptions(provider, selected, routeKey = '') {
    const models = modelsFor(provider, { routeKey });
    const selectedModel = normalizeDeprecatedModel(provider, clean(selected));
    const hasSelected = models.some((m) => m.value === selectedModel);
    const backendChecked = isBackendChecked(provider);
    const list = hasSelected || !selectedModel || backendChecked ? models : [{ ...fallbackModelMeta(provider, selectedModel), backendAllowed: false, warning: 'not listed by backend' }, ...models];
    return list.map((m) => {
      const tags = [m.tier, m.backendAllowed ? 'allowed' : (registry[provider]?.backendChecked ? 'not-listed' : 'fallback')].filter(Boolean).join(' · ');
      const label = `${m.label || m.value}${tags ? ` (${tags})` : ''}`;
      return `<option value="${escapeHtml(m.value)}"${m.value === selectedModel ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
  }

  function isBackendChecked(provider) {
    return Boolean(registry[provider]?.backendChecked);
  }

  function isOpenAiGptModel(model) {
    return /^gpt(?:[-_.]?[A-Za-z0-9]+)*$/i.test(clean(model));
  }

  function isCustomModelAllowed(provider, model) {
    const p = clean(provider || '');
    const m = clean(model || '');
    if (!m) return false;
    const record = registry[p] || PROVIDERS[p] || {};
    if (p === 'openai' && (record.allowAnyGptModel || record.allowCustomModels) && isOpenAiGptModel(m)) return true;
    if (record.allowCustomModels && record.customModelPattern) {
      try { return new RegExp(record.customModelPattern, 'i').test(m); } catch (_err) {}
    }
    return false;
  }

  function validateProviderModel(provider, model, options = {}) {
    const p = clean(provider || 'openai');
    const m = clean(model || '');
    const providerOk = Boolean(registry[p]);
    const providerRecord = registry[p] || registry.openai;
    const models = modelsFor(providerOk ? p : 'openai', { routeKey: options.routeKey });
    const allowed = models.map((item) => item.value);
    const backendChecked = isBackendChecked(providerOk ? p : 'openai');
    const repairedDeprecated = normalizeDeprecatedModel(providerOk ? p : 'openai', m);
    if (providerOk && m && repairedDeprecated !== m) {
      return { ok: false, provider: p, model: repairedDeprecated, repaired: true, backendChecked, reason: `${p}/${m} is deprecated or unavailable; repaired to ${repairedDeprecated}.` };
    }
    const modelOk = Boolean(m && allowed.includes(m));
    if (providerOk && modelOk) return { ok: true, provider: p, model: m, repaired: false, backendChecked, reason: '' };
    if (providerOk && isCustomModelAllowed(p, m)) {
      return { ok: true, provider: p, model: m, repaired: false, backendChecked, customModel: true, reason: `${p}/${m} accepted as a custom model.` };
    }

    const fallbackProvider = providerOk ? p : 'openai';
    const fallbackModels = modelsFor(fallbackProvider, { routeKey: options.routeKey });
    const fallbackModel = clean(options.preferredModel) && fallbackModels.some((item) => item.value === options.preferredModel)
      ? clean(options.preferredModel)
      : clean(registry[fallbackProvider]?.defaultModel || fallbackModels[0]?.value || PROVIDERS[fallbackProvider]?.defaultModel || 'gpt-4.1-mini');
    const reason = !providerOk ? `Unknown provider ${p}; repaired to ${fallbackProvider}.` : (backendChecked ? `${p}/${m || '(empty)'} is not listed by backend; repaired to ${fallbackModel}.` : `${p}/${m || '(empty)'} is not in local registry; repaired to ${fallbackModel}.`);
    return { ok: false, provider: fallbackProvider, model: fallbackModel, repaired: true, backendChecked, reason };
  }

  function recommendedForRoute(routeKey, provider = '') {
    const p = clean(provider || el('aiProvider')?.value || safeLocalGet(LS_PROVIDER, 'openai') || 'openai');
    const models = modelsFor(p, { routeKey });
    return { provider: p, model: models[0]?.value || registry[p]?.defaultModel || '' };
  }

  function syncVisibleProviderModel({ repair = false } = {}) {
    const providerEl = el('aiProvider');
    const modelEl = el('aiModel');
    const customModelEl = el('aiCustomModel');
    if (!providerEl || !modelEl) return null;

    const currentProvider = clean(providerEl.value || safeLocalGet(LS_PROVIDER, 'openai') || 'openai');
    providerEl.innerHTML = providerOptions(currentProvider);
    if (!registry[currentProvider]) providerEl.value = 'openai';
    else providerEl.value = currentProvider;

    const savedModel = safeLocalGet(`${LS_MODEL_PREFIX}${providerEl.value}`, modelEl.value || registry[providerEl.value]?.defaultModel || '');
    const savedCustomModel = safeLocalGet(`${LS_CUSTOM_MODEL_PREFIX}${providerEl.value}`, customModelEl?.value || '');
    const candidateModel = normalizeDeprecatedModel(providerEl.value, clean(savedCustomModel || savedModel));
    const validation = validateProviderModel(providerEl.value, candidateModel || savedModel, { routeKey: 'default' });
    const finalModel = validation.repaired ? validation.model : (normalizeDeprecatedModel(providerEl.value, savedModel) || validation.model);
    modelEl.innerHTML = modelOptions(providerEl.value, finalModel, 'default');
    if (Array.from(modelEl.options || []).some((option) => option.value === finalModel)) modelEl.value = finalModel;
    if (customModelEl) {
      const allowCustom = Boolean(registry[providerEl.value]?.allowCustomModels);
      if (!allowCustom) {
        customModelEl.value = '';
        customModelEl.disabled = true;
        customModelEl.placeholder = 'Disabled: choose a currently available model from the dropdown';
      } else {
        customModelEl.disabled = false;
        customModelEl.value = savedCustomModel && !Array.from(modelEl.options || []).some((option) => option.value === savedCustomModel) ? savedCustomModel : savedCustomModel;
        customModelEl.placeholder = providerEl.value === 'openai' ? 'Optional custom GPT model' : providerEl.value === 'gemini' ? 'Optional Gemini model' : 'Optional custom model';
      }
    }
    safeLocalSet(LS_PROVIDER, providerEl.value);
    safeLocalSet(`${LS_MODEL_PREFIX}${providerEl.value}`, modelEl.value || '');
    safeLocalSet(`${LS_CUSTOM_MODEL_PREFIX}${providerEl.value}`, customModelEl?.disabled ? '' : (customModelEl?.value?.trim() || ''));
    updateCardSummary(validation);
    return validation;
  }

  function updateRouteModelSelects({ repair = false } = {}) {
    D.querySelectorAll('[data-route-provider]').forEach((providerNode) => {
      const routeKey = providerNode.getAttribute('data-route-provider') || '';
      const modelNode = D.querySelector(`[data-route-model="${cssEscape(routeKey)}"]`);
      if (!modelNode) return;
      const provider = clean(providerNode.value || 'openai');
      const selected = normalizeDeprecatedModel(provider, clean(modelNode.value || recommendedForRoute(routeKey, provider).model));
      const validation = validateProviderModel(provider, selected, { routeKey });
      const finalModel = validation.repaired ? validation.model : selected;
      if (modelNode.tagName === 'SELECT') modelNode.innerHTML = modelOptions(provider, finalModel, routeKey);
      if (Array.from(modelNode.options || []).some((option) => option.value === finalModel)) modelNode.value = finalModel;
    });
  }

  function cssEscape(value) {
    if (W.CSS?.escape) return W.CSS.escape(value);
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function setStatus(message, bad = false) {
    const node = el('modelRegistryStatus');
    if (node) {
      node.textContent = message;
      node.classList.toggle('bad', Boolean(bad));
    }
  }

  function providerSummaryHtml() {
    return Object.values(registry).map((provider) => {
      const models = provider.models || [];
      const configured = provider.configured === true ? 'configured' : provider.configured === false ? 'not configured' : 'unknown config';
      const checked = provider.backendChecked ? 'backend checked' : 'fallback registry';
      return [
        '<div class="model-registry-provider-row">',
        `<strong>${escapeHtml(provider.title || provider.key)}</strong>`,
        `<span>${escapeHtml(configured)} · ${escapeHtml(checked)} · ${models.length} model(s)</span>`,
        `<code>${escapeHtml(models.map((m) => m.value).join(', ') || '(none)')}</code>`,
        '</div>'
      ].join('');
    }).join('');
  }

  function capabilityRowsHtml() {
    const rows = [];
    Object.entries(registry).forEach(([provider, record]) => {
      (record.models || []).forEach((model) => {
        rows.push([
          '<div class="model-registry-cap-row">',
          `<span>${escapeHtml(record.title || provider)}</span>`,
          `<strong>${escapeHtml(model.value)}</strong>`,
          `<span>${escapeHtml(model.tier || 'standard')}</span>`,
          `<span>${model.structuredJson ? 'JSON yes' : 'JSON unknown'}</span>`,
          `<span>${model.longContext ? 'long context yes' : 'long context unknown'}</span>`,
          `<span>${escapeHtml((model.recommendedFor || []).slice(0, 4).join(', ') || 'general')}</span>`,
          '</div>'
        ].join(''));
      });
    });
    return rows.join('');
  }

  function createCard() {
    const settings = el('settingsTab') || D.querySelector('.right-panel');
    if (!settings || el('modelRegistryCard')) return false;
    const card = D.createElement('div');
    card.id = 'modelRegistryCard';
    card.className = 'model-registry-card';
    card.innerHTML = [
      '<div class="section-head compact"><div><div class="smallcaps">AI models</div><h2>Backend model registry</h2></div></div>',
      '<p class="model-registry-help">Central registry for provider/model choices. It uses backend-reported allowed models when available and repairs routes that point to unsupported models.</p>',
      '<div id="modelRegistrySummary" class="model-registry-summary">Registry initializing…</div>',
      '<div class="model-registry-actions">',
      '<button id="refreshModelRegistryBtn" class="btn mini primary" type="button">Refresh backend models</button>',
      '<button id="repairVisibleModelBtn" class="btn mini" type="button">Repair current selection</button>',
      '<button id="copyModelRegistryReportBtn" class="btn mini" type="button">Copy model report</button>',
      '</div>',
      '<div id="modelRegistryStatus" class="settings-note">Model registry ready.</div>',
      '<div id="modelRegistryProviders" class="model-registry-provider-list"></div>',
      '<details class="model-registry-details"><summary>Model capabilities and task recommendations</summary><div id="modelRegistryCapabilities" class="model-registry-cap-table"></div></details>'
    ].join('');
    const routing = el('modelRoutingCard');
    const inspector = el('aiRoutingInspectorCard');
    if (routing?.parentElement === settings) settings.insertBefore(card, routing);
    else if (inspector?.parentElement === settings) settings.insertBefore(card, inspector);
    else settings.appendChild(card);
    bindCardControls();
    renderCard();
    return true;
  }

  function renderCard() {
    const providers = el('modelRegistryProviders');
    if (providers) providers.innerHTML = providerSummaryHtml();
    const caps = el('modelRegistryCapabilities');
    if (caps) caps.innerHTML = capabilityRowsHtml();
    updateCardSummary();
  }

  function updateCardSummary(validation = null) {
    const summary = el('modelRegistrySummary');
    if (!summary) return;
    const provider = clean(el('aiProvider')?.value || 'openai');
    const customModel = clean(el('aiCustomModel')?.value || safeLocalGet(`${LS_CUSTOM_MODEL_PREFIX}${provider}`, ''));
    const model = customModel || clean(el('aiModel')?.value || '');
    const checkedCount = Object.values(registry).filter((p) => p.backendChecked).length;
    const note = validation?.repaired ? ` · repaired: ${validation.reason}` : '';
    summary.textContent = `Current: ${provider || '(provider?)'} / ${model || '(model?)'} · ${checkedCount ? `${checkedCount} provider(s) backend-checked` : 'using fallback registry'}${note}`;
  }

  async function repairVisibleModel() {
    const validation = syncVisibleProviderModel({ repair: true });
    updateRouteModelSelects({ repair: true });
    const bad = Boolean(validation?.repaired);
    setStatus(validation?.repaired ? validation.reason : 'Current provider/model already matches the registry.', bad);
    emitUpdated();
    return validation;
  }

  function bindCardControls() {
    el('refreshModelRegistryBtn')?.addEventListener('click', async () => {
      setStatus('Refreshing backend model registry…');
      try {
        await refreshFromBackend();
        setStatus('Backend model registry refreshed.');
      } catch (err) {
        renderCard();
        setStatus(`Refresh failed; using fallback/local registry. ${err.message || err}`, true);
      }
    }, true);
    el('repairVisibleModelBtn')?.addEventListener('click', repairVisibleModel, true);
    el('copyModelRegistryReportBtn')?.addEventListener('click', copyReport, true);
  }

  function bindVisibleControls() {
    const providerEl = el('aiProvider');
    const modelEl = el('aiModel');
    const customModelEl = el('aiCustomModel');
    if (!providerEl || !modelEl || providerEl.dataset.stage18aModelRegistryBound === 'true') return false;
    providerEl.dataset.stage18aModelRegistryBound = 'true';
    providerEl.addEventListener('change', () => {
      safeLocalSet(LS_PROVIDER, providerEl.value || 'openai');
      if (customModelEl) customModelEl.value = registry[providerEl.value || 'openai']?.allowCustomModels ? safeLocalGet(`${LS_CUSTOM_MODEL_PREFIX}${providerEl.value || 'openai'}`, '') : '';
      syncVisibleProviderModel({ repair: true });
      updateRouteModelSelects({ repair: true });
      emitUpdated();
    }, true);
    modelEl.addEventListener('change', () => {
      safeLocalSet(`${LS_MODEL_PREFIX}${providerEl.value || 'openai'}`, modelEl.value || '');
      if (customModelEl && customModelEl.value.trim()) {
        // Choosing a listed model clears the optional override so the dropdown takes effect.
        customModelEl.value = '';
        safeLocalSet(`${LS_CUSTOM_MODEL_PREFIX}${providerEl.value || 'openai'}`, '');
      }
      updateCardSummary();
    }, true);
    customModelEl?.addEventListener('input', () => {
      if (customModelEl.disabled) return;
      safeLocalSet(`${LS_CUSTOM_MODEL_PREFIX}${providerEl.value || 'openai'}`, customModelEl.value.trim());
      updateCardSummary(validateProviderModel(providerEl.value, customModelEl.value.trim() || modelEl.value, { routeKey: 'default' }));
    }, true);
    return true;
  }

  function bindRouteControls() {
    D.querySelectorAll('[data-route-provider]').forEach((node) => {
      if (node.dataset.stage18aModelRegistryBound === 'true') return;
      node.dataset.stage18aModelRegistryBound = 'true';
      node.addEventListener('change', () => {
        updateRouteModelSelects({ repair: true });
        emitUpdated();
      }, true);
    });
  }

  function emitUpdated() {
    try { D.dispatchEvent(new CustomEvent('latexai:model-registry-updated', { detail: registryReport() })); } catch (_err) {}
  }

  function registryReport() {
    const visibleProvider = clean(el('aiProvider')?.value || '');
    const customInput = el('aiCustomModel');
    const visibleCustomModel = customInput?.disabled ? '' : clean(customInput?.value || safeLocalGet(`${LS_CUSTOM_MODEL_PREFIX}${visibleProvider}`, ''));
    const visible = { provider: visibleProvider, model: visibleCustomModel || clean(el('aiModel')?.value || ''), selectedModel: clean(el('aiModel')?.value || ''), customModel: visibleCustomModel };
    return {
      schema: 'latexai-model-routing-audit-validation-lock-registry-report-v1',
      stage: STAGE,
      generatedAt: nowIso(),
      proxyUrl: proxyUrl(),
      statusUrl: statusUrl(),
      modelsUrl: modelsUrl(),
      lastRefreshError,
      visible,
      visibleValidation: validateProviderModel(visible.provider, visible.model, { routeKey: 'default' }),
      providers: Object.fromEntries(Object.entries(registry).map(([key, value]) => [key, {
        title: value.title,
        configured: value.configured,
        backendChecked: Boolean(value.backendChecked),
        defaultModel: value.defaultModel,
        allowedModels: (value.models || []).map((m) => m.value),
        models: (value.models || []).map((m) => ({ value: m.value, tier: m.tier, structuredJson: m.structuredJson, longContext: m.longContext, recommendedFor: m.recommendedFor || [] }))
      }])),
      routes: ROUTES,
      cachedBackendStatus: lastBackendStatus ? true : false
    };
  }

  async function copyReport() {
    const text = JSON.stringify(registryReport(), null, 2);
    try { await navigator.clipboard.writeText(text); setStatus('Model registry report copied.'); }
    catch (_err) { setStatus(text); }
  }

  function init() {
    createCard();
    bindVisibleControls();
    syncVisibleProviderModel({ repair: true });
    bindRouteControls();
    updateRouteModelSelects({ repair: true });
    renderCard();

    // Try once in the background, but never block the editor if the backend is not reachable.
    if (!init.didBackgroundRefresh) {
      init.didBackgroundRefresh = true;
      setTimeout(() => {
        refreshFromBackend().catch((err) => {
          lastRefreshError = err.message || String(err);
          renderCard();
        });
      }, 1200);
    }
  }

  NS.ModelRegistryService = {
    STAGE,
    ROUTES,
    init,
    getRegistry: () => registry,
    getLastBackendStatus: () => lastBackendStatus,
    refreshFromBackend,
    providerOptions,
    modelOptions,
    modelsFor,
    validateProviderModel,
    recommendedForRoute,
    syncVisibleProviderModel,
    updateRouteModelSelects,
    registryReport,
    repairVisibleModel
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    createCard();
    bindVisibleControls();
    bindRouteControls();
    updateRouteModelSelects({ repair: true });
    tries += 1;
    if (tries > 18) clearInterval(interval);
  }, 500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

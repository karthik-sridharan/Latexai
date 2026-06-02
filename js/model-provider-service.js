/* Latexai Stage 18A ModelRoutingService
 * Stage: stage19n1q10-live-provider-model-discovery-1
 *
 * Central model/provider routing cleanup.
 *
 * Goals:
 * - keep the main Copilot provider/model controls as the source of truth;
 * - let developers define per-workflow provider/model routes;
 * - apply the route automatically before AIProvider.ask runs;
 * - keep the UI optional and safe-mode aware.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19n1q10-live-provider-model-discovery-1';
  const STORAGE_KEY = 'latexai:model-routing:v1';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('model-provider-service')) {
    NS.ModelRoutingService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false,
      getRoutes: () => ({})
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  let originalAsk = null;
  let wrapped = false;

  const ROUTES = [
    { key: 'default', title: 'Default / Copilot', hint: 'General Copilot, rewriting, advice' },
    { key: 'paper', title: 'Total Paper Remake', hint: 'Review, remake, ranking, acceptance improvement' },
    { key: 'citation', title: 'Citation AI', hint: 'Citation filler, missing BibTeX, citation audit' },
    { key: 'presentation', title: 'Presentation export', hint: 'Paper → presentation JSON/HTML/Beamer' },
    { key: 'figure', title: 'Figure/TikZ generation', hint: 'Image/TikZ and presentation figure assets' },
    { key: 'slide-repair', title: 'Slide repair', hint: 'Imported slide math/text cleanup' },
    { key: 'diagnostic', title: 'Diagnostics / logs', hint: 'Compile-log explanations and lightweight checks' },
    { key: 'competitive-ranking', title: 'Competitive review · ranking', hint: 'Ranks competitor papers and estimates draft position' },
    { key: 'competitive-improvement', title: 'Competitive review · improvement', hint: 'Produces ranking-aware improvement edits' },
    { key: 'debate-advocate', title: 'Devil’s advocate · supporter', hint: 'Argues for the current draft' },
    { key: 'debate-critic', title: 'Devil’s advocate · critic', hint: 'Attacks weaknesses in the draft' },
    { key: 'debate-synthesizer', title: 'Devil’s advocate · synthesis', hint: 'Produces the balanced improvement plan' }
  ];

  const DEFAULTS = {
    default: { provider: 'openai', model: 'gpt-5.4-mini' },
    paper: { provider: 'openai', model: 'gpt-5.4-mini' },
    citation: { provider: 'openai', model: 'gpt-5.4-mini' },
    presentation: { provider: 'openai', model: 'gpt-5.4-mini' },
    figure: { provider: 'openai', model: 'gpt-5.4-mini' },
    'slide-repair': { provider: 'openai', model: 'gpt-5.4-mini' },
    diagnostic: { provider: 'openai', model: 'gpt-5.4-mini' },
    'competitive-ranking': { provider: 'openai', model: 'gpt-5.4-mini' },
    'competitive-improvement': { provider: 'openai', model: 'gpt-5.4-mini' },
    'debate-advocate': { provider: 'openai', model: 'gpt-5.4-mini' },
    'debate-critic': { provider: 'openai', model: 'gpt-5.4-mini' },
    'debate-synthesizer': { provider: 'openai', model: 'gpt-5.4-mini' }
  };

  function el(id) { return D.getElementById(id); }

  function clean(value) {
    return String(value || '').trim();
  }


  function normalizeDeprecatedModel(provider, model) {
    const p = clean(provider || 'openai').toLowerCase();
    const m = clean(model || '');
    if (p !== 'openai') return m;
    const aliases = {
      'gpt-5.1-mini': 'gpt-5.4-mini',
      'gpt 5.1 mini': 'gpt-5.4-mini',
      'gpt-5.1': 'gpt-5.4',
      'gpt 5.1': 'gpt-5.4'
    };
    return aliases[m.toLowerCase()] || m;
  }

  function providerSelect() {
    return el('aiProvider') || D.querySelector('[data-lumina-ai-provider]');
  }

  function modelSelect() {
    return el('aiModel') || D.querySelector('[data-lumina-ai-model]');
  }

  function currentProviderModel() {
    return {
      provider: clean(providerSelect()?.value || DEFAULTS.default.provider),
      model: clean(modelSelect()?.value || DEFAULTS.default.model)
    };
  }

  function cssEscape(value) {
    if (W.CSS?.escape) return W.CSS.escape(value);
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function routeProviderNode(routeKey) {
    return D.querySelector(`[data-route-provider="${cssEscape(routeKey)}"]`);
  }

  function routeModelNode(routeKey) {
    return D.querySelector(`[data-route-model="${cssEscape(routeKey)}"]`);
  }

  function setProviderModel(route) {
    const provider = clean(route?.provider);
    const model = normalizeDeprecatedModel(provider || route?.provider, route?.model);
    const p = providerSelect();
    const m = modelSelect();

    if (p && provider) {
      p.value = provider;
      try { p.dispatchEvent(new Event('change', { bubbles: true })); } catch (_err) {}
    }

    if (m && model) {
      if (m.tagName === 'SELECT' && NS.ModelRegistryService?.modelOptions) {
        m.innerHTML = NS.ModelRegistryService.modelOptions(provider || p?.value || 'openai', model, 'default');
      }
      const option = Array.from(m.options || []).find((opt) => opt.value === model);
      if (option || m.tagName !== 'SELECT') m.value = model;
      try { m.dispatchEvent(new Event('change', { bubbles: true })); } catch (_err) {}
    }
  }

  function readRoutes() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return normalizeRoutes(parsed);
    } catch (_err) {
      return normalizeRoutes({});
    }
  }

  function normalizeRoutes(input) {
    const routes = {};
    for (const item of ROUTES) {
      const source = input?.[item.key] || DEFAULTS[item.key] || DEFAULTS.default;
      routes[item.key] = {
        provider: clean(source.provider || DEFAULTS[item.key]?.provider || DEFAULTS.default.provider),
        model: normalizeDeprecatedModel(source.provider || DEFAULTS[item.key]?.provider || DEFAULTS.default.provider, source.model || DEFAULTS[item.key]?.model || DEFAULTS.default.model)
      };
    }
    return routes;
  }

  function writeRoutes(routes) {
    const normalized = normalizeRoutes(routes);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch (_err) {}
    return normalized;
  }

  function routeForTask(task, payload, options) {
    const haystack = [
      options?.routeKey,
      options?.modelRouteKey,
      options?.context?.routeKey,
      options?.context?.modelRouteKey,
      options?.context?.agentRole,
      payload?.routeKey,
      payload?.modelRouteKey,
      payload?.agentRole,
      task,
      options?.context?.workflow,
      options?.context?.task,
      payload?.presentationExport?.style,
      payload?.presentationFigureAsset?.slideTitle,
      payload?.citationWorkflow,
      payload?.documentWorkflow,
      payload?.workflow,
      payload?.task
    ].map(clean).join(' ').toLowerCase();

    if (/debate.*synth|synthesis|synthesizer/.test(haystack)) return 'debate-synthesizer';
    if (/debate.*critic|critical agent|devils?.*critic/.test(haystack)) return 'debate-critic';
    if (/debate.*advocate|supporter|defender|devils?.*advocate/.test(haystack)) return 'debate-advocate';
    if (/competitive.*rank|ranking.*competitive|competitor.*rank/.test(haystack)) return 'competitive-ranking';
    if (/competitive|competitor|ranking-aware|improvement roadmap/.test(haystack)) return 'competitive-improvement';
    if (/slide-repair|slide repair|math repair|pdf slide import|presentation repair/.test(haystack)) return 'slide-repair';
    if (/presentation-figure|figure-asset|image-to-tikz|tikz|diagram|figure/.test(haystack)) return 'figure';
    if (/paper-to-presentation|presentation-export|talk export|beamer/.test(haystack)) return 'presentation';
    if (/citation|bibtex|bibliography|missing-bib|cite/.test(haystack)) return 'citation';
    if (/paper|document|review|remake|ranking|acceptance|rewrite-paper/.test(haystack)) return 'paper';
    if (/diagnostic|compile-log|explain-log|fix-error|backend/.test(haystack)) return 'diagnostic';
    return 'default';
  }

  function routeForAsk(payload, options) {
    const task = clean(options?.task || payload?.task || '');
    const routeKey = routeForTask(task, payload, options);
    const routes = readRoutes();
    return {
      routeKey,
      route: routes[routeKey] || routes.default || DEFAULTS.default
    };
  }

  async function askWithRoute(payload, options) {
    // Stage 17H: allow workflow code to explicitly opt out of route override.
    // This is needed for multi-agent workflows where each visible agent row has
    // its own provider/model. Without this, the generic "paper" route can
    // override all agents to gpt-5.4 even when the row shows gpt-5.4-mini.
    const bypass = Boolean(
      payload?.modelRoutingBypass ||
      payload?.modelRouting?.bypass ||
      payload?.agentModelRoutingBypass ||
      options?.modelRoutingBypass ||
      options?.context?.modelRoutingBypass
    );
    if (bypass) {
      if (payload && typeof payload === 'object') {
        payload.modelRouting = {
          ...(payload.modelRouting || {}),
          stage: STAGE,
          bypass: true,
          reason: payload.modelRoutingBypassReason || options?.context?.modelRoutingBypassReason || 'explicit-workflow-agent-model'
        };
      }
      if (options && typeof options === 'object') {
        options.modelRouting = {
          ...(options.modelRouting || {}),
          stage: STAGE,
          bypass: true,
          reason: options?.context?.modelRoutingBypassReason || payload?.modelRoutingBypassReason || 'explicit-workflow-agent-model'
        };
      }
      return await originalAsk.call(NS.AIProvider, payload, options);
    }

    const decision = routeForAsk(payload || {}, options || {});
    const validation = NS.ModelRegistryService?.validateProviderModel?.(decision.route.provider, decision.route.model, { routeKey: decision.routeKey });
    if (validation?.repaired) decision.route = { provider: validation.provider, model: validation.model };
    const before = currentProviderModel();

    try {
      setProviderModel(decision.route);

      if (payload && typeof payload === 'object') {
        payload.modelRouting = {
          stage: STAGE,
          routeKey: decision.routeKey,
          provider: decision.route.provider,
          model: decision.route.model
        };
      }

      if (options && typeof options === 'object') {
        options.modelRouting = {
          stage: STAGE,
          routeKey: decision.routeKey,
          provider: decision.route.provider,
          model: decision.route.model
        };
      }

      return await originalAsk.call(NS.AIProvider, payload, options);
    } finally {
      // Restore visible controls so developers do not lose the currently selected default.
      setProviderModel(before);
    }
  }

  function wrapAiProvider() {
    if (wrapped || !NS.AIProvider?.ask || NS.AIProvider.ask.stage15gWrapped) return Boolean(NS.AIProvider?.ask);
    originalAsk = NS.AIProvider.ask;
    NS.AIProvider.ask = askWithRoute;
    NS.AIProvider.ask.stage15gWrapped = true;
    wrapped = true;
    return true;
  }

  function providerOptionsHtml(selected) {
    if (NS.ModelRegistryService?.providerOptions) return NS.ModelRegistryService.providerOptions(selected);
    const p = providerSelect();
    const values = Array.from(p?.options || []).map((opt) => opt.value).filter(Boolean);
    const fallback = values.length ? values : ['openai', 'anthropic', 'gemini'];
    return fallback.map((value) => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(labelProvider(value))}</option>`).join('');
  }

  function modelOptionsHtml(provider, selected, routeKey) {
    if (NS.ModelRegistryService?.modelOptions) return NS.ModelRegistryService.modelOptions(provider, selected, routeKey);
    const source = modelSelect();
    const values = Array.from(source?.options || []).map((opt) => ({ value: opt.value, label: opt.textContent || opt.value })).filter((item) => item.value);
    const fallback = values.length ? values : [{ value: selected || DEFAULTS[routeKey]?.model || DEFAULTS.default.model, label: selected || DEFAULTS[routeKey]?.model || DEFAULTS.default.model }];
    return fallback.map((item) => `<option value="${escapeHtml(item.value)}"${item.value === selected ? ' selected' : ''}>${escapeHtml(item.label || item.value)}</option>`).join('');
  }

  function labelProvider(value) {
    if (value === 'openai') return 'OpenAI';
    if (value === 'anthropic') return 'Claude / Anthropic';
    if (value === 'gemini') return 'Gemini / Google';
    return value;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function routeRowsHtml(routes) {
    return ROUTES.map((item) => {
      const route = routes[item.key] || DEFAULTS[item.key] || DEFAULTS.default;
      return [
        `<div class="model-routing-row" data-route="${escapeHtml(item.key)}">`,
        '  <div class="model-routing-label">',
        `    <strong>${escapeHtml(item.title)}</strong>`,
        `    <span>${escapeHtml(item.hint)}</span>`,
        '  </div>',
        '  <label>Provider',
        `    <select class="model-routing-provider" data-route-provider="${escapeHtml(item.key)}">${providerOptionsHtml(route.provider)}</select>`,
        '  </label>',
        '  <label>Model',
        `    <select class="model-routing-model" data-route-model="${escapeHtml(item.key)}">${modelOptionsHtml(route.provider, route.model, item.key)}</select>`,
        '  </label>',
        '</div>'
      ].join('');
    }).join('');
  }

  function createCard() {
    const settings = el('settingsTab') || el('copilotTab') || D.querySelector('.right-panel');
    if (!settings || el('modelRoutingCard')) return false;

    const routes = readRoutes();
    const card = D.createElement('div');
    card.id = 'modelRoutingCard';
    card.className = 'model-routing-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Models</div>',
      '    <h2>Model/provider routing</h2>',
      '  </div>',
      '</div>',
      '<p class="model-routing-help">Developer-facing routing for AI workflows. Routes temporarily set the existing Copilot provider/model controls before each AI call, then restore them.</p>',
      '<div id="modelRoutingRows" class="model-routing-rows">',
      routeRowsHtml(routes),
      '</div>',
      '<div class="model-routing-actions">',
      '  <button id="saveModelRoutingBtn" class="btn mini primary" type="button">Save routing</button>',
      '  <button id="useCurrentModelForAllBtn" class="btn mini" type="button">Use current for all</button>',
      '  <button id="resetModelRoutingBtn" class="btn mini" type="button">Reset defaults</button>',
      '  <button id="copyModelRoutingReportBtn" class="btn mini" type="button">Copy report</button>',
      '</div>',
      '<div id="modelRoutingStatus" class="settings-note">Model routing ready.</div>'
    ].join('');

    const backendCard = el('backendDiagnosticsCard');
    if (backendCard?.parentElement === settings) settings.insertBefore(card, backendCard);
    else settings.appendChild(card);

    bindCardControls();
    return true;
  }

  function routeRecommendation(routeKey, provider) {
    return NS.ModelRegistryService?.recommendedForRoute?.(routeKey, provider) || DEFAULTS[routeKey] || DEFAULTS.default;
  }

  function refreshRouteRow(routeKey, options = {}) {
    const p = routeProviderNode(routeKey);
    const m = routeModelNode(routeKey);
    const provider = clean(p?.value || DEFAULTS[routeKey]?.provider || DEFAULTS.default.provider);
    const currentModel = clean(m?.value || '');
    const recommendation = routeRecommendation(routeKey, provider);
    const validation = currentModel
      ? NS.ModelRegistryService?.validateProviderModel?.(provider, currentModel, { routeKey })
      : null;

    let targetModel = currentModel;
    if (options.forceRecommended || !targetModel) {
      targetModel = clean(recommendation.model || DEFAULTS[routeKey]?.model || DEFAULTS.default.model);
    } else if (options.repair !== false && validation?.repaired) {
      targetModel = clean(validation.model || recommendation.model || DEFAULTS[routeKey]?.model || DEFAULTS.default.model);
    }

    if (m?.tagName === 'SELECT') m.innerHTML = modelOptionsHtml(provider, targetModel, routeKey);
    if (m) {
      const hasTarget = Array.from(m.options || []).some((opt) => opt.value === targetModel);
      if (hasTarget || m.tagName !== 'SELECT') m.value = targetModel;
      else if (m.options?.length) m.value = m.options[0].value;
    }
    return { provider, model: clean(m?.value || targetModel) };
  }

  function refreshRouteOptionsPreservingUi() {
    for (const item of ROUTES) refreshRouteRow(item.key, { repair: true, forceRecommended: false });
  }

  function routesFromUi() {
    const routes = {};
    for (const item of ROUTES) {
      const provider = clean(routeProviderNode(item.key)?.value || DEFAULTS[item.key]?.provider);
      const model = clean(routeModelNode(item.key)?.value || DEFAULTS[item.key]?.model);
      const validation = NS.ModelRegistryService?.validateProviderModel?.(provider, model, { routeKey: item.key });
      routes[item.key] = validation ? { provider: validation.provider, model: validation.model } : { provider, model };
    }
    return normalizeRoutes(routes);
  }

  function updateUiFromRoutes(routes) {
    const normalized = normalizeRoutes(routes);
    for (const item of ROUTES) {
      const route = normalized[item.key];
      const p = routeProviderNode(item.key);
      const m = routeModelNode(item.key);
      if (p) p.value = route.provider;
      if (m) {
        if (m.tagName === 'SELECT') m.innerHTML = modelOptionsHtml(route.provider, route.model, item.key);
        m.value = route.model;
      }
    }
  }

  function autosaveRoutes(message) {
    writeRoutes(routesFromUi());
    if (message) setStatus(message);
  }

  function setStatus(message) {
    const node = el('modelRoutingStatus');
    if (node) node.textContent = message;
  }

  function saveRoutesFromUi() {
    const routes = writeRoutes(routesFromUi());
    updateUiFromRoutes(routes);
    setStatus('Model routing saved.');
    return routes;
  }

  function useCurrentForAll() {
    const current = currentProviderModel();
    const routes = {};
    for (const item of ROUTES) routes[item.key] = { ...current };
    writeRoutes(routes);
    updateUiFromRoutes(routes);
    setStatus(`All routes set to ${current.provider} / ${current.model}.`);
    return routes;
  }

  function resetDefaults() {
    const routes = writeRoutes(DEFAULTS);
    updateUiFromRoutes(routes);
    setStatus('Model routing reset to defaults.');
    return routes;
  }

  function routingReport() {
    return {
      schema: 'latexai-model-routing-audit-validation-lock-report-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      wrapped,
      current: currentProviderModel(),
      routes: readRoutes(),
      routeKeys: ROUTES.map((r) => r.key),
      modelRegistry: NS.ModelRegistryService?.registryReport?.() || null,
      safeMode: Boolean(W.LatexaiSafeMode?.isSafeMode?.())
    };
  }

  async function copyReport() {
    const text = JSON.stringify(routingReport(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Model routing report copied.');
    } catch (_err) {
      setStatus(text);
    }
  }

  function bindCardControls() {
    el('saveModelRoutingBtn')?.addEventListener('click', saveRoutesFromUi, true);
    el('useCurrentModelForAllBtn')?.addEventListener('click', useCurrentForAll, true);
    el('resetModelRoutingBtn')?.addEventListener('click', resetDefaults, true);
    el('copyModelRoutingReportBtn')?.addEventListener('click', copyReport, true);

    D.querySelectorAll('[data-route-provider]').forEach((node) => {
      if (node.dataset.stage19n1q3RouteProviderBound === 'true') return;
      node.dataset.stage19n1q3RouteProviderBound = 'true';
      node.addEventListener('change', () => {
        const key = node.getAttribute('data-route-provider');
        refreshRouteRow(key, { forceRecommended: true, repair: true });
        autosaveRoutes(`Route ${key} set to ${node.value} / ${routeModelNode(key)?.value || '(model?)'}.`);
      }, true);
    });

    D.querySelectorAll('[data-route-model]').forEach((node) => {
      if (node.dataset.stage19n1q3RouteModelBound === 'true') return;
      node.dataset.stage19n1q3RouteModelBound = 'true';
      node.addEventListener('change', () => {
        const key = node.getAttribute('data-route-model');
        autosaveRoutes(`Route ${key} set to ${routeProviderNode(key)?.value || '(provider?)'} / ${node.value}.`);
      }, true);
    });

    // Do not rebuild route rows from saved localStorage when the model registry
    // refreshes. That was the source of the iPad/Safari dropdown bug: a backend
    // registry update fired while the user was editing, so the row reverted to
    // the previously saved OpenAI route. Refresh only the option lists and keep
    // the currently visible provider/model choices.
    if (D.documentElement.dataset.stage19n1q3RegistryPreserveBound !== 'true') {
      D.documentElement.dataset.stage19n1q3RegistryPreserveBound = 'true';
      D.addEventListener('latexai:model-registry-updated', () => {
        refreshRouteOptionsPreservingUi();
      }, { passive: true });
    }
  }

  function init() {
    createCard();
    wrapAiProvider();
  }

  NS.ModelRoutingService = {
    STAGE,
    init,
    ROUTES,
    DEFAULTS,
    getRoutes: readRoutes,
    setRoutes: writeRoutes,
    routeForTask,
    routeForAsk,
    wrapAiProvider,
    routingReport
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    createCard();
    if (wrapAiProvider()) clearInterval(interval);
    tries += 1;
    if (tries > 40) clearInterval(interval);
  }, 500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

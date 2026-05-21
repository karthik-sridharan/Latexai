/* Latexai Stage 17I AiRoutingInspectorService
 * Stage: stage17i-ai-model-routing-inspector-preflight-1
 * AI model routing inspector + preflight.
 * Local-only except explicit backend status checks.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage17i-ai-model-routing-inspector-preflight-1';
  const ROUTES_KEY = 'latexai:model-routing:v1';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('ai-routing-inspector-service')) {
    NS.AiRoutingInspectorService = { STAGE, disabledBySafeMode: true, init: () => false };
    return;
  }

  const SAFE_DEFAULT_ROUTES = {
    default: { provider: 'openai', model: 'gpt-4.1-mini' },
    paper: { provider: 'openai', model: 'gpt-4.1-mini' },
    citation: { provider: 'openai', model: 'gpt-4.1-mini' },
    presentation: { provider: 'openai', model: 'gpt-4.1-mini' },
    figure: { provider: 'openai', model: 'gpt-4.1-mini' },
    diagnostic: { provider: 'openai', model: 'gpt-4.1-mini' }
  };

  const WORKFLOWS = [
    { key: 'default', title: 'Default Copilot', routeKey: 'default', task: 'latex-copilot', webSearch: false },
    { key: 'paper-ai-polish', title: 'Paper-level edit review', routeKey: 'paper', task: 'latex-paper-ai', webSearch: false },
    { key: 'competitive-review', title: 'Competitive paper review', routeKey: 'paper', task: 'latex-competitive-paper-review', webSearch: true },
    { key: 'devils-advocate-debate', title: 'Devil’s advocate debate', routeKey: 'paper', task: 'latex-paper-debate', webSearch: false, explicitAgents: true },
    { key: 'citation-ai', title: 'Citation filler', routeKey: 'citation', task: 'latex-citation-ai', webSearch: false },
    { key: 'citation-verifier', title: 'Citation verifier', routeKey: 'citation', task: 'latex-citation-verifier', webSearch: false },
    { key: 'presentation-export', title: 'Presentation export', routeKey: 'presentation', task: 'paper-to-presentation-export', webSearch: false },
    { key: 'image-to-tikz', title: 'Image-to-TikZ / figure AI', routeKey: 'figure', task: 'image-to-tikz', webSearch: false },
    { key: 'backend-diagnostics', title: 'Backend diagnostics', routeKey: 'diagnostic', task: 'backend-diagnostic', webSearch: false }
  ];

  let lastBackendStatus = null;
  let lastReport = '';
  let originalAsk = null;
  let wrapped = false;

  function el(id) { return D.getElementById(id); }
  function clean(v) { return String(v || '').trim(); }

  function visibleProviderModel() {
    return {
      provider: clean(el('aiProvider')?.value || 'openai'),
      model: clean(el('aiModel')?.value || 'gpt-4.1-mini')
    };
  }

  function readRoutes() {
    try {
      const raw = JSON.parse(localStorage.getItem(ROUTES_KEY) || '{}');
      return { ...SAFE_DEFAULT_ROUTES, ...(raw.routes || raw || {}) };
    } catch (_err) {
      return { ...SAFE_DEFAULT_ROUTES };
    }
  }

  function resetRoutesToSafeDefaults() {
    try {
      localStorage.setItem(ROUTES_KEY, JSON.stringify({ schema: 'latexai-model-routing-v1', routes: SAFE_DEFAULT_ROUTES }));
    } catch (_err) {}
    setStatus('Model routes reset to safe defaults: OpenAI gpt-4.1-mini.');
    renderInspector();
  }

  function agentRows() {
    return [
      { role: 'advocate', provider: clean(el('advocateAgentProvider')?.value || visibleProviderModel().provider), model: clean(el('advocateAgentModel')?.value || visibleProviderModel().model) },
      { role: 'critic', provider: clean(el('criticAgentProvider')?.value || visibleProviderModel().provider), model: clean(el('criticAgentModel')?.value || visibleProviderModel().model) },
      { role: 'synthesizer', provider: clean(el('synthAgentProvider')?.value || visibleProviderModel().provider), model: clean(el('synthAgentModel')?.value || visibleProviderModel().model) }
    ];
  }

  function predictedFinalProviderModel(workflow, routes = readRoutes()) {
    const visible = visibleProviderModel();
    if (workflow.explicitAgents) {
      const agents = agentRows();
      return {
        source: 'explicit-agent-rows',
        provider: agents.map(a => a.provider).join(', '),
        model: agents.map(a => `${a.role}:${a.model}`).join(', '),
        agents,
        bypassesRoute: true
      };
    }
    const route = routes[workflow.routeKey] || routes.default || visible;
    return {
      source: `route:${workflow.routeKey}`,
      provider: route.provider || visible.provider,
      model: route.model || visible.model,
      agents: null,
      bypassesRoute: false
    };
  }

  function statusUrl() {
    const raw = clean(el('aiProxyUrl')?.value) || '/api/lumina/ai';
    try {
      const u = new URL(raw, W.location.href);
      if (/\/api\/lumina\/ai\/?$/i.test(u.pathname)) {
        u.pathname = u.pathname.replace(/\/?$/, '/status');
        u.search = '';
        return u.href;
      }
      if (/\/api\/lumina\/ai\/status\/?$/i.test(u.pathname)) return u.href;
    } catch (_err) {}
    return raw.replace(/\/api\/lumina\/ai\/?$/i, '/api/lumina/ai/status');
  }

  async function fetchBackendStatus() {
    const headers = {};
    const token = clean(el('aiProxyToken')?.value);
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(statusUrl(), { headers, cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw new Error(json?.error?.message || `AI status HTTP ${res.status}`);
    lastBackendStatus = json;
    return json;
  }

  function allowedModelsFor(provider, status = lastBackendStatus) {
    const p = clean(provider || 'openai');
    const models = status?.allowedModels?.[p] || status?.providers?.[p]?.allowedModels || [];
    return Array.isArray(models) ? models : [];
  }

  function backendHasModel(provider, model, status = lastBackendStatus) {
    const allowed = allowedModelsFor(provider, status);
    return !allowed.length || allowed.includes(model);
  }

  function backendHasWebSearch(provider, status = lastBackendStatus) {
    const web = status?.webSearch || status?.capabilities?.webSearch || {};
    if (web.available === true && !web.providers) return true;
    const info = web.providers?.[provider] || status?.providers?.[provider]?.webSearch || {};
    return info === true || Boolean(info.available === true || (info.supported === true && info.enabled !== false && info.configured !== false));
  }

  function workflowStatus(workflow, status = lastBackendStatus) {
    const routes = readRoutes();
    const visible = visibleProviderModel();
    const route = routes[workflow.routeKey] || routes.default || visible;
    const final = predictedFinalProviderModel(workflow, routes);
    const notes = [];
    let backendSupported = true;

    if (final.agents) {
      final.agents.forEach(agent => {
        if (!backendHasModel(agent.provider, agent.model, status)) {
          backendSupported = false;
          notes.push(`${agent.role}: ${agent.provider}/${agent.model} is not allowed`);
        }
      });
    } else if (!backendHasModel(final.provider, final.model, status)) {
      backendSupported = false;
      notes.push(`${final.provider}/${final.model} is not allowed`);
    }

    const webSearchOk = workflow.webSearch ? backendHasWebSearch(final.agents ? final.agents[0].provider : final.provider, status) : true;
    if (workflow.webSearch && !webSearchOk) notes.push('web search required but backend did not report availability');

    return {
      key: workflow.key,
      title: workflow.title,
      routeKey: workflow.routeKey,
      visibleProvider: visible.provider,
      visibleModel: visible.model,
      routeProvider: route.provider || '',
      routeModel: route.model || '',
      finalProvider: final.provider,
      finalModel: final.model,
      finalSource: final.source,
      agents: final.agents || [],
      backendSupported,
      webSearchRequired: Boolean(workflow.webSearch),
      webSearchOk,
      mismatch: !final.agents && (visible.provider !== final.provider || visible.model !== final.model),
      notes
    };
  }

  function reportObject(status = lastBackendStatus) {
    const workflows = WORKFLOWS.map(w => workflowStatus(w, status));
    return {
      schema: 'latexai-ai-routing-inspector-report-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      appStage: W.LUMINA_LATEX_STAGE || '',
      backendStage: status?.stage || '(not checked)',
      backendUrl: statusUrl(),
      visible: visibleProviderModel(),
      routes: readRoutes(),
      workflows,
      summary: {
        total: workflows.length,
        backendChecked: Boolean(status),
        unsupported: workflows.filter(w => !w.backendSupported).length,
        mismatches: workflows.filter(w => w.mismatch).length,
        webSearchProblems: workflows.filter(w => w.webSearchRequired && !w.webSearchOk).length
      }
    };
  }

  function formatReport(report = reportObject()) {
    const lines = [
      'Latexai AI model routing inspector report',
      '=========================================',
      '',
      `Generated: ${report.generatedAt}`,
      `App stage: ${report.appStage}`,
      `Backend: ${report.backendStage}`,
      `Backend URL: ${report.backendUrl}`,
      '',
      `Unsupported final models: ${report.summary.unsupported}`,
      `Visible/routed mismatches: ${report.summary.mismatches}`,
      `Web-search problems: ${report.summary.webSearchProblems}`,
      '',
      'Workflows',
      '---------'
    ];
    report.workflows.forEach(w => {
      lines.push(`- ${w.title}`);
      lines.push(`  visible: ${w.visibleProvider}/${w.visibleModel}`);
      lines.push(`  route: ${w.routeKey} -> ${w.routeProvider}/${w.routeModel}`);
      lines.push(`  final: ${w.finalProvider}/${w.finalModel} (${w.finalSource})`);
      lines.push(`  backend allowed: ${w.backendSupported ? 'yes' : 'NO'}; web search: ${w.webSearchRequired ? (w.webSearchOk ? 'required/ok' : 'required/NO') : 'not required'}`);
      w.notes.forEach(n => lines.push(`  note: ${n}`));
    });
    return lines.join('\n');
  }

  async function checkWorkflow(key = clean(el('aiRoutingWorkflowSelect')?.value || 'default')) {
    setStatus('Checking backend model routing...');
    let status = lastBackendStatus;
    try { status = await fetchBackendStatus(); }
    catch (err) { setStatus(`Backend status failed: ${err.message || err}`); }
    const wf = WORKFLOWS.find(w => w.key === key) || WORKFLOWS[0];
    const single = reportObject(status);
    single.workflows = [workflowStatus(wf, status)];
    single.summary.total = 1;
    single.summary.unsupported = single.workflows[0].backendSupported ? 0 : 1;
    single.summary.mismatches = single.workflows[0].mismatch ? 1 : 0;
    single.summary.webSearchProblems = single.workflows[0].webSearchRequired && !single.workflows[0].webSearchOk ? 1 : 0;
    lastReport = formatReport(single);
    setOutput(lastReport);
    renderInspector();
    setStatus(single.summary.unsupported || single.summary.webSearchProblems ? 'Routing check found problem(s).' : `${wf.title}: routing looks OK.`);
    return single;
  }

  async function checkAllWorkflows() {
    setStatus('Checking all AI workflows...');
    let status = lastBackendStatus;
    try { status = await fetchBackendStatus(); }
    catch (err) { setStatus(`Backend status failed: ${err.message || err}`); }
    const report = reportObject(status);
    lastReport = formatReport(report);
    setOutput(lastReport);
    renderInspector();
    setStatus(report.summary.unsupported || report.summary.webSearchProblems ? 'Routing check found problem(s).' : 'All checked routes look OK.');
    return report;
  }

  async function copyRoutingReport() {
    const text = lastReport || formatReport(reportObject(lastBackendStatus));
    setOutput(text);
    try { await navigator.clipboard.writeText(text); setStatus('Routing report copied.'); }
    catch (_err) { setStatus('Could not copy automatically. Report shown below.'); }
  }

  function preflightPayload(payload = {}, options = {}) {
    const task = clean(options.task || payload.task || '');
    const routeKey = /citation|bibtex|cite/i.test(task) ? 'citation'
      : /presentation|beamer|talk/i.test(task) ? 'presentation'
      : /tikz|figure|image/i.test(task) ? 'figure'
      : /diagnostic|compile-log|backend/i.test(task) ? 'diagnostic'
      : /paper|debate|competitive|document|review/i.test(task) ? 'paper'
      : 'default';

    if (payload.modelRoutingBypass || options.modelRoutingBypass || options.context?.modelRoutingBypass) {
      const provider = clean(payload.provider || options.provider || visibleProviderModel().provider);
      const model = clean(payload.model || options.model || visibleProviderModel().model);
      const ok = backendHasModel(provider, model);
      return { ok, warning: ok ? '' : `Preflight warning: ${provider}/${model} is not in backend allowed models.`, finalProvider: provider, finalModel: model };
    }

    const status = workflowStatus({ key: task || 'ad-hoc', title: task || 'Ad hoc AI call', routeKey, webSearch: Boolean(payload.webSearchRequired || payload.requireWebSearch) }, lastBackendStatus);
    const ok = status.backendSupported && status.webSearchOk;
    return { ok, warning: ok ? '' : `Preflight warning: ${status.finalProvider}/${status.finalModel} may not be supported. ${status.notes.join(' ')}`, finalProvider: status.finalProvider, finalModel: status.finalModel };
  }

  function wrapAiProviderPreflight() {
    if (wrapped || !NS.AIProvider?.ask || NS.AIProvider.ask.stage17iPreflightWrapped) return Boolean(NS.AIProvider?.ask);
    originalAsk = NS.AIProvider.ask;
    NS.AIProvider.ask = async function stage17iAskWithPreflight(payload, options) {
      const decision = preflightPayload(payload || {}, options || {});
      if (!decision.ok && decision.warning) {
        setStatus(decision.warning);
        try { console.warn('[Latexai preflight]', decision.warning); } catch (_err) {}
        if (el('aiRoutingHardBlock')?.checked) throw new Error(decision.warning);
      }
      return originalAsk.call(this, payload, options);
    };
    NS.AIProvider.ask.stage17iPreflightWrapped = true;
    wrapped = true;
    return true;
  }

  function pill(ok, text) {
    return `<span class="ai-routing-pill ${ok ? 'ok' : 'bad'}">${escapeHtml(text)}</span>`;
  }

  function rowsHtml(report = reportObject(lastBackendStatus)) {
    return report.workflows.map(w => {
      const final = w.agents.length ? w.agents.map(a => `${a.role}: ${a.provider}/${a.model}`).join(' · ') : `${w.finalProvider}/${w.finalModel}`;
      return [
        '<div class="ai-routing-row">',
        '<div class="ai-routing-row-head">',
        `<strong>${escapeHtml(w.title)}</strong>${pill(w.backendSupported && w.webSearchOk, w.backendSupported && w.webSearchOk ? 'ok' : 'check')}`,
        '</div>',
        `<div class="ai-routing-line">Visible: ${escapeHtml(w.visibleProvider)}/${escapeHtml(w.visibleModel)}</div>`,
        `<div class="ai-routing-line">Route: ${escapeHtml(w.routeKey)} → ${escapeHtml(w.routeProvider)}/${escapeHtml(w.routeModel)}</div>`,
        `<div class="ai-routing-line">Final: ${escapeHtml(final)} · ${escapeHtml(w.finalSource)}</div>`,
        `<div class="ai-routing-line">Backend allowed: ${w.backendSupported ? 'yes' : 'NO'} · Web search: ${w.webSearchRequired ? (w.webSearchOk ? 'required/ok' : 'required/NO') : 'not required'}</div>`,
        w.notes.length ? `<div class="ai-routing-note">${escapeHtml(w.notes.join(' '))}</div>` : '',
        '</div>'
      ].join('');
    }).join('');
  }

  function renderInspector() {
    const report = reportObject(lastBackendStatus);
    const summary = el('aiRoutingSummary');
    if (summary) {
      summary.textContent = `${report.summary.unsupported} unsupported · ${report.summary.mismatches} mismatch(es) · ${report.summary.webSearchProblems} web-search problem(s)`;
      summary.classList.toggle('bad', Boolean(report.summary.unsupported || report.summary.webSearchProblems));
    }
    const backend = el('aiRoutingBackendSummary');
    if (backend) backend.textContent = lastBackendStatus ? `Backend: ${lastBackendStatus.stage || '(unknown stage)'}` : 'Backend not checked yet.';
    const rows = el('aiRoutingRows');
    if (rows) rows.innerHTML = rowsHtml(report);
    return report;
  }

  function workflowOptionsHtml() {
    return WORKFLOWS.map(w => `<option value="${escapeHtml(w.key)}">${escapeHtml(w.title)}</option>`).join('');
  }

  function setStatus(msg) { const n = el('aiRoutingInspectorStatus'); if (n) n.textContent = msg; }
  function setOutput(text) { const n = el('aiRoutingInspectorOutput'); if (n) { n.classList.add('active'); n.textContent = String(text || ''); } }
  function escapeHtml(v) { return String(v || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

  function createCard() {
    const settings = el('settingsTab') || el('copilotTab') || D.querySelector('.right-panel');
    if (!settings || el('aiRoutingInspectorCard')) return false;
    const card = D.createElement('div');
    card.id = 'aiRoutingInspectorCard';
    card.className = 'ai-routing-card';
    card.innerHTML = [
      '<div class="section-head compact"><div><div class="smallcaps">AI routing</div><h2>AI model routing inspector</h2></div></div>',
      '<p class="ai-routing-help">Check visible provider/model, route-selected provider/model, final provider/model, backend allowed models, and web-search support before expensive AI calls.</p>',
      '<div class="ai-routing-grid"><label class="field">Workflow',
      `<select id="aiRoutingWorkflowSelect">${workflowOptionsHtml()}</select>`,
      '</label><label class="ai-routing-check"><input id="aiRoutingHardBlock" type="checkbox" /> Hard-block unsupported preflight calls</label></div>',
      '<div id="aiRoutingSummary" class="ai-routing-summary">Routing not checked yet.</div>',
      '<div id="aiRoutingBackendSummary" class="ai-routing-backend">Backend not checked yet.</div>',
      '<div class="ai-routing-actions">',
      '<button id="checkSelectedRoutingBtn" class="btn mini primary" type="button">Check selected workflow</button>',
      '<button id="checkAllRoutingBtn" class="btn mini" type="button">Check all AI workflows</button>',
      '<button id="copyRoutingReportBtn" class="btn mini" type="button">Copy routing report</button>',
      '<button id="resetSafeRoutesBtn" class="btn mini" type="button">Reset routes to safe defaults</button>',
      '</div>',
      '<div id="aiRoutingInspectorStatus" class="settings-note">AI routing inspector ready.</div>',
      '<div id="aiRoutingRows" class="ai-routing-rows"></div>',
      '<pre id="aiRoutingInspectorOutput" class="ai-routing-output"></pre>'
    ].join('');
    const reports = el('aiReportBrowserCard');
    const flags = el('featureFlagCard');
    if (reports?.parentElement === settings) settings.insertBefore(card, reports.nextSibling);
    else if (flags?.parentElement === settings) settings.insertBefore(card, flags.nextSibling);
    else settings.appendChild(card);
    el('checkSelectedRoutingBtn')?.addEventListener('click', () => checkWorkflow(), true);
    el('checkAllRoutingBtn')?.addEventListener('click', checkAllWorkflows, true);
    el('copyRoutingReportBtn')?.addEventListener('click', copyRoutingReport, true);
    el('resetSafeRoutesBtn')?.addEventListener('click', resetRoutesToSafeDefaults, true);
    renderInspector();
    return true;
  }

  function init() {
    createCard();
    wrapAiProviderPreflight();
    renderInspector();
  }

  NS.AiRoutingInspectorService = {
    STAGE,
    WORKFLOWS,
    init,
    visibleProviderModel,
    predictedFinalProviderModel,
    fetchBackendStatus,
    allowedModelsFor,
    backendHasWebSearch,
    checkWorkflow,
    checkAllWorkflows,
    resetRoutesToSafeDefaults,
    preflightPayload,
    wrapAiProviderPreflight,
    reportObject,
    formatReport,
    getLastBackendStatus: () => lastBackendStatus,
    getLastReport: () => lastReport
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  setTimeout(init, 1400);
  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

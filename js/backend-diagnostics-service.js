/* Latexai Stage 15F BackendDiagnosticsService
 * Stage: stage15f-backend-diagnostics-dashboard-1
 *
 * Adds a lightweight backend/boot diagnostics dashboard in Settings.
 * It only performs GET probes and local checks; it does not run compile jobs
 * or spend AI tokens.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage18x4-backend-url-settings-diagnostics-1';

  let lastReport = null;

  function el(id) { return D.getElementById(id); }

  function value(id) {
    return String(el(id)?.value || '').trim();
  }

  function absoluteUrl(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    try { return new URL(s, W.location.href).href; } catch (_err) { return s; }
  }

  function endpointOrigin(raw) {
    try { return new URL(absoluteUrl(raw)).origin; } catch (_err) { return ''; }
  }

  function replacePath(raw, path) {
    try {
      const url = new URL(absoluteUrl(raw));
      url.pathname = path;
      url.search = '';
      url.hash = '';
      return url.href;
    } catch (_err) {
      return '';
    }
  }

  function aiStatusUrl() {
    const raw = value('aiProxyUrl') || '/api/lumina/ai';
    try {
      const url = new URL(absoluteUrl(raw));
      if (/\/api\/lumina\/ai\/?$/i.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/?$/, '/status');
        url.search = '';
        return url.href;
      }
      if (/\/api\/lumina\/ai\/status\/?$/i.test(url.pathname)) return url.href;
    } catch (_err) {}
    return replacePath(raw, '/api/lumina/ai/status') || '';
  }

  function compileHealthUrl() {
    const raw = value('compileProxyUrl') || '/api/lumina/latex/compile';
    return replacePath(raw, '/health') || `${endpointOrigin(raw)}/health`;
  }

  function extractionHealthUrl() {
    const raw = value('aiProxyUrl') || value('compileProxyUrl') || W.location.href;
    return replacePath(raw, '/health') || `${endpointOrigin(raw)}/health`;
  }

  function memoryHealthUrl() {
    if (NS.BackendUrlSettings?.getMemoryApiBaseUrl) return `${NS.BackendUrlSettings.getMemoryApiBaseUrl()}/health`;
    const raw = value('memoryBackendUrl') || 'https://lumina-latex-backend-zugntkn2la-ue.a.run.app';
    try {
      const url = new URL(absoluteUrl(raw));
      url.pathname = url.pathname.replace(/\/api\/lumina\/memory(?:\/.+)?$/i, '/api/lumina/memory');
      if (!/\/api\/lumina\/memory\/?$/i.test(url.pathname)) url.pathname = url.pathname.replace(/\/+$/, '') + '/api/lumina/memory';
      url.pathname = url.pathname.replace(/\/?$/, '/health');
      url.search = '';
      url.hash = '';
      return url.href;
    } catch (_err) {
      return '';
    }
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = performance.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        ...options,
        signal: controller.signal
      });
      const elapsedMs = Math.round(performance.now() - started);
      let text = '';
      try { text = await response.text(); } catch (_err) {}
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        elapsedMs,
        url,
        bodyPreview: text.slice(0, 1200)
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        statusText: err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err)),
        elapsedMs: Math.round(performance.now() - started),
        url,
        bodyPreview: ''
      };
    } finally {
      clearTimeout(timer);
    }
  }

  function localBootChecks() {
    const scripts = Array.from(D.scripts || []).map((script) => script.getAttribute('src')).filter(Boolean);
    const css = Array.from(D.querySelectorAll('link[rel="stylesheet"]')).map((link) => link.getAttribute('href')).filter(Boolean);
    return {
      stage: W.LUMINA_LATEX_STAGE || '',
      safeMode: Boolean(W.LatexaiSafeMode?.isSafeMode?.()),
      safeModeReport: W.LatexaiSafeMode?.bootReport?.() || null,
      uiCleanupLoaded: Boolean(NS.UiCleanupService),
      compileRootServiceLoaded: Boolean(NS.CompileRootService),
      standalonePathServiceLoaded: Boolean(NS.StandalonePathService),
      presentationExportLoaded: Boolean(NS.PresentationExportService),
      aiProviderLoaded: Boolean(NS.AIProvider),
      compilerProviderLoaded: Boolean(NS.CompilerProvider),
      scripts,
      css
    };
  }

  async function runBackendDiagnostics() {
    setStatus('Running backend diagnostics...');
    const checks = [];
    const local = localBootChecks();

    const targets = [
      { name: 'Compile backend health', url: compileHealthUrl() },
      { name: 'AI backend status', url: aiStatusUrl() },
      { name: 'Memory backend health', url: memoryHealthUrl() },
      { name: 'Shared backend health', url: extractionHealthUrl() }
    ].filter((target, index, arr) => target.url && arr.findIndex((x) => x.name === target.name && x.url === target.url) === index);

    for (const target of targets) {
      setStatus(`Checking ${target.name}...`);
      const result = await fetchWithTimeout(target.url);
      checks.push({ name: target.name, ...result });
    }

    lastReport = {
      schema: 'latexai-backend-diagnostics-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      location: W.location.href,
      local,
      configured: {
        aiProxyUrl: value('aiProxyUrl'),
        memoryBackendUrl: value('memoryBackendUrl'),
        memoryApiBaseUrl: NS.BackendUrlSettings?.getMemoryApiBaseUrl?.() || '',
        compileProxyUrl: value('compileProxyUrl'),
        aiProvider: value('aiProvider'),
        aiModel: value('aiModel'),
        compilerMode: value('compilerModeSelect'),
        browserWasmAssetBase: value('browserWasmAssetBase'),
        browserWasmTexliveEndpoint: value('browserWasmTexliveEndpoint')
      },
      checks
    };

    renderReport(lastReport);
    const failures = checks.filter((c) => !c.ok).length;
    setStatus(failures ? `Diagnostics completed with ${failures} failing check(s).` : 'Diagnostics passed.');
    return lastReport;
  }

  function formatReport(report = lastReport) {
    if (!report) return 'No diagnostics report yet.';
    const lines = [
      'Latexai backend diagnostics',
      '===========================',
      '',
      `Generated: ${report.generatedAt}`,
      `App stage: ${report.local.stage || '(unknown)'}`,
      `Safe mode: ${report.local.safeMode ? 'ON' : 'off'}`,
      '',
      'Configured endpoints',
      '--------------------',
      `AI proxy: ${report.configured.aiProxyUrl || '(empty)'}`,
      `Memory backend: ${report.configured.memoryBackendUrl || '(empty)'}`,
      `Memory API base: ${report.configured.memoryApiBaseUrl || '(empty)'}`,
      `Compile proxy: ${report.configured.compileProxyUrl || '(empty)'}`,
      `Provider/model: ${report.configured.aiProvider || '(provider?)'} / ${report.configured.aiModel || '(model?)'}`,
      `Compiler mode: ${report.configured.compilerMode || '(unknown)'}`,
      '',
      'Loaded services',
      '---------------',
      `AIProvider: ${report.local.aiProviderLoaded ? 'yes' : 'no'}`,
      `CompilerProvider: ${report.local.compilerProviderLoaded ? 'yes' : 'no'}`,
      `CompileRootService: ${report.local.compileRootServiceLoaded ? 'yes' : 'no'}`,
      `StandalonePathService: ${report.local.standalonePathServiceLoaded ? 'yes' : 'no'}`,
      `PresentationExportService: ${report.local.presentationExportLoaded ? 'yes' : 'no'}`,
      `UiCleanupService: ${report.local.uiCleanupLoaded ? 'yes' : 'no'}`,
      '',
      'Endpoint checks',
      '---------------'
    ];

    for (const check of report.checks || []) {
      lines.push(`- ${check.name}: ${check.ok ? 'OK' : 'FAIL'} HTTP ${check.status} ${check.statusText} (${check.elapsedMs} ms)`);
      lines.push(`  ${check.url}`);
      if (check.bodyPreview) lines.push(`  body: ${check.bodyPreview.replace(/\s+/g, ' ').slice(0, 240)}`);
    }

    lines.push('', 'Script count: ' + (report.local.scripts?.length || 0));
    lines.push('CSS count: ' + (report.local.css?.length || 0));

    return lines.join('\n');
  }

  function renderReport(report) {
    const out = el('backendDiagnosticsOutput');
    if (out) {
      out.classList.add('active');
      out.textContent = formatReport(report);
    }
  }

  function setStatus(message) {
    const node = el('backendDiagnosticsStatus');
    if (node) node.textContent = message;
  }

  async function copyDiagnosticsReport() {
    const text = formatReport(lastReport);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Diagnostics report copied.');
    } catch (_err) {
      setStatus('Could not copy automatically. Select the report text manually.');
    }
  }

  function resetUiStateFromDiagnostics() {
    const removed = W.LatexaiSafeMode?.resetUiState?.() || [];
    setStatus(`Reset UI state (${removed.length} key(s) removed). Reloading in safe mode...`);
    setTimeout(() => {
      const url = new URL(W.location.href);
      url.searchParams.set('safe', '1');
      url.searchParams.delete('resetUi');
      W.location.href = url.href;
    }, 300);
  }

  function createCard() {
    const settings = el('settingsTab') || el('logsTab') || D.querySelector('.right-panel');
    if (!settings || el('backendDiagnosticsCard')) return false;

    const card = D.createElement('div');
    card.id = 'backendDiagnosticsCard';
    card.className = 'backend-diagnostics-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Diagnostics</div>',
      '    <h2>Backend and boot diagnostics</h2>',
      '  </div>',
      '</div>',
      '<p class="backend-diagnostics-help">Checks local boot state and backend health/status endpoints. This does not run a compile job and does not spend AI tokens.</p>',
      '<div class="backend-diagnostics-actions">',
      '  <button id="runBackendDiagnosticsBtn2" class="btn mini primary" type="button">Run backend diagnostics</button>',
      '  <button id="copyBackendDiagnosticsBtn" class="btn mini" type="button">Copy report</button>',
      '  <button id="resetUiFromDiagnosticsBtn" class="btn mini" type="button">Reset UI state</button>',
      '</div>',
      '<div id="backendDiagnosticsStatus" class="settings-note">Diagnostics ready.</div>',
      '<pre id="backendDiagnosticsOutput" class="backend-diagnostics-output"></pre>'
    ].join('');

    settings.appendChild(card);

    el('runBackendDiagnosticsBtn2')?.addEventListener('click', runBackendDiagnostics, true);
    el('copyBackendDiagnosticsBtn')?.addEventListener('click', copyDiagnosticsReport, true);
    el('resetUiFromDiagnosticsBtn')?.addEventListener('click', resetUiStateFromDiagnostics, true);

    return true;
  }

  function init() {
    createCard();
  }

  NS.BackendDiagnosticsService = {
    STAGE,
    init,
    runBackendDiagnostics,
    localBootChecks,
    formatReport,
    getLastReport: () => lastReport
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    if (createCard()) clearInterval(interval);
    tries += 1;
    if (tries > 40) clearInterval(interval);
  }, 500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

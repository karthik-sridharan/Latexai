/* Latexai Stage 15H RegressionChecklistService
 * Stage: stage15h-in-app-regression-checklist-1
 *
 * Lightweight in-app regression checklist.
 *
 * This intentionally avoids DOM observers, intervals, compile jobs, and AI calls.
 * It checks local DOM/service health and provides a copyable report so future
 * patches can be sanity-checked before deeper testing.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage15h-in-app-regression-checklist-1';
  const STORAGE_KEY = 'latexai:regression-checklist:last-report';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('regression-checklist-service')) {
    NS.RegressionChecklistService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false,
      runChecklist: () => ({ disabledBySafeMode: true })
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  let lastReport = null;

  function el(id) { return D.getElementById(id); }

  function exists(selector) {
    return Boolean(D.querySelector(selector));
  }

  function text(value) {
    return String(value || '').trim();
  }

  function activeRightPanels() {
    return Array.from(D.querySelectorAll('.right-tab-panel.active')).map((node) => node.id || '(anonymous)');
  }

  function activeRightTabs() {
    return Array.from(D.querySelectorAll('.right-tab.active')).map((node) => node.dataset.rightTab || node.textContent.trim());
  }

  function pass(name, details = '') {
    return { name, ok: true, severity: 'pass', details };
  }

  function warn(name, details = '') {
    return { name, ok: true, severity: 'warn', details };
  }

  function fail(name, details = '') {
    return { name, ok: false, severity: 'fail', details };
  }

  function checkDom() {
    const checks = [];
    checks.push(exists('#sourceEditor') ? pass('Source editor exists') : fail('Source editor exists', 'Missing #sourceEditor'));
    checks.push(exists('#compileBtn') ? pass('Compile button exists') : fail('Compile button exists', 'Missing #compileBtn'));
    checks.push(exists('#rootFileSelect') ? pass('Root-file selector exists') : warn('Root-file selector exists', 'Missing #rootFileSelect; compile-root features may be unavailable.'));
    checks.push(exists('#activeFilePill') ? pass('Active file indicator exists') : warn('Active file indicator exists', 'Missing #activeFilePill.'));
    checks.push(exists('#copilotTab') ? pass('Copilot tab panel exists') : fail('Copilot tab panel exists', 'Missing #copilotTab'));
    checks.push(exists('#settingsTab') ? pass('Settings tab panel exists') : fail('Settings tab panel exists', 'Missing #settingsTab'));
    checks.push(exists('#logsTab') ? pass('Logs tab panel exists') : fail('Logs tab panel exists', 'Missing #logsTab'));
    checks.push(exists('#previewTab') ? pass('Preview tab panel exists') : fail('Preview tab panel exists', 'Missing #previewTab'));

    const panels = activeRightPanels();
    checks.push(panels.length === 1 ? pass('Exactly one right-panel tab is active', panels.join(', ')) : fail('Exactly one right-panel tab is active', `Active panels: ${panels.join(', ') || '(none)'}`));

    const tabs = activeRightTabs();
    checks.push(tabs.length === 1 ? pass('Exactly one right-tab button is active', tabs.join(', ')) : warn('Exactly one right-tab button is active', `Active tab buttons: ${tabs.join(', ') || '(none)'}`));

    return checks;
  }

  function checkAiUi() {
    const checks = [];
    checks.push(exists('#aiProvider') ? pass('AI provider selector exists') : warn('AI provider selector exists', 'Missing #aiProvider'));
    checks.push(exists('#aiModel') ? pass('AI model selector exists') : warn('AI model selector exists', 'Missing #aiModel'));
    checks.push(exists('#aiProxyUrl') ? pass('AI backend proxy field exists') : warn('AI backend proxy field exists', 'Missing #aiProxyUrl'));
    checks.push(exists('#memoryBackendUrl') ? pass('Memory backend URL field exists') : warn('Memory backend URL field exists', 'Missing #memoryBackendUrl'));
    checks.push(exists('#askCopilotBtn') ? pass('Ask Copilot button exists') : warn('Ask Copilot button exists', 'Missing #askCopilotBtn'));
    checks.push(exists('#copilotPrompt') ? pass('Copilot prompt field exists') : warn('Copilot prompt field exists', 'Missing #copilotPrompt'));

    const hiddenCopilotBodies = D.querySelectorAll('#copilotTab .stage15a-card-body[hidden], #copilotTab .stage15b-card-body[hidden]').length;
    checks.push(hiddenCopilotBodies === 0 ? pass('No stale hidden Copilot card bodies') : fail('No stale hidden Copilot card bodies', `${hiddenCopilotBodies} stale hidden body/bodies found.`));

    const staleHeaders = D.querySelectorAll('#copilotTab .stage15a-card-header, #copilotTab .stage15b-card-header').length;
    checks.push(staleHeaders === 0 ? pass('No stale collapsed Copilot headers') : warn('No stale collapsed Copilot headers', `${staleHeaders} stale header(s) found; use safe mode reset if UI looks wrong.`));

    return checks;
  }

  function checkServices() {
    const checks = [];
    checks.push(NS.AIProvider ? pass('AIProvider loaded') : warn('AIProvider loaded', 'NS.AIProvider missing.'));
    checks.push(NS.CompilerProvider ? pass('CompilerProvider loaded') : warn('CompilerProvider loaded', 'NS.CompilerProvider missing.'));
    checks.push(NS.CompileRootService ? pass('CompileRootService loaded') : warn('CompileRootService loaded', 'Stage 14A service missing.'));
    checks.push(NS.StandalonePathService ? pass('StandalonePathService loaded') : warn('StandalonePathService loaded', 'Stage 14B service missing.'));
    checks.push(NS.PresentationExportService ? pass('PresentationExportService loaded') : warn('PresentationExportService loaded', 'Stage 13 exporter missing.'));
    checks.push(NS.BackendDiagnosticsService ? pass('BackendDiagnosticsService loaded') : warn('BackendDiagnosticsService loaded', 'Stage 15F service missing.'));
    checks.push(NS.ModelRoutingService ? pass('ModelRoutingService loaded') : warn('ModelRoutingService loaded', 'Stage 15G service missing.'));
    checks.push(W.LatexaiSafeMode ? pass('SafeMode service loaded') : warn('SafeMode service loaded', 'Stage 15E safe-mode service missing.'));
    return checks;
  }

  function checkSafeModeAndRecovery() {
    const checks = [];
    const safeOn = Boolean(W.LatexaiSafeMode?.isSafeMode?.());
    checks.push(W.LatexaiSafeMode?.resetUiState ? pass('Reset UI state is available') : warn('Reset UI state is available', 'Safe-mode reset hook missing.'));
    checks.push(exists('#safeModeRecoveryBar') ? pass('Recovery bar exists') : warn('Recovery bar exists', 'Recovery bar missing; safe-mode script may not have injected it.'));
    checks.push(safeOn ? warn('Safe mode status', 'Safe mode is ON; optional services may be disabled.') : pass('Safe mode status', 'Safe mode is off.'));
    return checks;
  }

  function checkBackendFields() {
    const checks = [];
    const compileUrl = text(el('compileProxyUrl')?.value);
    const aiUrl = text(el('aiProxyUrl')?.value);
    const memoryUrl = text(el('memoryBackendUrl')?.value);
    checks.push(compileUrl ? pass('Compile backend URL configured', compileUrl) : warn('Compile backend URL configured', 'Compile URL is empty.'));
    checks.push(aiUrl ? pass('AI backend URL configured', aiUrl) : warn('AI backend URL configured', 'AI proxy URL is empty.'));
    checks.push(memoryUrl ? pass('Memory backend URL configured', memoryUrl) : warn('Memory backend URL configured', 'Memory backend URL is empty.'));
    checks.push(exists('#backendDiagnosticsCard') ? pass('Backend diagnostics card exists') : warn('Backend diagnostics card exists', 'Open Settings; diagnostics card may not have initialized yet.'));
    checks.push(exists('#modelRoutingCard') ? pass('Model routing card exists') : warn('Model routing card exists', 'Open Settings; model routing card may not have initialized yet.'));
    return checks;
  }

  function manualChecklist() {
    return [
      { name: 'Compile main.tex with existing Compile PDF button', status: 'manual' },
      { name: 'Open a standalone talk/*.beamer.tex file and compile it', status: 'manual' },
      { name: 'Run Paper → Presentation export and validate package', status: 'manual' },
      { name: 'Run backend diagnostics from Settings', status: 'manual' },
      { name: 'Use ?safe=1 and confirm page still loads', status: 'manual' },
      { name: 'Use ?resetUi=1 and confirm UI recovers', status: 'manual' }
    ];
  }

  function summarize(checks) {
    const failCount = checks.filter((c) => c.severity === 'fail').length;
    const warnCount = checks.filter((c) => c.severity === 'warn').length;
    const passCount = checks.filter((c) => c.severity === 'pass').length;
    return { passCount, warnCount, failCount, total: checks.length };
  }

  function runChecklist() {
    const checks = [
      ...checkDom(),
      ...checkAiUi(),
      ...checkServices(),
      ...checkSafeModeAndRecovery(),
      ...checkBackendFields()
    ];

    lastReport = {
      schema: 'latexai-regression-checklist-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      appStage: W.LUMINA_LATEX_STAGE || '',
      url: W.location.href,
      userAgent: navigator.userAgent,
      summary: summarize(checks),
      checks,
      manualChecklist: manualChecklist()
    };

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lastReport)); } catch (_err) {}
    renderReport(lastReport);
    setStatus(statusLine(lastReport));
    return lastReport;
  }

  function statusLine(report) {
    const s = report?.summary || {};
    if (s.failCount) return `Regression checklist: ${s.failCount} fail(s), ${s.warnCount} warning(s), ${s.passCount} pass.`;
    if (s.warnCount) return `Regression checklist: ${s.warnCount} warning(s), ${s.passCount} pass.`;
    return `Regression checklist passed ${s.passCount || 0} local checks.`;
  }

  function formatReport(report = lastReport) {
    if (!report) return 'No regression checklist report yet.';
    const lines = [
      'Latexai regression checklist',
      '============================',
      '',
      `Generated: ${report.generatedAt}`,
      `App stage: ${report.appStage || '(unknown)'}`,
      `URL: ${report.url}`,
      '',
      `Pass: ${report.summary.passCount}`,
      `Warnings: ${report.summary.warnCount}`,
      `Failures: ${report.summary.failCount}`,
      '',
      'Automatic checks',
      '----------------'
    ];

    for (const check of report.checks || []) {
      const mark = check.severity === 'fail' ? 'FAIL' : (check.severity === 'warn' ? 'WARN' : 'PASS');
      lines.push(`- [${mark}] ${check.name}${check.details ? ` — ${check.details}` : ''}`);
    }

    lines.push('', 'Manual checklist', '----------------');
    for (const item of report.manualChecklist || []) {
      lines.push(`- [ ] ${item.name}`);
    }

    return lines.join('\n');
  }

  function renderReport(report) {
    const out = el('regressionChecklistOutput');
    if (out) {
      out.classList.add('active');
      out.textContent = formatReport(report);
    }

    const summary = el('regressionChecklistSummary');
    if (summary) {
      summary.textContent = statusLine(report);
      summary.classList.toggle('has-fails', Boolean(report.summary.failCount));
      summary.classList.toggle('has-warnings', !report.summary.failCount && Boolean(report.summary.warnCount));
    }
  }

  function setStatus(message) {
    const node = el('regressionChecklistStatus');
    if (node) node.textContent = message;
  }

  async function copyChecklist() {
    const textToCopy = formatReport(lastReport || runChecklist());
    try {
      await navigator.clipboard.writeText(textToCopy);
      setStatus('Regression checklist copied.');
    } catch (_err) {
      setStatus('Could not copy automatically. Select the report text manually.');
    }
  }

  function downloadChecklist() {
    const report = lastReport || runChecklist();
    const blob = new Blob([JSON.stringify(report, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = D.createElement('a');
    a.href = url;
    a.download = `latexai-regression-checklist-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    D.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Regression checklist JSON downloaded.');
  }

  function resetUiAndSafeReload() {
    const removed = W.LatexaiSafeMode?.resetUiState?.() || [];
    setStatus(`Reset UI state (${removed.length} key(s) removed). Reloading safe mode...`);
    setTimeout(() => {
      const url = new URL(W.location.href);
      url.searchParams.set('safe', '1');
      url.searchParams.delete('resetUi');
      W.location.href = url.href;
    }, 300);
  }

  function createCard() {
    const settings = el('settingsTab') || el('logsTab') || D.querySelector('.right-panel');
    if (!settings || el('regressionChecklistCard')) return false;

    const card = D.createElement('div');
    card.id = 'regressionChecklistCard';
    card.className = 'regression-checklist-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Regression</div>',
      '    <h2>Regression checklist</h2>',
      '  </div>',
      '</div>',
      '<p class="regression-checklist-help">Runs local smoke checks for UI, services, safe mode, and backend configuration. It does not compile and does not call AI.</p>',
      '<div id="regressionChecklistSummary" class="regression-checklist-summary">Checklist not run yet.</div>',
      '<div class="regression-checklist-actions">',
      '  <button id="runRegressionChecklistBtn" class="btn mini primary" type="button">Run checklist</button>',
      '  <button id="copyRegressionChecklistBtn" class="btn mini" type="button">Copy report</button>',
      '  <button id="downloadRegressionChecklistBtn" class="btn mini" type="button">Download JSON</button>',
      '  <button id="safeReloadFromChecklistBtn" class="btn mini" type="button">Reset UI + safe reload</button>',
      '</div>',
      '<div id="regressionChecklistStatus" class="settings-note">Regression checklist ready.</div>',
      '<pre id="regressionChecklistOutput" class="regression-checklist-output"></pre>'
    ].join('');

    const diagnostics = el('backendDiagnosticsCard');
    if (diagnostics?.parentElement === settings) settings.insertBefore(card, diagnostics.nextSibling);
    else settings.appendChild(card);

    el('runRegressionChecklistBtn')?.addEventListener('click', runChecklist, true);
    el('copyRegressionChecklistBtn')?.addEventListener('click', copyChecklist, true);
    el('downloadRegressionChecklistBtn')?.addEventListener('click', downloadChecklist, true);
    el('safeReloadFromChecklistBtn')?.addEventListener('click', resetUiAndSafeReload, true);

    return true;
  }

  function init() {
    createCard();
  }

  NS.RegressionChecklistService = {
    STAGE,
    init,
    runChecklist,
    formatReport,
    checkDom,
    checkAiUi,
    checkServices,
    checkSafeModeAndRecovery,
    checkBackendFields,
    getLastReport: () => lastReport
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  // One delayed attempt only; no intervals/observers.
  setTimeout(createCard, 750);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

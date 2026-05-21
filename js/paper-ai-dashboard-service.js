/* Latexai Stage 17C PaperAiDashboardService
 * Stage: stage17c-paper-ai-dashboard-1
 *
 * Paper AI dashboard / workflow launcher.
 *
 * One top-level Copilot card that shows:
 * - which paper-AI workflows are enabled/loaded/visible;
 * - quick jump to each workflow card;
 * - quick run buttons when a workflow has a safe existing primary action;
 * - high-level workflow status report.
 *
 * This service is local-only by itself: no AI calls and no compile jobs.
 * It can trigger existing workflow buttons only when the user clicks Run.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage17c-paper-ai-dashboard-1';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('paper-ai-dashboard-service')) {
    NS.PaperAiDashboardService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  let lastReport = '';

  const WORKFLOWS = [
    {
      key: 'paper-ai-polish',
      title: 'Paper-level edit review',
      tab: 'copilot',
      cardId: 'paperAiPolishCard',
      service: 'PaperAiPolishService',
      primaryButtonId: 'paperAiScanBtn',
      runLabel: 'Scan edits',
      outputId: 'paperAiPolishOutput'
    },
    {
      key: 'competitive-review',
      title: 'Competitive paper review',
      tab: 'copilot',
      cardId: 'competitiveReviewCard',
      service: 'CompetitivePaperReviewService',
      primaryButtonId: 'runCompetitiveReviewBtn',
      runLabel: 'Run review',
      outputId: 'competitiveReviewOutput'
    },
    {
      key: 'devils-advocate-debate',
      title: 'Devil’s advocate debate',
      tab: 'copilot',
      cardId: 'devilsDebateCard',
      service: 'DevilsAdvocateDebateService',
      primaryButtonId: 'runDevilsDebateBtn',
      runLabel: 'Run debate',
      outputId: 'devilsDebateOutput'
    },
    {
      key: 'ai-suggestion-comments',
      title: 'AI suggestion comments',
      tab: 'copilot',
      cardId: 'aiCommentsCard',
      service: 'AiSuggestionCommentsService',
      primaryButtonId: 'refreshAiCommentsBtn',
      runLabel: 'Refresh',
      outputId: 'aiCommentsOutput'
    },
    {
      key: 'ai-revision-history',
      title: 'AI revision history',
      tab: 'settings',
      cardId: 'aiRevisionCard',
      service: 'AiRevisionHistoryService',
      primaryButtonId: 'refreshAiSnapshotsBtn',
      runLabel: 'View snapshots',
      outputId: 'aiRevisionOutput'
    },
    {
      key: 'citation-ai',
      title: 'Citation filler',
      tab: 'copilot',
      cardId: 'citationAiCard',
      service: 'CitationAiService',
      primaryButtonId: 'runCitationAiBtn',
      runLabel: 'Run',
      outputId: 'citationAiOutput'
    },
    {
      key: 'citation-verifier',
      title: 'Citation verifier',
      tab: 'copilot',
      cardId: 'citationVerifierCard',
      service: 'CitationVerifierService',
      primaryButtonId: 'runCitationVerifierBtn',
      runLabel: 'Verify',
      outputId: 'citationVerifierOutput'
    },
    {
      key: 'backend-diagnostics',
      title: 'Backend diagnostics',
      tab: 'settings',
      cardId: 'backendDiagnosticsCard',
      service: 'BackendDiagnosticsService',
      primaryButtonId: 'runBackendDiagnosticsBtn2',
      runLabel: 'Run diagnostics',
      outputId: 'backendDiagnosticsOutput'
    },
    {
      key: 'regression-checklist',
      title: 'Regression checklist',
      tab: 'settings',
      cardId: 'regressionChecklistCard',
      service: 'RegressionChecklistService',
      primaryButtonId: 'runRegressionChecklistBtn',
      runLabel: 'Run checklist',
      outputId: 'regressionChecklistOutput'
    }
  ];

  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }

  function safeModeOn() {
    return Boolean(W.LatexaiSafeMode?.isSafeMode?.());
  }

  function featureFlags() {
    try {
      if (NS.FeatureFlagService?.getFlags) return NS.FeatureFlagService.getFlags();
      if (W.LatexaiFeatureFlags?.getFlags) return W.LatexaiFeatureFlags.getFlags();
    } catch (_err) {}
    return {};
  }

  function featureReport() {
    try {
      if (NS.FeatureFlagService?.getReport) return NS.FeatureFlagService.getReport();
      if (W.LatexaiFeatureFlags?.getReport) return W.LatexaiFeatureFlags.getReport();
    } catch (_err) {}
    return null;
  }

  function featureStatusFor(key) {
    const report = featureReport();
    return report?.status?.[key] || null;
  }

  function isElementVisible(node) {
    if (!node) return false;
    const rect = node.getBoundingClientRect();
    const style = W.getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function outputHasContent(workflow) {
    const node = el(workflow.outputId);
    return Boolean(node && clean(node.textContent));
  }

  function commentCount() {
    try {
      return NS.AiSuggestionCommentsService?.getComments?.({ status: 'open' })?.length || 0;
    } catch (_err) {
      return 0;
    }
  }

  function snapshotCount() {
    try {
      return NS.AiRevisionHistoryService?.getSnapshots?.()?.length || 0;
    } catch (_err) {
      return 0;
    }
  }

  function workflowStatus(workflow) {
    const flags = featureFlags();
    const card = el(workflow.cardId);
    const featureStatus = featureStatusFor(workflow.key);
    const enabled = flags[workflow.key] !== false;
    const loaded = Boolean(NS[workflow.service]);
    const visible = isElementVisible(card);
    const present = Boolean(card);
    const hasOutput = outputHasContent(workflow);
    const runnable = Boolean(el(workflow.primaryButtonId));

    return {
      key: workflow.key,
      title: workflow.title,
      tab: workflow.tab,
      enabled,
      loaded,
      present,
      visible,
      hasOutput,
      runnable,
      service: workflow.service,
      cardId: workflow.cardId,
      featureState: featureStatus?.state || (enabled ? 'unknown' : 'disabled'),
      featureDetails: featureStatus?.details || '',
      openComments: workflow.key === 'ai-suggestion-comments' ? commentCount() : undefined,
      snapshots: workflow.key === 'ai-revision-history' ? snapshotCount() : undefined
    };
  }

  function dashboardReport() {
    const statuses = WORKFLOWS.map(workflowStatus);
    return {
      schema: 'latexai-paper-ai-dashboard-report-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      appStage: W.LUMINA_LATEX_STAGE || '',
      safeMode: safeModeOn(),
      workflows: statuses,
      summary: {
        total: statuses.length,
        enabled: statuses.filter((s) => s.enabled).length,
        loaded: statuses.filter((s) => s.loaded).length,
        visible: statuses.filter((s) => s.visible).length,
        missingCards: statuses.filter((s) => s.enabled && !s.present).length,
        outputs: statuses.filter((s) => s.hasOutput).length,
        openComments: commentCount(),
        snapshots: snapshotCount()
      }
    };
  }

  function formatDashboardReport(report = dashboardReport()) {
    const lines = [
      'Latexai Paper AI dashboard report',
      '==================================',
      '',
      `Generated: ${report.generatedAt}`,
      `App stage: ${report.appStage || '(unknown)'}`,
      `Safe mode: ${report.safeMode ? 'ON' : 'off'}`,
      '',
      'Summary',
      '-------',
      `Workflows: ${report.summary.total}`,
      `Enabled: ${report.summary.enabled}`,
      `Loaded: ${report.summary.loaded}`,
      `Visible: ${report.summary.visible}`,
      `Missing enabled cards: ${report.summary.missingCards}`,
      `Workflows with output: ${report.summary.outputs}`,
      `Open AI suggestion comments: ${report.summary.openComments}`,
      `AI revision snapshots: ${report.summary.snapshots}`,
      '',
      'Workflows',
      '---------'
    ];

    for (const item of report.workflows) {
      lines.push(`- ${item.title}`);
      lines.push(`  feature: ${item.enabled ? 'enabled' : 'disabled'}; state: ${item.featureState}`);
      lines.push(`  service: ${item.loaded ? 'loaded' : 'missing'}; card: ${item.present ? (item.visible ? 'visible' : 'present/hidden') : 'missing'}; output: ${item.hasOutput ? 'yes' : 'no'}`);
      if (item.openComments !== undefined) lines.push(`  open comments: ${item.openComments}`);
      if (item.snapshots !== undefined) lines.push(`  snapshots: ${item.snapshots}`);
      if (item.featureDetails) lines.push(`  details: ${item.featureDetails}`);
    }

    return lines.join('\n');
  }

  function activateRightTab(tab) {
    const name = tab === 'settings' ? 'settings' : 'copilot';
    try {
      const btn = D.querySelector(`[data-right-tab="${CSS.escape(name)}"]`);
      if (btn) {
        btn.click();
        return true;
      }
    } catch (_err) {}

    try {
      if (NS.UiCleanupService?.activateRightTab) {
        NS.UiCleanupService.activateRightTab(name);
        return true;
      }
    } catch (_err) {}

    const panelId = name === 'settings' ? 'settingsTab' : 'copilotTab';
    D.querySelectorAll('.right-tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === panelId));
    D.querySelectorAll('.right-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.rightTab === name));
    return true;
  }

  function jumpToWorkflow(key) {
    const workflow = WORKFLOWS.find((item) => item.key === key);
    if (!workflow) return false;

    activateRightTab(workflow.tab);

    setTimeout(() => {
      const card = el(workflow.cardId);
      if (!card) {
        setStatus(`Card not found: ${workflow.title}. Check feature flags or reload.`);
        renderDashboard();
        return;
      }

      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card.classList.add('paper-ai-dashboard-highlight');
      setTimeout(() => card.classList.remove('paper-ai-dashboard-highlight'), 1600);
      setStatus(`Jumped to ${workflow.title}.`);
    }, 80);

    return true;
  }

  function runWorkflow(key) {
    const workflow = WORKFLOWS.find((item) => item.key === key);
    if (!workflow) return false;
    jumpToWorkflow(key);

    setTimeout(() => {
      const btn = el(workflow.primaryButtonId);
      if (!btn) {
        setStatus(`Run button not found for ${workflow.title}.`);
        renderDashboard();
        return;
      }
      btn.click();
      setStatus(`Triggered ${workflow.title}: ${workflow.runLabel}.`);
      setTimeout(renderDashboard, 500);
    }, 220);
    return true;
  }

  function openFeatureFlags() {
    activateRightTab('settings');
    setTimeout(() => {
      const card = el('featureFlagCard');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        card.classList.add('paper-ai-dashboard-highlight');
        setTimeout(() => card.classList.remove('paper-ai-dashboard-highlight'), 1600);
        setStatus('Opened Feature flags.');
      } else {
        setStatus('Feature flags card not found.');
      }
    }, 80);
  }

  async function copyDashboardReport() {
    const report = formatDashboardReport();
    lastReport = report;
    setOutput(report);
    try {
      await navigator.clipboard.writeText(report);
      setStatus('Dashboard report copied.');
    } catch (_err) {
      setStatus('Could not copy automatically. Report shown below.');
    }
  }

  function cardHtml(status) {
    const cls = [
      'paper-ai-dashboard-workflow',
      status.enabled ? 'enabled' : 'disabled',
      status.loaded ? 'loaded' : 'missing',
      status.visible ? 'visible' : 'not-visible'
    ].join(' ');

    const statusText = [
      status.enabled ? 'enabled' : 'disabled',
      status.loaded ? 'loaded' : 'missing service',
      status.present ? (status.visible ? 'visible' : 'hidden') : 'card missing',
      status.hasOutput ? 'has output' : 'no output'
    ].join(' · ');

    const extra = [];
    if (status.openComments !== undefined) extra.push(`${status.openComments} open comment(s)`);
    if (status.snapshots !== undefined) extra.push(`${status.snapshots} snapshot(s)`);

    const workflow = WORKFLOWS.find((item) => item.key === status.key);
    const runLabel = workflow?.runLabel || 'Run';

    return [
      `<div class="${cls}" data-dashboard-workflow="${escapeHtml(status.key)}">`,
      '  <div class="paper-ai-dashboard-workflow-head">',
      `    <strong>${escapeHtml(status.title)}</strong>`,
      `    <span>${escapeHtml(status.featureState)}</span>`,
      '  </div>',
      `  <div class="paper-ai-dashboard-workflow-status">${escapeHtml(statusText)}</div>`,
      extra.length ? `<div class="paper-ai-dashboard-extra">${escapeHtml(extra.join(' · '))}</div>` : '',
      '  <div class="paper-ai-dashboard-actions-row">',
      `    <button class="btn mini" type="button" data-dashboard-jump="${escapeHtml(status.key)}">Jump to card</button>`,
      `    <button class="btn mini" type="button" data-dashboard-run="${escapeHtml(status.key)}"${status.runnable ? '' : ' disabled'}>${escapeHtml(runLabel)}</button>`,
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderDashboard() {
    const report = dashboardReport();
    const summary = el('paperAiDashboardSummary');
    if (summary) {
      summary.textContent = `${report.summary.loaded}/${report.summary.total} loaded · ${report.summary.visible} visible · ${report.summary.openComments} open comment(s) · ${report.summary.snapshots} snapshot(s)`;
      summary.classList.toggle('has-missing', report.summary.missingCards > 0);
    }

    const list = el('paperAiDashboardList');
    if (list) list.innerHTML = report.workflows.map(cardHtml).join('');

    D.querySelectorAll('[data-dashboard-jump]').forEach((btn) => {
      btn.onclick = () => jumpToWorkflow(btn.dataset.dashboardJump);
    });
    D.querySelectorAll('[data-dashboard-run]').forEach((btn) => {
      btn.onclick = () => runWorkflow(btn.dataset.dashboardRun);
    });

    return report;
  }

  function setStatus(message) {
    const node = el('paperAiDashboardStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const out = el('paperAiDashboardOutput');
    if (out) {
      out.classList.add('active');
      out.textContent = String(text || '');
    }
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function createCard() {
    const panel = el('copilotTab') || D.querySelector('.right-panel');
    if (!panel || el('paperAiDashboardCard')) return false;

    const card = D.createElement('div');
    card.id = 'paperAiDashboardCard';
    card.className = 'paper-ai-dashboard-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Dashboard</div>',
      '    <h2>Paper AI dashboard</h2>',
      '  </div>',
      '</div>',
      '<p class="paper-ai-dashboard-help">Quick-launch and status dashboard for paper AI workflows. Use this instead of hunting through the long Copilot/Settings panels.</p>',
      '<div id="paperAiDashboardSummary" class="paper-ai-dashboard-summary">Dashboard not refreshed yet.</div>',
      '<div class="paper-ai-dashboard-actions">',
      '  <button id="refreshPaperAiDashboardBtn" class="btn mini primary" type="button">Refresh dashboard</button>',
      '  <button id="copyPaperAiDashboardBtn" class="btn mini" type="button">Copy workflow status</button>',
      '  <button id="openFeatureFlagsFromDashboardBtn" class="btn mini" type="button">Open feature flags</button>',
      '</div>',
      '<div id="paperAiDashboardStatus" class="settings-note">Paper AI dashboard ready.</div>',
      '<div id="paperAiDashboardList" class="paper-ai-dashboard-list"></div>',
      '<pre id="paperAiDashboardOutput" class="paper-ai-dashboard-output"></pre>'
    ].join('');

    panel.insertBefore(card, panel.firstChild);

    el('refreshPaperAiDashboardBtn')?.addEventListener('click', () => {
      renderDashboard();
      setStatus('Dashboard refreshed.');
    }, true);
    el('copyPaperAiDashboardBtn')?.addEventListener('click', copyDashboardReport, true);
    el('openFeatureFlagsFromDashboardBtn')?.addEventListener('click', openFeatureFlags, true);

    renderDashboard();
    return true;
  }

  function init() {
    createCard();
    renderDashboard();
  }

  NS.PaperAiDashboardService = {
    STAGE,
    init,
    WORKFLOWS,
    renderDashboard,
    dashboardReport,
    formatDashboardReport,
    jumpToWorkflow,
    runWorkflow,
    openFeatureFlags,
    getLastReport: () => lastReport
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  setTimeout(init, 1200);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

// Stage 19W10: right-panel workflow tabs + debug-only diagnostics cleanup.
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'latex-stage19w13-objective-improver-unified-subtab-20260604-1';
  const STORAGE_TAB = 'latexai:stage19w10:right-tab';
  const STORAGE_WORKFLOW = 'latexai:stage19w10:paper-ai-workflow-tab';
  const STORAGE_OBJECTIVE = 'latexai:stage19w13:objective-improver-mode';

  const PAPER_WORKFLOW_CARDS = {
    documentAiCard: 'paperWorkflowRemakePane',
    reviewerRebuttalCard: 'paperWorkflowReviewPane',
    realAgentBranchCard: 'paperWorkflowObjectivePane',
    competitiveReviewCard: 'paperWorkflowObjectivePane'
  };

  const LITERATURE_CARDS = {
    citationAiCard: 'literatureCitationPane',
    citationVerifierCard: 'literatureCitationPane'
  };

  const PROJECT_CARDS = {
    projectBlockContextCard: 'projectContextPane'
  };

  const DEBUG_CARD_IDS = [
    'paperAiDashboardCard',
    'regressionChecklistCard',
    'contextPolicyDashboardCard',
    'backendDiagnosticsCard',
    'releaseVerifyCard',
    'aiRoutingInspectorCard'
  ];

  function el(id) { return D.getElementById(id); }
  function q(sel, root) { return (root || D).querySelector(sel); }
  function qa(sel, root) { return Array.from((root || D).querySelectorAll(sel)); }

  function params() {
    try { return new URLSearchParams(W.location.search || ''); } catch (_e) { return new URLSearchParams(); }
  }

  function isDebugMode() {
    const p = params();
    const values = [p.get('debug'), p.get('laiDebug'), p.get('luminaDebug'), p.get('diagnostics')].filter((x) => x !== null);
    return values.some((v) => /^(1|true|yes|on)$/i.test(String(v || '').trim()));
  }

  function applyDebugClass() {
    const debug = isDebugMode();
    D.body.classList.toggle('stage19w10-debug-mode', debug);
    D.body.classList.toggle('stage19w10-clean-mode', !debug);
    return debug;
  }

  function cssEscape(value) {
    if (W.CSS && typeof W.CSS.escape === 'function') return W.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function activateRightTab(name) {
    if (!name) return;
    const btn = q(`[data-right-tab="${cssEscape(name)}"]`);
    const panel = el(`${name}Tab`);
    if (!btn || !panel) return;
    qa('[data-right-tab]').forEach((b) => b.classList.toggle('active', b === btn));
    qa('.right-tab-panel').forEach((p) => p.classList.toggle('active', p === panel));
    try { localStorage.setItem(STORAGE_TAB, name); } catch (_e) {}
  }

  function normalizeWorkflowKey(name) {
    const raw = String(name || 'remake').trim();
    if (/^(devils|competitive|ranking|adversarial)$/i.test(raw)) return 'objective';
    return raw || 'remake';
  }

  function activateWorkflow(name) {
    const key = normalizeWorkflowKey(name || 'remake');
    qa('.stage19w10-workflow-tab').forEach((b) => b.classList.toggle('active', b.dataset.workflowTab === key));
    qa('.stage19w10-workflow-pane[data-workflow-pane]').forEach((p) => p.classList.toggle('active', p.dataset.workflowPane === key));
    try { localStorage.setItem(STORAGE_WORKFLOW, key); } catch (_e) {}
    applyObjectiveMode();
  }

  function bindWorkflowTabs() {
    qa('.stage19w10-workflow-tab').forEach((btn) => {
      if (btn.dataset.stage19w10Bound === 'true') return;
      btn.dataset.stage19w10Bound = 'true';
      btn.addEventListener('click', () => activateWorkflow(btn.dataset.workflowTab || 'remake'), true);
    });
  }

  function stripPlaceholder(target) {
    if (!target) return;
    const placeholders = qa(':scope > .settings-note', target).filter((n) => /will appear here|Project block context card|Citation AI cards|Total Paper Remake controls/i.test(n.textContent || ''));
    placeholders.forEach((n) => n.remove());
  }

  function moveCard(cardId, targetId) {
    const card = el(cardId);
    const target = el(targetId);
    if (!card || !target || card.parentElement === target) return false;
    stripPlaceholder(target);
    target.appendChild(card);
    card.dataset.stage19w10Home = targetId;
    return true;
  }

  function addDiagnosticLabel(card, text) {
    if (!card || card.dataset.stage19w10LabelAdded === 'true') return;
    const label = D.createElement('div');
    label.className = 'stage19w10-diagnostic-label';
    label.textContent = text || 'Developer diagnostic';
    card.insertBefore(label, card.firstChild);
    card.dataset.stage19w10LabelAdded = 'true';
  }

  function diagnosticsHost() {
    let host = el('developerDiagnosticsCards');
    if (host) return host;
    const settings = el('settingsTab') || D.querySelector('.right-panel');
    if (!settings) return null;
    let section = el('developerDiagnosticsSection');
    if (!section) {
      section = D.createElement('div');
      section.id = 'developerDiagnosticsSection';
      section.className = 'stage19w10-developer-diagnostics stage19w10-debug-only';
      section.innerHTML = '<div class="section-head compact"><div><div class="smallcaps">Developer</div><h2>Developer / diagnostics</h2></div></div><div class="settings-note compact">Hidden in normal mode. Add <code>?debug=1</code> to show diagnostic cards.</div><div id="developerDiagnosticsCards" class="stage19w10-debug-card-host"></div>';
      settings.appendChild(section);
    }
    return el('developerDiagnosticsCards');
  }

  function moveDiagnostics() {
    const host = diagnosticsHost();
    const debug = isDebugMode();
    DEBUG_CARD_IDS.forEach((id) => {
      const card = el(id);
      if (!card || !host) return;
      card.classList.add('stage19w10-debug-only');
      addDiagnosticLabel(card, 'Developer diagnostic · hidden unless debug=1');
      if (card.parentElement !== host) host.appendChild(card);
      card.classList.toggle('stage19w10-hidden-by-debug-policy', !debug);
    });
    qa('.branch-workflow-regression-card').forEach((node) => {
      node.classList.add('stage19w10-debug-only');
      node.classList.toggle('stage19w10-hidden-by-debug-policy', !debug);
    });
    const runApp = el('runAppDiagnosticsBtn');
    if (runApp) runApp.classList.add('stage19w10-debug-only');
  }

  function ensureObjectiveImproverControls() {
    const pane = el('paperWorkflowObjectivePane');
    if (!pane || el('stage19w13ObjectiveImproverControls')) return;
    stripPlaceholder(pane);
    const box = D.createElement('div');
    box.id = 'stage19w13ObjectiveImproverControls';
    box.className = 'stage19w13-objective-improver-card settings-card-subtle';
    box.innerHTML = [
      '<div class="section-head compact"><div><div class="smallcaps">Unified objective engine</div><h2>Goal-driven paper improver</h2></div></div>',
      '<p class="settings-note compact">This subtab merges the old Devil’s Advocate branch runner and Competitive Review. The underlying engine is an objective-driven paper improver: choose a scope, focal improvement type, and objective. Competitive ranking is just one objective when competitor papers are supplied.</p>',
      '<div class="field-grid two compact">',
      '  <label class="field">Objective mode',
      '    <select id="stage19w13ObjectiveMode">',
      '      <option value="acceptance">Increase acceptance probability / paper quality</option>',
      '      <option value="competitive">Improve ranking against competitor papers</option>',
      '      <option value="combined">Combined: adversarial + competitive</option>',
      '    </select>',
      '  </label>',
      '  <label class="field">Scope',
      '    <select id="stage19w13ObjectiveScope">',
      '      <option value="whole" selected>Whole paper</option>',
      '      <option value="selected">Selected text / section</option>',
      '      <option value="salient">Most salient blocks</option>',
      '    </select>',
      '  </label>',
      '</div>',
      '<div class="field-grid two compact">',
      '  <label class="field">Improvement focus',
      '    <select id="stage19w13ObjectiveFocus">',
      '      <option value="balanced" selected>Balanced</option>',
      '      <option value="ideas">Ideas / novelty / positioning</option>',
      '      <option value="writing">Writing / organization / clarity</option>',
      '      <option value="math">Math / assumptions / notation / proof clarity</option>',
      '      <option value="citations">Citations / related work</option>',
      '    </select>',
      '  </label>',
      '  <label class="field">Search budget',
      '    <select id="stage19w13ObjectiveBudget">',
      '      <option value="fast" selected>Fast</option>',
      '      <option value="balanced">Balanced</option>',
      '      <option value="deep">Deep</option>',
      '    </select>',
      '  </label>',
      '</div>',
      '<div id="stage19w13ObjectiveStatus" class="settings-note compact">Acceptance mode shows the adversarial branch runner. Competitive mode shows competitor-paper ranking/review. Combined mode shows both.</div>'
    ].join('');
    pane.insertBefore(box, pane.firstChild);
    const select = el('stage19w13ObjectiveMode');
    if (select) {
      try { select.value = localStorage.getItem(STORAGE_OBJECTIVE) || 'acceptance'; } catch (_e) { select.value = 'acceptance'; }
      select.addEventListener('change', () => {
        try { localStorage.setItem(STORAGE_OBJECTIVE, select.value || 'acceptance'); } catch (_e) {}
        applyObjectiveMode();
      }, true);
    }
  }

  function setCardHidden(card, hidden) {
    if (!card) return;
    card.classList.toggle('stage19w13-objective-hidden', !!hidden);
    if (hidden) card.setAttribute('aria-hidden', 'true');
    else card.removeAttribute('aria-hidden');
  }

  function applyObjectiveMode() {
    const pane = el('paperWorkflowObjectivePane');
    if (!pane) return;
    ensureObjectiveImproverControls();
    const select = el('stage19w13ObjectiveMode');
    let mode = (select && select.value) || 'acceptance';
    if (!/^(acceptance|competitive|combined)$/.test(mode)) mode = 'acceptance';
    const devils = el('realAgentBranchCard');
    const competitive = el('competitiveReviewCard');
    setCardHidden(devils, mode === 'competitive');
    setCardHidden(competitive, mode === 'acceptance');
    const status = el('stage19w13ObjectiveStatus');
    if (status) {
      if (mode === 'competitive') status.textContent = 'Competitive objective selected: use competitor URLs/reference papers to evaluate and improve relative ranking.';
      else if (mode === 'combined') status.textContent = 'Combined objective selected: use adversarial debate plus competitor-paper ranking context.';
      else status.textContent = 'Acceptance/quality objective selected: use the adversarial branch runner to stress-test and improve the paper without competitor papers.';
    }
    if (select) {
      try { localStorage.setItem(STORAGE_OBJECTIVE, mode); } catch (_e) {}
    }
  }

  function moveWorkflowCards() {
    Object.entries(PAPER_WORKFLOW_CARDS).forEach(([card, target]) => moveCard(card, target));
    ensureObjectiveImproverControls();
    applyObjectiveMode();
    Object.entries(LITERATURE_CARDS).forEach(([card, target]) => moveCard(card, target));
    Object.entries(PROJECT_CARDS).forEach(([card, target]) => moveCard(card, target));
    el('copilotTab')?.classList.add('stage19w10-local-copilot-only');
  }

  function normalizeLabels() {
    const stageBadge = el('stageBadge');
    if (stageBadge) stageBadge.textContent = STAGE;
    const copilotHeading = q('#copilotTab .section-head h2');
    if (copilotHeading && !/local editing assistant/i.test(copilotHeading.textContent || '')) copilotHeading.textContent = 'Local editing assistant';
    const copilotSmall = q('#copilotTab .section-head .smallcaps');
    if (copilotSmall) copilotSmall.textContent = 'AI Copilot';
  }

  function installPrimaryTabMemory() {
    qa('[data-right-tab]').forEach((btn) => {
      if (btn.dataset.stage19w10PrimaryBound === 'true') return;
      btn.dataset.stage19w10PrimaryBound = 'true';
      btn.addEventListener('click', () => {
        try { localStorage.setItem(STORAGE_TAB, btn.dataset.rightTab || 'preview'); } catch (_e) {}
      }, true);
    });
  }

  function restoreTabs() {
    let saved = '';
    let wf = '';
    try { saved = localStorage.getItem(STORAGE_TAB) || ''; wf = localStorage.getItem(STORAGE_WORKFLOW) || ''; } catch (_e) {}
    if (wf) activateWorkflow(normalizeWorkflowKey(wf));
    else activateWorkflow('remake');
    if (saved && el(`${saved}Tab`) && q(`[data-right-tab="${cssEscape(saved)}"]`)) activateRightTab(saved);
  }

  function reconcile() {
    applyDebugClass();
    bindWorkflowTabs();
    installPrimaryTabMemory();
    normalizeLabels();
    moveWorkflowCards();
    moveDiagnostics();
  }

  function startObserver() {
    const root = D.querySelector('.right-panel') || D.body;
    if (!root || root.dataset.stage19w10Observed === 'true') return;
    root.dataset.stage19w10Observed = 'true';
    let timer = null;
    const obs = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; reconcile(); }, 80);
    });
    obs.observe(root, {childList: true, subtree: true});
  }

  function jumpToWorkflow(name) {
    activateRightTab('paperAi');
    activateWorkflow(name || 'remake');
    reconcile();
  }

  function init() {
    reconcile();
    restoreTabs();
    startObserver();
    [250, 800, 1600, 3000, 5500].forEach((ms) => setTimeout(reconcile, ms));
  }

  NS.Stage19W10WorkflowTabsService = {
    stage: STAGE,
    init,
    reconcile,
    activateRightTab,
    activateWorkflow,
    applyObjectiveMode,
    jumpToWorkflow,
    isDebugMode
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

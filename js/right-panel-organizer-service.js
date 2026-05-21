/* Latexai Stage 17J4 RightPanelOrganizerService
 * Stage: stage17j4-right-panel-organizer-click-hardening-1
 *
 * Right panel cleanup / collapsible workflow sections.
 *
 * Organizes the growing Copilot and Settings panels into collapsible groups.
 * This service is layout-only: no AI calls, no compile jobs.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage17j4-right-panel-organizer-click-hardening-1';
  const STORAGE_KEY = 'latexai:right-panel-sections:v1';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('right-panel-organizer-service')) {
    NS.RightPanelOrganizerService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  const GROUPS = [
    {
      tab: 'copilot',
      key: 'core-copilot',
      title: 'Core Copilot prompt',
      defaultOpen: true,
      selectors: [
        '#copilotTab > .section-head.compact',
        '#aiProvider',
        '#aiModel',
        '#aiProxyUrl',
        '#aiProxyToken',
        '#copilotTask',
        '#copilotPrompt',
        '#askCopilotBtn',
        '#previewCopilotPatchBtn',
        '#insertCopilotBtn',
        '#replaceCopilotBtn',
        '#patchReview',
        '#copilotOutput'
      ],
      cardIds: []
    },
    {
      tab: 'settings',
      key: 'compile-settings',
      title: 'Compile / backend settings',
      defaultOpen: true,
      selectors: [
        '#settingsTab > .section-head.compact',
        '#compileProxyUrl',
        '#backendStatusCard',
        '#compileProxyToken',
        '#compilerModeSelect',
        '#wasmStatusCard',
        '#browserWasmAssetBase',
        '#browserWasmTexliveEndpoint',
        '#browserWasmReuseCheck',
        '#texlyreStatusCard',
        '#texlyreModuleUrl',
        '#texlyreBusytexBase',
        '#texlyreReuseCheck',
        '#texlyreUseWorkerCheck',
        '#resetTexlyreDirectModeBtn',
        '#rootFileSelect',
        '#engineSelect',
        '#shellEscapeCheck',
        '#compileJobsCheck',
        '#compilePollSelect',
        '#settingsTab > .settings-note',
        '#openOverleafBtn',
        '#runAppDiagnosticsBtn'
      ],
      cardIds: []
    },
    {
      tab: 'copilot',
      key: 'paper-ai',
      title: 'Paper AI',
      defaultOpen: true,
      cardIds: [
        'paperAiDashboardCard',
        'paperAiPolishCard',
        'competitiveReviewCard',
        'devilsDebateCard'
      ]
    },
    {
      tab: 'copilot',
      key: 'citations',
      title: 'Citations',
      defaultOpen: true,
      cardIds: [
        'citationAiCard',
        'citationVerifierCard',
        'localCitationVerifierCard',
        'citationVerifierPanel',
        'citationAiPanel'
      ]
    },
    {
      tab: 'copilot',
      key: 'history-comments',
      title: 'History / Comments',
      defaultOpen: true,
      cardIds: [
        'aiCommentsCard',
        'aiRevisionCard',
        'aiReportBrowserCard'
      ]
    },
    {
      tab: 'copilot',
      key: 'presentation',
      title: 'Presentation',
      defaultOpen: false,
      cardIds: [
        'presentationExportCard',
        'talkPackageCard',
        'presentationMakerCard'
      ]
    },
    {
      tab: 'copilot',
      key: 'figures',
      title: 'Figures',
      defaultOpen: false,
      cardIds: [
        'figureAssetCard',
        'figuresPanel',
        'tikzMakerCard',
        'imageToTikzCard',
        'figureEditorCard'
      ]
    },
    {
      tab: 'settings',
      key: 'reports-reviews',
      title: 'Reports / Reviews',
      defaultOpen: true,
      cardIds: [
        'aiReportBrowserCard',
        'aiRevisionCard',
        'aiCommentsCard'
      ]
    },
    {
      tab: 'settings',
      key: 'diagnostics',
      title: 'Diagnostics',
      defaultOpen: false,
      cardIds: [
        'aiRoutingInspectorCard',
        'backendDiagnosticsCard',
        'regressionChecklistCard',
        'releaseVerifyCard',
        'featureVisibilityCard',
        'featureFlagCard'
      ]
    },
    {
      tab: 'settings',
      key: 'model-config',
      title: 'AI / Model configuration',
      defaultOpen: true,
      cardIds: [
        'modelRoutingCard',
        'aiSettingsCard',
        'aiProviderCard',
        'aiRoutingInspectorCard'
      ]
    }
  ];

  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }

  function isElement(node) {
    return Boolean(node && node.nodeType === 1 && node.classList);
  }

  function updateDetailsOpenState(details, open) {
    if (!details) return false;
    const desired = Boolean(open);
    details.open = desired;
    if (desired) details.setAttribute('open', '');
    else details.removeAttribute('open');
    details.dataset.rpoOpen = desired ? 'true' : 'false';

    const summary = details.querySelector?.('.right-panel-group-summary');
    if (summary) summary.setAttribute('aria-expanded', desired ? 'true' : 'false');

    const body = details.querySelector?.('.right-panel-group-body');
    if (body) {
      body.hidden = !desired;
      body.setAttribute('aria-hidden', desired ? 'false' : 'true');
      body.style.display = desired ? '' : 'none';
    }
    return desired;
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function writeState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state || {})); } catch (_err) {}
  }

  function stateKey(group) {
    return `${group.tab}:${group.key}`;
  }

  function isOpen(group) {
    const state = readState();
    const key = stateKey(group);
    return typeof state[key] === 'boolean' ? state[key] : Boolean(group.defaultOpen);
  }

  function rememberOpen(group, value) {
    const state = readState();
    state[stateKey(group)] = Boolean(value);
    writeState(state);
  }

  function panelFor(tab) {
    return el(tab === 'settings' ? 'settingsTab' : 'copilotTab');
  }

  function groupId(group) {
    return `rightPanelGroup-${group.tab}-${group.key}`;
  }

  function bodyId(group) {
    return `rightPanelGroupBody-${group.tab}-${group.key}`;
  }

  function directPanelChildFor(node, panel) {
    if (!isElement(node) || !panel?.contains?.(node)) return null;
    let current = node;
    while (current && current.parentElement && current.parentElement !== panel) current = current.parentElement;
    if (!current || current.parentElement !== panel) return null;
    if (current.classList?.contains('right-panel-group') || current.classList?.contains('right-panel-organizer-toolbar')) return null;
    return current;
  }

  function addUniqueCard(cards, seen, node) {
    if (!isElement(node) || seen.has(node)) return false;
    seen.add(node);
    cards.push(node);
    return true;
  }

  function findCards(group) {
    const seen = new Set();
    const cards = [];

    // Direct id matches for optional feature cards.
    for (const id of group.cardIds || []) {
      const node = el(id);
      addUniqueCard(cards, seen, node);
    }

    // Selector matches for the original static Copilot/Settings controls.
    const panel = panelFor(group.tab);
    if (!panel) return cards;

    for (const selector of group.selectors || []) {
      try {
        panel.querySelectorAll(selector).forEach((node) => {
          addUniqueCard(cards, seen, directPanelChildFor(node, panel) || node);
        });
      } catch (_err) {}
    }

    // Fallback semantic matching for older cards whose ids changed.

    const titleNeedles = {
      'core-copilot': ['latex copilot'],
      'compile-settings': ['compile settings', 'backend status', 'browser engine status', 'texlyre busytex status'],
      'paper-ai': ['paper ai dashboard', 'paper-level edit review', 'competitive paper review', 'devil’s advocate', "devil's advocate"],
      citations: ['citation filler', 'citation verifier', 'local citation verifier', 'ai citation'],
      'history-comments': ['ai suggestion comments', 'ai revision history', 'unified ai reports'],
      presentation: ['presentation', 'beamer', 'talk package'],
      figures: ['figures', 'tikz', 'image-to-tikz'],
      'reports-reviews': ['unified ai reports', 'reviews browser', 'ai revision history', 'ai suggestion comments'],
      diagnostics: ['ai model routing inspector', 'backend diagnostics', 'regression checklist', 'release/deploy verifier', 'feature flags'],
      'model-config': ['model routing', 'ai model routing inspector', 'ai provider', 'model configuration']
    }[group.key] || [];

    if (titleNeedles.length) {
      Array.from(panel.children).forEach((node) => {
        if (!isElement(node)) return;
        if (node.classList.contains('right-panel-group') || node.classList.contains('right-panel-organizer-toolbar')) return;
        const text = clean(node.querySelector('h2')?.textContent || node.textContent).toLowerCase();
        if (titleNeedles.some((needle) => text.includes(needle)) && !seen.has(node)) {
          seen.add(node);
          cards.push(node);
        }
      });
    }

    return cards;
  }

  function ensureGroup(group) {
    const panel = panelFor(group.tab);
    if (!panel) return null;

    let details = el(groupId(group));
    if (!details) {
      details = D.createElement('details');
      details.id = groupId(group);
      details.className = 'right-panel-group';
      details.dataset.groupTab = group.tab;
      details.dataset.groupKey = group.key;
      const initialOpen = isOpen(group);
      details.open = initialOpen;
      if (initialOpen) details.setAttribute('open', '');
      else details.removeAttribute('open');
      details.dataset.rpoOpen = initialOpen ? 'true' : 'false';

      const summary = D.createElement('summary');
      summary.className = 'right-panel-group-summary';
      summary.setAttribute('aria-expanded', initialOpen ? 'true' : 'false');
      summary.innerHTML = [
        `<span class="right-panel-group-title">${escapeHtml(group.title)}</span>`,
        `<span class="right-panel-group-count" id="${groupId(group)}Count">0</span>`
      ].join('');

      const body = D.createElement('div');
      body.id = bodyId(group);
      body.className = 'right-panel-group-body';
      body.hidden = !initialOpen;
      body.setAttribute('aria-hidden', initialOpen ? 'false' : 'true');
      body.style.display = initialOpen ? '' : 'none';

      details.appendChild(summary);
      details.appendChild(body);
      details.addEventListener('toggle', () => {
        rememberOpen(group, details.open);
        updateDetailsOpenState(details, details.open);
      }, true);
    }

    return details;
  }

  function ensureToolbar(tab) {
    const panel = panelFor(tab);
    if (!panel) return null;

    const id = `rightPanelOrganizerToolbar-${tab}`;
    let toolbar = el(id);
    if (toolbar) return toolbar;

    toolbar = D.createElement('div');
    toolbar.id = id;
    toolbar.className = 'right-panel-organizer-toolbar';
    toolbar.innerHTML = [
      '<div>',
      '<div class="smallcaps">Sections</div>',
      `<strong>${tab === 'settings' ? 'Settings organization' : 'Copilot organization'}</strong>`,
      '</div>',
      '<div class="right-panel-organizer-actions">',
      `<button class="btn mini" type="button" data-rpo-action="expand" data-rpo-tab="${tab}" data-rpo-expand="${tab}">Expand all</button>`,
      `<button class="btn mini" type="button" data-rpo-action="collapse" data-rpo-tab="${tab}" data-rpo-collapse="${tab}">Collapse all</button>`,
      `<button class="btn mini" type="button" data-rpo-action="refresh" data-rpo-tab="${tab}" data-rpo-refresh="${tab}">Refresh sections</button>`,
      '</div>'
    ].join('');

    panel.insertBefore(toolbar, panel.firstChild);

    toolbar.querySelectorAll('[data-rpo-action]').forEach((button) => {
      button.addEventListener('click', handleOrganizerButtonEvent, true);
    });

    return toolbar;
  }

  function allRenderedGroups(tab) {
    const panel = panelFor(tab);
    if (!panel) return [];
    GROUPS.filter((group) => group.tab === tab).forEach((group) => ensureGroup(group));
    return Array.from(panel.querySelectorAll(`details.right-panel-group[data-group-tab="${tab}"]`));
  }

  function syncGroupStateToStorage(tab, open) {
    const desired = Boolean(open);
    GROUPS.filter((group) => group.tab === tab).forEach((group) => rememberOpen(group, desired));
  }

  function setAllGroups(tab, open) {
    const desired = Boolean(open);
    const panel = panelFor(tab);
    if (!panel) return false;

    // Ensure wrappers exist, even if this is called before delayed optional cards mount.
    ensureToolbar(tab);
    placeGroupsInOrder(tab);
    syncGroupStateToStorage(tab, desired);

    let changed = 0;
    allRenderedGroups(tab).forEach((details) => {
      updateDetailsOpenState(details, desired);
      changed += 1;
    });

    // Defensive compatibility: if an older cleanup stage left native <details> in the panel,
    // make Expand all / Collapse all control those too.
    panel.querySelectorAll('details').forEach((details) => {
      if (!details.classList.contains('right-panel-group')) updateDetailsOpenState(details, desired);
    });

    setStatus(`${tab === 'settings' ? 'Settings' : 'Copilot'} sections ${desired ? 'expanded' : 'collapsed'} (${changed} group${changed === 1 ? '' : 's'}).`, tab);
    return desired;
  }

  function placeGroupsInOrder(tab) {
    const panel = panelFor(tab);
    if (!panel) return;

    const toolbar = ensureToolbar(tab);
    let anchor = toolbar?.nextSibling || panel.firstChild;

    GROUPS.filter((group) => group.tab === tab).forEach((group) => {
      const details = ensureGroup(group);
      if (!details) return;
      if (details.parentElement !== panel) panel.insertBefore(details, anchor);
      else panel.insertBefore(details, anchor);
      anchor = details.nextSibling;
    });
  }

  function organize(tab = null) {
    const tabs = tab ? [tab] : ['copilot', 'settings'];

    for (const t of tabs) {
      const panel = panelFor(t);
      if (!panel) continue;

      ensureToolbar(t);
      placeGroupsInOrder(t);

      for (const group of GROUPS.filter((item) => item.tab === t)) {
        const details = ensureGroup(group);
        const body = el(bodyId(group));
        if (!details || !body) continue;

        const cards = findCards(group).filter((node) => {
          // Do not move a group into itself or duplicate the toolbar.
          if (node === details || node.closest?.('.right-panel-group') === details) return false;
          if (node.classList.contains('right-panel-organizer-toolbar')) return false;
          return true;
        });

        for (const card of cards) body.appendChild(card);

        const count = el(`${groupId(group)}Count`);
        if (count) count.textContent = String(body.children.length);
        details.classList.toggle('empty', body.children.length === 0);
        updateDetailsOpenState(details, details.open);
      }
    }

    setStatus('Right panel sections organized.');
    return true;
  }

  function currentReport() {
    const lines = [
      'Latexai right panel organization report',
      '=======================================',
      '',
      `Stage: ${STAGE}`,
      `Generated: ${new Date().toISOString()}`,
      ''
    ];

    for (const group of GROUPS) {
      const body = el(bodyId(group));
      lines.push(`- ${group.tab}/${group.title}: ${body?.children.length || 0} card(s), ${el(groupId(group))?.open ? 'open' : 'collapsed'}`);
    }

    return lines.join('\n');
  }

  async function copyReport() {
    const report = currentReport();
    try {
      await navigator.clipboard.writeText(report);
      setStatus('Right panel organization report copied.');
    } catch (_err) {
      setStatus('Could not copy report automatically.');
    }
    return report;
  }

  function setStatus(message, tab = '') {
    const id = tab ? `rightPanelOrganizerStatus-${tab}` : 'rightPanelOrganizerStatus';
    let node = el(id);
    if (!node) {
      const toolbar = (tab && el(`rightPanelOrganizerToolbar-${tab}`)) || el('rightPanelOrganizerToolbar-copilot') || el('rightPanelOrganizerToolbar-settings');
      if (!toolbar) return;
      node = D.createElement('div');
      node.id = id;
      node.className = 'right-panel-organizer-status';
      toolbar.appendChild(node);
    }
    node.textContent = message;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function installToolbarReportButton() {
    ['copilot', 'settings'].forEach((tab) => {
      const toolbar = ensureToolbar(tab);
      if (!toolbar || toolbar.querySelector('[data-rpo-copy-report]')) return;
      const actions = toolbar.querySelector('.right-panel-organizer-actions');
      const btn = D.createElement('button');
      btn.className = 'btn mini';
      btn.type = 'button';
      btn.dataset.rpoCopyReport = tab;
      btn.dataset.rpoAction = 'copy-report';
      btn.dataset.rpoTab = tab;
      btn.textContent = 'Copy report';
      btn.addEventListener('click', handleOrganizerButtonEvent, true);
      actions?.appendChild(btn);
    });
  }

  function getButtonAction(button) {
    if (!button) return '';
    const explicit = button.getAttribute('data-rpo-action');
    if (explicit) return explicit;
    if (button.hasAttribute('data-rpo-expand')) return 'expand';
    if (button.hasAttribute('data-rpo-collapse')) return 'collapse';
    if (button.hasAttribute('data-rpo-refresh')) return 'refresh';
    if (button.hasAttribute('data-rpo-copy-report')) return 'copy-report';
    return '';
  }

  function getButtonTab(button, action = getButtonAction(button)) {
    if (!button) return 'copilot';
    const direct = button.getAttribute('data-rpo-tab');
    if (direct) return direct;
    const attr = action === 'expand' ? 'data-rpo-expand'
      : action === 'collapse' ? 'data-rpo-collapse'
        : action === 'refresh' ? 'data-rpo-refresh'
          : action === 'copy-report' ? 'data-rpo-copy-report'
            : '';
    const value = attr ? button.getAttribute(attr) : '';
    if (value) return value;
    const toolbar = button.closest?.('.right-panel-organizer-toolbar');
    if (toolbar?.id?.includes('settings')) return 'settings';
    return 'copilot';
  }

  function handleOrganizerButton(button) {
    const action = getButtonAction(button);
    const tab = getButtonTab(button, action);
    if (!['copilot', 'settings'].includes(tab)) return false;

    if (action === 'expand') {
      setAllGroups(tab, true);
      return true;
    }
    if (action === 'collapse') {
      setAllGroups(tab, false);
      return true;
    }
    if (action === 'refresh') {
      organize(tab);
      setStatus(`${tab === 'settings' ? 'Settings' : 'Copilot'} sections refreshed.`, tab);
      return true;
    }
    if (action === 'copy-report') {
      copyReport();
      return true;
    }
    return false;
  }

  function handleOrganizerButtonEvent(event) {
    const button = event?.target?.closest?.('[data-rpo-action], [data-rpo-expand], [data-rpo-collapse], [data-rpo-refresh], [data-rpo-copy-report]');
    if (!button) return false;
    event.preventDefault?.();
    event.stopPropagation?.();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    return handleOrganizerButton(button);
  }

  function installDelegatedButtonHandlers() {
    if (D.documentElement.dataset.stage17j4DelegatedOrganizerButtons === 'true') return;
    D.documentElement.dataset.stage17j4DelegatedOrganizerButtons = 'true';

    D.addEventListener('click', handleOrganizerButtonEvent, true);
    D.addEventListener('pointerup', handleOrganizerButtonEvent, true);
    D.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      handleOrganizerButtonEvent(event);
    }, true);
  }

  function init() {
    installDelegatedButtonHandlers();
    organize();
    installToolbarReportButton();
  }

  NS.RightPanelOrganizerService = {
    STAGE,
    GROUPS,
    init,
    organize,
    setAllGroups,
    currentReport,
    copyReport,
    handleOrganizerButton
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  // A few delayed passes handle optional feature modules that mount after this one.
  setTimeout(init, 700);
  setTimeout(init, 1500);
  setTimeout(init, 2800);
  setTimeout(init, 4500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

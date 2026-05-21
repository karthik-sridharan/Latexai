/* Latexai Stage 17J7 RightPanelOrganizerService
 * Stage: stage17j7-right-panel-organizer-button-shell-1
 *
 * Right panel cleanup / collapsible workflow sections.
 *
 * Stage 17J7 deliberately stops using native <details> for these groups.
 * iPad/Safari and delayed re-organize passes made the native toggle event fight
 * our forced hidden/body state.  Each group is now a small controlled shell:
 * a button header plus a body div.  Bulk buttons and individual group headers
 * use the same setGroupOpen path, so reports, ARIA, and visible state cannot drift.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage17j7-right-panel-organizer-button-shell-1';
  const STORAGE_KEY = 'latexai:right-panel-sections:v2';
  const LEGACY_STORAGE_KEY = 'latexai:right-panel-sections:v1';
  const LEGACY_FORCE_STATE_KEY = 'latexai:right-panel-sections:forced-tab-state:v1';

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

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function readJson(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_err) {}
  }

  function clearLegacyForcedState() {
    try { localStorage.removeItem(LEGACY_FORCE_STATE_KEY); } catch (_err) {}
    try { delete W.__LATEXAI_RPO_FORCED_TAB_STATE; } catch (_err) { W.__LATEXAI_RPO_FORCED_TAB_STATE = {}; }
    ['copilot', 'settings'].forEach((tab) => {
      const panel = panelFor(tab);
      if (panel) delete panel.dataset.rpoForcedOpen;
    });
  }

  function readState() {
    const fresh = readJson(STORAGE_KEY);
    if (Object.keys(fresh).length) return fresh;
    return readJson(LEGACY_STORAGE_KEY);
  }

  function writeState(state) {
    writeJson(STORAGE_KEY, state || {});
  }

  function stateKey(group) {
    return `${group.tab}:${group.key}`;
  }

  function desiredGroupOpen(group, fallback = null) {
    const state = readState();
    const key = stateKey(group);
    if (typeof state[key] === 'boolean') return state[key];
    if (typeof fallback === 'boolean') return fallback;
    return Boolean(group.defaultOpen);
  }

  function rememberOpen(group, value) {
    const state = readState();
    state[stateKey(group)] = Boolean(value);
    writeState(state);
  }

  function panelFor(tab) {
    return el(tab === 'settings' ? 'settingsTab' : 'copilotTab');
  }

  function groupFor(tab, key) {
    return GROUPS.find((group) => group.tab === tab && group.key === key) || null;
  }

  function groupId(group) {
    return `rightPanelGroup-${group.tab}-${group.key}`;
  }

  function summaryId(group) {
    return `rightPanelGroupSummary-${group.tab}-${group.key}`;
  }

  function bodyId(group) {
    return `rightPanelGroupBody-${group.tab}-${group.key}`;
  }

  function directPanelItemFor(node, panel) {
    if (!isElement(node) || !panel?.contains?.(node)) return null;
    if (node.closest?.('.right-panel-group')) return null;
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
    const panel = panelFor(group.tab);
    if (!panel) return cards;

    // Direct id matches for optional feature cards.  These may already be inside
    // another group, so keep the exact card node and let organize() move it only
    // when necessary.
    for (const id of group.cardIds || []) {
      addUniqueCard(cards, seen, el(id));
    }

    // Selector matches for the original static Copilot/Settings controls.  Only
    // move the containing direct panel child.  If the selector already lives in a
    // right-panel group, skip it; this prevents re-organize passes from yanking a
    // select/input out of its label and making the UI look truncated.
    for (const selector of group.selectors || []) {
      try {
        panel.querySelectorAll(selector).forEach((node) => {
          const item = directPanelItemFor(node, panel);
          if (item) addUniqueCard(cards, seen, item);
        });
      } catch (_err) {}
    }

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
        if (titleNeedles.some((needle) => text.includes(needle))) addUniqueCard(cards, seen, node);
      });
    }

    return cards;
  }

  function makeGroupShell(group, existingBody = null) {
    const initialOpen = desiredGroupOpen(group);
    const shell = D.createElement('div');
    shell.id = groupId(group);
    shell.className = 'right-panel-group';
    shell.dataset.groupTab = group.tab;
    shell.dataset.groupKey = group.key;
    shell.setAttribute('role', 'group');
    shell.setAttribute('aria-labelledby', summaryId(group));

    const button = D.createElement('button');
    button.id = summaryId(group);
    button.className = 'right-panel-group-summary';
    button.type = 'button';
    button.dataset.rpoGroupToggle = `${group.tab}:${group.key}`;
    button.setAttribute('aria-controls', bodyId(group));
    button.innerHTML = [
      `<span class="right-panel-group-title">${escapeHtml(group.title)}</span>`,
      `<span class="right-panel-group-count" id="${groupId(group)}Count">0</span>`
    ].join('');

    const body = existingBody || D.createElement('div');
    body.id = bodyId(group);
    body.classList.add('right-panel-group-body');

    shell.appendChild(button);
    shell.appendChild(body);
    button.addEventListener('click', handleGroupToggleEvent, false);
    setGroupOpen(group, shell, initialOpen, { remember: false });
    return shell;
  }

  function ensureGroup(group) {
    const panel = panelFor(group.tab);
    if (!panel) return null;

    let shell = el(groupId(group));
    if (!shell) return makeGroupShell(group);

    // Stage 17J4-J6 used native <details>.  If a stale copy exists during a
    // hot reload/fallback double-load, replace it with the controlled shell and
    // preserve the cards already moved into the body.
    if (shell.tagName === 'DETAILS' || !shell.querySelector?.('.right-panel-group-summary[data-rpo-group-toggle]')) {
      const oldBody = shell.querySelector?.('.right-panel-group-body') || null;
      const body = D.createElement('div');
      body.id = bodyId(group);
      body.className = 'right-panel-group-body';
      if (oldBody) {
        while (oldBody.firstChild) body.appendChild(oldBody.firstChild);
      }
      const replacement = makeGroupShell(group, body);
      shell.replaceWith(replacement);
      return replacement;
    }

    const button = shell.querySelector('.right-panel-group-summary[data-rpo-group-toggle]');
    const body = shell.querySelector('.right-panel-group-body');
    if (button) button.addEventListener('click', handleGroupToggleEvent, false);
    if (body) body.id = bodyId(group);
    setGroupOpen(group, shell, desiredGroupOpen(group, shell.dataset.rpoOpen !== 'false'), { remember: false });
    return shell;
  }

  function groupFromShell(shell) {
    if (!isElement(shell)) return null;
    return groupFor(shell.dataset.groupTab, shell.dataset.groupKey);
  }

  function setGroupOpen(group, shell, open, options = {}) {
    const target = shell || el(groupId(group));
    if (!target) return false;
    const desired = Boolean(open);
    target.dataset.rpoOpen = desired ? 'true' : 'false';
    target.classList.toggle('is-open', desired);
    target.classList.toggle('is-collapsed', !desired);

    const button = target.querySelector('.right-panel-group-summary');
    if (button) button.setAttribute('aria-expanded', desired ? 'true' : 'false');

    const body = target.querySelector('.right-panel-group-body');
    if (body) {
      body.hidden = !desired;
      body.setAttribute('aria-hidden', desired ? 'false' : 'true');
      body.style.display = desired ? '' : 'none';
    }

    if (options.remember !== false) rememberOpen(group, desired);
    return desired;
  }

  function toggleGroup(shell) {
    const group = groupFromShell(shell);
    if (!group) return false;
    const next = shell.dataset.rpoOpen !== 'true';
    setGroupOpen(group, shell, next, { remember: true });
    setStatus(`${group.title} ${next ? 'expanded' : 'collapsed'}.`, group.tab);
    return true;
  }

  function handleGroupToggleEvent(event) {
    const button = event?.target?.closest?.('[data-rpo-group-toggle]') || event?.currentTarget;
    if (!button) return false;
    const shell = button.closest?.('.right-panel-group');
    if (!shell) return false;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    return toggleGroup(shell);
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
      `<button class="btn mini" type="button" data-rpo-action="expand" data-rpo-tab="${tab}" onclick="window.LatexaiRightPanelExpandAll && window.LatexaiRightPanelExpandAll('${tab}'); return false;">Expand all</button>`,
      `<button class="btn mini" type="button" data-rpo-action="collapse" data-rpo-tab="${tab}" onclick="window.LatexaiRightPanelCollapseAll && window.LatexaiRightPanelCollapseAll('${tab}'); return false;">Collapse all</button>`,
      `<button class="btn mini" type="button" data-rpo-action="refresh" data-rpo-tab="${tab}" onclick="window.LuminaLatex && window.LuminaLatex.RightPanelOrganizerService && window.LuminaLatex.RightPanelOrganizerService.organize && window.LuminaLatex.RightPanelOrganizerService.organize('${tab}'); return false;">Refresh sections</button>`,
      '</div>'
    ].join('');

    panel.insertBefore(toolbar, panel.firstChild);
    toolbar.querySelectorAll('[data-rpo-action]').forEach((button) => {
      button.addEventListener('click', handleOrganizerButtonEvent, false);
    });
    return toolbar;
  }

  function placeGroupsInOrder(tab) {
    const panel = panelFor(tab);
    if (!panel) return;

    const toolbar = ensureToolbar(tab);
    let anchor = toolbar?.nextSibling || panel.firstChild;
    GROUPS.filter((group) => group.tab === tab).forEach((group) => {
      const shell = ensureGroup(group);
      if (!shell) return;
      if (shell.parentElement !== panel) panel.insertBefore(shell, anchor);
      else panel.insertBefore(shell, anchor);
      anchor = shell.nextSibling;
    });
  }

  function allRenderedGroups(tab) {
    const panel = panelFor(tab);
    if (!panel) return [];
    GROUPS.filter((group) => group.tab === tab).forEach((group) => ensureGroup(group));
    return Array.from(panel.querySelectorAll(`.right-panel-group[data-group-tab="${tab}"]`));
  }

  function normalizeBulkTabs(tab = 'all') {
    if (tab === 'copilot' || tab === 'settings') return [tab];
    return ['copilot', 'settings'];
  }

  function setAllGroupsOne(tab, open) {
    const desired = Boolean(open);
    const panel = panelFor(tab);
    if (!panel) return false;

    ensureToolbar(tab);
    placeGroupsInOrder(tab);

    let changed = 0;
    GROUPS.filter((group) => group.tab === tab).forEach((group) => {
      const shell = ensureGroup(group);
      if (!shell) return;
      setGroupOpen(group, shell, desired, { remember: true });
      changed += 1;
    });

    // One delayed pass handles cards mounted right after optional feature scripts.
    setTimeout(() => {
      GROUPS.filter((group) => group.tab === tab).forEach((group) => {
        const shell = ensureGroup(group);
        if (shell) setGroupOpen(group, shell, desired, { remember: true });
      });
    }, 120);

    setStatus(`${tab === 'settings' ? 'Settings' : 'Copilot'} sections ${desired ? 'expanded' : 'collapsed'} (${changed} group${changed === 1 ? '' : 's'}).`, tab);
    return desired;
  }

  function setAllGroups(tab = 'all', open) {
    const desired = Boolean(open);
    const tabs = normalizeBulkTabs(tab);
    tabs.forEach((item) => setAllGroupsOne(item, desired));
    return desired;
  }

  function organize(tab = null) {
    clearLegacyForcedState();
    const tabs = tab ? normalizeBulkTabs(tab) : ['copilot', 'settings'];

    for (const t of tabs) {
      const panel = panelFor(t);
      if (!panel) continue;

      ensureToolbar(t);
      placeGroupsInOrder(t);

      for (const group of GROUPS.filter((item) => item.tab === t)) {
        const shell = ensureGroup(group);
        const body = el(bodyId(group));
        if (!shell || !body) continue;

        const cards = findCards(group).filter((node) => {
          if (!isElement(node)) return false;
          if (node === shell || node.closest?.('.right-panel-group') === shell) return false;
          if (node.classList.contains('right-panel-organizer-toolbar')) return false;
          return true;
        });

        for (const card of cards) body.appendChild(card);

        const count = el(`${groupId(group)}Count`);
        if (count) count.textContent = String(body.children.length);
        shell.classList.toggle('empty', body.children.length === 0);
        setGroupOpen(group, shell, desiredGroupOpen(group, shell.dataset.rpoOpen !== 'false'), { remember: false });
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
      const shell = el(groupId(group));
      const bodyHidden = body ? (body.hidden || getComputedStyle(body).display === 'none') : true;
      const open = shell?.dataset?.rpoOpen === 'true';
      lines.push(`- ${group.tab}/${group.title}: ${body?.children.length || 0} card(s), ${open ? 'open' : 'collapsed'}${bodyHidden ? ', body hidden' : ''}`);
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
      btn.setAttribute('onclick', 'window.LuminaLatex && window.LuminaLatex.RightPanelOrganizerService && window.LuminaLatex.RightPanelOrganizerService.copyReport && window.LuminaLatex.RightPanelOrganizerService.copyReport(); return false;');
      btn.textContent = 'Copy report';
      btn.addEventListener('click', handleOrganizerButtonEvent, false);
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

  function getButtonTab(button) {
    if (!button) return 'all';
    const direct = button.getAttribute('data-rpo-tab');
    if (direct) return direct;
    const toolbar = button.closest?.('.right-panel-organizer-toolbar');
    if (toolbar?.id?.includes('settings')) return 'settings';
    if (toolbar?.id?.includes('copilot')) return 'copilot';
    return 'all';
  }

  function handleOrganizerButton(button) {
    const action = getButtonAction(button);
    const tab = getButtonTab(button);
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
    const target = event?.target || event?.currentTarget;
    const button = target?.closest?.('[data-rpo-action], [data-rpo-expand], [data-rpo-collapse], [data-rpo-refresh], [data-rpo-copy-report]') || (target?.matches?.('[data-rpo-action], [data-rpo-expand], [data-rpo-collapse], [data-rpo-refresh], [data-rpo-copy-report]') ? target : null);
    if (!button) return false;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    return handleOrganizerButton(button);
  }

  function installDelegatedHandlers() {
    if (D.documentElement.dataset.stage17j7OrganizerButtonShell === 'true') return;
    D.documentElement.dataset.stage17j7OrganizerButtonShell = 'true';

    D.addEventListener('click', (event) => {
      if (event.target?.closest?.('[data-rpo-group-toggle]')) handleGroupToggleEvent(event);
      else handleOrganizerButtonEvent(event);
    }, false);
  }

  function init() {
    clearLegacyForcedState();
    installDelegatedHandlers();
    organize();
    installToolbarReportButton();
  }

  W.LatexaiRightPanelExpandAll = function LatexaiRightPanelExpandAll(tab = 'all') {
    return setAllGroups(tab, true);
  };

  W.LatexaiRightPanelCollapseAll = function LatexaiRightPanelCollapseAll(tab = 'all') {
    return setAllGroups(tab, false);
  };

  NS.RightPanelOrganizerService = {
    STAGE,
    GROUPS,
    init,
    organize,
    setAllGroups,
    currentReport,
    copyReport,
    handleOrganizerButton,
    toggleGroup,
    setGroupOpen
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  setTimeout(init, 700);
  setTimeout(init, 1500);
  setTimeout(init, 2800);
  setTimeout(init, 4500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();

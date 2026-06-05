/* Latexai Stage 19W18 RightPanelOrganizerService
 * Stage: stage19w15-copilot-audit-edits-cleanup-20260604-1
 *
 * Right panel cleanup / collapsible workflow sections.
 *
 * Stage 17M keeps the J10/K/L scroll and Figures-tab fixes, then adds
 * a tab-ownership integrity lock so organizer passes cannot silently move cards
 * between Copilot, Settings, and Figures. Diagnostics now report per-tab card
 * counts, misplaced known cards, and Figures-tool completeness.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'latex-stage19w29-settings-github-drawers-cleanup-20260605-1';
  const STORAGE_KEY = 'latexai:right-panel-sections:v8';
  const STAGE17L_STORAGE_KEY = 'latexai:right-panel-sections:v6';
  const STAGE17J10_STORAGE_KEY = 'latexai:right-panel-sections:v5';
  const STAGE17J9_STORAGE_KEY = 'latexai:right-panel-sections:v4';
  const STAGE17J8_STORAGE_KEY = 'latexai:right-panel-sections:v3';
  const STAGE17J7_STORAGE_KEY = 'latexai:right-panel-sections:v2';
  const LEGACY_STORAGE_KEY = 'latexai:right-panel-sections:v1';
  const LEGACY_FORCE_STATE_KEY = 'latexai:right-panel-sections:forced-tab-state:v1';
  let lastHandledControl = { id: '', time: 0 };

  const RIGHT_TAB_PANELS = {
    copilot: 'copilotTab',
    paperAi: 'paperAiTab',
    literature: 'literatureTab',
    project: 'projectTab',
    settings: 'settingsTab',
    assets: 'assetsTab',
    presentation: 'leftPresentationTab'
  };

  const KNOWN_CARD_OWNERS = {
    // Copilot-owned workflow cards.
    documentAiCard: ['paperAi'],
    paperAiDashboardCard: ['copilot'],
    paperAiPolishCard: ['copilot'],
    competitiveReviewCard: ['paperAi'],
    realAgentBranchCard: ['paperAi'],
    reviewerRebuttalCard: ['paperAi'],
    citationAiCard: ['literature'],
    citationVerifierCard: ['literature'],
    localCitationVerifierCard: ['literature'],
    citationVerifierPanel: ['literature'],
    citationAiPanel: ['literature'],
    aiCommentsCard: ['copilot'],
    presentationExportCard: ['presentation'],
    talkPackageCard: ['presentation'],
    presentationMakerCard: ['presentation'],

    // Settings-owned diagnostics/model/report cards.
    aiRevisionCard: ['copilot'],
    aiReportBrowserCard: ['copilot'],
    aiRoutingInspectorCard: ['settings'],
    backendDiagnosticsCard: ['settings'],
    regressionChecklistCard: ['settings'],
    releaseVerifyCard: ['settings'],
    featureVisibilityCard: ['settings'],
    featureFlagCard: ['settings'],
    modelRegistryCard: ['settings'],
    modelRoutingCard: ['settings'],
    aiSettingsCard: ['settings'],
    aiProviderCard: ['settings'],

    // Figures-tab-owned drawing/TikZ/asset controls.  These must never be
    // moved into Copilot's optional "Figures" group or Settings catch-alls.
    figureEditorCard: ['assets'],
    tikzMakerCard: ['assets'],
    imageToTikzCard: ['assets'],
    assetFileInput: ['assets'],
    assetSnippetPreview: ['assets'],
    assetList: ['assets']
  };

  const FIGURES_REQUIRED_IDS = [
    ['figureEditorCard', 'Draw figure'],
    ['tikzMakerCard', 'AI TikZ maker'],
    ['imageToTikzCard', 'Image → TikZ remaker'],
    ['assetFileInput', 'Image assets'],
    ['assetSnippetPreview', 'Snippet preview'],
    ['assetList', 'Project images']
  ];

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
        '#copilotTask',
        '#copilotPrompt',
        '#askCopilotBtn',
        '#previewCopilotPatchBtn',
        '#insertCopilotBtn',
        '#replaceCopilotBtn',
        '#patchReview',
        '#copilotOutput',
        '#copilotContextChips'
      ],
      cardIds: []
    },
    {
      tab: 'settings',
      key: 'ai-memory-backends',
      title: 'AI / memory backends',
      defaultOpen: true,
      selectors: [
        '#settingsTab > .section-head.compact',
        '#settingsBackendIntroNote',
        '#aiProxyUrl',
        '#aiProxyToken',
        '#memoryBackendUrl',
        '#memoryProxyToken',
        '#memoryBackendStatusCard'
      ],
      cardIds: []
    },
    {
      tab: 'settings',
      key: 'github-sync',
      title: 'GitHub backend / project sync',
      defaultOpen: true,
      selectors: [
        '#githubBackendUrl',
        '#githubBackendSettingsNote',
        '#githubBackendStatusCard'
      ],
      cardIds: []
    },
    {
      tab: 'settings',
      key: 'compile-engines',
      title: 'Compile backend / engines',
      defaultOpen: true,
      selectors: [
        '#compileProxyUrl',
        '#backendStatusCard',
        '#compileProxyToken',
        '#compilerModeSelect',
        '#rootFileSelect',
        '#engineSelect',
        '#shellEscapeCheck',
        '#compileJobsCheck',
        '#compilePollSelect',
        '#compileBackendSettingsNote',
        '#compileContractSettingsNote',
        '#runAppDiagnosticsBtn'
      ],
      cardIds: []
    },
    {
      tab: 'copilot',
      key: 'audit-ai-edits',
      title: 'Audit AI Edits',
      defaultOpen: true,
      cardIds: [
        'paperAiPolishCard'
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
      tab: 'presentation',
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
      tab: 'settings',
      key: 'reports-reviews',
      title: 'Reports / Reviews',
      defaultOpen: false,
      cardIds: []
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
        'modelRegistryCard',
        'modelRoutingCard',
        'aiSettingsCard',
        'aiProviderCard',
        'aiRoutingInspectorCard'
      ]
    },
    {
      tab: 'settings',
      key: 'other-settings',
      title: 'Other settings / advanced',
      defaultOpen: false,
      catchAll: true,
      selectors: [],
      cardIds: []
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

  function memoryStorage() {
    if (W.__LATEXAI_RPO_MEMORY_STORAGE) return W.__LATEXAI_RPO_MEMORY_STORAGE;
    const store = {};
    W.__LATEXAI_RPO_MEMORY_STORAGE = {
      getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: (key) => { delete store[key]; }
    };
    return W.__LATEXAI_RPO_MEMORY_STORAGE;
  }

  function storageAdapter() {
    if (W.__LATEXAI_RPO_STORAGE && typeof W.__LATEXAI_RPO_STORAGE.getItem === 'function') return W.__LATEXAI_RPO_STORAGE;
    try {
      const storage = W.localStorage;
      const probe = '__latexai_rpo_storage_probe__';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return storage;
    } catch (_err) {
      return memoryStorage();
    }
  }

  function readJson(key) {
    try {
      const parsed = JSON.parse(storageAdapter().getItem(key) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function writeJson(key, value) {
    try { storageAdapter().setItem(key, JSON.stringify(value || {})); } catch (_err) {}
  }

  function clearLegacyForcedState() {
    try { storageAdapter().removeItem(LEGACY_FORCE_STATE_KEY); } catch (_err) {}
    try { delete W.__LATEXAI_RPO_FORCED_TAB_STATE; } catch (_err) { W.__LATEXAI_RPO_FORCED_TAB_STATE = {}; }
    ['copilot', 'settings'].forEach((tab) => {
      const panel = panelFor(tab);
      if (panel) delete panel.dataset.rpoForcedOpen;
    });
  }

  function readState() {
    const fresh = readJson(STORAGE_KEY);
    if (Object.keys(fresh).length) return fresh;
    const legacyL = readJson(STAGE17L_STORAGE_KEY);
    if (Object.keys(legacyL).length) return legacyL;
    const legacyJ10 = readJson(STAGE17J10_STORAGE_KEY);
    if (Object.keys(legacyJ10).length) return legacyJ10;
    const legacyJ9 = readJson(STAGE17J9_STORAGE_KEY);
    if (Object.keys(legacyJ9).length) return legacyJ9;
    const legacyJ8 = readJson(STAGE17J8_STORAGE_KEY);
    if (Object.keys(legacyJ8).length) return legacyJ8;
    const legacyJ7 = readJson(STAGE17J7_STORAGE_KEY);
    if (Object.keys(legacyJ7).length) return legacyJ7;
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
    return el(RIGHT_TAB_PANELS[tab] || (tab === 'settings' ? 'settingsTab' : 'copilotTab'));
  }

  function tabForPanel(panel) {
    if (!panel) return '';
    if (panel.id === 'copilotTab') return 'copilot';
    if (panel.id === 'paperAiTab') return 'paperAi';
    if (panel.id === 'literatureTab') return 'literature';
    if (panel.id === 'projectTab') return 'project';
    if (panel.id === 'settingsTab') return 'settings';
    if (panel.id === 'assetsTab') return 'assets';
    return panel.id || '';
  }

  function panelForNode(node) {
    if (!isElement(node)) return null;
    return node.closest?.('.right-tab-panel') || null;
  }

  function tabForNode(node) {
    return tabForPanel(panelForNode(node));
  }

  function expectedTabsForNode(node) {
    if (!isElement(node)) return [];
    if (node.id && KNOWN_CARD_OWNERS[node.id]) return KNOWN_CARD_OWNERS[node.id];
    const known = node.querySelector?.('[id]');
    if (known && KNOWN_CARD_OWNERS[known.id]) return KNOWN_CARD_OWNERS[known.id];
    return [];
  }

  function nodeAllowedForTab(node, tab) {
    const expected = expectedTabsForNode(node);
    return !expected.length || expected.includes(tab);
  }

  function isCardMisplaced(node) {
    const expected = expectedTabsForNode(node);
    const actual = tabForNode(node);
    return expected.length && actual && !expected.includes(actual);
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
    const tab = tabForPanel(panel);
    if (!nodeAllowedForTab(current, tab)) return null;
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

    if (group.catchAll) {
      Array.from(panel.children).forEach((node) => {
        if (!isElement(node)) return;
        if (node.classList.contains('right-panel-group') || node.classList.contains('right-panel-organizer-toolbar')) return;
        if (node.id && node.id.startsWith('rightPanelOrganizer')) return;
        if (!nodeAllowedForTab(node, group.tab)) return;
        addUniqueCard(cards, seen, node);
      });
      return cards;
    }

    // Direct id matches for optional feature cards.  Stage 17L is careful not
    // to steal cards from another right-tab panel.  The previous organizer used
    // document.getElementById(id) globally, so the dedicated Figures tab cards
    // (Draw figure / AI TikZ maker / Image → TikZ) could be moved into the
    // Copilot organizer's hidden Figures group.
    for (const id of group.cardIds || []) {
      const node = el(id);
      if (!isElement(node)) continue;
      if (!panel.contains(node)) continue;
      if (!nodeAllowedForTab(node, group.tab)) continue;
      addUniqueCard(cards, seen, node);
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
      'ai-memory-backends': ['ai backend proxy', 'memory backend status', 'memory backend url'],
      'github-sync': ['github backend', 'github backend status', 'project sync'],
      'compile-engines': ['compile backend', 'backend compiler only', 'backend status'],
      'audit-ai-edits': ['audit ai edits', 'ai edit review'],
      'history-comments': ['ai suggestion comments', 'ai revision history', 'unified ai reports'],
      presentation: ['presentation', 'beamer', 'talk package'],
      'reports-reviews': ['unified ai reports', 'reviews browser', 'ai revision history', 'ai suggestion comments'],
      diagnostics: ['ai model routing inspector', 'backend diagnostics', 'regression checklist', 'release/deploy verifier', 'feature flags'],
      'model-config': ['model routing', 'ai model routing inspector', 'ai provider', 'model configuration']
    }[group.key] || [];

    if (titleNeedles.length) {
      Array.from(panel.children).forEach((node) => {
        if (!isElement(node)) return;
        if (node.classList.contains('right-panel-group') || node.classList.contains('right-panel-organizer-toolbar')) return;
        if (!nodeAllowedForTab(node, group.tab)) return;
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
    shell.className = group.catchAll ? 'right-panel-group is-catchall' : 'right-panel-group';
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
    bindGroupToggleEvents(button);
    setGroupOpen(group, shell, initialOpen, { remember: false });
    return shell;
  }

  function ensureGroup(group) {
    const panel = panelFor(group.tab);
    if (!panel) return null;

    let shell = el(groupId(group));
    if (!shell) return makeGroupShell(group);

    // Stage 17J4-J7 used native <details>.  If a stale copy exists during a
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
    if (button) bindGroupToggleEvents(button);
    if (body) body.id = bodyId(group);
    setGroupOpen(group, shell, desiredGroupOpen(group, shell.dataset.rpoOpen !== 'false'), { remember: false });
    return shell;
  }


  function ensurePanelScrollContainment(tab) {
    const panel = panelFor(tab);
    if (!panel) return false;
    panel.classList.add('rpo-scroll-containment');
    // Inline fallbacks make this survive stale CSS ordering/cache on iPad Safari.
    panel.style.minHeight = '0px';
    panel.style.height = '0px';
    panel.style.flex = '1 1 0px';
    panel.style.overflowY = 'auto';
    panel.style.overflowX = 'hidden';
    panel.style.webkitOverflowScrolling = 'touch';
    panel.style.overscrollBehavior = 'contain';
    panel.style.touchAction = 'pan-y';
    return true;
  }

  function ensureGroupNaturalHeight(shell) {
    if (!isElement(shell)) return false;
    shell.style.flex = '0 0 auto';
    shell.style.minHeight = '0px';
    shell.style.maxHeight = 'none';
    if (shell.dataset.rpoOpen === 'true') shell.style.overflow = 'visible';
    const body = shell.querySelector?.('.right-panel-group-body');
    if (body) {
      body.style.maxHeight = 'none';
      body.style.overflow = 'visible';
      body.style.flex = '0 0 auto';
    }
    return true;
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
    target.style.overflow = desired ? 'visible' : 'hidden';
    ensurePanelScrollContainment(group.tab);
    ensureGroupNaturalHeight(target);

    const button = target.querySelector('.right-panel-group-summary');
    if (button) button.setAttribute('aria-expanded', desired ? 'true' : 'false');

    const body = target.querySelector('.right-panel-group-body');
    if (body) {
      body.hidden = !desired;
      body.setAttribute('aria-hidden', desired ? 'false' : 'true');
      body.style.display = desired ? '' : 'none';
      if (desired) {
        body.style.maxHeight = 'none';
        body.style.overflow = 'visible';
        body.style.flex = '0 0 auto';
      }
    }

    if (options.remember !== false) rememberOpen(group, desired);
    return desired;
  }


  function controlKeyFor(target, action = '') {
    if (!target) return '';
    return [
      action || target.getAttribute?.('data-rpo-action') || target.getAttribute?.('data-rpo-group-toggle') || '',
      target.id || '',
      target.getAttribute?.('data-rpo-tab') || '',
      target.getAttribute?.('data-rpo-group-toggle') || ''
    ].join('|');
  }

  function shouldSkipDuplicateControl(target, action = '') {
    const key = controlKeyFor(target, action);
    const now = Date.now();
    if (key && lastHandledControl.id === key && now - lastHandledControl.time < 220) return true;
    lastHandledControl = { id: key, time: now };
    return false;
  }

  function stopControlEvent(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (typeof event?.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  }

  function bindControlEvents(node, handler) {
    if (!node || node.dataset.rpoBoundStage17k === 'true') return;
    node.dataset.rpoBoundStage17k = 'true';
    ['pointerdown', 'mousedown', 'touchend', 'click'].forEach((type) => {
      node.addEventListener(type, (event) => {
        stopControlEvent(event);
        handler(event);
      }, true);
    });
    node.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      stopControlEvent(event);
      handler(event);
    }, true);
  }

  function bindGroupToggleEvents(node) {
    if (!node || node.dataset.rpoGroupBoundStage17k === 'true') return;
    node.dataset.rpoGroupBoundStage17k = 'true';
    // Group headers must toggle exactly once per user activation.  Earlier
    // versions listened to pointerdown, mousedown, touchend, and click; on real
    // browsers that can open on mousedown and close again on click, making
    // individual section headers look dead.  Bulk buttons are idempotent and can
    // keep the aggressive multi-event binding, but group headers use click/keys.
    node.addEventListener('click', handleGroupToggleEvent, true);
    node.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      handleGroupToggleEvent(event);
    }, true);
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
    let button = event?.target?.closest?.('[data-rpo-group-toggle]') || null;
    if (!button && event?.currentTarget?.matches?.('[data-rpo-group-toggle]')) button = event.currentTarget;

    // Chromium/Safari hit testing can sometimes return the group shell rather
    // than the nested button even though the button is visible.  Treat clicks on
    // the shell's header area as header toggles, while leaving clicks inside an
    // open body alone so form controls inside cards still work normally.
    if (!button) {
      const shellTarget = event?.target?.closest?.('.right-panel-group');
      if (shellTarget && !event?.target?.closest?.('.right-panel-group-body')) {
        button = shellTarget.querySelector?.('[data-rpo-group-toggle]') || null;
      }
    }

    if (!button) return false;
    const shell = button.closest?.('.right-panel-group');
    if (!shell) return false;
    stopControlEvent(event);
    if (shouldSkipDuplicateControl(button, 'group-toggle')) return true;
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
      '<div class="right-panel-organizer-label">',
      '<div class="smallcaps">Sections</div>',
      `<strong>${tab === 'settings' ? 'Settings' : 'Copilot'}</strong>`,
      '</div>',
      '<div class="right-panel-organizer-actions">',
      `<button class="btn mini" type="button" title="Expand all ${tab} sections" data-rpo-action="expand" data-rpo-tab="${tab}" onclick="window.LatexaiRightPanelExpandAll && window.LatexaiRightPanelExpandAll('${tab}'); return false;">Expand all</button>`,
      `<button class="btn mini" type="button" title="Collapse all ${tab} sections" data-rpo-action="collapse" data-rpo-tab="${tab}" onclick="window.LatexaiRightPanelCollapseAll && window.LatexaiRightPanelCollapseAll('${tab}'); return false;">Collapse all</button>`,
      `<button class="btn mini" type="button" title="Re-scan ${tab} sections" data-rpo-action="refresh" data-rpo-tab="${tab}" onclick="window.LuminaLatex && window.LuminaLatex.RightPanelOrganizerService && window.LuminaLatex.RightPanelOrganizerService.organize && window.LuminaLatex.RightPanelOrganizerService.organize('${tab}'); return false;">Refresh</button>`,
      '</div>'
    ].join('');

    panel.insertBefore(toolbar, panel.firstChild);
    toolbar.querySelectorAll('[data-rpo-action]').forEach((button) => {
      bindControlEvents(button, handleOrganizerButtonEvent);
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


  function unwrapOrganizerGroups(tab) {
    const panel = panelFor(tab);
    if (!panel) return false;
    const toolbar = el(`rightPanelOrganizerToolbar-${tab}`);
    if (toolbar) toolbar.remove();
    Array.from(panel.querySelectorAll(`.right-panel-group[data-group-tab="${tab}"]`)).forEach((group) => {
      const body = group.querySelector('.right-panel-group-body');
      if (body) {
        while (body.firstChild) panel.insertBefore(body.firstChild, group);
      }
      group.remove();
    });
    panel.classList.remove('rpo-scroll-containment');
    panel.style.height = '';
    panel.style.minHeight = '';
    panel.style.flex = '';
    panel.style.overflowY = '';
    panel.style.overflowX = '';
    panel.style.webkitOverflowScrolling = '';
    panel.style.overscrollBehavior = '';
    panel.style.touchAction = '';
    return true;
  }

  function normalizeBulkTabs(tab = 'all') {
    // Stage 19W29: keep the drawer UI for Settings only.  Workflow tools now live
    // in dedicated right tabs, so the organizer must not rewrap Copilot/workflow
    // content or pull GitHub controls into the generic catch-all drawer.
    if (tab === 'settings') return ['settings'];
    if (tab === 'all' || !tab) return ['settings'];
    return [];
  }

  function setAllGroupsOne(tab, open) {
    const desired = Boolean(open);
    const panel = panelFor(tab);
    if (!panel) return false;

    ensureToolbar(tab);
    organize(tab);
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
    // Copilot should stay in the newer workflow layout; Settings keeps drawers.
    unwrapOrganizerGroups('copilot');
    const tabs = tab ? normalizeBulkTabs(tab) : ['settings'];

    for (const t of tabs) {
      const panel = panelFor(t);
      if (!panel) continue;
      ensurePanelScrollContainment(t);

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

        for (const card of cards) {
          const beforePanel = panelForNode(card);
          if (beforePanel !== panel || !nodeAllowedForTab(card, t) || isCardMisplaced(card)) continue;
          body.appendChild(card);
        }

        const count = el(`${groupId(group)}Count`);
        if (count) count.textContent = String(body.children.length);
        shell.classList.toggle('empty', body.children.length === 0);
        setGroupOpen(group, shell, desiredGroupOpen(group, shell.dataset.rpoOpen !== 'false'), { remember: false });
      }
    }

    setStatus('Right panel sections organized.');
    return true;
  }


  function activeRightTabName() {
    const activeButton = D.querySelector('.right-tab.active');
    const fromButton = activeButton?.dataset?.tab || clean(activeButton?.textContent || '').toLowerCase();
    if (fromButton) return fromButton;
    const activePanel = D.querySelector('.right-tab-panel.active');
    if (!activePanel) return 'none';
    return activePanel.id === 'settingsTab' ? 'settings' : (activePanel.id === 'copilotTab' ? 'copilot' : activePanel.id || 'unknown');
  }

  function isVisibleNode(node) {
    if (!isElement(node)) return false;
    if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
    const cs = W.getComputedStyle ? W.getComputedStyle(node) : null;
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
    return Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects?.().length);
  }

  function visibleUngroupedCards(tab) {
    const panel = panelFor(tab);
    if (!panel) return [];
    return Array.from(panel.children).filter((node) => {
      if (!isElement(node)) return false;
      if (node.classList.contains('right-panel-group')) return false;
      if (node.classList.contains('right-panel-organizer-toolbar')) return false;
      if (node.id && node.id.startsWith('rightPanelOrganizer')) return false;
      return isVisibleNode(node);
    });
  }

  function overlayDiagnostics() {
    const bootBox = D.querySelector('.boot-error-box');
    const errors = Array.isArray(W.LUMINA_LATEX_BOOT_ERRORS) ? W.LUMINA_LATEX_BOOT_ERRORS : [];
    const visible = isVisibleNode(bootBox);
    return {
      present: Boolean(bootBox),
      visible,
      errorCount: errors.length,
      lastError: errors.length ? String(errors[errors.length - 1]).slice(0, 180) : ''
    };
  }

  function toolbarHitTest(tab) {
    const toolbar = el(`rightPanelOrganizerToolbar-${tab}`);
    if (!toolbar || !toolbar.getBoundingClientRect || !D.elementFromPoint) return 'not available';
    const rect = toolbar.getBoundingClientRect();
    if (!rect.width || !rect.height) return 'toolbar not visible';
    const x = Math.min(Math.max(rect.left + rect.width * 0.55, 0), Math.max(0, W.innerWidth - 1));
    const y = Math.min(Math.max(rect.top + Math.min(rect.height * 0.55, 34), 0), Math.max(0, W.innerHeight - 1));
    const hit = D.elementFromPoint(x, y);
    if (!hit) return 'no hit target';
    if (toolbar.contains(hit)) return 'ok';
    const label = hit.className ? `.${String(hit.className).trim().replace(/\s+/g, '.')}` : hit.tagName;
    return `blocked by ${label}`;
  }

  function knownCardPlacementRows() {
    return Object.keys(KNOWN_CARD_OWNERS).sort().map((id) => {
      const node = el(id);
      const expected = KNOWN_CARD_OWNERS[id].join('|');
      const actual = node ? (tabForNode(node) || 'outside right tabs') : 'missing';
      const ok = node ? KNOWN_CARD_OWNERS[id].includes(actual) : false;
      return { id, expected, actual, ok };
    });
  }

  function misplacedKnownCards() {
    return knownCardPlacementRows().filter((row) => row.actual !== 'missing' && !row.ok);
  }

  function tabCardCount(tab) {
    const panel = panelFor(tab);
    if (!panel) return { tab, present: false, direct: 0, grouped: 0, total: 0 };
    const groups = Array.from(panel.querySelectorAll('.right-panel-group-body'));
    const grouped = groups.reduce((sum, body) => sum + body.children.length, 0);
    const direct = Array.from(panel.children).filter((node) => {
      if (!isElement(node)) return false;
      if (node.classList.contains('right-panel-group') || node.classList.contains('right-panel-organizer-toolbar')) return false;
      if (node.id && node.id.startsWith('rightPanelOrganizer')) return false;
      return true;
    }).length;
    return { tab, present: true, direct, grouped, total: direct + grouped };
  }

  function figuresTabHealth() {
    const panel = panelFor('assets');
    const rows = FIGURES_REQUIRED_IDS.map(([id, label]) => {
      const node = el(id);
      const actual = node ? (tabForNode(node) || 'outside right tabs') : 'missing';
      const ok = Boolean(node && actual === 'assets');
      return { id, label, ok, actual };
    });
    return {
      present: Boolean(panel),
      ok: Boolean(panel) && rows.every((row) => row.ok),
      rows
    };
  }

  function tabIntegritySummary() {
    const misplaced = misplacedKnownCards();
    const figures = figuresTabHealth();
    return {
      ok: misplaced.length === 0 && figures.ok,
      misplaced,
      figures,
      counts: ['copilot', 'settings', 'assets'].map(tabCardCount)
    };
  }

  function panelDiagnostics(tab) {
    const panel = panelFor(tab);
    if (!panel) return `${tab}: missing`;
    const cs = W.getComputedStyle ? W.getComputedStyle(panel) : null;
    const ungrouped = visibleUngroupedCards(tab);
    const scrollable = panel.scrollHeight > panel.clientHeight + 2;
    return `${tab}: active=${panel.classList.contains('active') ? 'yes' : 'no'}, display=${cs?.display || 'n/a'}, overflowY=${cs?.overflowY || 'n/a'}, client=${panel.clientHeight}, scroll=${panel.scrollHeight}, scrollTop=${panel.scrollTop}, scrollable=${scrollable ? 'yes' : 'no'}, visible ungrouped=${ungrouped.length}, hit-test=${toolbarHitTest(tab)}`;
  }

  function currentReport() {
    const lines = [
      'Latexai right panel organization report',
      '=======================================',
      '',
      `Stage: ${STAGE}`,
      `Generated: ${new Date().toISOString()}`,
      `Active right tab: ${activeRightTabName()}`,
      ''
    ];

    const overlay = overlayDiagnostics();
    lines.push(`Boot overlay: ${overlay.present ? 'present' : 'absent'}${overlay.visible ? ', visible' : ''}; boot errors=${overlay.errorCount}`);
    if (overlay.lastError) lines.push(`Last boot error: ${overlay.lastError}`);
    lines.push(`Panel scroll / hit-test: ${panelDiagnostics('copilot')}`);
    lines.push(`Panel scroll / hit-test: ${panelDiagnostics('settings')}`);
    if (panelFor('assets')) lines.push(`Panel scroll / hit-test: ${panelDiagnostics('assets')}`);

    const integrity = tabIntegritySummary();
    lines.push(`Tab integrity: ${integrity.ok ? 'ok' : 'problem'}`);
    integrity.counts.forEach((count) => {
      lines.push(`Tab card count: ${count.tab}: ${count.present ? `${count.total} total (${count.grouped} grouped, ${count.direct} direct)` : 'missing panel'}`);
    });
    if (integrity.misplaced.length) {
      integrity.misplaced.forEach((row) => lines.push(`Misplaced known card: #${row.id} expected ${row.expected}, actual ${row.actual}`));
    } else {
      lines.push('Misplaced known cards: none');
    }
    lines.push(`Figures tab tools: ${integrity.figures.ok ? 'ok' : 'problem'}${integrity.figures.present ? '' : ' (missing Figures tab)'}`);
    integrity.figures.rows.forEach((row) => lines.push(`  - ${row.label}: ${row.ok ? 'ok' : `missing/wrong tab (${row.actual})`}`));
    lines.push('');

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
    [].forEach((tab) => {
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
      btn.title = 'Copy right-panel organization report';
      btn.textContent = 'Report';
      bindControlEvents(btn, handleOrganizerButtonEvent);
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
    stopControlEvent(event);
    const action = getButtonAction(button);
    if (shouldSkipDuplicateControl(button, action)) return true;
    return handleOrganizerButton(button);
  }

  function installDelegatedHandlers() {
    if (D.documentElement.dataset.stage17kOrganizerButtonShell === 'true') return;
    D.documentElement.dataset.stage17kOrganizerButtonShell = 'true';

    const routePointerEvent = (event) => {
      const groupButton = event.target?.closest?.('[data-rpo-group-toggle]');
      const groupShell = !groupButton ? event.target?.closest?.('.right-panel-group') : null;
      if (groupButton || (groupShell && !event.target?.closest?.('.right-panel-group-body'))) {
        if (event.type !== 'click' && event.type !== 'keydown') return false;
        return handleGroupToggleEvent(event);
      }
      return handleOrganizerButtonEvent(event);
    };
    ['pointerdown', 'mousedown', 'touchend', 'click'].forEach((type) => {
      D.addEventListener(type, routePointerEvent, true);
    });
    D.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      routePointerEvent(event);
    }, true);
  }

  function init() {
    clearLegacyForcedState();
    // Keep Copilot/workflow panels in the newer left-tab layout, but restore
    // clean Settings drawers with a dedicated GitHub backend section.
    unwrapOrganizerGroups('copilot');
    installDelegatedHandlers();
    organize('settings');
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
    tabIntegritySummary,
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

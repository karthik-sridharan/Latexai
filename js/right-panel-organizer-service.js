/* Latexai Stage 17J RightPanelOrganizerService
 * Stage: stage17j3-right-panel-organizer-buttons-hotfix-1
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
  const STAGE = 'stage17j3-right-panel-organizer-buttons-hotfix-1';
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

  function findCards(group) {
    const seen = new Set();
    const cards = [];

    for (const id of group.cardIds) {
      const node = el(id);
      if (node && !seen.has(node)) {
        seen.add(node);
        cards.push(node);
      }
    }

    // Fallback semantic matching for older cards whose ids changed.
    const panel = panelFor(group.tab);
    if (!panel) return cards;

    const titleNeedles = {
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
        if (!(node instanceof HTMLElement)) return;
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
      details.open = isOpen(group);

      const summary = D.createElement('summary');
      summary.className = 'right-panel-group-summary';
      summary.innerHTML = [
        `<span class="right-panel-group-title">${escapeHtml(group.title)}</span>`,
        `<span class="right-panel-group-count" id="${groupId(group)}Count">0</span>`
      ].join('');

      const body = D.createElement('div');
      body.id = bodyId(group);
      body.className = 'right-panel-group-body';

      details.appendChild(summary);
      details.appendChild(body);
      details.addEventListener('toggle', () => rememberOpen(group, details.open), true);
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
      `<button class="btn mini" type="button" data-rpo-expand="${tab}">Expand all</button>`,
      `<button class="btn mini" type="button" data-rpo-collapse="${tab}">Collapse all</button>`,
      `<button class="btn mini" type="button" data-rpo-refresh="${tab}">Refresh sections</button>`,
      '</div>'
    ].join('');

    panel.insertBefore(toolbar, panel.firstChild);

    toolbar.querySelector('[data-rpo-expand]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setAllGroups(tab, true);
    }, true);
    toolbar.querySelector('[data-rpo-collapse]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setAllGroups(tab, false);
    }, true);
    toolbar.querySelector('[data-rpo-refresh]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      organize(tab);
    }, true);

    return toolbar;
  }

  function setAllGroups(tab, open) {
    const desired = Boolean(open);
    GROUPS.filter((group) => group.tab === tab).forEach((group) => {
      rememberOpen(group, desired);
      const details = el(groupId(group)) || ensureGroup(group);
      if (details) {
        details.open = desired;
        if (desired) details.setAttribute('open', '');
        else details.removeAttribute('open');
      }
    });
    setStatus(`${tab === 'settings' ? 'Settings' : 'Copilot'} sections ${desired ? 'expanded' : 'collapsed'}.`);
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

  function setStatus(message) {
    let node = el('rightPanelOrganizerStatus');
    if (!node) {
      const toolbar = el('rightPanelOrganizerToolbar-copilot') || el('rightPanelOrganizerToolbar-settings');
      if (!toolbar) return;
      node = D.createElement('div');
      node.id = 'rightPanelOrganizerStatus';
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
      btn.textContent = 'Copy report';
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        copyReport();
      }, true);
      actions?.appendChild(btn);
    });
  }

  function installDelegatedButtonHandlers() {
    if (D.documentElement.dataset.stage17j3DelegatedOrganizerButtons === 'true') return;
    D.documentElement.dataset.stage17j3DelegatedOrganizerButtons = 'true';

    D.addEventListener('click', (event) => {
      const button = event.target?.closest?.('[data-rpo-expand], [data-rpo-collapse], [data-rpo-refresh], [data-rpo-copy-report]');
      if (!button) return;

      const tab = button.dataset.rpoExpand || button.dataset.rpoCollapse || button.dataset.rpoRefresh || button.dataset.rpoCopyReport || 'copilot';
      if (!['copilot', 'settings'].includes(tab)) return;

      event.preventDefault();
      event.stopPropagation();

      if (button.dataset.rpoExpand) {
        setAllGroups(tab, true);
      } else if (button.dataset.rpoCollapse) {
        setAllGroups(tab, false);
      } else if (button.dataset.rpoRefresh) {
        organize(tab);
      } else if (button.dataset.rpoCopyReport) {
        copyReport();
      }
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
    copyReport
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

// LatexAI Stage 19W16: move workflow/tools to the left panel and keep right panel for Preview/Logs only.
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'latex-stage19w20-audit-ai-header-subtab-stability-20260604-1';
  const STORAGE_LEFT_TAB = 'latexai:stage19w16:left-tool-tab';
  const STORAGE_RIGHT_TAB = 'latexai:stage19w16:right-output-tab';
  const STORAGE_AUDIT_SUBTAB = 'latexai:stage19w19:audit-ai-subtab';

  function el(id) { return D.getElementById(id); }
  function q(sel, root) { return (root || D).querySelector(sel); }
  function qa(sel, root) { return Array.from((root || D).querySelectorAll(sel)); }
  function cssEscape(value) {
    if (W.CSS && typeof W.CSS.escape === 'function') return W.CSS.escape(String(value));
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function clean(value) { return String(value == null ? '' : value).trim(); }

  function make(tag, attrs = {}, html = '') {
    const node = D.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v || {});
      else node.setAttribute(k, v);
    });
    if (html) node.innerHTML = html;
    return node;
  }

  function stageBadge() {
    const badge = el('stageBadge');
    if (badge) badge.textContent = STAGE;
  }

  function ensureLeftShell() {
    const left = q('.left-panel');
    if (!left) return null;
    left.classList.add('stage19w16-left-tools');

    let tabs = el('stage19w16LeftTabs');
    let content = el('stage19w16LeftContent');
    if (!tabs) {
      tabs = make('div', { id: 'stage19w16LeftTabs', class: 'stage19w16-left-tabs', role: 'tablist', 'aria-label': 'Left tool tabs' });
      left.insertBefore(tabs, left.firstChild);
    }
    if (!content) {
      content = make('div', { id: 'stage19w16LeftContent', class: 'stage19w16-left-content' });
      tabs.insertAdjacentElement('afterend', content);
    }
    return { left, tabs, content };
  }

  const LEFT_TABS = [
    ['project', 'Project'],
    ['copilot', 'Audit AI'],
    ['paperAi', 'Paper AI'],
    ['literature', 'Literature'],
    ['assets', 'Figures'],
    ['presentation', 'Presentation'],
    ['context', 'Context / MCTS'],
    ['settings', 'Settings']
  ];

  function ensureLeftTabButton(tabs, name, label) {
    let btn = q(`[data-left-tool-tab="${cssEscape(name)}"]`, tabs);
    if (!btn) {
      btn = make('button', { class: 'stage19w16-left-tab', type: 'button', 'data-left-tool-tab': name }, label);
      tabs.appendChild(btn);
    } else {
      btn.textContent = label;
    }
    if (btn.dataset.stage19w16Bound !== 'true') {
      btn.dataset.stage19w16Bound = 'true';
      btn.addEventListener('click', () => activateLeftTab(name), true);
    }
    return btn;
  }

  function ensurePanel(content, name, label) {
    const id = `left${name.charAt(0).toUpperCase()}${name.slice(1)}Tab`;
    let panel = el(id);
    if (!panel) {
      panel = make('section', { id, class: 'stage19w16-left-tool-panel', 'data-left-tool-panel': name, role: 'tabpanel', 'aria-label': label });
      content.appendChild(panel);
    }
    return panel;
  }

  function bootstrapLeftProjectPanel(content) {
    const projectPanel = ensurePanel(content, 'project', 'Project files and document map');
    if (projectPanel.dataset.stage19w16Bootstrapped === 'true') return;
    projectPanel.dataset.stage19w16Bootstrapped = 'true';
    const left = q('.left-panel');
    if (!left) return;
    const movable = Array.from(left.children).filter((node) => {
      if (!node || node.nodeType !== 1) return false;
      if (node.id === 'stage19w16LeftTabs' || node.id === 'stage19w16LeftContent') return false;
      if (node.classList.contains('stage19w16-left-tabs') || node.classList.contains('stage19w16-left-content')) return false;
      return true;
    });
    movable.forEach((node) => projectPanel.appendChild(node));
  }

  function movePanelToLeft(panelId, targetName, label) {
    const shell = ensureLeftShell();
    if (!shell) return null;
    const panel = el(panelId);
    const target = ensurePanel(shell.content, targetName, label);
    if (!panel) return target;
    if (panel.parentElement !== shell.content) {
      shell.content.appendChild(panel);
    }
    panel.classList.add('stage19w16-left-tool-panel');
    panel.dataset.leftToolPanel = targetName;
    panel.setAttribute('aria-label', label);
    panel.id = panelId;
    panel.dataset.stage19w16MovedLeft = 'true';
    if (target !== panel && target.childElementCount === 0) target.remove();
    return panel;
  }

  function removeLegacyCopilotOrganizer(copilot) {
    if (!copilot) return;
    const toolbar = el('rightPanelOrganizerToolbar-copilot');
    if (toolbar) toolbar.remove();
    qa('.right-panel-group[data-group-tab="copilot"]', copilot).forEach((group) => {
      const body = q('.right-panel-group-body', group);
      if (body) {
        ['paperAiPolishCard', 'aiCommentsCard', 'aiRevisionCard', 'aiReportBrowserCard'].forEach((id) => {
          const c = el(id);
          if (c && body.contains(c)) copilot.appendChild(c);
        });
      }
      group.remove();
    });
  }

  function ensureAuditAiShell(copilot) {
    let shell = el('stage19w19AuditAiShell');
    if (!shell) {
      shell = make('div', { id: 'stage19w19AuditAiShell', class: 'stage19w19-audit-ai-shell' });
      shell.innerHTML = [
        '<div class="stage19w19-audit-tabs" role="tablist" aria-label="Audit AI sections">',
        '  <button class="stage19w19-audit-tab active" type="button" data-audit-subtab="edits">Audit AI Edits</button>',
        '  <button class="stage19w19-audit-tab" type="button" data-audit-subtab="history">History / Comments</button>',
        '</div>',
        '<section id="stage19w19AuditEditsPanel" class="stage19w19-audit-panel active" data-audit-panel="edits" role="tabpanel" aria-label="Audit AI Edits"></section>',
        '<section id="stage19w19AuditHistoryPanel" class="stage19w19-audit-panel" data-audit-panel="history" role="tabpanel" aria-label="History and comments"></section>'
      ].join('');
      const head = q(':scope > .section-head.compact', copilot);
      if (head && head.nextSibling) copilot.insertBefore(shell, head.nextSibling);
      else copilot.insertBefore(shell, copilot.firstChild);
    } else if (shell.parentElement !== copilot) {
      const head = q(':scope > .section-head.compact', copilot);
      if (head && head.nextSibling) copilot.insertBefore(shell, head.nextSibling);
      else copilot.insertBefore(shell, copilot.firstChild);
    }
    if (shell.dataset.stage19w19Bound !== 'true') {
      shell.dataset.stage19w19Bound = 'true';
      qa('[data-audit-subtab]', shell).forEach((btn) => {
        btn.addEventListener('click', () => activateAuditAiSubtab(btn.dataset.auditSubtab || 'edits'), true);
      });
    }
    return shell;
  }

  function activateAuditAiSubtab(name) {
    const shell = el('stage19w19AuditAiShell');
    if (!shell) return;
    const next = name === 'history' ? 'history' : 'edits';
    qa('[data-audit-subtab]', shell).forEach((btn) => {
      const active = (btn.dataset.auditSubtab || 'edits') === next;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    qa('[data-audit-panel]', shell).forEach((panel) => {
      const active = (panel.dataset.auditPanel || 'edits') === next;
      panel.classList.toggle('active', active);
      if (active) panel.removeAttribute('aria-hidden'); else panel.setAttribute('aria-hidden', 'true');
    });
    try { localStorage.setItem(STORAGE_AUDIT_SUBTAB, next); } catch (_e) {}
  }

  function routeAuditAiCards() {
    const editsPanel = el('stage19w19AuditEditsPanel');
    const historyPanel = el('stage19w19AuditHistoryPanel');
    if (!editsPanel || !historyPanel) return;

    const auditCard = el('paperAiPolishCard');
    if (auditCard && auditCard.parentElement !== editsPanel) editsPanel.appendChild(auditCard);

    ['aiCommentsCard', 'aiRevisionCard', 'aiReportBrowserCard'].forEach((id) => {
      const c = el(id);
      if (c && c.parentElement !== historyPanel) historyPanel.appendChild(c);
    });
  }

  function installAuditAiRouter(copilot) {
    if (!copilot || copilot.dataset.stage19w20AuditRouter === 'true') return;
    copilot.dataset.stage19w20AuditRouter = 'true';
    const schedule = () => {
      if (copilot.dataset.stage19w20AuditRoutePending === 'true') return;
      copilot.dataset.stage19w20AuditRoutePending = 'true';
      setTimeout(() => {
        copilot.dataset.stage19w20AuditRoutePending = 'false';
        routeAuditAiCards();
      }, 0);
    };
    try {
      const observer = new MutationObserver(schedule);
      observer.observe(copilot, { childList: true, subtree: true });
      copilot._stage19w20AuditObserver = observer;
    } catch (_e) {}
    [0, 100, 350, 900, 1800].forEach((delay) => setTimeout(routeAuditAiCards, delay));
  }

  function ensureAuditInCopilotPanel() {
    const copilot = el('copilotTab') || el('leftCopilotTab');
    if (!copilot) return null;
    copilot.dataset.stage19w17AuditHome = 'true';
    copilot.classList.add('stage19w18-audit-ai-only', 'stage19w19-audit-ai-tab');

    const headSmall = q(':scope > .section-head.compact .smallcaps', copilot);
    const headTitle = q(':scope > .section-head.compact h2', copilot);
    if (headSmall) headSmall.textContent = 'Audit AI';
    if (headTitle) headTitle.textContent = 'Audit AI';

    // Hide the old core Copilot prompt controls.  The direct no-review use case
    // is now handled by Paper AI with Review/debate rounds = -1.
    [
      '#aiProvider', '#aiModel', '#aiCustomModel', '#copilotTask',
      '#copilotContextChips', '#copilotPrompt', '#askCopilotBtn',
      '#previewCopilotPatchBtn', '#insertCopilotBtn', '#replaceCopilotBtn',
      '#patchReview', '#copilotOutput'
    ].forEach((sel) => {
      const node = q(sel, copilot);
      const wrapper = node?.closest?.('.field-grid, .field, .micro-actions, .patch-review') || node;
      if (wrapper) wrapper.classList.add('stage19w18-core-copilot-hidden');
    });
    const oldNote = q(':scope > .settings-note', copilot);
    if (oldNote) oldNote.classList.add('stage19w18-core-copilot-hidden');

    removeLegacyCopilotOrganizer(copilot);
    const shell = ensureAuditAiShell(copilot);
    const editsPanel = el('stage19w19AuditEditsPanel');
    const historyPanel = el('stage19w19AuditHistoryPanel');

    // Remove stale wrapper headings from the previous Audit AI layout after
    // rescuing any cards that may have been nested inside them.
    ['stage19w17CopilotAuditWrap', 'stage19w18AuditHistoryWrap'].forEach((id) => {
      const wrap = el(id);
      if (!wrap) return;
      ['paperAiPolishCard', 'aiCommentsCard', 'aiRevisionCard', 'aiReportBrowserCard'].forEach((cardId) => {
        const c = el(cardId);
        if (!c || !wrap.contains(c)) return;
        if (cardId === 'paperAiPolishCard' && editsPanel) editsPanel.appendChild(c);
        else if (historyPanel) historyPanel.appendChild(c);
      });
      wrap.remove();
    });

    routeAuditAiCards();
    installAuditAiRouter(copilot);

    let saved = 'edits';
    try { saved = localStorage.getItem(STORAGE_AUDIT_SUBTAB) || 'edits'; } catch (_e) {}
    activateAuditAiSubtab(saved);

    const staleAudit = el('leftAuditTab');
    if (staleAudit) staleAudit.remove();
    qa('[data-left-tool-tab="audit"]').forEach((btn) => btn.remove());
    return shell;
  }

  function ensurePresentationPanel(shell) {
    const panel = ensurePanel(shell.content, 'presentation', 'Presentation');
    if (panel.dataset.stage19w18PresentationBootstrapped !== 'true') {
      panel.dataset.stage19w18PresentationBootstrapped = 'true';
      panel.appendChild(make('div', { class: 'section-head compact' }, '<div><div class="smallcaps">Presentation</div><h2>Paper to presentation tools</h2></div>'));
      panel.appendChild(make('div', { class: 'settings-note compact stage19w16-tool-note' }, 'Presentation export and talk-package tools live here, separate from Audit AI.'));
    }
    ['presentationExportCard', 'talkPackageCard', 'presentationMakerCard'].forEach((id) => {
      const c = el(id);
      if (c && c.parentElement !== panel) panel.appendChild(c);
    });
    const oldGroup = el('rightPanelGroup-copilot-presentation');
    if (oldGroup && oldGroup.parentElement !== panel) panel.appendChild(oldGroup);
    return panel;
  }

  function ensureFiguresPanel(shell) {
    try { W.LuminaLatex?.AssetService?.ensureAssetTab?.(); } catch (_e) {}
    let assets = el('assetsTab');
    if (!assets) {
      assets = ensurePanel(shell.content, 'assets', 'Figures');
      assets.id = 'assetsTab';
      assets.classList.add('right-tab-panel');
      assets.innerHTML = '<div class="section-head compact"><div><div class="smallcaps">Figures</div><h2>Figure maker and assets</h2></div></div><div class="settings-note compact stage19w16-tool-note">Figure tools will appear here once the asset, TikZ, and figure services finish loading.</div>';
    }
    if (assets.parentElement !== shell.content) shell.content.appendChild(assets);
    assets.classList.add('stage19w16-left-tool-panel');
    assets.dataset.leftToolPanel = 'assets';
    assets.setAttribute('aria-label', 'Figures');
    const btn = el('assetsTabButton');
    if (btn) btn.remove();
    return assets;
  }

  function setupLeftTools() {
    const shell = ensureLeftShell();
    if (!shell) return;
    LEFT_TABS.forEach(([name, label]) => ensureLeftTabButton(shell.tabs, name, label));
    bootstrapLeftProjectPanel(shell.content);

    const copilot = movePanelToLeft('copilotTab', 'copilot', 'Audit AI');
    const paper = movePanelToLeft('paperAiTab', 'paperAi', 'Paper AI');
    const literature = movePanelToLeft('literatureTab', 'literature', 'Literature');
    const context = movePanelToLeft('projectTab', 'context', 'Context / MCTS');
    const settings = movePanelToLeft('settingsTab', 'settings', 'Settings');
    ensureFiguresPanel(shell);
    ensurePresentationPanel(shell);
    ensureAuditInCopilotPanel();

    if (context) {
      const small = q('.smallcaps', context);
      const h2 = q('.section-head h2', context);
      if (small) small.textContent = 'Context / MCTS';
      if (h2) h2.textContent = 'Block context and MCTS-lite';
    }
    if (paper) {
      const small = q(':scope > .section-head .smallcaps', paper);
      const h2 = q(':scope > .section-head h2', paper);
      if (small) small.textContent = 'Paper AI';
      if (h2) h2.textContent = 'Goal-driven Paper AI';
    }
    if (copilot) {
      const small = q(':scope > .section-head .smallcaps', copilot);
      const h2 = q(':scope > .section-head h2', copilot);
      if (small) small.textContent = 'Audit AI';
      if (h2) h2.textContent = 'Audit AI';
    }
  }

  function setupRightPreviewLogs() {
    const right = q('.right-panel');
    if (!right) return;
    right.classList.add('stage19w16-preview-logs-only');
    const tabs = q('.right-tabs', right);
    if (tabs) {
      qa('[data-right-tab]', tabs).forEach((btn) => {
        const name = btn.dataset.rightTab;
        if (name !== 'preview' && name !== 'logs') btn.remove();
      });
    }
    ['previewTab', 'logsTab'].forEach((id) => {
      const panel = el(id);
      if (panel && panel.parentElement !== right) right.appendChild(panel);
    });
    qa('[data-right-tab]', right).forEach((btn) => {
      if (btn.dataset.stage19w16Bound === 'true') return;
      btn.dataset.stage19w16Bound = 'true';
      btn.addEventListener('click', () => activateRightOutputTab(btn.dataset.rightTab || 'preview'), true);
    });
  }

  function activateRightOutputTab(name) {
    const right = q('.right-panel');
    if (!right) return;
    const next = name === 'logs' ? 'logs' : 'preview';
    qa('[data-right-tab]', right).forEach((btn) => btn.classList.toggle('active', btn.dataset.rightTab === next));
    ['previewTab', 'logsTab'].forEach((id) => {
      const panel = el(id);
      if (!panel) return;
      const active = id === `${next}Tab`;
      panel.classList.toggle('active', active);
      if (active) panel.removeAttribute('aria-hidden'); else panel.setAttribute('aria-hidden', 'true');
    });
    try { localStorage.setItem(STORAGE_RIGHT_TAB, next); } catch (_e) {}
  }

  function activateLeftTab(name) {
    const shell = ensureLeftShell();
    if (!shell) return;
    let next = clean(name || 'project');
    if (next === 'projectTab') next = 'context';
    if (next === 'audit') next = 'copilot';
    const valid = new Set(LEFT_TABS.map((x) => x[0]));
    if (!valid.has(next)) next = 'project';
    qa('[data-left-tool-tab]', shell.tabs).forEach((btn) => btn.classList.toggle('active', btn.dataset.leftToolTab === next));
    qa('.stage19w16-left-tool-panel', shell.content).forEach((panel) => {
      const active = panel.dataset.leftToolPanel === next || panel.id === `left${next.charAt(0).toUpperCase()}${next.slice(1)}Tab`;
      panel.classList.toggle('active', active);
      if (active) panel.removeAttribute('aria-hidden'); else panel.setAttribute('aria-hidden', 'true');
    });
    try { localStorage.setItem(STORAGE_LEFT_TAB, next); } catch (_e) {}
  }

  function restoreTabs() {
    let left = 'project';
    let right = 'preview';
    try { left = localStorage.getItem(STORAGE_LEFT_TAB) || 'project'; } catch (_e) {}
    try { right = localStorage.getItem(STORAGE_RIGHT_TAB) || 'preview'; } catch (_e) {}
    activateLeftTab(left);
    activateRightOutputTab(right);
  }

  function patchStage19W10Api() {
    const svc = NS.Stage19W10WorkflowTabsService;
    if (!svc || svc.datasetStage19w16Patched) return;
    svc.datasetStage19w16Patched = true;
    const originalReconcile = svc.reconcile;
    svc.activateWorkflow = function () { activateLeftTab('paperAi'); if (typeof originalReconcile === 'function') originalReconcile(); return true; };
    svc.jumpToWorkflow = svc.activateWorkflow;
    svc.activateLeftToolTab = activateLeftTab;
  }

  function reconcile() {
    stageBadge();
    setupLeftTools();
    setupRightPreviewLogs();
    patchStage19W10Api();
    restoreTabs();
  }

  function init() {
    reconcile();
    [150, 500, 1200, 2600, 5200].forEach((ms) => setTimeout(reconcile, ms));
    const root = q('.workspace') || D.body;
    if (root && root.dataset.stage19w16Observed !== 'true') {
      root.dataset.stage19w16Observed = 'true';
      let timer = null;
      const obs = new MutationObserver(() => {
        if (timer) return;
        timer = setTimeout(() => { timer = null; setupLeftTools(); setupRightPreviewLogs(); patchStage19W10Api(); }, 100);
      });
      obs.observe(root, { childList: true, subtree: true });
    }
  }

  NS.Stage19W16LeftToolTabsService = {
    stage: STAGE,
    init,
    reconcile,
    activateLeftTab,
    activateRightOutputTab
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

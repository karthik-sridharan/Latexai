// LatexAI Stage 19W16: move workflow/tools to the left panel and keep right panel for Preview/Logs only.
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'latex-stage19w17-copilot-audit-left-panel-narrower-20260604-1';
  const STORAGE_LEFT_TAB = 'latexai:stage19w16:left-tool-tab';
  const STORAGE_RIGHT_TAB = 'latexai:stage19w16:right-output-tab';

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
    ['copilot', 'Copilot'],
    ['paperAi', 'Paper AI'],
    ['literature', 'Literature'],
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

  function ensureAuditInCopilotPanel() {
    const copilot = el('copilotTab') || el('leftCopilotTab');
    if (!copilot) return null;
    copilot.dataset.stage19w17AuditHome = 'true';

    let auditWrap = el('stage19w17CopilotAuditWrap');
    if (!auditWrap) {
      auditWrap = make('div', { id: 'stage19w17CopilotAuditWrap', class: 'stage19w17-copilot-audit-wrap' });
      auditWrap.appendChild(make('div', { class: 'section-head compact' }, '<div><div class="smallcaps">Audit AI Edits</div><h2>Review and resolve AI edits</h2></div>'));
      auditWrap.appendChild(make('div', { class: 'settings-note compact stage19w16-tool-note' }, 'Review, accept, reject, repair, and clean up <code>\\lai</code> / <code>\\laiold</code> edits. This lives inside Copilot because it audits local visible AI edit markup, not a separate top-level workflow.'));
    }

    const output = el('copilotOutput');
    if (output && output.parentElement === copilot) {
      output.insertAdjacentElement('afterend', auditWrap);
    } else if (auditWrap.parentElement !== copilot) {
      copilot.appendChild(auditWrap);
    }

    const card = el('paperAiPolishCard');
    if (card && card.parentElement !== auditWrap) auditWrap.appendChild(card);

    const staleAudit = el('leftAuditTab');
    if (staleAudit) staleAudit.remove();
    qa('[data-left-tool-tab="audit"]').forEach((btn) => btn.remove());
    return auditWrap;
  }

  function setupLeftTools() {
    const shell = ensureLeftShell();
    if (!shell) return;
    LEFT_TABS.forEach(([name, label]) => ensureLeftTabButton(shell.tabs, name, label));
    bootstrapLeftProjectPanel(shell.content);

    const copilot = movePanelToLeft('copilotTab', 'copilot', 'Copilot');
    const paper = movePanelToLeft('paperAiTab', 'paperAi', 'Paper AI');
    const literature = movePanelToLeft('literatureTab', 'literature', 'Literature');
    const context = movePanelToLeft('projectTab', 'context', 'Context / MCTS');
    const settings = movePanelToLeft('settingsTab', 'settings', 'Settings');
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
      if (small) small.textContent = 'AI Copilot';
      if (h2) h2.textContent = 'Local editing assistant';
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
